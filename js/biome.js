/* La fiche d'un biome — biome.html?b=redwood_forest.

   Ce que la fiche d'une creature est a une bete, celle-ci l'est a un biome :
   le decor vivant derriere (le monde des biomes suit la fiche), un panneau de
   sentier a la place de la plaque d'enclos, une carte postale de la capture en
   jeu, puis cinq chapitres, tous tires du JSON :

     01 Habitants            les creatures qui y apparaissent (spawn), leur poids
     02 Flore & blocs        les blocs du biome, dans un inventaire du jeu
     03 Du bloc a l'ouvrage  les recettes du biome, en arbre, et l'etabli
     04 Palette              les couleurs du decor dessine pour ce biome
     05 Fiche technique      identifiants, registre, modificateurs

   Le chapitre 03 ne connait pas le bois : il classe les blocs du biome par
   distance a la matiere premiere, quelle qu'elle soit. Un biome dont l'export
   ne donne aucune recette n'affiche simplement pas le chapitre.

   Ajouter un biome, c'est ajouter une entree a FICHES : le reste suit l'export. */

(function (OW) {
  'use strict';

  const { loadWikiData, escapeHtml, mountHeader, mountFooter, reveal, animalHref, bg } = OW;
  const $ = (sel) => document.querySelector(sel);

  /* ===========================================================================
     Les biomes qui ont une fiche
     =========================================================================== */

  const FICHES = {
    redwood_forest: {
      scene: 'redwood',
      name: 'Forêt de séquoias',
      art: 'assets/biomes/redwood_forest.png',
      accent: '#B5553A',
      /* Le texte du wiki (celui de la page Biomes) : l'export ne donne que les
         identifiants. */
      tagline: 'Troncs de séquoia, sous-bois de buissons à baies et lumière rase. '
        + 'Le kodiak y défend sa pente, le panda roux vit dans la canopée.',
      /* Les blocs du biome : tout ce dont l'identifiant contient ce mot. */
      blockWord: 'redwood',
      /* Les couleurs du biome dans le jeu : OWBiomes.redwoodBiome, specialEffects
         (identiques dans data/ow/worldgen/biome/redwood_forest.json). Le ciel
         est OWBiomeUtils.calculateSkyColor(0.8) = 7907327. */
      effects: {
        sky: '#78A7FF', fog: '#C0D8FF', grass: '#6A7039', foliage: '#8DB127', water: '#3A7A6A', waterFog: '#4D7A60'
      },
      /* Aussi signales par le texte du wiki, sans apparition dans le mod. */
      sightings: ['red_panda'],
      /* La generation (OWOverworldRegion) : dans la region TerraBlender du
         mod (poids 5, contre 10 par defaut pour le jeu de base), ces biomes
         vanilla deviennent le sien. */
      gen: {
        biome: 'ow:redwood_forest',
        replaces: ['minecraft:taiga', 'minecraft:old_growth_pine_taiga', 'minecraft:old_growth_spruce_taiga'],
        modWeight: 5, vanillaWeight: 10
      }
    }
  };
  const SOON = [
    { id: 'mine_field', name: 'Champ de mines', note: "Pas encore assez d'informations dans le mod pour une fiche." }
  ];

  /* ===========================================================================
     Blocs
     =========================================================================== */

  const pathOf = (id) => String(id || '').replace(/^.*:/, '');

  /* Les trois casiers de l'inventaire. `nature` se reconnait au nom du bloc,
     `raw` se deduit des recettes du biome (une matiere qu'on emploie et que
     rien ne fabrique), et le reste est de la construction. Aucun des trois ne
     suppose du bois : un biome mineral se rangerait de la meme facon. */
  const GROUPS = [
    { key: 'nature', label: 'Nature', test: (p) => /leaves|sapling|bush|flower|grass|moss|coral|vine|fungus/.test(p) },
    { key: 'raw', label: 'Matière brute', test: (p, block, ctx) => ctx.raw.has(block.id) },
    { key: 'build', label: 'Construction', test: () => true }
  ];

  const CLASS_LABEL = {
    OWFlammableRotatedPillarBlock: 'Pilier orientable, inflammable',
    LeavesBlock: 'Feuillage',
    SaplingBlock: 'Pousse',
    StairBlock: 'Escalier',
    SlabBlock: 'Dalle',
    PressurePlateBlock: 'Plaque de pression',
    ButtonBlock: 'Bouton',
    FenceBlock: 'Barrière',
    FenceGateBlock: 'Portillon',
    DoorBlock: 'Porte',
    TrapDoorBlock: 'Trappe'
  };

  function blockIconHtml(path, size) {
    const style = 'width:' + size + 'px;height:' + size + 'px';
    if (OW.blockModel && OW.blockModel(path)) {
      return `<span class="bf-bicon crisp" data-block="${escapeHtml(path)}" style="${style}" aria-hidden="true"></span>`;
    }
    const list = (OW.blockCandidates ? OW.blockCandidates(path) : []).concat(
      ['assets/block/' + path + '.png', 'assets/item/' + path + '.png'], OW.itemCandidates ? OW.itemCandidates(path) : []);
    return `<span class="bf-bicon crisp" ${OW.imgAttr(list.filter((u, i) => list.indexOf(u) === i), { mode: 'bg' })} style="${style}" aria-hidden="true"></span>`;
  }

  function paint(root) {
    if (OW.resolveImages) OW.resolveImages(root);
    if (OW.paintBlocks) OW.paintBlocks(root);
  }

  /* ===========================================================================
     Rendu
     =========================================================================== */

  function renderHero(biome, fiche, ctx) {
    document.title = fiche.name + ' - Operation W.I.L.D';
    if (OW.crumbs) OW.crumbs([{ label: 'Accueil', href: 'index.html' }, { label: 'Biomes', href: 'biomes.html' }, { label: fiche.name }]);
    /* 01 · Generation : la mini-carte et ce que dit le code du mod. */
    if (fiche.gen && OW.mountBiomeMap) {
      const genSection = document.querySelector('[data-bf-generation]');
      genSection.hidden = false;
      const names = { 'minecraft:taiga': 'Taïga', 'minecraft:old_growth_pine_taiga': 'Taïga de pins géants', 'minecraft:old_growth_spruce_taiga': 'Taïga d’épicéas géants' };
      document.querySelector('[data-bf-gen-lead]').innerHTML = 'Le biome ne se crée pas de zéro : dans les régions du mod, il <b>remplace</b> '
        + fiche.gen.replaces.map((id) => '<b>' + escapeHtml(names[id] || id) + '</b>').join(', ').replace(/, ([^,]*)$/, ' et $1')
        + '. Ces régions pèsent ' + fiche.gen.modWeight + ' face à ' + fiche.gen.vanillaWeight
        + ' pour celles du jeu de base : environ une taïga sur trois devient une ' + escapeHtml(fiche.name.toLowerCase()) + '.';
      OW.mountBiomeMap(document.querySelector('[data-bf-gen]'), Object.assign({ id: fiche.gen.biome, name: fiche.name, color: fiche.accent }, fiche.gen));
    }
    document.documentElement.style.setProperty('--biome-accent', fiche.accent);
    $('[data-bf-id]').textContent = biome.id;
    $('[data-bf-name]').textContent = fiche.name;
    $('[data-bf-tagline]').textContent = fiche.tagline;
    $('[data-bf-caption]').textContent = fiche.name;
    const photo = $('[data-bf-photo]');
    photo.style.backgroundImage = "url('" + OW.asset(fiche.art) + "')";
    photo.setAttribute('aria-label', fiche.name + ', capture en jeu');

    const chips = [
      ['Biome du mod', 'assets/logo.png'],
      [ctx.dwellers.length + (ctx.dwellers.length > 1 ? ' habitants' : ' habitant'), 'assets/ui/animal.png'],
      [ctx.blocks.length + ' blocs', 'assets/ui/mineral.png'],
      [ctx.recipes.length + ' recettes', 'assets/ui/tools.png']
    ];
    $('[data-bf-chips]').innerHTML = chips.map(([label, icon], i) => `
      <span class="bf-chip" style="--i:${i}"><span class="crisp" style="${bg(icon)}" aria-hidden="true"></span>${escapeHtml(label)}</span>`).join('');

    if (OW.heroSigns) {
      const weight = ctx.dwellers.reduce((s, d) => s + (d.spawn.weight || 0), 0);
      const anchor = document.createElement('span');
      $('[data-bf-signs]').appendChild(anchor);
      OW.heroSigns(anchor, [
        [ctx.dwellers.length, 'Habitants'], [ctx.blocks.length, 'Blocs'],
        [ctx.recipes.length, 'Recettes'], [weight, "Poids d'apparition"]
      ]);
      anchor.remove();
    }
  }

  function renderDwellers(biome, fiche, ctx, data) {
    const host = $('[data-bf-dwellers]');
    const total = ctx.dwellers.reduce((s, e) => s + (e.spawn.weight || 0), 0) || 1;
    const seen = (fiche.sightings || []).map((slug) => data.entities.find((e) => e.slug === slug)).filter(Boolean)
      .filter((e) => ctx.dwellers.indexOf(e) === -1);

    host.innerHTML = `
      <div class="bf-dweller-cards">
        ${ctx.dwellers.map((e) => OW.creatureCard(e)).join('') || '<p class="empty-note">Aucune créature ne s\'y génère naturellement.</p>'}
      </div>
      <div class="bf-dweller-side">
        ${ctx.dwellers.map((e) => {
          const share = Math.round((e.spawn.weight || 0) / total * 100);
          const group = e.spawn.min === e.spawn.max ? e.spawn.min : e.spawn.min + '–' + e.spawn.max;
          return `
            <div class="bf-spawn" style="--c:${escapeHtml(e.color || '#F2A32C')}">
              <div class="bf-spawn-head">
                <span class="crisp bf-spawn-face" style="${bg(e.head)}" aria-hidden="true"></span>
                <span><b>${escapeHtml(e.name)}</b><small>${escapeHtml(e.spawn.modifier || '')}</small></span>
              </div>
              <div class="bf-share">
                <span class="bf-share-bar"><i style="width:${share}%"></i></span>
                <span class="bf-share-num">${share} %</span>
              </div>
              <span class="bf-share-note">des apparitions de créatures du mod dans ce biome</span>
              <dl class="bf-rows">
                <div><dt>Poids d'apparition</dt><dd>${escapeHtml(String(e.spawn.weight))}</dd></div>
                <div><dt>Taille de groupe</dt><dd>${escapeHtml(String(group))}</dd></div>
                <div><dt>Instances par chunk</dt><dd>${escapeHtml(String(e.spawn.perChunk != null ? e.spawn.perChunk : '—'))}</dd></div>
                <div><dt>Autres biomes</dt><dd>${escapeHtml(e.spawn.biomes.filter((b) => b !== biome.id).map(OW.biomeName).join(', ') || 'Aucun')}</dd></div>
              </dl>
              <a class="link-arrow" href="${animalHref(e.slug, 'spawn')}">Territoires de ${escapeHtml(e.name)}</a>
            </div>`;
        }).join('')}
        ${seen.length ? `
          <div class="bf-sighting">
            <span class="t-pixel">AUSSI SIGNALÉ</span>
            ${seen.map((e) => `
              <a class="bf-sighting-row" href="${animalHref(e.slug)}">
                <span class="crisp" style="${bg(e.head)}" aria-hidden="true"></span>
                <span><b>${escapeHtml(e.name)}</b><small>Pas encore d'apparition naturelle dans le mod</small></span>
              </a>`).join('')}
          </div>` : ''}
      </div>`;
    if (OW.mountCreatureCards) OW.mountCreatureCards(host);
  }

  /* ---- l'inventaire des blocs ---------------------------------------------------- */

  let selectedBlock = null;

  function renderFlora(ctx) {
    const groups = GROUPS.map((g) => ({ g, list: [] }));
    ctx.blocks.forEach((b) => {
      const p = pathOf(b.id);
      const slot = groups.find((x) => x.g.test(p, b, ctx));
      slot.list.push(b);
    });
    $('[data-bf-inv]').innerHTML = groups.filter((x) => x.list.length).map((x) => `
      <div class="bf-inv-group">
        <span class="bf-inv-label">${escapeHtml(x.g.label)}<em>${x.list.length}</em></span>
        <div class="bf-inv-grid">
          ${x.list.map((b, i) => `
            <button type="button" class="bf-slot" data-bf-slot="${escapeHtml(b.id)}" style="--i:${i}"
                    aria-pressed="false" title="${escapeHtml(b.name)}" aria-label="${escapeHtml(b.name)}">
              ${blockIconHtml(pathOf(b.id), 40)}
            </button>`).join('')}
        </div>
      </div>`).join('');
    paint($('[data-bf-inv]'));
    /* Le bloc ouvert d'emblee : une matiere premiere du biome, sinon le premier. */
    selectBlock(ctx, ctx.blocks.find((b) => ctx.raw.has(b.id)) || ctx.blocks[0]);
  }

  function selectBlock(ctx, block) {
    if (!block) return;
    selectedBlock = block;
    document.querySelectorAll('[data-bf-slot]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.bfSlot === block.id)));
    const makes = ctx.recipes.filter((r) => r.result === block.id);
    const uses = ctx.recipes.filter((r) => r.ingredients.some((i) => i.id === block.id));
    const path = pathOf(block.id);
    $('[data-bf-block]').innerHTML = `
      <div class="bf-block-card">
        <div class="bf-block-stage">${blockIconHtml(path, 112)}</div>
        <span class="bf-block-kicker">${escapeHtml(CLASS_LABEL[block.className] || block.className || 'Bloc')}</span>
        <h3 class="bf-block-name">${escapeHtml(block.name)}</h3>
        <span class="bf-block-id">${escapeHtml(block.id)}</span>
        <dl class="bf-rows">
          <div><dt>Résistance aux explosions</dt><dd>${escapeHtml(OW.num(block.explosionResistance, 2))}</dd></div>
          <div><dt>Glissance</dt><dd>${escapeHtml(OW.num(block.friction, 2))}</dd></div>
          <div><dt>Obtenu par recette</dt><dd>${makes.length ? makes.length : 'Non'}</dd></div>
          <div><dt>Sert dans</dt><dd>${uses.length} recette${uses.length > 1 ? 's' : ''}</dd></div>
        </dl>
        ${uses.length ? `<div class="bf-block-uses">${uses.map((r) => `
          <button type="button" class="bf-mini" data-bf-recipe="${escapeHtml(r.id)}" title="${escapeHtml(r.resultName)}">
            ${blockIconHtml(pathOf(r.result), 26)}<span>${escapeHtml(r.resultName)}</span>
          </button>`).join('')}</div>` : ''}
        <a class="link-arrow" href="items.html#bloc-${escapeHtml(path)}">Fiche complète dans Objets</a>
      </div>`;
    paint($('[data-bf-block]'));
  }

  /* ---- l'arbre des recettes --------------------------------------------------------- */

  let selectedRecipe = null;

  function renderTree(ctx) {
    /* Trois etages, mesures et non devines : la matiere premiere est ce
       qu'aucune recette du biome ne fabrique, le reste se range a sa distance
       de cette matiere. Aucune regle sur le bois nulle part — un biome de
       pierre, de glace ou de corail se rangerait pareil. */
    const levelOf = {};
    ctx.raw.forEach((id) => { levelOf[id] = 0; });
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 6) {
      changed = false;
      ctx.recipes.forEach((r) => {
        const inside = r.ingredients.map((i) => levelOf[i.id]).filter((v) => v != null);
        if (!inside.length) return;
        const lvl = Math.max.apply(null, inside) + 1;
        if (levelOf[r.result] == null || levelOf[r.result] < lvl) { levelOf[r.result] = lvl; changed = true; }
      });
    }
    const cols = [[], [], []];
    Object.keys(levelOf).forEach((id) => cols[Math.min(2, levelOf[id])].push(id));
    const nameOf = (id) => {
      const b = ctx.blocks.find((x) => x.id === id);
      return b ? b.name : (ctx.nameOf ? ctx.nameOf(id) : pathOf(id));
    };
    const titles = ['Récolter', 'Transformer', 'Construire'];

    $('[data-bf-tree]').innerHTML = `
      <svg class="bf-tree-wires" data-bf-wires aria-hidden="true"></svg>
      ${cols.map((ids, c) => `
        <div class="bf-tree-col">
          <span class="bf-tree-step"><b>${c + 1}</b>${escapeHtml(titles[c])}</span>
          ${ids.map((id, i) => {
            const recipe = ctx.recipes.find((r) => r.result === id);
            return `
              <button type="button" class="bf-node${recipe ? '' : ' is-raw'}" data-bf-node="${escapeHtml(id)}"
                      ${recipe ? `data-bf-recipe="${escapeHtml(recipe.id)}"` : ''} style="--i:${i + c * 3}">
                ${blockIconHtml(pathOf(id), 34)}
                <span class="bf-node-name">${escapeHtml(nameOf(id))}</span>
                ${recipe && recipe.count > 1 ? `<span class="bf-node-count">×${recipe.count}</span>` : ''}
              </button>`;
          }).join('')}
        </div>`).join('')}`;
    paint($('[data-bf-tree]'));
    requestAnimationFrame(() => drawWires(ctx));
    setTimeout(() => drawWires(ctx), 400);
    /* La recette montree d'emblee : la premiere du premier etage fabrique, pour
       ouvrir l'etabli sur le geste le plus simple du biome. */
    const firstMade = cols[1][0] || cols[2][0] || cols[0][0];
    const first = ctx.recipes.find((r) => r.result === firstMade) || ctx.recipes[0];
    if (first) showRecipe(ctx, first.id);
  }

  /* Les fils entre les etages : un trait en escalier par ingredient. */
  function drawWires(ctx) {
    const tree = $('[data-bf-tree]');
    const svg = $('[data-bf-wires]');
    if (!tree || !svg) return;
    const box = tree.getBoundingClientRect();
    svg.setAttribute('viewBox', '0 0 ' + Math.round(box.width) + ' ' + Math.round(box.height));
    const pos = (id) => {
      const el = tree.querySelector('[data-bf-node="' + CSS.escape(id) + '"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { l: r.left - box.left, r: r.right - box.left, y: r.top - box.top + r.height / 2 };
    };
    let html = '';
    ctx.recipes.forEach((recipe) => {
      const to = pos(recipe.result);
      if (!to) return;
      const seen = {};
      recipe.ingredients.forEach((ing) => {
        if (seen[ing.id]) return;
        seen[ing.id] = true;
        const from = pos(ing.id);
        if (!from || from.r >= to.l) return;
        const mid = Math.round((from.r + to.l) / 2);
        html += `<path data-wire-from="${escapeHtml(ing.id)}" data-wire-to="${escapeHtml(recipe.result)}"
          d="M${Math.round(from.r)} ${Math.round(from.y)} H${mid} V${Math.round(to.y)} H${Math.round(to.l)}"/>`;
      });
    });
    svg.innerHTML = html;
    lightWires(selectedRecipe);
  }

  function lightWires(recipeId) {
    const recipe = recipeId && current.ctx.recipes.find((r) => r.id === recipeId);
    document.querySelectorAll('[data-wire-to]').forEach((p) => {
      p.classList.toggle('is-lit', !!recipe && p.dataset.wireTo === recipe.result);
    });
    document.querySelectorAll('[data-bf-node]').forEach((n) => {
      const involved = recipe && (n.dataset.bfNode === recipe.result || recipe.ingredients.some((i) => i.id === n.dataset.bfNode));
      n.classList.toggle('is-lit', !!involved);
      n.classList.toggle('is-current', !!recipe && n.dataset.bfNode === recipe.result);
    });
  }

  function showRecipe(ctx, recipeId) {
    const recipe = ctx.recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    selectedRecipe = recipe.id;
    lightWires(recipe.id);
    const cells = recipe.shaped && recipe.grid ? recipe.grid : recipe.ingredients.concat(new Array(9).fill(null)).slice(0, 9);
    /* La vraie quantite de chaque ingredient (js/wiki-data.js, needs). */
    const tally = {};
    (recipe.needs || recipe.ingredients.map((i) => ({ id: i.id, name: i.name, count: 1 })))
      .forEach((n) => { tally[n.id] = { name: n.name, n: n.count }; });
    $('[data-bf-bench]').innerHTML = `
      <div class="bf-bench-card">
        <div class="bf-bench-title">
          <span class="t-pixel">ÉTABLI</span>
          <b>${escapeHtml(recipe.resultName)}</b>
          <small>${recipe.shaped ? 'Recette façonnée' : 'Recette informe · sans disposition imposée'}</small>
        </div>
        <div class="bf-craft">
          <div class="bf-craft-grid">
            ${cells.map((cell, i) => `<span class="bf-craft-slot" style="--i:${i}">${cell ? blockIconHtml(pathOf(cell.id), 34) : ''}</span>`).join('')}
          </div>
          <span class="bf-craft-arrow" aria-hidden="true">→</span>
          <span class="bf-craft-out">${blockIconHtml(pathOf(recipe.result), 48)}${recipe.count > 1 ? `<b>${recipe.count}</b>` : ''}</span>
        </div>
        <ul class="bf-bench-needs">
          ${Object.keys(tally).map((id) => `<li>${blockIconHtml(pathOf(id), 22)}<span>${escapeHtml(tally[id].name)}</span><b>× ${tally[id].n}</b></li>`).join('')}
        </ul>
      </div>`;
    paint($('[data-bf-bench]'));
  }

  /**
   * Le chapitre 03, ou rien.
   *
   * L'export ne promet pas qu'un biome ait des recettes : la foret de sequoias
   * en a trente-cinq, un biome mineral pourrait n'en avoir aucune. Sans
   * recette, le chapitre et son entree de sommaire s'effacent plutot que
   * d'afficher un arbre vide.
   */
  function renderCrafting(ctx) {
    const chapter = $('[data-bf-crafting]');
    const link = $('[data-bf-link="crafting"]');
    if (!ctx.recipes.length) {
      if (chapter) chapter.hidden = true;
      if (link) link.hidden = true;
      return;
    }
    const lead = $('[data-bf-craft-lead]');
    if (lead) {
      lead.textContent = ctx.recipes.length + ' recettes partent des blocs de ce biome. '
        + 'Le survol suit le fil, le clic ouvre l’établi.';
    }
    renderTree(ctx);
  }

  /* ---- la palette ---------------------------------------------------------------------- */

  const SWATCHES = [
    ['sky', 'Ciel', 'sky_color'],
    ['fog', 'Brouillard', 'fog_color'],
    ['grass', 'Herbe', 'grass_color'],
    ['foliage', 'Feuillage', 'foliage_color'],
    ['water', 'Eau', 'water_color'],
    ['waterFog', 'Eau, en plongée', 'water_fog_color']
  ];

  /* Les couleurs que le jeu applique au biome, telles que le mod les declare.
     Le bandeau montre le ciel qui se fond dans le brouillard a l'horizon. */
  function renderPalette(fiche) {
    const fx = fiche.effects;
    const host = $('[data-bf-palette]');
    if (!fx) { host.closest('section').hidden = true; return; }
    const colors = SWATCHES.filter(([k]) => fx[k]).map(([k, label, key]) => ({ hex: fx[k], label, key }));
    host.innerHTML = `
      <div class="bf-sky" style="background:linear-gradient(180deg, ${fx.sky} 0%, ${fx.sky} 35%, ${fx.fog} 100%)">
        <span class="bf-sky-label">Ciel et horizon</span>
        <div class="bf-sky-stops">
          ${[fx.sky, fx.fog].map((hex) => `<button type="button" class="bf-stop" data-bf-copy="${hex}" style="--sw:${hex}" title="${hex}"><i></i><code>${hex}</code></button>`).join('')}
        </div>
      </div>
      <div class="bf-swatches">
        ${colors.map((c, i) => `
          <button type="button" class="bf-swatch" data-bf-copy="${escapeHtml(c.hex)}" style="--sw:${escapeHtml(c.hex)};--i:${i}" title="${escapeHtml(c.key)}">
            <span class="bf-swatch-chip" aria-hidden="true"></span>
            <span class="bf-swatch-text"><b>${escapeHtml(c.label)}</b><code>${escapeHtml(c.hex.toUpperCase())}</code></span>
          </button>`).join('')}
      </div>
      <p class="t-small bf-palette-note">Valeurs déclarées par le mod pour ce biome. L’herbe et le feuillage sont des teintes : le jeu les applique aux textures grises de l’herbe et des feuilles.</p>`;
  }

  /* ---- fiche technique -------------------------------------------------------------------- */

  function renderTech(biome, fiche, ctx, data) {
    const rows = [
      ['Identifiant', biome.id],
      ['Constante', biome.constant],
      ['Registre', biome.registry],
      ['Modificateurs d\'apparition', ctx.dwellers.map((e) => e.spawn.modifier).filter(Boolean).join(', ') || '—'],
      ['Préfixe des blocs', fiche.blockWord + '_*'],
      ['Commande de localisation', '/locate biome ' + biome.id],
      ['Version du mod', data.meta.version]
    ];
    $('[data-bf-tech]').innerHTML = `
      <dl class="bf-techlist">
        ${rows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd><code>${escapeHtml(v || '—')}</code>
          <button type="button" class="bf-copy" data-bf-copy="${escapeHtml(v || '')}" aria-label="Copier">⧉</button></dd></div>`).join('')}
      </dl>`;

    const others = data.biomes.filter((b) => b.id !== biome.id);
    $('[data-bf-others]').innerHTML = `
      <span class="t-pixel">AUTRES BIOMES DU MOD</span>
      <div class="bf-others-row">
        ${others.map((b) => {
          const key = pathOf(b.id);
          const has = FICHES[key];
          const soon = SOON.find((s) => s.id === key);
          return has
            ? `<a class="bf-other" href="biome.html?b=${encodeURIComponent(key)}"><b>${escapeHtml(has.name)}</b><small>${escapeHtml(b.id)}</small></a>`
            : `<span class="bf-other is-soon"><b>${escapeHtml(soon ? soon.name : OW.biomeName(b.id))}</b><small>${escapeHtml(soon ? soon.note : 'Fiche à venir')}</small><em>Bientôt</em></span>`;
        }).join('')}
      </div>`;
  }

  /* ---- sommaire colle ------------------------------------------------------------------------ */

  function initNav() {
    const nav = $('[data-bf-nav]');
    const bar = $('[data-bf-nav-bar]');
    const links = Array.from(nav.querySelectorAll('[data-bf-link]'));
    const sections = links.map((a) => document.getElementById(a.dataset.bfLink)).filter(Boolean);
    let currentId = null;
    const mark = (id) => {
      if (id === currentId) return;
      currentId = id;
      links.forEach((a) => a.classList.toggle('is-current', a.dataset.bfLink === id));
      const on = links.find((a) => a.dataset.bfLink === id);
      if (on) {
        bar.style.transform = 'translateX(' + on.offsetLeft + 'px)';
        bar.style.width = on.offsetWidth + 'px';
        bar.style.opacity = '1';
        if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: on.offsetLeft - 20, behavior: 'smooth' });
      } else {
        bar.style.opacity = '0';
      }
    };
    if ('IntersectionObserver' in window) {
      const visible = new Map();
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
        const best = sections.filter((s) => visible.get(s.id) > 0)[0];
        mark(best ? best.id : null);
      }, { rootMargin: '-30% 0px -55% 0px', threshold: [0, .01] });
      sections.forEach((s) => io.observe(s));
    }
    nav.addEventListener('click', (event) => {
      const a = event.target.closest('[data-bf-link]');
      if (!a) return;
      event.preventDefault();
      OW.scrollToEl('#' + a.dataset.bfLink);
      history.replaceState(null, '', '#' + a.dataset.bfLink);
    });
    let stuckFrame = 0;
    window.addEventListener('scroll', () => {
      if (stuckFrame) return;
      stuckFrame = requestAnimationFrame(() => {
        stuckFrame = 0;
        nav.classList.toggle('is-stuck', nav.getBoundingClientRect().top <= parseFloat(getComputedStyle(nav).top) + 1);
      });
    }, { passive: true });
  }

  /* ===========================================================================
     Montage
     =========================================================================== */

  const current = { ctx: null };

  mountHeader();

  loadWikiData()
    .then((data) => {
      const key = new URLSearchParams(window.location.search).get('b') || 'redwood_forest';
      /* Un biome inconnu dans l'adresse : la page introuvable. */
      if (!FICHES[key] && OW.goNotFound && OW.goNotFound('biome')) return;
      const fiche = FICHES[key] || FICHES.redwood_forest;
      const biomeKey = FICHES[key] ? key : 'redwood_forest';
      const biome = data.biomes.find((b) => pathOf(b.id) === biomeKey) || { id: 'ow:' + biomeKey, constant: '', registry: '' };

      const blocks = data.blocks.filter((b) => b.name && pathOf(b.id).indexOf(fiche.blockWord) !== -1);
      const ids = new Set(blocks.map((b) => b.id));
      const recipes = data.recipes.filter((r) => ids.has(r.result) || r.ingredients.some((i) => ids.has(i.id)));
      const dwellers = data.entities.filter((e) => e.spawn && e.spawn.biomes.indexOf(biome.id) !== -1);
      /* La matiere premiere du biome : ce que ses recettes consomment sans que
         rien ne le fabrique. Le chapitre 03 et l'inventaire s'en servent tous
         les deux. */
      const produced = new Set(recipes.map((r) => r.result));
      const raw = new Set();
      recipes.forEach((r) => r.ingredients.forEach((i) => { if (ids.has(i.id) && !produced.has(i.id)) raw.add(i.id); }));

      const ctx = { blocks, recipes, dwellers, raw, nameOf: data.nameOf };
      current.ctx = ctx;

      /* Le decor de la fiche, c'est le biome de la fiche — un seul, du haut de
         la page jusqu'au pied (data-biome-only dans biome.html). */
      if (OW.setBiomeRoute) OW.setBiomeRoute([fiche.scene]);

      renderHero(biome, fiche, ctx);
      renderDwellers(biome, fiche, ctx, data);
      renderFlora(ctx);
      renderCrafting(ctx);
      renderPalette(fiche);
      renderTech(biome, fiche, ctx, data);
      initNav();
      mountFooter(data, 'VERSION ' + data.meta.version + ' · ' + biome.id.toUpperCase());
      reveal();

      document.addEventListener('click', (event) => {
        const slot = event.target.closest('[data-bf-slot]');
        if (slot) { selectBlock(ctx, ctx.blocks.find((b) => b.id === slot.dataset.bfSlot)); return; }
        const rec = event.target.closest('[data-bf-recipe]');
        if (rec) {
          showRecipe(ctx, rec.dataset.bfRecipe);
          if (rec.classList.contains('bf-mini')) OW.scrollToEl('#crafting');
          return;
        }
        const copy = event.target.closest('[data-bf-copy]');
        if (copy) {
          const text = copy.dataset.bfCopy;
          const done = () => { if (OW.toast) OW.toast('Copié : ' + text, true); };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
          else done();
        }
      });
      $('[data-bf-tree]').addEventListener('pointerover', (event) => {
        const node = event.target.closest('[data-bf-recipe]');
        if (node) lightWires(node.dataset.bfRecipe);
      });
      $('[data-bf-tree]').addEventListener('pointerleave', () => lightWires(selectedRecipe));
      let resizeTimer = 0;
      window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => drawWires(ctx), 120); }, { passive: true });
    })
    .catch((error) => {
      console.error(error);
      $('[data-bf-name]').textContent = 'Biome introuvable';
    });
}(window.OW = window.OW || {}));
