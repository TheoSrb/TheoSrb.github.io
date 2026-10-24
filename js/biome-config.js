/* ===========================================================================
   REGLAGES DES BIOMES DE FOND — le seul fichier a toucher pour changer
   quel biome s'affiche ou.
   ===========================================================================

   Les biomes dessines disponibles (leur identifiant, a gauche) :

     jungle    Jungle                 bamboo    Jungle de bambous
     swamp     Marais                 mangrove  Mangrove
     forest    Forêt                  redwood   Forêt de séquoias
     cherry    Cerisaie               snow      Neige
     frozen    Banquise               savanna   Savane
     badlands  Badlands               desert    Désert
     ocean     Océan                  abyss     Abysses
     cave      Grottes                lukewarm  Océan tiède (sous l'eau)

   Pour mettre un biome a la place d'un autre, il suffit de changer
   l'identifiant dans les listes ci-dessous. */

(function (OW) {
   'use strict';

   OW.BIOME_CONFIG = {

      /* 1 · Les biomes du JSON -> le decor dessine.
  
         Sur une fiche de creature, le fond suit EXACTEMENT les biomes
         d'apparition que le JSON declare pour la bete (spawn.biomes). Chaque
         identifiant du JSON est traduit ici en un decor. Un identifiant absent
         de cette table est ignore (un avertissement apparait dans la console
         du navigateur) : ajoutez-le ici pour qu'il s'affiche. */
      spawnToBiome: {
         'ow:redwood_forest': 'redwood',
         'minecraft:jungle': 'jungle',
         'minecraft:sparse_jungle': 'jungle',
         'minecraft:bamboo_jungle': 'bamboo',
         'minecraft:swamp': 'swamp',
         'minecraft:mangrove_swamp': 'mangrove',
         'minecraft:forest': 'forest',
         'minecraft:birch_forest': 'forest',
         'minecraft:old_growth_birch_forest': 'forest',
         'minecraft:flower_forest': 'forest',
         'minecraft:plains': 'forest',
         'minecraft:meadow': 'forest',
         'minecraft:cherry_grove': 'cherry',
         'minecraft:savanna': 'savanna',
         'minecraft:savanna_plateau': 'savanna',
         'minecraft:windswept_savanna': 'savanna',
         'minecraft:desert': 'desert',
         'minecraft:badlands': 'badlands',
         'minecraft:eroded_badlands': 'badlands',
         'minecraft:wooded_badlands': 'badlands',
         'minecraft:snowy_plains': 'snow',
         'minecraft:snowy_taiga': 'snow',
         'minecraft:grove': 'snow',
         'minecraft:snowy_slopes': 'snow',
         'minecraft:frozen_peaks': 'snow',
         'minecraft:frozen_ocean': 'frozen',
         'minecraft:deep_frozen_ocean': 'frozen',
         'minecraft:ice_spikes': 'frozen',
         'minecraft:ocean': 'ocean',
         'minecraft:deep_ocean': 'ocean',
         'minecraft:warm_ocean': 'ocean',
         'minecraft:lukewarm_ocean': 'lukewarm',
         'minecraft:deep_lukewarm_ocean': 'lukewarm',
         'minecraft:cold_ocean': 'ocean',
         'minecraft:beach': 'ocean',
         'minecraft:dripstone_caves': 'cave',
         'minecraft:lush_caves': 'cave'
      },

      /* 2 · Les fiches de creature. */

      /* Au plus tant de biomes differents sur une fiche. La hauteur de la page
         est partagee a parts egales entre eux, dans l'ordre du JSON. */
      animalMaxBiomes: 4,

      /* Les betes dont le JSON ne declare AUCUN biome d'apparition (encore sans
         spawn dans le mod). Ce n'est pas le JSON qui parle ici : c'est un choix
         a faire a la main. */
      animalWithoutSpawn: {
         orca: ['ocean'],
         elephant: ['savanna'],
         kangaroo: ['badlands'],
         red_panda: ['bamboo'],
         gorilla: ['jungle'],
         hippopotamus: ['savanna'],
         lion: ['savanna'],
         plant_empress: ['jungle']
         /* Les betes secretes ou a venir n'ont pas leur ligne ici (elle les
            nommerait dans le code servi) : leur reglage attend dans
            tools/hidden.json, « a_leur_sortie ». */
      },
      /* ...et pour une bete absente de la liste ci-dessus. */
      animalDefault: ['forest'],

      /* Forcer une liste pour une bete, meme si le JSON en declare une autre.
         Vide par defaut : c'est le JSON qui decide. Exemple :
           tiger: ['bamboo', 'cherry'] */
      animalOverride: {
         /* Le JSON donne bamboo_jungle puis jungle : on garde les memes biomes,
            mais la jungle d'abord. */
         tiger: ['jungle', 'bamboo']
      },

      /* 3 · Les autres pages : les biomes traverses en descendant, dans
         l'ordre. La page n'en montre que ce que sa hauteur permet (environ un
         biome par ecran et quart), en commencant par le premier.

       Les listes suivent des voisinages logiques : on ne passe d'un biome qu'a
       un biome qui peut le border (jamais de la banquise au desert, ni des
       abysses a la jungle). Voisins permis :
         jungle    bambous, marais, mangrove, savane, ocean, foret
         bambous   jungle, cerisaie, foret
         marais    jungle, mangrove, foret
         mangrove  marais, jungle, ocean, ocean tiede
         foret     jungle, bambous, marais, sequoias, cerisaie, neige, savane, grottes
         sequoias  foret, cerisaie, neige
         cerisaie  bambous, foret, sequoias, neige
         neige     foret, sequoias, cerisaie, banquise, grottes
         banquise  neige, ocean
         savane    jungle, foret, desert, badlands
         badlands  savane, desert, grottes
         desert    savane, badlands, ocean
         ocean     jungle, mangrove, desert, banquise, ocean tiede
         ocean tiede  ocean, abysses, mangrove
         abysses   ocean tiede, grottes
         grottes   abysses, badlands, neige, foret
       Et elles se repartissent les biomes : sur l'ensemble des pages, chacun
       revient a peu pres autant de fois dans ce qu'on voit reellement (le
       debut de chaque liste). L'accueil commence par la jungle, Objets par les badlands, Musiques par la
       cerisaie. */
      pages: {
         index: ['jungle', 'bamboo', 'cherry', 'redwood', 'snow', 'frozen', 'ocean', 'lukewarm', 'mangrove', 'swamp', 'forest', 'savanna', 'desert', 'badlands', 'cave', 'abyss'],
         creatures: ['savanna', 'desert', 'badlands', 'jungle', 'forest', 'cherry', 'bamboo'],
         biomes: ['redwood', 'snow', 'swamp', 'forest', 'redwood', 'cherry', 'snow', 'frozen', 'ocean', 'desert', 'savanna', 'badlands', 'cave', 'abyss', 'lukewarm', 'mangrove'],
         items: ['badlands', 'desert', 'ocean', 'frozen', 'snow', 'redwood', 'cherry', 'bamboo', 'forest', 'savanna', 'jungle', 'swamp', 'mangrove', 'lukewarm', 'abyss', 'cave'],
         cosmetics: ['cave', 'abyss', 'lukewarm', 'mangrove', 'ocean', 'frozen', 'snow', 'redwood', 'cherry', 'bamboo', 'jungle', 'swamp', 'forest', 'savanna', 'badlands', 'desert'],
         simulator: ['lukewarm', 'ocean', 'forest', 'desert', 'badlands', 'cave', 'abyss', 'swamp', 'mangrove', 'savanna', 'jungle', 'bamboo', 'cherry', 'redwood', 'snow', 'frozen'],
         music: ['cherry', 'redwood', 'forest', 'bamboo', 'jungle', 'swamp', 'mangrove', 'lukewarm', 'abyss', 'cave', 'badlands', 'savanna', 'desert', 'ocean', 'frozen', 'snow'],
         download: ['snow', 'frozen', 'ocean', 'lukewarm', 'abyss', 'cave', 'desert', 'savanna', 'forest', 'snow', 'redwood', 'cherry', 'bamboo', 'jungle', 'mangrove', 'swamp'],
         guide: ['forest', 'swamp', 'mangrove', 'redwood', 'jungle', 'badlands', 'desert', 'ocean', 'lukewarm', 'abyss', 'cave', 'snow', 'redwood', 'cherry', 'bamboo'],
         community: ['ocean', 'savanna', 'forest', 'bamboo', 'mangrove', 'swamp', 'forest', 'redwood', 'cherry', 'bamboo', 'jungle', 'savanna', 'badlands', 'desert', 'ocean', 'frozen'],
         /* La page introuvable : le panda roux s'est egare dans sa jungle de bambous. */
         '404': ['bamboo'],
         /* L'antre des boss (bosses.html) : une grotte, rien qu'une grotte. */
         bosses: ['cave'],
         /* La fiche d'un biome (biome.html) ne montre QUE son propre biome, du
            haut de la page jusqu'au pied : elle parle d'un biome, en traverser
            quinze en descendant n'aurait pas de sens. La page porte
            data-biome-only, et js/biome.js lui passe le decor de sa fiche ; cette
            liste n'est plus qu'un repli si le JSON ne repond pas. */
         biome: ['redwood'],
         lab: ['cave', 'abyss', 'lukewarm', 'ocean', 'frozen', 'snow', 'redwood', 'cherry', 'bamboo', 'jungle', 'swamp', 'mangrove']
      }
   };
}(window.OW = window.OW || {}));
