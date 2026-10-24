/* La parallaxe au gyroscope, sur telephone.

   En inclinant le telephone, les rendus solo des creatures (cartes du
   bestiaire, en-tete d'une fiche) glissent de quelques pixels, comme poses
   devant leur decor. L'effet est leger, n'existe que sur un ecran tactile muni
   d'un gyroscope, et se coupe dans le menu Langue > Affichage (choix garde
   dans le navigateur). Sur iPhone, le systeme demande l'autorisation au
   premier geste qui l'active.

   Le decalage s'ecrit directement sur les quelques rendus concernes (jamais
   sur la page entiere) : pas de recalcul du reste de la page. */

(function (OW) {
  'use strict';

  const KEY = 'ow-gyro';
  const TARGETS = '.ident-art, .cc-stage';
  const MAX_X = 10, MAX_Y = 6;           /* pixels */
  const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supported = touch && 'DeviceOrientationEvent' in window;

  const read = () => { try { return window.localStorage.getItem(KEY); } catch (e) { return null; } };
  const write = (v) => { try { window.localStorage.setItem(KEY, v); } catch (e) { /* rien */ } };

  let on = false;
  let neutral = null;
  let target = [0, 0], shown = [0, 0];
  let raf = 0;
  let els = [];
  let lastScan = 0;

  const clamp = (v) => Math.max(-1, Math.min(1, v));

  function frame(now) {
    raf = 0;
    if (now - lastScan > 1500) { els = Array.from(document.querySelectorAll(TARGETS)); lastScan = now; }
    shown = [shown[0] + (target[0] - shown[0]) * 0.12, shown[1] + (target[1] - shown[1]) * 0.12];
    const value = (shown[0] * MAX_X).toFixed(1) + 'px ' + (shown[1] * MAX_Y).toFixed(1) + 'px';
    els.forEach((el) => { el.style.translate = value; });
    if (Math.abs(target[0] - shown[0]) > 0.01 || Math.abs(target[1] - shown[1]) > 0.01) raf = requestAnimationFrame(frame);
  }

  function onOrient(e) {
    if (e.beta == null || e.gamma == null) return;
    /* La premiere mesure sert de position neutre : on tient son telephone
       comme on veut, l'effet part de la. */
    if (!neutral) neutral = [e.gamma, e.beta];
    target = [clamp((e.gamma - neutral[0]) / 25), clamp((e.beta - neutral[1]) / 25)];
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (on || !supported) return;
    on = true;
    neutral = null;
    window.addEventListener('deviceorientation', onOrient, { passive: true });
  }
  function stop() {
    on = false;
    window.removeEventListener('deviceorientation', onOrient);
    target = [0, 0];
    document.querySelectorAll(TARGETS).forEach((el) => { el.style.translate = ''; });
  }

  /** Active ou coupe l'effet (depuis le menu). Sur iPhone, demande l'autorisation. */
  function set(value) {
    write(value ? 'on' : 'off');
    if (!value) { stop(); return Promise.resolve(false); }
    const ask = window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission;
    if (typeof ask === 'function') {
      return ask.call(DeviceOrientationEvent).then((r) => { if (r === 'granted') start(); return r === 'granted'; }).catch(() => false);
    }
    start();
    return Promise.resolve(true);
  }

  OW.gyro = {
    supported,
    get enabled() { return read() !== 'off'; },
    set
  };

  /* Par defaut active, sauf mouvement reduit demande — et sur iPhone, ou il
     faut un geste pour autoriser le capteur. */
  if (supported && !reduced && read() !== 'off' && typeof (window.DeviceOrientationEvent || {}).requestPermission !== 'function') {
    start();
  }
}(window.OW = window.OW || {}));
