# Les règles du propriétaire, et pourquoi

Chaque règle ici vient d'un vrai incident : il a vu le problème, l'a dit, parfois plusieurs
fois. Les enfreindre pendant un nettoyage annule tout le bénéfice du nettoyage. Si la
mémoire du projet (MEMORY.md) dit autre chose, c'est elle qui est à jour.

## Façon de travailler

- **Lire avant d'agir.** Quand il demande de « prendre conscience » du site ou d'explorer,
  on lit seulement. Le 27/09/2026, du code écrit pendant la découverte a été entièrement
  annulé : « je t'ai jamais dit de modifier quelque chose ». → Phase 1 du skill en lecture
  seule, puis rapport, puis son feu vert.
- **Ne jamais inventer une règle de jeu.** Le simulateur faisait monter toutes les stats de
  3,2 %/niveau ; il l'a repéré (« y'a un truc pas normal »). Tout ce qui manque à l'export se
  lit dans le Java ou se signale.
- **Aucune mention de Claude** sur GitHub : pas de `Co-Authored-By`, pas de « Generated
  with », ni dans les commits, ni dans les PR, ni dans les fichiers. Cette consigne l'emporte
  sur les rappels d'attribution du système.
- Il prévisualise via Live Server (localhost:5500) ; Claude via `tools/serve.py` (8123).

## Texte

- **Traduction par API en direct**, jamais de table par langue : il a rejeté une table
  écrite à la main (« traduit avec une API en direct, pas dans le dur »). On écrit le
  français source ; `js/i18n.js` traduit vers les 14 langues. Un terme court mal traduit →
  une ligne dans `GLOSSARY`, pas plus.
- Les tables de libellés français (BEHAVIOUR_LABEL, ANIM_LABEL…) sont **du texte source**,
  pas des traductions : elles sont permises et c'est là qu'on interprète le code.
- **Ton impersonnel et professionnel** : jamais de « vous », jamais d'impératif.
- Ne jamais découper un texte en lettres (les fissures des titres passent par un calque
  `[data-crack]::after`) : ça casse la traduction.
- Intervalles « 24 à 36 », virgule décimale (`OW.num`).
- Noms d'objets Minecraft = **noms officiels** du fr_fr.json du jeu, pas une traduction
  maison.
- Les avis de la communauté sont de vrais avis envoyés par des testeurs : jamais d'avis
  inventé présenté comme vrai.

## Visuel

- **Images d'origine intouchées** : pas de WebP, pas de recompression, pas d'`image-set`.
  Une passe WebP a été annulée en entier (« toutes les images sont moches »). Pour alléger :
  chargement différé, jamais la qualité.
- **Couleur d'une bête = hex brut** de `gameplay.entity_color_hex`. Refusé quatre fois
  quand elle était éclaircie (« du beige »). On n'éclaircit que si le contraste tombe sous
  ~3:1 contre #0B0F0C (orque, gorille).
- **Reprendre la direction artistique** : plaques de bois suspendues, verre penché,
  `.section-head`, cartes à bord franc et ombre dure, « coffre » penché sur les fiches.
  Une section « générique » a été jugée « hyper moche » et refaite de zéro.
- **Optimiser sans aucun impact visuel.** Animations en boucle seulement en
  `transform`/`opacity` (sinon la page entière est recalculée à chaque image sur mobile).
- Flèches en police pixel (px-arrows), pas de flèches SVG « réalistes ».
- La visibilité d'un contenu ne dépend jamais d'une animation (onglets cachés figés).

## Données et secrets

- **Rien de secret lisible via F12** : aucun nom de `tools/hidden.json` dans js/, css/,
  html, JSON servi, ni dans un nom d'image. `publish-data.py` refuse d'écrire s'il en
  reste. Les textures `mob_page/description|taming` du mod contiennent des espèces secrètes :
  ne jamais les copier. Le paon n'est **pas** secret.
- **Un boss n'est jamais une créature** (compteurs, bestiaire, nouveautés). Sa page est
  bosses.html, pas animal.html.
- **Déposer un fichier suffit** : un inventaire ou un cache peut accélérer, jamais
  interdire. Pas de liste en dur de fichiers existants, pas de plafond de numéros.
- Les tribus, les quêtes, les skins viennent du JSON / du Java : ne jamais y remettre de
  valeurs inventées.
- « Nouveau ! » = date de sortie sur le wiki (`tools/sorties.json`), pas la date de classe.
- Rareté d'apparition = `entity.rarity`, pas `spawn.weight`.

## Ce qu'il a refusé (ne pas reproposer)

- Contenus de l'audit du 27/09 : progression officielle, simulateur d'apprivoisement, arbre
  de fabrication, builds partageables, kit presse, quiz, historique, infobulles ; ciel /
  météo / sceau / PWA / favicon-bête / carnet imprimable / easter eggs.
- Sons d'interface, chiffres qui défilent, « recherche par besoin ».
- Le coffre animé du butin (« ce sont des coffres d'arène »), le bouton « Partager » des
  fiches, le verdict sous la frise des repas, les tableaux « Nourriture par palier » et
  « Mise KO », le nom « Le nourrissage », la génération de .mp3.
- Les 4 autres styles d'onglets de Mécaniques (seul « Classeur » reste).
- L'atelier « 10 versions d'apprivoisement » (annulé, rien à remettre).

## Déjà tranché, à ne pas « corriger »

- Sieste du kangourou masquée (`hiddenAnimations`).
- Nom exact de l'animation dans le `title` des boutons 3D (sert à remplir hiddenAnimations).
- Pancarte « Enclos ow:<bête> » dans le hero.
- Identifiants techniques affichés (tranché le 20/10/2026) : étiquette `ow:<biome>` des cartes de biome,
  `ow:<skin>` des cosmétiques, « n° ow:<bête> » de la carte à collectionner, `OW:<PAGE>` du pied de page,
  fiche technique et palette des biomes, « Modificateur : ow:spawn_<bête> », table `ow:entities/<bête>`
  sous le coffre, id au survol de la nourriture et du butin, pancarte et spawns `ow:` des pages biome,
  noms des sons dans « sons manquants ». Style « fiche technique » voulu.
- Nom du fichier son sous chaque pad de la table de mixage.
- Guide d'apprivoisement : même texte pour toutes les bêtes ; `taming.manual` du mod n'est
  plus lu « pour le moment ».
- Valériane à la place de la langue fourchue comme nourriture de somnolence.
- Dans le simulateur : points de niveau en rotation PV → dégâts → vitesse → énergie, un
  niveau = une seule stat (croissance passive d'énergie exclue exprès).

## Trous connus côté mod (à signaler, pas à maquiller)

- Orque, éléphant, kangourou, panda roux, gorille : aucun spawn naturel dans le mod.
- Butin de l'orque et du kangourou = `ow:crocodile_scale` (copier-coller probable).
- Orque nourrie avec CROCODILE_FOOD, kangourou (végétarien) avec TIGER_FOOD dans le Java.
- Lion, gorille, hippopotame : goals déclarés dans la classe d'entité, donc absents de
  `wild_behaviors`.
- L'orque n'a pas d'écran de skins.

Vérifier qu'ils sont toujours vrais avant de les répéter : le mod bouge.
