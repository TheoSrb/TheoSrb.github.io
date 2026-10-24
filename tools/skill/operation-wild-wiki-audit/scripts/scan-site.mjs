// Parcourt tout le wiki dans un Chrome sans fenetre et releve le texte « brut »
// qu'un visiteur voit : noms de classes Java (ElephantMournGoal), constantes
// (SEDATED_FALL), identifiants (ow:tiger_fang, minecraft:oak_log), cles de langue
// (ow.attacks.elephant.combo.title), trous (%s, undefined, NaN), mots anglais
// dans une page francaise, texte casse (Ã©).
//
// Le robot part des pages du menu, suit chaque lien interne (fiches, biomes,
// boss...), fait defiler chaque page jusqu'en bas (contenu charge a l'approche),
// clique chaque onglet, puis lit tous les textes ET les attributs lus par un
// humain (title, aria-label, alt, placeholder). Les textes caches sont releves
// aussi, marques « cache ».
//
// Usage :
//   node scan-site.mjs [--base http://localhost:8123/] [--out <dossier>]
//                      [--only animal.html?e=elephant,items.html] [--max 200]
// Il faut le site servi en local (python tools/serve.py 8123) et Google Chrome.
// Sortie : <out>/scan.json (tout) et <out>/scan.md (lecture humaine, par page).

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const BASE = String(args.base || 'http://localhost:8123/').replace(/\/?$/, '/');
const OUT = path.resolve(String(args.out || path.join(os.tmpdir(), 'ow-wiki-scan')));
const MAX = Number(args.max || 250);
const CHROME = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome'
].find((p) => p && fs.existsSync(p));
if (!CHROME) { console.error('Chrome introuvable (variable CHROME pour donner son chemin).'); process.exit(1); }

const START = args.only
  ? String(args.only).split(',').map((s) => s.trim()).filter(Boolean)
  : ['index.html', 'creatures.html', 'bosses.html', 'biomes.html', 'items.html', 'cosmetics.html',
     'simulator.html', 'music.html', 'guide.html', 'community.html', 'download.html', 'lab.html', '404.html'];
const FOLLOW = !args.only;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9100 + Math.floor(Math.random() * 800);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ow-scan-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--window-size=1440,1000', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--lang=fr-FR', 'about:blank'], { stdio: 'ignore' });

let targets;
for (let i = 0; i < 60 && !targets; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { await sleep(250); }
}
if (!targets) { console.error('Chrome ne repond pas.'); chrome.kill(); process.exit(1); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let seq = 0;
const pending = new Map();
const events = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
  } else if (m.method) events.push(m);
});
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++seq; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description));
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');
// Le site en francais, theme sombre par defaut : on efface toute preference.
await send('Emulation.setLocaleOverride', { locale: 'fr-FR' }).catch(() => {});

/* ---- ce qui tourne dans la page -------------------------------------------- */

const SCROLL_AND_TABS = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const H = () => document.documentElement.scrollHeight;
  for (let y = 0; y < H(); y += Math.round(innerHeight * 0.8)) { scrollTo(0, y); await sleep(160); }
  scrollTo(0, H()); await sleep(500);
  // Onglets : tout ce qui se declare onglet, ou bouton de bascule de panneau.
  const tabs = [...document.querySelectorAll('[role="tab"], [data-tab], [data-tab-btn], [aria-controls]')]
    .filter((b) => !b.closest('header, nav.site-nav') && b.offsetParent !== null).slice(0, 80);
  for (const t of tabs) { try { t.click(); await sleep(250); } catch (e) {} }
  // Volets repliables
  document.querySelectorAll('details:not([open])').forEach((d) => { d.open = true; });
  await sleep(400);
  scrollTo(0, 0);
  return tabs.length;
})()`;

const COLLECT = `(() => {
  const out = [];
  const seen = new Set();
  const visible = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  };
  const where = (el) => {
    const parts = [];
    for (let n = el; n && n !== document.body && parts.length < 4; n = n.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.id) { s += '#' + n.id; parts.unshift(s); break; }
      const cls = [...n.classList].filter((c) => !/^is-|^js-/.test(c)).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      const data = [...n.attributes].find((a) => a.name.startsWith('data-') && a.name !== 'data-reveal');
      if (data) s += '[' + data.name + ']';
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  const push = (text, el, kind) => {
    text = String(text).replace(/\\s+/g, ' ').trim();
    if (!text) return;
    const key = kind + '|' + text;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text: text.slice(0, 400), kind, where: where(el), shown: visible(el) });
  };
  const SKIP = 'script, style, noscript, template, svg title, code.raw-ok, [data-raw-ok]';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    const el = n.parentElement;
    if (!el || el.closest(SKIP)) continue;
    push(n.nodeValue, el, 'texte');
  }
  for (const el of document.body.querySelectorAll('[title], [aria-label], [alt], [placeholder], [data-tip]')) {
    if (el.closest(SKIP)) continue;
    for (const a of ['title', 'aria-label', 'alt', 'placeholder', 'data-tip']) {
      if (el.hasAttribute(a)) push(el.getAttribute(a), el, a);
    }
  }
  push(document.title, document.head, 'titre de page');
  const meta = document.querySelector('meta[name=description]');
  if (meta) push(meta.content, meta, 'meta description');
  const links = [...document.querySelectorAll('a[href]')].map((a) => a.href);
  const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith('data:'))
    .map((i) => i.currentSrc || i.src);
  return { texts: out, links, broken, lang: document.documentElement.lang, url: location.href };
})()`;

/* ---- ce qui est suspect ------------------------------------------------------ */

// Mots que le site a le droit d'ecrire tels quels (marques, noms propres du jeu).
const ALLOW = new Set(['Operation', 'W.I.L.D', 'Minecraft', 'NeoForge', 'TerraBlender', 'CurseForge', 'Modrinth',
  'GitHub', 'YouTube', 'TikTok', 'Discord', 'JavaScript', 'PayPal', 'Netlify', 'Blockbench', 'IntelliJ',
  'OK', 'PV', 'XP', 'HUD', 'FAQ', 'MC', 'NPC', 'PNJ', 'ID', 'UI', 'FPS', 'RP', 'KO', 'DJ', 'OST', 'BPM']);
const EN_WORDS = ['the', 'and', 'with', 'when', 'from', 'your', 'this', 'that', 'goal', 'target', 'attack', 'idle',
  'walk', 'run', 'follow', 'seek', 'herd', 'spray', 'water', 'fire', 'charge', 'grudge', 'listen', 'mourn',
  'browse', 'flee', 'hunt', 'defense', 'predator', 'sleep', 'nap', 'sit', 'swim', 'roar', 'loading', 'error',
  'click', 'here', 'more', 'less', 'show', 'hide', 'none', 'default', 'skin', 'level', 'damage', 'health', 'speed'];
// Ces mots existent aussi en francais ou sont du vocabulaire du jeu affiche voulu.
const EN_OK = new Set(['skin', 'combo', 'charge', 'default']);
const RULES = [
  ['classe Java', /\b(?:OW)?[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+){1,}(?:Goal|Entity|Task|Behaviou?r|Gaol|Run|Model|Screen|Item|Block)?\b/g, 'haute'],
  ['CONSTANTE', /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g, 'haute'],
  ['identifiant', /\b(?:ow|minecraft|neoforge|c|forge):[a-z0-9_./-]+/g, 'haute'],
  ['cle de langue', /\b(?:ow|item|entity|block|tooltip|saddler|owteams|screen|gui|effect|advancements?)\.[a-z0-9_]+\.[a-z0-9_.]+/g, 'haute'],
  ['snake_case', /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g, 'moyenne'],
  ['trou', /%(?:\d+\$)?[sdf]|\{\d+\}|\{\{[^}]*\}\}|\$\{[^}]*\}|\bundefined\b|\bnull\b|\bNaN\b|\bInfinity\b|\[object \w+\]/g, 'haute'],
  ['texte casse', /Ã[\x80-\xBF©¨ª«®´]|â€[™œ\x9d“”˜]|\uFFFD/g, 'haute']
];
function findings(text) {
  const hits = [];
  for (const [label, re, level] of RULES) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const tok = m[0];
      if (ALLOW.has(tok)) continue;
      if (label === 'classe Java' && !/(Goal|Entity|Task|Behaviou?r|Model|Screen)$/.test(tok) && tok.length < 9) continue;
      if (label === 'snake_case' && (/^(?:https?|www)/.test(tok) || hits.some((h) => h.tok.includes(tok)))) continue;
      hits.push({ label, tok, level });
    }
  }
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  const en = words.filter((w) => EN_WORDS.includes(w) && !EN_OK.has(w));
  // « Follow Herd », « Water Run » : quelques mots anglais capitalises, sans un accent,
  // c'est presque toujours un nom de classe Java decoupe par un repli automatique.
  const titleCaseEnglish = /^(?:[A-Z][a-z]+ ?){1,4}$/.test(text) && en.length >= 1;
  if (titleCaseEnglish) hits.push({ label: 'anglais (nom de code decoupe ?)', tok: text, level: 'haute' });
  else if (en.length >= 2) hits.push({ label: 'anglais ?', tok: [...new Set(en)].join(', '), level: 'basse' });
  return hits;
}

// Textes bruts VOULUS, deja tranches avec le proprietaire : releves a part, jamais
// « corriges » sans lui demander. Ajouter ici ce qu'il confirme vouloir garder.
const INTENTIONAL = [
  { where: /button\[data-anim\]/, kind: 'title', why: "nom exact de l'animation au survol, sert a remplir hiddenAnimations (site-config.js)" },
  { where: /sb-path/, why: 'nom du fichier son sous chaque pad de la table de mixage' },
  { where: /span\.ident-id/, why: 'pancarte « Enclos ow:<bete> » du hero, effet voulu' },
  // Tranche le 20/10/2026 : les identifiants techniques ci-dessous sont un choix de style « fiche technique ».
  { where: /article\.biome-card.*span\.t-pixel/, why: 'etiquette ow:<biome> des cartes de biome' },
  { where: /span\.t-pixel\[data-skin-id\]/, why: 'etiquette ow:<skin> des cosmetiques' },
  { where: /span\.tcg-foot/, why: 'numero « n° ow:<bete> » de la carte a collectionner' },
  { where: /footer\.site-footer/, why: 'pied de page « VERSION · OW:<PAGE> »' },
  { where: /span\.bf-block-id/, why: 'id des blocs de la flore d\'un biome' },
  { where: /dl\.bf-techlist/, why: 'fiche technique du biome (registre, constante)' },
  { where: /button\.bf-swatch/, kind: 'title', why: 'nom du champ de couleur de la palette du biome' },
  { where: /dl\.rows\[data-spawn-rows\]/, text: /^ow:spawn_/, why: '« Modificateur : ow:spawn_<bete> » des fiches' },
  { where: /span\.chest-note/, text: /^ow:entities\//, why: 'table de butin ow:entities/<bete> sous le coffre' },
  { where: /a\.need\.sack-row|a\.chest-slot/, kind: 'title', why: 'id de l\'objet au survol de la nourriture et du butin' },
  { where: /span\.bf-id/, why: 'pancarte ow:<biome> du hero d\'un biome' },
  { where: /div\.bf-spawn-head/, text: /^ow:spawn_/, why: 'id du spawn sous chaque bete d\'un biome' },
  { where: /span\.sb-miss/, why: 'nom du son exporte sans fichier, dans « sons manquants » de la table de mixage' }
];
const intentional = (i) => INTENTIONAL.find((r) => r.where.test(i.where) && (!r.kind || r.kind === i.kind) && (!r.text || r.text.test(i.text)));
// Le site SONDE des fichiers facultatifs (gallery_N, anim_N.gif, skin_N, rendus...) :
// un 404 sur ces noms est normal (« deposer un fichier suffit »).
const PROBE = /\/pages\/[^/]+\/(?:gallery|anim|skin|craft|variant|render)_?\d*\.(?:png|gif)|\/(?:skins|solo|thumbs|wallpapers|og)\//;

/* ---- le parcours ------------------------------------------------------------- */

const queue = START.map((p) => new URL(p, BASE).href);
const done = new Set();
const pages = [];
const norm = (href) => {
  const u = new URL(href);
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (/^(v|fresh|demo|utm_.*)$/.test(k)) u.searchParams.delete(k);
  return u.href;
};

while (queue.length && pages.length < MAX) {
  const url = norm(queue.shift());
  if (done.has(url)) continue;
  done.add(url);
  process.stdout.write(`[${pages.length + 1}] ${url.replace(BASE, '')} ... `);
  // Le petit serveur python refuse parfois des connexions quand Chrome demande
  // 40 fichiers d'un coup : la page sort a moitie vide. On la relit (3 essais).
  for (let attempt = 1; attempt <= 3; attempt++) {
  events.length = 0;
  try {
    await send('Page.navigate', { url });
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      const ready = await evaluate('document.readyState').catch(() => '');
      if (ready === 'complete') break;
    }
    await sleep(1800); // le JSON du wiki, la 3D, les traductions
    const tabs = await evaluate(SCROLL_AND_TABS).catch(() => 0);
    await sleep(600);
    const res = await evaluate(COLLECT);
    const errors = events
      .filter((e) => (e.method === 'Runtime.exceptionThrown')
        || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
        || (e.method === 'Network.loadingFailed' && !e.params.canceled))
      .map((e) => e.method === 'Runtime.exceptionThrown'
        ? 'JS : ' + (e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text).split('\n').slice(0, 2).join(' ')
        : e.method === 'Log.entryAdded' ? 'console : ' + e.params.entry.text + (e.params.entry.url ? ' (' + e.params.entry.url + ')' : '')
          : 'reseau : ' + e.params.errorText);
    const issues = [];
    for (const t of res.texts) {
      for (const h of findings(t.text)) {
        const i = { ...h, text: t.text, kind: t.kind, where: t.where, shown: t.shown };
        // Une infobulle ou un aria-label ne se lit qu'au survol : un cran de moins.
        if (t.kind !== 'texte' && i.level === 'haute') i.level = 'moyenne';
        const ok = intentional(i);
        if (ok) { i.level = 'voulu'; i.why = ok.why; }
        issues.push(i);
      }
    }
    const probes = errors.filter((e) => /404/.test(e) && PROBE.test(e)).length;
    // ERR_BLOCKED_BY_ORB = une sonde d'image hors site (GitHub Pages) qui a repondu 404 : meme bruit.
    errors.splice(0, errors.length, ...new Set(errors.filter((e) => !(/404/.test(e) && PROBE.test(e)) && !/ERR_BLOCKED_BY_ORB/.test(e))));
    const refused = errors.some((e) => /ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|ERR_CONNECTION_RESET/.test(e));
    if (refused && attempt < 3) { process.stdout.write(`(serveur sature, essai ${attempt + 1}) `); await sleep(3000); continue; }
    if (refused) errors.unshift('PAGE INCOMPLETE : le serveur local a refuse des fichiers, resultat peu fiable');
    pages.push({ url: url.replace(BASE, ''), tabs, probes, lang: res.lang, issues, broken: [...new Set(res.broken)], errors: [...new Set(errors)], textCount: res.texts.length });
    console.log(`${issues.length} suspects, ${res.broken.length} images cassees, ${errors.length} erreurs`);
    if (FOLLOW) {
      for (const href of res.links) {
        let u;
        try { u = new URL(href); } catch { continue; }
        if (!u.href.startsWith(BASE) || !/\.html$/.test(u.pathname) || /\/(tools|partage|c)\//.test(u.pathname)) continue;
        const n = norm(u.href);
        if (!done.has(n)) queue.push(n);
      }
    }
  } catch (err) {
    console.log('ECHEC : ' + err.message);
    pages.push({ url: url.replace(BASE, ''), failed: err.message, issues: [], broken: [], errors: [] });
  }
  break;
  }
}
chrome.kill();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}

/* ---- le rapport -------------------------------------------------------------- */

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'scan.json'), JSON.stringify({ base: BASE, date: new Date().toISOString(), pages }, null, 1));

// Un meme texte brut sur 12 fiches = un seul probleme (un gabarit) : on regroupe.
const byToken = new Map();
for (const p of pages) for (const i of p.issues) {
  const k = i.label + '|' + i.tok;
  if (!byToken.has(k)) byToken.set(k, { ...i, pages: new Set() });
  byToken.get(k).pages.add(p.url);
}
const order = { haute: 0, moyenne: 1, basse: 2, voulu: 3 };
const rows = [...byToken.values()].sort((a, b) => order[a.level] - order[b.level] || b.pages.size - a.pages.size);
const md = [];
md.push(`# Scan du wiki — ${new Date().toLocaleString('fr-FR')}`, '', `Base : ${BASE} · ${pages.length} pages lues`, '');
md.push('## Textes bruts, regroupes (du plus grave au moins grave)', '');
md.push('| Gravite | Type | Ce qui s\'affiche | Contexte | Ou (selecteur) | Pages |', '|---|---|---|---|---|---|');
for (const r of rows) {
  const ctx = r.text.length > 90 ? r.text.slice(0, 87) + '…' : r.text;
  const pg = [...r.pages];
  if (r.level === 'voulu') continue;
  md.push(`| ${r.level} | ${r.label} | \`${r.tok}\` | ${ctx.replace(/\|/g, '\\|')}${r.shown ? '' : ' *(cache)*'} (${r.kind}) | \`${r.where}\` | ${pg.length > 3 ? pg.slice(0, 3).join(', ') + ` +${pg.length - 3}` : pg.join(', ')} |`);
}
const kept = rows.filter((r) => r.level === 'voulu');
if (kept.length) {
  md.push('', '## Textes bruts voulus (deja tranches, ne pas toucher sans demander)', '');
  const why = new Map();
  for (const r of kept) { if (!why.has(r.why)) why.set(r.why, []); why.get(r.why).push(r.tok); }
  for (const [w, toks] of why) md.push(`- ${w} : ${toks.length} textes (ex. \`${toks.slice(0, 4).join('`, `')}\`)`);
}
md.push('', '## Erreurs et images cassees, par page', '', '_Les 404 des fichiers sondes (gallery_N, anim_N.gif, skins...) sont normaux et ne sont pas listes._', '');
for (const p of pages) {
  if (!p.failed && !p.errors.length && !p.broken.length) continue;
  md.push(`### ${p.url}`);
  if (p.failed) md.push(`- **page non lue** : ${p.failed}`);
  p.errors.slice(0, 15).forEach((e) => md.push('- ' + e));
  p.broken.slice(0, 15).forEach((b) => md.push('- image cassee : ' + b));
  md.push('');
}
md.push('## Pages lues', '', ...pages.map((p) => `- ${p.url} — ${p.textCount || 0} textes, ${p.tabs || 0} onglets cliques, ${p.issues.length} suspects`));
fs.writeFileSync(path.join(OUT, 'scan.md'), md.join('\n'));
console.log(`\nRapport : ${path.join(OUT, 'scan.md')} (${rows.length} textes bruts distincts)`);
