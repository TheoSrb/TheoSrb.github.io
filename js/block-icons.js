/* Les icones de blocs, dessinees comme dans l'inventaire de Minecraft.

   Deux dossiers de textures 2D :
     assets/block/     les blocs du mod (son dossier textures/block) ;
     assets/mcblocks/  les blocs de Minecraft, ceux que le mod reprend (les
                       bûches autour des bois scarifies) ou que le wiki cite
                       (botte de foin, citrouille, gateau, verre…).
   Et leurs objets a plat : assets/item/ (mod), assets/mcitems/ (Minecraft).

   Un bloc plein ne se montre pas a plat : on le monte en cube vu de trois
   quarts, dessus eclaire, flancs assombris, comme le jeu le fait dans
   l'inventaire. Dalles, escaliers, barrieres, trappes, gateau ont leur forme.
   La face de gauche est la face avant du bloc (celle des bois scarifies,
   de la citrouille sculptee), comme dans l'inventaire du jeu.

   Les plantes restent a plat (c'est aussi ce que fait le jeu). Les blocs dont
   le modele est special (oeuf, ours en peluche, carcasse, piege) n'ont pas de
   modele ici : ils prennent leur image d'objet si elle existe.

   Un identifiant « minecraft:… » cherche dans les dossiers de Minecraft,
   « ow:… » (ou sans prefixe) dans ceux du mod.

   OW.blockModel(id)  -> la description du modele, ou null
   OW.blockCandidates(id) -> images a plat a essayer (plantes, objets)
   OW.paintBlocks(root) -> dessine les [data-block] qui ont un modele */

(function (OW) {
  'use strict';

  const OW_TEX = (name) => 'assets/block/' + name + '.png';
  const MC_TEX = (name) => 'assets/mcblocks/' + name + '.png';

  /* Une boite : coins en seiziemes de bloc, comme les modeles du jeu. Chaque
     face visible a sa texture (chemin complet) : left, right, top. */
  const box = (x1, y1, z1, x2, y2, z2, tex) => ({ from: [x1, y1, z1], to: [x2, y2, z2], tex });
  const faces = (left, right, top, tint) => ({ left, right: right || left, top: top || left, tint });
  const cube = (side, top, tint) => [box(0, 0, 0, 16, 16, 16, faces(side, side, top || side, tint))];

  /* Les feuilles sont grises dans le fichier : le jeu les teinte de la couleur
     du feuillage. Celle-ci est le vert sombre des coniferes. */
  const FOLIAGE = '#5C8C3A';

  const FLAT = {
    lavender: 'lavender',
    camellia: 'camellia',
    potted_lavender: 'lavender',
    potted_camellia: 'camellia',
    redwood_sapling: 'redwood_sapling',
    savage_berry_bush: 'savage_berry_bush_stage3'
  };
  const MC_FLAT = {
    brown_mushroom: 'brown_mushroom',
    red_mushroom: 'red_mushroom',
    sugar_cane: 'sugar_cane'
  };
  /* Les plantes grises dans le fichier, que le jeu teinte : a plat, de la
     couleur qu'il leur donne hors de tout biome (GrassColor.get(0.5, 1.0),
     lu dans colormap/grass.png ; 0x71C35C pour le nenuphar). Les plantes
     hautes montrent leur moitie du haut, comme dans l'inventaire. */
  const GRASS = '#7CBD6B';
  const MC_TINTED = {
    short_grass: ['short_grass', GRASS],
    fern: ['fern', GRASS],
    tall_grass: ['tall_grass_top', GRASS],
    large_fern: ['large_fern_top', GRASS],
    lily_pad: ['lily_pad', '#71C35C']
  };
  const plant = (tex, tint) => [{ flat: true, from: [0, 0, 0], to: [16, 16, 16], tex: faces(tex, tex, tex, tint) }];

  /** « minecraft:hay_block » -> { mc: true, p: 'hay_block' }. */
  function parse(id) {
    const s = String(id || '');
    const ns = (s.match(/^([a-z0-9_.-]+):/) || [])[1] || null;
    return { mc: ns === 'minecraft', bare: !ns, p: s.replace(/^.*:/, '') };
  }

  /* Les blocs de Minecraft que le wiki sait dessiner. */
  function vanillaModel(p, generic) {
    if (/^(oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|pale_oak)_log$/.test(p)) return cube(MC_TEX(p), MC_TEX(p + '_top'));
    if (p === 'hay_block') return cube(MC_TEX('hay_block_side'), MC_TEX('hay_block_top'));
    if (p === 'pumpkin') return cube(MC_TEX('pumpkin_side'), MC_TEX('pumpkin_top'));
    if (p === 'melon') return cube(MC_TEX('melon_side'), MC_TEX('melon_top'));
    if (MC_TINTED[p]) return plant(MC_TEX(MC_TINTED[p][0]), MC_TINTED[p][1]);
    if (p === 'carved_pumpkin') return [box(0, 0, 0, 16, 16, 16, faces(MC_TEX('carved_pumpkin'), MC_TEX('pumpkin_side'), MC_TEX('pumpkin_top')))];
    if (p === 'honey_block') return cube(MC_TEX('honey_block_side'), MC_TEX('honey_block_top'));
    if (p === 'glass') return cube(MC_TEX('glass'));
    if (p === 'cake') return [box(1, 0, 1, 15, 8, 15, faces(MC_TEX('cake_side'), MC_TEX('cake_side'), MC_TEX('cake_top')))];
    /* Prets a dessiner des que leurs textures arrivent dans assets/mcblocks/
       (noms du jeu). Tant qu'il en manque une, l'icone de repli reste. */
    if (p === 'crafting_table') return [box(0, 0, 0, 16, 16, 16, faces(MC_TEX('crafting_table_front'), MC_TEX('crafting_table_side'), MC_TEX('crafting_table_top')))];
    if (p === 'ancient_debris') return cube(MC_TEX('ancient_debris_side'), MC_TEX('ancient_debris_top'));
    /* Le tapis se dessine avec la laine de sa couleur, un pixel d'epaisseur. */
    if (/_carpet$/.test(p)) return [box(0, 0, 0, 16, 1, 16, faces(MC_TEX(p.replace(/_carpet$/, '_wool'))))];
    /* Tout autre bloc de Minecraft (laines, planches, pierre, betons…) : un
       cube de sa texture assets/mcblocks/<nom>.png, s'il y en a une. Les
       plantes restent a plat. */
    if (MC_FLAT[p] || !generic) return null;
    return cube(MC_TEX(p));
  }

  function blockModel(id) {
    const { mc, bare, p } = parse(id);
    /* Le cube « generique » (toute texture de mcblocks) n'est tente que pour
       un identifiant explicitement de Minecraft. */
    if (mc) return vanillaModel(p, true);
    const own = modModel(p);
    return own || (bare ? vanillaModel(p, false) : null);
  }

  function modModel(p) {
    if (p === 'redwood_leaves') return cube(OW_TEX(p), OW_TEX(p), FOLIAGE);
    if (/_ore$/.test(p) || p === 'marked_mud' || p === 'dna_analyser' || p === 'redwood_planks') return cube(OW_TEX(p));
    if (p === 'saddler') return cube(OW_TEX('saddler_side'), OW_TEX('saddler_top'));
    if (p === 'redwood_log' || p === 'stripped_redwood_log') return cube(OW_TEX(p), OW_TEX(p + '_top'));
    if (p === 'redwood_wood') return cube(OW_TEX('redwood_log'));
    if (p === 'stripped_redwood_wood') return cube(OW_TEX('stripped_redwood_log'));
    /* Le bois scarifie (models/block/scarified_*_log.json du mod) : la face
       griffee devant, l'ecorce et le cerne de la bûche de Minecraft ailleurs. */
    const scarified = p.match(/^scarified_(.+)_log$/);
    if (scarified) {
      const wood = scarified[1] + '_log';
      return [box(0, 0, 0, 16, 16, 16, faces(OW_TEX(p), MC_TEX(wood), MC_TEX(wood + '_top')))];
    }

    const planks = faces(OW_TEX('redwood_planks'));
    if (p === 'redwood_slab') return [box(0, 0, 0, 16, 8, 16, planks)];
    /* L'escalier se presente comme dans l'inventaire du jeu : la marche vers
       nous, la contremarche au fond. */
    if (p === 'redwood_stairs') return [box(0, 0, 0, 16, 8, 16, planks), box(0, 8, 0, 16, 16, 8, planks)];
    if (p === 'redwood_pressure_plate') return [box(1, 0, 1, 15, 1, 15, planks)];
    if (p === 'redwood_button') return [box(5, 6, 6, 11, 10, 10, planks)];
    if (p === 'redwood_fence') {
      return [
        box(6, 0, 0, 10, 16, 4, planks), box(6, 0, 12, 10, 16, 16, planks),
        box(7, 12, 4, 9, 15, 12, planks), box(7, 6, 4, 9, 9, 12, planks)
      ];
    }
    if (p === 'redwood_fence_gate') {
      return [
        box(0, 5, 7, 2, 16, 9, planks), box(14, 5, 7, 16, 16, 9, planks),
        box(2, 6, 7, 14, 9, 9, planks), box(2, 12, 7, 14, 15, 9, planks),
        box(6, 9, 7, 10, 12, 9, planks)
      ];
    }
    if (p === 'redwood_trapdoor') return [box(0, 0, 0, 16, 3, 16, faces(OW_TEX('redwood_trapdoor')))];
    return null;
  }

  function blockCandidates(id) {
    const { mc, p } = parse(id);
    const list = [];
    if (mc) {
      list.push('assets/mcitems/' + p + '.png');
      if (MC_FLAT[p]) list.push(MC_TEX(MC_FLAT[p]));
      return list;
    }
    if (FLAT[p]) list.push(OW_TEX(FLAT[p]));
    list.push('assets/item/' + p + '.png');
    return list;
  }

  /* ---- le dessin ------------------------------------------------------------- */

  const images = {};
  function loadImage(src) {
    if (!images[src]) {
      images[src] = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('texture absente : ' + src));
        img.src = src;
      });
    }
    return images[src];
  }

  /* La texture assombrie d'une face : dessus 1, flanc gauche .8, droit .6,
     les valeurs de l'inventaire du jeu. Les trous (feuilles) restent vides. */
  const shadedCache = new Map();
  function shaded(img, light, tint) {
    const key = img.src + '|' + light + '|' + (tint || '');
    if (shadedCache.has(key)) return shadedCache.get(key);
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    if (tint) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(img, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (light < 1) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(0,0,0,' + (1 - light) + ')';
      ctx.fillRect(0, 0, c.width, c.height);
    }
    shadedCache.set(key, c);
    return c;
  }

  const C30 = Math.cos(Math.PI / 6);
  const S45 = Math.SQRT1_2;

  function render(model, textures, size) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const s = size * 0.9 / 25.3;
    /* Vue de trois quarts : rotation de 45 degres, plongee de 30. */
    const project = (x, y, z) => ({ x: (x - z) * S45 * s, y: -y * C30 * s + (x + z) * S45 * 0.5 * s });
    const mid = project(8, 8, 8);
    const ox = size / 2 - mid.x;
    const oy = size / 2 - mid.y;
    const P = (x, y, z) => { const q = project(x, y, z); return { x: q.x + ox, y: q.y + oy }; };

    /* Pose une region de texture (u0,v0 -> u1,v1, en seiziemes) sur un
       parallelogramme : origine O, axes U et V par texel. La region deborde a
       peine, pour ne pas laisser de fil clair entre deux faces. */
    function face(img, light, O, U, V, u0, v0, u1, v1) {
      const src = shaded(img, light, tint);
      const k = img.width / 16;
      const e = 0.06;
      ctx.setTransform(U.x, U.y, V.x, V.y, O.x - U.x * u0 - V.x * v0, O.y - U.y * u0 - V.y * v0);
      ctx.drawImage(src, u0 * k, v0 * k, (u1 - u0) * k, (v1 - v0) * k, u0 - e, v0 - e, u1 - u0 + 2 * e, v1 - v0 + 2 * e);
    }

    const sorted = model.slice().sort((a, b) =>
      (a.from[0] + a.from[2] + a.from[1]) - (b.from[0] + b.from[2] + b.from[1]));

    let tint = null;
    sorted.forEach((b) => {
      tint = b.tex.tint || null;
      if (b.flat) {
        /* Une plante : l'image a plat, teintee, a la largeur d'un cube. */
        const w = size * 0.9;
        ctx.drawImage(shaded(textures[b.tex.left], 1, tint), (size - w) / 2, (size - w) / 2, w, w);
        return;
      }
      const [x1, y1, z1] = b.from;
      const [x2, y2, z2] = b.to;
      const left = textures[b.tex.left];
      const right = textures[b.tex.right];
      const top = textures[b.tex.top];
      const d = (a, c) => ({ x: c.x - a.x, y: c.y - a.y });
      const o = P(0, 0, 0);
      const ux = d(o, P(1, 0, 0));
      const uy = d(o, P(0, 1, 0));
      const uz = d(o, P(0, 0, 1));
      const neg = (v) => ({ x: -v.x, y: -v.y });

      /* Face de gauche (l'avant du bloc) : u suit x, v descend. */
      face(left, 0.8, P(x1, y2, z2), ux, neg(uy), x1, 16 - y2, x2, 16 - y1);
      /* Face de droite : u suit -z, v descend. */
      face(right, 0.6, P(x2, y2, z2), neg(uz), neg(uy), 16 - z2, 16 - y2, 16 - z1, 16 - y1);
      /* Dessus : u suit x, v suit z. */
      face(top, 1, P(x1, y2, z1), ux, uz, x1, z1, x2, z2);
    });

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return canvas.toDataURL('image/png');
  }

  const icons = {};
  /** L'icone d'un bloc (URL data:), ou null s'il n'a pas de modele. */
  function blockIcon(id, size) {
    const model = blockModel(id);
    if (!model) return Promise.resolve(null);
    const key = String(id) + '@' + (size || 128);
    if (!icons[key]) {
      const names = [];
      model.forEach((b) => { [b.tex.left, b.tex.right, b.tex.top].forEach((n) => { if (names.indexOf(n) === -1) names.push(n); }); });
      /* Chaque texture est d'abord verifiee sans etre telechargee (et le
         verdict garde) : un objet de Minecraft sans bloc depose ne coute
         qu'une petite requete. */
      const exists = (n) => (OW.assetExists ? OW.assetExists(n) : Promise.resolve(true));
      icons[key] = Promise.all(names.map(exists))
        .then((ok) => (ok.every(Boolean) ? Promise.all(names.map((n) => loadImage(n))) : Promise.reject(new Error('texture absente'))))
        .then((imgs) => {
          const textures = {};
          names.forEach((n, i) => { textures[n] = imgs[i]; });
          return render(model, textures, size || 128);
        })
        .catch(() => null);
    }
    return icons[key];
  }

  /** Dessine chaque [data-block] qui a un modele ; les autres gardent leurs images. */
  function paintBlocks(root) {
    (root || document).querySelectorAll('[data-block]:not([data-block-painted])').forEach((el) => {
      el.setAttribute('data-block-painted', '');
      blockIcon(el.dataset.block).then((url) => {
        if (!url) return;
        el.style.backgroundImage = 'url("' + url + '")';
        el.setAttribute('data-img-found', 'block-model');
      });
    });
  }

  Object.assign(OW, { blockModel, blockCandidates, blockIcon, paintBlocks });
}(window.OW = window.OW || {}));
