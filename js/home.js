/* Page d'accueil : scene d'ouverture, chiffres du mod, bandeau defilant,
   bestiaire, grille des domaines et lecteur du theme principal. */

(function (OW) {
  'use strict';

  const {
    loadWikiData, mountHeader, mountFooter, reveal, escapeHtml, animalHref,
    archetypeIcon, contrastInk, formatTime, num, bg, tintStyle, startEmbers, plural
  } = OW;

  const DIET_LABEL = { CARNIVOROUS: 'Carnivore', VEGETARIAN: 'Végétarien', OMNIVOROUS: 'Omnivore' };

  /* ===========================================================================
     Cadre d'ouverture
     =========================================================================== */

  /* Le decor d'ouverture (la jungle et la troupe) est trace par
     js/biome-world.js ; il ne reste ici que le chiffre des creatures. */
  function initHero(data) {
    const count = document.querySelector('[data-hero-count]');
    if (count && data) count.textContent = data.entities.length;
  }

  /* ===========================================================================
     Les chiffres du mod
     =========================================================================== */

  /**
   * Cinq chiffres : trois tires des donnees du mod, les telechargements lus
   * sur CurseForge, et la version. Chacun est un panneau de chene suspendu,
   * ecrit a l'encre luisante (la couleur du chiffre, cernee de brun, comme un
   * panneau de Minecraft passe au sac d'encre luisante).
   *
   * Au premier passage a l'ecran, chaque nombre part de zero et atteint sa
   * valeur en une seconde, tous ensemble.
   */

  /* Le projet CurseForge. Les telechargements passent par CFWidget, un service
     public qui n'a besoin d'aucune cle ; l'identifiant numerique est celui de
     la page du projet (« Project ID »). Le total est garde une heure dans le
     navigateur pour ne pas interroger le service a chaque visite. */
  const CURSEFORGE_ID = 1349902;
  const VERSION_LABEL = 'Bêta 0.1';
  const DOWNLOADS_CACHE = 'ow-cf-downloads';
  const COUNT_MS = 1000;

  function fetchDownloads() {
    try {
      const cached = JSON.parse(localStorage.getItem(DOWNLOADS_CACHE) || 'null');
      if (cached && Date.now() - cached.at < 3600e3) return Promise.resolve(cached.total);
    } catch (e) { }
    return fetch('https://api.cfwidget.com/' + CURSEFORGE_ID)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('CFWidget : ' + r.status))))
      .then((json) => {
        const total = json && json.downloads ? json.downloads.total : null;
        if (total == null) throw new Error('CFWidget : pas de total');
        try { localStorage.setItem(DOWNLOADS_CACHE, JSON.stringify({ total, at: Date.now() })); } catch (e) { }
        return total;
      });
  }

  /** 12 345 -> « 12 k+ » : le total ne fait que monter, d'ou le « + ». */
  /* 1 000 -> 1k, 1 000 000 -> 1M, 1 000 000 000 -> 1Md. Arrondi vers le bas,
     une decimale sous 10 (1,5k) : le « + » reste vrai. */
  function downloadsLabel(n) {
    const units = [[1e9, 'Md'], [1e6, 'M'], [1e3, 'k']];
    for (const [size, unit] of units) {
      if (n < size) continue;
      const x = n / size;
      const shown = x < 10 ? Math.floor(x * 10) / 10 : Math.floor(x);
      return String(shown).replace('.', ',') + unit + '+';
    }
    return n + '+';
  }

  let statData = null;
  let statsCounted = false;

  function heroStats(data) {
    const skins = data.entities.reduce((sum, e) => sum + e.cosmetics.length, 0);
    const downloads = statData && statData.downloads != null ? downloadsLabel(statData.downloads) : '0+';
    return [
      { id: 'items', key: 'Objets', value: String(data.items.length), ink: '#FFE08A', glow: '#D9A63A' },
      { id: 'creatures', key: 'Créatures', value: String(data.entities.length), ink: '#FFB27A', glow: '#E8752E' },
      { id: 'downloads', key: 'Téléchargements', value: downloads, ink: '#FFD65C', glow: '#F2A32C' },
      { id: 'version', key: 'Version', value: VERSION_LABEL, ink: '#C9F26E', glow: '#7FB52A' },
      { id: 'skins', key: 'Skins', value: String(skins), ink: '#FF9C8C', glow: '#D2483A' }
    ];
  }

  function renderHeroStats(host, data) {
    if (!host) return;
    if (data) statData = Object.assign(statData || {}, { data });
    if (!statData || !statData.data) return;

    host.innerHTML = `
      <div class="sign-row">${heroStats(statData.data).map((s, i) => `
        <div class="sign" style="--i:${i};--ink:${s.ink};--glow:${s.glow}">
          <span class="sign-chains" aria-hidden="true"></span>
          <div class="sign-board">
            <span class="sign-value${s.value.length > 5 ? ' is-long' : ''}" data-stat-value="${s.id}" data-count>${escapeHtml(s.value)}</span>
            <span class="sign-rule" aria-hidden="true"></span>
            <span class="sign-key">${escapeHtml(s.key)}</span>
          </div>
        </div>`).join('')}
      </div>`;

    if (OW.swing) OW.swing(host, '.sign');

    const count = () => {
      statsCounted = true;
      host.querySelectorAll('[data-stat-value]').forEach((el) => OW.countUp(el, 0, COUNT_MS));
    };
    if (!('IntersectionObserver' in window)) { count(); return; }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      count();
    }, { threshold: .35 });
    io.observe(host);
  }

  function loadDownloads(host) {
    fetchDownloads()
      .then((total) => {
        statData = Object.assign(statData || {}, { downloads: total });
        if (!host) return;
        host.querySelectorAll('[data-stat-value="downloads"]').forEach((el) => {
          el.textContent = downloadsLabel(total);
          if (statsCounted) OW.countUp(el, 0, COUNT_MS);
        });
      })
      .catch((error) => console.warn(error));
  }

  /* ===========================================================================
     Bandeau defilant
     =========================================================================== */

  /**
   * Le bandeau s'arretait net et repartait avec un saut visible.
   *
   * La cause : l'animation translatait la piste de -50 %, ce qui n'est exact
   * que si la piste contient exactement deux copies de meme largeur — or les
   * polices se chargent apres le premier calcul, et la largeur bouge. Et le
   * survol mettait `animation-play-state: paused`, ce qui fige la bande d'un
   * coup et se lit comme un plantage.
   *
   * Ici la distance est mesuree en pixels sur une copie reelle, autant de
   * copies que necessaire sont ajoutees pour couvrir deux fois la fenetre, et
   * la duree suit la distance pour que la vitesse reste la meme partout. Le
   * survol ralentit au lieu d'arreter (regle dans css/motion.css).
   */
  const MARQUEE_SPEED = 58; /* pixels par seconde */

  /* Une bande de verre posee de travers : la tete et le nom de chaque bete,
     dans la matiere du lecteur du theme principal. */
  function marqueeItem(e) {
    const color = e.boss ? '#B84A38' : (e.color || '#F2A32C');
    /* Le bandeau est toujours sur fond sombre (.on-media), meme en theme
       clair. La couleur d'espece brute y passe parfois sous 2:1 — l'ardoise
       de l'orque, l'olive du boa. On la remonte juste assez pour la lire. */
    const ink = OW.tintFor(color).onDark;
    return `
      <a class="marquee-item" href="${animalHref(e.slug)}" style="--ink:${escapeHtml(ink)}">
        <span class="marquee-head crisp" style="${bg(e.head)}"></span>
        <span class="marquee-name">${escapeHtml(e.name)}</span>
      </a>`;
  }

  let marqueeResizeBound = false;

  function renderMarquee(host, data) {
    if (!host) return;

    host.dataset.run = data.entities.map(marqueeItem).join('');
    layoutMarquee(host);

    /* Les largeurs ne sont justes qu'une fois les polices posees : mesurer
       avant donnerait une distance calculee sur la police de repli. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => layoutMarquee(host));
    }

    bindMarqueeResize(host);
  }

  function bindMarqueeResize(host) {
    if (marqueeResizeBound) return;
    marqueeResizeBound = true;
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => layoutMarquee(host), 180);
    }, { passive: true });
  }

  /* L'animation vit ici et non en CSS. Ralentir au survol en changeant
     `animation-duration` reprojette la position courante sur la nouvelle duree :
     la bande saute d'un coup, ce qui se voit comme un a-coup. `playbackRate`,
     lui, change la vitesse sans toucher a la position — et on l'amene en
     douceur, pour que le freinage soit lisible comme un freinage. */
  let marqueeAnimation = null;

  function layoutMarquee(host) {
    const chips = host.dataset.run;
    if (!chips) return;

    /* On repart d'une seule copie pour mesurer : compter sur la piste en place
       reviendrait a mesurer le resultat du calcul precedent. */
    host.innerHTML = '<div class="marquee-run">' + chips + '</div>';
    const runWidth = host.firstElementChild.getBoundingClientRect().width;
    if (!runWidth) return;

    /* Il faut de quoi remplir la fenetre plus la copie qui defile hors champ. */
    const needed = Math.max(2, Math.ceil((window.innerWidth + runWidth) / runWidth) + 1);
    let markup = '';
    for (let i = 0; i < needed; i++) markup += '<div class="marquee-run">' + chips + '</div>';
    host.innerHTML = markup;

    if (marqueeAnimation) marqueeAnimation.cancel();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    /* Translater d'exactement une copie : le motif suivant se retrouve pile a
       la place du precedent, et la boucle est invisible. */
    marqueeAnimation = host.animate(
      [
        { transform: 'translate3d(0, 0, 0)' },
        { transform: 'translate3d(' + (-runWidth) + 'px, 0, 0)' }
      ],
      { duration: runWidth / MARQUEE_SPEED * 1000, iterations: Infinity, easing: 'linear' }
    );
  }

  const HOVER_RATE = 0.22;

  /** Amene la vitesse du bandeau vers `target` sans a-coup. */
  function easeMarqueeRate(target) {
    if (!marqueeAnimation) return;
    const from = marqueeAnimation.playbackRate;
    if (Math.abs(from - target) < 0.01) return;

    const start = performance.now();
    const DURATION = 420;

    const step = (now) => {
      if (!marqueeAnimation) return;
      const p = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - p, 3);
      marqueeAnimation.playbackRate = from + (target - from) * eased;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function initMarqueeHover(band) {
    if (!band) return;
    band.addEventListener('pointerenter', () => easeMarqueeRate(HOVER_RATE));
    band.addEventListener('pointerleave', () => easeMarqueeRate(1));
    band.addEventListener('focusin', () => easeMarqueeRate(HOVER_RATE));
    band.addEventListener('focusout', () => easeMarqueeRate(1));
  }

  /* ===========================================================================
     Bestiaire
     =========================================================================== */

  function renderCreatures(host, data) {
    if (!host) return;
    /* La meme carte qu'au bestiaire (js/creature-card.js) : la bete dans son
       biome, son rendu solo au-dessus, ses chiffres sur le verre. Les betes
       annoncees (silhouettes) ne sont montrees que sur la page Creatures. */
    host.innerHTML = data.entities.map(OW.creatureCard).join('');
    OW.mountCreatureCards(host);
  }

  /* ===========================================================================
     Bestiaire — le carrousel
     ===========================================================================

     Un vrai tambour : les huit betes sont posees sur les faces d'un cylindre,
     chacune tournee de 45 degres de plus que la precedente et poussee vers
     l'exterieur d'un rayon. Faire tourner le cylindre sur son axe Y amene la
     suivante de face — et comme les faces sont fermees en cercle, il n'y a ni
     debut ni fin : l'index n'est jamais ramene dans [0, n[, seule la bete
     affichee l'est.

     Le rayon se deduit de la largeur d'une face : pour que n faces se touchent
     bord a bord, R = (largeur / 2) / tan(pi / n). La perspective suit le rayon,
     sinon le tambour parait plat sur mobile et demesure sur grand ecran. */

  /* Les rendus plein cadre du carrousel. Aucun n'est declare ici : le chemin se
     deduit du slug de la bete, `assets/entities/solo/<Nom> [SOLO].png`, ou
     <Nom> est le slug capitalise mot a mot — red_panda donne « Red Panda ».
     Deposer le fichier suffit donc a le faire entrer dans le carrousel, sans
     toucher au code. Ce qui manque encore est gere plus bas, a l'emprunt. */
  function soloArt(slug) {
    const name = String(slug).split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return OW.asset(encodeURI('assets/entities/solo/' + name + ' [SOLO].png'));
  }

  const ringMod = (value, n) => ((value % n) + n) % n;

  function renderCreatureRing(host, data) {
    if (!host) return null;

    /* Les « bientot » ne montent pas sur le tambour : sans rendu ni fiche, une
       face sur douze n'aurait mene nulle part. Elles restent en mode cartes. */
    const cast = data.entities;
    if (!cast.length) return null;
    /* Les nouveautes (js/creature-card.js) : l'etoile se pose pres du nom
       quand l'une d'elles passe devant. */
    const fresh = new Set(OW.newCreatures ? OW.newCreatures(data).map((e) => e.slug) : []);

    const n = cast.length;
    const step = 360 / n;

    /* --panel-i decale la respiration d'une bete a l'autre : neuf souffles
       exactement synchrones donneraient un mur qui pompe, pas des animaux. */
    const panels = cast.map((e, i) => `
      <figure class="ring-panel" data-ring-panel
              style="--panel-angle:${(i * step).toFixed(3)}deg;--panel-i:${i}">
        <span class="ring-panel-float">
          <img class="ring-panel-art" src="${soloArt(e.slug)}" alt="${escapeHtml(e.name)}"
               width="2560" height="1440" decoding="async" loading="lazy">
        </span>
      </figure>`).join('');

    host.innerHTML = `
      <div class="ring-stage" data-ring-stage tabindex="0" role="group"
           aria-roledescription="carrousel" aria-label="Les créatures du mod">
        <span class="ring-aura" data-ring-aura aria-hidden="true"></span>

        <div class="ring-scene" data-ring-scene>
          <div class="ring-drum" data-ring-drum>${panels}</div>
        </div>

        <span class="ring-flare" aria-hidden="true"></span>

        <div class="ring-hud">
          <h3 class="ring-title" data-ring-title>
            <span class="visually-hidden" data-ring-title-text data-no-i18n></span>
            <span class="ring-title-letters" data-ring-letters aria-hidden="true" data-no-i18n></span>
            ${fresh.size && OW.newBurst ? `<span class="cc-new ring-new" data-ring-new aria-hidden="true" hidden>
              ${OW.newBurst()}<span class="cc-new-text">Nouveau<i>!</i></span></span>` : ''}
          </h3>
          <a class="btn btn-accent btn-lg ring-cta" data-ring-cta href="#">
            Découvrir
            <span class="ring-cta-arrow" aria-hidden="true">→</span>
            <span class="shine" aria-hidden="true"></span>
          </a>
        </div>

        <button type="button" class="ring-nav ring-nav-prev" data-ring-prev
                aria-label="Créature précédente">${OW.icon ? OW.icon('prev') : '<span aria-hidden="true">‹</span>'}</button>
        <button type="button" class="ring-nav ring-nav-next" data-ring-next
                aria-label="Créature suivante">${OW.icon ? OW.icon('play') : '<span aria-hidden="true">›</span>'}</button>
      </div>`;

    const stage = host.querySelector('[data-ring-stage]');
    const drum = host.querySelector('[data-ring-drum]');
    const aura = host.querySelector('[data-ring-aura]');
    const letters = host.querySelector('[data-ring-letters]');
    const titleText = host.querySelector('[data-ring-title-text]');
    const cta = host.querySelector('[data-ring-cta]');
    const count = host.querySelector('[data-ring-count]');
    const faces = Array.prototype.slice.call(host.querySelectorAll('[data-ring-panel]'));
    const dotNodes = Array.prototype.slice.call(host.querySelectorAll('[data-ring-dot]'));

    /* Toutes les betes n'ont pas encore leur rendu. Celle dont le fichier
       manque emprunte le premier qui a bien charge, plutot que de laisser un
       trou dans le tambour — et le jour ou son fichier arrive, elle le prend
       sans qu'une ligne change ici. */
    const arts = faces.map((face) => face.querySelector('img'));
    let borrowed = null;
    const waiting = [];

    arts.forEach((img) => {
      /* once: si le rendu emprunte echoue lui aussi, on s'arrete la. */
      img.addEventListener('error', () => {
        if (borrowed) img.src = borrowed;
        else waiting.push(img);
      }, { once: true });

      img.addEventListener('load', () => {
        if (borrowed) return;
        borrowed = img.getAttribute('src');
        while (waiting.length) waiting.pop().src = borrowed;
      });
    });

    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const AUTOPLAY = 10000;
    const TURN = 960;
    const TURN_REDUCED = 240;

    let pos = 0;
    let drag = null;

    /* Le rayon depend de la largeur reelle de la scene : elle change au
       redimensionnement, et vaut zero tant que le carrousel est masque — d'ou
       le recalcul a chaque retour en mode carrousel. */
    function measure() {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width) return;

      /* La face prend presque toute la scene : les voisines sont effacees au
         repos, il n'y a plus de raison de leur reserver les cotes. Elle ne la
         prend pas entierement pour autant — le peu qui reste est ce qu'on voit
         de la voisine pendant qu'elle tourne. */
      const panelWidth = Math.round(width * 0.90);
      const panelHeight = Math.round(height * 0.74);
      const radius = panelWidth / 2 / Math.tan(Math.PI / n);

      stage.style.setProperty('--panel-w', panelWidth + 'px');
      stage.style.setProperty('--panel-h', panelHeight + 'px');
      stage.style.setProperty('--ring-radius', radius.toFixed(2) + 'px');
      stage.style.setProperty('--ring-z', '-' + radius.toFixed(2) + 'px');
      /* Perspective courte : c'est elle qui donne son angle a la bete de face
         et qui fait plonger les voisines. Trop longue, le tambour s'aplatit. */
      stage.style.setProperty('--ring-perspective', (width * 0.95).toFixed(2) + 'px');
    }

    function paintAngle(angle) {
      drum.style.setProperty('--ring-angle', angle.toFixed(3) + 'deg');
    }

    /* Le nom arrive lettre par lettre. On recree les noeuds a chaque fois :
       reaffecter la meme animation ne la rejoue pas, et forcer un reflow pour
       la relancer coute plus cher que dix spans. */
    function setTitle(source) {
      /* Le nom est decoupe lettre par lettre pour l'animation : il doit donc
         etre traduit AVANT (js/i18n.js ne verrait que des lettres isolees). */
      const name = OW.t ? OW.t(source) : source;
      if (name === source && OW.i18n && OW.i18n.active && OW.i18n.ready) {
        OW.i18n.ready().then(() => {
          if (titleText.dataset.source === source && OW.t(source) !== source) setTitle(source);
        });
      }
      titleText.dataset.source = source;
      titleText.textContent = name;
      letters.textContent = '';
      if (reduced()) { letters.textContent = name; return; }

      const frag = document.createDocumentFragment();
      Array.from(name).forEach((char, i) => {
        const span = document.createElement('span');
        span.className = 'ring-letter';
        span.style.setProperty('--i', String(i));
        span.textContent = char === ' ' ? ' ' : char;
        frag.appendChild(span);
      });
      letters.appendChild(frag);
    }

    function paint(index) {
      const entity = cast[index];
      const color = entity.boss ? '#B84A38' : (entity.color || '#F2A32C');

      stage.style.setProperty('--ring-color', color);
      aura.style.background =
        'radial-gradient(56% 54% at 50% 46%, ' + color + '4D 0%, ' + color + '1C 44%, rgba(5,6,4,0) 76%)';

      setTitle(entity.name);
      const star = host.querySelector('[data-ring-new]');
      if (star) star.hidden = !fresh.has(entity.slug);
      cta.href = animalHref(entity.slug);
      cta.setAttribute('aria-label', 'Découvrir ' + entity.name);
      /* Le bouton emprunte la couleur de la bete : --accent est un jeton
         global, le redefinir ici ne deborde pas de l'element. L'encre suit,
         sinon un fauve sombre porterait du texte noir. */
      cta.style.setProperty('--accent', color);
      cta.style.setProperty('--accent-hover', color);
      cta.style.setProperty('--on-accent', contrastInk(color));
      if (count) count.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');

      /* Marquer la sortante avant de designer l'entrante : c'est ce qui dit au
         tapis dans quel sens la faire sortir. Le toggle efface au passage la
         marque laissee par le tour precedent. */
      faces.forEach((face, i) => {
        const wasFront = face.classList.contains('is-front');
        face.classList.toggle('is-leaving', wasFront && i !== index);
        face.classList.toggle('is-front', i === index);
      });
      dotNodes.forEach((dot, i) => {
        const active = i === index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
      });
    }

    /* La classe porte le recul de camera pendant la rotation. Elle est retiree
       au bout du compte a rebours, et non sur transitionend : un tambour qu'on
       relance avant la fin n'emet jamais cet evenement. */
    let turnTimer = 0;

    /* Un tour a la fois. Tant que le tambour pivote, les commandes ne repondent
       plus : enchainer deux sauts coupait le fondu croise au milieu, et la bete
       precedente restait a mi-course, ni partie ni posee. Le verrou dure
       exactement ce que dure la rotation. */
    let locked = false;
    let lockTimer = 0;

    function move(delta) {
      if (delta && locked) return false;

      /* Le sens du dernier saut arme l'animation du titre : sans lui, revenir
         en arriere a l'air d'avancer. */
      if (delta) stage.dataset.ringDir = delta > 0 ? 'next' : 'prev';
      pos += delta;
      paintAngle(-pos * step);
      paint(ringMod(pos, n));

      if (delta) {
        /* Le verrou suit la duree reelle du mouvement : en mouvement reduit, le
           tambour se cale en 240 ms et rien ne justifie d'attendre une seconde. */
        const span = reduced() ? TURN_REDUCED : TURN;
        locked = true;
        stage.classList.add('is-locked');
        window.clearTimeout(lockTimer);
        lockTimer = window.setTimeout(() => {
          locked = false;
          stage.classList.remove('is-locked');
        }, span);
      }

      if (delta && !reduced()) {
        stage.classList.remove('is-turning');
        /* Forcer le recalcul relance l'animation de recul : sans cela, retirer
           puis remettre la classe dans la meme image ne change rien. */
        void stage.offsetWidth;
        stage.classList.add('is-turning');
        window.clearTimeout(turnTimer);
        turnTimer = window.setTimeout(() => stage.classList.remove('is-turning'), TURN);
      }

      schedule();
      return true;
    }

    /* --- Defilement automatique -------------------------------------------- *

       Dix secondes par bete, et le compte a rebours repart a chaque saut, qu'il
       vienne du minuteur ou de la main. Il s'arrete des que la main est dessus,
       des que le clavier y entre, pendant un glissement, quand la section sort
       de l'ecran et quand l'onglet passe en arriere-plan : un carrousel qui
       tourne dans le vide use la batterie sans rien montrer a personne. */

    const holds = { hover: false, focus: false, drag: false };
    let onScreen = true;
    let autoTimer = 0;

    function heldBack() {
      return holds.hover || holds.focus || holds.drag
        || !onScreen || document.hidden || reduced();
    }

    function schedule() {
      window.clearTimeout(autoTimer);
      autoTimer = 0;
      const paused = heldBack();
      stage.classList.toggle('is-paused', paused);
      if (paused) return;
      autoTimer = window.setTimeout(() => move(1), AUTOPLAY);
    }

    function setHold(key, value) {
      if (holds[key] === value) return;
      holds[key] = value;
      schedule();
    }

    stage.addEventListener('pointerenter', () => setHold('hover', true));
    stage.addEventListener('pointerleave', () => setHold('hover', false));
    stage.addEventListener('focusin', () => setHold('focus', true));
    stage.addEventListener('focusout', () => setHold('focus', false));
    document.addEventListener('visibilitychange', schedule);

    if (window.IntersectionObserver) {
      new window.IntersectionObserver((entries) => {
        onScreen = entries[entries.length - 1].isIntersecting;
        schedule();
      }, { threshold: 0.25 }).observe(stage);
    }

    /* --- Gestes ---------------------------------------------------------- */

    host.querySelector('[data-ring-prev]').addEventListener('click', () => move(-1));
    host.querySelector('[data-ring-next]').addEventListener('click', () => move(1));

    dotNodes.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        /* On rejoint la face par le plus court chemin : depuis la huitieme, la
           premiere est a un cran a droite, pas a sept crans a gauche. */
        const current = ringMod(pos, n);
        let delta = i - current;
        if (delta > n / 2) delta -= n;
        if (delta < -n / 2) delta += n;
        if (delta) move(delta);
      });
    });

    stage.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
    });

    /* Seul le defilement horizontal pilote le tambour. Detourner la molette
       verticale bloquerait la page sur la section. Le verrou tient lieu de
       frein : un pave tactile envoie des dizaines d'evenements par geste, ils
       sont refuses tant que le tour precedent n'est pas fini. */
    stage.addEventListener('wheel', (event) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 8) return;
      event.preventDefault();
      move(event.deltaX > 0 ? 1 : -1);
    }, { passive: false });

    stage.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || locked) return;
      if (event.target.closest('a, button')) return;
      drag = { id: event.pointerId, x: event.clientX, base: -pos * step, steps: 0 };
      stage.setPointerCapture(event.pointerId);
      stage.classList.add('is-dragging');
      setHold('drag', true);
    });

    stage.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      drag.steps = (event.clientX - drag.x) / (stage.clientWidth || 1);
      paintAngle(drag.base + drag.steps * step);
    });

    function endDrag(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const steps = drag.steps;
      drag = null;
      stage.classList.remove('is-dragging');
      setHold('drag', false);

      let delta = -Math.round(steps);
      /* Un geste franc mais court doit quand meme faire tourner d'un cran :
         avec l'arrondi seul, glisser sur 40% de la face ne changeait rien. */
      if (!delta && Math.abs(steps) > 0.12) delta = steps > 0 ? -1 : 1;
      if (!delta || !move(delta)) { paintAngle(-pos * step); schedule(); }
    }

    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    window.addEventListener('resize', measure, { passive: true });

    measure();
    move(0);

    return { refresh: measure };
  }

  /* ===========================================================================
     Bestiaire — la bascule carrousel / cartes
     =========================================================================== */

  const VIEW_KEY = 'ow-bestiary-view';

  function readView() {
    try {
      const saved = window.localStorage.getItem(VIEW_KEY);
      if (saved === 'ring' || saved === 'cards') return saved;
    } catch (error) { /* stockage refuse : on garde le defaut */ }
    return 'ring';
  }

  function initBestiaryModes(ring) {
    const host = document.querySelector('[data-bestiary]');
    const swatch = document.querySelector('[data-view-switch]');
    if (!host || !swatch) return;

    const options = Array.prototype.slice.call(swatch.querySelectorAll('[data-view-option]'));
    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const OUT = 220;
    let swapTimers = [];

    function commit(mode) {
      host.dataset.mode = mode;
      swatch.dataset.active = mode;
      options.forEach((option) => {
        option.setAttribute('aria-pressed', option.dataset.viewOption === mode ? 'true' : 'false');
      });
      /* La scene mesure zero tant qu'elle est masquee : le rayon doit etre
         repris au moment ou elle redevient visible, pas avant. */
      if (mode === 'ring' && ring) ring.refresh();
    }

    /* La bascule se joue en deux temps parce qu'on ne peut pas faire de
       transition sur display : le mode sortant s'efface, on echange, le mode
       entrant remonte. Les minuteurs sont annules a chaque clic, sinon deux
       bascules rapprochees laissent le bloc a mi-chemin. */
    function apply(mode, persist, animate) {
      if (persist) {
        try { window.localStorage.setItem(VIEW_KEY, mode); } catch (error) { /* ignore */ }
      }
      if (host.dataset.mode === mode && animate) return;

      swapTimers.forEach(window.clearTimeout);
      swapTimers = [];
      host.classList.remove('is-swapping', 'is-swapped');

      if (!animate || reduced()) { commit(mode); return; }

      host.classList.add('is-swapping');
      swapTimers.push(window.setTimeout(() => {
        commit(mode);
        host.classList.remove('is-swapping');
        host.classList.add('is-swapped');
        swapTimers.push(window.setTimeout(() => host.classList.remove('is-swapped'), 620));
      }, OUT));
    }

    options.forEach((option) => {
      option.addEventListener('click', () => apply(option.dataset.viewOption, true, true));
    });

    apply(readView(), false, false);
  }

  /* ===========================================================================
     Le reste du mode
     =========================================================================== */

  /* Chaque domaine a son decor et sa grappe d'objets. `span` est le nombre de
     colonnes sur douze : l'alternance 7/5 puis 5/7 empeche la grille de se lire
     comme deux colonnes egales, et donne a chaque rangee une piece dominante. */
  function railTiles(data) {
    const skins = data.entities.reduce((sum, e) => sum + e.cosmetics.length, 0);
    const vanillaSpawnBiomes = new Set();
    data.spawns.forEach((s) => (s.biomes || []).forEach((b) => vanillaSpawnBiomes.add(b)));

    return [
      {
        title: 'Biomes', href: 'biomes.html', color: '#3A6B55', icon: 'assets/ui/mineral.png',
        sprites: [
          { src: 'assets/ui/mineral.png', tilt: -8 },
          { src: 'assets/item/savage_berries.png', tilt: 6 },
          { src: 'assets/item/plant_fiber.png', tilt: -4 }
        ],
        desc: "Les biomes ajoutés par le mod, et les biomes vanilla où chaque bête décide d'apparaître.",
        meta: [plural(data.biomes.length, 'biome') + ' ajouté' + (data.biomes.length > 1 ? 's' : ''),
        vanillaSpawnBiomes.size + ' biomes de spawn']
      },
      {
        title: 'Objets', href: 'items.html', color: '#B08040', icon: 'assets/tools/jade_sword.png',
        sprites: [
          { src: 'assets/tools/jade_sword.png', tilt: -12 },
          { src: 'assets/tools/ruby_pickaxe.png', tilt: 9 },
          { src: 'assets/tools/primitive_spear.png', tilt: -5 }
        ],
        desc: 'Armes primitives, outils en jade et rubis, matériaux animaux et selles.',
        meta: [plural(data.items.length, 'objet'), plural(data.recipes.length, 'recette')]
      },
      {
        title: 'Cosmétiques', href: 'cosmetics.html', color: '#F2A32C', icon: 'assets/ui/skins.png',
        sprites: [{ hero: true, tilt: 0 }],
        desc: 'Skins de monture, variantes naturelles et récompenses de prestige.',
        meta: [plural(skins, 'skin'), 'Modèles 3D']
      },
      {
        title: 'Mécaniques', href: 'simulator.html', color: '#00A0C8', icon: 'assets/ui/energy.png',
        sprites: [
          { src: 'assets/archetypes/berserker.png', tilt: -10 },
          { src: 'assets/ui/energy.png', tilt: 0 },
          { src: 'assets/archetypes/tank.png', tilt: 10 }
        ],
        desc: 'Combat, Piste Sauvage, archétypes et niveaux, quêtes quotidiennes, succès et bientôt les tribus.',
        meta: ['Niveau 1 → ' + data.levelCurve.max, plural(data.archetypes.length, 'archétype')]
      },
      {
        title: 'Musiques', href: 'music.html', color: '#B84A38', icon: 'assets/ui/red_panda_music.png',
        sprites: [{ hero: true, tilt: -4 }],
        desc: 'Thème principal, thèmes de boss et la voix de chaque créature.',
        meta: [plural(data.sounds.length, 'son'), 'Thème principal']
      },
      {
        title: 'Télécharger', href: 'download.html', color: '#8A9A2E', icon: 'assets/logo.png',
        sprites: [{ hero: true, tilt: 0 }],
        desc: "Version du mod, dépendances NeoForge et notes d'installation.",
        meta: [VERSION_LABEL, 'NeoForge 1.21']
      }
    ];
  }

  /* ===========================================================================
     Le reste du mod — l'accordeon
     ===========================================================================

     Six bandes. Fermees, elles ne montrent que leur icone et leur titre sur
     la tranche ; celle qu'on survole (ou qu'on prend au clavier) s'ouvre en
     grand. Chacune a pour fond le biome dans lequel sa page s'ouvre, dessine
     par le moteur du fond du site (js/biome-world.js), et, a l'ouverture, les
     objets qui symbolisent l'onglet viennent s'y poser. */

  const BIOME_NAMES = {
    jungle: 'Jungle', swamp: 'Marais', redwood: 'Forêt redwood', snow: 'Neige',
    savanna: 'Savane', desert: 'Désert', ocean: 'Océan', lukewarm: 'Océan tiède', abyss: 'Abysses',
    bamboo: 'Jungle de bambous', mangrove: 'Mangrove', badlands: 'Badlands', cherry: 'Cerisaie',
    cave: 'Grottes', frozen: 'Banquise', forest: 'Forêt'
  };

  /* Les planches (skins.png : 3,7 Mo) ne se telechargent qu'a l'approche de
     la section : elle est tout en bas de l'accueil. */
  const sprite = (src, cls, extra) =>
    `<span class="${cls}" aria-hidden="true"${extra ? ` style="${extra}"` : ''} ${OW.imgAttr([src], { mode: 'bg', lazy: true })}></span>`;

  function renderRail(host, data) {
    if (!host) return;

    host.innerHTML = railTiles(data).map((t, i) => {
      const biome = OW.pageBiome ? OW.pageBiome(t.href) : 'jungle';
      const emblem = t.sprites.map((sp, k) =>
        sprite(sp.hero ? t.icon : sp.src, 'acc-emblem-sprite' + (sp.hero ? ' is-hero' : ''),
          '--tilt:' + sp.tilt + 'deg;--k:' + k + ';')).join('');
      return `
        <a class="acc-item${i === 0 ? ' is-open' : ''}" href="${t.href}" style="--c:${t.color}">
          <span class="acc-back" aria-hidden="true">
            <span class="acc-scene" data-biome-window="${biome}"></span>
            <span class="acc-shade"></span>
          </span>
          <span class="acc-spine" aria-hidden="true">${sprite(t.icon, 'acc-spine-icon')}<span>${escapeHtml(t.title)}</span></span>
          <span class="acc-content">
            <span class="acc-emblem" aria-hidden="true">${emblem}</span>
            <span class="acc-kicker">ARRIVÉE · ${escapeHtml((BIOME_NAMES[biome] || biome).toUpperCase())}</span>
            <span class="acc-title">${escapeHtml(t.title)}</span>
            <span class="acc-desc">${escapeHtml(t.desc)}</span>
            <span class="acc-meta">${escapeHtml(t.meta.join(' · '))}</span>
            <span class="acc-go">Entrer <span class="acc-go-arrow" aria-hidden="true">→</span></span>
          </span>
        </a>`;
    }).join('');

    host.querySelectorAll('[data-biome-window]').forEach((win) => {
      const scene = OW.biomeScene && OW.biomeScene(win.dataset.biomeWindow, win.clientWidth);
      if (scene) win.append(scene);
    });

    const items = Array.from(host.querySelectorAll('.acc-item'));
    const open = (el) => items.forEach((it) => it.classList.toggle('is-open', it === el));
    items.forEach((it) => {
      it.addEventListener('pointerenter', () => open(it));
      it.addEventListener('focus', () => open(it));
    });
  }



  /* ===========================================================================
     Lecteur
     =========================================================================== */

  function initPlayer() {
    const audio = document.querySelector('[data-audio]');
    const button = document.querySelector('[data-audio-toggle]');
    const bar = document.querySelector('[data-audio-bar]');
    const seek = document.querySelector('[data-audio-seek]');
    const equaliser = document.querySelector('[data-audio-equaliser]');
    const time = document.querySelector('[data-audio-time]');
    const duration = document.querySelector('[data-audio-duration]');
    if (!audio || !button) return;

    button.addEventListener('click', () => {
      if (audio.paused) audio.play().catch(() => { });
      else audio.pause();
    });

    audio.addEventListener('play', () => {
      if (OW.icon) button.innerHTML = OW.icon('pause'); else button.textContent = '❙❙';
      button.setAttribute('aria-label', 'Mettre en pause');
      if (equaliser) equaliser.setAttribute('data-playing', 'true');
    });

    const stopped = () => {
      if (OW.icon) button.innerHTML = OW.icon('play'); else button.textContent = '▶';
      button.setAttribute('aria-label', 'Lire le thème principal');
      if (equaliser) equaliser.removeAttribute('data-playing');
    };
    audio.addEventListener('pause', stopped);
    audio.addEventListener('ended', stopped);

    audio.addEventListener('timeupdate', () => {
      if (time) time.textContent = formatTime(audio.currentTime);
      if (audio.duration && seek) {
        seek.style.setProperty('--bar-width', (audio.currentTime / audio.duration * 100) + '%');
      }
      if (audio.duration && bar) {
        bar.style.setProperty('--bar-width', (audio.currentTime / audio.duration * 100) + '%');
      }
    });

    audio.addEventListener('loadedmetadata', () => {
      if (duration) duration.textContent = formatTime(audio.duration);
    });

    audio.addEventListener('error', () => {
      button.setAttribute('aria-disabled', 'true');
      if (time) time.textContent = 'FICHIER ABSENT';
    });

    /* Cliquer dans la barre deplace la lecture. Le curseur au survol annonce
       deja que la barre est active ; sans ce gestionnaire, c'etait un mensonge. */
    /* Un glisser sur la barre fait defiler la lecture (js/player.js). */
    if (seek && OW.bindSeek) OW.bindSeek(seek, () => audio);
    if (seek && !OW.bindSeek) {
      seek.addEventListener('click', (event) => {
        if (!audio.duration) return;
        const rect = seek.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        audio.currentTime = ratio * audio.duration;
      });
    }
  }

  /* ===========================================================================
     Amorcage
     =========================================================================== */

  mountHeader();
  startEmbers(document.querySelector('[data-embers]'));
  initMarqueeHover(document.querySelector('.marquee'));
  loadDownloads(document.querySelector('[data-hero-stats]'));
  initPlayer();

  loadWikiData()
    .then((data) => {
      initHero(data);
      renderHeroStats(document.querySelector('[data-hero-stats]'), data);
      renderMarquee(document.querySelector('[data-marquee]'), data);
      renderCreatures(document.querySelector('[data-creatures]'), data);
      initBestiaryModes(renderCreatureRing(document.querySelector('[data-creature-ring]'), data));
      renderRail(document.querySelector('[data-rail]'), data);
      if (OW.resolveImages) OW.resolveImages(document.querySelector('[data-rail]'));
      /* La nouveaute dans le hero (js/news.js), les avis des joueurs
         (js/community.js) : chacun se cache tout seul s'il n'a rien a dire. */
      if (OW.mountNews) OW.mountNews(data);
      if (OW.mountHomeReviews) OW.mountHomeReviews(data);
      mountFooter(data, null, true);
      if (OW.enhance) OW.enhance(document);
      else reveal();
    })
    .catch((error) => {
      console.error(error);
      /* Sans donnees, le tambour reste vide : on repasse sur la grille, seule a
         pouvoir porter le message d'erreur. */
      const modes = document.querySelector('[data-bestiary]');
      if (modes) modes.dataset.mode = 'cards';
      const host = document.querySelector('[data-creatures]');
      if (host) {
        host.innerHTML =
          '<p class="empty-note">Les données du mod n\'ont pas pu être chargées. '
          + 'Relancez <code>build-data.py</code> après chaque export du mod.</p>';
      }
    });
}(window.OW = window.OW || {}));
