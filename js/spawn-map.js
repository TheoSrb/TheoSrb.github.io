(function (OW) {
  'use strict';

  const WIDTH = 250;
  const HEIGHT = 100;
  const CELL = 4;
  const BACKDROP = '#0B0F0C';
  const DEEP_DISTANCE = 8;
  const DEEP_ICE_DISTANCE = 6;
  const MIN_ZONE = 45;

  const SHAPE = '.250|.250|.250|.250|.250|.250|.86a2.162|.83a11.156|.16c11.55a17.28a5.118|.14c14.54a20.20a14.114|.12c17.52a59.88b5.17|.11c18.51a63.83b7.17|.10c20.16e6.28a70.74b9.17|.10c21.13e9.26a73.41a4.26b11.16|.10c22.11e11.25a74.36a10.22b13.16|.10c22.11e11.24a76.32a14.20b15.15|.11c10,2c10.10e11.21a80.27a18.20b18.12|.11c9,4c9.11e10.18a84.22a22.19b20.11|.12c7,6c9.10e10.14a89.18a25.18b21.11|.12c6,7c9.9e10.15a90.16a26.18b21.11|.13c4,8c9.9e9.16a91.13a28.17b22.11|.13c3,9c9.9e8.16a92.12a28.18b22.11|.12c4,9c9.10e4.19a93.10a29.18b22.11|.12c5,8c7.26a4.5a95.7a30.18b22.11|.11c7,5c8.24a7.5a96.5a30.20b20.12|.10c20.23a10.4a97.3a31.20b20.12|.10c19.22a13.3a130.21b20.12|.10c19.21a15.2a130.22b19.12|.9c19.20a148.23b19.12|.9c19.18a150.23b19.12|.9c18.18a150.25b18.12|.10c17.17a151.16g2.7b19.11|.22c2.19a151.16g4.6b19.11|.42a151.17g4.6b19.11|.41a152.17g4.6b18.12|.41a152.17g4.5b19.12|.40a153.16g5.5b18.13|.39a154.16g5.5b17.14|.38a155.15g6.5b16.15|.35a158.15g6.5b16.15|.34a160.14g6.5b15.16|.33a161.14g5.6b15.16|.32a162.14g5.7b14.16|.32a163.14g3.11b10.17|.31a164.31b7.17|.31a165.30b6.18|.32a164.31b5.18|.32a164.31b4.19|.33a163.31b4.19|.34a131.1a30.18i2.11b3.20|.36a126.7a26.18i3.11b2.21|.37a124.10a23.19i3.11b1.22|.38a122.13a20.20i3.34|.39a120.15a18.21i2.35|.39a120.17a14.24i1.35|.40a119.18a11.62|.40a118.22a5.65|.40a118.92|.41a109.1a6.93|.41a107.4a4.94|.41a107.5a2.95|.41a106.103|.41a106.18d2.83|.41a106.17d4.10h2.70|.41a106.16d6.8h4.69|.41a106.16d7.6h6.68|~3.38a106.15d8.6h6.68|~4.37a106.15d9.6h5.68|~6.34a107.15d9.7h3.22f3.44|~8.32a107.14d8.10h1.21f6.43|~9.32a106.14d6.33f8.42|~10.32a105.13d7.33f8.42|~11.35a101.13d7.33f9.41|~12.39a22.3a71.13d8.32f9.41|~13.40a19.4a71.13d8.32f8.42|~14.39a19.5a69.14d8.33f6.43|~15.39a17.7a68.14d9.32f6.43|~16.40a14.8a68.14d9.32f5.44|~17.40a12.9a46.5a17.15d8.33f4.44|~19.41a8.10a44.11a13.14d9.34f3.44|~21.43a2.13a41.15a11.13d10.34f2.45|~22.57a40.17a9.14d9.82|~24.55a38.19a9.13d9.83|~25.54a37.20a8.14d8.84|~26.54a35.20a8.15d6.86|~27.53a34.21a8.16d2.89|~29.52a32.22a7.108|~32.50a30.22a7.109|~34.51a26.23a6.110|~37.50a22.25a4.112|~40.52a16.142|~41.54a12.143|~42.56a6.146|~44.206|~45.205|~47.203|~50.200|~52.198|~55.195|~56.194';

  const BIOMES = {
    warm_ocean: { label: 'Océan chaud', color: '#2B6573', group: 'ocean' },
    lukewarm_ocean: { label: 'Océan tiède', color: '#28546E', group: 'ocean' },
    deep_lukewarm_ocean: { label: 'Océan tiède profond', color: '#22475F', group: 'ocean' },
    ocean: { label: 'Océan', color: '#234466', group: 'ocean' },
    deep_ocean: { label: 'Océan profond', color: '#1C3756', group: 'ocean' },
    cold_ocean: { label: 'Océan froid', color: '#283E59', group: 'ocean' },
    deep_cold_ocean: { label: 'Océan froid profond', color: '#20324B', group: 'ocean' },
    frozen_ocean: { label: 'Océan gelé', color: '#B4C4C8', group: 'ocean' },
    deep_frozen_ocean: { label: 'Océan gelé profond', color: '#9DB0B6', group: 'ocean' },

    snowy_plains: { label: 'Plaines enneigées', color: '#C3CDCC', group: 'cold' },
    ice_spikes: { label: 'Pics de glace', color: '#A6BEC8', group: 'cold' },
    snowy_taiga: { label: 'Taïga enneigée', color: '#73857F', trees: true, group: 'cold' },
    taiga: { label: 'Taïga', color: '#3F5C49', trees: true, group: 'cold' },
    old_growth_pine_taiga: { label: 'Taïga de pins ancienne', color: '#4A573A', trees: true, group: 'cold' },

    windswept_hills: { label: 'Collines venteuses', color: '#6A7465', group: 'peaks' },
    jagged_peaks: { label: 'Pics escarpés', color: '#CDD3D3', group: 'peaks' },
    stony_peaks: { label: 'Pics rocheux', color: '#85847E', group: 'peaks' },
    meadow: { label: 'Prairie', color: '#6F8C52', group: 'peaks' },
    cherry_grove: { label: 'Cerisaie', color: '#A98793', trees: true, group: 'peaks' },

    forest: { label: 'Forêt', color: '#395F35', trees: true, group: 'temperate' },
    birch_forest: { label: 'Forêt de bouleaux', color: '#567A48', trees: true, group: 'temperate' },
    dark_forest: { label: 'Forêt noire', color: '#2A4026', trees: true, group: 'temperate' },
    flower_forest: { label: 'Forêt fleurie', color: '#4D7641', trees: true, group: 'temperate' },
    plains: { label: 'Plaines', color: '#6B8A47', group: 'temperate' },
    sunflower_plains: { label: 'Plaines de tournesols', color: '#7E8C48', group: 'temperate' },
    swamp: { label: 'Marais', color: '#45522F', trees: true, group: 'temperate' },

    savanna: { label: 'Savane', color: '#928C59', group: 'warm' },
    savanna_plateau: { label: 'Plateau de savane', color: '#837D50', group: 'warm' },
    desert: { label: 'Désert', color: '#BBAE7A', group: 'warm' },
    badlands: { label: 'Badlands', color: '#985A3A', group: 'warm' },
    wooded_badlands: { label: 'Badlands boisées', color: '#7C6041', trees: true, group: 'warm' },
    eroded_badlands: { label: 'Badlands érodées', color: '#A96843', group: 'warm' },
    jungle: { label: 'Jungle', color: '#2F6526', trees: true, group: 'warm' },
    sparse_jungle: { label: 'Jungle clairsemée', color: '#527A37', trees: true, group: 'warm' },
    bamboo_jungle: { label: 'Jungle de bambous', color: '#43742F', trees: true, group: 'warm' },
    mangrove_swamp: { label: 'Mangrove', color: '#3D5635', trees: true, group: 'warm' },

    beach: { label: 'Plage', color: '#B5A881', group: 'coast' },
    snowy_beach: { label: 'Plage enneigée', color: '#CFD3CB', group: 'coast' },
    stony_shore: { label: 'Rivage rocheux', color: '#7A7973', group: 'coast' },
    river: { label: 'Rivière', color: '#35618A', group: 'coast' },
    lake: { label: 'Lac', color: '#35618A', group: 'coast' },
    mushroom_fields: { label: 'Champs de champignons', color: '#7C6C7E', group: 'coast' },

    redwood_forest: { label: 'Forêt de séquoias', color: '#557335', trees: true, speck: '#4D5A2D', group: 'mod', mod: true }
  };

  const ALIASES = {
    windswept_savanna: 'savanna_plateau',
    old_growth_spruce_taiga: 'old_growth_pine_taiga',
    old_growth_birch_forest: 'birch_forest',
    snowy_slopes: 'jagged_peaks',
    frozen_peaks: 'jagged_peaks',
    grove: 'snowy_taiga',
    windswept_forest: 'windswept_hills',
    windswept_gravelly_hills: 'windswept_hills',
    frozen_river: 'river'
  };

  const FIXED = { c: 'mushroom_fields' };
  const ISLAND_HUMIDITY = { b: 0.3, d: 0.4, f: -0.3 };

  const COLD = { snowy_plains: 1, ice_spikes: 1, snowy_taiga: 1, jagged_peaks: 1 };
  const ROCKY = { windswept_hills: 1, stony_peaks: 1 };
  const NO_SHORE = { swamp: 1, mangrove_swamp: 1, mushroom_fields: 1, badlands: 1, wooded_badlands: 1, eroded_badlands: 1 };

  function bareId(id) {
    const bare = String(id).replace(/^.*:/, '');
    return ALIASES[bare] || bare;
  }

  function activeSet(biomes) {
    const active = {};
    (biomes || []).forEach((id) => {
      const bare = bareId(id);
      if (BIOMES[bare]) active[bare] = true;
    });
    return active;
  }

  function hash(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function valueNoise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    return hash(ix, iy) * (1 - sx) * (1 - sy)
      + hash(ix + 1, iy) * sx * (1 - sy)
      + hash(ix, iy + 1) * (1 - sx) * sy
      + hash(ix + 1, iy + 1) * sx * sy;
  }

  function fbm(x, y, octaves) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let total = 0;
    for (let i = 0; i < octaves; i++) {
      value += valueNoise(x * frequency, y * frequency) * amplitude;
      total += amplitude;
      amplitude *= 0.5;
      frequency *= 2.1;
    }
    return value / total;
  }

  function spread(value) {
    return Math.max(0, Math.min(1, (value - 0.3) / 0.4));
  }

  function bump(x, y, cx, cy, radius) {
    const dx = x - cx;
    const dy = y - cy;
    return Math.exp(-(dx * dx + dy * dy) / (2 * radius * radius));
  }

  function decodeShape() {
    const cells = new Array(WIDTH * HEIGHT);
    SHAPE.split('|').forEach((row, y) => {
      let x = 0;
      row.replace(/([^\d])(\d+)/g, (match, ch, count) => {
        for (let i = 0; i < Number(count); i++) cells[y * WIDTH + x++] = ch;
        return match;
      });
    });
    return cells;
  }

  function distanceFrom(cells, isSource) {
    const dist = new Int16Array(WIDTH * HEIGHT).fill(-1);
    const queue = [];
    for (let i = 0; i < cells.length; i++) {
      if (isSource(cells[i])) { dist[i] = 0; queue.push(i); }
    }
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head];
      const x = i % WIDTH;
      const y = (i - x) / WIDTH;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT) continue;
          const j = ny * WIDTH + nx;
          if (dist[j] !== -1) continue;
          dist[j] = dist[i] + 1;
          queue.push(j);
        }
      }
    }
    return dist;
  }

  function temperatureAt(x, y) {
    const base = 0.06 + 0.78 * (x / WIDTH) + 0.12 * (1 - y / HEIGHT) - bump(x, y, 35, 75, 25) * 0.2;
    return base + (fbm(x * 0.03 + 9.1, y * 0.03 + 4.7, 3) - 0.5) * 0.2;
  }

  function elevationAt(x, y, inland) {
    return spread(fbm(x * 0.05 + 5.3, y * 0.05 + 8.9, 4)) * 0.62
      + Math.min(inland / 16, 1) * 0.22
      + bump(x, y, 117, 15, 15) * 0.42
      + bump(x, y, 150, 38, 8) * 0.26
      + bump(x, y, 183, 36, 7) * 0.24;
  }

  function humidityAt(x, y) {
    return spread(fbm(x * 0.035 + 33.5, y * 0.035 + 17.2, 3)) * 0.8 + 0.1
      + bump(x, y, 84, 24, 12) * 0.3
      + bump(x, y, 104, 77, 13) * 0.42
      - bump(x, y, 176, 47, 10) * 0.15
      + bump(x, y, 192, 22, 10) * 0.3
      - bump(x, y, 166, 34, 8) * 0.3;
  }

  function landBiome(t, h, e, detail, coast, zone) {
    if (t < 0.25) {
      if (e > 0.82) return 'jagged_peaks';
      if (detail > 0.6 && t < 0.18) return 'ice_spikes';
      return h > 0.5 ? 'snowy_taiga' : 'snowy_plains';
    }
    if (t < 0.4) {
      if (e > 0.84) return 'jagged_peaks';
      if (e > 0.74) return 'windswept_hills';
      if (h > 0.66 && zone.redwood > 0.35) return 'redwood_forest';
      if (h > 0.62) return 'old_growth_pine_taiga';
      return 'taiga';
    }
    if (t < 0.58) {
      if (e > 0.66 && zone.stony > 0.4) return 'stony_peaks';
      if (e > 0.86) return 'stony_peaks';
      if (e > 0.76) return h > 0.6 ? 'cherry_grove' : 'meadow';
      if (h > 0.62 && coast <= 10 && e < 0.56 && zone.swamp > 0.28) return 'swamp';
      if (h > 0.84) return 'dark_forest';
      if (h > 0.6) return detail > 0.72 ? 'flower_forest' : 'forest';
      if (h > 0.48) return 'birch_forest';
      return detail > 0.66 ? 'sunflower_plains' : 'plains';
    }
    if (t < 0.7) {
      if (h > 0.8 && coast <= 4 && e < 0.55) return 'mangrove_swamp';
      if (zone.plateau > 0.42 || e > 0.72) return 'savanna_plateau';
      if (h > 0.76) return 'sparse_jungle';
      if (zone.desert > 0.36 && detail < 0.74) return 'desert';
      return 'savanna';
    }
    if (h > 0.74 && coast <= 4 && e < 0.55) return 'mangrove_swamp';
    if (h > 0.62) return detail > 0.58 ? 'bamboo_jungle' : 'jungle';
    if (h > 0.5) return 'sparse_jungle';
    if (h < 0.26) return e > 0.5 ? 'wooded_badlands' : (zone.eroded > 0.4 ? 'eroded_badlands' : 'badlands');
    return zone.desert > 0.35 || h < 0.32 ? 'desert' : 'savanna';
  }

  function oceanBiome(t, depth) {
    const deep = depth > DEEP_DISTANCE;
    if (t < 0.3) return deep ? 'deep_cold_ocean' : 'cold_ocean';
    if (t < 0.55) return deep ? 'deep_ocean' : 'ocean';
    if (t < 0.7) return deep ? 'deep_lukewarm_ocean' : 'lukewarm_ocean';
    return 'warm_ocean';
  }

  const KEEP = { beach: 1, snowy_beach: 1, stony_shore: 1, lake: 1, frozen_ocean: 1, deep_frozen_ocean: 1, mushroom_fields: 1 };

  function absorbSmallZones(cells) {
    const isOcean = (key) => BIOMES[key].group === 'ocean';
    for (let pass = 0; pass < 4; pass++) {
      const seen = new Uint8Array(cells.length);
      let changed = false;
      for (let start = 0; start < cells.length; start++) {
        const key = cells[start];
        if (seen[start] || KEEP[key]) continue;
        const zone = [start];
        seen[start] = 1;
        const around = {};
        for (let head = 0; head < zone.length; head++) {
          const i = zone[head];
          const x = i % WIDTH;
          const y = (i - x) / WIDTH;
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT) return;
            const j = ny * WIDTH + nx;
            const other = cells[j];
            if (other === key) {
              if (!seen[j]) { seen[j] = 1; zone.push(j); }
            } else if (!KEEP[other] && isOcean(other) === isOcean(key)) {
              around[other] = (around[other] || 0) + 1;
            }
          });
        }
        if (zone.length >= MIN_ZONE) continue;
        const target = Object.keys(around).sort((a, b) => around[b] - around[a])[0];
        if (!target) continue;
        zone.forEach((i) => { cells[i] = target; });
        changed = true;
      }
      if (!changed) break;
    }
  }

  let world = null;

  function buildWorld() {
    if (world) return world;
    const shape = decodeShape();
    const isLand = (ch) => ch >= 'a' && ch <= 'z';
    const landDistance = distanceFrom(shape, isLand);
    const waterDistance = distanceFrom(shape, (ch) => !isLand(ch));
    const iceDistance = distanceFrom(shape, (ch) => ch !== '~');
    const biome = new Array(WIDTH * HEIGHT);
    const elevation = new Float32Array(WIDTH * HEIGHT);

    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const i = y * WIDTH + x;
        const ch = shape[i];
        if (isLand(ch)) {
          const coast = waterDistance[i];
          const e = elevationAt(x, y, coast);
          const t = temperatureAt(x, y) - Math.max(0, e - 0.62) * 0.55;
          const h = humidityAt(x, y) + (ISLAND_HUMIDITY[ch] || 0);
          const detail = fbm(x * 0.06 + 71.3, y * 0.06 + 12.9, 2);
          elevation[i] = e;
          const zone = {
            redwood: bump(x, y, 84, 22, 15), swamp: bump(x, y, 102, 78, 18), desert: bump(x, y, 176, 46, 13),
            stony: bump(x, y, 131, 17, 7), plateau: bump(x, y, 151, 37, 6), eroded: bump(x, y, 186, 51, 6)
          };
          biome[i] = FIXED[ch] || landBiome(t, h, e, detail, coast, zone);
        } else if (ch === ',') {
          biome[i] = 'lake';
        } else if (ch === '~') {
          biome[i] = iceDistance[i] > DEEP_ICE_DISTANCE ? 'deep_frozen_ocean' : 'frozen_ocean';
        } else {
          biome[i] = oceanBiome(temperatureAt(x, y), landDistance[i]);
        }
      }
    }

    absorbSmallZones(biome);
    const final = biome.slice();
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const i = y * WIDTH + x;
        if (!isLand(shape[i]) || FIXED[shape[i]]) continue;
        const b = biome[i];
        if (waterDistance[i] !== 1 || NO_SHORE[b]) continue;
        final[i] = COLD[b] ? 'snowy_beach' : (ROCKY[b] || elevation[i] > 0.78 ? 'stony_shore' : 'beach');
      }
    }

    absorbSmallZones(final);
    world = { shape, biome: final, landDistance, iceDistance, elevation };
    return world;
  }

  function hexRgb(hex) {
    const v = parseInt(String(hex).replace('#', ''), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  function toHex(rgb) {
    return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }

  function mixRgb(a, b, amount) {
    return a.map((v, k) => v + (b[k] - v) * amount);
  }

  function regions(cells, key) {
    const seen = new Uint8Array(cells.length);
    let best = null;
    for (let i = 0; i < cells.length; i++) {
      if (seen[i] || cells[i] !== key) continue;
      const stack = [i];
      seen[i] = 1;
      let count = 0;
      let sx = 0;
      let sy = 0;
      while (stack.length) {
        const j = stack.pop();
        const x = j % WIDTH;
        const y = (j - x) / WIDTH;
        count++;
        sx += x;
        sy += y;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT) return;
          const k = ny * WIDTH + nx;
          if (!seen[k] && cells[k] === key) { seen[k] = 1; stack.push(k); }
        });
      }
      if (!best || count > best.count) best = { count, x: sx / count, y: sy / count };
    }
    return best;
  }

  function cellColor(w, x, y, lit, marine) {
    const i = y * WIDTH + x;
    const own = w.biome[i];
    const info = BIOMES[own];
    const ocean = info.group === 'ocean';
    const water = ocean || own === 'river' || own === 'lake';
    let key = own;
    if (!water && hash(x * 3.1, y * 1.7) < 0.3) {
      const jx = x + (hash(x * 1.9, y * 4.3) < 0.5 ? -1 : 1);
      const jy = y + (hash(x * 1.3, y * 2.9) < 0.5 ? -1 : 1);
      if (jx >= 0 && jy >= 0 && jx < WIDTH && jy < HEIGHT) {
        const other = w.biome[jy * WIDTH + jx];
        const otherInfo = BIOMES[other];
        if (otherInfo.group !== 'ocean' && other !== 'river' && other !== 'lake') key = other;
      }
    }
    let rgb = hexRgb(BIOMES[key].color);
    const grain = (hash(x * 0.71, y * 1.13) - 0.5) * 0.035;
    if (ocean) {
      const depth = own === 'frozen_ocean' || own === 'deep_frozen_ocean' ? 0 : w.landDistance[i];
      if (depth === 1) rgb = mixRgb(rgb, [255, 255, 255], 0.1);
      else if (depth === 2) rgb = mixRgb(rgb, [255, 255, 255], 0.04);
      else if (depth > 2) rgb = mixRgb(rgb, [10, 18, 30], Math.min((depth - 2) / 20, 1) * 0.4);
      if (own === 'frozen_ocean' || own === 'deep_frozen_ocean') {
        const crack = hash(Math.floor(x / 3) * 5.3, Math.floor(y / 2) * 7.1) < 0.035;
        rgb = mixRgb(rgb, crack ? [120, 140, 150] : [255, 255, 255], crack ? 0.14 : Math.max(0, 0.1 - w.iceDistance[i] * 0.02));
      }
      rgb = rgb.map((v) => v * (1 + grain * 0.5));
    } else if (!water) {
      const e = w.elevation;
      const left = x > 0 ? e[i - 1] : e[i];
      const up = y > 0 ? e[i - WIDTH] : e[i];
      const relief = (e[i] - (left + up) / 2) * 1.1;
      rgb = rgb.map((v) => v * (1 + grain + relief));
      if (BIOMES[key].speck && hash(x * 2.3, y * 3.7) < 0.12) rgb = mixRgb(rgb, hexRgb(BIOMES[key].speck), 0.35);
      else if (BIOMES[key].trees && hash(x * 2.3, y * 3.7) < 0.06) rgb = mixRgb(rgb, [8, 14, 8], 0.1);
    }
    if (!lit) {
      const grey = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
      rgb = mixRgb(rgb, [grey, grey, grey], 0.35);
      rgb = mixRgb(rgb, hexRgb(BACKDROP), water ? (marine ? 0.5 : 0.22) : 0.45);
    }
    return toHex(rgb);
  }

  function drawSpawnMap(canvas, biomes, accent) {
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const w = buildWorld();
    const biome = w.biome;
    const active = activeSet(biomes);
    const any = Object.keys(active).length > 0;
    const marine = Object.keys(active).some((key) => BIOMES[key].group === 'ocean');
    const luma = (rgb) => rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
    let inkRgb = hexRgb(/^#[0-9a-f]{6}$/i.test(accent || '') ? accent : '#F2A32C');
    if (luma(inkRgb) < 60) inkRgb = hexRgb('#F2A32C');
    for (let step = 0; step < 4 && luma(inkRgb) < 175; step++) inkRgb = mixRgb(inkRgb, [255, 255, 255], 0.3);
    const ink = toHex(inkRgb);

    canvas.width = WIDTH * CELL;
    canvas.height = HEIGHT * CELL;
    context.fillStyle = BACKDROP;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        context.fillStyle = cellColor(w, x, y, !any || !!active[biome[y * WIDTH + x]], marine);
        context.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }

    context.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let x = 10; x < WIDTH; x += 10) context.fillRect(x * CELL, 0, 1, canvas.height);
    for (let y = 10; y < HEIGHT; y += 10) context.fillRect(0, y * CELL, canvas.width, 1);

    if (any) {
      const at = (x, y) => (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT ? null : biome[y * WIDTH + x]);
      context.save();
      context.shadowColor = ink;
      context.shadowBlur = 8;
      context.fillStyle = ink;
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          if (!active[biome[y * WIDTH + x]]) continue;
          const edge = !active[at(x + 1, y)] || !active[at(x - 1, y)] || !active[at(x, y + 1)] || !active[at(x, y - 1)];
          if (edge) context.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
      context.restore();
    }

    const frame = canvas.parentElement;
    const labels = frame && frame.querySelector('[data-map-labels]');
    if (labels) {
      const placed = [];
      labels.innerHTML = Object.keys(active).map((key) => {
        const spot = regions(biome, key);
        if (!spot) return '';
        const left = ((spot.x + 0.5) / WIDTH) * 100;
        const top = ((spot.y + 0.5) / HEIGHT) * 100;
        const side = left < 14 ? ' is-left' : (left > 86 ? ' is-right' : '');
        let under = top < 22;
        if (placed.some((p) => Math.abs(p.left - left) < 16 && Math.abs(p.top - top) < 14 && p.under === under)) under = !under;
        placed.push({ left, top, under });
        const below = under ? ' is-below' : '';
        return '<span class="atlas-pin' + side + below + '" style="left:' + left.toFixed(2) + '%;top:' + top.toFixed(2) + '%">'
          + '<i aria-hidden="true"></i><b>' + BIOMES[key].label + '</b></span>';
      }).join('');
    }

    const tip = frame && frame.querySelector('[data-map-tip]');
    if (tip && !canvas.dataset.tipBound) {
      canvas.dataset.tipBound = '1';
      canvas.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor(((event.clientX - rect.left) / rect.width) * WIDTH);
        const y = Math.floor(((event.clientY - rect.top) / rect.height) * HEIGHT);
        if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) { tip.hidden = true; return; }
        const key = buildWorld().biome[y * WIDTH + x];
        const lit = !!(canvas.dataset.active && canvas.dataset.active.split(',').indexOf(key) !== -1);
        tip.textContent = BIOMES[key].label + (lit ? ' · apparition' : '');
        tip.classList.toggle('is-active', lit);
        tip.hidden = false;
        const frameRect = frame.getBoundingClientRect();
        tip.style.left = Math.min(event.clientX - frameRect.left + 14, frameRect.width - tip.offsetWidth - 8) + 'px';
        tip.style.top = Math.max(event.clientY - frameRect.top - 34, 8) + 'px';
      });
      canvas.addEventListener('mouseleave', () => { tip.hidden = true; });
    }
    canvas.dataset.active = Object.keys(active).join(',');
  }

  const BIOME_BANDS = {};
  Object.keys(BIOMES).forEach((key) => {
    BIOME_BANDS[key] = {
      label: BIOMES[key].label,
      color: BIOMES[key].color,
      tags: [key].concat(Object.keys(ALIASES).filter((alias) => ALIASES[alias] === key))
    };
  });

  Object.assign(OW, { BIOME_BANDS, activeBands: activeSet, drawSpawnMap });
}(window.OW = window.OW || {}));
