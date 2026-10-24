/* Le confort de lecture, commun a toutes les pages.

   - OW.icon(nom) : le jeu d'icones pixel du wiki (fermer, valider, etoile,
     lecture, pause), dessinees sur une grille de 16 et remplies de
     currentColor. Elles remplacent les caracteres ✕ ✓ ★ ▶ que chaque police
     dessinait a sa facon.
   - La typographie francaise : une espace fine insecable devant : ; ! ? et
     dans les guillemets, pour qu'un deux-points ne tombe jamais seul en debut
     de ligne. Seulement quand la page est en francais.
   - La memoire du defilement : revenir sur une page (bouton retour,
     rechargement) ramene la ou on l'avait laissee, une fois son contenu
     construit — le navigateur, lui, essaie trop tot, sur une page encore vide.
   - La memoire des onglets : les Mecaniques et les Objets rouvrent l'onglet
     qu'on avait quitte.
   - html.sd-ok : le navigateur sait animer au defilement en CSS
     (animation-timeline) ; reveal.js et css/ux.css s'en servent. */

(function (OW) {
  'use strict';

  const root = document.documentElement;

  /* ---- les icones -------------------------------------------------------------- */

  const ICONS = {
    close: 'M3 3h2v2H3zM11 3h2v2h-2zM5 5h2v2H5zM9 5h2v2H9zM7 7h2v2H7zM5 9h2v2H5zM9 9h2v2H9zM3 11h2v2H3zM11 11h2v2h-2z',
    check: 'M1 8h3v2H1zM3 10h3v2H3zM5 12h3v2H5zM8 10h3v2H8zM10 8h3v2h-3zM12 6h2v2h-2zM13 4h2v2h-2z',
    star: 'M7 1h2v2H7zM6 3h4v2H6zM1 5h14v2H1zM3 7h10v2H3zM4 9h8v2H4zM3 11h4v2H3zM9 11h4v2H9zM2 13h3v2H2zM11 13h3v2h-3z',
    play: 'M4 2h2v12H4zM6 3h2v10H6zM8 5h2v6H8zM10 7h2v2h-2z',
    prev: 'M10 2h2v12h-2zM8 3h2v10H8zM6 5h2v6H6zM4 7h2v2H4z',
    pause: 'M4 3h3v10H4zM9 3h3v10H9z',
    up: 'M7 3h2v2H7zM5 5h6v2H5zM3 7h10v2H3zM1 9h14v2H1z',
    down: 'M1 5h14v2H1zM3 7h10v2H3zM5 9h6v2H5zM7 11h2v2H7z',
    note: 'M6 1h8v2H6zM6 3h2v8H6zM12 3h2v6h-2zM2 10h6v4H2zM8 8h6v4H8z'
  };

  /** Une icone pixel, prete a coller dans un gabarit. */
  function icon(name, cls) {
    const d = ICONS[name];
    if (!d) return '';
    return '<svg class="px-ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 16 16" aria-hidden="true" focusable="false">'
      + '<path d="' + d + '"/></svg>';
  }

  /* ---- la typographie francaise --------------------------------------------------- */

  const NNBSP = ' ';
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|CODE|PRE|SVG|NOSCRIPT)$/;

  function frenchSpaces(scope) {
    if ((root.lang || 'fr').slice(0, 2) !== 'fr' || root.hasAttribute('data-i18n-pending')) return;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const v = node.nodeValue;
        if (!v || v.length < 2) return NodeFilter.FILTER_REJECT;
        if (v.indexOf(':') < 0 && v.indexOf(';') < 0 && v.indexOf('!') < 0 && v.indexOf('?') < 0
          && v.indexOf('«') < 0 && v.indexOf('»') < 0) return NodeFilter.FILTER_REJECT;
        for (let p = node.parentNode; p && p !== scope.parentNode; p = p.parentNode) {
          if (p.nodeType === 1 && (SKIP.test(p.nodeName.toUpperCase()) || p.hasAttribute('data-no-typo'))) {
            return NodeFilter.FILTER_REJECT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const v = node.nodeValue;
      /* « 12:30 », une adresse, un « ? » colle : on ne touche qu'aux signes
         deja precedes d'une espace ordinaire. */
      const next = v
        .replace(/ ([:;!?»])/g, NNBSP + '$1')
        .replace(/« /g, '«' + NNBSP);
      if (next !== v) node.nodeValue = next;
    });
  }

  let typoQueued = false;
  const pending = new Set();
  const idle = window.requestIdleCallback
    ? (fn) => window.requestIdleCallback(fn, { timeout: 500 })
    : (fn) => setTimeout(fn, 120);

  function queueTypo(node) {
    pending.add(node);
    if (typoQueued) return;
    typoQueued = true;
    idle(() => {
      typoQueued = false;
      const list = Array.from(pending);
      pending.clear();
      list.forEach((n) => { if (n && n.isConnected) frenchSpaces(n.nodeType === 1 ? n : n.parentNode || document.body); });
    });
  }

  function watchTypo() {
    if (!document.body) return;
    queueTypo(document.body);
    if (!('MutationObserver' in window)) return;
    new MutationObserver((records) => {
      records.forEach((r) => r.addedNodes.forEach((n) => {
        if (n.nodeType === 1 || n.nodeType === 3) queueTypo(n.nodeType === 1 ? n : n.parentNode);
      }));
    }).observe(document.body, { childList: true, subtree: true });
    /* La traduction leve son voile : si la page est restee en francais, on
       repasse sur tout. */
    document.addEventListener('ow:langchange', () => queueTypo(document.body));
  }

  /* ---- la memoire du defilement ------------------------------------------------------- */

  const PAGE = location.pathname.split('/').pop() || 'index.html';
  const SCROLL_KEY = 'ow-scroll:' + PAGE + location.search;
  const navType = (() => {
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      return nav ? nav.type : 'navigate';
    } catch (e) { return 'navigate'; }
  })();

  const session = {
    get(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* rien */ } }
  };
  const local = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* rien */ } }
  };

  function rememberScroll() {
    session.set(SCROLL_KEY, String(Math.round(window.scrollY)));
  }

  function restoreScroll() {
    if (navType !== 'back_forward' && navType !== 'reload') return;
    /* Une ancre precise gagne toujours. */
    if (location.hash && location.hash.length > 1) {
      try { if (document.querySelector(location.hash)) return; } catch (e) { /* ancre non CSS */ }
    }
    const y = parseInt(session.get(SCROLL_KEY) || '0', 10);
    if (!y) return;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    /* La page se construit apres le JSON : on attend qu'elle soit assez haute
       pour tenir la position, sans jamais disputer le defilement a quelqu'un
       qui a deja commence a lire. */
    let stop = false;
    const cancel = () => { stop = true; };
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((t) => window.addEventListener(t, cancel, { once: true, passive: true }));
    const started = Date.now();
    const tick = () => {
      if (stop) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max >= y - 4) { window.scrollTo(0, y); return; }
      if (Date.now() - started > 6000) { window.scrollTo(0, Math.max(0, max)); return; }
      setTimeout(tick, 80);
    };
    tick();
  }

  let scrollTimer = 0;
  window.addEventListener('scroll', () => {
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => { scrollTimer = 0; rememberScroll(); }, 300);
  }, { passive: true });
  window.addEventListener('pagehide', rememberScroll);

  /* ---- la memoire des onglets ---------------------------------------------------------

     Retiree le 24/10/2026 : les Mecaniques s'ouvrent sans onglet choisi,
     et un lien sans ancre ne doit plus rouvrir le dernier onglet vu. On
     efface ce que les navigateurs avaient retenu. */
  try {
    window.localStorage.removeItem('ow-tab:simulator.html');
    window.localStorage.removeItem('ow-tab:items.html');
  } catch (e) { /* rien */ }

  /* ---- les boucles hors de l'ecran ---------------------------------------------------------

     Une animation en boucle qui tourne hors de l'ecran ne se voit pas, mais
     le navigateur la calcule a chaque image quand meme (Chrome sur Android ne
     s'en prive pas). Chaque grand bloc de la page qui sort de l'ecran met ses
     boucles en pause, et les relance un ecran avant qu'on y revienne : a
     l'oeil, rien ne change. Seules les boucles infinies sont touchees, et
     seulement une fois la page posee — une entree en scene garde son cours. */

  function pauseOffscreen() {
    if (!('IntersectionObserver' in window) || !document.getAnimations) return;
    const loopsOf = (region) => {
      region.getAnimations({ subtree: true }).forEach((a) => {
        const timing = a.effect && a.effect.getTiming ? a.effect.getTiming() : null;
        const el = a.effect && a.effect.target;
        if (!el || !timing || timing.iterations !== Infinity) return;
        if (typeof CSSAnimation !== 'undefined' && !(a instanceof CSSAnimation)) return;
        el.setAttribute('data-loop', '');
      });
    };
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.removeAttribute('data-off'); return; }
      loopsOf(e.target);
      e.target.setAttribute('data-off', '');
    }), { rootMargin: '100% 0px' });
    /* Un bloc qui fait a lui seul plusieurs ecrans (la fiche d'une bete tient
       tout entiere dans une seule boite) est toujours a l'ecran : on descend
       alors a ses enfants. */
    const watch = (region, depth) => {
      const kids = region.children;
      if (depth < 4 && kids.length > 1 && region.offsetHeight > window.innerHeight * 3) {
        Array.prototype.forEach.call(kids, (kid) => watch(kid, depth + 1));
      } else {
        io.observe(region);
      }
    };
    document.querySelectorAll('main > *, .site-footer, footer').forEach((region) => watch(region, 0));
    /* Ce qui se dessine plus tard dans un bloc deja hors de l'ecran (la Piste
       sauvage d'une fiche, quand ses donnees arrivent) n'avait pas ete
       marque : ses boucles tournaient pour personne, et celles qu'on ne peut
       pas confier a la carte graphique (un SVG qui change de couleur)
       faisaient refaire la page a chaque image. On le marque des qu'il
       arrive. */
    if (!('MutationObserver' in window)) return;
    let later = 0;
    new MutationObserver(() => {
      clearTimeout(later);
      later = setTimeout(() => document.querySelectorAll('[data-off]').forEach(loopsOf), 600);
    }).observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'complete') setTimeout(pauseOffscreen, 2500);
  else window.addEventListener('load', () => setTimeout(pauseOffscreen, 2500), { once: true });

  /* ---- les animations au defilement ------------------------------------------------------ */

  const sdOk = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));
  if (sdOk) root.classList.add('sd-ok');

  /* ---- les fissures des grands titres ----------------------------------------------------

     css/ux.css dessine des lezardes sur une copie transparente du titre,
     posee par-dessus (data-crack). La copie suit le texte : si la traduction
     le reecrit, elle est reprise. */

  const CRACKED = [
    'main h1', 'main .t-display.t-h2', 'main .t-section', '.sim-step-title', '.ident-name', '.stage-name',
    '.tb-title', '.dl-channel-title', '.mz-deck-title', '.mz-sleeve-title', '.acc-title', '.rm-title',
    '.dif-title', '.aura-title', '.gd-step-title', '.gd-pod-name', '.trail-hero-name', '.duel-name', '.verdict-name'
  ].join(', ');

  /* Les lezardes se posent sur le texte lui-meme (pas sur la boite du titre,
     souvent bien plus large) : on mesure ou tombent ses lettres. */
  function placeCracks(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 2);
    if (!rects.length) return;
    const box = el.getBoundingClientRect();
    const x0 = Math.min.apply(null, rects.map((r) => r.left)) - box.left;
    const x1 = Math.max.apply(null, rects.map((r) => r.right)) - box.left;
    const w = x1 - x0;
    [['--crk-a', .17], ['--crk-b', .61], ['--crk-c', .9]].forEach(([name, f]) => {
      el.style.setProperty(name, Math.round(x0 + f * w) + 'px');
    });
  }

  function crackTitles() {
    const ro = 'ResizeObserver' in window ? new ResizeObserver((entries) => entries.forEach((e) => placeCracks(e.target))) : null;
    const sync = (el) => {
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      if (!text) return;
      if (el.getAttribute('data-crack') !== text) {
        el.setAttribute('data-crack', text);
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        if (ro && !el._crackSeen) { el._crackSeen = true; ro.observe(el); }
        placeCracks(el);
      }
    };
    const scan = () => document.querySelectorAll(CRACKED).forEach(sync);
    scan();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => document.querySelectorAll('[data-crack]').forEach(placeCracks));
    if (!('MutationObserver' in window)) return;
    let queued = 0;
    new MutationObserver(() => {
      if (queued) return;
      queued = requestAnimationFrame(() => { queued = 0; scan(); });
    }).observe(document.querySelector('main') || document.body, { childList: true, subtree: true, characterData: true });
  }

  /* ---- le lien d'evitement ----------------------------------------------------------------

     Au clavier, le premier arret de la page propose d'aller droit au
     contenu, sans traverser tout le menu. Invisible a la souris. */
  function skipLink() {
    const main = document.querySelector('main');
    if (!main || document.querySelector('.skip-link')) return;
    if (!main.id) main.id = 'contenu';
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    const a = document.createElement('a');
    a.className = 'skip-link';
    a.href = '#' + main.id;
    a.textContent = 'Aller au contenu';
    a.addEventListener('click', (e) => { e.preventDefault(); main.focus(); main.scrollIntoView(); });
    document.body.prepend(a);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', skipLink);
  else skipLink();

  /* ---- les transitions entre pages : js/biome-world.js (dans l'en-tete, pour
     etre pret avant la premiere image de la page) ---------------------------- */

  /* ---- le fil d'Ariane et le retour intelligent -----------------------------------------

     Chaque clic sur un lien interne retient la vue exacte que l'on quitte
     (adresse complete : filtre, tri, onglet, ancre). Une fiche affiche son fil
     d'Ariane (Accueil > Creatures > Tigre) et un bouton « Retour » qui ramene a
     cette vue — par l'historique quand c'est possible, pour retrouver aussi la
     position dans la page. */

  const PAGE_LABEL = {
    'index.html': 'Accueil', 'creatures.html': 'Créatures', 'biomes.html': 'Biomes', 'items.html': 'Objets',
    'cosmetics.html': 'Cosmétiques', 'simulator.html': 'Mécaniques', 'music.html': 'Musiques',
    'community.html': 'Communauté', 'guide.html': 'Guide', 'download.html': 'Télécharger'
  };
  const FROM_KEY = 'ow-from';
  document.addEventListener('click', (event) => {
    const a = event.target.closest && event.target.closest('a[href]');
    if (!a || a.target === '_blank' || event.defaultPrevented) return;
    let url;
    try { url = new URL(a.href, location.href); } catch (e) { return; }
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
    const h1 = document.querySelector('main h1');
    const label = PAGE_LABEL[PAGE] || (h1 ? h1.textContent.trim() : document.title.split(/[-–|]/)[0].trim());
    session.set(FROM_KEY, JSON.stringify({ url: location.href, label, page: PAGE }));
  }, true);

  /**
   * Le fil d'Ariane d'une fiche.
   * @param {Array<{label: string, href?: string}>} trail du plus general au plus precis
   */
  function crumbs(trail) {
    const main = document.querySelector('main');
    if (!main || document.querySelector('.crumbs')) return;
    let from = null;
    try { from = JSON.parse(session.get(FROM_KEY) || 'null'); } catch (e) { from = null; }
    if (from && (from.page === PAGE && from.url === location.href)) from = null;
    const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const nav = document.createElement('nav');
    nav.className = 'crumbs';
    nav.setAttribute('aria-label', 'Fil d’Ariane');
    nav.innerHTML = (from ? `<a class="crumbs-back" href="${esc(from.url)}" data-crumbs-back>
        <span aria-hidden="true">←</span> Retour<span class="crumbs-from"> · ${esc(from.label)}</span></a>` : '')
      + '<ol>' + trail.map((c, i) => (i < trail.length - 1 && c.href
        ? `<li><a href="${esc(c.href)}">${esc(c.label)}</a></li>`
        : `<li aria-current="page">${esc(c.label)}</li>`)).join('') + '</ol>';
    main.prepend(nav);
    const back = nav.querySelector('[data-crumbs-back]');
    if (back) {
      back.addEventListener('click', (e) => {
        /* Par l'historique si la page d'avant est celle retenue : on retrouve
           aussi la position de lecture. */
        if (document.referrer && document.referrer === from.url && history.length > 1) {
          e.preventDefault();
          history.back();
        }
      });
    }
  }

  /* ---- la patte qui se referme -------------------------------------------------------------
     Le curseur est une patte (css/ux.css, section curseurs) : bouton enfonce,
     html.paw-down la referme ; au clic, une empreinte se pose et s'efface la
     ou la patte a touche. Rien sur le texte a saisir ni au doigt. */
  const TYPING = 'input, textarea, select, [contenteditable="true"]';
  /* Ce qui prend la patte aux doigts ecartes (css/ux.css, meme liste). */
  const CLICKABLE = 'a[href], button, summary, select, label[for], [role="button"], [role="tab"], [role="option"], [role="switch"]';
  const FRAME_MS = 50;   /* une image de passage : trois images a l'ecran, a peu pres */
  function wirePaw() {
    const root = document.documentElement;
    const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || root.getAttribute('data-perf') === 'lite';

    /* ---- se refermer, se rouvrir : en deux temps ---- */
    let held = false;
    let frame = 0;
    /* Passe par la patte a moitie fermee, puis finit sur `to` (ou ouverte). */
    const settle = (to) => {
      clearTimeout(frame);
      root.classList.remove('paw-down', 'paw-half');
      if (still()) { if (to) root.classList.add(to); return; }
      root.classList.add('paw-half');
      frame = setTimeout(() => {
        root.classList.remove('paw-half');
        if (to) root.classList.add(to);
      }, FRAME_MS);
    };
    const release = () => {
      if (!held) return;
      held = false;
      settle(null);
    };
    document.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      if (event.target.closest && event.target.closest(TYPING)) return;
      held = true;
      settle('paw-down');
    }, { passive: true });
    document.addEventListener('pointerup', release, { passive: true });
    document.addEventListener('pointercancel', release, { passive: true });
    document.addEventListener('dragend', release);
    window.addEventListener('blur', release);

    /* ---- tendre les doigts vers un lien, les rabattre en le quittant ----
       Le passage se pose en style sur le seul element survole : l'en-tete de
       la page ne se recalcule pas a chaque lien croise. */
    let onLink = false;
    let reaching = null;
    const clearReach = () => {
      if (!reaching) return;
      clearTimeout(reaching.timer);
      reaching.el.style.cursor = reaching.before;
      reaching = null;
    };
    document.addEventListener('pointerover', (event) => {
      if (event.pointerType !== 'mouse') return;
      const el = event.target;
      if (!el || !el.closest) return;
      const now = !!el.closest(CLICKABLE) && !el.closest(':disabled, [aria-disabled="true"]');
      if (now === onLink) return;
      onLink = now;
      if (held || still() || el.closest(TYPING) || el.closest('canvas')) return;
      clearReach();
      reaching = { el, before: el.style.cursor };
      el.style.cursor = 'var(--cur-reach)';
      reaching.timer = setTimeout(clearReach, FRAME_MS);
    }, { passive: true });

    /* ---- l'empreinte : jusqu'a quatre a la fois, gauche et droite tour a tour ---- */
    const prints = [];
    let stride = 0;
    document.addEventListener('click', (event) => {
      if (!event.detail || (event.pointerType && event.pointerType !== 'mouse')) return;
      if (still()) return;
      if (event.target.closest && event.target.closest(TYPING)) return;
      stride += 1;
      const side = stride % 2 ? 1 : -1;
      const print = document.createElement('span');
      print.className = 'paw-print';
      print.setAttribute('aria-hidden', 'true');
      print.style.setProperty('--x', event.clientX + 'px');
      print.style.setProperty('--y', event.clientY + 'px');
      print.style.setProperty('--side', String(side));
      /* Chaque patte penche vers son cote, avec un peu de hasard. */
      print.style.setProperty('--r', (side * 10 + Math.random() * 24 - 12).toFixed(0) + 'deg');
      print.addEventListener('animationend', (e) => {
        /* La poussiere (::before) finit plus tot et previent aussi : on attend l'empreinte. */
        if (e.animationName !== 'paw-print' || e.pseudoElement) return;
        print.remove();
        const at = prints.indexOf(print);
        if (at !== -1) prints.splice(at, 1);
      });
      document.body.appendChild(print);
      prints.push(print);
      while (prints.length > 4) prints.shift().remove();
    }, { passive: true });
  }

  /* ---- le clic molette : defiler a la patte ------------------------------------------------
     Le navigateur dessine son propre rond a fleches, qu'aucune feuille ne peut
     remplacer : le site defile donc lui-meme, comme lui. Clic bref : le
     defilement continue jusqu'au clic suivant (ou une touche, la molette) ;
     clic maintenu : il s'arrete au relachement. Plus la souris s'eloigne du
     repere, plus ca va vite. Un clic molette sur un lien ouvre toujours un
     onglet, et le texte a saisir garde son comportement. */
  const NO_AUTOSCROLL = 'a[href], ' + TYPING + ', canvas, iframe, video, audio, [data-no-autoscroll]';
  function wireScrollPaw() {
    const root = document.documentElement;
    const DEAD = 14;   /* autour du repere, rien ne bouge (px) */
    let run = null;

    const pageBox = () => document.scrollingElement || root;
    function scrollerOf(el) {
      for (let n = el; n && n !== document.body && n !== root; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
      }
      return pageBox();
    }

    function onMove(event) { run.mx = event.clientX; run.my = event.clientY; }

    function tick(now) {
      const dt = Math.min(50, now - run.last);
      run.last = now;
      const dy = run.my - run.y;
      let dir = '';
      if (Math.abs(dy) > DEAD) {
        dir = dy < 0 ? 'up' : 'down';
        /* Lent pres du repere, vite loin : a 100 px, environ 1000 px/s. */
        const speed = Math.min(60, Math.pow(Math.abs(dy) - DEAD, 1.35) * .035) * dt / 16.7;
        run.acc += dy < 0 ? -speed : speed;
        const step = Math.trunc(run.acc);
        if (step) {
          run.acc -= step;
          (run.box === pageBox() ? window : run.box).scrollBy({ top: step, behavior: 'instant' });
        }
      }
      if (dir !== run.dir) {
        root.classList.toggle('paw-scroll-up', dir === 'up');
        root.classList.toggle('paw-scroll-down', dir === 'down');
        run.dir = dir;
      }
      run.raf = requestAnimationFrame(tick);
    }

    /* Rien n'est pose sur la page : le point de depart reste invisible, seul
       le curseur change (css/ux.css). */
    function start(box, x, y) {
      run = { box, x, y, mx: x, my: y, acc: 0, dir: '', t0: performance.now(), last: performance.now(), raf: 0 };
      root.classList.add('paw-scrolling');
      window.addEventListener('mousemove', onMove, { passive: true, capture: true });
      run.raf = requestAnimationFrame(tick);
    }

    function stop() {
      if (!run) return;
      cancelAnimationFrame(run.raf);
      window.removeEventListener('mousemove', onMove, { capture: true });
      root.classList.remove('paw-scrolling', 'paw-scroll-up', 'paw-scroll-down');
      run = null;
    }

    /* Le clic qui arrete le defilement ne doit rien ouvrir d'autre. */
    function swallowNextClick() {
      const eat = (event) => { event.preventDefault(); event.stopPropagation(); };
      ['click', 'auxclick', 'contextmenu'].forEach((type) => window.addEventListener(type, eat, { capture: true, once: true }));
      setTimeout(() => ['click', 'auxclick', 'contextmenu'].forEach((type) => window.removeEventListener(type, eat, { capture: true })), 400);
    }

    document.addEventListener('mousedown', (event) => {
      if (run) {
        event.preventDefault();
        stop();
        swallowNextClick();
        return;
      }
      if (event.button !== 1) return;
      const target = event.target;
      if (!target || !target.closest || target.closest(NO_AUTOSCROLL)) return;
      const box = scrollerOf(target);
      if (box.scrollHeight <= box.clientHeight + 1) return;
      event.preventDefault();   /* pas de rond a fleches du navigateur */
      start(box, event.clientX, event.clientY);
    }, true);

    document.addEventListener('mouseup', (event) => {
      if (!run || event.button !== 1) return;
      /* Maintenu ou deja parti : le relachement arrete. Clic bref sur place : ca continue. */
      const held = performance.now() - run.t0 > 320;
      const moved = Math.abs(run.my - run.y) > DEAD || Math.abs(run.mx - run.x) > DEAD;
      if (held || moved) stop();
    }, true);

    window.addEventListener('keydown', (event) => { if (run) { if (event.key === 'Escape') event.preventDefault(); stop(); } }, true);
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
  }

  /* ---- demarrage ------------------------------------------------------------------------ */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { watchTypo(); restoreScroll(); crackTitles(); });
  } else {
    watchTypo();
    restoreScroll();
    crackTitles();
  }
  wirePaw();
  wireScrollPaw();

  Object.assign(OW, { icon, frenchSpaces, scrollDriven: sdOk, crumbs });
}(window.OW = window.OW || {}));
