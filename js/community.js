/* La communaute : les avis des joueurs et leurs creations.

   Tout vient de data/community.json, rempli a la main (le mode d'emploi est
   en tete du fichier) : les testeurs envoient leur avis, on le recopie. Rien
   n'est invente ici. Avec ?demo dans l'adresse, data/community.demo.json
   s'ajoute, chaque carte marquee « Exemple ».

   Deux usages :
     OW.mountHomeReviews()  le carrousel d'avis de l'accueil ;
     la page community.html (body[data-page="community"]) : note moyenne et
     repartition, tous les avis, la galerie des creations, et comment
     participer.

   Les etoiles sont celles du jeu d'icones pixel (js/ux.js) : cinq cases, que
   la note remplit par demi-etoiles. Elles se remplissent quand on les voit ;
   la note chiffree reste toujours ecrite a cote. */

(function (OW) {
  'use strict';

  const { escapeHtml, bg } = OW;
  const $ = (s, r) => (r || document).querySelector(s);

  const DISCORD = 'https://discord.gg/TUUJHBwDdA';
  /* Les exemples : avec ?demo dans l'adresse, ou tant que js/site-config.js
     les allume (community.examples). */
  const demo = new URLSearchParams(location.search).has('demo')
    || !!(OW.SITE_CONFIG && OW.SITE_CONFIG.community && OW.SITE_CONFIG.community.examples);

  const TYPES = {
    screenshot: 'Capture',
    build: 'Construction',
    video: 'Vidéo',
    fanart: 'Fan art',
    pack: 'Pack',
    server: 'Serveur',
    other: 'Autre'
  };

  /* ---- les donnees -------------------------------------------------------------- */

  let pending = null;
  function loadCommunity() {
    if (pending) return pending;
    const get = (url) => fetch(url, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : { reviews: [], creations: [] }))
      .catch(() => ({ reviews: [], creations: [] }));
    pending = Promise.all([get('data/community.json'), demo ? get('data/community.demo.json') : Promise.resolve(null)])
      .then(([real, sample]) => {
        const tag = (list, isDemo) => (list || []).map((x) => Object.assign({}, x, { demo: isDemo }));
        return {
          reviews: tag(real.reviews, false).concat(sample ? tag(sample.reviews, true) : [])
            .filter((r) => r && r.text && r.stars != null)
            .map((r) => Object.assign(r, { stars: clampStars(r.stars) })),
          creations: tag(real.creations, false).concat(sample ? tag(sample.creations, true) : [])
            .filter((c) => c && c.title)
        };
      });
    return pending;
  }

  const clampStars = (v) => Math.max(0, Math.min(5, Math.round(Number(v) * 2) / 2));
  const frNum = (v) => String(v).replace('.', ',');

  function dateLabel(iso) {
    const t = Date.parse(iso);
    if (isNaN(t)) return '';
    return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function average(reviews) {
    if (!reviews.length) return 0;
    return reviews.reduce((s, r) => s + r.stars, 0) / reviews.length;
  }

  /* ---- les etoiles -------------------------------------------------------------- */

  /** Cinq etoiles pixel, remplies a `value` sur 5 (demi-etoiles comprises). */
  /* Cinq etoiles separees, chacune remplie a 0, 50 ou 100 % (la note est
     arrondie a la demi-etoile). Au premier passage a l'ecran, elles
     s'allument une a une de gauche a droite, en une seconde, chacune avec son
     rebond et sa gerbe d'etincelles (css/community.css). */
  function stars(value, size) {
    const halves = Math.round(Math.max(0, Math.min(5, value)) * 2);
    let html = '';
    for (let k = 0; k < 5; k++) {
      const f = Math.max(0, Math.min(2, halves - k * 2)) / 2;
      html += `<i class="st${f ? '' : ' is-empty'}" style="--f:${f};--k:${k}">`
        + (f ? '<b></b><u></u><u></u><u></u><u></u><u></u>' : '') + '</i>';
    }
    return `<span class="stars${size ? ' is-' + size : ''}" role="img"
                  aria-label="${frNum(value)} étoile${value > 1 ? 's' : ''} sur 5" data-stars>${html}</span>`;
  }

  /* Les etoiles se remplissent la premiere fois qu'elles passent a l'ecran.
     Leur etat de repos est plein : si l'animation ne joue pas (onglet en
     arriere-plan), la note reste lisible. */
  let starObserver = null;
  function fillStars(root) {
    const list = (root || document).querySelectorAll('[data-stars]:not([data-stars-armed])');
    if (!list.length) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!starObserver) {
      starObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          starObserver.unobserve(el);
          el.classList.add('is-filling');
          setTimeout(() => el.classList.remove('is-filling'), 2200);
        });
      }, { threshold: 0.6 });
    }
    list.forEach((el) => { el.setAttribute('data-stars-armed', ''); starObserver.observe(el); });
  }

  /* ---- une carte d'avis ------------------------------------------------------------ */

  /* La couleur de la bete, telle quelle pour le filet ; pour les guillemets,
     eclaircie juste assez pour se lire sur le fond sombre (3:1). */
  function inkText(hex) {
    if (!OW.luminance || !/^#[0-9a-f]{6}$/i.test(hex || '')) return hex || '#F2A32C';
    const back = OW.luminance('#15221B');
    const ratio = (l) => (Math.max(l, back) + .05) / (Math.min(l, back) + .05);
    const mix = (t) => '#' + [1, 3, 5].map((k) => {
      const c = parseInt(hex.slice(k, k + 2), 16);
      return Math.round(c + (255 - c) * t).toString(16).padStart(2, '0');
    }).join('');
    for (let step = 0; step <= 10; step++) {
      const c = mix(step / 10);
      if (ratio(OW.luminance(c)) >= 3) return c;
    }
    return '#FFFFFF';
  }

  function reviewCard(r, data, i) {
    const beast = r.creature && data ? data.entities.find((e) => e.slug === r.creature) : null;
    const when = r.date ? dateLabel(r.date) : '';
    const meta = [when, r.version].filter(Boolean).map(escapeHtml).join(' · ');
    return `
      <article class="rv-card${r.demo ? ' is-demo' : ''}" style="--i:${i || 0};--ink:${escapeHtml((beast && beast.color) || '#F2A32C')};--ink-t:${inkText((beast && beast.color) || '#F2A32C')}">
        <span class="rv-pin" aria-hidden="true"></span>
        ${r.demo ? '<span class="rv-demo">Exemple</span>' : ''}
        <div class="rv-top">
          ${stars(r.stars)}
          <b class="rv-score">${frNum(r.stars)}<small>/5</small></b>
        </div>
        <p class="rv-text">${escapeHtml(r.text)}</p>
        <footer class="rv-foot">
          ${beast ? `<span class="rv-beast crisp" title="Créature préférée : ${escapeHtml(beast.name)}" style="${bg(beast.head)}"></span>` : ''}
          <span class="rv-who">
            <b>${escapeHtml(r.author && String(r.author).trim() ? r.author : 'Anonyme')}</b>
            ${meta ? `<small>${meta}</small>` : ''}
          </span>
        </footer>
      </article>`;
  }

  /* ---- le carrousel de l'accueil ------------------------------------------------------ */

  function carousel(host, reviews, data) {
    const avg = average(reviews);
    host.innerHTML = `
      <div class="wrap stack" style="gap:28px">
        <div class="section-head rv-head" data-reveal="left">
          <div class="stack" style="gap:12px">
            <span class="t-pixel t-accent">LA COMMUNAUTÉ</span>
            <h2 class="t-display t-h2">Les Avis</h2>
          </div>
          <div class="rv-summary">
            <b class="rv-avg">${frNum(Math.round(avg * 10) / 10)}</b>
            <span class="stack" style="gap:6px">
              ${stars(avg, 'lg')}
              <small>${reviews.length} avis · <a class="link-arrow" href="community.html">Tous les avis</a></small>
            </span>
          </div>
        </div>
        <div class="rv-carousel" data-rv-carousel>
          <div class="rv-track" data-rv-track tabindex="0" aria-label="Avis des joueurs">
            ${reviews.map((r, i) => reviewCard(r, data, i)).join('')}
          </div>
          <div class="rv-controls">
            <button type="button" class="rv-arrow" data-rv-step="-1" aria-label="Avis précédent">${OW.icon ? OW.icon('prev') : '‹'}</button>
            <span class="rv-dots" data-rv-dots></span>
            <button type="button" class="rv-arrow" data-rv-step="1" aria-label="Avis suivant">${OW.icon ? OW.icon('play') : '›'}</button>
          </div>
        </div>
      </div>`;
    host.hidden = false;

    const track = $('[data-rv-track]', host);
    const cards = Array.from(track.children);
    const dotsHost = $('[data-rv-dots]', host);
    let dots = [];
    let at = 0;

    /* Les arrets du carrousel : la position de chaque carte, bornee a la fin
       du defilement. Quatre cartes a l'ecran sur cinq, ce n'est pas cinq
       pages mais deux — la derniere carte ne peut pas venir en tete. Un point
       par avis promettait des pages qui n'existaient pas : le carrousel
       butait contre sa fin et ne bougeait plus. */
    let stops = [0];
    const measure = () => {
      const max = Math.max(0, track.scrollWidth - track.clientWidth);
      const list = [];
      cards.forEach((c) => {
        const x = Math.min(max, Math.max(0, c.offsetLeft - track.offsetLeft));
        if (!list.length || x - list[list.length - 1] > 4) list.push(x);
      });
      stops = list.length ? list : [0];
      if (dots.length !== stops.length) {
        dotsHost.innerHTML = stops.map((_, i) => `<button type="button" class="rv-dot" data-rv-dot="${i}" aria-label="Page ${i + 1} sur ${stops.length}"></button>`).join('');
        dots = Array.from(dotsHost.children);
      }
      at = Math.min(at, stops.length - 1);
    };

    const current = () => {
      const left = track.scrollLeft;
      let best = 0;
      stops.forEach((x, i) => { if (Math.abs(x - left) < Math.abs(stops[best] - left)) best = i; });
      return best;
    };
    const paint = () => dots.forEach((d, i) => d.setAttribute('aria-current', String(i === at)));
    /* Apres la derniere page, on repart de la premiere (et inversement). */
    const go = (i) => {
      at = (i + stops.length) % stops.length;
      track.scrollTo({ left: stops[at], behavior: 'smooth' });
      paint();
    };
    /* Tout tient a l'ecran : pas de fleches, pas de defilement automatique. */
    const fits = () => track.scrollWidth <= track.clientWidth + 4;

    host.addEventListener('click', (e) => {
      const step = e.target.closest('[data-rv-step]');
      if (step) { go(at + parseInt(step.dataset.rvStep, 10)); hold(); return; }
      const dot = e.target.closest('[data-rv-dot]');
      if (dot) { go(parseInt(dot.dataset.rvDot, 10)); hold(); }
    });
    let scrollT = 0;
    track.addEventListener('scroll', () => {
      clearTimeout(scrollT);
      scrollT = setTimeout(() => { at = current(); paint(); }, 90);
    }, { passive: true });

    /* Le defilement tout seul, toutes les six secondes ; il se tait tant
       qu'on survole, qu'on touche ou qu'on vient de choisir un avis. */
    let paused = 0;
    const hold = () => { paused = Date.now() + 9000; };
    ['pointerenter', 'focusin', 'touchstart'].forEach((t) => host.addEventListener(t, hold, { passive: true }));
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInterval(() => {
        if (document.hidden || Date.now() < paused || fits()) return;
        const r = track.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        go(at + 1);
      }, 6000);
    }
    const sync = () => {
      measure();
      host.classList.toggle('is-static', fits());
      paint();
    };
    window.addEventListener('resize', sync);
    /* Les polices et les etoiles changent la largeur des cartes apres coup. */
    if ('ResizeObserver' in window) new ResizeObserver(sync).observe(track);
    sync();
    fillStars(host);
    if (OW.reveal) OW.reveal(host);
  }

  OW.mountHomeReviews = function (data) {
    const host = $('[data-home-reviews]');
    const cfg = (OW.SITE_CONFIG && OW.SITE_CONFIG.community) || {};
    if (!host || cfg.homeCarousel === false) return;
    loadCommunity().then((c) => {
      if (!c.reviews.length) return;
      const list = c.reviews.slice().sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
      carousel(host, list, data);
    });
  };

  /* ---- la page Communaute -------------------------------------------------------------- */

  const pageState = { sort: 'recent', type: 'all' };

  function summaryHtml(reviews) {
    const avg = average(reviews);
    const rows = [5, 4, 3, 2, 1].map((n) => {
      /* Une demi-etoile compte avec l'etoile du dessous : 4,5 va dans les 4. */
      const count = reviews.filter((r) => Math.floor(r.stars) === n || (n === 1 && r.stars < 1)).length;
      const pct = reviews.length ? count / reviews.length * 100 : 0;
      return `
        <div class="cm-dist-row">
          <span class="cm-dist-key">${n} ${OW.icon ? OW.icon('star') : '★'}</span>
          <span class="cm-dist-bar"><i style="width:${pct.toFixed(1)}%"></i></span>
          <span class="cm-dist-n">${count}</span>
        </div>`;
    }).join('');
    return `
      <div class="cm-summary" data-reveal>
        <div class="cm-score">
          <b>${reviews.length ? frNum(Math.round(avg * 10) / 10) : '—'}</b>
          ${stars(avg, 'lg')}
          <small>${reviews.length} avis</small>
        </div>
        <div class="cm-dist">${rows}</div>
      </div>`;
  }

  function reviewsHtml(reviews, data) {
    const sorted = reviews.slice().sort((a, b) => (pageState.sort === 'best'
      ? b.stars - a.stars || (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)
      : (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)));
    return `
      <div class="filter-group cm-sort" role="group" aria-label="Trier les avis">
        <button type="button" class="btn btn-toggle" data-cm-sort="recent" aria-pressed="${pageState.sort === 'recent'}">Les plus récents</button>
        <button type="button" class="btn btn-toggle" data-cm-sort="best" aria-pressed="${pageState.sort === 'best'}">Les mieux notés</button>
      </div>
      <div class="cm-reviews">${sorted.map((r, i) => reviewCard(r, data, i)).join('')}</div>`;
  }

  function youtubeId(url) {
    const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  function creationCard(c, i) {
    const yt = youtubeId(c.url);
    const image = c.image || (yt ? 'https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg' : '');
    const tag = c.url ? 'a' : 'div';
    const link = c.url ? ` href="${escapeHtml(c.url)}" target="_blank" rel="noopener"` : '';
    return `
      <${tag} class="cm-work${c.featured ? ' is-featured' : ''}${c.demo ? ' is-demo' : ''}"${link} style="--i:${i}" data-reveal>
        <span class="cm-work-media">
          ${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async">` : '<span class="cm-work-empty" aria-hidden="true"></span>'}
          ${c.type === 'video' ? `<span class="cm-play" aria-hidden="true">${OW.icon ? OW.icon('play') : '▶'}</span>` : ''}
          <span class="cm-type">${escapeHtml(TYPES[c.type] || TYPES.other)}</span>
          ${c.featured ? '<span class="cm-feat">À la une</span>' : ''}
          ${c.demo ? '<span class="rv-demo">Exemple</span>' : ''}
        </span>
        <span class="cm-work-body">
          <b class="cm-work-title">${escapeHtml(c.title)}</b>
          ${c.text ? `<span class="cm-work-text">${escapeHtml(c.text)}</span>` : ''}
          <span class="cm-work-meta">${escapeHtml(c.author || 'Anonyme')}${c.date ? ' · ' + escapeHtml(dateLabel(c.date)) : ''}</span>
        </span>
      </${tag}>`;
  }

  function creationsHtml(creations) {
    const types = Object.keys(TYPES).filter((t) => creations.some((c) => (c.type || 'other') === t));
    const shown = creations
      .filter((c) => pageState.type === 'all' || (c.type || 'other') === pageState.type)
      .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
    return `
      ${types.length > 1 ? `
        <div class="filter-group cm-types" role="group" aria-label="Filtrer les créations">
          <button type="button" class="btn btn-toggle" data-cm-type="all" aria-pressed="${pageState.type === 'all'}">Tout<span class="btn-count">${creations.length}</span></button>
          ${types.map((t) => `<button type="button" class="btn btn-toggle" data-cm-type="${t}" aria-pressed="${pageState.type === t}">${escapeHtml(TYPES[t])}<span class="btn-count">${creations.filter((c) => (c.type || 'other') === t).length}</span></button>`).join('')}
        </div>` : ''}
      <div class="cm-works">${shown.map(creationCard).join('')}</div>`;
  }

  function emptyHtml(kind) {
    return `
      <div class="cm-empty" data-reveal>
        <span class="cm-empty-icon crisp" aria-hidden="true" style="${bg('assets/heads/red_panda.png')}"></span>
        <b>${kind === 'reviews' ? 'Pas encore d’avis publié' : 'Pas encore de création publiée'}</b>
        <p>${kind === 'reviews'
          ? 'Les premiers avis des testeurs arrivent bientôt. Les retours de partie sont les bienvenus sur le Discord.'
          : 'Captures, constructions, vidéos, fan arts : le Discord les accueille, et les plus réussies sont publiées ici.'}</p>
        <a class="btn btn-accent" href="${DISCORD}" target="_blank" rel="noopener">Rejoindre le Discord</a>
      </div>`;
  }

  function renderPage(c, data) {
    const reviewsHost = $('[data-cm-reviews]');
    const worksHost = $('[data-cm-works]');
    const summaryHost = $('[data-cm-summary]');

    const drawReviews = () => {
      reviewsHost.innerHTML = c.reviews.length ? reviewsHtml(c.reviews, data) : emptyHtml('reviews');
      fillStars(reviewsHost);
      if (OW.reveal) OW.reveal(reviewsHost);
    };
    const drawWorks = () => {
      worksHost.innerHTML = c.creations.length ? creationsHtml(c.creations) : emptyHtml('works');
      if (OW.reveal) OW.reveal(worksHost);
    };

    summaryHost.innerHTML = c.reviews.length ? summaryHtml(c.reviews) : '';
    fillStars(summaryHost);
    drawReviews();
    drawWorks();

    document.addEventListener('click', (e) => {
      const sort = e.target.closest('[data-cm-sort]');
      if (sort) { pageState.sort = sort.dataset.cmSort; drawReviews(); return; }
      const type = e.target.closest('[data-cm-type]');
      if (type) { pageState.type = type.dataset.cmType; drawWorks(); }
    });

    const anchor = $('[data-cm-signs]');
    if (anchor && OW.heroSigns) {
      const avg = average(c.reviews);
      OW.heroSigns(anchor, [
        [c.reviews.length ? frNum(Math.round(avg * 10) / 10) : '—', 'Note moyenne'],
        [c.reviews.length, 'Avis'],
        [c.creations.length, 'Créations']
      ]);
      anchor.remove();
    }
  }

  if (document.body && document.body.dataset.page === 'community') {
    OW.mountHeader();
    Promise.all([OW.loadWikiData().catch(() => null), loadCommunity()])
      .then(([data, c]) => {
        renderPage(c, data);
        if (data) OW.mountFooter(data, 'VERSION ' + data.meta.version + ' · COMMUNAUTÉ');
        if (OW.reveal) OW.reveal();
      });
  }

  Object.assign(OW, { stars, loadCommunity });
}(window.OW = window.OW || {}));
