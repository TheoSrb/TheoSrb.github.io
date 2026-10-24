/* La page des boss (bosses.html).

   Les boss viennent du JSON du mod : toute entite dont classification.boss
   est vrai (js/wiki-data.js les met a part, dans data.bosses — ils ne
   comptent jamais comme creatures). Chacun a son dossier : son rendu, sa
   barre de boss, ses statistiques en caisses, ses regles de combat et ses
   reliques.

   Les boss scelles viennent de js/upcoming.js (OW.UPCOMING_BOSSES, genere par
   tools/publish-data.py depuis tools/hidden.json, « boss_mysteres ») : une
   silhouette noire, une menace, un indice, et aucun nom. Un boss scelle
   disparait de lui-meme le jour ou l'export contient un boss de meme
   empreinte.

   Le rendu d'un boss : assets/bosses/solo/<slug>.png, sinon
   assets/entities/<slug>.png. Son fond de scene, s'il existe :
   assets/bosses/wallpapers/<slug>.png. */

(function (OW) {
  'use strict';

  const { loadWikiData, mountHeader, mountFooter, reveal, escapeHtml, num } = OW;

  const REDUCED = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LITE = () => !!(OW.perf && OW.perf.lite && OW.perf.lite());

  /* ---- ce que le JSON ne dit pas -------------------------------------------------

     Les regles de combat d'un boss ne sont pas dans l'export : elles se
     lisent dans sa classe Java (IdeaProjects/Operation-W.I.L.D,
     entity/bosses/). Une entree par boss ; un boss sans entree garde un
     dossier complet, simplement sans ces deux blocs.
       epithet : le sous-titre du dossier ;
       threat  : 1 a 5 tetes de mort (sinon deduit des PV) ;
       parts   : les morceaux de sa barre de boss (PV de chacun) ;
       rules   : comment le vaincre. */
  const NOTES = {
    /* PlantEmpressEntity.java */
    plant_empress: {
      epithet: 'La reine aux trois gueules',
      threat: 5,
      parts: [
        { label: 'Tête gauche', hp: 75 },
        { label: 'Tête centrale', hp: 150, core: true },
        { label: 'Tête droite', hp: 75 }
      ],
      rules: [
        { icon: 'shield', title: 'Aucune lame ne l’atteint',
          text: 'Épées, crocs et griffes ne lui font rien : seuls les projectiles qui touchent l’une de ses trois têtes la blessent.' },
        { icon: 'bow', title: 'Flèches, lance, trident',
          text: 'Chaque tir inflige les dégâts de base du projectile, quelle que soit sa vitesse. Une bille de lance-pierre : 2 dégâts. Un seul tir compte par seconde.' },
        { icon: 'crown', title: 'La tête centrale en dernier',
          text: 'Elle arrête tout projectile tant que les deux têtes latérales vivent. Il faut donc les abattre d’abord : chacune s’effondre à 0 PV.' },
        { icon: 'venom', title: 'Le venin la ronge',
          text: 'Une flèche venimeuse l’empoisonne 10 à 15 secondes : pendant ce temps, chaque tir lui fait 50 % de dégâts en plus.' },
        { icon: 'root', title: 'Enracinée',
          text: 'Elle ne bouge pas d’un bloc et ne recule jamais. Son thème retentit à son apparition, puis toutes les 2 min 24 s.' }
      ]
    }
  };

  /* ---- les pixels -------------------------------------------------------------- */

  const SKULL = {
    eyes: 'M3 6h4v1h-4zM9 6h4v1h-4zM3 7h4v1h-4zM9 7h4v1h-4zM4 8h2v1h-2zM10 8h2v1h-2z',
    cran: 'M4 1h8v1h-8zM2 2h12v1h-12zM1 3h14v1h-14zM1 4h14v1h-14zM0 5h16v1h-16zM0 6h3v1h-3zM7 6h2v1h-2zM13 6h3v1h-3zM0 7h3v1h-3zM7 7h2v1h-2zM13 7h3v1h-3zM0 8h4v1h-4zM6 8h4v1h-4zM12 8h4v1h-4zM1 9h6v1h-6zM9 9h6v1h-6zM2 10h5v1h-5zM9 10h5v1h-5zM3 11h10v1h-10z',
    jaw: 'M3 12h2v1h-2zM6 12h1v1h-1zM9 12h1v1h-1zM11 12h2v1h-2zM3 13h10v1h-10zM4 14h8v1h-8zM6 15h4v1h-4z'
  };

  function skull(cls) {
    return '<svg class="bz-skull' + (cls ? ' ' + cls : '') + '" viewBox="0 0 16 16" aria-hidden="true" focusable="false">'
      + '<path class="sk-eyes" d="' + SKULL.eyes + '"/><path class="sk-cran" d="' + SKULL.cran + '"/>'
      + '<path class="sk-jaw" d="' + SKULL.jaw + '"/></svg>';
  }

  /* Les icones des regles, en cases 16x16 comme celles du site (js/ux.js). */
  const RULE_ICONS = {
    shield: 'M2 2h12v2H2zM2 4h2v6H2zM12 4h2v6h-2zM4 10h2v2H4zM10 10h2v2h-2zM6 12h4v2H6zM5 5h6v2H5zM7 7h2v3H7z',
    bow: 'M9 1h4v2H9zM12 3h2v4h-2zM13 7h1v2h-1zM12 9h2v4h-2zM9 13h4v2H9zM3 12h2v2H3zM5 10h2v2H5zM7 8h2v2H7zM9 6h2v2H9zM10 4h1v2h-1zM1 13h2v2H1z',
    crown: 'M1 3h2v2H1zM7 2h2v2H7zM13 3h2v2h-2zM2 5h2v3H2zM6 4h4v3H6zM12 5h2v3h-2zM2 8h12v3H2zM2 12h12v2H2z',
    venom: 'M7 1h2v2H7zM6 3h4v2H6zM5 5h6v2H5zM4 7h8v3H4zM5 10h6v2H5zM6 12h4v1H6zM6 7h1v1H6zM9 7h1v1H9z',
    root: 'M7 1h2v6H7zM4 4h2v2H4zM10 4h2v2h-2zM5 6h6v2H5zM3 8h10v2H3zM2 10h3v2H2zM7 10h2v4H7zM11 10h3v2h-3zM1 12h2v2H1zM13 12h2v2h-2z'
  };
  const ruleIcon = (name) => '<svg class="px-ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="'
    + (RULE_ICONS[name] || RULE_ICONS.shield) + '"/></svg>';

  /* ---- lecture des donnees ---------------------------------------------------------- */

  const threatOf = (boss) => {
    const note = NOTES[boss.slug];
    if (note && note.threat) return note.threat;
    const hp = boss.stats.hp || 0;
    return hp >= 250 ? 5 : hp >= 150 ? 4 : hp >= 80 ? 3 : 2;
  };

  /* Le motif de banniere de tribu qui porte le nom du boss (tribes.banner). */
  function patternOf(boss, data) {
    const patterns = (data.tribes && data.tribes.banner && data.tribes.banner.patterns) || [];
    const key = boss.slug.toUpperCase();
    return patterns.find((p) => String(p.name || '').indexOf(key) !== -1) || null;
  }

  /* Son rang dans l'arene des tribus (tribes.arena.roster). */
  function arenaOf(boss, data) {
    const roster = (data.tribes && data.tribes.arena && data.tribes.arena.roster) || [];
    return roster.find((r) => r.id === boss.id || r.path === boss.slug) || null;
  }

  const THEME_LABEL = [
    [/_defeated$/, 'Thème de la victoire', 'Joué à sa mort'],
    [/_theme_lite$/, 'Thème allégé', 'Version courte'],
    [/_theme$/, 'Thème du combat', 'Joué à son apparition']
  ];
  function themesOf(boss) {
    return boss.sounds.map((s) => {
      const hit = THEME_LABEL.find(([re]) => re.test(s.path));
      return hit ? { title: hit[1], sub: hit[2], id: s.id } : null;
    }).filter(Boolean);
  }

  function relicsOf(boss, data) {
    const disc = (data.items || []).find((i) => i.path === boss.slug + '_music_disc');
    const pattern = patternOf(boss, data);
    const relics = [];
    if (disc) relics.push({ kind: 'disc', name: 'Disque de musique', sub: 'Objet ' + (RARITY[disc.rarity] || 'du mod'), img: 'assets/item/' + disc.path + '.png' });
    if (pattern) relics.push({ kind: 'banner', name: 'Motif de bannière « Boss »', sub: pattern.unlockable ? 'Tribu · à débloquer' : 'Tribu', img: null });
    return relics;
  }

  /* La piste du boss dans l'onglet Musiques (js/music.js, openRequested) :
     la page s'y rend, et la lance si elle a un fichier. */
  const musicHref = (boss) => 'music.html?boss=' + encodeURIComponent(boss.slug);
  const NOTE_ICON = '<svg class="px-ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 1h8v2H6zM6 3h2v8H6zM12 3h2v6h-2zM2 10h6v4H2zM8 8h6v4H8z"/></svg>';

  const RARITY = { COMMON: 'commun', UNCOMMON: 'peu commun', RARE: 'rare', EPIC: 'épique' };
  const TERRAIN = { TERRESTRIAL: 'Terrestre', AQUATIC: 'Aquatique', SEMI_AQUATIC: 'Semi-aquatique' };

  /* ---- les morceaux de dossier -------------------------------------------------------- */

  const threatRow = (n) => '<div class="bz-threat" role="img" aria-label="Menace ' + n + ' sur 5">'
    + [0, 1, 2, 3, 4].map((i) => '<span class="bz-threat-pip' + (i < n ? ' is-on' : '') + '" style="--i:' + i + '">' + skull() + '</span>').join('')
    + '</div>';

  /* La barre de boss de Minecraft : le nom au-dessus, une jauge en segments.
     Les morceaux (les tetes de l'Imperatrice) la decoupent a leur part de PV. */
  function bossBar(name, hp, parts, sealed) {
    const total = parts && parts.length ? parts.reduce((s, p) => s + p.hp, 0) : 0;
    const segs = total
      ? parts.map((p) => '<span class="bz-bar-part' + (p.core ? ' is-core' : '') + '" style="flex:' + p.hp + '"></span>').join('')
      : '<span class="bz-bar-part" style="flex:1"></span>';
    return '<div class="bz-bar' + (sealed ? ' is-sealed' : '') + '">'
      + '<div class="bz-bar-name"><span>' + escapeHtml(name) + '</span><span class="bz-bar-hp">' + (sealed ? '??? PV' : num(hp, 0) + ' PV') + '</span></div>'
      + '<div class="bz-bar-track" data-reveal="bar"><div class="bz-bar-fill">' + segs + '</div></div>'
      + '</div>';
  }

  /* Une statistique dans sa caisse : bois cercle de fer, comme les pancartes. */
  const crate = (value, key, count, i) => '<div class="bz-crate" data-reveal="pop" style="--i:' + i + '">'
    + '<span class="bz-crate-value' + (/^[0-9?.,\s×—-]+$/.test(String(value)) ? '' : ' is-word') + '"' + (count ? ' data-count' : '') + '>' + escapeHtml(value) + '</span>'
    + '<span class="bz-crate-key">' + escapeHtml(key) + '</span></div>';

  function crates(boss, data) {
    const s = boss.stats;
    const size = boss.size || {};
    const arena = arenaOf(boss, data);
    const kb = s.knockbackRes;
    const list = [
      [num(s.hp, 0), 'Points de vie', true],
      [num(s.damage, 1), 'Dégâts', true],
      [num(s.armor || 0, 1), 'Armure', true],
      [kb >= 1 ? 'Inébranlable' : Math.round((kb || 0) * 100) + ' %', 'Résistance au recul', kb < 1],
      [size.height ? num(size.height, 1) + ' × ' + num(size.width, 1) : '—', 'Taille (blocs)', false],
      [arena && arena.terrains && arena.terrains.length ? arena.terrains.map((t) => TERRAIN[t] || t).join(' · ') : (boss.gameplay.fightsInArena ? 'Oui' : 'Non'), 'Arène', false]
    ];
    return '<div class="bz-crates">' + list.map((c, i) => crate(c[0], c[1], c[2], i)).join('') + '</div>';
  }

  function artImg(boss, cls) {
    const primary = 'assets/bosses/solo/' + boss.slug + '.png';
    const fallback = 'assets/entities/' + boss.slug + '.png';
    return '<img class="' + cls + ' crisp" src="' + primary + '" data-fallback="' + fallback + '" alt="' + escapeHtml(boss.name) + '" decoding="async">';
  }

  function stage(inner, n, extra) {
    return '<div class="bz-stage' + (extra || '') + '" data-reveal="zoom" data-bz-stage>'
      + '<span class="bz-stage-wall" data-bz-wall></span>'
      + '<span class="bz-stage-num" aria-hidden="true">' + String(n).padStart(2, '0') + '</span>'
      + '<span class="bz-stage-spot" aria-hidden="true"></span>'
      + '<span class="bz-stage-art" data-bz-parallax>' + inner + '</span>'
      + '<span class="bz-stage-fog" aria-hidden="true"></span>'
      + '<span class="bz-stage-rim" aria-hidden="true"></span>'
      + '</div>';
  }

  function dossier(boss, data, n) {
    const note = NOTES[boss.slug] || {};
    const themes = themesOf(boss);
    const relics = relicsOf(boss, data);

    const parts = note.parts
      ? '<div class="bz-block"><h3 class="bz-block-title">Sa barre de vie, en ' + note.parts.length + ' morceaux</h3><div class="bz-parts">'
        + note.parts.map((p, i) => '<div class="bz-part' + (p.core ? ' is-core' : '') + '" data-reveal="pop" style="--i:' + i + '">'
          + '<span class="bz-part-hp" data-count>' + p.hp + '</span><span class="bz-part-unit">PV</span>'
          + '<span class="bz-part-label">' + escapeHtml(p.label) + '</span>'
          + (p.core ? '<span class="bz-part-tag">Protégée</span>' : '') + '</div>').join('')
        + '</div></div>'
      : '';

    const rules = note.rules
      ? '<div class="bz-block"><h3 class="bz-block-title">Comment l’abattre</h3><ol class="bz-rules">'
        + note.rules.map((r, i) => '<li class="bz-rule" data-reveal="left" style="--i:' + i + '">'
          + '<span class="bz-rule-ico">' + ruleIcon(r.icon) + '</span>'
          + '<span class="bz-rule-body"><strong>' + escapeHtml(r.title) + '</strong><span>' + escapeHtml(r.text) + '</span></span></li>').join('')
        + '</ol></div>'
      : '';

    const relicBlock = (relics.length || themes.length)
      ? '<div class="bz-block"><h3 class="bz-block-title">Ses reliques</h3><div class="bz-relics">'
        + relics.map((r) => '<div class="bz-relic bz-relic--' + r.kind + '" data-reveal="pop">'
          + '<span class="bz-relic-slot">' + (r.img ? '<img class="crisp" src="' + escapeHtml(r.img) + '" alt="" loading="lazy" decoding="async">' : '<span class="bz-relic-banner" aria-hidden="true">' + skull() + '</span>') + '</span>'
          + '<span class="bz-relic-text"><strong>' + escapeHtml(r.name) + '</strong><span>' + escapeHtml(r.sub) + '</span></span></div>').join('')
        + themes.map((t) => '<a class="bz-relic bz-relic-theme" href="' + musicHref(boss) + '" data-reveal="pop">'
          + '<span class="bz-relic-slot bz-relic-note" aria-hidden="true">' + NOTE_ICON + '</span>'
          + '<span class="bz-relic-text"><strong>' + escapeHtml(t.title) + '</strong><span>' + escapeHtml(t.sub) + '</span></span>'
          + '<span class="bz-relic-go" aria-hidden="true">›</span></a>').join('')
        + '</div></div>'
      : '';

    const kicker = ['Boss #' + String(n).padStart(2, '0'),
      boss.createdAt ? 'Apparu le ' + new Date(boss.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null
    ].filter(Boolean).join(' · ');

    return '<article class="bz-dossier" id="boss-' + escapeHtml(boss.slug) + '" style="--boss:' + escapeHtml(boss.color || '#B3191C') + '" data-bz-dossier>'
      + '<div class="bz-dossier-top">'
      + stage(artImg(boss, 'bz-art'), n)
      + '<div class="bz-file" data-reveal="right">'
      + '<span class="t-pixel bz-file-kicker">' + escapeHtml(kicker) + '</span>'
      + '<h2 class="bz-name">' + escapeHtml(boss.name) + '</h2>'
      + (note.epithet ? '<p class="bz-epithet">' + escapeHtml(note.epithet) + '</p>' : '')
      + threatRow(threatOf(boss))
      + bossBar(boss.name, boss.stats.hp, note.parts, false)
      + crates(boss, data)
      + '<div class="bz-file-actions">'
      + '<a class="btn btn-accent bz-file-link" href="' + musicHref(boss) + '">' + NOTE_ICON + 'Voir la musique</a>'
      + '</div>'
      + '</div></div>'
      + (parts || rules || relicBlock ? '<div class="bz-dossier-more">' + parts + rules + relicBlock + '</div>' : '')
      + '</article>';
  }

  function sealedDossier(s, n) {
    const hint = s.hint ? '<blockquote class="bz-hint" data-reveal>« ' + escapeHtml(s.hint) + ' »</blockquote>' : '';
    const q = ['???', 'Points de vie'], list = [q, ['???', 'Dégâts'], ['???', 'Armure'], ['???', 'Résistance au recul'], ['???', 'Taille (blocs)'], ['???', 'Arène']];
    return '<article class="bz-dossier is-sealed" data-bz-dossier>'
      + '<div class="bz-dossier-top">'
      + stage('<img class="bz-art bz-silhouette crisp" src="' + escapeHtml(s.img) + '" alt="" decoding="async" loading="lazy">'
        + '<span class="bz-chains" aria-hidden="true"><i></i><i></i></span>'
        + '<span class="bz-lock" aria-hidden="true"></span>'
        + '<span class="bz-stamp" aria-hidden="true">Scellé</span>', n, ' is-sealed')
      + '<div class="bz-file" data-reveal="right">'
      + '<span class="t-pixel bz-file-kicker">Boss #' + String(n).padStart(2, '0') + ' · Identité inconnue</span>'
      + '<h2 class="bz-name bz-name-sealed" aria-label="Boss mystère">???</h2>'
      + '<p class="bz-epithet">Quelque chose remue sous la terre…</p>'
      + threatRow(s.threat || 5)
      + bossBar('???', 0, null, true)
      + '<div class="bz-crates">' + list.map((c, i) => crate(c[0], c[1], false, i)).join('') + '</div>'
      + hint
      + '</div></div></article>';
  }

  /* ---- le ruban de danger --------------------------------------------------------- */

  function tapes() {
    const one = (text) => {
      const seg = '<span class="bz-tape-seg">' + skull() + '<span>' + text + '</span></span>';
      const run = seg.repeat(8);
      return '<div class="bz-tape-track"><div class="bz-tape-run">' + run + '</div><div class="bz-tape-run">' + run + '</div></div>';
    };
    return '<div class="bz-tape bz-tape-a">' + one('Danger de mort') + '</div>'
      + '<div class="bz-tape bz-tape-b">' + one('Accès interdit') + '</div>';
  }

  /* ---- le mouvement ----------------------------------------------------------------- */

  /* Le rendu penche vers le curseur : une ecriture de variables par image,
     et seulement quand la souris bouge. */
  function parallax(scope) {
    if (REDUCED() || !window.matchMedia('(hover: hover)').matches) return;
    scope.querySelectorAll('[data-bz-stage], [data-bz-hero-art]').forEach((host) => {
      const target = host.querySelector('[data-bz-parallax]') || host;
      let raf = 0, x = 0, y = 0;
      host.addEventListener('pointermove', (e) => {
        const r = host.getBoundingClientRect();
        x = ((e.clientX - r.left) / r.width - .5) * 2;
        y = ((e.clientY - r.top) / r.height - .5) * 2;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          target.style.setProperty('--mx', x.toFixed(3));
          target.style.setProperty('--my', y.toFixed(3));
        });
      });
      host.addEventListener('pointerleave', () => {
        target.style.setProperty('--mx', '0');
        target.style.setProperty('--my', '0');
      });
    });
  }

  /* L'entree : le titre s'abat, l'ecran tremble, un eclair rouge. Rien n'est
     cache en attendant : le titre est deja la, l'animation ne fait que le
     pousser. Elle ne part que sur une page visible, une fois le voile de
     chargement leve, et un minuteur retire la classe quoi qu'il arrive. */
  function slam() {
    if (REDUCED()) return;
    const root = document.documentElement;
    const go = () => {
      if (document.visibilityState !== 'visible') return;
      root.classList.add('bz-intro');
      setTimeout(() => root.classList.remove('bz-intro'), 1700);
    };
    if (!root.hasAttribute('data-booting')) { setTimeout(go, 120); return; }
    const mo = new MutationObserver(() => {
      if (root.hasAttribute('data-booting')) return;
      mo.disconnect();
      setTimeout(go, 180);
    });
    mo.observe(root, { attributes: true, attributeFilter: ['data-booting'] });
  }

  /* Les tetes de mort de la menace s'abattent une a une, et le tampon
     « Scelle » frappe, quand ils entrent a l'ecran. Ils sont deja la avant :
     l'animation ne fait que les pousser. */
  function wireImpacts(scope) {
    const targets = scope.querySelectorAll('.bz-threat, .bz-stage.is-sealed');
    if (!('IntersectionObserver' in window) || REDUCED()) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-lit');
      io.unobserve(e.target);
    }), { rootMargin: '0px 0px -15% 0px' });
    targets.forEach((t) => io.observe(t));
  }

  /* Un rendu absent de assets/bosses/solo : on tente assets/entities. */
  function wireImages(scope) {
    scope.querySelectorAll('img[data-fallback]').forEach((img) => {
      img.addEventListener('error', () => {
        const next = img.getAttribute('data-fallback');
        if (next && img.src.indexOf(next) === -1) { img.removeAttribute('data-fallback'); img.src = next; }
        else img.style.visibility = 'hidden';
      });
    });
  }

  /* Le fond de scene d'un boss, s'il a ete depose. */
  function wireWalls(scope, bosses) {
    scope.querySelectorAll('[data-bz-dossier]:not(.is-sealed)').forEach((node, i) => {
      const boss = bosses[i];
      if (!boss) return;
      const src = 'assets/bosses/wallpapers/' + boss.slug + '.png';
      const probe = new Image();
      probe.onload = () => {
        const wall = node.querySelector('[data-bz-wall]');
        if (wall) { wall.style.backgroundImage = "url('" + src + "')"; wall.classList.add('has-wall'); }
      };
      probe.src = src;
    });
  }

  /* ---- boot --------------------------------------------------------------------------- */

  mountHeader();
  slam();
  document.querySelector('[data-bz-tapes]').innerHTML = tapes();

  if (OW.startEmbers && !LITE()) {
    OW.startEmbers(document.querySelector('[data-embers]'), { count: 58, tint: [255, 64, 40], drift: -0.34 });
  }

  function fnv1a(text) {
    let h = 0x811c9dc5;
    const bytes = new TextEncoder().encode(String(text));
    for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  loadWikiData()
    .then((data) => {
      const bosses = (data.bosses || []).slice().sort((a, b) => (b.stats.hp || 0) - (a.stats.hp || 0));
      const released = new Set(bosses.map((b) => fnv1a(b.slug)));
      const sealed = (OW.UPCOMING_BOSSES || []).filter((s) => !released.has(s.key));

      /* Les pancartes, comme sur les autres rubriques. */
      const hp = bosses.reduce((s, b) => s + (b.stats.hp || 0), 0);
      const relics = bosses.reduce((s, b) => s + relicsOf(b, data).length + themesOf(b).length, 0);
      const signs = [[bosses.length + sealed.length, 'Boss'], [hp || '???', 'PV à abattre']];
      if (sealed.length) signs.push([sealed.length, sealed.length > 1 ? 'Scellés' : 'Scellé']);
      else signs.push([relics, relics > 1 ? 'Reliques' : 'Relique']);
      if (OW.heroSigns) OW.heroSigns(document.querySelector('[data-bz-intro]'), signs);
      const signRow = document.querySelector('.bz-hero .hero-signs');
      if (signRow) signRow.classList.add('bz-signs');

      /* Le premier boss trone dans l'entree ; a defaut, le premier scelle. */
      const heroArt = document.querySelector('[data-bz-hero-art]');
      if (bosses[0]) {
        heroArt.innerHTML = '<span class="bz-hero-halo"></span><span class="bz-hero-float" data-bz-parallax>'
          + artImg(bosses[0], 'bz-hero-img') + '</span><span class="bz-hero-ground"></span>';
        heroArt.style.setProperty('--boss', bosses[0].color || '#B3191C');
      } else if (sealed[0]) {
        heroArt.innerHTML = '<span class="bz-hero-halo"></span><span class="bz-hero-float" data-bz-parallax>'
          + '<img class="bz-hero-img bz-silhouette crisp" src="' + escapeHtml(sealed[0].img) + '" alt=""></span><span class="bz-hero-ground"></span>';
      }

      const roster = document.querySelector('[data-bz-roster]');
      roster.innerHTML = bosses.length
        ? bosses.map((b, i) => dossier(b, data, i + 1)).join('')
        : '<p class="empty-note bz-empty">Aucun boss ne s’est encore montré. Pour l’instant.</p>';

      const sealedHost = document.querySelector('[data-bz-sealed]');
      if (sealed.length) {
        sealedHost.innerHTML = sealed.map((s, i) => sealedDossier(s, bosses.length + i + 1)).join('');
        document.querySelector('[data-bz-sealed-section]').hidden = false;
      }

      const main = document.querySelector('main');
      wireImages(main);
      wireImpacts(main);
      wireWalls(roster, bosses);
      parallax(main);

      mountFooter(data, 'VERSION ' + data.meta.version + ' · ' + (bosses.length + sealed.length) + ' BOSS');
      reveal();

      /* Arrivee sur bosses.html#boss-<slug> (la recherche) : le dossier
         n'existait pas encore quand le navigateur a lu l'ancre. */
      const target = window.location.hash && document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (target) setTimeout(() => (OW.scrollToEl ? OW.scrollToEl(target) : target.scrollIntoView()), 400);
    })
    .catch((error) => {
      console.error(error);
      document.querySelector('[data-bz-roster]').innerHTML =
        '<p class="empty-note">Les données du mod n\'ont pas pu être chargées. '
        + 'Ce wiki doit être servi par un serveur HTTP — voir le README.</p>';
    });
}(window.OW = window.OW || {}));
