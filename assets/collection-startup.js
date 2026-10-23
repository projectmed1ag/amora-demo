/* Keep the static fallback out of the first paint while its collection
   enhancement and styles load. This classic script runs before the body parses. */
(() => {
  const root = document.documentElement;
  const startupScript = document.currentScript;
  const page = location.pathname.split('/').pop()?.replace(/\.html$/, '');
  const pages = new Set(['hotel', 'rooms', 'spaces', 'gallery', 'about', 'location', 'booking']);
  const cities = new Set(['mozhaysk', 'ruza', 'krasnoyarsk']);
  const aliases = { moscow: 'mozhaysk', petersburg: 'ruza' };
  const normalizeCity = value => cities.has(value) ? value : Object.hasOwn(aliases, value) ? aliases[value] : null;
  let savedCity;
  try { savedCity = localStorage.getItem('amore-destination'); }
  catch { /* Storage may be unavailable in private or restricted browsing. */ }
  const city = normalizeCity(new URLSearchParams(location.search).get('city')) || normalizeCity(savedCity) || 'mozhaysk';

  // Other destinations retain their original design and never need hiding.
  if (!pages.has(page) || city !== 'mozhaysk' || root.dataset.collectionStartup) return;
  root.dataset.collectionStartup = 'pending';

  const app = document.querySelector('script[data-collection-app]');
  const addedStyles = [];
  const removeListeners = [];
  let settled = false;
  let appLoaded = false;
  let fontStarted = false;
  let remainingStyles = 0;
  let watchdog;
  const isEnhanced = () => document.body?.classList.contains('collection-site-page');

  function listen(target, name, listener) {
    target.addEventListener(name, listener);
    removeListeners.push(() => target.removeEventListener(name, listener));
  }

  function finish(ready, reason) {
    if (settled) return;
    settled = true;
    clearTimeout(watchdog);
    removeListeners.forEach(remove => remove());
    // If enhancement failed before changing the DOM, restore its original
    // styling too. A partially enhanced page still needs its new styles.
    if (!ready && !isEnhanced()) addedStyles.forEach(link => link.remove());
    root.dataset.collectionStartupReason = reason;
    root.dataset.collectionStartup = ready ? 'ready' : 'fallback';
  }

  function checkReady() {
    if (settled || !appLoaded || remainingStyles !== 0) return;
    if (!isEnhanced()) {
      finish(false, 'enhancement-missing');
      return;
    }
    if (fontStarted) return;
    fontStarted = true;
    // Load only the heading face and its two used subsets, rather than waiting
    // for unrelated fonts or images. The watchdog also bounds this short wait.
    if (!document.fonts?.load) {
      finish(true, 'loaded');
      return;
    }
    try {
      document.fonts.load('400 16px Cormorant', 'A’MORE Отдых').then(
        () => finish(true, 'loaded'),
        () => finish(true, 'font-fallback'),
      );
    } catch {
      finish(true, 'font-fallback');
    }
  }

  if (!app || !startupScript?.src) {
    finish(false, 'script-missing');
    return;
  }

  listen(app, 'load', () => {
    appLoaded = true;
    checkReady();
  });
  listen(app, 'error', () => finish(false, 'app-error'));
  listen(window, 'error', () => finish(false, 'runtime-error'));
  watchdog = setTimeout(() => finish(false, 'timeout'), 15000);

  const styles = [
    ['collection-home-style', './collection-home.css?v=home-1'],
    ['collection-site-shell-style', './collection-site-shell.css?v=device-1'],
  ];
  if (page === 'rooms') styles.push(['collection-rooms-style', './collection-rooms.css?v=20261023-photo-response-3']);
  if (page === 'booking') styles.push(['collection-booking-style', './collection-booking.css?v=site-1']);
  if (page === 'gallery' || page === 'about') styles.push(['collection-editorial-style', './collection-editorial.css?v=about-1']);
  if (page === 'location' || page === 'spaces') styles.push(['collection-site-style', './collection-site.css?v=site-1']);
  if (page === 'spaces') styles.push(['collection-nearby-style', './collection-nearby.css?v=device-1']);

  // Install listeners before insertion: warm-cache stylesheet events may arrive
  // quickly. Reusing the enhancer IDs also prevents duplicate late CSS loads.
  const pendingLinks = [];
  for (const [id, file] of styles) {
    let link = document.getElementById(id);
    if (link?.sheet) continue;
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = new URL(file, startupScript.src).href;
      link.setAttribute('blocking', 'render');
      addedStyles.push(link);
      pendingLinks.push(link);
    }
    remainingStyles += 1;
    let loaded = false;
    listen(link, 'load', () => {
      if (loaded) return;
      loaded = true;
      remainingStyles -= 1;
      checkReady();
    });
    listen(link, 'error', () => finish(false, 'stylesheet-error'));
  }
  pendingLinks.forEach(link => {
    if (!settled) document.head.append(link);
  });
})();
