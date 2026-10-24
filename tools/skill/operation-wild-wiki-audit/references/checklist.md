# Ce que les scripts ne voient pas : la liste de contrôle

Les scripts trouvent le texte brut et les trous de libellés. Le reste demande de **lire**
la page à côté du Java. Faire chaque point pour chaque bête publiée (non-boss), puis les
pages transverses. Noter au fil de l'eau : page, ce qui est faux, la preuve (fichier Java
+ ligne ou champ du JSON), la correction.

## Fiche créature (animal.html?e=<slug>)

- **Identité** : nom, famille, régime, tempérament, archétype (couleur = code § du mod),
  taille et vitesses = valeurs du JSON. Couleur de la bête = hex brut.
- **Statistiques** : PV, dégâts, vitesse, énergie, armure comparées à
  `attributes` / `gameplay` de l'export, et pour la montée de niveau à `OWEntity.java`
  (`upgradeAttributes`, plafonds dans `OWInventoryScreen.java`). Stats sauvages aléatoires :
  PV ×0,8–1,2, dégâts ×0,9–1,1, vitesse ×0,85–1,05.
- **Capacités** : chaque carte du JSON est là, titre et description en français du mod,
  `%s` remplacés par la bonne constante (le bon ordre !), touches (Clic gauche/droit,
  Touche X). Constantes sous la carte : libellé français, unité juste (ticks → s).
  Rythme du combo (`comboTicks`) = 1er argument de `createCombo()` du Java.
- **Apprivoisement** : difficulté (`tamingDifficulty`, choisie par lui), nourriture acceptée
  dans l'ordre adoré → préféré → pour l'apprivoiser → régime → reste ; constantes `MEAL`
  toujours égales à celles d'OWAggressiveTaming ; selle (matières, emplacements, icônes qui
  défilent).
- **Apparition** : biomes = `spawn.biomes ∪ rarity.biomes`, palier de rareté, paramètres ;
  une bête sans spawn dans le mod affiche « Aucune » proprement. Comportements sauvages :
  phrases françaises interprétées, aucune classe utilitaire, aucun repli anglais.
- **Butin** : chaque entrée de la loot table, quantités, chances, noms d'objets français.
- **Variantes / skins** : noms français, prix et conditions venant de `js/skin-data.js`
  (généré du Java), images présentes.
- **Sons** : un pad par son exporté, noms lisibles (`js/assets-config.js`).
- **Animations** : nombre de boutons = animations du Java moins `hiddenAnimations` ;
  aucun libellé brut ; groupes cohérents.
- **Guide d'apprivoisement** (livre) : texte de `js/taming-guides.js`, à jour avec les
  mécaniques (repas, somnolence, valériane).

## Pages transverses

- **Accueil** : compteurs (créatures sans boss, biomes, objets…), nouveautés = bêtes sorties
  depuis `news.months`, feuille de route (`data/roadmap.json` : à lui de la réécrire, mais
  signaler une étape « à venir » déjà sortie).
- **Créatures** : toutes les bêtes publiées, aucun boss, aucune espèce secrète ; filtres qui
  donnent des comptes justes ; comparateur à l'échelle avec toutes les bêtes de models.json.
- **Boss** : `NOTES` de bosses.js toujours vraies face au Java (`entity/bosses/`).
- **Biomes** : chaque bête listée dans le bon biome (biome-config `spawnToBiome`,
  `animalWithoutSpawn`), noms de biomes français.
- **Objets** : chaque objet du mod a une image (sinon : `tools/bilan.py`), nom français,
  recettes complètes, objets masqués absents.
- **Cosmétiques** : prix, raretés, conditions = Java ; skins sans 3D ou sans image signalés.
- **Mécaniques** : archétypes (multiplicateurs d'`OWEntityConfig.java`), simulateur (règles
  d'`OWEntity.hurt`, Tank ×0,8, Assassin 1 coup sur 10 ×1,25), tribus (tout du JSON),
  quêtes (`js/quest-data.js` généré de DailyQuestTier.java).
- **Guide, Téléchargement, Musique, Communauté** : versions et liens à jour, pistes
  d'`ALBUMS` qui existent, avis réels seulement.

## Partout

- Texte : français, ton impersonnel, pas de « vous », pas de fautes, accents, virgule
  décimale, espaces avant « : ; ! ? » cohérentes avec le reste du site.
- Liens internes qui mènent quelque part ; aucune page orpheline.
- Console sans erreur JS (les 404 de sondes sont normales).
- Thème clair : pas de texte sombre sur fond blanc dans les habillages « coffre ».
- Mobile (375 px) : pas de débordement horizontal (il casse aussi les transitions de page).
- `?v=` : chaque fichier JS/CSS modifié a un nouveau `?v=` dans **toutes** les pages qui
  le chargent.
- Aucun nom de `tools/hidden.json` dans un fichier servi :
  `grep -rniE "<nom1>|<nom2>" js css *.html data` doit rester vide.
