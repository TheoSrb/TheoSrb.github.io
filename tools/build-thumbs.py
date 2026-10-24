"""Les vignettes floues des gros rendus (chargement progressif).

Pour chaque PNG de plus de 500 Ko du dossier des assets, ecrit une petite image
floue (~320 px de large) au meme chemin sous thumbs/. Elle s'affiche le temps
que l'original arrive (js/site.js, progressive) ; l'original, lui, n'est
jamais modifie ni recompresse.

Une vignette n'est refaite que si son original est plus recent qu'elle, et
n'est reecrite que si elle change vraiment.

Usage : python tools/build-thumbs.py   (tools/sync-wiki.py le lance aussi)
"""

import os
import sys

from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths  # noqa: E402

THUMBS = paths.asset("thumbs")

count, made, total = 0, 0, 0
for folder, dirs, names in os.walk(paths.ASSETS):
    dirs[:] = [d for d in dirs if d not in (".git", "thumbs", "vignettes")]
    for name in names:
        if not name.lower().endswith(".png"):
            continue
        path = os.path.join(folder, name)
        if os.path.getsize(path) < 500 * 1024:
            continue
        out = os.path.join(THUMBS, os.path.relpath(path, paths.ASSETS))
        count += 1
        if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(path):
            total += os.path.getsize(out)
            continue
        im = Image.open(path).convert("RGBA")
        w, h = im.size
        small = im.resize((64, max(1, round(64 * h / w))), Image.LANCZOS)
        thumb = small.resize((320, max(1, round(320 * h / w))), Image.BILINEAR).filter(ImageFilter.GaussianBlur(3))
        if paths.save_image(thumb, out, optimize=True):
            made += 1
        os.utime(out, None)  # a jour, meme identique : pas refaite au prochain passage
        total += os.path.getsize(out)
print("vignettes :", count, "dont", made, "refaites,", total // 1024, "Ko au total")
