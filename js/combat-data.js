/* Les donnees de combat que l'export du mod ne transporte pas encore,
   partagees par le simulateur (js/simulator.js) et le guide (js/guide.js).

   comboTicks      la duree d'un coup de combo, en ticks : le premier argument
                   de createCombo() dans la classe de chaque bete. Le kangourou
                   frappe en 20, 20 puis 35 ticks : 25 en moyenne. Les
                   berserkers (kodiak, orque, gorille) frappent 30 % plus vite
                   sous 25 % de PV, ce qui n'est pas compte.
   comboHits       un combo, ce sont trois coups (MAX_ATTACKS_IN_COMBO).
   energyFallback  la reserve d'energie vitale quand l'export ne la fige pas :
                   celle du tigre depend de l'heure (300 le jour, 400 la nuit),
                   on retient celle du jour.
   harvest         ce qu'une bete recolte hors combat. L'elephant, en chargeant,
                   abat l'arbre entier (ElephantEntity.fellTree : jusqu'a 40
                   buches dans un rayon de 8 blocs) ; chaque buche tombe, et une
                   seconde la suit une fois sur deux (CHARGE_LOG_BONUS_CHANCE) :
                   +50 % de bois en moyenne. */

(function (OW) {
  'use strict';

  OW.COMBAT_DATA = {
    comboTicks: { tiger: 16, kodiak: 20, crocodile: 32, boa: 16, orca: 28, elephant: 28, kangaroo: 25, gorilla: 18, hippopotamus: 22, lion: 16 },
    defaultComboTicks: 20,
    comboHits: 3,
    energyFallback: { tiger: 300 },
    harvest: {
      elephant: { resource: 'wood', name: 'Bois (bûches)', icon: 'assets/block/redwood_log.png', bonus: 0.5, maxLogs: 40 }
    }
  };
}(window.OW = window.OW || {}));
