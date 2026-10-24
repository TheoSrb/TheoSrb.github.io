/* Site footer. Two shapes: the full sitemap on the home page, a back-link strip
   everywhere else. Both take their version line from the mod export. */

(function (OW) {
  'use strict';

  const { escapeHtml } = OW;
  /* La version de ce fichier, reprise pour js/cameos.js (charge a la demande). */
  const VERSION = (document.currentScript && document.currentScript.src.split('?')[1]) || '';

  const COLUMNS = [
    {
      title: 'CONTENU',
      links: [
        ['creatures.html', 'Créatures'],
        ['biomes.html', 'Biomes'],
        ['items.html', 'Objets']
      ]
    },
    {
      title: 'SYSTEMES',
      links: [
        ['cosmetics.html', 'Cosmétiques'],
        ['simulator.html', 'Mécaniques'],
        ['music.html', 'Musiques']
      ]
    },
    {
      title: 'JOUER',
      links: [
        ['guide.html', 'Guide du débutant'],
        ['download.html', 'Télécharger'],
        ['community.html', 'Communauté']
      ]
    }
  ];

  /* Les liens exterieurs du mod. L'adresse se remplit ici, une fois : le pied
     de page des neuf pages la reprend. Une adresse laissee a '' affiche quand
     meme l'icone, desactivee, pour ne pas mener nulle part. */
  const LINKS = [
    { key: 'curseforge', label: 'CurseForge', title: 'Télécharger sur CurseForge', url: 'https://www.curseforge.com/minecraft/mc-mods/operation-w-i-l-d' },
    { key: 'youtube', label: 'YouTube', title: 'La chaîne YouTube', url: 'https://www.youtube.com/@Operation_W.I.L.D_Studio' },
    { key: 'discord', label: 'Discord', title: 'Rejoindre le Discord', url: 'https://discord.gg/TUUJHBwDdA' }
  ];

  /* Le logo de chaque marque, tel que la marque le dessine : une balise <i>
     prise dans Simple Icons (css/icons.css), pas une approximation maison. */
  const brand = (key) => '<i class="icon--simple-icons icon--simple-icons--' + key + '" aria-hidden="true"></i>';

  function socials() {
    return `
      <div class="footer-links">
        ${LINKS.map((l) => (l.url
          ? `<a class="footer-link" href="${escapeHtml(l.url)}" target="_blank" rel="noopener"
                title="${escapeHtml(l.title)}" aria-label="${escapeHtml(l.title)}" data-social="${l.key}">${brand(l.key)}</a>`
          : `<span class="footer-link is-empty" title="${escapeHtml(l.title)} — lien à renseigner"
                aria-label="${escapeHtml(l.title)}" data-social="${l.key}">${brand(l.key)}</span>`)).join('')}
      </div>`;
  }

  function fullFooter(data) {
    const columns = COLUMNS.map((col) => `
      <section>
        <span class="t-pixel" style="color:var(--text-dim)">${col.title}</span>
        ${col.links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
      </section>`).join('');

    return `
  <footer class="site-footer">
    <div class="wrap site-footer-inner" style="align-items:flex-start;gap:48px">
      <div style="display:flex;gap:16px;align-items:flex-start">
        <img class="crisp" src="assets/logo.png" alt="" width="44" height="46" style="display:block">
        <div>
          <div class="t-sub" style="font-size:19px;letter-spacing:.09em;line-height:1.1">Operation W.I.L.D</div>
          <div class="t-pixel" style="margin-top:8px;color:var(--text-faint)">
            WIKI · VERSION ${escapeHtml(data.meta.version)} · ${data.meta.stringCount} LIGNES FR
          </div>
          ${socials()}
        </div>
      </div>
      <div class="footer-columns">${columns}</div>
    </div>
  </footer>`;
  }

  function stripFooter(note) {
    return `
  <footer class="site-footer">
    <div class="wrap site-footer-inner">
      <a class="link-arrow" href="index.html">← Accueil</a>
      ${socials()}
      <span class="t-pixel" style="color:var(--text-faint)">${escapeHtml(note || '')}</span>
    </div>
  </footer>`;
  }

  /**
   * Renders the footer into [data-site-footer].
   * @param {object} data normalised mod export
   * @param {string} [note] right-hand note for the strip footer
   * @param {boolean} [full] render the sitemap variant
   */
  function mountFooter(data, note, full) {
    const host = document.querySelector('[data-site-footer]');
    if (!host) return;
    host.innerHTML = full ? fullFooter(data) : stripFooter(note);
    startCameos(host.querySelector('.site-footer'));
  }

  /* ---- les passants ------------------------------------------------------------
     De temps en temps, une bete du mod traverse le haut du pied de page en
     marchant sur son bord : sa planche de marche (tools/build-cameos.mjs,
     rendue depuis son vrai modele), a sa vitesse de marche du mod. Rare : une
     fois le pied de page a l'ecran, jamais deux fois la meme d'affilee, et pas
     plus d'une toutes les 35 secondes, d'une page a l'autre. Au survol elle
     s'arrete ; un clic ouvre sa fiche. Rien en mode allege ni avec les
     animations reduites. Tout bouge par transform. */
  const CAMEO_KEY = 'ow-cameo-last';
  const CAMEO_GAP = 35000;

  function loadCameos() {
    if (OW.CAMEOS) return Promise.resolve(OW.CAMEOS);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'js/cameos.js' + (VERSION ? '?' + VERSION : '');
      script.onload = () => (OW.CAMEOS ? resolve(OW.CAMEOS) : reject());
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function startCameos(footer) {
    if (!footer || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (document.documentElement.getAttribute('data-perf') === 'lite') return;

    const lane = document.createElement('div');
    lane.className = 'cameo-lane';
    footer.prepend(lane);
    let visible = false;
    let walking = false;
    let timer = 0;
    let last = null;

    const lastPass = () => { try { return +sessionStorage.getItem(CAMEO_KEY) || 0; } catch (e) { return 0; } };
    const schedule = (delay) => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (visible && !walking && !document.hidden) pass(); else if (visible) schedule(8000); }, delay);
    };

    function pass() {
      loadCameos().then((cameos) => {
        const slugs = Object.keys(cameos).filter((s) => s !== last);
        if (!slugs.length || walking) return;
        const slug = slugs[Math.floor(Math.random() * slugs.length)];
        const c = cameos[slug];
        last = slug;
        walking = true;
        try { sessionStorage.setItem(CAMEO_KEY, String(Date.now())); } catch (e) { /* rien */ }

        /* Pixels doubles (1,5 sur telephone), l'elephant plafonne a 140 px de haut. */
        const k = Math.min(window.innerWidth < 700 ? 1.5 : 2, 140 / c.h);
        const w = c.w * k;
        const rightward = Math.random() < 0.7;
        const from = rightward ? -w - 20 : window.innerWidth + 20;
        const to = rightward ? window.innerWidth + 20 : -w - 20;
        const seconds = Math.abs(to - from) / (c.bps * 16 * k);

        const a = document.createElement('a');
        a.className = 'cameo' + (rightward ? '' : ' is-leftward');
        a.href = OW.animalHref ? OW.animalHref(slug) : 'animal.html?e=' + slug;
        a.tabIndex = -1;
        a.setAttribute('aria-hidden', 'true');
        a.style.cssText = `--k:${k};--w:${c.w};--h:${c.h};--n:${c.frames};--g:${c.ground};`
          + `--step:${c.seconds}s;--from:${from.toFixed(0)}px;--to:${to.toFixed(0)}px;--time:${seconds.toFixed(2)}s`;
        a.innerHTML = `<span class="cameo-sheet"><img src="assets/cameos/${slug}.png" alt="" decoding="async"></span>`;
        const done = () => {
          a.remove();
          walking = false;
          schedule(CAMEO_GAP + Math.random() * 35000);
        };
        a.addEventListener('animationend', (event) => { if (event.target === a) done(); });
        const img = a.querySelector('img');
        img.onload = () => lane.appendChild(a);
        img.onerror = () => { walking = false; };
      }).catch(() => { walking = false; });
    }

    new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (!visible) { clearTimeout(timer); return; }
      if (walking) return;
      const wait = Math.max(0, CAMEO_GAP - (Date.now() - lastPass()));
      schedule(wait + 1200 + Math.random() * 2500);
    }, { threshold: 0.2 }).observe(footer);
  }

  Object.assign(OW, { mountFooter });
}(window.OW = window.OW || {}));
