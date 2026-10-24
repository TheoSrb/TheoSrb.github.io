/* La table de sons d'une fiche de creature — des sons qu'on ecoute vraiment.

   Chaque son exporte par le mod devient un pad : un bouton de lecture, la
   vraie forme d'onde du fichier (calculee a partir de l'audio decode, pas
   dessinee au hasard), sa duree, une barre de progression qui avance pendant
   la lecture. Au-dessus, la console : ce qui joue, un oscilloscope branche
   sur la sortie audio, le volume, la lecture aleatoire, l'enchainement, et la
   bascule entre les sons normaux et ceux du skin « Virus ».

   Les fichiers suivent la convention du wiki :
     assets/sounds/<espece>/<chemin du son>.ogg   (et sa jumelle .mp3)
   Safari ne lit pas l'OGG : on choisit le format que le navigateur sait lire.
   Un son dont le fichier n'est pas encore depose reste liste, grise, dans un
   tiroir a part : deposer le fichier au bon nom suffit a le rendre ecoutable.

   Raccourcis, quand la table est a l'ecran : 1 a 9 jouent les pads visibles,
   Echap coupe le son. */

(function (OW) {
  'use strict';

  const esc = (v) => (OW.escapeHtml ? OW.escapeHtml(v) : String(v));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const VOLUME_KEY = 'ow-sound-volume';

  function storedVolume() {
    try {
      const v = parseFloat(window.localStorage.getItem(VOLUME_KEY));
      if (v >= 0 && v <= 1) return v;
    } catch (e) { /* stockage bloque : volume par defaut */ }
    return 0.8;
  }

  /* Le type d'un son se lit dans son chemin. */
  const FAMILIES = [
    { key: 'attack', re: /attack|bite|roar|rugiss|crush|hit|slam|strike|scream/i, label: 'Attaque', color: '#F2A32C' },
    { key: 'hurt', re: /hurt|damage|pain/i, label: 'Blessure', color: '#E0654F' },
    { key: 'death', re: /death|die/i, label: 'Mort', color: '#B07AC9' },
    { key: 'move', re: /step|walk|run|jump|slither|footstep|swim/i, label: 'Mouvement', color: '#9BC53D' },
    { key: 'idle', re: /idle|ambient|breath|call|misc/i, label: 'Ambiance', color: '#3AB0D8' },
    { key: 'rest', re: /snore|sleep|nap|sniff/i, label: 'Repos', color: '#8A9ED8' },
    { key: 'tame', re: /tam|eat|feed/i, label: 'Apprivoisement', color: '#D17948' }
  ];
  const OTHER = { key: 'other', label: 'Divers', color: '#A19791' };

  function familyOf(path) {
    return FAMILIES.find((f) => f.re.test(path)) || OTHER;
  }

  /* « tiger_roar_ultimate » devient « Rugissement ultime ». */
  const WORDS = {
    roar: 'Rugissement', ultimate: 'ultime', idle: 'Ambiance', hurt: 'Blessure', hurting: 'Douleur',
    jump: 'Saut', no: 'sans', loop: 'boucle', snore: 'Ronflement', sniff: 'Reniflement', sniffing: 'Reniflement',
    misc: 'Divers', hit: 'Coup', hitting: 'Frappe', death: 'Mort', slither: 'Glissement', footstep: 'Pas',
    scream: 'Cri', call: 'Appel', mouth: 'mâchoires', crush: 'Broyage', virus: 'Virus', attack: 'Attaque',
    bite: 'Morsure', step: 'Pas', walk: 'Marche', run: 'Course', eat: 'Repas', swim: 'Nage'
  };

  function prettyName(path, slug) {
    /* Un nom ecrit dans js/assets-config.js (sounds) l'emporte. */
    const named = OW.ASSETS_CONFIG && OW.ASSETS_CONFIG.sounds && OW.ASSETS_CONFIG.sounds[path];
    if (named) return { label: named, virus: /(^|_)virus(_|$)/.test(path) };
    let rest = String(path).replace(new RegExp('^' + slug + '_?'), '');
    if (!rest) rest = path;
    const words = rest.split('_').filter(Boolean);
    const virus = words.indexOf('virus') !== -1;
    const out = [];
    words.filter((w) => w !== 'virus').forEach((w) => {
      if (/^\d+$/.test(w)) { out.push(w); return; }
      out.push(WORDS[w] || w);
    });
    if (!out.length) out.push(slug);
    /* « tiger3 » : un son sans nom, seulement un numero. */
    if (out.length === 1 && /^\d+$/.test(out[0])) out.unshift('Son');
    /* Un chiffre colle au nom (« tiger3 ») se lit comme une variante. */
    let label = out.join(' ').replace(/([a-z])(\d)$/i, '$1 $2');
    label = label.charAt(0).toUpperCase() + label.slice(1);
    return { label, virus };
  }

  /* ===========================================================================
     Fichiers : format lisible, existence, forme d'onde
     =========================================================================== */

  const probe = document.createElement('audio');
  const oggOk = !!(probe.canPlayType && probe.canPlayType('audio/ogg; codecs="vorbis"').replace(/no/, ''));
  const mp3Ok = !!(probe.canPlayType && probe.canPlayType('audio/mpeg').replace(/no/, ''));

  function candidates(slug, path) {
    const base = 'assets/sounds/' + slug + '/' + path;
    const list = [];
    if (oggOk) list.push(base + '.ogg');
    if (mp3Ok) list.push(base + '.mp3');
    if (!list.length) list.push(base + '.mp3');
    return list;
  }

  const existCache = {};
  function exists(url) {
    if (!existCache[url]) {
      existCache[url] = fetch(url, { method: 'HEAD', cache: 'force-cache' })
        .then((r) => r.ok)
        .catch(() => false);
    }
    return existCache[url];
  }

  async function resolveFile(slug, path) {
    /* En ligne, l'inventaire (js/asset-list.js) dit d'avance quel fichier
       existe : celui-la se prend sans requete. Un son absent de l'inventaire
       est quand meme cherche — un fichier depose sans relancer l'outil doit
       devenir ecoutable. */
    const all = candidates(slug, path);
    const tries = OW.worthTrying ? OW.worthTrying(all) : all.map((url) => ({ url, sure: false }));
    for (const { url, sure } of tries) {
      /* eslint-disable no-await-in-loop -- l'ordre donne la preference de format */
      if (sure || await exists(url)) return url;
    }
    return null;
  }

  let decodeCtx = null;
  function getDecodeCtx() {
    if (decodeCtx) return decodeCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { decodeCtx = new AC(); } catch (e) { decodeCtx = null; }
    return decodeCtx;
  }

  const peakCache = {};
  /** Les crêtes d'un fichier, en `bars` colonnes, et sa duree exacte. */
  function peaksOf(url, bars) {
    if (peakCache[url]) return peakCache[url];
    peakCache[url] = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((buffer) => new Promise((resolve, reject) => {
        const ctx = getDecodeCtx();
        if (!ctx) { reject(new Error('no audio')); return; }
        /* L'ancienne signature (callbacks) est la seule que Safari accepte partout. */
        ctx.decodeAudioData(buffer, resolve, reject);
      }))
      .then((audio) => {
        const data = audio.getChannelData(0);
        const step = Math.max(1, Math.floor(data.length / bars));
        const peaks = [];
        let max = 0;
        for (let b = 0; b < bars; b++) {
          let peak = 0;
          const from = b * step;
          const to = Math.min(data.length, from + step);
          for (let i = from; i < to; i += 8) {
            const v = Math.abs(data[i]);
            if (v > peak) peak = v;
          }
          peaks.push(peak);
          if (peak > max) max = peak;
        }
        return { peaks: peaks.map((p) => (max ? p / max : 0)), duration: audio.duration };
      })
      .catch(() => null);
    return peakCache[url];
  }

  function drawWave(canvas, peaks, color) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 200;
    const h = canvas.clientHeight || 40;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const bars = peaks.length;
    const gap = 2;
    const bw = Math.max(1, (w - gap * (bars - 1)) / bars);
    ctx.fillStyle = color;
    for (let i = 0; i < bars; i++) {
      /* Des barres en marches de 2 px : l'onde reste pixelisee, comme le reste. */
      const bh = Math.max(2, Math.round((peaks[i] * (h - 4)) / 2) * 2);
      ctx.fillRect(Math.round(i * (bw + gap)), Math.round((h - bh) / 2), Math.ceil(bw), bh);
    }
  }

  function fmt(seconds) {
    if (!seconds || !isFinite(seconds)) return '—';
    if (seconds < 10) return seconds.toFixed(1).replace('.', ',') + ' s';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ===========================================================================
     Le composant
     =========================================================================== */

  function mount(host, entity, noteEl, extra) {
    /* Les sons de la bete, plus ceux du registre global qui portent son nom
       sans figurer dans sa liste (tiger3, tiger4...). */
    const own = (entity.sounds || []).slice();
    const known = new Set(own.map((s) => s.path));
    (extra || []).forEach((s) => {
      if (known.has(s.path)) return;
      if (!new RegExp('^' + entity.slug + '(\\d|_)').test(s.path)) return;
      known.add(s.path);
      own.push(s);
    });
    const sounds = own.map((s) => {
      const name = prettyName(s.path, entity.slug);
      return Object.assign({}, s, { family: familyOf(s.path), label: name.label, virus: name.virus, url: null });
    });

    if (!sounds.length) {
      host.innerHTML = '<p class="empty-note">Aucun son exporté pour cette créature.</p>';
      if (noteEl) noteEl.textContent = 'Les sons de cette créature ne sont pas encore enregistrés dans le mod.';
      return;
    }

    const hasVirus = sounds.some((s) => s.virus);
    const state = { family: 'all', virus: false, playing: null, chain: false, volume: storedVolume() };

    host.classList.add('sb');
    host.innerHTML = `
      <div class="sb-deck">
        <button type="button" class="sb-deck-play" data-sb-main aria-label="Lecture aléatoire">
          <svg viewBox="0 0 16 16" aria-hidden="true" data-sb-main-icon><path d="M4 2h2v1h2v1h2v1h2v1h1v4h-1v1h-2v1H8v1H6v1H4z"/></svg>
        </button>
        <div class="sb-now">
          <span class="sb-now-kicker" data-sb-kicker>TABLE DE SONS</span>
          <b class="sb-now-name" data-sb-now>Aucun son choisi</b>
          <canvas class="sb-scope" data-sb-scope aria-hidden="true"></canvas>
        </div>
        <div class="sb-controls">
          <button type="button" class="sb-ctl" data-sb-shuffle title="Jouer un son au hasard">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 4h3v1h1v1h1v1H5V6H4V5H1zM1 11h3v-1h1V9h1v1h1v1h1v1H6v-1H5v1H1zM9 5h3V3h1v1h1v1h1v1h-1v1h-1v1h-1V6H9v1H8V6h1zM9 10h3V8h1v1h1v1h1v1h-1v1h-1v1h-1v-2H9z"/></svg>
            <span>Au hasard</span>
          </button>
          <button type="button" class="sb-ctl" data-sb-chain aria-pressed="false" title="Enchaîner tous les sons visibles">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h9v2h1v2h-2V5H4v6h2v2H2zM6 7h2v4h4V7H9V5h5v8H6z"/></svg>
            <span>Enchaîner</span>
          </button>
          ${hasVirus ? `
          <button type="button" class="sb-ctl sb-ctl-virus" data-sb-virus aria-pressed="false" title="Sons du skin Virus">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 1h2v2h1v1h1V3h2v2h-1v1h1v1h2v2h-2v1h-1v1h1v2h-2v-1h-1v1H9v2H7v-2H6v1H4v-2h1v-1H4V9H2V7h2V6h1V5H4V3h2v1h1zM7 6v4h2V6z"/></svg>
            <span>Skin Virus</span>
          </button>` : ''}
          <label class="sb-volume" title="Volume">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2zM11 5h1v1h1v4h-1v1h-1v-1h1V6h-1z"/></svg>
            <input type="range" min="0" max="100" step="1" value="${Math.round(state.volume * 100)}" data-sb-volume aria-label="Volume">
          </label>
        </div>
      </div>
      <div class="sb-filters" data-sb-filters role="group" aria-label="Familles de sons"></div>
      <div class="sb-grid" data-sb-grid></div>
      <details class="sb-missing" data-sb-missing hidden>
        <summary><span data-sb-missing-count></span></summary>
        <div class="sb-missing-list" data-sb-missing-list></div>
      </details>`;

    const $ = (sel) => host.querySelector(sel);
    const grid = $('[data-sb-grid]');
    const scope = $('[data-sb-scope]');
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = state.volume;

    /* ---- l'oscilloscope ---------------------------------------------------------- */

    let graph = null;
    function ensureGraph() {
      if (graph !== null) return graph;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { graph = false; return graph; }
      try {
        const ctx = new AC();
        const src = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        graph = { ctx, analyser, data: new Uint8Array(analyser.frequencyBinCount) };
      } catch (e) {
        graph = false;
      }
      return graph;
    }

    let scopeFrame = 0;
    function drawScope() {
      scopeFrame = 0;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const w = scope.clientWidth, h = scope.clientHeight;
      if (scope.width !== Math.round(w * ratio)) { scope.width = Math.round(w * ratio); scope.height = Math.round(h * ratio); }
      const ctx = scope.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const color = state.playing ? state.playing.family.color : '#3A4A3C';
      const bars = 32;
      const bw = w / bars;
      if (graph && state.playing && !audio.paused) {
        graph.analyser.getByteFrequencyData(graph.data);
        for (let i = 0; i < bars; i++) {
          const v = graph.data[Math.floor(i * graph.data.length / bars / 1.4)] / 255;
          const cells = Math.round(v * (h / 4));
          for (let c = 0; c < cells; c++) {
            ctx.fillStyle = c > (h / 4) * .75 ? '#FFFFFF' : color;
            ctx.fillRect(Math.round(i * bw) + 1, h - (c + 1) * 4 + 1, Math.max(1, Math.round(bw) - 2), 3);
          }
        }
      } else {
        ctx.fillStyle = color;
        for (let i = 0; i < bars; i++) ctx.fillRect(Math.round(i * bw) + 1, h - 3, Math.max(1, Math.round(bw) - 2), 2);
      }
      if (state.playing && !audio.paused) scopeFrame = requestAnimationFrame(drawScope);
    }

    /* ---- rendu des pads ------------------------------------------------------------ */

    function visible() {
      return sounds.filter((s) => s.url && s.virus === state.virus
        && (state.family === 'all' || s.family.key === state.family));
    }

    function renderFilters() {
      const pool = sounds.filter((s) => s.url && s.virus === state.virus);
      const counts = {};
      pool.forEach((s) => { counts[s.family.key] = (counts[s.family.key] || 0) + 1; });
      const fams = FAMILIES.concat([OTHER]).filter((f) => counts[f.key]);
      $('[data-sb-filters]').innerHTML = [`<button type="button" class="sb-chip" data-sb-family="all" aria-pressed="${state.family === 'all'}">Tous<em>${pool.length}</em></button>`]
        .concat(fams.map((f) => `<button type="button" class="sb-chip" data-sb-family="${f.key}" style="--fam:${f.color}" aria-pressed="${state.family === f.key}"><i aria-hidden="true"></i>${esc(f.label)}<em>${counts[f.key]}</em></button>`))
        .join('');
    }

    function padHtml(s, i) {
      return `
        <button type="button" class="sb-pad" data-sb-pad="${esc(s.id)}" style="--fam:${s.family.color};--i:${i}"
                aria-label="Écouter : ${esc(s.label)}">
          <span class="sb-pad-top">
            <span class="sb-fam">${esc(s.family.label)}</span>
            <span class="sb-dur" data-sb-dur>${s.duration ? fmt(s.duration) : '…'}</span>
          </span>
          <span class="sb-wave">
            <canvas data-sb-wave aria-hidden="true"></canvas>
            <span class="sb-wave-prog" aria-hidden="true"></span>
          </span>
          <span class="sb-pad-bottom">
            <span class="sb-play" aria-hidden="true">
              <svg class="sb-i-play" viewBox="0 0 16 16"><path d="M4 2h2v1h2v1h2v1h2v1h1v4h-1v1h-2v1H8v1H6v1H4z"/></svg>
              <svg class="sb-i-stop" viewBox="0 0 16 16"><path d="M3 3h4v10H3zM9 3h4v10H9z"/></svg>
            </span>
            <span class="sb-name">${esc(s.label)}</span>
            ${i < 9 ? `<kbd class="sb-key">${i + 1}</kbd>` : ''}
          </span>
          <small class="sb-path">${esc(s.path)}</small>
        </button>`;
    }

    function renderGrid() {
      const list = visible();
      grid.innerHTML = list.length
        ? list.map(padHtml).join('')
        : '<p class="sb-empty">Aucun son écoutable dans cette famille pour le moment.</p>';
      list.forEach((s) => paintPad(s));
      if (state.playing) markPlaying(state.playing);
    }

    function padEl(s) {
      return grid.querySelector('[data-sb-pad="' + CSS.escape(s.id) + '"]');
    }

    function paintPad(s) {
      const el = padEl(s);
      if (!el) return;
      const canvas = el.querySelector('[data-sb-wave]');
      if (s.peaks) {
        drawWave(canvas, s.peaks, s.family.color);
        el.querySelector('[data-sb-dur]').textContent = fmt(s.duration);
        return;
      }
      /* Tant que l'onde n'est pas calculee, une ligne plate. */
      drawWave(canvas, new Array(40).fill(.06), 'rgba(255,255,255,.25)');
      peaksOf(s.url, 40).then((res) => {
        if (!res) return;
        s.peaks = res.peaks;
        s.duration = res.duration;
        const now = padEl(s);
        if (!now) return;
        drawWave(now.querySelector('[data-sb-wave]'), s.peaks, s.family.color);
        now.querySelector('[data-sb-dur]').textContent = fmt(s.duration);
      });
    }

    function renderMissing() {
      const missing = sounds.filter((s) => !s.url);
      const box = $('[data-sb-missing]');
      box.hidden = !missing.length;
      if (!missing.length) return;
      $('[data-sb-missing-count]').textContent = missing.length + (missing.length > 1
        ? ' sons exportés, pas encore ajoutés au wiki'
        : ' son exporté, pas encore ajouté au wiki');
      $('[data-sb-missing-list]').innerHTML = missing.map((s) => `
        <span class="sb-miss" style="--fam:${s.family.color}">
          <i aria-hidden="true"></i><b>${esc(s.label)}${s.virus ? ' · Virus' : ''}</b><small>${esc(s.path)}</small>
        </span>`).join('');
    }

    /* ---- lecture ---------------------------------------------------------------- */

    let progressFrame = 0;
    function tickProgress() {
      progressFrame = 0;
      if (!state.playing) return;
      const el = padEl(state.playing);
      if (el && audio.duration) el.style.setProperty('--p', (audio.currentTime / audio.duration).toFixed(4));
      if (!audio.paused) progressFrame = requestAnimationFrame(tickProgress);
    }

    function markPlaying(s) {
      grid.querySelectorAll('.sb-pad.is-playing').forEach((el) => {
        el.classList.remove('is-playing');
        el.style.removeProperty('--p');
      });
      const el = s && padEl(s);
      if (el) el.classList.add('is-playing');
      host.classList.toggle('is-live', !!s);
      $('[data-sb-main-icon]').innerHTML = s
        ? '<path d="M3 3h4v10H3zM9 3h4v10H9z"/>'
        : '<path d="M4 2h2v1h2v1h2v1h2v1h1v4h-1v1h-2v1H8v1H6v1H4z"/>';
      $('[data-sb-main]').setAttribute('aria-label', s ? 'Couper le son' : 'Lecture aléatoire');
      $('[data-sb-now]').textContent = s ? s.label + (s.virus ? ' · Virus' : '') : 'Aucun son choisi';
      $('[data-sb-kicker]').textContent = s ? 'EN LECTURE · ' + s.family.label.toUpperCase() : 'TABLE DE SONS';
      host.style.setProperty('--now', s ? s.family.color : '#3A4A3C');
    }

    function stop() {
      audio.pause();
      state.playing = null;
      markPlaying(null);
      cancelAnimationFrame(progressFrame);
      drawScope();
    }

    function play(s) {
      if (!s || !s.url) return;
      if (state.playing === s && !audio.paused) { stop(); return; }
      ensureGraph();
      if (graph && graph.ctx.state === 'suspended') graph.ctx.resume();
      state.playing = s;
      audio.src = s.url;
      audio.currentTime = 0;
      const attempt = audio.play();
      if (attempt && attempt.catch) attempt.catch(() => stop());
      markPlaying(s);
      if (!reduced) { cancelAnimationFrame(scopeFrame); scopeFrame = requestAnimationFrame(drawScope); }
      cancelAnimationFrame(progressFrame);
      progressFrame = requestAnimationFrame(tickProgress);
    }

    function playRandom() {
      const list = visible();
      if (!list.length) return;
      let pick = list[Math.floor(Math.random() * list.length)];
      if (list.length > 1 && pick === state.playing) pick = list[(list.indexOf(pick) + 1) % list.length];
      play(pick);
    }

    audio.addEventListener('ended', () => {
      const done = state.playing;
      const el = done && padEl(done);
      if (el) el.style.setProperty('--p', '1');
      if (state.chain) {
        const list = visible();
        const next = list[list.indexOf(done) + 1];
        if (next) { setTimeout(() => play(next), 280); return; }
        state.chain = false;
        $('[data-sb-chain]').setAttribute('aria-pressed', 'false');
      }
      setTimeout(() => { if (state.playing === done && audio.paused) stop(); }, 400);
    });
    audio.addEventListener('error', () => { if (state.playing) stop(); });

    /* ---- evenements ---------------------------------------------------------------- */

    host.addEventListener('click', (e) => {
      const pad = e.target.closest('[data-sb-pad]');
      if (pad) {
        const s = sounds.find((x) => x.id === pad.dataset.sbPad);
        /* Un clic sur l'onde lance la lecture a l'endroit vise. */
        const wave = e.target.closest('.sb-wave');
        if (wave && state.playing === s && !audio.paused && audio.duration) {
          const r = wave.getBoundingClientRect();
          audio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * audio.duration;
          return;
        }
        play(s);
        return;
      }
      const fam = e.target.closest('[data-sb-family]');
      if (fam) {
        state.family = fam.dataset.sbFamily;
        renderFilters();
        renderGrid();
        return;
      }
      if (e.target.closest('[data-sb-main]')) {
        if (state.playing && !audio.paused) stop();
        else playRandom();
        return;
      }
      if (e.target.closest('[data-sb-shuffle]')) { playRandom(); return; }
      if (e.target.closest('[data-sb-chain]')) {
        state.chain = !state.chain;
        $('[data-sb-chain]').setAttribute('aria-pressed', String(state.chain));
        if (state.chain && (!state.playing || audio.paused)) play(visible()[0]);
        return;
      }
      if (e.target.closest('[data-sb-virus]')) {
        state.virus = !state.virus;
        $('[data-sb-virus]').setAttribute('aria-pressed', String(state.virus));
        state.family = 'all';
        stop();
        renderFilters();
        renderGrid();
      }
    });

    $('[data-sb-volume]').addEventListener('input', (e) => {
      state.volume = Math.max(0, Math.min(1, e.target.value / 100));
      audio.volume = state.volume;
      try { localStorage.setItem(VOLUME_KEY, String(state.volume)); } catch (err) { /* rien */ }
    });

    /* Les chiffres jouent les pads, mais seulement quand la table est a l'ecran. */
    let onScreen = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { onScreen = entries.some((en) => en.isIntersecting); }).observe(host);
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.playing) { stop(); return; }
      if (!onScreen || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (/^[1-9]$/.test(e.key)) {
        const s = visible()[+e.key - 1];
        if (s) { e.preventDefault(); play(s); }
      }
    });

    /* Redessine les ondes si la largeur des pads change. */
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => visible().forEach((s) => { if (s.peaks) paintPad(s); }), 150);
    }, { passive: true });

    /* ---- chargement : on cherche les fichiers quand la table approche -------------- */

    function load() {
      grid.innerHTML = '<p class="sb-empty">Recherche des fichiers audio…</p>';
      Promise.all(sounds.map((s) => resolveFile(entity.slug, s.path).then((url) => { s.url = url; })))
        .then(() => {
          const playable = sounds.filter((s) => s.url);
          if (!playable.some((s) => s.virus === state.virus) && playable.length) state.virus = playable[0].virus;
          /* La bascule Virus n'a de sens que si les deux jeux de sons existent. */
          const virusBtn = $('[data-sb-virus]');
          if (virusBtn) {
            virusBtn.hidden = !(playable.some((s) => s.virus) && playable.some((s) => !s.virus));
            virusBtn.setAttribute('aria-pressed', String(state.virus));
          }
          renderFilters();
          renderGrid();
          renderMissing();
          drawScope();
          if (noteEl) {
            noteEl.textContent = playable.length
              ? playable.length + ' son' + (playable.length > 1 ? 's' : '') + ' écoutable' + (playable.length > 1 ? 's' : '')
                + ' sur ' + sounds.length + ' exporté' + (sounds.length > 1 ? 's' : '') + ' par le mod, variantes de skin comprises.'
                + ' Touches 1 à 9 pour jouer, Échap pour couper.'
              : sounds.length + ' sons exportés par le mod. Leurs fichiers audio n\'ont pas encore été ajoutés au wiki.';
          }
          if (!playable.length) {
            host.classList.add('is-silent');
            grid.innerHTML = '<p class="sb-empty">Aucun fichier audio pour cette créature pour le moment.</p>';
          }
        });
    }

    let loaded = false;
    const loadOnce = () => { if (loaded) return; loaded = true; load(); };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (!entries.some((en) => en.isIntersecting)) return;
        io.disconnect();
        loadOnce();
      }, { rootMargin: '600px 0px' });
      io.observe(host);
      /* Filet de securite : quelques requetes HEAD legeres, de toute facon. */
      setTimeout(loadOnce, 4000);
    } else {
      loadOnce();
    }
    markPlaying(null);
  }

  OW.mountSoundboard = mount;
  /* Les outils de la table, pour d'autres pages (musique) : le nom lisible
     d'un son, sa famille, et le fichier que ce navigateur sait lire. */
  OW.soundKit = { prettyName, familyOf, resolveFile, FAMILIES, OTHER };
}(window.OW = window.OW || {}));
