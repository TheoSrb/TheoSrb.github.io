/* Les creatures favorites du visiteur, et la creature au hasard.

   Les favoris vivent dans le navigateur (localStorage) : aucune inscription,
   rien ne part sur un serveur. Ils suivent d'un onglet a l'autre (evenement
   « storage ») et toute la page ecoute le meme signal, ow:favorites, pour
   rester a jour : l'etoile d'une carte, le menu de l'en-tete, le filtre du
   bestiaire, la recherche.

   OW.favorites.list()          -> ['tiger', 'kodiak']
   OW.favorites.has(slug)       -> vrai / faux
   OW.favorites.toggle(slug)    -> le nouvel etat
   OW.favStar(slug, name)       -> le HTML d'une etoile a poser sur une carte
   OW.randomCreature()          -> ouvre la fiche d'une bete au hasard */

(function (OW) {
  'use strict';

  const KEY = 'ow-favorites';

  function read() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(KEY) || '[]');
      return Array.isArray(raw) ? raw.filter((s) => typeof s === 'string') : [];
    } catch (e) {
      return [];
    }
  }

  let cache = read();

  function write(list) {
    cache = list;
    try { window.localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* navigation privee : la session garde l'etat */ }
    document.dispatchEvent(new CustomEvent('ow:favorites', { detail: { list: list.slice() } }));
  }

  const favorites = {
    list: () => cache.slice(),
    has: (slug) => cache.indexOf(slug) !== -1,
    toggle(slug) {
      const list = cache.slice();
      const at = list.indexOf(slug);
      if (at === -1) list.unshift(slug);
      else list.splice(at, 1);
      write(list);
      return at === -1;
    },
    remove(slug) {
      if (!favorites.has(slug)) return;
      write(cache.filter((s) => s !== slug));
    }
  };

  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return;
    cache = read();
    document.dispatchEvent(new CustomEvent('ow:favorites', { detail: { list: cache.slice() } }));
  });

  /* ---- l'etoile ----------------------------------------------------------------

     Posee dans une carte qui est deja un lien : ce n'est donc pas un <button>
     (interdit dans un <a>) mais un element au role de bouton, dont le clic est
     intercepte avant que le lien ne parte. */

  /* L'etoile vient d'un jeu d'icones de developpeur (css/icons.css) : une
     balise <i>, comme les logos du pied de page. */
  const STAR = '<i class="icon--mdi icon--mdi--star" aria-hidden="true"></i>';

  function favStar(slug, name, extraClass) {
    const on = favorites.has(slug);
    const esc = OW.escapeHtml || String;
    return `<span class="fav-star${extraClass ? ' ' + extraClass : ''}" role="button" tabindex="0" data-fav-toggle="${esc(slug)}" data-fav-name="${esc(name)}"
      aria-pressed="${on}" aria-label="${on ? 'Retirer ' + esc(name) + ' des favoris' : 'Ajouter ' + esc(name) + ' aux favoris'}"
      title="${on ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${STAR}</span>`;
  }

  function paintStars(root) {
    (root || document).querySelectorAll('[data-fav-toggle]').forEach((el) => {
      const on = favorites.has(el.dataset.favToggle);
      el.setAttribute('aria-pressed', String(on));
      el.title = on ? 'Retirer des favoris' : 'Ajouter aux favoris';
      const name = el.dataset.favName || '';
      el.setAttribute('aria-label', on ? 'Retirer ' + name + ' des favoris' : 'Ajouter ' + name + ' aux favoris');
    });
  }

  function onToggle(event) {
    const star = event.target.closest && event.target.closest('[data-fav-toggle]');
    if (!star) return;
    event.preventDefault();
    event.stopPropagation();
    const on = favorites.toggle(star.dataset.favToggle);
    star.classList.remove('is-pop');
    void star.offsetWidth;
    star.classList.add('is-pop');
    toast(on ? 'Ajouté aux favoris' : 'Retiré des favoris', on);
  }

  document.addEventListener('click', onToggle, true);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!event.target.closest || !event.target.closest('[data-fav-toggle]')) return;
    onToggle(event);
  }, true);
  document.addEventListener('ow:favorites', () => paintStars());

  /* ---- le petit message de confirmation ------------------------------------------ */

  let toastEl = null;
  let toastTimer = 0;
  function toast(message, positive) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'ow-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = (positive ? STAR : '') + '<span></span>';
    toastEl.querySelector('span').textContent = message;
    toastEl.classList.toggle('is-positive', !!positive);
    toastEl.classList.remove('is-in');
    void toastEl.offsetWidth;
    toastEl.classList.add('is-in');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-in'), 1800);
  }

  /* ---- la creature au hasard -------------------------------------------------------- */

  function randomCreature() {
    const load = OW.loadWikiData ? OW.loadWikiData() : Promise.reject();
    return load.then((data) => {
      const current = new URLSearchParams(window.location.search).get('e');
      const pool = data.entities.filter((e) => e.slug !== current);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick) window.location.href = OW.animalHref(pick.slug);
    }).catch(() => {});
  }

  /* Touche R : une bete au hasard, quand on n'est pas en train d'ecrire. */
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'r' && event.key !== 'R') return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const t = event.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
    if (document.querySelector('[data-palette]:not([hidden])')) return;
    event.preventDefault();
    randomCreature();
  });

  Object.assign(OW, { favorites, favStar, paintStars, randomCreature, toast, FAV_STAR_SVG: STAR });
}(window.OW = window.OW || {}));
