/* Objets : un inventaire, et la fiche de chaque objet.

   Tout tient dans une fenetre d'inventaire, a la maniere de l'inventaire
   creatif de Minecraft : des onglets par categorie, une recherche, une case
   par objet. Le survol donne l'infobulle du jeu ; le clic ouvre la fiche de
   l'objet, qui rassemble ce que la page repartissait en quatre sections :
   ses statistiques, sa recette posee sur l'etabli, ses materiaux s'il s'agit
   d'une selle, et ce qu'on fabrique avec lui. D'ingredient en ingredient, on
   passe d'une fiche a l'autre.

   Les blocs ont leur propre section, sous l'inventaire : chacun est dessine
   en cube (js/block-icons.js), et range par famille. Un bloc est aussi un
   objet dans les donnees du mod : il n'apparait qu'une fois, cote blocs, et
   sa fiche reunit les deux (rarete, pile, recettes, friction...).

   Liens directs : items.html#jade_sword ouvre une fiche, #bloc-<nom> celle
   d'un bloc, #selles un onglet, #blocs la section des blocs. */

(function (OW) {
  'use strict';

  const { loadWikiData, escapeHtml, mountHeader, mountFooter, reveal, itemSprite, saddleSprite, contrastInk, num, bg, DASH, animalHref } = OW;

  /* La palette de rarete du mod, et la couleur du nom dans l'infobulle du jeu
     (blanc, jaune, cyan, magenta). */
  const RARITY = {
    COMMON: { color: '#8A817C', game: '#FFFFFF', label: 'Commun' },
    UNCOMMON: { color: '#8A9A2E', game: '#FFFF55', label: 'Peu commun' },
    RARE: { color: '#00658B', game: '#55FFFF', label: 'Rare' },
    EPIC: { color: '#B84A38', game: '#FF55FF', label: 'Épique' }
  };
  const rarityOf = (item) => RARITY[item.rarity] || RARITY.COMMON;

  const CATEGORIES = [
    { key: 'all', label: 'Tout', icon: 'assets/ui/tools.png', test: null },
    { key: 'weapons', label: 'Armes', icon: 'jade_sword', test: (p) => /sword|axe|pickaxe|shovel|hoe|dagger|spear|blowpipe|sling|sickle/.test(p) },
    { key: 'armor', label: 'Armures', icon: 'jade_chestplate', test: (p) => /helmet|chestplate|leggings|boots/.test(p) },
    { key: 'materials', label: 'Matériaux', icon: 'jade', test: (p) => /fur|tooth|scale|fiber|jade|ruby|ingot|leather|bone|shell|horn|coat|gland/.test(p) },
    { key: 'saddles', label: 'Selles', icon: 'tiger_saddle', test: (p) => /saddle/.test(p) },
    { key: 'food', label: 'Nourriture', icon: 'raw_tiger', test: (p) => /raw_|cooked_|meat|fish|berry|food/.test(p) },
    { key: 'other', label: 'Divers', icon: 'assets/ui/tab-formulas.png', test: null }
  ];

  /* Les familles de blocs. L'icone est un bloc de la famille, dessine en cube. */
  const FAMILIES = [
    { key: 'all', label: 'Tous', icon: 'redwood_planks', test: null },
    { key: 'ores', label: 'Minerais', icon: 'jade_ore', test: (p) => /_ore$/.test(p) },
    { key: 'redwood', label: 'Séquoia', icon: 'redwood_log', test: (p) => /redwood/.test(p) },
    { key: 'scarified', label: 'Bois scarifiés', icon: 'scarified_oak_log', test: (p) => /^scarified_/.test(p) },
    { key: 'plants', label: 'Plantes', icon: 'lavender', test: (p) => /lavender|camellia|berry_bush/.test(p) },
    { key: 'special', label: 'Spéciaux', icon: 'saddler', test: null }
  ];
  function familyOf(path) {
    for (const f of FAMILIES) if (f.test && f.test(path)) return f.key;
    return 'special';
  }
  const familyLabel = (key) => (FAMILIES.find((f) => f.key === key) || {}).label || '';

  /* Les filtres de l'inventaire, en plus des onglets et de la recherche. */
  const TOGGLES = [
    { key: 'craftable', label: 'Fabricable', test: (e) => !!state.recipesOf[e.id] },
    { key: 'ingredient', label: 'Ingrédient', test: (e) => !!state.usedIn[e.id] },
    { key: 'durable', label: 'Avec durabilité', test: (e) => !!(e.item && e.item.durability) },
    { key: 'fire', label: 'Résiste au feu', test: (e) => !!(e.item && e.item.fireResistant) }
  ];
  const RARITY_KEYS = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC'];
  const SORTS = {
    mod: { label: 'Ordre du mod', compare: null },
    name: { label: 'Nom', compare: (a, b) => a.name.localeCompare(b.name, 'fr') },
    rarity: { label: 'Rareté', compare: (a, b) => (RARITY_KEYS.indexOf(b.item.rarity) - RARITY_KEYS.indexOf(a.item.rarity)) || a.name.localeCompare(b.name, 'fr') }
  };

  const RECIPE_TYPE_LABEL = {
    crafting_shaped: 'Établi · recette façonnée',
    crafting_shapeless: 'Établi · recette informe',
    smelting: 'Four',
    smoking: 'Fumoir',
    campfire_cooking: 'Feu de camp',
    blasting: 'Haut fourneau'
  };

  const state = {
    data: null, tab: 'all', query: '', entries: [], blocks: [], byKey: {}, recipesOf: {}, usedIn: {}, saddleOf: {},
    blockPaths: new Set(), rarity: 'all', toggles: {}, sort: 'mod', family: 'all', blockQuery: ''
  };

  const pathOf = (id) => String(id || '').replace(/^.*:/, '');

  function categoryOf(item) {
    const path = item.path || '';
    for (const category of CATEGORIES) {
      if (category.test && category.test(path)) return category.key;
    }
    return 'other';
  }
  const categoryLabel = (key) => (CATEGORIES.find((c) => c.key === key) || {}).label || '';

  function iconSrc(icon) {
    return /\//.test(icon) ? icon : 'assets/item/' + icon + '.png';
  }

  /* Un sprite d'objet : la premiere image qui existe parmi ses candidats
     (assets/item/<nom>.png d'abord). Tant qu'aucun vrai fichier n'est trouve,
     l'icone de repli s'affiche grisee (voir items.css). */
  function sprite(id, size, extra, more) {
    const style = `width:${size}px;height:${size}px;background-size:contain;background-position:center;background-repeat:no-repeat`;
    const path = pathOf(id);
    /* Un bloc : son cube s'il a un modele, sinon sa texture a plat (plantes)
       ou son image d'objet. */
    if (state.blockPaths.has(path)) {
      if (OW.blockModel && OW.blockModel(path)) {
        return `<span class="crisp item-img block-img${extra ? ' ' + extra : ''}" aria-hidden="true" data-block="${escapeHtml(path)}" style="${style}"></span>`;
      }
      const list = (OW.blockCandidates ? OW.blockCandidates(path) : []).concat(OW.itemCandidates(id));
      return `<span class="crisp item-img block-img${extra ? ' ' + extra : ''}" aria-hidden="true"
        ${OW.imgAttr(list.filter((u, i) => list.indexOf(u) === i), { mode: 'bg' })} style="${style}"></span>`;
    }
    return `<span class="crisp item-img${extra ? ' ' + extra : ''}" aria-hidden="true"
      ${OW.imgAttr(OW.itemCandidates(id), { mode: 'bg' })} ${more || ''} style="${style}"></span>`;
  }
  const resolve = (root) => {
    if (OW.resolveImages) OW.resolveImages(root);
    if (OW.paintBlocks) OW.paintBlocks(root);
  };

  /* ---- index ------------------------------------------------------------------ */

  function buildIndex(data) {
    data.blocks.forEach((block) => state.blockPaths.add(pathOf(block.id)));
    const itemByPath = {};
    data.items.forEach((item) => { itemByPath[item.path] = item; });

    const entries = [];
    data.items.forEach((item) => {
      if (state.blockPaths.has(item.path)) return;
      entries.push({ kind: 'item', key: item.path, id: item.id, name: item.name, item, category: categoryOf(item) });
    });
    const nameByPath = {};
    data.blocks.forEach((block) => { nameByPath[pathOf(block.id)] = block.name; });
    /* L'export n'a pas de nom pour les fleurs en pot : on le compose. */
    const blockName = (path) => {
      if (nameByPath[path]) return nameByPath[path];
      const potted = /^potted_(.+)$/.exec(path);
      if (potted && nameByPath[potted[1]]) return nameByPath[potted[1]] + ' en pot';
      return OW.readableId ? OW.readableId(path) : path;
    };
    const blocks = data.blocks.map((block) => {
      const path = pathOf(block.id);
      return {
        kind: 'block', key: 'bloc-' + path, id: block.id, name: blockName(path), block,
        item: itemByPath[path] || null, category: 'blocks', family: familyOf(path)
      };
    });
    state.entries = entries;
    state.blocks = blocks;
    entries.forEach((e) => { state.byKey[e.key] = e; });
    /* Un bloc repond aussi a son nom d'objet : #redwood_planks, ingredient. */
    blocks.forEach((e) => {
      state.byKey[e.key] = e;
      const path = pathOf(e.id);
      if (!state.byKey[path]) state.byKey[path] = e;
    });

    data.recipes.forEach((recipe, index) => {
      (state.recipesOf[recipe.result] = state.recipesOf[recipe.result] || []).push(index);
      const seen = {};
      recipe.ingredients.forEach((ing) => {
        if (seen[ing.id]) return;
        seen[ing.id] = true;
        (state.usedIn[ing.id] = state.usedIn[ing.id] || []).push(index);
      });
    });

    data.saddles.forEach((saddle) => { state.saddleOf[saddle.result] = saddle; });
  }

  const entryById = (id) => state.byKey[pathOf(id)] || null;

  /* ---- l'inventaire ----------------------------------------------------------- */

  function renderTabs() {
    document.querySelector('[data-inv-tabs]').innerHTML = CATEGORIES.map((c) => {
      const count = c.key === 'all' ? state.entries.length : state.entries.filter((e) => e.category === c.key).length;
      if (!count) return '';
      return `
        <button type="button" class="inv-tab" role="tab" data-tab="${c.key}" aria-selected="${state.tab === c.key}"
                title="${escapeHtml(c.label)}">
          <span class="inv-tab-icon crisp" aria-hidden="true" style="${bg(iconSrc(c.icon))}"></span>
          <span class="inv-tab-label">${escapeHtml(c.label)}</span>
          <span class="inv-tab-count">${count}</span>
        </button>`;
    }).join('');
  }

  function renderFilters() {
    const counts = {};
    RARITY_KEYS.forEach((k) => { counts[k] = state.entries.filter((e) => e.item.rarity === k).length; });
    document.querySelector('[data-inv-filters]').innerHTML = `
      <span class="inv-filter-group" role="group" aria-label="Rareté">
        <button type="button" class="inv-chip" data-rarity="all" aria-pressed="${state.rarity === 'all'}">Toutes</button>
        ${RARITY_KEYS.filter((k) => counts[k]).map((k) => `
          <button type="button" class="inv-chip" data-rarity="${k}" aria-pressed="${state.rarity === k}"
                  style="--chip:${RARITY[k].game}">
            <span class="inv-gem" aria-hidden="true"></span>${escapeHtml(RARITY[k].label)}<small>${counts[k]}</small>
          </button>`).join('')}
      </span>
      <span class="inv-filter-group" role="group" aria-label="Propriétés">
        ${TOGGLES.map((t) => `
          <button type="button" class="inv-chip is-toggle" data-toggle="${t.key}" aria-pressed="${!!state.toggles[t.key]}">
            <span class="inv-check" aria-hidden="true"></span>${escapeHtml(t.label)}
          </button>`).join('')}
      </span>
      <label class="inv-sort">
        <span>Trier</span>
        <select data-inv-sort>
          ${Object.keys(SORTS).map((k) => `<option value="${k}"${state.sort === k ? ' selected' : ''}>${escapeHtml(SORTS[k].label)}</option>`).join('')}
        </select>
      </label>
      <button type="button" class="inv-reset" data-inv-reset hidden>Réinitialiser</button>`;
  }

  const filtersActive = () => state.rarity !== 'all' || TOGGLES.some((t) => state.toggles[t.key]) || state.query.trim() !== '';

  function visibleEntries() {
    const q = state.query.trim().toLowerCase();
    const rows = state.entries.filter((e) => {
      if (state.tab !== 'all' && e.category !== state.tab) return false;
      if (q && !(e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q))) return false;
      if (state.rarity !== 'all' && e.item.rarity !== state.rarity) return false;
      for (const t of TOGGLES) if (state.toggles[t.key] && !t.test(e)) return false;
      return true;
    });
    const compare = SORTS[state.sort].compare;
    return compare ? rows.slice().sort(compare) : rows;
  }

  function renderGrid() {
    const rows = visibleEntries();
    const tab = CATEGORIES.find((c) => c.key === state.tab);
    document.querySelector('[data-inv-title]').textContent =
      (state.query ? 'Recherche' : tab.label) + ' · ' + rows.length;
    const reset = document.querySelector('[data-inv-reset]');
    if (reset) reset.hidden = !filtersActive();

    const grid = document.querySelector('[data-inv-grid]');
    if (!rows.length) {
      grid.innerHTML = '<p class="inv-empty">Aucun objet ne correspond.</p>';
      return;
    }

    /* Au moins cinq rangees pleines : une fenetre d'inventaire a toujours ses
       cases vides, c'est ce qui la rend lisible comme un inventaire. */
    const columns = 9;
    const total = Math.max(columns * 5, Math.ceil(rows.length / columns) * columns);
    let html = '';
    for (let i = 0; i < total; i++) {
      const e = rows[i];
      if (!e) { html += '<span class="inv-slot is-empty" aria-hidden="true"></span>'; continue; }
      const rarity = e.item ? rarityOf(e.item) : RARITY.COMMON;
      const craftable = !!state.recipesOf[e.id];
      html += `
        <button type="button" class="inv-slot${e.item && e.item.rarity !== 'COMMON' ? ' is-rare' : ''}" data-open="${escapeHtml(e.key)}"
                style="--rarity:${rarity.color}" aria-label="${escapeHtml(e.name || String(e.key).replace(/_/g, ' '))}">
          ${sprite(e.id, 40, 'inv-sprite')}
          ${e.item && e.item.stack > 1 ? `<span class="inv-count">${e.item.stack}</span>` : ''}
          ${craftable ? '<span class="inv-craft" aria-hidden="true"></span>' : ''}
        </button>`;
    }
    grid.innerHTML = html;
    resolve(grid);
  }

  /* ---- les blocs ---------------------------------------------------------------- */

  function renderBlockFilters() {
    document.querySelector('[data-blk-filters]').innerHTML = FAMILIES.map((f) => {
      const count = f.key === 'all' ? state.blocks.length : state.blocks.filter((b) => b.family === f.key).length;
      if (!count) return '';
      return `
        <button type="button" class="btn btn-toggle" data-family="${f.key}" aria-pressed="${state.family === f.key}">
          ${sprite(f.icon, 22, 'blk-filter-icon')}
          ${escapeHtml(f.label)}<span class="btn-count">${count}</span>
        </button>`;
    }).join('');
    resolve(document.querySelector('[data-blk-filters]'));
  }

  function renderBlocks() {
    const q = state.blockQuery.trim().toLowerCase();
    const rows = state.blocks.filter((b) =>
      (state.family === 'all' || b.family === state.family)
      && (!q || b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q)));
    const grid = document.querySelector('[data-blk-grid]');
    grid.innerHTML = rows.length
      ? rows.map((b) => {
        const r = b.item ? rarityOf(b.item) : RARITY.COMMON;
        return `
          <button type="button" class="blk-tile" data-open="${escapeHtml(b.key)}" style="--rarity:${r.color};--game:${r.game}"
                  aria-label="${escapeHtml(b.name)}">
            <span class="blk-stage">${sprite(b.id, 64, 'blk-icon')}</span>
            <span class="blk-name">${escapeHtml(b.name)}</span>
            <span class="blk-family">${escapeHtml(familyLabel(b.family))}</span>
          </button>`;
      }).join('')
      : '<p class="inv-empty">Aucun bloc ne correspond.</p>';
    resolve(grid);
  }

  /* L'infobulle du jeu : fond violet-noir, liseré degrade, nom colore par la
     rarete, et quelques lignes grises dessous. */
  function tooltipHtml(e) {
    const lines = [];
    if (e.item) {
      const r = rarityOf(e.item);
      lines.push(`<b style="color:${r.game}">${escapeHtml(e.name)}</b>`);
      lines.push(`<span>${escapeHtml(e.kind === 'block' ? 'Bloc · ' + familyLabel(e.family) : categoryLabel(e.category))} · ${escapeHtml(r.label)}</span>`);
      if (state.saddleOf[e.id]) lines.push(`<span class="tip-blue">Selle · seuil ${state.saddleOf[e.id].threshold} XP</span>`);
      if (e.item.durability) lines.push(`<span>Durabilité : ${e.item.durability}</span>`);
      if (state.recipesOf[e.id]) lines.push('<span class="tip-green">Fabricable</span>');
      if (state.usedIn[e.id]) lines.push(`<span class="tip-green">Ingrédient de ${state.usedIn[e.id].length} recette${state.usedIn[e.id].length > 1 ? 's' : ''}</span>`);
    } else {
      lines.push(`<b style="color:#FFFFFF">${escapeHtml(e.name)}</b>`);
      lines.push('<span>Bloc</span>');
    }
    lines.push(`<small>${escapeHtml(e.id)}</small>`);
    return lines.join('');
  }

  function initTooltip(grid) {
    const tip = document.querySelector('[data-inv-tip]');
    const place = (ev) => {
      const x = Math.min(window.innerWidth - tip.offsetWidth - 12, ev.clientX + 18);
      const y = Math.max(8, ev.clientY - tip.offsetHeight - 14);
      tip.style.transform = `translate(${x}px, ${y}px)`;
    };
    grid.addEventListener('pointerover', (ev) => {
      const slot = ev.target.closest('[data-open]');
      if (!slot) return;
      tip.innerHTML = tooltipHtml(state.byKey[slot.dataset.open]);
      tip.hidden = false;
      place(ev);
    });
    grid.addEventListener('pointermove', (ev) => { if (!tip.hidden) place(ev); });
    grid.addEventListener('pointerout', (ev) => {
      if (!ev.relatedTarget || !ev.relatedTarget.closest || !ev.relatedTarget.closest('[data-open]')) tip.hidden = true;
    });
  }

  /* ---- la fiche --------------------------------------------------------------- */

  function craftGrid(recipe) {
    const cells = recipe.shaped && recipe.grid ? recipe.grid : null;
    let html = '';
    for (let i = 0; i < 9; i++) {
      const cell = cells ? cells[i] : recipe.ingredients[i];
      html += cell
        ? `<button type="button" class="craft-slot is-filled" data-open-id="${escapeHtml(cell.id)}" title="${escapeHtml(cell.name)}">${sprite(cell.id, 34)}</button>`
        : '<span class="craft-slot"></span>';
    }
    return html;
  }

  /* La methode de la recette. Une cuisson qui se fait de plusieurs facons (four,
     fumoir, feu de camp) n'a qu'une fiche : sa note fait defiler les methodes,
     une toutes les deux secondes (cycleNotes). */
  function methodNote(recipe) {
    const methods = recipe.methods && recipe.methods.length ? recipe.methods : [recipe.type];
    const label = (type) => RECIPE_TYPE_LABEL[type] || type;
    const tail = recipe.shaped ? '' : ' · sans disposition imposée';
    if (methods.length < 2) {
      return `<span class="fiche-note">${escapeHtml(label(methods[0]))} · ${escapeHtml(recipe.id)}${tail}</span>`;
    }
    const list = methods.map(label);
    return `<span class="fiche-note"><span class="fiche-method" data-cycle="${escapeHtml(JSON.stringify(list))}">${escapeHtml(list[0])}</span>`
      + ` · ${escapeHtml(methods.length)} cuissons possibles</span>`;
  }
  let cycleTimer = 0;
  function cycleNotes() {
    if (cycleTimer) return;
    cycleTimer = setInterval(() => {
      document.querySelectorAll('[data-cycle]').forEach((el) => {
        let list;
        try { list = JSON.parse(el.dataset.cycle); } catch (e) { return; }
        const at = (Number(el.dataset.at || 0) + 1) % list.length;
        el.dataset.at = String(at);
        el.textContent = list[at];
        el.classList.remove('is-new');
        void el.offsetWidth;
        el.classList.add('is-new');
      });
    }, 2000);
  }

  function recipeBlock(recipe) {
    cycleNotes();
    /* La vraie quantite de chaque ingredient (js/wiki-data.js, needs) :
       6 planches pour une porte, pas 1. */
    const tally = {};
    (recipe.needs || recipe.ingredients.map((ing) => ({ id: ing.id, name: ing.name, count: 1 })))
      .forEach((n) => { tally[n.id] = { name: n.name, count: n.count }; });
    return `
      <div class="fiche-recipe">
        <div class="craft-stage">
          <div class="craft-grid">${craftGrid(recipe)}</div>
          <span class="craft-arrow" aria-hidden="true">→</span>
          <span class="craft-result">
            ${sprite(recipe.result, 52)}
            ${recipe.count > 1 ? `<span class="craft-count">${recipe.count}</span>` : ''}
          </span>
        </div>
        <div class="fiche-needs">
          ${Object.keys(tally).map((id) => `
            <button type="button" class="need-row" data-open-id="${escapeHtml(id)}">
              <span class="need-row-name">${sprite(id, 24)}<span>${escapeHtml(tally[id].name)}</span></span>
              <b>× ${tally[id].count}</b>
            </button>`).join('')}
          ${methodNote(recipe)}
        </div>
      </div>`;
  }

  function saddleBlock(saddle) {
    const entity = state.data.entities.find((e) => e.id === saddle.entityId);
    const render = saddleSprite(saddle.id);
    const accent = saddle.accent || 'var(--accent)';
    return `
      <section class="fiche-section">
        <h3 class="fiche-h">La selle</h3>
        <div class="fiche-saddle" style="--accent-line:${escapeHtml(accent)}">
          <span class="fiche-saddle-stage">
            ${render ? `<img class="crisp" src="${OW.asset(render)}" alt="" loading="lazy">` : '<span class="fiche-note">RENDU À VENIR</span>'}
          </span>
          <span class="fiche-saddle-info">
            ${entity ? `<a class="fiche-creature" href="${animalHref(entity.slug)}">
              <span class="crisp" aria-hidden="true" style="${bg(entity.head)}"></span>${escapeHtml(entity.name)} →</a>` : ''}
            <span class="fiche-chip">SEUIL ${saddle.threshold} XP</span>
            <span class="fiche-note">MATÉRIAUX</span>
            ${saddle.needs.map((need) => `
              <button type="button" class="need-row" data-open-id="${escapeHtml(need.iconId)}">
                <span class="need-row-name">${sprite(need.iconId, 24, '', OW.cycleAttr(need.iconIds, (need.colorSlot || 0) * 8))}<span>${escapeHtml(need.name)}</span></span>
                <b>× ${need.count}</b>
              </button>`).join('')}
          </span>
        </div>
      </section>`;
  }

  function openFiche(key) {
    const e = state.byKey[key];
    if (!e) return;
    const card = document.querySelector('[data-fiche]');
    const r = e.item ? rarityOf(e.item) : RARITY.COMMON;

    const stats = e.kind === 'block'
      ? [['Pile max', e.item ? e.item.stack : DASH], ['Friction', num(e.block.friction, 2)],
        ['Résistance', num(e.block.explosionResistance, 2)]]
      : [['Pile max', e.item.stack], ['Durabilité', e.item.durability || DASH],
        ['Résiste au feu', e.item.fireResistant ? 'Oui' : 'Non']];

    const recipes = (state.recipesOf[e.id] || []).map((i) => state.data.recipes[i]);
    const uses = (state.usedIn[e.id] || []).map((i) => state.data.recipes[i]);
    const saddle = state.saddleOf[e.id];

    card.style.setProperty('--rarity', r.color);
    document.querySelector('[data-fiche-body]').innerHTML = `
      <header class="fiche-head">
        <span class="fiche-slot">${sprite(e.id, 72)}</span>
        <span class="fiche-titles">
          <span class="fiche-kicker">${escapeHtml((e.kind === 'block' ? 'Bloc · ' + familyLabel(e.family) : categoryLabel(e.category)).toUpperCase())}</span>
          <h2 class="fiche-name" id="fiche-title" style="--game:${r.game}">${escapeHtml(e.name)}</h2>
          <span class="fiche-tags">
            ${e.item ? `<span class="rarity-chip" style="--rarity:${r.color};--rarity-ink:${contrastInk(r.color)}">${escapeHtml(e.item.rarity)}</span>` : ''}
            <span class="fiche-id">${escapeHtml(e.id)}</span>
          </span>
        </span>
      </header>

      <div class="fiche-stats">
        ${stats.map(([k, v]) => `<span class="fiche-stat"><b>${escapeHtml(String(v))}</b><small>${escapeHtml(k)}</small></span>`).join('')}
      </div>

      ${saddle ? saddleBlock(saddle) : ''}

      <section class="fiche-section">
        <h3 class="fiche-h">${recipes.length > 1 ? 'Recettes' : 'Recette'}</h3>
        ${recipes.length
          ? recipes.map(recipeBlock).join('')
          : `<p class="fiche-empty">${e.kind === 'block'
            ? 'Pas de recette : ce bloc se trouve dans le monde (génération, butin).'
            : "Pas de recette : cet objet s'obtient autrement (butin, créature, coffre)."}</p>`}
      </section>

      ${uses.length ? `
      <section class="fiche-section">
        <h3 class="fiche-h">Sert à fabriquer</h3>
        <div class="fiche-uses">
          ${uses.map((recipe) => `
            <button type="button" class="fiche-use" data-open-id="${escapeHtml(recipe.result)}" title="${escapeHtml(recipe.resultName)}">
              <span class="inv-slot">${sprite(recipe.result, 36)}</span>
              <span>${escapeHtml(recipe.resultName)}</span>
            </button>`).join('')}
        </div>
      </section>` : ''}`;

    resolve(document.querySelector('[data-fiche-body]'));
    const modal = document.querySelector('[data-item-modal]');
    modal.hidden = false;
    card.scrollTop = 0;
    card.classList.remove('is-in'); void card.offsetWidth; card.classList.add('is-in');
    if (location.hash.slice(1) !== key) history.replaceState(null, '', '#' + key);
  }

  function closeFiche() {
    document.querySelector('[data-item-modal]').hidden = true;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }

  /* ---- liens directs ------------------------------------------------------------- */

  function followHash() {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (!hash) return;
    if (hash === 'blocs' || hash === 'blocks') {
      OW.scrollToEl('#blocs', 'auto');
      return;
    }
    const tabAlias = { selles: 'saddles', saddles: 'saddles' };
    if (tabAlias[hash]) {
      state.tab = tabAlias[hash];
      renderTabs();
      renderGrid();
      OW.scrollToEl('[data-inv]', 'auto');
      return;
    }
    if (state.byKey[hash]) openFiche(hash);
  }

  /* ---- amorcage --------------------------------------------------------------------- */

  mountHeader();

  loadWikiData()
    .then((data) => {
      state.data = data;
      buildIndex(data);

      document.querySelector('[data-intro]').textContent =
        `${state.entries.length} objets, ${data.recipes.length} recettes, ${data.saddles.length} selles `
        + `et ${data.blocks.length} blocs.`;
      if (OW.heroSigns) {
        OW.heroSigns(document.querySelector('[data-intro]'), [
          [state.entries.length, 'Objets'], [data.recipes.length, 'Recettes'],
          [data.saddles.length, 'Selles'], [data.blocks.length, 'Blocs']
        ]);
      }

      /* Onglet, tri, rarete et recherche vivent dans l'adresse : un retour
         depuis une fiche rouvre exactement la meme vue. */
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab')) state.tab = params.get('tab');
      if (params.get('sort') && SORTS[params.get('sort')]) state.sort = params.get('sort');
      if (params.get('rarity')) state.rarity = params.get('rarity');
      if (params.get('q')) state.query = params.get('q');
      const syncUrl = () => {
        const url = new URL(window.location.href);
        const put = (k, v, def) => { if (v && v !== def) url.searchParams.set(k, v); else url.searchParams.delete(k); };
        put('tab', state.tab, 'all');
        put('sort', state.sort, Object.keys(SORTS)[0]);
        put('rarity', state.rarity, 'all');
        put('q', state.query, '');
        history.replaceState(history.state, '', url);
      };

      renderTabs();
      renderFilters();
      renderGrid();
      renderBlockFilters();
      if (state.query) document.querySelector('[data-inv-search]').value = state.query;
      renderBlocks();
      initTooltip(document.querySelector('[data-inv-grid]'));
      initTooltip(document.querySelector('[data-blk-grid]'));
      mountFooter(data, 'VERSION ' + data.meta.version + ' · ' + data.items.length + ' OBJETS');
      reveal();
      followHash();
      window.addEventListener('hashchange', followHash);

      document.querySelector('[data-inv-search]').addEventListener('input', (ev) => {
        state.query = ev.target.value;
        renderGrid();
        syncUrl();
      });
      document.querySelector('[data-blk-search]').addEventListener('input', (ev) => {
        state.blockQuery = ev.target.value;
        renderBlocks();
      });
      document.querySelector('[data-inv-filters]').addEventListener('change', (ev) => {
        if (!ev.target.matches('[data-inv-sort]')) return;
        state.sort = ev.target.value;
        renderGrid();
        syncUrl();
      });

      document.addEventListener('click', (event) => {
        const tab = event.target.closest('[data-tab]');
        if (tab) {
          state.tab = tab.dataset.tab;
          document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
          renderGrid();
          syncUrl();
          return;
        }
        const rarity = event.target.closest('[data-rarity]');
        if (rarity) {
          state.rarity = rarity.dataset.rarity;
          document.querySelectorAll('[data-rarity]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rarity === state.rarity)));
          renderGrid();
          syncUrl();
          return;
        }
        const toggle = event.target.closest('[data-toggle]');
        if (toggle) {
          state.toggles[toggle.dataset.toggle] = !state.toggles[toggle.dataset.toggle];
          toggle.setAttribute('aria-pressed', String(state.toggles[toggle.dataset.toggle]));
          renderGrid();
          return;
        }
        if (event.target.closest('[data-inv-reset]')) {
          state.rarity = 'all';
          state.toggles = {};
          state.query = '';
          document.querySelector('[data-inv-search]').value = '';
          renderFilters();
          renderGrid();
          return;
        }
        const family = event.target.closest('[data-family]');
        if (family) {
          state.family = family.dataset.family;
          document.querySelectorAll('[data-family]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.family === state.family)));
          renderBlocks();
          return;
        }
        const open = event.target.closest('[data-open]');
        if (open) { document.querySelector('[data-inv-tip]').hidden = true; openFiche(open.dataset.open); return; }
        const openId = event.target.closest('[data-open-id]');
        if (openId) {
          const target = entryById(openId.dataset.openId);
          if (target) openFiche(target.key);
          return;
        }
        if (event.target.closest('[data-fiche-close]')) closeFiche();
      });

      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !document.querySelector('[data-item-modal]').hidden) closeFiche();
      });
    })
    .catch((error) => {
      console.error(error);
      document.querySelector('[data-inv-grid]').innerHTML =
        '<p class="inv-empty">Les données du mod n\'ont pas pu être chargées. '
        + 'Ce wiki doit être servi par un serveur HTTP — voir le README.</p>';
    });
}(window.OW = window.OW || {}));
