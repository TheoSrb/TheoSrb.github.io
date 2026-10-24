/* La page introuvable : l'en-tete, le pied de page, et l'adresse demandee.

   Elle s'affiche dans trois cas :
   - une adresse qui n'existe pas : l'hebergeur (Netlify, GitHub Pages...)
     renvoie ce fichier pour n'importe quel chemin inconnu. La page porte
     <base href="/"> pour que ses images et ses liens partent toujours de la
     racine du site, quelle que soit la profondeur de l'adresse ;
   - les donnees du mod manquent ou ne se lisent pas : chaque page y renvoie
     d'elle-meme (js/wiki-data.js, goNotFound), avec ?raison=donnees ;
   - une fiche qui nomme une creature ou un biome inconnu (?raison=creature,
     ?raison=biome).
   `depuis` garde l'adresse de depart : on propose d'y revenir. */

(function (OW) {
  'use strict';

  const { mountHeader, mountFooter, loadWikiData, escapeHtml } = OW;

  mountHeader();

  const params = new URLSearchParams(location.search);
  const reason = params.get('raison');
  /* L'adresse de depart, limitee a une page du site (pas de lien externe). */
  const from = (params.get('depuis') || '').replace(/^[/\\]+/, '');
  const safeFrom = /^[\w-]+\.html([?#].*)?$/.test(from) ? from : '';

  const REASONS = {
    donnees: {
      key: 'Données introuvables',
      kicker: 'LA JUNGLE EST VIDE',
      title: 'Les données du mod manquent',
      lead: 'Le fichier des données du wiki n’a pas pu être chargé : il est absent, ou illisible. '
        + 'Sans lui, le panda roux ne retrouve plus aucune bête. Un nouvel essai dans un instant devrait suffire ; si le problème persiste, '
        + 'le fichier <code>data/wiki_data.json</code> doit être remis en place.',
      actions: [[safeFrom || 'index.html', 'Réessayer', true], ['index.html', 'Retour à l’accueil']]
    },
    creature: {
      key: 'Créature introuvable',
      kicker: 'AUCUNE TRACE DANS LA JUNGLE',
      title: 'Cette bête n’existe pas',
      lead: 'Le panda roux a cherché partout : aucune créature du mod ne porte ce nom. Un lien mal copié, '
        + 'ou une bête qui n’est pas encore sortie.',
      actions: [['creatures.html', 'Le bestiaire', true], ['index.html', 'Retour à l’accueil']]
    },
    biome: {
      key: 'Biome introuvable',
      kicker: 'HORS DE LA CARTE',
      title: 'Ce biome n’existe pas',
      lead: 'Aucun biome du mod ne porte ce nom : le panda roux est sorti de la carte.',
      actions: [['biomes.html', 'Les biomes', true], ['index.html', 'Retour à l’accueil']]
    }
  };

  const r = REASONS[reason];
  if (r) {
    const set = (sel, html) => { const el = document.querySelector(sel); if (el) el.innerHTML = html; };
    set('[data-nf-key]', escapeHtml(r.key));
    set('[data-nf-kicker]', escapeHtml(r.kicker));
    set('[data-nf-title]', escapeHtml(r.title));
    set('[data-nf-lead]', r.lead);
    set('[data-nf-actions]', r.actions.map(([href, label, main]) =>
      `<a class="btn btn-lg${main ? ' btn-accent' : ''}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join('')
      + '<button type="button" class="btn btn-lg" data-palette-open>Rechercher</button>');
    document.title = r.key + ' - Operation W.I.L.D';
  }

  /* « Rechercher » ouvre la recherche de l'en-tete : elle ne se branche que
     sur ses propres boutons. */
  document.addEventListener('click', (event) => {
    if (!event.target.closest('main [data-palette-open]')) return;
    const button = document.querySelector('[data-site-header] [data-palette-open]');
    if (button && !button.disabled) button.click();
  });

  const path = document.querySelector('[data-nf-path]');
  if (path) path.textContent = decodeURIComponent(safeFrom || (location.pathname + location.search));

  loadWikiData()
    .then((data) => mountFooter(data, 'VERSION ' + data.meta.version))
    .catch(() => mountFooter(null));
}(window.OW = window.OW || {}));
