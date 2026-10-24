/* B.I.L.L.Y — le relais entre le wiki et une IA gratuite (POST /api/billy).

   Le panneau (js/billy.js) envoie { system, messages } ; ce relais choisit
   l'IA, garde la cle a l'abri, et renvoie le texte au fil de l'eau (text/plain).

   Les IA, dans l'ordre, selon les cles posees dans Netlify
   (Project configuration > Environment variables) :
     GEMINI_API_KEY   Google AI Studio, gratuit (aistudio.google.com/apikey)
                      modele : BILLY_GEMINI_MODEL, sinon gemini-flash-lite-latest
     GROQ_API_KEY     Groq, gratuit (console.groq.com/keys)
                      modele : BILLY_GROQ_MODEL, sinon llama-3.3-70b-versatile
   Si l'une echoue (quota du jour, panne), on passe a la suivante. Sans cle du
   tout, le relais repond 503 et Billy passe en « mode pisteur » : il repond
   avec la recherche du wiki, sans IA.

   Aucune dependance : rien a installer, la fonction part telle quelle. */

const MAX_SYSTEM = 80000;
const MAX_MESSAGES = 14;
const MAX_CONTENT = 2000;

/* Un visiteur ne vide pas le quota de tout le monde : 20 questions par
   tranche de 5 minutes et par adresse. En memoire, donc approximatif (chaque
   instance de la fonction compte de son cote), mais suffisant. */
const WINDOW_MS = 5 * 60 * 1000;
const PER_WINDOW = 20;
const seen = new Map();

function tooMany(ip) {
  const now = Date.now();
  const hits = (seen.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  seen.set(ip, hits);
  if (seen.size > 5000) seen.clear();
  return hits.length > PER_WINDOW;
}

function clean(body) {
  const system = typeof body.system === 'string' ? body.system.slice(0, MAX_SYSTEM) : '';
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT) }));
  if (!system || !messages.length || messages[messages.length - 1].role !== 'user') return null;
  return { system, messages };
}

/** Lance la requete et abandonne si l'IA n'a pas repondu en ms millisecondes.
    Le delai ne court que jusqu'a la reponse : le flux qui suit n'est pas coupe. */
async function within(ms, start) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('pas de reponse en ' + ms / 1000 + ' s')), ms);
  try {
    return await start(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Lit un flux SSE et n'en garde que le texte, via pick(json). */
function sseText(response, pick) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  return new ReadableStream({
    async pull(out) {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) { out.close(); return; }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();
        let text = '';
        for (const line of lines) {
          const m = line.match(/^data:\s*(.*)$/);
          if (!m || m[1] === '[DONE]') continue;
          try { text += pick(JSON.parse(m[1])) || ''; } catch (e) { /* morceau incomplet */ }
        }
        if (text) { out.enqueue(encoder.encode(text)); return; }
      }
    },
    cancel() { reader.cancel(); }
  });
}

const PROVIDERS = [
  {
    name: 'gemini',
    ready: () => !!process.env.GEMINI_API_KEY,
    async open({ system, messages }) {
      /* Les « flash » complets ne repondent pas en gratuit (plus de 20 s pour
         « bonjour », vu le 20/10/2026) et les 2.5 sont fermes aux nouveaux
         comptes : les « lite » repondent en moins d'une seconde. */
      const models = [process.env.BILLY_GEMINI_MODEL, 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite']
        .filter((m, i, all) => m && all.indexOf(m) === i);
      const why = [];
      /* Avec tout le savoir du wiki (pres de 27 000 caracteres, skins compris),
         le premier modele met parfois plus de 10 s a commencer (vu le
         22/10/2026) : 10 s chacun, et Billy retombait en mode pisteur. Le
         premier a donc le gros du temps, le second ce qui reste. */
      const budget = [17000, 7000];
      for (const [n, model] of models.entries()) {
        try {
          const r = await within(budget[n] || 5000, (signal) => fetch('https://generativelanguage.googleapis.com/v1beta/models/'
            + encodeURIComponent(model) + ':streamGenerateContent?alt=sse', {
            method: 'POST',
            signal,
            headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY.trim() },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
              generationConfig: { temperature: 0.6, maxOutputTokens: 2048 }
            })
          }));
          if (!r.ok || !r.body) throw new Error(r.status + ' ' + (await r.text()).replace(/\s+/g, ' ').slice(0, 160));
          return sseText(r, (j) => ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [])
            .filter((p) => !p.thought).map((p) => p.text || '').join(''));
        } catch (e) {
          why.push(model + ' : ' + e.message);
        }
      }
      throw new Error('gemini — ' + why.join(' | '));
    }
  },
  {
    name: 'groq',
    ready: () => !!process.env.GROQ_API_KEY,
    async open({ system, messages }) {
      const r = await within(10000, (signal) => fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.GROQ_API_KEY },
        body: JSON.stringify({
          model: process.env.BILLY_GROQ_MODEL || 'llama-3.3-70b-versatile',
          stream: true,
          temperature: 0.6,
          max_tokens: 900,
          messages: [{ role: 'system', content: system }].concat(messages)
        })
      }));
      if (!r.ok || !r.body) throw new Error('groq ' + r.status + ' ' + (await r.text()).slice(0, 200));
      return sseText(r, (j) => j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content);
    }
  }
];

/* Le wiki ouvert en local (Live Server, tools/serve.py, un telephone sur le
   reseau de la maison) n'a pas de fonction : il appelle celle-ci. Le navigateur
   ne le laisse faire que si elle autorise ces adresses. */
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/;

function cors(req) {
  const origin = req.headers.get('origin');
  if (!origin || !LOCAL.test(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin'
  };
}

export default async (req, context) => {
  const headers = cors(req);
  const reply = (data, status) => Response.json(data, { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response('POST seulement', { status: 405, headers });

  const ready = PROVIDERS.filter((p) => p.ready());
  if (!ready.length) return reply({ error: 'aucune cle posee' }, 503);

  const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || 'inconnu';
  if (tooMany(ip)) return reply({ error: 'trop de questions, pause de quelques minutes' }, 429);

  let body;
  try { body = clean(await req.json()); } catch (e) { body = null; }
  if (!body) return reply({ error: 'requete invalide' }, 400);

  const why = [];
  for (const provider of ready) {
    try {
      const stream = await provider.open(body);
      return new Response(stream, {
        headers: Object.assign({ 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-billy-ai': provider.name }, headers)
      });
    } catch (e) {
      console.warn('Billy :', e.message);
      /* La raison donnee par l'IA (quota, modele inconnu...) : jamais la cle. */
      why.push(String(e.message).split(process.env.GEMINI_API_KEY || '#').join('***').slice(0, 300));
    }
  }
  return reply({ error: 'aucune IA disponible', why }, 502);
};

export const config = { path: '/api/billy' };
