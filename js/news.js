/* Les nouveautes de l'accueil, posees dans le hero, en haut a droite.

   Toutes les creatures sorties sur le wiki depuis moins d'un mois
   (SITE_CONFIG.news.months, liste tenue par js/creature-card.js) ; aucune,
   l'encart disparait. Trois choses seulement, pour rester discret : une
   etoile de bande dessinee « Nouveau ! », le rendu solo de la bete, et le
   bouton qui ouvre sa fiche. Plusieurs nouveautes : elles defilent l'une
   apres l'autre (la plus recente d'abord), et leurs tetes, sous le bouton,
   permettent d'en choisir une. Le defilement suit la jauge de la tete en
   cours (une animation CSS) : il s'arrete au survol, quand l'onglet est
   cache, et ne demarre pas si le visiteur a demande moins d'animations.

   Trois placements, du plus large au plus serre : a droite du logo (ecran
   d'ordinateur) ; en une ligne entre le logo et la troupe (telephone
   allonge, tablette) ; en vignette dans le coin libre du logo, a droite de
   « W.I.L.D » (telephone court, ou rien ne tient sous le logo).

   Reglages : js/site-config.js (allumer, eteindre, forcer une bete).
   Apercu : index.html?news=<slug>. */

(function (OW) {
  'use strict';

  const { escapeHtml, animalHref } = OW;


  function soloArt(slug) {
    const name = String(slug).split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return OW.asset(encodeURI('assets/entities/solo/' + name + ' [SOLO].png'));
  }

  /* Les betes a mettre en avant, et l'etoile « Nouveau ! » : js/creature-card.js
     (les cartes du bestiaire portent la meme). */
  const burst = () => OW.newBurst();

  /* Le premier placement qui tient sans rien chevaucher. Mesure sur la mise
     en page (offset*), pas sur les animations d'entree du logo et de la
     troupe. */
  function place(host) {
    const stage = host.parentElement;
    const logo = stage && stage.querySelector('.hb-logo');
    const cast = stage && stage.querySelector('.hb-cast');
    if (!logo) return;
    host.classList.remove('is-compact', 'is-corner');

    /* A droite du logo. */
    if (host.offsetLeft >= logo.offsetLeft + logo.offsetWidth - 4) return;

    /* En ligne sous le logo, si elle s'arrete avant la troupe. */
    host.classList.add('is-compact');
    if (!cast || host.offsetTop + host.offsetHeight <= cast.offsetTop + 8) return;

    /* En vignette dans le coin du logo : « OPERATION » en occupe le haut, et
       « W.I.L.D » ne va pas au-dela de 72 % de sa largeur. */
    host.classList.remove('is-compact');
    host.classList.add('is-corner');
    const free = stage.clientWidth - (logo.offsetLeft + logo.offsetWidth * .72);
    host.style.setProperty('--corner-w', Math.round(Math.max(84, Math.min(128, free - 12))) + 'px');
    host.style.setProperty('--corner-top', Math.round(logo.offsetTop + logo.offsetHeight * .6) + 'px');
  }

  /* Les rendus solo n'ont pas tous les memes marges transparentes : on lit
     les vrais contours de la bete sur une vignette, et on cadre l'image pour
     que la bete, elle, remplisse la largeur du bloc, centree. Sans lecture
     possible (page ouverte en fichier local), le cadrage par defaut du CSS
     reste. */
  function frame(img, slide) {
    try {
      const W = 128;
      const H = 72;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, W, H);
      const px = ctx.getImageData(0, 0, W, H).data;
      let left = W;
      let right = -1;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (px[(y * W + x) * 4 + 3] > 40) {
            if (x < left) left = x;
            if (x > right) right = x;
          }
        }
      }
      if (right < left) return;
      const span = (right - left + 1) / W;
      const scale = Math.min(1.45, 1 / span);
      const centre = (left + right + 1) / 2 / W;
      slide.style.setProperty('--solo-w', (scale * 100).toFixed(1) + '%');
      slide.style.setProperty('--solo-x', ((0.5 - centre * scale) * 100).toFixed(1) + '%');
    } catch (err) { /* cadrage par defaut */ }
  }

  /* Une bete du carrousel. Seule la premiere se telecharge tout de suite (un
     rendu pese plusieurs mega-octets) ; la suivante part quand vient le tour
     de celle d'avant. */
  function slide(e, i) {
    return `
      <a class="hb-news-art${i ? '' : ' is-current'}" href="${animalHref(e.slug)}" tabindex="-1"
         aria-hidden="true" data-news-slide${i ? ' hidden' : ''}>
        <img class="hb-news-solo crisp" src="${OW.soloVignette(e.slug)}" data-solo-full="${soloArt(e.slug)}" alt=""
             decoding="async" width="1280" height="720"${i ? ' loading="lazy"' : ''}
             onerror="OW.soloImgError(this, '${escapeHtml(e.art)}')">
      </a>`;
  }

  function render(host, list) {
    const many = list.length > 1;
    host.innerHTML = `
      <div class="hb-news-reel">
        ${list.map(slide).join('')}
        <span class="hb-news-burst">
          ${burst()}
          <span class="hb-news-burst-text">Nouveau<i>!</i></span>
        </span>
      </div>
      <a class="btn btn-accent hb-news-btn" href="#" data-news-btn>
        <span>Découvrir</span>
        <small data-news-name></small>
      </a>
      ${many ? `
      <div class="hb-news-picks" role="group" aria-label="Les nouvelles créatures">
        ${list.map((e, i) => `
          <button type="button" class="hb-news-pick crisp" data-news-pick
                  style="--pick:${escapeHtml(e.color || '#F2A32C')};${OW.bg(e.head)}"
                  aria-label="Voir : ${escapeHtml(e.name)}"><i aria-hidden="true"></i></button>`).join('')}
      </div>` : ''}`;
    if (many) {
      host.setAttribute('aria-roledescription', 'carrousel');
      host.setAttribute('aria-label', 'Nouvelles créatures');
    }

    const slides = Array.from(host.querySelectorAll('[data-news-slide]'));
    const picks = Array.from(host.querySelectorAll('[data-news-pick]'));
    const btn = host.querySelector('[data-news-btn]');
    const name = host.querySelector('[data-news-name]');
    const star = host.querySelector('.hb-news-burst');
    let current = 0;

    /* Rejoue une animation d'entree : seulement du mouvement, la bete est
       visible des la premiere image, meme si l'animation ne part jamais. */
    const replay = (el, cls) => {
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
    };

    function show(index, swap) {
      current = (index + list.length) % list.length;
      const e = list[current];
      host.style.setProperty('--ink', e.color || '#F2A32C');
      slides.forEach((s, i) => {
        s.hidden = i !== current;
        s.classList.toggle('is-current', i === current);
      });
      if (swap) {
        replay(slides[current], 'is-in');
        replay(star, 'is-bump');
      }
      btn.href = animalHref(e.slug);
      btn.setAttribute('aria-label', 'Découvrir la nouvelle créature : ' + e.name);
      name.textContent = e.name;
      picks.forEach((p, i) => {
        p.classList.toggle('is-current', i === current);
        p.setAttribute('aria-pressed', String(i === current));
      });
      if (many) slides[(current + 1) % list.length].querySelector('img').loading = 'eager';
    }

    slides.forEach((s) => {
      const img = s.querySelector('.hb-news-solo');
      img.addEventListener('load', () => frame(img, s));
      if (img.complete && img.naturalWidth) frame(img, s);
    });
    picks.forEach((p, i) => p.addEventListener('click', () => { if (i !== current) show(i, true); }));
    /* La jauge de la tete en cours arrivee au bout : au tour de la suivante. */
    host.addEventListener('animationend', (event) => {
      if (event.target.parentElement === picks[current]) show(current + 1, true);
    });

    show(0, false);
    host.hidden = false;
    place(host);
    window.addEventListener('resize', () => place(host));
  }

  OW.mountNews = function (data) {
    const host = document.querySelector('[data-news]');
    if (!host || !data || !OW.newCreatures) return;
    const list = OW.newCreatures(data);
    if (list.length) render(host, list);
  };
}(window.OW = window.OW || {}));
