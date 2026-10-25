import { initCollectionMotion } from './collection-motion.js?v=20261025-progressive-photos-1';
import { initHeadingFormat } from './collection-heading-format.js?v=20261023-local-nav-restored-1';

// Bind controls to the HTML that is already visible. No page shell or primary
// content is generated here, and ordinary links retain native navigation.
initCollectionMotion();
initHeadingFormat();
const header = document.querySelector('.home-header');
const toggle = header?.querySelector('.home-menu-toggle');
const nav = header?.querySelector('.home-nav');
if (toggle && nav) {
  const sync = () => {
    header.classList.toggle('menu-open', toggle.checked);
    toggle.setAttribute('aria-label', toggle.checked ? 'Закрыть меню' : 'Меню разделов');
  };
  const close = () => { toggle.checked = false; sync(); };
  toggle.addEventListener('change', sync);
  nav.addEventListener('click', event => { if (event.target.closest('a')) close(); });
  document.addEventListener('click', event => { if (!header.contains(event.target)) close(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.checked) { close(); toggle.focus(); }
  });
  header.addEventListener('focusout', event => { if (event.relatedTarget && !header.contains(event.relatedTarget)) close(); });
  matchMedia('(min-width: 1400px)').addEventListener('change', close);
  sync();
}

const page = document.body.dataset.page;

function initializeNearbyOnApproach(section) {
  let pending;
  let observer;
  const cleanup = () => {
    observer?.disconnect();
    section.removeEventListener('click', onClick, true);
    section.removeEventListener('focusin', load);
    window.removeEventListener('hashchange', onHashChange);
  };
  function load() {
    if (section.dataset.initialized) return Promise.resolve();
    if (!pending) {
      pending = import('./collection-nearby.js?v=20261025-sharp-gallery-1')
        .then(({ enhanceNearbyPlaces }) => {
          enhanceNearbyPlaces(section);
          if (section.dataset.initialized) cleanup();
        })
        .catch(error => {
          pending = undefined;
          console.warn('Не удалось подключить карту. Описания мест и ссылки доступны.', error);
        });
    }
    return pending;
  }
  function onClick(event) {
    const button = event.target.closest('[data-nearby-place], [data-nearby-retry]');
    if (!button || section.dataset.initialized) return;
    event.preventDefault();
    // A first click must still select its place while the optional controller
    // is downloading, including keyboard activation and a fast anchor jump.
    void load().then(() => {
      if (section.dataset.initialized && button.isConnected) button.click();
    });
  }
  function onHashChange() {
    let target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
    if (target && section.contains(target)) void load();
  }
  section.addEventListener('click', onClick, true);
  section.addEventListener('focusin', load);
  window.addEventListener('hashchange', onHashChange);
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void load();
    }, { rootMargin: '600px 0px' });
    observer.observe(section);
  } else void load();
  if (new URLSearchParams(location.search).has('place')) void load();
  else onHashChange();
}

try {
  if (page === 'rooms' || page === 'gallery') {
    const { initCollectionPhotos } = await import('./collection-photo-runtime.js?v=20261025-progressive-photos-1');
    initCollectionPhotos(page);
  } else if (page === 'booking') {
    const { initCollectionBooking } = await import('./collection-booking-runtime.js?v=20261025-progressive-photos-1');
    initCollectionBooking();
  } else if (['spaces', 'location'].includes(page) && document.querySelector('#nearby [data-nearby-place]')) {
    initializeNearbyOnApproach(document.querySelector('#nearby'));
  }
  document.documentElement.dataset.collectionInteractive = 'ready';
} catch (error) {
  // Content, image links and native menu remain available if an optional
  // controller cannot be downloaded. Never conceal the page on failure.
  document.documentElement.dataset.collectionInteractive = 'unavailable';
  console.warn('Не удалось подключить дополнительные элементы страницы.', error);
}
