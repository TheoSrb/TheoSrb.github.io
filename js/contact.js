/* Le formulaire de contact de la page Communaute (Netlify Forms).

   Le formulaire est ecrit en dur dans community.html : c'est la que Netlify le
   detecte au deploiement. Ce script le rend vivant sans le remplacer :
   - la jauge d'apprivoisement se remplit a mesure que le message s'etoffe ;
   - les champs mal remplis tremblent et disent pourquoi ;
   - l'envoi part en arriere-plan (fetch), l'enveloppe s'envole dans la boite,
     le drapeau se leve, et un recu tamponne prend la place du formulaire.
   Les messages arrivent dans le tableau de bord Netlify (Forms) et, si la
   notification est reglee, a operationwteam@gmail.com. */

(function () {
  'use strict';

  const MIN = 20;          /* caracteres minimum du message */
  const FULL = 160;        /* la jauge est pleine a partir d'ici */
  const STAGES = [
    [0, 'SAUVAGE'], [.25, 'MÉFIANT'], [.6, 'CURIEUX'], [1, 'APPRIVOISÉ !']
  ];

  function init() {
    const root = document.querySelector('[data-contact]');
    if (!root) return;
    const form = root.querySelector('[data-ct-form]');
    const done = root.querySelector('[data-ct-done]');
    const message = form.querySelector('[data-ct-message]');
    const tame = form.querySelector('[data-ct-tame]');
    const tameLabel = form.querySelector('[data-ct-tame-label]');
    const send = form.querySelector('[data-ct-send]');
    const sendLabel = form.querySelector('[data-ct-send-label]');
    const fail = form.querySelector('[data-ct-fail]');

    /* La jauge : la longueur du message, jusqu'a FULL caracteres. */
    const gauge = () => {
      const p = Math.min(1, message.value.trim().length / FULL);
      tame.style.setProperty('--p', p.toFixed(3));
      let label = STAGES[0][1];
      STAGES.forEach(([at, text]) => { if (p >= at) label = text; });
      if (tameLabel.textContent !== label) {
        tameLabel.textContent = label;
        tameLabel.classList.remove('is-bump');
        void tameLabel.offsetWidth;
        tameLabel.classList.add('is-bump');
      }
      root.classList.toggle('is-tamed', p >= 1);
    };
    message.addEventListener('input', gauge);
    gauge();

    const valid = (el) => {
      if (el.name === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim());
      if (el.name === 'message') return el.value.trim().length >= MIN;
      if (el.required) return el.value.trim().length > 0;
      return true;
    };
    const mark = (el, ok) => {
      const field = el.closest('.ct-field');
      if (!field) return;
      field.classList.toggle('is-bad', !ok);
      if (!ok) {
        field.classList.remove('is-shake');
        void field.offsetWidth;
        field.classList.add('is-shake');
      }
    };
    form.querySelectorAll('[data-ct-input]').forEach((el) => {
      el.addEventListener('blur', () => { if (el.value) mark(el, valid(el)); });
      el.addEventListener('input', () => {
        const field = el.closest('.ct-field');
        if (field && field.classList.contains('is-bad') && valid(el)) field.classList.remove('is-bad');
      });
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      fail.hidden = true;
      let first = null;
      form.querySelectorAll('[data-ct-input]').forEach((el) => {
        const ok = valid(el);
        mark(el, ok);
        if (!ok && !first) first = el;
      });
      if (first) { first.focus(); return; }

      send.disabled = true;
      sendLabel.textContent = 'Envoi en cours…';
      root.classList.add('is-sending');

      const body = new URLSearchParams(new FormData(form)).toString();
      const flight = new Promise((r) => setTimeout(r, 1100));
      fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
        .then((res) => { if (!res.ok) throw new Error(res.status); return flight; })
        .then(() => {
          root.classList.remove('is-sending');
          root.classList.add('is-sent');
          form.hidden = true;
          done.hidden = false;
        })
        .catch(() => {
          root.classList.remove('is-sending');
          fail.hidden = false;
        })
        .finally(() => {
          send.disabled = false;
          sendLabel.textContent = 'Envoyer le message';
        });
    });

    root.querySelector('[data-ct-again]').addEventListener('click', () => {
      form.reset();
      gauge();
      root.classList.remove('is-sent');
      done.hidden = true;
      form.hidden = false;
      form.querySelector('[name="email"]').focus();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
