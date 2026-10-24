/* Simulator: creature comparison, Wild Trail planner, level curve and quests.

   The comparison is a weighted model, not a fight: every stat is normalised
   against a shared ceiling then weighted by the chosen mode. The weights and
   the two penalties are stated on the page so the number can be argued with.

   La mise en scene : un bandeau par combattant (illustration, niveau, chiffres),
   le mode choisi dans une liste de regles, puis le verdict — podium, un grand
   cadran par bete, atouts et faiblesses. Le modele, lui, n'a pas change. */

(function (OW) {
  'use strict';

  const { loadWikiData, escapeHtml, mountHeader, mountFooter, reveal, animalHref, archetypeIcon, coinSprite, contrastInk, num, bg, tintStyle } = OW;

  /* Les modes : le poids de chaque axe dans le score. Les poids d'un mode font
     toujours 1. « Dégâts » se lit en dégâts par seconde : un coup énorme mais
     lent ne vaut pas une rafale. */
  const MODES = [
    {
      id: 'balanced', name: 'Équilibré', icon: 'assets/ui/animal.png',
      description: 'Tous les aspects comptent, avec un léger avantage à la vie et aux dégâts.',
      weights: { hp: 0.25, damage: 0.25, resistance: 0.15, speed: 0.15, energy: 0.20 }
    },
    {
      id: 'brute', name: 'Force brute', icon: 'assets/tools/ruby_sword.png',
      description: 'Frapper fort et ne jamais reculer.',
      weights: { hp: 0.15, damage: 0.45, resistance: 0.30, speed: 0.05, energy: 0.05 }
    },
    {
      id: 'mobility', name: 'Mobilité', icon: 'assets/ui/energy.png',
      description: "La bête la plus rapide sur le terrain, avec l'énergie pour courir.",
      weights: { hp: 0.06, damage: 0.08, resistance: 0.06, speed: 0.60, energy: 0.20 }
    },
    {
      id: 'dps', name: 'DPS', icon: 'assets/tools/reptilian_daggers.png',
      description: "Le plus de dégâts par seconde, et l'énergie pour enchaîner les attaques spéciales.",
      weights: { hp: 0.05, damage: 0.60, resistance: 0.05, speed: 0.05, energy: 0.25 }
    },
    {
      id: 'survival', name: 'Survie', icon: 'assets/tools/jade_chestplate.png',
      description: 'Tenir le plus longtemps sous les coups.',
      weights: { hp: 0.45, damage: 0.05, resistance: 0.25, speed: 0.05, energy: 0.20 }
    }
  ];

  const SLOT_COLORS = ['#8A9A2E', '#00A0C8', '#F2A32C', '#B84A38', '#BA7FD4'];

  /* Les noms francais des archetypes (js/site.js, partages avec les fiches). */
  const ARCHETYPE_LABEL = OW.ARCHETYPE_LABEL;

  const WEIGHT_LABEL = {
    hp: 'PV', damage: 'DPS', resistance: 'Résist.', speed: 'Vitesse', energy: 'Énergie'
  };

  const TABS = [
    { key: 'combat', label: 'Combat', title: 'Combat', icon: 'assets/tools/ruby_sword.png', hint: 'Deux à cinq bêtes',
      subtitle: "Deux à cinq bêtes dans l'arène. Chacune a son niveau, un aspect de combat est à privilégier, "
        + "et le classement compare force, mobilité, dégâts par seconde et survie. "
        + "L'archétype vient de l'espèce : il est affiché, pas modifiable." },
    { key: 'trail', label: 'Piste Sauvage', title: 'Piste Sauvage', icon: 'assets/ui/tab-trail.png', hint: 'Arbre de progression',
      subtitle: 'La Piste Sauvage, nœud par nœud, avec le coût de chaque étape en pièces sauvages.' },
    { key: 'stats', label: 'Archétypes & niveaux', title: 'Archétypes & niveaux', icon: 'assets/ui/exp/exp_4.png', hint: 'Multiplicateurs et XP',
      subtitle: "Les multiplicateurs d'archétype et la courbe d'expérience lus dans le mod." },
    { key: 'quests', label: 'Quêtes', title: 'Quêtes quotidiennes', icon: 'assets/ui/coins/coin_3.png', hint: 'Trois paliers', subtitle: null },
    { key: 'achievements', label: 'Succès', title: 'Succès & progrès', icon: 'assets/ui/tab-trophy.png', hint: 'À débloquer',
      subtitle: "Les succès du mode, la condition de chacun et le suivi de la progression, enregistré dans ce navigateur." },
    { key: 'tribes', label: 'Tribus', title: 'Tribus', icon: 'assets/ui/tab-banner.png', hint: 'Bannière & arène',
      subtitle: "L'organisation des tribus : bannière, rangs et permissions, réputation, combats en arène et coffres de récompense." },
    { key: 'formulas', label: 'Formules', title: 'Encyclopédie des mécaniques', icon: 'assets/ui/tab-formulas.png', hint: 'Chaque calcul expliqué',
      subtitle: "Chaque calcul du mod, expliqué simplement et appliqué à une créature au choix : naissance, apprivoisement, niveaux, plafonds, combat, armure." }
  ];

  const state = {
    data: null,
    tab: null,
    /* `alloc` : null tant que les points suivent le mode (repartition auto). */
    roster: [{ slug: 'tiger', level: 20, alloc: null }, { slug: 'crocodile', level: 20, alloc: null }],
    mode: 'balanced',
    hasRun: false,
    /* La bete dont la fiche du verdict est ouverte (null : la premiere). */
    focus: null,
    trailSlug: 'tiger',
    curveLevel: 1,
    fxOpen: 1
  };

  const $ = (selector) => document.querySelector(selector);

  /* ---- model -------------------------------------------------------------------

     Le calcul suit le mod a la lettre (entity/OWEntity.java) :

     - Apprivoisee, la bete est niveau 1. Chaque niveau gagne donne UN point
       (passingLevel), a placer dans UN des quatre postes de l'inventaire. Le
       comparateur les place en rotation, pour toutes les betes : niveau 2 les
       PV, 3 les degats, 4 la vitesse, 5 l'energie, 6 les PV, etc. Un poste au
       plafond passe son tour. Ce que rapporte un point depend de l'archetype :
         PV       +1     x multiplicateur PV de l'archetype
         Degats   +0,15  x multiplicateur degats
         Vitesse  +0,002 de vitesse de deplacement x multiplicateur DEGATS
                  (sic : upgradeAttributes lit getDamageMultiplier pour la vitesse)
         Energie  +6     x multiplicateur energie, sur la reserve vitale
       Rien d'autre ne monte : un niveau, une statistique. (Le mod fait aussi
       grandir seule la reserve d'energie, jusqu'a +50 % au niveau 50 —
       getVitalEnergyCapacity — ; le comparateur ne le compte pas, pour qu'un
       niveau ne touche jamais deux statistiques.)
     - PV, degats et vitesse ont un plafond, au-dela duquel le bouton « + »
       disparait (OWInventoryScreen) : base x (0,75 + mult.) pour les PV et les
       degats, base x (0,5 + mult. vitesse) pour la vitesse. L'energie n'en a pas.
     - L'archetype ne multiplie PAS les statistiques de depart : il ne joue que
       sur ce que rapporte un point, et sur les plafonds.
     - A l'apprivoisement, les PV montent de 5 a 30 % selon la bete
       (setTamedAttributes).
     - Un combo, ce sont trois coups (MAX_ATTACKS_IN_COMBO) : chaque coup vaut
       le tiers des degats. Un coup dure `timeMax` ticks (COMBO_TICKS).
     - Un coup encaisse passe par trois filtres, dans l'ordre du mod :
         Assassin (attaquant) : 1 coup sur 10 frappe a x1,25 (attackEntitiesInFront)
         Tank (cible)         : x0,8 contre les attaques de creature (OWEntity.hurt)
         Armure (cible)       : formule de Minecraft, sur ce qui reste du coup
       La resistance au recul, elle, ne retire aucun degat. */

  const UPGRADES = ['hp', 'damage', 'speed', 'energy'];

  /* Le rythme des combos et la reserve du tigre : js/combat-data.js, partage
     avec le guide du debutant. */
  const {
    comboTicks: COMBO_TICKS, defaultComboTicks: DEFAULT_COMBO_TICKS,
    comboHits: COMBO_HITS, energyFallback: ENERGY_FALLBACK
  } = OW.COMBAT_DATA;

  let RULES = null;
  let CEILING = null;
  let REF_HIT = 3;

  const ASSASSIN_CRIT_CHANCE = 0.1;
  const ASSASSIN_CRIT_MULT = 1.25;
  const TANK_DAMAGE_TAKEN = 0.8;

  const entityConst = (key, fallback) => {
    const value = state.data.entityConstants && state.data.entityConstants[key];
    return typeof value === 'number' ? value : fallback;
  };

  function entityOf(slug) {
    return state.data.entities.find((e) => e.slug === slug) || state.data.entities[0];
  }

  function archetypeOf(name) {
    return state.data.archetypes.find((a) => a.name === name)
      || { name: 'NORMAL', hp: 1, damage: 1, speed: 1, energy: 1 };
  }

  const pointsAt = (level) => Math.max(0, level - 1);

  /* setTamedAttributes : plus la bete est solide, moins l'apprivoisement lui ajoute. */
  function tamedHealth(hp) {
    const mult = hp >= 80 ? 1.05 : hp >= 70 ? 1.1 : hp >= 60 ? 1.2 : 1.3;
    return hp * mult;
  }

  /** Les quatre postes d'une bete : valeur de depart, gain d'un point, plafond. */
  function tracksOf(entity) {
    const a = archetypeOf(entity.archetype && entity.archetype.name);
    const s = entity.stats;
    const hp0 = s.hp || 20;
    const damage0 = s.damage || 0;
    const speed0 = s.moveSpeed || 0.2;
    const tracks = {
      hp: { base: tamedHealth(hp0), step: RULES.hpStep * a.hp, cap: hp0 * RULES.baseHealthRef * (RULES.capHp + a.hp) },
      damage: { base: damage0, step: RULES.damageStep * a.damage, cap: damage0 * (RULES.capDamage + a.damage) },
      speed: { base: speed0, step: RULES.speedStep * a.damage, cap: speed0 * (RULES.capSpeed + a.speed) },
      energy: { base: 0, step: RULES.energyStep * a.energy, cap: Infinity }
    };
    /* Le bouton reste la tant que la valeur est sous le plafond : le dernier
       point peut le depasser un peu, comme en jeu. */
    UPGRADES.forEach((key) => {
      const t = tracks[key];
      t.max = t.cap === Infinity ? Infinity
        : (t.step <= 0 || t.base >= t.cap ? 0 : Math.ceil((t.cap - t.base) / t.step - 1e-9));
    });
    return tracks;
  }

  /* Reduction d'armure de Minecraft 1.21 pour un coup de `hit` degats. */
  function armorReduction(armor, toughness, hit) {
    if (!armor) return 0;
    const f = armor - hit / (2 + (toughness || 0) / 4);
    return Math.max(armor * 0.2, Math.min(20, f)) / 25;
  }

  /* Ce qu'un coup de `raw` degats retire vraiment a la cible : d'abord le
     x0,8 des tanks, puis l'armure sur ce qui reste. */
  function landed(raw, target) {
    const taken = raw * (target.archetype.name === 'TANK' ? TANK_DAMAGE_TAKEN : 1);
    return taken * (1 - armorReduction(target.armor, target.toughness, taken));
  }

  /* Un coup de l'attaquant sur la cible, en moyenne : les assassins placent
     un coup critique sur dix. */
  function landedHit(attacker, target) {
    if (attacker.hit <= 0) return 0;
    if (attacker.archetype.name !== 'ASSASSIN') return landed(attacker.hit, target);
    return (1 - ASSASSIN_CRIT_CHANCE) * landed(attacker.hit, target)
      + ASSASSIN_CRIT_CHANCE * landed(attacker.hit * ASSASSIN_CRIT_MULT, target);
  }

  /** La bete au niveau donne, ses points places selon `alloc`, face a des coups de `incoming` degats. */
  function derive(entity, level, alloc, incoming) {
    const against = incoming > 0 ? incoming : REF_HIT;
    const archetype = archetypeOf(entity.archetype && entity.archetype.name);
    const tracks = tracksOf(entity);
    const value = (key) => tracks[key].base + (alloc[key] || 0) * tracks[key].step;

    const hp = value('hp');
    const damage = value('damage');
    const moveSpeed = value('speed');
    const speedRatio = moveSpeed / (entity.stats.moveSpeed || moveSpeed || 1);
    const maxEnergy = entity.mount.maxEnergy != null ? entity.mount.maxEnergy : (ENERGY_FALLBACK[entity.slug] || 0);
    /* Seuls les points comptent : un niveau ne monte qu'une statistique. */
    const energy = maxEnergy + value('energy');

    const ticks = COMBO_TICKS[entity.slug] || DEFAULT_COMBO_TICKS;
    const interval = ticks / 20;
    const hit = damage / COMBO_HITS;
    const armor = entity.stats.armor || 0;
    const toughness = entity.stats.armorToughness || 0;
    const tank = archetype.name === 'TANK';
    const taken = against * (tank ? TANK_DAMAGE_TAKEN : 1);
    const reduction = armorReduction(armor, toughness, taken);
    /* Part d'un coup adverse qui ne passe pas : tank et armure ensemble. */
    const protection = 1 - (taken * (1 - reduction)) / against;
    const crit = archetype.name === 'ASSASSIN' ? 1 + ASSASSIN_CRIT_CHANCE * (ASSASSIN_CRIT_MULT - 1) : 1;

    return {
      entity, archetype, level, alloc, tracks,
      points: pointsAt(level),
      hp, damage, hit, combo: COMBO_HITS, interval, crit, dps: hit * crit / interval,
      speed: (entity.stats.mountedBps || entity.stats.walkBps || 0) * speedRatio,
      energy, armor, toughness, tank, against, reduction, protection,
      effHp: hp / (1 - protection),
      knockback: entity.stats.knockbackRes || 0,
      capped: UPGRADES.filter((key) => tracks[key].max !== Infinity && tracks[key].max > 0 && (alloc[key] || 0) >= tracks[key].max)
    };
  }

  function normalise(fighter) {
    return {
      hp: Math.min(1, fighter.effHp / CEILING.hp),
      damage: Math.min(1, fighter.dps / CEILING.damage),
      resistance: Math.min(1, fighter.knockback),
      speed: Math.min(1, fighter.speed / CEILING.speed),
      energy: Math.min(1, fighter.energy / CEILING.energy)
    };
  }

  function score(fighter, mode) {
    const n = normalise(fighter);
    let value = 0;
    Object.keys(mode.weights).forEach((key) => { value += n[key] * mode.weights[key]; });
    return value;
  }

  /* La rotation : chaque niveau gagne monte un poste, a tour de role, dans
     l'ordre de l'inventaire — PV, degats, vitesse, energie — pour toutes les
     betes. Un poste arrive au plafond (ou sans objet, comme les degats du
     panda roux) passe son tour ; l'energie n'en a pas. */
  function rotationAlloc(entity, level) {
    const alloc = { hp: 0, damage: 0, speed: 0, energy: 0 };
    const tracks = tracksOf(entity);
    let turn = 0;
    for (let left = pointsAt(level); left > 0; left--) {
      for (let tries = 0; tries < UPGRADES.length; tries++) {
        const key = UPGRADES[turn % UPGRADES.length];
        turn++;
        if (alloc[key] < tracks[key].max) { alloc[key]++; break; }
      }
    }
    return alloc;
  }

  /* Le coup moyen que la bete recoit dans cette arene : celui de ses
     adversaires. Son armure se juge contre eux, pas contre une moyenne. */
  function incomingHit(index) {
    const hits = state.roster
      .filter((_, i) => i !== index)
      .map((other) => {
        const entity = entityOf(other.slug);
        return derive(entity, other.level, other.alloc || rotationAlloc(entity, other.level)).hit;
      })
      .filter((hit) => hit > 0);
    return hits.length ? hits.reduce((a, b) => a + b, 0) / hits.length : REF_HIT;
  }

  /** Un combattant de l'arene : ses points suivent la rotation, ou sont places a la main. */
  function build(config) {
    const entity = entityOf(config.slug);
    const alloc = config.alloc || rotationAlloc(entity, config.level);
    return derive(entity, config.level, alloc, incomingHit(state.roster.indexOf(config)));
  }

  /* Les references des jauges : le mieux qu'une bete du mod puisse atteindre
     sur chaque axe, niveau 50, tous ses points dans ce seul poste. Un axe a 1,
     c'est le record du bestiaire. */
  function computeModel() {
    RULES = {
      hpStep: 1, damageStep: 0.15, speedStep: 0.002,
      energyStep: entityConst('VITAL_ENERGY_UPGRADE_STEP', 6),
      capHp: 0.75, capDamage: 0.75, capSpeed: 0.5, baseHealthRef: 1.3
    };
    const fighters = state.data.entities.filter((e) => e.stats && e.stats.hp);
    const hits = fighters.map((e) => (e.stats.damage || 0) / COMBO_HITS).filter((h) => h > 0);
    REF_HIT = hits.length ? hits.reduce((a, b) => a + b, 0) / hits.length : 3;

    CEILING = { hp: 1, damage: 1, speed: 1, energy: 1 };
    const max = state.data.levelCurve.max || 50;
    const all = pointsAt(max);
    fighters.forEach((entity) => {
      const tracks = tracksOf(entity);
      const only = (key) => {
        const alloc = { hp: 0, damage: 0, speed: 0, energy: 0 };
        alloc[key] = Math.min(all, tracks[key].max);
        return derive(entity, max, alloc);
      };
      CEILING.hp = Math.max(CEILING.hp, only('hp').effHp);
      CEILING.damage = Math.max(CEILING.damage, only('damage').dps);
      CEILING.speed = Math.max(CEILING.speed, only('speed').speed);
      CEILING.energy = Math.max(CEILING.energy, only('energy').energy);
    });
  }

  function strengthsAndWeaknesses(fighter, mode) {
    const n = normalise(fighter);
    const pros = [];
    const cons = [];
    const capped = (key) => fighter.capped.indexOf(key) >= 0;

    if (n.hp >= 0.4) pros.push(Math.round(fighter.hp) + ' PV : encaisse plusieurs échanges.');
    else if (n.hp <= 0.2) cons.push('Seulement ' + Math.round(fighter.hp) + ' PV : tombe vite sous les coups.');

    if (fighter.hit <= 0) {
      cons.push('Ne frappe pas : le soigneur monte son soin à la place des dégâts.');
    } else {
      const perHit = num(fighter.hit) + ' par coup, ' + num(fighter.damage) + ' sur les trois coups du combo';
      if (n.damage >= 0.45) pros.push(num(fighter.dps) + ' dégâts par seconde — ' + perHit + '.');
      else if (n.damage <= 0.22) cons.push('Dégâts faibles (' + num(fighter.dps) + " par seconde) : les combats s'étirent.");
      if (fighter.interval <= 0.9) pros.push('Cadence rapide : un coup toutes les ' + num(fighter.interval) + ' s.');
      else if (fighter.interval >= 1.4) cons.push('Cadence lente : ' + num(fighter.interval) + ' s par coup de combo.');
    }

    if (n.speed >= 0.5) pros.push(num(fighter.speed) + ' blocs/s montée : impose la distance.');
    else if (n.speed <= 0.3) cons.push('Lente (' + num(fighter.speed) + ' b/s montée) : ne décroche jamais.');

    if (fighter.knockback >= 0.7) pros.push('Résistance au recul de ' + Math.round(fighter.knockback * 100) + ' % : ne se fait pas repousser.');
    else if (fighter.knockback <= 0.3) cons.push('Peu de résistance au recul : chaque coup la déséquilibre.');

    if (fighter.protection > 0) {
      const parts = [];
      if (fighter.tank) parts.push('Tank −20 %');
      if (fighter.armor > 0) parts.push('armure ' + num(fighter.armor));
      pros.push('Encaisse ' + num(fighter.protection * 100) + ' % de moins par coup adverse (' + parts.join(' + ') + ').');
    } else {
      cons.push('Aucune armure : chaque coup passe en entier.');
    }
    if (fighter.archetype.name === 'ASSASSIN') pros.push('Assassin : un coup sur dix frappe à ×1,25.');

    if (n.energy >= 0.55) pros.push("Grosse réserve d'énergie vitale (" + Math.round(fighter.energy) + ').');
    else if (n.energy <= 0.3) cons.push("Énergie vitale limitée (" + Math.round(fighter.energy) + ") : peu d'attaques spéciales.");

    if (fighter.archetype.name === 'BERSERKER') pros.push('Berserker : combo 30 % plus rapide sous 25 % de PV.');
    if (capped('damage')) cons.push("Dégâts au plafond : un point de plus n'y changerait rien.");
    if (capped('hp')) cons.push('PV au plafond : les points suivants doivent aller ailleurs.');
    if (mode.id === 'survival' && n.hp + n.resistance >= 1) pros.push('Profil taillé pour tenir la durée.');

    if (!pros.length) pros.push('Aucun avantage marquant.');
    if (!cons.length) cons.push('Aucune faiblesse marquante.');

    return { pros: pros.slice(0, 4), cons: cons.slice(0, 4) };
  }

  /* ---- onglets ------------------------------------------------------------------ */

  function renderTabs() {
    $('[data-tabs]').innerHTML = TABS.map((tab, i) => `
      <button type="button" class="sim-tab" data-tab="${tab.key}" role="tab" aria-selected="${state.tab === tab.key}" style="--t:${i}">
        <span class="sim-tab-num" aria-hidden="true">${i + 1}</span>
        <span class="sim-tab-icon crisp" aria-hidden="true" style="${bg(tab.icon)}"></span>
        <span class="sim-tab-text">
          <span class="sim-tab-label">${escapeHtml(tab.label)}</span>
          <span class="sim-tab-hint">${escapeHtml(tab.hint)}</span>
        </span>
      </button>`).join('');
  }

  /* L'arrivee sur la page : aucune carte tiree, aucun corps d'onglet. */
  const HOME = {
    key: null, title: 'Mécaniques',
    subtitle: 'Sept mécaniques du mode, une carte chacune : combat, Piste Sauvage, archétypes et niveaux, quêtes, succès, tribus et formules.'
  };

  const subtitleOf = (tab) => tab.subtitle
    || `${state.data.quests.length} quêtes quotidiennes, trois paliers : de l’expérience ou des pièces sauvages à la clé.`;

  /* Le titre et la phrase d'en-tete changent avec l'onglet, et leur longueur
     avec eux : les cartes des onglets, posees dessous, montaient et
     descendaient a chaque clic. Le titre et la phrase, ensemble, prennent
     donc la hauteur du plus haut des sept couples, mesuree a la largeur du
     moment ; la place en trop se loge sous la phrase, au-dessus des cartes. */
  let heroTallest = 0;
  function heightsOf(el, texts) {
    const probe = el.cloneNode(false);
    ['data-title', 'data-subtitle', 'data-crack'].forEach((name) => probe.removeAttribute(name));
    probe.className = el.className.replace(/\banim-\S+/g, '');
    probe.setAttribute('aria-hidden', 'true');
    Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', left: '0', top: '0', width: el.offsetWidth + 'px', minHeight: '0' });
    el.parentNode.appendChild(probe);
    /* La typographie francaise de js/ux.js passera sur le vrai texte (espace
       fine devant : ; ! ?) : la mesure la prend d'avance, sinon une ligne
       de plus ou de moins faussait le calcul. */
    const french = (document.documentElement.lang || 'fr').slice(0, 2) === 'fr';
    const typo = (text) => (french ? text.replace(/ ([:;!?»])/g, ' $1').replace(/« /g, '« ') : text);
    const heights = texts.map((text) => { probe.textContent = typo(text); return probe.offsetHeight; });
    probe.remove();
    return heights;
  }
  function stabiliseHero() {
    const title = $('[data-title]'), sub = $('[data-subtitle]');
    if (!title || !sub || !title.offsetWidth) return;
    const all = TABS.concat(HOME);
    const titles = heightsOf(title, all.map((t) => t.title));
    const subs = heightsOf(sub, all.map(subtitleOf));
    heroTallest = Math.max.apply(null, titles.map((h, i) => h + subs[i]));
    fitHero();
  }
  function fitHero() {
    const title = $('[data-title]'), sub = $('[data-subtitle]');
    if (!heroTallest || !title || !sub) return;
    /* En marge, pas en hauteur : en plein jour, la phrase a un fond de papier
       qui deviendrait une grande boite vide. */
    sub.style.marginBottom = '';
    sub.style.marginBottom = Math.max(0, heroTallest - title.offsetHeight - sub.offsetHeight) + 'px';
  }

  function showTab(key) {
    const tab = TABS.find((t) => t.key === key) || HOME;
    state.tab = tab.key;
    key = tab.key;

    $('[data-title]').textContent = tab.title;
    $('[data-subtitle]').textContent = subtitleOf(tab);
    fitHero();

    document.querySelectorAll('[data-panel]').forEach((panel) => {
      const show = panel.dataset.panel === key;
      panel.hidden = !show;
      if (!show) return;
      panel.classList.remove('is-entering');
      void panel.offsetWidth;
      panel.classList.add('is-entering');
    });
    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.setAttribute('aria-selected', String(button.dataset.tab === key));
    });
    const hash = key ? '#' + key : '';
    if (window.location.hash !== hash) history.replaceState(null, '', window.location.pathname + window.location.search + hash);
    if (OW.simVersions) OW.simVersions.follow(key);
  }

  /* ---- la barre d'experience (niveau) ---------------------------------------------

     Le curseur de niveau prend la barre verte du jeu : le chiffre vert au-dessus,
     la jauge en segments. Le vrai <input type=range> est pose dessus, invisible :
     il garde le clavier et l'accessibilite. */

  /* Le feu d'un combattant au niveau maximum : le feu de Minecraft lui-meme
     (mcblocks/fire_0 et fire_1, 32 images chacune), en rangee de flammes de
     tailles differentes au pied du portrait, une lueur qui respire dessous et
     des braises qui montent. La texture n'a pas de transparence : elle se
     sert de masque a elle-meme (en luminance), son noir disparait. L'animation
     fait glisser la bande d'images par paliers (transform) : la carte
     graphique la joue. */
  const FIRE_FLAMES = [
    { x: -2, w: 36, d: -1.1, t: 1, back: true }, { x: 30, w: 42, d: -.3, t: 0, back: true }, { x: 64, w: 38, d: -.8, t: 1, back: true },
    { x: 2, w: 22, d: -.2, t: 0 }, { x: 22, w: 20, d: -.9, t: 1 }, { x: 42, w: 24, d: -.5, t: 0 },
    { x: 62, w: 20, d: -1.3, t: 1 }, { x: 80, w: 22, d: -.7, t: 0 }
  ];
  function fireTexture(n) {
    const url = String(OW.asset('assets/mcblocks/fire_' + n + '.png')).replace(/'/g, '%27');
    return `background-image:url('${url}');-webkit-mask-image:url('${url}');mask-image:url('${url}')`;
  }
  const flames = (list) => list.map((f) => `<i style="--x:${f.x};--w:${f.w};--d:${f.d}s"><span style="${fireTexture(f.t)}"></span></i>`).join('');
  /* Deux calques : les grandes flammes et la lueur derriere la bete, les
     petites flammes et les braises devant elle. */
  const FIRE = '<span class="duel-fire is-back" aria-hidden="true"><span class="duel-fire-glow"></span>'
    + flames(FIRE_FLAMES.filter((f) => f.back)) + '</span>'
    + '<span class="duel-fire" aria-hidden="true">' + flames(FIRE_FLAMES.filter((f) => !f.back))
    + '<b></b>'.repeat(7) + '</span>';

  function xpBar(attrs, level, max, extra) {
    const pct = max > 1 ? (level - 1) / (max - 1) * 100 : 100;
    return `
      <div class="xp${extra ? ' ' + extra : ''}">
        <output class="xp-level">${level}</output>
        <span class="xp-track"><span class="xp-fill" style="width:${pct}%"></span></span>
        <input type="range" min="1" max="${max}" step="1" value="${level}" ${attrs}>
      </div>`;
  }

  /* Une bete au niveau maximum : son niveau s'ecrit en or (.lvl-max, css/ux.css). */
  const maxLevel = () => (state.data && state.data.levelCurve && state.data.levelCurve.max) || 50;
  const lvlClass = (level) => (level >= maxLevel() ? 'lvl-max' : '');

  function setXp(fill, level, max) {
    fill.style.width = (max > 1 ? (level - 1) / (max - 1) * 100 : 100) + '%';
  }

  /* ---- les portraits --------------------------------------------------------------

     Les rendus « solo » des betes donnent leur allure aux cartes, dans leur
     vignette en 1280 px (js/site.js, OW.loadSoloVignette) : chacun n'est charge
     qu'a sa premiere apparition. D'ici la, la bete garde son image habituelle,
     puis l'ecran se redessine une fois le rendu arrive. Sans rendu solo,
     l'image habituelle reste. */

  const portraits = {};
  let portraitRefresh = 0;

  function portrait(entity) {
    const known = portraits[entity.slug];
    if (known === undefined) {
      portraits[entity.slug] = null;
      OW.loadSoloVignette(entity.slug).then((url) => {
        portraits[entity.slug] = url || false;
        if (!url) return;
        cancelAnimationFrame(portraitRefresh);
        portraitRefresh = requestAnimationFrame(refreshPortraits);
      });
    }
    return portraits[entity.slug] || entity.art || entity.head;
  }

  /* Un rendu solo vient d'arriver : on remplace l'image la ou la bete est a
     l'ecran, sans reconstruire (un curseur en cours de glisse garde la main). */
  function refreshPortraits() {
    document.querySelectorAll('[data-portrait]').forEach((el) => {
      const url = portraits[el.dataset.portrait];
      if (!url) return;
      el.dataset.portraitSrc = url;
      el.style.backgroundImage = 'url("' + url + '")';
      el.classList.add('is-solo');
    });
  }

  /**
   * L'image d'une bete, prete a coller : le rendu solo s'il est charge (classe
   * is-solo, cadrage large), son image habituelle sinon. L'attribut data-portrait
   * permet a refreshPortraits() de la remplacer des que le solo arrive.
   */
  function portraitBox(entity, className) {
    const url = portrait(entity);
    const solo = portraits[entity.slug] === url;
    return `<span class="${className} crisp${solo ? ' is-solo' : ''}" aria-hidden="true"
      data-portrait="${entity.slug}" data-portrait-src="${url}" style="${bg(url)}"></span>`;
  }

  /* ---- combat : le fond des cartes -------------------------------------------------

     Plusieurs fonds pour les bandeaux de l'arene et les cadrans du verdict,
     a comparer d'un clic. Le choix est retenu d'une visite a l'autre. */

  /* La tete, pour un fond : une URL absolue, car la variable est lue depuis
     css/simulator.css et un chemin relatif s'y resoudrait depuis css/. */
  function headVar(entity) {
    return escapeHtml("url('" + new URL(entity.head, window.location.href).href + "')");
  }

  /* ---- combat : l'arene ----------------------------------------------------------- */

  /* Un combattant : son illustration a gauche, son identite au milieu, ses
     quatre chiffres a droite, sur le fond « aura ». */
  function duelRow(config, index) {
    const fighter = build(config);
    const color = SLOT_COLORS[index % SLOT_COLORS.length];
    const archetypeName = fighter.archetype.name;
    const letter = String.fromCharCode(65 + index);
    const max = state.data.levelCurve.max;
    return `
      <article class="duel-row${config.level >= max ? ' is-max' : ''}" data-pod="${index}"
               style="--slot:${color};--beast:${escapeHtml(fighter.entity.color || color)};--head:${headVar(fighter.entity)};--i:${index}">
        <span class="duel-art">${portraitBox(fighter.entity, 'duel-solo')}${FIRE}</span>
        <div class="duel-info">
          <span class="duel-tag">
            <span class="duel-letter">${letter}</span>
            <span class="crisp" aria-hidden="true" style="${bg(archetypeIcon(archetypeName))}"></span>
            ${escapeHtml((ARCHETYPE_LABEL[archetypeName] || archetypeName).toUpperCase())}
          </span>
          <h3 class="duel-name">${escapeHtml(fighter.entity.name)}</h3>
          <div class="duel-level">
            <span class="t-pixel">NIVEAU <b class="${lvlClass(config.level)}">${config.level}</b></span>
            <input type="range" class="duel-range" min="1" max="${max}" step="1" value="${config.level}"
                   data-level="${index}" aria-label="Niveau du combattant ${letter}">
          </div>
          <div class="duel-picker">
            ${state.data.entities.map((entity) => {
              /* Une bete deja dans l'arene sous une autre lettre se grise :
                 elle ne peut pas s'affronter elle-meme. */
              const owner = state.roster.findIndex((other, i) => i !== index && other.slug === entity.slug);
              if (owner >= 0) {
                const ownerLetter = String.fromCharCode(65 + owner);
                return `
                  <button type="button" class="duel-pick is-taken" disabled aria-disabled="true"
                          style="--owner:${SLOT_COLORS[owner % SLOT_COLORS.length]}"
                          aria-label="${escapeHtml(entity.name)} — déjà choisi par le combattant ${ownerLetter}">
                    <span class="crisp" aria-hidden="true" style="${bg(entity.head)}"></span>
                    <span class="duel-pick-owner" aria-hidden="true">${ownerLetter}</span>
                    <span class="duel-pick-name">${escapeHtml(entity.name)} · déjà en ${ownerLetter}</span>
                  </button>`;
              }
              return `
              <button type="button" class="duel-pick" data-pick="${index}" data-slug="${entity.slug}"
                      aria-pressed="${entity.slug === fighter.entity.slug}" aria-label="${escapeHtml(entity.name)}">
                <span class="crisp" aria-hidden="true" style="${bg(entity.head)}"></span>
                <span class="duel-pick-name">${escapeHtml(entity.name)}</span>
              </button>`;
            }).join('')}
          </div>
        </div>
        <div class="duel-stats" data-stats>${statsBlock(config, fighter)}</div>
        ${state.roster.length > 2
          ? `<button type="button" class="duel-remove" data-remove="${index}" aria-label="Retirer le combattant ${letter}">${OW.icon ? OW.icon('close') : '✕'}</button>`
          : ''}
      </article>`;
  }

  function renderRoster() {
    $('[data-roster-label]').textContent = 'COMBATTANTS ' + state.roster.length + ' / 5';

    const parts = [];
    state.roster.forEach((config, index) => {
      if (index) parts.push('<span class="duel-vs" aria-hidden="true">VS</span>');
      parts.push(duelRow(config, index));
    });
    /* Pas de bouton d'ajout quand toutes les betes sont deja dans l'arene. */
    if (state.roster.length < Math.min(5, state.data.entities.length)) {
      parts.push(`
        <button type="button" class="duel-add" data-add-fighter>
          <span class="duel-add-plus" aria-hidden="true">+</span>
          <span class="t-pixel">AJOUTER UN COMBATTANT</span>
        </button>`);
    }
    $('[data-roster]').innerHTML = parts.join('');
  }

  /* Les quatre chiffres d'un combattant, sa barre sous chacun. Les points de
     niveau suivent la rotation (PV, degats, vitesse, energie) : ils sont
     comptes, pas affiches. Degats et vitesse ont deux decimales, pour qu'un
     point gagne se voie. */
  const STAT_ROWS = [
    { key: 'hp', label: 'PV', value: (f) => num(f.hp) },
    { key: 'damage', label: 'DÉGÂTS / COUP', value: (f) => num(f.hit, 2) },
    { key: 'speed', label: 'VITESSE', value: (f) => num(f.speed, 2) + ' b/s' },
    { key: 'energy', label: 'ÉNERGIE', value: (f) => Math.round(f.energy) }
  ];

  function statsBlock(config, fighter) {
    const n = normalise(fighter);
    return STAT_ROWS.map((row) => `
      <div class="duel-stat">
        <span class="t-pixel">${row.label}</span>
        <b>${escapeHtml(String(row.value(fighter)))}</b>
        <span class="duel-bar"><span style="width:${Math.round(n[row.key] * 100)}%"></span></span>
      </div>`).join('');
  }

  /* Changer de niveau ne reconstruit pas l'arene (le curseur perdrait la main) :
     seuls les chiffres du combattant touche sont repris. */
  function refreshPod(index) {
    const row = document.querySelector(`[data-pod="${index}"]`);
    if (!row) return;
    const config = state.roster[index];
    const fighter = build(config);
    const n = normalise(fighter);
    row.querySelector('.duel-level b').textContent = config.level;
    row.querySelector('.duel-level b').className = lvlClass(config.level);
    row.classList.toggle('is-max', config.level >= maxLevel());
    row.querySelectorAll('.duel-stat').forEach((stat, i) => {
      const def = STAT_ROWS[i];
      const value = stat.querySelector('b');
      const text = String(def.value(fighter));
      if (value.textContent !== text) {
        value.textContent = text;
        /* Un chiffre qui change se signale : sinon le curseur semble inerte. */
        value.classList.remove('is-bump');
        void value.offsetWidth;
        value.classList.add('is-bump');
      }
      stat.querySelector('.duel-bar > span').style.width = Math.round(n[def.key] * 100) + '%';
    });
  }

  function renderRunBar() {
    const mode = MODES.find((m) => m.id === state.mode) || MODES[0];
    $('[data-run-hint]').textContent = state.hasRun
      ? 'Résultats calculés en mode ' + mode.name.toLowerCase() + '. Un changement de mode ou de niveau relance le calcul.'
      : "L'arène attend un aspect de comparaison : le choix d'un mode lance le combat.";
  }

  /* ---- combat : le choix du mode ----------------------------------------------------

     La bande de verre penchee des filtres pour choisir, et une grande jauge en
     blocs qui repartit les 100 points du mode (ses poids font toujours 1). Au
     survol d'un mode, la jauge le montre ; ses segments glissent d'un mode a
     l'autre au lieu de se redessiner. Les couleurs des statistiques sont celles
     du detail du score, plus bas. */

  /* Les statistiques dans l'ordre du profil compare : la jauge les garde fixes. */
  const STAT_ORDER = ['hp', 'damage', 'resistance', 'speed', 'energy'];
  const pct = (value) => Math.round(value * 100);

  const chosenMode = () => (state.hasRun ? state.mode : null);
  const modeById = (id) => MODES.find((m) => m.id === id) || MODES[0];

  function renderModes() {
    const chosen = chosenMode();
    const shown = modeById(chosen || 'balanced');
    const on = chosen === shown.id;
    $('[data-modes]').innerHTML = `
      <div class="asp-gauge">
        <div class="filter-group asp-strip">
          ${MODES.map((mode) => `
            <button type="button" class="btn btn-toggle asp-strip-btn" data-mode="${mode.id}" aria-pressed="${chosen === mode.id}">
              <span class="crisp" aria-hidden="true" style="${bg(mode.icon)}"></span>${escapeHtml(mode.name)}
            </button>`).join('')}
        </div>
        <div class="asp-meter-panel" data-aspect-detail>
          <div class="asp-meter-head">
            <span class="asp-meter-icon crisp" aria-hidden="true" data-meter-icon style="${bg(shown.icon)}"></span>
            <span class="asp-meter-title">
              <span class="t-pixel">RÉPARTITION DES 100 POINTS</span>
              <b data-meter-name>${escapeHtml(shown.name)}</b>
              <small data-meter-desc>${escapeHtml(shown.description)}</small>
            </span>
            <span class="asp-meter-state${on ? ' is-on' : ''}" data-meter-state>${on ? 'EN JEU' : 'APERÇU'}</span>
          </div>
          <div class="asp-meter" aria-hidden="true">
            ${STAT_ORDER.map((key) => `
              <span class="asp-meter-seg" data-stat="${key}" data-seg="${key}" style="flex-grow:${shown.weights[key]}">
                <b>${pct(shown.weights[key])}</b>
              </span>`).join('')}
          </div>
          <div class="asp-meter-legend">
            ${STAT_ORDER.map((key) => `
              <span class="asp-chip" data-stat="${key}"><i></i>${escapeHtml(WEIGHT_LABEL[key])} <b data-leg="${key}">${pct(shown.weights[key])} %</b></span>`).join('')}
          </div>
        </div>
      </div>`;
  }

  /* L'apercu au survol : seule la jauge change, jamais les boutons (le
     pointeur garderait sinon un element qui vient de disparaitre). */
  let previewed = null;
  function previewMode(id) {
    const mode = modeById(id || chosenMode() || 'balanced');
    if (previewed === mode.id) return;
    previewed = mode.id;
    const detail = document.querySelector('[data-modes] [data-aspect-detail]');
    if (!detail) return;
    const on = chosenMode() === mode.id;
    detail.querySelector('[data-meter-icon]').style.backgroundImage = 'url("' + OW.asset(mode.icon) + '")';
    detail.querySelector('[data-meter-name]').textContent = mode.name;
    detail.querySelector('[data-meter-desc]').textContent = mode.description;
    const stateTag = detail.querySelector('[data-meter-state]');
    stateTag.textContent = on ? 'EN JEU' : 'APERÇU';
    stateTag.classList.toggle('is-on', on);
    STAT_ORDER.forEach((key) => {
      const seg = detail.querySelector(`[data-seg="${key}"]`);
      seg.style.flexGrow = mode.weights[key];
      seg.querySelector('b').textContent = pct(mode.weights[key]);
      detail.querySelector(`[data-leg="${key}"]`).textContent = pct(mode.weights[key]) + ' %';
    });
  }

  /* ---- combat : le verdict --------------------------------------------------------- */

  function scoredRoster(mode) {
    return state.roster
      .map((config, index) => {
        const fighter = build(config);
        return { config, fighter, index, color: SLOT_COLORS[index % SLOT_COLORS.length], value: score(fighter, mode) };
      })
      .sort((a, b) => b.value - a.value);
  }

  const pts = (value) => Math.round(value * 1000) / 10;

  /* Les cinq axes du profil compare, dans l'ordre du tour de cadran. */
  const AXES = [
    { key: 'hp', label: 'PV EFF.' },
    { key: 'damage', label: 'DPS' },
    { key: 'resistance', label: 'RÉSIST' },
    { key: 'speed', label: 'VITESSE' },
    { key: 'energy', label: 'ÉNERGIE' }
  ];

  const radarPoint = (axisIndex, value) => {
    const angle = -Math.PI / 2 + axisIndex * (Math.PI * 2 / AXES.length);
    return [160 + Math.cos(angle) * 108 * value, 150 + Math.sin(angle) * 108 * value];
  };

  /* Le profil compare : une toile par bete, sur les memes cinq axes que le
     calcul. La forme dit tout de suite qui est massif et qui est vif. */
  function renderRadar(scored) {
    const ring = (value) => {
      const points = AXES.map((_, i) => radarPoint(i, value).map((n) => Math.round(n * 10) / 10).join(',')).join(' ');
      return `<polygon points="${points}" fill="${value === 1 ? 'rgba(0,0,0,.25)' : 'none'}"
                       stroke="rgba(255,255,255,${value === 1 ? .3 : .12})" stroke-width="1"></polygon>`;
    };
    const spokes = AXES.map((_, i) => {
      const [x, y] = radarPoint(i, 1);
      return `<line x1="160" y1="150" x2="${Math.round(x * 10) / 10}" y2="${Math.round(y * 10) / 10}"
                    stroke="rgba(255,255,255,.18)" stroke-width="1"></line>`;
    }).join('');
    /* Les dernieres du classement passent derriere : la gagnante reste lisible. */
    const shapes = scored.slice().reverse().map((row) => {
      const n = normalise(row.fighter);
      const points = AXES.map((axis, i) => radarPoint(i, Math.max(0.04, n[axis.key])).map((v) => Math.round(v * 10) / 10).join(',')).join(' ');
      return `<polygon class="radar-shape" data-slug="${escapeHtml(row.fighter.entity.slug)}" points="${points}" fill="${row.color}30" stroke="${row.color}"
                       stroke-width="2.5" stroke-linejoin="round" style="--i:${scored.length - 1 - scored.indexOf(row)}"></polygon>`;
    }).join('');
    const dots = scored.map((row) => {
      const n = normalise(row.fighter);
      return AXES.map((axis, i) => {
        const [x, y] = radarPoint(i, Math.max(0.04, n[axis.key]));
        return `<circle class="radar-dot" data-slug="${escapeHtml(row.fighter.entity.slug)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${row.color}"
                        stroke="#0B100C" stroke-width="1.5"></circle>`;
      }).join('');
    }).join('');
    const labels = AXES.map((axis, i) => {
      const [x, y] = radarPoint(i, 1.2);
      const anchor = Math.abs(x - 160) < 12 ? 'middle' : (x > 160 ? 'start' : 'end');
      return `<text x="${Math.round(x)}" y="${Math.round(y) + 3}" fill="#D9D3C7" font-family="Silkscreen, monospace"
                    font-size="9" text-anchor="${anchor}">${axis.label}</text>`;
    }).join('');

    $('[data-radar]').innerHTML = [0.25, 0.5, 0.75, 1].map(ring).join('') + spokes + shapes + dots + labels;
    /* La legende ouvre la fiche de la bete, comme le classement. */
    $('[data-radar-legend]').innerHTML = scored.map((row) => `
      <button type="button" class="radar-key" data-show="${escapeHtml(row.fighter.entity.slug)}" aria-pressed="false"
              style="--slot:${row.color}">
        <span class="swatch" style="--swatch-color:${row.color}"></span>
        <span class="crisp" aria-hidden="true" style="${bg(row.fighter.entity.head)}"></span>
        ${escapeHtml(row.fighter.entity.name)}
      </button>`).join('');
  }

  /* Tout ce que le combat calcule, dans la fiche : rien ne se perd. */
  const dialStats = (fighter) => [
    ['PV', num(fighter.hp)],
    ['PV EFFECTIFS', Math.round(fighter.effHp)],
    ['DÉGÂTS / COUP', num(fighter.hit)],
    ['DÉGÂTS / COMBO', num(fighter.damage)],
    ['DPS', num(fighter.dps)],
    ['CADENCE', num(fighter.interval) + ' s / coup'],
    ['VITESSE', num(fighter.speed) + ' b/s'],
    ['RECUL', Math.round(fighter.knockback * 100) + ' %'],
    ['ARMURE', num(fighter.armor)],
    ['PROTECTION', fighter.protection > 0 ? '−' + num(fighter.protection * 100) + ' %' : '0 %'],
    ['ÉNERGIE', Math.round(fighter.energy)],
    ['POINTS', fighter.points],
    ['PV · DGT · VIT · NRG', UPGRADES.map((key) => fighter.alloc[key] || 0).join(' · ')]
  ];

  /* Les postes arrives au plafond du mod : les points suivants vont ailleurs. */
  function capsOf(fighter) {
    const label = { hp: 'PV', damage: 'Dégâts', speed: 'Vitesse' };
    return fighter.capped.map((key) => label[key] + ' au plafond du mod');
  }

  /* D'ou viennent les points : la part de chaque statistique dans le score du
     mode choisi. C'est le calcul lui-meme, rendu lisible. */
  function breakdown(fighter, mode) {
    const n = normalise(fighter);
    const parts = Object.keys(mode.weights)
      .map((key) => ({ key, label: WEIGHT_LABEL[key], value: n[key] * mode.weights[key] }))
      .sort((a, b) => b.value - a.value);
    const raw = parts.reduce((sum, part) => sum + part.value, 0);
    return { parts, raw, final: score(fighter, mode) };
  }

  /* Combien de temps une bete met a en abattre une autre : autant de coups
     qu'il faut pour vider ses PV, chaque coup passe par les filtres du mod
     (critique d'assassin, x0,8 des tanks, armure), au rythme du combo de
     l'attaquant. */
  function timeToKill(attacker, target) {
    const perHit = landedHit(attacker, target);
    if (perHit <= 0) return null;
    const hits = Math.ceil(target.hp / perHit - 1e-9);
    return { seconds: hits * attacker.interval, hits, combos: Math.ceil(hits / COMBO_HITS), perHit };
  }

  /* Le podium : les trois premiers sur des blocs, le premier au centre et plus
     haut. Les suivants se lisent dans le classement, juste dessous.

     La hauteur d'une marche est proportionnelle au score : deux betes a
     quelques points l'une de l'autre se tiennent presque a la meme hauteur,
     un ecrasement se lit comme un gouffre. Un plancher garde le chiffre de la
     marche lisible, et un pas minimal garde l'ordre du classement visible. */
  const PODIUM_TOP = 210;
  const PODIUM_FLOOR = 66;
  const PODIUM_STEP = 8;
  function podiumHeights(scored) {
    const best = scored[0] && scored[0].value > 0 ? scored[0].value : 1;
    const out = [];
    scored.slice(0, 3).forEach((row, i) => {
      const ratio = Math.max(0, Math.min(1, row.value / best));
      let h = Math.max(PODIUM_FLOOR, Math.round(PODIUM_TOP * ratio));
      if (i > 0) h = Math.max(PODIUM_FLOOR, Math.min(h, out[i - 1] - PODIUM_STEP));
      out.push(h);
    });
    return out;
  }

  function renderPodium(scored) {
    const places = [1, 0, 2].filter((i) => scored[i]);
    const medal = ['#F5C842', '#C9CED6', '#C9824A'];
    const height = podiumHeights(scored);
    $('[data-podium]').innerHTML = `
      <div class="podium-stage">
        ${places.map((i) => {
          const row = scored[i];
          return `
            <div class="podium-place place-${i + 1}" style="--slot:${row.color};--medal:${medal[i]};--h:${height[i]}px">
              ${portraitBox(row.fighter.entity, 'podium-art')}
              <span class="podium-name">${escapeHtml(row.fighter.entity.name)}</span>
              <span class="podium-pts">${pts(row.value)} pts</span>
              <span class="podium-block"><b>${i + 1}</b></span>
            </div>`;
        }).join('')}
      </div>`;
  }

  const archetypeTag = (fighter) => (ARCHETYPE_LABEL[fighter.archetype.name] || fighter.archetype.name).toUpperCase();

  /* La bete dont la fiche est ouverte : celle qu'on a choisie tant qu'elle
     reste dans l'arene, sinon la premiere du classement. */
  const focusRow = (scored) => scored.find((row) => row.fighter.entity.slug === state.focus) || scored[0];

  /* Le classement : une ligne par bete, de la premiere a la derniere. La
     barre a la longueur du score (la premiere fait toute la largeur) et se
     coupe en une part par statistique du mode : d'ou viennent les points se
     lit sur la meme ligne, chaque part donne sa valeur au survol. Une ligne
     ouvre la fiche de sa bete. */
  function renderRanking(scored, mode) {
    const best = scored[0] && scored[0].value > 0 ? scored[0].value : 1;
    $('[data-ranking]').innerHTML = scored.map((row, index) => {
      const parts = breakdown(row.fighter, mode);
      const total = parts.raw || 1;
      const entity = row.fighter.entity;
      return `
        <button type="button" class="rank-row" data-show="${escapeHtml(entity.slug)}" aria-pressed="false"
                style="--slot:${row.color};--i:${index}">
          <b class="rank-num">${index + 1}</b>
          <span class="rank-head crisp" aria-hidden="true" style="${bg(entity.head)}"></span>
          <span class="rank-who">
            <b>${escapeHtml(entity.name)}</b>
            <small class="t-pixel">NIV. <b class="${lvlClass(row.config.level)}">${row.config.level}</b> · ${escapeHtml(archetypeTag(row.fighter))}</small>
          </span>
          <span class="rank-track">
            <span class="bd-bar" style="width:${Math.max(8, Math.round(row.value / best * 100))}%">
              ${parts.parts.map((part, i) => `
                <span class="bd-seg bd-seg-${part.key}" style="flex:${(part.value / total).toFixed(4)};--j:${i}"
                      title="${escapeHtml(part.label)} : ${pts(part.value)} pts">
                  <span>${part.value / total > 0.14 ? escapeHtml(part.label) : ''}</span>
                </span>`).join('')}
            </span>
          </span>
          <b class="rank-pts">${pts(row.value)}<small>PTS</small></b>
        </button>`;
    }).join('');
    $('[data-ranking-legend]').innerHTML = Object.keys(mode.weights).map((key) => `
      <span class="bd-key"><span class="bd-swatch bd-seg-${key}"></span>${WEIGHT_LABEL[key]} ×${mode.weights[key].toFixed(2).replace('.', ',')}</span>`).join('');
  }

  /* Un duel vu de la bete ouverte : le temps qu'elle met a abattre l'autre,
     celui qu'il faut a l'autre pour l'abattre ; le plus court gagne. */
  function duelLine(row, other) {
    const out = timeToKill(row.fighter, other.fighter);
    const back = timeToKill(other.fighter, row.fighter);
    const outcome = !out && !back ? 'is-draw'
      : !out ? 'is-lose'
        : !back ? 'is-win'
          : out.seconds < back.seconds ? 'is-win' : out.seconds > back.seconds ? 'is-lose' : 'is-draw';
    const time = (duel, attacker) => (duel
      ? `<span class="fd-time" title="${duel.hits} coups de ${num(duel.perHit)} (${num(attacker.hit)} avant protection) · ${duel.combos} combo${duel.combos > 1 ? 's' : ''}">
           <b>${num(duel.seconds)} s</b><small>${duel.hits} coup${duel.hits > 1 ? 's' : ''}</small></span>`
      : '<span class="fd-time" title="Ne frappe pas"><b>—</b></span>');
    return { out, outcome, html: (fastest) => `
      <div class="fd-row ${outcome}" style="--slot:${other.color}">
        <span class="fd-who">
          <span class="crisp" aria-hidden="true" style="${bg(other.fighter.entity.head)}"></span>
          <b>${escapeHtml(other.fighter.entity.name)}</b>
        </span>
        <span class="fd-side${fastest ? ' is-fastest' : ''}"><small class="t-pixel">L'ABAT EN</small>${time(out, row.fighter)}</span>
        <span class="fd-side"><small class="t-pixel">TOMBE EN</small>${time(back, other.fighter)}</span>
        <span class="fd-tag t-pixel">${{ 'is-win': 'GAGNE', 'is-lose': 'PERD', 'is-draw': 'ÉGALITÉ' }[outcome]}</span>
      </div>` };
  }

  /* La fiche d'une seule bete : son bandeau, tout ce que le combat calcule
     pour elle, ses duels contre chacune des autres (une ligne et une colonne
     de l'ancien tableau), ses atouts et ses faiblesses. Les tetes du bandeau
     passent d'une fiche a l'autre. */
  function renderFocus(scored, mode) {
    const row = focusRow(scored);
    if (!row) return;
    const rank = scored.indexOf(row) + 1;
    const entity = row.fighter.entity;
    const card = $('[data-focus-card]');
    card.style.setProperty('--slot', row.color);

    const banner = $('[data-focus-banner]');
    banner.style.setProperty('--beast', entity.color || row.color);
    banner.innerHTML = `
      ${portraitBox(entity, 'verdict-solo')}
      ${scored.length > 1 ? `
        <span class="focus-pick" role="group" aria-label="Fiche affichée">
          ${scored.map((other, i) => `
            <button type="button" class="focus-pick-btn" data-show="${escapeHtml(other.fighter.entity.slug)}" aria-pressed="false"
                    style="--slot:${other.color}" title="#${i + 1} · ${escapeHtml(other.fighter.entity.name)}"
                    aria-label="Fiche de ${escapeHtml(other.fighter.entity.name)}">
              <span class="crisp" aria-hidden="true" style="${bg(other.fighter.entity.head)}"></span>
            </button>`).join('')}
        </span>` : ''}
      <span class="verdict-rank">#${rank}</span>
      <a class="verdict-name" href="${animalHref(entity.slug)}">${escapeHtml(entity.name)}</a>
      <span class="verdict-score t-pixel">${pts(row.value)} PTS · NIV. <b class="${lvlClass(row.config.level)}">${row.config.level}</b> · ${escapeHtml(archetypeTag(row.fighter))}</span>`;

    const caps = capsOf(row.fighter);
    $('[data-focus-stats]').innerHTML = `
      <dl class="focus-stats">
        ${dialStats(row.fighter).map(([key, value]) => `
          <div><dt>${key}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join('')}
      </dl>
      ${caps.length ? `
        <span class="focus-caps">
          ${caps.map((text) => `<span class="focus-cap">${escapeHtml(text)}</span>`).join('')}
        </span>` : ''}`;

    const duels = scored.filter((other) => other !== row).map((other) => duelLine(row, other));
    const fastest = duels.filter((d) => d.out).reduce((min, d) => (!min || d.out.seconds < min.out.seconds ? d : min), null);
    $('[data-focus-duels]').innerHTML = duels.length
      ? duels.map((d) => d.html(d === fastest && duels.length > 1)).join('')
      : '<p class="empty-note">Un second combattant est nécessaire pour comparer les duels.</p>';

    const verdict = strengthsAndWeaknesses(row.fighter, mode);
    $('[data-focus-verdict]').innerHTML = `
      <div class="verdict-list is-pro">
        <span class="t-pixel">ATOUTS</span>
        ${verdict.pros.map((text) => `<span class="verdict-line">${escapeHtml(text)}</span>`).join('')}
      </div>
      <div class="verdict-list is-con">
        <span class="t-pixel">FAIBLESSES</span>
        ${verdict.cons.map((text) => `<span class="verdict-line">${escapeHtml(text)}</span>`).join('')}
      </div>`;

    markFocus(entity.slug);
  }

  /* La bete ouverte s'allume partout : sa ligne du classement, sa tete dans
     le bandeau, sa cle de legende ; sa toile passe devant les autres. */
  function markFocus(slug) {
    document.querySelectorAll('[data-results] [data-show]').forEach((el) => {
      el.setAttribute('aria-pressed', String(el.dataset.show === slug));
    });
    const radar = $('[data-radar]');
    radar.classList.add('has-focus');
    radar.querySelectorAll('[data-slug]').forEach((el) => el.classList.toggle('is-focus', el.dataset.slug === slug));
    const shape = radar.querySelector(`.radar-shape[data-slug="${slug}"]`);
    const firstDot = radar.querySelector('.radar-dot');
    if (shape && firstDot && shape.nextElementSibling !== firstDot) radar.insertBefore(shape, firstDot);
  }

  /* Ouvrir une autre fiche : seule la fiche se refait, le reste du verdict
     ne rejoue pas ses entrees. */
  function showFocus(slug) {
    state.focus = slug;
    const mode = MODES.find((m) => m.id === state.mode) || MODES[0];
    const card = $('[data-focus-card]');
    card.classList.remove('is-switching');
    void card.offsetWidth;
    card.classList.add('is-switching');
    renderFocus(scoredRoster(mode), mode);
  }

  function renderResults() {
    const results = $('[data-results]');
    results.hidden = !state.hasRun;
    if (!state.hasRun) return;

    const mode = MODES.find((m) => m.id === state.mode) || MODES[0];
    const scored = scoredRoster(mode);

    $('[data-ranking-label]').textContent = 'CLASSEMENT · ' + mode.name.toUpperCase();
    renderPodium(scored);

    const margin = $('[data-margin]');
    if (scored.length > 1) {
      const gap = pts(scored[0].value - scored[1].value);
      const relative = scored[1].value > 0
        ? '+' + Math.round((scored[0].value / scored[1].value - 1) * 1000) / 10 + ' %'
        : '—';
      margin.textContent = `${scored[0].fighter.entity.name} devance ${scored[1].fighter.entity.name} de ${gap} points (${relative}) dans ce mode.`;
      margin.hidden = false;
    } else {
      margin.hidden = true;
    }

    renderRanking(scored, mode);
    renderRadar(scored);
    renderFocus(scored, mode);
  }

  /* ---- Piste Sauvage ----------------------------------------------------------------

     Le plateau lui-meme (dessin, regles, achats, sons) vit dans
     js/wild-trail.js, partage avec les fiches de creature. Ici ne restent que
     le choix de la bete et les colonnes de droite, tenues a jour par le
     composant a chaque changement. */

  let trailPlanner = null;

  function renderTrailPicker() {
    $('[data-trail-picker]').innerHTML = state.data.entities
      .filter((entity) => entity.piste.available)
      .map((entity) => `
        <button type="button" class="btn btn-toggle" data-trail="${entity.slug}"
                aria-pressed="${entity.slug === state.trailSlug}">
          <span class="crisp" aria-hidden="true" style="${bg(entity.head)};width:24px;height:24px;background-size:contain;background-repeat:no-repeat"></span>
          ${escapeHtml(entity.name)}
        </button>`).join('');
  }

  function renderTrail() {
    const entity = entityOf(state.trailSlug);

    /* La bete dont on monte la piste, en tete de colonne. */
    const hero = $('[data-trail-hero]');
    hero.href = animalHref(entity.slug);
    hero.style.setProperty('--beast', entity.color || '#F2A32C');
    hero.innerHTML = `
      ${portraitBox(entity, 'trail-hero-solo')}
      <span class="trail-hero-text">
        <span class="t-pixel">PISTE SAUVAGE DE</span>
        <span class="trail-hero-name">${escapeHtml(entity.name)}</span>
        <span class="t-pixel">${entity.piste.available ? entity.piste.nodeCount + ' NŒUDS · FICHE →' : 'FICHE →'}</span>
      </span>`;

    if (!trailPlanner) {
      trailPlanner = OW.WildTrail.create($('[data-trail-planner]'), { height: 600, onChange: renderTrailSide });
    }
    trailPlanner.setEntity(entity);
  }

  function renderTrailSide(sum) {
    if (!sum) {
      $('[data-owned]').textContent = '0';
      $('[data-total]').textContent = '0';
      $('[data-progress]').style.setProperty('--bar-width', '0%');
      $('[data-trail-atlevel]').textContent = '—';
      $('[data-ledger]').innerHTML = '';
      $('[data-unlocked]').innerHTML = '<p class="empty-note">Aucune capacité à débloquer.</p>';
      return;
    }
    const accent = sum.entity.color || '#F2A32C';
    $('[data-owned]').textContent = sum.owned;
    $('[data-total]').textContent = sum.total;
    $('[data-progress]').style.setProperty('--bar-width', Math.round(sum.owned / sum.total * 100) + '%');
    $('[data-progress]').style.setProperty('--bar-color', accent);
    $('[data-trail-atlevel]').innerHTML = sum.reachable + ' / ' + sum.total + ' (niveau <span class="' + lvlClass(sum.level) + '">' + sum.level + '</span>)';

    const net = sum.coins - sum.spent;
    const ownedAttacks = sum.attacks.filter((a) => a.owned).length;
    $('[data-ledger]').innerHTML = [
      ['Pièces dépensées', sum.spent, 'var(--tone-spend)', coinSprite(sum.spent)],
      ['Pièces gagnées', sum.coins, 'var(--tone-gain)', coinSprite(sum.coins)],
      ['Bilan net', net, net >= 0 ? 'var(--tone-gain)' : 'var(--tone-loss)', coinSprite(Math.abs(net))],
      ['Expérience gagnée', sum.xp, 'var(--tone-gain)', OW.WildTrail && OW.WildTrail.xpIcon ? OW.WildTrail.xpIcon(sum.xp) : 'assets/ui/taming_exp.png'],
      ['Capacités', ownedAttacks + ' / ' + sum.attacks.length, null, 'assets/ui/energy.png']
    ].map(([label, value, color, icon]) => `
      <div class="stat-row">
        <dt>${escapeHtml(label)}</dt>
        <dd style="display:flex;align-items:center;gap:7px;justify-content:flex-end;${color ? 'color:' + color : ''}">
          <span class="crisp" aria-hidden="true" style="${bg(icon)};width:20px;height:20px;background-size:contain;background-repeat:no-repeat"></span>${escapeHtml(String(value))}
        </dd>
      </div>`).join('');

    /* Chaque noeud de capacite offre un passif au choix : on affiche celui qui
       a ete retenu, ou les options encore ouvertes. */
    $('[data-unlocked]').innerHTML = sum.attacks.length
      ? sum.attacks.map((a, i) => `
          <div class="trail-unlock${a.owned ? ' is-owned' : ''}" style="--i:${i}">
            <span class="trail-unlock-icon crisp" aria-hidden="true" style="${bg('assets/ui/energy.png')}"></span>
            <span class="stack" style="gap:3px;min-width:0">
              <span class="trail-unlock-name">${escapeHtml(a.passive ? a.passive.name : (a.passives.map((p) => p.name).join(' / ') || 'Nœud de capacité ' + (i + 1)))}</span>
              ${a.passive ? `<span class="trail-unlock-desc">${escapeHtml(a.passive.description)}</span>` : ''}
              <span class="t-pixel">NIVEAU ${a.node.requiredLevel} · ${a.node.cost} PIÈCES${a.owned ? ' · ACQUIS' : ' · ' + escapeHtml(a.why.toUpperCase())}</span>
            </span>
          </div>`).join('')
      : '<p class="empty-note">Cette piste ne débloque aucune capacité.</p>';
  }

  /* ---- archetypes & niveaux ---------------------------------------------------------- */

  /* Les couleurs des archetypes (codes § du mod) et l'encre de leur nom
     vivent dans js/site.js : le haut de chaque fiche les reprend. Le liseré
     garde la couleur brute, le nom prend archetypeInk. */
  const { archetypeColor, archetypeInk } = OW;

  /* Un multiplicateur sur une jauge centree sur x1 : a droite ce qui gagne,
     a gauche ce qui perd, de x0,5 a x1,5. */
  function multBar(label, value) {
    const delta = Math.max(-0.5, Math.min(0.5, value - 1));
    const width = Math.abs(delta) / 0.5 * 50;
    const side = delta >= 0 ? 'left:50%' : 'right:50%';
    const tone = delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : '';
    return `
      <div class="mult">
        <span class="mult-key">${label}</span>
        <span class="mult-track"><span class="mult-fill ${tone}" style="${side};width:${width}%"></span></span>
        <span class="mult-value ${tone}">×${value}</span>
      </div>`;
  }

  function renderArchetypes() {
    $('[data-archetypes]').innerHTML = state.data.archetypes.map((archetype) => {
      const members = state.data.entities.filter((e) => e.archetype && e.archetype.name === archetype.name);
      const color = archetypeColor(archetype.name);
      return `
        <article class="arch-card" data-arch="${escapeHtml(archetype.name)}" style="--arch:${color};--arch-ink:${archetypeInk(color)};--i:${state.data.archetypes.indexOf(archetype)}">
          <header class="arch-head">
            <span class="arch-icon crisp" aria-hidden="true" style="${bg(archetypeIcon(archetype.name))}"></span>
            <span class="stack" style="gap:2px">
              <span class="arch-name">${escapeHtml(ARCHETYPE_LABEL[archetype.name] || archetype.name)}</span>
              <span class="t-pixel">${escapeHtml(archetype.name)}</span>
            </span>
          </header>
          <div class="arch-mults">
            ${multBar('PV', archetype.hp)}
            ${multBar('DGT', archetype.damage)}
            ${multBar('VIT', archetype.speed)}
            ${multBar('NRG', archetype.energy)}
          </div>
          <footer class="arch-members">
            ${members.length
              ? members.map((e) => `<a class="arch-member" href="${animalHref(e.slug)}" title="${escapeHtml(e.name)}">
                  <span class="crisp" aria-hidden="true" style="${bg(e.head)}"></span></a>`).join('')
              : '<span class="t-pixel" style="color:var(--text-faint)">AUCUNE CRÉATURE</span>'}
          </footer>
        </article>`;
    }).join('');

    /* Venu de l'embleme d'une fiche (?arch=berserker#stats) : la carte de
       son archetype s'allume et passe a l'ecran. */
    const wanted = new URLSearchParams(window.location.search).get('arch');
    const target = wanted && /^[a-z_]+$/i.test(wanted)
      && $('[data-archetypes] [data-arch="' + wanted.toUpperCase() + '"]');
    if (target) {
      target.classList.add('is-target');
      /* Centree a l'ecran, sous l'en-tete : scrollIntoView() reste sans effet
         sur ce site (voir OW.scrollToEl). */
      const centre = () => {
        const r = target.getBoundingClientRect();
        const room = Math.max(96, (window.innerHeight - r.height) / 2);
        window.scrollTo({ top: Math.max(0, r.top + window.scrollY - room), behavior: 'smooth' });
      };
      /* Pas avant que le voile de chargement ne se leve (meme recette que
         js/bosses.js) : pendant qu'il couvre la page, le defilement se perd. */
      const root = document.documentElement;
      if (state.tab !== 'stats') return;
      if (!root.hasAttribute('data-booting')) { setTimeout(centre, 250); return; }
      const mo = new MutationObserver(() => {
        if (root.hasAttribute('data-booting')) return;
        mo.disconnect();
        setTimeout(centre, 300);
      });
      mo.observe(root, { attributes: true, attributeFilter: ['data-booting'] });
    }
  }


  /* ===========================================================================
     Formules : l'encyclopedie des mecaniques

     Chaque calcul du mod, en une phrase, en formule, puis applique a la
     creature choisie. Les exemples passent par les memes fonctions que
     l'arene (tracksOf, tamedHealth, armorReduction...) : ce qui est ecrit ici
     est exactement ce que le comparateur calcule.
     =========================================================================== */

  const fx = (n, d) => (n == null || !isFinite(n) ? '—' : num(Math.round(n * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)));
  const v = (text) => `<var>${escapeHtml(String(text))}</var>`;

  function renderFormulas() {
    const host = $('[data-formulas]');
    if (!host) return;
    const entities = state.data.entities.filter((e) => e.stats && e.stats.hp);
    if (!state.formulaSlug) state.formulaSlug = (entities.find((e) => e.slug === 'tiger') || entities[0]).slug;
    const e = entities.find((x) => x.slug === state.formulaSlug) || entities[0];
    const s = e.stats;
    const a = archetypeOf(e.archetype && e.archetype.name);
    const aName = (ARCHETYPE_LABEL[a.name] || a.name);
    const t = tracksOf(e);
    const hp0 = s.hp || 20;
    const tamedMult = hp0 >= 80 ? 1.05 : hp0 >= 70 ? 1.1 : hp0 >= 60 ? 1.2 : 1.3;
    const ticks = COMBO_TICKS[e.slug] || DEFAULT_COMBO_TICKS;
    const interval = ticks / 20;
    const hit = (s.damage || 0) / COMBO_HITS;
    const crit = a.name === 'ASSASSIN' ? 1 + ASSASSIN_CRIT_CHANCE * (ASSASSIN_CRIT_MULT - 1) : 1;
    const armor = s.armor || 0, tough = s.armorToughness || 0;
    const incoming = 6;
    const red = armorReduction(armor, tough, incoming);
    const curve = state.data.levelCurve;
    const lvl20 = curve.levels.find((l) => l.level === 20);
    const scale = s.scale || 0;
    const camera = scale >= 15 ? Math.max(4, scale * 8 / 18) : 4;

    /* Le texte d'un cote (.fx-face), le calcul de l'autre (.fx-math) : les
       versions les posent cote a cote, l'un sous l'autre, ou n'ouvrent qu'une
       fiche a la fois (state.fxOpen). */
    const titles = [];
    const card = (i, title, text, formula, example) => {
      titles.push(title);
      return `
      <article class="fx-card${state.fxOpen === i ? ' is-open' : ''}" style="--i:${i}" data-fx-card="${i}">
        <header class="fx-head" data-fx-open="${i}"><span class="fx-num">${String(i).padStart(2, '0')}</span><h3>${title}</h3></header>
        <div class="fx-face"><p class="fx-text">${text}</p></div>
        <div class="fx-math">
          <div class="fx-formula">${formula}</div>
          <div class="fx-example"><span class="t-pixel">EXEMPLE · ${escapeHtml(e.name.toUpperCase())}</span>${example}</div>
        </div>
      </article>`;
    };

    host.innerHTML = `
      <div class="fx-pick" role="group" aria-label="Créature des exemples">
        <span class="t-pixel">EXEMPLES AVEC</span>
        ${entities.map((x) => `<button type="button" class="fx-pick-btn" data-fx-pick="${escapeHtml(x.slug)}" aria-pressed="${x.slug === e.slug}" title="${escapeHtml(x.name)}">
          <span class="crisp" aria-hidden="true" style="${bg(x.head)}"></span><b>${escapeHtml(x.name)}</b></button>`).join('')}
      </div>
      <nav class="fx-index" data-fx-index aria-label="Sommaire des formules"></nav>
      <div class="fx-grid">
        ${card(1, 'Chaque créature est unique',
          'À son apparition, une créature sauvage tire au hasard ses points de vie, ses dégâts et sa vitesse autour de la valeur de base de son espèce. Une créature née d’un élevage n’est pas tirée au sort.',
          `${v('PV')} = base × ${v('0,8 à 1,2')}<br>${v('Dégâts')} = base × ${v('0,9 à 1,1')}<br>${v('Vitesse')} = base × ${v('0,85 à 1,05')}`,
          `<p>PV : ${fx(hp0 * 0.8)} à ${fx(hp0 * 1.2)} (base ${fx(hp0)})<br>Dégâts : ${fx((s.damage || 0) * 0.9)} à ${fx((s.damage || 0) * 1.1)}<br>Vitesse : ${fx((s.walkBps || 0) * 0.85)} à ${fx((s.walkBps || 0) * 1.05)} blocs/s</p>`)}
        ${card(2, 'L’apprivoisement renforce',
          'Une fois apprivoisée, la créature gagne des points de vie. Plus elle est déjà solide, moins elle en gagne.',
          `${v('PV apprivoisée')} = PV × ${v('1,05')} si PV ≥ 80, ${v('1,1')} si ≥ 70, ${v('1,2')} si ≥ 60, sinon ${v('1,3')}`,
          `<p>${fx(hp0)} PV × ${fx(tamedMult, 2)} = <b>${fx(tamedHealth(hp0))} PV</b></p>`)}
        ${card(3, 'Un niveau, un point',
          'Apprivoisée, la créature commence au niveau 1. Chaque niveau gagné rapporte un point, à placer dans une seule statistique.',
          `${v('Points disponibles')} = niveau − 1`,
          `<p>Au niveau 20 : <b>19 points</b> ; au niveau ${curve.max} : <b>${curve.max - 1} points</b>.${lvl20 ? `<br>Passer du niveau 20 au 21 demande ${fx(lvl20.xpToNext, 0)} XP.` : ''}</p>`)}
        ${card(4, 'Ce que rapporte un point',
          `Le gain dépend de l’archétype (${escapeHtml(aName)} pour cette créature). À noter : le mod applique le multiplicateur de dégâts au gain de vitesse.`,
          `${v('PV')} +1 × mult. PV<br>${v('Dégâts')} +0,15 × mult. dégâts<br>${v('Vitesse')} +0,002 × mult. dégâts<br>${v('Énergie')} +${RULES.energyStep} × mult. énergie`,
          `<p>PV +${fx(t.hp.step, 2)} · Dégâts +${fx(t.damage.step, 3)} · Vitesse +${fx(t.speed.step, 4)} · Énergie +${fx(t.energy.step, 1)} par point</p>`)}
        ${card(5, 'Les plafonds',
          'Les points de vie, les dégâts et la vitesse ne montent pas sans fin : au plafond, le bouton « + » de l’inventaire disparaît. L’énergie n’a pas de plafond.',
          `${v('Plafond PV')} = PV × 1,3 × (0,75 + mult. PV)<br>${v('Plafond dégâts')} = dégâts × (0,75 + mult. dégâts)<br>${v('Plafond vitesse')} = vitesse × (0,5 + mult. vitesse)`,
          `<p>PV : ${fx(t.hp.cap)} (atteint en ${t.hp.max} points)<br>Dégâts : ${fx(t.damage.cap, 2)} (en ${t.damage.max} points)<br>Vitesse : atteinte en ${t.speed.max} points</p>`)}
        ${card(6, 'Le combo',
          'Une attaque montée est un combo de trois coups. Chaque coup vaut le tiers des dégâts, et dure un nombre fixe de ticks (20 ticks = 1 seconde).',
          `${v('Coup')} = dégâts ÷ 3<br>${v('Rythme')} = ticks ÷ 20 s<br>${v('DPS')} = coup ÷ rythme`,
          `<p>${fx(s.damage || 0)} ÷ 3 = ${fx(hit, 2)} par coup, toutes les ${fx(interval, 2)} s<br>DPS = <b>${fx(hit * crit / interval, 2)}</b>${crit > 1 ? ' (critiques compris)' : ''}</p>`)}
        ${card(7, 'Les archétypes en combat',
          'Deux archétypes changent le calcul d’un coup : l’Assassin porte un coup critique une fois sur dix, le Tank encaisse moins les attaques de créatures.',
          `${v('Assassin')} : 1 coup sur 10 × 1,25 → en moyenne × 1,025<br>${v('Tank')} : dégâts reçus × 0,8`,
          `<p>${escapeHtml(e.name)} est ${escapeHtml(aName)} : ${a.name === 'ASSASSIN' ? 'ses coups valent en moyenne ×1,025.' : a.name === 'TANK' ? 'il ne reçoit que 80 % des coups de créatures.' : 'aucun effet particulier sur les coups.'}</p>`)}
        ${card(8, 'L’armure',
          'L’armure suit la formule de Minecraft : elle retire une part du coup, qui diminue quand le coup est fort. La ténacité limite cette baisse.',
          `${v('Réduction')} = limite(armure − coup ÷ (2 + ténacité ÷ 4), armure × 0,2, 20) ÷ 25`,
          `<p>Armure ${fx(armor)}, ténacité ${fx(tough)}, coup de ${incoming} :<br>réduction de <b>${fx(red * 100)} %</b>, soit ${fx(incoming * (1 - red), 2)} dégâts subis.</p>`)}
        ${card(9, 'La reproduction',
          'Le petit hérite de la taille moyenne de ses deux parents. Ses statistiques ne sont pas tirées au sort comme celles d’une créature sauvage.',
          `${v('Taille du petit')} = (taille parent 1 + taille parent 2) ÷ 2`,
          '<p>Parents de taille 1,05 et 0,95 : petit de taille <b>1,00</b>.</p>')}
        ${card(10, 'La caméra montée',
          'À la troisième personne, la caméra recule de 4 blocs sur une monture. Pour les très grandes créatures, elle recule davantage, en proportion de leur taille.',
          `${v('Recul')} = 4 blocs si taille théorique &lt; 15<br>sinon taille × 8 ÷ 18`,
          `<p>Taille théorique ${fx(scale)} : recul de <b>${fx(camera)} blocs</b>.</p>`)}
      </div>`;

    host.querySelector('[data-fx-index]').innerHTML = `
      <span class="t-pixel">SOMMAIRE</span>
      ${titles.map((title, i) => `
        <button type="button" class="fx-index-btn" data-fx-open="${i + 1}" aria-pressed="${state.fxOpen === i + 1}">
          <b>${String(i + 1).padStart(2, '0')}</b><span>${title}</span>
        </button>`).join('')}`;
  }

  /* Ouvrir une fiche du manuel, sans tout redessiner. */
  function openFormula(i) {
    state.fxOpen = i;
    document.querySelectorAll('[data-fx-card]').forEach((card) => {
      card.classList.toggle('is-open', Number(card.dataset.fxCard) === i);
    });
    document.querySelectorAll('.fx-index-btn').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(Number(btn.dataset.fxOpen) === i));
    });
  }


  function renderCurve() {
    const curve = state.data.levelCurve;
    const level = Math.min(state.curveLevel, curve.max);
    const entry = curve.levels.find((l) => l.level === level) || curve.levels[0];
    const peak = Math.max.apply(null, curve.levels.map((l) => l.xpToNext || 0)) || 1;

    $('[data-curve-level]').textContent = level;
    $('[data-curve-level]').classList.toggle('lvl-max', level >= curve.max);
    $('[data-max-level]').textContent = curve.max;
    setXp($('[data-curve-xp]'), level, curve.max);

    const slider = $('[data-curve-slider]');
    slider.max = curve.max;
    slider.value = level;

    $('[data-level-rows]').innerHTML = [
      ['XP pour le niveau suivant', entry ? entry.xpToNext : '—'],
      ['XP cumulée', entry ? entry.cumulative : '—'],
      ['XP totale (niveau ' + curve.max + ')', curve.totalXp]
    ].map(([key, value]) => `<div class="stat-row"><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join('');

    /* Les barres ne se dessinent qu'une fois ; ensuite, seules leurs classes
       changent (un glisser sur la courbe en change a chaque mouvement). */
    const host = $('[data-curve]');
    if (host.children.length !== curve.levels.length) {
      host.innerHTML = curve.levels.map((l) => `
        <span class="curve-bar" data-curve-at="${l.level}" style="height:${Math.max(6, Math.round((l.xpToNext || 0) / peak * 100))}%"
              title="Niveau ${l.level} · ${l.xpToNext} XP"></span>`).join('');
    }
    Array.prototype.forEach.call(host.children, (bar) => {
      const at = Number(bar.dataset.curveAt);
      bar.classList.toggle('is-on', at <= level);
      bar.classList.toggle('is-now', at === level);
    });
  }

  /* La courbe se manie comme le curseur : un clic sur une barre choisit son
     niveau, un glisser parcourt les niveaux. Le curseur (clavier,
     accessibilite) reste la commande de reference. */
  function wireCurve() {
    const host = $('[data-curve]');
    if (!host) return;
    const pick = (event) => {
      const bars = host.children;
      if (!bars.length) return;
      let chosen = bars[bars.length - 1];
      for (let i = 0; i < bars.length; i++) {
        if (event.clientX <= bars[i].getBoundingClientRect().right) { chosen = bars[i]; break; }
      }
      const level = Number(chosen.dataset.curveAt);
      if (level && level !== state.curveLevel) {
        state.curveLevel = level;
        renderCurve();
      }
    };
    let dragging = false;
    host.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      dragging = true;
      host.setPointerCapture(event.pointerId);
      host.classList.add('is-dragging');
      pick(event);
    });
    host.addEventListener('pointermove', (event) => { if (dragging) pick(event); });
    const stop = () => { dragging = false; host.classList.remove('is-dragging'); };
    host.addEventListener('pointerup', stop);
    host.addEventListener('pointercancel', stop);
  }

  function renderDpsRanking() {
    /* Niveau 1, aucun point place : le rythme reel du combo de chaque bete. */
    const zero = { hp: 0, damage: 0, speed: 0, energy: 0 };
    const rows = state.data.entities.map((entity) => ({ entity, dps: derive(entity, 1, zero).dps }))
      .sort((a, b) => b.dps - a.dps);

    const peak = Math.max.apply(null, rows.map((r) => r.dps)) || 1;

    $('[data-dps-ranking]').innerHTML = rows.map((row, i) => {
      const color = row.entity.color || 'var(--accent)';
      return `
        <a class="dps-row" href="${animalHref(row.entity.slug)}" style="--p:${(row.dps / peak).toFixed(3)};--i:${i}">
          <span class="dps-pos">${i + 1}</span>
          <span class="crisp dps-head" aria-hidden="true" style="${bg(row.entity.head)}"></span>
          <span class="grow stack" style="gap:5px;min-width:0">
            <span style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
              <span class="dps-name">${escapeHtml(row.entity.name)}</span>
              <span class="dps-value">${num(row.dps)} dps</span>
            </span>
            <span class="bar-track bar-track-sm">
              <span class="bar-fill" style="--bar-width:${Math.max(4, row.dps / peak * 100)}%;--bar-color:${escapeHtml(color)}"></span>
            </span>
          </span>
        </a>`;
    }).join('');
  }

  /* ---- quetes : les notifications du jeu, par palier ------------------------------------

     La recompense d'une quete ne depend que de son palier, tiree au hasard quand
     la quete est donnee : SOIT des orbes d'XP, SOIT des pieces sauvages. Les
     fourchettes viennent du code du mod (tools/build-quests.py -> js/quest-data.js,
     OW.QUEST_REWARDS). Le champ « reward » de l'export n'est pas lu par le mod. */

  const ORB_ICON = { I: 'assets/ui/exp/exp.png', II: 'assets/ui/exp/exp_2.png', III: 'assets/ui/exp/exp_3.png' };
  const range = (a, b) => (a === b ? String(a) : a + '–' + b);
  function odds(p) {
    if (!(p > 0)) return '';
    const n = Math.round(1 / p);
    return Math.abs(1 / n - p) < 0.01 ? '1 chance sur ' + n : Math.round(p * 100) + ' %';
  }

  function renderQuests() {
    const rules = (OW.QUEST_REWARDS && OW.QUEST_REWARDS.tiers) || {};
    const orbXp = OW.QUEST_REWARDS && OW.QUEST_REWARDS.orbXp;
    const tiers = ['I', 'II', 'III'].filter((t) => state.data.quests.some((q) => q.tier === t))
      .concat([...new Set(state.data.quests.map((q) => q.tier))].filter((t) => ['I', 'II', 'III'].indexOf(t) === -1));

    $('[data-quests]').innerHTML = tiers.map((tier) => {
      const quests = state.data.quests.filter((q) => q.tier === tier);
      const color = quests[0].color;
      const r = rules[tier];
      const orbs = r ? range(r.xpMin, r.xpMax) : '?';
      const coins = r && r.coinChance > 0 ? range(r.coinMin, r.coinMax) : null;
      const coinWord = r && r.coinMax > 1 ? 'pièces' : 'pièce';
      const head = r ? orbs + ' ORBES' + (coins ? ' OU ' + coins + ' ' + coinWord.toUpperCase() : '') : '';
      const orbIcon = ORB_ICON[tier] || ORB_ICON.I;
      return `
        <section class="quest-col" style="--q:${escapeHtml(color)};--q-ink:${contrastInk(color)}">
          <header class="quest-col-head">
            <span class="quest-tier">${escapeHtml(tier)}</span>
            <span class="stack" style="gap:2px">
              <span class="quest-col-title">Palier ${escapeHtml(tier)}</span>
              <span class="t-pixel">${quests.length} QUÊTE${quests.length > 1 ? 'S' : ''}${head ? ' · ' + escapeHtml(head) : ''}</span>
            </span>
          </header>
          ${quests.map((quest) => `
            <div class="toast" style="--i:${quests.indexOf(quest)}">
              <span class="toast-icon crisp" aria-hidden="true" style="${bg(orbIcon)}"></span>
              <span class="toast-text">
                <span class="toast-kicker">Quête quotidienne</span>
                <b>${escapeHtml(quest.name)}</b>
                <small>Objectif : ${quest.max}${quest.requiresLevelUp ? ' · demande de passer un niveau' : ''}</small>
              </span>
              <span class="toast-reward" title="${escapeHtml(r ? orbs + ' orbes d’expérience' + (orbXp ? ' (' + range(r.xpMin * orbXp, r.xpMax * orbXp) + ' XP)' : '') + (coins ? ', ou ' + coins + ' ' + coinWord + ' sauvage' + (r.coinMax > 1 ? 's' : '') + ' (' + odds(r.coinChance) + ')' : '') : '')}">
                <span class="crisp" aria-hidden="true" style="${bg(orbIcon)}"></span>${escapeHtml(orbs)}
                ${coins ? `<small class="toast-or">ou <span class="crisp" aria-hidden="true" style="${bg(coinSprite(0))}"></span>${escapeHtml(coins)}</small>` : ''}
              </span>
            </div>`).join('')}
        </section>`;
    }).join('');
  }

  /* ---- succes ----------------------------------------------------------------------

     Les succes du mode sont ceux de l'export (advancements). Chacun se
     debloque en apprivoisant une espece : la carte renvoie au chapitre
     « Apprivoisement » de sa fiche. Le visiteur coche ce qu'il a obtenu ;
     c'est garde dans son navigateur. */

  const ADV_KEY = 'ow-achievements';
  const advState = { filter: 'all' };

  function advDone() {
    try {
      const list = JSON.parse(window.localStorage.getItem(ADV_KEY) || '[]');
      return new Set(Array.isArray(list) ? list : []);
    } catch (e) { return new Set(); }
  }
  function advSave(set) {
    try { window.localStorage.setItem(ADV_KEY, JSON.stringify(Array.from(set))); } catch (e) { /* rien */ }
  }

  function renderAchievements() {
    const data = state.data;
    const done = advDone();
    const all = data.advancements.map((a) => ({ a, entity: data.entities.find((e) => e.slug === a.slug) || null }));
    const known = all.filter((x) => x.a.title);
    const mystery = all.filter((x) => !x.a.title);
    const got = known.filter((x) => done.has(x.a.id)).length;
    const pct = known.length ? Math.round(got / known.length * 100) : 0;

    /* Le compteur : une jauge en cases, comme celles du jeu. */
    const cells = 20;
    const lit = Math.round(pct / 100 * cells);
    $('[data-adv-summary]').innerHTML = `
      <span class="t-pixel">VOTRE PROGRESSION</span>
      <div class="adv-score">
        <b>${got}</b><small>/ ${known.length} succès</small>
      </div>
      <div class="adv-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Succès obtenus">
        ${Array.from({ length: cells }, (_, i) => `<i class="${i < lit ? 'is-on' : ''}" style="--k:${i}"></i>`).join('')}
      </div>
      <span class="adv-pct">${pct} %</span>
      ${mystery.length ? `<span class="t-small adv-soon">+ ${mystery.length} succès prévus pour des créatures à venir</span>` : ''}
      ${got ? '<button type="button" class="adv-reset" data-adv-reset>Tout décocher</button>' : ''}`;

    const filters = [['all', 'Tous', known.length], ['todo', 'À faire', known.length - got], ['done', 'Obtenus', got]];
    $('[data-adv-filters]').innerHTML = filters.map(([key, label, n]) => `
      <button type="button" class="btn btn-toggle" data-adv-filter="${key}" aria-pressed="${advState.filter === key}">${label}<span class="btn-count">${n}</span></button>`).join('');

    const shown = known.filter((x) => advState.filter === 'all' || (advState.filter === 'done') === done.has(x.a.id));

    const cards = shown.map((x, i) => {
      const e = x.entity;
      const on = done.has(x.a.id);
      const color = e ? (e.color || '#F2A32C') : '#8A817C';
      return `
        <article class="adv${on ? ' is-done' : ''}" style="--adv:${escapeHtml(color)};--i:${i}">
          <div class="adv-frame" aria-hidden="true">
            <span class="adv-icon crisp" style="${bg(e ? e.head : 'assets/ui/taming_exp.png')}"></span>
          </div>
          <div class="adv-body">
            <span class="adv-kicker">${on ? 'Succès obtenu !' : 'Succès'}</span>
            <h3 class="adv-title">${escapeHtml(x.a.title)}</h3>
            <p class="adv-desc">${escapeHtml(x.a.description)}</p>
            <div class="adv-foot">
              ${e ? `<a class="link-arrow" href="${animalHref(e.slug, 'taming')}">Guide d'apprivoisement</a>` : ''}
              <button type="button" class="adv-check" data-adv-toggle="${escapeHtml(x.a.id)}" aria-pressed="${on}">
                <span class="adv-box" aria-hidden="true"></span>${on ? 'Obtenu' : 'Marquer comme obtenu'}
              </button>
            </div>
          </div>
        </article>`;
    }).join('');

    const soon = advState.filter === 'all' ? mystery.map((x, i) => `
        <article class="adv is-mystery" style="--adv:#8A817C;--i:${shown.length + i}">
          <div class="adv-frame" aria-hidden="true"><span class="adv-q">?</span></div>
          <div class="adv-body">
            <span class="adv-kicker">Bientôt</span>
            <h3 class="adv-title">???</h3>
            <p class="adv-desc">Un succès déjà prévu dans le mod, pour une créature qui n'est pas encore sortie.</p>
          </div>
        </article>`).join('') : '';

    $('[data-adv-grid]').innerHTML = (cards + soon) || '<p class="empty-note">Rien ici pour le moment.</p>';
  }

  /* ---- tribus ------------------------------------------------------------------------

     Le JSON n'exporte pas encore les tribus. L'onglet garde leur place : il dit
     ce que le mod en montre deja, et ce qui s'affichera ici. */

  /* L'onglet des tribus vit dans js/tribes.js : il est assez gros pour lui
     seul, et il n'a besoin que des donnees du mod. */
  function renderTribes() {
    OW.renderTribes($('[data-tribes]'), state.data);
    decorateTribes();
  }

  /* Le sommaire des chapitres de la tribu : une colonne collante a gauche
     (css/tribes.css), qui allume le chapitre en cours de lecture. Un clic y
     mene. */
  let tribeSpy = null;
  function decorateTribes() {
    const host = $('[data-tribes]');
    const chapters = Array.from(host.querySelectorAll('.tb-chapter'));
    if (!chapters.length) return;
    const nav = document.createElement('nav');
    nav.className = 'tb-index';
    nav.setAttribute('aria-label', 'Chapitres de la tribu');
    nav.innerHTML = chapters.map((chapter, i) => {
      const id = chapter.id.replace(/^tb-/, '');
      const kicker = chapter.querySelector('.section-head .t-pixel');
      const title = chapter.querySelector('.section-head h2');
      return `
        <button type="button" class="tb-index-btn" data-tb-go="${id}" aria-pressed="${i === 0}">
          <b>${escapeHtml(kicker ? kicker.textContent : '')}</b><span>${escapeHtml(title ? title.textContent : id)}</span>
        </button>`;
    }).join('');
    chapters[0].before(nav);

    const light = (id) => nav.querySelectorAll('[data-tb-go]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.tbGo === id)));
    if (tribeSpy) tribeSpy.disconnect();
    if ('IntersectionObserver' in window) {
      tribeSpy = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { if (entry.isIntersecting) light(entry.target.id.replace(/^tb-/, '')); });
      }, { rootMargin: '-40% 0px -55% 0px' });
      chapters.forEach((chapter) => tribeSpy.observe(chapter));
    }
  }

  function goTribe(id) {
    $('[data-tribes]').querySelectorAll('[data-tb-go]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.tbGo === id)));
    OW.scrollToEl('#tb-' + id);
  }

  /* ---- amorcage -------------------------------------------------------------------- */

  mountHeader();

  loadWikiData()
    .then((data) => {
      state.data = data;
      computeModel();

      const params = new URLSearchParams(window.location.search);
      const requested = params.get('e');
      if (requested && data.entities.some((e) => e.slug === requested)) {
        state.trailSlug = requested;
        state.roster = [
          { slug: requested, level: 20, alloc: null },
          { slug: data.entities.find((e) => e.slug !== requested).slug, level: 20, alloc: null }
        ];
      }

      const hash = window.location.hash.replace('#', '');
      if (TABS.some((t) => t.key === hash)) state.tab = hash;

      renderTabs();
      showTab(state.tab);
      renderRoster();
      renderRunBar();
      renderModes();
      renderResults();
      renderTrailPicker();
      renderTrail();
      renderArchetypes();
      renderCurve();
      wireCurve();
      renderFormulas();
      document.addEventListener('click', (event) => {
        const pick = event.target.closest('[data-fx-pick]');
        if (pick) {
          state.formulaSlug = pick.dataset.fxPick;
          renderFormulas();
          return;
        }
        const open = event.target.closest('[data-fx-open]');
        if (open) { openFormula(Number(open.dataset.fxOpen)); return; }
        const go = event.target.closest('[data-tb-go]');
        if (go) goTribe(go.dataset.tbGo);
      });

      /* Le titre et la phrase d'en-tete gardent la hauteur du plus long :
         a remesurer quand la largeur ou la police changent. */
      let heroRaf = 0;
      const restabilise = () => { cancelAnimationFrame(heroRaf); heroRaf = requestAnimationFrame(stabiliseHero); };
      restabilise();
      window.addEventListener('resize', restabilise);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(restabilise);
      /* Un texte qui change de hauteur apres coup (typographie, traduction)
         recale la marge sur-le-champ. */
      if ('ResizeObserver' in window) {
        const ro = new ResizeObserver(() => fitHero());
        ro.observe($('[data-title]'));
        ro.observe($('[data-subtitle]'));
      }
      renderDpsRanking();
      renderQuests();
      renderAchievements();
      renderTribes();
      mountFooter(data, 'VERSION ' + data.meta.version + ' · SIMULATION LOCALE');

      /* Une ancre (depuis la recherche, un lien partage) change d'onglet. */
      window.addEventListener('hashchange', () => {
        const key = window.location.hash.replace('#', '');
        if ((key === '' || TABS.some((t) => t.key === key)) && (key || null) !== state.tab) showTab(key || null);
      });
      reveal();

      /* ---- evenements ------------------------------------------------------------ */

      document.addEventListener('click', (event) => {
        const tab = event.target.closest('[data-tab]');
        if (tab) { showTab(tab.dataset.tab); return; }


        const remove = event.target.closest('[data-remove]');
        if (remove) {
          if (state.roster.length <= 2) return;
          state.roster.splice(parseInt(remove.dataset.remove, 10), 1);
          renderRoster();
          renderResults();
          return;
        }

        const pick = event.target.closest('[data-pick]');
        if (pick) {
          const at = parseInt(pick.dataset.pick, 10);
          /* Deux fois la meme bete, jamais : la carte grisee ne repond pas. */
          if (state.roster.some((f, i) => i !== at && f.slug === pick.dataset.slug)) return;
          state.roster[at].slug = pick.dataset.slug;
          /* Une autre bete n'a ni les memes postes ni les memes plafonds. */
          state.roster[at].alloc = null;
          renderRoster();
          renderResults();
          return;
        }

        if (event.target.closest('[data-add-fighter]')) {
          if (state.roster.length >= 5) return;
          const used = state.roster.map((f) => f.slug);
          const next = data.entities.find((e) => used.indexOf(e.slug) === -1);
          if (!next) return;
          state.roster.push({ slug: next.slug, level: 20, alloc: null });
          renderRoster();
          renderResults();
          return;
        }

        if (event.target.closest('[data-reset-roster]')) {
          state.roster = [{ slug: 'tiger', level: 20, alloc: null }, { slug: 'crocodile', level: 20, alloc: null }];
          state.hasRun = false;
          state.focus = null;
          renderRoster();
          renderRunBar();
          renderModes();
          renderResults();
          return;
        }

        /* Le classement, la legende du profil et les tetes du bandeau
           ouvrent la fiche d'une bete ; hors de vue, la fiche remonte. */
        const show = event.target.closest('[data-show]');
        if (show) {
          showFocus(show.dataset.show);
          const card = $('[data-focus-card]');
          if (!show.closest('[data-focus-card]') && card.getBoundingClientRect().top > window.innerHeight - 160) {
            OW.scrollToEl('[data-focus-card]');
          }
          return;
        }

        const mode = event.target.closest('[data-mode]');
        if (mode) {
          state.mode = mode.dataset.mode;
          state.hasRun = true;
          previewed = null;
          renderModes();
          renderRunBar();
          renderResults();
          /* Cliquer un mode — meme celui deja actif — ramene au verdict. */
          requestAnimationFrame(() => OW.scrollToEl('[data-results]'));
          return;
        }

        const advToggle = event.target.closest('[data-adv-toggle]');
        if (advToggle) {
          const done = advDone();
          const id = advToggle.dataset.advToggle;
          if (done.has(id)) done.delete(id); else done.add(id);
          advSave(done);
          renderAchievements();
          if (done.has(id) && OW.toast) OW.toast('Succès obtenu !', true);
          return;
        }
        const advFilter = event.target.closest('[data-adv-filter]');
        if (advFilter) { advState.filter = advFilter.dataset.advFilter; renderAchievements(); return; }
        if (event.target.closest('[data-adv-reset]')) { advSave(new Set()); renderAchievements(); return; }

        const trail = event.target.closest('[data-trail]');
        if (trail) {
          state.trailSlug = trail.dataset.trail;
          renderTrailPicker();
          renderTrail();
          return;
        }
      });

      /* L'apercu des modes suit le pointeur et le clavier ; en sortant du
         bloc, il revient au mode en jeu. */
      const modesHost = $('[data-modes]');
      const followMode = (event) => {
        const over = event.target.closest && event.target.closest('[data-mode]');
        if (over) previewMode(over.dataset.mode);
      };
      modesHost.addEventListener('mouseover', followMode);
      modesHost.addEventListener('focusin', followMode);
      modesHost.addEventListener('mouseleave', () => previewMode(null));

      document.addEventListener('input', (event) => {
        const level = event.target.closest('[data-level]');
        if (level) {
          const index = parseInt(level.dataset.level, 10);
          state.roster[index].level = parseInt(level.value, 10);
          refreshPod(index);
          renderResults();
          return;
        }

        if (event.target.closest('[data-curve-slider]')) {
          state.curveLevel = parseInt(event.target.value, 10);
          renderCurve();
        }
      });

      /* Les fleches du clavier changent le mode, dans l'ordre de la liste. */
      window.addEventListener('keydown', (event) => {
        if (event.target.closest && event.target.closest('input, select, textarea')) return;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        if (state.tab !== 'combat' || !state.hasRun) return;
        const at = MODES.findIndex((m) => m.id === state.mode);
        const next = MODES[(at + (event.key === 'ArrowRight' ? 1 : -1) + MODES.length) % MODES.length];
        state.mode = next.id;
        previewed = null;
        renderModes();
        renderRunBar();
        renderResults();
      });
    })
    .catch((error) => {
      console.error(error);
      $('[data-subtitle]').textContent =
        "Les données du mod n'ont pas pu être chargées. Ce wiki doit être servi par un serveur HTTP — voir le README.";
    });
}(window.OW = window.OW || {}));
