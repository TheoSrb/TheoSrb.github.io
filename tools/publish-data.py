"""Retire du site tout ce qui est liste dans tools/hidden.json.

0. Au passage, la date de creation de chaque classe (history.created) est
   recalee sur l'historique git du mod quand il la connait plus ancienne :
   un fichier recree sur le disque ne rend pas sa bete « nouvelle ».
   Et chaque bete recoit sa date de sortie sur le wiki (history.revealed,
   registre tools/sorties.json) : c'est elle qui la fait « Nouveau ! ».

1. data/wiki_data.json : chaque bloc ou objet masque, et chaque espece secrete,
   disparaissent de l'export — l'entite elle-meme, et tout element de liste qui
   la cite (ses objets, ses sons, ses succes, sa ligne dans les tribus, les
   recettes d'un objet masque...). Un visiteur qui ouvre le JSON ou les outils
   du navigateur n'y trouve plus rien.
2. assets/mystery/ et js/upcoming.js : les cartes mystere. Une silhouette
   noire par bete annoncee, sous un nom de fichier sans rapport avec elle
   (une empreinte du nom), et seulement le decor de biome de sa carte. Aucun
   nom d'espece dans le code servi.

Usage :
    python tools/publish-data.py                 nettoie data/wiki_data.json sur place
    python tools/publish-data.py <export.json>   part d'un export neuf du mod

A relancer apres chaque export du mod et chaque changement de tools/hidden.json.
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths  # noqa: E402  (les images vivent dans le dossier des assets)

ROOT = paths.WIKI
os.chdir(ROOT)
A = paths.asset
MYSTERY = A("mystery")

HIDDEN = json.load(open("tools/hidden.json", encoding="utf-8"))
TARGET = "data/wiki_data.json"
SOURCE = sys.argv[1] if len(sys.argv) > 1 else TARGET


def fnv1a(text):
    """Empreinte 32 bits (FNV-1a) : la meme que js/creature-card.js."""
    h = 0x811C9DC5
    for byte in text.encode("utf-8"):
        h ^= byte
        h = (h * 0x01000193) & 0xFFFFFFFF
    return "%08x" % h


# ---- 1. l'export -----------------------------------------------------------------------

def token_re(word):
    # Un mot entier : "lion" efface ow:lion_roar, jamais « vermilion ».
    return re.compile(r"(?<![a-z0-9])" + re.escape(word.lower()) + r"(?![a-z0-9])")


# Les especes secretes : celles de "entities", plus toutes les betes annoncees
# ("upcoming") — ajouter une bete a venir suffit a la cacher.
SPECIES = (list(HIDDEN.get("entities", []))
           + [u["slug"] for u in HIDDEN.get("upcoming", [])]
           + [b["slug"] for b in HIDDEN.get("boss_mysteres", [])])
PATTERNS = [token_re(w) for w in SPECIES]
for ident in HIDDEN.get("ids", []):
    PATTERNS.append(token_re(ident))
    PATTERNS.append(token_re(ident.split(":", 1)[-1]))

removed = {}


def secret(text):
    low = str(text).lower()
    return any(p.search(low) for p in PATTERNS)


def note(path):
    key = re.sub(r"\[\d+\]", "", path)
    removed[key] = removed.get(key, 0) + 1


DROP = object()

# Les champs qui disent CE QU'EST un element : s'ils citent le secret,
# l'element entier part (l'objet masque, le son de la bete, sa recette).
# Ailleurs, une simple mention ne retire que le champ qui la porte.
IDENTITY = {"id", "path", "slug", "item", "constant", "translation_key", "label_key", "result", "output"}


def scrub(node, path, depth):
    """Renvoie le noeud nettoye, ou DROP s'il faut retirer l'element entier."""
    if isinstance(node, str):
        return DROP if secret(node) else node
    if isinstance(node, list):
        out = []
        whole = path.endswith(".recipes") or path.endswith(".crafting_uses")
        for i, el in enumerate(node):
            # Une recette qui cite un secret, meme en simple ingredient, part
            # en entier : amputee, elle s'afficherait incomplete.
            if whole and secret(json.dumps(el, ensure_ascii=False)):
                note(path)
                continue
            res = scrub(el, "%s[%d]" % (path, i), depth + 1)
            if res is DROP:
                note(path)
            else:
                out.append(res)
        return out
    if isinstance(node, dict):
        out = {}
        for key, value in node.items():
            if secret(key):
                note(path + "." + key)
                continue
            res = scrub(value, path + "." + key, depth + 1)
            if res is DROP:
                # Les grandes sections de l'export (depth <= 2) ne tombent jamais.
                if depth > 2 and (key in IDENTITY or key == "json"):
                    return DROP
                note(path + "." + key)
                continue
            out[key] = res
        return out
    return node


# ---- 0. la date de naissance de chaque classe --------------------------------------------
# L'export date chaque espece par la date de CREATION de son fichier de classe sur
# le disque (history.created) : c'est la date de la classe (« Apparu le » des boss) ;
# la nouveaute, elle, se lit dans la date de sortie (0 bis).
# Mais Windows la remet a l'heure du jour des qu'un fichier est recree (reecrit par
# suppression, deplace, reclone) : le 30/09/2026, TigerEntity.java, la plus vieille
# classe du mod, est ainsi « ne » a 18:47 et le tigre est passe pour nouveau.
# L'historique git du mod garde la vraie date : le premier commit du fichier, en
# suivant ses deplacements. On garde la plus ancienne des deux (une classe pas encore
# commitee n'a que la date du disque ; le disque ne peut qu'etre en retard).

def git_birth(rel):
    try:
        run = subprocess.run(
            ["git", "-C", paths.MOD, "log", "--diff-filter=A", "--follow", "--format=%aI", "--", rel],
            capture_output=True, text=True, encoding="utf-8", timeout=60)
    except (OSError, subprocess.SubprocessError):
        return None
    lines = [line.strip() for line in run.stdout.splitlines() if line.strip()]
    return lines[-1] if run.returncode == 0 and lines else None


def fix_births(export):
    for entity in export.get("entities", []):
        history = entity.get("history") or {}
        rel = history.get("file")
        if not rel:
            continue
        found = [d for d in (history.get("created"), git_birth(rel)) if d]
        try:
            oldest = min(found, key=datetime.fromisoformat)
        except ValueError:
            continue
        if oldest != history.get("created"):
            print("date de creation :", entity.get("id"), history.get("created_date"), "->", oldest[:10], "(git)")
            history["created"] = oldest
            history["created_date"] = oldest[:10]


# ---- 0 bis. la date de sortie de chaque bete ----------------------------------------------
# « Nouveau ! » sur le site, c'est une bete qui vient d'arriver SUR LE WIKI, pas une
# classe toute neuve : le lion, sorti le 10/10/2026, a une classe que git fait remonter
# a 2025 (une premiere version effacee depuis), et une bete gardee secrete des mois
# sortirait deja « ancienne ». Le registre tools/sorties.json note le jour ou chaque
# espece apparait pour la premiere fois dans le JSON publie ; une bete deja sur le site
# avant lui y entre avec sa date de creation. Le site la lit en history.revealed.

SORTIES = "tools/sorties.json"
SORTIES_README = [
    "Le jour ou chaque bete est sortie sur le wiki : c'est lui qui la rend « Nouveau ! »",
    "(accueil, bestiaire, tri recent), pendant SITE_CONFIG.news.months mois.",
    "Rempli tout seul par tools/publish-data.py : une espece qui apparait pour la premiere",
    "fois dans data/wiki_data.json (une bete revelee) prend la date du jour.",
    "Une date se corrige a la main ; supprimer une ligne la refait au prochain passage."
]


def stamp_releases(clean):
    try:
        ledger = json.load(open(SORTIES, encoding="utf-8"))
    except (OSError, ValueError):
        ledger = {}
    ledger["_lisez-moi"] = SORTIES_README
    dates = ledger.setdefault("sorties", {})
    # Les especes deja servies : celles du JSON qu'on va remplacer.
    try:
        before = {e.get("path") for e in json.load(open(TARGET, encoding="utf-8")).get("entities", [])}
    except (OSError, ValueError):
        before = set()
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    for entity in clean.get("entities", []):
        slug = entity.get("path")
        if not slug:
            continue
        history = entity.setdefault("history", {})
        if slug not in dates:
            dates[slug] = history.get("created") if slug in before and history.get("created") else now
            print("sortie :", slug, dates[slug][:10])
        history["revealed"] = dates[slug]
    return ledger


raw = open(SOURCE, "rb").read()
data = json.loads(raw.decode("utf-8"))
fix_births(data)
clean = scrub(data, "", 1)
releases = stamp_releases(clean)
text = json.dumps(clean, ensure_ascii=False, indent=2) + "\n"

left = [p.pattern for p in PATTERNS if p.search(text.lower())]
print("wiki_data.json :", sum(removed.values()), "elements retires")
for key in sorted(removed):
    print("   ", removed[key], "x", key)
if left:
    # Rien n'est ecrit : le site garde son JSON precedent, propre.
    print("ATTENTION, encore present (data/wiki_data.json n'est pas remplace) :", left)
    sys.exit(1)
open(TARGET, "w", encoding="utf-8", newline="\n").write(text)
open(SORTIES, "w", encoding="utf-8", newline="\n").write(json.dumps(releases, ensure_ascii=False, indent=2) + "\n")

# ---- 1 bis. les fichiers qui portent un nom secret ----------------------------------
# Une image servie sous le nom de la bete la trahit (il suffit de deviner
# l'adresse) : tout fichier d'assets/ dont le nom cite un secret part a
# l'abri dans tools/private/, au meme chemin. Pour le remettre : le deplacer
# en sens inverse, une fois la bete revelee.

moved = 0
for folder, dirs, files in os.walk(paths.ASSETS):
    dirs[:] = [d for d in dirs if d != ".git"]
    for name in files:
        if os.path.abspath(folder).startswith(os.path.abspath(MYSTERY)):
            continue
        if secret(os.path.splitext(name)[0]):
            src = os.path.join(folder, name)
            dst = os.path.join(paths.PRIVATE, os.path.relpath(src, paths.ASSETS))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            os.replace(src, dst)
            moved += 1
            print("mis a l'abri :", paths.web(src))
print("fichiers mis a l'abri :", moved)

# ---- 2. les cartes mystere ------------------------------------------------------------

os.makedirs(MYSTERY, exist_ok=True)
made = set()  # les silhouettes de ce passage ; les autres, perimees, partent a la fin

cards = []
for entry in HIDDEN.get("upcoming", []):
    slug = entry["slug"]
    src = "tools/private/assets/heads/%s.png" % slug
    public = A("heads", "%s.png" % slug)
    legacy = "tools/private/heads/%s.png" % slug
    if not os.path.exists(src) and os.path.exists(legacy):
        os.makedirs(os.path.dirname(src), exist_ok=True)
        os.replace(legacy, src)
    if not os.path.exists(src) and os.path.exists(public):
        # La tete deposee a l'endroit habituel est mise a l'abri : servie, son
        # nom de fichier trahirait la bete.
        os.makedirs(os.path.dirname(src), exist_ok=True)
        os.replace(public, src)
        print("tete mise a l'abri :", public, "->", src)
    if not os.path.exists(src):
        print("ATTENTION, tete introuvable pour une bete a venir :", public)
        continue
    key = fnv1a(slug)
    im = Image.open(src).convert("RGBA")
    alpha = im.split()[3]
    black = Image.new("RGBA", im.size, (0, 0, 0, 0))
    black.putalpha(alpha)
    paths.save_image(black, os.path.join(MYSTERY, "%s.png" % key))
    made.add("%s.png" % key)
    cards.append({"key": key, "img": "assets/mystery/%s.png" % key, "biome": entry.get("biome", "jungle")})

# ---- 2 bis. les boss scelles (bosses.html) ----------------------------------------------
# Le rendu complet de la bete (pas sa tete : un boss se reconnait a sa
# carrure), recadre sur ce qui est dessine, puis passe au noir.

bosses = []
for entry in HIDDEN.get("boss_mysteres", []):
    slug = entry["slug"]
    src = "tools/private/assets/entities/%s.png" % slug
    public = A("entities", "%s.png" % slug)
    # Le rendu du boss peut aussi avoir ete depose dans bosses/solo/.
    for place in (A("entities", "%s.png" % slug), A("bosses", "solo", "%s.png" % slug),
                  "tools/private/assets/bosses/solo/%s.png" % slug):
        if not os.path.exists(src) and os.path.exists(place):
            os.makedirs(os.path.dirname(src), exist_ok=True)
            os.replace(place, src)
            print("rendu mis a l'abri :", place, "->", src)
    if not os.path.exists(src):
        print("ATTENTION, rendu introuvable pour un boss scelle :", public)
        continue
    key = fnv1a(slug)
    im = Image.open(src).convert("RGBA")
    alpha = im.split()[3]
    box = alpha.getbbox() or (0, 0, im.width, im.height)
    alpha = alpha.crop(box)
    black = Image.new("RGBA", alpha.size, (0, 0, 0, 0))
    black.putalpha(alpha)
    paths.save_image(black, os.path.join(MYSTERY, "%s.png" % key))
    made.add("%s.png" % key)
    hint = str(entry.get("indice") or "").strip()
    if hint and secret(hint):
        print("ATTENTION, indice retire (il cite un secret) :", slug)
        hint = ""
    boss = {"key": key, "img": "assets/mystery/%s.png" % key,
            "w": alpha.width, "h": alpha.height,
            "threat": max(1, min(5, int(entry.get("menace", 5))))}
    if hint:
        boss["hint"] = hint
    bosses.append(boss)

js = """/* Genere par tools/publish-data.py — ne pas modifier a la main.

   Les betes annoncees, sans leur nom : une empreinte (key), une silhouette
   noire et le decor de biome de leur carte. Une carte disparait d'elle-meme
   quand l'export contient une espece de meme empreinte (js/creature-card.js).
   OW.UPCOMING_BOSSES : les boss scelles de bosses.html, meme principe
   (js/bosses.js). */
(function (OW) {
  'use strict';
  OW.UPCOMING = %s;
  OW.UPCOMING_BOSSES = %s;
}(window.OW = window.OW || {}));
""" % (json.dumps(cards, indent=2).replace("\n", "\n  "),
       json.dumps(bosses, indent=2, ensure_ascii=False).replace("\n", "\n  "))
open("js/upcoming.js", "w", encoding="utf-8", newline="\n").write(js)
# Les silhouettes d'une bete revelee depuis : plus rien ne les cite.
for name in os.listdir(MYSTERY):
    if name not in made:
        os.remove(os.path.join(MYSTERY, name))
print("cartes mystere :", len(cards), "· boss scelles :", len(bosses))

# Lance par tools/sync-wiki.py (la tache Gradle du mod) : la suite (inventaire,
# apercus de partage) vient plus tard, une fois tous les assets a jour.
if not os.environ.get("OW_SYNC"):
    # ---- 3. l'inventaire des fichiers ---------------------------------------------------
    # Les images mises a l'abri ci-dessus ne sont plus servies : l'inventaire du site
    # en ligne (js/asset-list.js) se refait apres elles.
    import runpy
    runpy.run_path(os.path.join(ROOT, "tools", "list-assets.py"), run_name="__main__")

    # ---- 4. les apercus de partage ------------------------------------------------------
    # Une page partage/<slug>.html et une image og/<slug>.png par creature publiee, et
    # sitemap.xml (tools/build-share.py) : une bete ajoutee a l'export a son apercu Discord.
    runpy.run_path(os.path.join(ROOT, "tools", "build-share.py"), run_name="__main__")
