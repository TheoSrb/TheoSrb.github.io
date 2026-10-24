"""Inventaire des fichiers du dossier assets/, pour que le site en ligne cesse
de deviner.

Le wiki nomme ses visuels et ses sons par convention (js/site.js, « images a
chemin conventionnel ») et essaie plusieurs chemins jusqu'au bon : chaque essai
rate est une requete 404, une centaine sur une fiche de creature. Avec cet
inventaire, le site en ligne sait d'avance quels fichiers existent et ne
demande plus que ceux-la.

Ecrit js/asset-list.js :
    OW.ASSET_LIST.files       { dossier: [fichiers] }
    OW.ASSET_LIST.gifSeconds  { chemin: duree d'un tour, en secondes }

La duree des GIF evite a la fiche de telecharger chaque apercu anime une
seconde fois pour la mesurer (js/animal.js, gifSeconds).

En local (localhost, 127.0.0.1, fichier), le site ignore l'inventaire et essaie
tout, comme avant : un fichier depose apparait tout de suite. EN LIGNE, un
fichier absent de l'inventaire n'est essaye qu'en dernier recours.

Usage :
    python tools/list-assets.py

A relancer apres chaque ajout, renommage ou suppression dans assets/, avant de
deployer. tools/publish-data.py le lance aussi a la fin.
"""

import json
import os
import re

import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths  # noqa: E402  (tools/paths.py : ou vivent les assets)

ROOT = paths.WIKI
OUT = os.path.join(ROOT, "js", "asset-list.js")

# Ce que le dossier des assets contient sans que le site le serve.
SKIP_DIRS = {".git", ".github"}
SKIP_FILES = {"desktop.ini", "thumbs.db", ".ds_store", ".nojekyll", ".gitignore", ".gitattributes",
              "lisez-moi.md", "readme.md"}


def secret_words():
    """Les noms de tools/hidden.json : aucun ne doit apparaitre dans l'inventaire."""
    return paths.SECRET_PATTERNS


def gif_seconds(path):
    """Somme des delais d'un GIF, bloc par bloc (la meme lecture que js/animal.js)."""
    b = open(path, "rb").read()
    if len(b) < 13 or b[:3] != b"GIF":
        return None
    i = 13
    if b[10] & 0x80:
        i += 3 * (1 << ((b[10] & 0x07) + 1))

    def skip(k):
        while k < len(b) and b[k] != 0:
            k += b[k] + 1
        return k + 1

    total = 0
    while i < len(b):
        block = b[i]
        if block == 0x21:
            if b[i + 1] == 0xF9:
                total += b[i + 4] | (b[i + 5] << 8)
            i = skip(i + 2)
        elif block == 0x2C:
            flags = b[i + 9]
            i += 10
            if flags & 0x80:
                i += 3 * (1 << ((flags & 0x07) + 1))
            i = skip(i + 1)
        else:
            break
    return total / 100


def main():
    secrets = secret_words()
    files = {}
    gifs = {}
    count = 0
    for folder, dirs, names in os.walk(paths.ASSETS):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        # Le chemin tel que le site le demande : assets/<dossier>.
        rel_dir = paths.web(folder).rstrip("/.").rstrip("/")
        kept = []
        for name in sorted(names):
            if name.lower() in SKIP_FILES:
                continue
            rel = rel_dir + "/" + name
            if any(p.search(rel.lower()) for p in secrets):
                continue
            kept.append(name)
            if name.lower().endswith(".gif"):
                seconds = gif_seconds(os.path.join(folder, name))
                if seconds:
                    gifs[rel] = seconds
        if kept:
            files[rel_dir] = kept
            count += len(kept)

    payload = {"files": dict(sorted(files.items())), "gifSeconds": dict(sorted(gifs.items()))}
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("/* Genere par tools/list-assets.py : ne pas modifier a la main.\n"
                "   Les fichiers presents dans assets/, pour que le site en ligne ne devine plus. */\n")
        f.write("window.OW = window.OW || {};\n")
        f.write("window.OW.ASSET_LIST = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print("js/asset-list.js : %d fichiers, %d GIF mesures" % (count, len(gifs)))


if __name__ == "__main__":
    main()
