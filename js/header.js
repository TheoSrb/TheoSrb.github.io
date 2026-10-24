/* Site header: navigation, recherche, creature au hasard, favoris, langue et
   theme.

   The header markup lives here rather than being pasted into every page, so a
   nav change lands everywhere at once. Each page only declares which entry is
   current, via <body data-page="…">. La recherche elle-meme vit dans
   js/search.js, les favoris dans js/favorites.js, les langues dans js/i18n.js. */

(function (OW) {
  'use strict';

  const { loadWikiData, escapeHtml, applyTheme, currentTheme, storedTheme, toggleTheme } = OW;
  /* Les icones pixel (js/ux.js) ; le caractere en repli si ux.js manque. */
  const pxIcon = (name) => (OW.icon ? OW.icon(name) : ({ check: '✓', close: '✕' })[name] || '');

  const NAV = [
    { key: 'guide', label: 'Guide', href: 'guide.html' },
    { key: 'creatures', label: 'Créatures', href: 'creatures.html' },
    { key: 'biomes', label: 'Biomes', href: 'biomes.html' },
    { key: 'items', label: 'Objets', href: 'items.html' },
    { key: 'cosmetics', label: 'Cosmétiques', href: 'cosmetics.html' },
    { key: 'simulator', label: 'Mécaniques', href: 'simulator.html' },
    { key: 'music', label: 'Musiques', href: 'music.html' },
    { key: 'community', label: 'Communauté', href: 'community.html' }
  ];

  /* L'ordre du menu, pour le sens de la transition entre pages (js/biome-world.js). */
  OW.navPages = NAV.map((item) => item.href.replace(/\.html$/, ''));

  const PAGE_TITLE = {
    home: 'Accueil',
    creatures: 'Créatures',
    biomes: 'Biomes',
    items: 'Objets',
    cosmetics: 'Cosmétiques',
    simulator: 'Mécaniques',
    music: 'Musiques',
    download: 'Télécharger',
    guide: 'Guide du débutant',
    community: 'Communauté'
  };

  const SEARCH_ICON =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">'
    + '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4.5-4.5"></path></svg>';

  const MOON_ICON =
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">'
    + '<path d="M21 13a8.2 8.2 0 01-10-10 9 9 0 1010 10z"></path></svg>';

  const SUN_ICON =
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">'
    + '<circle cx="12" cy="12" r="4.4"></circle>'
    + '<path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"></path></svg>';

  /* Les icones de marque sont des balises <i> (css/icons.css) : l'etoile des
     favoris ici, Discord / YouTube / CurseForge dans le pied de page. */
  const STAR_ICON = '<i class="ow-glyph icon--mdi icon--mdi--star" aria-hidden="true"></i>';

  /* Trois barres, en cases : le bouton qui ouvre le tiroir sur telephone. */
  const BURGER_ICON =
    '<svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" style="fill:currentColor;shape-rendering:crispEdges">'
    + '<path d="M1 2h14v2H1zm0 5h14v2H1zm0 5h14v2H1z"/></svg>';

  const CLOSE_ICON =
    '<svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" style="fill:currentColor;shape-rendering:crispEdges">'
    + '<path d="M3 3h2v2h-2zM3 11h2v2h-2zM5 5h2v2h-2zM5 9h2v2h-2zM7 7h2v2h-2zM9 5h2v2h-2zM9 9h2v2h-2zM11 3h2v2h-2zM11 11h2v2h-2z"/></svg>';

  const CHEVRON =
    '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" style="fill:currentColor;shape-rendering:crispEdges"><path d="M1 3h2v1h1v1h2V4h1V3h2v2H8v1H7v1H3V6H2V5H1z"/></svg>';

  /* ---- markup --------------------------------------------------------------- */

  function langMenu() {
    if (!OW.i18n) return '';
    const i = OW.i18n;
    const current = i.LANGS.find((l) => l.code === i.lang) || i.LANGS[0];
    /* Les treize drapeaux du menu ne sont pas a l'ecran tant qu'il est ferme :
       `loading="lazy"` evite treize allers-retours a chaque page ouverte.
       Celui de la langue en cours, lui, est visible : il part tout de suite. */
    const flag = (l, cls, lazy) => `<img class="${cls}" src="${l.flag}" alt="" width="20" height="14"`
      + ` decoding="async"${lazy ? ' loading="lazy"' : ''}>`;
    return `
    <div class="hmenu" data-hmenu="lang">
      <button type="button" class="hmenu-button lang-button" data-hmenu-toggle aria-haspopup="menu" aria-expanded="false"
              title="Langue du wiki" aria-label="Langue du wiki">
        ${flag(current, 'lang-flag')}<span class="lang-code" data-no-i18n>${current.short}</span>${CHEVRON}
      </button>
      <div class="hmenu-panel lang-panel" role="menu" data-hmenu-panel hidden>
        <span class="hmenu-kicker">Langue du wiki</span>
        <div class="lang-list">
          ${i.LANGS.map((l) => `
            <button type="button" class="lang-option${l.code === i.lang ? ' is-current' : ''}" role="menuitemradio"
                    aria-checked="${l.code === i.lang}" data-lang="${l.code}" lang="${l.code}">
              <span class="lang-badge">${flag(l, 'lang-flag-big', true)}</span>
              <span class="lang-text" data-no-i18n><b>${escapeHtml(l.name)}</b><small>${escapeHtml(l.region)}</small></span>
              ${l.code === i.lang ? '<span class="lang-check" aria-hidden="true">' + pxIcon('check') + '</span>' : ''}
            </button>`).join('')}
        </div>
        ${i.lang !== 'fr' ? '<span class="hmenu-note">Traduction automatique en direct depuis le français.</span>' : ''}
        ${OW.gyro && OW.gyro.supported ? `
          <span class="hmenu-kicker">Affichage</span>
          <button type="button" class="hmenu-switch" data-gyro-toggle role="menuitemcheckbox" aria-checked="${OW.gyro.enabled}">
            <span>Effet gyroscope</span><i aria-hidden="true"></i>
          </button>` : ''}
      </div>
    </div>`;
  }

  /* L'interrupteur de la parallaxe au gyroscope (js/gyro.js). */
  document.addEventListener('click', (event) => {
    const sw = event.target.closest('[data-gyro-toggle]');
    if (!sw || !OW.gyro) return;
    const next = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', String(next));
    OW.gyro.set(next).then((ok) => { if (next && !ok) sw.setAttribute('aria-checked', 'false'); });
  });

  function favMenu() {
    if (!OW.favorites) return '';
    return `
    <div class="hmenu" data-hmenu="fav">
      <button type="button" class="hmenu-button icon-button fav-button" data-hmenu-toggle aria-haspopup="menu" aria-expanded="false"
              title="Mes créatures favorites" aria-label="Mes créatures favorites">
        ${STAR_ICON}<span class="fav-count" data-fav-count hidden></span>
      </button>
      <div class="hmenu-panel fav-panel" role="menu" data-hmenu-panel hidden>
        <span class="hmenu-kicker">Mes favoris</span>
        <div class="fav-list" data-fav-list></div>
      </div>
    </div>`;
  }

  function headerMarkup(page, overlay) {
    const title = PAGE_TITLE[page] || '';
    const nav = NAV.map((item) => {
      const current = item.key === page ? ' aria-current="page"' : '';
      return `<a href="${item.href}"${current}>${item.label}</a>`;
    }).join('');

    /* Le tiroir : sur grand ecran c'est un `display: contents`, donc rien du
       tout — ses enfants restent les blocs de la barre, exactement comme
       avant. Sous 900 px, la meme boite devient le panneau qui descend sous la
       barre, et le bouton a trois barres l'ouvre. Un seul jeu de markup pour
       les deux : rien n'est ecrit deux fois, rien ne peut diverger. */
    return `
  <header class="site-header" data-overlay="${overlay ? 'true' : 'false'}" data-scrolled="false">
    <a class="site-brand" href="index.html">
      <img src="assets/logo.png" alt="" width="34" height="36">
      <span>Operation<br>W.I.L.D</span>
    </a>
    ${title ? `<span class="site-pagetitle">${escapeHtml(title)}</span>` : ''}
    <div class="site-tools" id="ow-nav-drawer" data-nav-drawer>
      <nav class="site-nav no-scrollbar" aria-label="Sections du wiki">${nav}</nav>
      <div class="grow"></div>
      <button type="button" class="search-button" data-palette-open aria-label="Rechercher (Ctrl K)">
        ${SEARCH_ICON}
        <span class="search-label">Rechercher</span>
        <span class="kbd">CTRL K</span>
      </button>
      ${favMenu()}
      ${langMenu()}
      <button type="button" class="icon-button" data-theme-toggle aria-label="Changer de thème"></button>
      <a class="btn btn-accent header-download" href="download.html" style="height:36px;padding:0 16px;white-space:nowrap">Télécharger</a>
    </div>
    <button type="button" class="icon-button burger" data-nav-toggle aria-expanded="false"
            aria-controls="ow-nav-drawer" aria-label="Ouvrir le menu" title="Menu">${BURGER_ICON}</button>
  </header>`;
  }

  /* ---- le tiroir de telephone ---------------------------------------------------

     Il n'existe qu'en dessous de 900 px : au-dessus, la barre porte ses blocs
     elle-meme et ce code ne sert a rien. Il se ferme comme un menu doit se
     fermer — sur un lien suivi, sur Echap, sur un clic a cote, et tout seul si
     la fenetre redevient large pendant qu'il est ouvert. */

  function initDrawer(header) {
    const button = header.querySelector('[data-nav-toggle]');
    const drawer = header.querySelector('[data-nav-drawer]');
    if (!button || !drawer) return;

    const wide = window.matchMedia('(min-width: 901px)');

    function setOpen(open) {
      header.classList.toggle('nav-open', open);
      /* La page ne defile pas sous le panneau ouvert (css/ux.css). */
      document.documentElement.classList.toggle('nav-lock', open && !wide.matches);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      button.innerHTML = open ? CLOSE_ICON : BURGER_ICON;
    }

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      setOpen(!header.classList.contains('nav-open'));
    });

    /* Un lien suivi, un theme change, une langue choisie : le tiroir a fait son
       travail. La recherche ouvre sa propre fenetre par-dessus — elle aussi. */
    drawer.addEventListener('click', (event) => {
      if (event.target.closest('[data-hmenu-toggle]')) return;
      if (event.target.closest('a, [data-palette-open], [data-theme-toggle], [data-lang]')) setOpen(false);
    });

    document.addEventListener('click', (event) => {
      if (!header.classList.contains('nav-open')) return;
      if (event.target.closest('.site-header')) return;
      setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && header.classList.contains('nav-open')) { setOpen(false); button.focus(); }
    });
    /* La fenetre s'elargit : le tiroir n'a plus lieu d'etre, et la barre
       reprend ses blocs. */
    const onWide = () => { if (wide.matches) setOpen(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide);
    else wide.addListener(onWide);
  }

  /* ---- les menus deroulants ----------------------------------------------------- */

  function initMenus(root) {
    const menus = Array.from(root.querySelectorAll('[data-hmenu]'));
    if (!menus.length) return;

    const closeAll = (except) => menus.forEach((m) => {
      if (m === except) return;
      const panel = m.querySelector('[data-hmenu-panel]');
      const btn = m.querySelector('[data-hmenu-toggle]');
      if (panel.hidden) return;
      m.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      setTimeout(() => { if (!m.classList.contains('is-open')) panel.hidden = true; }, 160);
    });

    menus.forEach((m) => {
      const btn = m.querySelector('[data-hmenu-toggle]');
      const panel = m.querySelector('[data-hmenu-panel]');
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const opening = panel.hidden || !m.classList.contains('is-open');
        closeAll(m);
        if (opening) {
          panel.hidden = false;
          void panel.offsetWidth;
          m.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
          const first = panel.querySelector('.is-current, button, a');
          if (first && event.detail === 0) first.focus();
        } else {
          closeAll();
        }
      });
      /* Fleches haut/bas dans le menu. */
      panel.addEventListener('keydown', (event) => {
        const items = Array.from(panel.querySelectorAll('button:not([hidden]), a'));
        const at = items.indexOf(document.activeElement);
        if (event.key === 'ArrowDown') { event.preventDefault(); (items[at + 1] || items[0]).focus(); }
        if (event.key === 'ArrowUp') { event.preventDefault(); (items[at - 1] || items[items.length - 1]).focus(); }
        if (event.key === 'Escape') { event.preventDefault(); closeAll(); btn.focus(); }
      });
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('[data-hmenu]')) closeAll();
    });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeAll(); });

    root.addEventListener('click', (event) => {
      const option = event.target.closest('[data-lang]');
      if (option && OW.i18n) {
        root.querySelectorAll('.lang-option').forEach((b) => b.classList.toggle('is-current', b === option));
        OW.i18n.setLanguage(option.dataset.lang);
      }
    });
  }

  /* ---- favoris ------------------------------------------------------------------ */

  function initFavorites(root, data) {
    const list = root.querySelector('[data-fav-list]');
    const count = root.querySelector('[data-fav-count]');
    if (!list || !OW.favorites) return;

    const paint = () => {
      const slugs = OW.favorites.list();
      count.hidden = !slugs.length;
      count.textContent = slugs.length;
      if (!data) { list.innerHTML = ''; return; }
      const beasts = slugs.map((s) => data.entities.find((e) => e.slug === s)).filter(Boolean);
      list.innerHTML = beasts.length
        ? beasts.map((e) => `
          <div class="fav-row" style="--c:${escapeHtml(e.boss ? '#B84A38' : (e.color || '#F2A32C'))}">
            <a class="fav-link" href="${OW.animalHref(e.slug)}" role="menuitem">
              <span class="fav-head crisp" style="background-image:url('${escapeHtml(e.head)}')" aria-hidden="true"></span>
              <span class="fav-name">${escapeHtml(e.name)}</span>
            </a>
            <button type="button" class="fav-remove" data-fav-remove="${escapeHtml(e.slug)}" aria-label="Retirer ${escapeHtml(e.name)} des favoris" title="Retirer">${pxIcon('close')}</button>
          </div>`).join('')
          + `<a class="fav-all" href="creatures.html?filter=fav">Voir dans le bestiaire →</a>`
        : `<div class="fav-empty">
            <span class="fav-empty-star" aria-hidden="true">${STAR_ICON}</span>
            <b>Aucun favori pour l'instant</b>
            <small>L'étoile d'une créature l'ajoute ici, et en tête de la recherche.</small>
          </div>`;
    };

    list.addEventListener('click', (event) => {
      const rm = event.target.closest('[data-fav-remove]');
      if (!rm) return;
      event.preventDefault();
      event.stopPropagation();
      OW.favorites.remove(rm.dataset.favRemove);
    });
    document.addEventListener('ow:favorites', paint);
    paint();
  }

  /* ---- theme toggle --------------------------------------------------------- */

  function initThemeToggle(root) {
    const button = root.querySelector('[data-theme-toggle]');
    if (!button) return;

    const paint = () => {
      const light = currentTheme() === 'light';
      button.innerHTML = light ? MOON_ICON : SUN_ICON;
      button.title = light ? 'Passer en thème sombre' : 'Passer en thème clair';
    };

    button.addEventListener('click', () => { toggleTheme(); paint(); });
    document.addEventListener('ow:themechange', paint);
    paint();
  }

  /* ---- scroll state --------------------------------------------------------- */

  function initScrollState(header) {
    /* Sur l'accueil, la barre flotte a l'interieur du cadre d'ouverture, sur un
       decor sombre. Tant qu'elle y est, elle emprunte la palette « media » :
       sans cela, en theme clair, elle afficherait du texte sombre sur une
       canopee sombre. Des que la page defile, elle reprend le fond de la page
       et donc la palette du theme. */
    const framed = document.body.hasAttribute('data-header-framed');
    let last = null;
    let frame = 0;

    const update = () => {
      frame = 0;
      const scrolled = window.scrollY > 12;
      if (scrolled === last) return;
      last = scrolled;
      header.setAttribute('data-scrolled', String(scrolled));
      if (framed) header.classList.toggle('on-media', !scrolled);
    };

    window.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
    update();
  }

  /* ---- la barre qui se resserre ------------------------------------------------ */

  /* Tant que les liens debordent de la barre, elle se resserre d'un cran
     (css/ux.css, data-fit) : on essaie chaque cran, du plus aere au plus
     serre, et on garde le premier ou tout tient. Refait quand la fenetre
     change de taille, quand les polices arrivent, et quand la traduction
     change les mots des liens. */
  const FIT_LEVELS = 5;
  function initNavFit(header) {
    const nav = header && header.querySelector('.site-nav');
    if (!nav) return;
    const fit = () => {
      if (window.innerWidth <= 900) { header.removeAttribute('data-fit'); return; }
      for (let level = 0; level <= FIT_LEVELS; level++) {
        if (level) header.setAttribute('data-fit', String(level));
        else header.removeAttribute('data-fit');
        if (nav.scrollWidth <= nav.clientWidth + 1) return;
      }
    };
    fit();
    window.addEventListener('resize', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    let frame = 0;
    new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; fit(); });
    }).observe(nav, { subtree: true, childList: true, characterData: true });
  }

  /* ---- boot ----------------------------------------------------------------- */

  /** Mounts the header into [data-site-header] and wires search, menus + theme. */
  function mountHeader(options) {
    const opts = options || {};
    const host = document.querySelector('[data-site-header]');
    if (!host) return Promise.resolve();

    const page = opts.page || document.body.getAttribute('data-page') || '';
    const overlay = opts.overlay != null ? opts.overlay : document.body.hasAttribute('data-header-overlay');

    host.innerHTML = headerMarkup(page, overlay);

    initThemeToggle(host);
    initMenus(host);
    initDrawer(host.querySelector('.site-header'));
    initScrollState(host.querySelector('.site-header'));
    initNavFit(host.querySelector('.site-header'));

    return loadWikiData()
      .then((data) => {
        if (OW.mountSearch) OW.mountSearch(host, data);
        initFavorites(host, data);
        return data;
      })
      .catch((error) => {
        /* Search needs the export; the rest of the header keeps working. */
        console.error('Recherche indisponible :', error);
        host.querySelectorAll('[data-palette-open]').forEach((b) => { b.disabled = true; });
        initFavorites(host, null);
        return null;
      });
  }

  /* The theme must land before first paint to avoid a flash of the wrong ground.
     index.html applies it inline; this is the fallback for direct navigation. */
  if (typeof document !== 'undefined' && !document.documentElement.hasAttribute('data-theme')) {
    applyTheme(storedTheme());
  }

  Object.assign(OW, { mountHeader });
}(window.OW = window.OW || {}));
