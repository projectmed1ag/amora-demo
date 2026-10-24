import { enhanceCollectionRooms } from './collection-rooms.js?v=20261025-first-photo-2';
import { enhanceCollectionHome } from './collection-home.js?v=20261025-first-photo-2';
import { enhanceCollectionBooking } from './collection-booking.js?v=20261025-first-photo-2';
import { enhanceCollectionEditorial } from './collection-editorial.js?v=20261025-first-photo-2';
import { enhanceCollectionLocation, enhanceCollectionSpaces } from './collection-site.js?v=20261025-first-photo-2';

// Run after the published app renders so generated breadcrumbs use the same
// hotel-home route as the static header and footer.
export function enhanceCollectionPublish(page, city) {
  // A failed/expired startup keeps the usable legacy page stable. Do not
  // replace it later if a delayed module eventually finishes downloading.
  if (document.documentElement.dataset.collectionStartup === 'fallback') return;

  const entryURL = new URL('./', location.href);
  document.querySelectorAll('a[data-page-link]').forEach((link) => {
    const target = new URL(link.getAttribute('href'), location.href);
    if (target.pathname !== entryURL.pathname) return;
    link.setAttribute('href', './hotel.html' + target.search + target.hash);
  });

  if (page === 'home' && city === 'mozhaysk') {
    enhanceCollectionHome();
    return;
  }

  if (page === 'rooms' && city === 'mozhaysk') {
    enhanceCollectionRooms();
    return;
  }

  if (page === 'booking' && city === 'mozhaysk') { enhanceCollectionBooking(); return; }
  if (page === 'location' && city === 'mozhaysk') { enhanceCollectionLocation(); return; }
  if (page === 'gallery' || page === 'about') { if (enhanceCollectionEditorial(page, city)) return; }
  if (page === 'spaces' && city === 'mozhaysk') enhanceCollectionSpaces();
}
