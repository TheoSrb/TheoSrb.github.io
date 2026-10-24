"""Le livre du manuel d'apprivoisement (js/animal.js, mountBook), taille dans le
journal du mod (textures/gui/mob_page/misc/ow_entity_journal_interface*.png).

Ecrit dans assets/pages/manual/ :
    page-l.png, page-r.png         les deux pages du journal, bords irreguliers et
                                   coins de lianes compris (123 x 178)
    page-l-torn.png, page-r-torn.png   les memes, pages arrachees pres du dos
    cover.png                      la couverture, cuir du journal, abimee : coin
                                   casse, fissure, eraflures, bords uses (128 x 188)
    endpaper.png                   l'interieur de la couverture (128 x 188)
    divider.png                    l'ornement de separation des pages du mod

Les images du mod ne sont pas modifiees : on en decoupe des morceaux.
Usage :  python tools/build-manual.py
"""

import os
import random
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths  # noqa: E402

ROOT = paths.WIKI
MOD = os.path.join(paths.MOD_ASSETS, "textures", "gui", "mob_page")
OUT = paths.asset("pages", "manual")


def _save(im, name):
    """Les images du livre ne sont reecrites que si elles changent."""
    paths.save_image(im, os.path.join(OUT, name))

LEATHER = (106, 51, 24)
LEATHER_DARK = (72, 32, 14)
LEATHER_DEEP = (48, 20, 8)
LEATHER_LIGHT = (138, 74, 40)
SCUFF = (160, 104, 66)


def load(rel):
    return Image.open(os.path.join(MOD, rel)).convert("RGBA")


def pages(src, suffix):
    left = src.crop((5, 3, 128, 181))
    right = src.crop((128, 3, 251, 181))
    _save(left, "page-l%s.png" % suffix)
    _save(right, "page-r%s.png" % suffix)
    return left, right


def cover(vines_from):
    rnd = random.Random(7)
    W, H = 128, 188
    img = Image.new("RGBA", (W, H), LEATHER + (255,))
    px = img.load()
    # Le grain du cuir : des taches de deux cases, et un cuir plus sombre vers
    # les bords (la ou les mains l'ont use).
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            r = rnd.random()
            c = LEATHER_DARK if r < .09 else LEATHER_LIGHT if r < .13 else None
            if c:
                for dy in (0, 1):
                    for dx in (0, 1):
                        if x + dx < W and y + dy < H:
                            px[x + dx, y + dy] = c + (255,)
    for y in range(H):
        for x in range(W):
            d = min(x, y, W - 1 - x, H - 1 - y)
            if 2 <= d < 5 and px[x, y][:3] == LEATHER:
                px[x, y] = LEATHER_DARK + (255,)
    # Le bord : deux cases sombres, puis une couture en pointilles.
    for y in range(H):
        for x in range(W):
            d = min(x, y, W - 1 - x, H - 1 - y)
            if d < 2:
                px[x, y] = LEATHER_DEEP + (255,)
            elif d == 6 and (x + y) % 4 < 2:
                px[x, y] = LEATHER_LIGHT + (255,)
    # Les bords uses : le cuir s'eclaircit par endroits, sur le pourtour.
    for _ in range(90):
        side = rnd.choice("tblr")
        t = rnd.randrange(4, (W if side in "tb" else H) - 4)
        x, y = {"t": (t, 2), "b": (t, H - 3), "l": (2, t), "r": (W - 3, t)}[side]
        for k in range(rnd.randint(1, 3)):
            xx = x + (k if side in "tb" else 0)
            yy = y + (k if side in "lr" else 0)
            if 0 <= xx < W and 0 <= yy < H:
                px[xx, yy] = SCUFF + (255,)
    # Les lianes des coins, reprises du journal (pixels verts seulement).
    # La page de gauche n'en a qu'a gauche : on les reflete pour la droite.
    vp = vines_from.load()
    for (sy, dy) in ((0, 3), (vines_from.height - 22, H - 25)):
        for y in range(22):
            for x in range(22):
                r, g, b, a = vp[x, sy + y]
                if a and g > r + 10:
                    px[3 + x, dy + y] = (r, g, b, 255)
                    px[W - 4 - x, dy + y] = (r, g, b, 255)
    # La plaque du titre : un rectangle creuse (le texte est pose par la page).
    for y in range(58, 108):
        for x in range(18, W - 18):
            edge = y in (58, 107) or x in (18, W - 19)
            bevel = y == 59 or x == 19
            light = y == 106 or x == W - 20
            px[x, y] = (LEATHER_DEEP if edge or bevel else LEATHER_LIGHT if light else LEATHER_DARK) + (255,)
    # Les eraflures : trois griffures en diagonale (une bete est passee par la).
    for (x0, y0, n) in ((84, 22, 16), (89, 20, 18), (94, 22, 15)):
        for i in range(n):
            x, y = x0 + i // 2, y0 + i
            if 0 <= x < W and 0 <= y < H:
                px[x, y] = SCUFF + (255,)
                if x + 1 < W:
                    px[x + 1, y] = LEATHER_DEEP + (255,)
    # La fissure, depuis le coin casse, qui descend en zigzag.
    x, y = W - 14, 12
    for _ in range(46):
        px[x, y] = LEATHER_DEEP + (255,)
        if x - 1 >= 0:
            px[x - 1, y] = LEATHER_LIGHT + (255,)
        y += 1
        x += rnd.choice((-1, 0, 0, 1))
        x = max(20, min(W - 4, x))
    # Le coin casse, en haut a droite : un morceau de carton manque.
    for y in range(0, 16):
        for x in range(W - 16, W):
            if (x - (W - 16)) + (16 - y) > 15 + rnd.randint(-2, 1):
                px[x, y] = (0, 0, 0, 0)
    # Un bord fonce le long de la cassure.
    for y in range(0, 17):
        for x in range(W - 17, W):
            if px[x, y][3] and any(0 <= x + dx < W and 0 <= y + dy < H and px[x + dx, y + dy][3] == 0
                                   for dx, dy in ((1, 0), (0, -1), (1, -1))):
                px[x, y] = LEATHER_DEEP + (255,)
    _save(img, "cover.png")


def endpaper():
    rnd = random.Random(11)
    W, H = 128, 188
    img = Image.new("RGBA", (W, H), LEATHER_DARK + (255,))
    px = img.load()
    # Le papier colle a l'interieur, marbre de brun, avec le rebord du cuir autour.
    for y in range(5, H - 5):
        for x in range(5, W - 5):
            v = rnd.random()
            base = (196, 170, 128) if v > .12 else (170, 140, 98)
            px[x, y] = base + (255,)
    for _ in range(26):
        x, y = rnd.randrange(8, W - 8), rnd.randrange(8, H - 8)
        for i in range(rnd.randint(6, 18)):
            if 5 < x < W - 5 and 5 < y < H - 5:
                px[x, y] = (150, 116, 78, 255)
            x += rnd.choice((-1, 1))
            y += rnd.choice((0, 1))
    _save(img, "endpaper.png")


def divider():
    page = load("taming/tiger_page_taming.png")
    orn = page.crop((19, 28, 118, 40))
    orn = orn.crop(orn.getbbox())
    _save(orn, "divider.png")


def main():
    os.makedirs(OUT, exist_ok=True)
    journal = load("misc/ow_entity_journal_interface_gui.png")
    torn = load("misc/ow_entity_journal_interface_torn_out_gui.png")
    left, _ = pages(journal, "")
    pages(torn, "-torn")
    cover(left)
    endpaper()
    divider()
    print("manuel : pages, pages arrachees, couverture, garde, ornement")


if __name__ == "__main__":
    main()
