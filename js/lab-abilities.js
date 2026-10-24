/* Labo — bloc 02 : cinq traitements des capacites montees.

   Une regle commune aux cinq : le jeu n'a que trois emplacements. Le combo,
   la secondaire, l'ultime. Les deux cartes secondaires se partagent le meme
   emplacement — la molette passe de l'une a l'autre — et aucune version n'a
   le droit de les poser cote a cote comme deux attaques distinctes.

   OW.labUtil.abilityModel() rend ces emplacements deja constitues. */

(function (OW) {
  'use strict';

  const { escapeHtml } = OW;
  const U = OW.labUtil;

  const KEY_LABEL = { LMB: 'Clic gauche', RMB: 'Clic droit', X: 'Touche X' };

  /* Les constantes d'une carte : les principales en clair, les reglages
     replies. Une attaque en aligne parfois huit — les afficher toutes noie
     les deux qui comptent. */
  function constants(card, ctx, cls) {
    const { primary, rest } = U.splitConstants(card);
    if (!primary.length && !rest.length) return '';
    return `
      <div class="${cls}">
        ${primary.map((c) => `
          <span class="lab-const">
            <b>${escapeHtml(c.value)}</b>
            <small>${escapeHtml(c.label)}</small>
          </span>`).join('')}
        ${rest.length ? `
          <details class="lab-const-more">
            <summary>${rest.length} réglage${rest.length > 1 ? 's' : ''}</summary>
            <span class="lab-const-list">
              ${rest.map((c) => `<span><em>${escapeHtml(c.label)}</em><b>${escapeHtml(c.value)}</b></span>`).join('')}
            </span>
          </details>` : ''}
      </div>`;
  }

  /* La bascule d'emplacement partage : deux onglets, une seule carte visible.
     Elle revient dans les cinq versions, c'est le geste a valider. */
  function rocker(slot, cls) {
    if (slot.cards.length < 2) return '';
    return `
      <div class="${cls}" data-rocker role="tablist" aria-label="Carte de l'emplacement secondaire">
        <span class="lab-rock-hint">Molette</span>
        ${slot.cards.map((card, i) => `
          <button type="button" class="lab-rock${i === 0 ? ' is-on' : ''}" role="tab"
                  data-card="${i}" aria-selected="${i === 0 ? 'true' : 'false'}">
            ${escapeHtml(card.title)}
          </button>`).join('')}
      </div>`;
  }

  /* Branche une bascule : elle n'affiche qu'une carte a la fois dans son
     conteneur, et allume l'onglet correspondant. */
  function wireRocker(scope) {
    const rock = scope.querySelector('[data-rocker]');
    if (!rock) return;
    rock.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-card]');
      if (!btn) return;
      const index = btn.dataset.card;
      rock.querySelectorAll('[data-card]').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      scope.querySelectorAll('[data-card-body]').forEach((body) => {
        body.hidden = body.dataset.cardBody !== index;
      });
    });
  }

  /* =========================================================================
     V1 — Barre d'action
     La barre du jeu : trois emplacements, on en choisit un, le detail s'ouvre
     dessous. L'emplacement secondaire porte sa bascule.
     ========================================================================= */

  OW.labVersions.abilities.push({
    id: 'barre',
    name: "Barre d'action",
    note: "La barre du HUD : trois emplacements, un seul ouvert à la fois. L'emplacement secondaire porte sa molette. Les touches 1, 2, 3 marchent aussi.",
    render(ctx) {
      const model = U.abilityModel(ctx.entity);
      if (!model.slots.length) return '<p class="empty-note">Aucune carte de capacité exportée pour cette créature.</p>';

      return `
        <div class="bar" data-bar>
          <div class="bar-slots">
            ${model.slots.map((slot, i) => {
              const card = slot.cards[0];
              return `
                <button type="button" class="bar-slot${i === 0 ? ' is-on' : ''}" data-slot="${i}" style="--i:${i}">
                  <span class="bar-num">${i + 1}</span>
                  <span class="bar-art">${U.attackArt(ctx.entity, card)}</span>
                  <span class="bar-role">${escapeHtml(U.SLOT_LABEL[slot.kind] || 'Capacité')}</span>
                  <span class="bar-key">${escapeHtml(KEY_LABEL[card.keyLabel] || card.keyLabel || '')}</span>
                  ${slot.cards.length > 1 ? '<span class="bar-pair">2 cartes</span>' : ''}
                </button>`;
            }).join('')}
          </div>

          ${model.slots.map((slot, i) => `
            <section class="bar-detail" data-detail="${i}" ${i === 0 ? '' : 'hidden'}>
              ${rocker(slot, 'lab-rocker')}
              ${slot.cards.map((card, k) => `
                <div class="bar-card" data-card-body="${k}" ${k === 0 ? '' : 'hidden'}>
                  <div class="bar-plate">${U.attackArt(ctx.entity, card)}</div>
                  <div class="bar-text">
                    <span class="bar-tag">${escapeHtml(U.ROLE_LABEL[card.role] || 'Capacité')}</span>
                    <h3>${escapeHtml(card.title)}</h3>
                    <p>${card.descriptionHtml}</p>
                    ${constants(card, ctx, 'lab-consts')}
                  </div>
                </div>`).join('')}
            </section>`).join('')}

          ${model.passives.length ? `
            <div class="bar-passives">
              <span class="lab-label">Toujours actif</span>
              ${model.passives.map((card) => `
                <article class="bar-passive">
                  <span class="bar-passive-ico">${U.icon('eye', ctx.ink, { fill: false })}</span>
                  <div>
                    <h4>${escapeHtml(card.title)}</h4>
                    <p>${card.descriptionHtml}</p>
                  </div>
                </article>`).join('')}
            </div>` : ''}
        </div>`;
    },
    mount(stage) {
      const bar = stage.querySelector('[data-bar]');
      if (!bar) return;

      function select(index) {
        bar.querySelectorAll('[data-slot]').forEach((b) => b.classList.toggle('is-on', b.dataset.slot === String(index)));
        bar.querySelectorAll('[data-detail]').forEach((d) => { d.hidden = d.dataset.detail !== String(index); });
      }
      bar.querySelectorAll('[data-slot]').forEach((btn) => {
        btn.addEventListener('click', () => select(btn.dataset.slot));
      });
      bar.querySelectorAll('[data-detail]').forEach(wireRocker);

      /* Les chiffres du clavier, comme dans le jeu — mais seulement quand la
         barre est sous les yeux, sinon on volerait les touches de la page. */
      document.addEventListener('keydown', (event) => {
        if (!bar.isConnected || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
        const n = Number(event.key);
        if (!n || n > bar.querySelectorAll('[data-slot]').length) return;
        const box = bar.getBoundingClientRect();
        if (box.bottom < 0 || box.top > window.innerHeight) return;
        select(n - 1);
      });
    }
  });

  /* =========================================================================
     V2 — Chaine de combat
     Les emplacements poses sur un rail, dans l'ordre ou on les enchaine.
     Le curseur avance de station en station ; la secondaire garde sa molette.
     ========================================================================= */

  OW.labVersions.abilities.push({
    id: 'chaine',
    name: 'Chaîne de combat',
    note: "Les emplacements posés sur un rail, dans l'ordre où on les enchaîne au combat. Cliquez une station : le wagon s'y arrête.",
    render(ctx) {
      const model = U.abilityModel(ctx.entity);
      if (!model.slots.length) return '<p class="empty-note">Aucune carte de capacité exportée pour cette créature.</p>';

      return `
        <div class="chn" data-chn style="--stations:${model.slots.length}">
          <div class="chn-rail">
            <span class="chn-line" aria-hidden="true"></span>
            <span class="chn-cursor" data-cursor aria-hidden="true"></span>
            ${model.slots.map((slot, i) => `
              <button type="button" class="chn-stop${i === 0 ? ' is-on' : ''}" data-stop="${i}" style="--i:${i}">
                <span class="chn-dot" aria-hidden="true"></span>
                <span class="chn-stop-key">${escapeHtml(KEY_LABEL[slot.cards[0].keyLabel] || '')}</span>
                <span class="chn-stop-name">${escapeHtml(U.SLOT_LABEL[slot.kind] || 'Capacité')}</span>
              </button>`).join('')}
          </div>

          ${model.slots.map((slot, i) => `
            <section class="chn-panel" data-detail="${i}" ${i === 0 ? '' : 'hidden'}>
              ${rocker(slot, 'lab-rocker')}
              ${slot.cards.map((card, k) => `
                <div class="chn-card" data-card-body="${k}" ${k === 0 ? '' : 'hidden'}>
                  <div class="chn-art">${U.attackArt(ctx.entity, card)}</div>
                  <div class="chn-text">
                    <h3>${escapeHtml(card.title)}</h3>
                    <p>${card.descriptionHtml}</p>
                    ${constants(card, ctx, 'lab-consts')}
                  </div>
                </div>`).join('')}
            </section>`).join('')}

          ${model.passives.length ? `
            <div class="chn-passives">
              ${model.passives.map((card) => `
                <article class="chn-passive">
                  <h4>${U.icon('eye', ctx.ink, { fill: false })}${escapeHtml(card.title)}</h4>
                  <p>${card.descriptionHtml}</p>
                </article>`).join('')}
            </div>` : ''}
        </div>`;
    },
    mount(stage) {
      const chn = stage.querySelector('[data-chn]');
      if (!chn) return;
      const cursor = chn.querySelector('[data-cursor]');

      function go(index) {
        chn.querySelectorAll('[data-stop]').forEach((b) => b.classList.toggle('is-on', b.dataset.stop === String(index)));
        chn.querySelectorAll('[data-detail]').forEach((d) => { d.hidden = d.dataset.detail !== String(index); });
        cursor.style.setProperty('--at', index);
      }
      chn.querySelectorAll('[data-stop]').forEach((btn) => btn.addEventListener('click', () => go(btn.dataset.stop)));
      chn.querySelectorAll('[data-detail]').forEach(wireRocker);
      go(0);
    }
  });

  /* =========================================================================
     V3 — Jeu de cartes
     Les cartes en eventail. On en tire une du paquet, elle passe devant ; le
     clic sur la carte devant la retourne, et son dos porte les constantes.
     ========================================================================= */

  OW.labVersions.abilities.push({
    id: 'deck',
    name: 'Jeu de cartes',
    keep: true,
    note: "Les cartes en éventail. Cliquez-en une pour la tirer devant, cliquez-la encore pour la retourner : ses réglages sont au dos.",
    render(ctx) {
      const model = U.abilityModel(ctx.entity);
      const cards = model.slots.reduce((list, slot) => list.concat(
        slot.cards.map((card) => ({ card, slot }))
      ), []);
      if (!cards.length) return '<p class="empty-note">Aucune carte de capacité exportée pour cette créature.</p>';

      return `
        <div class="dck" data-dck>
          <div class="dck-fan" style="--count:${cards.length}">
            ${cards.map(({ card, slot }, i) => `
              <article class="dck-card${i === 0 ? ' is-front' : ''}" data-deck="${i}" style="--i:${i}"
                       tabindex="0" role="button" aria-label="${escapeHtml(card.title)}">
                <div class="dck-inner">
                  <div class="dck-front">
                    <span class="dck-role">${escapeHtml(U.ROLE_LABEL[card.role] || 'Capacité')}</span>
                    <div class="dck-art">${U.attackArt(ctx.entity, card)}</div>
                    <h3>${escapeHtml(card.title)}</h3>
                    <p>${card.descriptionHtml}</p>
                    ${slot.cards.length > 1
                      ? `<span class="dck-share">Emplacement partagé — molette</span>` : ''}
                  </div>
                  <div class="dck-rear">
                    <span class="dck-rear-top">${escapeHtml(card.title)}</span>
                    ${constants(card, ctx, 'dck-consts')}
                    <span class="dck-rear-foot">${escapeHtml(KEY_LABEL[card.keyLabel] || card.keyLabel || '')}</span>
                  </div>
                </div>
              </article>`).join('')}
          </div>

          ${model.passives.length ? `
            <div class="dck-passives">
              <span class="lab-label">Toujours actif</span>
              ${model.passives.map((card) => `
                <article class="dck-passive">
                  <h4>${escapeHtml(card.title)}</h4>
                  <p>${card.descriptionHtml}</p>
                </article>`).join('')}
            </div>` : ''}
        </div>`;
    },
    mount(stage) {
      const fan = stage.querySelector('[data-dck]');
      if (!fan) return;
      const cards = Array.prototype.slice.call(fan.querySelectorAll('[data-deck]'));

      function pull(card) {
        if (card.classList.contains('is-front')) { card.classList.toggle('is-flipped'); return; }
        cards.forEach((c) => { c.classList.remove('is-front'); c.classList.remove('is-flipped'); });
        card.classList.add('is-front');
      }
      cards.forEach((card) => {
        card.addEventListener('click', () => pull(card));
        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pull(card); }
        });
      });
    }
  });

  /* =========================================================================
     V4 — Fiche d'attaque
     Une liste a gauche, une grande fiche a droite. La version la plus sobre :
     elle donne le plus de place au texte et aux chiffres.
     ========================================================================= */

  OW.labVersions.abilities.push({
    id: 'fiche',
    name: "Fiche d'attaque",
    note: "Une liste à gauche, une grande fiche à droite. La plus sobre des cinq : le texte et les chiffres ont toute la place.",
    render(ctx) {
      const model = U.abilityModel(ctx.entity);
      const flat = model.slots.reduce((list, slot) => list.concat(
        slot.cards.map((card, k) => ({ card, slot, alt: k > 0 }))
      ), []).concat(model.passives.map((card) => ({ card, slot: { kind: 'passive', cards: [card] }, alt: false })));
      if (!flat.length) return '<p class="empty-note">Aucune carte de capacité exportée pour cette créature.</p>';

      return `
        <div class="fch" data-fch>
          <nav class="fch-list" aria-label="Capacités">
            ${flat.map(({ card, slot, alt }, i) => `
              <button type="button" class="fch-item${i === 0 ? ' is-on' : ''}${alt ? ' is-alt' : ''}" data-pick="${i}">
                <span class="fch-item-art">${U.attackArt(ctx.entity, card)}</span>
                <span class="fch-item-text">
                  <b>${escapeHtml(card.title)}</b>
                  <small>${escapeHtml(card.passive ? 'Passif' : (U.ROLE_LABEL[card.role] || ''))}</small>
                </span>
                ${alt ? '<span class="fch-alt-mark" title="Partage l\'emplacement secondaire">⇄</span>' : ''}
              </button>`).join('')}
          </nav>

          <div class="fch-view">
            ${flat.map(({ card, slot, alt }, i) => `
              <article class="fch-sheet" data-sheet="${i}" ${i === 0 ? '' : 'hidden'}>
                <header class="fch-head">
                  <span class="fch-key">${escapeHtml(KEY_LABEL[card.keyLabel] || (card.passive ? 'aucune touche' : ''))}</span>
                  <h3>${escapeHtml(card.title)}</h3>
                  <span class="fch-role">${escapeHtml(card.passive ? 'Passif' : (U.ROLE_LABEL[card.role] || ''))}</span>
                </header>
                <div class="fch-body">
                  <div class="fch-art">${U.attackArt(ctx.entity, card)}</div>
                  <div class="fch-text">
                    <p>${card.descriptionHtml}</p>
                    ${alt || (slot.cards.length > 1 && !card.passive) ? `
                      <p class="fch-share">
                        ${escapeHtml(slot.cards.map((c) => c.title).join(' et '))} occupent le même
                        emplacement : la molette passe de l'une à l'autre.
                      </p>` : ''}
                    ${constants(card, ctx, 'lab-consts')}
                  </div>
                </div>
              </article>`).join('')}
          </div>
        </div>`;
    },
    mount(stage) {
      const fch = stage.querySelector('[data-fch]');
      if (!fch) return;
      fch.querySelectorAll('[data-pick]').forEach((btn) => {
        btn.addEventListener('click', () => {
          fch.querySelectorAll('[data-pick]').forEach((b) => b.classList.toggle('is-on', b === btn));
          fch.querySelectorAll('[data-sheet]').forEach((s) => { s.hidden = s.dataset.sheet !== btn.dataset.pick; });
        });
      });
    }
  });

  /* =========================================================================
     V5 — Manette
     Les touches, telles qu'on les a sous les doigts. On appuie sur une touche
     du dessin (ou du vrai clavier) et la capacite s'affiche. La molette fait
     tourner les deux cartes du meme emplacement — le geste du jeu, rendu tel
     quel.
     ========================================================================= */

  OW.labVersions.abilities.push({
    id: 'manette',
    name: 'Manette',
    note: "Les touches telles qu'on les a sous les doigts. Appuyez sur une touche du dessin — ou sur X du vrai clavier. La molette fait tourner les deux cartes du même emplacement.",
    render(ctx) {
      const model = U.abilityModel(ctx.entity);
      if (!model.slots.length) return '<p class="empty-note">Aucune carte de capacité exportée pour cette créature.</p>';

      return `
        <div class="pad" data-pad>
          <div class="pad-mouse">
            <svg class="pad-shape" viewBox="0 0 200 300" aria-hidden="true">
              <path class="pad-body" d="M100 6 C40 6 20 60 20 140 v70 c0 50 36 84 80 84 s80 -34 80 -84 v-70 C180 60 160 6 100 6 Z"/>
              <path class="pad-split" d="M100 6 v104 M20 110 h160"/>
            </svg>
            ${model.slots.map((slot, i) => {
              const card = slot.cards[0];
              const zone = card.keyLabel === 'LMB' ? 'lmb' : card.keyLabel === 'RMB' ? 'rmb' : 'key';
              return `
                <button type="button" class="pad-key pad-${zone}${i === 0 ? ' is-on' : ''}" data-key="${i}">
                  <b>${escapeHtml(card.keyLabel || '?')}</b>
                  <small>${escapeHtml(U.SLOT_LABEL[slot.kind] || '')}</small>
                </button>`;
            }).join('')}
            <span class="pad-wheel" data-wheel-zone aria-hidden="true"></span>
          </div>

          <div class="pad-screen">
            ${model.slots.map((slot, i) => `
              <section class="pad-out" data-detail="${i}" ${i === 0 ? '' : 'hidden'}>
                ${slot.cards.length > 1 ? `
                  <div class="pad-wheel-ctrl" data-rocker>
                    <span class="lab-rock-hint">Molette</span>
                    ${slot.cards.map((card, k) => `
                      <button type="button" class="lab-rock${k === 0 ? ' is-on' : ''}" data-card="${k}">
                        ${escapeHtml(card.title)}
                      </button>`).join('')}
                  </div>` : ''}
                ${slot.cards.map((card, k) => `
                  <div class="pad-card" data-card-body="${k}" ${k === 0 ? '' : 'hidden'}>
                    <div class="pad-art">${U.attackArt(ctx.entity, card)}</div>
                    <div class="pad-text">
                      <span class="pad-tag">${escapeHtml(U.ROLE_LABEL[card.role] || '')}</span>
                      <h3>${escapeHtml(card.title)}</h3>
                      <p>${card.descriptionHtml}</p>
                      ${constants(card, ctx, 'lab-consts')}
                    </div>
                  </div>`).join('')}
              </section>`).join('')}

            ${model.passives.length ? `
              <div class="pad-passives">
                ${model.passives.map((card) => `
                  <span class="pad-passive">${U.icon('eye', ctx.ink, { fill: false })}
                    <b>${escapeHtml(card.title)}</b> — ${card.descriptionHtml}
                  </span>`).join('')}
              </div>` : ''}
          </div>
        </div>`;
    },
    mount(stage) {
      const pad = stage.querySelector('[data-pad]');
      if (!pad) return;

      function press(index) {
        pad.querySelectorAll('[data-key]').forEach((b) => b.classList.toggle('is-on', b.dataset.key === String(index)));
        pad.querySelectorAll('[data-detail]').forEach((d) => { d.hidden = d.dataset.detail !== String(index); });
      }
      pad.querySelectorAll('[data-key]').forEach((btn) => {
        btn.addEventListener('click', () => press(btn.dataset.key));
      });
      pad.querySelectorAll('[data-detail]').forEach(wireRocker);

      /* La molette sur le dessin de la souris fait tourner les deux cartes de
         l'emplacement ouvert : le meme geste que dans le jeu. */
      const wheelZone = pad.querySelector('[data-wheel-zone]');
      wheelZone.addEventListener('wheel', (event) => {
        const open = pad.querySelector('[data-detail]:not([hidden]) [data-rocker]');
        if (!open) return;
        event.preventDefault();
        const tabs = Array.prototype.slice.call(open.querySelectorAll('[data-card]'));
        const at = tabs.findIndex((b) => b.classList.contains('is-on'));
        tabs[(at + (event.deltaY > 0 ? 1 : tabs.length - 1)) % tabs.length].click();
      });

      document.addEventListener('keydown', (event) => {
        if (!pad.isConnected || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
        const box = pad.getBoundingClientRect();
        if (box.bottom < 0 || box.top > window.innerHeight) return;
        const key = event.key.toUpperCase();
        const match = Array.prototype.slice.call(pad.querySelectorAll('[data-key] b'))
          .find((b) => b.textContent.trim().toUpperCase() === key);
        if (match) press(match.parentElement.dataset.key);
      });
    }
  });
}(window.OW = window.OW || {}));
