/* Drifting ember particles over the page. Pure decoration: it never blocks
   input, and it stops itself when the tab is hidden or motion is reduced.

   Les braises se dessinent dans un worker (OffscreenCanvas) quand le
   navigateur le permet. Dessinees sur le fil principal, elles demandaient une
   image a chaque rafraichissement de l'ecran : et a chaque image, le
   navigateur recalculait aussi le style de toutes les animations de la page
   (lianes, nuages, lucioles...), meme celles que la carte graphique fait
   tourner seule. Sur un telephone, c'etait le gros du travail au repos. Dans
   le worker, le meme dessin, image pour image, ne reveille plus la page.
   Sinon, le meme moteur tourne ici. */

(function (OW) {
  'use strict';

  const REDUCED = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const NOOP_CONTROLLER = { stop() {}, setTint() {}, setDrift() {} };

  /* Le moteur : la toile, ses braises, leur boucle. Il ne voit rien d'autre
     que ce qu'on lui passe — il est recopie tel quel dans le worker. */
  function emberEngine(scope) {
    let canvas = null;
    let context = null;
    let particles = [];
    let state = null;
    let width = 0;
    let height = 0;
    let frame = 0;
    let running = false;
    let t = 0;
    let lastDraw = 0;
    const raf = scope.requestAnimationFrame
      ? (fn) => scope.requestAnimationFrame(fn)
      : (fn) => setTimeout(() => fn(performance.now()), 16);
    const caf = scope.cancelAnimationFrame ? (id) => scope.cancelAnimationFrame(id) : (id) => clearTimeout(id);

    /* Les braises derivent lentement : 30 images par seconde suffisent a l'oeil. */
    const loop = (now) => {
      if (!running) return;
      if (now && now - lastDraw < 31) { frame = raf(loop); return; }
      const dt = lastDraw && now ? Math.min(3, (now - lastDraw) / 16) : 1;
      lastDraw = now || 0;
      t += 0.016 * dt;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      context.fillStyle = 'rgb(' + state.tint[0] + ',' + state.tint[1] + ',' + state.tint[2] + ')';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y += state.drift * p.speed * 0.001 * dt;
        p.x += Math.sin(t * 0.18 + p.phase) * 0.00012 * dt;

        if (p.y < -0.04) { p.y = 1.04; p.x = Math.random(); }
        if (p.y > 1.04) { p.y = -0.04; p.x = Math.random(); }

        const twinkle = 0.6 + 0.4 * Math.sin(t * 0.55 + p.phase);
        const px = Math.round(p.x * width);
        const py = Math.round(p.y * height);
        const size = p.size * 2;

        context.globalAlpha = 0.07 * twinkle;
        context.fillRect(px - size, py - size, size * 3, size * 3);
        context.globalAlpha = (0.26 + 0.3 * p.speed) * twinkle;
        context.fillRect(px, py, size, size);
      }

      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      frame = raf(loop);
    };

    return {
      init(target, list, initial) {
        canvas = target;
        context = canvas.getContext('2d');
        particles = list;
        state = initial;
        return !!context;
      },
      size(w, h, ratio) {
        width = w;
        height = h;
        canvas.width = w * ratio;
        canvas.height = h * ratio;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
      },
      run(on) {
        if (on === running) return;
        running = on;
        caf(frame);
        if (on) frame = raf(loop);
      },
      set(key, value) { state[key] = value; }
    };
  }

  /* Le worker : le moteur, et les messages de la page. */
  function workerMain(engine) {
    let core = null;
    self.onmessage = (event) => {
      const m = event.data;
      if (m.type === 'init') { core = engine(self); core.init(m.canvas, m.particles, m.state); core.size(m.width, m.height, m.ratio); }
      else if (!core) return;
      else if (m.type === 'size') core.size(m.width, m.height, m.ratio);
      else if (m.type === 'run') core.run(m.on);
      else if (m.type === 'set') core.set(m.key, m.value);
    };
  }

  let workerUrl = null;
  function emberWorker() {
    if (!window.Worker || !window.Blob || !window.URL || !HTMLCanvasElement.prototype.transferControlToOffscreen) return null;
    try {
      if (!workerUrl) {
        const src = '(' + workerMain.toString() + ')(' + emberEngine.toString() + ');';
        workerUrl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      }
      return new Worker(workerUrl);
    } catch (e) {
      return null;
    }
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{count?: number, tint?: number[], drift?: number}} [options]
   * @returns {{stop: Function, setTint: Function, setDrift: Function}}
   */
  function startEmbers(canvas, options) {
    if (!canvas || REDUCED()) return NOOP_CONTROLLER;

    const opts = options || {};
    /* En effets allegés, moitie moins de braises. */
    const lite = !!(OW.perf && OW.perf.lite());
    const count = Math.round((opts.count || 46) * (lite ? .5 : 1));
    const state = {
      tint: opts.tint || [255, 196, 116],
      drift: opts.drift == null ? -0.16 : opts.drift
    };
    const particles = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: 1 + Math.floor(Math.random() * 2),
      speed: 0.4 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2
    }));

    const measure = () => ({
      width: canvas.clientWidth || window.innerWidth,
      height: canvas.clientHeight || window.innerHeight,
      ratio: Math.min(window.devicePixelRatio || 1, 2)
    });

    /* Dans un worker si possible, sinon ici : la meme interface. */
    let worker = emberWorker();
    let local = null;
    if (worker) {
      try {
        const offscreen = canvas.transferControlToOffscreen();
        worker.postMessage(Object.assign({ type: 'init', canvas: offscreen, particles, state }, measure()), [offscreen]);
      } catch (e) {
        worker.terminate();
        worker = null;
      }
    }
    if (!worker) {
      local = emberEngine(window);
      if (!local.init(canvas, particles, state)) return NOOP_CONTROLLER;
      const m = measure();
      local.size(m.width, m.height, m.ratio);
    }
    const tell = (msg) => {
      if (worker) worker.postMessage(msg);
      else if (msg.type === 'size') local.size(msg.width, msg.height, msg.ratio);
      else if (msg.type === 'run') local.run(msg.on);
      else if (msg.type === 'set') local.set(msg.key, msg.value);
    };

    /* On ne dessine rien du tout quand la toile est masquee (theme clair) ou
       l'onglet cache. */
    let running = true;
    const hidden = () => getComputedStyle(canvas).display === 'none';
    let isHidden = hidden();
    const sync = () => tell({ type: 'run', on: running && !isHidden && !document.hidden });
    const onTheme = () => { isHidden = hidden(); sync(); };
    const onResize = () => tell(Object.assign({ type: 'size' }, measure()));

    document.addEventListener('ow:themechange', onTheme);
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', sync);
    sync();

    return {
      /* Creature pages retint the embers to the species colour. */
      setTint(rgb) { tell({ type: 'set', key: 'tint', value: rgb }); },
      setDrift(value) { tell({ type: 'set', key: 'drift', value }); },
      stop() {
        running = false;
        sync();
        if (worker) worker.terminate();
        document.removeEventListener('ow:themechange', onTheme);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', sync);
      }
    };
  }

  /** #D97733 → [217, 119, 51] */
  function hexToRgb(hex) {
    const s = String(hex || '').replace('#', '');
    if (s.length < 6) return [242, 163, 44];
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16)
    ];
  }

  Object.assign(OW, { startEmbers, hexToRgb });
}(window.OW = window.OW || {}));
