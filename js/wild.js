/* Le style de l'accueil sur les autres pages : ce qui ne se fait pas en CSS.

   Les compteurs (cosmetiques, telechargement) deviennent des panneaux de bois
   suspendus ; ils se balancent et la souris les pousse, comme les chiffres de
   l'accueil. Ils sont construits par chaque page une fois ses donnees lues :
   on attend qu'ils apparaissent pour les suspendre. */

(function (OW) {
  'use strict';

  const hung = new WeakSet();

  function hang() {
    if (!OW.swing) return;
    document.querySelectorAll('main .counters').forEach((host) => {
      if (hung.has(host) || !host.querySelector('.counter')) return;
      hung.add(host);
      OW.swing(host, '.counter');
    });
  }

  hang();
  new MutationObserver(hang).observe(document.body, { childList: true, subtree: true });

  /**
   * Les chiffres d'une page, suspendus sous son intro comme ceux de l'accueil.
   * L'intro reste : les panneaux en reprennent les nombres, en plus grand. Le
   * compteur part de zero et atteint sa valeur en une seconde.
   */
  OW.heroSigns = function (anchor, entries) {
    if (!anchor) return;
    const esc = OW.escapeHtml || ((v) => String(v));
    const row = document.createElement('div');
    row.className = 'counters hero-signs';
    row.innerHTML = entries.map(([value, key]) =>
      '<div class="counter"><div class="value">' + esc(value) + '</div><div class="key">' + esc(key) + '</div></div>'
    ).join('');
    anchor.after(row);
    if (OW.countUp) row.querySelectorAll('.value').forEach((v) => OW.countUp(v, 250, 1000));
  };
}(window.OW = window.OW || {}));
