"""Les biomes du theme clair, derives de ceux du theme sombre.

Chaque palette de nuit (css/biome-world.css) donne sa palette de jour : chaque
couleur garde sa teinte, les plans gardent leur etagement (du lointain clair au
proche fonce), et le tout remonte en lumiere, un peu plus sature. Le calcul se
fait en OKLCH, ou la luminosite se deplace sans faire deriver la teinte.

Le resultat remplace, dans css/theme-light.css, le bloc compris entre les deux
reperes « palettes de jour ». A relancer apres avoir retouche une palette de
nuit :

    python tools/build-light-biomes.py
"""

import math
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DARK = os.path.join(ROOT, "css", "biome-world.css")
LIGHT = os.path.join(ROOT, "css", "theme-light.css")
BEGIN = "/* >>> palettes de jour : generees par tools/build-light-biomes.py, ne pas modifier a la main <<< */"
END = "/* >>> fin des palettes de jour generees <<< */"

# ---- les reglages ---------------------------------------------------------------------
# Une luminosite L (0 a 1) devient a + b * L ; la saturation est multipliee par
# k + kd * (1 - L) (les couleurs sombres, ternes par nature, en recoivent plus),
# et ne descend pas sous « floor » si la couleur a une teinte.

SKY = {"a": 0.56, "b": 0.42, "k": 1.2, "floor": 0.055}
LAND = {"a": 0.24, "b": 0.86, "cap": 0.95, "k": 1.15, "kd": 0.55}
# Sous l'eau et sous terre : on eclaire moins, ce sont des lieux sombres.
DEEP_SKY = {"a": 0.34, "b": 0.72, "k": 1.1, "floor": 0.05}
DEEP_LAND = {"a": 0.2, "b": 0.8, "cap": 0.95, "k": 1.1, "kd": 0.4}
DEEP = {"abyss", "lukewarm", "cave"}
# La brume, moitie moins epaisse : de jour, c'est elle qui blanchissait tout.
MIST_O = 0.55

PER = {
    # La banquise est deja un plein jour polaire : l'eclaircir encore la rendait blanche.
    "frozen": {"sky": {"a": 0.3, "b": 0.72, "floor": 0}, "land": {"a": 0.06, "b": 0.97, "k": 1.1, "kd": 0.2}, "mist_o": 0.4},
    # Les abysses gardent leur bleu-violet au lieu de tourner au gris.
    "abyss": {"sky": {"k": 1.3, "floor": 0.09}, "land": {"k": 1.3, "kd": 0.6}},
    # Les dunes ne doivent pas se fondre dans l'horizon.
    "desert": {"land": {"a": 0.16}},
    "cave": {"sky": {"a": 0.28, "floor": 0}},
}

LAND_KEYS = re.compile(r"^--(far|mid|near|side|ceiling|ceil|vine|fg|water|cap|hi)(-|$)")


# ---- OKLab / OKLCH ------------------------------------------------------------------

def _lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _gam(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def to_oklch(hexv):
    h = hexv.lstrip("#")
    r, g, b = (_lin(int(h[i:i + 2], 16)) for i in (0, 2, 4))
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = (math.copysign(abs(v) ** (1 / 3), v) for v in (l, m, s))
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(A, B), math.degrees(math.atan2(B, A)) % 360


def _linear_rgb(L, C, H):
    A, B = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
    l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
    m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
    s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3
    return (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)


def to_hex(L, C, H):
    """La couleur la plus saturee possible sous C qui tienne dans le sRGB."""
    L = max(0.0, min(1.0, L))
    inside = lambda c: all(-1e-4 <= v <= 1 + 1e-4 for v in _linear_rgb(L, c, H))
    if not inside(C):
        lo, hi = 0.0, C
        for _ in range(30):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if inside(mid) else (lo, mid)
        C = lo
    return "#" + "".join("%02X" % max(0, min(255, round(_gam(max(0.0, v)) * 255))) for v in _linear_rgb(L, C, H))


def remap(hexv, rule, over):
    rule = dict(rule, **over)
    L, C, H = to_oklch(hexv)
    L2 = min(rule.get("cap", 1.0), rule["a"] + rule["b"] * L)
    C2 = C * (rule["k"] + rule.get("kd", 0) * (1 - L))
    if C > 0.008 and C2 < rule.get("floor", 0):
        C2 = rule["floor"]
    return to_hex(L2, C2, H)


def trip_to_hex(t):
    return "#" + "".join("%02X" % int(x) for x in t.split(","))


def hex_to_trip(h):
    h = h.lstrip("#")
    return ", ".join(str(int(h[i:i + 2], 16)) for i in (0, 2, 4))


# ---- la generation ----------------------------------------------------------------

def day_palette(biome, body):
    deep = biome in DEEP
    per = PER.get(biome, {})
    sky, land = (DEEP_SKY, DEEP_LAND) if deep else (SKY, LAND)
    over_sky, over_land = per.get("sky", {}), per.get("land", {})
    out = []
    for key, value in re.findall(r"(--[a-z0-9-]+):\s*([^;]+);", re.sub(r"/\*.*?\*/", "", body, flags=re.S)):
        value = value.strip()
        if key == "--sky":
            value = re.sub(r"#[0-9A-Fa-f]{6}", lambda m: remap(m.group(0), sky, over_sky), value)
        elif key == "--mist":
            value = hex_to_trip(remap(trip_to_hex(value), land, over_land))
        elif key == "--mist-o":
            value = "%.2f" % (float(value) * per.get("mist_o", MIST_O))
        elif LAND_KEYS.match(key) and re.fullmatch(r"#[0-9A-Fa-f]{6}", value):
            value = remap(value, land, over_land)
        # Le soleil, les lueurs, les particules et les rais sont deja des lumieres :
        # ils restent tels quels.
        out.append("%s: %s;" % (key, value))
    lines = [":root[data-theme='light'] .bw-scene[data-biome='%s'] {" % biome]
    lines += ["  " + d for d in out if d.startswith("--sky:")]
    rest = [d for d in out if not d.startswith("--sky:")]
    lines += ["  " + " ".join(rest[i:i + 5]) for i in range(0, len(rest), 5)]
    return "\n".join(lines + ["}"])


def main():
    dark = open(DARK, encoding="utf-8").read()
    blocks = re.findall(r"\.bw-scene\[data-biome='([a-z]+)'\]\s*\{([^}]*--sky:[^}]*)\}", dark)
    generated = "\n".join([BEGIN] + [day_palette(b, body) for b, body in blocks] + [END])
    light = open(LIGHT, encoding="utf-8").read()
    if BEGIN not in light or END not in light:
        raise SystemExit("Reperes introuvables dans css/theme-light.css")
    head, rest = light.split(BEGIN, 1)
    _, tail = rest.split(END, 1)
    updated = head + generated + tail
    if updated != light:
        open(LIGHT, "w", encoding="utf-8", newline="\n").write(updated)
    print("palettes de jour :", len(blocks), "biomes", "(mises a jour)" if updated != light else "(inchangees)")


if __name__ == "__main__":
    main()
