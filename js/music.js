/* La page Musiques : le jukebox de la jungle.

   Trois temps, tout en vocabulaire Minecraft :
   - la scene : un jukebox de bois ou tourne le disque en cours, le panda
     roux au casque qui balance la tete, des notes qui s'en echappent ; a cote,
     la platine — ce qui joue, un spectre en cases branche sur le son, la
     barre de lecture (clic, glisser, fleches), dix secondes en arriere ou en
     avant, le volume ;
   - la discotheque : un album par famille de morceaux (ALBUMS, plus bas),
     ses disques empiles derriere la pochette. Les pistes jouables se glissent
     dans le jukebox ; les autres disent ou les trouver en jeu.

   Le morceau joue dans l'element <audio data-audio> de la platine : le
   lecteur qui suit d'une page a l'autre (js/player.js) le reprend tel quel. */

(function (OW) {
  'use strict';

  const { loadWikiData, escapeHtml, mountHeader, mountFooter, reveal, formatTime, plural, bg } = OW;

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lite = () => !!(OW.perf && OW.perf.lite());
  const $ = (selector) => document.querySelector(selector);

  /* ---- les albums du mod ------------------------------------------------------------

     POUR AJOUTER UNE MUSIQUE : ajouter une ligne dans les `tracks` de l'album
     voulu, par exemple
       { title: 'La jungle', src: 'assets/music/jungle.mp3', sub: 'Theme du biome' },
     Champs d'une piste :
       title   (obligatoire) le nom affiche ;
       src     le fichier audio ; absent (null) = piste non ecoutable sur le wiki ;
       status  pour une piste sans src : EN JEU, EN COMPOSITION, BIENTOT... ;
       sub     (facultatif) la ligne sous le titre, dans la platine.
     POUR AJOUTER UN ALBUM : un bloc de plus dans ALBUMS (cover : 'logo',
     'boss', 'tribes', 'scene' ou le chemin d'une image).
     Chaque pochette empile derriere elle un disque par piste. */

  const ALBUMS = [
    {
      key: 'divers', title: 'Divers', tag: 'DIVERS', color: '#F2A32C', cover: 'logo',
      text: 'Les thèmes hors combat : écran-titre et moments calmes.',
      tracks: [
        { title: 'Operation W.I.L.D', src: 'assets/music/main-theme.mp3', sub: 'Le thème de l’écran-titre' }
      ]
    },
    {
      key: 'boss', title: 'Boss', tag: 'BOSS', color: '#B84A38', cover: 'boss',
      text: 'Les thèmes des combats de boss. Chaque boss laisse son disque en mourant.',
      /* Une piste par boss, ajoutee d'elle-meme pour chaque boss du JSON
         (bossTracks, plus bas). Pour la rendre ecoutable, la declarer ici avec
         son fichier, ex. :
           { title: 'Thème de l’Impératrice Végétale', boss: 'plant_empress',
             src: 'assets/music/plant_empress_theme.mp3' }
         La fiche d'un boss (bosses.html) pointe vers music.html?boss=<slug> :
         la page descend jusqu'a sa piste et la lance si elle a un fichier. */
      tracks: []
    },
    {
      key: 'aventure', title: 'Aventure', tag: 'AVENTURE', color: '#8A9A2E', cover: 'tribes',
      text: 'Tribus, biomes et exploration : la musique du monde sauvage.',
      tracks: [
        { title: 'Thèmes de tribu', src: null, status: 'EN COMPOSITION', sub: 'Un thème par tribu, pour les combats d’arène' },
        { title: 'Thèmes de biome', src: null, status: 'BIENTÔT', sub: 'Une ambiance par biome, de la jungle aux abysses' }
      ]
    }
  ];

  /* Toutes les pistes, a plat : ce que la platine sait jouer. Refait une
     fois le JSON lu, quand les pistes de boss s'ajoutent. */
  const DISCS = [];
  /* Le nom d'un morceau et sa ligne de platine se reglent par fichier dans
     js/assets-config.js (music) : ce qui y est ecrit l'emporte. */
  function named(track) {
    const file = String(track.src || track.file || '').split(/[?#]/)[0].split('/').pop();
    const cfg = (OW.ASSETS_CONFIG && OW.ASSETS_CONFIG.music && OW.ASSETS_CONFIG.music[file]) || {};
    return Object.assign({}, track, cfg.title ? { title: cfg.title } : {}, cfg.sub ? { sub: cfg.sub } : {});
  }
  function buildDiscs() {
    DISCS.length = 0;
    ALBUMS.forEach((album, a) => album.tracks.forEach((raw, i) => {
      const track = named(raw);
      DISCS.push(Object.assign({ key: album.key + '-' + i, album: a, tag: album.tag, color: album.color, where: track.sub || '' }, track));
    }));
  }
  buildDiscs();

  /* Chaque boss du JSON a sa piste dans l'album Boss : celle declaree plus
     haut (avec son fichier) si elle existe, sinon une piste a son nom. Son
     theme, tire du mod par tools/sync-wiki.py (assets/music/<boss>_theme.ogg),
     la rend ecoutable d'elle-meme ; sans fichier, elle reste « EN JEU ».
     Sans aucun boss, l'album garde une piste generique. */
  function bossTracks(data) {
    const album = ALBUMS.find((al) => al.key === 'boss');
    if (!album) return Promise.resolve();
    const bosses = (data && data.bosses) || [];
    bosses.forEach((boss) => {
      if (album.tracks.some((t) => t.boss === boss.slug)) return;
      album.tracks.push({ title: 'Thème — ' + boss.name, boss: boss.slug, src: null, status: 'EN JEU',
        sub: 'Joué à l’apparition de ' + boss.name, file: 'assets/music/' + boss.slug + '_theme.ogg' });
    });
    if (!album.tracks.length) {
      album.tracks.push({ title: 'Thème de boss', src: null, status: 'EN JEU', sub: 'Lancé à l’entrée dans l’arène du boss' });
    }
    const exists = OW.assetExists || (() => Promise.resolve(false));
    return Promise.all(album.tracks.filter((t) => t.file && !t.src).map((t) => exists(t.file).then((ok) => {
      if (!ok) return;
      t.src = t.file;
      delete t.status;
    }))).catch(() => {}).then(buildDiscs);
  }

  const VOLUME_KEY = 'ow-music-volume';
  const readVolume = () => {
    try {
      const v = parseFloat(window.localStorage.getItem(VOLUME_KEY));
      if (v >= 0 && v <= 1) return v;
    } catch (e) { /* rien */ }
    return 1;
  };
  const writeVolume = (v) => { try { window.localStorage.setItem(VOLUME_KEY, String(v)); } catch (e) { /* rien */ } };

  const ICON = {
    play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h2v1h2v1h2v1h2v1h1v4h-1v1h-2v1H8v1H6v1H4z"/></svg>',
    pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h4v12H3zM9 2h4v12H9z"/></svg>',
    back: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h2v2H6zM4 5h2v2H4zM2 7h2v2H2zM4 9h2v2H4zM6 11h2v2H6zM12 3h2v2h-2zM10 5h2v2h-2zM8 7h2v2H8zM10 9h2v2h-2zM12 11h2v2h-2z"/></svg>',
    fwd: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3h2v2H8zM10 5h2v2h-2zM12 7h2v2h-2zM10 9h2v2h-2zM8 11h2v2H8zM2 3h2v2H2zM4 5h2v2H4zM6 7h2v2H6zM4 9h2v2H4zM2 11h2v2H2z"/></svg>',
    volume: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2zM11 5h1v1h1v4h-1v1h-1v-1h1V6h-1z"/></svg>',
    lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 2h6v1h1v4h1v7H3V7h1V3h1zM6 4v3h4V4zM7 9v3h2V9z"/></svg>',
    shuffle: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 4h3v1h1v1h1v1H5V6H4V5H1zM1 11h3v-1h1V9h1v1h1v1h1v1H6v-1H5v1H1zM9 5h3V3h1v1h1v1h1v1h-1v1h-1v1h-1V6H9v1H8V6h1zM9 10h3V8h1v1h1v1h1v1h-1v1h-1v1h-1v-2H9z"/></svg>'
  };

  /* Les couleurs des notes de Minecraft : du vert au rouge, puis au bleu. */
  const NOTE_COLORS = ['#6FE36B', '#B8E04A', '#F2D33C', '#F2A32C', '#E0664F', '#E05BB5', '#9A6BE8', '#4AA3F0', '#3FD0C9'];

  const state = { data: null, disc: DISCS.find((d) => d.src) || DISCS[0] };

  /* ---- le disque, en cases -----------------------------------------------------------

     Un disque de musique de Minecraft : 16 x 16 cases, un bord noir, les
     sillons, un reflet, l'etiquette de couleur (currentColor : la couleur du
     disque passe par le CSS) et son ombre, le trou. Calcule une fois. */

  let discCache = null;
  function discSvg() {
    if (discCache) return discCache;
    const layers = { rim: '', body: '', groove: '', hi: '', label: '', shade: '', hole: '' };
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x + .5 - 8;
        const dy = y + .5 - 8;
        const r = Math.hypot(dx, dy);
        if (r > 7.9) continue;
        let k;
        if (r > 7) k = 'rim';
        else if (r <= 1.2) k = 'hole';
        else if (r <= 3.5) k = 'label';
        else if (r > 4.6 && r <= 5.6) k = 'groove';
        else k = 'body';
        const ang = Math.atan2(dy, dx) * 180 / Math.PI;
        if ((k === 'body' || k === 'groove') && r > 5.2 && ang > -165 && ang < -105) k = 'hi';
        const cell = 'M' + x + ' ' + y + 'h1v1h-1z';
        layers[k] += cell;
        if (k === 'label' && dx + dy > 1.2) layers.shade += cell;
      }
    }
    discCache = '<svg viewBox="0 0 16 16" aria-hidden="true">'
      + '<path fill="#0B0C0E" d="' + layers.rim + '"/>'
      + '<path fill="#262931" d="' + layers.body + '"/>'
      + '<path fill="#3A3E48" d="' + layers.groove + '"/>'
      + '<path fill="#7A8190" d="' + layers.hi + '"/>'
      + '<path fill="currentColor" d="' + layers.label + '"/>'
      + '<path fill="#000" fill-opacity=".28" d="' + layers.shade + '"/>'
      + '<path fill="#0B0C0E" d="' + layers.hole + '"/>'
      + '</svg>';
    return discCache;
  }

  /* ===========================================================================
     La platine
     =========================================================================== */

  const audio = () => $('[data-audio]');
  const stage = () => $('[data-stage]');

  function paintDeck() {
    const a = audio();
    const disc = state.disc;
    const playing = !a.paused && !a.ended;
    const started = a.currentTime > 0.05;
    const deck = $('[data-deck]');

    deck.style.setProperty('--c', disc.color);
    stage().style.setProperty('--c', disc.color);
    stage().classList.toggle('is-playing', playing);

    const status = $('[data-deck-state]');
    status.textContent = playing ? 'EN LECTURE' : (started ? 'EN PAUSE' : 'PRÊT');
    status.classList.toggle('is-live', playing);

    const toggle = $('[data-toggle]');
    toggle.innerHTML = playing ? ICON.pause : ICON.play;
    toggle.setAttribute('aria-label', playing ? 'Mettre en pause' : 'Lecture');

    const dur = isFinite(a.duration) ? a.duration : 0;
    const pct = dur ? Math.min(100, a.currentTime / dur * 100) : 0;
    $('[data-seek-fill]').style.width = pct + '%';
    $('[data-seek-knob]').style.left = pct + '%';
    $('[data-time]').textContent = formatTime(a.currentTime);
    $('[data-duration]').textContent = dur ? formatTime(dur) : '—:—';
    const seek = $('[data-seek]');
    seek.setAttribute('aria-valuemin', '0');
    seek.setAttribute('aria-valuemax', String(Math.round(dur)));
    seek.setAttribute('aria-valuenow', String(Math.round(a.currentTime)));
    seek.setAttribute('aria-valuetext', formatTime(a.currentTime) + ' sur ' + formatTime(dur));

    document.querySelectorAll('[data-album]').forEach((el) => {
      el.classList.toggle('is-current', DISCS.indexOf(disc) >= 0 && disc.album === parseInt(el.dataset.album, 10) && started);
    });
    document.querySelectorAll('[data-sleeve]').forEach((el) => {
      const d = DISCS[parseInt(el.dataset.sleeve, 10)];
      const current = d === disc && started;
      el.classList.toggle('is-current', current);
      const btn = el.querySelector('[data-load]');
      if (btn) btn.innerHTML = (current && playing ? ICON.pause + '<span>Pause</span>' : ICON.play + '<span>' + (current ? 'Reprendre' : 'Écouter') + '</span>');
    });

    if (playing) { startScope(); startNotes(); } else { stopNotes(); drawScope(); }
  }

  function showDisc(disc) {
    $('[data-deck-title]').textContent = disc.title;
    $('[data-deck-tag]').textContent = disc.tag;
    $('[data-deck-sub]').textContent = disc.sub || disc.where;
  }

  /* Le disque descend dans la fente du jukebox. */
  function insertDisc() {
    const el = $('[data-stage-disc]');
    el.classList.remove('is-inserting');
    void el.offsetWidth;
    el.classList.add('is-inserting');
  }

  function play() {
    const a = audio();
    ensureGraph();
    const go = a.play();
    if (go && go.catch) go.catch(() => { /* lecture refusee ou fichier absent */ });
  }

  function toggle() {
    const a = audio();
    if (a.paused || a.ended) play();
    else a.pause();
  }

  function seekBy(delta) {
    const a = audio();
    if (!isFinite(a.duration)) return;
    const t = Math.max(0, Math.min(a.duration - .25, a.currentTime + delta));
    if (OW.seekTo) OW.seekTo(a, t);
    else a.currentTime = t;
    paintDeck();
  }

  /* ---- le spectre, branche sur le son ----------------------------------------------

     L'element audio passe par un analyseur. Le branchement ne se fait que sur
     un geste (clic, touche) : cree sans geste, le contexte audio naitrait
     suspendu, et coupe le son au lieu de l'ecouter. En attendant, le spectre
     dessine une onde calme. */

  let graph = null;
  function ensureGraph() {
    if (graph !== null) {
      if (graph && graph.ctx.state === 'suspended') graph.ctx.resume();
      return graph;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { graph = false; return graph; }
    try {
      const ctx = new AC();
      const source = ctx.createMediaElementSource(audio());
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = .78;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      graph = { ctx, analyser, data: new Uint8Array(analyser.frequencyBinCount) };
    } catch (e) {
      graph = false;
    }
    return graph;
  }

  let scopeFrame = 0;
  let scopeSeen = true;
  function startScope() {
    if (!scopeFrame && scopeSeen && !document.hidden) scopeFrame = requestAnimationFrame(drawScope);
  }

  function drawScope() {
    scopeFrame = 0;
    const canvas = $('[data-scope]');
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * ratio)) {
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const a = audio();
    const playing = !a.paused && !a.ended;
    const color = state.disc.color;
    const cols = Math.max(12, Math.floor(w / 12));
    const cw = w / cols;
    const cell = 5;
    const rows = Math.floor(h / cell);
    const t = performance.now() / 1000;

    if (graph && playing) graph.analyser.getByteFrequencyData(graph.data);

    for (let i = 0; i < cols; i++) {
      let v;
      if (graph && playing) {
        /* Les basses a gauche, sur une echelle qui ecarte les aigus. */
        const k = Math.floor(Math.pow(i / cols, 1.6) * graph.data.length * .72);
        v = graph.data[k] / 255;
      } else if (playing) {
        v = .25 + .2 * Math.sin(t * 3.1 + i * .55) + .12 * Math.sin(t * 5.3 + i * 1.3);
      } else {
        v = 0;
      }
      const n = Math.max(1, Math.round(v * rows));
      for (let r = 0; r < n; r++) {
        ctx.fillStyle = r === n - 1 && n > 1 ? '#FFF6D8' : color;
        ctx.globalAlpha = playing ? 1 : .35;
        ctx.fillRect(Math.round(i * cw) + 1, h - (r + 1) * cell + 1, Math.max(1, Math.round(cw) - 3), cell - 2);
      }
    }
    ctx.globalAlpha = 1;
    if (playing && scopeSeen && !document.hidden) scopeFrame = requestAnimationFrame(drawScope);
  }

  /* ---- les notes qui s'echappent du jukebox ---------------------------------------- */

  let noteTimer = 0;
  let noteIndex = 0;
  function startNotes() {
    if (noteTimer || reducedMotion()) return;
    noteTimer = setInterval(() => {
      if (document.hidden || !scopeSeen) return;
      spawnNote($('[data-notes]'), NOTE_COLORS[noteIndex++ % NOTE_COLORS.length], (Math.random() - .5) * 70);
    }, lite() ? 900 : 520);
  }
  function stopNotes() { clearInterval(noteTimer); noteTimer = 0; }

  function spawnNote(host, color, drift) {
    if (!host || reducedMotion()) return;
    const note = document.createElement('i');
    note.className = 'mz-note';
    note.style.setProperty('--nc', color);
    note.style.setProperty('--dx', Math.round(drift) + 'px');
    note.style.left = (42 + Math.random() * 16) + '%';
    note.addEventListener('animationend', () => note.remove());
    host.appendChild(note);
    /* Filet de securite : une note dont l'animation ne joue pas (onglet
       masque) ne reste pas dans la page. */
    setTimeout(() => note.remove(), 4000);
  }

  function mountDeck() {
    const a = audio();
    a.volume = readVolume();
    $('[data-stage-disc] .mz-disc').innerHTML = discSvg();
    showDisc(state.disc);

    $('[data-toggle]').addEventListener('click', toggle);
    $('[data-back]').addEventListener('click', () => seekBy(-10));
    $('[data-fwd]').addEventListener('click', () => seekBy(10));
    const vol = $('[data-volume]');
    vol.value = Math.round(a.volume * 100);
    vol.style.setProperty('--v', vol.value + '%');
    vol.addEventListener('input', () => {
      a.volume = vol.value / 100;
      vol.style.setProperty('--v', vol.value + '%');
      writeVolume(a.volume);
    });
    if (OW.bindSeek) OW.bindSeek($('[data-seek]'), audio, paintDeck);

    ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'seeked', 'emptied'].forEach((type) => a.addEventListener(type, paintDeck));
    a.addEventListener('play', () => { if (!a._mzInserted) { a._mzInserted = true; insertDisc(); } });

    /* Le morceau a pu reprendre tout seul en arrivant sur la page (lecteur
       persistant) : le premier geste du visiteur branche le spectre. */
    const armGraph = () => { if (!a.paused) ensureGraph(); };
    document.addEventListener('pointerdown', armGraph, { passive: true });
    document.addEventListener('keydown', armGraph);

    /* Hors de l'ecran, ni spectre ni notes. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        scopeSeen = entries.some((e) => e.isIntersecting);
        if (scopeSeen && !a.paused) startScope();
      }, { rootMargin: '100px 0px' }).observe(stage());
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !a.paused) startScope(); });
    window.addEventListener('resize', () => { if (a.paused) drawScope(); });

    paintDeck();
  }

  /* ===========================================================================
     La discotheque
     =========================================================================== */

  function discArt(disc, extraClass) {
    return `<span class="${extraClass || ''}" aria-hidden="true"><span class="mz-disc" style="--c:${disc.color}">${discSvg()}</span></span>`;
  }

  function coverOf(album, data) {
    if (album.cover === 'logo') return '<img class="mz-cover-logo crisp" src="assets/logo.png" alt="" width="152" height="160" loading="lazy" decoding="async">';
    if (album.cover === 'boss') {
      const boss = data && (data.allEntities || data.entities).find((e) => e.boss);
      /* Le rendu du boss est lourd : il ne se charge qu'a l'approche. */
      return boss
        ? `<img class="mz-cover-art crisp" src="${escapeHtml(boss.art || boss.head)}" alt="" loading="lazy" decoding="async">`
        : '<span class="mz-cover-mark">?</span>';
    }
    if (album.cover === 'tribes') {
      return `<span class="mz-cover-emblems">${[1, 4, 6, 8].map((n) => `<span class="crisp" style="${bg('assets/tribes/emblems/emblem-' + n + '.png')}"></span>`).join('')}</span>`;
    }
    if (album.cover === 'scene') return '<span class="mz-cover-scene" data-cover-scene></span>';
    return `<img class="mz-cover-art crisp" src="${escapeHtml(album.cover)}" alt="" loading="lazy" decoding="async">`;
  }

  /* Une pochette par album : ses disques empiles derriere (un par piste, six
     au plus a l'ecran), puis la liste de ses pistes. */
  function renderCrate(data) {
    $('[data-crate]').innerHTML = ALBUMS.map((album, a) => {
      const stack = album.tracks.slice(0, 6);
      const count = album.tracks.length;
      const rows = album.tracks.map((raw, t) => {
        const track = named(raw);
        const i = DISCS.findIndex((d) => d.key === album.key + '-' + t);
        return `
          <li class="mz-track${track.src ? ' is-playable' : ' is-locked'}" data-sleeve="${i}">
            <span class="mz-track-disc" aria-hidden="true"><span class="mz-disc" style="--c:${album.color}">${discSvg()}</span></span>
            <span class="mz-track-name">${escapeHtml(track.title)}</span>
            ${track.src
              ? `<button type="button" class="mz-sleeve-btn" data-load="${i}">${ICON.play}<span>Écouter</span></button>`
              : `<span class="mz-sleeve-lock">${ICON.lock}<span>${escapeHtml(track.status || 'EN JEU')}</span></span>`}
          </li>`;
      }).join('');
      return `
      <article class="mz-sleeve mz-album${album.tracks.some((t) => t.src) ? ' is-playable' : ' is-locked'}" style="--c:${album.color};--n:${stack.length}" data-album="${a}" data-reveal="pop">
        <div class="mz-sleeve-pocket">
          ${stack.map((t, k) => `<span class="mz-sleeve-disc mz-stack-disc${t.src ? '' : ' is-muted'}" style="--k:${k}" aria-hidden="true"><span class="mz-disc" style="--c:${album.color}">${discSvg()}</span></span>`).join('')}
          <div class="mz-cover">
            ${coverOf(album, data)}
            <span class="mz-cover-band">${escapeHtml(album.tag)} · ${count} PISTE${count > 1 ? 'S' : ''}</span>
            <span class="mz-cover-in">DANS LE JUKEBOX</span>
          </div>
        </div>
        <div class="mz-sleeve-body">
          <b class="mz-sleeve-title">${escapeHtml(album.title)}</b>
          <p class="mz-sleeve-where">${escapeHtml(album.text || '')}</p>
          <ol class="mz-tracks">${rows}</ol>
        </div>
      </article>`;
    }).join('');

    /* Une pochette de biome : un vrai decor, anime. */
    document.querySelectorAll('[data-cover-scene]').forEach((host) => {
      const scene = OW.biomeScene && OW.biomeScene('jungle', host.clientWidth || 240);
      if (scene) host.appendChild(scene);
    });

    $('[data-crate]').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-load]');
      if (!btn) return;
      const disc = DISCS[parseInt(btn.dataset.load, 10)];
      if (!disc || !disc.src) return;
      const a = audio();
      if (state.disc !== disc) {
        state.disc = disc;
        showDisc(disc);
        a.src = disc.src;
        insertDisc();
      }
      toggle();
      /* Le disque part au jukebox : on remonte vers lui sur telephone. */
      if (!a.paused && window.innerWidth < 900 && OW.scrollToEl) OW.scrollToEl('[data-stage]');
    });
  }

  /* ===========================================================================
     Demarrage
     =========================================================================== */

  /* ---- arrivee depuis la fiche d'un boss : music.html?boss=<slug> ---------------

     La page descend jusqu'a la piste du boss et la met en evidence ; si la
     piste a un fichier, elle passe dans le jukebox et se lance. Un navigateur
     peut refuser la lecture automatique : le disque reste alors pret, et le
     bouton de lecture clignote pour la proposer. Sans piste, on s'arrete sur
     l'album Boss. */
  function openRequested() {
    const slug = new URLSearchParams(window.location.search).get('boss');
    if (!slug) return;
    const i = DISCS.findIndex((d) => d.boss === slug);
    const disc = DISCS[i];
    const albumAt = disc ? disc.album : ALBUMS.findIndex((al) => al.key === 'boss');
    const sleeve = document.querySelector('[data-album="' + albumAt + '"]');
    const row = i >= 0 ? document.querySelector('[data-sleeve="' + i + '"]') : null;
    if (row) row.classList.add('is-target');
    if (sleeve) {
      sleeve.classList.add('is-target');
      setTimeout(() => { if (OW.scrollToEl) OW.scrollToEl(sleeve); else sleeve.scrollIntoView(); }, 350);
    }
    if (!disc || !disc.src) return;
    const a = audio();
    state.disc = disc;
    showDisc(disc);
    a.src = disc.src;
    insertDisc();
    /* Pas d'ensureGraph() ici : sans geste, le contexte audio naitrait
       suspendu et couperait le son. Le premier clic le branche (mountDeck). */
    const go = a.play();
    if (go && go.catch) {
      go.catch(() => {
        const btn = $('[data-toggle]');
        btn.classList.add('is-nudge');
        btn.addEventListener('click', () => btn.classList.remove('is-nudge'), { once: true });
      });
    }
    paintDeck();
  }

  mountHeader();
  mountDeck();

  loadWikiData()
    .then((data) => bossTracks(data).then(() => data))
    .then((data) => {
      state.data = data;
      renderCrate(data);

      mountFooter(data, 'BANDE SON · OPERATION W.I.L.D');
      reveal();
      paintDeck();
      openRequested();
    })
    .catch((error) => {
      console.error(error);
      bossTracks(null).then(() => renderCrate(null));
    });
}(window.OW = window.OW || {}));
