# Carte du site, des données et des outils

Lire la partie utile, pas tout. Les noms de fichiers peuvent avoir bougé depuis : vérifier
par `grep` avant de citer une ligne.

## Sommaire
1. Les pages
2. Le chemin d'une donnée (mod → site)
3. Les tables de libellés écrites à la main (là où naît le texte brut)
4. Les fichiers générés (ne jamais les retoucher à la main)
5. Les réglages du propriétaire
6. Pièges connus

## 1. Les pages

Site statique, sans framework. Chaque page charge `js/wiki-data.js` (lit et normalise
`data/wiki_data.json` → objet `data`), `js/site.js` (outils partagés `OW.*`), puis son script.

| Page | Script principal | Contenu |
|---|---|---|
| index.html | home.js, news.js, roadmap.js | accueil, nouveautés (carrousel), feuille de route, diorama 3D |
| creatures.html | creatures.js, creature-card.js | bestiaire, comparateur « À l'échelle » |
| animal.html?e=<slug> | animal.js (+ creature-stage.js, creature-3d.js, soundboard.js, taming-guides.js, skins.js) | fiche d'une bête : identité, stats, capacités, apprivoisement, apparition, butin, variantes, skins, sons, animations |
| bosses.html | bosses.js | boss (classification.boss), règles de combat dans `NOTES` |
| biomes.html / biome.html?b=<id> | biomes.js, biome.js, biome-map.js, spawn-map.js | biomes et qui y vit |
| items.html | items.js | objets, blocs, recettes |
| cosmetics.html | cosmetics.js, skins.js, skin-data.js | skins, selles |
| simulator.html (« Mécaniques ») | simulator.js, combat-data.js, lab-*.js, tribes.js, quest-data.js | archétypes, simulateur, tribus, quêtes, formules |
| guide.html | guide.js | guide du débutant |
| music.html | music.js (`ALBUMS`) | musiques, `?boss=<slug>` |
| community.html | community.js, contact.js | avis (`data/community.json`), contact |
| download.html | download.js | versions (`data/releases.json`) |
| 404.html, lab.html | | page perdue, labo |

`partage/<slug>.html` sont des pages d'aperçu générées (build-share.py), `/tools/*` est
bloqué en ligne par `_redirects`.

## 2. Le chemin d'une donnée

```
Java du mod ──(datagen, runData)──▶ src/generated/resources/wiki_data.json   (export brut, secrets compris)
                                     │
            tools/publish-data.py ◀──┘  retire les secrets (tools/hidden.json), dates de sortie (tools/sorties.json)
                     │
                     ▼
            data/wiki_data.json ──▶ js/wiki-data.js (normalise, aplatit les sachets de langue, VANILLA_NAMES…)
                                         │
                                         ▼
                                  pages (animal.js, items.js…)
```

- **`runWikiDatas`** (tâche Gradle du mod, lancée par le propriétaire dans IntelliJ) = runData
  puis `python tools/sync-wiki.py` : JSON via publish-data, textures, sons, musiques,
  wallpapers, puis tous les `build-*.py`, puis push des assets sur GitHub. ~20 s.
- À la main : `python tools/publish-data.py "<export>"` (avec le chemin de l'export : sans
  argument il repart du JSON du site, et une bête révélée ne revient pas).
- L'export ne contient pas tout. Exemples connus : rythme des combos (`createCombo()` →
  recopié dans combat-data.js), repas d'apprivoisement (`MEAL` de animal.js, d'après
  OWAggressiveTaming), règles de boss (`NOTES` de bosses.js). Ces recopies **vieillissent** :
  les comparer au Java à chaque coup de balai.
- `wild_behaviors` = la liste des fichiers du dossier `entity/goals/<espèce>/`
  (OWWikiSources.wildBehaviors) : y compris les classes utilitaires (ElephantGoals,
  ElephantWaterRun), et rien pour une bête dont les goals sont ailleurs (lion, gorille,
  hippopotame déclarent les leurs dans `<Bête>Entity.java`).
- Données 3D : `tools/build-models.py` lit `<Nom>Model.java` et `<Nom>Animations.java`
  (y compris les animations rangées dans une classe interne `X.DEFINITION`) →
  `data/models.json`.

## 3. Les tables de libellés écrites à la main

C'est ici que naît le texte brut : quand une clé manque, chaque page a un **repli
automatique** qui découpe le code (souvent en anglais). Corriger = ajouter la clé, ou
améliorer le repli.

| Table | Fichier | Couvre | Repli quand la clé manque |
|---|---|---|---|
| `BEHAVIOUR_LABEL` | js/animal.js | goals sauvages (nom de classe → phrase) | retire `Goal`, le préfixe d'espèce, découpe la casse : « Follow Herd » |
| `ANIM_LABEL`, `ANIM_STATE` | js/animal.js | animations (3D, GIF) | « Sedated fall », transitions « Repos → Assis » si les deux états sont connus |
| `GROUPS` | js/creature-stage.js | familles de boutons du modèle 3D | « Capacités & comportements » |
| `FAMILY_LABEL`, `DIET_LABEL`, `TEMPERAMENT_LABEL` | animal.js, creature-card.js, lab-hero.js, home.js | classification | valeur brute |
| `ROLE_LABEL`, `KEY_LABEL` | animal.js, lab.js | cartes d'attaque | valeur brute |
| `VANILLA_NAMES` | js/wiki-data.js | objets Minecraft (noms officiels du fr_fr.json du jeu) | id découpé, en anglais |
| `CONSTANT_FR` | js/wiki-data.js | constantes d'attaque affichées sous les cartes | nom de constante en minuscules, en anglais |
| `VARIANT_FR` | js/wiki-data.js | variantes de couleur | nom découpé en minuscules |
| `MATERIAL_LABEL`, `SLOT_LABEL` | js/wiki-data.js | matières de selle | valeur brute |
| `BIOME_NAMES` | js/site.js (+ home.js) | biomes | id découpé |
| `ARCHETYPE_LABEL`, `ARCHETYPE_COLOR` | js/site.js | archétypes (couleurs = codes § du mod) | — |
| `RECIPE_TYPE_LABEL` | js/items.js | types de recette | valeur brute |
| `CLASS_LABEL` | js/biome.js | classes de biome | valeur brute |
| `THEME_LABEL`, `NOTES` | js/bosses.js | boss | — |
| `NAME_WORD` | js/skins.js | noms de skins | découpé |
| `PROFILES`, `CONSTANT_PREFIX` | js/attack-profiles.js | regroupement des constantes par carte (d'après OWAttacksInformation.java) | constante orpheline |
| `comboTicks` | js/combat-data.js | rythme des combos | — |
| `GLOSSARY` | js/i18n.js | termes courts que l'API traduit mal | — |

Ajouter une valeur ? Toujours chercher d'abord si la table existe déjà ailleurs (DIET_LABEL
est dupliqué dans 3 fichiers) : la corriger partout, ou mieux, la partager via `OW.*`.

## 4. Les fichiers générés

Ne jamais les éditer : corriger leur générateur, puis le relancer.

| Fichier | Générateur |
|---|---|
| data/wiki_data.json, js/upcoming.js, assets/mystery/* | tools/publish-data.py |
| data/models.json, assets/models/* | tools/build-models.py |
| js/skin-data.js | tools/build-skins.py |
| js/quest-data.js | tools/build-quests.py |
| js/asset-list.js | tools/list-assets.py |
| js/cameos.js, assets/cameos/* | tools/build-cameos.mjs (+ build-cameos.html) |
| css/theme-light.css, section 3 (biomes de jour) | tools/build-light-biomes.py |
| partage/*.html, assets/og/* | tools/build-share.py |
| assets/thumbs/* | tools/build-thumbs.py |
| icônes de Mécaniques, curseurs, manuel | build-icons.py, build-cursors.py, build-manual.py |

`tools/bilan.py` fait le bilan des assets manquants, bête par bête, comparé au tigre.

## 5. Les réglages du propriétaire

- `js/site-config.js` : `hiddenAnimations`, `tamingDifficulty`, `news`, `sleepFood`, lecteur…
- `js/assets-config.js` : titres des musiques, noms des sons et des GIF.
- `js/hero-config.js`, `js/biome-config.js` (`animalWithoutSpawn`, `spawnToBiome`).
- `js/taming-guides.js` : le texte du guide d'apprivoisement (même texte pour toutes les
  bêtes, à sa demande).
- `data/roadmap.json`, `data/community.json`, `data/releases.json`.
- `tools/hidden.json` : secrets (privé, jamais servi).

Ce qui est écrit là est **voulu**. Un coup de balai peut signaler une incohérence (une
bête de `tamingDifficulty` qui n'existe plus), pas réécrire ses choix.

## 6. Pièges connus

- `$('[data-biome]')` attrape aussi le décor de fond : cibler `.ident-biome[data-biome]`.
- Une animation CSS qui part de `opacity: 0` reste figée dans un onglet caché : le contenu
  semble absent alors qu'il est dans le DOM. Mesurer au DOM.
- `css/ux.css` coupe les transitions sur `[data-reveal].is-scroll`.
- Sélecteurs du thème clair : la spécificité de `:is()` = celle de son argument le plus
  fort ; les habillages « coffre » sont ciblés par id de section (#stats, #taming…).
- En local, python http.server laisse le navigateur garder le HTML : `?fresh=N`.
- Les 404 sur `pages/<bête>/gallery_N.png`, `anim_N.gif`, `skin_N.png` sont des **sondes**
  voulues (un fichier déposé doit s'afficher tout seul) : pas un bug.
- `traits.rideable` est vrai pour tout dans l'export : le site utilise
  `run_speed_multiplier > 0`.
- `theoretical_scale` n'est pas une échelle de rendu (recul de caméra monté).
- `OW.num` rend « 4,3 » ; les intervalles s'écrivent « 24 à 36 » et partent entiers à l'API
  de traduction.
