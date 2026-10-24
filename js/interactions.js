/* Vocabulaire d'interaction commun a toutes les pages.

   Rien ici n'est propre a une page : ce sont les gestes que le site rend
   partout de la meme facon — un titre qui se fissure, un bouton qui repond
   sous le doigt, un panneau qui s'eclaire la ou passe le curseur, une barre
   qui dit ou l'on en est.

   Le tout est branche une fois, en delegation, et se reapplique tout seul
   quand une page re-rend une liste : les pages du wiki construisent leur
   contenu apres le chargement des donnees, et devoir penser a rappeler
   quatre fonctions apres chaque innerHTML est le genre d'oubli qui ne se
   voit qu'en production. */

(function (OW) {
  'use strict';

  const reducedMotion = () => window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===========================================================================
     Onde au clic
     =========================================================================== */

  const RIPPLE_TARGETS = '.btn, .btn-square, .btn-close, .player-button, .icon-button, [data-ripple]';

  function bindRipples() {
    document.addEventListener('pointerdown', (event) => {
      if (reducedMotion() || event.button !== 0) return;

      const host = event.target.closest && event.target.closest(RIPPLE_TARGETS);
      if (!host || host.getAttribute('aria-disabled') === 'true') return;

      const rect = host.getBoundingClientRect();
      /* L'onde doit couvrir le coin le plus eloigne du point d'appui, sans quoi
         un clic dans un angle laisse une moitie de bouton intacte. */
      const size = Math.hypot(
        Math.max(event.clientX - rect.left, rect.right - event.clientX),
        Math.max(event.clientY - rect.top, rect.bottom - event.clientY)
      ) * 2;

      const style = getComputedStyle(host);
      if (style.position === 'static') host.style.position = 'relative';
      if (style.overflow === 'visible') host.style.overflow = 'hidden';

      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.cssText =
        'left:' + (event.clientX - rect.left) + 'px;'
        + 'top:' + (event.clientY - rect.top) + 'px;'
        + 'width:' + size + 'px;height:' + size + 'px';

      host.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
      /* Filet de securite : si l'animation ne se termine jamais (onglet mis en
         arriere-plan pendant l'appui), l'element ne doit pas rester. */
      setTimeout(() => ripple.remove(), 1200);
    }, { passive: true });
  }

  /* ===========================================================================
     Lueur qui suit le curseur
     =========================================================================== */

  function bindGlow() {
    if (reducedMotion()) return;
    let frame = 0;
    let pending = null;

    document.addEventListener('pointermove', (event) => {
      const host = event.target.closest && event.target.closest('.glow-follow');
      if (!host) return;
      pending = { host, x: event.clientX, y: event.clientY };

      /* Une seule ecriture par image : sans cela un pointermove a 120 Hz force
         autant de recalculs de style. */
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!pending) return;
        const rect = pending.host.getBoundingClientRect();
        pending.host.style.setProperty('--mx', ((pending.x - rect.left) / rect.width * 100) + '%');
        pending.host.style.setProperty('--my', ((pending.y - rect.top) / rect.height * 100) + '%');
        pending = null;
      });
    }, { passive: true });
  }

  /* ===========================================================================
     Inclinaison au survol
     =========================================================================== */

  /* Une carte qui s'incline vers le curseur. Reserve aux vraies souris : sur
     tactile il n'y a pas de survol, et l'effet ne ferait que retarder le tap. */
  function bindTilt() {
    if (reducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const MAX = 7;
    let frame = 0;

    document.addEventListener('pointermove', (event) => {
      const host = event.target.closest && event.target.closest('[data-tilt]');
      if (!host) return;
      if (frame) return;

      const x = event.clientX;
      const y = event.clientY;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = host.getBoundingClientRect();
        const dx = (x - rect.left) / rect.width - 0.5;
        const dy = (y - rect.top) / rect.height - 0.5;
        host.style.setProperty('--tilt-x', (-dy * MAX).toFixed(2) + 'deg');
        host.style.setProperty('--tilt-y', (dx * MAX).toFixed(2) + 'deg');
      });
    }, { passive: true });

    document.addEventListener('pointerleave', (event) => {
      const host = event.target.closest && event.target.closest('[data-tilt]');
      if (!host) return;
      host.style.removeProperty('--tilt-x');
      host.style.removeProperty('--tilt-y');
    }, { capture: true, passive: true });
  }

  /* ===========================================================================
     Barre de progression de lecture
     =========================================================================== */

  function mountScrollProgress() {
    if (document.querySelector('.scroll-progress')) return;

    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    let frame = 0;
    /* La hauteur de la page est relue quand elle change (ResizeObserver), pas a
       chaque image de defilement : la lire force un calcul de mise en page. */
    let scrollable = 0;
    const measure = () => { scrollable = document.documentElement.scrollHeight - window.innerHeight; };
    let last = '';
    const update = () => {
      frame = 0;
      const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
      const value = Math.max(0, Math.min(1, ratio)).toFixed(4);
      if (value === last) return;
      last = value;
      bar.style.setProperty('--progress', value);
    };

    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const remeasure = () => { measure(); schedule(); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', remeasure, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);
    measure();
    update();
  }

  /* ===========================================================================
     Reapplication automatique
     =========================================================================== */

  /**
   * Repasse les enrichissements sur tout ce qui vient d'etre insere.
   *
   * Les pages du wiki construisent leur contenu apres le chargement des
   * donnees, souvent par innerHTML, et parfois plusieurs fois de suite quand un
   * filtre change. Toutes ces fonctions marquent ce qu'elles ont traite, donc
   * les rappeler sur tout le document est sans effet de bord.
   */
  function enhance(root) {
    if (OW.resolveImages) OW.resolveImages(root);
    if (OW.guardImages) OW.guardImages(root);
    if (OW.reveal) OW.reveal(root);
  }

  function watchDom() {
    if (!('MutationObserver' in window)) return;

    let timer = 0;
    const observer = new MutationObserver((records) => {
      /* Le decor (.bw) et les vignettes de biome se construisent sans cesse :
         ils n'ont ni image a resoudre ni element a reveler. */
      const added = records.some((r) => r.addedNodes && r.addedNodes.length
        && !(r.target.closest && r.target.closest('.bw, .bw-scene')));
      if (!added || timer) return;
      /* Groupe les rafales : un innerHTML de trente cartes ne doit declencher
         qu'une passe, pas trente. */
      timer = setTimeout(() => { timer = 0; enhance(document); }, 60);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ---- amorcage -------------------------------------------------------------- */

  function boot() {
    bindRipples();
    bindGlow();
    bindTilt();
    mountScrollProgress();
    watchDom();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  Object.assign(OW, { enhance, mountScrollProgress });
}(window.OW = window.OW || {}));
