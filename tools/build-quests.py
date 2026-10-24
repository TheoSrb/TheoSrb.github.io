"""Les recompenses des quetes quotidiennes, lues dans le code du mod.

La recompense d'une quete ne depend que de son palier (I, II, III) et elle est
tiree au hasard quand la quete est donnee : SOIT des orbes d'XP, SOIT des
pieces sauvages, jamais les deux. Le mod la decrit a deux endroits :
  - entity/quests/daily_quests/DailyQuestTier.java : pour chaque palier,
    orbes min et max, chance d'avoir des pieces a la place, pieces min et max ;
  - entity/OWEntity.java : ce que vaut un orbe (ORB_XP_VALUE, en XP de la
    creature) et, passe un niveau (getLevel() >= N), la conversion des orbes
    en experience d'apprivoisement (Math.round(orbes / D)).

(Le champ « reward » de l'export, difficulte x 4, n'est lu nulle part par le
mod : le site ne s'en sert plus.)

Ecrit js/quest-data.js : OW.QUEST_REWARDS, lu par l'onglet Quetes de
Mecaniques (js/simulator.js).

Usage : python tools/build-quests.py   (tools/sync-wiki.py le lance aussi)
"""

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths  # noqa: E402

TIER_JAVA = os.path.join(paths.MOD_JAVA, "entity", "quests", "daily_quests", "DailyQuestTier.java")
ENTITY_JAVA = os.path.join(paths.MOD_JAVA, "entity", "OWEntity.java")
OUT = os.path.join(paths.WIKI, "js", "quest-data.js")


def read(path):
    try:
        return open(path, encoding="utf-8").read()
    except OSError:
        return ""


def number(text):
    """« 1.0f / 3.0f », « 0.5f », « 0.0f » -> nombre."""
    t = re.sub(r"(\d)[fFdD]\b", r"\1", text.replace(" ", ""))
    if not re.fullmatch(r"[\d.+\-*/()]+", t):
        raise ValueError("nombre illisible : " + text)
    return float(eval(t))  # expression arithmetique pure, verifiee ci-dessus


def method_body(src, name):
    m = re.search(r"\b" + name + r"\s*\([^)]*\)\s*\{", src)
    if not m:
        return ""
    depth, i = 1, m.end()
    while i < len(src) and depth:
        depth += {"{": 1, "}": -1}.get(src[i], 0)
        i += 1
    return src[m.end():i - 1]


def build():
    src = re.sub(r"//[^\n]*|/\*.*?\*/", "", read(TIER_JAVA), flags=re.S)
    tiers = {}
    # I(5, 10, 0.0f, 0, 0),  -> orbes min, max, chance de pieces, pieces min, max
    for m in re.finditer(r"\b([IVX]+)\s*\(\s*([^()]*(?:\([^()]*\)[^()]*)*)\)\s*[,;]", src):
        args = [a.strip() for a in m.group(2).split(",")]
        if len(args) != 5:
            continue
        tiers[m.group(1)] = {
            "xpMin": int(number(args[0])), "xpMax": int(number(args[1])),
            "coinChance": round(number(args[2]), 4),
            "coinMin": int(number(args[3])), "coinMax": int(number(args[4])),
        }
    entity = read(ENTITY_JAVA)
    orb = re.search(r"ORB_XP_VALUE\s*=\s*([\d.]+)", entity)
    grant = method_body(entity, "grantQuestReward")
    cap = re.search(r"getLevel\(\)\s*>=\s*(\d+)", grant)
    div = re.search(r"Math\.round\(\s*code\s*/\s*([\d.]+)", grant)
    out = {
        "tiers": tiers,
        "orbXp": number(orb.group(1)) if orb else None,
        "tamingFromLevel": int(cap.group(1)) if cap else None,
        "tamingDivisor": number(div.group(1)) if div else None,
    }
    if not tiers:
        print("ATTENTION : aucun palier lu dans", TIER_JAVA)
    js = ("/* Genere par tools/build-quests.py : ne pas modifier a la main.\n"
          "   Les recompenses des quetes quotidiennes, telles que le mod les tire\n"
          "   (DailyQuestTier.java, OWEntity.java). js/simulator.js s'en sert. */\n"
          "window.OW = window.OW || {};\n"
          "window.OW.QUEST_REWARDS = " + json.dumps(out, ensure_ascii=False, indent=2) + ";\n")
    paths.write_bytes(OUT, js.encode("utf-8"))
    print("quetes : paliers", ", ".join("%s %d-%d orbes%s" % (k, v["xpMin"], v["xpMax"],
          (" ou %d-%d piece(s) (%d %%)" % (v["coinMin"], v["coinMax"], round(v["coinChance"] * 100))) if v["coinChance"] else "")
          for k, v in tiers.items()), "· 1 orbe =", out["orbXp"], "XP")


if __name__ == "__main__":
    build()
