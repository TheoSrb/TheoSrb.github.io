/* Creature dictionary: filterable, sortable grid of every published entity. */

(function (OW) {
  'use strict';

  /* Les cartes elles-memes viennent de js/creature-card.js : le bestiaire et
     l'accueil montrent exactement la meme. */
  const { loadWikiData, mountHeader, mountFooter, reveal, bg } = OW;

  /* Les betes annoncees : js/upcoming.js (genere par tools/publish-data.py),
     sans leur nom. */
  const upcomingOf = (data) => (OW.upcomingOf ? OW.upcomingOf(data) : []);

  const FILTERS = [
    { key: 'all', label: 'Toutes', test: () => true },
    { key: 'tame', label: 'Apprivoisables', test: (e) => e.traits.tameable && !e.boss },
    { key: 'wild', label: 'Sauvages', test: (e) => !e.traits.tameable && !e.boss },
    /* semi_aquatic counts as water: the crocodile hunts from it. */
    { key: 'water', label: 'Aquatiques', test: (e) => e.family === 'aquatic' || e.family === 'semi_aquatic' },
    /* Les favoris du visiteur (js/favorites.js) : toujours propose, meme vide,
       pour qu'on decouvre qu'il existe. */
    { key: 'fav', label: 'Favoris', icon: 'star', test: (e) => !!(OW.favorites && OW.favorites.has(e.slug)), always: true }
  ];

  /* L'ordre alphabetique d'abord : c'est celui qu'on cherche quand on connait
     le nom de la bete, et c'est le tri par defaut. */
  const SORTS = [
    { key: 'name', label: 'Tri A à Z', compare: (a, b) => a.name.localeCompare(b.name, 'fr') },
    { key: 'hp', label: 'Tri PV', compare: (a, b) => (b.stats.hp || 0) - (a.stats.hp || 0) },
    { key: 'damage', label: 'Tri dégâts', compare: (a, b) => (b.stats.damage || 0) - (a.stats.damage || 0) },
    /* La plus recente d'abord : sa date de sortie sur le wiki (releasedAt,
       lue par wiki-data.js), la meme que l'etoile « Nouveau ! ». Une bete
       sans date passe en dernier. */
    { key: 'recent', label: 'Tri récent', compare: (a, b) => (Date.parse(b.releasedAt) || 0) - (Date.parse(a.releasedAt) || 0) || a.name.localeCompare(b.name, 'fr') }
  ];

  const state = { filter: 'all', sort: 'name', data: null };

  /* ---- rendering ------------------------------------------------------------ */

  function renderGrid() {
    const filter = FILTERS.find((f) => f.key === state.filter) || FILTERS[0];
    const sort = SORTS.find((s) => s.key === state.sort) || SORTS[0];
    const rows = state.data.entities.filter(filter.test).slice().sort(sort.compare);

    const grid = document.querySelector('[data-grid]');
    const empty = document.querySelector('[data-empty]');

    grid.innerHTML = rows.map(OW.creatureCard).join('');
    empty.hidden = rows.length > 0;
    empty.textContent = state.filter === 'fav'
      ? "Aucun favori pour l'instant : l'étoile d'une carte l'ajoute à cette liste."
      : 'Aucune créature ne correspond à ce filtre.';
    OW.mountCreatureCards(grid);

    mountFooter(state.data, 'VERSION ' + state.data.meta.version + ' · '
      + rows.length + (rows.length > 1 ? ' FICHES AFFICHEES' : ' FICHE AFFICHEE'));

    reveal(grid);
  }

  function renderControls() {
    const filters = document.querySelector('[data-filters]');
    const sorts = document.querySelector('[data-sorts]');

    /* A filter nothing matches is dead UI — every published creature is tameable
       today, so "Sauvages" would only ever empty the grid. It comes back on its
       own the day the export ships a hostile species. */
    filters.innerHTML = FILTERS
      .map((f) => ({ filter: f, count: state.data.entities.filter(f.test).length }))
      .filter(({ filter, count }) => count > 0 || filter.key === 'all' || filter.always)
      .map(({ filter, count }) => `
        <button type="button" class="btn btn-toggle" data-filter="${filter.key}"
                aria-pressed="${state.filter === filter.key}">${filter.icon && OW.icon ? OW.icon(filter.icon) : ''}${filter.label}<span class="btn-count">${count}</span></button>`)
      .join('');

    sorts.innerHTML = SORTS.map((s) => `
      <button type="button" class="btn btn-toggle" data-sort="${s.key}"
              aria-pressed="${state.sort === s.key}">${s.label}</button>`).join('');
  }

  function syncPressed() {
    document.querySelectorAll('[data-filter]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter));
    });
    document.querySelectorAll('[data-sort]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort));
    });
  }

  function renderUpcoming(data) {
    document.querySelector('[data-upcoming]').innerHTML = upcomingOf(data).map((s) => `
      <div class="upcoming-tile" data-reveal role="img" aria-label="Créature mystère, bientôt">
        <span class="mystery" aria-hidden="true">
          <span class="mystery-light"></span>
          <span class="upcoming-head mystery-silhouette crisp" style="${bg(s.img)}"></span>
          <span class="mystery-mark">?</span>
        </span>
        <div class="t-sub" aria-hidden="true" style="font-size:22px;letter-spacing:.12em;color:var(--text-strong)">???</div>
        <div class="t-pixel mystery-tag" aria-hidden="true">BIENTÔT</div>
      </div>`).join('');
  }

  /* ---- boot ----------------------------------------------------------------- */

  mountHeader();

  loadWikiData()
    .then((data) => {
      state.data = data;

      const tameable = data.entities.filter((e) => e.traits.tameable && !e.boss).length;
      const rideable = data.entities.filter((e) => e.traits.rideable && !e.boss).length;
      document.querySelector('[data-intro]').textContent =
        `${data.entities.length} créatures implémentées, ${tameable} apprivoisables, ${rideable} montables. `
        + 'Chaque carte ouvre la fiche complète.';
      if (OW.heroSigns) {
        const skins = data.entities.reduce((sum, e) => sum + e.cosmetics.length, 0);
        OW.heroSigns(document.querySelector('[data-intro]'), [
          [data.entities.length, 'Créatures'], [tameable, 'Apprivoisables'], [skins, 'Skins']
        ]);
      }

      /* Filtre et tri vivent dans l'adresse : un retour depuis une fiche
         rouvre exactement la meme vue. */
      const params = new URLSearchParams(window.location.search);
      const requested = params.get('filter');
      if (requested && FILTERS.some((f) => f.key === requested)) state.filter = requested;
      const requestedSort = params.get('sort');
      if (requestedSort && SORTS.some((x) => x.key === requestedSort)) state.sort = requestedSort;

      renderControls();
      renderUpcoming(data);

      /* Une etoile cochee ou decochee : les compteurs suivent, et la grille
         aussi quand c'est elle qu'on regarde. */
      document.addEventListener('ow:favorites', () => {
        renderControls();
        if (state.filter === 'fav') renderGrid();
      });
      renderGrid();
      reveal();

      document.addEventListener('click', (event) => {
        const filterButton = event.target.closest('[data-filter]');
        const sortButton = event.target.closest('[data-sort]');
        if (!filterButton && !sortButton) return;

        if (filterButton) state.filter = filterButton.dataset.filter;
        if (sortButton) state.sort = sortButton.dataset.sort;

        syncPressed();
        renderGrid();
        const url = new URL(window.location.href);
        url.searchParams.set('filter', state.filter);
        url.searchParams.set('sort', state.sort);
        history.replaceState(history.state, '', url);
      });
    })
    .catch((error) => {
      console.error(error);
      document.querySelector('[data-grid]').innerHTML =
        '<p class="empty-note">Les données du mod n\'ont pas pu être chargées. '
        + 'Ce wiki doit être servi par un serveur HTTP — voir le README.</p>';
    });
}(window.OW = window.OW || {}));
