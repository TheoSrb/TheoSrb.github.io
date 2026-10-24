# Écrire du français interprété (goals, animations, constantes…)

Le propriétaire ne veut pas une traduction mot à mot d'un nom de classe. « Follow Herd »
traduit en « Suivre troupeau » reste illisible. Il veut qu'un joueur qui n'a jamais ouvert
le code **comprenne ce que fait la bête, quand, et ce que ça change pour lui**.

## La méthode

1. **Lire le Java**, pas le nom. Pour un goal : `canUse()` (quand ça se déclenche),
   `start()` / `tick()` (ce qui se passe), `stop()` / cooldown (combien de temps, à quelle
   fréquence), les constantes en tête de classe (distances, durées). Pour une animation :
   où le modèle la joue (`<Bête>Model.java`) et dans quelle situation.
2. **Traduire en situation de jeu** : ce que le joueur voit ou subit. Une distance de
   6.0 devient « à moins de 6 blocs » ; 240 ticks deviennent « toutes les 12 s environ »
   (20 ticks = 1 s). Ne garder un chiffre que s'il aide le joueur.
3. **Écrire une phrase** :
   - au présent, sujet implicite (la bête) : « Fonce sur… », « Veille… » ;
   - impersonnelle : jamais « vous », jamais d'impératif ;
   - courte : 5 à 16 mots en général, une seule idée ;
   - concrète : un geste, un déclencheur, une conséquence ; pas de jargon (« cible »,
     « aggro », « goal », « tick », « trigger » restent dans le code) ;
   - vraie : chaque élément de la phrase doit se retrouver dans le code. En cas de doute,
     dire moins plutôt qu'inventer.
4. **Vérifier le rendu** dans la page (longueur, retour à la ligne, cohérence avec les
   phrases voisines déjà écrites pour les autres bêtes).

## Exemples

Les phrases déjà validées dans `BEHAVIOUR_LABEL` donnent le ton :

| Code | Phrase validée |
|---|---|
| TigerSmellBloodGoal | Flaire le sang et remonte la piste des blessés |
| KodiakSearchInsideChestGoal | Fouille les coffres laissés ouverts |
| CrocodileGoToWaterWithFoodGoal | Emporte sa proie dans l'eau |
| OWOrcaBeachingGoal | S'échoue volontairement pour attraper une proie à terre |

Un cas travaillé, `ElephantMockChargeGoal` :

- Ce que dit le code : se déclenche si l'éléphant est calme, au sol, pas en musth, et qu'un
  joueur qui le menace est en vue à moins de 6 blocs. Phases : il se tourne et barrit
  (DISPLAY), fonce (RUSH), s'arrête net à ~2 blocs avec un piétinement (heavyStomp), tient
  la pose (HOLD). Recharge de 12 à 18 s.
- Mauvais : « Mock Charge » (brut), « Charge simulée » (traduit, pas compris),
  « L'éléphant exécute une charge d'intimidation sur le joueur ciblé » (jargon, trop long).
- Bon : « Barrit puis fonce sur qui s'approche trop, et s'arrête net juste avant le choc ».

Autre cas, `ElephantMournGoal` : à la mort d'un éléphant, chaque membre de son troupeau
reçoit l'endroit (`ElephantHerd` → `startMourning`) ; s'il est calme, il y va et reste un
moment (`vigilTicks`). Le même événement lui fait garder rancune au tueur (c'est
`ElephantGrudgeTargetGoal`, une autre phrase). → « Revient veiller un membre du troupeau
à l'endroit où il est mort ».

## Ce qui ne se traduit pas

- Une classe utilitaire listée par erreur (ElephantGoals, ElephantWaterRun : pas de
  `extends Goal`) : la **filtrer** du rendu, ne pas lui inventer une phrase.
- Les comportements génériques communs à toutes les bêtes (OWRandomStrollGoal,
  OWLookAtPlayerGoal…) : n'apportent rien sur une fiche, à ne montrer que si le
  propriétaire le veut.
- Les noms propres et marques du jeu.

## Autres familles de libellés

- **Animations** (`ANIM_LABEL`) : nom court de ce qu'on voit, en titre : « Sédation —
  chute », « Coup d'épaule — gauche », « Repos → Assis » pour une transition. Même famille
  = même premier mot (« Frappe tellurique — élan / saut / impact »).
- **Constantes d'attaque** (`CONSTANT_FR`) : nom du réglage en minuscules, comme une ligne
  de fiche technique : « rayon de visée », « durée d'étourdissement ». L'unité est ajoutée
  par le code (s, blocs, %), ne pas la répéter.
- **Variantes** (`VARIANT_FR`) : la couleur au masculin, une majuscule : « Doré »,
  « Argenté ».
- **Objets Minecraft** (`VANILLA_NAMES`) : le nom officiel du jeu, copié du fr_fr.json de
  Minecraft (voir les fichiers du jeu, `.minecraft/assets`), jamais traduit à la main.
- **Biomes** (`BIOME_NAMES`) : nom officiel du jeu pour les biomes vanilla, nom du mod
  (fr_fr.json du mod) pour les siens.

## Traduction vers les autres langues

On n'écrit que le français. `js/i18n.js` envoie le texte à l'API et met le résultat en
cache. Conséquences pour l'écriture : des phrases complètes et grammaticales (l'API traduit
mal les fragments), pas de texte découpé en morceaux concaténés, et un terme court qui
ressort mal → une ligne dans `GLOSSARY`, rien de plus.
