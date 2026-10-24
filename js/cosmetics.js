/* Les cosmetiques : une vitrine.

   A gauche, la scene : le skin choisi tourne en 3D sur son socle, eclaire de la
   couleur de sa rarete, avec sa fiche dessous (prix, obtention, modele). A
   droite, la garde-robe : une tringle par creature, ou pendent ses skins. Un
   clic sur un cintre l'envoie sur la scene ; les fleches (ou le clavier) font
   defiler les skins dans l'ordre de la garde-robe.

   Lien direct : cosmetics.html?skin=tiger_gold met ce skin sur la scene. */

(function (OW) {
  'use strict';

  const { loadWikiData, escapeHtml, mountHeader, mountFooter, reveal, SKINS, RARITY, RARITY_ORDER, skinById, loadThree, createViewer, animalHref, coinSprite, contrastInk, bg } = OW;

  const state = { data: null, rarity: 'all', current: null, viewer: null, spin: true, order: [] };

  const $ = (selector) => document.querySelector(selector);

  function entityOf(slug) {
    return state.data.entities.find((e) => e.slug === slug) || null;
  }
  function entityName(slug) {
    const entity = entityOf(slug);
    return entity ? entity.name : slug;
  }
  function entityHead(slug) {
    const entity = entityOf(slug);
    return entity ? entity.head : 'assets/ui/skins.png';
  }

  /* Le mot court sous un skin (prix, niveau, quete...) : js/skins.js. */
  const unlockLabel = (skin) => OW.skinUnlockLabel(skin);

  const byRarity = (a, b) => (RARITY[b.rarity].order - RARITY[a.rarity].order) || a.name.localeCompare(b.name, 'fr');

  /* ---- les panneaux de l'en-tete ------------------------------------------------ */

  function renderCounters() {
    const counts = {};
    RARITY_ORDER.forEach((key) => { counts[key] = SKINS.filter((s) => s.rarity === key).length; });

    const entries = [{ key: 'SKINS', value: SKINS.length, color: 'var(--text-strong)' }]
      .concat(RARITY_ORDER.map((key) => ({
        key: RARITY[key].label.toUpperCase(), value: counts[key], color: RARITY[key].color
      })));

    $('[data-counters]').innerHTML = entries.map((entry) => `
      <div class="counter" style="--counter-color:${entry.color};border-bottom:3px solid ${entry.color}">
        <div class="value">${entry.value}</div>
        <div class="key">${escapeHtml(entry.key)}</div>
      </div>`).join('');
  }

  function renderFilters() {
    const counts = { all: SKINS.length };
    RARITY_ORDER.forEach((key) => { counts[key] = SKINS.filter((s) => s.rarity === key).length; });

    $('[data-rarity-filters]').innerHTML = [{ key: 'all', label: 'Toutes' }]
      .concat(RARITY_ORDER.map((key) => ({ key, label: RARITY[key].label })))
      .filter((f) => f.key === 'all' || counts[f.key] > 0)
      .map((f) => `
        <button type="button" class="btn btn-toggle" data-rarity="${f.key}" aria-pressed="${state.rarity === f.key}">
          ${f.key === 'all' ? '' : `<span class="gem" style="--gem:${RARITY[f.key].color};--gem-glow:${RARITY[f.key].glow}"></span>`}
          ${f.label}<span class="btn-count">${counts[f.key]}</span>
        </button>`).join('');
  }

  /* ---- la garde-robe ------------------------------------------------------------ */

  /* Un cintre : le rendu du skin, sa rarete en bas, son prix ou son obtention.
     Il pend a la tringle par son crochet et se balance quand la souris passe. */
  function hangerHtml(skin) {
    const rarity = RARITY[skin.rarity];
    return `
      <button type="button" class="hanger${skin.rarity === 'legendary' ? ' is-legendary' : ''}" data-skin="${escapeHtml(skin.id)}"
              data-rarity-key="${skin.rarity}" aria-label="${escapeHtml(skin.name)}"
              style="--rarity-color:${rarity.color};--rarity-glow:${rarity.glow}">
        <span class="hanger-hook" aria-hidden="true"></span>
        <span class="hanger-card">
          <span class="hanger-figure">
            <span class="hanger-img crisp" aria-hidden="true" ${OW.imgAttr(OW.skinImages(skin), { mode: 'bg' })}></span>
            ${skin.rarity === 'legendary' ? '<span class="skin-shine" aria-hidden="true"></span>' : ''}
            ${skin.model ? '<span class="hanger-3d t-pixel">3D</span>' : ''}
          </span>
          <span class="hanger-name">${escapeHtml(skin.name)}</span>
          <span class="hanger-foot">
            ${skin.price
              ? `<span class="hanger-price"><span class="crisp" aria-hidden="true" style="${bg(coinSprite(skin.price))}"></span>${skin.price}</span>`
              : `<span class="hanger-unlock">${escapeHtml(unlockLabel(skin))}</span>`}
          </span>
        </span>
      </button>`;
  }

  /* Seules les creatures qui ont des skins livres ont une tringle : celles a
     venir, ou sans skin, ne s'affichent pas. */
  function renderWardrobe() {
    const entities = state.data.entities
      .map((entity) => ({ entity, mine: SKINS.filter((s) => s.entity === entity.slug).sort(byRarity) }))
      .filter((row) => row.mine.length)
      .sort((a, b) => b.mine.length - a.mine.length);

    state.order = [];
    $('[data-wardrobe]').innerHTML = entities.map(({ entity, mine }) => {
      const color = entity.color || 'var(--accent)';
      mine.forEach((s) => state.order.push(s.id));

      return `
        <article class="ward-row" data-reveal data-ward="${escapeHtml(entity.slug)}" style="--accent-line:${escapeHtml(color)}">
          <header class="ward-head">
            <span class="ward-head-img crisp" aria-hidden="true" style="${bg(entity.head)}"></span>
            <a class="ward-name" href="${animalHref(entity.slug)}">${escapeHtml(entity.name)}</a>
            <span class="ward-count"><b>${mine.length}</b> skin${mine.length > 1 ? 's' : ''}</span>
          </header>
          <div class="ward-rack">${mine.map(hangerHtml).join('')}</div>
        </article>`;
    }).join('');

    /* Une seule boucle pour tous les cintres de la page. */
    if (OW.swing) OW.swing($('[data-wardrobe]'), '.hanger');
    applyFilter();
  }

  /* Le filtre ne reconstruit rien (les cintres gardent leur balancement) : il
     masque les skins d'une autre rarete, et les tringles qui se vident. */
  function applyFilter() {
    let shown = 0;
    document.querySelectorAll('[data-ward]').forEach((row) => {
      let visible = 0;
      row.querySelectorAll('.hanger').forEach((h) => {
        const match = state.rarity === 'all' || h.dataset.rarityKey === state.rarity;
        h.hidden = !match;
        if (match) visible += 1;
        if (match) shown += 1;
      });
      row.hidden = state.rarity !== 'all' && visible === 0;
    });

    $('[data-gallery-note]').textContent =
      `${shown} skin${shown > 1 ? 's' : ''} affiché${shown > 1 ? 's' : ''} sur ${SKINS.length}.`;
  }

  /* ---- la scene ----------------------------------------------------------------- */

  function visibleOrder() {
    return state.order.filter((id) => state.rarity === 'all' || skinById(id).rarity === state.rarity);
  }

  function select(id, opts) {
    const skin = skinById(id);
    if (!skin || skin === state.current) return;
    state.current = skin;

    const rarity = RARITY[skin.rarity];
    const stage = $('[data-stage]');
    stage.style.setProperty('--rarity-color', rarity.color);
    stage.style.setProperty('--rarity-glow', rarity.glow);
    stage.classList.toggle('is-legendary', skin.rarity === 'legendary');
    stage.classList.remove('is-swapping');
    void stage.offsetWidth;
    stage.classList.add('is-swapping');

    document.querySelectorAll('.hanger[data-skin]').forEach((h) => {
      h.classList.toggle('is-current', h.dataset.skin === skin.id);
      h.setAttribute('aria-pressed', String(h.dataset.skin === skin.id));
    });

    const badge = $('[data-skin-rarity]');
    badge.textContent = rarity.label;
    badge.style.setProperty('--tier-color', rarity.color);
    badge.style.setProperty('--chip-ink', contrastInk(rarity.color));

    $('[data-skin-id]').textContent = 'ow:' + skin.id;
    $('[data-skin-name]').textContent = skin.name;
    $('[data-skin-lore]').textContent = skin.lore;
    $('[data-skin-link]').href = animalHref(skin.entity);

    const order = state.order;
    $('[data-stage-index]').textContent = (order.indexOf(skin.id) + 1) + ' / ' + order.length;

    $('[data-skin-rows]').innerHTML = [
      ['CRÉATURE', entityName(skin.entity), 'var(--text-bright)', entityHead(skin.entity)],
      ['PRIX', skin.price ? skin.price + ' pièces sauvages' : '—',
        skin.price ? 'var(--accent)' : 'var(--text-faint)', skin.price ? coinSprite(skin.price) : null],
      ['OBTENTION', skin.unlock, 'var(--text-body)', null],
      ['MODÈLE', skin.model
        ? (window.location.protocol === 'file:' ? '3D (via serveur)' : '3D interactif')
        : 'Aperçu 2D',
        skin.model ? 'var(--moss)' : 'var(--text-faint)', null]
    ].map(([key, value, color, icon]) => `
      <div class="stage-row" data-row="${key}">
        <span class="t-pixel">${key}</span>
        <span class="stage-row-value" style="color:${color}">
          ${icon ? `<span class="crisp" aria-hidden="true" style="${bg(icon)}"></span>` : ''}
          ${escapeHtml(value)}
        </span>
      </div>`).join('');

    if (!(opts && opts.keepUrl)) {
      const url = new URL(window.location.href);
      url.searchParams.set('skin', skin.id);
      history.replaceState(null, '', url);
    }

    showModel(skin);
  }

  /* Un modele trouve apres coup : la pastille « 3D » de son cintre, et la
     ligne MODELE de la scene s'il y est. */
  function markModel(skin) {
    const figure = document.querySelector('.hanger[data-skin="' + CSS.escape(skin.id) + '"] .hanger-figure');
    if (figure && !figure.querySelector('.hanger-3d')) figure.insertAdjacentHTML('beforeend', '<span class="hanger-3d t-pixel">3D</span>');
    const row = state.current === skin && document.querySelector('[data-skin-rows] [data-row="MODÈLE"] .stage-row-value');
    if (row) {
      row.textContent = window.location.protocol === 'file:' ? '3D (via serveur)' : '3D interactif';
      row.style.color = 'var(--moss)';
    }
  }

  function showModel(skin) {
    if (state.viewer) { state.viewer.dispose(); state.viewer = null; }

    const canvas = $('[data-canvas]');
    const status = $('[data-viewer-status]');
    const fallback = $('[data-viewer-fallback]');
    const spinButton = $('[data-spin-toggle]');
    const note = $('[data-viewer-note]');

    fallback.style.backgroundImage = `url('${OW.asset(skin.image)}')`;
    /* Un skin sans fiche : son rendu depose (voir js/skins.js) remplace celui
       de la bete des qu'il est trouve, si le skin est toujours a l'affiche. */
    if (skin.images && OW.firstImage) {
      OW.firstImage(skin.images).then((url) => {
        if (url && state.current === skin) fallback.style.backgroundImage = `url('${url.replace(/'/g, '%27')}')`;
      });
    }

    /* Ouvert depuis le disque, le chargeur glTF est bloque par le navigateur :
       on montre le rendu 2D plutot qu'un chargement sans fin. Servir le dossier
       en HTTP, ou le mettre en ligne, rend la 3D. */
    const offline = window.location.protocol === 'file:';

    if (!skin.model || offline) {
      canvas.hidden = true;
      status.hidden = true;
      fallback.hidden = false;
      spinButton.hidden = true;
      note.hidden = !(offline && skin.model);
      note.textContent = 'MODÈLE 3D : OUVRIR VIA UN SERVEUR OU EN LIGNE';
      if (!skin.model) {
        note.hidden = false;
        note.textContent = 'APERÇU 2D · MODÈLE 3D NON EXPORTÉ';
        /* Un modele depose au nom du skin (js/skins.js, skinModel) : trouve,
           la scene passe en 3D sans qu'on ait a le declarer. */
        if (OW.skinModel && !offline) {
          OW.skinModel(skin).then((url) => {
            if (!url || state.current !== skin) return;
            markModel(skin);
            showModel(skin);
          });
        }
      }
      return;
    }

    note.hidden = true;
    canvas.hidden = false;
    fallback.hidden = true;
    status.hidden = false;
    status.textContent = 'CHARGEMENT DU MODÈLE…';
    spinButton.hidden = false;

    loadThree()
      .then((THREE) => {
        if (state.current !== skin) return null;
        state.viewer = createViewer(canvas, THREE);
        state.viewer.setSpin(state.spin);
        return state.viewer.load(skin.model);
      })
      .then(() => {
        if (state.current !== skin) return;
        status.hidden = true;
        if (skin.textures) state.viewer.cycleTextures(skin.textures, skin.textureEvery);
      })
      .catch((error) => {
        console.error(error);
        if (state.current !== skin) return;
        /* CDN bloque ou modele illisible : le rendu 2D raconte la meme chose. */
        canvas.hidden = true;
        status.hidden = true;
        spinButton.hidden = true;
        fallback.hidden = false;
      });
  }

  function step(delta) {
    const order = visibleOrder();
    if (!order.length) return;
    const at = order.indexOf(state.current && state.current.id);
    const next = order[(at + delta + order.length) % order.length];
    select(next);
  }

  /* Sur un petit ecran, la scene n'est pas collee : on y remonte. */
  function bringStageIntoView() {
    const stage = $('[data-stage]');
    if (getComputedStyle(stage).position === 'sticky') return;
    const r = stage.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight * .4) OW.scrollToEl(stage);
  }

  /* ---- amorcage ------------------------------------------------------------------ */

  mountHeader();

  loadWikiData()
    .then((data) => {
      if (OW.syncSkins) OW.syncSkins(data);
      state.data = data;

      $('[data-intro]').textContent =
        `${SKINS.length} skins de monture livrés, ${RARITY_ORDER.length} raretés. `
        + 'Chaque skin de la garde-robe s’affiche en trois dimensions sur la scène.';

      renderCounters();
      renderFilters();
      renderWardrobe();
      /* Les modeles 3D deposes sans fiche au catalogue se cherchent a leur
         nom (assets/skins/<skin>.gltf) : chacun trouve pose sa pastille. */
      if (OW.skinModel) SKINS.filter((s) => !s.model).forEach((s) => OW.skinModel(s).then((url) => { if (url) markModel(s); }));
      mountFooter(data, SKINS.length + ' SKINS · MONNAIE : PIECES SAUVAGES');
      reveal();

      /* Lien direct depuis une fiche de creature : cosmetics.html?skin=tiger_gold */
      const requested = new URLSearchParams(window.location.search).get('skin');
      if (requested && skinById(requested)) {
        select(requested, { keepUrl: true });
        requestAnimationFrame(() => OW.scrollToEl('#vitrine', 'auto'));
      } else {
        select(state.order[0], { keepUrl: true });
      }

      document.addEventListener('click', (event) => {
        const rarity = event.target.closest('[data-rarity]');
        if (rarity) {
          state.rarity = rarity.dataset.rarity;
          document.querySelectorAll('[data-rarity]').forEach((b) => {
            b.setAttribute('aria-pressed', String(b.dataset.rarity === state.rarity));
          });
          applyFilter();
          const order = visibleOrder();
          if (order.length && order.indexOf(state.current.id) === -1) select(order[0]);
          return;
        }

        const hanger = event.target.closest('[data-skin]');
        if (hanger) { select(hanger.dataset.skin); bringStageIntoView(); return; }

        const stepButton = event.target.closest('[data-step]');
        if (stepButton) { step(Number(stepButton.dataset.step)); return; }

        if (event.target.closest('[data-spin-toggle]')) {
          state.spin = !state.spin;
          if (state.viewer) state.viewer.setSpin(state.spin);
          $('[data-spin-toggle]').textContent = state.spin ? 'ROTATION ON' : 'ROTATION OFF';
        }
      });

      /* Les fleches du clavier font defiler la garde-robe, sauf dans un champ. */
      window.addEventListener('keydown', (event) => {
        if (event.target.closest && event.target.closest('input, textarea, select, [contenteditable]')) return;
        if (event.key === 'ArrowRight') step(1);
        else if (event.key === 'ArrowLeft') step(-1);
      });
    })
    .catch((error) => {
      console.error(error);
      $('[data-wardrobe]').innerHTML =
        '<p class="empty-note">Les données du mod n\'ont pas pu être chargées. '
        + 'Ce wiki doit être servi par un serveur HTTP — voir le README.</p>';
    });
}(window.OW = window.OW || {}));
