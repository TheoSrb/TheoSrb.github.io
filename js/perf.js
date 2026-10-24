/* La qualite des effets, adaptee a la machine.

   Le site est dessine pour une machine capable : decor anime, verre flou,
   particules lumineuses, parallaxe. Sur un telephone modeste ou un vieux PC,
   ce meme decor faisait tomber la page a quelques images par seconde.

   Deux niveaux :
     full  le site tel qu'il est dessine (par defaut sur une machine capable) ;
     lite  memes pages, memes positions, memes couleurs — mais sans flou de
           verre (les panneaux deviennent un peu plus opaques a la place),
           moitie moins de particules et sans halo, decor fixe dans les
           vignettes, pas de parallaxe a la souris.

   Choix du niveau, dans l'ordre :
     1. le choix du visiteur (menu Langue & affichage), garde dans localStorage ;
     2. sinon les indices materiels : tres peu de memoire ou de coeurs, ou
        l'economie de donnees activee.
   Le script de tete de chaque page applique le niveau connu avant le premier
   rendu : pas de bascule visible. */

(function (OW) {
  'use strict';

  const KEY = 'ow-perf';          /* choix du visiteur : auto | full | lite */
  const root = document.documentElement;

  const read = (k) => { try { return window.localStorage.getItem(k); } catch (e) { return null; } };
  const write = (k, v) => { try { window.localStorage.setItem(k, v); } catch (e) { /* rien */ } };

  /* Seules les machines vraiment modestes passent en allege : peu de memoire,
     peu de coeurs, ou l'economie de donnees demandee. Pas de mesure d'images
     par seconde : elle se trompait sur un onglet simplement occupe, et
     degradait le rendu d'une machine capable. */
  function hints() {
    const nav = navigator;
    const conn = nav.connection || {};
    if (conn.saveData) return 'lite';
    if (nav.deviceMemory && nav.deviceMemory <= 2) return 'lite';
    if (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) return 'lite';
    return null;
  }

  function choice() {
    const v = read(KEY);
    return v === 'full' || v === 'lite' ? v : 'auto';
  }

  function resolved() {
    const c = choice();
    if (c !== 'auto') return c;
    return hints() || 'full';
  }

  function apply(level) {
    if (root.getAttribute('data-perf') === level) return;
    root.setAttribute('data-perf', level);
    document.dispatchEvent(new CustomEvent('ow:perf', { detail: { level } }));
  }

  try { window.localStorage.removeItem('ow-perf-auto'); } catch (e) { /* rien */ }
  apply(resolved());

  /** Le choix du visiteur : 'auto', 'full' ou 'lite'. */
  function setPerf(value) {
    const v = value === 'full' || value === 'lite' ? value : 'auto';
    write(KEY, v);
    apply(resolved());
  }

  OW.perf = {
    get level() { return root.getAttribute('data-perf') || 'full'; },
    get choice() { return choice(); },
    get detected() { return hints() || 'full'; },
    lite: () => root.getAttribute('data-perf') === 'lite',
    set: setPerf
  };
}(window.OW = window.OW || {}));
