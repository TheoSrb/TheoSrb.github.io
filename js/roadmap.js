/* La feuille de route de l'accueil : « Ce qui arrive ensuite ».

   Les etapes viennent de data/roadmap.json (mode d'emploi dans le fichier).
   Elles se lisent de haut en bas le long d'une chaine : faites, en cours,
   prevues. Au-dela des premieres (5 par defaut), la suite se deplie d'un
   clic. */

(function (OW) {
  'use strict';

  const esc = (v) => (OW.escapeHtml ? OW.escapeHtml(v) : String(v));

  const STATUS = {
    done: { label: 'Terminé', cls: 'is-done' },
    current: { label: 'En cours', cls: 'is-current' },
    planned: { label: 'Prévu', cls: 'is-planned' }
  };

  /* Les pictogrammes des noeuds, en cases de 16. */
  const ICON = {
    done: '<path d="M2 8h2v2H2zM4 10h2v2H4zM6 12h2v2H6zM8 10h2v2H8zM10 8h2v2h-2zM12 6h2v2h-2zM14 4h1v2h-1z"/>',
    current: '<path d="M7 1h2v3H7zM7 12h2v3H7zM1 7h3v2H1zM12 7h3v2h-3zM3 3h2v2H3zM11 3h2v2h-2zM3 11h2v2H3zM11 11h2v2h-2zM6 5h4v6H6zM5 6h1v4H5zM10 6h1v4h-1z"/>',
    planned: '<path d="M4 1h8v2H4zM4 13h8v2H4zM5 3h1v2H5zM10 3h1v2h-1zM6 5h1v1H6zM9 5h1v1H9zM7 6h2v4H7zM6 10h1v1H6zM9 10h1v1H9zM5 11h1v2H5zM10 11h1v2h-1z"/>'
  };

  function step(s, index) {
    const st = STATUS[s.status] || STATUS.planned;
    const icon = ICON[s.status] || ICON.planned;
    const progress = s.status === 'current' && s.progress != null ? Math.max(0, Math.min(100, s.progress)) : null;
    return `
      <li class="rm-step ${st.cls}" style="--i:${index}" data-reveal="left">
        <span class="rm-node" aria-hidden="true">
          <svg viewBox="0 0 16 16" shape-rendering="crispEdges">${icon}</svg>
        </span>
        <article class="rm-card">
          <header class="rm-head">
            ${s.date ? `<span class="rm-date">${esc(s.date)}</span>` : ''}
            <span class="rm-status">${st.label}</span>
          </header>
          <h3 class="rm-title">${s.version ? `<small>${esc(s.version)}</small>` : ''}${esc(s.title)}</h3>
          ${s.text ? `<p class="rm-text">${esc(s.text)}</p>` : ''}
          ${progress != null ? `
            <span class="rm-progress">
              <span class="rm-progress-head"><span class="t-pixel">AVANCEMENT</span><b>${progress}<small>%</small></b></span>
              <span class="rm-bar" role="progressbar" aria-label="Avancement de l’étape" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
                <i style="--p:${progress / 100}"></i>
              </span>
            </span>` : ''}
          ${s.tags && s.tags.length ? `<span class="rm-tags">${s.tags.map((t) => `<em>${esc(t)}</em>`).join('')}</span>` : ''}
        </article>
      </li>`;
  }

  function render(host, data) {
    const steps = (data.steps || []).filter((s) => s && s.title);
    if (!steps.length) return;
    const visible = Math.max(1, data.visible || 5);
    /* Le temps monte : le passe en bas, l'avenir en haut. Les premieres
       etapes (passe, en cours, proche avenir) restent visibles ; l'avenir
       lointain se deplie au-dessus. */
    const shown = steps.slice(0, visible);
    const rest = steps.slice(visible);
    const done = steps.filter((s) => s.status === 'done').length;

    host.innerHTML = `
      <div class="wrap stack" style="gap:34px">
        <div class="section-head" data-reveal="left">
          <div class="stack" style="gap:12px">
            <span class="t-pixel t-accent">03 · FEUILLE DE ROUTE</span>
            <h2 class="t-display t-h2">Ce qui arrive ensuite</h2>
          </div>
          <span class="rm-count t-pixel">${done} / ${steps.length} ÉTAPES FRANCHIES</span>
        </div>
        ${rest.length ? `
          <button type="button" class="rm-toggle" data-rm-toggle aria-expanded="false">
            <span class="rm-toggle-mark" aria-hidden="true"></span>
            <span data-rm-label>Afficher les ${rest.length} étapes suivantes</span>
          </button>
          <div class="rm-more" data-rm-more style="height:0">
            <ol class="rm-list is-rest">${rest.slice().reverse().map((s, i) => step(s, steps.length - 1 - i)).join('')}</ol>
          </div>` : ''}
        <ol class="rm-list${rest.length ? '' : ' is-top'}">${shown.slice().reverse().map((s, i) => step(s, visible - 1 - i)).join('')}</ol>
        <span class="rm-origin t-pixel" aria-hidden="true">DÉBUT DE L’AVENTURE</span>
      </div>`;
    host.hidden = false;

    const toggle = host.querySelector('[data-rm-toggle]');
    if (!toggle) return;
    const body = host.querySelector('[data-rm-more]');
    const label = host.querySelector('[data-rm-label]');
    /* Le tiroir anime sa hauteur ; un minuteur double la transition (un
       onglet en arriere-plan ne la jouerait pas, et le tiroir resterait fige). */
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      label.textContent = open ? `Afficher les ${rest.length} étapes suivantes` : 'Replier la feuille de route';
      host.classList.toggle('is-open', !open);
      body.style.height = body.scrollHeight + 'px';
      if (open) {
        setTimeout(() => { body.style.height = '0px'; }, 20);
      } else {
        setTimeout(() => { body.style.height = 'auto'; }, 480);
      }
    });
  }

  function init() {
    const host = document.querySelector('[data-roadmap]');
    if (!host) return;
    fetch('data/roadmap.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) render(host, data); if (OW.reveal) OW.reveal(); })
      .catch(() => {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}(window.OW = window.OW || {}));
