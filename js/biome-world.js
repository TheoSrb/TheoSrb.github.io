/* Le monde des biomes : le decor qui vit derriere tout le site.

   Un calque fixe, sous le contenu, ou se succedent les biomes du mod a mesure
   qu'on descend dans la page. Chaque page entre dans le circuit par un biome
   different ; l'accueil commence toujours par la jungle.

   Tout est trace en cases, en SVG crispEdges : les plans sont des lignes de
   crete calculees colonne par colonne, les silhouettes des bords et du premier
   plan sont des sprites tramees. Le generateur est deterministe : un biome
   donne est le meme a chaque visite. Les couleurs vivent dans
   css/biome-world.css, une palette par biome. */

(function (OW) {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ===========================================================================
     Outils de trame
     =========================================================================== */

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function plot(cells, x, y) { cells.add(Math.round(x) + ',' + Math.round(y)); }
  function rect(cells, x, y, w, h) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) cells.add((x + i) + ',' + (y + j));
  }
  function line(cells, x0, y0, x1, y1, th) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 || 1;
    for (let k = 0; k <= n; k++) {
      const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
      for (let t = 0; t < (th || 1); t++) plot(cells, x + t, y);
    }
  }
  function ellipse(cells, cx, cy, a, b) {
    for (let y = Math.floor(cy - b); y <= cy + b; y++) {
      for (let x = Math.floor(cx - a); x <= cx + a; x++) {
        const u = (x + .5 - cx) / a, v = (y + .5 - cy) / b;
        if (u * u + v * v <= 1) cells.add(x + ',' + y);
      }
    }
  }
  /** Les cases exposees par le haut : la neige qui tient, la lumiere qui accroche. */
  function topEdge(cells, thick) {
    const out = new Set();
    cells.forEach((key) => {
      const [x, y] = key.split(',').map(Number);
      if (cells.has(x + ',' + (y - 1))) return;
      for (let t = 0; t < thick; t++) if (cells.has(x + ',' + (y + t))) out.add(x + ',' + (y + t));
    });
    return out;
  }

  /* Les cases d'un sprite, fusionnees en rectangles.

     Une case par sous-chemin donnait des SVG de dizaines de milliers de
     petits carres, que le navigateur rasterise a chaque repeinte. Les memes
     cases jointes en bandes horizontales, puis les bandes identiques de
     lignes voisines jointes en rectangles, couvrent exactement les memes
     pixels (le contour d'un rectangle est celui des cases qu'il remplace), pour
     bien moins de geometrie. Une case hors grille (coordonnee non entiere)
     reste seule. */
  function packRows(rows, extra) {
    let d = extra || '';
    const open = {};
    const flush = (key) => {
      const r = open[key];
      d += 'M' + r.x + ' ' + r.y + 'h' + r.w + 'v' + r.h + 'h-' + r.w + 'z';
      delete open[key];
    };
    Object.keys(rows).map(Number).sort((p, q) => p - q).forEach((y) => {
      const xs = rows[y].sort((p, q) => p - q);
      let start = xs[0], prev = xs[0];
      for (let k = 1; k <= xs.length; k++) {
        if (k < xs.length && (xs[k] === prev || xs[k] === prev + 1)) { prev = xs[k]; continue; }
        const w = prev - start + 1;
        const key = start + ',' + w;
        const r = open[key];
        if (r && r.last === y - 1) { r.h++; r.last = y; }
        else {
          if (r) flush(key);
          open[key] = { x: start, y, w, h: 1, last: y };
        }
        if (k < xs.length) { start = xs[k]; prev = xs[k]; }
      }
      /* Ce qui ne s'est pas prolonge sur cette ligne est termine. */
      Object.keys(open).forEach((key) => { if (open[key].last !== y) flush(key); });
    });
    Object.keys(open).forEach(flush);
    return d;
  }

  function cellsPath(cells) {
    const rows = {};
    let loose = '';
    cells.forEach((key) => {
      const i = key.indexOf(',');
      const x = +key.slice(0, i), y = +key.slice(i + 1);
      if (x !== Math.floor(x) || y !== Math.floor(y)) { loose += 'M' + x + ' ' + y + 'h1v1h-1z'; return; }
      (rows[y] = rows[y] || []).push(x);
    });
    return packRows(rows, loose);
  }

  /* ===========================================================================
     Lignes de crete

     Chaque generateur rend une hauteur par colonne. layerPath() la pose en
     marches. mode 1 aplanit le centre en plateau (le sol de la troupe) ;
     mode 2 le degage completement (un plafond qui laisse respirer le logo).
     =========================================================================== */

  const RIDGES = {
    /* Des couronnes d'arbres en demi-disque. */
    canopy(cols, seed, count, minR, maxR, base) {
      const r = rng(seed);
      const h = new Array(cols).fill(base);
      for (let i = 0; i < count; i++) {
        const cx = r() * cols, R = minR + r() * (maxR - minR);
        const top = base + R * .5 + r() * R * .9;
        for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
          if (x < 0 || x >= cols) continue;
          const dx = x + .5 - cx;
          if (Math.abs(dx) <= R) h[x] = Math.max(h[x], top - R + Math.sqrt(R * R - dx * dx));
        }
      }
      return h;
    },
    /* Des collines ou des dunes : une somme de sinus. */
    hills(cols, seed, amp, base) {
      const h = [];
      for (let x = 0; x < cols; x++) {
        const t = x / cols;
        h.push(base + Math.sin(t * 6.3 + seed) * amp * .55
          + Math.sin(t * 13.7 + seed * 2.1) * amp * .3
          + Math.sin(t * 29.1 + seed * .7) * amp * .15);
      }
      return h;
    },
    /* Des coniferes : des triangles aux flancs dentes. */
    pines(cols, seed, count, minH, maxH, base) {
      const r = rng(seed);
      const h = new Array(cols).fill(base);
      for (let i = 0; i < count; i++) {
        const cx = r() * cols, H = minH + r() * (maxH - minH);
        const half = H * .32, top = base + H;
        for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
          if (x < 0 || x >= cols) continue;
          const dx = Math.abs(x + .5 - cx);
          if (dx > half) continue;
          h[x] = Math.max(h[x], top - dx * (H / half) * .9 - (Math.floor(dx) % 2 ? 1.5 : 0));
        }
      }
      return h;
    },
    /* Des montagnes : de larges triangles aux flancs en escalier. */
    peaks(cols, seed, count, minH, maxH, base) {
      const r = rng(seed);
      const h = new Array(cols).fill(base);
      for (let i = 0; i < count; i++) {
        const cx = r() * cols, H = minH + r() * (maxH - minH);
        const half = H * (.9 + r() * .5), top = base + H;
        for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
          if (x < 0 || x >= cols) continue;
          const dx = Math.abs(x + .5 - cx);
          if (dx <= half) h[x] = Math.max(h[x], top - dx * (H / half));
        }
      }
      return h;
    },
    /* Des mesas, ou des iles au ras de l'eau : plateaux aux flancs raides. */
    mesas(cols, seed, count, base, minTop, maxTop, wMin, wMax) {
      const r = rng(seed);
      const h = new Array(cols).fill(base);
      for (let i = 0; i < count; i++) {
        const cx = r() * cols, w = wMin + r() * (wMax - wMin);
        const top = minTop + r() * (maxTop - minTop);
        for (let x = 0; x < cols; x++) {
          const dx = Math.abs(x + .5 - cx);
          const v = dx <= w ? top : top - Math.ceil(dx - w) * 2.5;
          h[x] = Math.max(h[x], v);
        }
      }
      return h;
    },
    /* La houle : une ligne plate hachee de cretes d'une case. */
    waves(cols, seed, base) {
      const h = [];
      for (let x = 0; x < cols; x++) {
        const s = Math.sin(x * .7 + seed) + Math.sin(x * 1.9 + seed * 2) * .5;
        h.push(base + (s > 1 ? 2 : s > .4 ? 1 : 0));
      }
      return h;
    }
  };

  function layerPath(spec) {
    const [type, cols, rows, ...args] = spec.g;
    const h = RIDGES[type].apply(null, [cols].concat(args));
    const base = type === 'mesas' ? args[2] : type === 'waves' ? args[1] : args[args.length - 1];
    let d = 'M0 ' + rows;
    let cap = '';
    for (let x = 0; x < cols; x++) {
      const k = Math.min(1, Math.abs((x + .5) / cols - .5) / .3);
      let v = h[x];
      if (spec.mode === 1) v = base * (1 - k) + v * k;
      if (spec.mode === 2) v = v * Math.pow(k, 1.6);
      const hv = Math.max(1, Math.min(rows, Math.round(v)));
      d += ' V' + (rows - hv) + ' H' + (x + 1);
      /* La neige sur les cimes : une calotte de quelques cases, seulement la
         ou le relief s'eleve au-dessus du fond. */
      if (spec.cap && hv > base + spec.cap) {
        const t = Math.min(spec.cap, Math.round((hv - base) * .35));
        cap += 'M' + x + ' ' + (rows - hv) + 'h1v' + t + 'h-1z';
      }
    }
    return { d: d + ' V' + rows + ' Z', cap, cols, rows };
  }

  /* ===========================================================================
     Sprites des bords
     =========================================================================== */

  const SPRITES = {
    cactus() {
      const c = new Set();
      rect(c, 6, 3, 4, 29); rect(c, 7, 2, 2, 1);
      rect(c, 2, 17, 5, 3); rect(c, 2, 9, 3, 9); rect(c, 3, 8, 1, 1);
      rect(c, 9, 13, 5, 3); rect(c, 11, 6, 3, 8); rect(c, 12, 5, 1, 1);
      return { w: 16, h: 32, d: cellsPath(c) };
    },
    palm() {
      const c = new Set();
      let tx = 0;
      for (let y = 51; y >= 16; y--) {
        const off = Math.round(Math.sin((51 - y) / 35 * 1.4) * 8);
        tx = 8 + off;
        rect(c, tx, y, y > 40 ? 3 : 2, 1);
      }
      const cx = tx + 1, cy = 15;
      [-172, -145, -115, -65, -35, -8, 18, 165].forEach((deg) => {
        const a = deg * Math.PI / 180;
        for (let t = 0; t <= 16; t += .5) {
          const px = cx + Math.cos(a) * t, py = cy + Math.sin(a) * t + t * t * .045;
          plot(c, px, py);
          plot(c, px, py + 1);
          /* Les folioles pendent sous la nervure, de plus en plus courtes. */
          if (t > 2 && t % 1 < .5) {
            const len = Math.max(1, Math.round((1 - t / 16) * 4));
            for (let k = 2; k <= len + 1; k++) plot(c, px - Math.sign(Math.cos(a)) * (k - 1) * .4, py + k);
          }
        }
      });
      rect(c, cx - 1, cy + 1, 2, 2); rect(c, cx + 1, cy + 2, 2, 2);
      return { w: 40, h: 52, d: cellsPath(c) };
    },
    acacia() {
      const c = new Set();
      rect(c, 19, 17, 2, 13);
      line(c, 19, 17, 13, 9, 2); line(c, 20, 17, 27, 9, 2);
      rect(c, 13, 3, 5, 1); rect(c, 22, 3, 6, 1); rect(c, 9, 4, 23, 1); rect(c, 5, 5, 31, 1);
      rect(c, 3, 6, 35, 2); rect(c, 4, 8, 33, 1);
      rect(c, 7, 9, 6, 1); rect(c, 16, 9, 9, 1); rect(c, 27, 9, 7, 1);
      return { w: 40, h: 30, d: cellsPath(c) };
    },
    /* Un chene des marais : un houppier large et plat, fait de touffes qui
       debordent, et les lianes qui pendent de tout son bord. */
    swampTree() {
      const c = new Set();
      const r = rng(9);
      rect(c, 21, 22, 5, 24); rect(c, 19, 40, 9, 6); rect(c, 16, 44, 15, 2);
      line(c, 22, 30, 12, 21, 2); line(c, 24, 29, 34, 20, 2); line(c, 23, 26, 22, 17, 2);
      [[22, 12, 12, 5], [9, 17, 9, 4], [35, 16, 9, 4], [15, 10, 7, 4], [30, 9, 8, 4], [3, 20, 4, 3], [41, 19, 4, 3], [22, 5, 7, 3]]
        .forEach(([x, y, a, b]) => ellipse(c, x, y, a, b));
      /* Le bord du houppier se decoupe en feuilles : quelques cases en moins,
         quelques cases en plus. */
      /* (Sur une copie : ajouter au Set pendant qu'on le parcourt faisait
         repousser chaque case ajoutee, et montait des colonnes verticales.) */
      [...c].forEach((key) => {
        const [x, y] = key.split(',').map(Number);
        if (y < 22 && !c.has(x + ',' + (y - 1)) && r() < .25) plot(c, x, y - 1);
      });
      for (let i = 0; i < 16; i++) {
        const x = 1 + Math.floor(r() * 43);
        let yb = 0;
        for (let y = 0; y < 30; y++) if (c.has(x + ',' + y) && y < 24) yb = y;
        if (!yb) continue;
        const len = 4 + Math.floor(r() * 14);
        for (let j = 1; j <= len; j++) plot(c, x + (j % 5 === 4 ? 1 : 0), yb + j);
        if (len > 6) { plot(c, x - 1, yb + len - 3); plot(c, x + 1, yb + len - 6); }
      }
      return { w: 46, h: 46, d: cellsPath(c) };
    },
    /* Un epicea charge de neige : cinq etages, la neige sur chaque rebord. */
    spruce() {
      const c = new Set();
      rect(c, 11, 34, 2, 6);
      for (let i = 0; i < 5; i++) {
        const y0 = 2 + i * 6;
        for (let row = 0; row < 8; row++) {
          const half = Math.round(1 + (row / 7) * (3 + i * 2));
          rect(c, 12 - half, y0 + row, half * 2, 1);
        }
      }
      return { w: 24, h: 40, d: cellsPath(c), d2: cellsPath(topEdge(c, 1)) };
    },
    /* Une algue geante qui ondule, frondes alternees. */
    kelp(i) {
      const c = new Set();
      for (let y = 0; y < 60; y++) {
        const x = 3 + Math.round(Math.sin(y * .22 + i) * 1.5);
        rect(c, x, y, 2, 1);
        if (y % 5 === 2 && y < 56) rect(c, (y % 10 === 2) ? x + 2 : x - 2, y, 2, 2);
      }
      return { w: 8, h: 60, d: cellsPath(c), sway: true };
    },
    /* Les grands futs, etires sur toute la hauteur de la scene. */
    jungleTrunk(i) {
      let d = 'M3 0h4v100h-4zM2 88h6v12h-6zM1 94h8v6h-8zM0 98h10v2h-10z';
      d += i % 2 ? 'M7 22h2v2h1v-4h-1v-2h-2z' : 'M1 30h2v-2h-1v-4h-1v2h-1v2h1z';
      return { w: 10, h: 100, d, full: true };
    },
    /* Une tige de bambou sur toute la hauteur : noeuds en anneau, et des
       gerbes de feuilles qui tombent des noeuds (le reflet --hi). */
    bambooStalk(i) {
      const c = new Set();
      const hi = new Set();
      rect(c, 6, 0, 3, 100);
      for (let y = 4 + (i % 3) * 3; y < 99; y += 11) {
        rect(c, 5, y, 5, 1);
        if (y > 70) continue;
        const dir = (y + i) % 22 < 11 ? 1 : -1;
        spray(hi, dir > 0 ? 8 : 6, y - 1, dir, 5, .6);
        spray(hi, dir > 0 ? 8 : 6, y + 1, dir, 4, 1.1);
      }
      return { w: 15, h: 100, d: cellsPath(c), d2: cellsPath(hi), full: true };
    },
    /* Un paletuvier : un houppier rond, perche sur ses racines en arches, et
       les propagules qui pendent. */
    mangroveTree() {
      const c = new Set();
      const crown = new Set();
      ellipse(crown, 24, 13, 22, 10);
      ellipse(crown, 12, 17, 10, 6); ellipse(crown, 37, 16, 10, 6);
      rect(c, 21, 20, 5, 15);
      [-18, -11, -5, 5, 11, 18].forEach((dx) => {
        line(c, 23, 30, 23 + dx, 44, 2);
        rect(c, 23 + dx, 44, 2, 12);
      });
      const r = rng(21);
      for (let k = 0; k < 9; k++) {
        const x = 6 + Math.floor(r() * 36);
        rect(c, x, 22 + Math.floor(r() * 3), 1, 3 + Math.floor(r() * 4));
      }
      return { w: 48, h: 56, d: cellsPath(c), d2: cellsPath(crown) };
    },
    /* Un arbre mort des badlands : un tronc qui se divise, sans une feuille. */
    deadTree() {
      const c = new Set();
      rect(c, 17, 30, 3, 12);
      (function branch(x, y, a, len, depth, th) {
        const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
        line(c, x, y, ex, ey, th);
        if (depth > 0) {
          branch(ex, ey, a - .55, len * .72, depth - 1, Math.max(1, th - 1));
          branch(ex, ey, a + .5, len * .66, depth - 1, Math.max(1, th - 1));
        }
      }(18, 31, -1.57, 11, 4, 2));
      return { w: 36, h: 42, d: cellsPath(c) };
    },
    /* Un cerisier : tronc tordu en encre, houppier rose porte par le reflet. */
    cherryTree() {
      const c = new Set();
      const crown = new Set();
      line(c, 25, 49, 23, 33, 3);
      line(c, 23, 34, 13, 23, 2);
      line(c, 24, 35, 34, 22, 2);
      line(c, 23, 30, 24, 16, 2);
      ellipse(crown, 13, 18, 12, 8); ellipse(crown, 34, 16, 13, 9); ellipse(crown, 24, 10, 11, 8);
      ellipse(crown, 5, 22, 5, 3); ellipse(crown, 44, 21, 5, 3);
      const r = rng(33);
      for (let k = 0; k < 10; k++) plot(crown, 4 + r() * 42, 25 + r() * 6);
      return { w: 50, h: 50, d: cellsPath(c), d2: cellsPath(crown) };
    },
    /* Un chene : tronc et branches en encre, houppier rond en feuillage. */
    oakTree() {
      const c = new Set();
      const crown = new Set();
      rect(c, 18, 24, 4, 24); rect(c, 16, 45, 8, 3);
      line(c, 19, 30, 10, 20, 2); line(c, 21, 29, 30, 19, 2);
      ellipse(crown, 20, 14, 17, 11); ellipse(crown, 8, 20, 8, 6); ellipse(crown, 32, 19, 8, 6); ellipse(crown, 21, 5, 10, 5);
      return { w: 40, h: 48, d: cellsPath(c), d2: cellsPath(crown) };
    },
    /* Un pic de glace et ses deux cadets : face eclairee en reflet. */
    iceSpike() {
      const c = new Set();
      const hi = new Set();
      function spike(cx, base, w, hgt) {
        for (let k = 0; k < hgt; k++) {
          const t = k / hgt;
          const cw = Math.max(1, Math.round(w * (1 - Math.pow(t, 1.5))));
          const x = Math.round(cx - cw / 2);
          rect(c, x, base - k, cw, 1);
          plot(hi, x, base - k);
          if (cw > 3) plot(hi, x + 1, base - k);
        }
      }
      spike(12, 59, 10, 58); spike(4, 59, 6, 26); spike(19, 59, 6, 34);
      return { w: 24, h: 60, d: cellsPath(c), d2: cellsPath(hi) };
    },
    /* Une paroi de grotte sur toute la hauteur, frangee de mousse. */
    caveWall(i) {
      const c = new Set();
      const hi = new Set();
      const r = rng(50 + i);
      let l = 1, rr = 10;
      for (let y = 0; y < 100; y++) {
        if (y % 4 === 0) { l = Math.max(0, Math.min(3, l + (r() < .5 ? -1 : 1))); rr = Math.max(8, Math.min(11, rr + (r() < .5 ? -1 : 1))); }
        rect(c, l, y, rr - l, 1);
        const mossy = (y > 8 && y < 22) || (y > 46 && y < 58) || y > 84;
        if (mossy) { plot(hi, i % 2 ? l : rr - 1, y); if (r() < .5) plot(hi, i % 2 ? l + 1 : rr - 2, y); }
      }
      return { w: 12, h: 100, d: cellsPath(c), d2: cellsPath(hi), full: true };
    },
    redwood(i) {
      let d = 'M2 0h6v100h-6zM1 86h8v14h-8zM0 94h10v6h-10z';
      d += i % 2 ? 'M8 24h2v1h-2zM8 52h2v1h-2z' : 'M0 36h2v1h-2zM0 64h2v1h-2z';
      return { w: 10, h: 100, d, full: true };
    }
  };

  function sidesHtml(spec) {
    return spec.items.map((it, i) => {
      const s = SPRITES[spec.kind](i);
      const cls = 'hb-sprite' + (it.far ? ' is-far' : '') + (it.flip ? ' is-flip' : '') + (s.full ? ' is-full' : '')
        + (s.sway ? ' is-sway' : '') + (it.left < 50 ? ' is-l' : ' is-r');
      const style = s.full
        ? 'left:' + it.left + '%;width:' + it.w + 'vw'
        : 'left:' + it.left + '%;bottom:' + it.bottom + '%;height:' + it.h + 'vh;width:' + (it.h * s.w / s.h).toFixed(2) + 'vh';
      return '<svg class="' + cls + '" viewBox="0 0 ' + s.w + ' ' + s.h + '"'
        + (s.full ? ' preserveAspectRatio="none"' : '')
        + ' style="' + style + (s.sway ? ';--d:' + (-i * 1.7).toFixed(1) + 's' : '') + '" aria-hidden="true"><path d="' + s.d + '"/>'
        + (s.d2 ? '<path class="hb-hi" d="' + s.d2 + '"/>' : '') + '</svg>';
    }).join('');
  }

  /* ===========================================================================
     Premier plan : le bouquet du coin bas-gauche (le droit est le meme, retourne)
     =========================================================================== */

  /** Une feuille tramee : ellipse, fentes regulieres depuis le bord, tige. */
  function leaf(c, cx, cy, a, b, angle, every, keep) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const ext = Math.ceil(a) + 1;
    for (let y = Math.floor(cy - ext); y <= cy + ext; y++) {
      for (let x = Math.floor(cx - ext); x <= cx + ext; x++) {
        const px = x + .5 - cx, py = y + .5 - cy;
        const u = px * cos + py * sin, v = -px * sin + py * cos;
        if ((u / a) * (u / a) + (v / b) * (v / b) > 1) continue;
        if (Math.abs(v) > b * keep && ((u + a) % every) < every * .22) continue;
        c.add(x + ',' + y);
      }
    }
    for (let t = 0; t < a * 1.4; t += .5) plot(c, cx - cos * (a + t), cy - sin * (a + t));
  }

  const CORNERS = {
    monstera(c) {
      leaf(c, 22, 38, 15, 9, -0.78, 5.2, .38);
      leaf(c, 38, 50, 14, 8.5, -0.29, 5.2, .38);
      leaf(c, 12, 24, 12, 7, -1.2, 5.2, .38);
    },
    palmFronds(c) {
      leaf(c, 24, 36, 20, 7, -0.78, 2.6, .3);
      leaf(c, 40, 50, 19, 6.5, -0.25, 2.6, .3);
      leaf(c, 12, 22, 16, 6, -1.25, 2.6, .3);
    },
    ferns(c) {
      [[0, 60, -0.35, 40], [0, 60, -0.8, 38], [0, 60, -1.25, 32], [6, 60, -0.1, 34]].forEach(([bx, by, a, L]) => {
        for (let t = 0; t <= L; t += .5) {
          const px = bx + Math.cos(a) * t, py = by + Math.sin(a) * t + t * t * .018;
          plot(c, px, py);
          if (t > 1 && t % 2 < .5) {
            const len = Math.max(1, Math.round((1 - t / L) * 7));
            for (let k = 1; k <= len; k++) {
              plot(c, px + Math.cos(a - 1.2) * k, py + Math.sin(a - 1.2) * k);
              plot(c, px + Math.cos(a + 1.2) * k, py + Math.sin(a + 1.2) * k);
            }
          }
        }
      });
    },
    reeds(c) {
      const r = rng(5);
      for (let i = 0; i < 14; i++) {
        const x = 1 + i * 2.3 + r() * 1.5, h = 20 + r() * 34, lean = (r() - .3) * .25;
        for (let t = 0; t < h; t++) plot(c, x + lean * t, 59 - t);
        if (r() < .65) {
          const cx = Math.round(x + lean * h), top = Math.round(59 - h);
          rect(c, cx, top, 2, 5); plot(c, cx, top - 1); plot(c, cx, top - 2);
        }
      }
      for (let j = 0; j < 10; j++) {
        const bx = r() * 30, L = 10 + r() * 20, a = -1.57 + (r() - .5) * 1.1;
        for (let t = 0; t < L; t += .5) plot(c, bx + Math.cos(a) * t + t * t * .01, 59 + Math.sin(a) * t);
      }
    },
    grass(c) {
      const r = rng(3);
      for (let i = 0; i < 64; i++) {
        const bx = r() * 38, L = 8 + r() * 34 * (1 - bx / 52);
        const a = -1.57 + (r() - .35) * .9, bend = (r() - .5) * .03;
        for (let t = 0; t < L; t += .5) plot(c, bx + Math.cos(a) * t + bend * t * t, 59 + Math.sin(a) * t);
      }
    },
    snowRocks(c) {
      ellipse(c, 12, 57, 15, 8); ellipse(c, 30, 59, 9, 5); ellipse(c, 6, 47, 7, 5);
      for (let i = 0; i < 4; i++) {
        const y0 = 22 + i * 7;
        for (let row = 0; row < 8; row++) {
          const half = Math.round(1 + (row / 7) * (2 + i * 1.6));
          rect(c, 44 - half, y0 + row, half * 2, 1);
        }
      }
      rect(c, 43, 53, 2, 7);
      c.hi = topEdge(c, 2);
    },
    coral(c) {
      const glow = new Set();
      function branch(x, y, a, len, depth) {
        const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
        line(c, x, y, ex, ey, 2);
        if (depth > 0) {
          branch(ex, ey, a - .45, len * .72, depth - 1);
          branch(ex, ey, a + .4, len * .7, depth - 1);
        } else {
          rect(glow, Math.round(ex), Math.round(ey) - 1, 2, 2);
        }
      }
      branch(14, 58, -1.45, 12, 3);
      branch(34, 58, -1.7, 9, 3);
      /* Un eventail de gorgone, ajoure en grille. */
      for (let y = 30; y < 50; y++) {
        for (let x = 0; x < 16; x++) {
          const u = (x - 6) / 10, v = (y - 44) / 14;
          if (u * u + v * v <= 1 && (x % 3 !== 1 || y % 3 !== 1)) c.add(x + ',' + y);
        }
      }
      rect(c, 5, 44, 2, 16);
      /* Des eponges en tubes. */
      rect(c, 44, 46, 4, 14); rect(c, 49, 50, 3, 10); rect(c, 40, 52, 3, 8);
      rect(glow, 44, 45, 4, 1); rect(glow, 49, 49, 3, 1); rect(glow, 40, 51, 3, 1);
      ellipse(c, 24, 60, 18, 4);
      c.hi = glow;
    },
    /* Un herbier : des rubans d'herbe marine qui ondulent depuis le sable, et
       quelques pointes qui accrochent la lumiere tombee de la surface. */
    seagrass(c) {
      const r = rng(21);
      const glow = new Set();
      for (let i = 0; i < 26; i++) {
        const bx = 2 + r() * 44;
        const L = 10 + r() * 34 * (1 - bx / 64);
        const phase = r() * 6;
        let x = bx;
        let y = 59;
        for (let t = 0; t < L; t += 1) {
          x = bx + Math.sin(t * .18 + phase) * 2.2 * (t / L);
          y = 59 - t;
          rect(c, Math.round(x), Math.round(y), 2, 1);
        }
        if (i % 4 === 0) rect(glow, Math.round(x), Math.round(y) - 1, 2, 2);
      }
      ellipse(c, 20, 60, 22, 3);
      c.hi = glow;
    },
    /* Trois grosses tiges de bambou et leurs feuilles en lame. */
    bambooCorner(c) {
      [[5, 62], [16, 50], [27, 58], [38, 34]].forEach(([x, hgt], i) => {
        for (let y = 59; y > 59 - hgt; y--) {
          rect(c, x, y, 3, 1);
          if ((59 - y) % 10 === 9) rect(c, x - 1, y, 5, 1);
        }
        for (let n = 0; n < 3; n++) {
          const y = 59 - hgt + 5 + n * 9;
          const right = (n + i) % 2 === 0;
          leaf(c, x + (right ? 10 : -7), y + 3, 7, 1.7, right ? .5 : Math.PI - .5, 100, 1);
        }
      });
    },
    /* Les racines de paletuvier : des arches qui plongent dans l'eau. */
    mangroveRoots(c) {
      [[10, 60, 10, 20], [24, 60, 9, 26], [36, 60, 8, 16], [4, 60, 6, 12]].forEach(([cx, base, a, hgt]) => {
        for (let t = 0; t <= Math.PI; t += .04) {
          const x = cx + Math.cos(t) * a, y = base - Math.sin(t) * hgt;
          rect(c, Math.round(x), Math.round(y), 2, 1);
        }
      });
      rect(c, 22, 20, 4, 16);
      ellipse(c, 16, 16, 14, 7); ellipse(c, 6, 20, 7, 4);
      leaf(c, 36, 26, 9, 3, -0.4, 100, 1);
    },
    /* Une prairie fleurie : l'herbe en encre, les fleurs en couleur. */
    flowers(c) {
      const r = rng(8);
      const hi = new Set();
      for (let i = 0; i < 48; i++) {
        const bx = r() * 40, L = 8 + r() * 30 * (1 - bx / 56);
        const a = -1.57 + (r() - .35) * .8;
        let tx = bx, ty = 59;
        for (let t = 0; t < L; t += .5) { tx = bx + Math.cos(a) * t; ty = 59 + Math.sin(a) * t; plot(c, tx, ty); }
        if (i % 3 === 0) { rect(hi, Math.round(tx) - 1, Math.round(ty) - 2, 3, 2); plot(hi, tx, ty - 3); }
      }
      c.hi = hi;
    },
    /* Un eboulis de roche, deux stalagmites, un peu de mousse sur le dessus. */
    caveCorner(c) {
      ellipse(c, 12, 58, 17, 8); ellipse(c, 32, 60, 9, 4); ellipse(c, 4, 48, 6, 6);
      [[16, 50, 4, 20], [26, 56, 3, 14], [8, 43, 2, 8]].forEach(([x, base, w, hgt]) => {
        for (let j = 0; j < hgt; j++) rect(c, x - Math.round(w * (1 - j / hgt) / 2), base - j, Math.max(1, Math.round(w * (1 - j / hgt))), 1);
      });
      const top = topEdge(c, 1);
      const r = rng(4);
      c.hi = new Set([...top].filter(() => r() < .45));
    },
    /* Des blocs de glace empiles, la neige sur chaque rebord. */
    iceChunks(c) {
      rect(c, 0, 42, 17, 18); rect(c, 15, 49, 15, 11); rect(c, 3, 31, 10, 11); rect(c, 29, 54, 11, 6);
      rect(c, 8, 22, 3, 9); rect(c, 9, 17, 1, 5);
      rect(c, 44, 56, 6, 4);
      c.hi = topEdge(c, 2);
    },
    deadBush(c) {
      ellipse(c, 10, 58, 16, 7); ellipse(c, 27, 59, 8, 4);
      (function branch(x, y, a, len, depth) {
        const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
        line(c, x, y, ex, ey, 1);
        if (depth > 0) {
          branch(ex, ey, a - .5, len * .7, depth - 1);
          branch(ex, ey, a + .45, len * .65, depth - 1);
        }
      }(20, 52, -1.5, 11, 4));
      rect(c, 40, 42, 3, 16); rect(c, 37, 48, 3, 2); rect(c, 37, 44, 2, 5); rect(c, 43, 46, 3, 2); rect(c, 44, 41, 2, 6);
    }
  };
  const cornerCache = {};
  function cornerPath(kind) {
    if (!cornerCache[kind]) {
      const c = new Set();
      CORNERS[kind](c);
      cornerCache[kind] = {
        grid: c.grid || 60,
        html: '<path d="' + cellsPath(c) + '"/>' + (c.hi ? '<path class="hb-hi" d="' + cellsPath(c.hi) + '"/>' : '')
      };
    }
    return cornerCache[kind];
  }

  /** Une liane : un fil qui ondule d'une case, des feuilles de part et d'autre. */
  function vineSvg(len, seed) {
    const r = rng(seed);
    let d = '';
    let x = 2;
    for (let y = 0; y < len; y++) {
      if (y % 3 === 0 && r() < .6) x = x === 2 ? 3 : 2;
      d += 'M' + x + ' ' + y + 'h1v1h-1z';
      if (y > 2 && y % 4 === 1) d += 'M' + (r() < .5 ? x - 2 : x + 1) + ' ' + y + 'h2v1h-2z';
    }
    d += 'M' + (x - 1) + ' ' + len + 'h3v2h-3z';
    return '<svg viewBox="0 0 6 ' + (len + 2) + '" shape-rendering="crispEdges"><path d="' + d + '"/></svg>';
  }

  /* ===========================================================================
     Les plans peints

     Une ligne de crete ne donne qu'une silhouette d'une seule couleur. Certains
     biomes demandent plus : des arbres roses sur une prairie verte, une
     banquise blanche sur l'eau bleue, des baies lumineuses sous la roche.
     Un plan peint rend plusieurs jeux de cases, un par role (a, b, c, d, e),
     chacun colore par la palette du biome : --far-b, --mid-c, --near-e...
     (le role a prend la couleur du plan). La grille garde des cases carrees :
     le plan est cadre par le bas (ou par le haut pour une voute) et rogne
     sur les cotes plutot qu'etire.
     =========================================================================== */

  /** Les cases d'un role, fusionnees en bandes horizontales, bornees au cadre. */
  function runsPath(cells, W, H) {
    const rows = {};
    let loose = '';
    cells.forEach((key) => {
      const i = key.indexOf(',');
      const x = +key.slice(0, i), y = +key.slice(i + 1);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      if (x !== Math.floor(x) || y !== Math.floor(y)) { loose += 'M' + x + ' ' + y + 'h1v1h-1z'; return; }
      (rows[y] = rows[y] || []).push(x);
    });
    return packRows(rows, loose);
  }

  const roles = () => ({ a: new Set(), b: new Set(), c: new Set(), d: new Set(), e: new Set() });

  /** Une gerbe de feuilles tombantes, depuis (x, y), vers dir (-1 ou 1). */
  function spray(set, x, y, dir, len, droop) {
    for (let k = 1; k <= len; k++) {
      const ly = y + Math.round(k * droop);
      plot(set, x + dir * k, ly);
      if (k > 1 && k < len - 1) plot(set, x + dir * k, ly + 1);
    }
  }

  /** Une ligne de sol ondulee : la hauteur du sol a chaque colonne. */
  function groundLine(W, H, r, base, amp, freq) {
    const ph = r() * 10;
    const g = [];
    for (let x = 0; x < W; x++) {
      g.push(Math.round(H - base - Math.sin(x * freq + ph) * amp - Math.sin(x * freq * 2.7 + ph * 1.7) * amp * .35));
    }
    return g;
  }

  const PAINTS = {
    /* Une bambouseraie : des tiges segmentees qui montent hors du cadre, leurs
       noeuds en anneau (c), des gerbes de feuilles qui tombent des noeuds
       superieurs (b). */
    bambooGrove(W, H, r, o) {
      const S = roles();
      const ground = H - (o.ground || 0);
      for (let i = 0; i < o.count; i++) {
        const x0 = r() * W;
        const w = o.width + (r() < (o.thick || 0) ? 1 : 0);
        const top = Math.round(o.top[0] + r() * (o.top[1] - o.top[0]));
        const lean = (r() - .5) * (o.lean || .08);
        const seg = o.seg || 8;
        let next = ground - 2 - Math.floor(r() * seg);
        for (let y = ground; y >= top; y--) {
          const x = Math.round(x0 + lean * (ground - y));
          rect(S.a, x, y, w, 1);
          if (y !== next) continue;
          rect(S.c, x - 1, y, w + 2, 1);
          next -= seg + Math.floor(r() * 3);
          if (y < ground - (ground - top) * .3 && r() < o.leaf) {
            const dir = r() < .5 ? -1 : 1;
            const len = o.leafLen[0] + Math.floor(r() * (o.leafLen[1] - o.leafLen[0]));
            const edge = dir > 0 ? x + w - 1 : x;
            spray(S.b, edge, y - 1, dir, len, .55);
            if (r() < .7) spray(S.b, edge, y + 1, dir, Math.max(2, len - 2), .95);
          }
        }
        if (top > -3) {
          const x = Math.round(x0 + lean * (ground - top));
          for (let s = 0; s < 4; s++) spray(S.b, x, top + s, s % 2 ? 1 : -1, 3 + Math.floor(r() * 4), .7);
        }
      }
      return S;
    },

    /* Une voute de feuillage : un bandeau dentele d'ou pendent des brins de
       feuilles (b). `open` degage le centre pour laisser le ciel. */
    leafCanopy(W, H, r, o) {
      const S = roles();
      for (let x = 0; x < W; x++) {
        const k = Math.min(1, Math.abs((x + .5) / W - .5) / .34);
        const lobe = o.lobes ? Math.abs(Math.sin(x * .45)) * 3 + Math.abs(Math.sin(x * .17 + 1)) * 2 : 0;
        const depth = Math.round((o.depth + lobe + Math.sin(x * .31) * 2 + Math.sin(x * .07) * 3 + r() * 2) * (o.open ? Math.pow(k, 1.4) : 1));
        if (depth <= 0) continue;
        rect(S.a, x, 0, 1, depth);
        if (o.dapple) for (let y = 0; y < depth - 1; y++) if (r() < o.dapple) plot(S.d, x, y);
        if (o.dapple && r() < .5) plot(S.d, x, depth - 1);
        if (r() < o.fringe) {
          const len = 2 + Math.floor(r() * o.droop);
          let lx = x;
          for (let j = 1; j <= len; j++) {
            if (j % 3 === 0) lx += r() < .5 ? -1 : 1;
            plot(S.b, lx, depth + j - 1);
          }
          if (o.bloom && r() < o.bloom) rect(S.c, lx - 1, depth + len - 1, 3, 2);
        }
      }
      return S;
    },

    /* Une prairie : sol vert (a), touffes d'herbe (b), et au choix des petales
       (e) semes au sol, des fleurs (d) sur leur tige. */
    meadow(W, H, r, o) {
      const S = roles();
      const g = groundLine(W, H, r, o.base, o.amp || 2, o.freq || .09);
      for (let x = 0; x < W; x++) {
        const top = g[x];
        rect(S.a, x, top, 1, H - top);
        if (r() < (o.tuft != null ? o.tuft : .35)) rect(S.b, x, top - 1 - Math.floor(r() * 2), 1, 2);
        if (o.pebbles && r() < o.pebbles) { const pw = 2 + Math.floor(r() * 3); rect(S.b, x, top - 1, pw, 1); if (pw > 3) rect(S.b, x + 1, top - 2, pw - 2, 1); }
        if (r() < (o.petals || 0)) plot(S.e, x, top + Math.floor(r() * Math.min(4, H - top)));
        if (r() < (o.flowers || 0)) { plot(S.b, x, top - 1); plot(S.d, x, top - 2); }
      }
      return S;
    },

    /* Un bosquet sur une prairie : sol (a), troncs (c), houppiers (b) et leur
       lumiere (d). `birch` melange des bouleaux (tronc e, marques c) ;
       `petals` seme des petales (e) au pied des arbres. */
    grove(W, H, r, o) {
      const S = roles();
      const g = groundLine(W, H, r, o.base, o.amp || 2, o.freq || .07);
      for (let x = 0; x < W; x++) rect(S.a, x, g[x], 1, H - g[x]);
      const trees = [];
      for (let i = 0; i < o.count; i++) trees.push({ x: Math.round((i + .15 + r() * .7) * W / o.count), s: o.size[0] + r() * (o.size[1] - o.size[0]) });
      trees.forEach((t) => {
        const gy = g[Math.max(0, Math.min(W - 1, t.x))];
        const trunkH = Math.round(o.trunk * t.s);
        const R = o.crown * t.s;
        const birch = o.birch && r() < o.birch;
        const tw = t.s > 1.05 ? 2 : 1 + (r() < .4 ? 1 : 0);
        rect(birch ? S.e : S.c, t.x, gy - trunkH, tw, trunkH + 1);
        if (birch) for (let y = gy - trunkH; y < gy; y += 3 + Math.floor(r() * 2)) plot(S.c, t.x + (r() < .5 ? 0 : tw - 1), y);
        if (!birch && trunkH > 6) {
          line(S.c, t.x, gy - trunkH * .55, t.x - R * .5, gy - trunkH * .9, 1);
          line(S.c, t.x + tw - 1, gy - trunkH * .6, t.x + R * .5, gy - trunkH * .95, 1);
        }
        const cy = gy - trunkH - R * .35;
        const rr = birch ? R * .75 : R;
        ellipse(S.b, t.x, cy, rr, rr * .72);
        ellipse(S.b, t.x - rr * .7, cy + rr * .3, rr * .6, rr * .45);
        ellipse(S.b, t.x + rr * .7, cy + rr * .25, rr * .62, rr * .46);
        ellipse(S.b, t.x + rr * .1, cy - rr * .45, rr * .6, rr * .45);
        ellipse(S.d, t.x - rr * .3, cy - rr * .35, rr * .45, rr * .3);
        if (o.petals) {
          for (let k = 0; k < rr * 3 * o.petals; k++) {
            const px = Math.round(t.x + (r() - .5) * rr * 2.6);
            if (px < 0 || px >= W) continue;
            plot(S.e, px, g[px] + Math.floor(r() * 2));
          }
          for (let k = 0; k < rr * o.petals; k++) plot(S.e, t.x + (r() - .5) * rr * 2, cy + rr * .6 + r() * (trunkH * .8));
        }
      });
      return S;
    },

    /* Une mangrove dans l'eau : des paletuviers de toutes tailles, plus
       petits vers l'horizon, houppiers (a) eclaires (b), troncs, racines en
       arches et propagules (c) qui plongent sous la ligne d'eau. */
    mangroveStand(W, H, r, o) {
      const S = roles();
      const wl = o.water;
      const trees = [];
      for (let i = 0; i < o.count; i++) trees.push({ x: r() * W, y0: wl + 1 + Math.pow(r(), 1.3) * (H - wl - 3) });
      trees.sort((p, q) => p.y0 - q.y0);
      trees.forEach((t) => {
        /* Un arbre ne depasse jamais le haut du cadre : sa taille est bornee
           par la place qu'il a au-dessus de lui. */
        const s = Math.min(.7 + (t.y0 - wl) / (H - wl) * 1.6, (t.y0 - 2) / 21);
        const rootH = 7 * s, trunkH = 6 * s, R = 9 * s;
        const x = Math.round(t.x), y0 = Math.round(t.y0);
        const rootTop = y0 - rootH;
        const trunkTop = rootTop - trunkH;
        rect(S.c, x, trunkTop, Math.max(1, Math.round(1.6 * s)), trunkH + 1);
        /* Les racines en arches, tracees segment par segment : un trait
           continu, sans case manquante, plus epais pour les grands arbres. */
        const n = 3 + Math.round(s * 1.5);
        const th = s > 1.3 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const dx = (k - (n - 1) / 2) * 2.6 * s;
          let px0 = x, py0 = rootTop;
          for (let t2 = .1; t2 <= 1.001; t2 += .1) {
            const px = x + dx * t2;
            const py = rootTop + Math.sin(t2 * Math.PI * .5) * rootH - Math.sin(t2 * Math.PI) * 2 * s;
            /* De loin en loin, un segment manque : une racine n'est pas un fil. */
            if (t2 < .15 || r() > .07) line(S.c, px0, py0, px, py, th);
            px0 = px; py0 = py;
          }
          rect(S.c, Math.round(px0), Math.round(py0), th, 2);
        }
        const cy = trunkTop - R * .3;
        ellipse(S.a, x, cy, R, R * .55);
        ellipse(S.a, x - R * .75, cy + R * .2, R * .55, R * .38);
        ellipse(S.a, x + R * .8, cy + R * .15, R * .55, R * .38);
        ellipse(S.b, x - R * .25, cy - R * .25, R * .5, R * .25);
        for (let k = 0; k < 4 * s; k++) rect(S.c, Math.round(x + (r() - .5) * R * 1.6), Math.round(cy + R * .4), 1, 1 + Math.round(r() * 2 * s));
      });
      return S;
    },

    /* Des pics de glace : des aiguilles effilees par paliers (a), leur face
       eclairee (b), plantees sur la banquise lointaine. */
    iceSpikes(W, H, r, o) {
      const S = roles();
      const base = H - (o.sheet || 2);
      for (let i = 0; i < o.count; i++) {
        const cx = r() * W;
        const w = o.w[0] + Math.floor(r() * (o.w[1] - o.w[0]));
        const hgt = o.h[0] + r() * (o.h[1] - o.h[0]);
        for (let k = 0; k < hgt; k++) {
          const t = k / hgt;
          const cw = Math.max(1, Math.round(w * (1 - Math.pow(t, 1.15))));
          const x = Math.round(cx - cw / 2);
          rect(S.a, x, base - k, cw, 1);
          rect(S.b, x, base - k, Math.max(1, Math.floor(cw * .4)), 1);
        }
      }
      rect(S.a, 0, base, W, H - base);
      rect(S.b, 0, base, W, 1);
      return S;
    },

    /* La banquise en plaques : des radeaux de glace, plus grands et plus
       epais a mesure qu'ils approchent, leur dessus de neige (b), leur tranche
       bleue (a), l'eau entre eux. */
    floes(W, H, r, o) {
      const S = roles();
      let y = o.y0;
      let th = 1.6;
      while (y < H) {
        let x = -Math.floor(r() * 12);
        const grow = 1 + (y / H) * 2.2;
        while (x < W) {
          const len = Math.round((7 + r() * 18) * grow);
          const top = Math.max(1, Math.round(th));
          rect(S.b, x, y, len, top);
          rect(S.b, x + 1, y - 1, len - 2, 1);
          rect(S.a, x, y + top, len, Math.max(1, Math.round(th * .8)));
          if (len > 10 && r() < .5) plot(S.c, x + Math.floor(len * r()), y);
          x += len + 2 + Math.floor(r() * 7 * grow);
        }
        y += Math.round(th * 2 + 3 + r() * 2);
        th *= 1.45;
      }
      return S;
    },

    /* Le rebord de banquise au premier plan : neige (b), tranche de glace (a),
       quelques fissures (c). */
    iceShelf(W, H, r, o) {
      const S = roles();
      const g = groundLine(W, H, r, o.base, 1.2, .05);
      for (let x = 0; x < W; x++) {
        const top = g[x];
        rect(S.b, x, top, 1, 2);
        rect(S.a, x, top + 2, 1, H - top - 2);
        if (r() < .05) rect(S.c, x, top + 2, 1, 2 + Math.floor(r() * 4));
      }
      return S;
    },

    /* La voute d'une grotte luxuriante : la roche (a) ouverte en son centre
       sur le ciel, des stalactites, la mousse sur le rebord (c), des fleurs
       de spores roses (b), des lianes (d) chargees de baies lumineuses (e). */
    caveRoof(W, H, r, o) {
      const S = roles();
      const edge = [];
      for (let x = 0; x < W; x++) {
        const k = Math.abs((x + .5) / W - (o.holeAt || .5)) / o.hole;
        let d = o.depth + Math.sin(x * .23) * 2 + Math.sin(x * .061) * 3 + r() * 1.5;
        if (k < 1) d *= Math.pow(k, 2.2) * .7;
        d = Math.max(0, Math.round(d));
        edge.push(d);
        if (d) rect(S.a, x, 0, 1, d);
      }
      for (let x = 0; x < W; x++) {
        const d = edge[x];
        if (!d) continue;
        const nearHole = Math.abs((x + .5) / W - (o.holeAt || .5)) / o.hole < 1.5;
        if (nearHole || r() < (o.moss != null ? o.moss : .35)) rect(S.c, x, d - 1, 1, 1 + (r() < .4 ? 1 : 0));
        if (o.lichen && r() < o.lichen) plot(S.e, x, d - 2 - Math.floor(r() * 4));
        if (nearHole && r() < .3) rect(S.c, x, d, 1, 1 + Math.floor(r() * 3));
        if (r() < (o.stalactites || .08) && d > 3) {
          const len = 3 + Math.floor(r() * 7);
          for (let j = 0; j < len; j++) rect(S.a, x, d + j, j < len * .5 ? 2 : 1, 1);
        }
        if (r() < o.blossom) { rect(S.b, x - 1, d + 1, 3, 1); rect(S.b, x - 2, d + 2, 5, 1); plot(S.c, x, d); }
        if (r() < o.vines) {
          const len = 6 + Math.floor(r() * o.vineLen);
          let vx = x;
          for (let j = 0; j < len; j++) {
            if (j % 4 === 3) vx += r() < .5 ? -1 : 1;
            plot(S.d, vx, d + j);
            if (j % 3 === 2) plot(S.e, vx + (j % 6 === 2 ? 1 : -1), d + j);
          }
        }
      }
      return S;
    },

    /* Les corniches de la grotte, de part et d'autre du bassin : roche (a),
       tapis de mousse (c), buissons d'azalee (b) fleuris (e), grandes feuilles
       plates (d) penchees au-dessus de l'eau. */
    mossLedges(W, H, r, o) {
      const S = roles();
      const tops = {};
      function ledge(x0, x1, dir) {
        for (let x = x0; x < x1; x++) {
          const t = dir > 0 ? (x - x0) / (x1 - x0) : (x1 - x) / (x1 - x0);
          const hh = Math.round(o.low + (1 - t) * o.rise + Math.sin(x * .4) * 1.2 + (Math.floor(x / 7) % 2));
          const top = H - hh;
          tops[x] = top;
          rect(S.a, x, top, 1, hh);
          if (r() < (o.moss != null ? o.moss : 1)) rect(S.c, x, top, 1, 1 + (r() < .45 ? 1 : 0));
          if (r() < .1 * (o.moss != null ? o.moss : 1)) rect(S.c, x, top + 2, 1, 1 + Math.floor(r() * 3));
          if (o.stalagmites && r() < o.stalagmites) {
            const sh = 2 + Math.floor(r() * 6);
            for (let j = 1; j <= sh; j++) rect(S.a, x, top - j, j < sh * .5 ? 2 : 1, 1);
          }
          if (r() < (o.bushes != null ? o.bushes : .05)) {
            const bx = x, by = top - 2, br = 2 + Math.floor(r() * 3);
            ellipse(S.b, bx, by, br, br * .7);
            for (let k = 0; k < br * 2; k++) plot(S.e, bx + (r() - .5) * br * 1.6, by + (r() - .5) * br);
          }
        }
        /* Les grandes feuilles, au bord du bassin, penchees vers l'eau. */
        const inner = dir > 0 ? x1 - 3 : x0 + 2;
        for (let k = 0; k < (o.leaves === false ? 0 : 3); k++) {
          const sx = inner - dir * k * 6;
          const base = tops[sx] != null ? tops[sx] : H - o.low;
          const stemH = 7 + k * 3 + Math.floor(r() * 4);
          for (let j = 0; j < stemH; j++) plot(S.d, sx + Math.round(j * .18 * dir), base - j);
          const lx = sx + Math.round(stemH * .18 * dir), ly = base - stemH;
          rect(S.d, lx - 3, ly, 7, 1);
          rect(S.d, lx - 2, ly - 1, 5, 1);
        }
      }
      ledge(0, Math.round(W * o.gap[0]), 1);
      ledge(Math.round(W * o.gap[1]), W, -1);
      /* Des filons de charbon, en petits amas bien loges dans la roche : un
         amas n'est pose que s'il est entoure de pierre, jamais au bord. */
      if (o.ores) S.a.forEach((key) => {
        if (r() > o.ores) return;
        const [x, y] = key.split(',').map(Number);
        const inside = [[-1, -1], [2, -1], [-1, 2], [2, 2], [0, -2], [0, 3]].every(([dx, dy]) => S.a.has((x + dx) + ',' + (y + dy)));
        if (!inside) return;
        plot(S.b, x, y); plot(S.b, x + 1, y); plot(S.b, x, y + 1);
        if (r() < .6) plot(S.b, x + 1, y + 1);
        if (r() < .4) plot(S.b, x + 2, y + 1);
      });
      /* Des torches plantees sur les corniches : un baton (d), une flamme (e). */
      for (let k = 0; k < (o.torches || 0); k++) {
        const tx = Math.round(k % 2 ? W * (o.gap[1] + .08 + r() * .15) : W * (o.gap[0] - .1 - r() * .15));
        const ty = tops[tx];
        if (ty == null) continue;
        rect(S.d, tx, ty - 4, 1, 4);
        rect(S.e, tx, ty - 6, 1, 2);
        plot(S.e, tx, ty - 7);
      }
      return S;
    }
  };

  /* ===========================================================================
     Les biomes
     =========================================================================== */

  const BIOMES = [
    {
      id: 'jungle', label: 'Jungle',
      far: { h: 48, g: ['canopy', 96, 40, 7, 30, 3, 7, 22] },
      mid: { h: 38, g: ['canopy', 72, 30, 3, 20, 3, 6, 14] },
      near: { h: 26, g: ['canopy', 60, 20, 11, 16, 2, 5, 11], mode: 1 },
      ceiling: { h: 30, paint: ['leafCanopy', 150, 40, 5, { depth: 7, fringe: .5, droop: 7, open: true, dapple: .12, lobes: true }] },
      vines: 12,
      sides: { kind: 'jungleTrunk', items: [{ left: 3, w: 4.2 }, { left: 13, w: 2.6, far: true }, { left: 84, w: 2.8, far: true }, { left: 92.5, w: 4.6 }] },
      corner: 'monstera',
      particles: { kind: 'fireflies', n: 22, top: [30, 90] }
    },
    {
      id: 'desert', label: 'Désert',
      far: { h: 44, g: ['mesas', 80, 40, 4, 5, 12, 20, 30, 4, 10] },
      mid: { h: 30, g: ['hills', 48, 16, 2.6, 5, 7] },
      near: { h: 24, g: ['hills', 40, 12, 1.7, 3, 5], mode: 1 },
      sides: { kind: 'cactus', items: [{ left: 4, bottom: 9, h: 34 }, { left: 17, bottom: 21, h: 17, far: true }, { left: 79, bottom: 20, h: 21, far: true }, { left: 89, bottom: 8, h: 38, flip: true }] },
      corner: 'deadBush',
      particles: { kind: 'dust', n: 26, top: [45, 95] }
    },
    {
      id: 'swamp', label: 'Marais', sunY: '28%',
      far: { h: 44, g: ['canopy', 96, 40, 9, 20, 4, 9, 16] },
      mid: { h: 34, g: ['canopy', 72, 30, 13, 14, 4, 8, 10] },
      water: { h: 22, pads: 14 },
      near: { h: 24, g: ['canopy', 60, 20, 21, 10, 2, 4, 9], mode: 1 },
      ceiling: { h: 28, g: ['canopy', 80, 30, 17, 20, 3, 9, 10], mode: 2 },
      vines: 16,
      sides: { kind: 'swampTree', items: [{ left: -3, bottom: 8, h: 58 }, { left: 86, bottom: 8, h: 54, flip: true }, { left: 13, bottom: 19, h: 30, far: true }, { left: 73, bottom: 19, h: 28, far: true }] },
      corner: 'reeds',
      particles: { kind: 'fireflies', n: 26, top: [35, 90] }
    },
    {
      id: 'ocean', label: 'Océan', sunY: '36%',
      far: { h: 48, g: ['mesas', 80, 40, 8, 4, 0, 37, 40, 4, 9] },
      water: { h: 42, reflect: true },
      mid: { h: 34, g: ['waves', 72, 30, 5, 16] },
      near: { h: 24, g: ['hills', 40, 12, 3.3, 3, 5], mode: 1 },
      sides: { kind: 'palm', items: [{ left: -1, bottom: 8, h: 62 }, { left: 85, bottom: 8, h: 58, flip: true }, { left: 15, bottom: 17, h: 30, far: true }] },
      corner: 'palmFronds',
      particles: { kind: 'sparkles', n: 30, top: [60, 84] }
    },
    {
      id: 'savanna', label: 'Savane',
      far: { h: 40, g: ['hills', 64, 20, 1.3, 5, 10] },
      mid: { h: 30, g: ['hills', 48, 16, 4.1, 4, 7] },
      near: { h: 24, g: ['hills', 40, 12, 2.2, 3, 5], mode: 1 },
      sides: { kind: 'acacia', items: [{ left: 1, bottom: 9, h: 36 }, { left: 15, bottom: 20, h: 16, far: true }, { left: 74, bottom: 19, h: 22, far: true }, { left: 85, bottom: 9, h: 32, flip: true }] },
      corner: 'grass',
      particles: { kind: 'embers', n: 24, top: [40, 95] }
    },
    {
      id: 'redwood', label: 'Forêt redwood',
      far: { h: 52, g: ['pines', 96, 40, 12, 34, 12, 22, 14] },
      mid: { h: 44, g: ['pines', 72, 30, 6, 22, 10, 18, 8] },
      near: { h: 24, g: ['canopy', 60, 20, 31, 16, 2, 4, 10], mode: 1 },
      ceiling: { h: 24, g: ['canopy', 80, 30, 23, 18, 3, 7, 8], mode: 2 },
      sides: { kind: 'redwood', items: [{ left: 0, w: 8 }, { left: 12, w: 3.6, far: true }, { left: 83, w: 4, far: true }, { left: 91, w: 9 }] },
      corner: 'ferns',
      particles: { kind: 'pollen', n: 30, top: [10, 80] }
    },
    {
      id: 'snow', label: 'Neige',
      far: { h: 62, g: ['peaks', 96, 40, 21, 7, 16, 28, 10], cap: 3 },
      mid: { h: 36, g: ['pines', 72, 30, 19, 20, 6, 12, 9], cap: 1 },
      near: { h: 24, g: ['hills', 40, 12, 5.5, 2, 5], mode: 1 },
      aurora: true,
      sides: { kind: 'spruce', items: [{ left: 1, bottom: 9, h: 46 }, { left: 14, bottom: 20, h: 22, far: true }, { left: 78, bottom: 19, h: 26, far: true }, { left: 88, bottom: 8, h: 50, flip: true }] },
      corner: 'snowRocks',
      particles: { kind: 'snow', n: 70, top: [0, 100] }
    },
    /* La jungle de bambous : une futaie de tiges segmentees, leurs gerbes de
       feuilles, une voute ouverte sur le ciel, la lumiere en rais. */
    {
      id: 'bamboo', label: 'Jungle de bambous', sunY: '34%',
      far: { h: 100, paint: ['bambooGrove', 160, 90, 61, { count: 62, width: 1, top: [-20, 12], seg: 8, leaf: .5, leafLen: [3, 5], lean: .06 }] },
      mid: { h: 100, paint: ['bambooGrove', 120, 68, 67, { count: 24, width: 2, thick: .35, top: [-20, 2], seg: 8, leaf: .8, leafLen: [4, 7], lean: .08 }] },
      near: { h: 18, paint: ['meadow', 150, 22, 71, { base: 9, amp: 2, tuft: .5, flowers: .02 }] },
      ceiling: { h: 30, paint: ['leafCanopy', 150, 40, 73, { depth: 7, fringe: .55, droop: 8, open: true }] },
      sides: { kind: 'bambooStalk', items: [{ left: 1, w: 3.6 }, { left: 8, w: 2.2, far: true }, { left: 88, w: 2.2, far: true }, { left: 94, w: 3.8 }] },
      corner: 'bambooCorner',
      particles: { kind: 'leaves', n: 28, top: [0, 70] }
    },
    /* La mangrove : une foret posee sur l'eau. Des paletuviers de toutes
       tailles jusqu'a l'horizon, leurs racines dans une eau claire qui
       miroite, la voute de feuilles au-dessus. */
    {
      id: 'mangrove', label: 'Mangrove', sunY: '32%',
      far: { h: 42, g: ['canopy', 110, 40, 81, 26, 2, 5, 13] },
      water: { h: 46, reflect: true },
      mid: { h: 64, paint: ['mangroveStand', 200, 55, 83, { water: 15, count: 22 }] },
      ceiling: { h: 22, paint: ['leafCanopy', 150, 36, 91, { depth: 6, fringe: .45, droop: 7, open: true }] },
      sides: { kind: 'mangroveTree', items: [{ left: -6, bottom: 3, h: 64 }, { left: 85, bottom: 3, h: 64, flip: true }] },
      corner: 'mangroveRoots',
      particles: { kind: 'sparkles', n: 34, top: [56, 96] }
    },
    /* Les badlands : des mesas striees d'ocre et de rouge, en fin d'apres-midi. */
    {
      id: 'badlands', label: 'Badlands', sunY: '18%',
      far: { h: 50, g: ['mesas', 80, 40, 17, 6, 10, 22, 34, 5, 12], bands: 'far' },
      mid: { h: 36, g: ['mesas', 72, 30, 29, 5, 6, 12, 20, 4, 9], bands: 'mid' },
      near: { h: 22, g: ['hills', 40, 12, 7.3, 2.5, 5], mode: 1 },
      sides: { kind: 'deadTree', items: [{ left: 2, bottom: 9, h: 34 }, { left: 16, bottom: 20, h: 16, far: true }, { left: 78, bottom: 19, h: 20, far: true, flip: true }, { left: 88, bottom: 8, h: 38, flip: true }] },
      corner: 'deadBush',
      particles: { kind: 'dust', n: 30, top: [40, 95] }
    },
    /* La cerisaie : des cerisiers roses sur une prairie bien verte, et leurs
       petales tombes a leur pied. */
    {
      id: 'cherry', label: 'Cerisaie', sunY: '28%',
      far: { h: 40, g: ['hills', 64, 20, 9.4, 5, 10] },
      mid: { h: 52, paint: ['grove', 180, 60, 97, { base: 12, count: 7, size: [.7, 1.2], trunk: 10, crown: 9, petals: 1 }] },
      near: { h: 20, paint: ['meadow', 160, 22, 111, { base: 10, tuft: .5, petals: .2, flowers: .04 }] },
      ceiling: { h: 18, paint: ['leafCanopy', 150, 30, 99, { depth: 5, fringe: .5, droop: 5, open: true, bloom: .3 }] },
      sides: { kind: 'cherryTree', items: [{ left: -3, bottom: 7, h: 50 }, { left: 86, bottom: 7, h: 46, flip: true }] },
      corner: 'flowers',
      particles: { kind: 'petals', n: 34, top: [0, 80] }
    },
    /* La grotte : une grotte ordinaire. Le devant est eclaire comme par la
       lampe du joueur, le fond se perd dans le noir. Roche, stalactites et
       stalagmites, quelques filons de charbon et de fer. Le « moss » des
       corniches et de la voute sert ici de liseré de lumiere sur les aretes. */
    {
      id: 'cave', label: 'Grottes', sunY: '70%',
      far: { h: 56, g: ['peaks', 96, 40, 103, 16, 12, 28, 8] },
      mid: { h: 42, paint: ['mossLedges', 160, 44, 107, { low: 6, rise: 26, gap: [.3, .7], moss: .9, bushes: 0, leaves: false, stalagmites: .05, torches: 0, ores: .02 }] },
      near: { h: 16, paint: ['meadow', 150, 18, 113, { base: 7, tuft: 0, pebbles: .05, amp: 1.5 }] },
      ceiling: { h: 30, paint: ['caveRoof', 160, 60, 109, { depth: 12, hole: .0001, blossom: 0, vines: 0, stalactites: .2, moss: .6 }] },
      sides: { kind: 'caveWall', items: [{ left: -1, w: 5 }, { left: 96, w: 5 }] },
      corner: 'caveCorner',
      particles: { kind: 'sporefall', n: 12, top: [20, 90] }
    },
    /* La banquise : la surface d'un ocean gele, des pics de glace sur
       l'horizon, des plaques de glace dans l'eau libre. */
    {
      id: 'frozen', label: 'Banquise', sunY: '30%',
      far: { h: 64, paint: ['iceSpikes', 180, 70, 121, { count: 18, w: [7, 14], h: [7, 22], sheet: 34 }] },
      water: { h: 34, reflect: true },
      mid: { h: 34, paint: ['floes', 180, 34, 123, { y0: 2 }] },
      near: { h: 14, paint: ['iceShelf', 160, 18, 127, { base: 9 }] },
      sides: { kind: 'iceSpike', items: [{ left: 0, bottom: 8, h: 58 }, { left: 14, bottom: 18, h: 26, far: true }, { left: 80, bottom: 18, h: 30, far: true }, { left: 89, bottom: 8, h: 54, flip: true }] },
      corner: 'iceChunks',
      particles: { kind: 'snow', n: 40, top: [0, 100] }
    },
    /* La foret : chenes et bouleaux sur une prairie, une lumiere douce, rien
       de sombre — le bois ou l'on a envie d'entrer. */
    {
      id: 'forest', label: 'Forêt', sunY: '30%',
      far: { h: 46, g: ['canopy', 96, 40, 131, 30, 3, 7, 16] },
      mid: { h: 56, paint: ['grove', 180, 64, 133, { base: 10, count: 9, size: [.75, 1.25], trunk: 11, crown: 10, birch: .3, amp: 2.5 }] },
      near: { h: 20, paint: ['meadow', 160, 22, 137, { base: 10, tuft: .55, flowers: .06 }] },
      ceiling: { h: 24, paint: ['leafCanopy', 150, 36, 139, { depth: 6, fringe: .35, droop: 5, open: true }] },
      /* Les deux chenes lointains (left 15 et 77) sont retires : poses dans le
         calque des bords, leur tronc passait devant le feuillage du bosquet. */
      sides: { kind: 'oakTree', items: [{ left: -4, bottom: 7, h: 54 }, { left: 86, bottom: 7, h: 50, flip: true }] },
      corner: 'flowers',
      particles: { kind: 'pollen', n: 30, top: [10, 80] }
    },
    {
      id: 'abyss', label: 'Abysses', sunY: '66%',
      far: { h: 46, g: ['peaks', 96, 40, 33, 9, 10, 22, 6] },
      mid: { h: 34, g: ['mesas', 72, 30, 41, 6, 6, 10, 16, 3, 7] },
      near: { h: 24, g: ['canopy', 60, 20, 53, 14, 2, 4, 10], mode: 1 },
      sides: { kind: 'kelp', items: [{ left: 2, bottom: 6, h: 78 }, { left: 8, bottom: 10, h: 60, far: true }, { left: 15, bottom: 14, h: 44, far: true }, { left: 82, bottom: 12, h: 52, far: true }, { left: 90, bottom: 6, h: 74, flip: true }] },
      corner: 'coral',
      particles: { kind: 'bubbles', n: 44, top: [20, 100] }
    },
    /* L'ocean tiede, sous l'eau : le meme monde que les abysses, remonte vers
       la lumiere. Une eau turquoise, un fond de sable et de roches, et une
       foret d'algues qui monte jusqu'a la surface. */
    {
      id: 'lukewarm', label: 'Océan tiède', sunY: '6%',
      far: { h: 42, g: ['hills', 64, 20, 61, 5, 10] },
      mid: { h: 30, g: ['mesas', 72, 30, 67, 6, 6, 10, 16, 3, 7] },
      near: { h: 22, g: ['hills', 40, 12, 71, 3, 5], mode: 1 },
      sides: { kind: 'kelp', items: [
        { left: 1, bottom: 5, h: 92 }, { left: 6, bottom: 8, h: 74, far: true }, { left: 11, bottom: 12, h: 58, far: true },
        { left: 19, bottom: 15, h: 40, far: true }, { left: 74, bottom: 14, h: 46, far: true }, { left: 81, bottom: 11, h: 62, far: true },
        { left: 87, bottom: 8, h: 78, far: true, flip: true }, { left: 93, bottom: 5, h: 94, flip: true }
      ] },
      corner: 'seagrass',
      particles: { kind: 'bubbles', n: 38, top: [10, 100] }
    }
  ];



  /* ===========================================================================
     Les animations d'ambiance

     Par-dessus les particules, chaque biome recoit quelques petites vies :

       clouds      des nuages en cases qui derivent dans le ciel
       birds       des oiseaux qui traversent en battant des ailes
       bats        la meme chose, en chauves-souris, pour la grotte
       tumbleweed  un virevoltant qui roule de temps en temps au sol
       drips       des gouttes qui tombent des stalactites
       jelly       des meduses qui remontent en pulsant
       sway        la voute de feuillage respire et se balance
       gust        une rafale de vent passe sur le premier plan
       glint       un reflet de soleil glisse sur l'eau
       bob         le plan du milieu tangue doucement (houle, plaques de glace)
     =========================================================================== */

  const AMBIENT = {
    jungle: ['sway', 'birds', 'clouds'],
    desert: ['clouds', 'tumbleweed', 'birds'],
    swamp: ['sway', 'clouds', 'glint'],
    ocean: ['clouds', 'birds', 'bob'],
    savanna: ['clouds', 'birds', 'gust'],
    redwood: ['sway', 'birds', 'clouds'],
    snow: ['clouds', 'gust'],
    abyss: ['jelly', 'bob'],
    lukewarm: ['bob'],
    bamboo: ['sway', 'gust', 'birds'],
    mangrove: ['sway', 'birds', 'glint'],
    badlands: ['clouds', 'tumbleweed', 'birds'],
    cherry: ['sway', 'clouds', 'gust'],
    cave: ['drips', 'bats'],
    frozen: ['clouds', 'birds', 'bob'],
    forest: ['sway', 'birds', 'clouds', 'gust']
  };

  function cloudSvg(seed) {
    const r = rng(seed);
    const c = new Set();
    const n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) ellipse(c, 6 + k * 7 + r() * 3, 7 - r() * 2, 5 + r() * 4, 2.5 + r() * 2.5);
    const flat = new Set([...c].filter((key) => +key.split(',')[1] <= 8));
    return '<svg viewBox="0 0 ' + (n * 7 + 12) + ' 10" shape-rendering="crispEdges"><path d="' + cellsPath(flat) + '"/></svg>';
  }

  const BIRD_SVG = '<svg viewBox="0 0 7 4" shape-rendering="crispEdges">'
    + '<path class="hb-wing-a" d="M0 0h1v1h-1zM1 1h1v1h-1zM2 2h3v1h-3zM5 1h1v1h-1zM6 0h1v1h-1z"/>'
    + '<path class="hb-wing-b" d="M0 2h1v1h-1zM1 1h1v1h-1zM2 1h3v1h-3zM5 1h1v1h-1zM6 2h1v1h-1z"/></svg>';

  function weedSvg() {
    const c = new Set();
    for (let a = 0; a < Math.PI * 2; a += .2) plot(c, 5 + Math.cos(a) * 4.4, 5 + Math.sin(a) * 4.4);
    line(c, 2, 3, 8, 7, 1); line(c, 2, 7, 8, 3, 1); line(c, 5, 1, 5, 9, 1); line(c, 1, 5, 9, 5, 1);
    return '<svg viewBox="0 0 11 11" shape-rendering="crispEdges"><path d="' + cellsPath(c) + '"/></svg>';
  }

  const JELLY_SVG = '<svg viewBox="0 0 7 10" shape-rendering="crispEdges"><path d="'
    + 'M2 0h3v1h-3zM1 1h5v1h-5zM0 2h7v2h-7zM1 4h1v2h-1zM3 4h1v3h-1zM5 4h1v2h-1zM1 7h1v2h-1zM5 7h1v2h-1zM3 8h1v2h-1z"/></svg>';

  /** Le decor vivant d'un biome : ce qui va dans le ciel, ce qui va sur la terre. */
  function ambientHtml(b) {
    const fx = AMBIENT[b.id] || [];
    const r = rng(b.id.length * 97 + b.id.charCodeAt(0));
    let sky = '', land = '';
    if (fx.includes('clouds')) {
      for (let k = 0; k < 5; k++) {
        sky += '<span class="hb-cloud" style="top:' + (4 + r() * 26).toFixed(1) + '%;width:' + (9 + r() * 12).toFixed(1) + 'vw;'
          + '--t:' + (90 + r() * 80).toFixed(0) + 's;--d:' + (-r() * 160).toFixed(0) + 's;opacity:' + (.45 + r() * .4).toFixed(2) + '">'
          + cloudSvg(Math.floor(r() * 1000)) + '</span>';
      }
    }
    if (fx.includes('birds') || fx.includes('bats')) {
      const bats = fx.includes('bats');
      for (let k = 0; k < (bats ? 4 : 5); k++) {
        sky += '<span class="hb-bird' + (bats ? ' is-bat' : '') + (r() < .5 ? ' is-rev' : '') + '" style="top:' + ((bats ? 22 : 10) + r() * 24).toFixed(1) + '%;'
          + '--t:' + ((bats ? 9 : 22) + r() * 14).toFixed(1) + 's;--d:' + (-r() * 30).toFixed(1) + 's;--f:' + (.32 + r() * .2).toFixed(2) + 's;'
          + 'width:' + (bats ? 1.6 + r() : 1.1 + r() * .9).toFixed(2) + 'vw">' + BIRD_SVG + '</span>';
      }
    }
    if (fx.includes('tumbleweed')) {
      land += '<span class="hb-weed" style="--t:28s;--d:-6s">' + weedSvg() + '</span>';
      land += '<span class="hb-weed is-small" style="--t:37s;--d:-24s">' + weedSvg() + '</span>';
    }
    if (fx.includes('drips')) {
      let drops = '';
      for (let k = 0; k < 9; k++) {
        drops += '<i style="left:' + (8 + r() * 84).toFixed(1) + '%;top:' + (14 + r() * 14).toFixed(1) + '%;'
          + '--t:' + (2.6 + r() * 3).toFixed(1) + 's;--d:' + (-r() * 6).toFixed(1) + 's"></i>';
      }
      land += '<span class="hb-drips">' + drops + '</span>';
    }
    if (fx.includes('jelly')) {
      for (let k = 0; k < 5; k++) {
        land += '<span class="hb-jelly" style="left:' + (6 + r() * 88).toFixed(1) + '%;width:' + (1.4 + r() * 1.6).toFixed(2) + 'vw;'
          + '--t:' + (26 + r() * 20).toFixed(0) + 's;--d:' + (-r() * 40).toFixed(0) + 's">' + JELLY_SVG + '</span>';
      }
    }
    if (fx.includes('gust')) land += '<span class="hb-gust"></span>';
    return { sky, land, classes: fx.map((f) => 'fx-' + f) };
  }

  /* ===========================================================================
     Une scene

     Le ciel (degrade, aurore, rais, soleil) et la terre (tous les plans) sont
     deux groupes : pendant une traversee, le ciel du biome qui arrive se fond
     par-dessus l'ancien, sous la brume (voir « La traversee »).
     La voute et le feuillage des coins ont leurs propres balancements, qui
     tournent autour de leur pied : la camera les deplace par une boite a part
     (.hb-cam), sans toucher a ce pivot.
     =========================================================================== */

  const SCENE_HTML =
    '<div class="bw-sky">'
    + '<div class="hb-aurora"></div><div class="hb-rays"></div>'
    + '<div class="hb-sun-halo"></div><div class="hb-sun"></div>'
    + '<div class="hb-sky-fx"></div>'
    + '</div>'
    + '<div class="bw-land">'
    + '<svg class="hb-layer hb-far"></svg>'
    + '<div class="hb-mist hb-mist-a"></div>'
    + '<div class="hb-water"></div>'
    + '<svg class="hb-layer hb-mid"></svg>'
    + '<div class="hb-mist hb-mist-b"></div>'
    + '<div class="hb-sides"></div>'
    + '<div class="hb-cam hb-cam-roof"><svg class="hb-ceiling"></svg></div>'
    + '<div class="hb-vines"></div>'
    + '<div class="hb-particles"></div>'
    + '<svg class="hb-layer hb-near"></svg>'
    + '<div class="hb-fx"></div>'
    + '<div class="hb-cam hb-cam-l"><svg class="hb-corner hb-corner-l" shape-rendering="crispEdges"></svg></div>'
    + '<div class="hb-cam hb-cam-r"><svg class="hb-corner hb-corner-r" shape-rendering="crispEdges"></svg></div>'
    + '</div>';

  /* Les strates des badlands : un degrade a arrets francs, bande par bande,
     dont les couleurs viennent de la palette CSS (--far-b1... ou --mid-b1...). */
  let bandSeq = 0;
  function bandFill(prefix, rows, seed) {
    const r = rng(seed);
    const id = 'bwBand' + (++bandSeq);
    let stops = '';
    let y = 0, k = 0;
    while (y < rows) {
      const hgt = 1 + Math.floor(r() * 3);
      const col = 'var(--' + prefix + '-b' + (1 + (k % 4)) + ')';
      stops += '<stop offset="' + (y / rows).toFixed(4) + '" style="stop-color:' + col + '"/>'
        + '<stop offset="' + (Math.min(rows, y + hgt) / rows).toFixed(4) + '" style="stop-color:' + col + '"/>';
      y += hgt; k += 1 + Math.floor(r() * 2);
    }
    return { id, defs: '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' + stops + '</linearGradient></defs>' };
  }

  function setLayer(el, spec) {
    if (!spec) { el.style.display = 'none'; return; }
    if (spec.paint) {
      const [name, W, H, seed, opts] = spec.paint;
      const set = PAINTS[name](W, H, rng(seed), opts || {});
      const roof = el.classList.contains('hb-ceiling');
      el.style.height = spec.h + '%';
      el.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      el.setAttribute('preserveAspectRatio', roof ? 'xMidYMin slice' : 'xMidYMax slice');
      el.classList.add('is-painted');
      el.innerHTML = ['a', 'e', 'c', 'b', 'd'].map((k) => (set[k].size
        ? '<path class="hb-p-' + k + '" d="' + runsPath(set[k], W, H) + '"/>' : '')).join('');
      return;
    }
    const p = layerPath(spec);
    el.style.height = spec.h + '%';
    el.setAttribute('viewBox', '0 0 ' + p.cols + ' ' + p.rows);
    el.setAttribute('preserveAspectRatio', 'none');
    const band = spec.bands ? bandFill(spec.bands, p.rows, spec.g[3] || 1) : null;
    el.innerHTML = (band ? band.defs : '')
      + '<path d="' + p.d + '"' + (band ? ' fill="url(#' + band.id + ')"' : '') + '/>'
      + (p.cap ? '<path class="hb-cap" d="' + p.cap + '"/>' : '');
  }

  /* Une scene donnee est toujours la meme (le generateur est deterministe) :
     elle n'est construite qu'une fois, puis clonee. Les cartes du bestiaire
     demandaient plusieurs fois la meme jungle. */
  const sceneCache = {};

  /* ---- la densite des particules ------------------------------------------

     Chaque biome declare un nombre de particules — 70 flocons pour la neige,
     26 grains pour le desert. Ce nombre a ete regle sur un ecran large : pose
     tel quel dans une vignette de carte de 300 px, ou sur un telephone, il
     entasse la meme poussiere dans un quart de la surface. Ce n'est pas
     seulement plus cher a animer : c'est plus dense que ce qui a ete dessine.

     Le nombre suit donc la largeur de la boite ou la scene va vivre, de sorte
     que la densite — des particules par unite de surface — reste celle du
     grand ecran. Sur un telephone de 375 px, il reste un grain sur trois, a
     l'endroit ou il y avait trois fois trop de monde.

     Le plancher de 25 % garde une vignette habitee. Les valeurs sont
     arrondies au vingtieme pour que le cache ne se remplisse pas d'une
     variante par largeur de fenetre. */

  const SCENE_WIDTH = 1280;

  function particleScale(width) {
    const raw = Math.max(0.25, Math.min(1, (width || SCENE_WIDTH) / SCENE_WIDTH));
    return Math.round(raw * 20) / 20;
  }

  function buildScene(b, width) {
    const scale = particleScale(width);
    const key = b.id + '@' + scale;
    if (sceneCache[key]) return sceneCache[key].cloneNode(true);
    const root = buildSceneFresh(b, scale);
    sceneCache[key] = root.cloneNode(true);
    return root;
  }

  function buildSceneFresh(b, scale) {
    const root = document.createElement('div');
    root.className = 'bw-scene';
    root.dataset.biome = b.id;
    root.innerHTML = SCENE_HTML;
    root.style.setProperty('--sun-y', b.sunY || '24%');
    const amb = ambientHtml(b);
    root.querySelector('.hb-sky-fx').innerHTML = amb.sky;
    root.querySelector('.hb-fx').innerHTML = amb.land;
    amb.classes.forEach((c) => root.classList.add(c));

    setLayer(root.querySelector('.hb-far'), b.far);
    setLayer(root.querySelector('.hb-mid'), b.mid);
    setLayer(root.querySelector('.hb-near'), b.near);
    setLayer(root.querySelector('.hb-ceiling'), b.ceiling);

    const water = root.querySelector('.hb-water');
    if (b.water) {
      water.style.height = b.water.h + '%';
      /* Les rides et le reflet : une nappe par position, montrees tour a tour
         (css/biome-world.css, .hb-rip). */
      let wHtml = '<i class="hb-rip"></i>'.repeat(4)
        + (b.water.reflect ? '<div class="hb-reflect"><i></i><i></i><i></i></div>' : '');
      if (b.water.pads) {
        const r = rng(77);
        for (let i = 0; i < b.water.pads; i++) {
          wHtml += '<i class="hb-pad" style="left:' + (r() * 96).toFixed(1) + '%;top:' + (8 + r() * 50).toFixed(1) + '%;width:'
            + (10 + Math.floor(r() * 4) * 6) + 'px"></i>';
        }
      }
      water.innerHTML = wHtml;
    }

    root.querySelector('.hb-sides').innerHTML = sidesHtml(b.sides);

    if (b.vines) {
      const r = rng(42);
      let vHtml = '';
      for (let i = 0; i < b.vines; i++) {
        const left = i % 2 === 0 ? 1 + r() * 26 : 73 + r() * 26;
        const len = 18 + Math.floor(r() * 44);
        vHtml += '<span class="hb-vine" style="left:' + left.toFixed(1) + '%;--d:' + (-r() * 6).toFixed(2) + 's">'
          + vineSvg(len, 100 + i) + '</span>';
      }
      root.querySelector('.hb-vines').innerHTML = vHtml;
    }

    const corner = cornerPath(b.corner);
    root.querySelectorAll('.hb-corner').forEach((el) => {
      el.setAttribute('viewBox', '0 0 ' + corner.grid + ' ' + corner.grid);
      el.innerHTML = corner.html;
    });

    /* L'aurore boreale : des rideaux de colonnes d'une case, qui ondulent. */
    if (b.aurora) {
      /* Sans elle, la boite reste cachee (css/biome-world.css) : vide, elle
         etait quand meme animee et fondue en « screen » sur tout le ciel. */
      root.classList.add('has-aurora');
      const curtains = [
        { id: 'bwAurA', color: '#7CFFC4', phase: 0, y: 14, amp: 5 },
        { id: 'bwAurB', color: '#B08CFF', phase: 2.1, y: 22, amp: 4 }
      ];
      let defs = '', body = '';
      curtains.forEach((cu) => {
        defs += '<linearGradient id="' + cu.id + '" x1="0" y1="0" x2="0" y2="1">'
          + '<stop offset="0" stop-color="' + cu.color + '" stop-opacity="0"/>'
          + '<stop offset=".55" stop-color="' + cu.color + '" stop-opacity=".55"/>'
          + '<stop offset="1" stop-color="' + cu.color + '" stop-opacity="0"/></linearGradient>';
        for (let x = 0; x < 120; x++) {
          const cy = cu.y + Math.sin(x * .09 + cu.phase) * cu.amp + Math.sin(x * .23 + cu.phase) * 2;
          const hh = 5 + Math.sin(x * .17 + 1 + cu.phase) * 3;
          body += '<rect x="' + x + '" y="' + (cy - hh).toFixed(1) + '" width="1" height="' + (hh * 2).toFixed(1) + '" fill="url(#' + cu.id + ')"/>';
        }
      });
      root.querySelector('.hb-aurora').innerHTML =
        '<svg viewBox="0 0 120 40" preserveAspectRatio="none" shape-rendering="crispEdges"><defs>' + defs + '</defs>' + body + '</svg>';
    }

    const flies = root.querySelector('.hb-particles');
    flies.dataset.kind = b.particles.kind;
    const r = rng(7);
    let pHtml = '';
    const [t0, t1] = b.particles.top;
    const count = Math.max(3, Math.round(b.particles.n * (scale == null ? 1 : scale)));
    for (let i = 0; i < count; i++) {
      pHtml += '<i style="left:' + (r() * 100).toFixed(1) + '%;top:' + (t0 + r() * (t1 - t0)).toFixed(1) + '%;'
        + '--d:' + (-r() * 8).toFixed(2) + 's;--t:' + (5 + r() * 6).toFixed(1) + 's"></i>';
    }
    flies.innerHTML = pHtml;

    return root;
  }

  /* ===========================================================================
     Le voyage

     Un circuit fixe, parcouru dans l'ordre et en boucle. Chaque page y entre
     par un biome different ; plus on descend, plus on avance. La hauteur de la
     page decide du nombre d'etapes : environ un biome par ecran et quart.
     =========================================================================== */

  /* Le reglage des biomes (quel decor sur quelle page, quel decor pour quel
     biome du JSON) vit dans js/biome-config.js : c'est le fichier a modifier. */
  const CONFIG = OW.BIOME_CONFIG || {};
  const PAGES = CONFIG.pages || {};
  const known = (id) => BIOMES.some((b) => b.id === id);

  /* La page se reconnait a son nom de fichier ; une page servie sous une autre
     adresse (la 404, que l'hebergeur renvoie pour n'importe quel chemin)
     le declare elle-meme : <body data-bw-page="404">. */
  const pageFile = () => (document.body && document.body.dataset.bwPage)
    || (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';

  /** Le circuit d'une page ordinaire, tel que biome-config.js le liste.

     Une page peut n'en vouloir qu'un seul : la fiche d'un biome parle d'un
     biome, en traverser quinze en descendant n'aurait aucun sens. Elle le dit
     avec data-biome-only, et son decor ne change plus jamais. */
  function pageRoute() {
    const forced = document.body.dataset.biomeStart;
    const only = document.body.hasAttribute('data-biome-only');
    const list = (PAGES[pageFile()] || PAGES.index || ['jungle']).filter(known);
    if (forced && known(forced)) return only ? [forced] : [forced].concat(list.filter((id) => id !== forced));
    if (only) return [list[0] || 'jungle'];
    return list.length ? list : ['jungle'];
  }

  /* ---- les fiches de creature : le decor suit le JSON -----------------------------

     Le fond d'une fiche traverse exactement les biomes d'apparition que le JSON
     declare pour la bete (spawn.biomes), traduits par biome-config.js, sans
     doublon, dans l'ordre du JSON, au plus animalMaxBiomes. Une bete sans
     biome d'apparition prend la liste choisie a la main dans le reglage. */

  const creatureSlug = () => pageFile() === 'animal' ? new URLSearchParams(location.search).get('e') : null;

  function entityBiomes(entityOrSlug) {
    const entity = typeof entityOrSlug === 'object' ? entityOrSlug : null;
    const slug = entity ? entity.slug : entityOrSlug;
    const max = CONFIG.animalMaxBiomes || 4;
    const pick = (list) => list.filter(known).slice(0, max);
    if (CONFIG.animalOverride && CONFIG.animalOverride[slug]) return pick(CONFIG.animalOverride[slug]);
    const out = [];
    ((entity && entity.spawn && entity.spawn.biomes) || []).forEach((id) => {
      const biome = (CONFIG.spawnToBiome || {})[id];
      if (!biome) { console.warn('[biomes] ' + id + ' : aucun decor dans js/biome-config.js (spawnToBiome)'); return; }
      if (!out.includes(biome)) out.push(biome);
    });
    if (out.length) return pick(out);
    return pick((CONFIG.animalWithoutSpawn || {})[slug] || CONFIG.animalDefault || ['forest']);
  }

  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  /* ===========================================================================
     La transition : le relief du biome qui arrive

     Pas de brume. Le biome suivant se devoile par le bas, derriere une ligne
     de crete en escalier de cases qui monte et balaie l'ecran. Cette crete a
     le relief du biome qui arrive : presque plate pour l'eau et la banquise,
     douce pour les plaines, dentelee pour la neige, les badlands, la grotte.
     Un liseré de lumiere, de la couleur du nouveau biome, court sur le bord ;
     quelques eclats s'en detachent. Le bord est le meme calcul pour la
     decoupe (clip-path du biome qui arrive) et pour le liseré (une toile
     basse resolution agrandie sans lissage) : ils tombent case pour case.
     =========================================================================== */

  /* L'amplitude du relief, par biome (part de la hauteur de l'ecran). */
  const RELIEF = {
    ocean: .08, frozen: .1, mangrove: .12, swamp: .16, desert: .2, savanna: .2, cherry: .22, forest: .24,
    jungle: .28, bamboo: .3, redwood: .32, abyss: .3, lukewarm: .3, cave: .38, badlands: .4, snow: .44
  };

  function createReveal(canvas) {
    const ctx = canvas.getContext('2d');
    let cols = 0, rows = 0, drawn = false, last = null;
    const hash = (x, s) => { const n = Math.sin(x * 12.9898 + s * 78.233) * 43758.5453; return n - Math.floor(n); };
    const glowOf = (el) => {
      if (!el._glow) {
        const v = getComputedStyle(el).getPropertyValue('--rim-glow').split(',').map((n) => parseFloat(n));
        el._glow = v.length === 3 && v.every((n) => !isNaN(n)) ? v : [255, 240, 200];
      }
      return el._glow;
    };
    function size() {
      cols = window.innerWidth < 720 ? 18 : 36;
      rows = Math.max(8, Math.round(cols * window.innerHeight / window.innerWidth));
      canvas.width = cols;
      canvas.height = rows;
    }
    size();
    window.addEventListener('resize', size);

    /* Au repos, la toile vide n'est plus un calque plein ecran a composer a
       chaque image : elle disparait, et revient avec la crete. */
    const show = (on) => { if (canvas._on !== on) { canvas._on = on; canvas.classList.toggle('is-on', on); } };
    function clear() {
      if (drawn) { ctx.clearRect(0, 0, cols, rows); drawn = false; }
      if (last) { last.style.clipPath = ''; last = null; }
      show(false);
    }

    return {
      apply(t, from, to) {
        if (from && from.style.clipPath) from.style.clipPath = '';
        if (!t || t >= 1 || !to) { clear(); return; }
        if (last && last !== to) last.style.clipPath = '';
        last = to;

        const id = to.dataset.biome || '';
        const seed = id.length * 7 + (id.charCodeAt(0) || 0);
        const amp = RELIEF[id] != null ? RELIEF[id] : .28;
        const A = amp * .5 + .03;
        const p = smooth(0, 1, t);
        const base = rows * ((1 + A) - p * (1 + 2 * A));
        const edge = [];
        for (let c = 0; c < cols; c++) {
          const relief = Math.sin(c * .5 + seed) * .55 + Math.sin(c * 1.3 + seed * 2) * .25 + (hash(c, seed) - .5) * .4;
          edge.push(Math.round(base + relief * amp * rows * .5));
        }

        /* La decoupe du biome qui arrive : tout ce qui est sous la crete. */
        let poly = '0% 100%';
        for (let c = 0; c < cols; c++) {
          const y = Math.max(-2, Math.min(rows + 2, edge[c])) / rows * 100;
          poly += ',' + (c / cols * 100).toFixed(3) + '% ' + y.toFixed(3) + '%,' + ((c + 1) / cols * 100).toFixed(3) + '% ' + y.toFixed(3) + '%';
        }
        to.style.clipPath = 'polygon(' + poly + ',100% 100%)';

        /* Le liseré de lumiere et ses eclats. */
        const g = glowOf(to);
        const rgb = g[0] + ',' + g[1] + ',' + g[2];
        ctx.clearRect(0, 0, cols, rows);
        for (let c = 0; c < cols; c++) {
          const y = edge[c];
          const prev = c > 0 ? edge[c - 1] : y;
          /* La contremarche : la ou la crete change de hauteur, le bord monte. */
          ctx.fillStyle = 'rgba(' + rgb + ',.55)';
          for (let k = Math.min(prev, y); k < Math.max(prev, y); k++) ctx.fillRect(c, k, 1, 1);
          ctx.fillStyle = 'rgba(' + rgb + ',.9)';
          ctx.fillRect(c, y, 1, 1);
          ctx.fillStyle = 'rgba(' + rgb + ',.28)';
          ctx.fillRect(c, y + 1, 1, 1);
          const spark = hash(c + Math.floor(t * 40), seed + 3);
          if (spark < .16) {
            ctx.fillStyle = 'rgba(' + rgb + ',' + (.35 + spark * 2).toFixed(2) + ')';
            ctx.fillRect(c, y - 2 - Math.floor(spark * 20), 1, 1);
          }
        }
        drawn = true;
        show(true);
      }
    };
  }

  /* ===========================================================================
     La traversee : on avance dans le biome, on passe dans le suivant

     Une vraie camera. Chaque plan du decor est pose a sa distance (--z,
     css/biome-world.css) et la camera avance de --cam : un plan grandit alors
     de z / (z - cam) autour du point de fuite, sur l'horizon. Le premier plan
     file vers nous et sort par le bas et les bords bien avant que les
     lointains bougent ; les silhouettes des bords s'ecartent en plus vers leur
     cote (--part), comme des branches qu'on depasse.

     Pendant qu'on avance, le biome suivant se devoile derriere sa crete
     (createReveal, plus haut). Il est deja devant nous : il approche (--cam
     negatif, ses plans un peu plus petits) et se pose quand la crete a tout
     recouvert.

     w va de 0 (le biome qu'on quitte, au repos) a 1 (le suivant, au repos).
     Le meme moteur sert au fond du site (le defilement donne w) et a la
     balade du chargement (js/loader.js, le temps donne w ; la, le suivant se
     fond par-dessus au lieu de monter derriere sa crete). La scene qui arrive
     est toujours empilee au-dessus de celle qu'on quitte.
     =========================================================================== */

  /* La course de la camera dans le biome qu'on quitte : au-dela des plans
     du milieu (1,6), sans jamais atteindre les lointains (2,3) ni l'eau
     (1,9 : elle s'arrete juste avant). Elle part doucement et accelere de
     facon exponentielle jusqu'au bout (CAM_EXP : plus il est grand, plus la
     fin est brutale). */
  const CAM_OUT = 1.75;
  const CAM_EXP = 2.6;
  const CAM_IN = .45;    /* la distance d'ou arrive le suivant */

  /**
   * @param {Element} host la ou vivent les scenes
   * @param {Node} [before] le liseré de la crete se pose juste avant (sous le voile de lecture)
   * @param {{fade?: boolean}} [opts] fade : le suivant se fond, sans crete
   */
  function createTravel(host, before, opts) {
    const fade = !!(opts && opts.fade);
    let reveal = null;
    if (!fade) {
      const canvas = document.createElement('canvas');
      canvas.className = 'bw-wipe';
      host.insertBefore(canvas, before || null);
      reveal = createReveal(canvas);
    }

    const size = () => host.style.setProperty('--sh', window.innerHeight + 'px');
    size();
    window.addEventListener('resize', size);

    /* On n'ecrit que ce qui a change. */
    const written = new WeakMap();
    function put(el, name, value) {
      let bag = written.get(el);
      if (!bag) { bag = {}; written.set(el, bag); }
      if (bag[name] === value) return;
      bag[name] = value;
      el.style.setProperty(name, value);
    }
    function pose(el, cam, part, o) {
      put(el, '--cam', cam.toFixed(4));
      put(el, '--part', part.toFixed(4));
      put(el, '--sky-o', o.toFixed(3));
      put(el, '--land-o', o.toFixed(3));
    }

    return {
      /**
       * Pose une image de la traversee.
       * @param {Element} a la scene qu'on quitte (ou la seule, au repos)
       * @param {Element|null} b la suivante, empilee au-dessus
       * @param {number} w l'avancee, de 0 a 1
       * @param {number} [walk] ce qu'on a deja avance dans a avant la traversee
       * @param {boolean} [back] on remonte : on va de b vers a
       */
      apply(a, b, w, walk, back) {
        if (!a) return;
        /* Mouvements reduits : la crete ou le fondu, sans camera. */
        const k = reduced ? 0 : 1;
        const base = (walk || 0) * k;
        if (!b || !(w > 0) || w >= 1) {
          if (w >= 1 && b) pose(b, 0, 0, 1);
          else pose(a, base, 0, 1);
          if (reveal) reveal.apply(0, a, null);
          return;
        }
        /* On remonte : on avance vers a, comme on avancait vers b en
           descendant. On fonce dans b, celui qu'on quitte ; a approche depuis
           l'horizon ; la crete redescend une fois l'elan pris. Sans cela, on
           reculait : le biome d'avant arrivait par son zoom le plus fort, en
           cases geantes, et on le voyait se defaire a l'envers. */
        if (back && !fade) {
          const v = 1 - w;
          const goBack = (Math.exp(CAM_EXP * v) - 1) / (Math.exp(CAM_EXP) - 1);
          pose(b, (CAM_OUT * goBack) * k, smooth(0, .8, v) * k, 1);
          pose(a, -CAM_IN * Math.pow(1 - v, 2) * k, 0, 1);
          if (reveal) reveal.apply(1 - smooth(.4, 1, v), a, b);
          return;
        }
        /* La crete attend que la camera ait pris son elan : jusqu'a 40 %,
           on ne fait qu'avancer, et elle monte pendant qu'on fonce. */
        const t = smooth(.4, 1, w);
        /* On quitte a : la camera part du repos et s'emballe. */
        const go = (Math.exp(CAM_EXP * w) - 1) / (Math.exp(CAM_EXP) - 1);
        pose(a, (base + CAM_OUT * go) * k, smooth(0, .8, w) * k, 1);
        /* b approche et ralentit pour se poser. */
        /* Tant que la crete n'est pas partie (t nul), b reste invisible : sans
           decoupe, il s'afficherait en entier par-dessus a. */
        pose(b, -CAM_IN * Math.pow(1 - w, 2) * k, 0, fade ? smooth(.35, 1, t) : (t > 0 ? 1 : 0));
        if (reveal) reveal.apply(t, a, b);
      }
    };
  }

  /* Pour la balade du chargement (js/loader.js). */
  OW.biomeTravel = createTravel;

  /* Les biomes de chaque bete, retenus dans le navigateur des que le JSON a
     ete lu sur une page : quelques octets, pour que la fiche suivante sache
     son decor avant meme d'avoir ses donnees. */
  const ROUTES_KEY = 'ow-bw-routes';
  function rememberedRoute(slug) {
    try {
      const list = (JSON.parse(localStorage.getItem(ROUTES_KEY) || '{}') || {})[slug];
      return Array.isArray(list) && list.length && list.every(known) ? list : null;
    } catch (e) { return null; }
  }
  function rememberRoutes(data) {
    try {
      const map = {};
      (data.allEntities || data.entities || []).forEach((e) => { map[e.slug] = entityBiomes(e); });
      const text = JSON.stringify(map);
      if (localStorage.getItem(ROUTES_KEY) !== text) localStorage.setItem(ROUTES_KEY, text);
    } catch (e) { /* rien : la fiche attendra son JSON */ }
  }

  function initWorld() {
    const world = document.createElement('div');
    world.className = 'bw';
    world.setAttribute('aria-hidden', 'true');
    world.innerHTML = '<div class="bw-veil"></div>';
    document.body.prepend(world);
    document.body.classList.add('bw-on');

    const veil = world.querySelector('.bw-veil');
    const travel = createTravel(world, veil);
    const isHome = document.body.dataset.page === 'home';
    const slug = creatureSlug();
    /* Sur une fiche, la page est partagee a parts egales entre ses biomes. */
    const even = !!slug;
    /* Une fiche dessine tout de suite les biomes de sa bete s'ils sont connus
       (retenus par une page precedente, voir rememberRoutes) : son decor est
       ainsi la des la premiere image, et glisse avec la transition entre
       pages. Sinon elle attend le JSON — le decor par defaut s'afficherait une
       fraction de seconde. */
    const known0 = slug ? rememberedRoute(slug) : null;
    let route = slug ? (known0 || entityBiomes(slug)) : pageRoute();
    let ready = !slug || !!known0;
    const scenes = [];
    let count = 2;
    let segLen = 1;
    let heroBottom = 0;
    let raf = 0;

    function biomeAt(i) {
      const id = route[i % route.length];
      return BIOMES.find((b) => b.id === id);
    }

    /* Change de circuit (la fiche d'une creature, une fois ses donnees lues) :
       les scenes deja construites ne correspondent plus, on repart de zero. */
    function setRoute(next) {
      if (!next.length || (ready && next.join() === route.join())) return;
      ready = true;
      route = next;
      scenes.forEach((el) => el && el.remove());
      scenes.length = 0;
      measure();
      update();
    }

    function sceneAt(i) {
      if (!scenes[i]) {
        const el = buildScene(biomeAt(i), window.innerWidth);
        el.style.zIndex = String(i + 1);
        world.insertBefore(el, veil);
        scenes[i] = el;
      }
      return scenes[i];
    }

    /* La hauteur de l'ecran qui decoupe la page en biomes. Sur un telephone,
       la barre d'adresse se montre quand on remonte et se cache quand on
       descend : la fenetre change de hauteur a chaque fois. Recalcule sur
       cette hauteur-la, le decoupage bougeait sous le doigt, et le biome
       affiche sautait en remontant. On garde donc la plus grande hauteur vue
       pour cette largeur ; elle ne change qu'avec la largeur (rotation,
       fenetre redimensionnee). */
    let stableW = 0, stableH = 0;
    /* Le sens de la traversee en cours (voir update). */
    let lastU = null, backAt = -1, back = false;
    function viewHeight() {
      const w = window.innerWidth, h = window.innerHeight;
      if (w !== stableW) { stableW = w; stableH = h; }
      else stableH = Math.max(stableH, h);
      return stableH;
    }

    function measure() {
      const vh = viewHeight();
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
      if (even) {
        count = route.length;
        segLen = Math.max(1, maxScroll / count);
      } else {
        count = Math.max(1, Math.min(route.length, 1 + Math.round(maxScroll / (vh * 1.25))));
        segLen = count > 1 ? Math.max(1, maxScroll / (count - 1)) : 1;
      }
      /* Une page ouverte sans fenetre encore (onglet en arriere-plan, apercu
         replie) mesure 0 sur 0 : le decoupage valait NaN, aucun biome ne
         correspondait et le decor mourait avant d'ecouter le defilement. Il
         part d'un seul biome, et se redecoupe a la premiere vraie mesure. */
      if (!(count >= 1)) count = 1;
      if (!(segLen > 0)) segLen = 1;
      const hero = document.querySelector('[data-biome-hero]') || document.querySelector('main > section');
      heroBottom = hero ? hero.getBoundingClientRect().bottom + window.scrollY : vh;
    }

    /* Chaque ecriture de style invalide la scene entiere : on n'ecrit que ce
       qui a change. Hors transition (l'essentiel du defilement), plus rien
       n'est ecrit du tout. */
    const written = new WeakMap();
    function setVar(el, name, value) {
      let bag = written.get(el);
      if (!bag) { bag = {}; written.set(el, bag); }
      if (bag[name] === value) return;
      bag[name] = value;
      el.style.setProperty(name, value);
    }
    function setLive(el, on) {
      if (el._live === on) return;
      el._live = on;
      el.classList.toggle('is-live', on);
    }
    function setMoving(el, on) {
      if (el._moving === on) return;
      el._moving = on;
      el.classList.toggle('is-moving', on);
    }

    /* Pendant une transition, la page entiere passe en mode « ca bouge » :
       les feuilles s'en servent pour couper ce qui coute trop cher a redessiner
       soixante fois par seconde (le flou derriere le verre, les ambiances, les
       ombres portees). Tout revient des que le decor se pose. */
    let wasMoving = null;
    function setWorldMoving(on) {
      if (wasMoving === on) return;
      wasMoving = on;
      document.documentElement.classList.toggle('bw-move', on);
    }

    /* La page change de hauteur sans qu'on defile (un onglet des Mecaniques,
       un bloc qui se deplie, des images qui arrivent) : le decoupage en
       biomes change avec elle, et le decor sautait d'un coup a sa nouvelle
       place — en pleine traversee, la crete se teleportait. Le decor y glisse
       desormais, en une demi-seconde. Le defilement, lui, reste suivi pas a
       pas : seul ce qui suit de pres un changement de hauteur est lisse. */
    const GLIDE_MS = 560;
    let drawnU = null, glide = null, layoutAt = -1e9;
    function glided(target) {
      const now = performance.now();
      if (!glide && drawnU != null && now - layoutAt < 700 && Math.abs(target - drawnU) > .002) {
        glide = { from: drawnU, at: now, ms: GLIDE_MS + 220 * Math.min(2, Math.abs(target - drawnU)) };
      }
      if (!glide) return target;
      const k = Math.min(1, (now - glide.at) / glide.ms);
      const e = k * k * (3 - 2 * k);
      if (k >= 1) { glide = null; return target; }
      ask();
      return glide.from + (target - glide.from) * e;
    }

    function update() {
      raf = 0;
      if (!ready) return;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const u = glided(count > 1 ? Math.min(count - (even ? 1e-6 : 1), y / segLen) : 0);
      drawnU = u;
      const i = Math.min(count - 1, Math.floor(u));
      /* Chaque biome tient un moment avant de ceder la place ; sur une fiche,
         il tient sa part de page et ne passe la main qu'a la fin de celle-ci.
         Pendant la traversee, l'avancee suit le defilement pas a pas : la
         molette est la marche. */
      const span = even ? .28 : .7;
      const t = i < count - 1 ? Math.min(1, Math.max(0, (u - i - (1 - span)) / span)) : 0;
      const moving = t > 0 && t < 1;

      for (let k = 0; k < scenes.length; k++) {
        if (scenes[k] && k !== i && k !== i + 1) { setLive(scenes[k], false); setMoving(scenes[k], false); }
      }

      setWorldMoving(moving);

      const a = sceneAt(i);
      setLive(a, true);
      setMoving(a, moving);

      let b = null;
      if (i + 1 < count) {
        b = sceneAt(i + 1);
        setLive(b, t > 0);
        setMoving(b, moving);
        /* Prepare l'etape d'apres pour que rien ne se construise en plein vol. */
        if (i + 2 < count && t > .3) sceneAt(i + 2);
      }
      /* ...et celle d'avant, pour qui remonte : une page rouverte au milieu
         (retour arriere, position retenue) construisait le biome precedent en
         plein defilement, et l'image sautait. Quand le navigateur souffle. */
      if (i > 0 && !scenes[i - 1]) whenIdle(() => sceneAt(i - 1));

      /* Le sens de la traversee se decide en y entrant (par le haut : on
         descend ; par le bas : on remonte) et tient jusqu'a ce qu'on en sorte.
         Changer d'avis en plein milieu ne fait donc rien sauter : on refait
         le meme chemin a l'envers. */
      const inside = t > 0 && t < 1;
      if (!inside) backAt = -1;
      else if (backAt !== i) { backAt = i; back = lastU != null && lastU > u; }
      lastU = u;
      travel.apply(a, t > 0 ? b : null, t, 0, inside && back);

      /* Le voile de lecture : absent sur le decor d'ouverture, il se pose des
         que le contenu arrive. */
      const base = isHome ? 0 : 1;
      const ramp = smooth(heroBottom - vh * .95, heroBottom - vh * .35, y);
      setVar(veil, '--veil', Math.max(base * .5, ramp).toFixed(3));
    }

    const ask = () => { if (!raf) raf = requestAnimationFrame(update); };
    let idleAsked = false;
    function whenIdle(fn) {
      if (idleAsked) return;
      idleAsked = true;
      const run = () => { idleAsked = false; fn(); };
      if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 800 });
      else setTimeout(run, 120);
    }

    /* measure() lit la hauteur du document : c'est un calcul de mise en page
       force. Appele a chaque notification du ResizeObserver — et la page en
       emet des dizaines pendant que ses elements se revelent — il rendait le
       defilement saccade a lui tout seul. Il attend donc la prochaine image,
       comme le reste. */
    let mraf = 0;
    const remeasure = () => {
      layoutAt = performance.now();
      if (mraf) return;
      mraf = requestAnimationFrame(() => { mraf = 0; measure(); update(); });
    };

    /* Une page qui connait son biome plus tard que le decor (la fiche d'un
       biome lit ?b= dans son JSON) le pose ici. */
    OW.setBiomeRoute = (list) => setRoute((list || []).filter(known));

    measure();
    update();
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', remeasure);
    /* La page grandit quand ses donnees arrivent : on remesure. */
    if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);

    /* Le decor peut naitre avant la fin de la page (voir plus bas) : les
       donnees du mod (js/wiki-data.js) arrivent alors avec elle. */
    const withData = (fn) => {
      if (OW.loadWikiData) fn();
      else document.addEventListener('DOMContentLoaded', () => { if (OW.loadWikiData) fn(); }, { once: true });
    };
    withData(() => { OW.loadWikiData().then(rememberRoutes).catch(() => {}); });
    if (slug) withData(() => {
      OW.loadWikiData().then((data) => {
        const entity = (data.allEntities || data.entities).find((e) => e.slug === slug);
        setRoute(entity ? entityBiomes(entity) : entityBiomes(slug));
      }).catch(() => setRoute(entityBiomes(slug)));
    });

    /* La parallaxe a la souris : seulement sur une machine capable (en effets
       allegés, le decor reste immobile). */
    if (finePointer && !reduced) {
      let praf = 0, pe = null;
      const lite = () => !!(OW.perf && OW.perf.lite());
      const sync = () => {
        world.classList.toggle('bw-parallax', !lite());
        if (lite()) { world.style.removeProperty('--px'); world.style.removeProperty('--py'); }
      };
      sync();
      document.addEventListener('ow:perf', sync);
      window.addEventListener('pointermove', (e) => {
        if (lite()) return;
        pe = e;
        if (praf) return;
        praf = requestAnimationFrame(() => {
          praf = 0;
          world.style.setProperty('--px', (pe.clientX / window.innerWidth - .5).toFixed(3));
          world.style.setProperty('--py', (pe.clientY / window.innerHeight - .5).toFixed(3));
        });
      }, { passive: true });
    }
  }

  /* Pour les autres scripts : une scene autonome d'un biome (sans les
     silhouettes des bords, trop grandes hors plein ecran), et le biome
     d'entree de chaque page. */
  /* Une vignette sortie de l'ecran met ses animations en pause (.is-paused,
     css/motion.css) : elle ne coute plus rien tant qu'on ne la voit pas. */
  const pauser = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('is-paused', !e.isIntersecting)),
      { rootMargin: '120px 0px' })
    : null;

  /**
   * Une scene autonome, pour une vignette.
   * @param {string} id le biome
   * @param {number} [width] la largeur ou elle va vivre, en pixels : elle
   *   regle la densite des particules. 320 px par defaut, la largeur d'une
   *   carte de creature.
   */
  OW.biomeScene = (id, width) => {
    const b = BIOMES.find((x) => x.id === id);
    if (!b) return null;
    const el = buildScene(b, width || 320);
    el.classList.add('is-live', 'is-mini');
    if (pauser) pauser.observe(el);
    return el;
  };
  OW.pageBiome = (file) => ((PAGES[String(file || '').replace(/\.html$/, '')] || [])[0]) || 'jungle';
  OW.entityBiomes = entityBiomes;

  /* Quand poser le decor. Ce script est dans l'en-tete : le decor se pose a
     pagereveal, juste avant la premiere image de la page — celle que le
     navigateur photographie pour la transition entre pages (css/ux.css). Il
     y est donc toujours, et glisse a chaque changement de page, que la page
     soit deja en cache ou non. A defaut (navigateur sans pagereveal, ou page
     pas encore commencee), il se pose a la fin de la lecture de la page. Le
     voile de chargement suit (js/loader.js, ow:world). */
  /* Les couches de la transition (decor, en-tete, contenu : css/ux.css) ne
     portent leur nom que pendant la transition : html.vt-on, pose a la sortie
     de l'ancienne page et a l'arrivee de la nouvelle, retire a la fin. Ecoute
     ici, dans l'en-tete : un chargement lent peut reveler la page bien avant
     que les scripts du bas soient lus. */
  const html = document.documentElement;

  /* Le glissement est celui de la barre du haut : il ne joue qu'entre les
     pages du premier niveau — l'accueil (le logo), les rubriques du menu et
     Telecharger. Vers ou depuis une page plus profonde (une fiche de bete ou
     de biome, la 404...), pas de glissement : le chargement habituel.
     Son sens suit le menu : une page plus a droite arrive par la droite, une
     page plus a gauche par la gauche (html.vt-back, css/ux.css). L'accueil
     est tout a gauche, Telecharger tout a droite. La page qu'on quitte decide
     et laisse le sens a celle qui arrive. */
  const DIR_KEY = 'ow-vt-dir';
  const fileOf = (url) => (url.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
  /* Les pages hors menu se rangent juste apres leur rubrique : une fiche de
     bete (et la page des boss) apres les Creatures, une fiche de biome apres
     les Biomes. Sans cela, la transition vers une fiche etait sautee. */
  const PARENT = { animal: 'creatures', bosses: 'creatures', biome: 'biomes' };
  const rankOf = (file) => {
    const order = OW.navPages || [];
    if (file === 'index') return -1;
    if (file === 'download') return order.length;
    if (PARENT[file]) {
      const parent = order.indexOf(PARENT[file]);
      return parent < 0 ? null : parent + 0.5;
    }
    const at = order.indexOf(file);
    return at < 0 ? null : at;
  };

  /* ---- la bete qui passe de sa carte a sa fiche -------------------------------
     Un clic sur une carte (tout lien vers animal.html?e=... qui contient un
     [data-vt-art]) : pendant la transition, l'image de la carte et le rendu
     de la fiche portent le meme nom (beast-art), et le navigateur fait
     glisser l'une vers l'autre. Le nom n'est pose que le temps du passage. */
  const BEAST_KEY = 'ow-vt-beast';
  /* Le rendu solo d'une bete (le meme chemin que js/animal.js, soloArt). */
  OW.soloSrc = (slug) => encodeURI('assets/entities/solo/'
    + String(slug).split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' [SOLO].png');
  let lastLink = null;
  document.addEventListener('click', (event) => {
    lastLink = event.target && event.target.closest ? event.target.closest('a[href]') : null;
  }, true);
  const beastOf = (url) => (url && /(^|\/)animal\.html$/.test(url.pathname) ? new URLSearchParams(url.search).get('e') : null);
  function markBeastSource(to) {
    const slug = beastOf(to);
    if (!slug || !lastLink) return;
    let href = null;
    try { href = new URL(lastLink.href, location.href); } catch (e) { return; }
    if (beastOf(href) !== slug) return;
    const art = lastLink.querySelector('[data-vt-art]');
    if (!art) return;
    const r = art.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight) return;
    art.style.viewTransitionName = 'beast-art';
    try { sessionStorage.setItem(BEAST_KEY, slug); } catch (e) { /* pas de fondu */ }
  }
  /** Cote fiche : le rendu du haut prend le relais, s'il est deja dans la page. */
  function markBeastTarget() {
    let slug = null;
    try { slug = sessionStorage.getItem(BEAST_KEY); sessionStorage.removeItem(BEAST_KEY); } catch (e) { return; }
    if (!slug || beastOf(location) !== slug) return;
    const img = document.querySelector('[data-art]');
    if (!img) return;
    if (OW.soloSrc && !img.getAttribute('src')) img.src = OW.soloSrc(slug);
    img.style.viewTransitionName = 'beast-art';
    /* Le rendu arrive deja en place : pas d'entree en glissade par-dessus
       (la classe reste, sinon l'animation repartirait de zero a son retrait). */
    html.classList.add('vt-beast');
    return img;
  }
  window.addEventListener('pageswap', (event) => {
    if (!event.viewTransition) return;
    let to = null;
    try { to = event.activation && event.activation.entry && new URL(event.activation.entry.url); } catch (e) { to = null; }
    const a = rankOf(fileOf(location)), b = to ? rankOf(fileOf(to)) : null;
    if (a == null || b == null) { event.viewTransition.skipTransition(); return; }
    html.classList.add('vt-on');
    markBeastSource(to);
    try {
      const back = b < a;
      sessionStorage.setItem(DIR_KEY, JSON.stringify({ to: to ? to.pathname + to.search : '', back }));
    } catch (e) { /* le sens par defaut */ }
  });
  window.addEventListener('pagereveal', (event) => {
    if (!event.viewTransition) { try { sessionStorage.removeItem(BEAST_KEY); } catch (e) { /* rien */ } return; }
    html.classList.add('vt-on');
    const beast = markBeastTarget();
    if (beast) event.viewTransition.finished.finally(() => { beast.style.viewTransitionName = ''; });
    try {
      const dir = JSON.parse(sessionStorage.getItem(DIR_KEY) || 'null');
      sessionStorage.removeItem(DIR_KEY);
      if (dir && dir.back && dir.to === location.pathname + location.search) html.classList.add('vt-back');
    } catch (e) { /* le sens par defaut */ }
    event.viewTransition.finished.finally(() => html.classList.remove('vt-on', 'vt-back'));
  });
  /* Une page restauree depuis le cache (retour arriere) avait garde la
     marque de sa sortie : on la retire. */
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    html.classList.remove('vt-on', 'vt-back');
    document.querySelectorAll('[data-vt-art]').forEach((el) => { el.style.viewTransitionName = ''; });
  });

  let started = false;
  const start = () => {
    if (started || !document.body) return;
    started = true;
    initWorld();
    document.dispatchEvent(new Event('ow:world'));
  };
  window.addEventListener('pagereveal', start);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}(window.OW = window.OW || {}));
