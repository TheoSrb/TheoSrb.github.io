/* L'onglet Tribus — tout vient de l'export.

   Le bloc `tribes` de data/wiki_data.json decrit le systeme entier : rangs et
   droits, badges de reputation, arene, prestige, coffres et leur butin, formes
   et mosaiques de banniere. Cette page le met en scene — pas un seuil, pas un
   prix, pas un nom n'est ecrit ici. js/wiki-data.js aplatit les libelles du
   mod avant de les passer : ce qui arrive ici est deja dans la langue
   affichee.

   Six chapitres :

     l'atelier   la banniere, montee comme dans le jeu (formes, mosaiques,
                 teintures) — c'est aussi elle qu'on retrouve dans l'arene ;
     les rangs   trois cartes a jouer, couronnees par les sprites du mod ;
     les badges  une medaille a la fois, en grand ;
     l'arene     deux camps qui se battent pour de bon devant la vraie arene,
                 puis ce que rapporte un combat ;
     les coffres un coffre qu'on ouvre, et son butin. */

(function (OW) {
  'use strict';

  const esc = (v) => (OW.escapeHtml ? OW.escapeHtml(v) : String(v == null ? '' : v));

  /* Une url() posee dans une variable CSS est resolue par rapport a la feuille
     qui la consomme, pas par rapport a la page : on passe l'adresse complete. */
  const abs = (path) => new URL(path, window.location.href).href.replace(/'/g, '%27');

  const int = (v) => Number(v || 0).toLocaleString('fr-FR');
  const mn = (ms) => Math.round((ms || 0) / 60000);
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const head = (kicker, title) => `
    <div class="section-head tb-section-head">
      <span class="t-pixel t-accent">${esc(kicker)}</span>
      <h2 class="t-section">${esc(title)}</h2>
      <span class="fill"></span>
    </div>`;

  function readable(name) {
    return String(name || '').toLowerCase().replace(/_pattern$/, '').replace(/_/g, ' ')
      .replace(/^./, (c) => c.toUpperCase());
  }

  function replay(el, cls, ms) {
    if (!el || reduced()) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    clearTimeout(el._replay);
    el._replay = setTimeout(() => el.classList.remove(cls), ms || 600);
  }

  /* ===========================================================================
     Les planches du mod
     =========================================================================== */

  const SPRITES = 'assets/tribes/ow_teams_sprites.png';
  const SPRITES_SIZE = 256;

  /** Un morceau de l'atlas des tribus, agrandi `k` fois, pixels francs. */
  function sprite(u, v, w, h, k, cls) {
    return '<span class="tb-sprite ' + (cls || '') + '" aria-hidden="true" style="'
      + 'width:' + w * k + 'px;height:' + h * k + 'px;'
      + 'background-image:url(\'' + abs(SPRITES) + '\');'
      + 'background-size:' + SPRITES_SIZE * k + 'px ' + SPRITES_SIZE * k + 'px;'
      + 'background-position:' + (-u * k) + 'px ' + (-v * k) + 'px"></span>';
  }

  /* Les couronnes du mod, dans l'atlas : or pour le chef (0, 0 — 8 x 8),
     argent pour le chef adjoint (juste a droite — 8 x 5). Le membre n'en porte
     pas : on montre la place vide, la couronne d'argent en ombre. */
  const CROWNS = {
    chief: { u: 0, v: 0, w: 8, h: 8 },
    deputy: { u: 8, v: 0, w: 8, h: 5 }
  };

  function crown(role, k) {
    const c = CROWNS[role];
    if (c) return sprite(c.u, c.v, c.w, c.h, k, 'tb-crown is-' + role);
    const g = CROWNS.deputy;
    return sprite(g.u, g.v, g.w, g.h, k, 'tb-crown is-empty');
  }

  /* Formes de banniere : decoupees dans l'ordre du JSON (id 0 -> shape-1).
     Les fichiers font 96 rangees pour 93 utiles : le CSS ne montre que les 93
     premieres (--tb-crop). */
  const shapeUrl = (shape, layer) => 'assets/tribes/shapes/shape-' + (shape.id + 1) + '-' + layer + '.png';

  /* Medailles : lues dans l'atlas aux coordonnees de chaque badge. */
  function medal(badge, size) {
    if (!badge || !badge.has_sprite || badge.sprite_u < 0) {
      return '<span class="tb-medal is-none" style="--s:' + size + 'px" aria-hidden="true"></span>';
    }
    const k = size / (badge.sprite_size || 23);
    return '<span class="tb-medal" aria-hidden="true" style="--s:' + size + 'px;'
      + 'background-image:url(\'' + abs(SPRITES) + '\');'
      + 'background-size:' + (SPRITES_SIZE * k).toFixed(1) + 'px ' + (SPRITES_SIZE * k).toFixed(1) + 'px;'
      + 'background-position:' + (-badge.sprite_u * k).toFixed(1) + 'px ' + (-badge.sprite_v * k).toFixed(1) + 'px"></span>';
  }

  /* Coffres : 37 x 29 pixels, de face. Ils gardent ces proportions partout. */
  const CHEST_FOLDER = { GOLD: 'or', JADE: 'jade', RUBY: 'rubis' };
  const CHEST_RANK = { SMALL: 1, NORMAL: 2, LARGE: 3 };

  function chestUrl(chest) {
    const folder = CHEST_FOLDER[chest.material];
    if (!folder) return 'assets/tribes/chests/tribu.png';
    return 'assets/tribes/chests/' + folder + '-' + (CHEST_RANK[chest.size] || 1) + '.png';
  }

  function chestArt(chest, cls, i) {
    const lid = OW.chestLid ? OW.chestLid(chestUrl(chest)).style + ';' : '';
    return `<span class="tb-chest ${cls || ''}" style="--src:url('${abs(chestUrl(chest))}');--ink:${esc(chest.accent || '#E9B115')};--i:${i || 0};${lid}" aria-hidden="true">
        <span class="tb-chest-glow"></span><span class="tb-lid"></span><span class="tb-box"></span>
      </span>`;
  }

  const coin = () => `<span class="tb-coin crisp" style="${OW.bg('assets/ui/coins/coin_3.png')}" aria-hidden="true"></span>`;

  /* ===========================================================================
     La banniere
     =========================================================================== */

  /* Les mosaiques, en CSS. Les tailles sont en pourcentages de l'etoffe : les
     rayures et le damier du jeu sont larges et peu nombreux, et ils le restent
     quelle que soit la taille a laquelle la banniere est dessinee. */
  const MOSAIC = {
    GRADIENT_DOWN: (a, b) => 'linear-gradient(180deg,' + a + ',' + b + ')',
    GRADIENT_RIGHT: (a, b) => 'linear-gradient(90deg,' + a + ',' + b + ')',
    GRADIENT_UP: (a, b) => 'linear-gradient(0deg,' + a + ',' + b + ')',
    SPLIT_H: (a, b) => 'linear-gradient(180deg,' + a + ' 50%,' + b + ' 50%)',
    SPLIT_V: (a, b) => 'linear-gradient(90deg,' + a + ' 50%,' + b + ' 50%)',
    DIAGONAL_TL_BR: (a, b) => 'linear-gradient(135deg,' + a + ' 50%,' + b + ' 50%)',
    THIRDS_H: (a, b, c) => 'linear-gradient(180deg,' + a + ' 33.34%,' + b + ' 33.34% 66.67%,' + c + ' 66.67%)',
    THIRDS_V: (a, b, c) => 'linear-gradient(90deg,' + a + ' 33.34%,' + b + ' 33.34% 66.67%,' + c + ' 66.67%)',
    CIRCLE_PRI: (a, b) => 'radial-gradient(circle at 50% 44%,' + a + ' 33%,' + b + ' 33%)',
    STRIPES: (a, b) => 'repeating-linear-gradient(135deg,' + a + ' 0 14%,' + b + ' 14% 28%)',
    CHECKER: (a, b) => 'repeating-conic-gradient(' + a + ' 0 25%,' + b + ' 0 50%) 0 0 / 40% 23.66%',
    /* Le losange est decoupe au clip-path (voir css/tribes.css). */
    DIAMOND: (a, b) => b
  };
  const mosaicOf = (name, a, b, c) => (MOSAIC[name] || ((x) => x))(a, b, c);

  const CLOTH = ['#B02E26', '#E8A72B', '#30B030'];
  const SLOT_NAME = { primary: 'Principale', secondary: 'Secondaire', tertiary: 'Tertiaire' };

  /* Votre banniere : celle de l'atelier, qu'on retrouve dans l'arene. */
  const B = { shape: 0, pattern: 0, dyes: CLOTH.slice() };
  /* La tribu d'en face : une autre forme, une autre mosaique, d'autres couleurs. */
  const RIVAL = { shape: 4, pattern: 'STRIPES', dyes: ['#2E5FB0', '#D8E2F0', '#1C2F55'] };

  const flag = (fs, fp, cls, rival) => `
    <span class="tb-flag ${cls || ''}" data-fs="${fs}" data-fp="${fp}"${rival ? ' data-rival' : ''} aria-hidden="true">
      <span class="tb-flag-paint"><span class="tb-flag-base"></span><span class="tb-flag-gem"></span></span>
      <span class="tb-flag-line"></span>
    </span>`;

  function paintFlags(root, t) {
    const shapes = t.banner.shapes || [];
    const patterns = t.banner.patterns || [];
    root.querySelectorAll('.tb-flag[data-fs]').forEach((el) => {
      const rival = el.hasAttribute('data-rival');
      const dyes = rival ? RIVAL.dyes : B.dyes;
      const shape = shapes[rival ? RIVAL.shape : (el.dataset.fs === '*' ? B.shape : +el.dataset.fs)] || shapes[0];
      const pattern = rival
        ? (patterns.find((p) => p.name === RIVAL.pattern) || {})
        : (patterns[el.dataset.fp === '*' ? B.pattern : +el.dataset.fp] || patterns[0] || {});
      el.style.setProperty('--tb-fill', 'url(\'' + abs(shapeUrl(shape, 'fill')) + '\')');
      el.style.setProperty('--tb-line', 'url(\'' + abs(shapeUrl(shape, 'line')) + '\')');
      el.style.setProperty('--tb-a', dyes[0]);
      el.style.setProperty('--tb-mosaic', mosaicOf(pattern.name, dyes[0], dyes[1], dyes[2]));
      el.dataset.pattern = pattern.name || '';
    });
    root.querySelectorAll('[data-pick-shape]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.pickShape === B.shape)));
    root.querySelectorAll('[data-pick-pattern]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.pickPattern === B.pattern)));
    root.querySelectorAll('[data-dye-swatch]').forEach((s) => { s.style.background = B.dyes[+s.dataset.dyeSwatch]; });
    root.querySelectorAll('[data-tb-dye]').forEach((i) => { i.value = B.dyes[+i.dataset.tbDye]; });
    const shape = shapes[B.shape] || {};
    const pattern = patterns[B.pattern] || {};
    root.querySelectorAll('[data-say-shape]').forEach((e) => { e.textContent = shape.label || shape.name || ''; });
    root.querySelectorAll('[data-say-pattern]').forEach((e) => { e.textContent = pattern.label || readable(pattern.name); });
    root.querySelectorAll('[data-say-price]').forEach((e) => {
      e.innerHTML = shape.purchasable ? esc(String(shape.price)) + ' ' + coin() : 'Gratuite';
      e.classList.toggle('is-free', !shape.purchasable);
    });
  }

  function hex(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
    return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  const special = (p) => p.unlockable || p.custom_paint;

  /* ===========================================================================
     L'atelier de banniere — l'etabli
     =========================================================================== */

  function atelierHtml(t) {
    const shapes = t.banner.shapes || [];
    const patterns = t.banner.patterns || [];
    const slots = t.banner.color_slots || ['primary', 'secondary', 'tertiary'];
    return `
      <div class="tbA3">
        <div class="tbA3-side" role="radiogroup" aria-label="Forme">
          ${shapes.map((s, i) => `
            <button type="button" class="tbA3-shape" data-pick-shape="${i}" role="radio" title="${esc(s.label || s.name)}" style="--i:${i}">
              <span class="tbA3-cut" style="--tb-fill:url('${abs(shapeUrl(s, 'fill'))}')"></span>
              ${s.purchasable ? `<em>${esc(String(s.price))}</em>` : ''}
            </button>`).join('')}
        </div>
        <div class="tbA3-center">
          <div class="tbA3-plinth">${flag('*', '*')}</div>
          <b class="tbA3-name" data-say-shape></b>
          <span class="tbA3-sub"><span data-say-pattern></span> · <span class="tb-price" data-say-price></span></span>
          <div class="tb-dyes">
            ${slots.map((slot, i) => `
              <label class="tb-dye" style="--i:${i}">
                <span class="tb-dye-pot" data-dye-swatch="${i}"></span>
                <input type="color" value="${B.dyes[i]}" data-tb-dye="${i}" aria-label="Teinture ${esc(SLOT_NAME[slot] || slot)}">
                <span class="tb-dye-name">${esc(SLOT_NAME[slot] || slot)}</span>
              </label>`).join('')}
            <button type="button" class="tb-dice" data-tb-dice title="Générer une bannière aléatoire" aria-label="Générer une bannière aléatoire">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2h12v12H2zm2 2v8h8V4zm1 1h2v2H5zm4 0h2v2H9zM7 7h2v2H7zm-2 2h2v2H5zm4 0h2v2H9z"/></svg>
            </button>
          </div>
        </div>
        <div class="tbA3-side tbA3-grid" role="radiogroup" aria-label="Mosaïque">
          ${patterns.map((p, i) => `
            <button type="button" class="tbA3-mosaic${special(p) ? ' is-special' : ''}" data-pick-pattern="${i}" role="radio"
                    title="${esc(p.label || readable(p.name))}" style="--i:${i}">
              <span class="tb-tile" data-pattern="${esc(p.name)}"></span>
            </button>`).join('')}
        </div>
      </div>`;
  }

  function mountAtelier(body, t) {
    const patterns = t.banner.patterns || [];
    const shapes = t.banner.shapes || [];
    const page = () => body.closest('[data-tribes]') || body;
    const tiles = () => body.querySelectorAll('.tb-tile').forEach((tile, i) => {
      const p = patterns[i] || {};
      tile.style.background = mosaicOf(p.name, B.dyes[0], B.dyes[1], B.dyes[2]);
      tile.classList.toggle('is-gem', p.name === 'DIAMOND');
      tile.style.setProperty('--tb-a', B.dyes[0]);
    });
    /* La banniere de l'atelier est aussi celle de l'arene : on repeint toute
       la page, pas seulement l'etabli. */
    const changed = (stamp) => {
      paintFlags(page(), t);
      tiles();
      if (stamp) replay(body.querySelector('.tbA3-plinth'), 'is-stamp', 520);
    };
    body.addEventListener('click', (event) => {
      const s = event.target.closest('[data-pick-shape]');
      if (s) { B.shape = +s.dataset.pickShape; changed(true); return; }
      const p = event.target.closest('[data-pick-pattern]');
      if (p) { B.pattern = +p.dataset.pickPattern; changed(true); return; }
      if (event.target.closest('[data-tb-dice]')) {
        const h = Math.floor(Math.random() * 360);
        B.dyes = [hex(h, 70, 42), hex((h + 40 + Math.random() * 140) % 360, 75, 55), hex((h + 180) % 360, 60, 45)];
        const plain = patterns.map((x, i) => (special(x) ? -1 : i)).filter((i) => i >= 0);
        B.pattern = plain[Math.floor(Math.random() * plain.length)] || 0;
        B.shape = Math.floor(Math.random() * shapes.length);
        changed(true);
      }
    });
    body.addEventListener('input', (event) => {
      const dye = event.target.closest('[data-tb-dye]');
      if (!dye) return;
      B.dyes[+dye.dataset.tbDye] = dye.value;
      changed(false);
    });
    tiles();
  }

  /* ===========================================================================
     Les rangs — trois cartes couronnees
     =========================================================================== */

  const ROLE_NAME = { member: 'Membre' };

  function rolesHtml(t) {
    const perms = t.permissions || [];
    return `
      <div class="tbR5">
        ${(t.roles || []).map((r, i) => {
          const has = (p) => (r.default_permissions || []).indexOf(p.name) !== -1;
          return `
          <article class="tbR5-card is-${esc(r.id)}" style="--i:${i}">
            <span class="tbR5-art"><span class="tbR5-rays"></span>${crown(r.id, 10)}</span>
            <b>${esc(r.label || ROLE_NAME[r.id] || readable(r.id))}</b>
            <span class="tb-pips" title="${perms.filter(has).length} droits sur ${perms.length}">
              ${perms.map((p) => `<i class="${has(p) ? 'is-on' : ''}"></i>`).join('')}
            </span>
            <ul class="tb-rights">
              ${perms.map((p) => `<li class="${has(p) ? 'is-on' : ''}" title="${esc(p.description || '')}">${esc(p.label || p.name)}</li>`).join('')}
            </ul>
          </article>`;
        }).join('')}
      </div>`;
  }

  /* Les cartes se penchent vers la souris. */
  function mountRoles(body) {
    if (reduced()) return;
    body.querySelectorAll('.tbR5-card').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--rx', ((e.clientY - r.top) / r.height - .5) * -14 + 'deg');
        card.style.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 16 + 'deg');
      });
      card.addEventListener('pointerleave', () => {
        card.style.removeProperty('--rx');
        card.style.removeProperty('--ry');
      });
    });
  }

  /* ===========================================================================
     Les badges — le trophee
     =========================================================================== */

  function badgesHtml(t) {
    const badges = ((t.reputation || {}).badges || []).filter((b) => b.has_sprite);
    return `
      <div class="tbB3">
        <div class="tbB3-show" data-b3-show></div>
        <div class="tbB3-row" role="tablist" aria-label="Badges">
          ${badges.map((b, i) => `
            <button type="button" class="tbB3-pick" data-b3="${i}" role="tab" style="--ink:${esc(b.accent)}"
                    aria-label="${esc(b.label || b.name)}">
              ${medal(b, 46)}
              <span>${esc(b.label || b.name)}</span>
            </button>`).join('')}
        </div>
      </div>`;
  }

  function mountBadges(body, t) {
    const all = (t.reputation || {}).badges || [];
    const badges = all.filter((b) => b.has_sprite);
    const seen = {};
    const firsts = all.map((b) => {
      const u = b.unlocks_tribe_chest ? 'Coffre de tribu' : (b.unlocks_arena ? 'Arène' : '');
      if (!u || seen[u]) return '';
      seen[u] = true;
      return u;
    });
    const show = body.querySelector('[data-b3-show]');
    let at = 0;
    function draw(i) {
      at = (i + badges.length) % badges.length;
      const b = badges[at];
      const u = firsts[all.indexOf(b)];
      show.style.setProperty('--ink', b.accent);
      show.innerHTML = `
        <span class="tbB3-rays" aria-hidden="true"></span>
        <span class="tbB3-medal">${medal(b, 132)}</span>
        <b class="tbB3-name">${esc(b.label || b.name)}</b>
        <span class="tbB3-pts">${esc(int(b.threshold))} <small>points de réputation</small></span>
        ${u ? `<em class="tbB3-unlock">Débloque : ${esc(u)}</em>` : ''}`;
      body.querySelectorAll('[data-b3]').forEach((x) => x.setAttribute('aria-selected', String(+x.dataset.b3 === at)));
    }
    let timer = reduced() ? 0 : setInterval(() => draw(at + 1), 2600);
    body.addEventListener('click', (e) => {
      const p = e.target.closest('[data-b3]');
      if (!p) return;
      clearInterval(timer); timer = 0;
      draw(+p.dataset.b3);
    });
    draw(0);
    return () => clearInterval(timer);
  }

  /* ===========================================================================
     L'arene — tribu contre tribu

     La vraie arene en fond : la texture du lieu par defaut de chaque terrain,
     telle que l'export la nomme (ow:textures/gui/arena/terrestrial_0.png), est
     cherchee dans assets/arena/ sous le meme nom. Devant, votre banniere
     (celle de l'atelier) contre celle d'en face, et les betes qui se battent.
     =========================================================================== */

  /* Qui se bat, par terrain. Sur terre, deux contre deux ; sous l'eau, un
     duel : le crocodile a gauche, l'orque a droite. */
  const FIGHT = {
    TERRESTRIAL: [['kodiak', 'kangaroo'], ['tiger', 'gorilla']],
    AQUATIC: [['crocodile'], ['orca']]
  };

  /* Le sens dans lequel chaque rendu solo regarde. Le camp de gauche regarde a
     droite, celui de droite a gauche : on retourne ceux qui tournent le dos a
     l'adversaire. */
  const FACES_LEFT = ['tiger', 'gorilla', 'orca', 'crocodile', 'elephant'];

  function soloPath(slug) {
    const name = String(slug).split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return encodeURI('assets/entities/solo/' + name + ' [SOLO].png');
  }

  /** La capture d'arene d'un terrain, d'apres la texture que l'export donne. */
  function arenaPhoto(t, terrain) {
    const arena = t.arena || {};
    const tr = (arena.terrains || []).find((x) => x.name === terrain) || {};
    const venue = (arena.venues || []).find((v) => v.name === tr.default_venue) || {};
    const file = String(venue.texture || venue.display_texture || '').split('/').pop();
    return file ? 'assets/arena/' + file : '';
  }

  function beastOf(data, slug) {
    return (data.allEntities || data.entities).find((e) => e.slug === slug) || { slug, name: readable(slug) };
  }

  function camp(t, data, terrain, side) {
    const team = (FIGHT[terrain] || FIGHT.TERRESTRIAL)[side];
    const wantLeft = side === 0;
    return `
      <div class="tbV-camp is-${side ? 'right' : 'left'}" data-n="${team.length}">
        ${flag('*', '*', 'tbV-flag', side === 1)}
        <div class="tbV-fighters">
          ${team.map((slug, k) => {
            const b = beastOf(data, slug);
            const mirror = wantLeft ? FACES_LEFT.indexOf(slug) !== -1 : FACES_LEFT.indexOf(slug) === -1;
            return `
              <span class="tbV-fighter" style="--k:${k}">
                <img class="tbV-solo${mirror ? ' is-mirror' : ''}" alt="${esc(b.name)}"
                     ${OW.imgAttr([OW.soloVignettePath(slug), soloPath(slug), b.art].filter(Boolean), { lazy: true })} decoding="async">
                <span class="tbV-dmg" aria-hidden="true">-${esc(String(Math.round((b.stats && b.stats.damage) || 6)))}</span>
              </span>`;
          }).join('')}
        </div>
      </div>`;
  }

  /* Les etincelles d'un coup : quelques cases qui partent en etoile. */
  const sparks = (n) => Array.from({ length: n }, (_, i) => `<i style="--a:${Math.round(i * 360 / n)}deg;--r:${50 + (i % 3) * 22}px"></i>`).join('');

  function arenaScene(t, data, terrain) {
    const photo = arenaPhoto(t, terrain);
    return `
      <span class="tbV-photo" data-terrain="${esc(terrain)}" ${photo ? OW.imgAttr([photo], { mode: 'bg' }) : ''} aria-hidden="true"></span>
      <span class="tbV-shade" aria-hidden="true"></span>
      ${camp(t, data, terrain, 0)}
      <span class="tbV-hit is-a" aria-hidden="true"><span class="tbV-star"></span>${sparks(8)}</span>
      <span class="tbV-hit is-b" aria-hidden="true"><span class="tbV-star"></span>${sparks(8)}</span>
      <span class="tbV-vs" aria-label="contre"><b>V</b><b>S</b></span>
      ${camp(t, data, terrain, 1)}`;
  }

  /** Ce que rapporte un combat : prestige, reputation, et les coffres au bout. */
  function rewardsHtml(t) {
    const arena = t.arena || {};
    const p = arena.prestige || {};
    const access = arena.access || {};
    const k = (t.constants && t.constants.arena) || {};
    const share = k.PRESTIGE_LOSER_SHARE != null ? k.PRESTIGE_LOSER_SHARE : 0.25;
    const chests = arena.chests || [];
    const first = chests[0];
    const tribe = chests.find((c) => c.material === 'TRIBE');
    const lo = Math.max(1, Math.round((p.min_gain || 10) * share));
    const hi = Math.max(1, Math.round((p.max_gain || 300) * share));
    return `
      <div class="tbW">
        <article class="tbW-card is-win">
          <span class="tbW-tag">Victoire</span>
          <div class="tbW-line"><b>+${esc(String(p.min_gain || 10))} à +${esc(String(p.max_gain || 300))}</b><i>prestige</i></div>
          <div class="tbW-line"><b>+${esc(int(p.reputation_min_gain || 100))}</b><i>réputation minimum</i></div>
          <p>Le gain augmente avec la réputation de la tribu adverse.</p>
        </article>
        <article class="tbW-card is-loss">
          <span class="tbW-tag">Défaite</span>
          <div class="tbW-line"><b>+${esc(String(lo))} à +${esc(String(hi))}</b><i>prestige</i></div>
          <div class="tbW-line"><b>${esc(String(Math.round(share * 100)))} %</b><i>du gain du vainqueur</i></div>
          <p>La tribu vaincue reçoit une part du prestige attribué au vainqueur.</p>
        </article>
        <div class="tbW-road">
          <div class="tbW-step">
            <span class="tbW-bar"><i></i></span>
            <b>${esc(String(p.per_chest || 300))} prestige</b>
            <span class="tbW-eq">=</span>
            ${first ? chestArt(first, 'tbW-chest', 0) : ''}
            <b>1 coffre</b>
          </div>
          ${tribe ? `
          <div class="tbW-step">
            <b>${esc(String(access.chests_per_tribe_chest || 10))} coffres</b>
            <span class="tbW-eq">=</span>
            ${chestArt(tribe, 'tbW-chest', 3)}
            <b>${esc(tribe.label || 'Coffre de tribu')}</b>
          </div>` : ''}
        </div>
      </div>`;
  }

  function arenaHtml(t) {
    const arena = t.arena || {};
    const match = arena.match || {};
    const access = arena.access || {};
    const badge = ((t.reputation || {}).badges || []).find((b) => b.name === access.min_badge);
    const first = ((arena.terrains || [])[0] || {}).name || 'TERRESTRIAL';
    return `
      <div class="tbV">
        <div class="tbV-tabs" role="tablist" aria-label="Terrain">
          ${(arena.terrains || []).map((tr) => `
            <button type="button" class="tbV-tab" role="tab" data-terrain-pick="${esc(tr.name)}"
                    aria-selected="${tr.name === first}">${esc(tr.label || tr.name)}</button>`).join('')}
        </div>
        <div class="tbV-stage" data-vs-stage data-terrain="${esc(first)}"></div>
        <div class="tbV-strip">
          <span><b>${esc(String(match.max_fighters || 5))}</b> contre <b>${esc(String(match.max_fighters || 5))}</b></span>
          <span><b>${esc(String(mn((match.timings || {}).fight_timeout_ms)))}</b> min maximum</span>
          <span>${medal(badge, 22)} Accès dès le badge <b>${esc(badge ? (badge.label || badge.name) : readable(access.min_badge))}</b></span>
        </div>
      </div>
      ${rewardsHtml(t)}`;
  }

  function mountArena(body, t, data) {
    const stage = body.querySelector('[data-vs-stage]');
    function build(terrain) {
      stage.dataset.terrain = terrain;
      stage.innerHTML = arenaScene(t, data, terrain);
      paintFlags(stage, t);
      if (OW.resolveImages) OW.resolveImages(stage);
      body.querySelectorAll('[data-terrain-pick]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.terrainPick === terrain)));
      replay(stage, 'is-enter', 900);
    }
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-terrain-pick]');
      if (b) build(b.dataset.terrainPick);
    });
    /* L'arene bouge un peu avec la souris : la profondeur de la charge. */
    if (!reduced()) {
      stage.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        stage.style.setProperty('--mx', ((e.clientX - r.left) / r.width - .5).toFixed(3));
        stage.style.setProperty('--my', ((e.clientY - r.top) / r.height - .5).toFixed(3));
      });
    }
    build(stage.dataset.terrain);
  }

  /* ===========================================================================
     Les coffres — l'ouverture
     =========================================================================== */

  function lootHtml(chest, data) {
    const loot = chest.loot || [];
    const rare = loot.filter((l) => l.rare);
    const common = loot.filter((l) => !l.rare);
    const span = (l) => (l.min === l.max ? String(l.min) : l.min + '–' + l.max);
    const icon = (l, cls) => `
      <span class="${cls}" title="${esc(data.nameOf(l.item))} ×${esc(span(l))}">
        <span class="crisp" ${OW.imgAttr(OW.itemCandidates(l.item), { mode: 'bg' })} aria-hidden="true"></span>
        ${cls === 'tb-drop-rare' ? `<b>${esc(data.nameOf(l.item))}</b>` : ''}
      </span>`;
    return `
      <div class="tb-drops" style="--ink:${esc(chest.accent || '#E9B115')}">
        <div class="tb-drops-top">
          <h3>${esc(chest.label || readable(chest.name))}</h3>
          <span class="tb-coins">${coin()} ${esc(chest.min_coins)}–${esc(chest.max_coins)}</span>
        </div>
        ${rare.length ? `<div class="tb-drops-rare">${rare.map((l) => icon(l, 'tb-drop-rare')).join('')}</div>` : ''}
        <div class="tb-drops-grid">${common.map((l) => icon(l, 'tb-drop')).join('')}</div>
      </div>`;
  }

  function chestsHtml(t) {
    const chests = t.arena.chests || [];
    return `
      <div class="tbC2">
        <button type="button" class="tbC2-big" data-c2-open aria-label="Ouvrir le coffre">
          <span class="tbC2-shake" data-c2-art></span>
          <span class="tbC2-burst" data-c2-burst aria-hidden="true"></span>
          <span class="tbC2-hint">Clic pour ouvrir le coffre</span>
        </button>
        <div class="tbC2-row" role="tablist">
          ${chests.map((c, i) => `
            <button type="button" class="tbC2-pick" data-chest="${i}" role="tab" title="${esc(c.label)}">${chestArt(c, '', i)}</button>`).join('')}
        </div>
      </div>
      <div data-loot></div>`;
  }

  function mountChests(body, t, data) {
    const chests = t.arena.chests || [];
    const big = body.querySelector('[data-c2-open]');
    const art = body.querySelector('[data-c2-art]');
    const burst = body.querySelector('[data-c2-burst]');
    const view = body.querySelector('[data-loot]');
    let current = 0;
    function show(i) {
      current = i;
      big.classList.remove('is-open');
      art.innerHTML = chestArt(chests[i], 'is-huge');
      burst.innerHTML = '';
      big.style.setProperty('--ink', chests[i].accent || '#E9B115');
      view.innerHTML = lootHtml(chests[i], data);
      if (OW.resolveImages) OW.resolveImages(view);
      body.querySelectorAll('[data-chest]').forEach((b) => b.setAttribute('aria-selected', String(+b.dataset.chest === i)));
    }
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-chest]');
      if (b) show(+b.dataset.chest);
    });
    big.addEventListener('click', () => {
      const c = chests[current];
      if (big.classList.contains('is-open')) { big.classList.remove('is-open'); burst.innerHTML = ''; return; }
      const loot = (c.loot || []).filter((l) => l.rare).concat((c.loot || []).filter((l) => !l.rare)).slice(0, 9);
      burst.innerHTML = loot.map((l, k) => {
        /* Un eventail large au-dessus du coffre, en deux rangs alternes pour
           que les prises ne se chevauchent pas. */
        const a = (-172 + k * (164 / Math.max(1, loot.length - 1))) * Math.PI / 180;
        const r = 190 + (k % 2) * 56;
        return `<i class="crisp${l.rare ? ' is-rare' : ''}" ${OW.imgAttr(OW.itemCandidates(l.item), { mode: 'bg' })}
          style="--x:${Math.round(Math.cos(a) * r)}px;--y:${Math.round(Math.sin(a) * r)}px;--d:${k * 45}ms"></i>`;
      }).join('');
      if (OW.resolveImages) OW.resolveImages(burst);
      void big.offsetWidth;
      big.classList.add('is-open');
    });
    show(0);
  }

  /* ===========================================================================
     Montage
     =========================================================================== */

  const cleanups = {};

  /** Monte un chapitre : les ecouteurs de l'ancien corps partent avec lui. */
  function mountBody(host, section, html, mount, t, data) {
    const wrap = host.querySelector('[data-body="' + section + '"]');
    if (!wrap) return;
    if (cleanups[section]) { cleanups[section](); cleanups[section] = null; }
    const body = document.createElement('div');
    body.className = 'tb-variant';
    body.innerHTML = html;
    wrap.replaceChildren(body);
    paintFlags(body, t);
    if (mount) cleanups[section] = mount(body, t, data) || null;
    if (OW.resolveImages) OW.resolveImages(body);
  }

  const chapter = (id, kicker, title, extra) => `
    <section class="tb-chapter" id="tb-${id}">
      ${head(kicker, title)}
      ${extra || ''}
      <div data-body="${id}"></div>
    </section>`;

  function renderTribes(host, data) {
    if (!host) return;
    const t = data.tribes || {};
    if (!t.overview || !t.banner) {
      host.innerHTML = `<p class="tb-empty" role="note"><b>Données indisponibles.</b> L'export du mod ne contient pas encore
        de section <code>tribes</code> ; cette page s'affichera dès qu'elle sera disponible.</p>`;
      return;
    }
    const k = (t.constants && t.constants.reputation) || {};
    const per = ((t.arena || {}).prestige || {}).per_chest || 300;

    /* Pas d'en-tete propre : le titre de l'onglet suffit (retire le 24/10). */
    host.innerHTML = `
      ${chapter('atelier', '01', 'La bannière')}
      ${chapter('rangs', '02', 'Rangs et permissions')}
      ${chapter('badges', '03', 'Badges de réputation',
        `<p class="tb-lead">La réputation mesure la progression de la tribu. Elle dépend du nombre de créatures, de leur niveau
          et des victoires remportées en arène. En partie solo, les gains de réputation sont multipliés par ${esc(String(k.SOLO_MULTIPLIER || 5))}.</p>`)}
      ${chapter('arene', '04', 'Combats en arène')}
      ${chapter('coffres', '05', 'Coffres de récompense',
        `<p class="tb-lead">Chaque tranche de ${esc(String(per))} points de prestige gagnés en arène donne droit à un coffre.
          Son contenu dépend du badge de la tribu.</p>`)}`;

    mountBody(host, 'atelier', atelierHtml(t), mountAtelier, t, data);
    mountBody(host, 'rangs', rolesHtml(t), mountRoles, t, data);
    mountBody(host, 'badges', badgesHtml(t), mountBadges, t, data);
    mountBody(host, 'arene', arenaHtml(t), mountArena, t, data);
    mountBody(host, 'coffres', chestsHtml(t), mountChests, t, data);
  }

  OW.renderTribes = renderTribes;
}(window.OW = window.OW || {}));
