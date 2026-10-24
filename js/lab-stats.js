/* Labo — bloc 01 : cinq relevés au sonar.

   Deuxieme serie. La premiere (console, cadrans, duel, compteur, tiroirs) a
   ete refusee en bloc ; seule l'idee du trace radar tenait. Les cinq versions
   ci-dessous en partent toutes, et aucune ne fait s'affronter deux creatures :
   la bete est seule sur son ecran, mesuree contre les plafonds du bestiaire.

   Les chiffres viennent tous de OW.labUtil.statModel(). */

(function (OW) {
  'use strict';

  const { escapeHtml, num, DASH, bg } = OW;
  const U = OW.labUtil;

  /* Les axes du trace. « Degats par coup » n'y figure pas : il vaut toujours
     le tiers du combo, l'axe ferait doublon. Il reste dans les releves. */
  const AXES = ['hp', 'damage', 'walk', 'mounted', 'knock', 'armor', 'taming'];

  const axesOf = (stats) => AXES.map((key) => stats.find((s) => s.key === key)).filter(Boolean);

  /* Le point d'un axe, sur un cercle qui commence en haut. */
  function point(i, count, radius, cx, cy) {
    const a = (Math.PI * 2 * i) / count - Math.PI / 2;
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius, angle: a };
  }
  /* La part du tour, de 0 a 1 : elle sert a retarder le clignotement d'un
     point jusqu'au passage du balayage. */
  const turnOf = (i, count) => i / count;

  const polygon = (list, radius, cx, cy) => list.map((s, i) => {
    const p = point(i, list.length, Math.max(.05, s.part) * radius, cx, cy);
    return p.x.toFixed(1) + ',' + p.y.toFixed(1);
  }).join(' ');

  const ring = (k, radius, cx, cy, count) => Array.from({ length: count }, (_, i) => {
    const p = point(i, count, radius * k, cx, cy);
    return p.x.toFixed(1) + ',' + p.y.toFixed(1);
  }).join(' ');

  /* Les attributs bruts et la monture : le detail que les versions rangent
     derriere un repli, pour ne pas noyer le trace. */
  function detail(entity) {
    const m = entity.mount || {};
    return {
      attributs: [
        ['Dégâts par coup', entity.stats.damage == null ? DASH : num(entity.stats.damage / 3)],
        ['Ténacité', entity.stats.armorToughness == null ? DASH : num(entity.stats.armorToughness)],
        ['Portée de suivi', entity.stats.followRange ? Math.round(entity.stats.followRange) + ' blocs' : DASH],
        ['Détente', entity.stats.jump == null ? DASH : num(entity.stats.jump, 2)],
        ['Chute sans dégâts', entity.stats.safeFall ? Math.round(entity.stats.safeFall) + ' blocs' : DASH],
        ['Gabarit', num(entity.size.width, 2) + ' × ' + num(entity.size.height, 2) + ' blocs'],
        ['Hauteur des yeux', entity.size.eye_height ? num(entity.size.eye_height, 2) + ' blocs' : DASH],
        ['Échelle du modèle', entity.stats.scale ? '×' + num(entity.stats.scale) : DASH]
      ],
      monture: [
        ['Montable', m.rideable ? 'Oui' : 'Non'],
        ['Selle', entity.saddle ? entity.saddle.resultName : DASH],
        ['Multiplicateur marche', m.walkMult ? '×' + num(m.walkMult) : DASH],
        ['Multiplicateur course', m.runMult ? '×' + num(m.runMult) : DASH],
        ['Multiplicateur combo', m.comboMult ? '×' + num(m.comboMult) : DASH],
        ['Énergie vitale / niveau', m.energyGain != null ? '+' + num(m.energyGain) : DASH],
        ['Récupération', m.energyRecup != null ? '×' + num(m.energyRecup, 2) : DASH],
        ['Combat en arène', entity.gameplay.fightsInArena ? 'Oui' : 'Non']
      ]
    };
  }

  const rows = (list) => list.map(([k, v]) => `
    <div class="lab-row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd></div>`).join('');

  const folds = (entity) => {
    const d = detail(entity);
    return `
      <div class="son-folds">
        <details class="son-fold">
          <summary>Attributs bruts</summary>
          <dl class="lab-rows">${rows(d.attributs)}</dl>
        </details>
        <details class="son-fold">
          <summary>Monture</summary>
          <dl class="lab-rows">${rows(d.monture)}</dl>
        </details>
      </div>`;
  };

  const statIcon = (s, ink) => (s.sprite
    ? `<span class="son-sprite crisp" aria-hidden="true" style="${bg(s.sprite)}"></span>`
    : U.icon(s.icon, ink));

  /* =========================================================================
     V1 — Sonar
     L'ecran d'un sonar : le balayage tourne, et chaque constante s'allume au
     passage du faisceau. On clique un echo, le cadran central le detaille.
     ========================================================================= */

  OW.labVersions.stats.push({
    id: 'sonar',
    name: 'Sonar',
    note: "Le balayage tourne, et chaque constante s'allume au passage du faisceau. Cliquez un écho — ou une ligne du relevé — et le cadran central le détaille.",
    render(ctx) {
      const stats = U.statModel(ctx.entity, ctx.data);
      const axes = axesOf(stats);
      const R = 158, CX = 210, CY = 210;

      return `
        <div class="son" data-son>
          <div class="son-scope">
            <svg viewBox="0 0 420 420" aria-hidden="true">
              ${[1, .75, .5, .25].map((k) => `
                <polygon class="son-web" points="${ring(k, R, CX, CY, axes.length)}"/>`).join('')}
              ${axes.map((s, i) => {
                const p = point(i, axes.length, R, CX, CY);
                return `<line class="son-spoke" x1="${CX}" y1="${CY}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}"/>`;
              }).join('')}
              <polygon class="son-shape" points="${polygon(axes, R, CX, CY)}"
                       style="fill:${escapeHtml(ctx.accent)}2E;stroke:${escapeHtml(ctx.ink)}"/>
              ${axes.map((s, i) => {
                const p = point(i, axes.length, Math.max(.05, s.part) * R, CX, CY);
                const label = point(i, axes.length, R + 30, CX, CY);
                return `
                  <g class="son-echo" data-echo="${escapeHtml(s.key)}" style="--turn:${turnOf(i, axes.length).toFixed(3)}">
                    <circle class="son-echo-wave" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7"/>
                    <circle class="son-echo-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5.5"
                            style="fill:${escapeHtml(ctx.ink)}"/>
                  </g>
                  <text class="son-axis" x="${label.x.toFixed(1)}" y="${label.y.toFixed(1)}"
                        text-anchor="middle" dominant-baseline="middle">${escapeHtml(s.short)}</text>`;
              }).join('')}
            </svg>
            <span class="son-sweep" aria-hidden="true"></span>

            <div class="son-core" data-core>
              <span class="son-core-ico" data-core-ico>${U.icon('eye', ctx.ink, { fill: false })}</span>
              <b data-core-value>${escapeHtml(ctx.entity.name)}</b>
              <small data-core-label>Relevé complet</small>
            </div>
          </div>

          <div class="son-side">
            <span class="son-head">
              <span class="son-led" aria-hidden="true"></span>
              Relevé sonar — ${escapeHtml(ctx.entity.name)}
            </span>

            <div class="son-list">
              ${stats.map((s, i) => `
                <button type="button" class="son-line" style="--i:${i}" data-line="${escapeHtml(s.key)}">
                  ${statIcon(s, ctx.ink)}
                  <span class="son-line-name">${escapeHtml(s.label)}</span>
                  <span class="son-line-track" aria-hidden="true"><i style="--fill:${(s.part * 100).toFixed(1)}%"></i></span>
                  <b class="son-line-value">${escapeHtml(s.text)}</b>
                </button>`).join('')}
            </div>

            <p class="son-hint" data-hint>Le trait de chaque ligne va jusqu'au plafond du bestiaire.</p>
            ${folds(ctx.entity)}
          </div>
        </div>`;
    },
    mount(stage, ctx) {
      const stats = U.statModel(ctx.entity, ctx.data);
      const core = {
        ico: stage.querySelector('[data-core-ico]'),
        value: stage.querySelector('[data-core-value]'),
        label: stage.querySelector('[data-core-label]')
      };
      const hint = stage.querySelector('[data-hint]');

      function show(key) {
        const s = stats.find((x) => x.key === key);
        if (!s) return;
        core.ico.innerHTML = statIcon(s, ctx.ink);
        core.value.textContent = s.text;
        core.label.textContent = s.label;
        hint.textContent = s.hint + ' Plafond du bestiaire : ' + num(s.max) + s.unit + '.';
        stage.querySelectorAll('[data-echo]').forEach((g) => g.classList.toggle('is-on', g.dataset.echo === key));
        stage.querySelectorAll('[data-line]').forEach((b) => b.classList.toggle('is-on', b.dataset.line === key));
      }

      stage.querySelectorAll('[data-line]').forEach((btn) => {
        btn.addEventListener('click', () => show(btn.dataset.line));
        btn.addEventListener('pointerenter', () => show(btn.dataset.line));
      });
      stage.querySelectorAll('[data-echo]').forEach((g) => {
        g.addEventListener('click', () => show(g.dataset.echo));
        g.addEventListener('pointerenter', () => show(g.dataset.echo));
      });
    }
  });

  /* =========================================================================
     V2 — Échos concentriques
     Le meme relevé, mais deroule en anneaux autour de la tete de la bete :
     un anneau par constante, plus il est ferme plus la valeur est haute.
     ========================================================================= */

  OW.labVersions.stats.push({
    id: 'anneaux',
    name: 'Échos concentriques',
    note: "Un anneau par constante, autour de la bête : plus l'arc est long, plus la valeur est haute. Survolez une ligne — son anneau s'allume.",
    render(ctx) {
      const stats = U.statModel(ctx.entity, ctx.data);
      const CX = 210, CY = 210;
      return `
        <div class="ann" data-ann>
          <div class="ann-dial">
            <svg viewBox="0 0 420 420" aria-hidden="true">
              ${stats.map((s, i) => {
                const r = 52 + i * 20;
                const c = 2 * Math.PI * r;
                return `
                  <g class="ann-ring" data-ring="${escapeHtml(s.key)}">
                    <circle class="ann-ring-track" cx="${CX}" cy="${CY}" r="${r}"/>
                    <circle class="ann-ring-fill" cx="${CX}" cy="${CY}" r="${r}"
                            style="stroke:${escapeHtml(ctx.ink)};stroke-dasharray:${c.toFixed(1)};stroke-dashoffset:${(c * (1 - s.part)).toFixed(1)};--delay:${i * 90}ms"/>
                  </g>`;
              }).join('')}
            </svg>
            <span class="ann-head crisp" aria-hidden="true" style="${bg(ctx.entity.head)}"></span>
            <span class="ann-scale">0 %</span>
            <span class="ann-scale ann-scale-max">plafond</span>
          </div>

          <div class="ann-side">
            <span class="son-head"><span class="son-led" aria-hidden="true"></span>${escapeHtml(ctx.entity.name)}</span>
            <div class="ann-list">
              ${stats.map((s, i) => `
                <div class="ann-row" style="--i:${i}" data-row="${escapeHtml(s.key)}">
                  ${statIcon(s, ctx.ink)}
                  <span class="ann-row-name">${escapeHtml(s.label)}</span>
                  <b>${escapeHtml(s.text)}</b>
                  <small>${escapeHtml('sur ' + num(s.max) + s.unit)}</small>
                </div>`).join('')}
            </div>
            ${folds(ctx.entity)}
          </div>
        </div>`;
    },
    mount(stage) {
      stage.querySelectorAll('[data-row]').forEach((row) => {
        const light = (on) => {
          const ring = stage.querySelector('[data-ring="' + row.dataset.row + '"]');
          if (ring) ring.classList.toggle('is-on', on);
          row.classList.toggle('is-on', on);
        };
        row.addEventListener('pointerenter', () => light(true));
        row.addEventListener('pointerleave', () => light(false));
      });
    }
  });

  /* =========================================================================
     V3 — Profil gravé
     Le trace seul, en grand, et les chiffres graves autour de lui. Pas de
     balayage, pas d'animation : la version sobre, pour lire vite.
     ========================================================================= */

  OW.labVersions.stats.push({
    id: 'profil',
    name: 'Profil gravé',
    keep: true,
    note: "Le tracé seul, en grand, et les chiffres gravés tout autour. Aucune animation : la version sobre, celle qui se lit le plus vite.",
    render(ctx) {
      const stats = U.statModel(ctx.entity, ctx.data);
      const axes = axesOf(stats);
      const R = 150, CX = 200, CY = 200;
      const extra = stats.filter((s) => AXES.indexOf(s.key) < 0);

      return `
        <div class="prf">
          <div class="prf-plate">
            <svg viewBox="0 0 400 400" aria-hidden="true">
              ${[1, .66, .33].map((k) => `<polygon class="prf-web" points="${ring(k, R, CX, CY, axes.length)}"/>`).join('')}
              ${axes.map((s, i) => {
                const p = point(i, axes.length, R, CX, CY);
                return `<line class="prf-spoke" x1="${CX}" y1="${CY}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}"/>`;
              }).join('')}
              <polygon class="prf-shape" points="${polygon(axes, R, CX, CY)}"
                       style="fill:${escapeHtml(ctx.accent)}30;stroke:${escapeHtml(ctx.ink)}"/>
              ${axes.map((s, i) => {
                const p = point(i, axes.length, Math.max(.05, s.part) * R, CX, CY);
                return `<circle class="prf-node" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5"
                          style="fill:${escapeHtml(ctx.ink)}"/>`;
              }).join('')}
            </svg>

            ${axes.map((s, i) => {
              const p = point(i, axes.length, R + 46, CX, CY);
              return `
                <span class="prf-mark" data-mark="${escapeHtml(s.key)}"
                      style="left:${(p.x / 4).toFixed(2)}%;top:${(p.y / 4).toFixed(2)}%">
                  <b>${escapeHtml(s.text)}</b>
                  <small>${escapeHtml(s.short)}</small>
                </span>`;
            }).join('')}
          </div>

          <div class="prf-side">
            <span class="prf-kicker">Relevé complet</span>
            <h3 class="prf-name">
              <span class="prf-head crisp" aria-hidden="true" style="${bg(ctx.entity.head)}"></span>
              ${escapeHtml(ctx.entity.name)}
            </h3>
            <dl class="lab-rows prf-rows">
              ${stats.map((s) => `
                <div class="lab-row">
                  <dt>${escapeHtml(s.label)}</dt>
                  <dd>${escapeHtml(s.text)}<em>sur ${escapeHtml(num(s.max) + s.unit)}</em></dd>
                </div>`).join('')}
              ${extra.length ? '' : ''}
            </dl>
            ${folds(ctx.entity)}
          </div>
        </div>`;
    }
  });

  /* =========================================================================
     V4 — Sonar plein écran
     Le meme sonar, mais la bete est dedans : son rendu au centre de l'ecran,
     les valeurs plantees au bout de chaque axe comme des balises. Le bouton
     change l'echelle : le plafond du bestiaire, ou le record en jeu.
     ========================================================================= */

  OW.labVersions.stats.push({
    id: 'balises',
    name: 'Sonar plein écran',
    note: "La bête au centre du sonar, les valeurs plantées comme des balises au bout des axes. Le bouton change l'échelle du tracé : plafond, ou record du bestiaire.",
    render(ctx) {
      const stats = U.statModel(ctx.entity, ctx.data);
      const axes = axesOf(stats);
      const R = 210, CX = 280, CY = 280;

      return `
        <div class="bls" data-bls>
          <div class="bls-scope">
            <svg viewBox="0 0 560 560" aria-hidden="true">
              ${[1, .8, .6, .4, .2].map((k) => `<circle class="bls-ring" cx="${CX}" cy="${CY}" r="${(R * k).toFixed(1)}"/>`).join('')}
              ${axes.map((s, i) => {
                const p = point(i, axes.length, R, CX, CY);
                return `<line class="bls-spoke" x1="${CX}" y1="${CY}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}"/>`;
              }).join('')}
              <polygon class="bls-shape" data-shape points="${polygon(axes, R, CX, CY)}"
                       style="fill:${escapeHtml(ctx.accent)}26;stroke:${escapeHtml(ctx.ink)}"/>
            </svg>

            <span class="bls-sweep" aria-hidden="true"></span>
            <span class="bls-beast">
              <img class="crisp" src="${escapeHtml(U.soloArt(ctx.entity.slug))}" alt=""
                   onerror="this.onerror=null;this.src='${escapeHtml(ctx.entity.art)}'">
            </span>

            ${axes.map((s, i) => {
              const p = point(i, axes.length, R + 42, CX, CY);
              return `
                <span class="bls-flag" data-flag="${escapeHtml(s.key)}"
                      style="left:${(p.x / 5.6).toFixed(2)}%;top:${(p.y / 5.6).toFixed(2)}%;--i:${i}">
                  ${statIcon(s, ctx.ink)}
                  <b>${escapeHtml(s.text)}</b>
                  <small>${escapeHtml(s.label)}</small>
                </span>`;
            }).join('')}
          </div>

          <div class="bls-bar">
            <span class="bls-scale" data-scale-note>Échelle : plafond du bestiaire</span>
            <div class="bls-modes" data-modes>
              <button type="button" class="bls-mode is-on" data-mode="max">Plafond</button>
              <button type="button" class="bls-mode" data-mode="best">Record</button>
            </div>
          </div>
        </div>`;
    },
    mount(stage, ctx) {
      const stats = U.statModel(ctx.entity, ctx.data);
      const axes = axesOf(stats);
      const shape = stage.querySelector('[data-shape]');
      const note = stage.querySelector('[data-scale-note]');
      const R = 210, CX = 280, CY = 280;

      stage.querySelector('[data-modes]').addEventListener('click', (event) => {
        const btn = event.target.closest('[data-mode]');
        if (!btn) return;
        stage.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('is-on', b === btn));
        const best = btn.dataset.mode === 'best';
        /* Le trace change de reference, pas de valeurs : contre le record, une
           bete moyenne se tasse, et on voit tout de suite ou elle domine. */
        const scaled = axes.map((s) => Object.assign({}, s, { part: best ? s.vsBest : s.part }));
        shape.setAttribute('points', polygon(scaled, R, CX, CY));
        note.textContent = best ? 'Échelle : record du bestiaire' : 'Échelle : plafond du bestiaire';
      });
    }
  });

  /* =========================================================================
     V5 — Écho de terrain
     Le sonar deroule a plat, comme un sondeur : les constantes en abscisse,
     leur valeur en hauteur, une ligne de balayage qui passe dessus.
     ========================================================================= */

  OW.labVersions.stats.push({
    id: 'sondeur',
    name: 'Écho de terrain',
    note: "Le sonar déroulé à plat, comme un sondeur de terrain : chaque constante est un pic, la ligne de balayage passe dessus. Survolez un pic pour le détail.",
    render(ctx) {
      const stats = U.statModel(ctx.entity, ctx.data);
      const W = 900, H = 300, PAD = 54;
      const step = (W - PAD * 2) / (stats.length - 1);
      const xy = stats.map((s, i) => ({
        x: PAD + step * i,
        y: H - 40 - s.part * (H - 90),
        s
      }));

      return `
        <div class="snd" data-snd>
          <div class="snd-screen">
            <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
              ${[0, .25, .5, .75, 1].map((k) => `
                <line class="snd-grid" x1="0" y1="${(H - 40 - k * (H - 90)).toFixed(1)}"
                      x2="${W}" y2="${(H - 40 - k * (H - 90)).toFixed(1)}"/>`).join('')}
              <polygon class="snd-fill" style="fill:${escapeHtml(ctx.accent)}24"
                       points="${PAD},${H - 40} ${xy.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')} ${W - PAD},${H - 40}"/>
              <polyline class="snd-trace" style="stroke:${escapeHtml(ctx.ink)}"
                        points="${xy.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')}"/>
              ${xy.map((p) => `
                <line class="snd-drop" x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}"
                      x2="${p.x.toFixed(1)}" y2="${H - 40}"/>`).join('')}
            </svg>
            <span class="snd-scan" aria-hidden="true"></span>

            <div class="snd-pins">
              ${xy.map((p, i) => `
                <button type="button" class="snd-pin" data-pin="${escapeHtml(p.s.key)}"
                        style="left:${(p.x / W * 100).toFixed(2)}%;top:${(p.y / H * 100).toFixed(2)}%;--i:${i}">
                  <span class="snd-dot" style="background:${escapeHtml(ctx.ink)}"></span>
                  <span class="snd-bubble">
                    <b>${escapeHtml(p.s.text)}</b>
                    <small>${escapeHtml(p.s.label)}</small>
                  </span>
                </button>`).join('')}
            </div>
          </div>

          <div class="snd-axis">
            ${stats.map((s) => `
              <span class="snd-axis-key">
                ${statIcon(s, ctx.ink)}
                <small>${escapeHtml(s.short)}</small>
              </span>`).join('')}
          </div>

          <p class="snd-read" data-read>
            Chaque pic monte jusqu'à la part du plafond du bestiaire que la bête atteint.
          </p>
          ${folds(ctx.entity)}
        </div>`;
    },
    mount(stage, ctx) {
      const stats = U.statModel(ctx.entity, ctx.data);
      const read = stage.querySelector('[data-read]');
      const base = read.textContent;
      stage.querySelectorAll('[data-pin]').forEach((pin) => {
        const s = stats.find((x) => x.key === pin.dataset.pin);
        pin.addEventListener('pointerenter', () => {
          read.textContent = s.label + ' : ' + s.text + ' sur ' + num(s.max) + s.unit + '. ' + s.hint;
        });
        pin.addEventListener('pointerleave', () => { read.textContent = base; });
      });
    }
  });
}(window.OW = window.OW || {}));
