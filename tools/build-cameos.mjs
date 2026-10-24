// Les « passants » du pied de page : une planche de marche par bete, rendue
// depuis son vrai modele 3D (data/models.json, tools/build-models.py).
//
// Ecrit assets/cameos/<slug>.png (les images d'un tour de marche, cote a cote)
// et js/cameos.js (taille des cases, nombre d'images, duree du tour, vitesse).
//
// Usage (le site doit etre servi en local, Live Server par exemple) :
//     node tools/build-cameos.mjs                       -> http://localhost:5500/
//     node tools/build-cameos.mjs http://localhost:8123/
//
// A relancer apres un changement de modele ou d'animation de marche.
// Il faut Google Chrome installe (le chemin est en tete de fichier).

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
/* Le dossier des assets (tools/paths.py) : variable OW_ASSETS_DIR, sinon tools/paths.json. */
const CFG = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'paths.json'), 'utf8')); } catch { return {}; } })();
const ASSETS = process.env.OW_ASSETS_DIR || CFG.assets || path.join(ROOT, 'assets');
const BASE = (process.argv[2] || 'http://localhost:5500/').replace(/\/?$/, '/');
const PORT = 9500 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ow-cameos-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets;
for (let i = 0; i < 50 && !targets; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { await sleep(200); }
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
});
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: BASE + 'tools/build-cameos.html' });

let result = null;
for (let i = 0; i < 120 && !result; i++) {
  await sleep(500);
  const r = await send('Runtime.evaluate', { expression: 'window.CAMEOS_RESULT ? JSON.stringify(window.CAMEOS_RESULT) : ""', returnByValue: true });
  if (r.result.value) result = JSON.parse(r.result.value);
}
chrome.kill();
if (!result) { console.error('Rien recu : le site est-il servi a ' + BASE + ' ?'); process.exit(1); }

/* La vitesse de marche du mod, pour que les pattes ne glissent pas au sol. */
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'wiki_data.json'), 'utf8'));
const speedOf = (slug) => {
  const e = data.entities.find((x) => x.path === slug);
  return (e && e.gameplay && e.gameplay.walk_speed_blocks_per_second) || 3;
};

/* Une planche identique n'est pas reecrite (Git ne la voit pas changer) ; celle
   d'une bete qui n'a plus de passant part. */
const dir = path.join(ASSETS, 'cameos');
fs.mkdirSync(dir, { recursive: true });
const meta = {};
for (const [slug, c] of Object.entries(result)) {
  const file = path.join(dir, slug + '.png');
  const png = Buffer.from(c.png.split(',')[1], 'base64');
  if (!fs.existsSync(file) || !fs.readFileSync(file).equals(png)) fs.writeFileSync(file, png);
  meta[slug] = { w: c.w, h: c.h, frames: c.frames, seconds: c.seconds, ground: c.ground, bps: +speedOf(slug).toFixed(2) };
}
for (const name of fs.readdirSync(dir)) {
  if (!meta[name.replace(/\.png$/, '')]) fs.rmSync(path.join(dir, name));
}
const js = `/* Genere par tools/build-cameos.mjs : ne pas modifier a la main.
   Les passants du pied de page (js/footer.js) : pour chaque bete, sa planche
   de marche assets/cameos/<slug>.png — w x h pixels par image, frames images
   pour un tour de seconds secondes, le sol a ground pixels du bas, bps blocs/s. */
window.OW = window.OW || {};
window.OW.CAMEOS = ${JSON.stringify(meta, null, 2)};
`;
fs.writeFileSync(path.join(ROOT, 'js', 'cameos.js'), js);
console.log('passants :', Object.keys(meta).join(', '));
process.exit(0);
