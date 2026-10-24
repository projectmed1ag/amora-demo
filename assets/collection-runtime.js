import { initCollectionMotion } from './collection-motion.js?v=static-1';
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
try {
  if (page === 'rooms' || page === 'gallery') {
    const { initCollectionPhotos } = await import('./collection-photo-runtime.js?v=20261024-image-load-1');
    initCollectionPhotos(page);
  } else if (page === 'booking') {
    const { initCollectionBooking } = await import('./collection-booking-runtime.js?v=20261024-image-load-1');
    initCollectionBooking();
  } else if (['spaces', 'location'].includes(page) && document.querySelector('#nearby [data-nearby-place]')) {
    const { enhanceNearbyPlaces } = await import('./collection-nearby.js?v=20261024-image-load-1');
    enhanceNearbyPlaces(document.querySelector('#nearby'));
  }
  document.documentElement.dataset.collectionInteractive = 'ready';
} catch (error) {
  // Content, image links and native menu remain available if an optional
  // controller cannot be downloaded. Never conceal the page on failure.
  document.documentElement.dataset.collectionInteractive = 'unavailable';
  console.warn('Не удалось подключить дополнительные элементы страницы.', error);
}
