/* glTF turntable for the cosmetics gallery.

   three.js is fetched only when a skin with a model is first opened, instead of
   on every page load — the gallery itself is plain HTML and does not need it.
   If the CDN is unreachable the caller falls back to the 2D render. */

(function (OW) {
  'use strict';

  const THREE_VERSION = '0.128.0';

  /* Deux hebergeurs, essayes dans l ordre. La visionneuse entiere dependait
     d un seul CDN : indisponible, bloque par un reseau d entreprise ou par un
     bloqueur, et plus aucun cosmetique n avait de modele 3D — sans que rien ne
     dise pourquoi. */
  const SOURCES = [
    {
      three: `https://cdnjs.cloudflare.com/ajax/libs/three.js/${THREE_VERSION}/three.min.js`,
      loader: `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/js/loaders/GLTFLoader.js`
    },
    {
      three: `https://unpkg.com/three@${THREE_VERSION}/build/three.min.js`,
      loader: `https://unpkg.com/three@${THREE_VERSION}/examples/js/loaders/GLTFLoader.js`
    }
  ];

  let loading = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded) resolve();
        else {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('Échec du chargement de ' + src)));
        }
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.addEventListener('load', () => { script.dataset.loaded = '1'; resolve(); });
      script.addEventListener('error', () => reject(new Error('Échec du chargement de ' + src)));
      document.head.appendChild(script);
    });
  }

  /** Resolves once THREE and THREE.GLTFLoader are on window. */
  function loadThree() {
    if (window.THREE && window.THREE.GLTFLoader) return Promise.resolve(window.THREE);

    if (!loading) {
      loading = SOURCES.reduce(
        (chain, source) => chain.catch(() => loadScript(source.three).then(() => loadScript(source.loader))),
        Promise.reject()
      )
        .then(() => {
          if (!window.THREE || !window.THREE.GLTFLoader) throw new Error('three.js indisponible');
          return window.THREE;
        })
        .catch((error) => { loading = null; throw error; });
    }
    return loading;
  }

  /* Une texture a-t-elle des pixels ni pleins ni vides ? Quelques-uns ne
     comptent pas (bords adoucis a l'export) : il en faut une vraie surface. */
  const translucencyCache = new WeakMap();
  function hasTranslucency(image) {
    if (!image || !image.width) return false;
    if (translucencyCache.has(image)) return translucencyCache.get(image);
    let result = false;
    try {
      const c = document.createElement('canvas');
      c.width = image.width;
      c.height = image.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let partial = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 8 && data[i] < 247) partial += 1;
      }
      result = partial > 24;
    } catch (error) { result = false; }
    translucencyCache.set(image, result);
    return result;
  }

  /**
   * Mounts a turntable on a canvas.
   * @returns {{dispose: Function, setSpin: Function}}
   */
  function createViewer(canvas, THREE) {
    const host = canvas.parentElement;
    const width = host.clientWidth || 420;
    const height = host.clientHeight || 340;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    /* Les couleurs du jeu, telles quelles. La texture est decodee en lineaire
       par le chargeur : sans sortie sRGB, l'image sortait plus sombre et bien
       plus saturee qu'en jeu, et l'ancien ACES + une ambiance a 2 ne faisaient
       que masquer l'ecart. Plus de tonemapping : un pixel eclaire en plein
       rend exactement sa couleur de texture. */
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);

    /* L'ombrage de Minecraft : le dessus en pleine lumiere, les flancs un peu
       plus sombres, jamais noirs. Ambiance + une lumiere venue d'en haut, dont
       la somme vaut 1 sur le dessus. */
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.34);
    key.position.set(1.2, 4, 2);
    scene.add(key);

    const pivot = new THREE.Group();
    scene.add(pivot);

    const state = {
      rotation: 0.5, tilt: 0, velocity: 0, tiltVelocity: 0,
      dragging: false, lastX: 0, lastY: 0,
      zoom: 1, distance: 3, lift: 0, spin: true, frame: 0, disposed: false,
      /* Encombrement du modele charge, garde pour recadrer au redimensionnement :
         la distance depend du rapport d image, qui change avec la fenetre. */
      extent: null
    };

    /**
     * Recule la camera juste assez pour que le modele tienne dans le cadre.
     *
     * L ancienne version prenait la plus grande des trois dimensions pour un
     * rayon et la multipliait par 2.15. Sur un boa — long, plat, etroit — cela
     * reculait la camera de plus de deux longueurs de serpent : le modele
     * occupait un dixieme du cadre.
     *
     * Ici on calcule l enveloppe reelle de la rotation. Le modele tourne autour
     * de Y : son extension horizontale au pire vaut la diagonale du sol, sa
     * hauteur ne bouge pas. On resout la distance pour chacun des deux champs
     * de vision et on garde la plus contraignante.
     */
    function frameObject() {
      if (!state.extent) return;

      const fovY = camera.fov * Math.PI / 180;
      const fovX = 2 * Math.atan(Math.tan(fovY / 2) * camera.aspect);

      const halfHeight = state.extent.y / 2;
      const halfWidth = Math.hypot(state.extent.x, state.extent.z) / 2;

      const forHeight = halfHeight / Math.tan(fovY / 2);
      const forWidth = halfWidth / Math.tan(fovX / 2);

      /* La marge laisse respirer le modele et absorbe l inclinaison, qui sort
         un peu de l enveloppe calculee ci-dessus. */
      state.distance = Math.max(forHeight, forWidth, 0.4) * 1.28;
      state.lift = halfHeight * 0.16;
    }

    /* ---- interaction -------------------------------------------------------- */

    const onPointerDown = (event) => {
      state.dragging = true;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      canvas.classList.add('is-grabbing');
    };
    const onPointerMove = (event) => {
      if (!state.dragging) return;
      const dx = event.clientX - state.lastX;
      const dy = event.clientY - state.lastY;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      state.rotation += dx * 0.012;
      state.velocity = dx * 0.012;
      state.tilt = Math.max(-0.62, Math.min(0.62, state.tilt + dy * 0.009));
      state.tiltVelocity = dy * 0.009;
    };
    const onPointerUp = () => { state.dragging = false; canvas.classList.remove('is-grabbing'); };
    const onWheel = (event) => {
      event.preventDefault();
      state.zoom = Math.max(0.55, Math.min(2.6, state.zoom * Math.exp(event.deltaY * 0.0016)));
    };
    const onResize = () => {
      const w = host.clientWidth || width;
      const h = host.clientHeight || height;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      /* Le cadrage depend du rapport d image : sans ce recalcul, passer en
         fenetre etroite coupait le modele. */
      frameObject();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onResize, { passive: true });

    /* Ou tombent les pieds du modele a l'ecran, en % de la hauteur : l'hote
       le recoit dans --floor, pour y poser un socle (vitrine des cosmetiques).
       Un boa plat et un elephant n'ont pas les pieds a la meme hauteur. */
    const floorPoint = new THREE.Vector3();
    let lastFloor = null;
    function reportFloor() {
      if (!state.extent) return;
      floorPoint.set(0, -state.extent.y / 2 + pivot.position.y, 0).project(camera);
      const floor = Math.round((1 - floorPoint.y) * 500) / 10;
      if (floor === lastFloor) return;
      lastFloor = floor;
      host.style.setProperty('--floor', floor + '%');
    }

    /* ---- loop ---------------------------------------------------------------- */

    /* Hors de l'ecran, la scene ne se redessine plus : un rendu WebGL par
       image pour une vitrine que personne ne voit, c'etait le plus gros
       travail de la page. Elle reprend des qu'elle revient. */
    let onScreen = true;
    const seen = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        if (onScreen && !state.frame && !state.disposed) state.frame = requestAnimationFrame(loop);
      }, { rootMargin: '200px 0px' })
      : null;
    if (seen) seen.observe(canvas);

    const loop = () => {
      if (state.disposed) return;
      if (!onScreen) { state.frame = 0; return; }
      if (!state.dragging) {
        if (state.spin) state.rotation += 0.0022;
        state.rotation += state.velocity;
        state.velocity *= 0.92;
        state.tilt = Math.max(-0.62, Math.min(0.62, state.tilt + state.tiltVelocity));
        state.tiltVelocity *= 0.9;
      }
      pivot.rotation.y = state.rotation;
      pivot.rotation.x = state.tilt;
      pivot.position.y = Math.sin(Date.now() * 0.0011) * 0.025;
      if (state.tick) state.tick(performance.now());

      const distance = state.distance * state.zoom;
      camera.position.set(0, state.lift * state.zoom, distance);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      reportFloor();
      state.frame = requestAnimationFrame(loop);
    };
    state.frame = requestAnimationFrame(loop);

    return {
      /** Loads a model, framing it in the viewport. */
      load(url) {
        clearInterval(state.cycle);
        state.tick = null;
        return new Promise((resolve, reject) => {
          new THREE.GLTFLoader().load(url, (gltf) => {
            const object = gltf.scene;
            const meshes = [];
            object.traverse((node) => { if (node.isMesh && node.material && node.material.map) meshes.push(node); });
            meshes.forEach((node) => {
              const map = node.material.map;
              /* Voxel textures must stay crisp: no bilinear smoothing. */
              map.magFilter = THREE.NearestFilter;
              map.minFilter = THREE.NearestFilter;
              map.generateMipmaps = false;
              node.material = new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide, alphaTest: 0.5 });

              /* Les skins exportes coupent la transparence a 5 % (MASK) : un
                 pixel translucide sortait plein. Le kodiak des ombres, fait
                 de voiles a demi transparents, devenait un bloc lumineux.
                 Quand la texture a de la transparence partielle, le modele
                 est dessine en deux passes : les pixels pleins d'abord (avec
                 profondeur), puis les translucides par-dessus, fondus. */
              if (hasTranslucency(map.image)) {
                node.material.alphaTest = 0.99;
                const veil = new THREE.Mesh(node.geometry, new THREE.MeshLambertMaterial({
                  map, side: THREE.DoubleSide, transparent: true, depthWrite: false, alphaTest: 0.01
                }));
                veil.renderOrder = 1;
                node.add(veil);
              }
            });

            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            object.position.sub(center);

            while (pivot.children.length) pivot.remove(pivot.children[0]);
            pivot.add(object);

            state.extent = {
              x: size.x || 0.001,
              y: size.y || 0.001,
              z: size.z || 0.001
            };
            state.zoom = 1;
            frameObject();
            resolve();
          }, undefined, () => reject(new Error('Modèle illisible : ' + url)));
        });
      },

      setSpin(value) { state.spin = value; },

      /**
       * Pose un objet deja construit (une creature de js/creature-3d.js) et
       * l'anime : `tick(now)` est appele a chaque image avant le rendu.
       */
      show(object, tick) {
        clearInterval(state.cycle);
        state.tick = tick || null;
        if (tick) tick(performance.now());
        object.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const holder = new THREE.Group();
        /* Une creature du mod regarde vers -Z : on la tourne vers la camera. */
        holder.rotation.y = Math.PI;
        holder.add(object);
        object.position.sub(center);
        while (pivot.children.length) pivot.remove(pivot.children[0]);
        pivot.add(holder);
        state.extent = { x: size.x || 0.001, y: size.y || 0.001, z: size.z || 0.001 };
        state.zoom = 1;
        frameObject();
      },

      /**
       * Pose tour a tour des calques sur la texture du modele charge (le skin
       * Virus : ses visages). Chaque calque est dessine PAR-DESSUS la texture
       * d'origine, jamais a sa place ; un nouveau toutes les `every` ms.
       * Un nouveau chargement ou dispose() arrete la ronde.
       */
      cycleTextures(urls, every) {
        clearInterval(state.cycle);
        if (!urls || !urls.length || !pivot.children[0]) return;
        const meshes = [];
        pivot.children[0].traverse((node) => { if (node.isMesh && node.material && node.material.map) meshes.push(node); });
        if (!meshes.length) return;
        const base = meshes[0].material.map;
        const src = base.image;
        const w = src.width, h = src.height;
        const frames = new Array(urls.length);
        const apply = (tex) => meshes.forEach((node) => { node.material.map = tex; node.material.needsUpdate = true; });
        urls.forEach((url, i) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(src, 0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            const tex = new THREE.CanvasTexture(canvas);
            /* Comme la texture d'origine : nette, sans lissage, meme sens. */
            tex.flipY = base.flipY;
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.generateMipmaps = false;
            if (base.colorSpace) tex.colorSpace = base.colorSpace;
            if (base.encoding != null) tex.encoding = base.encoding;
            frames[i] = tex;
            if (i === 0) apply(tex);
          };
          img.src = url;
        });
        let at = 0;
        state.cycle = setInterval(() => {
          if (state.disposed) return;
          for (let k = 1; k <= frames.length; k++) {
            const next = (at + k) % frames.length;
            if (frames[next]) { at = next; apply(frames[next]); return; }
          }
        }, every || 3000);
      },

      dispose() {
        state.disposed = true;
        clearInterval(state.cycle);
        cancelAnimationFrame(state.frame);
        if (seen) seen.disconnect();
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('wheel', onWheel);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('resize', onResize);
        try { renderer.dispose(); } catch (error) { /* context already gone */ }
      }
    };
  }

  Object.assign(OW, { loadThree, createViewer });
}(window.OW = window.OW || {}));
