"""Les modeles 3D et les animations des creatures, lus dans le code du mod.

Le mod decrit chaque creature en Java : ses parties (cubes, pivots, decalages
de texture) dans <Nom>Model.java, ses animations (repos, marche, attaque...)
en keyframes vanilla dans <Nom>Animations.java. Ce script les lit tels quels
et ecrit :
  - data/models.json            parties, cubes et animations de chaque creature ;
  - assets/models/<slug>.png    la texture par defaut (copiee telle quelle).

Le wiki les assemble et les anime en 3D (js/creature-3d.js).

Les creatures traitees sont celles de data/wiki_data.json (hors boss) : une
bete ajoutee au mod a son modele des qu'elle est dans l'export, sans rien
ecrire ici. Le nom des fichiers Java vient de sa classe (TigerEntity -> Tiger).

Usage : python tools/build-models.py [chemin du projet du mod]
A relancer apres chaque modification des modeles ou des animations du mod
(tools/sync-wiki.py le lance aussi).
"""

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths  # noqa: E402

MOD = sys.argv[1] if len(sys.argv) > 1 and os.path.isdir(sys.argv[1]) else paths.MOD
JAVA = os.path.join(MOD, r"src\main\java\net\tiew\operationWild\entity\client")
TEX = os.path.join(MOD, r"src\main\resources\assets\ow\textures\entity")
WIKI = paths.WIKI


def creatures():
    """slug -> nom de classe sans « Entity », pour chaque bete publiee (hors boss)."""
    data = json.load(open(os.path.join(WIKI, "data", "wiki_data.json"), encoding="utf-8"))
    out = {}
    for e in data.get("entities", []):
        if (e.get("classification") or {}).get("boss"):
            continue
        slug = e.get("path")
        cls = re.sub(r"Entity$", "", e.get("simple_class") or "")
        if slug and cls:
            out[slug] = cls
    return dict(sorted(out.items()))

CONST = {}  # les constantes « static final float X = ... » du fichier lu

NUM = r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?[fFdD]?"


def num(text):
    """Un nombre Java : 1.5F, -0.2618F, (float) Math.PI / 2, -Math.PI..."""
    t = text.strip().replace("(float)", "").replace("(double)", "").replace(" ", "")
    t = re.sub(r"(\d)[fFdD]\b", r"\1", t)
    t = t.replace("Mth.PI", "3.141592653589793").replace("Math.PI", "3.141592653589793")
    for name in sorted(CONST, key=len, reverse=True):
        t = re.sub(r"\b" + name + r"\b", repr(CONST[name]), t)
    if not re.fullmatch(r"[-+*/().\deE]+", t):
        raise ValueError("nombre illisible : " + text)
    return float(eval(t))  # expression arithmetique pure, verifiee ci-dessus


def split_args(s):
    """Decoupe une liste d'arguments au premier niveau de parentheses."""
    out, depth, cur = [], 0, ""
    for ch in s:
        if ch == "," and depth == 0:
            out.append(cur)
            cur = ""
            continue
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        cur += ch
    if cur.strip():
        out.append(cur)
    return [a.strip() for a in out]


def body_of(src, signature):
    i = src.find(signature)
    if i < 0:
        return None
    i = src.index("{", i)
    depth, j = 0, i
    while True:
        if src[j] == "{":
            depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                return src[i + 1:j]
        j += 1


def strip_comments(s):
    s = re.sub(r"/\*.*?\*/", "", s, flags=re.S)
    return re.sub(r"//[^\n]*", "", s)


def call_args(s, start):
    """Les arguments de l'appel dont la parenthese ouvrante est en s[start]."""
    depth, j = 0, start
    while True:
        if s[j] == "(":
            depth += 1
        elif s[j] == ")":
            depth -= 1
            if depth == 0:
                return s[start + 1:j], j + 1
        j += 1


def parse_cubes(chain):
    cubes, u, v, mirror = [], 0, 0, False
    pos = 0
    for m in re.finditer(r"\.(texOffs|mirror|addBox)\s*\(", chain):
        if m.start() < pos:
            continue
        args, pos = call_args(chain, m.end() - 1)
        name = m.group(1)
        a = split_args(args)
        if name == "texOffs":
            u, v = num(a[0]), num(a[1])
        elif name == "mirror":
            mirror = (not a) or a[0] == "true"
        else:
            if a and a[0].startswith('"'):
                a = a[1:]
            x, y, z, w, h, d = (num(t) for t in a[:6])
            inflate = 0.0
            if len(a) > 6:
                dm = re.search(r"CubeDeformation\((" + NUM + ")", a[6])
                if dm:
                    inflate = num(dm.group(1))
                elif a[6] in ("true", "false"):
                    mirror = a[6] == "true"
            cubes.append([u, v, x, y, z, w, h, d, inflate, 1 if mirror else 0])
    return cubes


def parse_pose(pose):
    pose = pose.strip()
    if pose.startswith("PartPose.ZERO"):
        return [0, 0, 0, 0, 0, 0]
    m = re.match(r"PartPose\.(offset|offsetAndRotation|rotation)\s*\(", pose)
    args, _ = call_args(pose, m.end() - 1)
    a = [num(t) for t in split_args(args)]
    if m.group(1) == "offset":
        return a + [0, 0, 0]
    if m.group(1) == "rotation":
        return [0, 0, 0] + a
    return a


def helper_part(src, name):
    """Une petite methode d'aide qui cree une partie (ex. all(mesh) -> "ALL")."""
    body = body_of(src, "PartDefinition " + name + "(")
    m = re.search(r"addOrReplaceChild\s*\(", body)
    args, _ = call_args(body, m.end() - 1)
    a = split_args(args)
    return {"name": a[0].strip('"'), "parent": None, "pose": [round(x, 5) for x in parse_pose(a[2])], "cubes": parse_cubes(a[1])}


def parse_model(path, method="createBodyLayer"):
    src = strip_comments(open(path, encoding="utf-8").read())
    CONST.clear()
    for c in re.finditer(r"static\s+final\s+(?:float|double|int)\s+(\w+)\s*=\s*([^;]+);", src):
        try:
            CONST[c.group(1)] = num(c.group(2))
        except (ValueError, SyntaxError, NameError):
            pass
    body = body_of(src, "LayerDefinition " + method + "(")
    tex = re.search(r"LayerDefinition\.create\(\s*\w+\s*,\s*(\d+)\s*,\s*(\d+)\s*\)", body)
    parts = []
    names = {"partdefinition": None}
    root_vars = re.findall(r"PartDefinition\s+(\w+)\s*=\s*\w+\.getRoot\(\)", body)
    for r in root_vars:
        names[r] = None
    for stmt in body.split(";"):
        m = re.search(r"(?:PartDefinition\s+(\w+)\s*=\s*)?(\w+\.getRoot\(\)|\w+\([^()]*\)|\w+)\.addOrReplaceChild\s*\(", stmt)
        if not m:
            continue
        args, _ = call_args(stmt, m.end() - 1)
        a = split_args(args)
        pname = a[0].strip('"')
        target = m.group(2)
        if target.endswith("getRoot()"):
            parent = None
        elif "(" in target:
            helper = helper_part(src, target.split("(")[0])
            if not any(p["name"] == helper["name"] for p in parts):
                parts.append(helper)
            parent = helper["name"]
        else:
            parent = names.get(target, target)
        cubes = parse_cubes(a[1])
        pose = parse_pose(a[2])
        parts.append({"name": pname, "parent": parent, "pose": [round(x, 5) for x in pose], "cubes": cubes})
        if m.group(1):
            names[m.group(1)] = pname
    return {"texW": int(tex.group(1)), "texH": int(tex.group(2)), "parts": parts}


def parse_animations(path):
    src = strip_comments(open(path, encoding="utf-8").read())
    anims, order = {}, {}
    # Les longues animations vivent dans une petite classe interne (limite de 64 Ko
    # par methode Java) : « SEDATED_FALL = SedatedFall.DEFINITION », la vraie
    # definition s'appelant DEFINITION dans SedatedFall. On les range sous le nom
    # de leur classe, puis on les renomme d'apres le champ public qui y renvoie.
    holders = [(c.start(), c.group(1)) for c in re.finditer(r"\bclass\s+(\w+)\s*\{", src)]
    for m in re.finditer(r"AnimationDefinition\s+(\w+)\s*=\s*AnimationDefinition\.Builder\.withLength\((" + NUM + r")\)", src):
        name, length = m.group(1), num(m.group(2))
        if name == "DEFINITION":
            name = "class:" + [h for start, h in holders if start < m.start()][-1]
        order[name] = m.start()
        end = src.index(".build()", m.end())
        block = src[m.end():end]
        loop = block.lstrip().startswith(".looping()")
        channels = []
        pos = 0
        for c in re.finditer(r"\.addAnimation\s*\(", block):
            if c.start() < pos:
                continue
            args, pos = call_args(block, c.end() - 1)
            a = split_args(args)
            bone = a[0].strip('"')
            ch = re.search(r"Targets\.(ROTATION|POSITION|SCALE)", a[1]).group(1)
            keys = []
            for k in re.finditer(r"new Keyframe\(\s*(" + NUM + r")\s*,\s*KeyframeAnimations\.(\w+)\(([^)]*)\)\s*,\s*AnimationChannel\.Interpolations\.(\w+)", a[1]):
                x, y, z = (num(t) for t in split_args(k.group(3)))
                keys.append([round(num(k.group(1)), 4), round(x, 4), round(y, 4), round(z, 4), 1 if k.group(4) == "CATMULLROM" else 0])
            channels.append([bone, {"ROTATION": "r", "POSITION": "p", "SCALE": "s"}[ch], keys])
        anims[name] = {"len": round(length, 4), "loop": loop, "ch": channels}
    # Les renvois : « X = Classe.DEFINITION » ou « X = AUTRE_ANIM », a leur place dans le fichier.
    for m in re.finditer(r"AnimationDefinition\s+(\w+)\s*=\s*(?:(\w+)\.DEFINITION|(\w+))\s*;", src):
        ref = "class:" + m.group(2) if m.group(2) else m.group(3)
        if ref in anims:
            anims[m.group(1)] = anims[ref]
            order[m.group(1)] = m.start()
    named = sorted((n for n in anims if not n.startswith("class:")), key=lambda n: order[n])
    return {n: anims[n] for n in named}


def main():
    out = {}
    os.makedirs(paths.asset("models"), exist_ok=True)
    for slug, cls in creatures().items():
        model_path = os.path.join(JAVA, "model", cls + "Model.java")
        tex_src = os.path.join(TEX, slug, slug + "_default.png")
        if not os.path.exists(tex_src):
            tex_src = os.path.join(TEX, slug, slug + ".png")
        if not os.path.exists(model_path) or not os.path.exists(tex_src):
            print(slug, ": pas de modele 3D (", cls + "Model.java ou sa texture introuvable )")
            continue
        try:
            model = parse_model(model_path)
            anim_path = os.path.join(JAVA, "animation", cls + "Animations.java")
            model["anims"] = parse_animations(anim_path) if os.path.exists(anim_path) else {}
        except Exception as err:  # noqa: BLE001
            # Un modele que le lecteur ne comprend pas ne bloque pas les autres.
            print(slug, ": modele illisible, ignore (", err, ")")
            continue
        paths.write_bytes(paths.asset("models", slug + ".png"), open(tex_src, "rb").read())
        model["tex"] = "assets/models/" + slug + ".png"
        out[slug] = model
        print(slug, len(model["parts"]), "parties,", sum(len(p["cubes"]) for p in model["parts"]), "cubes,",
              len(model["anims"]), "animations :", ", ".join(list(model["anims"])[:8]))
    target = os.path.join(WIKI, "data", "models.json")
    paths.write_bytes(target, json.dumps(out, separators=(",", ":")).encode("utf-8"))
    print("data/models.json :", os.path.getsize(target) // 1024, "Ko")


if __name__ == "__main__":
    main()
