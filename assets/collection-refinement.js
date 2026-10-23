// Shared progressive enhancements. Content, ordinary links and the locked
// A’MORE artwork remain usable without this module.
import { createScreenSwitcher } from './collection-screen-switcher.js?v=20261023-mobile-swipe-1';
import { initHeadingFormat } from './collection-heading-format.js?v=20261023-local-nav-restored-1';

const headerSelector = '.home-header, .site-header';
const cityNames = new Set(['mozhaysk', 'ruza', 'krasnoyarsk']);

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

function closeMobileMenu(header) {
  if (!header) return;
  const toggle = header.querySelector('.home-menu-toggle');
  if (toggle?.checked) {
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const button = header.querySelector('.menu-toggle[aria-expanded="true"], button.home-menu[aria-expanded="true"]');
  button?.click();
}

const primarySections = [
  ['home-hero', 'home', 'Начало'],
  ['home-stays', 'stays', 'Хаусботы'],
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

function createArrow(direction) {
  const link = document.createElement('a');
  link.className = `section-navigation-arrow section-navigation-${direction}`;
  link.dataset.sectionDirection = direction;
  link.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
  return link;
}

function initializeRefinement() {
  let header = document.querySelector(headerSelector);
  addBookingLink(header);
  const home = document.body.dataset.page === 'home';
  const main = home ? document.querySelector('#content') : null;
  let navigation;
  let list;
  let label;
  let position;
  let currentNumber;
  let totalNumber;
  let previous;
  let next;
  let targets = [];
  let links = [];
  let active = -1;
  let frame = 0;
  let headerBottom = -1;
  let rebuildPending = false;
  let pointLayoutKey = '';

  const number = value => String(value).padStart(2, '0');
  const sectionScroller = main ? createScreenSwitcher({
    main,
    getTargets: () => targets.map(target => target.element),
    getOffset: () => Math.max(0, header?.getBoundingClientRect().bottom || 0),
    onUpdate: scheduleRefresh,
  }) : null;

  function updateControl(control, index, disabled) {
    const target = targets[index];
    control.href = `#${target.element.id}`;
    control.setAttribute('aria-label', `${control === previous ? 'Предыдущий' : 'Следующий'} раздел: ${target.label}`);
    if (disabled) {
      control.setAttribute('aria-disabled', 'true');
      control.tabIndex = -1;
    } else {
      control.removeAttribute('aria-disabled');
      control.removeAttribute('tabindex');
    }
  }

  function setActive(index) {
    if (index === active || !targets[index]) return;
    active = index;
    links.forEach((link, i) => {
      if (i === index) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    label.textContent = targets[index].label;
    currentNumber.textContent = String(index + 1);
    totalNumber.textContent = String(targets.length);
    position.setAttribute('aria-label', `Раздел ${index + 1} из ${targets.length}`);
    navigation.dataset.currentSection = targets[index].element.id;
    updateControl(previous, Math.max(0, index - 1), index === 0);
    updateControl(next, Math.min(targets.length - 1, index + 1), index === targets.length - 1);
  }

  function positionChapterPoints() {
    if (!navigation || active < 0 || !links.length) return;
    // Keep the active point at the centre of the arc, as on the reference.
    // Other chapters rotate around it; offscreen points leave the tab order.
    const radius = Math.max(60, Math.min(180,
      (window.innerHeight / 2 - headerBottom - 40) / Math.sin(Math.PI / 3)));
    const key = `${active}:${links.length}:${radius}`;
    if (key === pointLayoutKey) return;
    pointLayoutKey = key;
    links.forEach((link, index) => {
      let offset = (index - active + links.length) % links.length;
      if (offset > links.length / 2) offset -= links.length;
      const angle = offset * Math.PI / 6;
      const item = link.parentElement;
      const visible = Math.abs(offset) <= 2;
      item.style.setProperty('--section-point-x', `${(124 * Math.cos(angle)).toFixed(2)}px`);
      item.style.setProperty('--section-point-y', `${(radius * Math.sin(angle)).toFixed(2)}px`);
      item.classList.toggle('is-visible', visible);
      if (visible) {
        item.removeAttribute('aria-hidden');
        link.removeAttribute('tabindex');
      } else {
        item.setAttribute('aria-hidden', 'true');
        link.tabIndex = -1;
      }
    });
  }

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
    if (!targets.length) return;
    // The scene controller owns selection while it changes between chapters.
    const marker = Math.max(headerBottom + 16, window.innerHeight * .3);
    let index = 0;
    targets.forEach((target, i) => {
      if (target.element.getBoundingClientRect().top <= marker) index = i;
    });
    const documentHeight = document.documentElement.scrollHeight;
    if (window.scrollY > 0 && window.scrollY + window.innerHeight >= documentHeight - 2) {
      index = targets.length - 1;
    }
    if (window.scrollY < 2) index = 0;
    const selected = sectionScroller?.getCurrentTarget();
    const selectedIndex = targets.findIndex(target => target.element === selected);
    if (selectedIndex >= 0) index = selectedIndex;
    setActive(index);
    positionChapterPoints();
  }

  function scheduleRefresh() {
    if (!frame) frame = requestAnimationFrame(refresh);
  }

  function ensureNavigation() {
    if (navigation) return;
    navigation = document.createElement('nav');
    navigation.className = 'section-navigation';
    navigation.setAttribute('aria-label', 'Разделы главной страницы');
    list = document.createElement('ol');
    list.className = 'section-navigation-list';
    label = document.createElement('span');
    label.className = 'section-navigation-current';
    position = document.createElement('span');
    position.className = 'section-navigation-position';
    currentNumber = document.createElement('span');
    currentNumber.className = 'section-navigation-index';
    const divider = document.createElement('span');
    divider.className = 'section-navigation-divider';
    divider.textContent = '/';
    divider.setAttribute('aria-hidden', 'true');
    totalNumber = document.createElement('span');
    totalNumber.className = 'section-navigation-total';
    position.append(currentNumber, divider, totalNumber);
    previous = createArrow('previous');
    next = createArrow('next');
    navigation.append(list, previous, label, position, next);
    navigation.addEventListener('click', event => {
      const link = event.target.closest('a');
      if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (link.getAttribute('aria-disabled') === 'true') {
        event.preventDefault();
        return;
      }
      let id;
      try { id = decodeURIComponent(new URL(link.href).hash.slice(1)); } catch { return; }
      const target = document.getElementById(id);
      if (!target || !sectionScroller) return;
      event.preventDefault();
      closeMobileMenu(header);
      sectionScroller.navigateTo(target);
    });
    document.body.append(navigation);
  }

  function rebuildNavigation() {
    rebuildPending = false;
    sectionScroller?.cancel();
    const sections = [...main.children].filter(element => element.tagName === 'SECTION');
    if (!sections.length) {
      if (navigation) navigation.hidden = true;
      targets = [];
      return;
    }
    const definitions = sections.some(section => section.classList.contains('home-hero'))
      ? primarySections : destinationSections;
    targets = sections.map((element, index) => {
      const definition = definitions === primarySections
        ? primarySections.find(([className]) => element.classList.contains(className))
        : definitions[index];
      const title = element.querySelector('h1, h2')?.textContent.trim().replace(/\s+/g, ' ').replace(/\.$/, '');
      const slug = definition?.[1] || `chapter-${index + 1}`;
      if (!element.id) {
        let id = `section-${slug}`;
        let suffix = 2;
        while (document.getElementById(id)) id = `section-${slug}-${suffix++}`;
        element.id = id;
      }
      element.classList.add('section-navigation-target');
      if (!element.hasAttribute('tabindex')) element.tabIndex = -1;
      return { element, label: element.dataset.sectionLabel || definition?.[2] || title || `Раздел ${index + 1}` };
    });
    ensureNavigation();
    navigation.hidden = false;
    links = targets.map(({ element, label: text }, index) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'section-navigation-link';
      link.href = `#${element.id}`;
      link.setAttribute('aria-label', `Раздел ${index + 1}: ${text}`);
      const numeral = document.createElement('span');
      numeral.className = 'section-navigation-number';
      numeral.textContent = number(index + 1);
      numeral.setAttribute('aria-hidden', 'true');
      const title = document.createElement('span');
      title.textContent = text;
      link.append(numeral, title);
      item.append(link);
      return { item, link };
    });
    list.replaceChildren(...links.map(({ item }) => item));
    links = links.map(({ link }) => link);
    active = -1;
    pointLayoutKey = '';
    sectionScroller?.syncTargets();
    refresh();
    sectionScroller?.alignInitialHash();
  }

  if (main) {
    rebuildNavigation();
    new MutationObserver(() => {
      if (rebuildPending) return;
      rebuildPending = true;
      queueMicrotask(rebuildNavigation);
    }).observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-section-label'] });
  }
  window.addEventListener('scroll', scheduleRefresh, { passive: true });
  window.addEventListener('resize', scheduleRefresh, { passive: true });
  window.addEventListener('hashchange', scheduleRefresh);
  window.addEventListener('pageshow', scheduleRefresh);
  document.fonts?.ready.then(scheduleRefresh);
  if (header && 'ResizeObserver' in window) new ResizeObserver(scheduleRefresh).observe(header);
  scheduleRefresh();
  initHeadingFormat();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeRefinement, { once: true });
} else {
  queueMicrotask(initializeRefinement);
}
