"""Ou vivent les choses, pour tous les outils du wiki.

Depuis le 28/09/2026, les assets du site (images, sons, modeles...) ne sont
plus dans le dossier du wiki : ils vivent dans leur propre dossier, publie tel
quel sur GitHub (depot Operation-W.I.L.D-Wiki-Assets, servi par GitHub Pages).
Le site les demande toujours a « assets/... » : Netlify va les chercher la-bas
(voir _redirects), et en local tools/serve.py fait de meme.

    WIKI     le dossier du site (html, js, css, data/, tools/)
    ASSETS   le dossier des assets (= la racine du depot GitHub)
    MOD      le projet Java du mod (IdeaProjects)
    STUDIO   le dossier de travail du Bureau (wallpapers, musiques, logos...)
    MINECRAFT les textures de Minecraft (item/ -> mcitems/, block/ -> mcblocks/)

Chaque chemin se regle, du plus fort au plus faible :
    1. une variable d'environnement (OW_ASSETS_DIR, OW_MOD_DIR, OW_STUDIO_DIR,
       OW_MINECRAFT_DIR) ;
    2. tools/paths.json ;
    3. la valeur par defaut ci-dessous.
La tache Gradle runWikiDatas du mod passe ses propres chemins (gradle.properties).
"""

import io
import json
import os
import re

WIKI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(WIKI, "tools")
DESKTOP = os.path.join(os.path.expanduser("~"), "Desktop")

try:
    _CFG = json.load(open(os.path.join(TOOLS, "paths.json"), encoding="utf-8"))
except (OSError, ValueError):
    _CFG = {}


def _pick(env, key, default):
    return os.path.normpath(os.environ.get(env) or _CFG.get(key) or default)


ASSETS = _pick("OW_ASSETS_DIR", "assets", os.path.join(DESKTOP, "Operation W.I.L.D Wiki Assets"))
MOD = _pick("OW_MOD_DIR", "mod", r"C:\Users\Tiew_37\IdeaProjects\Operation-W.I.L.D")
STUDIO = _pick("OW_STUDIO_DIR", "studio", os.path.join(DESKTOP, "Operation W.I.L.D"))
MINECRAFT = _pick("OW_MINECRAFT_DIR", "minecraft", os.path.join(DESKTOP, "Minecraft Textures 1.21.1"))

MOD_ASSETS = os.path.join(MOD, "src", "main", "resources", "assets", "ow")
MOD_JAVA = os.path.join(MOD, "src", "main", "java", "net", "tiew", "operationWild")

# Les images au nom secret, mises a l'abri hors du dossier publie.
PRIVATE = os.path.join(TOOLS, "private", "assets")

# L'adresse publique du depot (GitHub Pages). Le site passe par Netlify
# (_redirects) : cette adresse ne sert qu'aux messages et a la verification.
PAGES_URL = _CFG.get("pages_url") or "https://theosrb.github.io/Operation-W.I.L.D-Wiki-Assets/"


def asset(*parts):
    """Un chemin dans le dossier des assets : asset('item', 'jade.png')."""
    return os.path.join(ASSETS, *parts)


def web(path):
    """Le chemin tel que le site le demande : 'assets/item/jade.png'."""
    rel = os.path.relpath(path, ASSETS).replace(os.sep, "/")
    return "assets/" + rel


# ---- les secrets (tools/hidden.json) ------------------------------------------------

def _hidden():
    try:
        return json.load(open(os.path.join(TOOLS, "hidden.json"), encoding="utf-8"))
    except (OSError, ValueError):
        return {}


HIDDEN = _hidden()


def _token(word):
    # Un mot entier : « lion » attrape ow:lion_roar, jamais « vermilion ».
    return re.compile(r"(?<![a-z0-9])" + re.escape(word.lower()) + r"(?![a-z0-9])")


def secret_words():
    words = list(HIDDEN.get("entities", []))
    words += [u["slug"] for u in HIDDEN.get("upcoming", []) if "slug" in u]
    words += [b["slug"] for b in HIDDEN.get("boss_mysteres", []) if "slug" in b]
    for ident in HIDDEN.get("ids", []):
        words += [ident, ident.split(":", 1)[-1]]
    return [w for w in words if w]


SECRET_PATTERNS = [_token(w) for w in secret_words()]


def secret(text):
    """Vrai si le texte (un nom de fichier, un identifiant) cite un secret."""
    low = str(text).lower()
    return any(p.search(low) for p in SECRET_PATTERNS)


# ---- ecrire sans remuer ----------------------------------------------------------------
# Un fichier regenere a l'identique n'est pas reecrit : Git (et GitHub) ne voient
# changer que ce qui a vraiment change.

def write_bytes(path, data):
    """Ecrit si le contenu differe. Renvoie True si le fichier a change."""
    try:
        with open(path, "rb") as f:
            if f.read() == data:
                return False
    except OSError:
        pass
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return True


def save_image(im, path, **options):
    """Image PIL -> fichier, seulement si le resultat differe de l'existant."""
    buf = io.BytesIO()
    fmt = "PNG" if path.lower().endswith(".png") else None
    im.save(buf, format=fmt, **options)
    return write_bytes(path, buf.getvalue())
