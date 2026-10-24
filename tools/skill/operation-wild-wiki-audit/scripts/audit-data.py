"""Compare le wiki aux vraies donnees : l'export du mod, le code Java, les tables
de libelles du site. Ne modifie rien : produit un rapport de ce qui est en
retard, manquant, ou affiche en brut faute de traduction francaise.

Usage :
    python audit-data.py [--wiki <dossier du wiki>] [--mod <projet du mod>] [--out rapport.md]

Par defaut : le wiki = dossier courant (ou celui qui contient data/wiki_data.json),
le mod = la cle "mod" de tools/paths.json du wiki.

Ce que le rapport contient, dans l'ordre :
  1. Fraicheur  : export du mod plus recent que data/wiki_data.json ? champs de
                  l'export que le site n'a pas encore ?
  2. Goals      : comportements sauvages sans phrase francaise dans BEHAVIOUR_LABEL
                  (js/animal.js), classes qui ne sont pas des goals, betes sans
                  dossier de goals mais avec des goals propres dans leur classe.
  3. Animations : noms du Java absents de data/models.json (lecteur casse ?) et
                  animations sans libelle francais (ANIM_LABEL).
  4. Variantes  : noms sans libelle (VARIANT_FR).
  5. Objets vanilla cites par les donnees sans nom francais (VANILLA_NAMES).
  6. Constantes d'attaque sans libelle (CONSTANT_FR) : elles s'affichent en anglais.
  7. Libelles de langue : sachets {key, plain, translations} sans fr_fr, texte casse.
Chaque ligne donne le fichier Java a lire pour ecrire la bonne phrase.
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime

# ---------------------------------------------------------------- chemins


def find_wiki(start):
    d = os.path.abspath(start)
    while True:
        if os.path.exists(os.path.join(d, "data", "wiki_data.json")) and os.path.isdir(os.path.join(d, "js")):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            return None
        d = parent


ap = argparse.ArgumentParser()
ap.add_argument("--wiki")
ap.add_argument("--mod")
ap.add_argument("--out")
args = ap.parse_args()

WIKI = args.wiki or find_wiki(os.getcwd()) or find_wiki(os.path.dirname(os.path.abspath(__file__)))
if not WIKI:
    sys.exit("Wiki introuvable : lancer depuis son dossier ou passer --wiki.")
cfg = {}
try:
    cfg = json.load(open(os.path.join(WIKI, "tools", "paths.json"), encoding="utf-8"))
except OSError:
    pass
MOD = args.mod or cfg.get("mod")
JAVA = os.path.join(MOD, "src", "main", "java", "net", "tiew", "operationWild") if MOD else None
EXPORT = os.path.join(MOD, "src", "generated", "resources", "wiki_data.json") if MOD else None

read = lambda p: open(p, encoding="utf-8").read()
site = json.load(open(os.path.join(WIKI, "data", "wiki_data.json"), encoding="utf-8"))
models = {}
try:
    models = json.load(open(os.path.join(WIKI, "data", "models.json"), encoding="utf-8"))
except OSError:
    pass
hidden = {}
try:
    hidden = json.load(open(os.path.join(WIKI, "tools", "hidden.json"), encoding="utf-8"))
except OSError:
    pass


def secret_words():
    """Les noms a ne jamais ecrire dans un fichier servi ; dans ce rapport (local), on les masque aussi."""
    words = set()
    for k in ("entities", "ids"):
        for v in hidden.get(k, []) or []:
            words.add(str(v.get("slug") if isinstance(v, dict) else v).split(":")[-1])
    for v in hidden.get("upcoming", []) or []:
        words.add(str(v.get("slug") if isinstance(v, dict) else v))
    for v in hidden.get("boss_mysteres", []) or []:
        words.add(str(v.get("slug") if isinstance(v, dict) else v))
    return {w for w in words if w}


SECRETS = secret_words()

# ---------------------------------------------------------------- tables du site


def js_table(file, name):
    """Les cles d'un objet JS litteral `const NAME = { ... };` (cles nues ou entre guillemets)."""
    src = read(os.path.join(WIKI, "js", file))
    m = re.search(r"const\s+" + name + r"\s*=\s*\{", src)
    if not m:
        return set()
    depth, i = 0, m.end() - 1
    for j in range(i, len(src)):
        if src[j] == "{":
            depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                body = src[i + 1:j]
                break
    else:
        return set()
    keys = set(re.findall(r"""(?:^|[,{\s])(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:""", body))
    return {a or b or c for a, b, c in keys}


BEHAVIOUR = js_table("animal.js", "BEHAVIOUR_LABEL")
ANIM = js_table("animal.js", "ANIM_LABEL")
ANIM_STATE = js_table("animal.js", "ANIM_STATE")
VARIANT = js_table("wiki-data.js", "VARIANT_FR")
VANILLA = js_table("wiki-data.js", "VANILLA_NAMES")
CONSTANT = js_table("wiki-data.js", "CONSTANT_FR")

out = []
say = out.append
counts = {}


def section(title, key):
    say("")
    say("## " + title)
    say("")
    counts[key] = 0


def item(key, line):
    counts[key] += 1
    say("- " + line)


def rel(p):
    return os.path.relpath(p, MOD).replace("\\", "/") if MOD and p else p


def java_file(name):
    """Le .java qui declare cette classe, cherche dans tout le mod."""
    if not JAVA:
        return None
    for root, _dirs, files in os.walk(JAVA):
        if name + ".java" in files:
            return os.path.join(root, name + ".java")
    return None


ents = [e for e in site.get("entities", []) if not (e.get("classification") or {}).get("boss")]
slug = lambda e: e.get("path") or str(e.get("id", "")).split(":")[-1]

say("# Audit des donnees du wiki — " + datetime.now().strftime("%d/%m/%Y %H:%M"))
say("")
say(f"Wiki : `{WIKI}`  ")
say(f"Mod : `{MOD}`")

# ---------------------------------------------------------------- 1. fraicheur

section("1. Fraicheur : le site a-t-il le dernier export ?", "fresh")
if EXPORT and os.path.exists(EXPORT):
    t_exp = os.path.getmtime(EXPORT)
    t_site = os.path.getmtime(os.path.join(WIKI, "data", "wiki_data.json"))
    fmt = lambda t: datetime.fromtimestamp(t).strftime("%d/%m %H:%M")
    if t_exp > t_site + 60:
        item("fresh", f"**L'export du mod ({fmt(t_exp)}) est plus recent que data/wiki_data.json ({fmt(t_site)})** : "
                      "relancer `python tools/publish-data.py \"" + EXPORT + "\"` (ou runWikiDatas) AVANT de corriger quoi que ce soit.")
    else:
        say(f"Export {fmt(t_exp)} · site {fmt(t_site)} : a jour.")
    exp = json.load(open(EXPORT, encoding="utf-8"))
    exp_ents = {str(e.get("id")): e for e in exp.get("entities", [])}
    site_ents = {str(e.get("id")): e for e in site.get("entities", [])}
    missing = [i for i in exp_ents if i not in site_ents]
    masked = [i for i in missing if i.split(":")[-1] in SECRETS]
    other = [i for i in missing if i.split(":")[-1] not in SECRETS]
    if masked:
        say(f"- {len(masked)} espece(s) de l'export retenue(s) par tools/hidden.json (secrets, normal).")
    for i in other:
        item("fresh", f"`{i}` est dans l'export mais pas sur le site (ni dans hidden.json) : texture sans export ? publish-data pas relance ?")
    for i, e in site_ents.items():
        if i in exp_ents:
            gone = sorted(set(exp_ents[i]) - set(e))
            if gone:
                item("fresh", f"`{i}` : champs de l'export absents du site : {', '.join(gone)}")
    for k in sorted(set(exp) - set(site)):
        item("fresh", f"bloc `{k}` de l'export absent du site")
else:
    say("Export du mod introuvable (" + str(EXPORT) + ") : section sautee.")

# ---------------------------------------------------------------- 2. goals

section("2. Comportements sauvages (goals) : ce que lit le visiteur", "goals")
say("Sans phrase dans `BEHAVIOUR_LABEL` (js/animal.js), le site decoupe le nom de classe : "
    "`ElephantFollowHerdGoal` devient « Follow Herd ». Lire le .java, comprendre ce que fait la bete, "
    "ecrire une phrase francaise courte, impersonnelle, au present.")
say("")
for e in ents:
    s = slug(e)
    goals = e.get("wild_behaviors") or []
    for g in goals:
        f = java_file(g)
        src = read(f) if f else ""
        is_goal = bool(re.search(r"extends\s+\w*Goal\b|implements\s+\w*Goal\b", src)) or g.endswith("Goal")
        if not is_goal:
            item("goals", f"**{s}** · `{g}` n'est pas un goal (classe utilitaire de `{rel(f)}`) : l'export la liste "
                          "parce qu'elle est dans le dossier goals/ — la masquer du rendu, ne pas la traduire.")
        elif g not in BEHAVIOUR:
            item("goals", f"**{s}** · `{g}` sans phrase francaise → lire `{rel(f)}`")
    if not goals and JAVA:
        cls = (e.get("simple_class") or "") or (s.title().replace("_", "") + "Entity")
        f = java_file(cls)
        if f:
            own = sorted(set(re.findall(r"addGoal\(\s*\d+\s*,\s*new\s+(\w+)", read(f))))
            own = [g for g in own if not g.startswith(("OW", "Float", "LookAt", "RandomLook", "WaterAvoiding", "Panic", "Breed", "Tempt"))]
            if own:
                item("goals", f"**{s}** · aucun dossier `entity/goals/{s}/` (export vide) mais goals propres dans "
                              f"`{rel(f)}` : {', '.join(own)} — a signaler (l'export ne lit que le dossier).")

# ---------------------------------------------------------------- 3. animations

section("3. Animations : Java ↔ models.json ↔ libelles", "anims")
STATE_RE = re.compile(r"^TRANSITION_(STAND_UP|[A-Z]+)_(STAND_UP|[A-Z]+)$")
for s, m in models.items():
    names = list((m.get("anims") or {}).keys())
    if "DEFINITION" in names:
        item("anims", f"**{s}** · une animation s'appelle `DEFINITION` : tools/build-models.py ne suit plus les classes internes.")
    cls = None
    for e in site.get("entities", []):
        if slug(e) == s:
            cls = (e.get("simple_class") or "").replace("Entity", "")
    f = java_file((cls or s.title().replace("_", "")) + "Animations")
    if f:
        java = re.findall(r"public\s+static\s+final\s+AnimationDefinition\s+(\w+)\s*=", read(f))
        lost = [n for n in java if n not in names]
        if lost:
            item("anims", f"**{s}** · dans le Java mais pas dans models.json : {', '.join(lost)} → relancer "
                          "`python tools/build-models.py` ; si elles manquent encore, le lecteur est a reparer.")
    for n in names:
        mt = STATE_RE.match(n)
        if n in ANIM or (mt and mt.group(1) in ANIM_STATE and mt.group(2) in ANIM_STATE):
            continue
        item("anims", f"**{s}** · `{n}` sans libelle (ANIM_LABEL / ANIM_STATE de js/animal.js)")

# ---------------------------------------------------------------- 4. variantes

section("4. Variantes sans libelle", "variants")
for e in site.get("entities", []):
    for v in e.get("variants") or []:
        n = v.get("name") if isinstance(v, dict) else None
        if n and not n.startswith("SKIN_") and n not in VARIANT and n != "DEFAULT":
            item("variants", f"**{slug(e)}** · `{n}` (VARIANT_FR de js/wiki-data.js)")

# ---------------------------------------------------------------- 5. vanilla

section("5. Objets Minecraft sans nom francais", "vanilla")
say("Noms officiels : `assets/minecraft/lang/fr_fr.json` du jeu (.minecraft/assets/indexes + objects), "
    "jamais une traduction maison. A ajouter dans `VANILLA_NAMES` (js/wiki-data.js).")
say("")
ids = set(re.findall(r'"(minecraft:[a-z0-9_/]+)"', json.dumps(site)))
ids = {i for i in ids if "/" not in i}
MC = cfg.get("minecraft")
BIOMES = js_table("site.js", "BIOME_NAMES")


def is_item(i):
    """Un vrai objet/bloc a une texture dans le dossier Minecraft ; le reste (biomes, types de
    recette, fonctions de butin, mobs) n'est pas un nom d'objet a traduire."""
    n = i.split(":")[1]
    if not MC:
        return True
    return any(os.path.exists(os.path.join(MC, d, n + ".png")) for d in ("item", "block"))


for i in sorted(ids - VANILLA):
    if is_item(i):
        item("vanilla", f"`{i}`")
biome_ids = {i for i in ids if i.split(":")[1] not in VANILLA and not is_item(i) and not i.endswith("_block")
             and re.search(r"ocean|jungle|savanna|swamp|badlands|forest|taiga|plains|desert|river|beach|mountain|peaks|slopes|grove|meadow|tundra|ice|snow", i)}
for i in sorted(biome_ids):
    if i.split(":")[1] not in BIOMES and i not in BIOMES:
        item("vanilla", f"biome `{i}` sans nom dans BIOME_NAMES (js/site.js)")

# ---------------------------------------------------------------- 6. constantes

section("6. Constantes d'attaque affichees en anglais", "consts")
seen = set()
for e in ents:
    for key in (e.get("attack_constants") or {}):
        base = re.sub(r"_(TICKS|MS)$", "", key)
        words = base.lower().split("_")
        tails = {" ".join(words[i:]) for i in range(len(words))}
        if not tails & CONSTANT and base not in seen:
            seen.add(base)
            item("consts", f"**{slug(e)}** · `{key}` (lu « {' '.join(words[1:]) or base.lower()} » ou proche) → CONSTANT_FR")

# ---------------------------------------------------------------- 7. sachets de langue

section("7. Textes de langue sans francais ou casses", "lang")


def walk(node, path):
    if isinstance(node, dict):
        if "key" in node and "plain" in node and isinstance(node.get("translations"), dict):
            if "fr_fr" not in node["translations"]:
                item("lang", f"`{path}` : cle `{node['key']}` sans fr_fr (le site affiche « {str(node['plain'])[:60]} »)")
        for k, v in node.items():
            walk(v, path + "." + k)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk(v, f"{path}[{i}]")
    elif isinstance(node, str) and re.search(r"Ã[\x80-\xBF©¨ª«®´]|â€|�", node):
        item("lang", f"`{path}` : texte casse « {node[:60]} »")


walk(site, "data")

# ---------------------------------------------------------------- bilan

say("")
say("## Bilan")
say("")
labels = {"fresh": "fraicheur", "goals": "goals", "anims": "animations", "variants": "variantes",
          "vanilla": "objets vanilla", "consts": "constantes", "lang": "langue"}
for k, n in counts.items():
    say(f"- {labels[k]} : {n}")

text = "\n".join(out) + "\n"
if args.out:
    open(args.out, "w", encoding="utf-8").write(text)
    print("Rapport :", args.out, "·", ", ".join(f"{labels[k]} {n}" for k, n in counts.items()))
else:
    sys.stdout.reconfigure(encoding="utf-8")
    print(text)
