/* Le lecteur de musique qui suit d'une page a l'autre.

   Le wiki recharge la page a chaque lien : la musique s'y arretait. Ce
   fichier la fait continuer :

   - il ecoute tout lecteur du site qui se met a jouer (le theme de l'accueil,
     la page Musiques) ;
   - en quittant la page, il note le morceau et l'instant ou il en etait
     (sessionStorage : le temps de l'onglet) ;
   - sur la page suivante, il reprend au meme instant, dans un mini-lecteur
     pose en bas a gauche. Si le navigateur refuse de relancer le son tout
     seul, le mini-lecteur propose « Reprendre » : un clic suffit.

   Le mini-lecteur se montre aussi quand la musique joue et que le lecteur de
   la page est sorti de l'ecran. Il se ferme d'une croix, qui coupe le son.

   Reglage : js/site-config.js (player.enabled). */

(function (OW) {
  'use strict';

  /* L'adresse d'origine du morceau, meme une fois charge en memoire. */
  const srcOf = (a) => (a && (a.dataset.src || a.currentSrc || a.src)) || '';

  /* Deplacer la lecture. Un serveur qui refuse d'envoyer un morceau par
     morceaux (le petit serveur de test de Python, par exemple) interdit de
     sauter dans le fichier : le navigateur repart alors de zero. Dans ce cas
     seulement, le fichier est lu une fois en entier et joue depuis la
     memoire, ou tout instant est accessible. */
  function seekTo(a, t) {
    if (!a) return;
    const ok = () => {
      const r = a.seekable;
      for (let i = 0; i < r.length; i++) if (t >= r.start(i) && t <= r.end(i)) return true;
      return false;
    };
    if (a._loading) { a._pending = t; return; }
    if (t <= 0 || ok() || /^blob:/.test(a.currentSrc)) { a.currentTime = t; return; }
    const origin = srcOf(a);
    const playing = !a.paused;
    a._loading = true;
    a._pending = t;
    fetch(origin).then((res) => (res.ok ? res.blob() : Promise.reject())).then((blob) => {
      a.addEventListener('loadedmetadata', () => {
        a._loading = false;
        a.currentTime = a._pending;
        if (playing) a.play().catch(() => { /* rien */ });
      }, { once: true });
      a.dataset.src = origin;
      a.src = URL.createObjectURL(blob);
    }).catch(() => { a._loading = false; a.currentTime = t; });
  }
  OW.seekTo = seekTo;
  OW.audioSrc = srcOf;

  /* Une barre de progression qu'on peut saisir : un clic y saute, un glisser
     la fait defiler, les fleches du clavier avancent ou reculent de cinq
     secondes. Partage avec la page Musiques et le lecteur de l'accueil. */
  function bindSeek(el, getAudio, onSeek) {
    if (!el || el._seek) return;
    el._seek = true;
    el.setAttribute('role', 'slider');
    if (!el.hasAttribute('aria-valuenow')) { el.setAttribute('aria-valuemin', '0'); el.setAttribute('aria-valuemax', '100'); el.setAttribute('aria-valuenow', '0'); }
    el.setAttribute('aria-label', el.getAttribute('aria-label') || 'Position dans le morceau');
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    const ratioAt = (x) => {
      const r = el.getBoundingClientRect();
      return Math.max(0, Math.min(1, (x - r.left) / (r.width || 1)));
    };
    const apply = (ratio) => {
      const a = getAudio();
      if (!a || !isFinite(a.duration)) return;
      seekTo(a, ratio * a.duration);
      if (onSeek) onSeek(a);
    };
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !getAudio()) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
      el.classList.add('is-seeking');
      apply(ratioAt(e.clientX));
      const move = (ev) => apply(ratioAt(ev.clientX));
      const up = () => {
        el.classList.remove('is-seeking');
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    el.addEventListener('keydown', (e) => {
      const a = getAudio();
      if (!a || !isFinite(a.duration)) return;
      let t = a.currentTime;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') t += 5;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') t -= 5;
      else if (e.key === 'Home') t = 0;
      else if (e.key === 'End') t = a.duration - .5;
      else return;
      e.preventDefault();
      seekTo(a, Math.max(0, Math.min(a.duration, t)));
      if (onSeek) onSeek(a);
    });
  }
  OW.bindSeek = bindSeek;

  const cfg = (OW.SITE_CONFIG && OW.SITE_CONFIG.player) || {};
  if (cfg.enabled === false) return;

  const KEY = 'ow-player';
  const TITLES = {
    'main-theme.mp3': 'Operation W.I.L.D — thème principal'
  };

  const read = () => { try { return JSON.parse(window.sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const write = (s) => { try { window.sessionStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* rien */ } };
  const clear = () => { try { window.sessionStorage.removeItem(KEY); } catch (e) { /* rien */ } };

  const fileOf = (src) => String(src || '').split('?')[0].split('/').pop();
  /* Le nom d'un morceau : celui de js/assets-config.js (music) s'il y en a un. */
  const configured = (file) => {
    const m = OW.ASSETS_CONFIG && OW.ASSETS_CONFIG.music && OW.ASSETS_CONFIG.music[decodeURIComponent(file)];
    return m && m.title;
  };
  const titleOf = (audio) => (audio && audio.dataset.title) || configured(fileOf(srcOf(audio)))
    || TITLES[fileOf(srcOf(audio))]
    || decodeURIComponent(fileOf(srcOf(audio)).replace(/\.\w+$/, '').replace(/[-_]/g, ' '));

  const fmt = (t) => {
    if (!isFinite(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return m + ':' + String(s).padStart(2, '0');
  };

  let current = null;       /* l'element audio suivi (celui de la page ou le notre) */
  let own = null;           /* notre propre element, quand la page n'en a pas */
  let ui = null;
  let pageHome = null;      /* le lecteur visible de la page, s'il y en a un */
  let homeVisible = false;
  let blocked = false;

  /* ---- le mini-lecteur ------------------------------------------------------------ */

  function build() {
    if (ui) return ui;
    ui = document.createElement('aside');
    ui.className = 'mini-player';
    ui.setAttribute('aria-label', 'Lecteur de musique');
    ui.hidden = true;
    ui.innerHTML = `
      <span class="mp-art crisp" aria-hidden="true"></span>
      <span class="mp-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="mp-text">
        <b class="mp-title" data-mp-title></b>
        <small data-mp-state></small>
      </span>
      <button type="button" class="mp-btn mp-toggle" data-mp-toggle aria-label="Lecture"></button>
      <button type="button" class="mp-btn mp-close" data-mp-close aria-label="Arrêter la musique" title="Arrêter">
        ${OW.icon ? OW.icon('close') : '✕'}
      </button>
      <span class="mp-seek" data-mp-seek aria-label="Avancer ou reculer dans le morceau">
        <span class="mp-bar"><i data-mp-bar></i><b class="mp-knob" data-mp-knob></b></span>
      </span>`;
    document.body.appendChild(ui);
    bindSeek(ui.querySelector('[data-mp-seek]'), () => current, () => { blocked = false; paint(); });

    ui.querySelector('[data-mp-toggle]').addEventListener('click', () => {
      if (!current) return;
      if (current.paused) current.play().then(() => { blocked = false; paint(); }).catch(() => { blocked = true; paint(); });
      else current.pause();
    });
    ui.querySelector('[data-mp-close]').addEventListener('click', () => {
      if (current) current.pause();
      clear();
      ui.classList.add('is-leaving');
      setTimeout(() => { ui.hidden = true; ui.classList.remove('is-leaving'); }, 240);
      current = null;
    });
    return ui;
  }

  function paint() {
    if (!ui || !current) return;
    const playing = !current.paused;
    ui.classList.toggle('is-playing', playing);
    ui.classList.toggle('is-blocked', blocked && !playing);
    ui.querySelector('[data-mp-title]').textContent = titleOf(current);
    ui.querySelector('[data-mp-state]').textContent = blocked && !playing
      ? 'Reprendre · ' + fmt(current.currentTime)
      : fmt(current.currentTime) + (isFinite(current.duration) ? ' / ' + fmt(current.duration) : '');
    const toggle = ui.querySelector('[data-mp-toggle]');
    toggle.innerHTML = OW.icon ? OW.icon(playing ? 'pause' : 'play') : (playing ? '❙❙' : '▶');
    toggle.setAttribute('aria-label', playing ? 'Mettre en pause' : (blocked ? 'Reprendre la musique' : 'Lecture'));
    const pct = current.duration ? current.currentTime / current.duration * 100 : 0;
    ui.querySelector('[data-mp-bar]').style.width = pct + '%';
    ui.querySelector('[data-mp-knob]').style.left = pct + '%';
    const seek = ui.querySelector('[data-mp-seek]');
    seek.setAttribute('aria-valuemin', '0');
    seek.setAttribute('aria-valuemax', String(Math.round(current.duration || 0)));
    seek.setAttribute('aria-valuenow', String(Math.round(current.currentTime || 0)));
    seek.setAttribute('aria-valuetext', fmt(current.currentTime) + ' sur ' + fmt(current.duration));
  }

  /* Visible quand quelque chose est suivi et que le lecteur de la page, s'il
     y en a un, n'est pas a l'ecran. */
  function showIfNeeded() {
    if (!current) return;
    const want = (own && current === own) || !homeVisible;
    if (!want) { if (ui) ui.hidden = true; return; }
    build();
    if (ui.hidden) ui.hidden = false;
    paint();
  }

  /* ---- suivre un element audio ---------------------------------------------------------- */

  function follow(audio) {
    if (current === audio) return;
    if (current && current !== audio && !current.paused) current.pause();
    current = audio;
    ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata'].forEach((t) => {
      if (audio['_mp_' + t]) return;
      audio['_mp_' + t] = true;
      audio.addEventListener(t, () => {
        if (audio !== current) return;
        if (t === 'play') blocked = false;
        if (t === 'ended') clear();
        paint();
      });
    });
    /* Le lecteur de la page : le mini-lecteur s'efface tant qu'il est visible. */
    const home = audio === own ? null : audio.closest('.player-card, .track, [data-player]') || null;
    if (pageHome && pageHome !== home && pageHome._mpObserver) pageHome._mpObserver.disconnect();
    pageHome = home;
    homeVisible = false;
    if (home && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        homeVisible = entries.some((e) => e.isIntersecting);
        showIfNeeded();
      }, { threshold: 0.15 });
      io.observe(home);
      home._mpObserver = io;
    }
    showIfNeeded();
  }

  /* Tout lecteur de musique de la page qui se met a jouer (les petits sons de
     la page Musiques jouent hors du document : ils ne passent pas ici). */
  document.addEventListener('play', (event) => {
    const el = event.target;
    if (!(el instanceof HTMLAudioElement)) return;
    if (el === own || el.hasAttribute('data-audio')) follow(el);
  }, true);

  /* ---- noter, puis reprendre -------------------------------------------------------------- */

  function remember() {
    if (!current || !srcOf(current)) return;
    if (current.paused && !blocked && !current._loading) { clear(); return; }
    write({
      src: new URL(srcOf(current), location.href).href,
      title: titleOf(current),
      time: current._loading ? current._pending : current.currentTime,
      at: Date.now()
    });
  }
  window.addEventListener('pagehide', remember);
  /* Un onglet ferme sans pagehide fiable (certains mobiles) : on note aussi
     regulierement. */
  setInterval(() => { if (current && !current.paused) remember(); }, 4000);

  function resume() {
    const s = read();
    if (!s || !s.src) return;
    /* Le temps passe entre deux pages est compte : la musique « a continue ». */
    const elapsed = Math.min(5, Math.max(0, (Date.now() - (s.at || Date.now())) / 1000));
    const start = (s.time || 0) + elapsed;

    /* La page a son propre lecteur pour ce morceau : c'est lui qui reprend. */
    const page = Array.from(document.querySelectorAll('audio[data-audio]'))
      .find((a) => a.getAttribute('src') && new URL(a.getAttribute('src'), location.href).href === s.src);

    let audio = page;
    if (!audio) {
      own = new Audio();
      own.preload = 'auto';
      own.src = s.src;
      own.dataset.title = s.title || '';
      audio = own;
    }
    const go = () => {
      try { seekTo(audio, start); } catch (e) { /* pas encore pret */ }
      follow(audio);
      audio.play().then(() => { blocked = false; paint(); }).catch(() => { blocked = true; showIfNeeded(); paint(); });
    };
    if (audio.readyState >= 1) go();
    else audio.addEventListener('loadedmetadata', go, { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resume);
  else resume();

  /* Pour les tests : l'element suivi. */
  OW.player = { get current() { return current; } };
}(window.OW = window.OW || {}));
