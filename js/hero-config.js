/* ===========================================================================
   REGLAGES DU FOND D'EN-TETE DES FICHES CREATURES
   ===========================================================================

   Chaque fiche affiche en grand le wallpaper de la bete
   (assets/wallpapers/<bete>.png). L'image remplit tout le bandeau et en
   deborde : on choisit ici quelle partie on voit.

     y     position verticale, de 0 a 100.
           0   = on voit le HAUT de l'image (l'image descend)
           100 = on voit le BAS de l'image (l'image monte)
           Pour monter l'image, augmentez le chiffre ; pour la descendre,
           baissez-le. 40 est la valeur d'origine.

     x     position horizontale, de 0 a 100 (50 = centre). Facultatif.

     zoom  agrandissement, 1 = normal. Facultatif. Utile quand l'image a
           exactement la forme du bandeau et ne peut donc pas bouger :
           avec zoom: 1.15, elle deborde de 15 % et y / x reprennent effet.

   Une bete absente de la liste prend la valeur par defaut. */

(function (OW) {
  'use strict';

  OW.HERO_CONFIG = {
    default: { y: 40, x: 50, zoom: 1 },

    wallpapers: {
      tiger: { y: 80 },
      kodiak: { y: 40 },
      crocodile: { y: 70 },
      boa: { y: 0 },
      orca: { y: 80 },
      elephant: { y: 40 },
      kangaroo: { y: 0 },
      red_panda: { y: 80 },
      gorilla: { y: 10 },
      hippopotamus: { y: 40 },
      lion: { y: 40 },
      plant_empress: { y: 40 }
    }
  };
}(window.OW = window.OW || {}));
