/* ===========================================================================
   GUIDES D'APPRIVOISEMENT — a ecrire a la main
   ===========================================================================

   Les etapes du guide d'apprivoisement de chaque bete : le livre du chapitre
   « Apprivoisement » de sa fiche. Une etape = une page du livre.

   Comment ecrire :
     - le nom de la bete, tel qu'il est dans l'adresse de sa fiche
       (animal.html?e=kangaroo  ->  kangaroo), suivi de deux-points ;
     - ses etapes entre crochets [ ], chacune entre guillemets droits " ",
       separees par des virgules ;
     - une ligne qui commence par # est un titre de chapitre : il s'affiche
       en haut de la page qui la suit, numerote tout seul (Chapitre I, II...) ;
     - **mot** met un mot en gras.

   Exemple, pour le kangourou :

     kangaroo: [
       "# L'approche",
       "Le kangourou vit dans les **badlands**. Il faut l'approcher lentement.",
       "# Le repas",
       "Lui tendre une **carotte**, puis attendre qu'il la prenne."
     ],

   C'est la seule source du deroule : le texte du manuel exporte par le mod
   n'est plus lu. Une bete absente d'ici affiche « Le guide d'apprivoisement
   de cette creature n'est pas encore redige. » La traduction dans les autres
   langues se fait toute seule. La premiere phrase de la premiere page sert
   aussi au guide du debutant (guide.html).

   Toutes les betes ont pour l'instant le meme texte : l'apprivoisement
   « agressif » du mod (OWAggressiveTaming), commun a toutes. Pour donner a
   l'une son propre deroule, il suffit de reecrire ses lignes.
   Apres une modification : recharger la page de la fiche.
   =========================================================================== */
window.OW = window.OW || {};
window.OW.TAMING_GUIDES = {

  tiger: [
    "# Le matériel",
    "Avant de partir, il faut de quoi l'endormir : un **arc** et des **flèches tranquillisantes**, une **sarbacane de Maya** et ses **dards en bois tranquillisants**, ou bien un **lance-pierre primitif**. Prenez aussi de quoi la nourrir (ce qu'elle mange est listé plus haut, sous Nourriture acceptée).",
    "# Les premiers tirs",
    "Chaque tir qui fait mouche remplit sa **barre de somnolence**. Arrêtez-vous, et elle redescend d'elle-même : les tirs doivent s'enchaîner. Touchée, la créature réagit selon son caractère. Si elle peut vous atteindre, elle vous fonce dessus ; sinon, elle file et revient plus tard. Une créature paisible, elle, ne bronche pas.",
    "# La fuite",
    "Presque pleine, la barre lui fait perdre ses moyens : elle prend la fuite. Restez sur ses talons et continuez de tirer. Quand la barre est pleine, elle s'effondre et s'endort sur place.",
    "# Le sommeil",
    "Une fois endormie, les tranquillisants n'ont plus d'effet sur elle. Son sommeil s'use dès qu'elle touche le sol. S'il s'épuise avant la fin, elle se réveille et oublie tout ce que vous lui avez donné.",
    "# Les repas",
    "Lâchez sa nourriture au sol, tout près de sa gueule. Elle ne se jette pas dessus : avant chaque repas, elle laisse passer un moment, parfois vingt secondes, parfois plus d'une minute. Ensuite elle remarque ce qui traîne devant elle et l'avale, un morceau à la fois. Combien de repas faudra-t-il ? Ça dépend de l'individu.",
    "# Prolonger le sommeil",
    "Si sa barre de somnolence baisse trop, une **langue fourchue** posée près d'elle lui en rend une partie. Elle n'en veut pas tant que la barre est presque pleine. Et ce n'est pas un repas : la langue ne compte pas pour l'apprivoisement, et l'attente avant le repas suivant repart de zéro.",
    "# Le réveil",
    "Le dernier repas avalé, elle se relève, apprivoisée. Elle choisit pour maître le joueur qui l'a le plus nourrie. Chaque coup qu'elle reçoit pendant son sommeil lui coûte un des cinq points de niveau qu'elle gagne en se réveillant à vos côtés."
  ],

  kodiak: [
    "# Le matériel",
    "Avant de partir, il faut de quoi l'endormir : un **arc** et des **flèches tranquillisantes**, une **sarbacane de Maya** et ses **dards en bois tranquillisants**, ou bien un **lance-pierre primitif**. Prenez aussi de quoi la nourrir (ce qu'elle mange est listé plus haut, sous Nourriture acceptée).",
    "# Les premiers tirs",
    "Chaque tir qui fait mouche remplit sa **barre de somnolence**. Arrêtez-vous, et elle redescend d'elle-même : les tirs doivent s'enchaîner. Touchée, la créature réagit selon son caractère. Si elle peut vous atteindre, elle vous fonce dessus ; sinon, elle file et revient plus tard. Une créature paisible, elle, ne bronche pas.",
    "# La fuite",
    "Presque pleine, la barre lui fait perdre ses moyens : elle prend la fuite. Restez sur ses talons et continuez de tirer. Quand la barre est pleine, elle s'effondre et s'endort sur place.",
    "# Le sommeil",
    "Une fois endormie, les tranquillisants n'ont plus d'effet sur elle. Son sommeil s'use dès qu'elle touche le sol. S'il s'épuise avant la fin, elle se réveille et oublie tout ce que vous lui avez donné.",
    "# Les repas",
    "Lâchez sa nourriture au sol, tout près de sa gueule. Elle ne se jette pas dessus : avant chaque repas, elle laisse passer un moment, parfois vingt secondes, parfois plus d'une minute. Ensuite elle remarque ce qui traîne devant elle et l'avale, un morceau à la fois. Combien de repas faudra-t-il ? Ça dépend de l'individu.",
    "# Prolonger le sommeil",
    "Si sa barre de somnolence baisse trop, une **langue fourchue** posée près d'elle lui en rend une partie. Elle n'en veut pas tant que la barre est presque pleine. Et ce n'est pas un repas : la langue ne compte pas pour l'apprivoisement, et l'attente avant le repas suivant repart de zéro.",
    "# Le réveil",
    "Le dernier repas avalé, elle se relève, apprivoisée. Elle choisit pour maître le joueur qui l'a le plus nourrie. Chaque coup qu'elle reçoit pendant son sommeil lui coûte un des cinq points de niveau qu'elle gagne en se réveillant à vos côtés."
  ],

  crocodile: [
    "# Le matériel",
    "Avant de partir, il faut de quoi l'endormir : un **arc** et des **flèches tranquillisantes**, une **sarbacane de Maya** et ses **dards en bois tranquillisants**, ou bien un **lance-pierre primitif**. Prenez aussi de quoi la nourrir (ce qu'elle mange est listé plus haut, sous Nourriture acceptée).",
    "# Les premiers tirs",
    "Chaque tir qui fait mouche remplit sa **barre de somnolence**. Arrêtez-vous, et elle redescend d'elle-même : les tirs doivent s'enchaîner. Touchée, la créature réagit selon son caractère. Si elle peut vous atteindre, elle vous fonce dessus ; sinon, elle file et revient plus tard. Une créature paisible, elle, ne bronche pas.",
    "# La fuite",
    "Presque pleine, la barre lui fait perdre ses moyens : elle prend la fuite. Restez sur ses talons et continuez de tirer. Quand la barre est pleine, elle s'effondre et s'endort sur place.",
    "# Le sommeil",
    "Une fois endormie, les tranquillisants n'ont plus d'effet sur elle. Son sommeil s'use dès qu'elle touche le sol. S'il s'épuise avant la fin, elle se réveille et oublie tout ce que vous lui avez donné.",
    "# Les repas",
    "Lâchez sa nourriture au sol, tout près de sa gueule. Elle ne se jette pas dessus : avant chaque repas, elle laisse passer un moment, parfois vingt secondes, parfois plus d'une minute. Ensuite elle remarque ce qui traîne devant elle et l'avale, un morceau à la fois. Combien de repas faudra-t-il ? Ça dépend de l'individu.",
    "# Prolonger le sommeil",
    "Si sa barre de somnolence baisse trop, une **langue fourchue** posée près d'elle lui en rend une partie. Elle n'en veut pas tant que la barre est presque pleine. Et ce n'est pas un repas : la langue ne compte pas pour l'apprivoisement, et l'attente avant le repas suivant repart de zéro.",
    "# Le réveil",
    "Le dernier repas avalé, elle se relève, apprivoisée. Elle choisit pour maître le joueur qui l'a le plus nourrie. Chaque coup qu'elle reçoit pendant son sommeil lui coûte un des cinq points de niveau qu'elle gagne en se réveillant à vos côtés."
  ],

  boa: [
    "# Le matériel",
    "Avant de partir, il faut de quoi l'endormir : un **arc** et des **flèches tranquillisantes**, une **sarbacane de Maya** et ses **dards en bois tranquillisants**, ou bien un **lance-pierre primitif**. Prenez aussi de quoi la nourrir (ce qu'elle mange est listé plus haut, sous Nourriture acceptée).",
    "# Les premiers tirs",
    "Chaque tir qui fait mouche remplit sa **barre de somnolence**. Arrêtez-vous, et elle redescend d'elle-même : les tirs doivent s'enchaîner. Touchée, la créature réagit selon son caractère. Si elle peut vous atteindre, elle vous fonce dessus ; sinon, elle file et revient plus tard. Une créature paisible, elle, ne bronche pas.",
    "# La fuite",
    "Presque pleine, la barre lui fait perdre ses moyens : elle prend la fuite. Restez sur ses talons et continuez de tirer. Quand la barre est pleine, elle s'effondre et s'endort sur place.",
    "# Le sommeil",
    "Une fois endormie, les tranquillisants n'ont plus d'effet sur elle. Son sommeil s'use dès qu'elle touche le sol. S'il s'épuise avant la fin, elle se réveille et oublie tout ce que vous lui avez donné.",
    "# Les repas",
    "Lâchez sa nourriture au sol, tout près de sa gueule. Elle ne se jette pas dessus : avant chaque repas, elle laisse passer un moment, parfois vingt secondes, parfois plus d'une minute. Ensuite elle remarque ce qui traîne devant elle et l'avale, un morceau à la fois. Combien de repas faudra-t-il ? Ça dépend de l'individu.",
    "# Prolonger le sommeil",
    "Si sa barre de somnolence baisse trop, une **langue fourchue** posée près d'elle lui en rend une partie. Elle n'en veut pas tant que la barre est presque pleine. Et ce n'est pas un repas : la langue ne compte pas pour l'apprivoisement, et l'attente avant le repas suivant repart de zéro.",
    "# Le réveil",
    "Le dernier repas avalé, elle se relève, apprivoisée. Elle choisit pour maître le joueur qui l'a le plus nourrie. Chaque coup qu'elle reçoit pendant son sommeil lui coûte un des cinq points de niveau qu'elle gagne en se réveillant à vos côtés."
  ],

  orca: [
    "# Le matériel",
    "Avant de partir, il faut de quoi l'endormir : un **arc** et des **flèches tranquillisantes**, une **sarbacane de Maya** et ses **dards en bois tranquillisants**, ou bien un **lance-pierre primitif**. Prenez aussi de quoi la nourrir (ce qu'elle mange est listé plus haut, sous Nourriture acceptée).",
    "# Les premiers tirs",
    "Chaque tir qui fait mouche remplit sa **barre de somnolence**. Arrêtez-vous, et elle redescend d'elle-même : les tirs doivent s'enchaîner. Touchée, la créature réagit selon son caractère. Si elle peut vous atteindre, elle vous fonce dessus ; sinon, elle file et revient plus tard. Une créature paisible, elle, ne bronche pas.",
    "# La fuite",
    "Presque pleine, la barre lui fait perdre ses moyens : elle prend la fuite. Restez sur ses talons et continuez de tirer. Quand la barre est pleine, elle s'effondre et s'endort sur place.",
    "# Le sommeil",
    "Une fois endormie, les tranquillisants n'ont plus d'effet sur elle. Son sommeil s'use dès qu'elle touche le sol. S'il s'épuise avant la fin, elle se réveille et oublie tout ce que vous lui avez donné.",
    "# Les repas",
    "Lâchez sa nourriture au sol, tout près de sa gueule. Elle ne se jette pas dessus : avant chaque repas, elle laisse passer un moment, parfois vingt secondes, parfois plus d'une minute. Ensuite elle remarque ce qui traîne devant elle et l'avale, un morceau à la fois. Combien de repas faudra-t-il ? Ça dépend de l'individu.",
    "# Prolonger le sommeil",
    "Si sa barre de somnolence baisse trop, une **langue fourchue** posée près d'elle lui en rend une partie. Elle n'en veut pas tant que la barre est presque pleine. Et ce n'est pas un repas : la langue ne compte pas pour l'apprivoisement, et l'attente avant le repas suivant repart de zéro.",
    "# Le réveil",
    "Le dernier repas avalé, elle se relève, apprivoisée. Elle choisit pour maître le joueur qui l'a le plus nourrie. Chaque coup qu'elle reçoit pendant son sommeil lui coûte un des cinq points de niveau qu'elle gagne en se réveillant à vos côtés."
  ],

  elephant: [
    "# Le matériel",
    "Avant de partir, il faut de quoi l'endormir : un **arc** et des **flèches tranquillisantes**, une **sarbacane de Maya** et ses **dards en bois tranquillisants**, ou bien un **lance-pierre primitif**. Prenez aussi de quoi la nourrir (ce qu'elle mange est listé plus haut, sous Nourriture acceptée).",
    "# Les premiers tirs",
    "Chaque tir qui fait mouche remplit sa **barre de somnolence**. Arrêtez-vous, et elle redescend d'elle-même : les tirs doivent s'enchaîner. Touchée, la créature réagit selon son caractère. Si elle peut vous atteindre, elle vous fonce dessus ; sinon, elle file et revient plus tard. Une créature paisible, elle, ne bronche pas.",
    "# La fuite",
    "Presque pleine, la barre lui fait perdre ses moyens : elle prend la fuite. Restez sur ses talons et continuez de tirer. Quand la barre est pleine, elle s'effondre et s'endort sur place.",
    "# Le sommeil",
    "Une fois endormie, les tranquillisants n'ont plus d'effet sur elle. Son sommeil s'use dès qu'elle touche le sol. S'il s'épuise avant la fin, elle se réveille et oublie tout ce que vous lui avez donné.",
    "# Les repas",
    "Lâchez sa nourriture au sol, tout près de sa gueule. Elle ne se jette pas dessus : avant chaque repas, elle laisse passer un moment, parfois vingt secondes, parfois plus d'une minute. Ensuite elle remarque ce qui traîne devant elle et l'avale, un morceau à la fois. Combien de repas faudra-t-il ? Ça dépend de l'individu.",
    "# Prolonger le sommeil",
    "Si sa barre de somnolence baisse trop, une **langue fourchue** posée près d'elle lui en rend une partie. Elle n'en veut pas tant que la barre est presque pleine. Et ce n'est pas un repas : la langue ne compte pas pour l'apprivoisement, et l'attente avant le repas suivant repart de zéro.",
    "# Le réveil",
    "Le dernier repas avalé, elle se relève, apprivoisée. Elle choisit pour maître le joueur qui l'a le plus nourrie. Chaque coup qu'elle reçoit pendant son sommeil lui coûte un des cinq points de niveau qu'elle gagne en se réveillant à vos côtés."
  ],

  kangaroo: [
    "# Le matériel",
    "Avant de partir, il faut de quoi l'endormir : un **arc** et des **flèches tranquillisantes**, une **sarbacane de Maya** et ses **dards en bois tranquillisants**, ou bien un **lance-pierre primitif**. Prenez aussi de quoi la nourrir (ce qu'elle mange est listé plus haut, sous Nourriture acceptée).",
    "# Les premiers tirs",
    "Chaque tir qui fait mouche remplit sa **barre de somnolence**. Arrêtez-vous, et elle redescend d'elle-même : les tirs doivent s'enchaîner. Touchée, la créature réagit selon son caractère. Si elle peut vous atteindre, elle vous fonce dessus ; sinon, elle file et revient plus tard. Une créature paisible, elle, ne bronche pas.",
    "# La fuite",
    "Presque pleine, la barre lui fait perdre ses moyens : elle prend la fuite. Restez sur ses talons et continuez de tirer. Quand la barre est pleine, elle s'effondre et s'endort sur place.",
    "# Le sommeil",
    "Une fois endormie, les tranquillisants n'ont plus d'effet sur elle. Son sommeil s'use dès qu'elle touche le sol. S'il s'épuise avant la fin, elle se réveille et oublie tout ce que vous lui avez donné.",
    "# Les repas",
    "Lâchez sa nourriture au sol, tout près de sa gueule. Elle ne se jette pas dessus : avant chaque repas, elle laisse passer un moment, parfois vingt secondes, parfois plus d'une minute. Ensuite elle remarque ce qui traîne devant elle et l'avale, un morceau à la fois. Combien de repas faudra-t-il ? Ça dépend de l'individu.",
    "# Prolonger le sommeil",
    "Si sa barre de somnolence baisse trop, une **langue fourchue** posée près d'elle lui en rend une partie. Elle n'en veut pas tant que la barre est presque pleine. Et ce n'est pas un repas : la langue ne compte pas pour l'apprivoisement, et l'attente avant le repas suivant repart de zéro.",
    "# Le réveil",
    "Le dernier repas avalé, elle se relève, apprivoisée. Elle choisit pour maître le joueur qui l'a le plus nourrie. Chaque coup qu'elle reçoit pendant son sommeil lui coûte un des cinq points de niveau qu'elle gagne en se réveillant à vos côtés."
  ],

  red_panda: [
    "# Le matériel",
    "Avant de partir, il faut de quoi l'endormir : un **arc** et des **flèches tranquillisantes**, une **sarbacane de Maya** et ses **dards en bois tranquillisants**, ou bien un **lance-pierre primitif**. Prenez aussi de quoi la nourrir (ce qu'elle mange est listé plus haut, sous Nourriture acceptée).",
    "# Les premiers tirs",
    "Chaque tir qui fait mouche remplit sa **barre de somnolence**. Arrêtez-vous, et elle redescend d'elle-même : les tirs doivent s'enchaîner. Touchée, la créature réagit selon son caractère. Si elle peut vous atteindre, elle vous fonce dessus ; sinon, elle file et revient plus tard. Une créature paisible, elle, ne bronche pas.",
    "# La fuite",
    "Presque pleine, la barre lui fait perdre ses moyens : elle prend la fuite. Restez sur ses talons et continuez de tirer. Quand la barre est pleine, elle s'effondre et s'endort sur place.",
    "# Le sommeil",
    "Une fois endormie, les tranquillisants n'ont plus d'effet sur elle. Son sommeil s'use dès qu'elle touche le sol. S'il s'épuise avant la fin, elle se réveille et oublie tout ce que vous lui avez donné.",
    "# Les repas",
    "Lâchez sa nourriture au sol, tout près de sa gueule. Elle ne se jette pas dessus : avant chaque repas, elle laisse passer un moment, parfois vingt secondes, parfois plus d'une minute. Ensuite elle remarque ce qui traîne devant elle et l'avale, un morceau à la fois. Combien de repas faudra-t-il ? Ça dépend de l'individu.",
    "# Prolonger le sommeil",
    "Si sa barre de somnolence baisse trop, une **langue fourchue** posée près d'elle lui en rend une partie. Elle n'en veut pas tant que la barre est presque pleine. Et ce n'est pas un repas : la langue ne compte pas pour l'apprivoisement, et l'attente avant le repas suivant repart de zéro.",
    "# Le réveil",
    "Le dernier repas avalé, elle se relève, apprivoisée. Elle choisit pour maître le joueur qui l'a le plus nourrie. Chaque coup qu'elle reçoit pendant son sommeil lui coûte un des cinq points de niveau qu'elle gagne en se réveillant à vos côtés."
  ],

  gorilla: [
    "# Le matériel",
    "Avant de partir, il faut de quoi l'endormir : un **arc** et des **flèches tranquillisantes**, une **sarbacane de Maya** et ses **dards en bois tranquillisants**, ou bien un **lance-pierre primitif**. Prenez aussi de quoi la nourrir (ce qu'elle mange est listé plus haut, sous Nourriture acceptée).",
    "# Les premiers tirs",
    "Chaque tir qui fait mouche remplit sa **barre de somnolence**. Arrêtez-vous, et elle redescend d'elle-même : les tirs doivent s'enchaîner. Touchée, la créature réagit selon son caractère. Si elle peut vous atteindre, elle vous fonce dessus ; sinon, elle file et revient plus tard. Une créature paisible, elle, ne bronche pas.",
    "# La fuite",
    "Presque pleine, la barre lui fait perdre ses moyens : elle prend la fuite. Restez sur ses talons et continuez de tirer. Quand la barre est pleine, elle s'effondre et s'endort sur place.",
    "# Le sommeil",
    "Une fois endormie, les tranquillisants n'ont plus d'effet sur elle. Son sommeil s'use dès qu'elle touche le sol. S'il s'épuise avant la fin, elle se réveille et oublie tout ce que vous lui avez donné.",
    "# Les repas",
    "Lâchez sa nourriture au sol, tout près de sa gueule. Elle ne se jette pas dessus : avant chaque repas, elle laisse passer un moment, parfois vingt secondes, parfois plus d'une minute. Ensuite elle remarque ce qui traîne devant elle et l'avale, un morceau à la fois. Combien de repas faudra-t-il ? Ça dépend de l'individu.",
    "# Prolonger le sommeil",
    "Si sa barre de somnolence baisse trop, une **langue fourchue** posée près d'elle lui en rend une partie. Elle n'en veut pas tant que la barre est presque pleine. Et ce n'est pas un repas : la langue ne compte pas pour l'apprivoisement, et l'attente avant le repas suivant repart de zéro.",
    "# Le réveil",
    "Le dernier repas avalé, elle se relève, apprivoisée. Elle choisit pour maître le joueur qui l'a le plus nourrie. Chaque coup qu'elle reçoit pendant son sommeil lui coûte un des cinq points de niveau qu'elle gagne en se réveillant à vos côtés."
  ],

  hippopotamus: [
    "# Le matériel",
    "Avant de partir, il faut de quoi l'endormir : un **arc** et des **flèches tranquillisantes**, une **sarbacane de Maya** et ses **dards en bois tranquillisants**, ou bien un **lance-pierre primitif**. Prenez aussi de quoi la nourrir (ce qu'elle mange est listé plus haut, sous Nourriture acceptée).",
    "# Les premiers tirs",
    "Chaque tir qui fait mouche remplit sa **barre de somnolence**. Arrêtez-vous, et elle redescend d'elle-même : les tirs doivent s'enchaîner. Touchée, la créature réagit selon son caractère. Si elle peut vous atteindre, elle vous fonce dessus ; sinon, elle file et revient plus tard. Une créature paisible, elle, ne bronche pas.",
    "# La fuite",
    "Presque pleine, la barre lui fait perdre ses moyens : elle prend la fuite. Restez sur ses talons et continuez de tirer. Quand la barre est pleine, elle s'effondre et s'endort sur place.",
    "# Le sommeil",
    "Une fois endormie, les tranquillisants n'ont plus d'effet sur elle. Son sommeil s'use dès qu'elle touche le sol. S'il s'épuise avant la fin, elle se réveille et oublie tout ce que vous lui avez donné.",
    "# Les repas",
    "Lâchez sa nourriture au sol, tout près de sa gueule. Elle ne se jette pas dessus : avant chaque repas, elle laisse passer un moment, parfois vingt secondes, parfois plus d'une minute. Ensuite elle remarque ce qui traîne devant elle et l'avale, un morceau à la fois. Combien de repas faudra-t-il ? Ça dépend de l'individu.",
    "# Prolonger le sommeil",
    "Si sa barre de somnolence baisse trop, une **langue fourchue** posée près d'elle lui en rend une partie. Elle n'en veut pas tant que la barre est presque pleine. Et ce n'est pas un repas : la langue ne compte pas pour l'apprivoisement, et l'attente avant le repas suivant repart de zéro.",
    "# Le réveil",
    "Le dernier repas avalé, elle se relève, apprivoisée. Elle choisit pour maître le joueur qui l'a le plus nourrie. Chaque coup qu'elle reçoit pendant son sommeil lui coûte un des cinq points de niveau qu'elle gagne en se réveillant à vos côtés."
  ],

  lion: [
    "# Le matériel",
    "Avant de partir, il faut de quoi l'endormir : un **arc** et des **flèches tranquillisantes**, une **sarbacane de Maya** et ses **dards en bois tranquillisants**, ou bien un **lance-pierre primitif**. Prenez aussi de quoi la nourrir (ce qu'elle mange est listé plus haut, sous Nourriture acceptée).",
    "# Les premiers tirs",
    "Chaque tir qui fait mouche remplit sa **barre de somnolence**. Arrêtez-vous, et elle redescend d'elle-même : les tirs doivent s'enchaîner. Touchée, la créature réagit selon son caractère. Si elle peut vous atteindre, elle vous fonce dessus ; sinon, elle file et revient plus tard. Une créature paisible, elle, ne bronche pas.",
    "# La fuite",
    "Presque pleine, la barre lui fait perdre ses moyens : elle prend la fuite. Restez sur ses talons et continuez de tirer. Quand la barre est pleine, elle s'effondre et s'endort sur place.",
    "# Le sommeil",
    "Une fois endormie, les tranquillisants n'ont plus d'effet sur elle. Son sommeil s'use dès qu'elle touche le sol. S'il s'épuise avant la fin, elle se réveille et oublie tout ce que vous lui avez donné.",
    "# Les repas",
    "Lâchez sa nourriture au sol, tout près de sa gueule. Elle ne se jette pas dessus : avant chaque repas, elle laisse passer un moment, parfois vingt secondes, parfois plus d'une minute. Ensuite elle remarque ce qui traîne devant elle et l'avale, un morceau à la fois. Combien de repas faudra-t-il ? Ça dépend de l'individu.",
    "# Prolonger le sommeil",
    "Si sa barre de somnolence baisse trop, une **langue fourchue** posée près d'elle lui en rend une partie. Elle n'en veut pas tant que la barre est presque pleine. Et ce n'est pas un repas : la langue ne compte pas pour l'apprivoisement, et l'attente avant le repas suivant repart de zéro.",
    "# Le réveil",
    "Le dernier repas avalé, elle se relève, apprivoisée. Elle choisit pour maître le joueur qui l'a le plus nourrie. Chaque coup qu'elle reçoit pendant son sommeil lui coûte un des cinq points de niveau qu'elle gagne en se réveillant à vos côtés."
  ]

};
