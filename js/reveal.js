/* Apparition au scroll, et comptage des nombres.

   Reecriture. L'ancienne version posait une animation CSS en pause sur chaque
   element et laissait l'IntersectionObserver la relancer. Trois defauts s'y
   cumulaient :

     - l'observer ne repond qu'apres la premiere peinture, donc tout ce qui
       etait deja a l'ecran au chargement demarrait visiblement en retard ;
     - le decalage suivait l'ordre du document et non l'ordre d'apparition, si
       bien qu'une grille se remplissait dans le desordre ;
     - `animation-play-state` reste capricieux des qu'un element est re-rendu.

   Ici, l'element porte son etat de repos en CSS (css/motion.css) et la seule
   chose que fait ce fichier est de poser .is-in au bon moment, avec le bon
   decalage. Ce qui est deja a l'ecran est joue tout de suite, en cascade
   deliberee ; le reste attend son tour. */

(function (OW) {
  'use strict';

  /* Marge basse : on declenche un peu avant que l'element touche le bord, pour
     qu'il finisse d'apparaitre au moment ou le regard l'atteint. */
  const ROOT_MARGIN = '0px 0px -12% 0px';
  const STAGGER_STEP = 55;
  const STAGGER_MAX = 330;
  /* Le premier ecran est une entree en scene, pas une reaction au scroll : on
     lui laisse le temps que les polices et l'image de tete se posent. */
  const FIRST_PAINT_DELAY = 90;

  let observer = null;
  let booted = false;

  const reducedMotion = () => window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* js/ux.js pose html.sd-ok quand animation-timeline est connu ; le mode
     allege des effets (html[data-perf='lite']) garde l'ancienne apparition. */
  const scrollDriven = () => document.documentElement.classList.contains('sd-ok')
    && document.documentElement.getAttribute('data-perf') !== 'lite';

  /* ---- declenchement --------------------------------------------------------- */

  function release(el, delay) {
    if (el.classList.contains('is-in')) return;
    el.style.setProperty('--reveal-delay', (delay || 0) + 'ms');
    el.classList.add('is-in');
    if (el.hasAttribute('data-count')) countUp(el, delay || 0);
  }

  function ensureObserver() {
    if (observer || !('IntersectionObserver' in window)) return observer;

    observer = new IntersectionObserver((entries) => {
      /* Un meme scroll fait souvent entrer plusieurs elements a la fois. On les
         reordonne de haut en bas pour que la cascade suive le regard, quel que
         soit l'ordre dans lequel l'observer les a signales. */
      const arriving = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      arriving.forEach((entry, i) => {
        release(entry.target, Math.min(i * STAGGER_STEP, STAGGER_MAX));
        observer.unobserve(entry.target);
      });
    }, { rootMargin: ROOT_MARGIN, threshold: 0.01 });

    return observer;
  }

  /** Vrai si l'element occupe deja une partie de la fenetre. */
  function inViewport(el) {
    const rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) return false;
    return rect.top < window.innerHeight && rect.bottom > 0;
  }

  /* ---- une fois apparu, c'est acquis ------------------------------------------

     L'apparition qui suit le defilement (.is-scroll, css/ux.css) se rejouait a
     l'envers quand on remontait : tout ce qui passait en bas de l'ecran
     s'effacait et redescendait, et la page semblait se defaire sous le doigt.
     Des qu'un element a fini d'entrer, il quitte donc l'animation pour l'etat
     revele (.is-in) — les memes valeurs, rien ne bouge a l'ecran. Les titres
     de section (leur volet et leur surtitre) font de meme (.is-seen). */

  let settler = null;
  let titleSettler = null;
  const THRESHOLDS = [0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1];

  function settle(el) {
    if (!('IntersectionObserver' in window)) return;
    if (!settler) {
      settler = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting || !entry.rootBounds) return;
        /* Entre en entier par le bas, avec un rien de marge (la derniere
           carte d'une rangee finit son entree a 103 %, css/ux.css) : son
           animation est a sa fin. */
        const r = entry.boundingClientRect;
        if (r.bottom + r.height * .05 > entry.rootBounds.bottom) return;
        const el = entry.target;
        settler.unobserve(el);
        el.style.setProperty('--reveal-delay', '0ms');
        el.classList.add('is-in');
        el.classList.remove('is-scroll');
      }), { threshold: THRESHOLDS });
    }
    settler.observe(el);
  }

  function settleTitles(scope) {
    if (!scrollDriven() || !('IntersectionObserver' in window)) return;
    if (!titleSettler) {
      /* Le volet du titre finit a 32 % de sa traversee de l'ecran : un tiers
         de hauteur au-dessus du bas suffit a l'avoir depasse. */
      titleSettler = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        titleSettler.unobserve(entry.target);
        entry.target.classList.add('is-seen');
      }), { rootMargin: '0px 0px -40% 0px' });
    }
    scope.querySelectorAll('main :is(.section-head, .tb-section-head) :is(.t-h2, .t-section, .t-pixel):not([data-seen-armed])')
      .forEach((el) => { el.setAttribute('data-seen-armed', ''); titleSettler.observe(el); });
  }

  /* ---- comptage -------------------------------------------------------------- */

  /**
   * Fait monter un nombre depuis zero, en conservant ce qui l'entoure.
   *
   * Le contenu peut valoir « 33 », « 12 PV » ou « ×1.3 » : seul le premier
   * groupe de chiffres bouge, le prefixe et le suffixe sont laisses tels quels.
   * Les decimales sont respectees, sinon 1.3 s'afficherait 1 pendant toute la
   * montee puis sauterait a la fin. `ms` impose une duree fixe, pour que des
   * compteurs voisins arrivent ensemble quelle que soit leur taille.
   */
  function countUp(el, delay, ms) {
    const raw = (el.textContent || '').trim();
    const match = raw.match(/^([^0-9-]*)(-?[0-9]+(?:[.,][0-9]+)?)(.*)$/);
    if (!match) return;

    const prefix = match[1];
    const number = match[2];
    const suffix = match[3] || '';
    const separator = number.indexOf(',') !== -1 ? ',' : '.';
    const decimals = (number.split(/[.,]/)[1] || '').length;
    const target = parseFloat(number.replace(',', '.'));
    if (!target || !isFinite(target)) return;

    const write = (value) => {
      el.textContent = prefix + value.toFixed(decimals).replace('.', separator) + suffix;
    };

    if (reducedMotion()) {
      el.textContent = raw;
      return;
    }

    const duration = ms || 1000 + Math.min(400, String(Math.round(target)).length * 90);
    write(0);

    const start = performance.now() + (delay || 0);
    const step = (now) => {
      if (now < start) { requestAnimationFrame(step); return; }
      const p = Math.min(1, (now - start) / duration);
      write(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = raw;
    };
    requestAnimationFrame(step);
  }

  /* ---- armement -------------------------------------------------------------- */

  /**
   * Arme tout [data-reveal] ajoute depuis le dernier appel.
   *
   * Le decalage se calcule par parent : les six cartes d'une grille se
   * declenchent l'une apres l'autre, mais la grille voisine repart de zero. Un
   * decalage calcule sur l'index global aurait fait attendre trois secondes a
   * la derniere carte d'une longue page.
   */
  function reveal(root) {
    const scope = root || document;
    settleTitles(scope);
    const nodes = Array.prototype.slice.call(
      scope.querySelectorAll('[data-reveal]:not([data-reveal-armed])')
    );
    if (!nodes.length) return;

    const io = ensureObserver();
    const groupCounts = new Map();
    const visible = [];

    nodes.forEach((el) => {
      el.setAttribute('data-reveal-armed', '');

      const parent = el.parentNode;
      const rank = groupCounts.get(parent) || 0;
      groupCounts.set(parent, rank + 1);
      el.dataset.revealRank = String(rank);

      if (reducedMotion()) { el.classList.add('is-in'); return; }

      /* Deja a l'ecran : on ne passe pas par l'observer, qui ne repondrait
         qu'apres la peinture suivante — c'est exactement le retard qu'on
         cherche a supprimer. Cela vaut aussi pour le contenu construit apres
         le chargement des donnees, qui represente l'essentiel des pages. */
      if (inViewport(el)) visible.push(el);
      /* Plus bas dans la page, quand le navigateur sait animer au defilement
         (css/ux.css) : l'apparition suit le defilement lui-meme, sans
         observer. Un compteur garde l'observer, qui lance son comptage. */
      else if (scrollDriven() && !el.hasAttribute('data-count')) {
        el.style.setProperty('--reveal-rank', String(Math.min(rank, 5)));
        el.classList.add('is-scroll');
        settle(el);
      }
      else if (io) io.observe(el);
      else el.classList.add('is-in');
    });

    if (visible.length) {
      visible.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      /* Deux images d'attente : la premiere applique l'etat de repos, la
         seconde lance la transition. Sans cela le navigateur fusionne les deux
         etats et l'element apparait d'un coup. */
      /* Au tout premier rendu on laisse un souffle, le temps que les polices
         et l'image de tete se posent ; ensuite, plus aucune attente. */
      const base = booted ? 0 : FIRST_PAINT_DELAY;
      const play = () => visible.forEach((el, i) => {
        release(el, base + Math.min(i * STAGGER_STEP, STAGGER_MAX));
      });

      requestAnimationFrame(() => requestAnimationFrame(play));
      /* Filet de securite : dans un onglet en arriere-plan, requestAnimationFrame
         peut ne jamais s'executer. Sans ce rappel, le contenu resterait a
         opacity 0 — invisible, mais bien present, ce qui donne une page vide au
         retour sur l onglet. release() ignore ce qui est deja revele. */
      setTimeout(play, 240);
    }
  }

  /** Re-arme a la demande, pour les pages qui re-rendent leurs listes. */
  function revealAgain(root) {
    reveal(root);
  }

  /** Force l'apparition immediate, sans attendre le scroll. */
  function revealNow(root) {
    (root || document).querySelectorAll('[data-reveal]').forEach((el) => {
      el.setAttribute('data-reveal-armed', '');
      release(el, 0);
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      reveal();
      /* Passe ce point, tout nouvel element arrive par le scroll : il n'a plus
         droit au traitement « premier ecran ». */
      requestAnimationFrame(() => { booted = true; });
    });
  }

  Object.assign(OW, { countUp, reveal, revealAgain, revealNow });
}(window.OW = window.OW || {}));
