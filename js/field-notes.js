(function (OW) {
  'use strict';

  const WEAPONS = {
    bow: {
      label: 'Arc',
      icon: 'minecraft:bow',
      ammo: 'ow:tranquilizer_arrow',
      ammoName: 'Flèche tranquillisante',
      ammoPlural: 'Flèches tranquillisantes',
      base: 'minecraft:arrow',
      baseName: 'Flèche',
      perCraft: 2,
      interval: 1,
      avg: 75,
      low: 50,
      high: 100,
      cadence: '1 tir par seconde, arc bandé à fond',
      note: 'L’arc a une chance sur deux de tirer un coup critique : 100 points au lieu de 50. Une flèche à moitié bandée ne donne que 50. L’enchantement Puissance n’a aucun effet sur les flèches tranquillisantes.'
    },
    blowpipe: {
      label: 'Sarbacane',
      icon: 'ow:maya_blowpipe',
      ammo: 'ow:tranquilizer_wooden_stinger',
      ammoName: 'Dard tranquillisant',
      ammoPlural: 'Dards tranquillisants',
      base: 'ow:wooden_stinger',
      baseName: 'Dard en bois',
      perCraft: 2,
      interval: 0.5,
      avg: 75,
      low: 75,
      high: 75,
      cadence: '2 tirs par seconde, sarbacane chargée à fond',
      note: 'Chaque dard donne 75 points, sans hasard, et la Sarbacane de Maya se recharge en une demi-seconde : la bête a moins de temps pour se réveiller entre deux tirs.'
    },
    slingshot: {
      label: 'Fronde',
      icon: 'ow:primitive_slingshot',
      ammo: 'minecraft:cobblestone',
      ammoName: 'Pierre taillée',
      ammoPlural: 'Pierres taillées',
      base: null,
      baseName: null,
      perCraft: 0,
      interval: 1,
      avg: 35,
      low: 35,
      high: 35,
      cadence: '1 tir par seconde, fronde tendue à fond',
      note: 'Une pierre ne donne que 35 points. La fronde dépanne sur les petites bêtes, mais devient vite impossible sur les grandes : la somnolence retombe plus vite qu’elle ne monte.'
    }
  };

  const TIERS = [
    { level: 1, name: 'Tendre', blocks: 'terre, sable, feuilles, laine, verre, glace, foin' },
    { level: 2, name: 'Bois', blocks: 'planches, bûches, portes, barrières, coffres, tonneaux' },
    { level: 3, name: 'Pierre', blocks: 'pierre, pavés, briques, terre cuite, murets, grès' },
    { level: 4, name: 'Métal', blocks: 'barreaux, portes en fer, minerais, blocs de fer, d’or, de cuivre' },
    { level: 5, name: 'Obsidienne', blocks: 'obsidienne, netherite, débris antiques, coffre de l’Ender' }
  ];

  const esc = (v) => (OW.escapeHtml ? OW.escapeHtml(String(v)) : String(v));
  const fr = (n, d) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: d == null ? 0 : d });
  const icon = (id, extra) => `<span class="fn-ico crisp" aria-hidden="true" ${OW.imgAttr ? OW.imgAttr(OW.itemCandidates(id), { mode: 'bg' }) : ''}${extra || ''}></span>`;

  function clock(seconds) {
    if (!isFinite(seconds)) return '—';
    const t = Math.max(0, Math.round(seconds));
    const m = Math.floor(t / 60);
    const s = t % 60;
    if (!m) return s + ' s';
    return s ? m + ' min ' + String(s).padStart(2, '0') : m + ' min';
  }

  function shotsFor(max, lossPerSecond, weapon, power) {
    const drift = (lossPerSecond || 0) * weapon.interval;
    const gain = power - drift;
    if (max <= power) return 1;
    if (gain <= 0) return Infinity;
    return Math.max(1, Math.ceil((max - drift) / gain));
  }

  function block(key, style, title, body, foot) {
    return `
      <article class="fn-block" data-fn-block="${key}" data-fn-style="${style}">
        <header class="fn-head">
          <h3 class="fn-title">${esc(title)}</h3>
        </header>
        <div class="fn-body">${body}</div>
        ${foot ? `<footer class="fn-foot">${foot}</footer>` : ''}
      </article>`;
  }

  let weaponKey = 'bow';
  const listeners = [];
  const emit = () => listeners.forEach((fn) => fn());

  function weaponTabs() {
    return `
      <div class="fn-tabs" role="tablist" aria-label="Arme">
        ${Object.keys(WEAPONS).map((k) => `
          <button type="button" class="fn-tab" role="tab" data-fn-weapon="${k}" aria-selected="${k === weaponKey}">
            ${icon(WEAPONS[k].icon)}<span>${esc(WEAPONS[k].label)}</span>
          </button>`).join('')}
      </div>`;
  }

  function wireWeaponTabs(scope) {
    scope.querySelectorAll('[data-fn-weapon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        weaponKey = btn.dataset.fnWeapon;
        emit();
      });
    });
  }

  function syncWeaponTabs(scope) {
    scope.querySelectorAll('[data-fn-weapon]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.fnWeapon === weaponKey)));
  }

  function renderShots(entity) {
    const s = entity.taming && entity.taming.somnolence;
    if (!s) return '';
    const cols = [
      { key: 'low', label: 'Minimum', sub: 'individu le plus léger (−20 %)', max: s.min != null ? s.min : s.max * 0.8 },
      { key: 'avg', label: 'Moyenne', sub: 'individu moyen', max: s.max },
      { key: 'high', label: 'Maximum', sub: 'individu le plus lourd (+20 %)', max: s.top != null ? s.top : s.max * 1.2 }
    ];
    const body = `
      ${weaponTabs()}
      <div class="fn-shots" data-fn-shots></div>`;
    const foot = `Calcul théorique : tous les tirs touchent, au rythme indiqué. Entre deux tirs, la bête éveillée perd ${esc(fr(s.lossAwake || 0, 1))} points de somnolence par seconde. Un tir raté, une poursuite ou une bête qui s’éloigne en demandent davantage.`;
    return {
      html: block('shots', 'fenetre', 'Les tirs pour l’endormir', body, foot),
      mount(el) {
        const target = el.querySelector('[data-fn-shots]');
        const paint = () => {
          const w = WEAPONS[weaponKey];
          const rows = cols.map((c) => {
            const mid = shotsFor(c.max, s.lossAwake, w, w.avg);
            const best = shotsFor(c.max, s.lossAwake, w, w.high);
            const worst = shotsFor(c.max, s.lossAwake, w, w.low);
            return { c, mid, best, worst };
          });
          const fmt = (n) => (isFinite(n) ? fr(n) : '∞');
          target.innerHTML = `
            <div class="fn-shots-grid">
              ${rows.map(({ c, mid, best, worst }) => `
                <div class="fn-tile fn-tile-${c.key}${!isFinite(mid) ? ' is-impossible' : ''}">
                  <span class="fn-tile-label">${esc(c.label)}</span>
                  <b class="fn-tile-value">${fmt(mid)}</b>
                  <span class="fn-tile-unit">${!isFinite(mid) ? 'impossible' : (mid > 1 ? 'tirs' : 'tir')}</span>
                  <small class="fn-tile-sub">${esc(fr(c.max))} points · ${esc(c.sub)}</small>
                  ${best !== worst && isFinite(mid) ? `<small class="fn-tile-range">${fmt(best)} à ${fmt(worst)} selon les critiques</small>` : ''}
                </div>`).join('')}
            </div>
            <table class="fn-table">
              <thead><tr><th scope="col">Somnolence</th>${cols.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('')}</tr></thead>
              <tbody>
                <tr><th scope="row">Points à remplir</th>${cols.map((c) => `<td>${esc(fr(c.max))}</td>`).join('')}</tr>
                <tr class="is-key"><th scope="row">${esc(w.ammoPlural)}</th>${rows.map((r) => `<td>${fmt(r.mid)}</td>`).join('')}</tr>
                <tr><th scope="row">Temps de tir</th>${rows.map((r) => `<td>${isFinite(r.mid) ? esc(clock((r.mid - 1) * w.interval)) : '—'}</td>`).join('')}</tr>
                <tr><th scope="row">${w.perCraft ? 'Langues fourchues' : 'Coût'}</th>${rows.map((r) => `<td>${isFinite(r.mid) ? (w.perCraft ? fr(Math.ceil(r.mid / w.perCraft)) : 'aucun') : '—'}</td>`).join('')}</tr>
              </tbody>
            </table>
            <p class="fn-weapon-note">${icon(w.ammo)}<span><b>${esc(w.label)}</b> · ${esc(w.cadence)}. ${esc(w.note)}</span></p>`;
          syncWeaponTabs(el);
          if (OW.resolveImages) OW.resolveImages(el);
        };
        wireWeaponTabs(el);
        listeners.push(paint);
        paint();
      }
    };
  }

  function renderEnclosure(entity, raw) {
    const b = raw && raw.taming && raw.taming.breakout;
    if (!b) return '';
    const level = b.level;
    const safe = level < 0 ? TIERS[0] : TIERS.find((x) => x.level > level);
    const body = `
      <div class="fn-enclosure">
        <div class="fn-verdict">
          <span class="fn-verdict-label">Enclos sûr</span>
          <b class="fn-verdict-value">${level < 0 ? 'N’importe lequel' : (safe ? esc(safe.name) : 'Aucun')}</b>
          <small>${level < 0 ? 'cette créature ne casse aucun bloc' : (level === 0 ? 'elle casse absolument tout' : (safe ? 'au minimum : ' + esc(safe.blocks) : 'elle casse même l’obsidienne'))}</small>
        </div>
        <ol class="fn-tiers">
          ${TIERS.map((x) => `
            <li class="fn-tier${level === 0 || (level > 0 && x.level <= level) ? ' is-broken' : ''}${safe && x.level === safe.level && level >= 0 ? ' is-safe' : ''}">
              <span class="fn-tier-num">${x.level}</span>
              <span class="fn-tier-text"><b>${esc(x.name)}</b><small>${esc(x.blocks)}</small></span>
              <span class="fn-tier-state">${level === 0 || (level > 0 && x.level <= level) ? 'Cassé' : 'Tient'}</span>
            </li>`).join('')}
        </ol>
      </div>`;
    const foot = `Elle ne casse que si elle est enfermée, agitée (tirée, blessée ou alarmée) et sous ${esc(b.below_percent)} % de somnolence : au-delà, elle se sent acculée et ne force plus. Les bébés ne cassent rien${b.respects_mob_griefing ? ', et la règle mobGriefing est respectée' : ''}. La casse est progressive : un mur d’un palier juste en dessous du sien lui résiste plusieurs secondes.`;
    return { html: block('enclosure', 'planches', 'L’enclos qui la retient', body, foot), mount() {} };
  }

  function mountInto(host, parts) {
    const ready = parts.filter(Boolean);
    if (!host || !ready.length) {
      if (host) host.hidden = true;
      return;
    }
    host.hidden = false;
    host.innerHTML = ready.map((p) => p.html).join('');
    const els = host.querySelectorAll('.fn-block');
    ready.forEach((p, i) => p.mount(els[i]));
    if (OW.resolveImages) OW.resolveImages(host);
  }

  function toc(visible) {
    const link = document.querySelector('[data-toc-link="field"]');
    if (link) link.hidden = !visible;
  }

  function renderFieldNotes(entity) {
    if (entity.boss) {
      const chap = document.getElementById('field');
      if (chap) chap.hidden = true;
      toc(false);
      return;
    }
    fetch('data/wiki_data.json')
      .then((r) => r.json())
      .then((rawAll) => {
        const raw = (rawAll.entities || []).find((e) => e.id === entity.id) || null;
        const tameable = entity.taming && entity.taming.tameable;
        mountInto(document.querySelector('[data-fn-taming]'), tameable ? [renderShots(entity)] : []);
        mountInto(document.querySelector('[data-fn-field]'), [renderEnclosure(entity, raw)]);
        const chap = document.getElementById('field');
        const fieldHost = document.querySelector('[data-fn-field]');
        if (chap && fieldHost) chap.hidden = fieldHost.hidden;
        toc(!(fieldHost && fieldHost.hidden));
      })
      .catch((error) => console.error(error));
  }

  OW.renderFieldNotes = renderFieldNotes;
}(window.OW = window.OW || {}));
