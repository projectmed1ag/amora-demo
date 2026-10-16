import { renderCollectionLeisure } from './collection-leisure.js?v=leisure-detail-2';

const hotelURL = (city) => `./hotel.html?city=${encodeURIComponent(city)}`;

// Run after the published app renders so generated breadcrumbs use the same
// hotel-home route as the static header and footer.
export function enhanceCollectionPublish(page, city) {
  const entryURL = new URL('./', location.href);
  document.querySelectorAll('a[data-page-link]').forEach((link) => {
    const target = new URL(link.getAttribute('href'), location.href);
    if (target.pathname !== entryURL.pathname) return;
    link.setAttribute('href', './hotel.html' + target.search + target.hash);
  });

  if (page !== 'spaces' || city !== 'mozhaysk') return;

  const main = document.querySelector('#content');
  document.body.classList.add('collection-shell', 'mo-family-page', 'collection-leisure-page');
  main.innerHTML = renderCollectionLeisure();

  const detailTitle = main.querySelector('.cl-detail h1')?.textContent.replace(/\.$/, '');
  document.title = `${detailTitle || 'Досуг'} — Можайское водохранилище — A’MORE Collection`;
  document.querySelector('meta[name="description"]').content =
    'Семейный досуг в A’MORE Collection: велосипеды, теннис, мячи, зоопарк, детская зона и игры, прогулочные тропы, рыбалка, садовые парники, павильон для мероприятий, шашлычные зоны, ватрушки, каток и багги зимой.';

  document.querySelector('#site-menu a[href*="rooms.html"]').textContent = 'Дома';
  document.querySelector('.site-footer').classList.add('collection-footer');
  document.querySelector('.site-footer').innerHTML = `
    <a class="footer-wordmark" href="${hotelURL(city)}" aria-label="A’MORE Collection — на главную отеля">A’MORE <small>COLLECTION</small></a>
    <p class="collection-footer-location">Московская область,<br>Можайское водохранилище</p>
    <div class="collection-footer-message"><p>Там, где<br>хорошо быть вместе.</p><a href="./">Все отели →</a></div>`;

  // These sections are rendered by the module; restore native anchor behavior
  // for inbound activity links and the return link from a detail page.
  if (location.hash) {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); }
    catch { return; }
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }
}
