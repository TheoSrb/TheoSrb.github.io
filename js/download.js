/* La page Telecharger.

   - L'ouverture : le bouton de la derniere version, ce qu'il faut pour la
     faire tourner, et une pancarte de bois suspendue qui annonce la version,
     les tetes des creatures qui depassent de son bord.
   - L'installation en quatre etapes.
   - Les trois canaux (stable, experimentale, ancienne) : le principe de
     toujours, redessine.
   - Les nouveautes de la derniere version (son patch note), et l'historique
     de toutes les versions, range par version de Minecraft.
   - Les traductions livrees.

   Les versions viennent de data/releases.json (mode d'emploi en tete du
   fichier), completees des fichiers publies sur CurseForge (CFWidget). Rien
   n'est invente : sans patch note ecrit, la derniere version montre ce que
   contient l'export du mod. */

(function (OW) {
  'use strict';

  const { loadWikiData, escapeHtml, mountHeader, mountFooter, reveal, contrastInk, plural, bg } = OW;
  const $ = (s) => document.querySelector(s);

  const CURSEFORGE_ID = 1349902;
  const CF_CACHE = 'ow-cf-files';


  const CHANNEL = {
    release: { label: 'Stable', color: '#8A9A2E' },
    beta: { label: 'Bêta', color: '#F2A32C' },
    alpha: { label: 'Alpha', color: '#B84A38' }
  };

  const LINKS = {
    neoforge: 'https://neoforged.net/',
    terrablender: 'https://www.curseforge.com/minecraft/mc-mods/terrablender-neoforge',
    discord: 'https://discord.gg/TUUJHBwDdA'
  };

  /* ---- les versions ---------------------------------------------------------------- */

  function loadReleases() {
    return fetch('data/releases.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : { releases: [] }))
      .catch(() => ({ releases: [] }));
  }

  /* Les fichiers publies sur CurseForge. La page n'attend jamais l'API : elle
     s'affiche aussitot avec data/releases.json (et la derniere reponse gardee
     dans le navigateur, si elle existe), puis se complete quand l'API repond.
     Une reponse de moins d'une heure n'est pas redemandee. */
  function cachedCurseForge() {
    try {
      const cached = JSON.parse(localStorage.getItem(CF_CACHE) || 'null');
      return cached && Array.isArray(cached.files) ? cached : null;
    } catch (e) { return null; }
  }

  function fetchCurseForge() {
    const ctrl = window.AbortController ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), 10000);
    return fetch('https://api.cfwidget.com/' + CURSEFORGE_ID, ctrl ? { signal: ctrl.signal } : {})
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json || !json.files) return null;
        const files = json.files.map((f) => ({
          version: String(f.display || f.name || '').replace(/\.jar$/i, ''),
          label: f.display || f.name,
          channel: f.type === 'release' ? 'release' : (f.type === 'alpha' ? 'alpha' : 'beta'),
          minecraft: (f.versions || []).find((v) => /^1\.\d+(\.\d+)?$/.test(v)) || null,
          date: f.uploaded_at ? String(f.uploaded_at).slice(0, 10) : null,
          url: f.url || null,
          size: f.filesize || null,
          fromCurseForge: true
        }));
        try { localStorage.setItem(CF_CACHE, JSON.stringify({ files, at: Date.now() })); } catch (e) { /* rien */ }
        return files;
      })
      .catch(() => null)
      .finally(() => clearTimeout(timer));
  }

  /* Numero de version comparable : 0.0.10 passe apres 0.0.9. */
  const vkey = (v) => String(v || '').split(/[^\d]+/).filter(Boolean).map((n) => n.padStart(5, '0')).join('.');
  const mckey = (v) => vkey(v || '0');

  function mergeReleases(local, remote) {
    const byVersion = new Map();
    remote.forEach((r) => { if (r.version) byVersion.set(r.version, r); });
    local.forEach((r) => {
      if (!r || !r.version) return;
      const prev = byVersion.get(r.version) || {};
      byVersion.set(r.version, Object.assign({}, prev, r, { url: r.url || prev.url || null }));
    });
    return Array.from(byVersion.values())
      .sort((a, b) => (vkey(b.version) > vkey(a.version) ? 1 : -1));
  }

  function dateLabel(iso) {
    const t = Date.parse(iso);
    return isNaN(t) ? '' : new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const labelOf = (r) => r.label || r.version;

  /* ---- l'ouverture ---------------------------------------------------------------- */

  function renderVersion(latest, data, cfUrl) {
    if (latest) {
      $('[data-dl-kicker]').textContent = 'INSTALLATION · ' + labelOf(latest).toUpperCase();
      $('[data-dl-main-label]').textContent = labelOf(latest) + (latest.minecraft ? ' · Minecraft ' + latest.minecraft : '');
      $('[data-dl-main]').href = latest.url || cfUrl;
    }
    const tameable = data.entities.filter((e) => e.traits && e.traits.tameable).length;
    $('[data-dl-lead]').textContent = plural(tameable, 'créature') + ' à apprivoiser, à monter et à faire évoluer. '
      + 'Un fichier à déposer dans le dossier des mods, et la jungle est prête.';

    const req = latest ? [
      ['Minecraft', latest.minecraft],
      ['NeoForge', latest.neoforge],
      ['TerraBlender', latest.terrablender],
      ['Édition', 'Java']
    ].filter(([, v]) => v) : [];
    $('[data-dl-req]').innerHTML = req.map(([k, v]) => `
      <span class="dl-req-chip"><small>${escapeHtml(k)}</small><b>${escapeHtml(v)}</b></span>`).join('');
    $('[data-dl-sign-version]').textContent = latest ? labelOf(latest) : data.meta.version;
    $('[data-dl-sign-mc]').textContent = latest && latest.minecraft ? 'Minecraft ' + latest.minecraft : '';
  }

  /* Le reste de l'ouverture, pose une seule fois : les tetes qui depassent de
     la pancarte, les compteurs, le sursaut au survol. */
  function renderHero(latest, data, cfUrl) {
    renderVersion(latest, data, cfUrl);
    const heads = data.entities.filter((e) => !e.boss).slice(0, 7);
    $('[data-dl-heads]').innerHTML = heads.map((e, i) => `
      <i class="crisp" title="${escapeHtml(e.name)}"
         style="${bg(e.head)};--x:${(8 + i * (84 / Math.max(1, heads.length - 1))).toFixed(1)}%;--d:${(i * .37).toFixed(2)}s"></i>`).join('');

    const anchor = $('[data-dl-signs]');
    if (anchor && OW.heroSigns) {
      const skins = data.entities.reduce((s, e) => s + e.cosmetics.length, 0);
      OW.heroSigns(anchor, [
        [data.entities.length, 'Créatures'],
        [data.items.length, 'Objets'],
        [data.biomes.length, 'Biomes'],
        [skins, 'Skins']
      ]);
      anchor.remove();
    }

    /* Viser le bouton fait sursauter la pancarte : les betes se levent pour
       regarder, la fleche s'agite. */
    const sign = $('[data-dl-sign]');
    const hang = sign.querySelector('.dl-sign-hang');
    const arrow = sign.querySelector('.dl-sign-arrow');
    let awake = false;
    const wake = (on) => {
      if (on === awake) return;
      awake = on;
      sign.classList.toggle('is-awake', on);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      /* Le sursaut se joue par-dessus le balancement, qui ne s'arrete pas. */
      if (on && hang && hang.animate) {
        hang.animate([
          { transform: 'rotate(0deg)' }, { transform: 'rotate(-4deg)', offset: .3 },
          { transform: 'rotate(2.5deg)', offset: .6 }, { transform: 'rotate(0deg)' }
        ], { duration: 700, easing: 'cubic-bezier(.34, 1.56, .64, 1)' });
      }
      /* La fleche s'agite : la meme animation, plus vite, sans repartir de zero. */
      if (arrow) arrow.getAnimations().forEach((a) => a.updatePlaybackRate(on ? 1.4 / .6 : 1));
    };
    [$('[data-dl-main]'), sign].forEach((el) => {
      el.addEventListener('pointerenter', () => wake(true));
      el.addEventListener('pointerleave', () => wake(false));
      el.addEventListener('focus', () => wake(true));
      el.addEventListener('blur', () => wake(false));
    });
  }

  /* ---- l'installation ----------------------------------------------------------------- */

  function renderSteps(latest) {
    const mc = latest && latest.minecraft ? latest.minecraft : '1.21.1';
    const nf = latest && latest.neoforge ? latest.neoforge : '';
    const tb = latest && latest.terrablender ? latest.terrablender : '';
    const steps = [
      { title: 'Installer NeoForge', text: `Le chargeur de mods, en version ${nf || 'recommandée'} pour Minecraft ${mc} (édition Java). L'installateur se lance en mode « client ».`,
        link: [LINKS.neoforge, 'Site de NeoForge'], icon: 'assets/tools/ruby_pickaxe.png' },
      { title: 'Ajouter TerraBlender', text: `La dépendance obligatoire${tb ? ', en version ' + tb : ''} : c'est elle qui glisse les biomes du mod dans la génération du monde.`,
        link: [LINKS.terrablender, 'TerraBlender'], icon: 'assets/block/lavender.png' },
      { title: 'Déposer Operation W.I.L.D', text: 'Le fichier .jar du mod et celui de TerraBlender se placent dans le dossier « mods » de l’installation Minecraft.',
        icon: 'assets/tools/jade_shovel.png' },
      { title: 'Lancer et explorer', text: 'Le profil NeoForge démarré, un nouveau monde ouvre la rencontre avec les créatures. En multijoueur, le serveur a besoin des mêmes fichiers.',
        icon: 'assets/ui/animal.png' }
    ];
    $('[data-dl-steps]').innerHTML = steps.map((s, i) => `
      <li class="dl-step" style="--i:${i}" data-reveal>
        <span class="dl-step-num" aria-hidden="true">${i + 1}</span>
        <span class="dl-step-icon crisp" aria-hidden="true" style="${bg(s.icon)}"></span>
        <b class="dl-step-title">${escapeHtml(s.title)}</b>
        <p class="dl-step-text">${escapeHtml(s.text)}</p>
        ${s.link ? `<a class="link-arrow" href="${s.link[0]}" target="_blank" rel="noopener">${escapeHtml(s.link[1])}</a>` : ''}
      </li>`).join('');
  }

  /* ---- les canaux ------------------------------------------------------------------------ */

  function renderChannels(releases, data, cfUrl) {
    const stable = releases.find((r) => r.channel === 'release') || releases[0] || null;
    const experimental = releases.find((r) => r.channel === 'alpha') || null;
    const older = releases.filter((r) => r !== stable && r !== experimental);
    const cards = [
      {
        key: 'stable', title: 'Stable', tag: 'RECOMMANDÉE', color: '#8A9A2E', featured: true,
        version: stable ? labelOf(stable) : '—',
        text: 'La version jouable du mod : ' + plural(data.entities.length, 'créature') + ', la Piste Sauvage, les selles, les tribus et les biomes.',
        rows: stable ? [['Minecraft', stable.minecraft], ['NeoForge', stable.neoforge], ['Publiée', stable.date ? dateLabel(stable.date) : null]] : [],
        action: stable ? ['Télécharger', stable.url || cfUrl] : null
      },
      {
        key: 'experimental', title: 'Expérimentale', tag: 'INSTABLE', color: '#F2A32C',
        version: experimental ? labelOf(experimental) : 'Dernière build',
        text: 'La branche de développement : les créatures en chantier y arrivent en premier. Les sauvegardes peuvent casser : une copie du monde est recommandée.',
        rows: [['Sauvegardes', 'À risque'], ['Mises à jour', 'Fréquentes']],
        /* Libre, sans rien demander : le fichier de la version alpha s'il est
           renseigne, sinon la liste de tous les fichiers sur CurseForge. */
        action: ['Télécharger', experimental && experimental.url ? experimental.url : cfUrl.replace(/\/$/, '') + '/files']
      },
      {
        key: 'archive', title: 'Ancienne', tag: 'ARCHIVE', color: '#8A817C',
        version: older.length ? plural(older.length, 'version') : 'Aucune',
        text: 'Les fichiers précédents, gardés pour les mondes déjà lancés. Plus aucun correctif.',
        rows: [['Support', 'Aucun'], ['Compatibilité', 'Partielle']],
        action: older.length ? ['Voir l’historique', '#dl-history'] : null
      }
    ];
    $('[data-dl-channels]').innerHTML = cards.map((c, i) => `
      <article class="dl-channel${c.featured ? ' is-featured' : ''}" style="--c:${c.color};--c-ink:${contrastInk(c.color)};--i:${i}" data-reveal>
        <span class="dl-channel-tag">${escapeHtml(c.tag)}</span>
        <b class="dl-channel-title">${escapeHtml(c.title)}</b>
        <span class="dl-channel-version">${escapeHtml(c.version)}</span>
        <p>${escapeHtml(c.text)}</p>
        <dl class="dl-channel-rows">
          ${c.rows.filter(([, v]) => v).map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}
        </dl>
        ${c.action
          ? `<a class="btn${c.featured ? ' btn-accent' : ''} dl-channel-action" href="${escapeHtml(c.action[1])}"
               ${/^https?:/.test(c.action[1]) ? 'target="_blank" rel="noopener"' : ''}>${escapeHtml(c.action[0])}</a>`
          : '<span class="dl-channel-none">Rien à télécharger pour l’instant</span>'}
      </article>`).join('');
  }

  /* ---- le patch note ---------------------------------------------------------------------- */

  const NOTE_KINDS = [
    { key: 'added', label: 'Ajouts', icon: 'up', color: '#9BC53D' },
    { key: 'changed', label: 'Modifications', icon: 'note', color: '#F2A32C' },
    { key: 'fixed', label: 'Corrections', icon: 'check', color: '#6FA3C8' }
  ];

  /* Sans patch note ecrit, ce que contient la version, d'apres l'export. */
  function contentsOf(data) {
    const beasts = data.entities.filter((e) => !e.boss).map((e) => e.name);
    const skins = data.entities.reduce((s, e) => s + e.cosmetics.length, 0);
    const added = [
      plural(beasts.length, 'créature') + ' à apprivoiser et à monter : ' + beasts.join(', ') + '.',
      plural(data.items.length, 'objet') + ' et ' + plural(data.blocks.length, 'bloc') + ', dont ' + plural(data.recipes.length, 'recette') + '.',
      plural(data.biomes.length, 'biome') + ' générés avec TerraBlender.',
      plural(skins, 'skin') + ' de créature à débloquer.',
      'La Piste Sauvage, ' + plural(data.levelCurve.max, 'niveau') + ' par créature, et ' + plural(data.quests.length, 'quête') + ' quotidiennes.'
    ];
    if (data.tribes && data.tribes.overview) added.push('Les tribus : bannière, rangs, réputation, arène et coffres.');
    return { added };
  }

  function renderNotes(latest, data) {
    if (!latest) { $('[data-dl-notes]').innerHTML = ''; return; }
    const written = latest.notes && NOTE_KINDS.some((k) => (latest.notes[k.key] || []).length);
    const notes = written ? latest.notes : contentsOf(data);
    $('[data-dl-notes-title]').textContent = written ? 'Ce qui change en ' + labelOf(latest) : 'Ce que contient la ' + labelOf(latest);
    const kinds = NOTE_KINDS.filter((k) => (notes[k.key] || []).length);
    $('[data-dl-notes]').innerHTML = `
      <div class="dl-notes" data-reveal>
        <header class="dl-notes-head">
          <span class="dl-notes-version">${escapeHtml(labelOf(latest))}</span>
          <span class="dl-notes-meta">
            ${latest.minecraft ? `<span>Minecraft ${escapeHtml(latest.minecraft)}</span>` : ''}
            ${latest.date ? `<span>${escapeHtml(dateLabel(latest.date))}</span>` : ''}
            ${written ? '' : '<span>Contenu lu dans l’export du mod</span>'}
          </span>
        </header>
        <div class="dl-notes-cols" style="--n:${kinds.length}">
          ${kinds.map((k) => `
            <section class="dl-notes-col" style="--k:${k.color}">
              <h3>${OW.icon ? OW.icon(k.icon) : ''}${escapeHtml(k.label)}<span>${notes[k.key].length}</span></h3>
              <ul>${notes[k.key].map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
            </section>`).join('')}
        </div>
      </div>`;
  }

  /* ---- l'historique ------------------------------------------------------------------------- */

  function renderHistory(releases, cfUrl) {
    const host = $('[data-dl-history]');
    host.id = 'dl-history';
    if (!releases.length) {
      host.innerHTML = '<p class="t-small">Aucune version publiée pour l’instant.</p>';
      return;
    }
    const groups = new Map();
    releases.forEach((r) => {
      const mc = r.minecraft || 'Autre';
      if (!groups.has(mc)) groups.set(mc, []);
      groups.get(mc).push(r);
    });
    const order = Array.from(groups.keys()).sort((a, b) => (mckey(b) > mckey(a) ? 1 : -1));
    host.innerHTML = order.map((mc, gi) => {
      const list = groups.get(mc);
      return `
        <details class="dl-mc" ${gi === 0 ? 'open' : ''} data-reveal>
          <summary>
            <span class="dl-mc-block crisp" aria-hidden="true" style="${bg('assets/block/jade_ore.png')}"></span>
            <b>Minecraft ${escapeHtml(mc)}</b>
            <span class="dl-mc-count">${plural(list.length, 'version')}</span>
            <span class="dl-mc-chev" aria-hidden="true"></span>
          </summary>
          <ol class="dl-rel-list">
            ${list.map((r, i) => {
              const ch = CHANNEL[r.channel] || CHANNEL.beta;
              const hasNotes = r.notes && NOTE_KINDS.some((k) => (r.notes[k.key] || []).length);
              return `
                <li class="dl-rel${gi === 0 && i === 0 ? ' is-latest' : ''}">
                  <span class="dl-rel-version">${escapeHtml(labelOf(r))}</span>
                  <span class="dl-rel-chip" style="--c:${ch.color};--c-ink:${contrastInk(ch.color)}">${escapeHtml(ch.label)}</span>
                  ${gi === 0 && i === 0 ? '<span class="dl-rel-chip is-new">Dernière</span>' : ''}
                  <span class="dl-rel-meta">
                    ${r.date ? `<span>${escapeHtml(dateLabel(r.date))}</span>` : ''}
                    ${r.neoforge ? `<span>NeoForge ${escapeHtml(r.neoforge)}</span>` : ''}
                    ${r.terrablender ? `<span>TerraBlender ${escapeHtml(r.terrablender)}</span>` : ''}
                  </span>
                  <a class="btn dl-rel-get" href="${escapeHtml(r.url || cfUrl)}" target="_blank" rel="noopener">Télécharger</a>
                  ${hasNotes ? `
                    <details class="dl-rel-notes">
                      <summary>Notes de version</summary>
                      ${NOTE_KINDS.filter((k) => (r.notes[k.key] || []).length).map((k) => `
                        <p style="--k:${k.color}"><b>${escapeHtml(k.label)}</b></p>
                        <ul>${r.notes[k.key].map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`).join('')}
                    </details>` : ''}
                </li>`;
            }).join('')}
          </ol>
        </details>`;
    }).join('');
  }

  /* ---- demarrage -------------------------------------------------------------------------------- */

  mountHeader();

  Promise.all([loadWikiData(), loadReleases()])
    .then(([data, file]) => {
      const cfUrl = file.curseforge || 'https://www.curseforge.com/minecraft/mc-mods/operation-w-i-l-d';
      const local = file.releases || [];
      const cached = cachedCurseForge();
      let shown = '';

      /* Tout ce qui depend de la liste des versions : rejoue si CurseForge
         apporte du nouveau. */
      const paint = (remote, first) => {
        const releases = mergeReleases(local, remote || []);
        const key = JSON.stringify(releases);
        if (key === shown) return;
        shown = key;
        const latest = releases[0] || null;
        if (first) renderHero(latest, data, cfUrl); else renderVersion(latest, data, cfUrl);
        renderSteps(latest);
        renderChannels(releases, data, cfUrl);
        renderNotes(latest, data);
        renderHistory(releases, cfUrl);
        if (first) {
          mountFooter(data, 'VERSION ' + (latest ? labelOf(latest) : data.meta.version).toUpperCase() + ' · '
            + plural(Object.keys(data.meta.languages).length, 'LANGUE').toUpperCase());
        }
        /* Les blocs redessines s'animent a leur tour (seuls les nouveaux sont armes). */
        reveal();
      };

      paint(cached && cached.files, true);
      if (!cached || Date.now() - cached.at > 3600e3) {
        fetchCurseForge().then((files) => { if (files) paint(files, false); });
      }
    })
    .catch((error) => {
      console.error(error);
      $('[data-dl-lead]').textContent =
        "Les données du mod n'ont pas pu être chargées. Le lien de téléchargement, lui, fonctionne toujours.";
    });
}(window.OW = window.OW || {}));
