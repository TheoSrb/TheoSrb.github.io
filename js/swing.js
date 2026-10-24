/* Ce qui pend se balance : les panneaux des chiffres de l'accueil, les
   compteurs des autres pages. Un pendule par element, que la souris pousse.
   OW.swing(hote, selecteur) — le selecteur designe les elements suspendus,
   dont le point d'accroche est donne par leur transform-origin (CSS). */

(function (OW) {
  'use strict';

  /**
   * Les panneaux sont des pendules. Chacun pend a son point d'accroche (en
   * haut, au-dessus des chaines) et se balance a peine au repos.
   *
   * La souris qui le traverse le pousse : le panneau prend la vitesse du
   * curseur au point de contact, sans jamais la depasser (on ne peut pas
   * pousser plus vite qu'on ne bouge). Plus le contact est bas, plus le bras
   * de levier est long. Le rappel est celui d'un vrai pendule (en sinus),
   * raidi au-dela de 26 degres : l'amplitude se freine d'elle-meme au lieu de
   * buter sur un angle fixe, ou le panneau restait colle avant de revenir.
   *
   * Angle en degres, positif dans le sens horaire (CSS) : pousser vers la
   * droite fait partir le bas du panneau a droite, donc un angle negatif.
   */
  /* Sert aux panneaux des chiffres, et a tout ce qui pend (selector). Chaque
     hote garde sa propre boucle, relancee a chaque nouveau rendu. */
  function swing(host, selector) {
    cancelAnimationFrame(host._swingLoop || 0);
    host._swingLoop = 0;
    if (host._swingCalm) host._swingCalm();
    /* Un nouveau rendu des panneaux remplace la boucle precedente : elle ne
       doit plus jamais repartir. */
    const gen = host._swingGen = (host._swingGen || 0) + 1;
    const signs = Array.from(host.querySelectorAll(selector || '.sign'));
    if (!signs.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const STIFFNESS = 30;    /* rappel (1/s^2) : la frequence propre du pendule */
    const DAMPING = 2.2;     /* frottement : quelques oscillations, puis le calme */
    const SOFT_LIMIT = 26;   /* au-dela, un second ressort, bien plus raide */
    const SOFT_STIFF = 90;
    const PUSH = .06;        /* degres/s par pixel/s de curseur */
    const MAX_SPIN = 230;    /* degres/s */
    const RAD = Math.PI / 180;

    const state = signs.map((el, i) => ({ el, a: 0, v: 0, phase: i * 1.3, anim: null }));
    /* Un nouveau rendu annule aussi les animations confiees a la carte
       graphique par celui-ci (plus bas). */
    host._swingCalm = () => state.forEach((s) => { if (s.anim) { s.anim.cancel(); s.anim = null; } });
    let last = null;
    let visible = true;

    /* ---- le regime de repos, confie a la carte graphique ----------------------

       Au repos, le point d'equilibre de chaque panneau oscille (1,1 degre, une
       periode de 9,4 s) et le pendule finit par le suivre exactement : une
       sinusoide un rien plus ample et un rien en retard, calculee ci-dessous a
       partir de sa raideur et de son frottement. Une fois le panneau pose sur
       ce regime (a un vingtieme de degre pres), la boucle JavaScript s'arrete
       et une animation du navigateur, calee sur la meme horloge, prend le
       relais : le mouvement est le meme, mais la carte graphique le joue seule.
       Tant que la boucle tournait, le navigateur devait refaire la page entiere
       a chaque image, pour quatre panneaux qui bougent d'un degre.

       La main qui pousse un panneau, ou le panneau qui sort de l'ecran, rend la
       main au pendule, dans l'etat exact ou il est a cet instant. */
    const OMEGA = 1 / 1.5;                          /* rad/s : le repos suit sin(t / 1500) */
    const REST = 1.1;                               /* degres */
    const DEN_RE = STIFFNESS - OMEGA * OMEGA;
    const DEN_IM = DAMPING * OMEGA;
    const AMP = REST * STIFFNESS / Math.hypot(DEN_RE, DEN_IM);
    const LAG = Math.atan2(DEN_IM, DEN_RE);
    const PERIOD = 2 * Math.PI * 1500;              /* ms */
    const steady = (s, now) => {
      const x = now / 1500 + s.phase - LAG;
      return { a: AMP * Math.sin(x), v: AMP * OMEGA * Math.cos(x) };
    };
    const KEYS = 64;
    const keyframes = Array.from({ length: KEYS + 1 }, (_, k) => ({
      offset: k / KEYS,
      transform: 'rotate(' + (AMP * Math.sin(2 * Math.PI * k / KEYS)).toFixed(4) + 'deg)'
    }));
    const canHandOff = typeof Element.prototype.animate === 'function';
    let calm = false;

    /* Le navigateur decide une fois pour toutes, au depart, si la carte
       graphique peut jouer l'animation. Lancee pendant que le panneau finit
       d'apparaitre (sa transition de translate/scale, motion.css), elle restait
       sur le fil principal pour toujours : une image refaite a chaque
       rafraichissement de l'ecran, avec le style de toutes les animations de la
       page. Une fois ces transitions finies, on la relance — meme horloge, donc
       meme image : rien ne bouge a l'ecran. */
    function startCalm(s) {
      if (s.anim) s.anim.cancel();
      s.anim = s.el.animate(keyframes, { duration: PERIOD, iterations: Infinity });
      /* Le temps de l'animation est celui de la page : a l'instant T, elle
         montre AMP * sin(T / 1500 + phase - LAG), comme le pendule. */
      s.anim.startTime = -1500 * (s.phase - LAG);
      const mine = s.anim;
      const pending = s.el.getAnimations().filter((a) => a !== mine && a.playState === 'running'
        && isFinite(a.effect.getComputedTiming().endTime));
      if (pending.length) {
        Promise.all(pending.map((a) => a.finished.catch(() => {}))).then(() => {
          if (calm && s.anim === mine && host._swingGen === gen) startCalm(s);
        });
      }
    }

    /** Le pendule est pose sur son regime de repos : la carte graphique le joue. */
    function toCalm(now) {
      calm = true;
      state.forEach((s) => {
        s.el.style.transform = 'rotate(' + steady(s, now).a.toFixed(2) + 'deg)';
        startCalm(s);
      });
    }

    /** Le pendule reprend la main, dans l'etat exact du regime a cet instant. */
    function toLoop(now) {
      if (!calm) return;
      calm = false;
      state.forEach((s) => {
        const st = steady(s, now);
        s.a = st.a;
        s.v = st.v;
        s.el.style.transform = 'rotate(' + s.a.toFixed(2) + 'deg)';
        if (s.anim) { s.anim.cancel(); s.anim = null; }
      });
      if (visible && !host._swingLoop) {
        prev = now;
        host._swingLoop = requestAnimationFrame(step);
      }
    }

    host.addEventListener('pointermove', (e) => {
      if (host._swingGen !== gen) return;
      const now = performance.now();
      if (last && now - last.t > 4) {
        const dt = (now - last.t) / 1000;
        const vx = (e.clientX - last.x) / dt;
        state.forEach((s) => {
          const r = s.el.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
          toLoop(now);
          const lever = .5 + .8 * Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
          const target = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, -vx * PUSH * lever));
          /* Pousser, c'est entrainer : le panneau rattrape la vitesse de la
             main dans son sens, il ne l'accumule pas. */
          if (Math.sign(target) !== Math.sign(s.v) || Math.abs(target) > Math.abs(s.v)) {
            s.v += (target - s.v) * .6;
          }
        });
      }
      if (!last || now - last.t > 4) last = { x: e.clientX, y: e.clientY, t: now };
    }, { passive: true });
    host.addEventListener('pointerleave', () => { last = null; }, { passive: true });

    let prev = performance.now();

    const step = (now) => {
      if (host._swingGen !== gen) return;
      /* Pas fixe et petit : le ressort raide de la butee resterait stable
         meme sur une image lente. */
      let left = Math.min(.1, (now - prev) / 1000);
      prev = now;
      /* Hors de l'ecran, le pendule reste gele et la boucle s'eteint : une
         boucle d'images qui tourne a vide oblige quand meme le navigateur a
         refaire la page a chaque image. Elle repart au retour (plus bas). */
      if (!visible) { host._swingLoop = 0; return; }
      while (left > 0) {
        const dt = Math.min(left, 1 / 240);
        left -= dt;
        state.forEach((s) => {
          const rest = 1.1 * Math.sin(now / 1500 + s.phase);
          const off = s.a - rest;
          let acc = -STIFFNESS * Math.sin(off * RAD) / RAD - DAMPING * s.v;
          const over = Math.abs(s.a) - SOFT_LIMIT;
          if (over > 0) acc -= Math.sign(s.a) * SOFT_STIFF * over;
          s.v += acc * dt;
          s.a += s.v * dt;
        });
      }
      state.forEach((s) => { s.el.style.transform = 'rotate(' + s.a.toFixed(2) + 'deg)'; });
      /* Pose sur le regime de repos ? La carte graphique prend le relais. */
      if (canHandOff && state.every((s) => {
        const st = steady(s, now);
        /* Un vingtieme de degre (un dixieme de pixel au bas d'un panneau) :
           assez large pour qu'un telephone lent, qui calcule le pendule par
           grands pas, y arrive aussi. */
        return Math.abs(s.a - st.a) < .05 && Math.abs(s.v - st.v) < .3;
      })) {
        host._swingLoop = 0;
        toCalm(now);
        return;
      }
      host._swingLoop = requestAnimationFrame(step);
    };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (host._swingGen !== gen) { io.disconnect(); return; }
        const was = visible;
        visible = entries.some((en) => en.isIntersecting);
        /* Sorti de l'ecran : le pendule se fige ou il est, comme avant. */
        if (!visible && calm) toLoop(performance.now());
        if (visible && !was && !host._swingLoop && !calm) {
          prev = performance.now();
          host._swingLoop = requestAnimationFrame(step);
        }
      });
      io.observe(host);
    }
    host._swingLoop = requestAnimationFrame(step);
  }

  OW.swing = swing;
}(window.OW = window.OW || {}));
