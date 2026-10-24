/* ===========================================================================
   REGLAGES DU SITE — a modifier a la main
   ===========================================================================

   Ce fichier regroupe les interrupteurs des fonctions du wiki qu'on veut
   pouvoir allumer ou eteindre sans toucher au code. Il suffit de changer
   true / false (ou un nombre) et de recharger la page.

   ---------------------------------------------------------------------------
   news — les nouvelles creatures (« Nouveau ! »)
   ---------------------------------------------------------------------------

     enabled   true pour les mettre en avant, false pour ne rien montrer.

     months    combien de mois une creature reste « nouvelle » apres sa sortie
               sur le wiki (1 = un mois jour pour jour). Toutes celles sorties
               dans ce delai sont nouvelles EN MEME TEMPS : chacune a son
               etoile sur sa carte, et l'encart de l'accueil devient un
               carrousel qui les fait defiler, la plus recente d'abord (une
               seule : il ne bouge pas ; aucune : il disparait).
               Pour voir la liste dans la console du navigateur (F12) :
                   OW.newCreatures(await OW.loadWikiData())

     slug      pour forcer une ou plusieurs creatures, quelle que soit leur
               date : 'elephant', ou ['lion', 'hippopotamus']. null = la date
               de sortie decide.

   La date de sortie est le jour ou la bete est apparue sur le wiki (en
   general : le jour ou elle a quitte les creatures mysteres). Le registre
   est tools/sorties.json, rempli tout seul par tools/publish-data.py ; une
   date s'y corrige a la main. Le JSON la porte en history.revealed (et a
   defaut, la date de creation de la classe, history.created).

   Pour voir l'encart sans attendre, ajouter ?news=tiger (ou
   ?news=tiger,kodiak) a l'adresse de l'accueil.

   ---------------------------------------------------------------------------
   community — les avis des joueurs
   ---------------------------------------------------------------------------

     homeCarousel   true pour le carrousel d'avis sur l'accueil.

     examples       true pour afficher les AVIS ET CREATIONS D'EXEMPLE
                    (data/community.demo.json), marques « Exemple », partout :
                    pratique pour voir le rendu. A remettre a false avant de
                    publier le site, quand les vrais avis sont arrives.

   Les avis et les creations se saisissent dans data/community.json (le mode
   d'emploi est en tete du fichier). Pour voir le rendu avec des exemples,
   ajouter ?demo a l'adresse (index.html?demo ou community.html?demo) : les
   exemples sont marques comme tels et ne s'affichent jamais sans ?demo (ou
   sans examples: true ci-dessous).

   ---------------------------------------------------------------------------
   player — le lecteur de musique qui suit d'une page a l'autre
   ---------------------------------------------------------------------------

     enabled   false pour ne jamais afficher le mini-lecteur.

   ---------------------------------------------------------------------------
   hiddenAnimations — les animations a ne pas montrer sur la fiche d'une bete
   ---------------------------------------------------------------------------

   Une ligne par bete (son slug), avec la liste des animations a retirer du
   modele 3D de la fiche (chapitre Animations) et des apercus GIF. Chaque
   entree peut etre :
     - un mot du nom de l'animation : 'NAP' retire NAP, et aussi les
       transitions TRANSITION_IDLE_NAP et TRANSITION_NAP_IDLE ;
     - un nom exact : 'ATTACK_STRIKE_2' ;
     - le nom affiche sur la fiche : 'Sieste'.
   Les noms exacts s'affichent en survolant les boutons du modele 3D.

   Exemple, pour retirer la sieste du kangourou et le saut du tigre :
       hiddenAnimations: {
         kangaroo: ['NAP'],
         tiger: ['LEAP', 'PREPARING_LEAP']
       }

   ---------------------------------------------------------------------------
   tamingDifficulty — la difficulte d'apprivoisement de chaque bete
   ---------------------------------------------------------------------------

   Une ligne par bete (son slug) : son palier, de 1 a 8. C'est la SEULE
   source de la difficulte : rien n'est calcule (ni d'apres l'XP
   d'apprivoisement, ni d'apres autre chose).

       1 Tres facile   2 Facile       3 Accessible   4 Modere
       5 Difficile     6 Tres difficile  7 Redoutable  8 Cauchemar

   Une bete absente de la liste n'affiche pas de tampon de difficulte sur sa
   fiche, et le bilan de runWikiDatas la signale. Le guide (« Facile a
   apprivoiser », record « La plus facile a apprivoiser ») classe aussi les
   betes d'apres ces paliers.

   ---------------------------------------------------------------------------
   sleepFood — ce qui prolonge le sommeil pendant l'apprivoisement
   ---------------------------------------------------------------------------

   Affiche a la place de ce que l'export met dans le tag ow:somnolence_food
   (aujourd'hui la langue fourchue), dans le bandeau « Les repas » des fiches.

     id     l'objet du mod : son image est cherchee dans assets/item/ (pour
            ow:valerian, deposer assets/item/valerian.png suffit) ;
     name   le nom affiche ;
     icon   l'image de remplacement tant que l'objet n'en a pas.

   sleepFood: null pour revenir a ce que dit l'export.
   =========================================================================== */

(function (OW) {
  'use strict';

  OW.SITE_CONFIG = {
    news: {
      enabled: true,
      months: 1,
      slug: null
    },

    community: {
      homeCarousel: true,
      /* Des avis d'exemple (data/community.demo.json), pour voir le rendu. */
      examples: false
    },

    player: {
      enabled: true
    },

    hiddenAnimations: {
      kangaroo: ['NAP']
    },

    tamingDifficulty: {
      red_panda: 2,
      kangaroo: 3,
      boa: 4,
      gorilla: 4,
      kodiak: 5,
      tiger: 5,
      crocodile: 6,
      orca: 7,
      elephant: 4,
      hippopotamus: 5,
      lion: 5
    },

    sleepFood: null,

    placeholders: {
      loot: ['orca', 'kangaroo']
    }
  };
}(window.OW = window.OW || {}));
