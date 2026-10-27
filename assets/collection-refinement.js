// Shared progressive enhancements. Content, ordinary links and the locked
// A’MORE artwork remain usable without this module.
import { createHomeScroller } from './collection-home-scroll.js?v=20261027-native-home-scroll-1';
import { initPageNavigation } from './collection-page-navigation.js?v=20261027-mobile-carousel-1';
import { initHeadingFormat } from './collection-heading-format.js?v=20261023-local-nav-restored-1';
import { collectionDestinations, getDestination } from './collection-destinations.js?v=20261024-all-hotels-1';

const headerSelector = '.home-header, .site-header';
const cityNames = new Set(Object.keys(collectionDestinations));

function addBookingLink(header) {
  if (!header || header.querySelector('a[href*="booking.html"], [data-service-booking-link]')) return;
  // Legacy destination headers already own their booking control.
  if (!header.classList.contains('home-header')) return;
  const source = header.querySelector('a[href*="rooms.html"], a[href*="hotel.html"]');
  if (!source) return;
  const destination = new URL(source.href, location.href);
  destination.pathname = destination.pathname.replace(/[^/]*$/, 'booking.html');
  destination.hash = '';
  const city = document.documentElement.dataset.city || new URL(location.href).searchParams.get('city');
  if (cityNames.has(city)) destination.searchParams.set('city', city);
  const link = document.createElement('a');
  link.className = 'refine-booking';
  link.href = destination.href;
  link.textContent = 'Забронировать';
  (header.querySelector('.home-header-end') || header).prepend(link);
}

const primarySections = [
  ['home-hero', 'home', 'Начало'],
  ['home-stays', 'stays', getDestination().stayPlural],
  ['home-restaurant', 'restaurant', 'Ресторан'],
  ['home-banya', 'banya', 'Баня'],
  ['home-leisure', 'leisure', 'Развлечения и активный отдых'],
];
const destinationSections = [
  ['hero', 'home', 'Начало'],
  ['editorial-wide', 'stays', 'Номера'],
  ['editorial-detail', 'details', 'Детали'],
  ['editorial-wide', 'leisure', 'Развлечения и активный отдых'],
  ['editorial-ritual', 'walks', 'Прогулки'],
  ['panorama', 'place', 'О месте'],
  ['closing', 'evening', 'Костровая зона'],
];

function initializeRefinement() {
  let header = document.querySelector(headerSelector);
  addBookingLink(header);
  const home = document.body.dataset.page === 'home';
  const main = home ? document.querySelector('#content') : null;
  let targets = [];
  let frame = 0;
  let headerBottom = -1;
  let rebuildPending = false;

  const sectionScroller = main ? createHomeScroller({
    main,
    getTargets: () => targets.map(target => target.element),
    getOffset: () => Math.max(0, header?.getBoundingClientRect().bottom || 0),
    onUpdate: scheduleRefresh,
  }) : null;

  function refresh() {
    frame = 0;
    if (!header?.isConnected) {
      header = document.querySelector(headerSelector);
      addBookingLink(header);
    }
    header?.classList.toggle('is-scrolled', window.scrollY > 16);
    const bottom = Math.max(0, Math.round(header?.getBoundingClientRect().bottom || 0));
    if (bottom !== headerBottom) {
      headerBottom = bottom;
      document.documentElement.style.setProperty('--section-header-bottom', `${bottom}px`);
    }
  }

  function scheduleRefresh() {
    if (!frame) frame = requestAnimationFrame(refresh);
  }

  function rebuildHomeTargets() {
    rebuildPending = false;
    sectionScroller?.cancel();
    const sections = [...main.children].filter(element => element.tagName === 'SECTION');
    if (!sections.length) {
      targets = [];
      return;
    }
    const definitions = sections.some(section => section.classList.contains('home-hero'))
      ? primarySections : destinationSections;
    targets = sections.map((element, index) => {
      const definition = definitions === primarySections
        ? primarySections.find(([className]) => element.classList.contains(className))
        : definitions[index];
      const slug = definition?.[1] || `chapter-${index + 1}`;
      if (!element.id) {
        let id = `section-${slug}`;
        let suffix = 2;
        while (document.getElementById(id)) id = `section-${slug}-${suffix++}`;
        element.id = id;
      }
      element.classList.add('section-navigation-target');
      if (!element.hasAttribute('tabindex')) element.tabIndex = -1;
      return { element };
    });
    sectionScroller?.syncTargets();
    refresh();
    sectionScroller?.alignInitialHash();
  }

  if (main) {
    rebuildHomeTargets();
    new MutationObserver(() => {
      if (rebuildPending) return;
      rebuildPending = true;
      queueMicrotask(rebuildHomeTargets);
    }).observe(main, { childList: true });
  }
  window.addEventListener('scroll', scheduleRefresh, { passive: true });
  window.addEventListener('resize', scheduleRefresh, { passive: true });
  window.addEventListener('hashchange', scheduleRefresh);
  window.addEventListener('pageshow', scheduleRefresh);
  document.fonts?.ready.then(scheduleRefresh);
  if (header && 'ResizeObserver' in window) new ResizeObserver(scheduleRefresh).observe(header);
  scheduleRefresh();
  initPageNavigation();
  initHeadingFormat();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeRefinement, { once: true });
} else {
  queueMicrotask(initializeRefinement);
}
