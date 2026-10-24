/* La fiche d'une creature. Lit ?e=<slug> et monte la page entiere.

   La page n'est pas une suite de panneaux identiques : chaque chapitre a sa
   propre mise en scene. L'identite tient l'ecran (decor de la bete, rendu
   solo, constantes vitales) ; un rail de chapitres suit la lecture ; les
   capacites se lisent comme la barre du HUD du jeu (un emplacement, une
   carte) ; l'apprivoisement et le journal sont des pages de carnet ; les
   territoires prennent la largeur ; le butin est un coffre ; les sons une
   table de mixage ; les animations une bande de film. */

(function (OW) {
  'use strict';

  const { loadWikiData, escapeHtml, mountHeader, mountFooter, reveal, startEmbers, hexToRgb, drawSpawnMap, skinsFor, RARITY, animalHref, archetypeIcon, coinSprite, contrastInk, itemSprite, saddleSprite, num, percent, plural, readableId, variantRender, bg, DASH, tintStyle } = OW;

  const FAMILY_LABEL = {
    terrestrial: 'Terrestre', semi_aquatic: 'Semi-aquatique', aquatic: 'Aquatique', aerial: 'Aérien'
  };
  const DIET_LABEL = { CARNIVOROUS: 'Carnivore', VEGETARIAN: 'Végétarien', OMNIVOROUS: 'Omnivore' };
  const TEMPERAMENT_LABEL = { AGGRESSIVE: 'Agressif', NEUTRAL: 'Neutre', PASSIVE: 'Passif' };

  const FAMILY_COLOR = {
    terrestrial: '#8A9A2E', semi_aquatic: '#4E8F7A', aquatic: '#00A0C8', aerial: '#7FB2D9'
  };
  const DIET_COLOR = { CARNIVOROUS: '#B84A38', VEGETARIAN: '#8A9A2E', OMNIVOROUS: '#F2A32C' };
  const TEMPERAMENT_COLOR = { AGGRESSIVE: '#B84A38', NEUTRAL: '#F2A32C', PASSIVE: '#8A9A2E' };

  /* Les huit paliers (js/site.js) ; celui de chaque bete se regle a la main
     dans js/site-config.js (tamingDifficulty). */
  const DIFFICULTY_SCALE = OW.DIFFICULTY_SCALE;

  /* Reference ceilings shared by the whole bestiary, so bars compare. */
  const REFERENCE = { hp: 120, damage: 20, walk: 6, mounted: 12 };


  const $ = (selector) => document.querySelector(selector);

  /* Le lien vers la fiche d'un objet dans l'onglet Objets : la page y ouvre la
     fiche correspondant a son ancre. */
  const itemHref = (id) => 'items.html#' + encodeURIComponent(String(id).replace(/^.*:/, ''));

  /* L'encre de l'espece, posee au montage. Les icones la recoivent en clair :
     une variable CSS dans un attribut SVG ne se resout pas partout, et les
     icones sortaient alors en noir sur du noir. */
  let INK = '#F2A32C';
  let TINT = '#F2A32C';

  /* La couleur d'une espece telle que le mod la declare — #D97733 pour le
     tigre. tintFor() la delave vers le blanc pour tenir un rapport de 4,5:1
     de texte courant, ce qui donnait ce beige dont personne ne voulait. Les
     grands chiffres sont du gros texte : 3:1 suffit, et la plupart des
     especes passent alors sans etre touchees. Seules les plus sombres
     (l'orque, le gorille) sont eclaircies, et seulement autant qu'il faut. */
  const BACKDROP = '#0B0F0C';
  const LARGE_TEXT_RATIO = 3.2;

  function mixHex(a, b, amount) {
    const parse = (h) => [1, 3, 5].map((i) => parseInt(String(h).replace('#', '').substr(i - 1, 2), 16));
    const [ar, ag, ab] = parse(a);
    const [br, bg2, bb] = parse(b);
    const to = (v) => Math.round(v).toString(16).padStart(2, '0');
    return '#' + to(ar + (br - ar) * amount) + to(ag + (bg2 - ag) * amount) + to(ab + (bb - ab) * amount);
  }

  function strongInk(hex) {
    if (!OW.luminance || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    const back = OW.luminance(BACKDROP);
    const ratio = (l) => (Math.max(l, back) + .05) / (Math.min(l, back) + .05);
    let candidate = hex;
    for (let step = 0; step <= 10; step++) {
      if (ratio(OW.luminance(candidate)) >= LARGE_TEXT_RATIO) return candidate;
      candidate = mixHex(hex, '#FFFFFF', step / 10);
    }
    return candidate;
  }

  const ROLE_GLYPH = {
    combo:
      '<path d="M14 8 L30 40 M24 6 L40 38 M34 8 L50 40" stroke-linecap="round"/>'
      + '<path d="M8 44 Q32 56 56 44" stroke-linecap="round"/>',
    secondary:
      '<circle cx="32" cy="32" r="11"/>'
      + '<path d="M32 4 v9 M32 51 v9 M4 32 h9 M51 32 h9 M12 12 l6 6 M46 46 l6 6 M52 12 l-6 6 M18 46 l-6 6"'
      + ' stroke-linecap="round"/>',
    ultimate:
      '<path d="M32 3 L39 24 L61 24 L43 37 L50 59 L32 45 L14 59 L21 37 L3 24 L25 24 Z"'
      + ' stroke-linejoin="round"/>',
    passive:
      /* Un oeil cerne d'une aura : la plupart des passifs du mod sont des sens
         toujours actifs — Odeur de Sang, Vision Thermique, Sens Vital. */
      '<path d="M4 32 Q32 10 60 32 Q32 54 4 32 Z" stroke-linejoin="round"/>'
      + '<circle cx="32" cy="32" r="7"/>'
      + '<path d="M32 2 v6 M32 56 v6 M9 12 l4 4 M51 48 l4 4 M55 12 l-4 4 M13 48 l-4 4"'
      + ' stroke-linecap="round" opacity=".65"/>'
  };

  function roleGlyph(role, color) {
    const body = ROLE_GLYPH[role] || ROLE_GLYPH.secondary;
    return '<svg class="ability-glyph" viewBox="0 0 64 64" fill="none" aria-hidden="true"'
      + ' stroke="' + escapeHtml(color) + '" stroke-width="3.2">' + body + '</svg>';
  }

  /* Le nom de fichier de la planche, par role. Le mod en dessine une par
     emplacement : attack_0 pour le combo, attack_1 pour la secondaire,
     attack_1_2 pour la seconde secondaire interchangeable, attack_2 pour
     l'ultime. Les passifs n'en ont pas — ils portent leur sigil. */
  const ATTACK_FILE = {
    combo: 'attack_0',
    secondary: 'attack_1',
    'secondary-alt': 'attack_1_2',
    ultimate: 'attack_2'
  };

  /**
   * La vignette d'une carte.
   *
   * Le chemin conventionnel est toujours ecrit ; c'est le navigateur qui
   * tranche. Si la planche existe, elle s'affiche ; sinon resolveImages()
   * retire l'element et le sigil du role apparait a sa place — le CSS le masque
   * tant que l'image est la. Deposer un attack_1_2.png chez le gorille suffit
   * donc a le voir, sans toucher au code.
   */
  function abilityArt(entity, card, accent) {
    const file = ATTACK_FILE[card.role];
    const inner = file
      ? `<span class="ability-sprite-glyph" aria-hidden="true">${roleGlyph(card.role, accent)}</span>
         <span class="ability-sprite-image crisp" aria-hidden="true"
               ${OW.imgAttr(['assets/pages/' + entity.slug + '/' + file + '.png'], { mode: 'bg', empty: 'hide' })}></span>`
      : `<span class="ability-sprite-glyph" aria-hidden="true">${roleGlyph(card.role, accent)}</span>`;

    return `
      <span class="ability-sprite">
        <span class="ability-halo" aria-hidden="true"
              style="background:radial-gradient(56% 60% at 50% 46%, ${escapeHtml(accent)}3A 0%, rgba(0,0,0,0) 74%)"></span>
        ${inner}
      </span>`;
  }

  function constantChips(card) {
    if (!card.constants.length) return '';
    const chip = (c) => `
      <span class="const-chip">
        <span class="t-pixel">${escapeHtml(c.label)}</span>
        <span class="const-value">${escapeHtml(c.value)}</span>
      </span>`;
    const primary = card.constants.filter((c) => c.primary);
    const secondary = card.constants.filter((c) => !c.primary);

    return `
      <div class="const-list">
        ${primary.map(chip).join('')}
        ${secondary.length ? `
          <details class="const-more">
            <summary>${secondary.length} constante${secondary.length > 1 ? 's' : ''} de réglage</summary>
            <div class="const-list" style="margin-top:10px">${secondary.map(chip).join('')}</div>
          </details>` : ''}
      </div>`;
  }

  /* ===========================================================================
     1 · Identite
     =========================================================================== */

  /* Le rendu solo de la bete : assets/entities/solo/<Nom> [SOLO].png, le nom
     deduit du slug comme partout ailleurs sur le site. */
  function soloArt(slug) {
    const name = String(slug).split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return OW.asset(encodeURI('assets/entities/solo/' + name + ' [SOLO].png'));
  }

  /* Le biome de la bete (premier de ses biomes de fond, voir
     js/biome-config.js) sert de scene vivante posee sur le wallpaper. */

  /* L'enclos : le wallpaper de l'espece tient tout le fond, la scene vivante
     du biome passe par-dessus en transparence, la bete se tient devant et le
     panneau grave est pose sur le cote. */
  function renderIdentity(entity, accent) {
    /* Le fond d'ecran cinematique s'il existe, sinon la vignette de la bete
       agrandie et floutee. Le chemin conventionnel est tente d'abord —
       deposer un assets/wallpapers/<espece>.png suffit a remplacer le repli. */
    const wallpaper = $('[data-wallpaper]');
    wallpaper.style.setProperty('--abstract-tint', accent);
    /* Le cadrage du wallpaper se regle dans js/hero-config.js. */
    const heroCfg = OW.HERO_CONFIG || {};
    const frame = Object.assign({ y: 40, x: 50, zoom: 1 }, heroCfg.default, (heroCfg.wallpapers || {})[entity.slug]);
    wallpaper.style.setProperty('--wall-x', frame.x + '%');
    wallpaper.style.setProperty('--wall-y', frame.y + '%');
    wallpaper.style.setProperty('--wall-zoom', String(frame.zoom));
    wallpaper.setAttribute('data-img', entity.wallpaper + '|' + entity.art);
    wallpaper.setAttribute('data-img-mode', 'bg');
    if (OW.resolveImages) {
      OW.resolveImages(wallpaper.parentElement || document);
      const watch = setInterval(() => {
        const found = wallpaper.getAttribute('data-img-found');
        if (!found) return;
        clearInterval(watch);
        wallpaper.classList.toggle('hero-media-abstract', found === entity.art);
      }, 60);
      setTimeout(() => clearInterval(watch), 4000);
    }

    /* La scene du biome, a demi transparente : elle donne le mouvement sans
       effacer l'image de l'espece. */
    /* .ident-biome : le decor de fond (js/biome-world.js) porte lui aussi
       data-biome, et il vient avant dans la page — la scene s'y glissait et
       en masquait les arbres des bords. */
    const biome = $('.ident-biome[data-biome]');
    /* La largeur du cadre regle la densite de particules : la meme qu'a
       l'ecran large, pas la meme quantite. */
    const scene = OW.biomeScene
      ? OW.biomeScene((OW.entityBiomes && OW.entityBiomes(entity)[0]) || 'jungle', biome && biome.clientWidth)
      : null;
    if (biome && scene) biome.appendChild(scene);

    $('[data-tint]').style.background =
      `radial-gradient(90% 60% at 20% 30%, ${accent}30 0%, rgba(11,12,10,0) 70%)`;

    const art = $('[data-art]');
    art.alt = entity.name;
    art.src = soloArt(entity.slug);
    art.onerror = () => { art.onerror = null; art.classList.add('is-fallback'); art.src = entity.art; };

    $('[data-entity-id]').textContent = 'Enclos ' + entity.id;
    $('[data-name]').textContent = entity.name;

    const first = entity.lore[0];
    $('[data-tagline]').textContent = first
      ? first.text.split('.').slice(0, 2).join('.') + '.'
      : (entity.boss
        ? "Boss de tribu. Ne s'apprivoise pas et ne quitte pas son arène."
        : "Le manuscrit de l'aventurier ne couvre pas encore cette créature.");

    const sim = $('[data-sim-link]');
    if (sim) sim.href = 'simulator.html?e=' + encodeURIComponent(entity.slug) + '#combat';

    /* Le bouton favori de la fiche (js/favorites.js gere le clic et l'etat). */
    const cta = $('.ident-cta');
    if (cta && OW.favorites && !cta.querySelector('[data-fav-toggle]')) {
      cta.insertAdjacentHTML('beforeend', `
        <button type="button" class="btn ident-fav" data-fav-toggle="${escapeHtml(entity.slug)}" data-fav-name="${escapeHtml(entity.name)}"
                aria-pressed="${OW.favorites.has(entity.slug)}">
          ${OW.FAV_STAR_SVG || ''}<span class="ident-fav-off">Ajouter aux favoris</span><span class="ident-fav-on">Favori</span>
        </button>`);
    }

    /* La bete et le decor ne suivent pas la souris au meme pas : c'est ce
       decalage qui donne sa profondeur a l'enclos. */
    const screen = $('.ident');
    const glow = $('.ident-art-glow');
    if (screen && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      screen.addEventListener('pointermove', (event) => {
        const r = screen.getBoundingClientRect();
        const x = (event.clientX - r.left) / r.width - .5;
        const y = (event.clientY - r.top) / r.height - .5;
        art.style.setProperty('--px', (x * -22).toFixed(1) + 'px');
        art.style.setProperty('--py', (y * -14).toFixed(1) + 'px');
        wallpaper.style.setProperty('--px', (x * 14).toFixed(1) + 'px');
        wallpaper.style.setProperty('--py', (y * 9).toFixed(1) + 'px');
        if (glow) {
          glow.style.setProperty('--px', (x * -12).toFixed(1) + 'px');
          glow.style.setProperty('--py', (y * -8).toFixed(1) + 'px');
        }
      }, { passive: true });
      screen.addEventListener('pointerleave', () => {
        [art, wallpaper, glow].forEach((el) => {
          if (!el) return;
          el.style.setProperty('--px', '0px');
          el.style.setProperty('--py', '0px');
        });
      });
    }
  }

  /* Les traits de la bete : famille, regime, temperament, somnolence, et ce
     qu'on peut en faire. L'archetype n'est plus une plaque : c'est son
     embleme, dans le coin du panneau (renderArchetypeBadge). */
  function renderTraits(entity, accent) {
    /* Le plafond de la barre de somnolence : le detail (fourchette, durees)
       est dans le chapitre Apprivoisement, l'infobulle en donne l'essentiel. */
    const somno = !entity.boss && entity.taming && entity.taming.somnolence;
    renderArchetypeBadge(entity);
    const cells = [
      ['Famille', FAMILY_LABEL[entity.family] || entity.family, FAMILY_COLOR[entity.family], 'assets/ui/animal.png'],
      ['Régime', entity.diet ? (DIET_LABEL[entity.diet.name] || entity.diet.name) : DASH,
        entity.diet ? DIET_COLOR[entity.diet.name] : null,
        entity.diet && entity.diet.name === 'CARNIVOROUS' ? 'assets/item/raw_tiger.png' : 'assets/item/savage_berries.png'],
      ['Tempérament', entity.temperament ? (TEMPERAMENT_LABEL[entity.temperament] || entity.temperament) : DASH,
        entity.temperament ? TEMPERAMENT_COLOR[entity.temperament] : null, 'assets/item/predator_tooth.png'],
      somno ? ['Somnolence', bigNum(somno.max), SOMNOLENCE_COLOR, 'assets/item/tranquilizer_arrow.png', somnolenceTip(somno)] : null,
      ['Apprivoisable', entity.traits.tameable ? 'Oui' : 'Non',
        entity.traits.tameable ? '#8A9A2E' : '#B84A38', 'assets/ui/taming_exp.png'],
      ['Montable', entity.traits.rideable ? 'Oui' : 'Non',
        entity.traits.rideable ? '#8A9A2E' : '#8A817C',
        /* Sa propre selle des qu'un fichier est depose, sinon celle du tigre. */
        ['assets/pages/' + entity.slug + '/saddle.png', saddleSprite(entity.slug),
          'assets/item/' + entity.slug + '_saddle.png', 'assets/pages/tiger/saddle.png']]
    ];

    $('[data-idcard]').innerHTML = cells.filter(Boolean).map(([key, value, color, icon, tip], i) => `
      <span class="trait" style="--trait:${escapeHtml(color || 'rgba(255,255,255,.4)')};--i:${i}"${tip ? ` title="${escapeHtml(tip)}"` : ''}>
        <span class="trait-icon crisp" aria-hidden="true" ${Array.isArray(icon) ? OW.imgAttr(icon, { mode: 'bg' }) : `style="${bg(icon)}"`}></span>
        <span class="trait-text"><small>${escapeHtml(key)}</small><b>${escapeHtml(value)}</b></span>
      </span>`).join('');
  }

  /* L'embleme de l'archetype, visse dans le coin haut droit du panneau :
     l'image seule, une lueur a la couleur de l'archetype derriere (codes §
     du mod, les memes que les titres de la page Mecaniques). Au survol, son
     nom ; au clic, la carte de l'archetype dans Mecaniques. */
  function renderArchetypeBadge(entity) {
    const sign = $('.ident-sign');
    if (!sign) return;
    const old = sign.querySelector('.ident-arch');
    if (old) old.remove();
    const name = entity.archetype && entity.archetype.name;
    sign.classList.toggle('has-arch', !!name);
    if (!name) return;

    const color = OW.archetypeColor(name);
    const label = OW.archetypeLabel(name);
    sign.insertAdjacentHTML('beforeend', `
      <a class="ident-arch" href="simulator.html?arch=${encodeURIComponent(name.toLowerCase())}#stats"
         style="--arch:${color};--arch-ink:${OW.archetypeInk(color)}"
         aria-label="${escapeHtml('Archétype ' + label + ' : voir dans Mécaniques')}">
        <span class="ident-arch-glow" aria-hidden="true"></span>
        <span class="ident-arch-icon crisp" aria-hidden="true" style="${bg(archetypeIcon(name))}"></span>
        <span class="ident-arch-tip" aria-hidden="true">
          <small>Archétype</small>
          <b>${escapeHtml(label)}</b>
          <em>Voir dans Mécaniques →</em>
        </span>
      </a>`);
  }

  /* ---- la somnolence -----------------------------------------------------------
     La barre que les tirs tranquillisants remplissent (OWEntity.hurt) : pleine,
     la bete s'endort ; elle retombe ensuite d'elle-meme, deux fois moins vite
     pendant le sommeil (SLEEPING_SOMNOLENCE_LOSS_FACTOR), et la bete se
     reveille a zero. Tout vient de taming.somnolence dans l'export. */
  const SOMNOLENCE_COLOR = '#8A9ED8';
  const bigNum = (n) => Number(n).toLocaleString('fr-FR');

  function duration(seconds) {
    const total = Math.round(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const parts = [];
    if (h) parts.push(h + ' h');
    if (m) parts.push(m + ' min');
    if (s || !parts.length) parts.push(s + ' s');
    return parts.join(' ');
  }

  /* Ce qu'un individu peut dormir : son plafond tire au hasard, divise par
     la perte endormie. */
  const sleepSpan = (s) => (s.min != null && s.top != null && s.lossAsleep
    ? 'de ' + duration(s.min / s.lossAsleep) + ' à ' + duration(s.top / s.lossAsleep) : null);

  function somnolenceTip(s) {
    const range = s.min != null && s.top != null ? ' Chaque individu tire le sien entre ' + bigNum(s.min) + ' et ' + bigNum(s.top) + '.' : '';
    const sleep = s.decays && s.drainAsleep ? ' Endormi à barre pleine : environ ' + duration(s.drainAsleep) + ' de sommeil.' : '';
    return 'Points de somnolence pour l\'endormir.' + range + sleep;
  }

  function renderSomnolence(entity) {
    const host = $('[data-somnolence]');
    if (!host) return;
    const s = !entity.boss && entity.taming && entity.taming.somnolence;
    if (!s) {
      host.hidden = true;
      return;
    }
    host.hidden = false;

    /* Le mod compte en ticks (20 par seconde) : 1 point tous les N ticks.
       On donne ce rythme, puis son equivalent par seconde. */
    const pace = (ticks, perSecond) => {
      if (perSecond == null) return '';
      const second = num(perSecond, 1) + ' point' + (perSecond > 1 ? 's' : '') + ' par seconde';
      if (!ticks) return 'perd ' + second;
      return 'perd 1 point ' + (ticks === 1 ? 'par tick' : 'tous les ' + ticks + ' ticks') + ', soit ' + second;
    };
    /* Trois cases, sur les memes colonnes que le bandeau des repas : le
       plafond, puis ses deux durees. */
    const boxes = [
      ['Points pour l\'endormir', bigNum(s.max),
        s.min != null && s.top != null ? bigNum(s.min) + ' à ' + bigNum(s.top) + ' selon l\'individu' : '',
        'Le plafond de base de la barre : chaque créature sauvage tire le sien à ±' + (s.spread != null ? s.spread : 20)
          + ' % à son apparition. Chaque tir tranquillisant (flèche, dard, lance-pierre) la remplit ; pleine, la créature s\'endort.'],
      ...(s.decays
        ? [
            ['Durée du sommeil', s.drainAsleep != null ? duration(s.drainAsleep) : DASH, pace(s.ticksAsleep, s.lossAsleep),
              'Endormie à barre pleine, la créature se réveille quand la barre retombe à zéro.'
                + (sleepSpan(s) ? ' Selon son plafond : ' + sleepSpan(s) + '.' : '')],
            ['Dissipation, éveillé', s.drainAwake != null ? duration(s.drainAwake) : DASH, pace(s.ticksAwake, s.lossAwake),
              'Tant qu\'elle ne dort pas, la somnolence retombe deux fois plus vite : les tirs doivent s\'enchaîner avant qu\'elle ne se dissipe.']
          ]
        : [['Dissipation', 'Aucune', 'la barre ne redescend jamais', 'Cette créature ne perd jamais sa somnolence.']])
    ];

    host.innerHTML = `
      <span class="paper-label">La somnolence</span>
      <div class="feed-row${boxes.length === 2 ? ' is-duo' : ''}">
        ${boxes.map(([label, value, detail, tip]) => `
          <div class="feed-count feed-estimate-head">
            <span class="feed-estimate-label">${escapeHtml(label)}${infoDot(tip)}</span>
            <b>${escapeHtml(value)}</b>
            ${detail ? `<em>${escapeHtml(detail)}</em>` : ''}
          </div>`).join('')}
      </div>`;
  }

  /* ---- le nourrissage -----------------------------------------------------------
     Une fois effondree, la bete mange ce qu'on pose pres de sa gueule, un repas
     a la fois, avec une attente tiree au hasard avant chacun (le premier
     compris). A son compte, elle se releve apprivoisee ; reveillee avant, elle
     oublie tout (OWAggressiveTaming.onWakeUp). Le nombre de repas et l'attente
     viennent de taming.feeding ; le reste, que l'export ne donne pas, est
     recopie d'OWAggressiveTaming : elle remarque un repas 15 a 40 ticks apres
     l'avoir repere (NOTICE_DELAY), le mange en 60 ticks (MEAL_DURATION), se
     releve 40 ticks apres le dernier (TAME_REVEAL_DELAY) ; la nourriture de
     somnolence rend 15 % de la barre (SOMNOLENCE_FOOD_RESTORE), refusee
     au-dessus de 85 %, choisie avant le reste sous 35 %. */
  const MEAL = { noticeMin: 0.75, noticeMax: 2, eat: 3, reveal: 2, restore: 15, refuse: 85, urgent: 35 };

  /* Le temps du nourrissage : avec de la chance (le moins de repas, l'attente
     la plus courte), sans (le plus de repas, la plus longue), et en moyenne. */
  function feedingSpan(f) {
    const meal = (wait, notice) => wait + notice + MEAL.eat;
    return {
      fast: f.min * meal(f.intervalMin, MEAL.noticeMin) + MEAL.reveal,
      typical: ((f.min + f.max) / 2) * meal((f.intervalMin + f.intervalMax) / 2, (MEAL.noticeMin + MEAL.noticeMax) / 2) + MEAL.reveal,
      slow: f.max * meal(f.intervalMax, MEAL.noticeMax) + MEAL.reveal
    };
  }

  /* Grosso modo : a la minute au-dela d'une minute et demie, a 5 s pres en
     dessous. */
  const rough = (seconds) => (seconds < 90
    ? Math.max(5, Math.round(seconds / 5) * 5) + ' s'
    : Math.round(seconds / 60) + ' min');

  /* Une attente courte se dit en secondes : « 20 à 90 s » se lit mieux que
     « 20 s à 1 min 30 s ». */
  const secs = (seconds) => (seconds < 120 ? Math.round(seconds) + ' s' : duration(seconds));

  /* « 10 à 45 s » plutot que « 10 s à 45 s » quand les deux bornes ont la
     meme unite. */
  function between(a, b) {
    const x = /^(\d+) (s|min)$/.exec(a);
    const y = /^(\d+) (s|min)$/.exec(b);
    if (a === b) return a;
    return x && y && x[2] === y[2] ? x[1] + ' à ' + b : a + ' à ' + b;
  }

  function renderFeeding(entity) {
    const host = $('[data-feeding]');
    if (!host) return;
    const f = !entity.boss && entity.taming && entity.taming.feeding;
    if (!f || f.intervalMin == null || f.intervalMax == null) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    host.hidden = false;

    const t = feedingSpan(f);
    const s = entity.taming.somnolence;
    /* Ce qu'elle dort, barre pleine : son plafond divise par sa perte endormie. */
    const sleep = s && s.decays && s.lossAsleep
      ? {
          avg: s.drainAsleep != null ? s.drainAsleep : s.max / s.lossAsleep,
          min: (s.min != null ? s.min : s.max) / s.lossAsleep,
          top: (s.top != null ? s.top : s.max) / s.lossAsleep
        }
      : null;

    /* Ce qu'elle mange, en icone qui defile a cote de l'attente : son regime
       et sa nourriture d'apprivoisement (ni le poison, ni les oeufs, ni les
       douceurs). Sans nourriture exportee, l'horloge. */
    const seen = new Set();
    const meals = (entity.taming.foodTags || [])
      .filter((tag) => /_food$/.test(tag.id) && !/_dangerous_food$/.test(tag.id))
      .flatMap((tag) => tag.items)
      .concat((entity.taming.foodTiers || []).filter((tier) => tier.item).map((tier) => tier.item))
      .filter((i) => i.id.charAt(0) !== '#' && !seen.has(i.id) && seen.add(i.id));
    const mealIcon = meals.length
      ? `${OW.imgAttr(OW.itemCandidates(meals[0].id), { mode: 'bg' })} ${OW.cycleAttr(meals.map((i) => i.id))}`
      : `style="${bg('assets/mcitems/clock_00.png')}"`;

    /* Ce qui prolonge le sommeil : le reglage du site (SITE_CONFIG.sleepFood,
       la valeriane, futur objet) l'emporte sur le tag de l'export. Son image
       vient d'assets/item/ des qu'elle existe, sinon de l'icone de secours. */
    const sleepCfg = OW.SITE_CONFIG && OW.SITE_CONFIG.sleepFood;
    const calm = sleepCfg && sleepCfg.name ? sleepCfg : f.somnolenceFood[0];
    const calmName = calm ? calm.name : 'Nourriture de somnolence';
    const calmIcon = calm
      ? OW.imgAttr((calm.id ? OW.itemCandidates(calm.id) : []).concat(calm.icon || []), { mode: 'bg' })
      : `style="${bg('assets/item/tranquilizer_arrow.png')}"`;

    const rows = [
      [mealIcon, 'Entre deux repas', 'tirée au hasard avant chaque repas',
        between(secs(f.intervalMin), secs(f.intervalMax)),
        'Après chaque repas, la créature ignore la nourriture posée près d\'elle pendant un temps tiré au hasard. Le premier compte à rebours démarre dès qu\'elle s\'effondre.'
          + (meals.length ? ' Ce qu\'elle mange : ' + meals.map((i) => i.name).join(', ') + '.' : '')],
      f.hasteMin != null && f.hasteMax != null
        ? [calmIcon, calmName + ' seule à portée', 'l\'attente file deux fois plus vite',
            between(secs(f.hasteMin), secs(f.hasteMax)),
            'Si seule de la ' + calmName.toLowerCase() + ' est posée près d\'elle, l\'attente s\'écoule deux fois plus vite. Chaque bouchée'
              + ' rend ' + MEAL.restore + ' % de la barre de somnolence, mais ne compte pas comme un repas et relance l\'attente. La créature n\'en veut pas au-dessus de '
              + MEAL.refuse + ' % de la barre, et s\'y jette avant le reste sous ' + MEAL.urgent + ' %.']
        : null
    ].filter(Boolean);

    /* La frise : son sommeil face au temps des repas, sur la meme echelle.
       La barre pleine est la moyenne ; les hachures, ce que le hasard
       ajoute ou retire. */
    const axis = Math.max(t.slow, sleep ? sleep.top : 0) * 1.04;
    const pct = (v) => (Math.min(100, (v / axis) * 100)).toFixed(2) + '%';
    const lane = (cls, name, lo, mid, hi, label) => `
      <div class="feed-lane ${cls}">
        <span class="feed-lane-name">${escapeHtml(name)}</span>
        <span class="feed-track" aria-hidden="true">
          <i class="feed-band" style="left:${pct(lo)};width:calc(${pct(hi)} - ${pct(lo)})"></i>
          <i class="feed-fill" style="width:${pct(mid)}"></i>
        </span>
        <b>${escapeHtml(label)}</b>
      </div>`;

    const avgWanted = (f.min + f.max) / 2;
    host.innerHTML = `
      <span class="paper-label">Les repas</span>
      <div class="feed-row">
        <div class="feed-count feed-estimate-head">
          <span class="feed-estimate-label">Repas à donner${infoDot('Chaque créature tire ce nombre au hasard à son apparition. Un repas, c\'est un objet de sa nourriture posé au sol près de sa gueule, mangé une fois endormie. Si elle se réveille avant le dernier, le compte repart à zéro.')}</span>
          <b>${escapeHtml(f.min === f.max ? String(f.min) : f.min + ' à ' + f.max)}</b>
          ${f.min !== f.max ? `<em>${escapeHtml(num(avgWanted, 1) + ' en moyenne')}</em>` : ''}
        </div>
        <div class="needs somno-rows feed-waits">
          ${rows.map(([icon, name, detail, value, tip]) => `
            <div class="need">
              <span class="need-icon crisp" aria-hidden="true" ${icon}></span>
              <span class="need-name">${escapeHtml(name)}${infoDot(tip)}<small>${escapeHtml(detail)}</small></span>
              <b>${escapeHtml(value)}</b>
            </div>`).join('')}
        </div>
        <div class="feed-estimate">
          <div class="feed-estimate-head">
            <span class="feed-estimate-label">Durée estimée${infoDot('Le temps des repas, une fois endormie : l\'attente avant chacun, quelques secondes pour le remarquer et 3 s pour le manger. Sans compter le temps de l\'endormir.')}</span>
            <b>≈ ${escapeHtml(rough(t.typical))}</b>
            <em>${escapeHtml(between(rough(t.fast), rough(t.slow)) + ' selon le hasard')}</em>
          </div>
          <div class="feed-lanes">
            ${lane('is-meal', 'Repas', t.fast, t.typical, t.slow, '≈ ' + rough(t.typical))}
            ${sleep ? lane('is-sleep', 'Sommeil', sleep.min, sleep.avg, sleep.top, '≈ ' + rough(sleep.avg)) : ''}
          </div>
        </div>
      </div>`;
    if (OW.resolveImages) OW.resolveImages(host);
  }

  /* ---- le fond du livre ----------------------------------------------------------
     Le wallpaper de la bete (son rendu a defaut), flou et assombri sous le
     livre (css/animal.css, .book-wall). */
  function mountBookWall(entity) {
    const wall = $('[data-book-wall]');
    if (!wall) return;
    wall.setAttribute('data-img', [entity.wallpaper, entity.art].filter(Boolean).join('|'));
    wall.setAttribute('data-img-mode', 'bg');
    if (OW.resolveImages) OW.resolveImages(wall.parentElement);
  }

  /* Les constantes, en pancartes de bois suspendues — les memes que sur
     l'accueil et les autres onglets (.counters de js/wild.js, qui les
     accroche et les fait osciller sous la souris). */
  function renderVitals(entity) {
    const keep = ['hp', 'damage', 'walk', 'mounted', 'knock', 'taming'];
    const stats = statList(entity).filter((s) => keep.indexOf(s.key) >= 0);

    $('[data-vitals]').innerHTML = `
      <div class="counters hero-signs">
        ${stats.map((s) => `
          <div class="counter">
            <span class="counter-ico">${statSprite(s)}</span>
            <div class="value">${escapeHtml(s.text)}</div>
            <div class="key">${escapeHtml(s.label)}</div>
          </div>`).join('')}
      </div>`;
  }

  /* Le rail : la bete, ses chapitres, et le passage aux autres especes. */
  function renderRail(entity, data, accent) {
    const archetype = entity.archetype ? entity.archetype.name : 'NORMAL';
    $('[data-rail-beast]').innerHTML = `
      <span class="rail-head crisp" aria-hidden="true" style="${bg(entity.head)}"></span>
      <span class="rail-names">
        <b>${escapeHtml(entity.name)}</b>
        <small>${escapeHtml(archetype)}</small>
      </span>`;

    const host = $('[data-switcher]');
    host.innerHTML = `<span class="rail-label">Autres créatures</span>`
      + data.entities.map((other) => `
        <a href="${animalHref(other.slug)}" class="rail-beast-link" title="${escapeHtml(other.name)}"
           ${other.slug === entity.slug ? 'aria-current="page"' : ''}
           style="--switch:${escapeHtml(other.boss ? '#B84A38' : (other.color || '#F2A32C'))}">
          <span class="crisp" aria-hidden="true" style="${bg(other.head)}"></span>
          <span>${escapeHtml(other.name)}</span>
        </a>`).join('');
  }

  /* ===========================================================================
     2 · Statistiques — la fiche technique
     =========================================================================== */

  /* Une jauge en segments, comme une barre de vie du jeu : dix pas, remplis
     jusqu'a la valeur, et le chiffre a cote. */
  /* Des icones dessinees plutot que des images : elles prennent la couleur de
     l'espece et restent nettes a n'importe quelle taille. */
  const STAT_ICONS = {
    heart: '<path d="M32 56 C14 42 6 33 6 23 A13 13 0 0 1 32 17 A13 13 0 0 1 58 23 C58 33 50 42 32 56 Z"/>',
    sword: '<path d="M48 8 L56 16 L28 44 L20 36 Z"/><path d="M20 36 L28 44 L18 54 L10 46 Z"/><path d="M8 48 L16 56"/>',
    boot: '<path d="M18 6 h12 v26 l16 10 v12 H18 Z"/><path d="M18 46 h28"/>',
    anvil: '<path d="M10 16 h44 v10 H42 l-4 10 h10 v10 H16 v-10 h10 l-4 -10 H10 Z"/>',
    saddle: '<path d="M12 24 q20 -14 40 0 v14 q-20 12 -40 0 Z"/><path d="M22 20 v-8 M42 20 v-8"/>',
    paw: '<circle cx="18" cy="20" r="7"/><circle cx="32" cy="14" r="7"/><circle cx="46" cy="20" r="7"/>'
      + '<path d="M32 26 q14 0 16 12 q2 12 -16 12 q-18 0 -16 -12 q2 -12 16 -12 Z"/>',
    shield: '<path d="M32 4 L56 12 v20 q0 18 -24 28 Q8 50 8 32 V12 Z"/>'
  };

  function statIcon(name, color) {
    const ink = color || INK;
    return '<svg class="stat-ico" viewBox="0 0 64 64" aria-hidden="true"'
      + ' fill="' + escapeHtml(ink) + '" stroke="' + escapeHtml(ink) + '"'
      + ' stroke-width="3" stroke-linejoin="round" stroke-linecap="round">'
      + (STAT_ICONS[name] || STAT_ICONS.shield) + '</svg>';
  }

  /* Les huit constantes de la fiche, chacune avec le plafond du bestiaire
     qui lui sert d'echelle. */
  function statList(entity, data) {
    const taming = (entity.taming && entity.taming.experience) || entity.gameplay.tamingExperience || null;
    return [
      { key: 'hp', label: 'Points de vie', short: 'PV', icon: 'heart', unit: '',
        hint: "Dégâts encaissés avant que la créature ne tombe.", vary: [0.8, 1.2],
        value: entity.stats.hp, max: REFERENCE.hp },
      { key: 'damage', label: 'Dégâts par combo', short: 'Combo', icon: 'sword', unit: '',
        hint: "Dégâts cumulés d'un combo complet, soit trois coups enchaînés.", info: true, vary: [0.9, 1.1],
        value: entity.stats.damage, max: REFERENCE.damage },
      { key: 'hit', label: 'Dégâts par coup', short: 'Coup', icon: 'sword', unit: '',
        hint: "Un coup représente le tiers du combo, pour toutes les créatures.", info: true, vary: [0.9, 1.1],
        value: entity.stats.damage == null ? null : entity.stats.damage / 3, max: REFERENCE.damage / 3 },
      { key: 'walk', label: 'Vitesse au sol', short: 'Au sol', icon: 'boot', unit: ' b/s',
        hint: "Vitesse de déplacement sans cavalier, en blocs par seconde.", vary: [0.85, 1.05],
        value: entity.stats.walkBps, max: REFERENCE.walk },
      { key: 'mounted', label: 'Vitesse montée', short: 'Montée', icon: 'saddle', unit: ' b/s',
        hint: "Vitesse de déplacement avec un cavalier, en blocs par seconde.", info: true, vary: [0.85, 1.05],
        value: entity.stats.mountedBps, max: REFERENCE.mounted },
      { key: 'knock', label: 'Résistance au recul', short: 'Recul', icon: 'anvil', unit: ' %',
        hint: "Part du recul ignorée à l'impact. À 100 %, la créature ne recule pas.", info: true,
        value: entity.stats.knockbackRes == null ? null : entity.stats.knockbackRes * 100, max: 100 },
      { key: 'armor', label: 'Armure', short: 'Armure', icon: 'shield', unit: '',
        hint: "Chaque point d'armure réduit une part des dégâts reçus.", info: true,
        value: entity.stats.armor, max: 20 },
      { key: 'taming', label: "Expérience d'apprivoisement", short: 'Appriv.', icon: 'paw', unit: ' XP',
        hint: "Expérience totale requise pour apprivoiser la créature.", info: true,
        value: taming, max: 300, sprite: 'assets/ui/taming_exp.png' }
    ].map((d) => {
      /* Le rang et la moyenne se calculent sur tout le bestiaire : c'est ce
         qui donne son sens a une valeur brute. Sans l'export complet, les
         chiffres restent la, seule la comparaison disparait. */
      const all = data ? data.entities.map((e) => valueOf(e, d.key)).filter((v) => v != null) : [];
      const sorted = all.slice().sort((a, b) => b - a);
      const best = sorted[0] || 0;
      return Object.assign(d, {
        part: d.value == null ? 0 : Math.max(0, Math.min(1, d.value / d.max)),
        text: d.value == null ? DASH : num(d.value) + d.unit,
        best,
        count: all.length,
        avg: all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0,
        rank: d.value == null || !all.length ? null : sorted.findIndex((v) => v <= d.value) + 1,
        vsBest: d.value == null || !best ? 0 : Math.max(0, Math.min(1, d.value / best))
      });
    });
  }

  /* La meme valeur, lue sur n'importe quelle creature. */
  function valueOf(entity, key) {
    const taming = () => (entity.taming && entity.taming.experience) || entity.gameplay.tamingExperience || null;
    switch (key) {
      case 'hp': return entity.stats.hp;
      case 'damage': return entity.stats.damage;
      case 'hit': return entity.stats.damage == null ? null : entity.stats.damage / 3;
      case 'walk': return entity.stats.walkBps;
      case 'mounted': return entity.stats.mountedBps;
      case 'knock': return entity.stats.knockbackRes == null ? null : entity.stats.knockbackRes * 100;
      case 'armor': return entity.stats.armor;
      case 'taming': return taming();
      default: return null;
    }
  }

  const rankText = (s) => (s.rank == null ? 'non renseigné' : s.rank + 'ᵉ sur ' + s.count + ' créatures');
  const statSprite = (s) => (s.sprite
    ? '<span class="stat-sprite crisp" aria-hidden="true" style="' + bg(s.sprite) + '"></span>'
    : statIcon(s.icon));

  /* Le detail que le tableau range derriere un repli : il noierait les huit
     chiffres qui comptent s'il restait ouvert. */
  function statFolds(entity) {
    const m = entity.mount || {};
    /* Le troisieme element d'une ligne : son explication, en bulle « i »
       (infoDot, plus bas), pour les attributs peu parlants. */
    const raw = [
      ['Ténacité', entity.stats.armorToughness == null ? DASH : num(entity.stats.armorToughness),
        "Réduit en plus les dégâts des coups les plus puissants, en complément de l'armure."],
      ['Portée de suivi', entity.stats.followRange ? Math.round(entity.stats.followRange) + ' blocs' : DASH,
        'Distance jusqu’à laquelle la créature repère et suit une cible.'],
      ['Détente', entity.stats.jump == null ? DASH : num(entity.stats.jump, 2),
        'Force du saut : plus la valeur est haute, plus la créature saute haut.'],
      ['Chute sans dégâts', entity.stats.safeFall ? Math.round(entity.stats.safeFall) + ' blocs' : DASH,
        'Hauteur de chute supportée sans perte de points de vie.'],
      ['Gabarit', num(entity.size.width, 2) + ' × ' + num(entity.size.height, 2) + ' blocs',
        'Dimensions de la boîte de collision : largeur × hauteur.'],
      ['Hauteur des yeux', entity.size.eye_height ? num(entity.size.eye_height, 2) + ' blocs' : DASH,
        'Hauteur du regard, depuis laquelle la créature voit et vise.'],
      /* La « taille theorique » du mod ne regle pas la taille du modele : elle
         fixe le recul de la camera quand on monte la bete (CameraMixin :
         4 blocs, et taille x 8/18 au-dela d'une taille de 15). */
      ['Recul de caméra monté', entity.stats.scale
        ? num(entity.stats.scale >= 15 ? Math.max(4, entity.stats.scale * 8 / 18) : 4, 1) + ' blocs' : DASH,
        'Distance de la caméra à la troisième personne quand la créature est montée : 4 blocs, davantage pour les très grandes montures.']
    ];
    const mount = [
      ['Montable', m.rideable ? 'Oui' : 'Non'],
      ['Selle', entity.saddle ? entity.saddle.resultName : DASH],
      ['Multiplicateur marche', m.walkMult ? '×' + num(m.walkMult) : DASH,
        'Coefficient appliqué à la vitesse de marche lorsque la créature est montée.'],
      ['Multiplicateur course', m.runMult ? '×' + num(m.runMult) : DASH,
        'Coefficient appliqué à la vitesse de course lorsque la créature est montée.'],
      ['Multiplicateur combo', m.comboMult ? '×' + num(m.comboMult) : DASH,
        'Coefficient appliqué à la vitesse du combo lorsque la créature est montée.'],
      ['Énergie vitale / niveau', m.energyGain != null ? '+' + num(m.energyGain) : DASH,
        'Énergie vitale gagnée à chaque niveau de la monture.'],
      ['Récupération', m.energyRecup != null ? '×' + num(m.energyRecup, 2) : DASH,
        'Vitesse à laquelle l’énergie vitale se recharge.'],
      ['Combat en arène', entity.gameplay.fightsInArena ? 'Oui' : 'Non']
    ];
    const rows = (list) => list.map(([key, value, tip]) => `
      <div class="row"><dt>${escapeHtml(key)}${tip ? infoDot(tip) : ''}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join('');

    /* Pas de <details> : il s'ouvre d'un coup sec et ne sait pas s'animer a
       la fermeture. Un bouton et un tiroir dont on anime la hauteur. */
    const fold = (title, list) => `
      <div class="prof-fold">
        <button type="button" class="prof-fold-head" data-fold aria-expanded="false">
          <span class="prof-fold-mark" aria-hidden="true"></span>
          ${escapeHtml(title)}
          <em>${list.length}</em>
        </button>
        <div class="prof-fold-body" data-fold-body style="height:0">
          <dl class="rows">${rows(list)}</dl>
        </div>
      </div>`;

    /* Les attributs bruts se lisent a cote du tableau, toujours ouverts ; la
       monture reste repliee dessous. */
    return {
      raw: `
        <div class="prof-raw">
          <span class="prof-raw-head">Attributs bruts <em>${raw.length}</em></span>
          <dl class="rows">${rows(raw)}</dl>
        </div>`,
      folds: `
        <div class="prof-folds">
          ${fold('Monture', mount)}
        </div>`
    };
  }

  /* La petite bulle « i » : survolee ou touchee, elle explique la ligne
     (css/ux.css, .info-dot). */
  function infoDot(text) {
    return `<span class="info-dot" tabindex="0" role="note" aria-label="${escapeHtml(text)}" data-tip="${escapeHtml(text)}">i</span>`;
  }

  /* Ouvre et ferme un tiroir en animant sa hauteur : de zero a sa taille
     reelle, puis 'auto' une fois arrive, pour qu'il suive son contenu. */
  function wireFolds(host) {
    host.querySelectorAll('[data-fold]').forEach((head) => {
      const body = head.nextElementSibling;
      head.addEventListener('click', () => {
        const open = head.getAttribute('aria-expanded') === 'true';
        head.setAttribute('aria-expanded', open ? 'false' : 'true');
        head.classList.toggle('is-open', !open);

        /* Les minuteurs doublent l'animation : dans un onglet en arriere-plan
           le navigateur ne joue ni transition ni image suivante, et le tiroir
           resterait bloque a mi-course. */
        if (open) {
          body.style.height = body.scrollHeight + 'px';
          setTimeout(() => { body.style.height = '0px'; }, 20);
          return;
        }
        body.style.height = body.scrollHeight + 'px';
        const settle = setTimeout(() => { body.style.height = 'auto'; }, 420);
        const done = (event) => {
          if (event.propertyName !== 'height') return;
          clearTimeout(settle);
          body.style.height = 'auto';
          body.removeEventListener('transitionend', done);
        };
        body.addEventListener('transitionend', done);
      });
    });
  }

  /* Le chapitre 01 : le releve en tableau. Valeur et rang dans le
     bestiaire ; chaque colonne se trie d'un clic sur son en-tete. */
  function renderStats(entity, data, accent) {
    const host = $('[data-profile]');
    const stats = statList(entity, data);

    const row = (s) => `
      <div class="tbl-row" data-key="${escapeHtml(s.key)}">
        <span class="tbl-cell tbl-name">${statSprite(s)}${escapeHtml(s.label)}${s.info ? infoDot(s.hint) : ''}</span>
        <span class="tbl-cell tbl-val">${escapeHtml(s.text)}${s.vary && s.value != null
          ? `<small class="tbl-range" title="Fourchette d'une créature sauvage">${escapeHtml(num(s.value * s.vary[0], 1) + ' à ' + num(s.value * s.vary[1], 1) + s.unit)}</small>` : ''}</span>
        <span class="tbl-cell tbl-rank">${escapeHtml(s.rank == null ? DASH : s.rank + 'ᵉ / ' + s.count)}</span>
      </div>`;

    const extra = statFolds(entity);
    host.innerHTML = `
      <div class="tbl" data-table>
        <div class="prof-split">
          <div class="prof-main">
            <div class="tbl-row tbl-headrow">
              <button type="button" class="tbl-cell tbl-th" data-sort="label">Constante</button>
              <button type="button" class="tbl-cell tbl-th" data-sort="value">Valeur</button>
              <button type="button" class="tbl-cell tbl-th" data-sort="rank">Rang</button>
            </div>
            <div class="tbl-body" data-body>${stats.map(row).join('')}</div>
            <span class="tbl-foot">
              Rang établi sur les ${escapeHtml(num(data.entities.length))} créatures
              du bestiaire. Un clic sur un en-tête trie la colonne.
            </span>
            <p class="tbl-random">
              <b>Chaque créature est unique.</b> Les valeurs affichées sont les valeurs de base : une créature
              sauvage tire ses statistiques au hasard à son apparition — points de vie ×0,8 à ×1,2,
              dégâts ×0,9 à ×1,1, vitesse ×0,85 à ×1,05 (petits chiffres sous chaque valeur). Sa taille
              peut aussi varier d’environ ±10 %. Un petit né d’un élevage n’est pas tiré au sort.
            </p>
          </div>
          ${extra.raw}
        </div>
        ${extra.folds}
      </div>`;

    /* Le tri : la colonne cliquee passe en tete, un second clic inverse. */
    const body = host.querySelector('[data-body]');
    let sortKey = null;
    let desc = true;
    host.querySelector('[data-table]').addEventListener('click', (event) => {
      const th = event.target.closest('[data-sort]');
      if (!th) return;
      const key = th.dataset.sort;
      desc = key === sortKey ? !desc : true;
      sortKey = key;
      host.querySelectorAll('[data-sort]').forEach((b) => {
        b.classList.toggle('is-sorted', b === th);
        b.dataset.dir = b === th ? (desc ? 'desc' : 'asc') : '';
      });
      const value = (el) => {
        const s = stats.find((x) => x.key === el.dataset.key);
        if (key === 'label') return s.label;
        if (key === 'rank') return s.rank == null ? Infinity : s.rank;
        return s[key] == null ? -Infinity : s[key];
      };
      Array.prototype.slice.call(body.children)
        .sort((a, b) => {
          const va = value(a), vb = value(b);
          const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
          return desc ? -cmp : cmp;
        })
        .forEach((r) => body.appendChild(r));
    });

    wireFolds(host);
  }

  /* ===========================================================================
     3 · Capacites — la barre du HUD
     =========================================================================== */

  const ROLE_LABEL = {
    combo: 'Combo', secondary: 'Secondaire', 'secondary-alt': 'Secondaire bis', ultimate: 'Ultime'
  };
  const KEY_LABEL = { LMB: 'Clic gauche', RMB: 'Clic droit', X: 'Touche X' };

  /* Le jeu n'a que trois emplacements : combo, secondaire, ultime. Les deux
     cartes secondaires se partagent le meme — la molette passe de l'une a
     l'autre — et on n'a pas le droit de les poser cote a cote comme deux
     attaques distinctes. */
  function abilitySlots(entity) {
    const slots = [];
    entity.cards.filter((c) => !c.passive).slice().sort((a, b) => a.order - b.order)
      .forEach((card) => {
        const shared = card.role === 'secondary' || card.role === 'secondary-alt';
        const open = shared ? slots.find((s) => s.kind === 'secondary') : null;
        if (open) { open.cards.push(card); return; }
        slots.push({ kind: shared ? 'secondary' : (card.role || 'combo'), cards: [card] });
      });
    return slots;
  }

  /* Le dos d'une carte : ses reglages, en clair. */
  function cardConstants(card) {
    if (!card.constants.length) return '<span class="deck-none">Aucune constante exportée.</span>';
    return card.constants.map((c) => `
      <span class="deck-const">
        <em>${escapeHtml(c.label)}</em>
        <b>${escapeHtml(c.value)}</b>
      </span>`).join('');
  }

  /* Les capacites en jeu de cartes : l'eventail se tire d'un clic, et la carte
     de devant se retourne d'un second clic. */
  function renderAbilities(entity, accent) {
    const host = $('[data-abilities]');
    const passiveHost = $('[data-passives]');

    const slots = abilitySlots(entity);
    const passives = entity.cards.filter((c) => c.passive);

    if (!slots.length && !passives.length) {
      host.innerHTML = '<p class="empty-note">Aucune carte de capacité exportée pour cette créature.</p>';
      passiveHost.innerHTML = '';
      return;
    }

    const cards = slots.reduce((list, slot) => list.concat(
      slot.cards.map((card) => ({ card, slot }))
    ), []);

    const frame = '<span class="deck-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
    host.innerHTML = `
      <div class="deck-fan" style="--count:${cards.length}">
        ${cards.map(({ card, slot }, i) => `
          <div class="deck-card${i === 0 ? ' is-front' : ''}" data-deck data-role="${escapeHtml(card.role || 'combo')}"
                   style="--i:${i};--role-color:${escapeHtml(card.roleColor || accent)}"
                   tabindex="0" role="button" aria-label="${escapeHtml(card.title)}">
            <div class="deck-inner">
              <div class="deck-front">
                ${frame}
                <span class="deck-head">
                  <span class="deck-role">${escapeHtml(ROLE_LABEL[card.role] || 'Capacité')}</span>
                  <span class="deck-num">${String(i + 1).padStart(2, '0')}</span>
                </span>
                <div class="deck-art">${abilityArt(entity, card, accent)}</div>
                <h3>${escapeHtml(card.title)}</h3>
                <div class="deck-desc"><p>${card.descriptionHtml}</p></div>
                <span class="deck-foot">
                  <span class="deck-key">${escapeHtml(KEY_LABEL[card.keyLabel] || card.keyLabel || '')}</span>
                  ${slot.cards.length > 1 ? '<em>emplacement partagé — molette</em>' : ''}
                </span>
              </div>
              <div class="deck-rear">
                ${frame}
                <span class="deck-rear-top">${escapeHtml(card.title)}</span>
                <div class="deck-consts">${cardConstants(card)}</div>
                <span class="deck-rear-foot">Clic pour refermer</span>
              </div>
            </div>
          </div>`).join('')}
      </div>`;
    if (OW.resolveImages) OW.resolveImages(host);

    const fan = Array.prototype.slice.call(host.querySelectorAll('[data-deck]'));
    function pull(card) {
      if (card.classList.contains('is-front')) { card.classList.toggle('is-flipped'); return; }
      fan.forEach((c) => { c.classList.remove('is-front'); c.classList.remove('is-flipped'); });
      card.classList.add('is-front');
    }
    fan.forEach((card) => {
      card.addEventListener('click', () => pull(card));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pull(card); }
      });
    });

    /* Les passifs ne s'equipent pas : ils sont toujours la, sous l'eventail. */
    passiveHost.innerHTML = passives.length
      ? passives.map((card, i) => `
          <article class="aura" style="--accent-line:${escapeHtml(accent)};--i:${i}">
            <span class="aura-sigil" aria-hidden="true">${roleGlyph('passive', accent)}</span>
            <div class="aura-text">
              <h3 class="aura-title">${escapeHtml(card.title)}</h3>
              <p>${card.descriptionHtml}</p>
              ${constantChips(card)}
            </div>
          </article>`).join('')
      : '<p class="empty-note">Cette créature n\'a pas de passif documenté.</p>';
  }

  /* ===========================================================================
     4 · Apprivoisement — la page de carnet
     =========================================================================== */

  /* ---- le manuel, en livre -----------------------------------------------------
     Le manuel d'apprivoisement, relie comme le journal du jeu (textures du mod,
     tools/build-manual.py) et construit en volume : deux plats de cuir, deux
     blocs de pages qui ont une vraie epaisseur (on en voit la tranche), une
     couverture abimee qui pivote sur le dos. Ferme au depart ; au repos, il
     respire. Une page qui tourne est faite de trois bandes qui ploient l'une
     apres l'autre : le papier se courbe au lieu de pivoter d'un bloc. Tout
     bouge par transform et opacity.

     Les faces, dans l'ordre du livre : l'interieur de la couverture, la page de
     titre, les pages du manuel du mod, puis des pages arrachees (la suite
     manque). Double page quand la place le permet, sinon une page a la fois :
     le livre glisse alors d'une page a l'autre sous le cadre.

     Mesures en cases de la texture (--k pixels la case) : plat 128 x 188,
     page 123 x 178, posee a 2,5 cases du dos et 5 du haut. */
  const MB = { CW: 128, CH: 188, PW: 123, PH: 178, T: 16 };
  /* Les bandes de la feuille qui tourne, en cases depuis le dos : six bandes,
     chacune pivote un peu sur la precedente — une courbe, pas des plis. Elles
     debordent d'une demi-case sur la suivante : pas de jour entre elles. */
  const SEG = [[0, 26], [26, 22], [48, 21], [69, 20], [89, 18], [107, 16]];
  const SEG_OVERLAP = 0.6;

  function mountBook(host, pages, entity) {
    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const faces = [
      { kind: 'endpaper' },
      { kind: 'title' },
      ...pages.map((page) => ({ kind: 'text', html: page.html, title: page.title, number: page.number }))
    ];
    /* La fin arrachee : deux pages dechirees, sans rien d'ecrit dessus. */
    if (faces.length % 2 === 1) faces.push({ kind: 'torn' });
    faces.push({ kind: 'torn' }, { kind: 'torn' });
    const lastSpread = faces.length / 2 - 1;

    const img = (name) => `url('${new URL('assets/pages/manual/' + name + '.png', window.location.href).href}')`;
    const faceHTML = (i) => {
      const f = faces[i];
      if (!f) return '';
      const left = i % 2 === 0;
      if (f.kind === 'endpaper') {
        return `<div class="mb-face is-endpaper" style="background-image:${img('endpaper')}"></div>`;
      }
      const torn = f.kind === 'torn';
      const bgName = (left ? 'page-l' : 'page-r') + (torn ? '-torn' : '');
      let inner = '';
      if (f.kind === 'title') {
        inner = `<div class="mb-titlepage">
            <span class="mb-title-head crisp" aria-hidden="true" style="${bg(entity.head)}"></span>
            <span class="mb-title-kicker">Guide d'apprivoisement</span>
            <b class="mb-title-name">${escapeHtml(entity.name)}</b>
            <span class="mb-divider" aria-hidden="true" style="background-image:${img('divider')}"></span>
            <span class="mb-title-sub">L'apprivoisement, pas à pas</span>
          </div>`;
      } else if (f.kind === 'text') {
        const head = f.title
          ? `<span class="mb-chapter"><small>Chapitre ${escapeHtml(f.number)}</small><b>${escapeHtml(f.title)}</b></span>`
          : '';
        inner = `${head}<span class="mb-divider" aria-hidden="true" style="background-image:${img('divider')}"></span><p>${f.html}</p>`;
      }
      const folio = f.kind === 'text' ? `<span class="mb-folio">${i}</span>` : '';
      return `<div class="mb-face ${left ? 'is-left' : 'is-right'}" style="background-image:${img(bgName)}">${inner}${folio}</div>`;
    };
    /* Une bande de la feuille qui tourne : son morceau du recto et du verso. */
    const slice = (i, from, width, back) => `<div class="mb-slice${back ? ' is-back' : ''}"><div class="mb-slice-in" style="--off:${back ? MB.PW - from - width : from}">${faceHTML(i)}</div></div>`;

    host.innerHTML = `
      <div class="mb is-closed" tabindex="0" role="group" aria-roledescription="livre"
           aria-label="Guide d'apprivoisement : ${escapeHtml(entity.name)}">
        <div class="mb-stage">
          <span class="mb-shadow" aria-hidden="true"></span>
          <div class="mb-float">
            <div class="mb-jolt">
            <div class="mb-book">
              <div class="mb-board" aria-hidden="true"><i class="mb-edge is-bottom"></i><i class="mb-edge is-right"></i><i class="mb-edge is-top"></i></div>
              <div class="mb-stack is-right" data-mb-right><div class="mb-top" data-mb-right-top></div><i class="mb-edge is-bottom"></i><i class="mb-edge is-right"></i></div>
              <div class="mb-cover" data-mb-cover>
                <i class="mb-cover-edge is-bottom" aria-hidden="true"></i><i class="mb-cover-edge is-right" aria-hidden="true"></i><i class="mb-cover-edge is-top" aria-hidden="true"></i>
                <div class="mb-cover-front" style="background-image:${img('cover')}">
                  <span class="mb-cover-head crisp" aria-hidden="true" style="${bg(entity.head)}"></span>
                  <span class="mb-cover-plate"><small>Guide d'apprivoisement</small><b>${escapeHtml(entity.name)}</b></span>
                  <span class="mb-cover-hint">Ouvrir</span>
                </div>
                <div class="mb-cover-back" data-mb-endpaper></div>
                <div class="mb-stack is-left" data-mb-left><div class="mb-top" data-mb-left-top></div><i class="mb-edge is-bottom"></i><i class="mb-edge is-left"></i></div>
              </div>
              <div class="mb-leaf" data-mb-leaf hidden><div class="mb-leaf-turn" data-mb-turn>${SEG.reduceRight((inner, [, w], k) =>
                `<div class="mb-seg${k ? '' : ' is-first'}" style="--w:${w}"><div class="mb-seg-faces" data-mb-seg></div>${inner}</div>`, '')}</div></div>
            </div>
            </div>
          </div>
        </div>
        <div class="mb-nav">
          <button type="button" class="mb-btn" data-mb-prev aria-label="Page précédente">←</button>
          <span class="mb-count" data-mb-count aria-live="polite"></span>
          <button type="button" class="mb-btn" data-mb-next aria-label="Page suivante">→</button>
          <button type="button" class="mb-btn is-close" data-mb-close>Refermer</button>
        </div>
      </div>`;

    const root = host.querySelector('.mb');
    const cover = root.querySelector('[data-mb-cover]');
    const leaf = root.querySelector('[data-mb-leaf]');
    const rightTop = root.querySelector('[data-mb-right-top]');
    const leftTop = root.querySelector('[data-mb-left-top]');
    const segs = Array.from(root.querySelectorAll('[data-mb-seg]'));
    const count = root.querySelector('[data-mb-count]');
    const prevBtn = root.querySelector('[data-mb-prev]');
    const nextBtn = root.querySelector('[data-mb-next]');
    /* L'interieur de la couverture porte le meme coin use que son dehors :
       la transparence de cover.png, vue de dos (en miroir). */
    root.querySelector('[data-mb-endpaper]').innerHTML =
      `<div class="mb-endpaper-cut" style="--cover-mask:${img('cover')}">${faceHTML(0)}</div>`;

    /* L'etat : ferme, ou ouvert sur la double page `spread` (faces 2s et 2s+1) ;
       en page simple, `side` dit quelle moitie est sous le cadre. */
    let open = false;
    let spread = 0;
    let side = 'right';
    let busy = false;
    const single = () => root.classList.contains('is-single');

    /* Les feuilles deja tournees s'empilent a gauche, les autres a droite. */
    const tlOf = (s) => MB.T * s / lastSpread;
    const trOf = (s) => MB.T * (lastSpread - s) / lastSpread;
    function thickness(s) {
      root.style.setProperty('--tl', tlOf(s).toFixed(2));
      root.style.setProperty('--tr', trOf(s).toFixed(2));
    }

    function paint() {
      rightTop.innerHTML = faceHTML(2 * spread + 1);
      leftTop.innerHTML = spread > 0 ? faceHTML(2 * spread) : '';
      root.classList.toggle('has-left', spread > 0);
      thickness(spread);
      root.classList.toggle('is-closed', !open);
      root.classList.toggle('is-open', open);
      root.dataset.side = !open ? 'cover' : single() ? side : 'both';
      const pagesTotal = faces.length - 1;
      if (!open) count.textContent = 'Fermé';
      else if (single()) count.textContent = 'Page ' + (2 * spread + (side === 'left' ? 0 : 1)) + ' sur ' + pagesTotal;
      else count.textContent = spread === 0 ? 'Page 1 sur ' + pagesTotal : 'Pages ' + (2 * spread) + '–' + (2 * spread + 1) + ' sur ' + pagesTotal;
      prevBtn.disabled = !open || (spread === 0 && (!single() || side === 'right'));
      nextBtn.disabled = open && spread >= lastSpread && (!single() || side === 'right');
      root.setAttribute('aria-expanded', String(open));
    }

    /* Un petit a-coup quand quelque chose de lourd se pose (couverture, page). */
    const jolt = root.querySelector('.mb-jolt');
    function thud(kind) {
      if (reduced()) return;
      jolt.classList.remove('is-thud', 'is-settle');
      void jolt.offsetWidth;
      jolt.classList.add(kind);
    }

    function setOpen(value) {
      if (busy || open === value) return;
      open = value;
      spread = 0;
      side = 'right';
      busy = !reduced();
      paint();
      if (busy) {
        /* La couverture retombe : le livre encaisse le choc. */
        setTimeout(() => thud('is-thud'), value ? 1450 : 1300);
        setTimeout(() => { busy = false; }, 1800);
      }
    }

    /* Tourner une feuille : en avant, la page de droite part se poser a gauche. */
    function turn(dir) {
      if (busy || !open) return;
      if (single()) {
        /* Page simple : on glisse d'abord vers l'autre moitie de la double page. */
        if (dir > 0 && side === 'left') { side = 'right'; paint(); return; }
        if (dir < 0 && side === 'right' && spread > 0) { side = 'left'; paint(); return; }
      }
      const to = spread + dir;
      if (to < 0 || to > lastSpread) return;
      const n = dir > 0 ? spread + 1 : spread;     /* la feuille qui tourne */
      segs.forEach((el, k) => {
        el.innerHTML = slice(2 * n - 1, SEG[k][0], SEG[k][1] + SEG_OVERLAP, false) + slice(2 * n, SEG[k][0], SEG[k][1] + SEG_OVERLAP, true);
      });
      if (reduced()) {
        spread = to;
        if (single()) side = dir > 0 ? 'left' : 'right';
        paint();
        return;
      }
      busy = true;
      /* Dessous, la page d'apres est deja la ; l'epaisseur passe d'un cote a
         l'autre pendant que la feuille vole. */
      if (dir > 0) rightTop.innerHTML = faceHTML(2 * to + 1);
      else {
        leftTop.innerHTML = to > 0 ? faceHTML(2 * to) : '';
        root.classList.toggle('has-left', to > 0);
      }
      /* La feuille part du dessus d'un bloc et se pose sur l'autre (plats de
         4 cases compris) : ses hauteurs de depart et d'arrivee, en cases. */
      leaf.style.setProperty('--z0', ((dir > 0 ? trOf(spread) : tlOf(spread)) + 4).toFixed(2));
      leaf.style.setProperty('--z1', ((dir > 0 ? tlOf(to) : trOf(to)) + 4).toFixed(2));
      leaf.className = 'mb-leaf ' + (dir > 0 ? 'is-forward' : 'is-backward');
      leaf.hidden = false;
      thickness(dir > 0 ? to - 1 + 0.001 : to + 1);
      requestAnimationFrame(() => thickness(to));
      if (single()) { side = dir > 0 ? 'left' : 'right'; root.dataset.side = side; }
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        clearTimeout(guard);
        spread = to;
        leaf.hidden = true;
        leaf.className = 'mb-leaf';
        paint();
        thud('is-settle');
        busy = false;
      };
      const onEnd = (event) => {
        /* La fin de la rotation (la cloche finit au meme instant). */
        if (!event.target.hasAttribute('data-mb-turn')) return;
        leaf.removeEventListener('animationend', onEnd);
        done();
      };
      leaf.addEventListener('animationend', onEnd);
      /* Filet : un onglet en arriere-plan ne finit jamais son animation. */
      const guard = setTimeout(done, 2100);
    }

    root.querySelector('.mb-cover-front').addEventListener('click', () => setOpen(true));
    root.querySelector('[data-mb-close]').addEventListener('click', () => setOpen(false));
    prevBtn.addEventListener('click', () => turn(-1));
    nextBtn.addEventListener('click', () => (open ? turn(1) : setOpen(true)));
    root.querySelector('[data-mb-right]').addEventListener('click', () => { if (open) turn(1); });
    root.querySelector('[data-mb-left]').addEventListener('click', () => { if (open) turn(-1); });
    root.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') { event.preventDefault(); if (open) turn(1); else setOpen(true); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); turn(-1); }
      if (event.key === 'Escape' && open) setOpen(false);
    });

    /* La taille d'une case : entiere (ou demi) pour des pixels nets ; une page
       a la fois quand deux pages n'ont pas la place. */
    let lastK = '';
    const fit = () => {
      const w = host.clientWidth || window.innerWidth;
      const twoPages = w >= 2 * MB.CW * 2 + 40;
      const k = twoPages
        ? Math.max(2, Math.min(3, Math.floor((w - 40) / (2 * MB.CW))))
        : Math.max(1.5, Math.min(3, Math.floor(((w - 24) / MB.CW) * 2) / 2));
      const key = k + (twoPages ? 'd' : 's');
      if (key === lastK) return;
      lastK = key;
      root.style.setProperty('--k', String(k));
      root.classList.toggle('is-single', !twoPages);
      /* Sous deux pixels par case (telephone de moins de 338 px), la page
         est trop courte pour le texte a sa taille plancher : on le serre. */
      root.classList.toggle('is-tiny', k < 2);
      if (!twoPages && open) side = 'right';
      paint();
    };
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(host);
    fit();
  }

  /* Les numeros de chapitre du guide (js/taming-guides.js). */
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];

  function renderTaming(entity, accent) {
    const taming = entity.taming;
    const manual = $('[data-taming-manual]');

    /* Le deroule de l'apprivoisement vient uniquement des etapes ecrites a
       la main (js/taming-guides.js) : le texte du manuel exporte par le mod
       (taming.manual) n'est plus lu, pour le moment. */
    const written = OW.TAMING_GUIDES && OW.TAMING_GUIDES[entity.slug];
    /* Une ligne « # Titre » ouvre un chapitre : elle coiffe la page qui la
       suit, numerotee en chiffres romains. */
    const pages = [];
    let chapter = null;
    let chapterCount = 0;
    (Array.isArray(written) ? written : []).forEach((step) => {
      const line = String(step);
      const title = /^\s*#\s*(.+)$/.exec(line);
      if (title) {
        chapter = title[1].trim();
        return;
      }
      pages.push({
        title: chapter,
        number: chapter ? ROMAN[++chapterCount] || String(chapterCount) : null,
        text: line.replace(/\*\*/g, ''),
        html: escapeHtml(line)
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br>')
      });
      chapter = null;
    });

    if (pages.length) {
      mountBook(manual, pages, entity);
    } else {
      manual.innerHTML = `<p class="step-empty">${entity.traits.tameable
        ? "Le guide d'apprivoisement de cette créature n'est pas encore rédigé."
        : "Cette créature ne s'apprivoise pas. Elle se combat dans son arène et laisse son butin en mourant."}</p>`;
    }

    /* Le tampon de difficulte, dans le coin de la page : le palier choisi a la
       main (js/site-config.js). Sans palier regle, pas de tampon. */
    const level = OW.tamingDifficulty(entity.slug);
    const stampBox = $('[data-difficulty]');
    if (level == null) {
      stampBox.innerHTML = '';
      stampBox.hidden = true;
    } else {
    const scale = DIFFICULTY_SCALE[level];
    stampBox.hidden = false;

    stampBox.innerHTML = `
      <button type="button" class="stamp" data-difficulty-open
              style="--difficulty-color:${scale.color};--difficulty-ink:${strongInk(scale.color)}"
              title="Voir l'échelle de difficulté">
        <span class="stamp-icon crisp" role="img" aria-label="${escapeHtml(scale.label)}"
              style="${bg('assets/pages/difficulty/' + level + '.png')}"></span>
        <span class="stamp-text">
          <b>${escapeHtml(scale.label)}</b>
          <small>Palier ${level + 1} / 8</small>
          <em>Comprendre l'échelle →</em>
        </span>
      </button>`;

    buildDifficultyModal(entity, level);
    }

    /* La nourriture : une case d'inventaire par aliment, son nom au survol. */
    const foods = $('[data-foods]');
    const tags = (taming && taming.foodTags) || [];
    /* Le nom de chaque groupe, d'apres ce que le mod en fait (tags du Java) :
       le tag anglais (« tiger_taming_food ») ne parle a personne. */
    const FOOD_GROUP = [
      [/_taming_food$/, "Pour l'apprivoiser", ''],
      [/_dangerous_food$/, "Dangereux : l'empoisonne et le rend agressif", 'is-danger'],
      [/_stealable_eggs$/, "Les œufs qu'il vole", ''],
      [/_sweets$/, "Les douceurs qui l'attirent", ''],
      [/_food$/, 'Son régime', '']
    ];
    const groupOf = (id) => FOOD_GROUP.find(([re]) => re.test(id)) || [null, readableId(id), ''];
    /* Les oeufs du panda roux : un groupe cite les trois paliers (des tags),
       puis chaque palier est un groupe a part. On les reunit en une seule
       liste, la rarete au bout de chaque ligne. */
    const TIER = { common: 'Commun', rare: 'Rare', prized: 'Précieux' };
    const tiers = tags.filter((t) => /_eggs_(common|rare|prized)$/.test(t.id));
    const shown = tags
      .filter((t) => !tiers.includes(t))
      .map((t) => (tiers.length && t.items.every((i) => /^#/.test(i.id))
        ? Object.assign({}, t, {
          items: tiers.flatMap((tier) => tier.items.map((i) => Object.assign({}, i, { tier: TIER[/_eggs_(\w+)$/.exec(tier.id)[1]] })))
        })
        : t));
    /* Les paliers de nourriture (taming.food_tiers) en tete, du plus fort au
       plus faible : l'aliment adore, le prefere (chacun avec les repas qu'une
       bouchee compte), puis la nourriture pour l'apprivoiser, puis le
       regime ; le reste (poison, oeufs, douceurs) vient apres. Sans tag de
       regime, le palier 1 se dit « regime de base » plutot que d'inventer des
       aliments. */
    const foodTiers = (taming && taming.foodTiers) || [];
    const favorites = foodTiers
      .filter((tier) => tier.item && tier.kind !== 'diet')
      .sort((a, b) => b.tier - a.tier)
      .map((tier) => ({
        id: 'tier:' + tier.kind,
        label: tier.kind === 'adored' ? 'Son aliment adoré' : 'Son aliment préféré',
        cls: 'is-' + tier.kind,
        items: [Object.assign({}, tier.item, { tier: plural(tier.portions, 'repas', 'repas') })]
      }));
    const isDiet = (t) => /_food$/.test(t.id) && !/_(dangerous|taming)_food$/.test(t.id);
    const diet = shown.filter(isDiet);
    if (!diet.length && foodTiers.some((tier) => tier.kind === 'diet')) {
      diet.push({ id: 'tier:diet', label: 'Son régime', cls: '', items: [], note: 'régime de base' });
    }
    const isTaming = (t) => /_taming_food$/.test(t.id);
    shown.splice(0, shown.length, ...favorites, ...shown.filter(isTaming), ...diet,
      ...shown.filter((t) => !isDiet(t) && !isTaming(t)));
    foods.innerHTML = shown.length
      ? shown.map((tag) => {
        const [, label, cls] = tag.label ? [null, tag.label, tag.cls] : groupOf(tag.id);
        return `
          <div class="sack-group ${cls}">
            <span class="sack-name">${escapeHtml(label)}</span>
            ${tag.note ? `<span class="sack-base">${escapeHtml(tag.note)}</span>` : ''}
            <div class="sack-rows${tag.items.length > 3 ? ' is-many' : ''}">
              ${tag.items.map((item) => `
                <a class="need sack-row" href="${escapeHtml(itemHref(item.id))}" title="${escapeHtml(item.id)}">
                  <span class="need-icon crisp" aria-hidden="true" ${OW.imgAttr(OW.itemCandidates(item.id), { mode: 'bg' })}></span>
                  <span class="need-name">${escapeHtml(item.name)}</span>
                  ${item.tier ? `<b class="sack-tier">${escapeHtml(item.tier)}</b>` : ''}
                </a>`).join('')}
            </div>
          </div>`;
      }).join('')
      : '<p class="empty-note">Aucun régime d\'apprivoisement exporté.</p>';
    if (OW.resolveImages) OW.resolveImages(foods);
    renderFeeding(entity);

    /* La selle et ses materiaux. */
    const saddle = entity.saddle;
    const panel = $('[data-saddle-panel]');
    if (saddle) {
      /* Sans selle, une bete apprivoisee ne se monte pas : c'est la piece
         maitresse du chapitre, elle prend la premiere place et la grande
         vignette. */
      panel.innerHTML = `
        <span class="paper-label">L'objet à fabriquer</span>
        <div class="paper-body">
        <a class="saddle" href="${escapeHtml(itemHref(saddle.result))}">
          <span class="saddle-frame">
            <span class="saddle-image crisp"
                  ${OW.imgAttr(['assets/pages/' + entity.slug + '/saddle.png', saddleSprite(entity.slug)], { mode: 'bg', empty: 'hide' })}></span>
          </span>
          <span class="saddle-titles">
            <b>${escapeHtml(saddle.resultName)}</b>
            <small>Débloquée à ${escapeHtml(num(saddle.threshold))} XP d'apprivoisement</small>
          </span>
        </a>
        <div class="needs">
          ${saddle.needs.map((need) => `
            <a class="need" href="${escapeHtml(itemHref(need.iconId))}"
               title="${escapeHtml(need.name)} · voir la fiche">
              <span class="need-icon crisp" aria-hidden="true" ${OW.imgAttr(OW.itemCandidates(need.iconId), { mode: 'bg' })}
                    ${OW.cycleAttr(need.iconIds, (need.colorSlot || 0) * 8)}></span>
              <span class="need-name">${escapeHtml(need.name)}</span>
              <b>× ${need.count}</b>
            </a>`).join('')}
        </div>
        </div>`;
      if (OW.resolveImages) OW.resolveImages(panel);
    } else {
      panel.innerHTML = `
        <span class="paper-label">La selle</span>
        <div class="paper-body"><p class="empty-note">Aucune selle n'est encore définie pour cette créature.</p></div>`;
    }

    renderSomnolence(entity);
    mountBookWall(entity);

    /* Le progres du jeu, en notification. Sans progres, la difficulte prend
       toute la rangee (la case vide est cachee). */
    const advancement = taming && taming.advancement;
    const advBox = $('[data-advancement]');
    advBox.hidden = !advancement;
    advBox.innerHTML = advancement
      ? `<div class="toast-adv">
           <span class="toast-adv-icon crisp" aria-hidden="true" style="${bg(entity.head)}"></span>
           <span class="toast-adv-text">
             <small>Progrès débloqué</small>
             <b>${escapeHtml(advancement.title)}</b>
             <em>${escapeHtml(advancement.description)}</em>
           </span>
         </div>`
      : '';
  }

  /* ===========================================================================
     5 · Territoires — la carte bord a bord
     =========================================================================== */

  /* La couleur d'un biome : celle de la bande que la carte lui donne. Les
     biomes ajoutes par le mod n'y figurent pas — ils gardent le vert. */
  function biomeColor(id) {
    const bands = OW.BIOME_BANDS;
    if (!bands) return null;
    const bare = String(id).replace(/^.*:/, '');
    const key = Object.keys(bands).find((k) => bands[k].tags.indexOf(bare) !== -1);
    return key ? bands[key].color : null;
  }

  /* Les paliers de rarete du mod (OWWikiSpawnRarity), du plus frequent au plus
     rare. Les couleurs reprennent la gamme des skins (Cosmetiques), avec un
     vert pour « peu commun ». */
  const SPAWN_TIERS = {
    common: { label: 'Commun', color: '#B8BDB4' },
    uncommon: { label: 'Peu commun', color: '#7FC46A' },
    rare: { label: 'Rare', color: '#4FA3C7' },
    very_rare: { label: 'Très rare', color: '#BA7FD4' },
    exceptional: { label: 'Exceptionnel', color: '#F5C842' }
  };

  function tierBadge(tier) {
    const t = SPAWN_TIERS[tier];
    return t ? `<span class="spawn-tier" style="--tier:${t.color}">${escapeHtml(t.label)}</span>` : '';
  }

  /* Sous 1, deux decimales : 0,98 groupe ne s'arrondit pas a 1. */
  const per100 = (value) => num(value, value < 1 ? 2 : 1);

  function renderSpawn(entity, accent) {
    const spawn = entity.spawn;
    const rarity = entity.rarity;

    /* Les biomes de la regle d'apparition, plus ceux que le calcul de rarete
       a trouves (une deuxieme regle, comme la jungle clairsemee du gorille),
       du plus frequent au plus rare. */
    const byBiome = {};
    (rarity ? rarity.biomes : []).forEach((b) => { byBiome[b.biome] = b; });
    const ids = (spawn ? spawn.biomes : []).slice();
    Object.keys(byBiome).forEach((id) => { if (ids.indexOf(id) === -1) ids.push(id); });
    const freq = (id) => (byBiome[id] ? byBiome[id].groups : -1);
    ids.sort((a, b) => freq(b) - freq(a));

    drawSpawnMap($('[data-map]'), ids, accent);
    const caption = $('.atlas-caption');
    if (caption) {
      caption.textContent = ids.length
        ? 'Les zones éclairées sont les biomes où la bête apparaît.'
        : 'Aucune apparition naturelle : le monde entier est affiché.';
    }

    const biomes = $('[data-spawn-biomes]');
    if (ids.length) {
      biomes.innerHTML = ids.map((id, i) => {
        const isMod = id.indexOf('ow:') === 0;
        const marine = /ocean|deep|frozen_ocean|warm_ocean|lukewarm|river|beach|reef/.test(id);
        /* Chaque biome porte la couleur de sa bande sur la carte du dessus :
           la pastille de la chip et la tache du territoire se repondent. */
        const color = biomeColor(id) || (marine ? '#00A0C8' : (isMod ? '#8A9A2E' : INK));
        const here = byBiome[id];
        const title = here && SPAWN_TIERS[here.tier]
          ? ` title="${escapeHtml(SPAWN_TIERS[here.tier].label + ' : ' + per100(here.groups) + ' groupe' + (here.groups >= 2 ? 's' : '') + ' pour 100 chunks')}"`
          : '';
        return `
          <span class="biome-chip" style="--biome-accent:${color};--i:${i}"${title}>
            <span class="biome-dot" aria-hidden="true"></span>
            ${escapeHtml(OW.biomeName ? OW.biomeName(id) : readableId(id))}
            <small>${isMod ? 'MOD' : (marine ? 'OCÉAN' : 'VANILLA')}</small>
            ${here ? tierBadge(here.tier) : ''}
          </span>`;
      }).join('');
    } else {
      biomes.innerHTML = '<p class="empty-note">Aucune apparition naturelle.</p>';
    }

    $('[data-spawn-note]').textContent = rarity
      ? 'Rareté calculée par le mod : groupes apparus pour 100 chunks dans chaque biome. Celle de la bête est celle de son meilleur biome.'
      : spawn
        ? 'Apparition contrôlée par un modificateur de biome ajouté par le mod.'
        : "Aucune apparition naturelle : la créature est liée à son biome d'arène.";

    /* [intitule, valeur, valeur deja en HTML] */
    const rows = [];
    if (rarity) {
      rows.push(['Rareté', tierBadge(rarity.tier) || DASH, true],
                ['Groupes / 100 chunks', per100(rarity.groups)]);
      if (rarity.individuals != null && Math.abs(rarity.individuals - rarity.groups) > .001) {
        rows.push(['Individus / 100 chunks', per100(rarity.individuals)]);
      }
    }
    if (spawn) {
      rows.push(["Poids d'apparition", spawn.weight],
                ['Taille de groupe', spawn.min === spawn.max ? spawn.min : spawn.min + '–' + spawn.max]);
      if (spawn.chunkOneIn > 1) rows.push(['Chunks tentés', '1 sur ' + spawn.chunkOneIn]);
      rows.push(['Instances par chunk', spawn.perChunk != null ? spawn.perChunk : DASH],
                ['Modificateur', spawn.modifier || DASH]);
    } else if (!rarity) {
      rows.push(['Apparition naturelle', 'Aucune'], ['Invocation', "Structure d'arène"]);
    }

    $('[data-spawn-rows]').innerHTML = rows.map(([key, value, html]) => `
      <div class="row"><dt>${escapeHtml(key)}</dt><dd>${html ? value : escapeHtml(String(value))}</dd></div>`).join('');

    const behaviours = OW.wildBehaviours(entity);

    $('[data-behaviors]').innerHTML = behaviours.length
      ? behaviours.map((text, i) => `
          <span class="wild-row" style="--i:${i}"><i aria-hidden="true"></i>${escapeHtml(text)}</span>`).join('')
      : '<p class="empty-note">Aucun comportement sauvage exporté pour cette créature.</p>';
  }

  /* ===========================================================================
     6 · Journal — la double page
     =========================================================================== */

  function renderJournal(entity) {
    const host = $('[data-journal]');
    if (!entity.lore.length) {
      host.innerHTML = `
        <div class="book">
          <p class="book-empty">Le manuscrit de l'aventurier ne contient pas encore de pages pour ${escapeHtml(entity.name)}.</p>
        </div>`;
      return;
    }

    host.innerHTML = `
      <div class="book">
        <span class="book-spine" aria-hidden="true"></span>
        <div class="book-columns">
          ${entity.lore.map((page, i) => `
            <div class="book-page">
              <span class="book-folio">Page ${i + 1}</span>
              <p>${page.html}</p>
            </div>`).join('')}
        </div>
      </div>`;
  }

  /* ===========================================================================
     7 · Variantes — la tringle
     =========================================================================== */

  function renderVariants(entity, accent, lightbox) {
    /* Seules les variantes naturelles : les SKIN_* de l'export sont les
       cosmetiques payants, plus bas dans la fiche. */
    const natural = entity.variants.filter((v) => !v.cosmetic);
    const host = $('[data-variants]');
    /* Les images a essayer pour une variante : son rendu, et pour celle
       d'origine (DEFAULT) le rendu solo de la bete, qui la montre deja. */
    const renders = (index) => [variantRender(entity.slug, index)]
      .concat(natural[index] && natural[index].name === 'DEFAULT' ? [soloArt(entity.slug)] : []);

    if (!natural.length) {
      host.innerHTML = '<p class="empty-note">Aucune variante naturelle pour cette créature.</p>';
      return;
    }

    /* La penderie des cosmetiques, reprise ici : les variantes pendent a leur
       tringle, on en choisit une et elle passe en scene a cote. */
    host.innerHTML = `
      <div class="vard">
        <div class="vard-stage">
          <span class="vard-frame">
            <span class="vard-img crisp" data-vard-img aria-hidden="true"></span>
          </span>
          <span class="vard-meta">
            <small data-vard-id></small>
            <b data-vard-name></b>
            <em>Tirée au sort à l'apparition de la bête.</em>
            <button type="button" class="btn vard-zoom" data-lightbox-open="variant" data-index="0">
              Agrandir le rendu →
            </button>
          </span>
        </div>

        <div class="vard-rack" data-vrack>
          ${natural.map((variant, index) => `
            <button type="button" class="vhanger${index === 0 ? ' is-current' : ''}"
                    data-variant="${index}" style="--i:${index}">
              <span class="vhanger-hook" aria-hidden="true"></span>
              <span class="vhanger-card">
                <span class="vhanger-figure">
                  <span class="vhanger-img crisp" aria-hidden="true"
                        ${OW.imgAttr(renders(index), { mode: 'bg', empty: 'hide', lazy: true })}></span>
                </span>
                <span class="vhanger-name">${escapeHtml(variant.labelFr || variant.label)}</span>
                <span class="vhanger-foot">Variante ${variant.id}</span>
              </span>
            </button>`).join('')}
        </div>
      </div>`;

    const stage = host.querySelector('[data-vard-img]');
    const zoom = host.querySelector('.vard-zoom');

    function choose(index) {
      const variant = natural[index];
      if (!variant) return;
      host.querySelectorAll('[data-variant]').forEach((b) => {
        b.classList.toggle('is-current', Number(b.dataset.variant) === index);
      });
      host.querySelector('[data-vard-id]').textContent = 'Variante ' + variant.id;
      host.querySelector('[data-vard-name]').textContent = variant.labelFr || variant.label;
      zoom.dataset.index = index;
      /* Le rendu de la variante s'il existe, la vignette de la bete sinon :
         resolveImages() tranche, comme partout ailleurs sur le site. */
      stage.setAttribute('data-img', renders(index).concat(entity.art).join('|'));
      stage.setAttribute('data-img-mode', 'bg');
      stage.removeAttribute('data-img-done');
      if (OW.resolveImages) OW.resolveImages(host);
    }

    host.querySelectorAll('[data-variant]').forEach((btn) => {
      btn.addEventListener('click', () => choose(Number(btn.dataset.variant)));
    });
    choose(0);
    if (OW.resolveImages) OW.resolveImages(host);
    /* Elles pendent a leur tringle, et la souris les pousse. */
    if (OW.swing) OW.swing(host.querySelector('[data-vrack]'), '.vhanger');

    if (lightbox) {
      lightbox.addSet('variant', natural.map((variant, index) => renders(index)));
    }
  }

  /* ===========================================================================
     8 · Butin — le coffre
     =========================================================================== */

  function renderLoot(entity, accent) {
    const host = $('[data-loot]');
    const drops = entity.loot.drops;
    const SLOTS = 9;

    if (drops.length) {
      const cells = [];
      for (let i = 0; i < Math.max(SLOTS, drops.length); i++) {
        const drop = drops[i];
        if (!drop) { cells.push('<span class="chest-slot is-empty" aria-hidden="true"></span>'); continue; }
        cells.push(`
          <a class="chest-slot" href="${escapeHtml(itemHref(drop.id))}" style="--i:${i}"
             title="${escapeHtml(drop.name)} · ${escapeHtml(drop.id)}">
            <span class="chest-img crisp" ${OW.imgAttr(OW.itemCandidates(drop.id), { mode: 'bg' })}></span>
            <span class="chest-count">${drop.min === drop.max ? drop.min : drop.min + '–' + drop.max}</span>
            <span class="chest-chance">${escapeHtml(percent(drop.chance))}</span>
            <span class="chest-tip"><b>${escapeHtml(drop.name)}</b><small>${escapeHtml(percent(drop.chance))} · ${drop.min === drop.max ? drop.min : drop.min + '–' + drop.max}</small></span>
          </a>`);
      }
      const provisional = ((OW.SITE_CONFIG && OW.SITE_CONFIG.placeholders && OW.SITE_CONFIG.placeholders.loot) || []).indexOf(entity.slug) >= 0;
      host.innerHTML = cells.join('')
        + `<span class="chest-note">${escapeHtml(entity.loot.table)}</span>`
        + (provisional ? '<span class="fn-provisional" title="Table de butin reprise d’une autre créature en attendant la sienne.">Butin provisoire</span>' : '');
      if (OW.resolveImages) OW.resolveImages(host);
    } else {
      host.innerHTML = `
        <p class="empty-note">Cette créature ne laisse aucun butin — sa table de butin est vide dans le mod.</p>
        ${entity.loot.table ? `<span class="chest-note">${escapeHtml(entity.loot.table)}</span>` : ''}`;
    }

    /* Les recettes montrent ce qu'on obtient, pas seulement son nom : la case
       du resultat, puis celles des ingredients. */
    const uses = entity.craftingUses.slice(0, 8);
    const usesHost = $('[data-uses]');
    usesHost.innerHTML = uses.length
      ? uses.map((use, i) => `
          <span class="craft-row" style="--i:${i}">
            <a class="craft-out" href="${escapeHtml(itemHref(use.resultId || use.id))}">
              <span class="craft-img crisp" aria-hidden="true"
                    ${OW.imgAttr(OW.itemCandidates(use.resultId || use.result), { mode: 'bg', empty: 'hide' })}></span>
              <b>${escapeHtml(use.result)}</b>
            </a>
            <span class="craft-in">
              ${use.ingredientIds
                ? use.ingredientIds.map((id, k) => `
                    <a class="craft-chip" href="${escapeHtml(itemHref(id))}"
                       title="${escapeHtml(use.ingredients[k] || id)} · voir la fiche">
                      <span class="craft-img crisp" aria-hidden="true"
                            ${OW.imgAttr(OW.itemCandidates(id), { mode: 'bg', empty: 'hide' })}></span>
                      <small>${escapeHtml(use.ingredients[k] || readableId(id))}</small>
                    </a>`).join('')
                : use.ingredients.map((name) => `<span class="craft-chip"><small>${escapeHtml(name)}</small></span>`).join('')}
            </span>
          </span>`).join('')
      : '<p class="empty-note">Aucune recette n\'utilise ses matériaux pour l\'instant.</p>';
    if (OW.resolveImages) OW.resolveImages(usesHost);
  }

  /* ===========================================================================
     9 · Piste Sauvage — le plateau
     =========================================================================== */

  /* Le plateau est le composant partage (js/wild-trail.js) : le meme que dans
     le simulateur, jouable ici aussi. A cote, le resume de l'arbre et ce que la
     planification en cours coute et rapporte. */
  function renderTrail(entity) {
    const host = $('[data-trail]');
    const piste = entity.piste;

    if (!piste.available || !OW.WildTrail) {
      host.innerHTML = `<p class="empty-note">${escapeHtml(entity.name)} n'a pas encore de Piste Sauvage dans le mod.</p>`;
      return;
    }

    const nodes = piste.nodes;
    const byType = {};
    nodes.forEach((n) => { byType[n.type] = (byType[n.type] || 0) + 1; });

    const rows = [
      ['Nœuds', piste.nodeCount],
      ["Gains d'XP", byType.XP || 0],
      ['Gains de pièces', byType.COINS || 0],
      ['Nœuds de capacité', byType.ATTACK || 0],
      ['Coût total', nodes.reduce((sum, n) => sum + n.cost, 0) + ' pièces'],
      ['Niveau requis max', Math.max.apply(null, nodes.map((n) => n.requiredLevel))]
    ];

    host.innerHTML = `
      <div class="board">
        <div class="board-tree" data-board-planner></div>
        <div class="board-side">
          <span class="chap-label">L'arbre</span>
          <dl class="rows">
            ${rows.map(([key, value]) => `<div class="row"><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join('')}
          </dl>
          <span class="chap-label">Plan de progression</span>
          <dl class="rows" data-board-plan></dl>
          <div class="board-passives" data-board-passives></div>
          <a class="btn btn-accent board-cta" href="simulator.html?e=${encodeURIComponent(entity.slug)}#trail">
            Ouvrir dans les Mécaniques →
          </a>
        </div>
      </div>`;

    const planner = OW.WildTrail.create($('[data-board-planner]'), {
      height: 500,
      onChange(sum) {
        if (!sum) return;
        $('[data-board-plan]').innerHTML = [
          ['Nœuds acquis', sum.owned + ' / ' + sum.total],
          ['Pièces dépensées', sum.spent],
          ['Pièces gagnées', sum.coins],
          ['Expérience gagnée', '+' + sum.xp + ' XP']
        ].map(([key, value]) => `<div class="row"><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join('');
        $('[data-board-passives]').innerHTML = sum.attacks.map((a) => `
          <span class="board-passive${a.owned ? ' is-owned' : ''}">
            <span class="crisp" aria-hidden="true" style="${bg('assets/ui/energy.png')}"></span>
            <span><b>${escapeHtml(a.passive ? a.passive.name : a.passives.map((p) => p.name).join(' / '))}</b>
            <small>${a.owned ? 'Passif choisi' : 'Niveau ' + a.node.requiredLevel + ' · ' + a.node.cost + ' pièces'}</small></span>
          </span>`).join('');
      }
    });
    planner.setEntity(entity);
  }

  /* ===========================================================================
     10 · Skins
     =========================================================================== */

  function renderCosmetics(entity) {
    const skins = skinsFor(entity.slug);
    const host = $('[data-cosmetics]');

    if (skins.length) {
      host.innerHTML = skins.map((skin, i) => {
        const rarity = RARITY[skin.rarity];
        const price = OW.skinUnlockLabel(skin);
        return `
          <a class="skin" href="cosmetics.html?skin=${encodeURIComponent(skin.id)}" style="--rarity:${rarity.color};--i:${i}">
            <span class="skin-frame">
              <span class="skin-img crisp" role="img" aria-label="${escapeHtml(skin.name)}" ${OW.imgAttr(OW.skinImages(skin), { mode: 'bg' })}></span>
              ${skin.rarity === 'legendary' ? '<span class="skin-shine" aria-hidden="true"></span>' : ''}
            </span>
            <span class="skin-text">
              <span class="skin-rarity">${escapeHtml(rarity.label)}</span>
              <b>${escapeHtml(skin.name)}</b>
              <small>${skin.price ? `<span class="coin crisp" style="${bg(coinSprite(skin.price))}"></span>` : ''}${escapeHtml(price)}</small>
            </span>
          </a>`;
      }).join('');
    } else if (entity.cosmetics.length) {
      /* L'export connait le cosmetique, mais aucun rendu n'a ete produit. */
      host.innerHTML = entity.cosmetics.map((cosmetic, i) => `
        <div class="skin is-pending" style="--rarity:#B0A5A1;--i:${i}">
          <span class="skin-frame">
            <span class="skin-img crisp" aria-hidden="true" style="${bg('assets/ui/skins.png')}"></span>
          </span>
          <span class="skin-text">
            <span class="skin-rarity">Skin</span>
            <b>${escapeHtml(cosmetic.name.replace(/_/g, ' ').toLowerCase())}</b>
            <small>rendu à venir</small>
          </span>
        </div>`).join('');
    } else {
      host.innerHTML = '<p class="empty-note">Aucun cosmétique pour cette créature.</p>';
    }

    $('[data-texture-note]').textContent =
      entity.textureCount + ' textures livrées pour cette créature.'
      + (skins.length ? ' Chaque carte ouvre la vitrine, où le modèle tourne en 3D.' : '');
  }

  /* ===========================================================================
     11-12 · Sons et animations
     =========================================================================== */

  function renderSounds(entity, data) {
    /* La table de sons vit dans js/soundboard.js : de vrais sons, ecoutables. */
    const host = $('[data-sounds]');
    if (OW.mountSoundboard) {
      OW.mountSoundboard(host, entity, $('[data-sound-note]'), data && data.sounds);
      return;
    }
    host.innerHTML = '<p class="empty-note">Aucun son exporté pour cette créature.</p>';
  }

  /* ---- les apercus animes : le bon nom sur chaque GIF ------------------------------

     Les GIF sont deposes sous des noms neutres (anim_0.gif, anim_1.gif...) :
     rien ne dit quelle animation chacun montre. L'ancien code leur collait une
     etiquette fixe par position (Deplacement, Attaque, Repos, Special), ce qui
     etait faux des qu'on changeait l'ordre — le « Deplacement » du tigre etait
     son repos, son « Attaque » sa marche.

     L'export, lui, donne la duree exacte de chaque animation. On lit donc la
     duree du GIF (la somme des delais de ses images) et on la rapproche de
     celle des animations de la bete : a 4,04 s, le GIF du tigre est MISC_IDLE
     (4,03 s). Un GIF qui enchaine plusieurs fois le meme clip (quatre coups de
     griffe de 1,13 s = 4,52 s) est reconnu comme tel. Deposer un nouveau GIF
     suffit : il est nomme tout seul. */

  const ANIM_LABEL = {
    MISC_IDLE: 'Repos', MISC_IDLE_2: 'Repos — variante', MISC_IDLE_3: 'Repos — variante 2', MISC_PLAY: 'Jeu',
    MOVE_WALK: 'Marche', MOVE_WALK_WITH_ITEM: 'Marche avec un objet', MOVE_RUN: 'Course', MOVE_SWIM: 'Nage',
    ATTACK_STRIKE: 'Combo 1', ATTACK_STRIKE_2: 'Combo 2', ATTACK_STRIKE2: 'Combo 2',
    ATTACK_STRIKE_3: 'Combo 3', ATTACK_STRIKE3: 'Combo 3', ATTACK_SECONDARY: 'Attaque secondaire',
    ATTACK_DEATH_ROLL: 'Roulade mortelle', DEATH_ROLL_WINDUP: 'Préparation de la roulade',
    SIT: 'Assis', NAP: 'Sieste', SLEEP: 'Sommeil', ROAR: 'Rugissement', LEAP: 'Bond', PREPARING_LEAP: 'Préparation du bond',
    SCARIFY: 'Griffures', EARTHQUAKE: 'Séisme', ULTIMATE: 'Ultime', ROLL: 'Roulade', RUBS: 'Frottement',
    SNIFFS: 'Reniflement', REJECTION: 'Refus', STANDING_UP_IDLE: 'Debout', STANDING_UP_WALK: 'Marche debout',
    PAW_SLAM_CHARGE: 'Frappe de patte — charge', PAW_SLAM_CHARGE_FULL: 'Frappe de patte — pleine charge',
    PAW_SLAM_STRIKE: 'Frappe de patte', FEAR: 'Peur', INTIMIDATION: 'Intimidation', SHOULDER_IDLE: "Sur l'épaule",
    TONG: 'Langue', CONSTRICT_BREATH: 'Constriction', WILD_STALK_APPROACH: 'Approche furtive',
    MOUTH_SLAM_HIT: 'Coup de mâchoire', IDLE_WATER_MOUNTED: "Monté, dans l'eau", GRAB_HOLD: 'Prise', GRAB_THRASH: 'Secousse',
    TELLURIC_STOMP_WINDUP: 'Frappe tellurique — élan', TELLURIC_STOMP_LEAP: 'Frappe tellurique — saut',
    TELLURIC_STOMP_HOVER: 'Frappe tellurique — suspension', TELLURIC_STOMP_DIVE: 'Frappe tellurique — piqué',
    TELLURIC_STOMP_LAND: 'Frappe tellurique — impact', DROWN_WINDUP: 'Noyade — élan', DROWN_HOLD: 'Noyade', ALERT_THUMP: 'Alerte',
    SEDATED_FALL: 'Sédation — chute', SEDATED_REST: 'Sédation — sommeil', SEDATED_WAKE: 'Sédation — réveil',
    ALARM: 'Alarme', SHOULDER_BASH_RIGHT: "Coup d'épaule — droite", SHOULDER_BASH_LEFT: "Coup d'épaule — gauche",
    SWIM: 'Nage', FURY_ROAR: 'Furie — rugissement', FURY_ROAR_WATER: "Furie — rugissement dans l'eau",
    FURY_POSE: 'Furie — posture', DIZZY: 'Étourdi', ROLL_TUCK: 'Roulade en boule'
  };

  /* Une transition se lit d'un etat a l'autre : TRANSITION_IDLE_SIT = Repos → Assis. */
  const ANIM_STATE = { IDLE: 'Repos', SIT: 'Assis', NAP: 'Sieste', SLEEP: 'Sommeil', ROAR: 'Rugissement', FEAR: 'Peur', STAND_UP: 'Debout' };
  function animLabel(name) {
    if (ANIM_LABEL[name]) return ANIM_LABEL[name];
    const move = /^TRANSITION_(STAND_UP|[A-Z]+)_(STAND_UP|[A-Z]+)$/.exec(name);
    if (move && ANIM_STATE[move[1]] && ANIM_STATE[move[2]]) return ANIM_STATE[move[1]] + ' → ' + ANIM_STATE[move[2]];
    const clean = String(name).replace(/^TRANSITION_/, '').toLowerCase().replace(/_/g, ' ');
    return /^TRANSITION_/.test(name) ? 'Transition — ' + clean : clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  OW.animLabel = animLabel;

  /** Duree d'un GIF, en secondes : la somme des delais de ses images.
      On suit la structure du fichier bloc par bloc : chercher la signature
      des extensions a l'aveugle en trouve aussi dans les donnees d'image. */
  function gifSeconds(src) {
    /* Mesure d'avance par tools/list-assets.py : sinon, le GIF (jusqu'a 6 Mo)
       etait telecharge une seconde fois, en parallele de son <img>. */
    const known = OW.ASSET_LIST && OW.ASSET_LIST.gifSeconds && OW.ASSET_LIST.gifSeconds[String(src).split(/[?#]/)[0]];
    if (known) return Promise.resolve(known);
    return fetch(src).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((buffer) => {
      const b = new Uint8Array(buffer);
      const skipSubBlocks = (i) => { while (i < b.length && b[i] !== 0) i += b[i] + 1; return i + 1; };
      let i = 13;
      if (b[10] & 0x80) i += 3 * (1 << ((b[10] & 0x07) + 1));
      let total = 0;
      while (i < b.length) {
        const block = b[i];
        if (block === 0x21) {
          if (b[i + 1] === 0xF9) total += b[i + 4] | (b[i + 5] << 8);
          i = skipSubBlocks(i + 2);
        } else if (block === 0x2C) {
          const flags = b[i + 9];
          i += 10;
          if (flags & 0x80) i += 3 * (1 << ((flags & 0x07) + 1));
          i = skipSubBlocks(i + 1);
        } else {
          break;
        }
      }
      return total / 100;
    });
  }

  /* Les animations « de fond » d'abord : a duree egale, un GIF montre plus
     volontiers un repos qu'une transition. */
  const ANIM_RANK = (name) => (/^(MISC|MOVE)_/.test(name) ? 0 : /^ATTACK_STRIKE$/.test(name) ? 1 : /^TRANSITION_/.test(name) ? 3 : 2);

  function matchAnimation(seconds, animations) {
    if (!seconds || !animations.length) return null;
    /* La plus proche l'emporte ; a un centieme pres, le rang departage. */
    function best(times) {
      let hit = null;
      animations.forEach((a) => {
        if (!(a.seconds > 0)) return;
        const diff = Math.abs(seconds - a.seconds * times);
        if (diff > Math.max(.04, a.seconds * times * .02)) return;
        if (!hit || diff < hit.diff - .01 || (Math.abs(diff - hit.diff) <= .01 && ANIM_RANK(a.name) < ANIM_RANK(hit.anim.name))) {
          hit = { anim: a, times, diff };
        }
      });
      return hit;
    }
    for (let k = 1; k <= 5; k++) {
      const hit = best(k);
      if (hit) return hit;
    }
    return null;
  }

  function renderMedia(entity, accent, lightbox) {
    /* Les apercus animes : anim_0.gif, anim_1.gif… autant qu'il y en a dans
       le dossier de la bete (OW.findSeries). Deposer un fichier au nom suivant
       suffit a l'ajouter. */
    const clipHost = $('[data-clips]');
    let clips = [];
    OW.findSeries((i) => `assets/pages/${entity.slug}/anim_${i}.gif`).then((found) => {
      clips = found.map((src) => ({ src }));
      lightbox.setSets({ clip: found });
      if (!clips.length) {
        clipHost.innerHTML = '<p class="empty-note">Aucun aperçu animé livré pour cette créature.</p>';
        return;
      }
      clipHost.innerHTML = clips.map((clip, i) => `
        <button type="button" class="frame" data-lightbox-open="clip" data-index="${i}" style="--i:${i}"
                title="Agrandir">
          <span class="frame-holes" aria-hidden="true"></span>
          <span class="frame-image crisp" aria-hidden="true"
                ${OW.imgAttr([clip.src], { mode: 'bg', lazy: true })}></span>
          <span class="frame-bar"><span data-clip-label="${i}">Animation ${i + 1}</span><em>agrandir</em></span>
        </button>`).join('');

      clipHost.querySelectorAll('[data-clip-label]').forEach((label) => {
        const i = +label.dataset.clipLabel;
        /* Un nom ecrit dans js/assets-config.js (gifs) l'emporte sur la devinette. */
        const gifs = (OW.ASSETS_CONFIG && OW.ASSETS_CONFIG.gifs) || {};
        const named = gifs[clips[i].src.replace(/^assets\/pages\//, '')];
        if (named) {
          label.textContent = named;
          return;
        }
        gifSeconds(clips[i].src).then((seconds) => {
          const hit = matchAnimation(seconds, entity.animations);
          const frame = label.closest('.frame');
          /* Un apercu d'une animation retiree (js/site-config.js) s'en va aussi. */
          if (hit && OW.animationHidden && OW.animationHidden(entity.slug, hit.anim.name) && frame) {
            frame.remove();
            if (!clipHost.querySelector('.frame')) clipHost.innerHTML = '<p class="empty-note">Aucun aperçu animé livré pour cette créature.</p>';
            return;
          }
          if (!hit) {
            label.textContent = 'Animation ' + (i + 1);
            return;
          }
          label.textContent = hit.times > 1 && /^ATTACK/.test(hit.anim.name)
            ? "Combo d'attaques ×" + hit.times
            : animLabel(hit.anim.name) + (hit.times > 1 ? ' ×' + hit.times : '');
          if (frame) frame.title = hit.anim.name + ' · ' + num(hit.anim.seconds, 2) + ' s'
            + (hit.times > 1 ? ' (enchaîné ' + hit.times + ' fois)' : '') + ' — agrandir';
        }).catch(() => { /* hors serveur : on garde le nom generique */ });
      });
    });

    /* La boucle video, la ou il y en a une (aucune pour l'instant). Exemple :
         red_panda: { src: 'assets/ui/red_panda_animation.webm', label: 'Panda roux' } */
    const VIDEOS = {};
    const video = VIDEOS[entity.slug];
    $('[data-video]').innerHTML = video
      ? `<div class="reel">
           <video src="${video.src}" autoplay loop muted playsinline></video>
           <span class="frame-bar">${escapeHtml(video.label)}<em>en jeu</em></span>
         </div>`
      : '';

    /* La scene 3D : le modele du jeu, anime, et chacune de ses animations. */
    if (OW.mountCreatureStage) OW.mountCreatureStage($('[data-stage3d]'), entity.slug, accent);

    /* La galerie de captures : gallery_0.png, gallery_1.png… autant qu'il y
       en a ; la section disparait s'il n'y en a aucune. */
    const section = $('[data-gallery-section]');
    const galleryHost = $('[data-gallery]');
    section.hidden = true;
    OW.findSeries((i) => `assets/pages/${entity.slug}/gallery_${i}.png`).then((shots) => {
      lightbox.setSets({ shot: shots });
      section.hidden = !shots.length;
      galleryHost.innerHTML = shots.map((src, i) => `
        <button type="button" class="shot" data-lightbox-open="shot" data-index="${i}" style="--i:${i}">
          <span class="shot-image" aria-hidden="true" ${OW.imgAttr([src], { mode: 'bg', lazy: true })}></span>
          <span class="shot-bar">Capture ${i + 1} / ${shots.length}</span>
        </button>`).join('');
    });
  }

  function createLightbox() {
    const modal = $('[data-lightbox]');
    const image = $('[data-lightbox-image]');
    const label = $('[data-lightbox-label]');
    let sets = { shot: [], clip: [], variant: [] };
    let kind = 'shot';
    let index = 0;

    const draw = () => {
      const list = sets[kind] || [];
      if (!list.length) return;
      index = (index + list.length) % list.length;
      /* Une entree peut proposer plusieurs images : la suivante prend le
         relais si la premiere manque. */
      const tries = [].concat(list[index]);
      let n = 0;
      image.onerror = () => { n += 1; if (n < tries.length) image.src = tries[n]; else image.onerror = null; };
      image.src = tries[0];
      const word = kind === 'shot' ? 'CAPTURE ' : (kind === 'variant' ? 'VARIANTE ' : 'CLIP ');
      label.textContent = word + (index + 1) + ' / ' + list.length;
    };

    const open = (nextKind, nextIndex) => {
      kind = nextKind;
      index = nextIndex;
      draw();
      modal.hidden = false;
    };

    const close = () => { modal.hidden = true; };

    document.addEventListener('click', (event) => {
      const opener = event.target.closest('[data-lightbox-open]');
      if (opener) {
        open(opener.dataset.lightboxOpen, parseInt(opener.dataset.index, 10));
        return;
      }
      if (event.target.closest('[data-lightbox-close]')) close();
      if (event.target.closest('[data-lightbox-prev]')) { index -= 1; draw(); }
      if (event.target.closest('[data-lightbox-next]')) { index += 1; draw(); }
    });

    window.addEventListener('keydown', (event) => {
      if (modal.hidden) return;
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowLeft') { index -= 1; draw(); }
      if (event.key === 'ArrowRight') { index += 1; draw(); }
    });

    return {
      setSets(next) { sets = Object.assign(sets, next); },
      /* Les variantes s'ajoutent avant les captures : la visionneuse doit
         pouvoir accueillir un jeu de plus sans effacer les autres. */
      addSet(name, list) { sets[name] = list; }
    };
  }

  function initToc() {
    const links = Array.from(document.querySelectorAll('[data-toc-link]'));
    if (!links.length) return;

    const sections = links
      .map((link) => ({ link, section: document.getElementById(link.dataset.tocLink) }))
      .filter((entry) => entry.section);

    /* One observer instead of a requestAnimationFrame loop running forever. */
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const match = sections.find((s) => s.section === entry.target);
        if (match) match.visible = entry.isIntersecting;
      });

      const active = sections.find((s) => s.visible) || sections[0];
      sections.forEach((s) => s.link.classList.toggle('is-active', s === active));

      /* Le bouton du sommaire replie porte le nom du chapitre en cours : c'est
         le seul repere quand la liste est fermee. */
      const current = $('[data-rail-current]');
      const label = active && active.link.querySelector('span');
      if (current && label) current.textContent = label.textContent;
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });

    sections.forEach((entry) => observer.observe(entry.section));
  }

  /* Le sommaire replie : le bouton l'ouvre, un lien ou la touche Echap le
     referme. Au-dessus de 1240 pixels le bouton est cache et la liste reste
     ouverte — la regle CSS s'en occupe, le script n'a rien a savoir. */
  function initRailMenu() {
    const rail = $('[data-rail]');
    const toggle = $('[data-rail-toggle]');
    if (!rail || !toggle) return;

    const close = () => {
      rail.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', () => {
      const open = rail.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    rail.querySelectorAll('[data-toc-link]').forEach((link) => link.addEventListener('click', close));
    document.addEventListener('click', (event) => {
      if (!rail.contains(event.target)) close();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  }

  /* ---- l'echelle de difficulte ---------------------------------------------------
     Huit visages sur une echelle. On en designe un, il monte en scene ; le
     palier de la bete y est marque. Le texte se limite a l'essentiel : le nom,
     les bornes d'XP, une ligne. */

  function buildDifficultyModal(entity, level) {
    const ladder = $('[data-dif-ladder]');
    const stage = $('[data-dif-stage]');
    if (!ladder || !stage) return;

    ladder.innerHTML = DIFFICULTY_SCALE.map((step, i) => `
      <button type="button" class="dif-rung${i === level ? ' is-beast' : ''}" role="tab"
              data-rung="${i}" style="--dif:${step.color};--dif-ink:${strongInk(step.color)};--i:${i}"
              aria-selected="${i === level ? 'true' : 'false'}">
        <span class="dif-rung-face crisp" aria-hidden="true"
              style="${bg('assets/pages/difficulty/' + i + '.png')}"></span>
        <span class="dif-rung-num">${i + 1}</span>
        ${i === level ? '<span class="dif-rung-mark" aria-hidden="true"></span>' : ''}
      </button>`).join('');

    function show(i) {
      const step = DIFFICULTY_SCALE[i];
      stage.style.setProperty('--dif', step.color);
      stage.style.setProperty('--dif-ink', strongInk(step.color));
      stage.innerHTML = `
        <span class="dif-face crisp" aria-hidden="true"
              style="${bg('assets/pages/difficulty/' + i + '.png')}"></span>
        <span class="dif-text">
          <small>Palier ${i + 1} / 8</small>
          <b>${escapeHtml(step.label)}</b>
          <em>${escapeHtml(step.desc)}</em>
          ${i === level ? `<span class="dif-badge">${escapeHtml(entity.name)}</span>` : ''}
        </span>`;
      /* On relance l'entree a chaque changement : c'est ce qui fait sentir le
         passage d'un palier a l'autre. */
      stage.classList.remove('is-in');
      void stage.offsetWidth;
      stage.classList.add('is-in');

      ladder.querySelectorAll('[data-rung]').forEach((b) => {
        const on = Number(b.dataset.rung) === i;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }

    ladder.querySelectorAll('[data-rung]').forEach((btn) => {
      btn.addEventListener('click', () => show(Number(btn.dataset.rung)));
      btn.addEventListener('pointerenter', () => show(Number(btn.dataset.rung)));
    });

    /* Les fleches parcourent l'echelle tant que la fenetre est ouverte. */
    const modal = $('[data-difficulty-modal]');
    let at = level;
    window.addEventListener('keydown', (event) => {
      if (modal.hidden) return;
      const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      at = Math.max(0, Math.min(DIFFICULTY_SCALE.length - 1, at + step));
      show(at);
    });

    show(level);
  }

  function initDifficultyModal() {
    const modal = $('[data-difficulty-modal]');
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-difficulty-open]')) modal.hidden = false;
      if (event.target.closest('[data-modal-close]')) modal.hidden = true;
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') modal.hidden = true;
    });
  }


  /* ===========================================================================
     Le montage
     =========================================================================== */

  mountHeader();
  initDifficultyModal();
  const lightbox = createLightbox();

  loadWikiData()
    .then((data) => {
      if (OW.syncSkins) OW.syncSkins(data);
      const slug = new URLSearchParams(window.location.search).get('e') || 'tiger';
      /* Une adresse qui nomme une bete inconnue (faute de frappe, lien casse) :
         la page introuvable, plutot qu'une autre bete a sa place. */
      /* Un boss garde sa fiche (lien direct), sans compter parmi les creatures. */
      const found = data.entities.find((e) => e.slug === slug) || (data.bosses || []).find((e) => e.slug === slug);
      if (!found && OW.goNotFound && OW.goNotFound('creature')) return;
      const entity = found || data.entities[0];
      if (!entity) throw new Error("Aucune creature publiee dans l'export.");

      const accent = entity.boss ? '#B84A38' : (entity.color || '#F2A32C');
      /* Une espece presque noire (l'orque) ne peut pas servir d'encre sur du
         sombre : on garde sa couleur pour les aplats, et une version eclaircie
         pour le texte et les jauges. */
      const ink = OW.tintFor && /^#[0-9a-f]{6}$/i.test(accent) ? OW.tintFor(accent).onDark : accent;

      document.title = entity.name + ' - Operation W.I.L.D';
      if (OW.crumbs) OW.crumbs([{ label: 'Accueil', href: 'index.html' }, { label: 'Créatures', href: 'creatures.html' }, { label: entity.name }]);
      document.documentElement.style.setProperty('--entity-accent', accent);
      document.documentElement.style.setProperty('--entity-ink', ink);
      /* Toute la fiche porte la couleur de l'espece telle que le mod la
         declare. tintFor() ne sert plus ici : son seuil de petit texte, mesure
         contre la plus claire des surfaces sombres, delavait tout. */
      const strong = strongInk(accent);
      document.documentElement.style.setProperty('--entity-strong', strong);
      document.documentElement.style.setProperty('--entity-ink', strong);
      /* Le theme clair lit ces deux-la : la meme teinte, foncee pour le papier,
         et l'encre de nuit pour les ecrans sombres poses dessus. */
      const day = OW.tintFor && /^#[0-9a-f]{6}$/i.test(accent) ? OW.tintFor(accent).onLight : accent;
      document.documentElement.style.setProperty('--entity-ink-day', day);
      document.documentElement.style.setProperty('--entity-ink-night', strong);
      INK = strong;
      TINT = accent;

      renderIdentity(entity, accent);
      renderTraits(entity, accent);
      renderVitals(entity);
      renderRail(entity, data, accent);
      renderStats(entity, data, accent);
      renderAbilities(entity, accent);
      renderTaming(entity, accent);
      renderSpawn(entity, accent);
      renderJournal(entity);
      renderVariants(entity, accent, lightbox);
      renderLoot(entity, accent);
      renderTrail(entity);
      renderCosmetics(entity);
      renderSounds(entity, data);
      renderMedia(entity, accent, lightbox);
      if (OW.renderFieldNotes) OW.renderFieldNotes(entity, data);

      mountFooter(data, 'VERSION ' + data.meta.version + ' · ' + entity.id.toUpperCase());

      startEmbers(document.querySelector('[data-embers]'), {
        count: 70,
        tint: hexToRgb(accent),
        drift: entity.family === 'aquatic' ? -0.5 : (entity.boss ? -0.7 : -0.2)
      });

      initToc();
      initRailMenu();
      reveal();
    })
    .catch((error) => {
      console.error(error);
      $('[data-name]').textContent = 'Creature introuvable';
      $('[data-tagline]').textContent =
        "Les donnees du mod n'ont pas pu etre chargees. Ce wiki doit etre servi par un serveur HTTP — voir le README.";
    });
}(window.OW = window.OW || {}));
