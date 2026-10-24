/* Fiches d'attaques — le pendant web de OWAttacksInformation.java.

   Le mod ecrit ses descriptions avec des %s que le jeu remplit au moment du
   rendu, en piochant dans OWAttacksConstants. L'export JSON transporte bien
   ces constantes (`attack_constants` et `constants`), mais pas la
   correspondance : rien n'y dit que le premier %s de `primal_roar.desc` vaut
   PRIMAL_ROAR_CHARGE_MS / 1000. Cette table porte cette correspondance, et
   elle seule — les valeurs restent lues dans l'export.

   ─── Ajouter une entite ───────────────────────────────────────────────────
   Recopier le bloc de OWAttacksInformation.java, dans le meme ordre :
   combo, charged, charged2, ultimate, passive. `null` pour un emplacement
   absent (le panda roux n'a pas de combo).

   ─── Traduire une expression Java ─────────────────────────────────────────
     val("0.5")                              -> '0.5'
     val(CONST / 20)          entiers        -> idiv(ac.CONST, 20)
     val((int) CONST)                        -> int(ac.CONST)
     val((int) (CONST * 100))                -> int(ac.CONST * 100)
     val(e.getDamageToClient() / 3)          -> ctx.damage / 3
   Java tronque la division entiere : `idiv` fait la meme chose, et `int` est
   la transposition du cast (int). Le formatage final (entier sec, ou une
   decimale) est celui de val(float) cote mod. */

(function (OW) {
  'use strict';

  /* ---- transposition des primitives Java ----------------------------------- */

  /** Division entiere Java : tronque vers zero, jamais d'arrondi. */
  function idiv(a, b) { return Math.trunc(Number(a) / Number(b)); }

  /** Cast (int) Java. */
  function int(v) { return Math.trunc(Number(v)); }

  /** val(float) cote mod : entier sec si la valeur tombe juste, sinon 1 decimale. */
  function val(v) {
    if (v == null || (typeof v === 'number' && !isFinite(v))) return null;
    if (typeof v === 'string') return v.replace(/(\d)\.(\d)/g, '$1,$2');
    const n = Number(v);
    if (!isFinite(n)) return null;
    return n === Math.trunc(n) ? String(Math.trunc(n)) : n.toFixed(1).replace('.', ',');
  }

  /* ---- roles ---------------------------------------------------------------
     L'ordre est celui du record EntityProfile. `secondary-alt` est la seconde
     carte interchangeable : le joueur bascule de l'une a l'autre a la molette,
     et le mod n'en documente qu'une a la fois dans le HUD. */

  const ROLE = {
    combo: {
      id: 'combo',
      label: 'Attaque de base',
      short: 'COMBO',
      key: 'LMB',
      color: '#E6E1D4',
      order: 0
    },
    secondary: {
      id: 'secondary',
      label: 'Attaque secondaire',
      short: 'SECONDAIRE',
      key: 'RMB',
      /* Doree : la secondaire vaut l'or, l'ultime vaut le diamant. */
      color: '#F2A32C',
      order: 1
    },
    'secondary-alt': {
      id: 'secondary-alt',
      label: 'Secondaire alternative',
      short: 'SECONDAIRE · ALT',
      key: 'RMB',
      color: '#F2A32C',
      order: 2,
      /* Se substitue a la precedente d'un coup de molette : ce n'est pas une
         attaque de plus, c'est la meme touche qui change de carte. */
      swappable: true
    },
    ultimate: {
      id: 'ultimate',
      label: 'Ultime',
      short: 'ULTIME',
      key: 'X',
      color: '#4EDCCB',
      order: 3
    },
    passive: {
      id: 'passive',
      label: 'Passif',
      short: 'PASSIF',
      key: '',
      color: '#8A9A2E',
      order: 4,
      /* Aucune touche, aucune carte dans l'atlas du mod : le HUD l'affiche en
         bandeau sous les colonnes. Le wiki le distingue de la meme facon. */
      passive: true
    }
  };

  const ROLE_ORDER = ['combo', 'secondary', 'secondary-alt', 'ultimate', 'passive'];

  /* ---- table des entites ----------------------------------------------------
     Transcription fidele de OWAttacksInformation.java. Chaque `args` recoit un
     contexte { ac, c, damage } :
       ac      -> entity.attack_constants (OWAttacksConstants.<Espece>)
       c       -> entity.constants        (constantes de la classe d'entite)
       damage  -> degats de base de l'entite (e.getDamageToClient())            */

  const PROFILES = {

    /* ── TIGRE ───────────────────────────────────────────────────────────── */
    tiger: [
      { role: 'combo', slug: 'combo',
        args: (x) => ['0.5', x.damage / 3] },

      { role: 'secondary', slug: 'bond',
        args: (x) => [idiv(x.ac.SECONDARY_COOLDOWN_TICKS, 20)] },

      { role: 'secondary-alt', slug: 'primal_roar',
        args: (x) => [
          idiv(x.ac.PRIMAL_ROAR_CHARGE_MS, 1000),
          int(x.ac.PRIMAL_ROAR_RADIUS),
          idiv(x.ac.PRIMAL_ROAR_FEAR_TICKS, 20),
          idiv(x.ac.SECONDARY_COOLDOWN_TICKS, 20)
        ] },

      { role: 'ultimate', slug: 'shadow_strike',
        args: (x) => [
          idiv(x.ac.SHADOW_STRIKE_DURATION_TICKS, 20),
          '15',
          '25',
          x.ac.SHADOW_STRIKE_KILLS_REQUIRED,
          idiv(x.ac.SHADOW_STRIKE_COOLDOWN_TICKS, 20)
        ] },

      { role: 'passive', slug: 'predator_sense',
        args: () => ['30', '32'] }
    ],

    /* ── KODIAK ──────────────────────────────────────────────────────────── */
    kodiak: [
      { role: 'combo', slug: 'combo',
        args: (x) => ['0.75', x.damage / 3] },

      { role: 'secondary', slug: 'paw_slam',
        args: (x) => ['3', idiv(x.ac.PAW_SLAM_COOLDOWN_TICKS, 20)] },

      { role: 'ultimate', slug: 'nap',
        args: (x) => [
          idiv(x.ac.NAP_DURATION_TICKS, 20),
          '3',
          '80',
          x.ac.NAP_KILLS_REQUIRED,
          idiv(x.ac.NAP_COOLDOWN_TICKS, 20)
        ] },

      { role: 'passive', slug: 'butcher',
        args: (x) => [(x.ac.BUTCHER_INSTINCT_MULTIPLIER - 1) * 100] }
    ],

    /* ── CROCODILE ───────────────────────────────────────────────────────── */
    crocodile: [
      { role: 'combo', slug: 'combo',
        args: (x) => ['0.75', x.damage / 3] },

      { role: 'secondary', slug: 'mouth',
        args: (x) => ['3', idiv(x.ac.MOUTH_SLAM_COOLDOWN_TICKS, 20), x.damage] },

      { role: 'ultimate', slug: 'primal_dive',
        /* Total d'une roulade de la mort, deduit des constantes de l'entite :
           recopier le chiffre l'aurait laisse vieillir au premier equilibrage. */
        args: (x) => [
          idiv(x.c.PRIMAL_DIVE_GRAB_TICKS, 20),
          x.damage * x.c.DEATH_ROLL_BITE_RATIO * x.c.DEATH_ROLL_BITES,
          x.ac.PRIMAL_DIVE_KILLS_REQUIRED,
          idiv(x.ac.PRIMAL_DIVE_COOLDOWN_TICKS, 20)
        ] },

      { role: 'passive', slug: 'reptilian',
        args: () => ['10'] }
    ],

    /* ── BOA ─────────────────────────────────────────────────────────────── */
    boa: [
      { role: 'combo', slug: 'combo',
        args: (x) => ['0.5', x.damage / 3] },

      { role: 'secondary', slug: 'venom',
        args: (x) => [
          idiv(x.ac.VENOM_FANGS_MIN_DURATION_TICKS, 20),
          idiv(x.ac.VENOM_FANGS_MAX_DURATION_TICKS, 20),
          idiv(x.ac.VENOM_FANGS_COOLDOWN_TICKS, 20)
        ] },

      { role: 'ultimate', slug: 'ultimate',
        args: (x) => [
          x.ac.CONSTRICT_ULT_KILLS_REQUIRED,
          int(x.ac.CONSTRICT_ULT_RANGE)
        ] },

      { role: 'passive', slug: 'thermal_vision',
        args: (x) => [int(x.ac.THERMAL_MAX_HP)] }
    ],

    /* ── ORQUE ───────────────────────────────────────────────────────────── */
    orca: [
      { role: 'combo', slug: 'combo',
        args: (x) => ['1.4', x.damage / 3] },

      { role: 'secondary', slug: 'tidal_rush',
        args: (x) => [x.damage, idiv(x.ac.TIDAL_RUSH_COOLDOWN_TICKS, 20)] },

      { role: 'ultimate', slug: 'big_mouth',
        /* Durees lues sur les constantes de l'entite : celle du HUD ne connait
           que le plus long des deux transports. */
        args: (x) => [
          idiv(x.c.MOUTH_HOLD_ALLY_TICKS, 20),
          idiv(x.c.MOUTH_HOLD_ENEMY_TICKS, 20),
          x.ac.BIG_MOUTH_KILLS_REQUIRED,
          idiv(x.ac.BIG_MOUTH_COOLDOWN_TICKS, 20)
        ] },

      { role: 'passive', slug: 'slipstream',
        args: (x) => [
          int(x.c.SLIPSTREAM_RADIUS),
          int(x.c.SLIPSTREAM_SPEED_BONUS * 100),
          /* OrcaEntity.slipstreamBreathPercent() : la fraction d'air economisee,
             en pourcent et tronquee comme cote mod. */
          idiv(100 * x.c.SLIPSTREAM_BREATH_NUM, x.c.SLIPSTREAM_BREATH_DEN)
        ] }
    ],

    /* ── ELEPHANT ────────────────────────────────────────────────────────── */
    elephant: [
      { role: 'combo', slug: 'combo',
        args: (x) => ['1.2', x.damage / 3] },

      { role: 'secondary', slug: 'shoulder_bash',
        args: (x) => [
          int(x.damage * x.ac.SHOULDER_BASH_DAMAGE_RATIO),
          idiv(x.ac.SECONDARY_COOLDOWN_TICKS, 20)
        ] },

      { role: 'secondary-alt', slug: 'water_spray',
        args: (x) => [
          int(x.ac.WATER_SPRAY_RANGE),
          idiv(x.ac.WATER_SPRAY_LAVA_TICKS, 20),
          idiv(x.ac.SECONDARY_COOLDOWN_TICKS, 20)
        ] },

      { role: 'ultimate', slug: 'earthquake',
        args: (x) => [
          x.ac.EARTHQUAKE_KILLS_REQUIRED,
          int(x.ac.EARTHQUAKE_RADIUS),
          int(x.ac.EARTHQUAKE_PULSE_DAMAGE),
          idiv(x.ac.EARTHQUAKE_COOLDOWN_TICKS, 20)
        ] },

      { role: 'passive', slug: 'lumberjack',
        args: () => ['50'] }
    ],

    /* ── GORILLE ─────────────────────────────────────────────────────────── */
    gorilla: [
      { role: 'combo', slug: 'combo',
        args: (x) => ['0.75', x.damage / 3] },

      { role: 'secondary', slug: 'rock_throw',
        args: (x) => [
          int(x.damage * x.ac.ROCK_THROW_MAX_DAMAGE_RATIO),
          int(x.ac.ROCK_THROW_IMPACT_RADIUS),
          idiv(x.ac.SECONDARY_COOLDOWN_TICKS, 20)
        ] },

      { role: 'secondary-alt', slug: 'rider_launch',
        args: (x) => [idiv(x.ac.SECONDARY_COOLDOWN_TICKS, 20)] },

      { role: 'ultimate', slug: 'chest_beat',
        args: (x) => [
          x.ac.CHEST_BEAT_KILLS_REQUIRED,
          int(x.ac.CHEST_BEAT_RADIUS),
          int(x.ac.CHEST_BEAT_ALLY_DAMAGE_BONUS * 100),
          idiv(x.ac.CHEST_BEAT_DURATION_TICKS, 20),
          idiv(x.ac.CHEST_BEAT_COOLDOWN_TICKS, 20)
        ] },

      { role: 'passive', slug: 'cold_blood',
        args: () => [] }
    ],

    /* ── KANGOUROU ───────────────────────────────────────────────────────── */
    kangaroo: [
      { role: 'combo', slug: 'combo',
        args: (x) => ['0.5', x.damage / 3] },

      { role: 'secondary', slug: 'whirlwind',
        args: (x) => [
          idiv(x.ac.WHIRLWIND_DAMAGE_PEAK_TICKS, 20),
          x.ac.WHIRLWIND_DAMAGE_MAX,
          int(x.ac.WHIRLWIND_RADIUS),
          idiv(x.ac.WHIRLWIND_MAX_DURATION_TICKS, 20),
          idiv(x.ac.WHIRLWIND_COOLDOWN_TICKS, 20),
          idiv(x.ac.WHIRLWIND_COOLDOWN_THRESHOLD_TICKS, 20)
        ] },

      { role: 'ultimate', slug: 'telluric_stomp',
        args: (x) => [
          x.ac.TELLURIC_STOMP_KILLS_REQUIRED,
          int(x.ac.TELLURIC_STOMP_RADIUS),
          int(x.ac.TELLURIC_STOMP_DAMAGE_CENTER_MULT * 100),
          int(x.ac.TELLURIC_STOMP_DAMAGE_EDGE_MULT * 100),
          idiv(x.ac.TELLURIC_STOMP_SLOWNESS_TICKS, 20),
          idiv(x.ac.TELLURIC_STOMP_COOLDOWN_TICKS, 20)
        ] },

      { role: 'passive', slug: 'spring_step',
        args: () => [] }
    ],

    /* ── PANDA ROUX ──────────────────────────────────────────────────────────
       Pas de combo : sa colonne reste vide cote mod, sa fiche n'a que deux
       cartes actives. */
    red_panda: [
      { role: 'secondary', slug: 'heal_snack',
        args: (x) => [
          int(x.ac.HEAL_SNACK_INSTANT_RATIO * 100),
          int(x.ac.HEAL_SNACK_OVER_TIME_RATIO * 100),
          idiv(x.ac.HEAL_SNACK_OVER_TIME_TICKS, 20),
          int(x.ac.HEAL_SNACK_RANGE),
          idiv(x.ac.HEAL_SNACK_COOLDOWN_TICKS, 20)
        ] },

      { role: 'ultimate', slug: 'feast',
        args: (x) => [
          x.ac.FEAST_SNACKS_REQUIRED,
          int(x.ac.FEAST_RADIUS),
          x.ac.FEAST_HEAL_PER_PULSE,
          idiv(x.ac.FEAST_DURATION_TICKS, 20),
          x.ac.FEAST_OVERCHARGE_MAX,
          idiv(x.ac.FEAST_DURATION_TICKS
               + x.ac.FEAST_OVERCHARGE_MAX * x.ac.FEAST_OVERCHARGE_TICKS_EACH, 20),
          idiv(x.ac.FEAST_COOLDOWN_TICKS, 20)
        ] },

      { role: 'passive', slug: 'vital_sense',
        args: (x) => [int(x.ac.VITAL_SENSE_RADIUS)] }
    ],

    /* ── HIPPOPOTAME ─────────────────────────────────────────────────────── */
    hippopotamus: [
      { role: 'combo', slug: 'combo',
        args: (x) => ['0.75', x.damage / 3] },

      { role: 'secondary', slug: 'roll',
        args: (x) => [
          int(x.ac.ROLL_START_ENERGY),
          int(x.ac.ROLL_CRUSH_DAMAGE_RATIO * 100),
          idiv(x.ac.ROLL_COOLDOWN_TICKS, 20)
        ] },

      { role: 'ultimate', slug: 'river_fury',
        args: (x) => [
          x.ac.FURY_KILLS_REQUIRED,
          idiv(x.ac.FURY_DURATION_TICKS, 20),
          int(x.ac.FURY_DAMAGE_BONUS * 100),
          int(x.ac.FURY_GRUDGE_PER_HIT * 100),
          int(x.ac.FURY_DAMAGE_REDUCTION * 100),
          idiv(x.ac.FURY_COOLDOWN_TICKS, 20)
        ] },

      { role: 'passive', slug: 'river_surge',
        args: (x) => [
          idiv(x.ac.RIVER_SURGE_TICKS, 20),
          int(x.ac.RIVER_SURGE_SPEED_BONUS * 100)
        ] }
    ],

    /* ── LION ────────────────────────────────────────────────────────────── */
    lion: [
      { role: 'combo', slug: 'combo',
        args: (x) => ['0.5', x.damage / 3] },

      { role: 'secondary', slug: 'clan_call',
        args: (x) => [
          x.ac.CLAN_CALL_MAX_LIONESSES,
          int(x.ac.CLAN_CALL_RADIUS),
          idiv(x.ac.CLAN_CALL_DURATION_TICKS, 20),
          idiv(x.ac.CLAN_CALL_COOLDOWN_TICKS, 20)
        ] },

      { role: 'ultimate', slug: 'domination_roar',
        args: (x) => [
          x.ac.ROAR_KILLS_REQUIRED,
          int(x.ac.ROAR_RADIUS),
          idiv(x.ac.ROAR_BUFF_TICKS, 20),
          idiv(x.ac.ROAR_COOLDOWN_TICKS, 20)
        ] },

      { role: 'passive', slug: 'pride_bond',
        args: (x) => [
          int(x.ac.PACK_HEALTH_PER_LIONESS),
          x.ac.CLAN_MAX_LIONESSES,
          int(x.ac.PACK_BONUS_PER_LIONESS * 100),
          x.ac.PACK_BONUS_MAX_LIONESSES,
          int(x.ac.PACK_NEARBY_RADIUS)
        ] }
    ]
  };

  /* ---- rattachement des constantes -----------------------------------------
     Quelles constantes de `attack_constants` decrivent quelle carte. L'ancienne
     version devinait en cherchant les mots du slug dans le nom de la constante :
     `CONSTRICT_ULT_RANGE` ne contient pas "ULTIMATE", et la carte finissait sans
     aucun chiffre. Les prefixes sont donc ecrits noir sur blanc.

     Cle : "<espece>.<carte>". Une carte absente de la table n'affiche aucune
     constante, ce qui vaut mieux que d'en afficher de fausses. */

  const CONSTANT_PREFIX = {
    'tiger.combo': [],
    'tiger.bond': ['JUMP', 'SECONDARY_COOLDOWN'],
    'tiger.primal_roar': ['PRIMAL_ROAR', 'SECONDARY_COOLDOWN'],
    'tiger.shadow_strike': ['SHADOW_STRIKE'],
    'tiger.predator_sense': ['PREDATOR'],

    'kodiak.combo': [],
    'kodiak.paw_slam': ['PAW_SLAM'],
    'kodiak.nap': ['NAP'],
    'kodiak.butcher': ['BUTCHER'],

    'crocodile.combo': [],
    'crocodile.mouth': ['MOUTH_SLAM'],
    'crocodile.primal_dive': ['PRIMAL_DIVE'],
    'crocodile.reptilian': [],

    'boa.combo': [],
    'boa.venom': ['VENOM_FANGS'],
    'boa.ultimate': ['CONSTRICT_ULT'],
    'boa.thermal_vision': ['THERMAL'],

    'orca.combo': [],
    'orca.tidal_rush': ['TIDAL_RUSH'],
    'orca.big_mouth': ['BIG_MOUTH'],
    'orca.slipstream': ['SLIPSTREAM'],

    'elephant.combo': [],
    'elephant.shoulder_bash': ['SHOULDER_BASH', 'SHOCKWAVE', 'SECONDARY_COOLDOWN'],
    'elephant.water_spray': ['WATER_SPRAY', 'SECONDARY_COOLDOWN'],
    'elephant.earthquake': ['EARTHQUAKE'],
    'elephant.lumberjack': [],

    'gorilla.combo': [],
    'gorilla.rock_throw': ['ROCK_THROW', 'SECONDARY_COOLDOWN'],
    'gorilla.rider_launch': ['RIDER_LAUNCH', 'SECONDARY_COOLDOWN'],
    'gorilla.chest_beat': ['CHEST_BEAT'],
    'gorilla.cold_blood': [],

    'kangaroo.combo': [],
    'kangaroo.whirlwind': ['WHIRLWIND'],
    'kangaroo.telluric_stomp': ['TELLURIC_STOMP'],
    'kangaroo.spring_step': [],

    'red_panda.heal_snack': ['HEAL_SNACK'],
    'red_panda.feast': ['FEAST'],
    'red_panda.vital_sense': ['VITAL_SENSE'],

    'hippopotamus.combo': [],
    'hippopotamus.roll': ['ROLL'],
    'hippopotamus.river_fury': ['FURY'],
    'hippopotamus.river_surge': ['RIVER_SURGE'],

    'lion.combo': [],
    'lion.clan_call': ['CLAN_CALL'],
    'lion.domination_roar': ['ROAR'],
    'lion.pride_bond': ['PACK', 'CLAN_MAX_LIONESSES']
  };

  /** Prefixes de constantes rattaches a une carte, [] si la carte n'en a pas. */
  function constantPrefixes(entitySlug, cardSlug) {
    const found = CONSTANT_PREFIX[entitySlug + '.' + cardSlug];
    return found || null;
  }

  /* ---- resolution ----------------------------------------------------------- */

  /**
   * Remplit les %s / %1$s d'une description avec les valeurs deja calculees.
   *
   * Le mod utilise les deux formes : `%s` positionnel dans les cartes actuelles,
   * `%1$s` indexe dans les anciennes. Une valeur manquante laisse un marqueur
   * neutre plutot qu'un `%s` brut ou un trou silencieux.
   */
  function fillPlaceholders(text, args) {
    const source = String(text || '');
    if (!source) return '';

    const values = (args || []).map(val);
    let cursor = 0;

    return source.replace(/%(\d+)\$s|%s|%%/g, (match, index) => {
      if (match === '%%') return '%';
      const value = index ? values[Number(index) - 1] : values[cursor++];
      return value == null ? '—' : value;
    });
  }

  /**
   * Emballe chaque valeur injectee dans un <b> pour la detacher du texte gris,
   * exactement comme val() cote mod qui la passe en blanc gras.
   *
   * `escape` est fourni par l'appelant (OW.escapeHtml) : cette fonction produit
   * du HTML, elle ne doit jamais laisser passer du texte non echappe.
   */
  function fillPlaceholdersHtml(text, args, escape) {
    const source = String(text || '');
    if (!source) return '';

    const values = (args || []).map(val);
    let cursor = 0;
    let html = '';
    let last = 0;
    const pattern = /%(\d+)\$s|%s|%%/g;
    let match;

    while ((match = pattern.exec(source)) !== null) {
      html += escape(source.slice(last, match.index));
      last = pattern.lastIndex;

      if (match[0] === '%%') {
        html += '%';
        continue;
      }
      const value = match[1] ? values[Number(match[1]) - 1] : values[cursor++];
      html += value == null
        ? '<span class="atk-gap" title="Valeur absente de l\'export">—</span>'
        : '<b class="atk-val">' + escape(value) + '</b>';
    }
    html += escape(source.slice(last));
    return html;
  }

  /**
   * Contexte de calcul d'une entite, tel que le voit OWAttacksInformation.
   *
   * `damage` correspond a e.getDamageToClient() : les degats de base de
   * l'espece. Les multiplicateurs d'archetype s'appliquent par-dessus en jeu et
   * ne sont volontairement pas melanges ici — la fiche decrit l'espece, pas un
   * specimen.
   */
  function contextFor(rawEntity) {
    const attributes = rawEntity.attributes || {};
    return {
      ac: rawEntity.attack_constants || {},
      c: rawEntity.constants || {},
      damage: attributes['minecraft:generic.attack_damage'] != null
        ? attributes['minecraft:generic.attack_damage']
        : 0
    };
  }

  /**
   * Roles et valeurs de chaque carte d'une entite, indexes par slug.
   *
   * Renvoie {} pour une espece absente de la table : ses cartes s'afficheront
   * sans role ni valeurs, jamais en erreur. Une entite du mod qui n'est pas
   * encore decrite ici reste donc consultable.
   */
  function resolve(rawEntity) {
    const slug = rawEntity.path || String(rawEntity.id || '').replace(/^.*:/, '');
    const profile = PROFILES[slug];
    if (!profile) return {};

    const ctx = contextFor(rawEntity);
    const out = {};

    profile.forEach((slot, index) => {
      let args = [];
      try {
        args = slot.args(ctx) || [];
      } catch (error) {
        /* Une constante disparue de l'export ne doit pas emporter la page :
           la carte s'affiche alors avec des tirets a la place des valeurs. */
        console.warn('[OW] valeurs indisponibles pour ' + slug + '.' + slot.slug, error);
      }
      out[slot.slug] = {
        role: slot.role,
        roleInfo: ROLE[slot.role],
        index,
        args
      };
    });

    return out;
  }

  Object.assign(OW, {
    ATTACK_ROLES: ROLE,
    ATTACK_ROLE_ORDER: ROLE_ORDER,
    ATTACK_PROFILES: PROFILES,
    resolveAttackProfile: resolve,
    attackConstantPrefixes: constantPrefixes,
    fillPlaceholders,
    fillPlaceholdersHtml
  });
}(window.OW = window.OW || {}));
