/* Helpers shared by every page: formatting, sprite lookup, page links.

   The icon maps used to be copy-pasted into each page with small differences,
   which is how the same item ended up with two different sprites depending on
   where you looked. There is one list here, and it names only files that exist
   on disk so nothing 404s. */

(function (OW) {
  'use strict';

  const { escapeHtml } = OW;

  /* ---- numbers and text ----------------------------------------------------- */

  const DASH = '—';

  function round(value, decimals) {
    if (value == null || isNaN(value)) return null;
    const p = Math.pow(10, decimals == null ? 1 : decimals);
    return Math.round(value * p) / p;
  }

  /** Formats a number for display, dropping a trailing ".0". */
  /* A l'ecran, la virgule francaise : 4,3 b/s, pas 4.3. */
  function num(value, decimals) {
    const r = round(value, decimals);
    return r == null ? DASH : String(r).replace('.', ',');
  }

  function percent(value) {
    return value == null ? DASH : Math.round(value * 100) + ' %';
  }

  function plural(count, singular, pluralForm) {
    return count + ' ' + (count > 1 ? (pluralForm || singular + 's') : singular);
  }

  function formatTime(seconds) {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /** Turns `minecraft:bamboo_jungle` into `bamboo jungle`. */
  function readableId(id) {
    return String(id || '').replace(/^.*:/, '').replace(/_/g, ' ');
  }

  /* Les noms des biomes, tels que le jeu les affiche en francais. Un biome
     absent de la liste garde une lecture de son identifiant. */
  const BIOME_NAMES = {
    'ow:redwood_forest': 'Forêt de séquoias',
    'ow:mine_field': 'Champ de mines',
    'minecraft:jungle': 'Jungle',
    'minecraft:sparse_jungle': 'Jungle clairsemée',
    'minecraft:bamboo_jungle': 'Jungle de bambous',
    'minecraft:swamp': 'Marais',
    'minecraft:mangrove_swamp': 'Mangrove',
    'minecraft:forest': 'Forêt',
    'minecraft:birch_forest': 'Forêt de bouleaux',
    'minecraft:plains': 'Plaines',
    'minecraft:savanna': 'Savane',
    'minecraft:desert': 'Désert',
    'minecraft:badlands': 'Badlands',
    'minecraft:ocean': 'Océan',
    'minecraft:deep_ocean': 'Océan profond',
    'minecraft:warm_ocean': 'Océan chaud',
    'minecraft:frozen_ocean': 'Océan gelé',
    'minecraft:snowy_plains': 'Plaines enneigées',
    'minecraft:cherry_grove': 'Cerisaie',
    'minecraft:beach': 'Plage',
    'minecraft:lush_caves': 'Grottes luxuriantes',
    'minecraft:savanna_plateau': 'Plateau de savane',
    'minecraft:windswept_savanna': 'Savane venteuse',
    'minecraft:wooded_badlands': 'Badlands boisées',
    'minecraft:eroded_badlands': 'Badlands érodées',
    'minecraft:cold_ocean': 'Océan froid',
    'minecraft:lukewarm_ocean': 'Océan tiède',
    'minecraft:deep_cold_ocean': 'Océan froid profond',
    'minecraft:deep_frozen_ocean': 'Océan gelé profond',
    'minecraft:deep_lukewarm_ocean': 'Océan tiède profond',
    'minecraft:river': 'Rivière',
    'minecraft:frozen_river': 'Rivière gelée',
    'minecraft:taiga': 'Taïga',
    'minecraft:snowy_taiga': 'Taïga enneigée',
    'minecraft:old_growth_pine_taiga': 'Taïga de pins primaire',
    'minecraft:old_growth_spruce_taiga': 'Taïga d\'épicéas primaire',
    'minecraft:dark_forest': 'Forêt noire',
    'minecraft:flower_forest': 'Forêt fleurie',
    'minecraft:meadow': 'Prairie',
    'minecraft:stony_shore': 'Côte rocheuse',
    'minecraft:snowy_beach': 'Plage enneigée',
    'minecraft:mushroom_fields': 'Champs de champignons'
  };

  function biomeName(id) {
    if (BIOME_NAMES[id]) return BIOME_NAMES[id];
    const r = readableId(id);
    return r.charAt(0).toUpperCase() + r.slice(1);
  }

  /** Accent- and case-insensitive comparison, for search and sorting. */
  function fold(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function sortByName(a, b) {
    return String(a).localeCompare(String(b), 'fr');
  }

  /* ---- contrast -------------------------------------------------------------- */

  /* Noir et blanc purs, et non les encres de la charte : sur une pastille de
     couleur, ce sont les deux extremes qui donnent le plus de contraste, et
     quelques centiemes suffisent a faire passer une couleur d espece mediane
     au-dessus du seuil. */
  const INK_DARK = '#0A0A08';
  const INK_LIGHT = '#FFFFFF';

  function channelLuminance(value) {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  /** Relative luminance of a #rrggbb colour, per WCAG. */
  function luminance(hex) {
    const s = String(hex || '').replace('#', '');
    if (s.length < 6) return 0.5;
    return 0.2126 * channelLuminance(parseInt(s.slice(0, 2), 16))
      + 0.7152 * channelLuminance(parseInt(s.slice(2, 4), 16))
      + 0.0722 * channelLuminance(parseInt(s.slice(4, 6), 16));
  }

  function contrastRatio(a, b) {
    const [hi, lo] = a > b ? [a, b] : [b, a];
    return (hi + 0.05) / (lo + 0.05);
  }

  /**
   * Ink that reads on a coloured badge.
   *
   * Species and rarity colours span the whole range — amber is bright, the boss
   * red and the abyss blue are dark. Fixing badge text to dark ink left the darker
   * ones at ~2.6:1. Rather than guess from a luminance threshold, both inks are
   * measured and the better one wins. The palette itself is untouched.
   */
  function contrastInk(hex) {
    const background = luminance(hex);
    return contrastRatio(background, luminance(INK_DARK)) >= contrastRatio(background, luminance(INK_LIGHT))
      ? INK_DARK
      : INK_LIGHT;
  }

  function toRgb(hex) {
    const s = String(hex || '').replace('#', '');
    if (s.length < 6) return [242, 163, 44];
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }

  function toHex(rgb) {
    return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }

  function mix(hex, target, amount) {
    const a = toRgb(hex);
    const b = toRgb(target);
    return toHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * amount));
  }

  /* La surface la plus DEFAVORABLE de chaque theme, et non sa surface
     courante.

     Une couleur teintee ne sert pas que sur --panel : on la retrouve sur les
     puces (--inset), les lignes survolees (--raised), les etiquettes de skin.
     Calibrer le contraste sur --panel laissait donc passer des textes a 3.4:1
     des qu ils reposaient sur un aplat plus sombre en theme clair.

     On vise ici le pire cas de chaque theme : le fond le plus sombre du theme
     clair, le fond le plus clair du theme sombre. Toute autre surface donne
     alors davantage de contraste, jamais moins. */
  const PANEL_DARK = '#2C4A3B';   /* --raised-hi, le plus clair des fonds sombres */
  const PANEL_LIGHT = '#E0D6BE';  /* --inset, le plus sombre des fonds clairs */
  const MIN_RATIO = 4.5;

  function readableAgainst(hex, panel, towards) {
    const panelLuminance = luminance(panel);
    let candidate = hex;
    for (let step = 0; step <= 10; step++) {
      if (contrastRatio(luminance(candidate), panelLuminance) >= MIN_RATIO) return candidate;
      candidate = mix(hex, towards, step / 10);
    }
    return candidate;
  }

  /**
   * A species or status colour, adjusted per theme so it stays readable as text.
   *
   * The palette is mid-tone by design — the orca's slate (#28313E) and the boa's
   * olive (#566022) sit close to both grounds. Used raw they landed at 1.1:1 on
   * the dark panel. Each theme gets the same hue nudged just far enough toward its
   * own extreme to clear 4.5:1, and no further.
   *
   * @returns {{onDark: string, onLight: string}}
   */
  function tintFor(hex) {
    return {
      onDark: readableAgainst(hex, PANEL_DARK, '#FFFFFF'),
      onLight: readableAgainst(hex, PANEL_LIGHT, '#12100A')
    };
  }

  /** Inline custom properties for a tinted element: `style="${tintStyle(color)}"`. */
  function tintStyle(color) {
    /* A CSS variable cannot be measured here, so it is passed through untouched
       and both themes get the same value. */
    if (!/^#[0-9a-f]{6}$/i.test(String(color || ''))) {
      return '--tint:' + (color || 'var(--accent-text)');
    }
    const tint = tintFor(color);
    return '--tint:' + tint.onDark + ';--tint-light:' + tint.onLight;
  }

  /* ---- sprites -------------------------------------------------------------- */

  /* Item and tool sprites shipped with the wiki, keyed by the bare path the mod
     uses. Anything absent falls back to a category glyph, dimmed, so it reads as
     "no art yet" instead of a broken tile. */
  const ITEM_SPRITES = {
    crocodile_scale: 'assets/item/crocodile_scale.png',
    jade: 'assets/item/jade.png',
    plant_fiber: 'assets/item/plant_fiber.png',
    predator_tooth: 'assets/item/predator_tooth.png',
    raw_tiger: 'assets/item/raw_tiger.png',
    ruby: 'assets/item/ruby.png',
    tiger_fur: 'assets/item/tiger_fur.png',

    camouflage_boots: 'assets/tools/camouflage_boots.png',
    camouflage_chestplate: 'assets/tools/camouflage_chestplate.png',
    camouflage_helmet: 'assets/tools/camouflage_helmet.png',
    camouflage_leggings: 'assets/tools/camouflage_leggings.png',
    jade_axe: 'assets/tools/jade_axe.png',
    jade_boots: 'assets/tools/jade_boots.png',
    jade_chestplate: 'assets/tools/jade_chestplate.png',
    jade_helmet: 'assets/tools/jade_helmet.png',
    jade_hoe: 'assets/tools/jade_hoe.png',
    jade_leggings: 'assets/tools/jade_leggings.png',
    jade_pickaxe: 'assets/tools/jade_pickaxe.png',
    jade_shovel: 'assets/tools/jade_shovel.png',
    jade_sword: 'assets/tools/jade_sword.png',
    maya_blowpipe: 'assets/tools/maya_blowpipe.png',
    primitive_sickle: 'assets/tools/primitive_sickle.png',
    primitive_slingshot: 'assets/tools/primitive_slingshot.png',
    primitive_spear: 'assets/tools/primitive_spear.png',
    reptilian_daggers: 'assets/tools/reptilian_daggers.png',
    ruby_axe: 'assets/tools/ruby_axe.png',
    ruby_hoe: 'assets/tools/ruby_hoe.png',
    ruby_pickaxe: 'assets/tools/ruby_pickaxe.png',
    ruby_shovel: 'assets/tools/ruby_shovel.png',
    ruby_sword: 'assets/tools/ruby_sword.png'
  };

  /* Saddles are rendered per creature where the art exists. */
  const SADDLE_SPRITES = {
    tiger_saddle: 'assets/pages/tiger/saddle.png',
    kodiak_saddle: 'assets/pages/kodiak/saddle.png',
    crocodile_saddle: 'assets/pages/crocodile/saddle.png'
  };

  /* Icones de repli, par categorie, quand le mod ne livre pas encore le sprite
     exact. L'ordre compte : la premiere expression qui matche gagne, donc les
     motifs precis passent avant les generiques. Tout ce qui sort d'ici est
     marque `exact: false` et s'affiche attenue, pour ne jamais faire passer une
     approximation pour la vraie icone.

     La liste couvre volontairement les items vanilla cites par les regimes
     alimentaires — boeuf, saumon, bambou… : c'est la ou les trous se voyaient
     le plus, la fiche annoncant « nourriture acceptee » puis n'affichant rien. */
  const CATEGORY_FALLBACK = [
    [/saddle|selle/, 'assets/pages/tiger/saddle.png'],
    [/sword|axe|pickaxe|shovel|hoe|dagger|spear|blowpipe|sling|sickle|trap|dart|arrow/, 'assets/ui/tools.png'],
    [/helmet|chestplate|leggings|boots|armor/, 'assets/ui/skins.png'],
    [/jade|ruby|ore|mineral|gem|ingot|nugget|amethyst|diamond|emerald|coal|flint/, 'assets/ui/mineral.png'],
    [/music|disc|record/, 'assets/ui/red_panda_music.png'],
    [/wool|carpet|bed/, 'assets/ui/skins.png'],
    /* Viandes : celles du mod (ow:raw_boa, ow:raw_peacock…) comme les vanilla. */
    [/raw_|cooked_|meat|flesh|steak|beef|porkchop|mutton|chicken|rabbit|venison/, 'assets/item/raw_tiger.png'],
    [/fish|salmon|cod|tropical|pufferfish|kelp/, 'assets/item/raw_tiger.png'],
    [/fur|hide|pelt|coat|wool_ball/, 'assets/item/tiger_fur.png'],
    [/tooth|fang|claw|horn|tusk|bone/, 'assets/item/predator_tooth.png'],
    [/scale|shell|gland|carapace/, 'assets/item/crocodile_scale.png'],
    /* Vegetaux et sucres : bambou, ble, baies, miel, tout le regime herbivore. */
    [/fiber|plant|leaf|leaves|flower|bamboo|wheat|seed|berry|berries|apple|carrot|potato|beetroot|melon|sugar|honey|cocoa|sweet/, 'assets/item/plant_fiber.png'],
    [/stick|log|wood|plank|branch/, 'assets/item/wooden_stinger.png'],
    [/string|rope|web|vine/, 'assets/item/plant_fiber.png'],
    [/leather/, 'assets/item/tiger_fur.png'],
    /* Une entite citee comme ingredient (oeuf de spawn, monture) : sa tete. */
    [/egg|spawn/, 'assets/ui/animal.png']
  ];

  /**
   * Resolves an item id to a sprite.
   * @returns {{src: string, exact: boolean}} `exact` is false for category glyphs.
   */
  function itemSprite(id) {
    const key = String(id || '').replace(/^.*[:/]/, '').replace(/\s+/g, '_').toLowerCase();
    if (ITEM_SPRITES[key]) return { src: ITEM_SPRITES[key], exact: true };
    if (SADDLE_SPRITES[key]) return { src: SADDLE_SPRITES[key], exact: true };

    for (const [pattern, src] of CATEGORY_FALLBACK) {
      if (pattern.test(key)) return { src, exact: false };
    }
    return { src: 'assets/ui/animal.png', exact: false };
  }

  /**
   * Les images candidates d'un objet, dans l'ordre, selon d'ou il vient :
   *   « minecraft:… »  assets/mcitems/<nom>.png, puis le bloc de Minecraft
   *                    dessine en cube (assets/mcblocks/, js/block-icons.js) ;
   *   « ow:… » ou nu   assets/item/<nom>.png (le dossier textures/item du mod,
   *                    recopie tel quel), ses variantes (_2d, singulier),
   *                    l'ancienne carte, puis le bloc du mod en cube ;
   * et enfin l'icone de repli de sa categorie. Avec imgAttr() et
   * resolveImages(), la premiere qui charge s'affiche : deposer un fichier au
   * bon nom suffit a le faire apparaitre.
   *
   * « block:<id> » n'est pas un fichier : resolveImages() y dessine le cube.
   */
  function itemCandidates(id) {
    const raw = String(id || '').trim();
    const ns = (raw.match(/^([a-z0-9_.-]+):/) || [])[1] || null;
    const key = raw.replace(/^.*[:/]/, '').replace(/\s+/g, '_').toLowerCase();
    const full = ns ? ns + ':' + key : key;
    const block = OW.blockModel && OW.blockModel(full) ? 'block:' + full : null;
    const flat = OW.blockCandidates ? OW.blockCandidates(full) : [];
    let list;
    if (ns === 'minecraft') {
      list = ['assets/mcitems/' + key + '.png', block].concat(flat);
    } else {
      list = ['assets/item/' + key + '.png', 'assets/item/' + key + '_2d.png'];
      if (/s$/.test(key)) list.push('assets/item/' + key.slice(0, -1) + '.png');
      if (ITEM_SPRITES[key]) list.push(ITEM_SPRITES[key]);
      if (SADDLE_SPRITES[key]) list.push(SADDLE_SPRITES[key]);
      list.push(block);
      list = list.concat(flat);
    }
    const fallback = itemSprite(id);
    if (!fallback.exact) list.push(fallback.src);
    return list.filter((u, i) => u && list.indexOf(u) === i);
  }

  function saddleSprite(slug) {
    return SADDLE_SPRITES[slug + '_saddle'] || null;
  }

  const ARCHETYPE_ICONS = ['assassin', 'berserker', 'healer', 'marauder', 'normal', 'scout', 'tank'];

  function archetypeIcon(name) {
    const key = String(name || 'normal').toLowerCase();
    return 'assets/archetypes/' + (ARCHETYPE_ICONS.indexOf(key) !== -1 ? key : 'normal') + '.png';
  }

  /* Les couleurs des archetypes dans le mod : les codes de mise en forme
     Minecraft de leurs infobulles (tooltip.mobTypes*), §b Tank, §4 Assassin,
     §5 Maraudeur, §a Soigneur, §6 Berserker, §e Eclaireur, §f Normal.
     Partagees par la page Mecaniques et le haut de chaque fiche. */
  const ARCHETYPE_COLOR = {
    TANK: '#55FFFF', ASSASSIN: '#AA0000', MARAUDER: '#AA00AA', HEALER: '#55FF55',
    BERSERKER: '#FFAA00', SCOUT: '#FFFF55', NORMAL: '#FFFFFF'
  };

  function archetypeColor(name) {
    return ARCHETYPE_COLOR[String(name || 'NORMAL').toUpperCase()] || ARCHETYPE_COLOR.NORMAL;
  }

  /* Leurs noms en francais, tels que la page Mecaniques les titre. */
  const ARCHETYPE_LABEL = {
    TANK: 'Tank', ASSASSIN: 'Assassin', MARAUDER: 'Maraudeur', HEALER: 'Soigneur',
    BERSERKER: 'Berserker', SCOUT: 'Éclaireur', NORMAL: 'Normal'
  };

  function archetypeLabel(name) {
    const key = String(name || 'NORMAL').toUpperCase();
    return ARCHETYPE_LABEL[key] || String(name || '');
  }

  /* La couleur du nom d'un archetype, celle des titres de la page
     Mecaniques : la couleur brute, eclaircie seulement si elle tombe sous
     3:1 contre #0B0F0C (le rouge et le violet fonces du mod), comme les
     paliers de difficulte. */
  function archetypeInk(hex) {
    const bgLum = luminance('#0B0F0C');
    const ratio = (c) => (luminance(c) + 0.05) / (bgLum + 0.05);
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    let out = hex;
    for (let t = 0; t <= 1 && ratio(out) < 3; t += 0.04) {
      out = '#' + rgb.map((v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('');
    }
    return out;
  }

  /** The coin sprite grows with the amount: 0, 200, 300, 500. */
  function coinSprite(amount) {
    const value = amount || 0;
    if (value >= 500) return 'assets/ui/coins/coin_3.png';
    if (value >= 300) return 'assets/ui/coins/coin_2.png';
    if (value >= 200) return 'assets/ui/coins/coin_1.png';
    return 'assets/ui/coins/coin_0.png';
  }

  /* Renders of the natural (non-cosmetic) variants, where the art exists. */
  function variantRender(slug, index) {
    return 'assets/pages/' + slug + '/' + slug + '_' + index + '.png';
  }

  /* Renders of the cosmetic skins on the creature page. */
  function skinRender(slug, index) {
    return 'assets/pages/' + slug + '/skin_' + index + '.png';
  }

  /* La planche carree d'une carte d'attaque, telle que le mod la dessine : une
     par emplacement a touche dediee. Les passifs et la secondaire alternative
     sans planche renvoient null — a l'appelant de retomber sur son sigil ou sur
     la tete de la bete. */
  const ATTACK_FILE = {
    combo: 'attack_0',
    secondary: 'attack_1',
    'secondary-alt': 'attack_1_2',
    ultimate: 'attack_2'
  };

  function attackCard(slug, card) {
    const file = ATTACK_FILE[card && card.role];
    return file ? 'assets/pages/' + slug + '/' + file + '.png' : null;
  }

  /* ---- ou se trouve vraiment la bete dans son image -------------------------

     Les rendus solo sont tous des plans 16/9 de la meme taille, mais la bete
     n'y est pas toujours au milieu : le gorille est pose a 55,6 % de la
     largeur, le tigre a 47,4 %. Centrer l'image ne centre donc pas l'animal —
     sur une carte, il apparait decale d'un bon dixieme vers la droite ou vers
     la gauche, et deux cartes voisines ne s'alignent pas.

     Plutot qu'une table de decalages ecrite a la main (qui vieillirait au
     premier rendu ajoute), on mesure : l'image est redessinee minuscule sur un
     canevas, on cherche les colonnes ou quelque chose est opaque, et le milieu
     de ces colonnes est le vrai milieu de la bete. Soixante-quatre colonnes
     suffisent — on cherche un cadrage, pas un contour.

     Le resultat est garde le temps de l'onglet (sessionStorage), pas plus.
     Il etait garde pour toujours (localStorage), sous le seul nom du fichier :
     un rendu remplace depuis gardait la mesure de l'ancien, et la bete
     sortait de sa carte, poussee d'un quart vers la droite. Une nouvelle
     visite remesure donc, et l'ancienne memoire est effacee. */

  const CENTRE_KEY = 'ow-art-centre-v2';
  const CENTRE_COLS = 64;
  let centres = null;

  try { window.localStorage.removeItem('ow-art-centre'); } catch (e) { /* rien */ }

  function centreStore() {
    if (centres) return centres;
    centres = {};
    try {
      const raw = window.sessionStorage.getItem(CENTRE_KEY);
      if (raw) centres = JSON.parse(raw) || {};
    } catch (e) { centres = {}; }
    return centres;
  }

  function rememberCentre(url, value) {
    const bag = centreStore();
    bag[url] = value;
    try { window.sessionStorage.setItem(CENTRE_KEY, JSON.stringify(bag)); } catch (e) { /* rien */ }
  }

  /**
   * La position horizontale du sujet dans une image, entre 0 et 1.
   *
   * @param {HTMLImageElement} img une image deja chargee
   * @param {string} [key] l'adresse sous laquelle garder la mesure
   * @returns {number|null} .5 pour une image centree, null si illisible
   */
  function contentCentre(img, key) {
    const url = key || (img && img.src) || '';
    const bag = centreStore();
    if (bag[url] != null) return bag[url];
    if (!img || !img.naturalWidth) return null;
    try {
      const w = CENTRE_COLS;
      const h = Math.max(1, Math.round(w * img.naturalHeight / img.naturalWidth));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let left = -1;
      let right = -1;
      for (let x = 0; x < w; x++) {
        let solid = false;
        for (let y = 0; y < h && !solid; y++) if (data[(y * w + x) * 4 + 3] > 16) solid = true;
        if (!solid) continue;
        if (left < 0) left = x;
        right = x;
      }
      /* Une image vide, ou pleine bord a bord : rien a corriger. */
      const centre = left < 0 ? 0.5 : (left + right + 1) / 2 / w;
      rememberCentre(url, centre);
      return centre;
    } catch (e) {
      /* Canevas illisible (image d'une autre origine) : on ne touche a rien. */
      return null;
    }
  }

  /* ---- images a chemin conventionnel ---------------------------------------

     Le wiki nomme ses visuels par convention :

       assets/pages/<espece>/<espece>_0.png   variante naturelle
       assets/pages/<espece>/skin_0.png       rendu d'un skin sans fiche (js/skins.js)
       assets/pages/<espece>/attack_0.png     carte de combo
       assets/pages/<espece>/attack_1.png     carte secondaire
       assets/pages/<espece>/attack_1_2.png   seconde carte secondaire
       assets/pages/<espece>/attack_2.png     carte d'ultime
       assets/pages/<espece>/anim_0.gif       apercu anime (0, 1, 2… sans plafond)
       assets/pages/<espece>/gallery_0.png    capture de galerie (idem)
       assets/pages/<espece>/saddle.png       selle

     Avant, un inventaire code en dur decidait quels fichiers existaient. Il est
     tombe perime deux fois — le boa et l'orque avaient leurs trois cartes
     d'attaque sur le disque sans qu'aucune ne s'affiche, et deux wallpapers
     etaient declares absents.

     Desormais on ecrit toujours le chemin conventionnel, et le navigateur
     tranche : la premiere image de la liste qui se charge vraiment est celle
     qui s'affiche ; sinon on passe a la suivante, jusqu'au repli. Deposer un
     fichier au bon nom suffit donc a le faire apparaitre, sans toucher au code.

     Usage dans un gabarit :
       <span data-img="a.png|b.png" data-img-mode="bg"></span>
       <img data-img="a.png|b.png">                (mode 'src' par defaut)
     Et si aucune ne charge : data-img-empty="hide" retire l'element,
     "mark" lui pose data-img-missing pour que le CSS s'en occupe.          */

  /* ---- le cache des essais -------------------------------------------------

     Le procede a un cout : chaque chemin conventionnel qui n'existe pas est un
     aller-retour pour rien. Sur la page des objets, une trentaine de fichiers
     absents (les oeufs d'apparition, le piege a ours) sont redemandes a chaque
     page visitee — trente allers-retours de latence sur un telephone, avant
     meme que la page ne s'affiche.

     Le verdict de chaque chemin est donc garde dans l'onglet (sessionStorage) :
     la page suivante du wiki ne redemande plus rien. Un fichier trouve le
     reste ; un fichier absent est reverifie au bout de deux minutes
     (PROBE_MISS_TTL), si bien qu'un fichier depose entre-temps apparait au
     rechargement suivant — la regle « deposer un fichier suffit » tient.

     Un onglet prive, ou un stockage refuse, retombe simplement sur la memoire
     de la page : le site fonctionne, il redemande juste comme avant. */

  const PROBE_KEY = 'ow-img-probe';
  /* Un « present » vaut pour toute la session ; un « absent » deux minutes
     seulement. Sinon un fichier depose apres une premiere visite (runWikiDatas
     le pousse sur GitHub) restait invisible a chaque rechargement du meme
     onglet, jusqu'a la fermeture du navigateur. */
  const PROBE_MISS_TTL = 2 * 60 * 1000;
  const imageProbes = {};
  let probeSeen = null;
  let probeDirty = false;

  function probeCache() {
    if (probeSeen) return probeSeen;
    probeSeen = {};
    /* En local, rien n'est garde d'une page a l'autre : un fichier depose
       pendant qu'on navigue doit apparaitre au rechargement suivant, pas
       seulement dans un nouvel onglet. */
    if (LOCAL_HOST) return probeSeen;
    try {
      const raw = window.sessionStorage.getItem(PROBE_KEY);
      if (raw) probeSeen = JSON.parse(raw) || {};
    } catch (e) { probeSeen = {}; }
    return probeSeen;
  }

  /* Une seule ecriture par salve : resolveImages() en produit des dizaines
     coup sur coup. */
  /** Ce que la session sait deja d'une URL : vrai, faux, ou null (a verifier). */
  function cachedProbe(url) {
    const v = probeCache()[url];
    if (v === 1) return true;
    if (typeof v === 'number' && v > 1 && Date.now() - v < PROBE_MISS_TTL) return false;
    return null;
  }

  function rememberProbe(url, ok) {
    probeCache()[url] = ok ? 1 : Date.now();
    if (probeDirty || LOCAL_HOST) return;
    probeDirty = true;
    setTimeout(() => {
      probeDirty = false;
      try { window.sessionStorage.setItem(PROBE_KEY, JSON.stringify(probeSeen)); } catch (e) { /* rien */ }
    }, 400);
  }

  /* ---- l'inventaire des fichiers ---------------------------------------------

     js/asset-list.js (tools/list-assets.py) liste ce que contient assets/.
     Il ne sert qu'a ACCELERER : un chemin qu'il connait s'affiche sans etre
     verifie. Il n'interdit jamais rien : un chemin qu'il ne connait pas est
     essaye quand meme, a son rang. Un fichier depose sans relancer l'outil
     s'affiche donc toujours — avant, l'inventaire perime cachait tout ce qui
     avait ete ajoute depuis (rendus de variantes, selles, GIF, sons).

     En local (Live Server, fichier, reseau de la maison), l'inventaire est
     ignore : un fichier depose apparait tout de suite. */
  const LOCAL_HOST = location.protocol === 'file:'
    || /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost|.*\.test)$/.test(location.hostname)
    || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(location.hostname);
  let assetIndex = null;

  /** Vrai / faux selon l'inventaire, null quand il ne tranche pas. */
  function assetKnown(url) {
    const list = OW.ASSET_LIST;
    if (LOCAL_HOST || !list || !list.files) return null;
    let path;
    try { path = decodeURI(String(url).split(/[?#]/)[0]).replace(/^\.?\//, ''); } catch (e) { return null; }
    if (!/^assets\//.test(path)) return null;
    if (!assetIndex) {
      assetIndex = new Set();
      Object.keys(list.files).forEach((dir) => list.files[dir].forEach((name) => assetIndex.add(dir + '/' + name)));
    }
    return assetIndex.has(path);
  }

  /** Les candidats dans l'ordre, chacun marque `sure` si l'inventaire le
      connait (pas besoin de le verifier). Les autres restent dans la liste :
      l'appelant les essaie jusqu'au premier qui charge. */
  function worthTrying(urls) {
    return urls.map((url) => ({ url, sure: assetKnown(url) === true }));
  }

  /** Vrai/faux, en cache : cette URL charge-t-elle ? */
  function probeImage(url) {
    if (imageProbes[url]) return imageProbes[url];
    const known = cachedProbe(url);
    if (known != null) {
      imageProbes[url] = Promise.resolve(known);
      return imageProbes[url];
    }
    imageProbes[url] = new Promise((resolve) => {
      const probe = new Image();
      probe.onload = () => { rememberProbe(url, probe.naturalWidth > 0); resolve(probe.naturalWidth > 0); };
      probe.onerror = () => { rememberProbe(url, false); resolve(false); };
      probe.src = url;
    });
    return imageProbes[url];
  }

  /** Vrai/faux, en cache : ce fichier existe-t-il ? Une requete HEAD, sans
      telecharger le fichier (un GIF pese plusieurs Mo). Hors serveur (file:),
      HEAD echoue : on retombe sur le chargement de l'image. */
  function assetExists(url) {
    const u = asset(url);
    if (assetKnown(u) === true) return Promise.resolve(true);
    if (imageProbes[u]) return imageProbes[u];
    const known = cachedProbe(u);
    if (known != null) return (imageProbes[u] = Promise.resolve(known));
    imageProbes[u] = fetch(u, { method: 'HEAD', cache: 'no-store' })
      .then((r) => { rememberProbe(u, r.ok); return r.ok; })
      .catch(() => { delete imageProbes[u]; return probeImage(u); });
    return imageProbes[u];
  }

  /**
   * Une serie de fichiers numerotes (anim_0.gif, anim_1.gif…) : ceux qui
   * existent, dans l'ordre. On cherche jusqu'a deux trous d'affilee, sans
   * plafond — deposer un anim_7.gif apres le 6 suffit a l'ajouter.
   */
  async function findSeries(pathOf, max) {
    const found = [];
    let misses = 0;
    for (let i = 0; i < (max || 40) && misses < 2; i++) {
      /* eslint-disable-next-line no-await-in-loop -- on s'arrete au premier grand trou */
      if (await assetExists(pathOf(i))) { found.push(pathOf(i)); misses = 0; } else misses += 1;
    }
    return found;
  }

  /** La premiere image de la liste qui charge (promesse), ou null. Un
      candidat « block:<id> » rend le cube dessine (URL data:). */
  async function firstImage(candidates) {
    for (const { url, sure } of worthTrying(candidates.filter(Boolean).map(asset))) {
      if (/^block:/.test(url)) {
        /* eslint-disable-next-line no-await-in-loop */
        const cube = OW.blockIcon ? await OW.blockIcon(url.slice(6)) : null;
        if (cube) return cube;
        continue;
      }
      /* eslint-disable-next-line no-await-in-loop -- l'ordre est la priorite */
      if (sure || await probeImage(url)) return url;
    }
    return null;
  }

  /* ---- les icones qui defilent ------------------------------------------------

     Un ingredient qui accepte plusieurs objets (« laine de n'importe quelle
     couleur », « X ou Y ») montre chacun d'eux a tour de role, une seconde
     chacun, comme les livres de recettes du jeu. Toutes les icones changent
     ensemble, calees sur l'horloge : deux pages ouvertes, ou un onglet
     masque puis rouvert, restent en phase.

     Dans un gabarit, a cote de l'image du premier objet :
       <span ${imgAttr(itemCandidates(ids[0]), { mode: 'bg' })} ${cycleAttr(ids, decalage)}>
     `decalage` fait partir l'icone plus loin dans la liste : la laine
     principale et la secondaire ne montrent pas la meme couleur. */

  function cycleAttr(ids, offset) {
    const list = (ids || []).filter(Boolean);
    if (list.length < 2) return '';
    return 'data-cycle="' + list.join('|').replace(/"/g, '%22') + '"'
      + (offset ? ' data-cycle-offset="' + (offset | 0) + '"' : '');
  }

  const cycleUrls = {};
  function cycleUrl(id) {
    if (!(id in cycleUrls)) cycleUrls[id] = firstImage(itemCandidates(id));
    return cycleUrls[id];
  }

  let cycleTimer = 0;
  function cycleTick() {
    if (document.hidden) return;
    const now = Math.floor(Date.now() / 1000);
    document.querySelectorAll('[data-cycle]').forEach((el) => {
      const ids = el.getAttribute('data-cycle').split('|');
      /* Toutes les images de la liste se preparent ensemble des le premier
         passage : le premier tour n'attend pas chaque couleur une a une. */
      ids.forEach(cycleUrl);
      const start = (now + (parseInt(el.getAttribute('data-cycle-offset'), 10) || 0)) % ids.length;
      /* Le prochain objet qui a une image : un trou dans la liste est saute. */
      (async () => {
        for (let k = 0; k < ids.length; k++) {
          const id = ids[(start + k) % ids.length];
          /* eslint-disable-next-line no-await-in-loop */
          const url = await cycleUrl(id);
          if (!url) continue;
          if (el.getAttribute('data-cycle-now') === id) return;
          el.setAttribute('data-cycle-now', id);
          if (el.tagName === 'IMG') el.src = url;
          else el.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
          return;
        }
      })();
    });
  }
  function startCycling() {
    if (cycleTimer) return;
    /* Cale sur le debut de chaque seconde. */
    setTimeout(() => { cycleTick(); cycleTimer = setInterval(cycleTick, 1000); }, 1000 - (Date.now() % 1000));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) cycleTick(); });
  }
  startCycling();

  /**
   * Applique a un element la premiere image de sa liste qui existe.
   *
   * Marque l'element des le depart pour ne jamais le traiter deux fois : les
   * pages re-rendent leurs listes a chaque changement de filtre, et enhance()
   * repasse derriere.
   */
  /* ---- le chargement progressif des gros rendus -------------------------------

     Les rendus les plus lourds (fonds d'ecran, rendus solo, biomes, arenes,
     structures) ont une vignette floue de quelques Ko au meme chemin sous
     assets/thumbs/ (tools/build-thumbs.py). Elle s'affiche tout de suite, puis
     l'original, tel quel, la remplace des qu'il est arrive. */
  const THUMBED = /^assets\/(?:wallpapers|entities\/solo|biomes|arena|structures)\/[^|'"]+\.png$/;
  const OPAQUE_THUMBED = /^assets\/(?:wallpapers|biomes|arena|structures)\//;
  function thumbOf(url) {
    const u = String(url || '');
    return THUMBED.test(u) ? 'assets/thumbs/' + u.slice('assets/'.length) : null;
  }

  async function resolveImage(el) {
    if (el.hasAttribute('data-img-done')) return;
    el.setAttribute('data-img-done', '');

    const candidates = (el.getAttribute('data-img') || '').split('|')
      .map((s) => s.trim()).filter(Boolean);
    const mode = el.getAttribute('data-img-mode') || (el.tagName === 'IMG' ? 'src' : 'bg');
    const thumb = mode === 'bg' ? thumbOf(candidates[0]) : null;
    if (thumb && !el.style.backgroundImage) el.style.backgroundImage = "url('" + thumb.replace(/'/g, '%27') + "')";

    const tries = worthTrying(candidates.map(asset));
    for (const { url, sure } of tries) {
      const original = candidates[candidates.map(asset).indexOf(url)];
      /* Un bloc a dessiner (js/block-icons.js) : son cube, s'il a toutes ses
         textures ; sinon on passe au candidat suivant. */
      if (/^block:/.test(url)) {
        /* eslint-disable-next-line no-await-in-loop */
        const cube = OW.blockIcon ? await OW.blockIcon(url.slice(6)) : null;
        if (!cube) continue;
        el.setAttribute('data-img-found', original);
        if (mode === 'src') el.src = cube;
        else el.style.backgroundImage = 'url("' + cube + '")';
        return;
      }
      /* eslint-disable no-await-in-loop -- l'ordre EST la regle de priorite */
      if (!sure && !(await probeImage(url))) continue;
      el.setAttribute('data-img-found', original);
      const apply = () => {
        /* Une icone qui defile a deja pris la main (cycleAttr). */
        if (el.hasAttribute('data-cycle-now')) return;
        if (mode === 'src') el.src = url;
        else el.style.backgroundImage = "url('" + url.replace(/'/g, '%27') + "')";
      };
      /* data-img-lazy : l'element reste en place (on sait que l'image existe),
         mais le fichier n'est telecharge qu'a l'approche — les GIF et les
         captures d'une fiche pesent plusieurs Mo, huit chapitres plus bas. */
      if (el.hasAttribute('data-img-lazy') && 'IntersectionObserver' in window) whenNear(el, apply);
      else apply();
      return;
    }

    /* Aucune n'a charge. */
    const empty = el.getAttribute('data-img-empty');
    if (empty === 'hide') el.remove();
    else el.setAttribute('data-img-missing', '');
  }

  let nearObserver = null;
  const nearJobs = new WeakMap();
  function whenNear(el, job) {
    if (!nearObserver) {
      nearObserver = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        nearObserver.unobserve(e.target);
        const run = nearJobs.get(e.target);
        nearJobs.delete(e.target);
        if (run) run();
      }), { rootMargin: '900px 0px' });
    }
    nearJobs.set(el, job);
    nearObserver.observe(el);
  }

  /* Une image dans un panneau cache — un onglet ferme, un historique replie —
     ne se charge qu'une fois la page prete : elle ne dispute pas le reseau a
     ce qu'on voit. Si le panneau s'ouvre avant, elle se charge a l'instant ou
     il s'affiche. Le resultat a l'ecran est le meme ; seul l'ordre change. */
  const deferredImages = new Set();
  let deferObserver = null;
  let deferIdle = false;

  function flushDeferred(el) {
    if (!deferredImages.delete(el)) return;
    if (deferObserver) deferObserver.unobserve(el);
    resolveImage(el);
  }

  function deferImage(el) {
    if (deferredImages.has(el)) return;
    deferredImages.add(el);
    if (!deferObserver) {
      deferObserver = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting || e.target.getClientRects().length) flushDeferred(e.target);
      }), { rootMargin: '600px' });
    }
    deferObserver.observe(el);
    if (deferIdle) return;
    deferIdle = true;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
    const all = () => idle(() => Array.from(deferredImages).forEach(flushDeferred), { timeout: 2000 });
    if (document.readyState === 'complete') all();
    else window.addEventListener('load', all, { once: true });
  }

  /** Resout toutes les images conventionnelles d'un fragment. */
  function resolveImages(root) {
    (root || document).querySelectorAll('[data-img]:not([data-img-done])').forEach((el) => {
      if (el.getClientRects().length || !('IntersectionObserver' in window)) resolveImage(el);
      else deferImage(el);
    });
  }

  /** Attribut pret a coller dans un gabarit : `${imgAttr([a, b])}`. */
  function imgAttr(candidates, options) {
    const opts = options || {};
    const list = candidates.filter(Boolean).map((u) => String(u).replace(/"/g, '%22'));
    return 'data-img="' + list.join('|') + '"'
      + (opts.mode ? ' data-img-mode="' + opts.mode + '"' : '')
      + (opts.empty ? ' data-img-empty="' + opts.empty + '"' : '')
      + (opts.lazy ? ' data-img-lazy' : '');
  }

  /**
   * Amene un element sous l'en-tete fixe, en douceur.
   *
   * scrollIntoView() reste sans effet sur ce site (l'ancre calcule mal sa
   * position avec les couches de fond) : on calcule la position nous-memes, et
   * on garde la hauteur de l'en-tete au-dessus du titre vise.
   */
  function scrollToEl(target, behavior) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64;
    const top = el.getBoundingClientRect().top + window.scrollY - header - 20;
    window.scrollTo({ top: Math.max(0, top), behavior: behavior || 'smooth' });
  }

  /* Chemin d'image tel quel : les images du wiki sont servies dans leur format
     d'origine (PNG). En local, « assets/... » part vers le depot GitHub des
     assets (js/remote-assets.js) ; en ligne, Netlify s'en charge (_redirects). */
  function asset(url) { return OW.remoteAsset ? OW.remoteAsset(url) : url; }

  /* ---- les rendus solo et leurs vignettes --------------------------------------

     Le rendu solo d'une bete : assets/entities/solo/<Nom> [SOLO].png, en
     2560 x 1440 — une quinzaine de Mo de memoire une fois decode. Sa vignette :
     le meme rendu en 1280 x 720, au meme nom sous assets/vignettes/
     (tools/build-vignettes.py). Les cartes, la Nouveaute, le podium du guide et
     les portraits de Mecaniques l'affichent sur quelques centaines de pixels :
     a l'oeil la vignette y est identique, et elle pese quatre fois moins. La
     fiche, l'anneau de l'accueil et le labo, qui le montrent en grand, gardent
     l'original.

     Un rendu depose sans relancer l'outil n'a pas encore de vignette : on
     retombe alors sur l'original. */
  const soloName = (slug) => String(slug).split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  const soloPath = (slug) => encodeURI('assets/entities/solo/' + soloName(slug) + ' [SOLO].png');
  const soloVignettePath = (slug) => encodeURI('assets/vignettes/entities/solo/' + soloName(slug) + ' [SOLO].png');
  function soloArt(slug) { return asset(soloPath(slug)); }
  function soloVignette(slug) { return asset(soloVignettePath(slug)); }

  /** Le rendu solo pour une carte (promesse) : l'URL de la vignette, celle de
      l'original a defaut, ou null si la bete n'a pas de rendu solo. */
  const soloLoads = {};
  function loadSoloVignette(slug) {
    if (!soloLoads[slug]) {
      const load = (url) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => resolve(null);
        img.src = url;
      });
      soloLoads[slug] = load(soloVignette(slug)).then((url) => url || load(soloArt(slug)));
    }
    return soloLoads[slug];
  }

  /** Le onerror d'une <img> de vignette : l'original (data-solo-full), puis
      `fallback` (l'image habituelle de la bete). */
  function soloImgError(img, fallback) {
    const full = img.getAttribute('data-solo-full');
    if (full) {
      img.removeAttribute('data-solo-full');
      img.src = full;
      return;
    }
    img.onerror = null;
    if (fallback) img.src = fallback;
  }

  /* ---- les coffres (assets/tribes/chests, 37 x 29 pixels, de face) -----------

     Ou passe vraiment la jointure du couvercle, mesuree sur chaque image : la
     ligne ou il s'arrete (cut), et le fermoir qui pend du couvercle par-dessus
     la caisse ([x debut, x fin, y fin]). Avant, tous les coffres etaient
     coupes a 38 % : le couvercle du jade emportait trop peu, celui de la tribu
     trop, et le fermoir restait colle a la caisse. */
  const CHEST_LIDS = {
    'jade-1': { cut: 19 }, 'jade-2': { cut: 19 }, 'jade-3': { cut: 19 },
    'or-1': { cut: 12, latch: [16, 21, 15] }, 'or-2': { cut: 12, latch: [15, 22, 15] }, 'or-3': { cut: 12, latch: [15, 23, 15] },
    'rubis-1': { cut: 15 }, 'rubis-2': { cut: 15 }, 'rubis-3': { cut: 15 },
    tribu: { cut: 10, latch: [17, 20, 15] }
  };

  /** Les decoupes CSS du couvercle et de la caisse d'un coffre, d'apres son image. */
  function chestLid(url) {
    const key = (String(url).match(/chests\/([a-z]+(?:-\d)?)\.png/) || [])[1];
    const lid = CHEST_LIDS[key] || { cut: 11 };
    const X = (x) => (x / 37 * 100).toFixed(2) + '%';
    const Y = (y) => (y / 29 * 100).toFixed(2) + '%';
    const c = Y(lid.cut);
    let lidClip = `polygon(0 0, 100% 0, 100% ${c}, 0 ${c})`;
    let boxClip = `polygon(0 ${c}, 100% ${c}, 100% 100%, 0 100%)`;
    if (lid.latch) {
      const [x0, x1, y1] = lid.latch;
      lidClip = `polygon(0 0, 100% 0, 100% ${c}, ${X(x1)} ${c}, ${X(x1)} ${Y(y1)}, ${X(x0)} ${Y(y1)}, ${X(x0)} ${c}, 0 ${c})`;
      boxClip = `polygon(0 ${c}, ${X(x0)} ${c}, ${X(x0)} ${Y(y1)}, ${X(x1)} ${Y(y1)}, ${X(x1)} ${c}, 100% ${c}, 100% 100%, 0 100%)`;
    }
    return { cut: c, lidClip, boxClip, style: `--lid-cut:${c};--lid-clip:${lidClip};--box-clip:${boxClip}` };
  }

  /* ---- les animations retirees d'une fiche (js/site-config.js) --------------- */

  /** Vrai si l'animation `name` de la bete `slug` ne doit pas s'afficher. */
  function animationHidden(slug, name) {
    const cfg = OW.SITE_CONFIG && OW.SITE_CONFIG.hiddenAnimations;
    const rules = cfg && cfg[slug];
    if (!rules || !rules.length || !name) return false;
    const upper = String(name).toUpperCase();
    const tokens = upper.split('_');
    const label = OW.animLabel ? fold(OW.animLabel(name)) : '';
    return rules.some((rule) => {
      const r = String(rule || '').trim();
      if (!r) return false;
      const R = r.toUpperCase();
      return R === upper || (R.indexOf('_') === -1 && tokens.indexOf(R) !== -1) || (label && fold(r) === label);
    });
  }

  /* ---- la difficulte d'apprivoisement (js/site-config.js) -------------------
     Les huit paliers, dans l'ordre des visages assets/pages/difficulty/<0-7>.png.
     Le palier d'une bete se regle a la main dans SITE_CONFIG.tamingDifficulty :
     rien n'est deduit de l'XP. */

  const DIFFICULTY_SCALE = [
    { label: 'Très facile', color: '#8FEBC0', desc: 'Quelques poignées de nourriture suffisent. Aucune préparation.' },
    { label: 'Facile', color: '#8FD98A', desc: "La bête approche d'elle-même. Un stock de nourriture et c'est réglé." },
    { label: 'Accessible', color: '#B8C864', desc: 'Il faut du temps et de quoi la rassasier, rien de plus.' },
    { label: 'Modéré', color: '#E0C255', desc: 'Prévoir un tranquillisant et une bonne réserve de nourriture.' },
    { label: 'Difficile', color: '#AD2A12', desc: 'Arc ou sarbacane obligatoires. Le réveil de la bête est brutal.' },
    { label: 'Très difficile', color: '#AD125D', desc: 'Plusieurs tentatives, une armure correcte et un plan de retraite.' },
    { label: 'Redoutable', color: '#480A6D', desc: 'Territoire hostile et créature massive : ne jamais y aller seul.' },
    { label: 'Cauchemar', color: '#2E245F', desc: 'Le palier le plus haut du mod. Équipement complet exigé.' }
  ];

  /** Le palier (0 a 7) choisi pour la bete `slug`, ou null s'il n'est pas reglé. */
  function tamingDifficulty(slug) {
    const cfg = OW.SITE_CONFIG && OW.SITE_CONFIG.tamingDifficulty;
    const n = cfg ? Number(cfg[slug]) : NaN;
    if (Number.isInteger(n) && n >= 1 && n <= DIFFICULTY_SCALE.length) return n - 1;
    if (cfg && cfg[slug] != null) console.warn('tamingDifficulty.' + slug + ' : un palier de 1 à 8 est attendu, pas', cfg[slug]);
    return null;
  }

  /* Wild AI goals are class names in the export; these are their plain-French
     readings. An unmapped goal degrades to a spaced-out version of its name. */
  const BEHAVIOUR_LABEL = {
    TigerDistractedByFoodGoal: 'Se laisse distraire par la nourriture posée au sol',
    TigerDrowsyFleeGoal: 'Fuit quand il est somnolent plutôt que de se battre',
    TigerLeapingGoal: 'Bondit sur sa proie à distance',
    TigerScarifyTreeGoal: 'Griffe les troncs pour marquer son territoire',
    TigerSmellBloodGoal: 'Flaire le sang et remonte la piste des blessés',
    KodiakAttractedToBeeNestGoal: 'Attiré par les ruches et le miel',
    KodiakAttractedToCampfireGoal: "S'approche des feux de camp",
    KodiakAttractedToCropsGoal: 'Vient piller les cultures',
    KodiakAttractedToFoodItemGoal: 'Attiré par la nourriture laissée au sol',
    KodiakCatchFishGoal: 'Pêche à la patte dans les rivières',
    KodiakRandomStrollGoal: 'Déambule sans but sur son territoire',
    KodiakRollGoal: 'Se roule au sol',
    KodiakRubsAgainstTreeGoal: 'Se frotte contre les arbres',
    KodiakSearchInsideChestGoal: 'Fouille les coffres laissés ouverts',
    KodiakSitGoal: "S'assied pour observer les alentours",
    KodiakTemptGoal: 'Se laisse appâter par la main du joueur',
    KodiakTryFindWaterGoal: "Cherche un point d'eau",
    CrocodileAttackGoal: "Attaque en embuscade depuis l'eau",
    CrocodileChargingMouthGoal: 'Garde la gueule ouverte, prête à claquer',
    CrocodileGoToWaterWithFoodGoal: "Emporte sa proie dans l'eau",
    CrocodileNapGoal: 'Somnole sur la berge, immobile',
    MonstersAvoidCrocodileGoal: 'Les monstres évitent son territoire',
    BoaConstrictGoal: "Enserre sa proie jusqu'à l'étouffer",
    BoaEatItemGoal: 'Avale les objets laissés au sol',
    BoaHypnotizeGoal: "Hypnotise sa cible pour l'immobiliser",
    OWOrcaAbyssalDiveGoal: 'Plonge vers les abysses',
    OWOrcaBeachingGoal: "S'échoue volontairement pour attraper une proie à terre",
    OWOrcaBoatStrikeGoal: 'Percute les bateaux',
    OWOrcaBreathingHoleGoal: 'Remonte respirer par un trou dans la glace',
    OWOrcaPackHuntGoal: 'Chasse en meute, coordonnée avec les autres orques',
    OWOrcaPreyToyGoal: 'Joue avec sa proie avant de la tuer',
    OWOrcaSpyhopGoal: "Sort la tête de l'eau pour observer la surface",
    OWOrcaWaveWashGoal: 'Crée une vague pour faire tomber sa cible',
    KangarooAlertedFleeGoal: "Détale dès qu'il est alerté",
    KangarooAngerTargetGoal: "Désigne une cible et s'énerve contre elle",
    KangarooAngryAttackGoal: "Frappe des pattes arrière quand il est en colère",
    KangarooDrownPursuerGoal: "Noie le poursuivant qui le suit dans l'eau",
    KangarooFleeToWaterGoal: "Se réfugie dans l'eau",
    KangarooGrazeGoal: "Broute l'herbe",
    KangarooSeekShadeGoal: "Cherche l'ombre aux heures chaudes",
    KangarooShadeNapGoal: "Fait la sieste à l'ombre",
    KangarooThumpAlertGoal: 'Tape du pied pour alerter le groupe',
    RedPandaAlertedFleeGoal: "S'enfuit au moindre bruit",
    RedPandaCombatHealGoal: 'Se soigne pendant le combat',
    RedPandaEggStealGoal: 'Vole les œufs des nids',
    RedPandaIntimidationGoal: 'Se dresse pour paraître plus grand',
    RedPandaPlayGoal: "Joue avec ce qu'il trouve",
    RedPandaSweetLureGoal: 'Se laisse attirer par les aliments sucrés',
    RedPandaTreeClimbGoal: "Grimpe dans les arbres pour se mettre à l'abri",
    ElephantBrowseGoal: 'Arrache feuillages et herbes avec sa trompe pour se nourrir et se soigner',
    ElephantDouseFireGoal: "Éteint les flammes au jet de trompe, sur lui, un membre du troupeau ou au sol",
    ElephantFollowHerdGoal: "Rejoint la matriarche dès qu'il s'éloigne trop du troupeau",
    ElephantGrudgeTargetGoal: "Garde rancune au tueur d'un membre du troupeau et le charge à vue",
    ElephantHerdDefenseTargetGoal: "Répond à l'alerte du troupeau et s'en prend à la menace",
    ElephantListenGoal: "S'arrête et se tourne vers les pas qu'il sent au sol sans les voir",
    ElephantMockChargeGoal: "Barrit puis fonce sur qui s'approche trop, et s'arrête net juste avant le choc",
    ElephantMournGoal: "Revient veiller un membre du troupeau à l'endroit où il est mort",
    ElephantMusthTargetGoal: "En période de rut, s'en prend à tout joueur ou animal passant trop près",
    ElephantPredatorTargetGoal: 'Charge les lions, tigres, crocodiles, kodiaks et loups qui menacent le troupeau',
    ElephantSeekWaterGoal: "Va boire quand il a soif, surtout aux heures chaudes, puis s'asperge d'eau",
    ElephantSprayPerchedGoal: "Repousse au jet d'eau l'ennemi perché hors de sa portée"
  };

  /** Les comportements sauvages d'une bete, en clair (fiche, Billy). L'export
      liste tout le dossier goals/<espece>/, classes utilitaires comprises
      (ElephantGoals, ElephantWaterRun) : seul un *Goal est un comportement. */
  function wildBehaviours(entity) {
    return (entity.wildBehaviors || []).filter((goal) => /Goal$/.test(goal)).map((goal) => BEHAVIOUR_LABEL[goal] || goal
      .replace(/Goal$/, '').replace(/^OW/, '')
      .replace(/^(Tiger|Kodiak|Crocodile|Boa|Orca|Elephant|Kangaroo|RedPanda|Monsters)/, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2').trim());
  }

  /* ---- links ---------------------------------------------------------------- */

  function animalHref(slug, hash) {
    return 'animal.html?e=' + encodeURIComponent(slug) + (hash ? '#' + hash : '');
  }

  /* ---- DOM ------------------------------------------------------------------ */

  function el(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }

  function render(target, html) {
    const node = typeof target === 'string' ? document.querySelector(target) : target;
    if (node) node.innerHTML = html;
    return node;
  }

  /** Builds a `background-image` declaration from a URL, escaping quotes. */
  function bg(src) {
    const url = String(asset(src)).replace(/'/g, '%27');
    /* Un gros rendu opaque : sa vignette floue dessous, visible le temps que
       l'original arrive, puis entierement recouverte. */
    const thumb = OPAQUE_THUMBED.test(url) ? thumbOf(url) : null;
    return "background-image:url('" + url + "')" + (thumb ? ",url('" + thumb + "')" : '');
  }

  /** Marks up a sprite that may not have art, dimming the fallback. */
  function spriteImg(src, alt, className, exact) {
    return '<img src="' + escapeHtml(asset(src)) + '" alt="' + escapeHtml(alt || '') + '"'
      + ' class="crisp' + (className ? ' ' + className : '') + (exact === false ? ' sprite-placeholder' : '') + '"'
      + ' loading="lazy" decoding="async">';
  }

  /** Hides an image that fails to load rather than showing a broken tile. */
  function guardImages(root) {
    (root || document).querySelectorAll('img[data-guard]:not([data-guarded])').forEach((img) => {
      img.setAttribute('data-guarded', '');
      img.addEventListener('error', () => {
        img.closest('[data-guard-host]')?.setAttribute('data-missing', '');
        img.remove();
      }, { once: true });
    });
  }

  /* ---- footer --------------------------------------------------------------- */

  function footerNote(data, extra) {
    const base = 'VERSION ' + data.meta.version;
    return extra ? base + ' · ' + extra : base;
  }

  Object.assign(OW, { DASH, asset, soloPath, soloVignettePath, soloArt, soloVignette, loadSoloVignette, soloImgError, assetKnown, worthTrying, animationHidden, DIFFICULTY_SCALE, tamingDifficulty, chestLid, round, num, percent, plural, formatTime, readableId, biomeName, fold, sortByName, luminance, contrastInk, tintFor, tintStyle, itemSprite, itemCandidates, saddleSprite, resolveImages, firstImage, cycleAttr, assetExists, findSeries, scrollToEl, imgAttr, archetypeIcon, ARCHETYPE_COLOR, archetypeColor, archetypeInk, ARCHETYPE_LABEL, archetypeLabel, coinSprite, variantRender, skinRender, attackCard, contentCentre, animalHref, wildBehaviours, el, render, bg, spriteImg, guardImages, footerNote });
}(window.OW = window.OW || {}));
