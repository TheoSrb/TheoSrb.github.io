/* Les creatures en 3D, telles que le jeu les dessine.

   data/models.json (tools/build-models.py) contient, pour chaque creature, les
   parties de son modele Java (cubes, pivots, decalages de texture) et ses
   animations en keyframes vanilla. Ce module les assemble en three.js et les
   anime avec les memes regles que Minecraft :
   - un cube se texture en « box UV » (ModelPart.Cube) ;
   - une partie se place par son pivot, puis tourne dans l'ordre Z, Y, X ;
   - le modele entier est retourne (echelle -1, -1, 1) et descendu de 1,501
     bloc, comme dans LivingEntityRenderer ;
   - une animation remet chaque partie a sa pose, puis ajoute les valeurs des
     keyframes interpolees (lineaire ou Catmull-Rom), comme KeyframeAnimations.

   OW.creature3d.models()                -> Promise des modeles
   OW.creature3d.build(THREE, model)     -> { object, play(name), tick(t), sets }
   OW.creature3d.sets(model)             -> les animations utiles : repos,
                                            marche, course, nage, attaque. */

(function (OW) {
  'use strict';

  let modelsPromise = null;
  function models() {
    if (!modelsPromise) {
      modelsPromise = fetch('data/models.json').then((r) => {
        if (!r.ok) throw new Error('data/models.json');
        return r.json();
      }).catch((e) => { modelsPromise = null; throw e; });
    }
    return modelsPromise;
  }

  /* ---- les cubes ---------------------------------------------------------------- */

  /* Les six faces d'un cube vanilla : ses quatre sommets (indices dans v0..v7),
     sa zone de texture (colonnes et lignes de la « box UV ») et sa normale. */
  const FACES = [
    { v: [5, 4, 0, 1], uv: ['f5', 'f10', 'f6', 'f11'], n: [0, -1, 0] },
    { v: [2, 3, 7, 6], uv: ['f6', 'f11', 'f7', 'f10'], n: [0, 1, 0] },
    { v: [0, 4, 7, 3], uv: ['f4', 'f11', 'f5', 'f12'], n: [-1, 0, 0] },
    { v: [1, 0, 3, 2], uv: ['f5', 'f11', 'f6', 'f12'], n: [0, 0, -1] },
    { v: [5, 1, 2, 6], uv: ['f6', 'f11', 'f8', 'f12'], n: [1, 0, 0] },
    { v: [4, 5, 6, 7], uv: ['f8', 'f11', 'f9', 'f12'], n: [0, 0, 1] }
  ];

  function cubeGeometry(THREE, cubes, texW, texH) {
    const pos = [], uvs = [], nor = [], idx = [];
    cubes.forEach(([u, v, x, y, z, w, h, d, g, mirror]) => {
      let x0 = x - g, x1 = x + w + g;
      const y0 = y - g, y1 = y + h + g, z0 = z - g, z1 = z + d + g;
      if (mirror) { const t = x1; x1 = x0; x0 = t; }
      const V = [
        [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
        [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]
      ];
      const F = {
        f4: u, f5: u + d, f6: u + d + w, f7: u + d + w + w, f8: u + d + w + d, f9: u + d + w + d + w,
        f10: v, f11: v + d, f12: v + d + h
      };
      FACES.forEach((face) => {
        const u1 = F[face.uv[0]] / texW, v1 = F[face.uv[1]] / texH;
        const u2 = F[face.uv[2]] / texW, v2 = F[face.uv[3]] / texH;
        /* Polygon : sommet 0 -> (u2, v1), 1 -> (u1, v1), 2 -> (u1, v2), 3 -> (u2, v2). */
        let quad = [
          [V[face.v[0]], u2, v1], [V[face.v[1]], u1, v1], [V[face.v[2]], u1, v2], [V[face.v[3]], u2, v2]
        ];
        const n = face.n.slice();
        if (mirror) { quad = quad.reverse(); n[0] = -n[0]; }
        const base = pos.length / 3;
        quad.forEach(([p, qu, qv]) => {
          pos.push(p[0] / 16, p[1] / 16, p[2] / 16);
          uvs.push(qu, qv);
          nor.push(n[0], n[1], n[2]);
        });
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      });
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setIndex(idx);
    return geo;
  }

  /* ---- l'animation --------------------------------------------------------------- */

  const DEG = Math.PI / 180;
  const catmull = (t, a, b, c, d) =>
    0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);

  /* La valeur d'un canal a l'instant t (secondes), deja convertie comme les
     helpers vanilla : degreeVec en radians, posVec avec Y inverse, scaleVec
     moins 1 (on l'ajoute a l'echelle 1). */
  function sample(keys, kind, t) {
    let first = keys.length;
    for (let k = 0; k < keys.length; k++) { if (t <= keys[k][0]) { first = k; break; } }
    const i = Math.max(0, first - 1);
    const j = Math.min(keys.length - 1, i + 1);
    const a = keys[i], b = keys[j];
    const alpha = j !== i ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
    const out = [0, 0, 0];
    for (let c = 1; c <= 3; c++) {
      let value;
      if (b[4]) {
        const p0 = keys[Math.max(0, i - 1)][c], p3 = keys[Math.min(keys.length - 1, j + 1)][c];
        value = catmull(alpha, p0, a[c], b[c], p3);
      } else {
        value = a[c] + (b[c] - a[c]) * alpha;
      }
      out[c - 1] = value;
    }
    if (kind === 'r') return [out[0] * DEG, out[1] * DEG, out[2] * DEG];
    if (kind === 'p') return [out[0], -out[1], out[2]];
    return [out[0] - 1, out[1] - 1, out[2] - 1];
  }

  /* ---- l'assemblage -------------------------------------------------------------- */

  const textureCache = {};
  function texture(THREE, url) {
    if (!textureCache[url]) {
      const tex = new THREE.TextureLoader().load(url);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.flipY = false;
      if ('sRGBEncoding' in THREE) tex.encoding = THREE.sRGBEncoding;
      textureCache[url] = tex;
    }
    return textureCache[url];
  }

  function build(THREE, model, options) {
    const opts = options || {};
    const material = new THREE.MeshLambertMaterial({
      map: texture(THREE, opts.texture || model.tex), side: THREE.DoubleSide, alphaTest: 0.5
    });

    /* Le retournement du rendu vanilla : echelle (-1, -1, 1), puis 1,501 bloc. */
    const object = new THREE.Group();
    object.scale.set(-1, -1, 1);
    const inner = new THREE.Group();
    inner.position.y = -1.501;
    object.add(inner);

    const parts = {};
    model.parts.forEach((p) => {
      const group = new THREE.Group();
      group.rotation.order = 'ZYX';
      if (p.cubes.length) group.add(new THREE.Mesh(cubeGeometry(THREE, p.cubes, model.texW, model.texH), material));
      parts[p.name] = { group, pose: p.pose, off: [0, 0, 0], rot: [0, 0, 0], scl: [0, 0, 0] };
      (p.parent && parts[p.parent] ? parts[p.parent].group : inner).add(group);
    });

    const list = Object.values(parts);
    const apply = () => list.forEach((part) => {
      const [x, y, z, rx, ry, rz] = part.pose;
      part.group.position.set((x + part.off[0]) / 16, (y + part.off[1]) / 16, (z + part.off[2]) / 16);
      part.group.rotation.set(rx + part.rot[0], ry + part.rot[1], rz + part.rot[2]);
      part.group.scale.set(1 + part.scl[0], 1 + part.scl[1], 1 + part.scl[2]);
    });
    apply();

    let current = null;
    let started = 0;
    function play(name) {
      current = name && model.anims[name] ? model.anims[name] : null;
      started = performance.now();
    }
    /** Pose le modele a l'instant `now` (ms) de l'animation en cours. */
    function tick(now) {
      list.forEach((part) => { part.off = [0, 0, 0]; part.rot = [0, 0, 0]; part.scl = [0, 0, 0]; });
      if (current) {
        let t = (now - started) / 1000;
        /* Une animation qui ne boucle pas se rejoue apres un temps de pause. */
        t = current.loop ? t % current.len : t % (current.len + 0.8);
        current.ch.forEach(([bone, kind, keys]) => {
          const part = parts[bone];
          if (!part || !keys.length) return;
          const v = sample(keys, kind, t);
          const target = kind === 'r' ? part.rot : kind === 'p' ? part.off : part.scl;
          target[0] += v[0]; target[1] += v[1]; target[2] += v[2];
        });
      }
      apply();
    }
    return { object, play, tick, parts };
  }

  /* Les animations qui parlent a un visiteur, dans l'ordre des boutons. */
  const SETS = [
    ['idle', 'Repos', /^MISC_IDLE$/], ['walk', 'Marche', /^MOVE_WALK$/], ['run', 'Course', /^MOVE_RUN$/],
    ['swim', 'Nage', /^MOVE_SWIM$/], ['attack', 'Attaque', /^ATTACK_STRIKE$/]
  ];
  function sets(model) {
    const names = Object.keys(model.anims || {});
    return SETS.map(([key, label, re]) => ({ key, label, anim: names.find((n) => re.test(n)) }))
      .filter((s) => s.anim);
  }

  OW.creature3d = { models, build, sets };
}(window.OW = window.OW || {}));
