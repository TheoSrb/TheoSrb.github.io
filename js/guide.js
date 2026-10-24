/* Le guide du debutant.

   Beaucoup de calcul, peu a lire. Tout ce que la page affiche est deduit de
   l'export du mod (data/wiki_data.json) — rien n'est ecrit a la main sur les
   betes :

   01  Le parcours    six etapes, de la premiere balade a l'arene ; a chaque
                      etape, la recommandation calculee (le biome le plus
                      peuple, la bete la plus facile, la selle la moins chere,
                      l'XP qu'il faut, le badge d'acces a l'arene...).
   02  Le choix       « qu'est-ce qui compte pour vous ? » : on coche ses
                      priorites, chaque bete est notee sur chacune (facilite
                      d'apprivoisement, monture, combat, resistance, eau,
                      ressources, prix de la selle), et le podium se refait.
   03  Les records    la meilleure bete dans chaque domaine, et ses dauphines.
   04  Le farm        pour chaque ressource, qui en donne le plus par chasse,
                      et a quoi elle sert — le bois compris : l'elephant abat
                      l'arbre entier en chargeant, avec 50 % de buches en plus
                      (js/combat-data.js, harvest).

   Les notes de combat suivent le modele du simulateur (js/combat-data.js) :
   rythme reel des combos, armure, bonus des archetypes. */

(function (OW) {
  'use strict';

  const { loadWikiData, escapeHtml, mountHeader, mountFooter, reveal, bg, plural, num, animalHref, archetypeIcon } = OW;
  const $ = (s, r) => (r || document).querySelector(s);
  const CD = OW.COMBAT_DATA || { comboTicks: {}, defaultComboTicks: 20, comboHits: 3, energyFallback: {} };

  const ARCHETYPE_LABEL = {
    TANK: 'Tank', ASSASSIN: 'Assassin', MARAUDER: 'Maraudeur', HEALER: 'Soigneur',
    BERSERKER: 'Berserker', SCOUT: 'Éclaireur', NORMAL: 'Normal'
  };
  const TEMPER_LABEL = { PASSIVE: 'Paisible', NEUTRAL: 'Neutre', AGGRESSIVE: 'Agressive' };

  const soloArt = (slug) => {
    const name = String(slug).split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return OW.asset(encodeURI('assets/entities/solo/' + name + ' [SOLO].png'));
  };
  const icon = (id, cls, more) => `<span class="${cls || 'gd-ico'} crisp" aria-hidden="true" ${OW.imgAttr(OW.itemCandidates(id), { mode: 'bg' })} ${more || ''}></span>`;
  const frNum = (v, d) => num(v, d == null ? 1 : d).toString().replace('.', ',');

  /* La couleur d'une bete, brute ; eclaircie seulement quand elle tombe sous
     3:1 contre le fond sombre (le kodiak, l'orque, le gorille), comme sur les
     fiches (js/animal.js, strongInk). Pour le texte seulement : les barres et
     les liseres gardent la couleur brute. */
  function inkText(hex) {
    if (!OW.luminance || !/^#[0-9a-f]{6}$/i.test(hex || '')) return hex || '#F2A32C';
    const back = OW.luminance('#0B0F0C');
    const ratio = (l) => (Math.max(l, back) + .05) / (Math.min(l, back) + .05);
    const mix = (t) => '#' + [1, 3, 5].map((k) => {
      const c = parseInt(hex.slice(k, k + 2), 16);
      return Math.round(c + (255 - c) * t).toString(16).padStart(2, '0');
    }).join('');
    for (let step = 0; step <= 10; step++) {
      const c = mix(step / 10);
      if (ratio(OW.luminance(c)) >= 3) return c;
    }
    return '#FFFFFF';
  }
  const inkVars = (e) => `--ink:${escapeHtml(e.color || '#F2A32C')};--ink-t:${inkText(e.color || '#F2A32C')}`;
  const pctBar = (v) => `<span class="gd-bar"><i style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%"></i></span>`;

  /* ======================================================================
     Les mesures de chaque bete
     ====================================================================== */

  function armorReduction(armor, hit) {
    if (!armor) return 0;
    return Math.max(armor * 0.2, Math.min(20, armor - hit / 2)) / 25;
  }

  function tamedHealth(hp) {
    return hp * (hp >= 80 ? 1.05 : hp >= 70 ? 1.1 : hp >= 60 ? 1.2 : 1.3);
  }

  /** Tout ce que le guide sait d'une bete, en chiffres. */
  function measure(e, ctx) {
    const s = e.stats || {};
    const arch = e.archetype && e.archetype.name;
    const ticks = CD.comboTicks[e.slug] || CD.defaultComboTicks;
    /* Frapper fort : la statistique de degats, telle quelle. La cadence du
       combo n'entre pas en compte (elle hissait le tigre devant l'hippo). */
    const damage = s.damage || 0;

    const hp = tamedHealth(s.hp || 20);
    const taken = ctx.refHit * (arch === 'TANK' ? 0.8 : 1);
    const landed = taken * (1 - armorReduction(s.armor || 0, taken));
    const toughness = hp * (ctx.refHit / landed) * (1 + 0.5 * (s.knockbackRes || 0));

    const foods = (e.taming && e.taming.foodTags ? e.taming.foodTags : []).flatMap((t) => t.items);
    /* Sans nourriture dans l'export (le kangourou s'apprivoise autrement), ni
       bonus ni penalite : la moitie. */
    const vanillaFood = foods.length ? foods.filter((f) => /^minecraft:/.test(f.id)).length / foods.length : .5;
    const spawnBiomes = e.spawn && e.spawn.biomes ? e.spawn.biomes : [];

    const needsSaddle = !(e.traits && e.traits.rideable) ? null : (e.mount ? e.mount.needsSaddle !== false : true);
    const saddleCost = e.saddle ? e.saddle.needs.reduce((sum, n) => sum + (n.count || 0), 0) : null;

    /* Le butin : ce qu'une chasse rapporte en moyenne, pondere par l'utilite
       de chaque objet (le nombre de recettes qui le demandent). */
    const drops = (e.loot && e.loot.drops) || [];
    const perKill = drops.map((d) => {
      const avg = ((d.min || 0) + (d.max || 0)) / 2 * (d.chance == null ? 1 : d.chance);
      const uses = ctx.usesOf(d.id);
      return { d, avg, uses };
    });
    const lootCount = perKill.reduce((sum, x) => sum + x.avg, 0);
    const lootValue = perKill.reduce((sum, x) => sum + x.avg * (1 + x.uses * 0.6), 0);

    const aquatic = (e.family === 'aquatic' ? 1 : e.family === 'semi_aquatic' ? .7 : 0)
      + (e.traits && e.traits.diver ? .3 : 0);

    return {
      e, arch, ticks, damage, hp, toughness,
      speed: s.mountedBps || s.walkBps || 0,
      jump: !!(e.traits && e.traits.rideable_jumping),
      energy: e.mount && e.mount.maxEnergy != null ? e.mount.maxEnergy : (CD.energyFallback[e.slug] || 0),
      tameXp: e.taming && e.taming.experience ? e.taming.experience : null,
      /* Facile a apprivoiser : le plafond de la barre de somnolence, seul.
         Moins il y a de points a remplir, plus vite la bete s'endort. */
      somno: e.taming && e.taming.somnolence && e.taming.somnolence.max ? e.taming.somnolence.max : null,
      temper: e.temperament || 'NEUTRAL',
      vanillaFood, foods,
      spawnBiomes, spawnWeight: e.spawn ? e.spawn.weight || 0 : 0,
      needsSaddle, saddleCost,
      drops: perKill, lootCount, lootValue,
      harvest: (CD.harvest && CD.harvest[e.slug]) || null,
      aquatic: Math.min(1, aquatic)
    };
  }

  /* Chaque critere, ramene entre 0 et 1 sur l'ensemble du bestiaire. */
  function normaliser(list, get, invert) {
    const values = list.map(get).filter((v) => v != null && isFinite(v));
    const lo = Math.min.apply(null, values);
    const hi = Math.max.apply(null, values);
    return (m) => {
      const v = get(m);
      if (v == null || !isFinite(v)) return .35;
      const t = hi > lo ? (v - lo) / (hi - lo) : 1;
      return invert ? 1 - t : t;
    };
  }

  const NEEDS = [
    { key: 'easy', label: 'Facile à apprivoiser', icon: 'assets/ui/taming_exp.png' },
    { key: 'ride', label: 'Monture rapide', icon: 'assets/ui/energy.png' },
    { key: 'fight', label: 'Frapper fort', icon: 'assets/tools/ruby_sword.png' },
    { key: 'tank', label: 'Encaisser', icon: 'assets/tools/jade_chestplate.png' },
    { key: 'water', label: 'Nager', icon: 'assets/item/crocodile_scale.png' },
    { key: 'farm', label: 'Ressources', icon: 'assets/item/raw_boa.png' },
    { key: 'cheap', label: 'Selle bon marché', icon: 'assets/item/boa_saddle.png' }
  ];

  function scorers(ms) {
    const n = {
      somno: normaliser(ms, (m) => m.somno, true),
      speed: normaliser(ms, (m) => m.speed),
      damage: normaliser(ms, (m) => m.damage),
      tough: normaliser(ms, (m) => m.toughness),
      loot: normaliser(ms, (m) => m.lootValue),
      saddle: normaliser(ms, (m) => (m.needsSaddle === false ? 0 : m.saddleCost), true)
    };
    return {
      easy: (m) => n.somno(m),
      ride: (m) => .85 * n.speed(m) + (m.jump ? .15 : 0),
      fight: (m) => n.damage(m),
      tank: (m) => n.tough(m),
      water: (m) => m.aquatic,
      /* Les ressources : le butin d'une chasse, ou une recolte a part — le bois
         que l'elephant abat en chargeant, renouvelable et sans combat. */
      farm: (m) => Math.max(n.loot(m), m.harvest ? .75 + .25 * (m.harvest.bonus || 0) : 0),
      cheap: (m) => (m.needsSaddle === false ? 1 : m.saddleCost == null ? .3 : n.saddle(m))
    };
  }

  /* ======================================================================
     01 · Le parcours
     ====================================================================== */

  function journey(data, ms, score) {
    /* La premiere monture : la plus facile a apprivoiser parmi celles qu'on
       peut monter (le panda roux, lui, se porte sur l'epaule). L'etape de la
       selle parle ensuite de cette bete-la, pas d'une autre. */
    const byEase = ms.slice().sort((a, b) => score.easy(b) - score.easy(a));
    const first = byEase.find((m) => m.e.traits && m.e.traits.rideable) || byEase[0];

    /* Le biome qui accueille le plus d'especes differentes. */
    const biomeCount = {};
    ms.forEach((m) => m.spawnBiomes.forEach((b) => { (biomeCount[b] = biomeCount[b] || []).push(m); }));
    const biomes = Object.keys(biomeCount).sort((a, b) => biomeCount[b].length - biomeCount[a].length);

    const saddled = ms.filter((m) => m.saddleCost != null).sort((a, b) => a.saddleCost - b.saddleCost);
    /* La selle de la premiere monture : la sienne, ou celle qu'elle accepte
       (le kangourou porte la selle du tigre, mount.saddle_item). */
    const worn = first && first.e.mount && first.e.mount.saddleItem;
    const firstSaddle = first && first.saddleCost != null ? first
      : (worn ? saddled.find((m) => m.e.saddle && m.e.saddle.result === worn) : null) || null;
    const borrowed = firstSaddle && firstSaddle !== first;
    const cheapest = firstSaddle || saddled[0];
    const noSaddle = ms.filter((m) => m.needsSaddle === false);
    const de = (name) => (/^[aeiouyéèh]/i.test(name) ? 'de l’' : 'du ');

    const curve = data.levelCurve;
    const at = (lv) => (curve.levels.find((l) => l.level === lv) || {}).cumulative || 0;

    const t = data.tribes || {};
    const arena = t.arena || {};
    const badge = ((t.reputation || {}).badges || []).find((b) => b.name === (arena.access || {}).min_badge);
    const questCoins = data.quests.reduce((s, q) => s + (q.reward || 0), 0);

    const heads = (list) => list.slice(0, 5).map((m) => `<a class="gd-head" href="${animalHref(m.e.slug)}" title="${escapeHtml(m.e.name)}"><span class="crisp" style="${bg(m.e.head)}"></span></a>`).join('');
    /* La premiere phrase de son guide d'apprivoisement, s'il est ecrit
       (js/taming-guides.js) — le texte du mod n'est plus lu. */
    const firstSteps = first && OW.TAMING_GUIDES && OW.TAMING_GUIDES[first.e.slug];
    /* Les lignes « # Titre » sont des titres de chapitre, pas du texte. */
    const firstPage = Array.isArray(firstSteps) ? firstSteps.find((s) => !/^\s*#/.test(String(s))) : null;
    const firstManual = firstPage
      ? String(firstPage).replace(/\*\*/g, '').split('.').slice(0, 1).join('.') + '.' : '';

    const steps = [
      {
        title: 'Partir en exploration', kicker: 'OBJECTIF · TROUVER SES PREMIÈRES BÊTES',
        text: biomes.length
          ? `Le biome le plus peuplé du mod est ${escapeHtml(OW.biomeName(biomes[0]))} : ${plural(biomeCount[biomes[0]].length, 'espèce')} y vivent. `
            + (biomes[1] ? `Viennent ensuite ${escapeHtml(OW.biomeName(biomes[1]))} et ${escapeHtml(OW.biomeName(biomes[2] || biomes[1]))}.` : '')
          : 'Les biomes chauds et humides abritent la plupart des créatures.',
        extra: biomes.length ? `<span class="gd-heads">${heads(biomeCount[biomes[0]])}</span>` : ''
      },
      first && {
        title: 'Apprivoiser une première créature', kicker: 'OBJECTIF · SA PREMIÈRE MONTURE',
        text: `La plus accessible pour commencer : <b>${escapeHtml(first.e.name)}</b> — ${escapeHtml(TEMPER_LABEL[first.temper] || '')} de caractère`
          + (first.somno ? `, ${Math.round(first.somno)} points de somnolence pour l’endormir` : '')
          + (first.spawnBiomes.length ? `, en ${escapeHtml(first.spawnBiomes.map(OW.biomeName).join(', '))}` : '') + '. '
          + (firstManual ? escapeHtml(firstManual) : ''),
        extra: first.foods.length ? `<span class="gd-items">${first.foods.slice(0, 6).map((f) => `<span class="gd-item" title="${escapeHtml(f.name)}">${icon(f.id)}<small>${escapeHtml(f.name)}</small></span>`).join('')}</span>` : '',
        link: [animalHref(first.e.slug, 'taming'), 'Guide d’apprivoisement']
      },
      (cheapest || noSaddle.length) && {
        title: 'Fabriquer une selle', kicker: 'OBJECTIF · MONTER SUR SON DOS',
        text: (first && first.needsSaddle === false
          ? `Le <b>${escapeHtml(first.e.name)}</b> se monte sans selle. `
          : cheapest ? (firstSaddle
            ? (borrowed
              ? `Le ${escapeHtml(first.e.name)} porte la selle ${de(cheapest.e.name)}<b>${escapeHtml(cheapest.e.name)}</b> : ${plural(cheapest.saddleCost, 'ingrédient')} au total. `
              : `La selle ${de(cheapest.e.name)}<b>${escapeHtml(cheapest.e.name)}</b> demande ${plural(cheapest.saddleCost, 'ingrédient')} au total. `)
            : `La selle la moins chère est celle ${de(cheapest.e.name)}<b>${escapeHtml(cheapest.e.name)}</b> : ${plural(cheapest.saddleCost, 'ingrédient')} au total. `) : '')
          + (noSaddle.filter((m) => m !== first).length ? `Pas besoin de selle du tout pour : ${noSaddle.filter((m) => m !== first).map((m) => '<b>' + escapeHtml(m.e.name) + '</b>').join(', ')}.` : ''),
        extra: cheapest && !(first && first.needsSaddle === false) ? `<span class="gd-items">${cheapest.e.saddle.needs.map((n) => `<span class="gd-item" title="${escapeHtml(n.name)}">${icon(n.iconId, null, OW.cycleAttr(n.iconIds, (n.colorSlot || 0) * 8))}<b>×${n.count}</b><small>${escapeHtml(n.name)}</small></span>`).join('')}</span>` : ''
      },
      {
        title: 'Faire progresser sa bête', kicker: 'OBJECTIF · LE NIVEAU 10',
        text: `Chaque niveau donne un point à placer dans les PV, les dégâts, la vitesse ou l’énergie. Le niveau 10 demande ${at(10)} XP au total, `
          + `le niveau ${curve.max} ${curve.totalXp} XP.` + (first && first.e.piste && first.e.piste.available ? ` La Piste Sauvage ${de(first.e.name)}${escapeHtml(first.e.name)} compte ${first.e.piste.nodeCount} nœuds.` : ''),
        link: ['simulator.html#combat', 'Simuler ses points']
      },
      data.quests.length && {
        title: 'Faire ses quêtes du jour', kicker: 'OBJECTIF · DES PIÈCES SAUVAGES',
        text: `${plural(data.quests.length, 'quête')} quotidiennes, pour ${questCoins} pièces sauvages en tout : la monnaie qui débloque la Piste Sauvage.`,
        link: ['simulator.html#quests', 'Les quêtes']
      },
      t.overview && {
        title: 'Rejoindre une tribu', kicker: 'OBJECTIF · L’ARÈNE',
        text: `Jusqu’à ${t.overview.max_players} joueurs par tribu. L’arène s’ouvre au badge ${escapeHtml(badge ? (badge.label || badge.name) : 'requis')}`
          + (badge && badge.threshold != null ? `, à ${Number(badge.threshold).toLocaleString('fr-FR')} points de réputation` : '') + '.',
        link: ['simulator.html#tribes', 'Les tribus']
      }
    ].filter(Boolean);

    /* Une etape sur deux passe de l'autre cote du chemin : la carte se lit en
       zigzag, de la pancarte du depart au X du tresor. */
    $('[data-gd-journey]').innerHTML = steps.map((s, i) => `
      <li class="gd-step ${i % 2 ? 'is-right' : 'is-left'}" style="--i:${i}">
        <span class="gd-step-num" data-trail-node aria-hidden="true">${i + 1}</span>
        <div class="gd-step-body" data-reveal="${i % 2 ? 'right' : 'left'}">
          <span class="gd-step-kicker">${escapeHtml(s.kicker)}</span>
          <b class="gd-step-title">${escapeHtml(s.title)}</b>
          <p>${s.text}</p>
          ${s.extra || ''}
          ${s.link ? `<a class="link-arrow" href="${s.link[0]}">${escapeHtml(s.link[1])}</a>` : ''}
        </div>
      </li>`).join('');
    drawTrail();
  }

  /* Le chemin de la carte : une bande de terre balisee de pointilles, d'un
     repere a l'autre, en courbes douces. Recalcule a chaque changement de taille, et
     quand les polices ou les images ont fini de se poser. */
  function drawTrail() {
    const map = $('[data-gd-map]');
    if (!map) return;
    const svg = map.querySelector('[data-trail-svg]');
    const box = map.getBoundingClientRect();
    if (!box.width) return;
    const centre = (el) => {
      const r = el.getBoundingClientRect();
      return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
    };
    const nodes = [map.querySelector('[data-trail-start]')]
      .concat(Array.from(map.querySelectorAll('[data-trail-node]')))
      /* Le chemin s'arrete sur le X, pas au milieu de son ecriteau. */
      .concat([map.querySelector('[data-trail-end] svg') || map.querySelector('[data-trail-end]')])
      .filter(Boolean)
      .map(centre);
    if (nodes.length < 2) return;
    /* Une courbe qui passe par tous les reperes (Catmull-Rom) : le sentier
       serpente d'un bord de la carte a l'autre, sans angle. */
    const P = (i) => nodes[Math.max(0, Math.min(nodes.length - 1, i))];
    const f = (v) => v.toFixed(1);
    let d = 'M' + f(nodes[0][0]) + ' ' + f(nodes[0][1]);
    for (let i = 0; i < nodes.length - 1; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
    }
    svg.setAttribute('viewBox', `0 0 ${box.width.toFixed(0)} ${box.height.toFixed(0)}`);
    svg.querySelectorAll('path').forEach((p) => p.setAttribute('d', d));
  }

  function watchTrail() {
    const map = $('[data-gd-map]');
    if (!map) return;
    let frame = 0;
    const redraw = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(drawTrail); };
    if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(map);
    window.addEventListener('resize', redraw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
    window.addEventListener('load', redraw);
    setTimeout(redraw, 900);
  }

  /* ======================================================================
     02 · Quelle premiere creature ?
     ====================================================================== */

  /* Par defaut, la seule facilite : la section parle de la premiere bete, et
   la vitesse en selle poussait le tigre sur le podium. */
  const chosen = new Set(['easy']);

  function reasons(m, score, keys) {
    const lines = {
      easy: () => (m.somno ? `${Math.round(m.somno)} pts de somnolence` : 'Somnolence non documentée'),
      ride: () => `${frNum(m.speed)} blocs/s en selle${m.jump ? ' · saute' : ''}`,
      fight: () => `${frNum(m.damage)} points de dégâts`,
      tank: () => `${Math.round(m.hp)} PV apprivoisée${m.arch === 'TANK' ? ' · −20 % de dégâts' : ''}`,
      water: () => (m.e.family === 'aquatic' ? 'Aquatique' : m.aquatic > 0 ? 'Semi-aquatique' : 'Terrestre') + (m.e.traits && m.e.traits.diver ? ' · plonge' : ''),
      farm: () => (m.harvest
        ? `Abat l’arbre entier : +${Math.round((m.harvest.bonus || 0) * 100)} % de bois`
        : `≈ ${frNum(m.lootCount)} ressources par chasse`),
      cheap: () => (m.needsSaddle === false ? 'Pas besoin de selle' : m.saddleCost != null ? `Selle : ${m.saddleCost} ingrédients` : 'Selle non documentée')
    };
    return keys.slice().sort((a, b) => score[b](m) - score[a](m)).slice(0, 3).map((k) => ({ k, text: lines[k](), v: score[k](m) }));
  }

  function renderPicker(ms, score) {
    const keys = Array.from(chosen);
    const total = (m) => (keys.length ? keys.reduce((s, k) => s + score[k](m), 0) / keys.length : 0);
    const ranked = ms.slice().sort((a, b) => total(b) - total(a));
    const podium = ranked.slice(0, 3);
    const order = [1, 0, 2].filter((i) => podium[i]);

    $('[data-gd-podium]').innerHTML = keys.length ? `
      <div class="gd-podium">
        ${order.map((i) => {
          const m = podium[i];
          return `
            <a class="gd-pod place-${i + 1}" href="${animalHref(m.e.slug)}" style="${inkVars(m.e)}">
              <span class="gd-pod-rank">${i + 1}</span>
              <img class="gd-pod-art crisp" data-vt-art src="${OW.soloVignette(m.e.slug)}" data-solo-full="${soloArt(m.e.slug)}"
                   alt="" loading="lazy" decoding="async" onerror="OW.soloImgError(this, '${escapeHtml(m.e.art)}')">
              <b class="gd-pod-name">${escapeHtml(m.e.name)}</b>
              <span class="gd-pod-score">${Math.round(total(m) * 100)}<small>/100</small></span>
              <ul class="gd-pod-why">
                ${reasons(m, score, keys).map((r) => `<li>${escapeHtml(r.text)}</li>`).join('')}
              </ul>
            </a>`;
        }).join('')}
      </div>
      <ol class="gd-rank">
        ${ranked.map((m, i) => `
          <li style="--ink:${escapeHtml(m.e.color || '#F2A32C')}">
            <span class="gd-rank-n">${i + 1}</span>
            <span class="gd-rank-head crisp" style="${bg(m.e.head)}"></span>
            <a href="${animalHref(m.e.slug)}">${escapeHtml(m.e.name)}</a>
            ${pctBar(total(m))}
            <b>${Math.round(total(m) * 100)}</b>
          </li>`).join('')}
      </ol>`
      : '<p class="gd-empty">Le classement apparaît dès qu’une priorité est cochée.</p>';
    $('[data-gd-podium]').querySelectorAll('.gd-pod').forEach((el) => el.animate
      && !matchMedia('(prefers-reduced-motion: reduce)').matches
      && el.animate([{ transform: 'translateY(14px)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' }));
  }

  function mountPicker(ms, score) {
    $('[data-gd-needs]').innerHTML = NEEDS.map((n) => `
      <button type="button" class="btn btn-toggle gd-need" data-need="${n.key}" aria-pressed="${chosen.has(n.key)}">
        <span class="crisp" aria-hidden="true" style="${bg(n.icon)}"></span>${escapeHtml(n.label)}
      </button>`).join('');
    $('[data-gd-needs]').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-need]');
      if (!b) return;
      const k = b.dataset.need;
      if (chosen.has(k)) chosen.delete(k); else chosen.add(k);
      b.setAttribute('aria-pressed', String(chosen.has(k)));
      renderPicker(ms, score);
    });
    renderPicker(ms, score);
  }

  /* ======================================================================
     03 · Les records
     ====================================================================== */

  function renderAwards(ms) {
    const awards = [
      { title: 'Monture la plus rapide', get: (m) => m.speed, fmt: (m) => frNum(m.speed) + ' b/s', icon: 'assets/ui/energy.png' },
      { title: 'Le plus de dégâts', get: (m) => m.damage, fmt: (m) => frNum(m.damage) + ' points de dégâts', icon: 'assets/tools/ruby_sword.png' },
      { title: 'La plus solide', get: (m) => m.toughness, fmt: (m) => Math.round(m.hp) + ' PV' + (m.arch === 'TANK' ? ' · Tank' : ''), icon: 'assets/tools/jade_chestplate.png' },
      { title: 'La plus facile à apprivoiser', get: (m) => (m.somno == null ? null : -m.somno), fmt: (m) => Math.round(m.somno) + ' pts de somnolence', icon: 'assets/ui/taming_exp.png' },
      { title: 'La plus grande endurance', get: (m) => m.energy, fmt: (m) => Math.round(m.energy) + ' d’énergie', icon: 'assets/ui/energy.png' },
      { title: 'Le meilleur butin', get: (m) => m.lootValue, fmt: (m) => '≈ ' + frNum(m.lootCount) + ' par chasse', icon: 'assets/item/raw_boa.png' },
      { title: 'La selle la moins chère', get: (m) => (m.saddleCost == null ? null : -m.saddleCost), fmt: (m) => m.saddleCost + ' ingrédients', icon: 'assets/item/boa_saddle.png' },
      { title: 'La plus à l’aise dans l’eau', get: (m) => (m.aquatic > 0 ? m.aquatic + m.speed / 100 : null), fmt: (m) => (m.e.family === 'aquatic' ? 'Aquatique' : 'Semi-aquatique'), icon: 'assets/item/crocodile_scale.png' },
      { title: 'Le meilleur bûcheron', get: (m) => (m.harvest && m.harvest.resource === 'wood' ? 1 + (m.harvest.bonus || 0) : null), fmt: (m) => '+' + Math.round((m.harvest.bonus || 0) * 100) + ' % de bois', icon: 'assets/block/redwood_log.png' }
    ];
    $('[data-gd-awards]').innerHTML = awards.map((a, i) => {
      const list = ms.filter((m) => a.get(m) != null && isFinite(a.get(m))).sort((x, y) => a.get(y) - a.get(x));
      if (!list.length) return '';
      const w = list[0];
      return `
        <article class="gd-award" style="${inkVars(w.e)};--i:${i}" data-reveal>
          <span class="gd-award-medal crisp" aria-hidden="true" style="${bg(a.icon)}"></span>
          <span class="gd-award-title">${escapeHtml(a.title)}</span>
          <a class="gd-award-win" href="${animalHref(w.e.slug)}">
            <span class="gd-award-head crisp" style="${bg(w.e.head)}"></span>
            <b>${escapeHtml(w.e.name)}</b>
          </a>
          <span class="gd-award-value">${escapeHtml(a.fmt(w))}</span>
          <span class="gd-award-next">
            ${list.slice(1, 3).map((m, k) => `<a href="${animalHref(m.e.slug)}" title="${escapeHtml(m.e.name)} · ${escapeHtml(a.fmt(m))}"><small>${k + 2}</small><span class="crisp" style="${bg(m.e.head)}"></span></a>`).join('')}
          </span>
        </article>`;
    }).join('');
  }

  /* ======================================================================
     04 · Qu'est-ce qui farme le mieux ?
     ====================================================================== */

  let farmPick = null;

  function renderFarm(ms, ctx) {
    /* Chaque ressource, et les betes qui la donnent. */
    const items = new Map();
    ms.forEach((m) => m.drops.forEach((x) => {
      if (!items.has(x.d.id)) items.set(x.d.id, { id: x.d.id, name: x.d.name, uses: x.uses, sources: [] });
      items.get(x.d.id).sources.push({ m, x });
    }));
    /* Le bois : il ne tombe d'aucune chasse, il se recolte. L'elephant, en
       chargeant, abat l'arbre entier, avec une buche de plus une fois sur deux. */
    const woodcutters = ms.filter((m) => m.harvest && m.harvest.resource === 'wood');
    if (woodcutters.length) {
      const h = woodcutters[0].harvest;
      items.set('harvest:wood', {
        id: 'harvest:wood', name: h.name, icon: h.icon, harvest: true,
        uses: ctx.logRecipes.length, sources: woodcutters.map((m) => ({ m, h: m.harvest }))
      });
    }
    const list = Array.from(items.values()).sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name, 'fr'));
    if (!list.length) { $('[data-gd-farm]').innerHTML = '<p class="gd-empty">Aucun butin dans l’export.</p>'; return; }
    if (!farmPick || !items.has(farmPick)) farmPick = list[0].id;

    const it = items.get(farmPick);
    const iconOf = (r, cls) => (r.icon ? `<span class="${cls || 'gd-ico'} crisp" aria-hidden="true" style="${bg(r.icon)}"></span>` : icon(r.id, cls));
    const usedIn = it.harvest ? ctx.logRecipes : ctx.recipesUsing(it.id);

    let rows;
    if (it.harvest) {
      rows = it.sources.map(({ m, h }, i) => `
        <li style="--ink:${escapeHtml(m.e.color || '#F2A32C')}">
          <span class="gd-rank-n">${i + 1}</span>
          <span class="gd-rank-head crisp" style="${bg(m.e.head)}"></span>
          <span class="gd-src-text">
            <a href="${animalHref(m.e.slug, 'abilities')}">${escapeHtml(m.e.name)}</a>
            <small>En chargeant, abat l’arbre entier (jusqu’à ${h.maxLogs} bûches) · une bûche de plus une fois sur deux${m.spawnBiomes.length ? ' · ' + escapeHtml(m.spawnBiomes.map(OW.biomeName).join(', ')) : ''}</small>
          </span>
          ${pctBar(1)}
          <b>+${Math.round((h.bonus || 0) * 100)} %</b>
        </li>`).join('');
    } else {
      const sources = it.sources.slice().sort((a, b) => b.x.avg - a.x.avg);
      const best = sources[0].x.avg || 1;
      rows = sources.map(({ m, x }, i) => `
        <li style="--ink:${escapeHtml(m.e.color || '#F2A32C')}">
          <span class="gd-rank-n">${i + 1}</span>
          <span class="gd-rank-head crisp" style="${bg(m.e.head)}"></span>
          <span class="gd-src-text">
            <a href="${animalHref(m.e.slug, 'loot')}">${escapeHtml(m.e.name)}</a>
            <small>${x.d.min === x.d.max ? x.d.min : x.d.min + '–' + x.d.max} par chasse${x.d.chance < 1 ? ' · ' + Math.round(x.d.chance * 100) + ' % de chance' : ''}${x.d.lootingBonus ? ' · Butin l’augmente' : ''}${m.spawnBiomes.length ? ' · ' + escapeHtml(m.spawnBiomes.map(OW.biomeName).join(', ')) : ''}</small>
          </span>
          ${pctBar(x.avg / best)}
          <b>≈ ${frNum(x.avg)}</b>
        </li>`).join('');
    }

    $('[data-gd-farm]').innerHTML = `
      <div class="gd-farm">
        <div class="gd-farm-list" role="listbox" aria-label="Ressources">
          ${list.map((r) => `
            <button type="button" class="gd-res${r.id === farmPick ? ' is-on' : ''}" data-res="${escapeHtml(r.id)}" role="option" aria-selected="${r.id === farmPick}">
              ${iconOf(r)}
              <span>${escapeHtml(r.name)}</span>
              ${r.uses ? `<small>${r.uses}</small>` : ''}
            </button>`).join('')}
        </div>
        <div class="gd-farm-detail">
          <header class="gd-farm-head">
            ${iconOf(it, 'gd-farm-ico')}
            <span class="stack" style="gap:4px">
              <b>${escapeHtml(it.name)}</b>
              <small>${it.harvest ? 'Se récolte, sans combat' : ''}${it.harvest && usedIn.length ? ' · ' : ''}${usedIn.length ? 'Sert à ' + plural(usedIn.length, 'recette') : (it.harvest ? '' : 'Aucune recette ne la demande')}</small>
            </span>
          </header>
          <ol class="gd-sources">${rows}</ol>
          ${usedIn.length ? `
            <div class="gd-uses">
              <span class="t-pixel">SERT À FABRIQUER</span>
              <span class="gd-items">${usedIn.slice(0, 8).map((r) => `<span class="gd-item" title="${escapeHtml(r.resultName)}">${icon(r.result)}<small>${escapeHtml(r.resultName)}</small></span>`).join('')}</span>
            </div>` : ''}
        </div>
      </div>`;
    if (OW.resolveImages) OW.resolveImages($('[data-gd-farm]'));
  }

  /* ======================================================================
     Demarrage
     ====================================================================== */

  mountHeader();

  loadWikiData()
    .then((data) => {
      /* Les recettes, indexees une fois : qui demande quoi. */
      const using = new Map();
      data.recipes.forEach((r) => {
        const seen = new Set();
        r.ingredients.forEach((ing) => {
          if (seen.has(ing.id)) return;
          seen.add(ing.id);
          if (!using.has(ing.id)) using.set(ing.id, []);
          using.get(ing.id).push(r);
        });
      });
      data.saddles.forEach((s) => s.needs.forEach((n) => n.items.forEach((id) => {
        if (!using.has(id)) using.set(id, []);
        using.get(id).push({ result: s.result, resultName: s.resultName, ingredients: [] });
      })));

      const hits = data.entities.map((e) => (e.stats && e.stats.damage ? e.stats.damage / CD.comboHits : 0)).filter(Boolean);
      const ctx = {
        refHit: hits.length ? hits.reduce((a, b) => a + b, 0) / hits.length : 3,
        usesOf: (id) => (using.get(id) || []).length,
        recipesUsing: (id) => using.get(id) || [],
        /* Les recettes qui demandent une buche, quelle qu'elle soit. */
        logRecipes: data.recipes.filter((r) => r.ingredients.some((ing) => /_log$|_wood$|:logs?$/.test(ing.id)))
      };

      const beasts = data.entities.filter((e) => !e.boss && e.traits && e.traits.tameable);
      const ms = beasts.map((e) => measure(e, ctx));
      const score = scorers(ms);

      const anchor = $('[data-gd-signs]');
      if (anchor && OW.heroSigns) {
        OW.heroSigns(anchor, [
          [beasts.length, 'À apprivoiser'],
          [data.biomes.length, 'Biomes'],
          [data.recipes.length, 'Recettes'],
          [data.levelCurve.max, 'Niveaux']
        ]);
        anchor.remove();
      }

      journey(data, ms, score);
      watchTrail();
      mountPicker(ms, score);
      renderAwards(ms);
      renderFarm(ms, ctx);

      document.addEventListener('click', (ev) => {
        const res = ev.target.closest('[data-res]');
        if (res) { farmPick = res.dataset.res; renderFarm(ms, ctx); }
      });

      if (OW.resolveImages) OW.resolveImages(document.querySelector('main'));
      mountFooter(data, 'VERSION ' + data.meta.version + ' · GUIDE DU DÉBUTANT');
      reveal();
    })
    .catch((error) => {
      console.error(error);
      $('[data-gd-journey]').innerHTML = '<p class="gd-empty">Les données du mod n’ont pas pu être chargées.</p>';
    });
}(window.OW = window.OW || {}));
