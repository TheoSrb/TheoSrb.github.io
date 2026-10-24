"""La mise a jour complete du wiki depuis le mod.

C'est ce que lance la tache Gradle du mod :
    IntelliJ : Operation-W.I.L.D [runWikiDatas]      (ou : gradlew runWikiDatas)

Dans l'ordre :
  1. Le JSON. L'export du mod (src/generated/resources/wiki_data.json) passe par
     tools/publish-data.py : les secrets de tools/hidden.json en sont retires,
     puis il remplace data/wiki_data.json. Jamais de copie brute.
  2. Les assets tires du mod : textures des objets et des blocs, textures des
     betes (variantes, skins, selles...), icones d'effets, arenes, planches des
     tribus, pieces, orbes d'XP, visages animes des skins, sons de chaque bete
     (d'apres sounds.json : les sons de skin compris), autres sons, musiques.
  3. Les assets tires du dossier du Bureau (Operation W.I.L.D) : wallpapers
     officiels, logo, titre, theme principal. Et les textures de Minecraft
     (Minecraft Textures 1.21.1) : item/ -> mcitems/, block/ -> mcblocks/.
  4. Ce qui se fabrique a partir d'eux : modeles 3D (data/models.json), livre
     du manuel, icones de Mecaniques, fiches des skins (js/skin-data.js : nom,
     rarete, prix, deblocage lus dans le code du mod), vignettes floues, apercus de partage,
     passants du pied de page, silhouettes des betes a venir, inventaire des
     fichiers (js/asset-list.js).
  5. La publication : le dossier des assets part sur GitHub (commit + push),
     apres une derniere verification qu'aucun nom secret n'y figure. Le site
     les voit une minute plus tard (GitHub Pages).

Tout est ecrit dans le dossier des assets (tools/paths.py) : la racine du depot
GitHub Operation-W.I.L.D-Wiki-Assets. Rien n'est supprime ni recompresse :
  - un fichier absent est ajoute ;
  - un fichier different est remplace si la source est plus recente ; l'ancien
    est garde dans tools/private/backup/<date>/ (les 5 derniers passages) ;
  - un fichier different mais PLUS RECENT que la source (retouche a la main)
    est garde, et signale.
N'entre jamais dans le dossier : ce qui cite un secret de tools/hidden.json, ni
ce qui cite une espece dont le mod a les textures mais que l'export ne publie pas.

Le compte rendu s'affiche a la fin, suivi du bilan de ce qui manque encore,
bete par bete, par rapport au tigre (tools/bilan.py, qui se lance aussi seul).
Les deux restent dans tools/private/last-sync.txt.

Usage a la main :
    python tools/sync-wiki.py                   tout (chemins de tools/paths.json)
    python tools/sync-wiki.py --export <json>   en partant d'un export precis
    python tools/sync-wiki.py --no-cameos       sans refaire les passants (Chrome)
    python tools/sync-wiki.py --no-push         sans publier sur GitHub
"""

import argparse
import datetime
import json
import os
import re
import runpy
import shutil
import subprocess
import sys
import time
from collections import Counter, OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))


def parse_args():
    ap = argparse.ArgumentParser(description="Met a jour le JSON et tous les assets du wiki depuis le mod.")
    ap.add_argument("--mod", help="le projet Java du mod")
    ap.add_argument("--export", help="le wiki_data.json genere par le mod")
    ap.add_argument("--assets", help="le dossier des assets (racine du depot GitHub)")
    ap.add_argument("--studio", help="le dossier de travail du Bureau (Operation W.I.L.D)")
    ap.add_argument("--no-cameos", action="store_true", help="ne pas refaire les passants du pied de page")
    ap.add_argument("--cameos", action="store_true", help="refaire les passants meme si les modeles n'ont pas change")
    ap.add_argument("--no-push", action="store_true", help="ne pas publier le dossier des assets sur GitHub")
    return ap.parse_args()


ARGS = parse_args()
# Les chemins passes par Gradle l'emportent sur tools/paths.json (voir tools/paths.py).
for flag, env in (("mod", "OW_MOD_DIR"), ("assets", "OW_ASSETS_DIR"), ("studio", "OW_STUDIO_DIR")):
    if getattr(ARGS, flag):
        os.environ[env] = getattr(ARGS, flag)
os.environ["OW_SYNC"] = "1"

sys.path.insert(0, HERE)
import paths  # noqa: E402

A = paths.asset
T = os.path.join(paths.MOD_ASSETS, "textures")
LOG = []


def say(*parts):
    line = " ".join(str(p) for p in parts)
    LOG.append(line)
    print(line, flush=True)


def title(text):
    say("")
    say("== " + text + " " + "=" * max(3, 60 - len(text)))


# ---- la regle de copie ---------------------------------------------------------------

class Sync:
    def __init__(self):
        self.stats = OrderedDict()
        self.kept = []          # plus recents a l'arrivee : gardes
        self.hidden = Counter()  # ecartes (secrets, especes non publiees)
        self.stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        self.backup_root = os.path.join(paths.TOOLS, "private", "backup")
        self.unpublished = []   # especes que le mod dessine mais que l'export ne publie pas

    def _count(self, group, what):
        self.stats.setdefault(group, Counter())[what] += 1

    def blocked(self, text):
        low = str(text).lower()
        if paths.secret(low):
            return True
        return any(re.search(r"(?<![a-z0-9])" + re.escape(w) + r"(?![a-z0-9])", low) for w in self.unpublished)

    def put(self, src, rel, group):
        """Copie src vers <assets>/rel selon la regle du plus recent."""
        rel = rel.replace("\\", "/")
        if self.blocked(rel) or self.blocked(os.path.basename(src)):
            self.hidden[group] += 1
            return "hidden"
        dst = A(*rel.split("/"))
        if not os.path.exists(dst):
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
            self._count(group, "ajoutes")
            return "added"
        if same(src, dst):
            self._count(group, "a jour")
            return "same"
        # Une copie telle quelle d'un AUTRE fichier du mod n'est pas une retouche
        # a proteger : c'est une erreur d'aiguillage (ex. un son copie d'apres son
        # nom de fichier alors que sounds.json en joue un autre). Elle est remplacee.
        stray = digest(dst) in mod_digests()
        if stray or os.path.getmtime(src) >= os.path.getmtime(dst):
            backup = os.path.join(self.backup_root, self.stamp, *rel.split("/"))
            os.makedirs(os.path.dirname(backup), exist_ok=True)
            shutil.copy2(dst, backup)
            shutil.copy2(src, dst)
            self._count(group, "remplaces")
            if dst.lower().endswith(".ogg"):
                self.refresh_mp3_twin(dst, group)
            return "updated"
        self.kept.append(rel)
        self._count(group, "gardes (plus recents)")
        return "kept"

    def refresh_mp3_twin(self, ogg, group):
        """Un son deja livre aussi en .mp3 (pour Safari) : sa jumelle suit le nouveau
        .ogg, sinon Safari jouerait l'ancien son. Aucune jumelle n'est creee."""
        mp3 = ogg[:-4] + ".mp3"
        ffmpeg = shutil.which("ffmpeg")
        if not os.path.exists(mp3):
            return
        if not ffmpeg:
            say("  ATTENTION : %s ne suit plus son .ogg (ffmpeg introuvable)" % paths.web(mp3))
            return
        backup = os.path.join(self.backup_root, self.stamp, *os.path.relpath(mp3, paths.ASSETS).split(os.sep))
        os.makedirs(os.path.dirname(backup), exist_ok=True)
        shutil.copy2(mp3, backup)
        subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", ogg, "-codec:a", "libmp3lame", "-b:a", "192k", mp3],
                       check=False)
        self._count(group, "jumelles .mp3 refaites")

    def prune_backups(self, keep=5):
        if not os.path.isdir(self.backup_root):
            return
        runs = sorted(os.listdir(self.backup_root))
        for old in runs[:-keep]:
            shutil.rmtree(os.path.join(self.backup_root, old), ignore_errors=True)


def digest(path):
    import hashlib
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


_MOD_DIGESTS = None


def mod_digests():
    """L'empreinte de chaque texture et de chaque son du mod (calculee une fois)."""
    global _MOD_DIGESTS
    if _MOD_DIGESTS is None:
        _MOD_DIGESTS = set()
        for sub in ("textures", "sounds"):
            for folder, _dirs, files in os.walk(os.path.join(paths.MOD_ASSETS, sub)):
                for name in files:
                    _MOD_DIGESTS.add(digest(os.path.join(folder, name)))
    return _MOD_DIGESTS


def same(a, b):
    if os.path.getsize(a) != os.path.getsize(b):
        return False
    with open(a, "rb") as fa, open(b, "rb") as fb:
        while True:
            x, y = fa.read(1 << 20), fb.read(1 << 20)
            if x != y:
                return False
            if not x:
                return True


def pngs(folder):
    return sorted(f for f in os.listdir(folder) if f.lower().endswith(".png")) if os.path.isdir(folder) else []


def run_tool(name, argv=None):
    """Lance un outil du dossier tools/ dans ce meme processus."""
    saved = sys.argv
    sys.argv = [os.path.join(HERE, name)] + list(argv or [])
    try:
        runpy.run_path(os.path.join(HERE, name), run_name="__main__")
    except SystemExit as stop:
        if stop.code not in (None, 0):
            raise RuntimeError("%s s'est arrete (code %s)" % (name, stop.code))
    finally:
        sys.argv = saved
        os.chdir(paths.WIKI)


S = Sync()


# ---- 0. le dossier des assets ----------------------------------------------------------

README = """# Operation W.I.L.D — assets du wiki

Les images, sons et modeles du wiki (https://operation-wild-wiki.netlify.app).
Le site les demande a `assets/...` ; Netlify va les chercher ici, via GitHub Pages.

**Ce dossier est mis a jour par le mod** : dans IntelliJ, `Operation-W.I.L.D [runWikiDatas]`.
La tache regenere le JSON du wiki et recopie ici tout ce qui vient du mod (textures,
sons, musiques, modeles 3D) et du dossier `Operation W.I.L.D` du Bureau (wallpapers,
logo, theme principal), refait les vignettes, apercus et inventaire, puis publie
le tout sur GitHub.

A deposer a la main (rien ne les produit automatiquement) :
- `entities/`, `entities/solo/`, `heads/` : les rendus des betes ;
- `pages/<bete>/` : variantes (`<bete>_0.png`...), skins (`skin_0.png`...), GIF
  (`anim_0.gif`...), captures (`gallery_0.png`...), cartes d'attaque, selle ;
- `skins/` : rendus et modeles 3D (glTF) des cosmetiques ;
- `mcitems/`, `mcblocks/` : les textures de Minecraft, aux noms du jeu.

Ne jamais y mettre ce qui doit rester secret : ce depot est public, historique compris.
Pour que le site les trouve : depot **public**, et GitHub Pages active
(Settings > Pages > Deploy from a branch > main, dossier / (root)).
"""

GITIGNORE = "desktop.ini\nThumbs.db\n.DS_Store\n"


def prepare():
    title("Dossier des assets")
    os.makedirs(paths.ASSETS, exist_ok=True)
    say("dossier :", paths.ASSETS)
    marker = A(".nojekyll")
    legacy = os.path.join(paths.WIKI, "assets")
    if not os.path.exists(marker) and os.path.isdir(legacy):
        # Premier passage : on part de tout ce que le site avait deja (rendus,
        # GIF, skins, textures de Minecraft...), copie a l'identique.
        n = 0
        for folder, _dirs, files in os.walk(legacy):
            for name in files:
                if name.lower() in ("desktop.ini", "thumbs.db"):
                    continue
                src = os.path.join(folder, name)
                dst = A(os.path.relpath(src, legacy))
                if not os.path.exists(dst):
                    os.makedirs(os.path.dirname(dst), exist_ok=True)
                    shutil.copy2(src, dst)
                    n += 1
        say("premier passage : %d fichiers repris du dossier assets/ du wiki" % n)
    # GitHub Pages sert les fichiers tels quels (pas de Jekyll).
    for name, text in ((".nojekyll", ""), ("LISEZ-MOI.md", README), (".gitignore", GITIGNORE)):
        if not os.path.exists(A(name)):
            open(A(name), "w", encoding="utf-8", newline="\n").write(text)


# ---- 1. le JSON ------------------------------------------------------------------------

def publish_json():
    title("JSON du wiki")
    export = ARGS.export or os.path.join(paths.MOD, "src", "generated", "resources", "wiki_data.json")
    if os.path.isfile(export):
        say("export :", export)
        run_tool("publish-data.py", [export])
    else:
        say("pas d'export du mod (%s) : nettoyage de data/wiki_data.json sur place" % export)
        run_tool("publish-data.py")
    return json.load(open(os.path.join(paths.WIKI, "data", "wiki_data.json"), encoding="utf-8"))


# ---- 2. le mod -------------------------------------------------------------------------

def mod_textures(data, published):
    title("Textures du mod")
    for name in pngs(os.path.join(T, "item")):
        S.put(os.path.join(T, "item", name), "item/" + name, "objets")
    for name in pngs(os.path.join(T, "block")):
        S.put(os.path.join(T, "block", name), "block/" + name, "blocs")

    # Les textures des betes publiees, telles que le mod les range (variantes,
    # yeux, sang, selles, colliers, skins...) : de quoi montrer un jour chaque
    # variante en 3D sans rien recopier a la main.
    for slug in published:
        base = os.path.join(T, "entity", slug)
        for folder, _dirs, files in os.walk(base):
            for name in files:
                if name.lower().endswith(".png"):
                    src = os.path.join(folder, name)
                    S.put(src, "textures/entity/" + slug + "/" + os.path.relpath(src, base).replace(os.sep, "/"),
                          "textures des betes")
    # Les visages animes du skin Virus (et tout autre calque deja utilise par le
    # site dans skins/) suivent leur texture du mod.
    for folder, _dirs, files in os.walk(os.path.join(T, "entity")):
        if os.path.basename(folder) != "skins":
            continue
        for name in files:
            if os.path.exists(A("skins", name)):
                S.put(os.path.join(folder, name), "skins/" + name, "calques de skins")

    for name in pngs(os.path.join(T, "mob_effect")):
        S.put(os.path.join(T, "mob_effect", name), "textures/mob_effect/" + name, "icones d'effets")
    for name in pngs(os.path.join(T, "gui", "arena")):
        S.put(os.path.join(T, "gui", "arena", name), "arena/" + name, "arenes")
    for name in ("ow_teams_banners_styles.png", "ow_teams_sprites.png"):
        src = os.path.join(T, "gui", name)
        if os.path.exists(src):
            S.put(src, "tribes/" + name, "tribus")
    # Les pieces et les orbes, renumerotees comme le site les appelle.
    for src, dst in (("coin.png", "coin_0.png"), ("coin_2.png", "coin_1.png"),
                     ("coin_3.png", "coin_2.png"), ("coin_4.png", "coin_3.png")):
        if os.path.exists(os.path.join(T, "misc", src)):
            S.put(os.path.join(T, "misc", src), "ui/coins/" + dst, "pieces et XP")
    for name in pngs(os.path.join(T, "misc")):
        if name.startswith("exp"):
            S.put(os.path.join(T, "misc", name), "ui/exp/" + name, "pieces et XP")


def mod_sounds(data, published):
    title("Sons et musiques du mod")
    sj_path = os.path.join(paths.MOD_ASSETS, "sounds.json")
    sj = json.load(open(sj_path, encoding="utf-8")) if os.path.exists(sj_path) else {}

    def files_of(event):
        entry = sj.get(event)
        if not entry:
            return None, "absent de sounds.json"
        out = []
        for s in entry.get("sounds", []):
            name = s.get("name") if isinstance(s, dict) else s
            ns, _, rel = str(name).partition(":")
            if not rel:
                ns, rel = "minecraft", ns
            if ns != "ow":
                continue
            f = os.path.join(paths.MOD_ASSETS, "sounds", *rel.split("/")) + ".ogg"
            if os.path.exists(f):
                out.append(f)
        return (out[0], None) if out else (None, "fichier .ogg introuvable dans le mod")

    def is_music(event):
        return (sj.get(event) or {}).get("category") == "music"

    done = set()
    problems = []

    def place(event, rel_dir, group):
        f, why = files_of(event)
        if not f:
            problems.append("%s : %s" % (event, why))
            return
        S.put(f, "%s/%s.ogg" % (rel_dir, event), group)
        done.add(event)

    # Les sons de chaque bete, au nom que la table de sons de sa fiche demande
    # (le chemin de l'evenement : tiger_roar_virus, meme si le fichier du mod
    # s'appelle skin_virus/tiger_roar.ogg).
    for e in data.get("entities", []):
        slug = e.get("path")
        for s in e.get("sounds") or []:
            event = s.get("path")
            if event and event not in done:
                place(event, "music" if is_music(event) else "sounds/" + slug,
                      "musiques" if is_music(event) else "sons des betes")
    # Les sons du registre global qui portent le nom d'une bete (tiger3, tiger4...),
    # puis tous les autres : sons divers et musiques.
    slugs = sorted(published, key=len, reverse=True)
    for s in data.get("sounds") or []:
        event = s.get("path")
        if not event or event in done:
            continue
        owner = next((sl for sl in slugs if re.match(re.escape(sl) + r"(\d|_)", event)), None)
        if is_music(event):
            place(event, "music", "musiques")
        elif owner:
            place(event, "sounds/" + owner, "sons des betes")
        else:
            place(event, "sounds/misc", "autres sons")
    # Ce que sounds.json declare en plus (musiques de rituel, theme du menu...).
    for event in sj:
        if event in done or S.blocked(event):
            continue
        owner = next((sl for sl in slugs if re.match(re.escape(sl) + r"(\d|_)", event)), None)
        if is_music(event):
            place(event, "music", "musiques")
        elif owner:
            place(event, "sounds/" + owner, "sons des betes")
    for p in OrderedDict.fromkeys(problems):
        if not S.blocked(p):
            say("  son sans fichier :", p)


# ---- 3. le dossier du Bureau -----------------------------------------------------------

def studio(data, published, bosses):
    title("Dossier du Bureau (Operation W.I.L.D)")
    if not os.path.isdir(paths.STUDIO):
        say("introuvable :", paths.STUDIO)
        return
    walls = os.path.join(paths.STUDIO, "Officials Wallpapers")
    for name in pngs(walls):
        m = re.match(r"^\[OW\] (.+?) Wallpaper\.png$", name)
        if not m:
            continue  # « (old) », modele de copyright, teasers : pas des wallpapers de bete
        slug = m.group(1).strip().lower().replace(" ", "_")
        if slug in bosses:
            S.put(os.path.join(walls, name), "bosses/wallpapers/%s.png" % slug, "wallpapers")
        elif slug in published:
            S.put(os.path.join(walls, name), "wallpapers/%s.png" % slug, "wallpapers")
        else:
            S.hidden["wallpapers"] += 1
    for src, dst in (("[OW] Official Logo.png", "logo.png"), ("[OW] Main Title.png", "wordmark.png"),
                     (os.path.join("Musics", "Operation W.I.L.D - Main Theme.mp3"), "music/main-theme.mp3")):
        f = os.path.join(paths.STUDIO, src)
        if os.path.exists(f):
            S.put(f, dst, "logo, titre, theme")


def minecraft():
    """Les textures de Minecraft (le dossier du jeu, tel quel) : objets et blocs.
    Le site les montre la ou le mod cite un objet du jeu (recettes, regimes,
    coffres d'arene), les blocs dessines en cube (js/block-icons.js)."""
    title("Textures de Minecraft")
    base = paths.MINECRAFT
    if not os.path.isdir(base):
        say("  introuvable :", base)
        return
    for sub, dst, group in (("item", "mcitems", "Minecraft : objets"), ("block", "mcblocks", "Minecraft : blocs")):
        for name in pngs(os.path.join(base, sub)):
            S.put(os.path.join(base, sub, name), dst + "/" + name, group)


# ---- 4. ce qui se fabrique -------------------------------------------------------------

def generators(models_before):
    title("Modeles 3D")
    run_tool("build-models.py", [paths.MOD])
    title("Livre du manuel, icones de Mecaniques")
    run_tool("build-manual.py")
    run_tool("build-icons.py")
    title("Skins (nom, rarete, prix, deblocage, lus dans le code du mod)")
    run_tool("build-skins.py")
    title("Quetes quotidiennes (recompenses par palier, lues dans le code du mod)")
    run_tool("build-quests.py")
    title("Vignettes floues")
    run_tool("build-thumbs.py")
    title("Vignettes des rendus solo (1280 px, pour les cartes)")
    run_tool("build-vignettes.py")
    title("Apercus de partage")
    run_tool("build-share.py")

    models_after = read(os.path.join(paths.WIKI, "data", "models.json"))
    missing = [s for s in json.loads(models_after or "{}") if s not in ("orca", "boa")
               and not os.path.exists(A("cameos", s + ".png"))]
    if ARGS.no_cameos:
        return
    if ARGS.cameos or models_after != models_before or missing:
        title("Passants du pied de page")
        cameos()


def read(path):
    try:
        return open(path, "rb").read()
    except OSError:
        return None


def cameos():
    node = shutil.which("node")
    if not node or not os.path.exists("C:/Program Files/Google/Chrome/Application/chrome.exe"):
        say("  passe : il faut Node.js et Google Chrome")
        return
    import importlib
    serve = importlib.import_module("serve")
    server, port = serve.start(0)
    try:
        env = dict(os.environ, OW_ASSETS_DIR=paths.ASSETS)
        out = subprocess.run([node, os.path.join(HERE, "build-cameos.mjs"), "http://127.0.0.1:%d/" % port],
                             cwd=paths.WIKI, env=env, capture_output=True, text=True, timeout=300)
        for line in (out.stdout + out.stderr).strip().splitlines():
            say(" ", line)
        if out.returncode:
            say("  ATTENTION : les passants n'ont pas pu etre refaits (code %d)" % out.returncode)
    except subprocess.TimeoutExpired:
        say("  ATTENTION : les passants ont pris trop de temps, ignores")
    finally:
        server.shutdown()


# ---- 5. la publication sur GitHub ----------------------------------------------------------

def publish_assets():
    """Commit + push du dossier des assets, s'il est un depot Git relie a GitHub."""
    title("Publication sur GitHub")
    if ARGS.no_push:
        say("  passe (--no-push)")
        return
    git = shutil.which("git")
    if not git or not os.path.isdir(A(".git")):
        say("  passe : le dossier des assets n'est pas un depot Git relie a GitHub")
        return

    # Le depot est public : une derniere passe sur chaque nom de fichier. Un seul
    # nom secret, et rien ne part.
    leaks = []
    for folder, dirs, files in os.walk(paths.ASSETS):
        dirs[:] = [d for d in dirs if d != ".git"]
        for name in files:
            rel = os.path.relpath(os.path.join(folder, name), paths.ASSETS).replace(os.sep, "/")
            if S.blocked(rel):
                leaks.append(rel)
    if leaks:
        say("  ATTENTION, rien n'est publie : ces fichiers portent un nom secret (tools/hidden.json) :")
        for rel in leaks:
            say("    -", rel)
        say("  Les retirer du dossier des assets, puis relancer la tache.")
        return

    def g(*args):
        return subprocess.run([git, "-C", paths.ASSETS] + list(args), capture_output=True,
                              text=True, encoding="utf-8", errors="replace")

    g("add", "-A")
    changed = [line for line in g("status", "--porcelain").stdout.splitlines() if line.strip()]
    if changed:
        counts = Counter(line[:2].strip() or "?" for line in changed)
        summary = ", ".join("%d %s" % (n, {"A": "ajoutes", "M": "modifies", "D": "supprimes", "R": "renommes"}.get(k, k))
                            for k, n in counts.items())
        msg = "Mise a jour des assets (runWikiDatas, %s)\n\n%s" % (
            datetime.datetime.now().strftime("%d/%m/%Y %H:%M"), summary)
        res = g("commit", "-q", "-m", msg)
        if res.returncode:
            say("  ATTENTION : le commit a echoue :", (res.stderr or res.stdout).strip())
            return
        say("  commit :", summary)
    else:
        say("  aucun fichier change depuis la derniere publication")

    ahead = g("rev-list", "--count", "@{u}..HEAD")
    if not changed and ahead.returncode == 0 and ahead.stdout.strip() == "0":
        return
    push = g("push", "-q", "origin", "HEAD:main")
    if push.returncode and ("fetch first" in push.stderr or "non-fast-forward" in push.stderr):
        # Quelqu'un (ou le site de GitHub) a modifie le depot entre-temps : on se remet
        # a jour par-dessus, puis on renvoie.
        g("pull", "-q", "--rebase", "origin", "main")
        push = g("push", "-q", "origin", "HEAD:main")
    if push.returncode:
        say("  ATTENTION : l'envoi sur GitHub a echoue. Le site garde les anciens assets.")
        for line in (push.stderr or push.stdout).strip().splitlines()[-6:]:
            say("   ", line)
        return
    g("branch", "-q", "--set-upstream-to=origin/main")
    say("  publie sur GitHub : le site le voit d'ici une a deux minutes (%s)" % paths.PAGES_URL)


# ---- le compte rendu --------------------------------------------------------------------

def orphans():
    """Les textures d'objets et de blocs que le mod n'a plus (renommees, retirees)."""
    out = []
    for sub in ("item", "block"):
        mod_names = set(pngs(os.path.join(T, sub)))
        for name in pngs(A(sub)):
            if name not in mod_names:
                out.append(sub + "/" + name)
    return out


def report(started):
    title("Compte rendu")
    for group, c in S.stats.items():
        parts = ["%d %s" % (n, k) for k, n in c.items() if n]
        say("  %-22s %s" % (group, ", ".join(parts)))
    if sum(S.hidden.values()):
        say("  ecartes (secrets, especes non publiees) :",
            ", ".join("%d %s" % (n, g) for g, n in S.hidden.items()))
    if S.kept:
        say("")
        say("  Gardes parce que PLUS RECENTS dans le dossier des assets que dans le mod :")
        for rel in S.kept:
            say("    -", rel)
    left = orphans()
    if left:
        say("")
        say("  Plus dans le mod (gardes, a supprimer a la main si c'est voulu) :")
        for rel in left:
            say("    -", rel)
    say("")
    say("Mise a jour terminee en %.0f s. Dossier des assets : %s" % (time.time() - started, paths.ASSETS))


def main():
    started = time.time()
    os.chdir(paths.WIKI)
    prepare()
    data = publish_json()
    entities = data.get("entities", [])
    published = [e["path"] for e in entities if e.get("path")]
    bosses = {e["path"] for e in entities if (e.get("classification") or {}).get("boss")}
    # Les especes que le mod dessine mais que l'export ne publie pas (a venir,
    # secretes) : rien de ce qui porte leur nom n'entre dans le dossier public.
    # (Les dossiers de projectiles et de vehicules ne sont pas des especes.)
    entity_dir = os.path.join(T, "entity")
    known = {e.get("path") for e in entities}
    not_species = {"seabug", "seabug_shard", "primitive_spear", "slingshot_projectile", "tranquilizer_arrow",
                   "tranquilizer_wooden_stinger", "venomous_arrow", "wooden_stinger"}
    S.unpublished = [d.lower() for d in (os.listdir(entity_dir) if os.path.isdir(entity_dir) else [])
                     if os.path.isdir(os.path.join(entity_dir, d)) and d not in known
                     and d not in not_species and re.fullmatch(r"[a-z_]+", d)]
    models_before = read(os.path.join(paths.WIKI, "data", "models.json"))

    mod_textures(data, published)
    mod_sounds(data, published)
    studio(data, set(published) - bosses, bosses)
    minecraft()
    generators(models_before)

    title("Inventaire des fichiers")
    run_tool("list-assets.py")
    S.prune_backups()
    report(started)
    # Ce qui manque encore, bete par bete, par rapport au tigre (tools/bilan.py).
    import bilan
    bilan.run(say)
    publish_assets()
    os.makedirs(os.path.join(paths.TOOLS, "private"), exist_ok=True)
    open(os.path.join(paths.TOOLS, "private", "last-sync.txt"), "w", encoding="utf-8").write("\n".join(LOG) + "\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:  # noqa: BLE001
        say("")
        say("ECHEC :", err)
        import traceback
        traceback.print_exc()
        sys.exit(1)
