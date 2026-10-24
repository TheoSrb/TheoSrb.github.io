/* Les assets viennent de GitHub, partout.

   Les images, sons et modeles du wiki vivent dans le depot GitHub
   TheoSrb/Operation-W.I.L.D-Wiki-Assets, servi par GitHub Pages. Le code du
   site les demande toujours a « assets/... ».

   - En ligne, Netlify va les chercher la-bas (voir _redirects) : ce script ne
     fait rien.
   - En local (n'importe quel serveur, ou la page ouverte directement depuis le
     disque), le dossier du wiki n'a plus d'assets : ce script, charge en
     premier sur chaque page, renvoie vers GitHub toute adresse « assets/... »
     avant qu'elle parte — images et sons poses par le code, fichiers lus par
     fetch, images des pages et des gabarits.

   Pour changer d'adresse (autre depot, autre compte) : ASSETS_BASE ci-dessous. */

(function () {
  'use strict';

  const ASSETS_BASE = 'https://theosrb.github.io/Operation-W.I.L.D-Wiki-Assets/';

  const local = location.protocol === 'file:'
    || /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost|.*\.test)$/.test(location.hostname)
    || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(location.hostname);
  if (!local) return;

  /* La racine du site : le dossier au-dessus de js/ (ce script). */
  const me = document.currentScript && document.currentScript.src;
  const root = me ? new URL('../', me).href : new URL('./', location.href).href;
  const rootAssets = root + 'assets/';

  /** « assets/item/jade.png » (relatif, ../, ou absolu sur ce site) -> GitHub. */
  function remote(url) {
    if (typeof url !== 'string' || url.indexOf('assets/') === -1) return url;
    const rel = url.match(/^(?:\.{1,2}\/)*assets\/(.*)$/);
    if (rel) return ASSETS_BASE + rel[1];
    if (url.indexOf(rootAssets) === 0) return ASSETS_BASE + url.slice(rootAssets.length);
    /* Adresse absolue sur ce site, mais encodee autrement (espaces, accents). */
    try {
      const abs = new URL(url, location.href).href;
      if (abs.indexOf(rootAssets) === 0) return ASSETS_BASE + abs.slice(rootAssets.length);
    } catch (e) { /* pas une adresse */ }
    return url;
  }

  /* Le reste du site passe aussi par OW.asset() (js/site.js). */
  window.OW = window.OW || {};
  window.OW.remoteAsset = remote;

  /* ---- ce que le code pose lui-meme : new Image(), new Audio(), fetch… -------- */

  function patchUrlProperty(proto, prop, crossOrigin) {
    const d = proto && Object.getOwnPropertyDescriptor(proto, prop);
    if (!d || !d.set) return;
    Object.defineProperty(proto, prop, {
      configurable: true,
      enumerable: d.enumerable,
      get: d.get,
      set(value) {
        const next = remote(value);
        /* Venu d'ailleurs, un fichier doit etre demande « avec autorisation » :
           sinon une image ne peut pas etre lue par un canevas (cubes de blocs,
           centrage des betes, textures 3D), et un son qui passe par le moteur
           audio du navigateur (egaliseur de la platine, oscilloscope de la table
           de sons) sort muet. GitHub Pages donne cette autorisation. */
        if (crossOrigin && next !== value && !this.crossOrigin) this.crossOrigin = 'anonymous';
        d.set.call(this, next);
      }
    });
  }
  patchUrlProperty(HTMLImageElement.prototype, 'src', true);
  patchUrlProperty(HTMLMediaElement.prototype, 'src', true);
  patchUrlProperty(HTMLSourceElement.prototype, 'src', false);

  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    const n = String(name).toLowerCase();
    if (n === 'src' || n === 'href' || n === 'poster') value = remote(String(value));
    else if (n === 'style') value = remoteStyle(String(value));
    return nativeSetAttribute.call(this, name, value);
  };

  const nativeFetch = window.fetch;
  if (nativeFetch) {
    window.fetch = function (input, init) {
      if (typeof input === 'string') input = remote(input);
      else if (input instanceof URL) input = remote(input.href);
      else if (input && input.url && remote(input.url) !== input.url) input = new Request(remote(input.url), input);
      return nativeFetch.call(this, input, init);
    };
  }
  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    const args = Array.prototype.slice.call(arguments);
    args[1] = remote(String(url));
    return nativeOpen.apply(this, args);
  };

  /* ---- ce qui est ecrit dans les pages et les gabarits ------------------------ */

  function remoteStyle(text) {
    if (text.indexOf('assets/') === -1) return text;
    return text.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, u) => 'url(' + q + remote(u) + q + ')');
  }

  function fix(el) {
    if (el.nodeType !== 1) return;
    for (const attr of ['src', 'href', 'poster']) {
      const v = el.getAttribute(attr);
      if (v && v.indexOf('assets/') !== -1) {
        const next = remote(v);
        if (next !== v) {
          if (attr === 'src' && /^(IMG|AUDIO|VIDEO)$/.test(el.tagName) && !el.crossOrigin) el.crossOrigin = 'anonymous';
          nativeSetAttribute.call(el, attr, next);
        }
      }
    }
    const style = el.getAttribute('style');
    if (style && style.indexOf('assets/') !== -1) {
      const next = remoteStyle(style);
      if (next !== style) nativeSetAttribute.call(el, 'style', next);
    }
  }

  function sweep(node) {
    fix(node);
    if (node.querySelectorAll) node.querySelectorAll('[src],[href],[poster],[style]').forEach(fix);
  }

  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes') fix(r.target);
      else r.addedNodes.forEach(sweep);
    }
  }).observe(document.documentElement, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'href', 'poster', 'style']
  });
  sweep(document.documentElement);
}());
