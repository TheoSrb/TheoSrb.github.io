/* La recherche du wiki — Ctrl/⌘ + K, ou « / ».

   Tout le site en une fenetre : les creatures et chaque chapitre de leur
   fiche, leurs capacites, les objets, les blocs, les selles, les skins, les
   biomes, les quetes, les succes, les passifs de la Piste, les archetypes, les
   pages et les onglets du simulateur, et des actions (une creature au hasard,
   le theme, la langue).

   La recherche :
     - insensible aux accents et a la casse ;
     - par mots, dans n'importe quel ordre (« piste tigre ») ;
     - tolerante : un mot mal tape retrouve encore son resultat (« tgire ») ;
     - classee : le nom avant le contexte, le debut d'un mot avant le milieu,
       les favoris et les resultats deja ouverts un peu devant ;
     - bilingue : le nom francais et le nom traduit sont cherches tous deux.

   La fenetre, dans son habit « Safari » : de larges bandes illustrees, le
   rendu de la bete pose au bout de sa ligne et coupe par le bord.
     - des familles a cocher (Tab pour passer de l'une a l'autre) ;
     - les resultats groupes, le mot cherche surligne ;
     - un apercu a droite (image, chiffres, raccourcis) ;
     - l'historique et les favoris quand le champ est vide ;
     - fleches, Entree, Echap ; tout reste utilisable a la souris et au doigt. */

(function (OW) {
  'use strict';

  const esc = (v) => (OW.escapeHtml ? OW.escapeHtml(v) : String(v == null ? '' : v));
  const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = (s) => (OW.t ? OW.t(s) : s);
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const RECENT_KEY = 'ow-search-recent';
  /* ===========================================================================
     Familles
     =========================================================================== */

  const KINDS = {
    action: { label: 'Action', plural: 'Actions', color: '#9BE04A', order: 0 },
    creature: { label: 'Créature', plural: 'Créatures', color: '#F2A32C', order: 1 },
    boss: { label: 'Boss', plural: 'Boss', color: '#D8413A', order: 1.5 },
    section: { label: 'Chapitre', plural: 'Chapitres de fiche', color: '#9BC53D', order: 2 },
    ability: { label: 'Capacité', plural: 'Capacités', color: '#D17948', order: 3 },
    item: { label: 'Objet', plural: 'Objets', color: '#A9B84A', order: 4 },
    block: { label: 'Bloc', plural: 'Blocs', color: '#B07A45', order: 5 },
    saddle: { label: 'Selle', plural: 'Selles', color: '#C08A4A', order: 6 },
    skin: { label: 'Skin', plural: 'Skins', color: '#BA7FD4', order: 7 },
    biome: { label: 'Biome', plural: 'Biomes', color: '#4FB58A', order: 8 },
    quest: { label: 'Quête', plural: 'Quêtes', color: '#F5C842', order: 9 },
    achievement: { label: 'Succès', plural: 'Succès', color: '#FFD489', order: 10 },
    passive: { label: 'Passif', plural: 'Passifs de la Piste', color: '#3AB0D8', order: 11 },
    archetype: { label: 'Archétype', plural: 'Archétypes', color: '#E0654F', order: 12 },
    page: { label: 'Page', plural: 'Pages et onglets', color: '#E6E1D4', order: 13 }
  };

  const SCOPES = [
    { key: 'all', label: 'Tout', kinds: null },
    { key: 'creature', label: 'Créatures', kinds: ['creature', 'boss', 'section'] },
    { key: 'ability', label: 'Capacités', kinds: ['ability', 'passive'] },
    { key: 'item', label: 'Objets', kinds: ['item', 'block', 'saddle'] },
    { key: 'skin', label: 'Skins', kinds: ['skin'] },
    { key: 'world', label: 'Monde', kinds: ['biome'] },
    { key: 'progress', label: 'Progression', kinds: ['quest', 'achievement', 'archetype'] },
    { key: 'page', label: 'Pages', kinds: ['page', 'action'] }
  ];

  const CHAPTERS = [
    ['stats', 'Statistiques', 'stats statistiques pv degats vitesse chiffres'],
    ['abilities', 'Capacités', 'capacites attaques combo ultime secondaire cartes'],
    ['taming', 'Apprivoisement', 'apprivoisement apprivoiser nourriture selle dompter'],
    ['spawn', 'Apparition', 'apparition spawn biomes territoire ou trouver'],
    ['wild', 'Comportements sauvages', 'comportements goals ia instinct reactions'],
    ['journal', 'Journal', 'journal lore histoire manuscrit'],
    ['variants', 'Variantes', 'variantes couleurs naturelles'],
    ['loot', 'Butin', 'butin loot drop recompenses'],
    ['trail', 'Piste Sauvage', 'piste sauvage arbre progression noeuds'],
    ['cosmetics', 'Skins', 'skins cosmetiques apparences'],
    ['sounds', 'Sons', 'sons bruits audio ecouter cris'],
    ['animations', 'Animations', 'animations gif mouvements']
  ];

  /* ===========================================================================
     Index
     =========================================================================== */

  function row(kind, o) {
    const r = Object.assign({ kind, alt: [], keywords: '', hint: '', icon: null, pixel: true }, o);
    r.color = r.color || KINDS[kind].color;
    const names = [r.name].concat(r.alt || []).filter(Boolean);
    r.names = names.filter((n, i) => names.indexOf(n) === i);
    r.fNames = r.names.map(fold);
    r.fKeys = fold(r.keywords + ' ' + r.hint);
    r.fRequire = r.requireAny ? r.requireAny.map(fold) : null;
    return r;
  }

  const both = (fr) => { const tr = t(fr); return tr && tr !== fr ? [tr] : []; };

  function loadScript(src, test) {
    if (test()) return Promise.resolve();
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  function buildIndex(data) {
    const rows = [];
    const readable = OW.readableId || ((id) => String(id).replace(/^.*:/, '').replace(/_/g, ' '));
    const itemIcon = (id) => (OW.itemCandidates ? OW.itemCandidates(id) : [OW.itemSprite(id).src]);

    /* ---- actions ---------------------------------------------------------------- */
    rows.push(row('action', {
      name: 'Créature au hasard', hint: 'Touche R', keywords: 'aleatoire random hasard surprise explorer de',
      icon: 'assets/ui/animal.png', pixel: false, run: () => OW.randomCreature && OW.randomCreature()
    }));
    rows.push(row('action', {
      name: 'Changer de thème', hint: 'Clair / sombre', keywords: 'theme clair sombre nuit jour mode dark light',
      glyph: 'theme', run: () => { if (OW.toggleTheme) OW.toggleTheme(); document.dispatchEvent(new CustomEvent('ow:themepainted')); }
    }));
    rows.push(row('action', {
      name: 'Mes favoris', hint: 'Les créatures étoilées', keywords: 'favoris etoile star prefere',
      glyph: 'star', href: 'creatures.html?filter=fav'
    }));
    if (OW.i18n) {
      OW.i18n.LANGS.forEach((l) => rows.push(row('action', {
        name: 'Langue : ' + l.name, alt: [l.name], hint: l.region, keywords: 'langue language idioma lingua язык traduction ' + l.code,
        glyph: 'lang', badge: l.code.toUpperCase(), run: () => OW.i18n.setLanguage(l.code)
      })));
    }

    /* ---- pages et onglets ------------------------------------------------------------ */
    [
      ['Accueil', 'index.html', 'accueil home bestiaire', 'assets/logo.png'],
      ['Créatures', 'creatures.html', 'creatures bestiaire dictionnaire animaux', 'assets/ui/animal.png'],
      ['Biomes', 'biomes.html', 'biomes monde spawn apparition structures', 'assets/biomes/redwood_forest.png'],
      ['Objets', 'items.html', 'objets items blocs outils armures recettes craft', 'assets/ui/tools.png'],
      ['Boss', 'bosses.html', 'boss bosses zone interdite danger arene menace', 'assets/ui/animal.png'],
      ['Cosmétiques', 'cosmetics.html', 'cosmetiques skins vitrine apparences', 'assets/ui/skins.png'],
      ['Mécaniques', 'simulator.html', 'mecaniques simulateur outils combat piste quetes succes tribus', 'assets/tools/ruby_sword.png'],
      ['Musiques', 'music.html', 'musiques bande son theme sons', 'assets/ui/red_panda_music.png'],
      ['Télécharger', 'download.html', 'telecharger download installer mod neoforge', 'assets/logo.png']
    ].forEach(([name, href, keys, icon]) => rows.push(row('page', { name, href, keywords: keys, icon, pixel: false, hint: href })));
    [
      ['Combat', 'combat', 'combat arene comparer duel simulateur', 'assets/tools/ruby_sword.png'],
      ['Piste Sauvage', 'trail', 'piste sauvage arbre planificateur noeuds', 'assets/ui/prestige_points.png'],
      ['Archétypes & niveaux', 'stats', 'archetypes niveaux xp courbe multiplicateurs', 'assets/ui/animal.png'],
      ['Quêtes quotidiennes', 'quests', 'quetes quotidiennes pieces recompenses', 'assets/ui/coins/coin_3.png'],
      ['Succès', 'achievements', 'succes progres advancements trophees debloquer', 'assets/ui/taming_exp.png'],
      ['Tribus', 'tribes', 'tribus clan equipe guilde', 'assets/ui/tab-banner.png']
    ].forEach(([name, hash, keys, icon]) => rows.push(row('page', {
      name, href: 'simulator.html#' + hash, keywords: keys, icon, pixel: /exp|coin|prestige|animal/.test(icon) ? false : true,
      hint: 'Mécaniques › ' + name
    })));

    /* ---- creatures, chapitres, capacites --------------------------------------------- */
    const favs = OW.favorites ? OW.favorites.list() : [];
    data.entities.forEach((e) => {
      const color = e.boss ? '#B84A38' : (e.color || '#F2A32C');
      const biomes = e.spawn ? e.spawn.biomes.map((id) => readable(id) + ' ' + biomeName(id)).join(' ') : '';
      rows.push(row('creature', {
        name: e.name, alt: both(e.name), slug: e.slug, color,
        hint: [e.archetype ? e.archetype.name : '', e.stats.hp ? Math.round(e.stats.hp) + ' PV' : ''].filter(Boolean).join(' · '),
        keywords: [e.slug, e.id, e.family, e.diet && e.diet.name, e.temperament, biomes, e.boss ? 'boss' : '', e.traits.tameable ? 'apprivoisable' : ''].join(' '),
        href: OW.animalHref(e.slug), icon: e.head, art: e.art, entity: e, boost: favs.indexOf(e.slug) !== -1 ? 14 : 0
      }));
      CHAPTERS.forEach(([hash, label, keys]) => rows.push(row('section', {
        name: e.name + ' › ' + label, alt: both(label).map((l) => t(e.name) + ' › ' + l), color,
        hint: 'Chapitre de la fiche', keywords: e.slug + ' ' + keys, requireAny: keys.split(' ').concat(fold(label).split(' '), fold(t(label)).split(' ')),
        href: OW.animalHref(e.slug, hash), icon: e.head, art: e.art, entity: e, chapter: label
      })));
      /* Une capacite se montre par SA carte : la planche carree que le mod
         dessine pour elle, dans la case comme dans le grand visuel au bout de
         la ligne. Jamais la tete de la bete — c'est la capacite qu'on cherche,
         pas l'espece. Un passif n'a pas de planche : il prend le sigil de sa
         famille, pas un portrait. */
      e.cards.forEach((c) => {
        const art = OW.attackCard(e.slug, c);
        rows.push(row('ability', {
          name: c.title, alt: both(c.title), color,
          hint: e.name + (c.roleLabel ? ' · ' + c.roleLabel : ''),
          keywords: e.slug + ' ' + e.name + ' ' + (c.roleLabel || '') + ' ' + c.description,
          href: OW.animalHref(e.slug, 'abilities'),
          candidates: art ? [art] : null,
          glyph: art ? null : 'bolt',
          card: c, art, entity: e
        }));
      });
    });

    /* ---- les boss (bosses.html) : a part des creatures, comme dans data --------------- */
    (data.bosses || []).forEach((e) => {
      rows.push(row('boss', {
        name: e.name, alt: both(e.name), slug: e.slug,
        hint: ['Boss', e.stats.hp ? Math.round(e.stats.hp) + ' PV' : ''].filter(Boolean).join(' · '),
        keywords: [e.slug, e.id, e.family, 'boss arene danger menace musique theme'].join(' '),
        href: 'bosses.html#boss-' + e.slug, icon: e.art, pixel: false, art: e.art, entity: e
      }));
    });

    /* ---- objets, blocs, selles ------------------------------------------------------- */
    data.items.forEach((i) => rows.push(row('item', {
      name: i.name, alt: both(i.name), hint: i.id,
      keywords: [i.path, i.rarity, i.className].join(' '),
      href: 'items.html#' + i.path, candidates: itemIcon(i.id), item: i
    })));
    data.blocks.forEach((b) => {
      if (!b.name) return;
      const path = String(b.id).replace(/^.*:/, '');
      rows.push(row('block', {
        name: b.name, alt: both(b.name), hint: b.id, keywords: path + ' ' + b.className,
        href: 'items.html#bloc-' + path, block: b, path,
        candidates: ['assets/block/' + path + '.png', 'assets/block/' + path + '_side.png', 'assets/block/' + path + '_stage3.png', 'assets/item/' + path + '.png', 'assets/ui/mineral.png']
      }));
    });
    data.saddles.forEach((s) => rows.push(row('saddle', {
      name: s.resultName, alt: both(s.resultName), color: s.accent || KINDS.saddle.color,
      hint: s.entityName + ' · seuil ' + s.threshold + ' XP', keywords: 'selle saddle ' + s.id + ' ' + s.entityName,
      href: 'items.html#' + String(s.result).replace(/^.*:/, ''), candidates: itemIcon(s.result), saddle: s
    })));

    /* ---- skins ----------------------------------------------------------------------- */
    (OW.SKINS || []).forEach((s) => {
      const rarity = OW.RARITY && OW.RARITY[s.rarity];
      const owner = data.entities.find((e) => e.slug === s.entity);
      rows.push(row('skin', {
        name: s.name, alt: both(s.name), color: rarity ? rarity.color : KINDS.skin.color,
        hint: (rarity ? rarity.label : '') + (owner ? ' · ' + owner.name : ''),
        keywords: [s.id, s.entity, s.rarity, s.unlock, s.lore].join(' '),
        href: 'cosmetics.html?skin=' + encodeURIComponent(s.id), icon: s.image, art: s.image, pixel: false, skin: s, rarity
      }));
    });

    /* ---- biomes ------------------------------------------------------------------------ */
    const residents = (id) => data.entities.filter((e) => e.spawn && e.spawn.biomes.indexOf(id) !== -1);
    data.biomes.forEach((b) => {
      const who = residents(b.id);
      const hasFiche = b.id === 'ow:redwood_forest';
      rows.push(row('biome', {
        name: biomeName(b.id), alt: both(biomeName(b.id)), hint: b.id + ' · biome du mod',
        keywords: [b.id, b.constant, who.map((e) => e.name).join(' '), 'mod'].join(' '),
        href: hasFiche ? 'biome.html?b=' + encodeURIComponent(b.id.replace(/^.*:/, '')) : 'biomes.html',
        icon: hasFiche ? 'assets/biomes/redwood_forest.png' : null, art: hasFiche ? 'assets/biomes/redwood_forest.png' : null,
        glyph: hasFiche ? null : 'biome', pixel: false, biome: b, residents: who
      }));
    });
    /* Les biomes vanilla (jungle, marais...) n'ont ni page ni carte sur le
       site : pas de ligne a eux. Chercher « jungle » trouve quand meme les
       betes qui y vivent (leurs biomes sont dans leurs mots-cles). */

    /* ---- progression ------------------------------------------------------------------ */
    data.quests.forEach((q) => rows.push(row('quest', {
      name: q.name, alt: both(q.name), color: q.color,
      /* La recompense depend du palier (orbes d'XP ou pieces, tires au hasard) :
         l'onglet Quetes de Mecaniques la detaille. */
      hint: 'Palier ' + q.tier + ' · quête quotidienne', keywords: 'quete quotidienne ' + q.id + ' palier ' + q.tier,
      href: 'simulator.html#quests', icon: { I: 'assets/ui/exp/exp.png', II: 'assets/ui/exp/exp_2.png', III: 'assets/ui/exp/exp_3.png' }[q.tier] || 'assets/ui/exp/exp.png', quest: q
    })));
    data.advancements.forEach((a) => {
      if (!a.title) return;
      const owner = data.entities.find((e) => e.slug === a.slug);
      rows.push(row('achievement', {
        name: a.title, alt: both(a.title), hint: a.description,
        keywords: [a.id, a.constant, 'succes progres advancement', owner ? owner.name + ' ' + owner.slug : ''].join(' '),
        href: 'simulator.html#achievements', icon: owner ? owner.head : 'assets/ui/taming_exp.png',
        art: owner ? owner.art : null, pixel: true, advancement: a, entity: owner
      }));
    });
    data.pistePassives.forEach((p) => rows.push(row('passive', {
      name: p.name, alt: both(p.name), hint: p.description, keywords: 'passif piste sauvage capacite',
      href: 'simulator.html#trail', icon: 'assets/ui/energy.png', art: 'assets/ui/energy.png', passive: p
    })));
    data.archetypes.forEach((a) => {
      const kin = data.entities.filter((e) => e.archetype && e.archetype.name === a.name);
      rows.push(row('archetype', {
        name: a.name.charAt(0) + a.name.slice(1).toLowerCase(), hint: 'PV ×' + a.hp + ' · dégâts ×' + a.damage,
        keywords: 'archetype ' + a.name + ' ' + kin.map((e) => e.name).join(' '),
        href: 'simulator.html#stats', icon: OW.archetypeIcon ? OW.archetypeIcon(a.name) : null,
        art: kin.length ? kin[0].art : null, archetype: a
      }));
    });

    return rows;
  }

  function biomeName(id) {
    return OW.biomeName ? OW.biomeName(id) : String(id).replace(/^.*:/, '').replace(/_/g, ' ');
  }

  /* ===========================================================================
     Classement
     =========================================================================== */

  /** Sous-sequence : « tgire » dans « tigre » ? Renvoie un score, ou 0. */
  function fuzzy(token, text) {
    if (token.length < 3) return 0;
    let ti = 0, gaps = 0, last = -1;
    for (let i = 0; i < text.length && ti < token.length; i++) {
      if (text[i] === token[ti]) {
        if (last >= 0 && i - last > 1) gaps += i - last - 1;
        last = i;
        ti++;
      }
    }
    if (ti === token.length) return Math.max(4, 26 - gaps * 3);
    /* Deux lettres inversees (« tgire ») : on tente la transposition. */
    for (let i = 0; i < token.length - 1; i++) {
      const swapped = token.slice(0, i) + token[i + 1] + token[i] + token.slice(i + 2);
      if (text.indexOf(swapped) !== -1) return 22;
    }
    return 0;
  }

  function tokenScore(token, r) {
    let best = 0;
    for (let n = 0; n < r.fNames.length; n++) {
      const name = r.fNames[n];
      if (name === token) best = Math.max(best, 120);
      else if (name.indexOf(token) === 0) best = Math.max(best, 90);
      else if (new RegExp('(^|[\\s\\-\'’›·(])' + token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(name)) best = Math.max(best, 72);
      else if (name.indexOf(token) !== -1) best = Math.max(best, 48);
      else best = Math.max(best, fuzzy(token, name));
    }
    if (best < 40 && r.fKeys.indexOf(token) !== -1) best = Math.max(best, 30);
    return best;
  }

  function search(rows, query, scope, context) {
    const q = fold(query).trim();
    const allowed = scope && scope.kinds;
    const pool = allowed ? rows.filter((r) => allowed.indexOf(r.kind) !== -1) : rows;
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    const out = [];
    for (let i = 0; i < pool.length; i++) {
      const r = pool[i];
      if (r.fRequire && !tokens.some((tk) => r.fRequire.some((w) => w && (w.indexOf(tk) === 0 || tk.indexOf(w) === 0)))) continue;
      let total = 0;
      let ok = true;
      for (let k = 0; k < tokens.length; k++) {
        const s = tokenScore(tokens[k], r);
        if (!s) { ok = false; break; }
        total += s;
      }
      if (!ok) continue;
      total += (r.boost || 0) + (context.recent[r.href] ? 8 : 0) - KINDS[r.kind].order * .6 - r.name.length * .05;
      out.push({ r, score: total });
    }
    out.sort((a, b) => b.score - a.score);
    return out.map((o) => o.r);
  }

  /** Le nom avec les passages trouves entoures de <mark>. */
  function highlight(name, query) {
    const tokens = fold(query).trim().split(/\s+/).filter((tk) => tk.length > 0);
    if (!tokens.length) return esc(name);
    /* Le nom plie garde la meme longueur que l'original, lettre par lettre. */
    const chars = Array.from(name);
    const folded = chars.map((c) => fold(c) || c);
    const flat = folded.join('');
    const mask = new Array(chars.length).fill(false);
    const offsets = [];
    let pos = 0;
    folded.forEach((f) => { offsets.push(pos); pos += f.length; });
    tokens.forEach((tk) => {
      let at = flat.indexOf(tk);
      while (at !== -1) {
        for (let i = 0; i < chars.length; i++) {
          if (offsets[i] >= at && offsets[i] < at + tk.length) mask[i] = true;
        }
        at = flat.indexOf(tk, at + tk.length);
      }
    });
    let html = '';
    let open = false;
    chars.forEach((c, i) => {
      if (mask[i] && !open) { html += '<mark>'; open = true; }
      if (!mask[i] && open) { html += '</mark>'; open = false; }
      html += esc(c);
    });
    if (open) html += '</mark>';
    return html;
  }

  /** Le nom le plus proche, pour « Vouliez-vous dire… ». */
  function closest(rows, query) {
    const q = fold(query).trim();
    if (q.length < 3) return null;
    const lev = (a, b) => {
      const m = a.length, n = b.length;
      const d = Array.from({ length: m + 1 }, (_, i) => [i]);
      for (let j = 1; j <= n; j++) d[0][j] = j;
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
      }
      return d[m][n];
    };
    let best = null, bestD = Infinity;
    rows.forEach((r) => {
      if (r.kind === 'section' || r.kind === 'action') return;
      r.fNames.forEach((n, idx) => {
        const cmp = n.slice(0, Math.max(q.length + 2, 4));
        const dist = lev(q, cmp);
        if (dist < bestD) { bestD = dist; best = r.names[idx]; }
      });
    });
    return bestD <= Math.max(2, Math.floor(q.length / 3)) ? best : null;
  }

  /* ===========================================================================
     Historique
     =========================================================================== */

  function readRecent() {
    try {
      const list = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(list) ? list.slice(0, 8) : [];
    } catch (e) { return []; }
  }
  function pushRecent(r) {
    if (!r.href) return;
    const list = readRecent().filter((x) => x.href !== r.href);
    list.unshift({ href: r.href, name: r.name, kind: r.kind, icon: r.icon || null, color: r.color });
    try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8))); } catch (e) { /* rien */ }
  }

  /* ===========================================================================
     Glyphes
     =========================================================================== */

  const GLYPH = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4.5-4.5"></path></svg>',
    theme: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 1h4v1h2v1h1v2h1v6h-1v2h-1v1h-2v1H6v-1H4v-1H3v-2H2V5h1V3h1V2h2zm2 2v10h2v-1h1v-1h1V5h-1V4h-1V3z"/></svg>',
    star: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 1h2v3h1v1h5v2h-1v1h-2v1h-1v2h1v3h-1v1h-1v-1H9v-1H7v1H6v1H5v-1H4v-3h1V9H4V8H2V7H1V5h5V4h1z"/></svg>',
    lang: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 1h6v1h2v2h1v2h1v4h-1v2h-1v2h-2v1H5v-1H3v-2H2v-2H1V6h1V4h1V2h2zm1 2v2H4v2h3V3zm3 0v4h3V5h-2V3zM4 9v2h2v2h1V9zm5 0v4h1v-2h2V9z"/></svg>',
    biome: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 1h2v2h1v2h1v2h-1v1h2v2h-1v1h2v2H9v2H7v-2H2v-2h2v-1H3V8h2V7H4V5h1V3h1V2h1z"/></svg>',
    clock: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 1h6v1h2v2h1v2h1v4h-1v2h-1v2h-2v1H5v-1H3v-2H2v-2H1V6h1V4h1V2h2zm0 2v1H4v2H3v4h1v2h1v1h6v-1h1v-2h1V6h-1V4h-1V3zm2 1h2v4h3v2H7z"/></svg>',
    enter: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12 3h2v7H5v2H4v-1H3v-1H2V9h1V8h1V7h1v2h7z"/></svg>',
    /* La croix qui ferme la fenetre : en cases, comme le reste. */
    close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h2v2H3zM3 11h2v2H3zM5 5h2v2H5zM5 9h2v2H5zM7 7h2v2H7zM9 5h2v2H9zM9 9h2v2H9zM11 3h2v2h-2zM11 11h2v2h-2z"/></svg>',
    /* Les familles du rail, une empreinte par famille. */
    all: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 1h2v4h4v2H9v4H7V7H3V5h4zM1 12h14v2H1z"/></svg>',
    paw: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h2v3H3zm4-1h2v4H7zm4 1h2v3h-2zM1 7h2v3H1zm3 3h8v1h1v3h-1v1H4v-1H3v-3h1z"/></svg>',
    bolt: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9 1h4l-3 5h3l-7 9 2-6H5z"/></svg>',
    box: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12v2H2zm0 3h12v8H2zm5 1v3h2V7z"/></svg>',
    shirt: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 1h4v1h3v1h2v4h-3v8H4V7H1V3h2V2h3zm0 2v1h4V3z"/></svg>',
    trophy: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1h10v2h2v3h-1v1h-2v2H9v2h1v1h2v2H4v-2h2v-1h1V9H6V7H4V6H2V3h1zm-1 3v1h1V4zm11 0v1h1V4z"/></svg>',
    page: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1h7l3 3v11H3zm2 2v1h4V3zm0 3v1h6V6zm0 3v1h6V9zm0 3v1h4v-1z"/></svg>'
  };

  /* Le rail des familles : une empreinte par famille. */
  const SCOPE_GLYPH = {
    all: 'all', creature: 'paw', ability: 'bolt', item: 'box',
    skin: 'shirt', world: 'biome', progress: 'trophy', page: 'page'
  };

  /* ===========================================================================
     La fenetre
     =========================================================================== */

  function markup() {
    return `
  <div class="ps" data-palette hidden>
    <div class="ps-scrim" data-palette-scrim></div>

    <div class="ps-stack">
      <div class="ps-win" role="dialog" aria-modal="true" aria-label="Recherche">

        <!-- La barre de commande -->
        <div class="ps-bar">
          <span class="ps-mark" aria-hidden="true">${GLYPH.search}</span>
          <input type="text" class="ps-input" data-palette-input
                 placeholder="Chercher une bête, un objet, un biome, une quête…"
                 autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true"
                 aria-controls="palette-results" aria-autocomplete="list">
          <span class="ps-beam" aria-hidden="true"></span>
          <span class="ps-count" data-palette-count></span>
          <button type="button" class="ps-esc" data-palette-close aria-label="Fermer la recherche" title="Fermer">
            ${GLYPH.close}
          </button>
        </div>

        <div class="ps-body">
          <!-- Le rail des familles -->
          <nav class="ps-rail no-scrollbar" data-palette-scopes role="tablist" aria-label="Familles de résultats"></nav>

          <!-- Les resultats -->
          <div class="ps-results" id="palette-results" role="listbox" data-palette-results>
            <span class="ps-cursor" data-palette-cursor aria-hidden="true"></span>
            <div data-palette-list></div>
          </div>

          <!-- L'apercu -->
          <aside class="ps-aside" data-palette-preview aria-live="polite"></aside>
        </div>

        <div class="ps-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span>
          <span><kbd>↵</kbd> ouvrir</span>
          <span><kbd>Tab</kbd> famille</span>
        </div>
      </div>
    </div>
  </div>`;
  }

  /** La case d'icone d'une ligne : une case creusee, le sprite dedans. */
  function iconHtml(r) {
    const style = '--kc:' + esc(r.color);
    if (r.glyph) {
      return `<span class="ps-slot is-glyph" style="${style}">${GLYPH[r.glyph] || ''}${r.badge ? `<b>${esc(r.badge)}</b>` : ''}</span>`;
    }
    if (r.candidates) {
      /* Une carte d'attaque porte deja son cadre : elle remplit la case au lieu
         de flotter au milieu comme une icone d'objet. */
      const cls = r.card ? ' is-pixel is-card' : (r.pixel ? ' is-pixel' : '');
      return `<span class="ps-slot${cls}" style="${style}"><i data-img="${r.candidates.map((u) => String(u).replace(/"/g, '%22')).join('|')}" data-img-mode="bg"></i></span>`;
    }
    if (r.icon) {
      return `<span class="ps-slot${r.pixel ? ' is-pixel' : ''}" style="${style}"><i style="background-image:url('${esc(OW.asset(r.icon)).replace(/'/g, '%27')}')"></i></span>`;
    }
    return `<span class="ps-slot is-glyph" style="${style}">${GLYPH.search}</span>`;
  }

  function mountSearch(host, data) {
    host.insertAdjacentHTML('beforeend', markup());
    const palette = host.querySelector('[data-palette]');
    const card = palette.querySelector('.ps-win');
    const input = palette.querySelector('[data-palette-input]');
    const listEl = palette.querySelector('[data-palette-list]');
    const resultsEl = palette.querySelector('[data-palette-results]');
    const cursor = palette.querySelector('[data-palette-cursor]');
    const preview = palette.querySelector('[data-palette-preview]');
    const scopesEl = palette.querySelector('[data-palette-scopes]');
    const countEl = palette.querySelector('[data-palette-count]');

    let index = null;
    let flat = [];
    let selected = 0;
    let scope = SCOPES[0];
    let lastFocus = null;
    let building = null;

    /* Dans une autre langue, les noms traduits arrivent au fil de l'eau :
       l'index est reconstruit a chaque ouverture (quelques millisecondes). */
    const translated = () => !!(OW.i18n && OW.i18n.active);

    function ensureIndex(fresh) {
      if (index && fresh && translated() && OW.SKINS) { index = buildIndex(data); return Promise.resolve(index); }
      if (index) return Promise.resolve(index);
      if (building) return building;
      /* Les noms des skins viennent du mod (js/skin-data.js) : sans eux, la
         recherche ne connaissait que « Kodiak Squelette », pas « Kodiak Os
         Sombre ». Le catalogue charge, il se cale sur le JSON (syncSkins). */
      building = loadScript('js/skin-data.js?v=20261001l', () => !!OW.SKIN_DATA)
        .then(() => loadScript('js/skins.js?v=20261001l', () => !!OW.SKINS))
        .then(() => {
          if (OW.syncSkins && data) OW.syncSkins(data);
          index = buildIndex(data);
          return index;
        });
      return building;
    }

    /* ---- les familles ---------------------------------------------------------------- */

    /* Le rail : une famille par ligne, son empreinte, son compte. Les familles
       sans resultat s'eteignent au lieu de disparaitre — la liste ne saute pas
       d'une frappe a l'autre. */
    function renderScopes(counts) {
      scopesEl.innerHTML = SCOPES.map((s) => {
        const n = counts ? counts[s.key] : null;
        const off = n === 0;
        return `<button type="button" class="ps-tab" role="tab" data-scope="${s.key}"
          aria-selected="${s === scope}"${off ? ' data-empty' : ''}>
          <i aria-hidden="true">${GLYPH[SCOPE_GLYPH[s.key]] || GLYPH.all}</i>
          <span>${esc(s.label)}</span>
          ${n != null ? `<em>${n}</em>` : ''}</button>`;
      }).join('');
    }

    /* ---- le rendu -------------------------------------------------------------------- */

    const context = () => {
      const recent = {};
      readRecent().forEach((r) => { recent[r.href] = true; });
      return { recent };
    };

    /* Une ligne porte tout ce dont les cinq habits ont besoin : la case
       d'icone, le rendu en grand, le nom, le contexte, la famille. Chaque habit
       montre ce qui l'interesse et masque le reste — un fond d'image masque
       n'est jamais telecharge, les habits qui ne s'en servent pas ne le paient
       donc pas. */
    function rowHtml(r, i, query) {
      const kind = KINDS[r.kind];
      const art = r.art
        ? `<span class="ps-shot" style="background-image:url('${esc(OW.asset(r.art)).replace(/'/g, '%27')}')" aria-hidden="true"></span>`
        : '<span class="ps-shot is-empty" aria-hidden="true"></span>';
      return `
        <a class="ps-row" href="${esc(r.href || '#')}" role="option" id="pr-${i}" data-pr="${i}" aria-selected="${i === selected}"
           style="--kc:${esc(r.color)};--i:${Math.min(i, 16)}">
          ${art}${iconHtml(r)}
          <span class="ps-text">
            <span class="ps-name" data-no-i18n>${highlight(t(r.name), query)}</span>
            ${r.hint ? `<span class="ps-hint">${esc(r.hint)}</span>` : ''}
          </span>
          <span class="ps-dots" aria-hidden="true"></span>
          <span class="ps-kind">${esc(kind.label)}</span>
          <span class="ps-go" aria-hidden="true">${GLYPH.enter}</span>
        </a>`;
    }

    function groupHtml(title, rows, query, more, moreScope) {
      const start = flat.length;
      rows.forEach((r) => flat.push(r));
      return `<section class="ps-group">
        <h3 class="ps-group-head"><span>${esc(title)}</span>
          ${more ? `<button type="button" class="ps-more" data-scope-jump="${moreScope}">+${more}</button>` : ''}</h3>
        <div class="ps-rows">${rows.map((r, k) => rowHtml(r, start + k, query)).join('')}</div>
      </section>`;
    }

    function draw() {
      const query = input.value;
      flat = [];
      let html = '';
      const q = query.trim();

      if (!q) {
        /* Le champ vide : ce qu'on cherche le plus souvent. */
        const recent = readRecent();
        const favSlugs = OW.favorites ? OW.favorites.list() : [];
        const byHref = {};
        index.forEach((r) => { if (r.href) byHref[r.href] = r; });
        const inScope = (r) => !scope.kinds || scope.kinds.indexOf(r.kind) !== -1;
        const fav = favSlugs.map((slug) => index.find((r) => r.kind === 'creature' && r.slug === slug)).filter(Boolean).filter(inScope);
        const rec = recent.map((x) => byHref[x.href]).filter(Boolean).filter(inScope).slice(0, 5);
        if (fav.length) html += groupHtml('Favoris', fav.slice(0, 6), '');
        if (rec.length) html += groupHtml('Récemment ouverts', rec, '');
        if (!scope.kinds || scope.key === 'page') {
          html += groupHtml('Accès rapide', index.filter((r) => r.kind === 'action').slice(0, 3)
            .concat(index.filter((r) => r.kind === 'page' && /simulator\.html#|biome\.html/.test(r.href)).slice(0, 5)), '');
        }
        const base = scope.kinds ? index.filter((r) => scope.kinds.indexOf(r.kind) !== -1 && r.kind !== 'section') : index.filter((r) => r.kind === 'creature');
        if (base.length) html += groupHtml(scope.kinds ? scope.label : 'Toutes les créatures', base.slice(0, scope.kinds ? 40 : 20), '');
        renderScopes(null);
      } else {
        const all = search(index, q, null, context());
        const counts = {};
        SCOPES.forEach((s) => { counts[s.key] = s.kinds ? all.filter((r) => s.kinds.indexOf(r.kind) !== -1).length : all.length; });
        renderScopes(counts);
        const hits = scope.kinds ? all.filter((r) => scope.kinds.indexOf(r.kind) !== -1) : all;

        if (hits.length) {
          /* Le meilleur resultat en tete, puis des groupes par famille. */
          const top = hits[0];
          html += groupHtml('Meilleur résultat', [top], q);
          const groups = {};
          const order = [];
          hits.slice(1).forEach((r) => {
            if (!groups[r.kind]) { groups[r.kind] = []; order.push(r.kind); }
            groups[r.kind].push(r);
          });
          const cap = scope.kinds ? 30 : 5;
          order.forEach((k) => {
            const list = groups[k];
            const jump = SCOPES.find((s) => s.kinds && s.kinds.indexOf(k) !== -1);
            html += groupHtml(KINDS[k].plural, list.slice(0, cap), q, list.length > cap ? list.length - cap : 0, jump ? jump.key : 'all');
          });
        } else {
          const guess = closest(index, q);
          html = `<div class="ps-empty">
            <span class="ps-empty-art" aria-hidden="true"></span>
            <b>Rien pour « ${esc(q)} »</b>
            ${guess ? `<button type="button" class="ps-guess" data-guess="${esc(guess)}">Suggestion : <u>${esc(guess)}</u> ?</button>` : ''}
            <span class="ps-tips">Exemples :
              <button type="button" data-guess="Tigre">tigre</button>
              <button type="button" data-guess="jade">jade</button>
              <button type="button" data-guess="piste">piste</button>
              <button type="button" data-guess="succès">succès</button></span>
          </div>`;
        }
      }

      listEl.innerHTML = html;
      if (OW.resolveImages) OW.resolveImages(listEl);
      selected = Math.min(selected, Math.max(0, flat.length - 1));
      countEl.textContent = q ? flat.length + (flat.length > 1 ? ' résultats' : ' résultat') : '';
      palette.classList.toggle('is-searching', !!q);
      paintSelection(true);
    }

    /* `quiet` : on repose le curseur sans faire defiler la liste. C'est le cas
       du survol — sinon amener la ligne survolee dans le cadre repoussait le
       contenu sous le curseur, qui survolait alors la ligne suivante, et la
       liste remontait toute seule des qu'on visait le bas. */
    function paintSelection(instant, quiet) {
      listEl.querySelectorAll('.ps-row[aria-selected="true"]').forEach((el) => el.setAttribute('aria-selected', 'false'));
      const el = listEl.querySelector('[data-pr="' + selected + '"]');
      if (!el) {
        cursor.style.opacity = '0';
        input.removeAttribute('aria-activedescendant');
        renderPreview(null);
        return;
      }
      el.setAttribute('aria-selected', 'true');
      input.setAttribute('aria-activedescendant', el.id);

      /* Ou poser le curseur.

         Deux pieges, et c'est leur somme qui decalait l'eclairage :

         - offsetTop se mesure depuis le PARENT POSITIONNE le plus proche, et
           chaque famille de resultats (.ps-group) en est un. Une ligne de la
           deuxieme famille renvoyait donc sa position dans sa famille, pas
           dans la liste : le curseur se posait des centaines de pixels trop
           haut ;
         - getBoundingClientRect, lui, inclut les transformations : survoler
           une ligne pendant son animation d'entree (elle glisse de quelques
           pixels) figeait le curseur a mi-course.

         On additionne donc les offsetTop de parent en parent jusqu'au cadre
         qui defile : des positions de mise en page, sans transformation,
         justes quelle que soit la profondeur du balisage. */
      let top = 0;
      let left = 0;
      for (let node = el; node && node !== resultsEl; node = node.offsetParent) {
        top += node.offsetTop;
        left += node.offsetLeft;
      }
      const height = el.offsetHeight;

      /* Le curseur glisse d'une ligne a l'autre au lieu de sauter. */
      cursor.classList.toggle('is-instant', !!instant || reduced());
      cursor.style.opacity = '1';
      cursor.style.transform = 'translate(' + left + 'px,' + top + 'px)';
      cursor.style.width = el.offsetWidth + 'px';
      cursor.style.height = height + 'px';
      cursor.style.setProperty('--kc', flat[selected].color);
      if (!quiet) {
        const bottom = top + height;
        if (top < resultsEl.scrollTop + 30) resultsEl.scrollTop = Math.max(0, top - 36);
        else if (bottom > resultsEl.scrollTop + resultsEl.clientHeight) resultsEl.scrollTop = bottom - resultsEl.clientHeight + 8;
      }
      renderPreview(flat[selected]);
    }

    /* ---- l'apercu --------------------------------------------------------------------- */

    let previewKey = null;
    function renderPreview(r) {
      const key = r ? r.kind + '|' + r.href + '|' + r.name : null;
      if (key === previewKey) return;
      previewKey = key;
      if (!r) { preview.innerHTML = ''; return; }
      const kind = KINDS[r.kind];
      let art = '';
      let facts = [];
      let body = '';
      let actions = [];
      const e = r.entity;

      if (r.kind === 'creature' && e) {
        art = `<span class="pp-art pp-art-photo pp-art-contain" style="background-image:url('${esc(OW.asset(e.art))}')"></span>`;
        const speed = e.stats.mountedBps || e.stats.walkBps;
        facts = [['PV', e.stats.hp != null ? Math.round(e.stats.hp) : '—'], ['Dégâts', e.stats.damage != null ? OW.num(e.stats.damage) : '—'],
          ['Vitesse', speed ? OW.num(speed) + ' b/s' : '—'], ['Archétype', e.archetype ? e.archetype.name : '—']];
        body = e.lore[0] ? e.lore[0].text.split('.').slice(0, 2).join('.') + '.' : '';
        actions = [['Piste Sauvage', OW.animalHref(e.slug, 'trail')], ['Capacités', OW.animalHref(e.slug, 'abilities')], ['Comparer', 'simulator.html?e=' + encodeURIComponent(e.slug) + '#combat']];
      } else if (r.kind === 'boss' && e) {
        art = `<span class="pp-art pp-art-photo pp-art-contain" style="background-image:url('${esc(OW.asset(e.art))}')"></span>`;
        const size = e.size || {};
        facts = [['PV', e.stats.hp != null ? Math.round(e.stats.hp) : '—'], ['Dégâts', e.stats.damage != null ? OW.num(e.stats.damage) : '—'],
          ['Taille', size.height ? OW.num(size.height) + ' × ' + OW.num(size.width) + ' blocs' : '—'], ['Arène', e.gameplay && e.gameplay.fightsInArena ? 'Oui' : 'Non']];
        body = 'Son dossier sur la page Boss : barre de vie, règles de combat, reliques.';
        actions = [['Voir la musique', 'music.html?boss=' + encodeURIComponent(e.slug)]];
      } else if (r.kind === 'section' && e) {
        art = `<span class="pp-art pp-art-photo pp-art-contain" style="background-image:url('${esc(OW.asset(e.art))}')"></span>`;
        body = 'Ouvre la fiche de ' + e.name + ' directement au chapitre « ' + r.chapter + ' ».';
      } else if (r.kind === 'ability' && r.card) {
        const card = OW.attackCard(e.slug, r.card);
        art = card
          ? `<span class="pp-art pp-art-pixel pp-art-card"><i data-img="${esc(card)}" data-img-mode="bg"></i></span>`
          : `<span class="pp-art pp-art-glyph">${GLYPH.bolt}</span>`;
        facts = [['Créature', e.name], ['Rôle', r.card.roleLabel || '—'], ['Touche', r.card.keyLabel || '—']];
        body = r.card.description;
      } else if (r.candidates) {
        art = `<span class="pp-art pp-art-pixel"><i data-img="${r.candidates.join('|')}" data-img-mode="bg"></i></span>`;
        if (r.item) facts = [['Rareté', r.item.rarity], ['Pile', r.item.stack], ['Durabilité', r.item.durability || '—'], ['Résiste au feu', r.item.fireResistant ? 'Oui' : 'Non']];
        if (r.block) facts = [['Résistance', OW.num(r.block.explosionResistance)], ['Friction', OW.num(r.block.friction, 2)]];
        if (r.saddle) facts = [['Créature', r.saddle.entityName], ['Seuil', r.saddle.threshold + ' XP'], ['Ingrédients', r.saddle.needs.length]];
      } else if (r.kind === 'skin' && r.skin) {
        art = `<span class="pp-art pp-art-photo pp-art-contain" style="background-image:url('${esc(OW.asset(r.skin.image))}')"></span>`;
        facts = [['Rareté', r.rarity ? r.rarity.label : '—'], ['Obtention', r.skin.price ? r.skin.price + ' pièces' : r.skin.unlock]];
        body = r.skin.lore || '';
      } else if (r.kind === 'biome') {
        art = r.icon ? `<span class="pp-art pp-art-photo" style="background-image:url('${esc(OW.asset(r.icon))}')"></span>` : `<span class="pp-art pp-art-glyph">${GLYPH.biome}</span>`;
        facts = [['Identifiant', r.biome.id], ['Habitants', (r.residents || []).length]];
        body = (r.residents || []).length ? 'On y croise : ' + r.residents.map((x) => x.name).join(', ') + '.' : 'Aucune créature ne s\'y génère naturellement.';
      } else if (r.kind === 'quest' && r.quest) {
        art = `<span class="pp-art pp-art-pixel" style="background-image:url('${esc(r.icon)}')"></span>`;
        /* La recompense se tire au hasard selon le palier (js/quest-data.js,
           onglet Quetes de Mecaniques) : pas de nombre fixe a donner ici. */
        facts = [['Palier', r.quest.tier], ['Récompense', 'Orbes d’XP ou pièces'], ['Objectif', r.quest.max]];
      } else if (r.kind === 'achievement' && r.advancement) {
        art = `<span class="pp-art pp-art-pixel" style="background-image:url('${esc(r.icon)}')"></span>`;
        body = r.advancement.description;
        if (e) actions = [['Comment l\'apprivoiser', OW.animalHref(e.slug, 'taming')]];
      } else if (r.icon) {
        art = `<span class="pp-art ${r.pixel ? 'pp-art-pixel' : 'pp-art-photo pp-art-contain'}" style="background-image:url('${esc(OW.asset(r.icon))}')"></span>`;
        body = r.hint;
      } else if (r.glyph) {
        art = `<span class="pp-art pp-art-glyph">${GLYPH[r.glyph] || ''}</span>`;
        body = r.hint;
      }

      preview.innerHTML = `
        <div class="pp" style="--kc:${esc(r.color)}">
          <div class="pp-stage">${art}<span class="pp-kind">${esc(kind.label)}</span></div>
          <div class="pp-title">${esc(t(r.name))}</div>
          ${r.hint && r.kind !== 'achievement' && r.kind !== 'passive' ? `<div class="pp-hint">${esc(r.hint)}</div>` : ''}
          ${facts.length ? `<dl class="pp-facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(String(v))}</dd></div>`).join('')}</dl>` : ''}
          ${body ? `<p class="pp-body">${esc(body)}</p>` : (r.kind === 'passive' ? `<p class="pp-body">${esc(r.hint)}</p>` : '')}
          <div class="pp-actions">
            ${r.href ? `<a class="pp-open" href="${esc(r.href)}" data-pp-open>${r.run ? 'Lancer' : 'Ouvrir'} <kbd>↵</kbd></a>` : `<button type="button" class="pp-open" data-pp-open>Lancer <kbd>↵</kbd></button>`}
            ${actions.map(([label, href]) => `<a class="pp-link" href="${esc(href)}">${esc(label)} →</a>`).join('')}
            ${r.kind === 'creature' && OW.favStar ? OW.favStar(r.slug, e.name, 'pp-fav') : ''}
          </div>
        </div>`;
      if (OW.resolveImages) OW.resolveImages(preview);
    }

    /* ---- ouvrir, fermer, choisir ---------------------------------------------------------- */

    function choose(r, newTab) {
      if (!r) return;
      pushRecent(r);
      if (r.run) { close(); r.run(); return; }
      if (!r.href) return;
      if (newTab) { window.open(r.href, '_blank', 'noopener'); return; }
      const here = location.pathname.split('/').pop() || 'index.html';
      const [page, hash] = r.href.split('#');
      close();
      /* Meme page, autre ancre : on defile au lieu de recharger. */
      if (page.split('?')[0] === here && (page.indexOf('?') === -1 || page === here + location.search) && hash) {
        history.replaceState(null, '', '#' + hash);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        const target = document.getElementById(hash);
        if (target && OW.scrollToEl) OW.scrollToEl(target);
        const tab = document.querySelector('[data-tab="' + hash + '"]');
        if (tab) tab.click();
        return;
      }
      window.location.href = r.href;
    }

    let closing = 0;
    function open(initial) {
      clearTimeout(closing);
      lastFocus = document.activeElement;
      palette.hidden = false;
      palette.classList.remove('is-closing');
      document.documentElement.classList.add('palette-lock');
      void palette.offsetWidth;
      palette.classList.add('is-open');
      input.value = typeof initial === 'string' ? initial : '';
      selected = 0;
      scope = SCOPES[0];
      listEl.innerHTML = '<div class="ps-wait"><i></i><i></i><i></i></div>';
      ensureIndex(true).then(() => {
        draw();
        /* Les traductions demandees pendant ce rendu arrivent : on redessine une fois. */
        if (translated() && OW.i18n.ready) {
          OW.i18n.ready().then(() => {
            if (palette.hidden) return;
            index = buildIndex(data);
            draw();
          });
        }
      });
      setTimeout(() => input.focus({ preventScroll: true }), 20);
    }

    function close() {
      if (palette.hidden) return;
      palette.classList.remove('is-open');
      palette.classList.add('is-closing');
      document.documentElement.classList.remove('palette-lock');
      closing = setTimeout(() => { palette.hidden = true; palette.classList.remove('is-closing'); }, reduced() ? 0 : 170);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    function setScope(key) {
      scope = SCOPES.find((s) => s.key === key) || SCOPES[0];
      selected = 0;
      draw();
      const btn = scopesEl.querySelector('[data-scope="' + scope.key + '"]');
      if (btn && btn.scrollIntoView) btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    /* ---- evenements ------------------------------------------------------------------ */

    host.querySelectorAll('[data-palette-open]').forEach((btn) => btn.addEventListener('click', () => open()));
    palette.querySelector('[data-palette-scrim]').addEventListener('click', close);
    palette.querySelector('[data-palette-close]').addEventListener('click', close);

    let inputTimer = 0;
    input.addEventListener('input', () => {
      selected = 0;
      clearTimeout(inputTimer);
      /* Une frappe rapide ne recalcule qu'une fois. */
      inputTimer = setTimeout(() => { if (index) draw(); }, 40);
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (flat.length) { selected = (selected + 1) % flat.length; paintSelection(); }
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (flat.length) { selected = (selected - 1 + flat.length) % flat.length; paintSelection(); }
      } else if (event.key === 'PageDown') {
        event.preventDefault();
        selected = Math.min(flat.length - 1, selected + 6); paintSelection();
      } else if (event.key === 'PageUp') {
        event.preventDefault();
        selected = Math.max(0, selected - 6); paintSelection();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        choose(flat[selected], event.ctrlKey || event.metaKey);
      } else if (event.key === 'Tab') {
        event.preventDefault();
        const at = SCOPES.indexOf(scope);
        setScope(SCOPES[(at + (event.shiftKey ? -1 : 1) + SCOPES.length) % SCOPES.length].key);
      }
    });

    palette.addEventListener('click', (event) => {
      const scopeBtn = event.target.closest('[data-scope]');
      if (scopeBtn) { setScope(scopeBtn.dataset.scope); input.focus(); return; }
      const jump = event.target.closest('[data-scope-jump]');
      if (jump) { setScope(jump.dataset.scopeJump); input.focus(); return; }
      const guess = event.target.closest('[data-guess]');
      if (guess) { input.value = guess.dataset.guess; selected = 0; draw(); input.focus(); return; }
      const pr = event.target.closest('[data-pr]');
      if (pr) {
        if (event.ctrlKey || event.metaKey || event.button === 1) { pushRecent(flat[+pr.dataset.pr]); return; }
        event.preventDefault();
        choose(flat[+pr.dataset.pr]);
        return;
      }
      if (event.target.closest('[data-pp-open]')) {
        event.preventDefault();
        choose(flat[selected]);
        return;
      }
      const link = event.target.closest('.pp-link');
      if (link) { pushRecent(flat[selected]); close(); }
    });

    /* Au survol, la ligne se selectionne — sans voler le clavier, et sans faire
       bouger la liste.

       Deux garde-fous : le navigateur envoie un pointermove quand le contenu
       glisse sous un curseur immobile (donc a chaque cran de molette), et le
       doigt sur un ecran tactile n'a pas a selectionner avant de toucher. */
    let pointerAt = null;
    let hoverMuted = 0;
    resultsEl.addEventListener('scroll', () => { hoverMuted = Date.now() + 150; }, { passive: true });

    listEl.addEventListener('pointermove', (event) => {
      if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      const moved = !pointerAt || Math.abs(event.clientX - pointerAt.x) > 2 || Math.abs(event.clientY - pointerAt.y) > 2;
      pointerAt = { x: event.clientX, y: event.clientY };
      if (!moved || Date.now() < hoverMuted) return;
      const pr = event.target.closest('[data-pr]');
      if (!pr || +pr.dataset.pr === selected) return;
      selected = +pr.dataset.pr;
      paintSelection(false, true);
    });

    window.addEventListener('keydown', (event) => {
      const typing = event.target && event.target.closest && event.target.closest('input, textarea, select, [contenteditable]');
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (palette.hidden) open(); else close();
      } else if (event.key === '/' && !typing && palette.hidden) {
        event.preventDefault();
        open();
      } else if (event.key === 'Escape' && !palette.hidden) {
        event.preventDefault();
        if (input.value) { input.value = ''; selected = 0; draw(); } else close();
      }
    });

    /* Le focus reste dans la fenetre. */
    palette.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab' || event.target === input) return;
      event.preventDefault();
      input.focus();
    });

    document.addEventListener('ow:favorites', () => {
      if (!index) return;
      const favs = OW.favorites.list();
      index.forEach((r) => { if (r.kind === 'creature') r.boost = favs.indexOf(r.slug) !== -1 ? 14 : 0; });
      if (!palette.hidden && !input.value.trim()) draw();
    });

    /* L'index se prepare pendant un temps mort : la premiere ouverture est instantanee. */
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
    idle(() => ensureIndex());

    OW.openSearch = open;
    OW.closeSearch = close;
    /* Le meme index, sans la fenetre : Billy (js/billy.js) y cherche les
       pages dont parle une question. */
    OW.searchWiki = (query, limit) => ensureIndex().then((rows) =>
      search(rows, query, null, { recent: {} }).slice(0, limit || 8));
  }

  OW.mountSearch = mountSearch;
  OW.searchKinds = KINDS;
}(window.OW = window.OW || {}));
