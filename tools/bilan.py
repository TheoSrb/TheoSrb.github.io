"""Le bilan : tout ce qui manque au wiki, bete par bete, par rapport au tigre.

Le tigre sert de modele : chaque chose qu'il a (rendus, variantes, skins, GIF,
captures, sons, cartes d'attaque, donnees du mod...) est cherchee chez les
autres betes publiees. Suivent les boss, les objets et blocs du mod sans image,
et les textures de Minecraft a deposer.

Affiche a la fin de la tache IntelliJ runWikiDatas (tools/sync-wiki.py), et se
lance seul, sans rien mettre a jour :
    python tools/bilan.py
"""

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths  # noqa: E402

A = paths.asset
REF = "tiger"                     # la bete modele
NO_CAMEO = {"orca", "boa"}        # sans passant, volontairement (build-cameos.html)
ROLE_FILE = {"combo": "attack_0", "secondary": "attack_1", "secondary-alt": "attack_1_2", "ultimate": "attack_2"}
COLORS = ["white", "light_gray", "gray", "black", "brown", "red", "orange", "yellow",
          "lime", "green", "cyan", "light_blue", "blue", "purple", "magenta", "pink"]


def exists(*parts):
    return os.path.exists(A(*parts))


def series(fmt):
    """anim_0.gif, anim_1.gif... : combien, jusqu'a deux trous d'affilee (comme le site)."""
    n, i, misses = 0, 0, 0
    while misses < 2 and i < 60:
        if exists(*fmt(i).split("/")):
            n += 1
            misses = 0
        else:
            misses += 1
        i += 1
    return n


def read(path):
    try:
        return open(path, encoding="utf-8").read()
    except OSError:
        return ""


def strip_comments(js):
    return re.sub(r"/\*.*?\*/", "", js, flags=re.S)


def attack_roles():
    """slug de carte -> role, par bete (js/attack-profiles.js)."""
    out, current = {}, None
    for line in read(os.path.join(paths.WIKI, "js", "attack-profiles.js")).splitlines():
        m = re.match(r"^\s{4}(\w+): \[", line)
        if m:
            current = m.group(1)
            out.setdefault(current, {})
        for role, slug in re.findall(r"role: '([\w-]+)', slug: '(\w+)'", line):
            if current:
                out[current][slug] = role
    return out


def skin_catalogue():
    """id -> {image, model} des fiches ecrites dans js/skins.js."""
    js = strip_comments(read(os.path.join(paths.WIKI, "js", "skins.js")))
    out = {}
    for m in re.finditer(r"id: '([\w]+)'(.*?)(?=\bid: '|\Z)", js, flags=re.S):
        body = m.group(2)
        img = re.search(r"image: '([^']+)'", body)
        mdl = re.search(r"model: '([^']+)'", body)
        out[m.group(1)] = {"image": img.group(1) if img else None, "model": mdl.group(1) if mdl else None}
    return out


def taming_guides():
    js = strip_comments(read(os.path.join(paths.WIKI, "js", "taming-guides.js")))
    return set(re.findall(r"^\s*(\w+):\s*\[", js, flags=re.M))


def web_exists(url):
    """'assets/skins/x.png' -> le fichier est-il dans le dossier des assets ?"""
    return bool(url) and url.startswith("assets/") and exists(*url[len("assets/"):].split("/"))


def natural_variants(e):
    skins = {c.get("variant") for c in e.get("cosmetics") or []}
    return [v for v in e.get("variants") or []
            if not v.get("cosmetic") and v.get("name") not in skins and not str(v.get("name", "")).startswith("SKIN_")]


def solo_name(slug):
    return " ".join(w.capitalize() for w in slug.split("_")) + " [SOLO].png"


# ---- une bete ------------------------------------------------------------------------

def profile(e, ctx):
    """Tout ce qu'une bete a, sous une forme comparable a celle du tigre."""
    slug = e["path"]
    p = {}
    # -- les fichiers
    p["tete"] = exists("heads", slug + ".png")
    p["rendu"] = exists("entities", slug + ".png")
    p["rendu solo"] = exists("entities", "solo", solo_name(slug))
    p["wallpaper"] = exists("wallpapers", slug + ".png")
    p["apercu de partage"] = exists("og", slug + ".png")
    p["modele 3D"] = slug in ctx["models"]
    if slug not in NO_CAMEO:
        p["passant du pied de page"] = exists("cameos", slug + ".png")

    nat = natural_variants(e)
    p["variantes"] = ([v.get("name") for i, v in enumerate(nat) if exists("pages", slug, "%s_%d.png" % (slug, i))],
                      [v.get("name") for v in nat])

    cat = ctx["skins"]
    no_render, no_3d, no_card = [], [], []
    for rank, c in enumerate(e.get("cosmetics") or []):
        sid = slug + "_" + str(c.get("name", "")).lower()
        entry = cat.get(sid)
        # Une fiche : celle que le mod decrit (js/skin-data.js), sinon celle de js/skins.js.
        if not entry and sid not in ctx["modskins"]:
            no_card.append(sid)
        render = (entry and web_exists(entry["image"])) or exists("skins", sid + ".png") \
            or exists("pages", slug, "skin_%d.png" % rank)
        if not render:
            no_render.append(sid)
        if not (entry and web_exists(entry["model"])):
            no_3d.append(sid)
    p["skins"] = (len(e.get("cosmetics") or []), no_render, no_3d, no_card)

    roles = ctx["roles"].get(slug, {})
    cards_missing, cards_unknown = [], []
    for card in (e.get("abilities") or {}).get("cards") or []:
        role = roles.get(card.get("slug"))
        if role is None:
            cards_unknown.append(card.get("slug"))
        elif role in ROLE_FILE and not exists("pages", slug, ROLE_FILE[role] + ".png"):
            cards_missing.append("%s.png (%s)" % (ROLE_FILE[role], card.get("slug")))
    p["cartes d'attaque"] = (cards_missing, cards_unknown)

    p["GIF"] = series(lambda i: "pages/%s/anim_%d.gif" % (slug, i))
    p["captures"] = series(lambda i: "pages/%s/gallery_%d.png" % (slug, i))
    has_saddle = bool((e.get("mount") or {}).get("saddle_item"))
    p["selle"] = exists("pages", slug, "saddle.png") if has_saddle else None

    sounds = [s.get("path") for s in e.get("sounds") or [] if s.get("path")]
    heard = [s for s in sounds if exists("sounds", slug, s + ".ogg") or exists("sounds", slug, s + ".mp3")
             or exists("music", s + ".ogg")]
    p["sons"] = (heard, sounds)

    # -- les donnees du mod
    taming = e.get("taming") or {}
    p["donnees"] = dict([
        ("lieu d'apparition", bool(e.get("spawn"))),
        ("texte du manuscrit", bool(e.get("lore"))),
        ("comportements sauvages", bool(e.get("wild_behaviors"))),
        ("butin", bool((e.get("loot") or {}).get("drops"))),
        ("nourriture d'apprivoisement", bool(taming.get("food_tags"))),
        ("recette de selle", bool(taming.get("saddle_recipe"))),
        ("Piste Sauvage", bool((e.get("piste") or {}).get("available"))),
        ("sons declares", bool(sounds)),
        ("utilisations en fabrication", bool(e.get("crafting_uses"))),
        ("nom de chapitre", bool(e.get("chapter_names"))),
        ("skins", bool(e.get("cosmetics"))),
        ("guide d'apprivoisement (js/taming-guides.js)", slug in ctx["guides"]),
    ])
    return p


def perfect(p):
    """Un modele ideal : tout present, aucun nombre a atteindre. Sert a lister ce
    qui manque au tigre lui-meme."""
    ideal = {k: (True if isinstance(v, bool) else v) for k, v in p.items()}
    ideal.update({"donnees": {k: True for k in p["donnees"]}, "GIF": 0, "captures": 0})
    return ideal


def gaps(p, ref):
    """Ce que le tigre a et que la bete n'a pas, en phrases courtes."""
    out = []
    files = [k for k in ("tete", "rendu", "rendu solo", "wallpaper", "apercu de partage", "modele 3D",
                         "passant du pied de page") if ref.get(k) and k in p and not p[k]]
    if files:
        out.append("manque : " + ", ".join(files))

    have, names = p["variantes"]
    if names and len(have) < len(names):
        out.append("variantes %d/%d (manque : %s)" % (len(have), len(names),
                                                    ", ".join(n for n in names if n not in have)))

    count, no_render, no_3d, no_card = p["skins"]
    if count:
        bits = []
        if no_render:
            bits.append("sans rendu : " + ", ".join(no_render))
        if no_3d:
            bits.append("sans modele 3D : " + ", ".join(no_3d))
        if no_card:
            bits.append("pas decrit dans le code du mod : " + ", ".join(no_card))
        if bits:
            out.append("skins — " + " · ".join(bits))

    missing, unknown = p["cartes d'attaque"]
    if missing:
        out.append("cartes d'attaque : " + ", ".join(missing))
    if unknown:
        out.append("cartes sans role dans js/attack-profiles.js : " + ", ".join(unknown))

    for key in ("GIF", "captures"):
        if p[key] < ref[key]:
            out.append("%s %d/%d" % (key, p[key], ref[key]))
    if p["selle"] is False:
        out.append("selle : pages/<bete>/saddle.png")

    heard, sounds = p["sons"]
    if sounds and len(heard) < len(sounds):
        out.append("sons %d/%d (sans fichier : %s)" % (len(heard), len(sounds),
                                                    ", ".join(s for s in sounds if s not in heard)))

    data = [k for k, v in p["donnees"].items() if ref["donnees"].get(k) and not v]
    if data:
        out.append("donnees du mod : " + ", ".join(data))
    return out


# ---- objets, blocs, Minecraft -----------------------------------------------------------

def mod_model(kind, name):
    for base in ("main", "generated"):
        path = os.path.join(paths.MOD, "src", base, "resources", "assets", "ow", "models", kind, name + ".json")
        try:
            return json.load(open(path, encoding="utf-8"))
        except (OSError, ValueError):
            continue
    return None


def items_without_image(data):
    """Les objets du mod que le site ne peut pas montrer, d'apres leurs modeles du mod."""
    eggs, missing = [], []
    for it in data.get("items", []):
        key = it["id"].split(":")[-1]
        model = mod_model("item", key) or {}
        parent = str(model.get("parent", ""))
        layer = (model.get("textures") or {}).get("layer0")
        if "template_spawn_egg" in parent:
            eggs.append(key)
        elif layer:
            # « ow:item/jade » ou « ow:block/lavender » (une plante montree a plat).
            folder = "block" if "block/" in str(layer) else "item"
            name = str(layer).split("/")[-1]
            if not (exists(folder, name + ".png") or exists("item", key + ".png")):
                missing.append(key)
        elif parent.startswith("ow:block/"):
            block = mod_model("block", parent.split("/")[-1]) or {}
            # Un modele Blockbench (formes libres) : le site ne sait pas le dessiner,
            # il lui faut une icone a plat.
            if (block.get("elements") or block.get("texture_size")) and not exists("item", key + ".png"):
                missing.append(key)
    return eggs, missing


NOT_ITEMS = set("crafting_shaped crafting_shapeless smelting smoking campfire_cooking entity item uniform set_count "
                "looting enchanted_count_increase entity_properties furnace_smelt random_chance worldgen/biome "
                "barrier horse pig cow sheep llama".split())


def vanilla_missing(data):
    refs = set()

    def walk(node):
        if isinstance(node, dict):
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
        elif isinstance(node, str):
            m = re.fullmatch(r"minecraft:([a-z0-9_]+)", node)
            if m and m.group(1) not in NOT_ITEMS:
                refs.add(m.group(1))

    for e in data.get("entities", []):
        walk([e.get("taming"), e.get("loot"), e.get("crafting_uses")])
    walk([data.get("recipes"), data.get("tribes", {}).get("arena"), data.get("tags")])
    # Les biomes cites ne sont pas des objets.
    for s in data.get("worldgen", {}).get("spawns", []):
        refs -= {b.split(":")[-1] for b in s.get("biomes", [])}
    # Les emplacements « n'importe quelle couleur » des selles : les 16 couleurs.
    for s in data.get("saddles", []):
        for n in s.get("needs", []):
            m = re.match(r"^saddler\.material\.([a-z_]+)\.", str(n.get("label_key") or ""))
            if m:
                refs |= {c + "_" + m.group(1) for c in COLORS}

    mc_items = set(os.listdir(A("mcitems"))) if os.path.isdir(A("mcitems")) else set()
    mc_blocks = set(os.listdir(A("mcblocks"))) if os.path.isdir(A("mcblocks")) else set()
    missing = []
    for name in sorted(refs):
        if name + ".png" in mc_items or name + ".png" in mc_blocks:
            continue
        if any(name + suffix + ".png" in mc_blocks for suffix in ("_side", "_top", "_front")):
            continue
        # Un tag (« leaves » : n'importe quel feuillage) : une seule texture suffit.
        if any(f.endswith("_" + name + ".png") for f in mc_blocks):
            continue
        missing.append(name)
    return missing


# ---- le bilan ------------------------------------------------------------------------------

def run(say=print):
    data = json.load(open(os.path.join(paths.WIKI, "data", "wiki_data.json"), encoding="utf-8"))
    try:
        models = json.load(open(os.path.join(paths.WIKI, "data", "models.json"), encoding="utf-8"))
    except (OSError, ValueError):
        models = {}
    m = re.search(r"SKIN_DATA = (\{.*\});", read(os.path.join(paths.WIKI, "js", "skin-data.js")), flags=re.S)
    modskins = set(json.loads(m.group(1))) if m else set()
    ctx = {"models": models, "skins": skin_catalogue(), "modskins": modskins, "roles": attack_roles(),
           "guides": taming_guides()}
    entities = data.get("entities", [])
    name = lambda e: re.sub(r"§.", "", (e.get("names") or {}).get("fr_fr") or e["path"])  # noqa: E731
    beasts = [e for e in entities if not (e.get("classification") or {}).get("boss")]
    bosses = [e for e in entities if (e.get("classification") or {}).get("boss")]

    say("")
    say("== Bilan : ce qui manque par rapport au tigre " + "=" * 14)
    ref_e = next((e for e in beasts if e["path"] == REF), None)
    if not ref_e:
        say("  le tigre n'est pas dans l'export : pas de bilan")
        return
    ref = profile(ref_e, ctx)
    say("  Modele : %s — %d variantes, %d skins, %d GIF, %d captures, %d/%d sons."
        % (name(ref_e), len(ref["variantes"][1]), ref["skins"][0], ref["GIF"], ref["captures"],
           len(ref["sons"][0]), len(ref["sons"][1])))
    own = gaps(ref, perfect(ref))
    if own:
        say("  Au tigre lui-meme, il manque :")
        for line in own:
            say("    - " + line)

    for e in beasts:
        if e is ref_e:
            continue
        lines = gaps(profile(e, ctx), ref)
        say("")
        if not lines:
            say("  %s : rien ne manque" % name(e))
            continue
        say("  %s (%d)" % (name(e), len(lines)))
        for line in lines:
            say("    - " + line)

    for e in bosses:
        slug = e["path"]
        miss = [label for label, ok in (
            ("rendu (bosses/solo/%s.png)" % slug, exists("bosses", "solo", slug + ".png") or exists("entities", slug + ".png")),
            ("fond (bosses/wallpapers/%s.png)" % slug, exists("bosses", "wallpapers", slug + ".png")),
            ("theme (music/%s_theme.ogg)" % slug, exists("music", slug + "_theme.ogg")),
        ) if not ok]
        say("")
        say("  Boss %s : %s" % (name(e), ("manque : " + ", ".join(miss)) if miss else "rien ne manque"))

    eggs, items = items_without_image(data)
    say("")
    say("  Objets du mod sans image :", (", ".join(items) if items else "aucun"))
    if eggs:
        say("  Oeufs d'apparition sans image (%d) : le jeu teinte un oeuf generique, rien a copier du mod" % len(eggs))
    vanilla = vanilla_missing(data)
    say("  Textures de Minecraft a deposer (%d) : %s" % (len(vanilla), ", ".join(vanilla) if vanilla else "aucune"))
    if vanilla:
        say("    (dans mcitems/<nom>.png, ou mcblocks/<nom>.png pour un bloc)")


if __name__ == "__main__":
    run()
