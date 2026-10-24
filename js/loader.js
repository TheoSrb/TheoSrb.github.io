/* L'ecran de chargement du wiki.

   Chaque page du wiki est vide a l'arrivee : son contenu se construit en
   JavaScript une fois data/wiki_data.json telecharge, et dans une autre langue
   que le francais elle reste cachee quelques instants de plus, le temps que la
   traduction arrive. Entre les deux, il faut montrer quelque chose.

   Ce quelque chose : on marche. Tout l'ecran est le fond du site lui-meme —
   ses biomes, dessines par js/biome-world.js, dans un ordre tire au sort a
   chaque fois. On avance dans l'un, la vue dodeline a chaque pas, puis on passe dans
   le suivant avec la transition que le fond utilise quand on fait defiler la
   page. Une brume a la couleur de chaque biome baigne l'horizon.

   Au centre, la tete du panda roux sur un disque de bois : un anneau de
   segments qui s'allument avec l'avancee, une etincelle en tete de l'anneau,
   un halo qui bat au rythme des pas. Le panda cligne des yeux. A cent pour
   cent, on presse le pas, le medaillon s'eloigne doucement.

   Une pancarte de bois — le bois des compteurs, en grand, au bout de ses
   chaines — ouvre et ferme la scene : elle couvre l'ecran au debut et se
   leve sur la balade ; a la fin elle redescend, se pose, et remonte en
   decouvrant la page. Tout glisse : l'allure, le
   ciel, les frontieres entre biomes, la brume de chaque biome qui colore
   l'horizon — rien ne change d'un coup.

   Le voile lui-meme est pose par l'attribut data-booting, ecrit directement
   dans le HTML : ce fichier ne fait que l'habiller, le faire avancer, puis le
   lever.

   L'avancee ne ment pas : elle bouge sur de vrais jalons (le document analyse,
   les donnees du mod recues, la traduction posee). Entre deux jalons elle
   avance lentement, sans jamais depasser le suivant.

   Trois filets de securite, parce qu'un ecran de chargement bloque doit etre
   impossible : un delai maximum, une levee des que les conditions sont la, et
   la scene qui n'apparait qu'au bout de 180 ms — un chargement rapide ne
   montre donc jamais rien, pas meme un clignotement. */

(function (OW) {
  'use strict';

  const root = document.documentElement;
  /* Sans l'attribut, la page ne demarre pas sous un voile — mais l'ecran reste
     rejouable a la demande (onglet « Chargement » des Mecaniques). */
  const booting = root.hasAttribute('data-booting');

  const MAX = 4000;            /* jamais plus longtemps que ca, quoi qu'il arrive */
  const NO_DATA_AFTER = 1400;  /* une page sans donnees ne doit pas attendre */
  const EXIT_MS = 1900;        /* la pancarte tombe, se pose, puis on la hisse (css/base.css) */
  const QUICK_MS = 1550;       /* avant ca, la pancarte n'a pas fini de s'ouvrir (380 + 1150 ms) */

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Ce que l'ecran raconte, par seuil. Du francais, comme partout ailleurs
     dans le wiki : js/i18n.js le traduira quand il arrivera. */
  const SAYINGS = [
    [0, 'On part en balade…'],
    [30, 'On traverse la forêt…'],
    [55, 'On suit la piste du kodiak…'],
    [78, 'On ouvre le bestiaire…'],
    [99, 'Arrivés !']
  ];

  /* =========================================================================
     La balade dans les biomes du site

     Pas un decor de plus : ce sont les scenes du fond du site
     (js/biome-world.js, OW.biomeScene), les memes plans, soleils, brumes et
     silhouettes, tires au sort a chaque chargement.
     On avance dans chacune — la camera marche vers l'horizon, le premier plan
     passe plus vite que les lointains, la vue dodeline a chaque pas — puis on
     passe dans la suivante avec la traversee du site lui-meme
     (OW.biomeTravel) : le decor s'ecarte, et le biome suivant approche en
     se fondant par-dessus.
     ========================================================================= */

  const HOLD = 3.6;            /* le temps passe dans un biome, en secondes */
  const TRANS = 1.5;           /* dont la traversee vers le suivant */
  const STEP = 0.62;           /* la duree d'un pas */
  const WALK = 0.2;            /* ce que la camera avance dans un biome */

  /** Les biomes de la balade : tous ceux du site, tires au sort a chaque
      chargement (le circuit de l'accueil les liste tous). */
  function walkRoute() {
    const pages = (OW.BIOME_CONFIG && OW.BIOME_CONFIG.pages) || {};
    const list = (pages.index || []).slice();
    const ids = list.length ? list : ['jungle', 'forest', 'snow', 'savanna', 'desert', 'cherry', 'badlands'];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const x = ids[i]; ids[i] = ids[j]; ids[j] = x;
    }
    return ids;
  }

  /* Construire une scene coute quelques dizaines de millisecondes : on le fait
     quand le navigateur n'a rien d'autre a faire, jamais pendant une image. */
  const idle = window.requestIdleCallback
    ? (fn) => window.requestIdleCallback(fn, { timeout: 700 })
    : (fn) => setTimeout(fn, 60);

  function createWalk(host, onStep) {
    if (typeof OW.biomeScene !== 'function') return null;
    const ids = walkRoute();
    const scenes = [];
    let t = 0;
    let last = 0;
    let raf = 0;
    let pace = 1;
    let target = 1;
    let lastStep = 0;
    let queued = -1;
    let bobPx = -1;
    let travel = null;

    /* Une scene du site, habillee d'un voile de brume a sa couleur (--mist,
       la brume de sa palette). */
    function sceneAt(i) {
      const k = i % ids.length;
      if (scenes[k]) return scenes[k];
      const el = OW.biomeScene(ids[k], window.innerWidth);
      if (!el) return null;
      /* En plein ecran : les ambiances (nuages, oiseaux, reflets) restent. */
      el.classList.remove('is-live', 'is-mini');
      el.insertAdjacentHTML('beforeend', '<span class="boot-haze"></span>');
      host.appendChild(el);
      scenes[k] = el;
      return el;
    }
    const live = (el, on) => { if (el._on !== on) { el._on = on; el.classList.toggle('is-live', on); } };

    function render() {
      if (!travel) travel = OW.biomeTravel(host, null, { fade: true });
      const i = Math.floor(t / HOLD);
      const local = t - i * HOLD;
      const tr = Math.max(0, (local - (HOLD - TRANS)) / TRANS);
      const a = sceneAt(i);
      /* Le suivant n'est construit sur-le-champ que s'il n'a pas pu l'etre
         avant et qu'il faut deja le montrer. */
      const b = tr > 0 ? sceneAt(i + 1) : scenes[(i + 1) % ids.length];
      if (!a) return;
      scenes.forEach((s) => { if (s && s !== a && s !== b) live(s, false); });

      /* On avance dans le biome, puis on le traverse. Pendant la traversee,
         les deux scenes passent en mode « ca bouge » (css/base.css) : leurs
         plans deviennent des textures, leurs ambiances se figent. */
      const moving = tr > 0 && tr < 1;
      live(a, true);
      a.classList.toggle('is-moving', moving);
      a.style.zIndex = '1';
      if (b && b !== a) {
        live(b, tr > 0);
        b.classList.toggle('is-moving', moving);
        /* Celui qui arrive passe au-dessus (OW.biomeTravel). */
        b.style.zIndex = '2';
      }
      travel.apply(a, b !== a ? b : null, tr, WALK * Math.min(local, HOLD - TRANS) / (HOLD - TRANS));
      /* Le biome d'apres se prepare des qu'on est arrive, au calme. */
      if (queued !== i + 2) {
        queued = i + 2;
        const n = i + 2;
        idle(() => sceneAt(n));
      }

      /* Chaque pas : la vue descend et remonte en douceur. */
      const phase = (t % STEP) / STEP;
      const bob = (1 - Math.cos(phase * Math.PI * 2)) * 0.5;
      /* Au pixel pres : un decalage d'une fraction de pixel ferait scintiller
         les bords nets du decor. */
      const px = Math.round(bob * window.innerHeight * 0.0045);
      if (px !== bobPx) { bobPx = px; host.style.transform = 'translateY(' + px + 'px)'; }
      const stepIndex = Math.floor(t / STEP);
      if (stepIndex !== lastStep) { lastStep = stepIndex; if (onStep) onStep(); }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      pace += (target - pace) * Math.min(1, dt * 1.5);
      t += dt * pace;
      render();
    }

    return {
      start() {
        if (raf) return;
        last = 0;
        render();
        /* Le deuxieme biome est pret avant la premiere traversee. */
        idle(() => sceneAt(1));
        raf = requestAnimationFrame(frame);
      },
      still() { render(); },
      stop() { cancelAnimationFrame(raf); raf = 0; },
      pace() {},
      /* A la fin, on presse un peu le pas. */
      rush() { target = 2.2; },
      resize() {}
    };
  }

  /* =========================================================================
     Le voile
     ========================================================================= */

  let veil = null;
  let world = null;
  let demo = 0;            /* la levee d'une demonstration */
  let demoing = false;     /* une demonstration est en cours */
  let maxTimer = 0;        /* le filet du demarrage */
  let builtAt = 0;         /* quand le voile a ete pose */
  let pct = null;
  let label = null;
  let medal = null;
  let shown = 0;           /* ce que l'ecran affiche, en pourcents */
  let goal = 10;           /* le prochain jalon atteint */
  let raf = 0;
  let lifted = false;
  let saidAt = -1;

  /* ---- les jalons ------------------------------------------------------------- */

  let parsed = false;      /* le document est analyse */
  let dataSeen = false;    /* les donnees du mod sont arrivees (ou ne viendront pas) */

  const i18nPending = () => root.hasAttribute('data-i18n-pending');

  /* Pendant une demonstration, seuls ses propres jalons comptent. */
  function milestone(p, staged) {
    if (demoing && !staged) return;
    goal = Math.max(goal, Math.min(100, p));
  }

  function onResize() { if (world) world.resize(); }

  function build() {
    if (veil || lifted || !document.body) return;

    veil = document.createElement('div');
    veil.className = 'boot';
    /* Le lecteur d'ecran annonce le chargement, pas le decor. */
    veil.setAttribute('role', 'status');
    veil.setAttribute('aria-live', 'polite');
    veil.innerHTML = '<div class="boot-world" aria-hidden="true"><div class="boot-walk"></div></div>'
      + '<span class="boot-vignette" aria-hidden="true"></span>'
      + '<div class="boot-center">'
      + '<img class="boot-mark" src="assets/wordmark.png" alt="Operation W.I.L.D" width="260" height="74">'
      + '<div class="boot-medal" aria-hidden="true">'
      + '<span class="boot-halo"></span>'
      + '<span class="boot-orbit"></span>'
      + '<span class="boot-ring"></span>'
      + '<span class="boot-spark"><i></i></span>'
      + '<span class="boot-core">'
      + '<span class="boot-panda">'
      + '<img src="assets/heads/red_panda.png" alt="" width="932" height="653">'
      + '<i class="boot-lid is-l"></i><i class="boot-lid is-r"></i>'
      + '</span>'
      + '</span>'
      + '</div>'
      + '<span class="boot-pct" aria-hidden="true">0<small>%</small></span>'
      + '<span class="boot-label">' + SAYINGS[0][1] + '</span>'
      + '</div>'
      /* La pancarte : elle couvre l'ecran, se leve pour ouvrir la balade, et
         redescend la fermer quand la page est prete. */
      + '<div class="boot-sign" aria-hidden="true">'
      + '<span class="boot-chains"></span>'
      + '<div class="boot-board">'
      + '<img class="boot-board-mark" src="assets/wordmark.png" alt="" width="260" height="74">'
      + '<span class="boot-board-say">Chargement…</span>'
      + '</div>'
      + '</div>';

    document.body.appendChild(veil);
    builtAt = performance.now();
    pct = veil.querySelector('.boot-pct');
    label = veil.querySelector('.boot-label');
    medal = veil.querySelector('.boot-medal');

    const host = veil.querySelector('.boot-walk');
    try {
      /* A chaque pas, le medaillon bat : le panda marche avec nous. */
      world = createWalk(host, () => {
        if (!medal) return;
        medal.classList.remove('is-step');
        void medal.offsetWidth;
        medal.classList.add('is-step');
      });
      if (world && reduced()) world.still();
      else if (world) world.start();
      window.addEventListener('resize', onResize);
    } catch (e) {
      world = null;
    }
    paint();
  }

  /* ---- l'avancee ---------------------------------------------------------------- */

  function paint() {
    raf = 0;
    if (lifted) return;
    /* Un dixieme de ce qui reste a parcourir par image : le compteur ralentit
       en approchant du jalon au lieu de s'y cogner. */
    shown += Math.max(0.12, (goal - shown) * 0.08);
    if (shown > goal) shown = goal;
    render(shown);
    raf = requestAnimationFrame(paint);
  }

  /** Le pourcentage, l'anneau, la phrase, et l'allure de la marche. */
  function render(value) {
    if (!veil) return;
    const whole = Math.round(value);
    if (pct && pct.dataset.v !== String(whole)) {
      pct.dataset.v = String(whole);
      pct.firstChild.nodeValue = String(whole);
      veil.style.setProperty('--p', String(whole));
    }
    if (world) world.pace(value);
    say(value);
  }

  /** La phrase suit les jalons, et ne se repete pas. */
  function say(value) {
    if (!label) return;
    let at = 0;
    for (let i = 0; i < SAYINGS.length; i++) if (value >= SAYINGS[i][0]) at = i;
    if (at === saidAt) return;
    saidAt = at;
    label.textContent = SAYINGS[at][1];
    label.classList.remove('is-new');
    void label.offsetWidth;
    label.classList.add('is-new');
  }

  /* ---- la levee ------------------------------------------------------------------ */

  function ready() {
    return parsed && dataSeen && !i18nPending();
  }

  function lift() {
    if (lifted) return;
    lifted = true;
    clearTimeout(demo);
    clearTimeout(maxTimer);
    root.removeAttribute('data-booting');
    root.classList.remove('boot-late');
    if (!veil) return;
    cancelAnimationFrame(raf);
    /* Le compteur finit sa course : on ne laisse pas un chargement arrete en
       chemin. Puis on presse le pas. */
    render(100);
    const leaving = veil;
    const leavingWorld = world;
    /* Un chargement tres court n'a pas le temps d'ouvrir la pancarte : on ne
       la fait pas redescendre pour rien, le voile s'efface. */
    const quick = performance.now() - builtAt < QUICK_MS;
    const say = leaving.querySelector('.boot-board-say');
    if (say) say.textContent = 'C’est parti !';
    leaving.classList.add(quick ? 'is-quick' : 'is-gone');
    if (leavingWorld) leavingWorld.rush();
    veil = null;
    world = null;
    medal = null;
    window.removeEventListener('resize', onResize);
    const off = () => {
      if (leavingWorld) leavingWorld.stop();
      if (leaving.parentNode) leaving.parentNode.removeChild(leaving);
    };
    if (reduced()) off();
    else setTimeout(off, quick ? 320 : EXIT_MS);
  }

  /** Leve le voile des que tout est pret, une fois la page peinte. */
  function settle() {
    /* Une demonstration se leve a son heure, pas sur les signaux du demarrage. */
    if (demoing || !ready()) return;
    milestone(100);
    /* Une demonstration lancee entre-temps garde la main. */
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!demoing) lift(); }));
  }

  /* ---- les signaux ---------------------------------------------------------------- */

  function onParsed() {
    parsed = true;
    milestone(38);
    build();
    settle();
  }

  /* Arrivee par une transition entre pages : le decor glisse d'abord, voile
     invisible et fige (css/base.css, boot-wait) ; ensuite seulement, si la
     page n'est pas prete, le voile se pose et joue sa scene (boot-late). */
  if (booting) window.addEventListener('pagereveal', (event) => {
    if (!event.viewTransition) return;
    root.classList.add('boot-wait');
    event.viewTransition.finished.finally(() => {
      root.classList.remove('boot-wait');
      if (!lifted) root.classList.add('boot-late');
    });
  });

  /* Le voile se pose des que le decor existe, avant la premiere image de la
     page : il entre ainsi dans la transition entre pages (css/ux.css). */
  if (booting) document.addEventListener('ow:world', build);

  if (booting) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onParsed);
    else onParsed();
  }

  /* Les donnees du mod : js/wiki-data.js previent des qu'elles sont normalisees. */
  if (booting) document.addEventListener('ow:data', () => {
    dataSeen = true;
    milestone(76);
    settle();
  });

  /* Une page qui ne lit pas les donnees (ou qui les a deja en cache) ne doit pas
     attendre pour rien. */
  if (booting) setTimeout(() => { dataSeen = true; settle(); }, NO_DATA_AFTER);

  /* La traduction pose puis leve son propre voile : on suit le sien. */
  if (booting && i18nPending() && 'MutationObserver' in window) {
    const eye = new MutationObserver(() => {
      if (i18nPending()) return;
      eye.disconnect();
      milestone(92);
      settle();
    });
    eye.observe(root, { attributes: true, attributeFilter: ['data-i18n-pending'] });
  }

  if (booting) window.addEventListener('load', () => { milestone(88); settle(); });

  /* Le filet : passe ce delai, la page s'affiche quoi qu'il arrive. */
  maxTimer = booting ? setTimeout(lift, MAX) : 0;

  /* ---- rejouer l'ecran, pour le regarder ------------------------------------------
     Pour les essais, depuis la console (OW.showBoot(4200)) : sur une machine
     rapide, l'ecran passe trop vite pour qu'on puisse le juger. Ici il prend
     son temps, s'arrete a chaque jalon, puis se leve comme au demarrage. */

  function showBoot(ms) {
    const span = Math.max(1200, ms || 4200);
    clearTimeout(demo);
    demoing = true;
    clearTimeout(maxTimer);
    if (world) world.stop();
    if (veil && veil.parentNode) veil.parentNode.removeChild(veil);
    veil = null;
    world = null;
    lifted = false;
    shown = 0;
    goal = 10;
    saidAt = -1;
    root.setAttribute('data-booting', '');
    build();
    if (veil) {
      veil.classList.add('is-demo');
      veil.addEventListener('click', lift);
    }
    /* Les memes jalons que pour de vrai, simplement etales. */
    const marks = [[.10, 38], [.36, 62], [.60, 78], [.82, 92], [.96, 100]];
    marks.forEach(([at, p]) => setTimeout(() => { if (!lifted) milestone(p, true); }, span * at));
    demo = setTimeout(lift, span);
    return span;
  }

  OW.bootDone = lift;
  OW.showBoot = showBoot;
}(window.OW = window.OW || {}));
