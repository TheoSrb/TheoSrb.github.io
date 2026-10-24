/* La carte d'une creature : le vitrail de biome.

   Une seule carte pour tout le site — le bestiaire (creatures.html) et le tri
   de l'accueil. La bete se tient dans son biome, vivant, dessine par
   biome-world.js ; son rendu solo flotte au-dessus ; ses chiffres sont sur une
   plaque de verre en bas.

   Les scenes sont montees quand la carte approche de l'ecran : neuf scenes
   animees d'un coup au chargement, ce serait cher pour rien.

   Toutes les cinq secondes, la carte passe du rendu solo a la tete de la bete,
   en grand, puis revient. Les cartes ne basculent pas ensemble (chacune a son
   decalage) et la bascule s'arrete sous le curseur : sinon l'image change au
   moment ou on la regarde.

   OW.creatureCard(entity)        -> le HTML d'une carte
   OW.mysteryCard(upcoming)       -> la carte d'une bete a venir (silhouette)
   OW.mountCreatureCards(root)    -> monte les scenes et charge les rendus */

(function (OW) {
  'use strict';

  const { escapeHtml, animalHref, archetypeIcon, num, bg } = OW;

  const FAMILY_LABEL = {
    terrestrial: 'Terrestre', aquatic: 'Aquatique', semi_aquatic: 'Semi-aquatique',
    aerial: 'Aérien', boss: 'Boss'
  };

  /* Le biome d'une bete : le premier de ses biomes de fond (js/biome-config.js). */
  const habitatOf = (x) => ((OW.entityBiomes && OW.entityBiomes(x)[0]) || 'jungle');

  /* ---- le rendu solo, charge a la demande ------------------------------------ */

  const solos = {};

  /* La carte prend la vignette du rendu (1280 x 720, js/site.js) : l'original
     en 2560 pesait une quinzaine de Mo en memoire vive par bete, pour une
     carte de 300 pixels. On ne la demande qu'une fois, l'image habituelle de
     la bete tient la place en attendant, et une carte partie loin sous l'ecran
     la rend (voir releaseSolo). */
  function loadSolo(slug) {
    if (solos[slug] !== undefined) { dressSolo(slug); return; }
    solos[slug] = null;
    OW.loadSoloVignette(slug).then((url) => {
      solos[slug] = url || false;
      dressSolo(slug);
    });
  }

  /** Pose le rendu sur les cartes de cette espece qui l'attendent. */
  function dressSolo(slug) {
    if (!solos[slug]) return;
    document.querySelectorAll('[data-cc-solo="' + slug + '"]').forEach((el) => {
      if (el.dataset.ccAsleep) return;
      el.style.backgroundImage = 'url("' + solos[slug] + '")';
      el.classList.add('is-solo');
    });
  }

  /**
   * Une carte partie tres loin rend son rendu solo.
   *
   * Un navigateur garde en memoire l'image decodee de chaque fond affiche :
   * 1280 x 720 pixels pour une vignette, pres de 4 Mo par bete. Toute une
   * grille ouverte en meme temps sur un telephone, et l'onglet finit par
   * manquer de place. Reposer la vignette de depart rend cette
   * memoire ; le fichier, lui, reste dans le cache du navigateur, donc le
   * retour ne coute aucun telechargement.
   *
   * La marge est large et l'attente longue a dessein : on ne rend que ce qui
   * est parti pour de bon, jamais ce qu'on vient de depasser.
   */
  function releaseSolo(el) {
    if (!el || !el.classList.contains('is-solo')) return;
    const rest = el.dataset.ccRest;
    if (!rest) return;
    el.dataset.ccAsleep = '1';
    el.style.backgroundImage = 'url("' + rest + '")';
    el.classList.remove('is-solo');
  }

  function restoreSolo(el) {
    if (!el || !el.dataset.ccAsleep) return;
    delete el.dataset.ccAsleep;
    dressSolo(el.dataset.ccSolo);
  }

  /* ---- le recentrage ---------------------------------------------------------

     Un rendu solo est un plan 16/9 qui remplit exactement sa case : le
     `background-position` n'a donc aucune prise dessus, les deux rectangles se
     superposent. C'est la case elle-meme qu'on decale, de la distance qui
     separe la bete du milieu de son image (js/site.js, contentCentre).

     Le decalage part en --ox, en fraction de la largeur de la case ; le CSS
     s'en sert dans le `left` de l'image. Zero quand la bete est deja centree,
     ou quand la mesure echoue : sans variable, la carte ne bouge pas. */

  function frameOffset(img, url) {
    const centre = OW.contentCentre ? OW.contentCentre(img, url) : null;
    if (centre == null) return '0';
    /* Au-dela d'un quart de case, ce n'est plus un cadrage un peu de travers :
       c'est une image composee autrement, qu'on laisse telle quelle. */
    const shift = Math.max(-0.25, Math.min(0.25, 0.5 - centre));
    return shift.toFixed(4);
  }

  const artOf = (entity) => solos[entity.slug] || entity.art || entity.head;

  /* ---- la carte -------------------------------------------------------------- */

  function statsOf(entity) {
    const speed = entity.stats.mountedBps || entity.stats.walkBps;
    return [
      ['PV', entity.stats.hp != null ? Math.round(entity.stats.hp) : null, ''],
      /* Une bete qui ne se bat pas (le panda roux) : un tiret, pas « 0 dégâts ». */
      ['DÉGÂTS', entity.stats.damage ? num(entity.stats.damage) : (entity.stats.damage === 0 ? OW.DASH : null), ''],
      ['VITESSE', speed ? num(speed) : null, ' b/s']
    ];
  }

  function creatureCard(entity) {
    const color = entity.boss ? '#B84A38' : (entity.color || '#F2A32C');
    const archetype = entity.archetype ? entity.archetype.name : 'NORMAL';
    const tier = entity.boss ? 'Boss de tribu' : (entity.traits.tameable ? 'Apprivoisable' : 'Sauvage');
    const family = FAMILY_LABEL[entity.family] || String(entity.family);

    return `
      <a class="cc" href="${animalHref(entity.slug)}" data-cc-biome="${habitatOf(entity)}"
         style="--c:${escapeHtml(color)}">
        <span class="cc-scene" aria-hidden="true"></span>
        <span class="cc-veil" aria-hidden="true"></span>
        ${OW.favStar ? OW.favStar(entity.slug, entity.name) : ''}
        <span class="cc-stage" aria-hidden="true">
          <span class="cc-art crisp${solos[entity.slug] ? ' is-solo' : ''}" data-vt-art role="img"
                aria-label="${escapeHtml(entity.name)}" data-cc-solo="${escapeHtml(entity.slug)}"
                data-cc-rest="${escapeHtml(OW.asset(entity.art || entity.head))}"
                style="${bg(artOf(entity))}"></span>
          <span class="cc-face crisp" style="${bg(entity.head)}"></span>
        </span>
        <span class="cc-plate">
          <span class="cc-line">
            <span class="cc-name">${escapeHtml(entity.name)}</span>
            <span class="cc-arch crisp" role="img" aria-label="Archétype ${escapeHtml(archetype)}"
                  title="${escapeHtml(archetype)}" style="${bg(archetypeIcon(archetype))}"></span>
          </span>
          <span class="cc-stats">
            ${statsOf(entity).map(([key, value, unit]) => `
              <span class="cc-stat">
                <b>${value == null ? '—' : escapeHtml(String(value)) + (unit ? '<i class="cc-unit">' + unit + '</i>' : '')}</b>
                <small>${key}</small>
              </span>`).join('')}
          </span>
          <span class="cc-foot">
            <span class="cc-tier">${escapeHtml(tier)}</span>
            <span class="cc-dot" aria-hidden="true"></span>
            <span class="cc-family">${escapeHtml(family)}</span>
            <span class="cc-go">Fiche →</span>
          </span>
        </span>
      </a>`;
  }

  /* La bete annoncee mais pas encore livree : sa silhouette, un point
     d'interrogation, et pas de nom. */
  function mysteryCard(upcoming) {
    return `
      <div class="cc cc-mystery" data-cc-biome="${escapeHtml(upcoming.biome || 'jungle')}" role="img"
           aria-label="Créature mystère, bientôt" style="--c:#8A817C">
        <span class="cc-scene" aria-hidden="true"></span>
        <span class="cc-veil" aria-hidden="true"></span>
        <span class="cc-mystery-light" aria-hidden="true"></span>
        <span class="cc-art crisp mystery-silhouette" aria-hidden="true" style="${bg(upcoming.img)}"></span>
        <span class="cc-mystery-mark" aria-hidden="true">?</span>
        <span class="cc-plate">
          <span class="cc-line"><span class="cc-name">???</span></span>
          <span class="cc-foot">
            <span class="cc-tier">Bientôt</span>
            <span class="cc-dot" aria-hidden="true"></span>
            <span class="cc-family">Créature mystère</span>
          </span>
        </span>
      </div>`;
  }

  /* Les betes annoncees (OW.UPCOMING, js/upcoming.js) : aucune n'y est nommee,
     seule une empreinte de son nom (FNV-1a, la meme que tools/publish-data.py)
     permet de retirer sa carte des que l'export contient l'espece. */
  function fnv1a(text) {
    let h = 0x811C9DC5;
    for (const byte of new TextEncoder().encode(String(text))) {
      h ^= byte;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }
  function upcomingOf(data) {
    const released = new Set((data.allEntities || data.entities || []).map((e) => fnv1a(e.slug)));
    return (OW.UPCOMING || []).filter((u) => !released.has(u.key));
  }

  /* ---- la nouveaute -------------------------------------------------------------

     Toutes les creatures sorties sur le wiki depuis moins d'un mois
     (SITE_CONFIG.news.months) sont nouvelles en meme temps : chacune porte
     l'etoile « Nouveau ! » sur sa carte, et l'encart de l'accueil
     (js/news.js) les fait defiler, la plus recente en tete. La date est celle
     de leur sortie (releasedAt, history.revealed du JSON, tenue par
     tools/publish-data.py). Reglages : js/site-config.js. */

  /* Un mois de calendrier, jour pour jour : du 29 aout au 29 septembre, a la
     meme heure. */
  function addMonths(time, months) {
    const d = new Date(time);
    d.setMonth(d.getMonth() + months);
    return d.getTime();
  }

  /** Les betes nouvelles, de la plus recente a la plus ancienne (meme date :
      ordre de slug). Une liste vide quand il n'y en a aucune. */
  function newCreatures(data) {
    const cfg = (OW.SITE_CONFIG && OW.SITE_CONFIG.news) || {};
    const preview = new URLSearchParams(location.search).get('news');
    const pick = (slugs) => [].concat(slugs).map(String)
      .map((slug) => data.entities.find((e) => e.slug === slug.trim()))
      .filter(Boolean);

    /* ?news=lion,hippopotamus pour voir l'encart avec ces betes-la. */
    if (preview) return pick(preview.split(','));
    if (cfg.enabled === false) return [];
    if (cfg.slug && [].concat(cfg.slug).length) return pick(cfg.slug);

    const now = Date.now();
    return data.entities
      .filter((e) => e.releasedAt && !e.boss)
      .map((e) => ({ entity: e, out: Date.parse(e.releasedAt) }))
      .filter(({ out }) => out <= now && now < addMonths(out, cfg.months || 1))
      .sort((a, b) => b.out - a.out || a.entity.slug.localeCompare(b.entity.slug))
      .map(({ entity }) => entity);
  }

  /** La plus recente des nouvelles betes, ou null. */
  function pickNew(data) {
    return newCreatures(data)[0] || null;
  }

  /* L'etoile : seize branches, en pixels francs. */
  function burst() {
    const points = [];
    const n = 16;
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? 60 : 100;
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      points.push((100 + Math.cos(a) * r).toFixed(1) + ',' + (100 + Math.sin(a) * r).toFixed(1));
    }
    return `
      <svg class="hb-news-star" viewBox="0 0 200 200" aria-hidden="true">
        <polygon points="${points.join(' ')}" class="hb-news-star-back"></polygon>
        <polygon points="${points.join(' ')}" class="hb-news-star-front"></polygon>
      </svg>`;
  }

  /* L'etoile de la carte : l'autocollant du coin haut droit. */
  function markNew(cards, data) {
    const fresh = new Set(newCreatures(data).map((e) => e.slug));
    if (!fresh.size) return;
    cards.forEach((card) => {
      const art = card.querySelector('[data-cc-solo]');
      if (!art || !fresh.has(art.dataset.ccSolo) || card.querySelector('.cc-new')) return;
      card.classList.add('is-new');
      card.insertAdjacentHTML('beforeend', `
        <span class="cc-new" aria-hidden="true">
          ${burst()}
          <span class="cc-new-text">Nouveau<i>!</i></span>
        </span>`);
    });
  }

  /* ---- le montage ------------------------------------------------------------ */

  /**
   * Monte les scenes de biome et demande les rendus solo, au fur et a mesure
   * que les cartes approchent de l'ecran.
   */
  function mountCreatureCards(root) {
    const cards = Array.from((root || document).querySelectorAll('.cc[data-cc-biome]'));
    if (!cards.length) return;

    const wake = (card) => {
      if (card.dataset.ccReady) return;
      card.dataset.ccReady = '1';
      const scene = OW.biomeScene && OW.biomeScene(card.dataset.ccBiome, card.clientWidth);
      if (scene) card.querySelector('.cc-scene').appendChild(scene);
      const solo = card.querySelector('[data-cc-solo]');
      if (solo) loadSolo(solo.dataset.ccSolo);
      centreFace(card.querySelector('.cc-face'));
    };

    startSwapping(cards.filter((card) => !card.classList.contains('cc-mystery')));
    if (OW.loadWikiData) OW.loadWikiData().then((data) => markNew(cards, data)).catch(() => {});

    if (!('IntersectionObserver' in window)) { cards.forEach(wake); return; }

    /* Deux cercles autour de l'ecran. Le petit reveille la carte : le decor se
       monte, le rendu part au telechargement. Le grand, beaucoup plus loin,
       lui reprend son rendu — avec un delai, pour qu'un coup de pouce rapide
       a travers la grille ne defasse pas ce qu'il vient de faire. */
    const near = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        wake(entry.target);
        near.unobserve(entry.target);
      });
    }, { rootMargin: '300px 0px' });

    const RELEASE_AFTER = 4000;
    const far = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const art = entry.target.querySelector('[data-cc-solo]');
        if (!art) return;
        clearTimeout(art._ccTimer);
        if (entry.isIntersecting) { restoreSolo(art); return; }
        art._ccTimer = setTimeout(() => releaseSolo(art), RELEASE_AFTER);
      });
    }, { rootMargin: '1600px 0px' });

    cards.forEach((card) => { near.observe(card); far.observe(card); });
  }

  /* La tete suit la meme regle que le rendu. Les planches livrees sont
     rognees au plus juste, la mesure ne change donc rien pour elles — mais une
     tete deposee plus tard avec de la marge d'un seul cote se recadrera toute
     seule, sans qu'on ait rien a ecrire. */
  function centreFace(face) {
    if (!face) return;
    const url = (face.style.backgroundImage.match(/url\(['"]?([^'")]+)/) || [])[1];
    if (!url) return;
    const img = new Image();
    img.onload = () => { face.style.setProperty('--ox', frameOffset(img, url)); };
    img.src = url;
  }

  /* ---- la bascule rendu solo / tete ------------------------------------------ */

  const SWAP_EVERY = 5000;
  const SWAP_STAGGER = 260;   /* decalage entre deux cartes voisines */
  let swapTimer = 0;

  /**
   * Une seule horloge pour toute la grille : a chaque tour, chaque carte
   * bascule a son tour, decalee de sa voisine. Une carte survolee garde son
   * image le temps du survol, puis se remet dans le rang.
   *
   * Toutes les cartes suivent la phase, y compris celles qui sont hors de
   * l'ecran : sinon une carte sautee gardait son image d'avant et arrivait
   * a contretemps quand on defilait jusqu'a elle. Basculer une classe sur une
   * carte invisible ne coute rien — le navigateur ne repeint pas ce qu'il
   * n'affiche pas.
   */
  function startSwapping(cards) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let face = false;

    cards.forEach((card) => {
      card.addEventListener('pointerenter', () => { card.dataset.ccHold = '1'; });
      card.addEventListener('pointerleave', () => {
        delete card.dataset.ccHold;
        card.classList.toggle('is-face', face);
      });
    });

    /* La vague traverse la grille en moins d'un tour : avec beaucoup de cartes,
       le decalage se resserre pour que la derniere bascule avant la suivante. */
    const step = Math.min(SWAP_STAGGER, (SWAP_EVERY - 800) / Math.max(1, cards.length));

    clearInterval(swapTimer);
    swapTimer = setInterval(() => {
      face = !face;
      const wave = face;
      cards.forEach((card, i) => {
        if (!card.isConnected) return;
        setTimeout(() => {
          if (card.dataset.ccHold) return;
          card.classList.toggle('is-face', wave);
        }, i * step);
      });
    }, SWAP_EVERY);
  }

  Object.assign(OW, { creatureCard, mysteryCard, upcomingOf, mountCreatureCards, creatureHabitat: habitatOf,
    pickNewCreature: pickNew, newCreatures, newBurst: burst });
}(window.OW = window.OW || {}));
