/* La scene 3D d'une fiche de creature (chapitre « Animations »).

   Le modele et les animations sont ceux du mod (js/creature-3d.js) : la bete
   tourne sur elle-meme, et joue d'un clic chacune des animations de l'entite,
   toutes, rangees par famille (les trois coups du combo a part). Three.js ne
   se charge qu'a l'approche du chapitre.

   OW.mountCreatureStage(host, slug, accent) -> Promise<{ play(name), has(name) }> */

(function (OW) {
  'use strict';

  const esc = (v) => (OW.escapeHtml ? OW.escapeHtml(v) : String(v));
  const fmt = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

  const LABELS = {
    MISC_IDLE: 'Repos', MOVE_WALK: 'Marche', MOVE_RUN: 'Course', MOVE_SWIM: 'Nage',
    ATTACK_STRIKE: 'Combo 1', ATTACK_STRIKE_2: 'Combo 2', ATTACK_STRIKE2: 'Combo 2', ATTACK_STRIKE_3: 'Combo 3', ATTACK_STRIKE3: 'Combo 3',
    SIT: 'Assis', NAP: 'Sieste', SLEEP: 'Sommeil', ROAR: 'Rugissement'
  };
  /* Les noms de la fiche (js/animal.js) quand ils sont la, sinon ceux-ci. */
  const labelOf = (name) => (OW.animLabel ? OW.animLabel(name)
    : LABELS[name] || name.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()));

  /* Toutes les animations du modele, par famille. Le combo : ATTACK_STRIKE,
     puis _2 (ou 2), puis _3 (ou 3). */
  const COMBO = /^ATTACK_STRIKE_?([23])?$/;
  const GROUPS = [
    ['rest', 'REPOS & POSTURES', (n) => /^MISC_|_IDLE$|^IDLE_|^(SIT|NAP|SLEEP)$/.test(n) && !/^TRANSITION_/.test(n)],
    ['move', 'DÉPLACEMENTS', (n) => /^MOVE_|_WALK$|^WILD_STALK|^(ROLL|SWIM)$/.test(n)],
    ['combo', 'COMBO', (n) => COMBO.test(n)],
    ['sedated', 'SÉDATION', (n) => /^SEDATED_/.test(n)],
    ['skill', 'CAPACITÉS & COMPORTEMENTS', (n) => !/^TRANSITION_/.test(n)],
    ['trans', 'TRANSITIONS', () => true]
  ];
  /* Le repere « en boucle » : deux fleches qui se suivent, en pixels. */
  const LOOP_PX = [
    '..XXXXX.',
    '.X....XX',
    'X....XXX',
    'X.......',
    '.......X',
    'XXX....X',
    'XX....X.',
    '.XXXXX..'
  ];
  const LOOP_ICON = '<svg class="st3d-loop" viewBox="0 0 8 8" aria-hidden="true"><path d="'
    + LOOP_PX.map((row, y) => row.split('').map((c, x) => (c === 'X' ? `M${x} ${y}h1v1h-1z` : '')).join('')).join('')
    + '"/></svg>';

  function grouped(names) {
    const left = names.slice();
    return GROUPS.map(([key, title, test]) => {
      const list = left.filter(test);
      list.forEach((n) => left.splice(left.indexOf(n), 1));
      if (key === 'combo') list.sort((a, b) => Number(COMBO.exec(a)[1] || 1) - Number(COMBO.exec(b)[1] || 1));
      return { key, title, list };
    }).filter((g) => g.list.length);
  }

  function mount(host, slug, accent) {
    host.innerHTML = `
      <div class="st3d" style="--st-c:${esc(accent || '#F2A32C')}">
        <div class="st3d-view">
          <canvas class="st3d-canvas" aria-label="Modèle 3D de la créature, à faire tourner"></canvas>
          <span class="st3d-status t-pixel" data-st3d-status>CHARGEMENT DU MODÈLE…</span>
          <span class="st3d-hint t-pixel">GLISSER POUR TOURNER · MOLETTE POUR ZOOMER</span>
        </div>
        <div class="st3d-side">
          <span class="t-pixel st3d-kicker">EN MOUVEMENT</span>
          <b class="st3d-title">Le modèle du jeu</b>
          <p class="st3d-text">Modèle, texture et animations sont lus dans le code du mod et rejoués à l’identique.</p>
          <span class="st3d-now t-pixel" data-st3d-now></span>
          <span class="st3d-count t-pixel" data-st3d-count></span>
          <button type="button" class="st3d-spin" data-st3d-spin aria-pressed="true">Rotation automatique</button>
        </div>
        <div class="st3d-btns" data-st3d-btns role="group" aria-label="Animation jouée"></div>
      </div>`;

    const canvas = host.querySelector('canvas');
    const status = host.querySelector('[data-st3d-status]');
    const btns = host.querySelector('[data-st3d-btns]');
    const now = host.querySelector('[data-st3d-now]');
    const count = host.querySelector('[data-st3d-count]');
    const spin = host.querySelector('[data-st3d-spin]');
    let api = null;

    return new Promise((resolve) => {
      const start = () => Promise.all([OW.loadThree(), OW.creature3d.models()]).then(([THREE, models]) => {
        const model = models[slug];
        if (!model) throw new Error('modele absent');
        const viewer = OW.createViewer(canvas, THREE);
        const creature = OW.creature3d.build(THREE, model);
        viewer.show(creature.object, creature.tick);
        status.hidden = true;

        /* Les animations retirees de cette fiche (js/site-config.js, hiddenAnimations). */
        const hidden = (name) => !!(OW.animationHidden && OW.animationHidden(slug, name));
        const names = Object.keys(model.anims || {}).filter((n) => !hidden(n));
        const groups = grouped(names);
        const play = (name) => {
          if (!model.anims[name] || hidden(name)) return false;
          creature.play(name);
          const a = model.anims[name];
          now.textContent = 'EN COURS : ' + labelOf(name).toUpperCase() + ' · ' + fmt(a.len) + ' S' + (a.loop ? ' · EN BOUCLE' : '');
          btns.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.anim === name)));
          return true;
        };
        btns.innerHTML = groups.map((g) => `
          <div class="st3d-group is-${g.key}">
            <span class="st3d-group-title t-pixel">${g.title} <small>${g.list.length}</small></span>
            <div class="st3d-group-btns">
              ${g.list.map((n) => {
                const loop = !!model.anims[n].loop;
                return `<button type="button" data-anim="${esc(n)}" aria-pressed="false" title="${esc(n)}${loop ? ' · en boucle' : ''}"${loop ? ' class="is-loop"' : ''}>${esc(labelOf(n))}${loop ? LOOP_ICON + '<span class="visually-hidden"> (en boucle)</span>' : ''}</button>`;
              }).join('')}
            </div>
          </div>`).join('');
        const loops = names.filter((n) => model.anims[n].loop).length;
        count.innerHTML = esc(names.length + ' ANIMATION' + (names.length > 1 ? 'S' : '') + ' DANS LE MOD')
          + (loops ? '<br>' + LOOP_ICON + ' ' + esc(loops + ' EN BOUCLE') : '');
        btns.addEventListener('click', (e) => { const b = e.target.closest('[data-anim]'); if (b) play(b.dataset.anim); });
        spin.addEventListener('click', () => {
          const on = spin.getAttribute('aria-pressed') !== 'true';
          spin.setAttribute('aria-pressed', String(on));
          viewer.setSpin(on);
        });
        play(model.anims.MISC_IDLE && !hidden('MISC_IDLE') ? 'MISC_IDLE' : names[0]);
        api = { play, has: (name) => !!model.anims[name] && !hidden(name) };
        resolve(api);
      }).catch(() => {
        status.textContent = 'MODÈLE 3D INDISPONIBLE';
        resolve({ play: () => false, has: () => false });
      });

      /* A l'approche du chapitre seulement : three.js pese plusieurs centaines de Ko. */
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io.disconnect();
          start();
        }, { rootMargin: '600px 0px' });
        io.observe(host);
      } else {
        start();
      }
    });
  }

  OW.mountCreatureStage = mount;
  OW.animLabel3d = labelOf;
}(window.OW = window.OW || {}));
