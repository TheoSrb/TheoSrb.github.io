/* Theme switch.

   The previous implementation walked every element on the page and rewrote its
   inline `style` attribute, remapping hex values one property at a time — it had
   to guess whether #0E120E was a background or a border, it missed React
   re-renders, and it ran a MutationObserver plus a 600ms interval forever.

   The stylesheet now resolves every colour through a token, so switching themes
   is one attribute on <html>. */

(function (OW) {
  'use strict';

  const STORAGE_KEY = 'ow-theme';
  const THEMES = ['dark', 'light'];

  function storedTheme() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (THEMES.indexOf(saved) !== -1) return saved;
    } catch (err) {
      /* private mode or blocked storage: fall through to the default */
    }
    return 'dark';
  }

  function applyTheme(theme) {
    const next = THEMES.indexOf(theme) !== -1 ? theme : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (err) {
      /* nothing to do: the theme still applies for this page load */
    }
    document.dispatchEvent(new CustomEvent('ow:themechange', { detail: { theme: next } }));
    return next;
  }

  function toggleTheme() {
    return applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  Object.assign(OW, { storedTheme, applyTheme, toggleTheme, currentTheme });
}(window.OW = window.OW || {}));
