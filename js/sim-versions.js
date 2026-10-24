/* Mecaniques : l'atelier des versions (temporaire).

   Reste a trancher la courbe de niveau (onglet Archetypes, cinq
   presentations), a comparer d'un clic. Le choix pose data-v sur sa cible ; css/sim-v-*.css
   font le reste. Il est retenu dans ce navigateur. Le dock ne montre que
   les groupes de l'onglet ouvert.

   Une fois la version choisie, ce fichier, le dock et css/sim-v-*.css s'en
   vont : la version gardee rejoint css/simulator.css. */

(function (OW) {
  'use strict';

  const KEY = 'ow-sim-versions-3';

  const GROUPS = {
    curve: { label: 'Courbe de niveau', tab: 'stats', target: '[data-curve-panel]',
      names: ["Barre d'expérience", 'Escalier de blocs', 'Panneaux de bois', 'Coffre', "Orbes d'expérience"] }
  };


  function load() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch (e) { return {}; }
  }
  const chosen = load();

  function get(group) {
    const v = parseInt(chosen[group], 10);
    return v >= 1 && v <= GROUPS[group].names.length ? v : 1;
  }

  function apply(group) {
    const v = get(group);
    document.querySelectorAll(GROUPS[group].target).forEach((el) => { el.dataset.v = String(v); });
  }

  function set(group, v) {
    if (!GROUPS[group]) return;
    chosen[group] = v;
    try { window.localStorage.setItem(KEY, JSON.stringify(chosen)); } catch (e) { /* rien */ }
    apply(group);
    paint();
    document.dispatchEvent(new CustomEvent('ow:sim-version', { detail: { group, v } }));
  }

  /* ---- le dock ---------------------------------------------------------------- */

  let dock = null;
  let openTab = null;

  function row(group) {
    const g = GROUPS[group];
    const v = get(group);
    return `
      <div class="svd-row" data-svd-group="${group}">
        <span class="svd-label">${g.label}</span>
        <span class="svd-btns" role="group" aria-label="Version : ${g.label}">
          ${g.names.map((_, i) => i + 1).map((n) => `
            <button type="button" class="svd-btn" data-svd="${group}:${n}" aria-pressed="${n === v}"
                    title="${n} · ${g.names[n - 1]}">${n}</button>`).join('')}
        </span>
        <span class="svd-name">${g.names[v - 1]}</span>
      </div>`;
  }

  function paint() {
    if (!dock) return;
    const groups = Object.keys(GROUPS).filter((g) => GROUPS[g].tab === openTab);
    dock.hidden = !groups.length;
    dock.querySelector('[data-svd-rows]').innerHTML = groups.map(row).join('');
  }

  function mountDock() {
    dock = document.createElement('aside');
    dock.className = 'sv-dock';
    dock.setAttribute('aria-label', 'Choix des versions');
    dock.innerHTML = `
      <button type="button" class="svd-head" data-svd-fold aria-expanded="true">
        <span class="t-pixel">ATELIER</span><b>Versions</b><i aria-hidden="true">▾</i>
      </button>
      <div class="svd-rows" data-svd-rows></div>`;
    document.body.appendChild(dock);
    try { if (window.localStorage.getItem(KEY + '-fold') === '1') dock.classList.add('is-folded'); } catch (e) { /* rien */ }
    dock.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-svd]');
      if (btn) {
        const [group, n] = btn.dataset.svd.split(':');
        set(group, parseInt(n, 10));
        return;
      }
      if (event.target.closest('[data-svd-fold]')) {
        const folded = dock.classList.toggle('is-folded');
        dock.querySelector('[data-svd-fold]').setAttribute('aria-expanded', String(!folded));
        try { window.localStorage.setItem(KEY + '-fold', folded ? '1' : '0'); } catch (e) { /* rien */ }
      }
    });
    paint();
  }

  /** L'onglet ouvert change : le dock montre ses groupes, ou s'efface. */
  function follow(tab) {
    openTab = tab;
    paint();
  }

  Object.keys(GROUPS).forEach(apply);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountDock);
  else mountDock();

  OW.simVersions = { get, set, follow, apply, GROUPS };
}(window.OW = window.OW || {}));
