"""Les icones des onglets de Mecaniques qui n'existent pas telles quelles dans
le mod, composees depuis ses propres textures.

    assets/ui/tab-banner.png   Tribus : la banniere CLASSIC du mod
                               (tribes/ow_teams_banners_styles.png), teinte en
                               degrade comme en jeu (GRADIENT_DOWN), un embleme
                               de tribu au milieu, pendue a sa hampe.
    assets/ui/tab-trophy.png   Succes : le trophee des emblemes de tribu
                               (tribes/emblems/emblem-8.png), dore.
    assets/ui/tab-trail.png    Piste Sauvage : l'icone de l'onglet Piste du jeu
                               (textures/gui/ow_inventory_gui.png), teintee.

Usage :  python tools/build-icons.py
"""

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths  # noqa: E402

A = paths.asset

TOP, BOTTOM = (242, 163, 44), (150, 62, 24)     # l'orange du site, vers le brun
WOOD, WOOD_DARK = (122, 84, 50), (70, 46, 26)
GOLD_LIGHT, GOLD, GOLD_DARK = (255, 226, 120), (233, 177, 21), (150, 98, 10)


def banner():
    sheet = Image.open(A("tribes", "ow_teams_banners_styles.png")).convert("RGBA")
    # La forme CLASSIC : 55 x 93 (tribes.banner.base_width / base_height de l'export).
    shape = sheet.crop((0, 0, 55, 93))
    w, h = shape.size
    px = shape.load()
    for y in range(h):
        t = y / max(1, h - 1)
        tint = tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
        for x in range(w):
            r, g, b, a = px[x, y]
            if not a:
                continue
            k = (r + g + b) / 3 / 200          # le gris de la texture garde son relief
            px[x, y] = tuple(min(255, round(c * k)) for c in tint) + (a,)
    emblem = Image.open(A("tribes", "emblems", "emblem-4.png")).convert("RGBA")
    emblem = emblem.resize((emblem.width * 2, emblem.height * 2), Image.NEAREST)
    shape.alpha_composite(emblem, ((w - emblem.width) // 2, h // 3 - emblem.height // 2))

    pole_h = 6
    out = Image.new("RGBA", (w + 8, h + pole_h), (0, 0, 0, 0))
    out.alpha_composite(shape, (4, pole_h - 1))
    bar = out.load()
    for x in range(out.width):
        for y in range(pole_h - 1):
            edge = y in (0, pole_h - 2) or x in (0, out.width - 1)
            bar[x, y] = (WOOD_DARK if edge else WOOD) + (255,)
    paths.save_image(out, A("ui", "tab-banner.png"))


def trophy():
    # Le trophee : le dernier embleme des tribus (le meme dessin que l'atlas).
    cup = Image.open(A("tribes", "emblems", "emblem-8.png")).convert("RGBA")
    cup = cup.crop(cup.getbbox())
    px = cup.load()
    for y in range(cup.height):
        for x in range(cup.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            v = (r + g + b) / 3
            px[x, y] = ((20, 14, 6) if v < 40 else GOLD_LIGHT if v > 170 else GOLD if v > 100 else GOLD_DARK) + (a,)
    paths.save_image(cup, A("ui", "tab-trophy.png"))


MOD_GUI = os.path.join(paths.MOD_ASSETS, "textures", "gui", "ow_inventory_gui.png")


def trail():
    # L'icone de l'onglet Piste Sauvage du jeu (176, 64), grise en jeu, teintee ici.
    icon = Image.open(MOD_GUI).convert("RGBA").crop((176, 64, 192, 80))
    px = icon.load()
    for y in range(icon.height):
        for x in range(icon.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            v = (r + g + b) / 3
            px[x, y] = ((27, 18, 8) if v < 70 else (201, 138, 58) if v < 170 else (242, 196, 107)) + (a,)
    paths.save_image(icon, A("ui", "tab-trail.png"))


def formulas():
    # Formules : le fragment de manuscrit du mod, tel quel. L'objet est masque
    # (tools/hidden.json) : son image ne peut pas etre servie sous son nom, elle
    # l'est sous celui de l'onglet.
    src = os.path.join(paths.MOD_ASSETS, "textures", "item", "manuscript_fragment.png")
    if os.path.exists(src):
        paths.write_bytes(A("ui", "tab-formulas.png"), open(src, "rb").read())


if __name__ == "__main__":
    banner()
    trophy()
    trail()
    formulas()
    print("icones : ui/tab-banner.png, tab-trophy.png, tab-trail.png, tab-formulas.png")
