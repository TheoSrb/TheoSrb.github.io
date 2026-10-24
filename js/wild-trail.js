/* La Piste Sauvage — un seul composant pour tout le wiki.

   Le rendu reprend l'ecran du jeu : un panneau gris d'inventaire Minecraft,
   titre en tete, pourcentage de completion a droite, solde en bas ; dedans,
   un plateau de mousse sombre ou les liens gris deviennent vert vif une fois
   acquis. Un noeud disponible porte un cadre dore, un noeud acquis un cadre
   vert, et un noeud que le niveau de la bete ne permet pas encore d'atteindre
   reste un « ? ».

   Regles du jeu appliquees, strictement :
     - un noeud ne s'achete que si le noeud qui y mene est deja acquis (tous
       les noeuds qui y menent, pour requires_all) et si le niveau est atteint ;
     - on ne saute pas d'etape : cliquer un noeud lointain ne l'achete pas ;
     - un embranchement exclusif n'ouvre qu'une branche ;
     - un achat est definitif : il n'y a pas de revente, seulement
       « Reinitialiser » pour repartir de zero.

   Le reste tient de l'outil : une echelle commune a toutes les betes, une
   fenetre de hauteur fixe qui se parcourt (molette, glisser, mini-carte), une
   passe anti-chevauchement, et un SVG construit une seule fois par bete — un
   achat ne change que des classes, rien ne clignote. */

(function (OW) {
  'use strict';

  const esc = (v) => (OW.escapeHtml ? OW.escapeHtml(v) : String(v));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===========================================================================
     Vocabulaire
     =========================================================================== */

  const TYPE = {
    START: { label: 'Départ', color: '#F7F4EC', size: 40 },
    STEP: { label: 'Palier', color: '#8B8B8B', size: 20 },
    XP: { label: 'Expérience', color: '#7FD13B', size: 36, icon: 'assets/ui/exp/exp.png' },
    COINS: { label: 'Pièces', color: '#F2A32C', size: 36, icon: 'assets/ui/coins/coin_1.png' },
    ATTACK: { label: 'Capacité', color: '#B84A38', size: 40, icon: 'assets/ui/energy.png' }
  };
  const TYPE_ORDER = ['START', 'STEP', 'XP', 'COINS', 'ATTACK'];

  /* L'icone grossit avec la recompense, comme dans le jeu : une bille
     d'experience, puis deux, trois, un tas ; une piece, puis une pile. */
  function xpIcon(reward) {
    if (reward >= 150) return 'assets/ui/exp/exp_4.png';
    if (reward >= 85) return 'assets/ui/exp/exp_3.png';
    if (reward >= 55) return 'assets/ui/exp/exp_2.png';
    return 'assets/ui/exp/exp.png';
  }
  function coinIcon(reward) {
    if (reward >= 10) return 'assets/ui/coins/coin_3.png';
    if (reward >= 6) return 'assets/ui/coins/coin_2.png';
    if (reward >= 4) return 'assets/ui/coins/coin_1.png';
    return 'assets/ui/coins/coin_0.png';
  }

  /* Pixels par unite de l'export, au zoom 1. La meme pour toutes les betes :
     un noeud a la meme taille sur toutes les pistes. */
  const UNIT = 1.75;
  const PAD = 64;
  const GAP = 8;
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 1.7;
  const DEFAULT_LEVEL = 1;

  /* ===========================================================================
     Le fond du plateau : une mousse sombre en gros pixels, generee une fois
     =========================================================================== */

  let noiseUrl = null;
  function boardNoise() {
    if (noiseUrl) return noiseUrl;
    try {
      const size = 32;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      let seed = 1337;
      const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      const tones = ['#18230F', '#1B2811', '#1E2C13', '#213016', '#172010', '#243418'];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          ctx.fillStyle = tones[Math.floor(rand() * rand() * tones.length * 1.6) % tones.length];
          ctx.fillRect(x, y, 1, 1);
        }
      }
      noiseUrl = canvas.toDataURL('image/png');
    } catch (e) {
      noiseUrl = '';
    }
    return noiseUrl;
  }

  /* ===========================================================================
     Modele
     =========================================================================== */

  function indexOf(piste) {
    const byId = {};
    const parents = {};
    piste.nodes.forEach((n) => { byId[n.id] = n; });
    piste.nodes.forEach((n) => (n.children || []).forEach((c) => {
      if (!byId[c]) return;
      (parents[c] = parents[c] || []).push(n.id);
    }));
    return { byId, parents };
  }

  /* Ecarte les noeuds dont les cadres se touchent, en poussant chaque paire le
     long de l'axe ou elle se recouvre le moins : la silhouette reste celle de
     l'export, seuls les voisins trop serres prennent l'air. */
  function relax(points) {
    for (let iter = 0; iter < 80; iter++) {
      let moved = false;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i], b = points[j];
          const need = a.r + b.r + GAP;
          const dx = b.x - a.x, dy = b.y - a.y;
          if (Math.abs(dx) >= need || Math.abs(dy) >= need) continue;
          const ox = need - Math.abs(dx), oy = need - Math.abs(dy);
          if (ox <= oy) {
            const s = (dx === 0 ? (i % 2 ? -1 : 1) : Math.sign(dx)) * ox / 2;
            a.x -= s; b.x += s;
          } else {
            const s = (dy === 0 ? (i % 2 ? -1 : 1) : Math.sign(dy)) * oy / 2;
            a.y -= s; b.y += s;
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  /* Place les colonnes (ou les lignes) de l'export en gardant leurs ecarts,
     sauf quand deux colonnes voisines portent des noeuds qui se
     chevaucheraient : on les ecarte juste assez. Deux noeuds qui partagent
     une abscisse dans l'export la partagent toujours a l'ecran, si bien que
     les liens restent droits, comme dans le jeu. */
  function axisMap(nodes, key, other) {
    const values = Array.from(new Set(nodes.map((n) => n[key]))).sort((a, b) => a - b);
    const byValue = {};
    nodes.forEach((n) => { (byValue[n[key]] = byValue[n[key]] || []).push(n); });
    const map = {};
    let pos = 0;
    values.forEach((v, i) => {
      if (i) {
        const prev = values[i - 1];
        let need = (v - prev) * UNIT;
        byValue[prev].forEach((a) => byValue[v].forEach((b) => {
          const ra = (TYPE[a.type] || TYPE.STEP).size / 2;
          const rb = (TYPE[b.type] || TYPE.STEP).size / 2;
          if (Math.abs(a[other] - b[other]) * UNIT < ra + rb + GAP) need = Math.max(need, ra + rb + GAP);
        }));
        pos += need;
      }
      map[v] = pos;
    });
    return map;
  }

  function layout(piste) {
    const nodes = piste.nodes;
    const mx = axisMap(nodes, 'x', 'y');
    const my = axisMap(nodes, 'y', 'x');
    const points = nodes.map((n) => ({
      id: n.id,
      x: mx[n.x],
      y: my[n.y],
      r: (TYPE[n.type] || TYPE.STEP).size / 2
    }));
    /* Filet de securite : s'il reste un chevauchement, on l'ecarte. */
    relax(points);
    const x0 = Math.min.apply(null, points.map((p) => p.x - p.r));
    const y0 = Math.min.apply(null, points.map((p) => p.y - p.r));
    const pos = {};
    /* Les positions sont arrondies au pixel : des cadres a cheval sur deux
       pixels baveraient, et tout l'ecran du jeu est au pixel pres. */
    points.forEach((p) => { pos[p.id] = { x: Math.round(p.x - x0 + PAD), y: Math.round(p.y - y0 + PAD), r: p.r }; });
    const w = Math.max.apply(null, points.map((p) => p.x - x0 + p.r)) + PAD * 2;
    const h = Math.max.apply(null, points.map((p) => p.y - y0 + p.r)) + PAD * 2;
    return { pos, w: Math.ceil(w), h: Math.ceil(h) };
  }

  /* ===========================================================================
     Le composant
     =========================================================================== */

  /* Les plans se gardent par bete, le temps de la visite : changer de bete et
     revenir retrouve la piste telle qu'on l'avait laissee. */
  const plans = {};

  function create(host, opts) {
    const options = Object.assign({ height: 540, levelControl: true, onChange: null }, opts || {});
    const ui = {};
    let entity = null;
    let piste = null;
    let idx = null;
    let geo = null;
    let plan = null;
    let zoom = 1;
    let busy = false;
    let hoverId = null;
    let chooser = null;

    host.classList.add('wt');
    host.style.setProperty('--wt-h', options.height + 'px');
    host.innerHTML = `
      <div class="wt-toolbar">
        ${options.levelControl ? `
          <label class="wt-level">
            <span class="wt-level-label">NIVEAU</span>
            <output class="wt-level-out" data-wt-level-out>${DEFAULT_LEVEL}</output>
            <span class="wt-level-track">
              <span class="wt-level-fill" data-wt-level-fill></span>
              <input type="range" min="1" max="50" step="1" value="${DEFAULT_LEVEL}" data-wt-level aria-label="Niveau de la créature">
            </span>
            <span class="wt-level-max">/ <span data-wt-level-max>50</span></span>
          </label>` : ''}
        <span class="wt-tools">
          <button type="button" class="wt-btn wt-btn-accent" data-wt-all>Tout débloquer</button>
          <button type="button" class="wt-btn" data-wt-reset>Réinitialiser</button>
          <span class="wt-sep" aria-hidden="true"></span>
          <button type="button" class="wt-icon" data-wt-zoom="out" aria-label="Dézoomer" title="Dézoomer">−</button>
          <button type="button" class="wt-icon" data-wt-zoom="fit" aria-label="Voir tout l'arbre" title="Voir tout l'arbre">⤢</button>
          <button type="button" class="wt-icon" data-wt-zoom="in" aria-label="Zoomer" title="Zoomer">+</button>
        </span>
      </div>
      <div class="wt-gui">
        <div class="wt-gui-head">
          <span class="wt-gui-title">La Piste Sauvage</span>
          <span class="wt-gui-pct" data-wt-pct>0%</span>
        </div>
        <div class="wt-frame">
          <div class="wt-viewport" data-wt-viewport tabindex="-1">
            <div class="wt-stage" data-wt-stage></div>
          </div>
          <div class="wt-minimap" data-wt-minimap hidden></div>
          <div class="wt-hint" data-wt-hint hidden>Glisser pour explorer · Ctrl + molette pour zoomer</div>
          <div class="wt-tip" data-wt-tip role="tooltip" hidden></div>
          <div class="wt-choose" data-wt-choose hidden></div>
          <p class="wt-empty" data-wt-empty hidden></p>
        </div>
        <div class="wt-gui-foot">
          <span class="wt-gui-count" data-wt-count></span>
          <span class="wt-gui-balance" data-wt-spent></span>
        </div>
      </div>
      <div class="wt-legend" data-wt-legend></div>`;

    const $ = (sel) => host.querySelector(sel);
    ui.viewport = $('[data-wt-viewport]');
    ui.stage = $('[data-wt-stage]');
    ui.tip = $('[data-wt-tip]');
    ui.choose = $('[data-wt-choose]');
    ui.minimap = $('[data-wt-minimap]');
    ui.hint = $('[data-wt-hint]');
    ui.empty = $('[data-wt-empty]');
    ui.frame = $('.wt-frame');
    ui.level = $('[data-wt-level]');

    const noise = boardNoise();
    if (noise) ui.frame.style.setProperty('--wt-noise', "url('" + noise + "')");

    /* ---- etat d'un noeud ------------------------------------------------------ */

    const owned = (id) => plan.owned.has(id);

    /** Le parent exclusif qui ferme ce noeud, s'il y en a un. */
    function forkBlock(id) {
      const ps = idx.parents[id] || [];
      for (let i = 0; i < ps.length; i++) {
        const p = idx.byId[ps[i]];
        if (!p.exclusiveFork) continue;
        const taken = p.children.some((c) => c !== id && owned(c));
        if (taken) return p;
      }
      return null;
    }

    function nodeState(n) {
      if (owned(n.id)) return { key: 'owned', why: 'Acquis' };
      if (n.type === 'START') return { key: 'buyable', why: 'Point de départ' };
      const req = idx.parents[n.id] || [];
      const held = req.filter(owned);
      const linked = n.requiresAll ? held.length === req.length : held.length > 0;
      if (!linked) {
        return {
          key: 'locked',
          why: n.requiresAll
            ? 'Requiert d\'abord les ' + req.length + ' nœuds qui y mènent'
            : 'Requiert d\'abord le nœud qui y mène'
        };
      }
      if (forkBlock(n.id)) return { key: 'locked', why: 'Embranchement exclusif : une autre branche est prise' };
      if (n.requiredLevel > plan.level) return { key: 'level', why: 'Niveau ' + n.requiredLevel + ' requis' };
      return { key: 'buyable', why: n.cost ? n.cost + ' pièces' : 'Gratuit' };
    }

    /** Un noeud que le niveau de la bete ne permet pas encore : un « ? ». */
    const mystery = (n) => !owned(n.id) && n.type !== 'START' && n.type !== 'STEP' && n.requiredLevel > plan.level;

    function prune(set) {
      const kept = new Set();
      const queue = piste.nodes.filter((n) => n.type === 'START' && set.has(n.id)).map((n) => n.id);
      while (queue.length) {
        const id = queue.shift();
        if (kept.has(id)) continue;
        kept.add(id);
        (idx.byId[id].children || []).forEach((c) => {
          if (!set.has(c) || kept.has(c) || !idx.byId[c]) return;
          const child = idx.byId[c];
          const req = idx.parents[c] || [];
          if (child.requiresAll && !req.every((p) => set.has(p) && (kept.has(p) || queue.indexOf(p) !== -1))) return;
          queue.push(c);
        });
      }
      return kept;
    }

    function maxLevel() {
      return piste.nodes.reduce((m, n) => Math.max(m, n.requiredLevel || 0), 1);
    }

    /* ---- rendu ------------------------------------------------------------------ */

    function nodeIcon(n) {
      if (n.type === 'START') return entity.head;
      if (n.type === 'XP') return xpIcon(n.reward || 0);
      if (n.type === 'COINS') return coinIcon(n.reward || 0);
      return (TYPE[n.type] || {}).icon || null;
    }

    function nodeSvg(n) {
      const t = TYPE[n.type] || TYPE.STEP;
      const p = geo.pos[n.id];
      const s = t.size;
      const icon = nodeIcon(n);
      const step = n.type === 'STEP';
      const inset = step ? 0 : 6;
      const x = p.x - s / 2, y = p.y - s / 2;
      return `
        <g class="wt-node is-${n.type.toLowerCase()}" data-wt-node="${n.id}" tabindex="0" role="button"
           transform="translate(${x} ${y})" style="--type:${t.color}">
          <g class="wt-node-body" style="transform-origin:${s / 2}px ${s / 2}px">
            <rect class="wt-node-drop" x="1" y="3" width="${s}" height="${s}"></rect>
            <rect class="wt-node-outline" x="0" y="0" width="${s}" height="${s}"></rect>
            <rect class="wt-node-ring" x="1" y="1" width="${s - 2}" height="${s - 2}"></rect>
            <rect class="wt-node-fill" x="${step ? 4 : 3}" y="${step ? 4 : 3}" width="${s - (step ? 8 : 6)}" height="${s - (step ? 8 : 6)}"></rect>
            ${step ? `<rect class="wt-node-pip" x="${s / 2 - 3}" y="${s / 2 - 3}" width="6" height="6"></rect>` : ''}
            ${!step ? `<rect class="wt-node-shine" x="3" y="3" width="${s - 6}" height="2"></rect>` : ''}
            ${icon && !step
              ? `<image class="wt-node-icon" href="${esc(icon)}" x="${inset}" y="${inset}" width="${s - inset * 2}" height="${s - inset * 2}" preserveAspectRatio="xMidYMid meet"></image>`
              : ''}
            ${!step && n.type !== 'START' ? `<text class="wt-node-q" x="${s / 2}" y="${s / 2 + 7}" text-anchor="middle">?</text>` : ''}
          </g>
        </g>`;
    }

    function build() {
      geo = layout(piste);
      const edges = [];
      piste.nodes.forEach((n) => (n.children || []).forEach((c) => {
        const a = geo.pos[n.id], b = geo.pos[c];
        if (!b) return;
        edges.push(`
          <g class="wt-edge" data-from="${n.id}" data-to="${c}">
            <line class="wt-edge-base" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"></line>
            <line class="wt-edge-open" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"></line>
            <line class="wt-edge-fill" pathLength="1" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"></line>
          </g>`);
      }));
      ui.stage.innerHTML = `
        <svg class="wt-svg" viewBox="0 0 ${geo.w} ${geo.h}" data-wt-svg role="group"
             aria-label="Arbre de la Piste Sauvage de ${esc(entity.name)}">
          <g class="wt-edges">${edges.join('')}</g>
          <g class="wt-nodes">${piste.nodes.map(nodeSvg).join('')}</g>
          <g class="wt-fx" data-wt-fx></g>
        </svg>`;
      ui.svg = ui.stage.querySelector('[data-wt-svg]');
      ui.fx = ui.stage.querySelector('[data-wt-fx]');
      ui.nodeEls = {};
      ui.stage.querySelectorAll('[data-wt-node]').forEach((el) => { ui.nodeEls[el.dataset.wtNode] = el; });
      ui.edgeEls = Array.prototype.slice.call(ui.stage.querySelectorAll('.wt-edge'));

      buildMinimap();
      buildLegend();
    }

    function buildLegend() {
      const count = {};
      piste.nodes.forEach((n) => { count[n.type] = (count[n.type] || 0) + 1; });
      const iconOf = (k) => (k === 'START' ? entity.head : k === 'XP' ? xpIcon(100) : k === 'COINS' ? coinIcon(6) : TYPE[k].icon);
      $('[data-wt-legend]').innerHTML = TYPE_ORDER.filter((k) => count[k]).map((k) => `
        <span class="wt-key wt-key-${k.toLowerCase()}">
          <span class="wt-key-box">${iconOf(k) ? `<span class="crisp" style="background-image:url('${esc(iconOf(k))}')"></span>` : '<i></i>'}</span>
          ${TYPE[k].label}<em>${count[k]}</em>
        </span>`).join('')
        + `<span class="wt-key-states">
            <span class="wt-st is-owned">Acquis</span>
            <span class="wt-st is-buyable">Disponible</span>
            <span class="wt-st is-locked">Verrouillé</span>
            <span class="wt-st is-mystery">Niveau trop bas</span>
          </span>`;
    }

    function update() {
      piste.nodes.forEach((n) => {
        const el = ui.nodeEls[n.id];
        const st = nodeState(n);
        const hidden = mystery(n);
        el.classList.toggle('is-owned', st.key === 'owned');
        el.classList.toggle('is-buyable', st.key === 'buyable');
        el.classList.toggle('is-level', st.key === 'level');
        el.classList.toggle('is-locked', st.key === 'locked');
        el.classList.toggle('is-mystery', hidden);
        const t = TYPE[n.type] || TYPE.STEP;
        el.setAttribute('aria-label', (hidden ? 'Nœud mystère' : t.label) + (n.cost ? ', ' + n.cost + ' pièces' : '')
          + (n.requiredLevel ? ', niveau ' + n.requiredLevel : '') + ' — ' + st.why);
      });
      ui.edgeEls.forEach((el) => {
        const a = +el.dataset.from, b = +el.dataset.to;
        const lit = owned(a) && owned(b);
        el.classList.toggle('is-lit', lit);
        el.classList.toggle('is-open', !lit && owned(a) && nodeState(idx.byId[b]).key === 'buyable');
      });
      if (options.levelControl) {
        const max = maxLevel();
        ui.level.max = max;
        ui.level.value = plan.level;
        $('[data-wt-level-out]').textContent = plan.level;
        /* Le niveau maximum s'ecrit en or (.lvl-max, css/ux.css). */
        $('[data-wt-level-out]').classList.toggle('lvl-max', plan.level >= max);
        $('[data-wt-level-max]').textContent = max;
        $('[data-wt-level-fill]').style.width = (max > 1 ? (plan.level - 1) / (max - 1) * 100 : 100) + '%';
      }
      const sum = summary();
      $('[data-wt-pct]').textContent = Math.round(sum.owned / sum.total * 100) + '%';
      $('[data-wt-count]').innerHTML = `<b>${sum.owned}</b> / ${sum.total} nœuds`;
      $('[data-wt-spent]').innerHTML = `<b>${sum.spent}</b><span class="crisp wt-coin" style="background-image:url('${coinIcon(sum.spent >= 100 ? 10 : sum.spent >= 40 ? 6 : sum.spent ? 4 : 0)}')"></span>`;
      $('[data-wt-spent]').setAttribute('title', sum.spent + ' pièces dépensées');
      paintMinimap();
      if (hoverId != null) showTip(hoverId);
      if (typeof options.onChange === 'function') options.onChange(sum);
    }

    function summary() {
      let spent = 0, xp = 0, coins = 0;
      const attacks = [];
      piste.nodes.forEach((n) => {
        const has = owned(n.id);
        if (has) {
          spent += n.cost || 0;
          if (n.type === 'XP') xp += n.reward || 0;
          if (n.type === 'COINS') coins += n.reward || 0;
        }
        if (n.type === 'ATTACK') {
          const choice = plan.choices[n.id];
          attacks.push({
            node: n, owned: has, why: nodeState(n).why,
            passive: has && n.passives && n.passives.length ? n.passives[choice || 0] : null,
            passives: n.passives || []
          });
        }
      });
      return {
        entity, level: plan.level, maxLevel: maxLevel(),
        owned: plan.owned.size, total: piste.nodes.length,
        spent, xp, coins, attacks, reachable: reachableAtLevel().size
      };
    }

    function reachableAtLevel() {
      const saved = plan.owned;
      const set = new Set(piste.nodes.filter((n) => n.type === 'START').map((n) => n.id));
      plan.owned = set;
      let grew = true;
      while (grew) {
        grew = false;
        piste.nodes.forEach((n) => {
          if (set.has(n.id)) return;
          if (nodeState(n).key !== 'buyable') return;
          set.add(n.id);
          grew = true;
        });
      }
      plan.owned = saved;
      return set;
    }

    /* ---- effets ---------------------------------------------------------------- */

    function burst(id, color) {
      if (reduced || !ui.fx) return;
      const p = geo.pos[id];
      let html = '';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + Math.random() * .4;
        const d = 26 + Math.random() * 26;
        const s = 3 + Math.round(Math.random() * 3);
        html += `<rect class="wt-spark" x="${(p.x - s / 2).toFixed(1)}" y="${(p.y - s / 2).toFixed(1)}" width="${s}" height="${s}"
          style="--dx:${(Math.cos(a) * d).toFixed(1)}px;--dy:${(Math.sin(a) * d).toFixed(1)}px;fill:${i % 3 ? color : '#FFFFFF'}"></rect>`;
      }
      html += `<rect class="wt-ring" x="${(p.x - p.r - 4).toFixed(1)}" y="${(p.y - p.r - 4).toFixed(1)}" width="${p.r * 2 + 8}" height="${p.r * 2 + 8}" style="stroke:${color}"></rect>`;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.innerHTML = html;
      ui.fx.appendChild(g);
      setTimeout(() => g.remove(), 800);
    }

    function flash(id, cls) {
      const el = ui.nodeEls[id];
      if (!el) return;
      el.classList.remove(cls);
      void el.getBoundingClientRect();
      el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 700);
    }

    /* ---- actions ---------------------------------------------------------------- */

    function commitBuy(id, choice) {
      const n = idx.byId[id];
      plan.owned.add(id);
      if (n.type === 'ATTACK') plan.choices[id] = choice || 0;
      update();
      flash(id, 'is-fresh');
      burst(id, '#9BE04A');
    }

    function deny(id, message) {
      flash(id, 'is-denied');
      showTip(id, message);
    }

    function activate(id) {
      if (busy) return;
      closeChooser();
      const n = idx.byId[id];
      if (!n) return;
      /* Un achat est definitif : cliquer un noeud acquis ne fait que le
         rappeler. */
      if (owned(id)) { showTip(id); return; }

      const st = nodeState(n);
      if (st.key !== 'buyable') { deny(id, st.why); return; }

      if (n.type === 'ATTACK' && n.passives && n.passives.length > 1) {
        openChooser(id, (choice) => commitBuy(id, choice));
        return;
      }
      commitBuy(id, 0);
    }

    function unlockAll() {
      if (busy) return;
      closeChooser();
      plan.level = Math.max(plan.level, maxLevel());
      const target = reachableAtLevel();
      /* Du plus proche du depart au plus lointain : la piste se trace dans
         l'ordre du jeu, noeud par noeud, jamais par saut. */
      const order = [];
      const seen = new Set(plan.owned);
      let frontier = Array.from(plan.owned);
      if (!frontier.length) frontier = piste.nodes.filter((n) => n.type === 'START').map((n) => n.id);
      frontier.forEach((id) => { if (!seen.has(id) && target.has(id)) { seen.add(id); order.push(id); } });
      while (frontier.length) {
        const nextFrontier = [];
        frontier.forEach((id) => (idx.byId[id].children || []).forEach((c) => {
          if (seen.has(c) || !target.has(c)) return;
          seen.add(c);
          order.push(c);
          nextFrontier.push(c);
        }));
        frontier = nextFrontier;
      }
      target.forEach((id) => { if (!seen.has(id)) order.push(id); });
      if (!order.length) { update(); return; }

      busy = true;
      host.classList.add('is-busy');
      let i = 0;
      (function next() {
        const batch = order.slice(i, i + 3);
        batch.forEach((id) => {
          plan.owned.add(id);
          if (idx.byId[id].type === 'ATTACK' && plan.choices[id] == null) plan.choices[id] = 0;
          burst(id, '#9BE04A');
        });
        update();
        i += 3;
        if (i < order.length) setTimeout(next, reduced ? 0 : 45);
        else { busy = false; host.classList.remove('is-busy'); }
      }());
    }

    function resetPlan() {
      if (busy) return;
      closeChooser();
      const starts = piste.nodes.filter((n) => n.type === 'START').map((n) => n.id);
      const lost = Array.from(plan.owned).filter((id) => starts.indexOf(id) === -1);
      lost.forEach((x, i) => setTimeout(() => flash(x, 'is-sold'), reduced ? 0 : Math.min(i * 12, 400)));
      plan.owned = new Set(starts);
      plan.choices = {};
      update();
    }

    function setLevel(level) {
      plan.level = Math.max(1, Math.min(50, level | 0));
      /* Baisser le niveau reprend ce qu'il ne permet plus, et ce qui n'y
         tenait que par la. */
      const kept = new Set(Array.from(plan.owned).filter((id) => {
        const n = idx.byId[id];
        return n && (n.type === 'START' || n.requiredLevel <= plan.level);
      }));
      plan.owned = prune(kept);
      Object.keys(plan.choices).forEach((k) => { if (!plan.owned.has(+k)) delete plan.choices[k]; });
      update();
    }

    /* ---- le choix du passif ------------------------------------------------------- */

    function openChooser(id, done) {
      const n = idx.byId[id];
      hideTip();
      ui.choose.innerHTML = `
        <span class="wt-choose-kicker">NŒUD DE CAPACITÉ · ${n.cost} PIÈCES</span>
        <b class="wt-choose-title">Choix du passif</b>
        ${n.passives.map((pv, i) => `
          <button type="button" class="wt-choice" data-wt-choice="${i}">
            <span class="wt-choice-icon crisp" aria-hidden="true"></span>
            <span class="wt-choice-text"><b>${esc(pv.name)}</b><small>${esc(pv.description)}</small></span>
          </button>`).join('')}
        <button type="button" class="wt-choose-cancel" data-wt-choice-cancel>Annuler</button>`;
      ui.choose.hidden = false;
      placeFloating(ui.choose, id);
      chooser = { id, done };
      const first = ui.choose.querySelector('[data-wt-choice]');
      if (first) first.focus({ preventScroll: true });
    }

    function closeChooser() {
      if (!chooser) return;
      chooser = null;
      ui.choose.hidden = true;
    }

    /* ---- l'info-bulle ------------------------------------------------------------ */

    function placeFloating(el, id) {
      const node = ui.nodeEls[id];
      if (!node) return;
      const f = ui.frame.getBoundingClientRect();
      const r = node.getBoundingClientRect();
      const w = el.offsetWidth, h = el.offsetHeight;
      let x = r.left - f.left + r.width / 2 - w / 2;
      let y = r.top - f.top - h - 12;
      if (y < 8) y = r.bottom - f.top + 14;
      x = Math.max(8, Math.min(f.width - w - 8, x));
      y = Math.max(8, Math.min(f.height - h - 8, y));
      el.style.left = x + 'px';
      el.style.top = y + 'px';
    }

    function showTip(id, override) {
      const n = idx.byId[id];
      if (!n) return;
      const t = TYPE[n.type] || TYPE.STEP;
      const st = nodeState(n);
      const hidden = mystery(n);

      let action;
      if (st.key === 'owned') action = n.type === 'START' ? 'Point de départ de la piste' : 'Déjà acquis';
      else if (st.key === 'buyable') action = 'Clic pour débloquer';
      else action = st.why;

      const reward = hidden ? 'Se révèle quand la créature atteint le niveau ' + n.requiredLevel
        : n.type === 'XP' ? '+' + n.reward + ' XP d\'apprivoisement'
        : n.type === 'COINS' ? '+' + n.reward + ' pièces sauvages'
        : n.type === 'START' ? esc(entity.name) + ' commence ici'
        : n.type === 'STEP' ? 'Relie les nœuds entre eux'
        : 'Débloque un passif au choix';

      let passives = '';
      if (!hidden && n.type === 'ATTACK' && n.passives && n.passives.length) {
        const chosen = owned(id) ? (plan.choices[id] || 0) : -1;
        passives = `<span class="wt-tip-passives">${n.passives.map((pv, i) => `
          <span class="wt-tip-passive${i === chosen ? ' is-chosen' : ''}"><b>${esc(pv.name)}</b>${esc(pv.description)}</span>`).join('')}</span>`;
      }

      ui.tip.innerHTML = `
        <span class="wt-tip-head" style="--type:${hidden ? '#9A9A9A' : t.color}">
          <span class="wt-tip-type">${hidden ? 'Nœud mystère' : t.label}</span>
          ${n.cost ? `<span class="wt-tip-cost"><span class="crisp wt-coin" style="background-image:url('assets/ui/coins/coin_1.png')"></span>${n.cost}</span>` : ''}
        </span>
        <span class="wt-tip-reward">${reward}</span>
        ${passives}
        <span class="wt-tip-meta">${n.requiredLevel ? 'Niveau ' + n.requiredLevel + ' requis' : 'Aucun niveau requis'}${n.requiresAll ? ' · tous les nœuds précédents' : ''}</span>
        <span class="wt-tip-action is-${override ? 'bad' : st.key}">${esc(override || action)}</span>`;
      ui.tip.hidden = false;
      placeFloating(ui.tip, id);
    }

    function hideTip() {
      ui.tip.hidden = true;
    }

    /* ---- zoom, deplacement, mini-carte ------------------------------------------------ */

    function applyZoom(z, anchor) {
      const vp = ui.viewport;
      const old = zoom;
      zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
      const ax = anchor ? anchor.x : vp.clientWidth / 2;
      const ay = anchor ? anchor.y : vp.clientHeight / 2;
      const cx = (vp.scrollLeft + ax) / old;
      const cy = (vp.scrollTop + ay) / old;
      sizeStage();
      vp.scrollLeft = cx * zoom - ax;
      vp.scrollTop = cy * zoom - ay;
      paintMinimap();
    }

    function sizeStage() {
      if (!ui.svg) return;
      ui.svg.setAttribute('width', Math.round(geo.w * zoom));
      ui.svg.setAttribute('height', Math.round(geo.h * zoom));
      const over = geo.w * zoom > ui.viewport.clientWidth + 2 || geo.h * zoom > ui.viewport.clientHeight + 2;
      host.classList.toggle('is-overflow', over);
      ui.minimap.hidden = !over;
    }

    function fitZoom() {
      const vp = ui.viewport;
      return Math.max(ZOOM_MIN, Math.min(1, (vp.clientWidth - 24) / geo.w, (vp.clientHeight - 24) / geo.h));
    }

    function centerOn(id) {
      const p = geo.pos[id];
      if (!p) return;
      const vp = ui.viewport;
      vp.scrollLeft = p.x * zoom - vp.clientWidth / 2;
      vp.scrollTop = p.y * zoom - vp.clientHeight * .62;
    }

    function buildMinimap() {
      const w = 150;
      const h = Math.max(50, Math.min(130, Math.round(w * geo.h / geo.w)));
      ui.mini = { w, h, sx: w / geo.w, sy: h / geo.h };
      ui.minimap.style.width = w + 'px';
      ui.minimap.style.height = h + 'px';
      ui.minimap.innerHTML = `<svg viewBox="0 0 ${geo.w} ${geo.h}" preserveAspectRatio="none">
          ${piste.nodes.map((n) => {
            const p = geo.pos[n.id];
            const s = Math.max(10, p.r * 2);
            return `<rect data-mm="${n.id}" x="${p.x - s / 2}" y="${p.y - s / 2}" width="${s}" height="${s}"></rect>`;
          }).join('')}
        </svg><span class="wt-mm-view" data-wt-mm-view></span>`;
      ui.mmRects = {};
      ui.minimap.querySelectorAll('[data-mm]').forEach((el) => { ui.mmRects[el.dataset.mm] = el; });
      ui.mmView = ui.minimap.querySelector('[data-wt-mm-view]');
    }

    function paintMinimap() {
      if (!ui.mini || ui.minimap.hidden) return;
      piste.nodes.forEach((n) => {
        const el = ui.mmRects[n.id];
        if (el) el.setAttribute('class', owned(n.id) ? 'is-owned' : nodeState(n).key === 'buyable' ? 'is-buyable' : '');
      });
      const vp = ui.viewport;
      const vw = vp.clientWidth / (geo.w * zoom), vh = vp.clientHeight / (geo.h * zoom);
      const vx = vp.scrollLeft / (geo.w * zoom), vy = vp.scrollTop / (geo.h * zoom);
      Object.assign(ui.mmView.style, {
        left: Math.max(0, vx * 100) + '%',
        top: Math.max(0, vy * 100) + '%',
        width: Math.min(100, vw * 100) + '%',
        height: Math.min(100, vh * 100) + '%'
      });
    }

    function minimapJump(e) {
      const r = ui.minimap.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      const vp = ui.viewport;
      vp.scrollLeft = fx * geo.w * zoom - vp.clientWidth / 2;
      vp.scrollTop = fy * geo.h * zoom - vp.clientHeight / 2;
    }

    let hintSeen = false;
    function dismissHint() {
      if (hintSeen) return;
      hintSeen = true;
      ui.hint.classList.add('is-gone');
    }

    /* ---- evenements ------------------------------------------------------------------- */

    const nodeFrom = (target) => {
      const el = target.closest && target.closest('[data-wt-node]');
      return el ? +el.dataset.wtNode : null;
    };

    /* Glisser pour parcourir (a la souris ; au doigt, le defilement natif
       suffit). Un glisser ne doit pas acheter le noeud sur lequel il finit. */
    let drag = null;
    let suppressClick = false;
    ui.viewport.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, sl: ui.viewport.scrollLeft, st: ui.viewport.scrollTop, moved: false };
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 5) {
        drag.moved = true;
        host.classList.add('is-dragging');
        hideTip();
        dismissHint();
      }
      if (drag.moved) {
        ui.viewport.scrollLeft = drag.sl - dx;
        ui.viewport.scrollTop = drag.st - dy;
      }
    }, { passive: true });
    window.addEventListener('pointerup', () => {
      if (!drag) return;
      suppressClick = drag.moved;
      drag = null;
      host.classList.remove('is-dragging');
    });

    ui.viewport.addEventListener('click', (e) => {
      if (suppressClick) { suppressClick = false; return; }
      const id = nodeFrom(e.target);
      if (id != null) activate(id);
      else closeChooser();
    });

    ui.viewport.addEventListener('pointerover', (e) => {
      if (drag && drag.moved) return;
      const id = nodeFrom(e.target);
      if (id == null || id === hoverId) return;
      hoverId = id;
      showTip(id);
    });
    ui.viewport.addEventListener('pointerout', (e) => {
      const to = e.relatedTarget && nodeFrom(e.relatedTarget);
      if (to != null) return;
      hoverId = null;
      hideTip();
    });

    ui.viewport.addEventListener('focusin', (e) => {
      const id = nodeFrom(e.target);
      if (id != null) { hoverId = id; showTip(id); }
    });
    ui.viewport.addEventListener('focusout', () => { hoverId = null; hideTip(); });
    ui.viewport.addEventListener('keydown', (e) => {
      const id = nodeFrom(e.target);
      if (id == null) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(id); }
    });

    ui.viewport.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) { dismissHint(); return; }
      e.preventDefault();
      const r = ui.viewport.getBoundingClientRect();
      applyZoom(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), { x: e.clientX - r.left, y: e.clientY - r.top });
    }, { passive: false });

    let scrollRaf = 0;
    ui.viewport.addEventListener('scroll', () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        if (!ui.tip.hidden && hoverId != null) placeFloating(ui.tip, hoverId);
        if (chooser) placeFloating(ui.choose, chooser.id);
        paintMinimap();
      });
    }, { passive: true });

    let mmDrag = false;
    ui.minimap.addEventListener('pointerdown', (e) => {
      mmDrag = true;
      ui.minimap.setPointerCapture(e.pointerId);
      minimapJump(e);
      dismissHint();
    });
    ui.minimap.addEventListener('pointermove', (e) => { if (mmDrag) minimapJump(e); });
    ui.minimap.addEventListener('pointerup', () => { mmDrag = false; });

    ui.choose.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-wt-choice]');
      if (btn && chooser) {
        const done = chooser.done;
        closeChooser();
        done(+btn.dataset.wtChoice);
        return;
      }
      if (e.target.closest('[data-wt-choice-cancel]')) closeChooser();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeChooser(); });
    document.addEventListener('pointerdown', (e) => {
      if (chooser && !ui.choose.contains(e.target) && !e.target.closest('[data-wt-node]')) closeChooser();
    });

    host.querySelector('.wt-toolbar').addEventListener('click', (e) => {
      if (e.target.closest('[data-wt-all]')) { unlockAll(); return; }
      if (e.target.closest('[data-wt-reset]')) { resetPlan(); return; }
      const z = e.target.closest('[data-wt-zoom]');
      if (z) {
        const k = z.dataset.wtZoom;
        if (k === 'fit') { applyZoom(fitZoom()); centerStage(); }
        else applyZoom(zoom * (k === 'in' ? 1.2 : 1 / 1.2));
        dismissHint();
      }
    });
    if (ui.level) {
      ui.level.addEventListener('input', () => setLevel(parseInt(ui.level.value, 10)));
    }

    function centerStage() {
      const vp = ui.viewport;
      vp.scrollLeft = (geo.w * zoom - vp.clientWidth) / 2;
      vp.scrollTop = (geo.h * zoom - vp.clientHeight) / 2;
    }

    if ('ResizeObserver' in window) {
      new ResizeObserver(() => { if (geo) { sizeStage(); paintMinimap(); } }).observe(ui.viewport);
    }

    /* ---- API ---------------------------------------------------------------------------- */

    function setEntity(next) {
      closeChooser();
      hideTip();
      hoverId = null;
      entity = next;
      piste = next && next.piste;
      host.style.setProperty('--wt-accent', (next && next.color) || '#F2A32C');
      if (!piste || !piste.available) {
        host.classList.add('is-empty');
        ui.stage.innerHTML = '';
        ui.minimap.hidden = true;
        ui.empty.hidden = false;
        ui.empty.textContent = (next ? next.name : 'Cette créature') + " n'a pas encore de Piste Sauvage dans le mod.";
        $('[data-wt-legend]').innerHTML = '';
        $('[data-wt-pct]').textContent = '';
        $('[data-wt-count]').textContent = '';
        $('[data-wt-spent]').textContent = '';
        if (typeof options.onChange === 'function') options.onChange(null);
        return;
      }
      host.classList.remove('is-empty');
      ui.empty.hidden = true;
      idx = indexOf(piste);
      if (!plans[next.slug]) {
        plans[next.slug] = {
          owned: new Set(piste.nodes.filter((n) => n.type === 'START').map((n) => n.id)),
          choices: {},
          level: DEFAULT_LEVEL
        };
      }
      plan = plans[next.slug];
      build();
      zoom = 1;
      sizeStage();
      update();
      const start = piste.nodes.find((n) => n.type === 'START');
      requestAnimationFrame(() => {
        sizeStage();
        if (host.classList.contains('is-overflow') && start) centerOn(start.id);
        else centerStage();
        paintMinimap();
        if (host.classList.contains('is-overflow') && !hintSeen) ui.hint.hidden = false;
      });
    }

    return {
      setEntity,
      setLevel(level) { if (plan) setLevel(level); },
      summary() { return plan ? summary() : null; },
      refresh() { if (geo) { sizeStage(); paintMinimap(); } }
    };
  }

  OW.WildTrail = { create, TYPE, xpIcon, coinIcon };
}(window.OW = window.OW || {}));
