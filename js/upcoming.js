/* Genere par tools/publish-data.py — ne pas modifier a la main.

   Les betes annoncees, sans leur nom : une empreinte (key), une silhouette
   noire et le decor de biome de leur carte. Une carte disparait d'elle-meme
   quand l'export contient une espece de meme empreinte (js/creature-card.js).
   OW.UPCOMING_BOSSES : les boss scelles de bosses.html, meme principe
   (js/bosses.js). */
(function (OW) {
  'use strict';
  OW.UPCOMING = [
    {
      "key": "631ff538",
      "img": "assets/mystery/631ff538.png",
      "biome": "savanna"
    },
    {
      "key": "5c1c35e9",
      "img": "assets/mystery/5c1c35e9.png",
      "biome": "ocean"
    },
    {
      "key": "a9cd618b",
      "img": "assets/mystery/a9cd618b.png",
      "biome": "frozen"
    },
    {
      "key": "f4a21130",
      "img": "assets/mystery/f4a21130.png",
      "biome": "abyss"
    },
    {
      "key": "43a3fd72",
      "img": "assets/mystery/43a3fd72.png",
      "biome": "ocean"
    },
    {
      "key": "8b79a18d",
      "img": "assets/mystery/8b79a18d.png",
      "biome": "forest"
    },
    {
      "key": "e0a415a0",
      "img": "assets/mystery/e0a415a0.png",
      "biome": "lukewarm"
    }
  ];
  OW.UPCOMING_BOSSES = [];
}(window.OW = window.OW || {}));
