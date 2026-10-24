/* Le labo de la fiche creature.

   Une page d'essai, hors du site : aucun lien n'y mene, rien d'autre n'en
   depend. Chaque chapitre de la fiche y est redessine cinq fois, et des
   boutons passent de l'un a l'autre. Les versions lisent les vraies donnees
   du mod, sinon on choisirait sur un mensonge.

   Les versions elles-memes sont dans js/lab-hero.js, js/lab-stats.js et
   js/lab-abilities.js : ce fichier ne tient que la mecanique commune et les
   outils qu'elles partagent.

   OW.labVersions.<bloc>  -> la liste des versions du bloc
   OW.labUtil             -> les outils communs (chiffres, sprites, icones) */

(function (OW) {
  'use strict';

  const { loadWikiData, escapeHtml, mountHeader, mountFooter, num, bg, DASH } = OW;

  /* Les trois blocs du labo, dans l'ordre de la fiche. Les versions viennent
     s'y inscrire au chargement de leur fichier. */
  const VERSIONS = { hero: [], stats: [], abilities: [] };
  OW.labVersions = VERSIONS;

  const BLOCKS = [
    { id: 'hero', num: '00', title: 'En-tête', lead: "Le premier écran : le décor, la bête, son nom et ses constantes." },
    { id: 'stats', num: '01', title: 'Statistiques', lead: "Cinq relevés au sonar. La bête est seule sur son écran : ses valeurs se mesurent aux plafonds du bestiaire, jamais à une autre créature." },
    { id: 'abilities', num: '02', title: 'Capacités montées', lead: "Les cartes du HUD de monture. Les deux secondaires partagent un emplacement : on doit pouvoir passer de l'une à l'autre." }
  ];

  /* ---- outils communs aux versions ------------------------------------------ */

  /* Plafonds partages par tout le bestiaire : sans eux, chaque jauge se
     comparerait a elle-meme et ne dirait plus rien. */
  const REFERENCE = { hp: 120, damage: 20, walk: 6, mounted: 12, taming: 300, armor: 20 };

  function soloArt(slug) {
    const name = String(slug).split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return encodeURI('assets/entities/solo/' + name + ' [SOLO].png');
  }

  /* Le biome de chaque bete, comme sur les cartes du bestiaire. */
  const habitatOf = (x) => ((OW.entityBiomes && OW.entityBiomes(x)[0]) || 'jungle');

  /* Des icones dessinees, pas des images : elles prennent la couleur qu'on
     leur donne et restent nettes a n'importe quelle taille. Le trace est
     grossier a dessein — on reste dans la grille du jeu. */
  const ICONS = {
    heart: '<path d="M32 56 C14 42 6 33 6 23 A13 13 0 0 1 32 17 A13 13 0 0 1 58 23 C58 33 50 42 32 56 Z"/>',
    sword: '<path d="M48 8 L56 16 L28 44 L20 36 Z"/><path d="M20 36 L28 44 L18 54 L10 46 Z"/><path d="M8 48 L16 56"/>',
    boot: '<path d="M18 6 h12 v26 l16 10 v12 H18 Z"/><path d="M18 46 h28"/>',
    anvil: '<path d="M10 16 h44 v10 H42 l-4 10 h10 v10 H16 v-10 h10 l-4 -10 H10 Z"/>',
    saddle: '<path d="M12 24 q20 -14 40 0 v14 q-20 12 -40 0 Z"/><path d="M22 20 v-8 M42 20 v-8"/>',
    paw: '<circle cx="18" cy="20" r="7"/><circle cx="32" cy="14" r="7"/><circle cx="46" cy="20" r="7"/>'
      + '<path d="M32 26 q14 0 16 12 q2 12 -16 12 q-18 0 -16 -12 q2 -12 16 -12 Z"/>',
    star: '<path d="M32 4 L40 24 L61 24 L44 37 L51 58 L32 45 L13 58 L20 37 L3 24 L24 24 Z"/>',
    shield: '<path d="M32 4 L56 12 v20 q0 18 -24 28 Q8 50 8 32 V12 Z"/>',
    eye: '<path d="M4 32 Q32 8 60 32 Q32 56 4 32 Z"/><circle cx="32" cy="32" r="8"/>'
  };

  function icon(name, color, opts) {
    const o = opts || {};
    const body = ICONS[name] || ICONS.star;
    return '<svg class="lab-ico' + (o.className ? ' ' + o.className : '') + '" viewBox="0 0 64 64"'
      + ' aria-hidden="true" fill="' + (o.fill === false ? 'none' : escapeHtml(color)) + '"'
      + ' stroke="' + escapeHtml(color) + '" stroke-width="' + (o.stroke || 3) + '"'
      + ' stroke-linejoin="round" stroke-linecap="round">' + body + '</svg>';
  }

  /* Le modele de statistiques, partage par les cinq versions du bloc 01 :
     elles changent de forme, jamais de chiffres. Le rang se calcule sur tout
     le bestiaire — c'est lui qui donne son sens a une valeur brute. */
  function statModel(entity, data) {
    const beasts = data.entities;
    const taming = (entity.taming && entity.taming.experience) || entity.gameplay.tamingExperience || null;

    const defs = [
      { key: 'hp', label: 'Points de vie', short: 'PV', icon: 'heart', unit: '',
        value: entity.stats.hp, max: REFERENCE.hp,
        of: (e) => e.stats.hp,
        hint: "Ce que la bête encaisse avant de tomber." },
      { key: 'damage', label: 'Dégâts par combo', short: 'Combo', icon: 'sword', unit: '',
        value: entity.stats.damage, max: REFERENCE.damage,
        of: (e) => e.stats.damage,
        hint: "Le combo complet : trois coups enchaînés." },
      { key: 'hit', label: 'Dégâts par coup', short: 'Coup', icon: 'sword', unit: '',
        value: entity.stats.damage == null ? null : entity.stats.damage / 3, max: REFERENCE.damage / 3,
        of: (e) => (e.stats.damage == null ? null : e.stats.damage / 3),
        hint: "Un coup vaut le tiers du combo, pour toutes les créatures." },
      { key: 'walk', label: 'Vitesse au sol', short: 'Au sol', icon: 'boot', unit: ' b/s',
        value: entity.stats.walkBps, max: REFERENCE.walk,
        of: (e) => e.stats.walkBps,
        hint: "Sa vitesse libre, sans cavalier." },
      { key: 'mounted', label: 'Vitesse montée', short: 'Montée', icon: 'saddle', unit: ' b/s',
        value: entity.stats.mountedBps, max: REFERENCE.mounted,
        of: (e) => e.stats.mountedBps,
        hint: "Sa vitesse avec un cavalier sur le dos." },
      { key: 'knock', label: 'Résistance au recul', short: 'Recul', icon: 'anvil', unit: ' %',
        value: entity.stats.knockbackRes == null ? null : entity.stats.knockbackRes * 100, max: 100,
        of: (e) => (e.stats.knockbackRes == null ? null : e.stats.knockbackRes * 100),
        hint: "À 100 %, rien ne la fait reculer." },
      { key: 'armor', label: 'Armure', short: 'Armure', icon: 'shield', unit: '',
        value: entity.stats.armor, max: REFERENCE.armor,
        of: (e) => e.stats.armor,
        hint: "Chaque point retire une part des dégâts reçus." },
      { key: 'taming', label: "Expérience d'apprivoisement", short: 'Appriv.', icon: 'paw', unit: ' XP',
        value: taming, max: REFERENCE.taming,
        of: (e) => (e.taming && e.taming.experience) || e.gameplay.tamingExperience || null,
        hint: "Le total à remplir pour que la bête devienne une compagne.", sprite: 'assets/ui/taming_exp.png' }
    ];

    return defs.map((d) => {
      const all = beasts.map(d.of).filter((v) => v != null);
      const sorted = all.slice().sort((a, b) => b - a);
      const best = sorted[0] || 0;
      const avg = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
      const rank = d.value == null ? null : sorted.findIndex((v) => v <= d.value) + 1;
      return Object.assign({}, d, {
        best, avg, rank, count: all.length,
        part: d.value == null ? 0 : Math.max(0, Math.min(1, d.value / d.max)),
        vsBest: d.value == null || !best ? 0 : Math.max(0, Math.min(1, d.value / best)),
        text: d.value == null ? DASH : num(d.value) + d.unit
      });
    });
  }

  /* Les cartes de capacite, rangees comme dans le jeu : le combo, l'unique
     emplacement secondaire (avec ses deux cartes interchangeables), l'ultime.
     Les passifs sortent a part — ils ne s'equipent pas. */
  function abilityModel(entity) {
    const cards = entity.cards.slice().sort((a, b) => a.order - b.order);
    const passives = cards.filter((c) => c.passive);
    const attacks = cards.filter((c) => !c.passive);

    const slots = [];
    attacks.forEach((card) => {
      const secondary = card.role === 'secondary' || card.role === 'secondary-alt';
      const open = secondary ? slots.find((s) => s.kind === 'secondary') : null;
      if (open) { open.cards.push(card); return; }
      slots.push({
        kind: secondary ? 'secondary' : (card.role || 'combo'),
        cards: [card]
      });
    });

    return { slots, passives, attacks };
  }

  const ROLE_LABEL = {
    combo: 'Combo', secondary: 'Secondaire', 'secondary-alt': 'Secondaire bis', ultimate: 'Ultime'
  };
  const SLOT_LABEL = { combo: 'Combo', secondary: 'Secondaire', ultimate: 'Ultime' };
  const ATTACK_FILE = {
    combo: 'attack_0', secondary: 'attack_1', 'secondary-alt': 'attack_1_2', ultimate: 'attack_2'
  };

  /* La planche d'une attaque. Le chemin conventionnel est toujours ecrit : si
     le fichier manque, resolveImages() retire l'element et le cadre reste
     vide plutot que casse. */
  function attackArt(entity, card) {
    const file = ATTACK_FILE[card.role];
    if (!file) return '';
    return '<span class="lab-atk-art crisp" aria-hidden="true" '
      + OW.imgAttr(['assets/pages/' + entity.slug + '/' + file + '.png'], { mode: 'bg', empty: 'hide' })
      + '></span>';
  }

  const UTIL = {
    REFERENCE, ICONS, icon, soloArt, habitatOf, statModel, abilityModel,
    ROLE_LABEL, SLOT_LABEL, attackArt,
    /* Le meme nettoyage que sur la fiche : les constantes de reglage se
       replient, seules les principales restent visibles. */
    splitConstants: (card) => ({
      primary: card.constants.filter((c) => c.primary),
      rest: card.constants.filter((c) => !c.primary)
    })
  };
  OW.labUtil = UTIL;

  /* ---- la mecanique du labo --------------------------------------------------- */

  const state = { data: null, entity: null, accent: '#F2A32C', ink: '#F2A32C', chosen: {} };

  function context() {
    return { entity: state.entity, data: state.data, accent: state.accent, ink: state.ink, util: UTIL };
  }

  /* On garde le choix d'une visite a l'autre : comparer cinq versions demande
     plusieurs allers-retours, et repartir de la premiere a chaque fois serait
     penible. */
  function remember() {
    try { localStorage.setItem('ow-lab', JSON.stringify(state.chosen)); } catch (e) { /* prive */ }
  }
  function recall() {
    try { return JSON.parse(localStorage.getItem('ow-lab') || '{}') || {}; } catch (e) { return {}; }
  }

  function renderPicker() {
    const host = document.querySelector('[data-entity-pick]');
    host.innerHTML = state.data.entities.map((e) => `
      <button type="button" class="lab-beast${e.slug === state.entity.slug ? ' is-on' : ''}"
              data-beast="${escapeHtml(e.slug)}" style="--beast:${escapeHtml(e.color || '#F2A32C')}">
        <span class="crisp" aria-hidden="true" style="${bg(e.head)}"></span>
        <span>${escapeHtml(e.name)}</span>
      </button>`).join('');

    host.querySelectorAll('[data-beast]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = state.data.entities.find((e) => e.slug === btn.dataset.beast);
        if (!next || next === state.entity) return;
        setEntity(next);
        renderPicker();
        BLOCKS.forEach((b) => paint(b.id));
      });
    });
  }

  function renderBlocks() {
    /* Les versions deja retenues passent en tete de leur rangee : c'est celle
       qu'on rouvre le plus souvent, elle ne doit pas se chercher. */
    Object.keys(VERSIONS).forEach((key) => {
      VERSIONS[key].sort((a, b) => (b.keep ? 1 : 0) - (a.keep ? 1 : 0));
    });

    const host = document.querySelector('[data-blocks]');
    host.innerHTML = BLOCKS.map((block) => {
      const list = VERSIONS[block.id] || [];
      return `
        <section class="lab-block" id="lab-${escapeHtml(block.id)}" data-block="${escapeHtml(block.id)}">
          <header class="lab-block-head">
            <span class="lab-block-num">${escapeHtml(block.num)}</span>
            <div class="lab-block-text">
              <h2>${escapeHtml(block.title)}</h2>
              <p>${escapeHtml(block.lead)}</p>
            </div>
          </header>
          <div class="lab-tabs" role="tablist" data-tabs="${escapeHtml(block.id)}">
            ${list.map((v, i) => `
              <button type="button" class="lab-tab${v.keep ? ' is-keep' : ''}" role="tab"
                      data-version="${escapeHtml(v.id)}">
                <b>${v.keep ? 'Retenu' : 'V' + (i + 1)}</b>
                <span>${escapeHtml(v.name)}</span>
              </button>`).join('')}
          </div>
          <p class="lab-note" data-note="${escapeHtml(block.id)}"></p>
          <div class="lab-stage" data-stage="${escapeHtml(block.id)}"></div>
        </section>`;
    }).join('');

    host.querySelectorAll('[data-tabs]').forEach((bar) => {
      bar.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-version]');
        if (!btn) return;
        state.chosen[bar.dataset.tabs] = btn.dataset.version;
        remember();
        paint(bar.dataset.tabs);
      });
    });
  }

  /* Dessine la version choisie d'un bloc. Chaque version rend son HTML, puis
     branche ce qui bouge dans mount() — les ecouteurs meurent avec le HTML
     qu'ils tenaient, il n'y a donc rien a nettoyer. */
  function paint(blockId) {
    const list = VERSIONS[blockId] || [];
    if (!list.length) return;
    const stage = document.querySelector('[data-stage="' + blockId + '"]');
    const bar = document.querySelector('[data-tabs="' + blockId + '"]');
    const note = document.querySelector('[data-note="' + blockId + '"]');

    let version = list.find((v) => v.id === state.chosen[blockId]);
    if (!version) { version = list[0]; state.chosen[blockId] = version.id; }

    bar.querySelectorAll('[data-version]').forEach((btn) => {
      const on = btn.dataset.version === version.id;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    note.textContent = version.note || '';

    const ctx = context();
    stage.className = 'lab-stage lab-v-' + version.id;
    stage.style.setProperty('--accent', state.accent);
    stage.style.setProperty('--ink', state.ink);
    stage.innerHTML = version.render(ctx);
    if (OW.resolveImages) OW.resolveImages(stage);
    if (version.mount) version.mount(stage, ctx);
    if (OW.reveal) OW.reveal(stage);
  }

  function setEntity(entity) {
    state.entity = entity;
    const accent = entity.boss ? '#B84A38' : (entity.color || '#F2A32C');
    state.accent = accent;
    state.ink = OW.tintFor && /^#[0-9a-f]{6}$/i.test(accent) ? OW.tintFor(accent).onDark : accent;
    document.body.style.setProperty('--lab-accent', accent);
    document.body.style.setProperty('--lab-ink', state.ink);
  }

  loadWikiData()
    .then((data) => {
      mountHeader();
      mountFooter(data);

      state.data = data;
      state.chosen = recall();

      const wanted = new URLSearchParams(location.search).get('e');
      setEntity(data.entities.find((e) => e.slug === wanted) || data.entities[0]);

      renderPicker();
      renderBlocks();
      BLOCKS.forEach((b) => paint(b.id));
    })
    .catch((error) => {
      console.error(error);
      const host = document.querySelector('[data-blocks]');
      if (host) host.innerHTML = '<p class="empty-note">Les données du wiki n\'ont pas pu être chargées.</p>';
    });
}(window.OW = window.OW || {}));
