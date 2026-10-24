/* Reads data/wiki_data.json — the file exported from the mod — and normalises it
   into the shape the wiki pages consume.

   data/wiki_data.json is the single source of truth and is never edited by hand:
   re-export it from the mod, drop it in, and every page follows. Everything below
   only reads and reshapes; no value is invented. When the exporter adds a field,
   it lands here untouched until a page asks for it. */

(function (OW) {
  'use strict';

  /* La langue source du wiki et du JSON. La langue d'affichage vient de
     js/i18n.js : si l'export la contient (en_us, es_es...), elle passe
     devant ; sinon on retombe sur le francais. */
  const LANG = 'fr_fr';
  const displayLang = () => (OW.i18n && OW.i18n.mc) || LANG;

  /* Entities the export ships but the wiki does not publish yet. Secret ones are
     not listed here — a name in this file would be readable by anyone: they are
     removed from data/wiki_data.json itself by tools/publish-data.py (list in
     tools/hidden.json, never served). This list only takes entities that may be
     named publicly. `allEntities` always holds the full export. */
  const HIDDEN_ENTITIES = [];

  /* Blocs et objets que le wiki n'affiche JAMAIS, par regle : tout ce qui
     repond a l'une d'elles est ecarte des le chargement, donc de la page
     Objets, de la recherche et du reste. Une regle couvre aussi les ajouts
     futurs du mod : le prochain oeuf d'apparition disparait tout seul.
     (Les objets secrets, eux, se retirent dans tools/hidden.json.) */
  const NEVER_SHOWN = [
    /* Les oeufs d'apparition : ow:tiger_spawn_egg, classe DeferredSpawnEggItem. */
    (x) => /_spawn_egg$/.test(x.id || '') || /SpawnEgg/.test(x.class || '')
  ];
  const shown = (x) => !NEVER_SHOWN.some((rule) => rule(x));

  /* ---- small helpers ------------------------------------------------------- */

  /**
   * Retire les codes de mise en forme de Minecraft (§l, §r, §d…).
   *
   * Le mod ecrit ses textes avec ces codes. Le champ "plain" de l'export les a
   * deja retires, mais la traduction, elle, les conserve — et c'est la
   * traduction qu'on affiche. Sans ce nettoyage, la fiche du tigre s'ouvrait
   * sur « Le §l§n§dTigre§r est un §lfelin§r sauvage ».
   *
   * trRaw() reste la porte d'entree pour qui veut les codes : c'est elle que
   * formatMinecraftText() utilise pour rendre le gras et le souligne voulus
   * par l'auteur.
   */
  function stripFormatCodes(raw) {
    return String(raw == null ? '' : raw).replace(/§./g, '');
  }

  /** Texte d affichage, dans la langue du wiki, sans code de mise en forme. */
  function tr(bag, fallback) {
    if (!bag) return fallback === undefined ? '' : fallback;
    if (typeof bag === 'string') return stripFormatCodes(bag);
    const want = displayLang();
    if (want !== LANG) {
      if (bag[want] != null) return stripFormatCodes(bag[want]);
      if (bag.translations && bag.translations[want] != null) return stripFormatCodes(bag.translations[want]);
    }
    if (bag[LANG] != null) return stripFormatCodes(bag[LANG]);
    if (bag.translations && bag.translations[LANG] != null) return stripFormatCodes(bag.translations[LANG]);
    if (bag.plain != null) return stripFormatCodes(bag.plain);
    const first = Object.keys(bag)[0];
    return first ? stripFormatCodes(bag[first]) : fallback === undefined ? '' : fallback;
  }

  /** Same as tr(), but keeps the raw string with its Minecraft § formatting codes. */
  function trRaw(bag) {
    if (!bag) return '';
    if (typeof bag === 'string') return bag;
    const want = displayLang();
    if (want !== LANG && bag.translations && bag.translations[want] != null) return bag.translations[want];
    if (want !== LANG && bag[want] != null) return bag[want];
    if (bag.translations && bag.translations[LANG] != null) return bag.translations[LANG];
    return bag.plain || '';
  }

  const round = (v, decimals) => {
    if (v == null || isNaN(v)) return null;
    const p = Math.pow(10, decimals == null ? 1 : decimals);
    return Math.round(v * p) / p;
  };

  const shortId = (id) => String(id || '').replace(/^.*:/, '');

  /* Les arenes ne sont pas des biomes, meme si le registre les range comme
     tels. Accepte un id ('ow:arena') ou une entree de worldgen ({ id, constant }). */
  function isArenaBiome(entry) {
    const id = typeof entry === 'string' ? entry : (entry && entry.id) || '';
    const constant = (entry && entry.constant) || '';
    return /^arena(_|$)/.test(shortId(id)) || /^ARENA(_|$)/.test(constant);
  }

  const TICKS_PER_SECOND = 20;

  /* ---- Minecraft formatting codes ----------------------------------------- */

  /* The mod writes lore with § codes. `plain` has them stripped; the translated
     string keeps them, so we render the emphasis the author actually wrote. */
  const FORMAT_CODES = {
    l: 'strong',
    n: 'u',
    o: 'em',
    m: 's'
  };

  function formatMinecraftText(raw) {
    const text = String(raw || '');
    if (text.indexOf('§') === -1) return escapeHtml(text);

    let html = '';
    let open = [];
    let i = 0;

    const closeAll = () => {
      while (open.length) html += '</' + open.pop() + '>';
    };

    while (i < text.length) {
      const ch = text[i];
      if (ch === '§' && i + 1 < text.length) {
        const code = text[i + 1].toLowerCase();
        if (code === 'r') {
          closeAll();
        } else if (FORMAT_CODES[code]) {
          const tag = FORMAT_CODES[code];
          if (open.indexOf(tag) === -1) {
            open.push(tag);
            html += '<' + tag + '>';
          }
        }
        /* colour codes (0-9, a-f) carry no meaning on a light/dark themed page,
           so they are dropped rather than forced onto the palette. */
        i += 2;
        continue;
      }
      html += escapeHtml(ch);
      i += 1;
    }
    closeAll();
    return html;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Ability descriptions carry %s placeholders the mod fills in at runtime. */
  function stripPlaceholders(text) {
    return String(text || '')
      .replace(/%\d*\$?s/g, '…')
      .replace(/\s*%\s*/g, ' % ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Certains noms d'objets sont remplis par le jeu : « Âme de %s » prend le nom
     de la bete morte (AnimalSoulItem.getName). Hors jeu, on met le mot juste. */
  const NAME_FILL = { 'ow:animal_soul': 'compagnon' };

  function itemName(it) {
    const name = tr(it.names);
    return /%\d*\$?s/.test(name || '') ? name.replace(/%\d*\$?s/g, NAME_FILL[it.id] || '…') : name;
  }

  /* ---- name index ---------------------------------------------------------- */

  /* Resolves `ow:raw_boa` / `minecraft:leather` to a display name. Built from the
     items, blocks and entities the exporter ships; anything unknown degrades to a
     readable version of its path rather than showing a raw id. */
  function buildNameIndex(raw) {
    const index = {};
    const add = (id, name) => {
      if (!id || !name) return;
      index[id] = name;
    };
    (raw.items || []).forEach((it) => add(it.id, itemName(it)));
    (raw.blocks || []).forEach((b) => add(b.id, tr(b.names)));
    (raw.entities || []).forEach((e) => add(e.id, tr(e.names)));
    return index;
  }

  const VANILLA_NAMES = {
    'minecraft:leather': 'Cuir',
    'minecraft:iron_ingot': 'Lingot de fer',
    'minecraft:gold_ingot': "Lingot d'or",
    'minecraft:diamond': 'Diamant',
    'minecraft:emerald': 'Émeraude',
    'minecraft:stick': 'Bâton',
    'minecraft:string': 'Ficelle',
    'minecraft:redstone': 'Poudre de redstone',
    'minecraft:shield': 'Bouclier',
    'minecraft:salmon': 'Saumon cru',
    'minecraft:cod': 'Morue crue',
    'minecraft:beef': 'Bœuf cru',
    'minecraft:porkchop': 'Porc cru',
    'minecraft:chicken': 'Poulet cru',
    'minecraft:mutton': 'Mouton cru',
    'minecraft:rabbit': 'Lapin cru',
    'minecraft:wheat': 'Blé',
    'minecraft:sugar': 'Sucre',
    'minecraft:honeycomb': 'Rayon de miel',
    'minecraft:honey_bottle': 'Fiole de miel',
    'minecraft:bamboo': 'Bambou',
    'minecraft:bone': 'Os',
    'minecraft:feather': 'Plume',
    'minecraft:flint': 'Silex',
    'minecraft:coal': 'Charbon',
    'minecraft:oak_planks': 'Planches de chêne',
    'minecraft:acacia_planks': "Planches d'acacia",
    'minecraft:barrier': 'Laine',

    /* La nourriture d'apprivoisement (taming.food_tags), telle que le jeu la
       nomme en francais ; les etiquettes #ow: regroupent plusieurs oeufs. */
    'minecraft:apple': 'Pomme',
    'minecraft:baked_potato': 'Pomme de terre cuite',
    'minecraft:beetroot': 'Betterave',
    'minecraft:brown_mushroom': 'Champignon brun',
    'minecraft:red_mushroom': 'Champignon rouge',
    'minecraft:cake': 'Gâteau',
    'minecraft:carrot': 'Carotte',
    'minecraft:chorus_fruit': 'Fruit de chorus',
    'minecraft:dried_kelp': 'Algues séchées',
    'minecraft:kelp': 'Algues',
    'minecraft:egg': 'Œuf',
    'minecraft:turtle_egg': 'Œuf de tortue',
    'minecraft:sniffer_egg': 'Œuf de renifleur',
    'minecraft:glow_berries': 'Baies lumineuses',
    'minecraft:sweet_berries': 'Baies sucrées',
    'minecraft:hay_block': 'Botte de foin',
    'minecraft:honey_block': 'Bloc de miel',
    'minecraft:melon_slice': 'Tranche de pastèque',
    'minecraft:potato': 'Pomme de terre',
    'minecraft:poisonous_potato': 'Pomme de terre empoisonnée',
    'minecraft:pufferfish': 'Poisson-globe',
    'minecraft:pumpkin': 'Citrouille',
    'minecraft:sugar_cane': 'Canne à sucre',
    'minecraft:short_grass': 'Herbes courtes',
    'minecraft:tall_grass': 'Hautes herbes',
    'minecraft:fern': 'Fougère',
    'minecraft:large_fern': 'Grande fougère',
    'minecraft:lily_pad': 'Nénuphar',
    'minecraft:seagrass': 'Herbe aquatique',
    'minecraft:melon': 'Pastèque',
    '#ow:red_panda_eggs_common': 'Œufs communs',
    '#ow:red_panda_eggs_rare': 'Œufs rares',
    '#ow:red_panda_eggs_prized': 'Œufs précieux',

    /* Les objets vanilla des recettes du mod. */
    'minecraft:arrow': 'Flèche',
    'minecraft:birch_planks': 'Planches de bouleau',
    'minecraft:cherry_planks': 'Planches de cerisier',
    'minecraft:dark_oak_planks': 'Planches de chêne noir',
    'minecraft:jungle_planks': 'Planches d’acajou',
    'minecraft:mangrove_planks': 'Planches de palétuvier',
    'minecraft:spruce_planks': 'Planches de sapin',
    'minecraft:crafting_table': 'Établi',
    'minecraft:glass': 'Verre',
    'minecraft:leaves': 'Feuilles',
    'minecraft:saddle': 'Selle',

    /* Le butin des coffres d'arene (tribes.arena.chests) est en grande partie
       vanilla : sans ces noms, la page afficherait « ancient debris » au
       milieu de phrases francaises. Ce sont des noms d'objets du jeu, pas du
       texte d'interface : ils ne passent pas par le traducteur. */
    'minecraft:copper_ingot': 'Lingot de cuivre',
    'minecraft:raw_iron': 'Fer brut',
    'minecraft:raw_gold': 'Or brut',
    'minecraft:lapis_lazuli': 'Lapis-lazuli',
    'minecraft:quartz': 'Quartz du Nether',
    'minecraft:amethyst_shard': "Éclat d'améthyste",
    'minecraft:ancient_debris': 'Débris antiques',
    'minecraft:netherite_scrap': 'Déchet de netherite',
    'minecraft:netherite_ingot': 'Lingot de netherite',
    'minecraft:gunpowder': 'Poudre à canon',
    'minecraft:rotten_flesh': 'Chair putréfiée',
    'minecraft:spider_eye': "Œil d'araignée",
    'minecraft:slime_ball': 'Boule de slime',
    'minecraft:magma_cream': 'Crème de magma',
    'minecraft:blaze_rod': 'Bâton de blaze',
    'minecraft:ghast_tear': 'Larme de ghast',
    'minecraft:ender_pearl': "Perle de l'Ender",
    'minecraft:phantom_membrane': 'Membrane de phantom',
    'minecraft:shulker_shell': 'Carapace de shulker',
    'minecraft:wither_skeleton_skull': 'Tête de wither squelette',
    'minecraft:nautilus_shell': 'Coquille de nautile',
    'minecraft:prismarine_shard': 'Éclat de prismarine',
    'minecraft:prismarine_crystals': 'Cristaux de prismarine',
    'minecraft:ink_sac': "Poche d'encre",
    'minecraft:glow_ink_sac': "Poche d'encre luminescente",
    'minecraft:rabbit_hide': 'Peau de lapin',
    'minecraft:golden_apple': 'Pomme dorée',
    'minecraft:enchanted_golden_apple': 'Pomme dorée enchantée',
    'minecraft:iron_sword': 'Épée en fer',
    'minecraft:iron_pickaxe': 'Pioche en fer',
    'minecraft:iron_axe': 'Hache en fer',
    'minecraft:iron_shovel': 'Pelle en fer',
    'minecraft:iron_helmet': 'Casque en fer',
    'minecraft:iron_chestplate': 'Plastron en fer',
    'minecraft:iron_leggings': 'Jambières en fer',
    'minecraft:iron_boots': 'Bottes en fer',
    'minecraft:diamond_sword': 'Épée en diamant',
    'minecraft:diamond_pickaxe': 'Pioche en diamant',
    'minecraft:diamond_helmet': 'Casque en diamant',
    'minecraft:diamond_chestplate': 'Plastron en diamant',
    'minecraft:diamond_leggings': 'Jambières en diamant',
    'minecraft:diamond_boots': 'Bottes en diamant'
  };

  /* ---- les sachets de libelle ------------------------------------------------

     Le bloc `tribes` de l'export est le seul a porter ses textes en sachets
     { key, plain, translations } — un par bouton, un par permission, un par
     forme de banniere, jusqu'au fond des tables de butin. Les aplatir une fois
     ici, a la lecture, evite d'appeler tr() dans chaque gabarit de la page :
     ce qui en sort n'est plus que des chaines, dans la langue affichee.

     Un objet est reconnu comme sachet s'il porte `plain` ou une table
     `translations` ; tout le reste est parcouru tel quel. */

  function flattenLabels(value) {
    if (Array.isArray(value)) return value.map(flattenLabels);
    if (!value || typeof value !== 'object') return value;
    if (typeof value.plain === 'string' || (value.translations && typeof value.translations === 'object')) {
      return tr(value);
    }
    const out = {};
    Object.keys(value).forEach((k) => { out[k] = flattenLabels(value[k]); });
    return out;
  }

  function makeNameResolver(index) {
    return function nameOf(id) {
      if (!id) return '';
      if (index[id]) return index[id];
      if (VANILLA_NAMES[id]) return VANILLA_NAMES[id];
      return shortId(id).replace(/_/g, ' ');
    };
  }

  /* ---- visuels d'entite -----------------------------------------------------

     Il y avait ici un inventaire code en dur de ce qui existait sur le disque,
     espece par espece. Il est tombe perime deux fois : le boa et l'orque
     avaient leurs trois cartes d'attaque livrees sans qu'aucune ne s'affiche,
     et deux wallpapers etaient declares absents.

     Il n'y en a plus. Les pages ecrivent le chemin conventionnel et
     resolveImages() (js/site.js) laisse le navigateur trancher : le fichier
     repond, il s'affiche ; il ne repond pas, on retombe sur le repli. Deposer
     un visuel au bon nom suffit desormais a le faire apparaitre. */

  /* ---- entity normalisation ------------------------------------------------ */

  function normaliseStats(entity) {
    const a = entity.attributes || {};
    const g = entity.gameplay || {};
    const attr = (key) => (a['minecraft:generic.' + key] != null ? a['minecraft:generic.' + key] : null);
    return {
      hp: attr('max_health'),
      damage: attr('attack_damage'),
      armor: attr('armor'),
      armorToughness: attr('armor_toughness'),
      knockbackRes: attr('knockback_resistance'),
      followRange: attr('follow_range'),
      moveSpeed: attr('movement_speed'),
      jump: attr('jump_strength'),
      safeFall: attr('safe_fall_distance'),
      walkBps: g.walk_speed_blocks_per_second != null ? g.walk_speed_blocks_per_second : null,
      mountedBps: g.mounted_speed_blocks_per_second != null ? g.mounted_speed_blocks_per_second : null,
      scale: g.theoretical_scale != null ? g.theoretical_scale : (entity.size && entity.size.theoretical_scale)
    };
  }

  function normaliseMount(entity) {
    const m = entity.mount || {};
    return {
      rideable: !!m.rideable && m.run_speed_multiplier > 0,   /* voir traits, plus bas */
      saddleItem: m.saddle_item || null,
      walkMult: m.walk_speed_multiplier != null ? m.walk_speed_multiplier : null,
      runMult: m.run_speed_multiplier != null ? m.run_speed_multiplier : null,
      comboMult: m.combo_speed_multiplier != null ? m.combo_speed_multiplier : null,
      riderY: m.base_rider_y_offset != null ? m.base_rider_y_offset : null,
      energyGain: m.vital_energy_level_gain != null ? m.vital_energy_level_gain : null,
      energyRecup: m.vital_energy_recuperation != null ? m.vital_energy_recuperation : null,
      maxEnergy: m.max_vital_energy != null ? m.max_vital_energy : null,
      needsSaddle: m.needs_saddle != null ? !!m.needs_saddle : null,
      waterSpeedDivider: m.water_speed_divider != null ? m.water_speed_divider : null,
      leapingVehicle: !!m.leaping_vehicle
    };
  }

  /* Turns TIGER_ROAR_SLOW_TICKS = 200 into { label: 'roar slow', value: '10 s' }.
     Tick/millisecond twins of the same constant are collapsed onto the seconds
     reading so a card does not list the same number twice in two units. */
  function normaliseAttackConstants(entity) {
    const src = entity.attack_constants || {};
    const cards = (entity.abilities && entity.abilities.cards) || [];
    const slug = entity.path || shortId(entity.id);
    const prefixesOf = (cardSlug) => (
      OW.attackConstantPrefixes ? OW.attackConstantPrefixes(slug, cardSlug) : null
    );
    const byCard = {};
    cards.forEach((c) => { byCard[c.slug] = []; });

    const seen = {};
    Object.keys(src).sort().forEach((key) => {
      const value = src[key];
      if (typeof value === 'boolean') return;

      /* Le rattachement carte ↔ constante est declare dans attack-profiles.js,
         d'apres les noms reels de OWAttacksConstants. On prend le prefixe le
         plus long qui matche, pour que MOUTH_SLAM_* aille bien a la carte
         "mouth" et non a une carte "slam" voisine. */
      let best = null;
      let bestLength = -1;
      cards.forEach((c) => {
        const prefixes = prefixesOf(c.slug);
        if (!prefixes) return;
        prefixes.forEach((prefix) => {
          if (key.indexOf(prefix) !== 0) return;
          if (prefix.length > bestLength) {
            bestLength = prefix.length;
            best = c.slug;
          }
        });
      });
      if (!best) return;

      const base = key.replace(/_(TICKS|MS)$/, '');
      if (seen[best + '|' + base]) return;

      let display;
      if (/_TICKS$/.test(key)) display = round(value / TICKS_PER_SECOND, 2) + ' s';
      else if (/_MS$/.test(key)) display = round(value / 1000, 2) + ' s';
      else if (/_RADIUS$|_RANGE$|_DISTANCE$/.test(key)) display = round(value, 2) + ' blocs';
      else if (/_THRESHOLD$|_RATIO$|_BONUS$/.test(key) && value > 0 && value <= 1) display = Math.round(value * 100) + ' %';
      else display = String(round(value, 2));

      /* La constante est deja rangee sous sa carte : on retire le prefixe pour
         que PRIMAL_ROAR_RADIUS se lise "radius" et non "primal roar radius". */
      let label = base;
      (prefixesOf(best) || []).forEach((prefix) => {
        if (label.indexOf(prefix + '_') === 0) label = label.slice(prefix.length + 1);
      });
      label = label.replace(/^_+|_+$/g, '').replace(/__+/g, '_');

      const text = (label || base).replace(/_/g, ' ').toLowerCase();
      seen[best + '|' + base] = true;
      byCard[best].push({
        label: CONSTANT_FR[text] || text,
        value: display,
        /* Cards like the red panda's Feast carry 30+ tuning constants. The ones a
           player acts on come first; the rest stay behind a disclosure. */
        primary: PRIMARY_CONSTANT.test(text)
      });
    });

    Object.keys(byCard).forEach((slug) => {
      byCard[slug].sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0));
    });

    return byCard;
  }

  const CONSTANT_FR = {
      "accel": "accélération",
      "aim radius": "rayon de visée",
      "aim tolerance": "tolérance de visée",
      "ally damage bonus": "bonus de dégâts allié",
      "ally nudge": "poussée des alliés",
      "anim skip": "saut d'animation",
      "animation": "animation",
      "approach": "approche",
      "arrival": "arrivée",
      "arrival spacing": "écart à l'arrivée",
      "arrival spread": "dispersion à l'arrivée",
      "bamboo max stalk": "tige de bambou max",
      "bamboo reach": "portée du bambou",
      "bamboo side margin": "marge latérale du bambou",
      "bamboo speed lookahead": "anticipation sur bambou",
      "bar height": "hauteur de barre",
      "block steps": "pas par bloc",
      "blocks per pulse": "blocs par impulsion",
      "bonus max lionesses": "lionnes max (bonus)",
      "bonus per lioness": "bonus par lionne",
      "bounce": "rebond",
      "bounce recoil": "recul au rebond",
      "bounce recoil speed": "vitesse de recul au rebond",
      "brake ratio": "taux de freinage",
      "buff": "bonus",
      "bump damage ratio": "dégâts de bousculade",
      "capacity": "capacité",
      "carry": "transport",
      "cast": "lancer",
      "cast release": "relâche du lancer",
      "charge": "charge",
      "charge max": "charge max",
      "charge min": "charge min",
      "check interval": "intervalle de vérification",
      "clan max lionesses": "lionnes max du clan",
      "cooldown": "recharge",
      "cooldown threshold": "seuil de recharge",
      "cost interval": "intervalle de coût",
      "creature bounce": "rebond sur créature",
      "crush damage ratio": "dégâts d'écrasement",
      "crush flatten": "aplatissement",
      "crush immunity": "immunité à l'écrasement",
      "crush knockback": "recul d'écrasement",
      "crush max scale": "taille max écrasée",
      "crush min speed": "vitesse min d'écrasement",
      "curl": "enroulement",
      "damage": "dégâts",
      "damage bonus": "bonus de dégâts",
      "damage center mult": "dégâts au centre",
      "damage edge mult": "dégâts en bordure",
      "damage interval": "intervalle de dégâts",
      "damage max": "dégâts max",
      "damage min": "dégâts min",
      "damage peak": "pic de dégâts",
      "damage ratio": "part des dégâts",
      "damage reduction": "réduction des dégâts",
      "damage start": "dégâts initiaux",
      "dash": "ruée",
      "dash speed": "vitesse de ruée",
      "diner scan interval": "recherche des convives",
      "dive ramp": "rampe de plongée",
      "dive speed": "vitesse de plongée",
      "dizzy": "étourdissement",
      "douse radius": "rayon d'extinction",
      "droop": "affaissement",
      "drum first tick": "premier battement",
      "drum interval": "intervalle des battements",
      "drum last tick": "dernier battement",
      "duration": "durée",
      "edge interval": "intervalle en bordure",
      "edge points": "points de bordure",
      "edge sound interval": "intervalle du son de bordure",
      "edge sound step": "pas du son de bordure",
      "energy": "énergie",
      "energy per tick": "énergie par tick",
      "engage range": "portée d'engagement",
      "fade": "fondu",
      "fall immunity": "immunité de chute",
      "fear": "peur",
      "feed": "festin",
      "fidelity radius tamed": "écart max au clan, apprivoisé",
      "fidelity radius wild": "écart max au clan, sauvage",
      "fill per tick": "remplissage par tick",
      "fill reach": "portée de remplissage",
      "first arrival tick": "première arrivée",
      "flight speed": "vitesse de vol",
      "front dot": "angle frontal",
      "gesture": "geste",
      "grab max timeout": "jauge d'étreinte fatale",
      "grab start timeout": "jauge d'étreinte au départ",
      "gravity": "gravité",
      "grudge max": "rancune max",
      "grudge per hit": "rancune par coup",
      "half width": "demi-largeur",
      "head raise ratio": "hauteur de la tête sur la proie",
      "heal per pulse": "soin par impulsion",
      "health per lioness": "vie par lionne",
      "heart mult": "multiplicateur de cœur",
      "hold to start": "maintien avant départ",
      "hover": "vol stationnaire",
      "hover damping": "amorti du vol",
      "impact radius": "rayon d'impact",
      "instant ratio": "part instantanée",
      "instinct multiplier": "multiplicateur d'instinct",
      "kills required": "kills requis",
      "knockback": "recul",
      "knockback lift": "soulèvement du recul",
      "last hit": "dernier coup",
      "launch": "projection",
      "launch speed": "vitesse de projection",
      "lava": "lave",
      "leak interval": "intervalle de fuite",
      "leap": "bond",
      "leap forward": "bond en avant",
      "leap power": "puissance du bond",
      "length": "longueur",
      "lifetime factor den": "durée de vie (dénominateur)",
      "lifetime factor num": "durée de vie (numérateur)",
      "lift": "soulèvement",
      "lift degrees": "angle de soulèvement",
      "lift ratio": "taux de soulèvement",
      "max damage ratio": "part de dégâts max",
      "max dive": "plongée max",
      "max duration": "durée max",
      "max flight": "vol max",
      "max hp": "vie max",
      "max lifetime": "durée de vie max",
      "max lionesses": "lionnes max",
      "max power": "puissance max",
      "max speed": "vitesse max",
      "max target height": "hauteur max de la proie",
      "max target width": "largeur max de la proie",
      "min aim distance": "distance de visée min",
      "min damage ratio": "part de dégâts min",
      "min dive pitch": "inclinaison de plongée min",
      "min duration": "durée min",
      "min flight": "vol min",
      "min power": "puissance min",
      "min speed": "vitesse min",
      "min water": "eau min",
      "nearby radius": "rayon de proximité",
      "outro": "sortie",
      "over time": "sur la durée",
      "over time interval": "intervalle sur la durée",
      "over time ratio": "part sur la durée",
      "overcharge max": "surcharge max",
      "overcharge ticks each": "ticks par surcharge",
      "particle gravity": "gravité des particules",
      "portions": "portions",
      "power": "puissance",
      "pulse damage": "dégâts par impulsion",
      "pulse hop": "saut d'impulsion",
      "pulse interval": "intervalle des impulsions",
      "push": "poussée",
      "push max factor": "poussée max",
      "push min factor": "poussée min",
      "push power": "puissance de poussée",
      "push reference volume": "volume de référence",
      "radius": "rayon",
      "radius blocks": "rayon",
      "range": "portée",
      "recover": "récupération",
      "ref size": "taille de référence",
      "regeneration amplifier": "niveau de régénération",
      "release": "relâche",
      "respond": "réaction au rugissement",
      "river surge": "déferlante",
      "roll crush multiplier": "écrasement en roulade",
      "scale max": "taille max",
      "scale min": "taille min",
      "seat lift": "élévation du siège",
      "seat spread": "écart des sièges",
      "secondary cooldown": "recharge secondaire",
      "sensitive damage": "dégâts sensibles",
      "shake floor": "tremblement minimal",
      "shake intensity": "intensité du tremblement",
      "shake radius": "rayon du tremblement",
      "shockwave push": "poussée de l'onde",
      "shockwave radius": "rayon de l'onde",
      "shockwave slow": "ralentissement de l'onde",
      "shockwave tick": "tick de l'onde",
      "shout tick": "tick du cri",
      "sign distance gain": "gain de distance",
      "sign scale": "échelle du signe",
      "slope gain": "gain en pente",
      "slope max bonus": "bonus de pente max",
      "slow": "ralentissement",
      "slowness": "lenteur",
      "snacks required": "en-cas requis",
      "speed": "vitesse",
      "speed amplifier": "niveau de vitesse",
      "speed bonus": "bonus de vitesse",
      "speed factor": "facteur de vitesse",
      "spot density": "densité des taches",
      "spots max": "taches max",
      "spots min": "taches min",
      "spread inner": "dispersion intérieure",
      "spread outer": "dispersion extérieure",
      "stagger": "titubation",
      "stand lift": "dressement",
      "start energy": "énergie de départ",
      "stomp tick": "tick du piétinement",
      "stop glide": "fin de glissade",
      "strength amplifier": "niveau de force",
      "struggle reduction": "recul de la jauge par débattement",
      "swirl interval": "intervalle du tourbillon",
      "swirl points": "points du tourbillon",
      "swirl speed": "vitesse du tourbillon",
      "target range": "portée de cible",
      "targeting": "ciblage",
      "threshold": "seuil",
      "throw": "lancer",
      "top speed ratio": "part de la vitesse max",
      "toss distance": "distance de lancer",
      "total": "total",
      "turn max degrees": "virage max",
      "turn speed": "vitesse de virage",
      "uncurl": "déroulement",
      "visual radius": "rayon visuel",
      "wall bounce min speed": "vitesse min de rebond mural",
      "wall probe distance": "détection des murs",
      "wall speed decay": "perte de vitesse au mur",
      "warning ratio": "seuil d'alerte",
      "water speed bonus": "bonus de vitesse dans l'eau",
      "wave count": "nombre de vagues",
      "wave interval": "intervalle des vagues",
      "wave radius": "rayon des vagues",
      "wave travel": "course des vagues",
      "wild damage multiplier": "dégâts à l'état sauvage",
      "windup": "élan"
  };

  /* Constants that describe what the ability does, rather than how it is tuned. */
  const PRIMARY_CONSTANT = /^(cooldown|energy|duration|radius|range|damage|kills required|charge|slow|fear|speed|threshold)\b|\b(cooldown|energy|duration|radius|range)$/;

  /* L'index de la planche attack_N.png du mod, par role. L'atlas ne dessine que
     les trois cartes qui ont une touche dediee ; la secondaire alternative et le
     passif n'y figurent pas et retombent sur le glyphe de leur role. */
  const SPRITE_INDEX_BY_ROLE = { combo: 0, secondary: 1, ultimate: 2 };

  function normaliseCards(entity) {
    const cards = (entity.abilities && entity.abilities.cards) || [];
    const consts = normaliseAttackConstants(entity);

    /* Roles et valeurs des %s viennent de js/attack-profiles.js, la
       transcription de OWAttacksInformation.java. Sans ce fichier les cartes
       restent lisibles : elles perdent seulement leur role et leurs chiffres. */
    const profile = OW.resolveAttackProfile ? OW.resolveAttackProfile(entity) : {};
    const fill = OW.fillPlaceholders || ((t) => stripPlaceholders(t));
    const fillHtml = OW.fillPlaceholdersHtml || ((t) => escapeHtml(stripPlaceholders(t)));

    const mapped = cards.map((c) => {
      const slot = profile[c.slug] || null;
      const role = slot ? slot.role : null;
      const roleInfo = slot ? slot.roleInfo : null;
      const raw = tr(c.desc);

      return {
        slug: c.slug,
        title: tr(c.title),
        /* Le texte brut du mod, %s compris — utile pour deboguer un export. */
        rawDescription: raw,
        description: slot ? fill(raw, slot.args) : stripPlaceholders(raw),
        descriptionHtml: slot
          ? fillHtml(raw, slot.args, escapeHtml)
          : escapeHtml(stripPlaceholders(raw)),
        args: slot ? slot.args : [],
        role,
        roleLabel: roleInfo ? roleInfo.label : '',
        roleShort: roleInfo ? roleInfo.short : '',
        roleColor: roleInfo ? roleInfo.color : null,
        keyLabel: roleInfo ? roleInfo.key : '',
        passive: !!(roleInfo && roleInfo.passive),
        swappable: !!(roleInfo && roleInfo.swappable),
        spriteIndex: role && SPRITE_INDEX_BY_ROLE[role] != null ? SPRITE_INDEX_BY_ROLE[role] : null,
        order: roleInfo ? roleInfo.order : 90,
        constants: consts[c.slug] || []
      };
    });

    /* L'export ne garantit aucun ordre (l'orque sort son ultime en premier).
       On retablit celui du jeu : combo, secondaires, ultime, passif. */
    return mapped.sort((a, b) => a.order - b.order);
  }

  /* The exporter only writes variants[].cosmetic for some creatures, so the
     cosmetics list — which names its own variant everywhere — is the cross-check.
     Without it, kodiak/crocodile/orca skins get counted as natural variants. */
  const VARIANT_FR = {
    DEFAULT: 'Classique', LIGHT_ORANGE: 'Orange clair', GOLDEN: 'Doré', WHITE: 'Blanc', BLACK: 'Noir',
    GREY: 'Gris', GREEN: 'Vert', DARK: 'Sombre', YELLOW: 'Jaune', BROWN: 'Brun', AQUA: 'Turquoise',
    PINK: 'Rose', ORANGE: 'Orange', RED: 'Roux', SILVER: 'Argenté', ALBINOS: 'Albinos', ALBINO: 'Albinos'
  };

  function normaliseVariants(entity) {
    const cosmeticNames = {};
    (entity.cosmetics || []).forEach((c) => { if (c.variant) cosmeticNames[c.variant] = true; });

    return (entity.variants || []).map((v) => ({
      id: v.id,
      name: v.name,
      label: v.name.replace(/^SKIN_/, '').replace(/_/g, ' ').toLowerCase(),
      labelFr: VARIANT_FR[v.name] || v.name.replace(/^SKIN_/, '').replace(/_/g, ' ').toLowerCase(),
      cosmetic: v.cosmetic === true || !!cosmeticNames[v.name] || /^SKIN_/.test(v.name),
      deprecated: !!v.deprecated,
      ordinal: v.ordinal
    }));
  }

  /* La rarete calculee par le mod (OWWikiSpawnRarity) : un palier par biome,
     d'apres le nombre de groupes pour 100 chunks, et le palier de son
     meilleur biome pour la bete. Sans apparition naturelle : null. */
  function normaliseRarity(rarity) {
    if (!rarity || !rarity.spawns_naturally) return null;
    return {
      tier: rarity.tier,
      bestBiome: rarity.best_biome || '',
      groups: rarity.groups_per_100_chunks,
      individuals: rarity.individuals_per_100_chunks,
      biomes: (rarity.biomes || []).filter((b) => !isArenaBiome(b.biome)).map((b) => ({
        biome: b.biome,
        tier: b.tier,
        groups: b.groups_per_100_chunks,
        individuals: b.individuals_per_100_chunks,
        chunkOneIn: b.chunk_one_in || 1
      }))
    };
  }

  function normalisePiste(entity) {
    const p = entity.piste || {};
    if (!p.available || !p.nodes || !p.nodes.length) {
      return { available: false, nodeCount: 0, nodes: [] };
    }
    return {
      available: true,
      nodeCount: p.node_count != null ? p.node_count : p.nodes.length,
      nodes: p.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        x: n.x,
        y: n.y,
        children: n.children || [],
        cost: n.cost || 0,
        reward: n.reward || 0,
        requiredLevel: n.required_level || 0,
        requiresAll: !!n.requires_all,
        exclusiveFork: !!n.exclusive_fork,
        /* Un noeud de capacite propose un choix entre plusieurs passifs. */
        passives: (n.passives || []).map((pv, i) => ({
          id: pv.id != null ? pv.id : i,
          name: tr(pv.name),
          description: tr(pv.description),
          icon: pv.icon || ''
        }))
      }))
    };
  }

  function normaliseLoot(entity, nameOf) {
    const loot = entity.loot || {};
    return {
      table: loot.table || '',
      drops: (loot.drops || []).map((d) => ({
        id: d.item,
        name: nameOf(d.item),
        min: d.min,
        max: d.max,
        chance: d.chance != null ? d.chance : 1,
        lootingBonus: !!d.looting_bonus,
        smeltsWhenBurning: !!d.smelts_when_burning
      }))
    };
  }

  function normaliseTaming(entity, nameOf, advancementIndex, somnolenceFood) {
    const t = entity.taming;
    if (!t) return null;
    const f = t.feeding;
    const seconds = (s, ticks) => (s != null ? s : (ticks != null ? ticks / 20 : null));
    return {
      tameable: !!(entity.traits && entity.traits.tameable),
      experience: t.experience != null ? t.experience : null,
      advancementId: t.advancement && t.advancement !== 'ow:' ? t.advancement : null,
      advancement: advancementIndex[t.advancement] || null,
      /* La barre de somnolence (MAX_SOMNOLENCE et SOMNOLENCE_LOSS_INTERVAL
         du Java) : son plafond, tire a ±spread % pour chaque individu, et ce
         qu'elle perd par seconde, eveillee puis endormie (deux fois moins
         vite : SLEEPING_SOMNOLENCE_LOSS_FACTOR). */
      somnolence: t.somnolence && t.somnolence.max
        ? {
            max: t.somnolence.max,
            min: t.somnolence.max_min != null ? t.somnolence.max_min : null,
            top: t.somnolence.max_max != null ? t.somnolence.max_max : null,
            spread: t.somnolence.spread_percent != null ? t.somnolence.spread_percent : null,
            decays: t.somnolence.decays !== false,
            /* Le rythme du mod : 1 point tous les N ticks (OWEntity.tick). */
            ticksAwake: t.somnolence.loss_interval_ticks_awake != null ? t.somnolence.loss_interval_ticks_awake : null,
            ticksAsleep: t.somnolence.loss_interval_ticks_asleep != null ? t.somnolence.loss_interval_ticks_asleep : null,
            lossAwake: t.somnolence.loss_per_second_awake != null ? t.somnolence.loss_per_second_awake : null,
            lossAsleep: t.somnolence.loss_per_second_asleep != null ? t.somnolence.loss_per_second_asleep : null,
            drainAwake: t.somnolence.full_bar_awake_seconds != null ? t.somnolence.full_bar_awake_seconds : null,
            drainAsleep: t.somnolence.full_bar_asleep_seconds != null ? t.somnolence.full_bar_asleep_seconds : null
          }
        : null,
      /* Le nourrissage, une fois la bete endormie (taming.feeding,
         OWAggressiveTaming) : combien de repas elle exige (FOOD_WANTED_MIN
         et MAX, tire a son apparition), et l'attente avant chaque repas
         (MEAL_INTERVAL), deux fois plus courte quand seule la nourriture de
         somnolence est a portee (SOMNOLENCE_MEAL_HASTE). */
      feeding: f && f.food_wanted_min != null && f.food_wanted_max != null
        ? {
            min: f.food_wanted_min,
            max: f.food_wanted_max,
            intervalMin: seconds(f.meal_interval_seconds_min, f.meal_interval_ticks_min),
            intervalMax: seconds(f.meal_interval_seconds_max, f.meal_interval_ticks_max),
            hasteMin: seconds(f.somnolence_meal_interval_seconds_min, f.somnolence_meal_interval_ticks_min),
            hasteMax: seconds(f.somnolence_meal_interval_seconds_max, f.somnolence_meal_interval_ticks_max),
            somnolenceFood: somnolenceFood || []
          }
        : null,
      foodTags: (t.food_tags || []).map((f) => ({
        id: f.id,
        constant: f.constant,
        items: (f.entries || []).map((id) => ({ id, name: nameOf(id) }))
      })),
      /* Les paliers de nourriture (taming.food_tiers) : le regime (palier 1,
         ses aliments sont ceux de food_tags), puis le prefere et l'adore,
         chacun un seul objet. portions = repas comptes par bouchee
         (OWAggressiveTaming.mealPortions). Les paliers 2 et 3 manquent
         quand la bete n'en a pas. taming.knockout n'est pas affiche. */
      foodTiers: (t.food_tiers || []).map((x) => ({
        tier: x.tier,
        kind: x.kind,
        portions: x.portions,
        item: x.item ? { id: x.item, name: nameOf(x.item) } : null
      })),
      manual: (t.manual || []).map((page) => ({
        key: page.key,
        text: tr(page),
        html: formatMinecraftText(trRaw(page))
      }))
    };
  }

  /* Le sellier liste ses emplacements de couleur en minecraft:barrier — le
     bouche-trou du mod pour « n'importe quelle couleur ». Le label_key dit la
     matiere et l'emplacement : saddler.material.<matiere>.<emplacement>. La
     ligne se lit donc « Laine · couleur principale », et son icone fait
     defiler les 16 couleurs de la matiere (OW.cycleAttr).
     Une future selle en tapis, beton, terre cuite… marche d'elle-meme : il
     suffit que ses blocs soient dans assets/mcblocks/ (<couleur>_<matiere>.png). */
  const COLORS = ['white', 'light_gray', 'gray', 'black', 'brown', 'red', 'orange', 'yellow',
    'lime', 'green', 'cyan', 'light_blue', 'blue', 'purple', 'magenta', 'pink'];
  const MATERIAL_LABEL = {
    wool: 'Laine', carpet: 'Tapis', concrete: 'Béton', concrete_powder: 'Béton en poudre',
    terracotta: 'Terre cuite', glazed_terracotta: 'Terre cuite émaillée', stained_glass: 'Verre teinté',
    stained_glass_pane: 'Vitre teintée', banner: 'Bannière', dye: 'Teinture', bed: 'Lit', candle: 'Bougie'
  };
  const SLOT_LABEL = { primary: 'couleur principale', secondary: 'couleur secondaire', tertiary: 'troisième couleur' };

  function colorSlot(labelKey) {
    const m = /^saddler\.material\.([a-z_]+)\.([a-z_]+)$/.exec(labelKey || '');
    if (!m) return null;
    const [, material, slot] = m;
    const matLabel = MATERIAL_LABEL[material] || (material.charAt(0).toUpperCase() + material.slice(1).replace(/_/g, ' '));
    return {
      label: matLabel + ' · ' + (SLOT_LABEL[slot] || slot.replace(/_/g, ' ')),
      ids: COLORS.map((c) => 'minecraft:' + c + '_' + material)
    };
  }

  function normaliseSaddleNeeds(needs, nameOf) {
    return (needs || []).map((n) => {
      const slot = colorSlot(n.label_key);
      const items = slot ? slot.ids : (n.items || []).filter((id) => id !== 'minecraft:barrier');
      const iconIds = items;
      return {
        count: n.count,
        items,
        colorSlot: n.color_slot != null ? n.color_slot : null,
        name: slot ? slot.label : items.map(nameOf).join(' ou ') || '—',
        iconId: iconIds[0] || '',
        /* Tous les objets acceptes : l'icone les fait defiler s'il y en a plusieurs. */
        iconIds
      };
    });
  }

  function releaseDate(entity) {
    const time = Date.parse((entity.history || {}).revealed);
    return isNaN(time) ? entityDate(entity) : new Date(time).toISOString();
  }

  /* La premiere date lisible parmi les noms que l'export peut employer, a la
     racine de l'entite ou dans son bloc classification. */
  const DATE_KEYS = ['created', 'created_date', 'class_created_at', 'class_created', 'created_at'];
  function entityDate(entity) {
    /* L'export date chaque espece par le fichier de sa classe :
       entities[].history.created (ou created_date). C'est la source retenue ;
       les anciens noms restent lus en secours. */
    const places = [entity.history || {}, entity, entity.classification || {}];
    for (const place of places) {
      for (const key of DATE_KEYS) {
        const value = place[key];
        if (!value) continue;
        const time = Date.parse(value);
        if (!isNaN(time)) return new Date(time).toISOString();
      }
    }
    return null;
  }

  function normaliseEntity(entity, ctx) {
    const cls = entity.classification || {};
    const g = entity.gameplay || {};
    const color = g.entity_color_hex || null;

    return {
      id: entity.id,
      slug: entity.path,
      name: tr(entity.names),
      className: entity.simple_class || entity.class || '',
      interfaces: cls.interfaces || [],
      hierarchy: cls.hierarchy || [],
      boss: !!cls.boss,
      family: cls.family || 'terrestrial',
      tier: cls.boss ? 'boss' : (entity.traits && entity.traits.tameable ? 'tameable' : 'hostile'),
      mobCategory: cls.mob_category || '',
      maxPerChunk: cls.max_instances_per_chunk != null ? cls.max_instances_per_chunk : null,
      color,

      art: 'assets/entities/' + entity.path + '.png',
      head: 'assets/heads/' + entity.path + '.png',
      /* Toujours ecrit : renderHero() le tente et bascule sur un fond tire de
         la vignette de la bete si le fichier n'existe pas. */
      wallpaper: 'assets/wallpapers/' + entity.path + '.png',

      /* « rideable » vaut vrai pour toutes les betes dans l'export : OWEntity
         implemente IOWRideable, donc le test du datagen (isAssignableFrom,
         OWWikiEntitySection) repond oui meme pour le panda roux, qui se porte
         sur l'epaule. Une vraie monture a une allure de course. */
      traits: Object.assign({}, entity.traits || {}, entity.traits && entity.traits.rideable
        ? { rideable: !!(entity.mount && entity.mount.run_speed_multiplier > 0) } : {}),
      /* La date de creation de la classe de l'entite, quand l'export la
         donne : l'encart « Nouveau ! » de l'accueil s'en sert
         (js/news.js, js/site-config.js). Plusieurs noms sont acceptes. */
      createdAt: entityDate(entity),
      /* Le jour ou la bete est sortie sur le wiki (history.revealed, ecrit par
         tools/publish-data.py) : c'est lui qui la fait « Nouveau ! » et qui
         range le tri recent. A defaut, la date de sa classe. */
      releasedAt: releaseDate(entity),
      stats: normaliseStats(entity),
      size: entity.size || {},
      archetype: g.archetype || null,
      diet: g.diet || null,
      temperament: g.temperament || '',
      gameplay: {
        fightsInArena: !!g.fights_in_arena,
        prefersRaw: !!g.prefers_raw_meat,
        prefersCooked: !!g.prefers_cooked_meat,
        prefersVegetables: !!g.prefers_vegetables,
        secondaryCount: g.secondary_attack_count != null ? g.secondary_attack_count : null,
        teleports: !!g.teleports_to_owner,
        canLean: !!g.can_lean,
        bankMaxAngle: g.bank_max_angle != null ? g.bank_max_angle : null,
        pitchMaxAngle: g.pitch_max_angle != null ? g.pitch_max_angle : null,
        tamingExperience: g.taming_experience != null ? g.taming_experience : null,
        defaultSkinIndex: g.default_skin_index != null ? g.default_skin_index : null
      },
      mount: normaliseMount(entity),
      cards: normaliseCards(entity),
      taming: normaliseTaming(entity, ctx.nameOf, ctx.advancementIndex, ctx.somnolenceFood),
      saddle: ctx.saddleByEntity[entity.id] || null,

      spawn: entity.spawn
        ? {
            biomes: (entity.spawn.biomes || []).filter((id) => !isArenaBiome(id)),
            weight: entity.spawn.weight,
            min: entity.spawn.min_count,
            max: entity.spawn.max_count,
            modifier: entity.spawn.biome_modifier || '',
            chunkOneIn: entity.spawn.chunk_one_in || 1,
            perChunk: cls.max_instances_per_chunk != null ? cls.max_instances_per_chunk : null
          }
        : null,
      rarity: normaliseRarity(entity.rarity),

      lore: ((entity.lore && entity.lore.adventurer_manuscript) || []).map((page) => ({
        key: page.key,
        text: tr(page),
        html: formatMinecraftText(trRaw(page))
      })),

      variants: normaliseVariants(entity),
      cosmetics: (entity.cosmetics || []).map((c) => ({
        name: c.name,
        variant: c.variant,
        variantId: c.variant_id
      })),

      loot: normaliseLoot(entity, ctx.nameOf),
      piste: normalisePiste(entity),

      sounds: (entity.sounds || []).map((s) => ({
        id: s.id,
        path: s.path,
        constant: s.constant
      })),

      animations: ((entity.client && entity.client.animations) || []).map((a) => ({
        name: a.name,
        seconds: a.seconds,
        loop: !!a.looping
      })),
      client: entity.client
        ? {
            model: entity.client.model || '',
            renderer: entity.client.renderer || '',
            layers: entity.client.layers || [],
            skin: entity.client.skin || ''
          }
        : null,

      textures: entity.textures || [],
      textureCount: (entity.textures || []).length,
      wildBehaviors: entity.wild_behaviors || [],
      craftingUses: mergeCooking((entity.crafting_uses || []).map((u) => ({
        id: u.id,
        type: u.type,
        result: ctx.nameOf(u.result),
        resultId: u.result,
        count: u.result_count || 1,
        ingredients: (u.ingredients || []).map(ctx.nameOf),
        /* Les identifiants restent a cote des noms : la fiche s'en sert pour
           afficher la case de chaque ingredient. */
        ingredientIds: (u.ingredients || []).slice()
      })), (u) => shortId(u.type), (u) => u.resultId + '<' + u.ingredientIds.join(',')),
      constants: entity.constants || {}
    };
  }

  /* ---- recipes ------------------------------------------------------------- */

  /* The exporter keeps the recipe json, so a shaped recipe can be shown on the
     real 3x3 grid the mod uses rather than an approximation. */
  /* Une viande se cuit au four, au fumoir et au feu de camp : trois recettes
     dans le mod, la meme pour le joueur (meme ingredient, meme resultat). On
     n'en garde qu'une, qui connait ses methodes (methods) — la page Objets les
     fait defiler, aucune page n'affiche de doublon. */
  const COOKING = ['smelting', 'smoking', 'blasting', 'campfire_cooking'];
  function mergeCooking(list, typeOf, keyOf) {
    const out = [];
    const seen = {};
    list.forEach((r) => {
      const type = typeOf(r);
      if (COOKING.indexOf(type) === -1) { out.push(Object.assign(r, { methods: [type] })); return; }
      const key = keyOf(r);
      if (seen[key]) {
        if (seen[key].methods.indexOf(type) === -1) seen[key].methods.push(type);
        return;
      }
      seen[key] = Object.assign(r, { methods: [type] });
      out.push(seen[key]);
    });
    out.forEach((r) => r.methods.sort((a, b) => COOKING.indexOf(a) - COOKING.indexOf(b)));
    return out;
  }

  function normaliseRecipe(recipe, nameOf) {
    const json = recipe.json || {};
    const type = shortId(recipe.type);
    let grid = null;
    const idOf = (entry) => {
      if (!entry) return null;
      if (Array.isArray(entry)) return entry[0] && (entry[0].item || entry[0].tag);
      return entry.item || entry.tag || null;
    };

    if (type === 'crafting_shaped' && Array.isArray(json.pattern)) {
      const keyMap = json.key || {};
      grid = [];
      for (let row = 0; row < 3; row++) {
        const line = json.pattern[row] || '   ';
        for (let col = 0; col < 3; col++) {
          const symbol = line[col];
          const id = symbol && symbol !== ' ' ? idOf(keyMap[symbol]) : null;
          grid.push(id ? { id, name: nameOf(id) } : null);
        }
      }
    }

    /* Ce qu'il faut reunir, avec la quantite : `ingredients` ne cite chaque
       ingredient qu'une fois (6 planches pour une porte y font 1 ligne). On
       compte donc les cases de la grille (recette faconnee), ou chaque entree
       de la liste du mod (recette informe) ; a defaut, 1 par ingredient. */
    const slots = grid
      ? grid.filter(Boolean)
      : (Array.isArray(json.ingredients) ? json.ingredients.map(idOf).filter(Boolean).map((id) => ({ id })) : null);
    const needs = [];
    (slots || (recipe.ingredients || []).map((id) => ({ id }))).forEach((cell) => {
      const found = needs.find((n) => n.id === cell.id);
      if (found) found.count++;
      else needs.push({ id: cell.id, name: nameOf(cell.id), count: 1 });
    });

    return {
      id: recipe.id,
      type,
      shaped: type === 'crafting_shaped',
      needs,
      result: recipe.result,
      resultName: nameOf(recipe.result),
      count: recipe.result_count || 1,
      ingredients: (recipe.ingredients || []).map((id) => ({ id, name: nameOf(id) })),
      grid
    };
  }

  /* ---- top level ----------------------------------------------------------- */

  function normalise(raw) {
    const nameIndex = buildNameIndex(raw);
    const nameOf = makeNameResolver(nameIndex);

    const advancementIndex = {};
    (raw.advancements || []).forEach((a) => {
      advancementIndex[a.id] = {
        id: a.id,
        constant: a.constant,
        /* TIGER_TAMED_ADVANCEMENT -> tiger : la bete que ce succes recompense.
           Plus sur que le lien inverse (taming.advancement), que l'export
           partage parfois entre deux especes. */
        slug: String(a.constant || '').replace(/_TAMED_ADVANCEMENT$/, '').toLowerCase() || null,
        title: tr(a.title),
        description: tr(a.description)
      };
    });

    const saddles = (raw.saddles || []).map((s) => ({
      id: s.id,
      entityId: 'ow:' + s.id,
      entityName: tr(s.entity_names),
      result: s.result,
      resultName: nameOf(s.result),
      accent: s.accent_color || null,
      threshold: s.taming_threshold,
      needs: normaliseSaddleNeeds(s.needs, nameOf)
    }));

    const saddleByEntity = {};
    saddles.forEach((s) => { saddleByEntity[s.entityId] = s; });

    /* Ce qui prolonge le sommeil d'une bete qu'on apprivoise : le tag
       ow:somnolence_food, le meme pour toutes. */
    const itemTags = raw.tags && Array.isArray(raw.tags.items) ? raw.tags.items : [];
    const somnolenceTag = itemTags.find((t) => t.id === 'ow:somnolence_food');
    const somnolenceFood = ((somnolenceTag && somnolenceTag.entries) || [])
      .filter((id) => id.charAt(0) !== '#')
      .map((id) => ({ id, name: nameOf(id) }));

    const ctx = { nameOf, advancementIndex, saddleByEntity, somnolenceFood };
    const glossary = raw.glossary || {};
    const worldgen = raw.worldgen || {};
    const levelCurve = glossary.level_curve || { levels: [] };

    const allEntities = (raw.entities || []).map((e) => normaliseEntity(e, ctx));
    const published = allEntities.filter((e) => HIDDEN_ENTITIES.indexOf(e.slug) === -1);
    /* Un boss n'est pas une creature du bestiaire : il ne compte ni dans « 9
       creatures », ni dans les grilles, le carrousel, le guide ou les
       comparateurs. Il vit a part, dans `bosses`, pour son futur onglet. */
    const entities = published.filter((e) => !e.boss);
    const bosses = published.filter((e) => e.boss);

    return {
      meta: {
        modId: raw.meta && raw.meta.mod_id,
        version: (raw.meta && raw.meta.mod_version) || '—',
        schema: raw.meta && raw.meta.schema_version,
        generator: raw.meta && raw.meta.generator,
        languages: (raw.meta && raw.meta.languages) || {},
        stringCount: ((raw.meta && raw.meta.languages) || {})[LANG] || 0
      },

      entities,
      bosses,
      allEntities,

      items: (raw.items || []).filter(shown).map((it) => ({
        id: it.id,
        path: it.path,
        name: itemName(it),
        rarity: it.rarity || 'COMMON',
        stack: it.max_stack_size != null ? it.max_stack_size : 1,
        durability: it.max_damage || 0,
        fireResistant: !!it.fire_resistant,
        className: it.class || ''
      })),

      blocks: (raw.blocks || []).filter(shown).map((b) => ({
        id: b.id,
        name: tr(b.names),
        friction: b.friction,
        explosionResistance: b.explosion_resistance,
        className: b.class || ''
      })),

      recipes: mergeCooking((raw.recipes || []).map((r) => normaliseRecipe(r, nameOf)),
        (r) => r.type, (r) => r.result + '<' + r.ingredients.map((i) => i.id).join(',')),
      saddles,

      quests: (glossary.daily_quests || []).map((q) => ({
        id: q.id,
        name: tr(q.names),
        tier: q.tier,
        color: q.tier_color || '#F2A32C',
        reward: q.reward || 0,
        max: q.max_value,
        difficulty: q.difficulty,
        requiresLevelUp: !!q.requires_level_up
      })),

      archetypes: (glossary.archetypes || []).map((a) => ({
        name: a.name,
        hp: a.health_multiplier,
        damage: a.damage_multiplier,
        speed: a.speed_multiplier,
        energy: a.energy_multiplier
      })),

      diets: (glossary.diets || []).map((d) => ({
        name: d.name,
        saturation: d.saturation_multiplier
      })),

      temperaments: glossary.temperaments || [],
      attackIds: glossary.attack_ids || {},
      entityConstants: glossary.entity_constants || {},

      levelCurve: {
        formula: levelCurve.formula || '',
        max: (levelCurve.levels || []).reduce((m, l) => Math.max(m, l.level), 0) + 1,
        totalXp: (levelCurve.levels || []).reduce((m, l) => Math.max(m, l.cumulative_xp || 0), 0),
        levels: (levelCurve.levels || []).map((l) => ({
          level: l.level,
          xpToNext: l.xp_to_next,
          cumulative: l.cumulative_xp
        }))
      },

      pisteNodeTypes: (glossary.piste && glossary.piste.node_types) || [],
      pistePassives: ((glossary.piste && glossary.piste.passives) || []).map((p, i) => ({
        id: p.id != null ? p.id : i,
        name: tr(p.name || p.title),
        description: tr(p.description),
        icon: p.icon || ''
      })),

      /* Les arenes (ow:arena, ow:arena_aquatic) sont declarees comme biomes
         dans le registre, mais ce sont des structures de combat : elles ne
         doivent jamais apparaitre comme biome, quelle que soit la version de
         l'export. Le filtre se fait ici, a la source, pour toutes les pages. */
      biomes: (worldgen.biomes || []).filter((b) => !isArenaBiome(b)).map((b) => ({
        id: b.id,
        constant: b.constant,
        registry: b.registry
      })),

      spawns: (worldgen.spawns || []).map((s) => ({
        entity: s.entity,
        biomes: (s.biomes || []).filter((id) => !isArenaBiome(id)),
        weight: s.weight,
        min: s.min_count,
        max: s.max_count,
        modifier: s.biome_modifier
      })),

      advancements: Object.keys(advancementIndex).map((k) => advancementIndex[k]),

      sounds: (raw.sounds || []).map((s) => ({
        id: s.id,
        path: s.path,
        constant: s.constant
      })),

      /* Les tribus : le bloc de l'export, libelles aplatis, tel quel. La page
         (js/tribes.js) y lit tout ce qu'elle affiche — formes de banniere,
         badges, coffres et leur butin, arene, reputation, commandes. Rien
         n'est recopie ni reinterprete en chemin : ce que le mod exporte est
         ce que le wiki montre. */
      tribes: flattenLabels(raw.tribes || {}),

      tags: raw.tags || {},
      nameOf
    };
  }

  /* ---- chargement ----------------------------------------------------------- */

  let pending = null;

  /**
   * Charge et normalise l'export du mod, une fois par page.
   *
   * data/wiki_data.json est le seul fichier de donnees du wiki : celui que le
   * mod exporte, depose tel quel. Il n'y a aucune etape de construction — pas
   * de copie a regenerer, pas de script a relancer. Mettre le wiki a jour, c'est
   * remplacer ce fichier, rien d'autre.
   *
   * En contrepartie, fetch() exige une origine : le dossier doit etre servi en
   * http, meme par le plus simple des serveurs statiques. Ouvert par
   * double-clic (file://), le navigateur refuse la requete — et plutot que de
   * laisser neuf pages vides, on l'ecrit noir sur blanc a l'ecran.
   */
  function loadWikiData() {
    if (pending) return pending;

    pending = fetch('data/wiki_data.json', { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('data/wiki_data.json : reponse ' + response.status);
        }
        return response.json();
      })
      .then((raw) => {
        if (!raw || !raw.entities) {
          throw new Error('data/wiki_data.json ne contient aucune entite.');
        }
        const data = normalise(raw);
        /* L'ecran de chargement (js/loader.js) attend ce signal pour se lever,
           et y prend la liste des betes. */
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('ow:data', { detail: data }));
        }
        return data;
      })
      .catch((error) => {
        showDataError(error);
        throw error;
      });

    return pending;
  }

  /**
   * Envoie le visiteur sur la page introuvable, en lui disant pourquoi.
   *
   * `reason` : 'donnees' (le fichier des donnees manque ou ne se lit pas),
   * 'creature' ou 'biome' (l'adresse nomme quelque chose qui n'existe pas).
   * La page 404 garde l'adresse de depart pour proposer d'y revenir.
   * Rien ne se passe sur la page 404 elle-meme (elle ne se renverrait pas a
   * elle-meme en boucle), ni ouvert par double-clic (file://) : la page 404
   * part de la racine du site, qu'un fichier local n'a pas.
   * @returns {boolean} vrai si le visiteur part
   */
  function goNotFound(reason) {
    if (typeof document === 'undefined' || location.protocol === 'file:') return false;
    if (document.body && document.body.getAttribute('data-page') === '404') return false;
    const from = (location.pathname.split('/').pop() || 'index.html') + location.search + location.hash;
    location.replace('404.html?raison=' + encodeURIComponent(reason || '') + '&depuis=' + encodeURIComponent(from));
    return true;
  }

  /** Bandeau d'erreur, en haut de page, qui dit quoi faire. */
  function showDataError(error) {
    if (typeof document === 'undefined') return;
    if (document.querySelector('[data-data-error]')) return;
    /* En ligne, la page introuvable prend le relais : elle dit ce qui manque.
       Sur la page 404 elle-meme, elle l'explique deja : pas de bandeau. */
    if (document.body && document.body.getAttribute('data-page') === '404') return;
    if (goNotFound('donnees')) return;

    const offline = location.protocol === 'file:';
    const title = offline
      ? 'Ce wiki doit être servi en http'
      : 'Les données du mod n’ont pas pu être chargées';
    const body = offline
      ? 'Ouvert par double-clic, le navigateur refuse de lire <code>data/wiki_data.json</code> '
        + '— c’est une règle de sécurité, pas un bug du site. Servez le dossier avec n’importe '
        + 'quel serveur statique (l’extension « Live Server » de VS Code, <code>npx serve</code>, '
        + 'ou une publication sur GitHub Pages), et tout s’affichera.'
      : 'Vérifiez que <code>data/wiki_data.json</code> est bien présent à côté de la page. '
        + 'Détail : ' + escapeHtml(String((error && error.message) || error));

    const banner = document.createElement('div');
    banner.className = 'data-error';
    banner.setAttribute('data-data-error', '');
    banner.setAttribute('role', 'alert');
    banner.innerHTML =
      '<strong class="data-error-title">' + title + '</strong>'
      + '<p class="data-error-body">' + body + '</p>';

    const mount = () => document.body && document.body.prepend(banner);
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount);
  }

  Object.assign(OW, { LANG, HIDDEN_ENTITIES, formatMinecraftText, stripFormatCodes, escapeHtml, stripPlaceholders, normalise, loadWikiData, goNotFound });
}(window.OW = window.OW || {}));
