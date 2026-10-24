"""Les curseurs du wiki : une patte, tiree de l'icone d'apprivoisement du mod
(assets/ui/taming_exp.png, 11 x 11 cases), en bleu marine et noir.

Ecrit assets/ui/cursors/<etat>.png (1x) et <etat>@2x.png (ecrans nets), un
pixel du dessin = 2 pixels d'ecran (4 en @2x) :
    paw        la patte ouverte, partout
    point      les doigts ecartes et tournes vers l'exterieur : un lien, un bouton
    point-half les doigts a mi-chemin : l'image de passage entre paw et point
    press      la patte refermee : le bouton de la souris est enfonce
    press-half la patte a moitie refermee : l'image de passage entre paw et press
    grab       les doigts ecartes : ce qui se fait glisser (modele 3D...)
    grabbing   la patte refermee sur ce qu'elle tient
    scroll     la patte et deux petites fleches : le clic molette, souris au repos (js/ux.js)
    scroll-up / scroll-down  la patte et sa fleche, pendant ce defilement
    no         la patte grise barree : desactive
    wait       la patte et trois points : ca charge
Les points chauds (ou le clic tombe) sont dans css/ux.css, section curseurs.

Usage :  python tools/build-cursors.py
"""

import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths  # noqa: E402

ROOT = paths.WIKI
OUT = paths.asset("ui", "cursors")

# L'icone du mod, case par case (b clair, c sombre, d milieu, e ombre).
PAW = [
    "...bc.bc...",
    "...dc.dc...",
    "dc.cc.cc.dc",
    "cc.ee.ee.cc",
    "ee.bbbbb.ee",
    "..bdddddc..",
    ".bdddddddc.",
    ".bdddddddc.",
    ".eccdddcce.",
    "..eecccee..",
    "....eee....",
]
# La version sombre : bleu marine et noir, peu saturee, un reflet gris-bleu sur le haut des coussinets.
DARK = {"b": (104, 116, 140), "c": (24, 28, 38), "d": (38, 44, 60), "e": (12, 14, 19)}
GREY = {"b": (150, 146, 140), "c": (60, 58, 56), "d": (84, 81, 78), "e": (40, 39, 38)}
OUTLINE = (243, 230, 200)   # le liseré creme : lisible sur le fond sombre du site
HEART = (196, 118, 124)
RED = (178, 84, 72)


def grid(rows):
    return {(x, y): ch for y, row in enumerate(rows) for x, ch in enumerate(row) if ch != "."}


def toes_and_pad(cells):
    """Separe les quatre doigts du coussinet principal."""
    toes = {"tl": {}, "tr": {}, "l": {}, "r": {}}
    pad = {}
    for (x, y), ch in cells.items():
        if y <= 3 and 3 <= x <= 4: toes["tl"][(x, y)] = ch
        elif y <= 3 and 6 <= x <= 7: toes["tr"][(x, y)] = ch
        elif 2 <= y <= 4 and x <= 1: toes["l"][(x, y)] = ch
        elif 2 <= y <= 4 and x >= 9: toes["r"][(x, y)] = ch
        else: pad[(x, y)] = ch
    return toes, pad


def moved(part, dx, dy):
    return {(x + dx, y + dy): ch for (x, y), ch in part.items()}


def compose(pad, toes, shifts):
    cells = dict(pad)
    for key, (dx, dy) in shifts.items():
        cells.update(moved(toes[key], dx, dy))
    return cells


def rotated(part, degrees, pivot, shift=(0, 0)):
    """Un doigt pivote autour de sa base, case par case (plus proche voisin,
    sans trous) : chaque case d'arrivee va chercher la case d'origine."""
    a = math.radians(degrees)
    px, py = pivot
    xs = [x for x, _ in part]
    ys = [y for _, y in part]
    out = {}
    for y in range(min(ys) - 4, max(ys) + 5):
        for x in range(min(xs) - 4, max(xs) + 5):
            cx, cy = x + .5 - px, y + .5 - py
            sx = px + cx * math.cos(-a) - cy * math.sin(-a)
            sy = py + cx * math.sin(-a) + cy * math.cos(-a)
            src = (math.floor(sx), math.floor(sy))
            if src in part:
                out[(x + shift[0], y + shift[1])] = part[src]
    return out


def fanned(pad, toes, k=1.0):
    """Les doigts ecartes et tournes vers l'exterieur : la patte veut attraper.
    k < 1 : la patte a mi-chemin (une image de l'animation, js/ux.js)."""
    cells = dict(pad)
    side = (-1 if k >= .75 else 0)
    cells.update(rotated(toes["tl"], -34 * k, (4.0, 4.0)))
    cells.update(rotated(toes["tr"], 34 * k, (7.0, 4.0)))
    cells.update(rotated(toes["l"], -42 * k, (2.0, 5.0), (side, 0)))
    cells.update(rotated(toes["r"], 42 * k, (9.0, 5.0), (-side, 0)))
    return cells


BASE = grid(PAW)
TOES, PAD = toes_and_pad(BASE)
SHAPES = {
    "paw": BASE,
    # Refermee : les doigts se replient sur le coussinet.
    "press": compose(PAD, TOES, {"tl": (0, 2), "tr": (0, 2), "l": (1, 2), "r": (-1, 2)}),
    # Ecartee : les doigts s'ouvrent pour attraper.
    "grab": compose(PAD, TOES, {"tl": (-1, 0), "tr": (1, 0), "l": (-1, -1), "r": (1, -1)}),
}
SHAPES["grabbing"] = SHAPES["press"]
# Les images de passage (js/ux.js les enchaine en quelques dizaines de ms) :
# la patte a moitie refermee, et les doigts a moitie ecartes.
SHAPES["press-half"] = compose(PAD, TOES, {"tl": (0, 1), "tr": (0, 1), "l": (0, 1), "r": (0, 1)})


def render(cells, palette, extra=None, scale=2, size=32, origin=(1, 4)):
    """Dessine les cases a `scale` pixels, liseré compris, dans un carre `size`."""
    img = Image.new("RGBA", (size * scale // 2, size * scale // 2), (0, 0, 0, 0))
    px = img.load()
    ox, oy = origin
    k = scale

    def put(x, y, rgb):
        for i in range(k):
            for j in range(k):
                X, Y = (ox + x) * k + i, (oy + y) * k + j
                if 0 <= X < img.width and 0 <= Y < img.height:
                    px[X, Y] = rgb + (255,)

    # Le liseré : chaque case vide voisine d'une case pleine.
    filled = set(cells)
    for (x, y) in list(filled):
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                n = (x + dx, y + dy)
                if n not in filled and abs(dx) + abs(dy) == 1:
                    put(*n, OUTLINE)
    for (x, y), ch in cells.items():
        put(x, y, palette[ch])
    for (x, y, rgb) in (extra or []):
        put(x, y, rgb)
    return img


def heart(x0, y0):
    shape = [".#.#.", "#####", "#####", ".###.", "..#.."]
    cells = []
    for y, row in enumerate(shape):
        for x, ch in enumerate(row):
            if ch == "#":
                cells.append((x0 + x, y0 + y, HEART))
    # le petit reflet
    cells.append((x0 + 1, y0 + 1, (255, 190, 196)))
    return cells


def badge_no(x0, y0):
    ring = []
    for y in range(5):
        for x in range(5):
            edge = x in (0, 4) or y in (0, 4)
            corner = (x in (0, 4)) and (y in (0, 4))
            if edge and not corner:
                ring.append((x0 + x, y0 + y, RED))
            elif x == y and 0 < x < 4:
                ring.append((x0 + x, y0 + y, RED))
    return ring


ARROW_UP = ["..c..", ".ccc.", "ccccc"]


def arrow(x0, y0, up=True):
    """Une fleche de 5 cases, pointe en haut ou en bas, aux couleurs de la patte."""
    rows = ARROW_UP if up else ARROW_UP[::-1]
    return {(x0 + x, y0 + y): ch for y, row in enumerate(rows) for x, ch in enumerate(row) if ch != "."}


def scrolling(up):
    """Le curseur du defilement au clic molette (js/ux.js) : la patte et la
    fleche du sens ou l'on part (True : vers le haut, False : vers le bas)."""
    top = 4 if up else 0
    cells = moved(BASE, 0, top)
    cells.update(arrow(3, 0, True) if up else arrow(3, 12, False))
    return cells


def scroll_idle():
    """Le curseur au repos pendant ce defilement : la patte et deux petites
    fleches, une en haut, une en bas. Aucun repere n'est pose sur la page :
    la seule chose a l'ecran est la patte."""
    up, down = [".c.", "ccc"], ["ccc", ".c."]
    cells = moved(BASE, 0, 3)
    cells.update({(4 + x, y): ch for y, row in enumerate(up) for x, ch in enumerate(row) if ch != "."})
    cells.update({(4 + x, 14 + y): ch for y, row in enumerate(down) for x, ch in enumerate(row) if ch != "."})
    return cells


def dots(x0, y0):
    return [(x0 + i * 2, y0, (243, 230, 200)) for i in range(3)]


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = {
        "paw": (SHAPES["paw"], DARK, None),
        "point": (fanned(PAD, TOES), DARK, None),
        "press": (SHAPES["press"], DARK, None),
        "press-half": (SHAPES["press-half"], DARK, None),
        "point-half": (fanned(PAD, TOES, .5), DARK, None),
        "grab": (SHAPES["grab"], DARK, None),
        "grabbing": (SHAPES["grabbing"], DARK, None),
        "no": (SHAPES["paw"], GREY, badge_no(9, 6)),
        "wait": (SHAPES["paw"], DARK, dots(10, 11)),
    }
    for name, (cells, palette, extra) in jobs.items():
        # Les doigts ecartes debordent d'une case a gauche : on decale d'autant
        # (le point chaud de css/ux.css en tient compte).
        origin = (2, 4) if name in ("grab", "point", "point-half") else (1, 4)
        render(cells, palette, extra, scale=2, origin=origin).save(os.path.join(OUT, name + ".png"))
        render(cells, palette, extra, scale=4, origin=origin).save(os.path.join(OUT, name + "@2x.png"))
    # Le clic molette : deux curseurs (18 cases, fleche en haut ou en bas) et le
    # curseur au repos (la patte et deux petites fleches).
    scroll_jobs = {"scroll-up": (scrolling(True), 36), "scroll-down": (scrolling(False), 36), "scroll": (scroll_idle(), 36)}
    for name, (cells, size) in scroll_jobs.items():
        render(cells, DARK, None, scale=2, size=size, origin=(1, 1)).save(os.path.join(OUT, name + ".png"))
        render(cells, DARK, None, scale=4, size=size, origin=(1, 1)).save(os.path.join(OUT, name + "@2x.png"))
    print("curseurs :", ", ".join(list(jobs) + list(scroll_jobs)))


if __name__ == "__main__":
    main()
