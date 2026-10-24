"""Les apercus de partage (Discord, Twitter, WhatsApp...).

Un robot qui lit un lien n'execute pas le JavaScript : il ne voit que le <head>
de la page. Toutes les fiches etant animal.html?e=..., elles montraient toutes
le meme apercu generique. Cet outil ecrit, pour chaque creature :

    partage/<slug>.html    une page minuscule : le titre, la description, la
                           couleur et l'image de la bete pour les robots, puis
                           elle renvoie aussitot le visiteur sur la fiche.
    assets/og/<slug>.png   l'image de l'apercu, 1200 x 630 : son wallpaper (ou,
                           sans lui, son rendu solo), le logo du mod.
    assets/og/site.png     l'apercu des autres pages (l'affiche du mod).

Et il met a jour sitemap.xml. Les images d'origine ne sont jamais modifiees :
les apercus sont des fichiers a part, faits pour les reseaux.

Le lien a partager est partage/<slug>.html (l'ancien dossier c/ est redirige
vers lui par _redirects, pour les liens deja postes).

Usage :
    python tools/build-share.py

A relancer apres l'ajout d'une creature (tools/publish-data.py le lance aussi).
Si le site change d'adresse, modifier SITE ci-dessous.
"""

import html
import json
import os
import re
import sys

from PIL import Image, ImageDraw

SITE = "https://operation-wild-wiki.netlify.app"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths  # noqa: E402  (les images vivent dans le dossier des assets)

ROOT = paths.WIKI
os.chdir(ROOT)
A = paths.asset

W, H = 1200, 630
SHARE_DIR = "partage"   # les pages d'apercu, une par creature (autrefois c/)
PAGES = ["index", "guide", "creatures", "bosses", "biomes", "items", "cosmetics",
         "simulator", "music", "community", "download"]


def plain(text):
    """Retire les codes § de Minecraft."""
    return re.sub(r"§.", "", str(text or "")).strip()


def cover(im, w, h, focus_y=0.45):
    """Recadre en remplissant w x h (comme background-size: cover)."""
    k = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    x = (im.width - w) // 2
    y = int((im.height - h) * focus_y)
    return im.crop((x, y, x + w, y + h))


def shade(canvas):
    """Un voile sombre en bas et a gauche : le rendu ressort, le logo se lit."""
    veil = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(veil)
    for y in range(H):
        a = int(150 * max(0, (y / H) - 0.35) / 0.65)
        d.line([(0, y), (W, y)], fill=(8, 10, 8, a))
    for x in range(W // 2):
        a = int(90 * (1 - x / (W / 2)))
        d.line([(x, 0), (x, H)], fill=(8, 10, 8, a))
    return Image.alpha_composite(canvas, veil)


def stamp_logo(canvas):
    logo = Image.open(A("wordmark.png")).convert("RGBA")
    k = 300 / logo.width
    logo = logo.resize((300, round(logo.height * k)), Image.LANCZOS)
    canvas.alpha_composite(logo, (40, 34))
    return canvas


def solo_path(slug):
    name = " ".join(w.capitalize() for w in slug.split("_"))
    return A("entities", "solo", "%s [SOLO].png" % name)


def creature_image(slug, color):
    # Le wallpaper montre deja la bete en gros plan : il suffit. Sans lui, le
    # rendu solo sur un fond de sa couleur.
    wall = A("wallpapers", "%s.png" % slug)
    solo = solo_path(slug)
    if not os.path.exists(solo):
        solo = A("entities", "%s.png" % slug)
    if os.path.exists(wall):
        canvas = shade(cover(Image.open(wall).convert("RGBA"), W, H))
    else:
        canvas = shade(Image.new("RGBA", (W, H), color or "#0B0F0C"))
    if not os.path.exists(wall) and os.path.exists(solo):
        art = Image.open(solo).convert("RGBA")
        art = art.crop(art.getbbox() or (0, 0, art.width, art.height))
        k = min(560 / art.height, 860 / art.width)
        art = art.resize((round(art.width * k), round(art.height * k)), Image.LANCZOS)
        canvas.alpha_composite(art, (W - art.width - 40, H - art.height - 10))
    # Un liseré de la couleur de la bete, en bas, comme les cartes du site.
    if color and re.match(r"^#[0-9a-fA-F]{6}$", color):
        ImageDraw.Draw(canvas).rectangle([0, H - 10, W, H], fill=color)
    return stamp_logo(canvas)


def site_image():
    canvas = cover(Image.open(A("key-art-cast.png")).convert("RGBA"), W, H, 0.3)
    base = Image.new("RGBA", (W, H), "#0B0F0C")
    return Image.alpha_composite(base, canvas)


SHARE_PAGE = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="{color}">
<link rel="canonical" href="{site}/animal.html?e={slug}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Operation W.I.L.D">
<meta property="og:title" content="{name}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{site}/partage/{slug}.html">
<meta property="og:image" content="{site}/assets/og/{slug}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{name}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{site}/assets/og/{slug}.png">
<meta http-equiv="refresh" content="0; url=../animal.html?e={slug}">
<script>location.replace('../animal.html?e={slug}' + location.hash);</script>
<style>body{{background:#0B0F0C;color:#F2EBDD;font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}}a{{color:{color}}}</style>
</head>
<body><a href="../animal.html?e={slug}">{name} — ouvrir la fiche</a></body>
</html>
"""


def main():
    data = json.load(open("data/wiki_data.json", encoding="utf-8"))
    os.makedirs(A("og"), exist_ok=True)
    os.makedirs(SHARE_DIR, exist_ok=True)

    paths.save_image(site_image().convert("RGB"), A("og", "site.png"), optimize=True)

    made = []
    for e in data.get("entities", []):
        cls = e.get("classification") or {}
        if cls.get("boss"):
            continue
        slug = e.get("path")
        if not slug:
            continue
        name = plain((e.get("names") or {}).get("fr_fr")) or slug
        g = e.get("gameplay") or {}
        color = g.get("entity_color_hex") or "#F2A32C"
        pages = ((e.get("lore") or {}).get("adventurer_manuscript") or [])
        desc = plain(pages[0].get("plain")) if pages else ""
        if not desc:
            desc = "La fiche complète de la créature : statistiques, apprivoisement, capacités, butin."
        if len(desc) > 200:
            desc = desc[:197].rsplit(" ", 1)[0] + "…"

        paths.save_image(creature_image(slug, color).convert("RGB"), A("og", "%s.png" % slug), optimize=True)
        page = SHARE_PAGE.format(
            site=SITE, slug=html.escape(slug), name=html.escape(name + " · Operation W.I.L.D"),
            title=html.escape(name + " - Operation W.I.L.D"), desc=html.escape(desc),
            color=html.escape(color))
        open(os.path.join(SHARE_DIR, "%s.html" % slug), "w", encoding="utf-8", newline="\n").write(page)
        made.append(slug)

    # sitemap.xml : les pages, et chaque fiche a son adresse de partage.
    urls = ["%s/%s" % (SITE, "" if p == "index" else p + ".html") for p in PAGES]
    urls += ["%s/animal.html?e=%s" % (SITE, s) for s in made]
    xml = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    xml += ["  <url><loc>%s</loc></url>" % html.escape(u) for u in urls]
    xml.append("</urlset>")
    open("sitemap.xml", "w", encoding="utf-8", newline="\n").write("\n".join(xml) + "\n")

    print("apercus de partage :", ", ".join(made) or "aucun", "· sitemap :", len(urls), "adresses")


if __name__ == "__main__":
    sys.exit(main())
