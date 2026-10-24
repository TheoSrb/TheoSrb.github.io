/* ===========================================================================
   REGLAGES DES ASSETS — a modifier a la main
   ===========================================================================

   Les noms que le site donne a certains fichiers (musiques, sons, GIF), quand
   celui qu'il devine ne convient pas. Modifier le texte entre les guillemets,
   enregistrer, recharger la page. Une ligne absente = le nom devine par le site.

   Attention aux guillemets : un texte entre '...' ne peut pas contenir
   d'apostrophe droite. Ecrire l’ (apostrophe courbe) ou mettre le texte entre
   "...". Chaque ligne se termine par une virgule, sauf la derniere d'un bloc.

   ---------------------------------------------------------------------------
   music — les morceaux (page Musiques et mini-lecteur qui suit d'une page a
   l'autre), par nom de fichier du dossier music/ des assets :
       title    le nom du morceau
       sub      la ligne sous le titre, sur la platine (facultatif)
   Les fichiers disponibles : main-theme.mp3 (le theme principal), et ceux
   que le mod fournit (plant_empress_theme.ogg, plant_empress_theme_lite.ogg,
   plant_empress_defeated.ogg, ritual_intro.ogg, ritual_theme.ogg,
   ritual_end.ogg, menu_music.ogg). Seuls ceux que la page Musiques joue
   s'affichent (voir ALBUMS dans js/music.js pour en ajouter).

   ---------------------------------------------------------------------------
   sounds — les sons des fiches de creatures, par nom de son : le nom en petit
   sous chaque bouton de la table de sons (ex. tiger_roar_ultimate).

   ---------------------------------------------------------------------------
   gifs — les apercus animes des fiches, par fichier du dossier pages/ :
   '<bete>/anim_<n>.gif' (ex. 'tiger/anim_3.gif'). Sans ligne, le site
   reconnait l'animation a sa duree et lui donne son nom.
   =========================================================================== */

(function (OW) {
  'use strict';

  OW.ASSETS_CONFIG = {
    music: {
      'main-theme.mp3': {
        title: 'Operation W.I.L.D',
        sub: 'Le thème de l’écran-titre'
      },
      'plant_empress_theme.ogg': {
        title: 'Thème — Impératrice Végétale',
        sub: 'Joué à l’apparition de l’Impératrice Végétale'
      }
    },

    sounds: {
      /* 'tiger_roar_ultimate': 'Rugissement de la Cruauté Féline', */
    },

    gifs: {
      /* 'tiger/anim_3.gif': 'Combo d’attaques', */
    }
  };
}(window.OW = window.OW || {}));
