/* La mini-carte de generation d'une fiche de biome.

   Un monde en cases, genere a la volee : oceans, puis des biomes vanilla
   choisis par temperature et humidite (une version simplifiee du tableau de
   Minecraft). Par-dessus, les regions TerraBlender : chaque region est soit
   celle du jeu de base, soit celle du mod, au prorata de leurs poids (5 pour
   le mod, 10 pour le jeu de base). Dans une region du mod, les biomes que le
   mod remplace deviennent le sien — c'est exactement ce que fait
   OWOverworldRegion.addBiomes.

   La carte est illustrative (le vrai monde depend de la graine) : on la
   survole pour lire chaque case, on la compare avec et sans le mod, on en
   tire une autre.

   OW.mountBiomeMap(host, { id, name, color, replaces: [ids], modWeight, vanillaWeight }) */

(function (OW) {
  'use strict';

  const esc = (v) => (OW.escapeHtml ? OW.escapeHtml(v) : String(v));
  const W = 96, H = 58;

  const BIOMES = {
    'minecraft:deep_ocean': ['Océan profond', '#22457F'],
    'minecraft:ocean': ['Océan', '#2E5DA8'],
    'minecraft:beach': ['Plage', '#E6D9A2'],
    'minecraft:snowy_plains': ['Plaine enneigée', '#E6EDF1'],
    'minecraft:snowy_taiga': ['Taïga enneigée', '#B9CFD2'],
    'minecraft:plains': ['Plaine', '#8DB360'],
    'minecraft:flower_forest': ['Forêt fleurie', '#7FB045'],
    'minecraft:forest': ['Forêt', '#3F7A2B'],
    'minecraft:birch_forest': ['Forêt de bouleaux', '#6A9E45'],
    'minecraft:dark_forest': ['Forêt noire', '#2B4A1E'],
    'minecraft:taiga': ['Taïga', '#2F6A52'],
    'minecraft:old_growth_spruce_taiga': ['Taïga d’épicéas géants', '#27574A'],
    'minecraft:old_growth_pine_taiga': ['Taïga de pins géants', '#3A6152'],
    'minecraft:savanna': ['Savane', '#BDB25F'],
    'minecraft:jungle': ['Jungle', '#3A8A1E'],
    'minecraft:desert': ['Désert', '#E0CF8A']
  };

  /* Le tableau (simplifie) du jeu : temperature (lignes) x humidite (colonnes). */
  const TABLE = [
    ['snowy_plains', 'snowy_plains', 'snowy_plains', 'snowy_taiga', 'snowy_taiga'],
    ['plains', 'plains', 'forest', 'taiga', 'old_growth_spruce_taiga'],
    ['flower_forest', 'plains', 'forest', 'birch_forest', 'dark_forest'],
    ['savanna', 'savanna', 'forest', 'jungle', 'jungle'],
    ['desert', 'desert', 'desert', 'desert', 'desert']
  ].map((row) => row.map((b) => 'minecraft:' + b));

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Un bruit lisse : des valeurs au hasard sur une grille, interpolees. */
  function noise(seed, scale) {
    const r = rng(seed);
    const G = 32;
    const grid = Array.from({ length: G * G }, () => r());
    const at = (x, y) => grid[((y % G + G) % G) * G + ((x % G + G) % G)];
    const s = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const fx = x / scale, fy = y / scale;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = s(fx - x0), ty = s(fy - y0);
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      return a + (b - a) * ty;
    };
  }

  function world(seed, gen, withMod) {
    const cont = noise(seed, 14), cont2 = noise(seed + 1, 5);
    const temp = noise(seed + 2, 18), hum = noise(seed + 3, 12), weird = noise(seed + 4, 6);
    /* Les regions : des cellules de Voronoi, du mod ou du jeu de base. */
    const r = rng(seed + 9);
    const share = gen.modWeight / (gen.modWeight + gen.vanillaWeight);
    const sites = Array.from({ length: 22 }, () => ({ x: r() * W, y: r() * H, mod: r() < share }));
    const cells = new Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = cont(x, y) * 0.75 + cont2(x, y) * 0.25;
        let id;
        if (c < 0.3) id = 'minecraft:deep_ocean';
        else if (c < 0.43) id = 'minecraft:ocean';
        else if (c < 0.46) id = 'minecraft:beach';
        else {
          const t = Math.min(4, Math.floor(temp(x, y) * 5));
          const h = Math.min(4, Math.floor(hum(x, y) * 5));
          id = TABLE[t][h];
          if (id === 'minecraft:old_growth_spruce_taiga' && weird(x, y) > 0.55) id = 'minecraft:old_growth_pine_taiga';
        }
        let site = sites[0], best = Infinity;
        sites.forEach((s) => { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < best) { best = d; site = s; } });
        const inMod = site.mod;
        let final = id;
        if (withMod && inMod && gen.replaces.includes(id)) final = gen.id;
        cells[y * W + x] = { id: final, base: id, inMod };
      }
    }
    return cells;
  }

  function mount(host, gen) {
    const colorOf = (id) => (id === gen.id ? gen.color : (BIOMES[id] || ['', '#555'])[1]);
    const nameOf = (id) => (id === gen.id ? gen.name : (BIOMES[id] || [id])[0]);
    host.innerHTML = `
      <div class="bmap">
        <div class="bmap-view">
          <canvas class="bmap-canvas" width="${W}" height="${H}" aria-label="Carte illustrative de la génération du biome"></canvas>
          <span class="bmap-tip" data-bmap-tip hidden></span>
        </div>
        <div class="bmap-side">
          <div class="bmap-switch" role="group" aria-label="Affichage">
            <button type="button" data-bmap-mode="mod" aria-pressed="true">Avec le mod</button>
            <button type="button" data-bmap-mode="vanilla" aria-pressed="false">Sans le mod</button>
          </div>
          <label class="bmap-regions"><input type="checkbox" data-bmap-regions> Montrer les régions du mod</label>
          <div class="bmap-legend" data-bmap-legend tabindex="0" role="region" aria-label="Légende de la carte"></div>
          <p class="bmap-stat" data-bmap-stat></p>
          <button type="button" class="bmap-reroll" data-bmap-reroll>Tirer un autre monde</button>
          <p class="bmap-note">Carte illustrative : dans le jeu, le relief et la place de chaque biome dépendent de la graine du monde.</p>
        </div>
      </div>`;
    const canvas = host.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const tip = host.querySelector('[data-bmap-tip]');
    let seed = 2024, withMod = true, showRegions = false, cells = [];

    const paint = () => {
      cells = world(seed, gen, withMod);
      const img = ctx.createImageData(W, H);
      const counts = {};
      cells.forEach((c, i) => {
        counts[c.id] = (counts[c.id] || 0) + 1;
        const hex = colorOf(c.id);
        let rr = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), bb = parseInt(hex.slice(5, 7), 16);
        if (showRegions && c.inMod) { rr = Math.min(255, rr * 0.7 + 90); gg = Math.min(255, gg * 0.7 + 60); bb = bb * 0.7; }
        /* Un grain de relief : une case sur deux un rien plus sombre. */
        const k = ((i % W) + Math.floor(i / W)) % 2 ? 0.94 : 1;
        img.data.set([rr * k, gg * k, bb * k, 255], i * 4);
      });
      ctx.putImageData(img, 0, 0);
      const land = cells.filter((c) => !/ocean|beach/.test(c.base));
      const legend = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
      host.querySelector('[data-bmap-legend]').innerHTML = legend.map((id) => `
        <span class="bmap-key${id === gen.id ? ' is-it' : ''}"><i style="background:${colorOf(id)}"></i>${esc(nameOf(id))}
          <small>${Math.round(counts[id] / cells.length * 100)} %</small></span>`).join('');
      const replacedPool = land.filter((c) => gen.replaces.includes(c.base)).length;
      const became = cells.filter((c) => c.id === gen.id).length;
      host.querySelector('[data-bmap-stat]').innerHTML = withMod
        ? `Sur cette carte, <b>${became ? Math.round(became / Math.max(1, replacedPool) * 100) : 0} %</b> des taïgas deviennent la ${esc(gen.name.toLowerCase())}
           — en moyenne, un tiers (poids ${gen.modWeight} du mod face à ${gen.vanillaWeight} du jeu de base).`
        : `Sans le mod, ces mêmes zones restent des taïgas.`;
    };
    paint();

    host.querySelector('[data-bmap-reroll]').addEventListener('click', () => { seed = Math.floor(Math.random() * 1e6); paint(); });
    host.querySelector('[data-bmap-regions]').addEventListener('change', (e) => { showRegions = e.target.checked; paint(); });
    host.querySelectorAll('[data-bmap-mode]').forEach((b) => b.addEventListener('click', () => {
      withMod = b.dataset.bmapMode === 'mod';
      host.querySelectorAll('[data-bmap-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      paint();
    }));
    const move = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / rect.width * W);
      const y = Math.floor((e.clientY - rect.top) / rect.height * H);
      const c = cells[y * W + x];
      if (!c) { tip.hidden = true; return; }
      tip.hidden = false;
      tip.textContent = nameOf(c.id) + (c.id !== c.base ? ' (au lieu de : ' + nameOf(c.base) + ')' : '');
      tip.style.left = (e.clientX - rect.left) + 'px';
      tip.style.top = (e.clientY - rect.top) + 'px';
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerdown', move);
    canvas.addEventListener('pointerleave', () => { tip.hidden = true; });
  }

  OW.mountBiomeMap = mount;
}(window.OW = window.OW || {}));
