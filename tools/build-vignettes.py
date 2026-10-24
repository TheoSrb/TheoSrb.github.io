"""Les vignettes des rendus solo (assets/entities/solo/<Nom> [SOLO].png).

Un rendu solo fait 2560 x 1440 : pres de 15 Mo de memoire vive une fois
decode, pour une carte qui l'affiche sur 300 pixels. Sur un telephone, une page
de cartes en garde plus de 200 Mo et l'onglet passe son temps a en manquer.

Pour chaque rendu, ecrit sa vignette au meme chemin sous vignettes/ :
le meme PNG, sans perte, en 1280 x 720 (la moitie de chaque cote, un quart des
pixels). C'est encore deux a quatre fois plus de pixels que ce qu'une carte
affiche, ecran de telephone compris : a l'oeil, rien ne change. Les cartes,
la Nouveaute de l'accueil, le podium du guide et les portraits de Mecaniques
la prennent (js/site.js, OW.soloVignette) ; la fiche, l'anneau de l'accueil et
le labo gardent l'original. L'original n'est jamais modifie.

Une vignette n'est refaite que si son original est plus recent qu'elle, et
n'est reecrite que si elle change vraiment. Un rendu depose sans relancer
l'outil s'affiche quand meme : le site retombe sur l'original.

Usage : python tools/build-vignettes.py   (tools/sync-wiki.py le lance aussi)
"""

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths  # noqa: E402

SOLO = paths.asset("entities", "solo")
VIGNETTES = paths.asset("vignettes", "entities", "solo")
WIDTH = 1280

count, made, total = 0, 0, 0
names = sorted(os.listdir(SOLO)) if os.path.isdir(SOLO) else []
for name in names:
    if not name.lower().endswith(".png"):
        continue
    path = os.path.join(SOLO, name)
    out = os.path.join(VIGNETTES, name)
    count += 1
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(path):
        total += os.path.getsize(out)
        continue
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    if w > WIDTH:
        # Reduite en alpha premultiplie : le bord de la bete ne prend pas la
        # couleur des pixels transparents qui l'entourent (pas de liseré).
        im = im.convert("RGBa").resize((WIDTH, max(1, round(WIDTH * h / w))), Image.LANCZOS).convert("RGBA")
    if paths.save_image(im, out, optimize=True):
        made += 1
    os.utime(out, None)  # a jour, meme identique : pas refaite au prochain passage
    total += os.path.getsize(out)

# Une vignette dont le rendu a disparu s'en va aussi.
if os.path.isdir(VIGNETTES):
    for name in os.listdir(VIGNETTES):
        if name not in names:
            os.remove(os.path.join(VIGNETTES, name))

print("vignettes des rendus solo :", count, "dont", made, "refaites,", total // 1024, "Ko au total")
