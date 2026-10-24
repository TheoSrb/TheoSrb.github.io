/* Les langues du wiki — traduction automatique en direct.

   Le wiki est ecrit en francais : c'est la langue source, celle des gabarits
   et de data/wiki_data.json. Dans une autre langue, la page est traduite a la
   volee par un service de traduction en ligne, la ou elle s'affiche :

     - un parcours des noeuds de texte et de quelques attributs (placeholder,
       title, aria-label, alt), puis un MutationObserver qui traduit tout ce
       que les pages construisent ensuite — fiches, filtres, info-bulles ;
     - une phrase coupee par du gras ou de l'italique (<strong>, <em>…) part
       entiere, balises comprises : elle est traduite dans son contexte ;
     - les textes sont envoyes par lots (des dizaines par requete) ;
     - chaque traduction est gardee dans le navigateur (localStorage) : un texte
       n'est demande qu'une fois, la visite suivante est instantanee ;
     - les noms propres (Operation W.I.L.D, NeoForge…) ne passent jamais par le
       traducteur, et quelques abreviations de jeu (PV, DGT…) ont leur forme
       fixe dans chaque langue — un traducteur lit « PV » comme « photovoltaique » ;
     - un petit glossaire donne leur forme aux libelles courts du jeu (menus,
       chapitres, termes Minecraft), que le traducteur rate faute de contexte.

   Services, dans l'ordre : Google Traduction (point d'acces public, par lots),
   puis le traducteur integre au navigateur quand il existe (Chrome), puis
   MyMemory. Si aucun ne repond, la page reste en francais.

   Choix de la langue : le choix du visiteur (menu de l'en-tete, garde dans
   localStorage), sinon la langue du systeme si le wiki la parle, sinon
   l'anglais. Le script en tete de chaque page applique ce choix avant le
   premier rendu.

   Les textes du mod (noms, lore, descriptions) sont traduits de la meme facon.
   Des que l'export du mod contiendra lui-meme la langue (en_us, es_es, pt_pt,
   ru_ru), wiki-data.js prendra ces textes officiels a la place.
   (Portugais : celui du Portugal, pt-PT / pt_pt.) */

(function (OW) {
  'use strict';

  const KEY = 'ow-lang';

  /* Les langues du mod (dossier lang/ du jeu). `mc` est le fichier de langue
     de l'export, `api` le code du service de traduction, `gloss` la langue du
     glossaire a utiliser (voir plus bas), `short` ce qui s'affiche dans la
     barre. */
  const LANGS = [
    { code: 'fr', name: 'Français', region: 'France', short: 'FR', mc: 'fr_fr', api: 'fr' },
    { code: 'en', name: 'English', region: 'United States', short: 'EN', mc: 'en_us', api: 'en', gloss: 'en' },
    { code: 'en-gb', name: 'English', region: 'United Kingdom', short: 'GB', mc: 'en_gb', api: 'en', gloss: 'en' },
    { code: 'es', name: 'Español', region: 'España', short: 'ES', mc: 'es_es', api: 'es', gloss: 'es' },
    { code: 'es-mx', name: 'Español', region: 'México', short: 'MX', mc: 'es_mx', api: 'es', gloss: 'es' },
    { code: 'de', name: 'Deutsch', region: 'Deutschland', short: 'DE', mc: 'de_de', api: 'de' },
    { code: 'de-ch', name: 'Deutsch', region: 'Schweiz', short: 'CH', mc: 'de_ch', api: 'de' },
    { code: 'pt', name: 'Português', region: 'Portugal', short: 'PT', mc: 'pt_pt', api: 'pt-PT', gloss: 'pt' },
    { code: 'pt-br', name: 'Português', region: 'Brasil', short: 'BR', mc: 'pt_br', api: 'pt-BR', gloss: 'pt' },
    { code: 'ru', name: 'Русский', region: 'Россия', short: 'RU', mc: 'ru_ru', api: 'ru', gloss: 'ru' },
    { code: 'ja', name: '日本語', region: '日本', short: 'JA', mc: 'ja_jp', api: 'ja' },
    { code: 'ko', name: '한국어', region: '대한민국', short: 'KO', mc: 'ko_kr', api: 'ko' },
    { code: 'zh-cn', name: '简体中文', region: '中国', short: 'CN', mc: 'zh_cn', api: 'zh-CN' },
    { code: 'zh-tw', name: '繁體中文', region: '台灣', short: 'TW', mc: 'zh_tw', api: 'zh-TW' }
  ];
  LANGS.forEach((l) => { l.flag = 'assets/ui/flags/' + l.code + '.png'; });

  const CODES = LANGS.map((l) => l.code);

  function systemLang() {
    const list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
    for (let i = 0; i < list.length; i++) {
      const tag = String(list[i] || '').toLowerCase();
      /* « pt-BR » avant « pt » : la variante regionale gagne quand elle existe. */
      if (CODES.indexOf(tag) !== -1) return tag;
      const base = tag.slice(0, 2);
      const hit = LANGS.find((l) => l.code === base) || LANGS.find((l) => l.code.slice(0, 2) === base);
      if (hit) return hit.code;
    }
    return 'en';
  }

  function storedChoice() {
    try {
      const v = window.localStorage.getItem(KEY);
      if (CODES.indexOf(v) !== -1) return v;
    } catch (e) { /* stockage bloque */ }
    return null;
  }

  const lang = storedChoice() || systemLang();
  const info = LANGS.find((l) => l.code === lang) || LANGS[0];
  const active = lang !== 'fr';
  const root = document.documentElement;

  /* ===========================================================================
     Terminologie : ce que le traducteur ne doit pas toucher
     =========================================================================== */

  /* Remplaces par un jeton protege avant l'envoi, restitues apres. */
  const TERMS = [
    ['Operation W.I.L.D', null],
    ['OPERATION W.I.L.D', null],
    ['W.I.L.D', null],
    ['NeoForge', null],
    ['TerraBlender', null],
    ['Minecraft', null],
    ['Wildoween', null],
    ['Seabug', null],
    ['PV', { en: 'HP', es: 'PV', pt: 'PV', ru: 'ОЗ' }]
  ];
  const termOut = (i) => (TERMS[i][1] && TERMS[i][1][lang]) || TERMS[i][0];
  const termRe = new RegExp('(^|[^\\wÀ-ÿ])(' + TERMS.map((t) => t[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\wÀ-ÿ])', 'g');

  /* Le glossaire : les libelles courts du jeu, que le traducteur rate faute
     de contexte (« Palier » devient « Landing », « Butin » « Booty »,
     « Établi » « Established », « Accueil » « Welcome »…). Seul un libelle
     identique a une entree (casse mise a part) prend la forme du glossaire ;
     tout le reste — phrases, paragraphes, textes du mod — passe par le
     traducteur en direct. Les termes Minecraft suivent la traduction
     officielle du jeu dans chaque langue. */
  const GLOSSARY = {
    /* navigation et en-tete */
    'Accueil': ['Home', 'Inicio', 'Início', 'Главная'],
    'Objets': ['Items', 'Objetos', 'Itens', 'Предметы'],
    'Mécaniques': ['Mechanics', 'Mecánicas', 'Mecânicas', 'Механики'],
    'Rechercher': ['Search', 'Buscar', 'Pesquisar', 'Поиск'],
    'Cosmétiques': ['Cosmetics', 'Cosméticos', 'Cosméticos', 'Косметика'],
    'Ouvrir': ['Open', 'Abrir', 'Abrir', 'Открыть'],
    'Lancer': ['Run', 'Ejecutar', 'Executar', 'Запустить'],
    'famille': ['category', 'categoría', 'categoria', 'категория'],
    'Complets': ['Full', 'Completos', 'Completos', 'Полные'],
    'Allégés': ['Light', 'Ligeros', 'Leves', 'Облегчённые'],
    'Auto': ['Auto', 'Auto', 'Auto', 'Авто'],
    'Carrousel': ['Carousel', 'Carrusel', 'Carrossel', 'Карусель'],
    'Cartes': ['Cards', 'Cartas', 'Cards', 'Карточки'],
    'Fiche →': ['Page →', 'Ficha →', 'Ficha →', 'Страница →'],
    'Découvrir': ['Discover', 'Descubrir', 'Descobrir', 'Узнать'],
    'à apprivoiser, monter, faire évoluer et personnaliser': [
      'to tame, ride, level up and customize', 'para domesticar, montar, mejorar y personalizar',
      'para domar, montar, evoluir e personalizar', 'чтобы приручать, седлать, развивать и настраивать'],
    /* les chapitres d'une fiche */
    'Apprivoisement': ['Taming', 'Domesticación', 'Domesticação', 'Приручение'],
    'Apparition': ['Spawning', 'Aparición', 'Surgimento', 'Появление'],
    'Journal': ['Journal', 'Diario', 'Diário', 'Журнал'],
    'Animations': ['Animations', 'Animaciones', 'Animações', 'Анимации'],
    'Variantes': ['Variants', 'Variantes', 'Variantes', 'Варианты'],
    'Statistiques': ['Stats', 'Estadísticas', 'Estatísticas', 'Характеристики'],
    'Butin': ['Loot', 'Botín', 'Espólio', 'Добыча'],
    'Capacités montées': ['Mounted abilities', 'Habilidades en montura', 'Habilidades montado', 'Способности верхом'],
    'Montable': ['Rideable', 'Montable', 'Montável', 'Ездовое'],
    'Dégâts': ['Damage', 'Daño', 'Dano', 'Урон'],
    'Sauvage': ['Wild', 'Salvaje', 'Selvagem', 'Дикое'],
    'Sauvages': ['Wild', 'Salvajes', 'Selvagens', 'Дикие'],
    'Piste Sauvage': ['Wild Trail', 'Senda Salvaje', 'Trilha Selvagem', 'Дикая тропа'],
    'La Piste Sauvage': ['The Wild Trail', 'La Senda Salvaje', 'A Trilha Selvagem', 'Дикая тропа'],
    /* la Piste Sauvage */
    'Palier': ['Tier', 'Nivel', 'Nível', 'Ступень'],
    'Départ': ['Start', 'Inicio', 'Início', 'Старт'],
    'Pièces': ['Coins', 'Monedas', 'Moedas', 'Монеты'],
    'Capacité': ['Ability', 'Habilidad', 'Habilidade', 'Способность'],
    'Acquis': ['Owned', 'Obtenido', 'Obtido', 'Получено'],
    'Nœud mystère': ['Mystery node', 'Nodo misterioso', 'Nó misterioso', 'Загадочный узел'],
    'Niveau trop bas': ['Level too low', 'Nivel insuficiente', 'Nível muito baixo', 'Слишком низкий уровень'],
    'Tout débloquer': ['Unlock all', 'Desbloquear todo', 'Desbloquear tudo', 'Открыть всё'],
    'Réinitialiser': ['Reset', 'Restablecer', 'Redefinir', 'Сбросить'],
    'Pièces sauvages': ['Wild coins', 'Monedas salvajes', 'Moedas selvagens', 'Дикие монеты'],
    /* objets et recettes (termes officiels de Minecraft) */
    'Établi': ['Crafting table', 'Mesa de trabajo', 'Bancada', 'Верстак'],
    'ÉTABLI': ['CRAFTING TABLE', 'MESA DE TRABAJO', 'BANCADA', 'ВЕРСТАК'],
    'Selle': ['Saddle', 'Silla de montar', 'Sela', 'Седло'],
    'Selles': ['Saddles', 'Sillas de montar', 'Selas', 'Сёдла'],
    'Recette façonnée': ['Shaped recipe', 'Receta con forma', 'Receita com formato', 'Рецепт с формой'],
    'Glissance': ['Slipperiness', 'Deslizamiento', 'Escorregamento', 'Скольжение'],
    'Construction': ['Building', 'Construcción', 'Construção', 'Строительство'],
    /* la fiche d'un biome */
    'Troncs': ['Tree trunks', 'Troncos', 'Troncos', 'Стволы'],
    'Troncs lointains': ['Distant trunks', 'Troncos lejanos', 'Troncos distantes', 'Дальние стволы'],
    'Canopée': ['Canopy', 'Dosel', 'Dossel', 'Полог леса'],
    'Lointain': ['Background', 'Fondo', 'Fundo', 'Дальний план'],
    'Milieu': ['Middle ground', 'Plano medio', 'Plano médio', 'Средний план'],
    'Liseré': ['Rim light', 'Contraluz', 'Contraluz', 'Контровой свет'],
    'Récolter': ['Gather', 'Recolectar', 'Coletar', 'Добыть'],
    'Construire': ['Build', 'Construir', 'Construir', 'Построить'],
    'Habitants': ['Inhabitants', 'Habitantes', 'Habitantes', 'Обитатели'],
    'Fiche technique': ['Technical data', 'Ficha técnica', 'Ficha técnica', 'Технические данные'],
    /* la table de sons */
    'Enchaîner': ['Play all', 'Reproducir todo', 'Tocar tudo', 'Играть подряд'],
    'Au hasard': ['Shuffle', 'Aleatorio', 'Aleatório', 'Случайно'],
    'Skin Virus': ['Virus skin', 'Skin Virus', 'Skin Virus', 'Скин «Вирус»'],
    /* succes */
    'Succès': ['Achievements', 'Logros', 'Conquistas', 'Достижения'],
    'Obtenu': ['Unlocked', 'Conseguido', 'Obtido', 'Получено'],
    'Obtenus': ['Unlocked', 'Conseguidos', 'Obtidos', 'Получены'],
    'Succès obtenu !': ['Achievement unlocked!', '¡Logro conseguido!', 'Conquista obtida!', 'Достижение получено!'],
    /* combat */
    'Équilibré': ['Balanced', 'Equilibrado', 'Equilibrado', 'Сбалансированный'],
    'DPS': ['DPS', 'DPS', 'DPS', 'DPS'],
    'Tri PV': ['Sort by HP', 'Ordenar por PV', 'Ordenar por PV', 'По ОЗ'],
    'Tri dégâts': ['Sort by damage', 'Ordenar por daño', 'Ordenar por dano', 'По урону'],
    'Tri A à Z': ['Sort A–Z', 'Orden A–Z', 'Ordem A–Z', 'По алфавиту'],
    /* abreviations des cadrans */
    'PV': ['HP', 'PV', 'PV', 'ОЗ'],
    'DGT': ['DMG', 'DAÑ', 'DAN', 'УРН'],
    'Dég': ['Dmg', 'Dañ', 'Dan', 'Урн'],
    'Rés': ['Res', 'Res', 'Res', 'Защ'],
    'Résist.': ['Resist.', 'Resist.', 'Resist.', 'Защита'],
    'RÉSIST': ['RESIST', 'RESIST', 'RESIST', 'ЗАЩИТА'],
    'VIT': ['SPD', 'VEL', 'VEL', 'СКР'],
    'Vit': ['Spd', 'Vel', 'Vel', 'Скр'],
    'NRG': ['NRG', 'ENE', 'ENE', 'ЭНР'],
    'Éne': ['Nrg', 'Ene', 'Ene', 'Энр'],
    'XP': ['XP', 'XP', 'XP', 'XP'],
    'b/s': ['b/s', 'b/s', 'b/s', 'бл/с']
  };
  const GLOSS_INDEX = { en: 0, es: 1, pt: 2, ru: 3 };
  const glossLang = info.gloss || null;
  const glossLower = {};
  Object.keys(GLOSSARY).forEach((k) => { glossLower[k.toLowerCase()] = GLOSSARY[k]; });

  /** La forme du glossaire dans la langue affichee, ou null. */
  function gloss(key) {
    const row = GLOSSARY[key] || glossLower[key.toLowerCase()];
    if (!row || !glossLang) return null;
    return matchCase(key, row[GLOSS_INDEX[glossLang]]);
  }

  /* Les langues sans glossaire (allemand, japonais, coreen, chinois) partent de
     l'anglais pour ces libelles : « Butin » -> « Loot » -> « Beute ». Un
     traducteur comprend bien mieux « Loot » que « Butin » hors contexte. */
  function glossSource(key) {
    if (glossLang) return null;
    const row = GLOSSARY[key] || glossLower[key.toLowerCase()];
    return row ? row[GLOSS_INDEX.en] : null;
  }

  /* ===========================================================================
     Le cache
     =========================================================================== */

  const CACHE_KEY = 'ow-mt-' + lang + '-v1';
  let cache = {};
  if (active) {
    try { cache = JSON.parse(window.localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { cache = {}; }
  }
  let saveTimer = 0;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch (e) {
        /* Plein : on repart d'un cache vide plutot que de ne plus rien garder. */
        try { window.localStorage.removeItem(CACHE_KEY); } catch (err) { /* rien */ }
      }
    }, 900);
  }

  /* ===========================================================================
     Preparation d'un texte : jetons proteges, echappement, restitution
     =========================================================================== */

  const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const decoder = document.createElement('textarea');
  function decodeHtml(s) {
    decoder.innerHTML = s;
    return decoder.value;
  }

  function protect(text) {
    return text.replace(termRe, (all, lead, term) => {
      const i = TERMS.findIndex((t) => t[0] === term);
      return lead + '<span translate="no">X' + i + 'X</span>';
    });
  }

  function restore(html) {
    return html
      .replace(/<span translate="no">\s*X(\d+)X\s*<\/span>(\s+(?=[,.;:!?)\]»]))?/gi, (all, i) => escapeHtml(termOut(+i)))
      .replace(/<span translate=\\?"no\\?">\s*X(\d+)X\s*<\/span>/gi, (all, i) => escapeHtml(termOut(+i)));
  }

  /** La casse de la source : un titre en capitales le reste, une majuscule initiale aussi. */
  function matchCase(source, out) {
    /* Le japonais, le coreen et le chinois n'ont pas de casse : on n'y touche pas. */
    if (/^(ja|ko|zh)/.test(lang)) return out;
    const letters = source.replace(/[^A-Za-zÀ-ÿ]/g, '');
    if (letters.length > 1 && letters === letters.toUpperCase()) return out.toLocaleUpperCase(lang);
    const first = source.match(/[A-Za-zÀ-ÿ]/);
    const outFirst = out.match(/\p{L}/u);
    if (first && outFirst && first[0] === first[0].toUpperCase() && outFirst[0] !== outFirst[0].toLocaleUpperCase(lang)) {
      const at = out.indexOf(outFirst[0]);
      return out.slice(0, at) + outFirst[0].toLocaleUpperCase(lang) + out.slice(at + 1);
    }
    return out;
  }

  /* Ce qui ne se traduit pas : nombres, identifiants, constantes, codes. */
  function untranslatable(key) {
    if (!/[A-Za-zÀ-ÿ]/.test(key)) return true;
    if (key.length < 2) return true;
    if (/^[a-z0-9_.-]+:[a-z0-9_/.#-]+$/i.test(key)) return true;
    if (/^#[0-9a-f]{3,8}$/i.test(key)) return true;
    if (/^[A-Z0-9_]+$/.test(key) && key.indexOf('_') !== -1) return true;
    if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(key)) return true;
    if (/^(operation\s+)?w\.i\.l\.d$/i.test(key)) return true;
    if (/^(neoforge|terrablender|minecraft)(\s+[\d.]+)?$/i.test(key)) return true;
    if (/^[\d\s.,×x+\-–—/:()]+(b\/s|s|ms|%|px|pts?)?$/i.test(key)) return true;
    if (/^(v|version\s)?[\d.]+(-[a-z0-9.]+)?$/i.test(key)) return true;
    return false;
  }

  /* ===========================================================================
     Les services de traduction
     =========================================================================== */

  const GOOGLE = (sl) => 'https://translate.googleapis.com/translate_a/t?client=gtx&sl=' + sl
    + '&tl=' + info.api + '&format=html';

  async function viaGoogle(sources, sl) {
    const body = new URLSearchParams();
    sources.forEach((s) => body.append('q', s));
    const r = await fetch(GOOGLE(sl || 'fr'), { method: 'POST', body });
    if (!r.ok) throw new Error('google ' + r.status);
    const json = await r.json();
    const list = Array.isArray(json) ? json : [json];
    /* Une seule entree peut revenir comme [texte, langue] : on la deplie. */
    return list.map((x) => (Array.isArray(x) ? x[0] : x));
  }

  let chromeTranslator = null;
  async function viaBrowser(sources, sl) {
    if (!('Translator' in self)) throw new Error('no browser translator');
    if (!chromeTranslator || chromeTranslator.sl !== (sl || 'fr')) {
      const opts = { sourceLanguage: (sl || 'fr').slice(0, 2), targetLanguage: info.api.slice(0, 2) };
      const availability = await self.Translator.availability(opts);
      if (availability !== 'available') throw new Error('browser translator ' + availability);
      chromeTranslator = await self.Translator.create(opts);
      chromeTranslator.sl = sl || 'fr';
    }
    const out = [];
    for (const s of sources) {
      /* eslint-disable no-await-in-loop -- le traducteur integre travaille un texte a la fois */
      out.push(await chromeTranslator.translate(s));
    }
    return out;
  }

  async function viaMyMemory(sources, sl) {
    const out = [];
    for (const s of sources) {
      const plain = decodeHtml(s.replace(/<[^>]+>/g, ''));
      const r = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(plain.slice(0, 480)) + '&langpair=' + (sl || 'fr').slice(0, 2) + '|' + info.api.slice(0, 2));
      const json = await r.json();
      if (!json || !json.responseData || json.quotaFinished) throw new Error('mymemory');
      out.push(escapeHtml(json.responseData.translatedText || plain));
    }
    return out;
  }

  let googleDownUntil = 0;
  async function translateBatch(sources, sl) {
    if (Date.now() > googleDownUntil) {
      try { return await viaGoogle(sources, sl); } catch (e) { googleDownUntil = Date.now() + 60000; }
    }
    try { return await viaBrowser(sources, sl); } catch (e) { /* suivant */ }
    return viaMyMemory(sources.slice(0, 20), sl).then((out) => out.concat(sources.slice(20)));
  }

  /* ===========================================================================
     La file d'attente
     =========================================================================== */

  const waiting = new Map();   /* cle -> [appliquer, ...] */
  let queue = [];              /* { key, send, mode, source } */
  let flushTimer = 0;
  let inFlight = 0;
  const MAX_ITEMS = 60;
  const MAX_CHARS = 4200;
  const MAX_PARALLEL = 4;
  const idleWaiters = [];

  function whenIdle() {
    if (!queue.length && !inFlight) return Promise.resolve();
    return new Promise((resolve) => idleWaiters.push(resolve));
  }
  function checkIdle() {
    if (queue.length || inFlight) return;
    while (idleWaiters.length) idleWaiters.shift()();
  }

  /** Demande la traduction d'une source ; `apply` recoit le resultat. */
  function request(mode, source, apply) {
    const key = (mode === 'h' ? 'h:' : 't:') + source;
    if (Object.prototype.hasOwnProperty.call(cache, key)) { if (apply) apply(cache[key]); return; }
    let list = waiting.get(key);
    if (!list) {
      list = [];
      waiting.set(key, list);
      /* Un libelle du glossaire part de sa forme anglaise quand la langue n'a
         pas de glossaire : le traducteur a alors le bon sens du mot. */
      const english = mode === 't' ? glossSource(source) : null;
      const text = english || source;
      const send = mode === 'h' ? protectHtml(text) : protect(escapeHtml(text));
      queue.push({ key, send, mode, source, sl: english ? 'en' : 'fr' });
      schedule();
    }
    if (apply) list.push(apply);
  }

  function protectHtml(html) {
    return html.split(/(<[^>]+>)/).map((part) => (part.charAt(0) === '<' ? part : protect(part))).join('');
  }

  function schedule() {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, 40);
  }

  function flush() {
    flushTimer = 0;
    while (queue.length && inFlight < MAX_PARALLEL) {
      const batch = [];
      let chars = 0;
      const sl = queue[0].sl;
      /* Un lot ne melange pas deux langues sources. */
      while (queue.length && queue[0].sl === sl && batch.length < MAX_ITEMS
        && (chars + queue[0].send.length < MAX_CHARS || !batch.length)) {
        const item = queue.shift();
        chars += item.send.length;
        batch.push(item);
      }
      inFlight++;
      translateBatch(batch.map((b) => b.send), sl)
        .then((results) => {
          batch.forEach((item, i) => {
            const raw = results[i];
            if (raw == null) return;
            let out = restore(String(raw))
              /* Le traducteur glisse une espace entre une balise fermante et la ponctuation. */
              .replace(/(<\/(?:b|strong|em|i|u|s|small|sub|sup)>)\s+([,.;:!?)\]»])/gi, '$1$2');
            if (item.mode === 't') out = matchCase(item.source, decodeHtml(out).replace(/\s+/g, ' ').trim());
            cache[item.key] = out;
            (waiting.get(item.key) || []).forEach((fn) => { try { fn(out); } catch (e) { /* noeud disparu */ } });
            waiting.delete(item.key);
          });
          persist();
        })
        .catch(() => {
          /* Aucun service : le texte reste en francais, et on ne redemande pas en boucle. */
          batch.forEach((item) => {
            cache[item.key] = item.mode === 'h' ? item.source : item.source;
            waiting.delete(item.key);
          });
        })
        .finally(() => {
          inFlight--;
          if (queue.length) schedule();
          checkIdle();
        });
    }
  }

  /** Traduction synchrone si deja connue (sinon le texte d'origine, et la demande part). */
  function t(text) {
    if (!active || text == null) return text;
    const key = String(text).replace(/\s+/g, ' ').trim();
    if (!key || untranslatable(key)) return text;
    const g = gloss(key);
    if (g) return g;
    const hit = cache['t:' + key];
    if (hit != null) return hit;
    request('t', key, null);
    return text;
  }

  /* ===========================================================================
     La page
     =========================================================================== */

  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1, TEXTAREA: 1, CANVAS: 1, AUDIO: 1, VIDEO: 1, KBD: 1 };
  const INLINE = { B: 1, STRONG: 1, EM: 1, I: 1, U: 1, S: 1, SMALL: 1, BR: 1, SUB: 1, SUP: 1 };
  const textDone = new WeakMap();   /* noeud de texte -> valeur qu'on y a ecrite */
  const attrDone = new WeakMap();   /* element -> { attribut: valeur ecrite } */
  const richDone = new WeakMap();   /* element -> innerHTML qu'on y a ecrit */

  function skipped(el) {
    if (!el || el.nodeType !== 1) return false;
    if (SKIP_TAGS[el.tagName]) return true;
    if (el.getAttribute('translate') === 'no') return true;
    return el.classList.contains('bw') || el.classList.contains('bw-scene') || el.hasAttribute('data-no-i18n');
  }

  function closestSkipped(el) {
    let n = el;
    while (n && n !== document.body && n !== root) {
      if (skipped(n)) return true;
      n = n.parentElement;
    }
    return false;
  }

  /* Un paragraphe dont le texte est coupe par du gras ou de l'italique part
     entier : « Le <b>Tigre</b> est un félin » se traduit dans son contexte,
     et non en trois morceaux. Seulement quand ses enfants sont de simples
     balises de mise en forme, sans attribut : les remplacer ne casse rien. */
  /* Des balises de mise en forme sans attribut, eventuellement imbriquees
     (<strong><u>Tigre</u></strong>), et du texte : rien d'autre. */
  function inlineOnly(el, depth) {
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) continue;
      if (n.nodeType !== 1 || !INLINE[n.tagName] || n.attributes.length || depth > 3) return false;
      if (!inlineOnly(n, depth + 1)) return false;
    }
    return true;
  }

  function isRich(el) {
    if (!el.firstElementChild || INLINE[el.tagName] || SKIP_TAGS[el.tagName]) return false;
    let text = false;
    for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.data.trim()) { text = true; break; }
    if (!text && el.childElementCount < 2) return false;
    return inlineOnly(el, 0) && el.textContent.trim().length > 12;
  }

  function richAncestor(node) {
    let n = node.nodeType === 1 ? node : node.parentElement;
    for (let depth = 0; n && depth < 3; depth++, n = n.parentElement) {
      if (richDone.has(n)) return n;
    }
    return null;
  }

  function translateRich(el) {
    const html = el.innerHTML;
    if (richDone.get(el) === html) return true;
    const key = html.replace(/\s+/g, ' ').trim();
    request('h', key, (out) => {
      if (el.innerHTML.replace(/\s+/g, ' ').trim() !== key) return;
      richDone.set(el, out);
      el.innerHTML = out;
      richDone.set(el, el.innerHTML);
    });
    return true;
  }

  function translateText(node) {
    const value = node.data;
    if (textDone.get(node) === value) return;
    const key = value.replace(/\s+/g, ' ').trim();
    if (!key || untranslatable(key)) { textDone.set(node, value); return; }
    const lead = value.match(/^\s*/)[0];
    const trail = value.match(/\s*$/)[0];
    const write = (out) => {
      if (node.data !== value) return;
      const next = lead + out + trail;
      textDone.set(node, next);
      if (next !== value) node.data = next;
    };
    const g = gloss(key);
    if (g) { write(g); return; }
    textDone.set(node, value);
    request('t', key, write);
  }

  function translateAttrs(el) {
    for (let i = 0; i < ATTRS.length; i++) {
      const name = ATTRS[i];
      const value = el.getAttribute(name);
      if (!value) continue;
      const bag = attrDone.get(el) || {};
      if (bag[name] === value) continue;
      const key = value.replace(/\s+/g, ' ').trim();
      if (untranslatable(key)) continue;
      bag[name] = value;
      attrDone.set(el, bag);
      const g = gloss(key);
      const write = (out) => {
        if (el.getAttribute(name) !== value) return;
        bag[name] = out;
        if (out !== value) el.setAttribute(name, out);
      };
      if (g) write(g);
      else request('t', key, write);
    }
  }

  function translateTree(start) {
    if (!active || !start) return;
    if (start.nodeType === 3) {
      const parent = start.parentElement;
      if (!parent || closestSkipped(parent) || richAncestor(start)) return;
      if (isRich(parent)) { translateRich(parent); return; }
      translateText(start);
      return;
    }
    if (start.nodeType !== 1 && start.nodeType !== 9 && start.nodeType !== 11) return;
    if (start.nodeType === 1) {
      if (closestSkipped(start) || richAncestor(start)) return;
      translateAttrs(start);
      if (isRich(start)) { translateRich(start); return; }
    }
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === 1) {
          if (skipped(node)) return NodeFilter.FILTER_REJECT;
          if (isRich(node)) { translateAttrs(node); translateRich(node); return NodeFilter.FILTER_REJECT; }
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === 3) translateText(node);
      else translateAttrs(node);
      node = walker.nextNode();
    }
  }

  let observer = null;
  function watch() {
    if (observer || !('MutationObserver' in window)) return;
    observer = new MutationObserver((records) => {
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        if (r.type === 'childList') {
          if (richDone.has(r.target) && richDone.get(r.target) === r.target.innerHTML) continue;
          for (let j = 0; j < r.addedNodes.length; j++) translateTree(r.addedNodes[j]);
        } else if (r.type === 'characterData') {
          translateTree(r.target);
        } else if (r.type === 'attributes' && r.target.nodeType === 1 && !closestSkipped(r.target)) {
          translateAttrs(r.target);
        }
      }
    });
    observer.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
  }

  /* Le titre de l'onglet : « Tigre - Operation W.I.L.D » */
  let titleSource = null;
  function translateTitle() {
    const title = document.title;
    if (title === titleSource) return;
    const parts = title.split(' - ');
    const head = parts[0];
    if (!head || untranslatable(head)) return;
    titleSource = title;
    request('t', head.trim(), (out) => {
      if (document.title !== title) return;
      titleSource = [out].concat(parts.slice(1)).join(' - ');
      document.title = titleSource;
    });
  }

  function unveil() { root.removeAttribute('data-i18n-pending'); }

  /* Les libelles que le CSS affiche lui-meme (content:), via une variable. */
  const CSS_LABELS = { '--label-on-stage': 'EN SCÈNE' };
  function translateCssLabels() {
    Object.keys(CSS_LABELS).forEach((name) => {
      request('t', CSS_LABELS[name], (out) => root.style.setProperty(name, JSON.stringify(out)));
    });
  }

  function boot() {
    root.lang = lang;
    if (!active) { unveil(); return; }
    translateTree(document.body);
    translateTitle();
    translateCssLabels();
    watch();
    const titleEl = document.querySelector('title');
    if (titleEl && 'MutationObserver' in window) {
      new MutationObserver(translateTitle).observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
    /* Le premier rendu attend la premiere vague de traductions — quelques
       centaines de millisecondes la premiere fois, rien ensuite (cache). */
    Promise.race([whenIdle(), new Promise((r) => setTimeout(r, 1100))]).then(unveil);
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);

  /* ===========================================================================
     Changer de langue
     =========================================================================== */

  function setLanguage(next) {
    if (CODES.indexOf(next) === -1) return;
    try { window.localStorage.setItem(KEY, next); } catch (e) { /* rien */ }
    if (next === lang) return;
    window.location.reload();
  }

  OW.i18n = {
    LANGS,
    lang,
    system: systemLang(),
    mc: info.mc,
    active,
    t,
    translate: translateTree,
    setLanguage,
    ready: whenIdle
  };
  OW.t = t;
}(window.OW = window.OW || {}));
