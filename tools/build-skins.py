"""Les skins, lus dans le code du mod : nom, description, rarete, prix, deblocage.

Le mod decrit chaque skin a deux endroits, que ce script croise :
  - screen/entity/skins/<Bete>SkinsScreen.java : pour chaque numero de skin,
    ses cles de nom et de description, son deblocage (SkinInfo.level / rarity
    / quest / free / prestige) et sa rarete (la liste de son bouton :
    LEGENDARY_SKIN, EPIC_SKIN, RARE_SKIN, COMMON_SKIN, HALLOWEEN_SKIN) ;
  - entity/.../<Bete>Entity.java, methode changeSkin : quel cosmetique
    (XVariant.Cosmetics.NOM) porte ce numero.
Les textes viennent de lang/fr_fr.json, le prix de SkinRarity.java.

Ecrit js/skin-data.js : OW.SKIN_DATA, une entree par skin, sous l'identifiant
que le site emploie deja (<bete>_<nom du cosmetique>, ex. tiger_gold). js/skins.js
s'en sert pour le nom, la rarete, le prix, le deblocage et la description ;
ses propres fiches n'apportent plus que les images et les modeles 3D.

Usage : python tools/build-skins.py   (tools/sync-wiki.py le lance aussi)
"""

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths  # noqa: E402

SCREENS = os.path.join(paths.MOD_JAVA, "screen", "entity", "skins")
RARITY_JAVA = os.path.join(paths.MOD_JAVA, "screen", "entity", "SkinRarity.java")
LANG = os.path.join(paths.MOD_ASSETS, "lang", "fr_fr.json")
OUT = os.path.join(paths.WIKI, "js", "skin-data.js")

BUTTON_RARITY = {"LEGENDARY_SKIN": "legendary", "EPIC_SKIN": "epic", "RARE_SKIN": "rare",
                 "COMMON_SKIN": "common", "HALLOWEEN_SKIN": "event"}


def read(path):
    try:
        return open(path, encoding="utf-8").read()
    except OSError:
        return ""


def strip_comments(src):
    return re.sub(r"//[^\n]*|/\*.*?\*/", "", src, flags=re.S)


def plain(text):
    """Retire les codes § de Minecraft."""
    return re.sub(r"§.", "", str(text or "")).strip()


def fmt(template, *values):
    """« Niveau %s requis » + 50 -> « Niveau 50 requis »."""
    out = str(template)
    for v in values:
        out = out.replace("%s", str(v), 1)
    return out


def entity_file(cls):
    for folder, _dirs, files in os.walk(os.path.join(paths.MOD_JAVA, "entity")):
        if cls + "Entity.java" in files:
            return os.path.join(folder, cls + "Entity.java")
    return None


def method_body(src, name):
    """Le corps (entre accolades) de la premiere methode `name(`."""
    m = re.search(r"\b" + name + r"\s*\([^)]*\)\s*\{", src)
    if not m:
        return ""
    depth, i = 1, m.end()
    while i < len(src) and depth:
        depth += {"{": 1, "}": -1}.get(src[i], 0)
        i += 1
    return src[m.end():i - 1]


def cosmetics_by_index(cls):
    """numero de skin -> nom du cosmetique (GOLD, VIRUS...), d'apres changeSkin."""
    body = method_body(strip_comments(read(entity_file(cls) or "")), "changeSkin")
    out = {}
    for m in re.finditer(r"(?:case\s+(\d+)\s*->|skinIndex\s*==\s*(\d+)\s*\))\s*this\.\w+\(\s*\w+\.Cosmetics\.(\w+)", body):
        out[int(m.group(1) or m.group(2))] = m.group(3)
    # Le Kodiak Spectral n'est pas une variante : un simple interrupteur.
    for m in re.finditer(r"case\s+(\d+)\s*->\s*this\.setSkinShade\(\s*true\s*\)", body):
        out[int(m.group(1))] = "SHADE"
    return out


def build():
    lang = json.loads(read(LANG) or "{}")
    t = lambda key: plain(lang.get(key, ""))  # noqa: E731
    costs = {m.group(1): int(m.group(2)) for m in re.finditer(r"\b([A-Z]+)\((\d+)\)", read(RARITY_JAVA))}
    data = json.load(open(os.path.join(paths.WIKI, "data", "wiki_data.json"), encoding="utf-8"))

    out = {}
    for e in data.get("entities", []):
        if (e.get("classification") or {}).get("boss"):
            continue
        slug = e.get("path")
        cls = re.sub(r"Entity$", "", e.get("simple_class") or "")
        screen = strip_comments(read(os.path.join(SCREENS, cls + "SkinsScreen.java")))
        if not slug or not screen:
            continue
        infos = {}
        for m in re.finditer(r"case\s+(\d+)\s*->\s*SkinInfo\.(\w+)\(\s*\"([^\"]+)\"\s*,\s*\"([^\"]+)\"\s*(?:,\s*([^)]*))?\)", screen):
            infos[int(m.group(1))] = (m.group(2), m.group(3), m.group(4), (m.group(5) or "").strip())
        rarity = {int(m.group(1)): BUTTON_RARITY.get(m.group(2), "common")
                  for m in re.finditer(r"createSkinButton\([^;]*?,\s*(\d+)\s*,\s*(\w+)\s*\)", screen)}

        for index, cosmetic in cosmetics_by_index(cls).items():
            info = infos.get(index)
            if not info:
                continue
            kind, name_key, desc_key, arg = info
            entry = {
                "entity": slug, "index": index, "cosmetic": cosmetic,
                "name": t(name_key) or cosmetic.title(), "lore": t(desc_key),
                "rarity": rarity.get(index, "common"),
                "unlockType": {"level": "LEVEL", "rarity": "PRESTIGE", "prestige": "PRESTIGE",
                               "quest": "QUEST", "free": "FREE"}.get(kind, kind.upper()),
            }
            if kind == "level":
                entry["unlockValue"] = int(arg)
                entry["unlock"] = fmt(t("tooltip.skinUnlockLevel") or "Niveau %s requis", arg)
            elif kind in ("rarity", "prestige"):
                price = costs.get(arg.split(".")[-1]) if kind == "rarity" else int(arg)
                entry["price"] = price
                entry["unlock"] = fmt(t("tooltip.skinUnlockPrestige") or "Échange contre %s Pièces Sauvages", price)
            elif kind == "quest":
                entry["unlockValue"] = int(arg)
                quest = t("skin.unlock.quest.%s" % arg)
                entry["quest"] = quest
                entry["unlock"] = fmt(t("tooltip.skinUnlockQuest") or "Quête : %s", quest)
            else:
                entry["unlock"] = t("tooltip.skinUnlockFree") or "Disponible par défaut"
            out[slug + "_" + cosmetic.lower()] = entry

    js = ("/* Genere par tools/build-skins.py : ne pas modifier a la main.\n"
          "   Les skins tels que le mod les decrit (nom, description, rarete, prix,\n"
          "   deblocage), lus dans son code et son fichier de langue. js/skins.js s'en sert. */\n"
          "window.OW = window.OW || {};\n"
          "window.OW.SKIN_DATA = " + json.dumps(out, ensure_ascii=False, indent=2) + ";\n")
    paths.write_bytes(OUT, js.encode("utf-8"))
    print("skins lus dans le mod :", len(out), "·", ", ".join(sorted(out)))


if __name__ == "__main__":
    build()
