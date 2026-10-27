import { destinationURL, getDestination } from './collection-destinations.js?v=20261024-all-hotels-1';

const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
const services = { restaurant: 'restaurant', banya: 'banya', pavilion: 'pavilions' };

export function initPageNavigation() {
  const page = document.body.dataset.page;
  const destination = getDestination();
  const pages = [
    { id: 'home', file: 'hotel.html', label: 'Главная' },
    { id: 'rooms', file: 'rooms.html', label: destination.stayPlural },
    { id: 'restaurant', file: 'restaurant.html', label: 'Ресторан' },
    { id: 'banya', file: 'banya.html', label: 'Баня' },
    { id: 'pavilions', file: 'pavilions.html', label: 'Аренда павильонов' },
    { id: 'spaces', file: 'spaces.html', label: 'Развлечения' },
    { id: 'about', file: 'about.html', label: 'Об отеле' },
  ];
  const footer = document.querySelector('.home-footer, .site-footer');
  if (!page || !footer) return;
  const navigation = document.createElement('nav');
  navigation.className = 'section-navigation page-navigation';
  navigation.setAttribute('aria-label', 'Страницы отеля');
  const previous = document.createElement('a');
  previous.className = 'section-navigation-arrow section-navigation-previous';
  previous.rel = 'prev';
  previous.innerHTML = arrow;
  const label = document.createElement('span');
  label.className = 'section-navigation-current';
  label.setAttribute('aria-current', 'page');
  const links = document.createElement('ul');
  links.className = 'page-navigation-links';
  const pageLinks = pages.map(item => {
    const entry = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'page-navigation-link';
    link.dataset.pageDestination = item.id;
    link.textContent = item.label;
    entry.append(link);
    links.append(entry);
    return link;
  });
  const position = document.createElement('span');
  position.className = 'section-navigation-position';
  const current = document.createElement('span');
  current.className = 'section-navigation-index';
  const divider = document.createElement('span');
  divider.className = 'section-navigation-divider';
  divider.textContent = '/';
  divider.setAttribute('aria-hidden', 'true');
  const total = document.createElement('span');
  total.className = 'section-navigation-total';
  total.textContent = String(pages.length);
  position.append(current, divider, total);
  const next = document.createElement('a');
  next.className = 'section-navigation-arrow section-navigation-next';
  next.rel = 'next';
  next.innerHTML = arrow;
  navigation.append(previous, label, links, position, next);
  footer.after(navigation);
  const mobile = matchMedia('(max-width: 1099px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let activeIndex = -1;
  let scrollFrame = 0;
  let viewportWidth = innerWidth;

  function showActiveLink() {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      if (!mobile.matches || navigation.hidden) return;
      const active = pageLinks[activeIndex];
      if (!active) return;
      const viewport = links.getBoundingClientRect();
      const item = active.getBoundingClientRect();
      const centered = links.scrollLeft + item.left - viewport.left - (viewport.width - item.width) / 2;
      const left = Math.max(0, Math.min(links.scrollWidth - links.clientWidth, centered));
      if (Math.abs(left - links.scrollLeft) < 1) return;
      links.scrollTo({ left, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    });
  }

  function currentPage() {
    if (page === 'booking') return 'rooms';
    if (page === 'location') return 'about';
    if (page === 'service-booking') {
      const service = document.querySelector('#service-kind')?.value || new URL(location.href).searchParams.get('service');
      return Object.hasOwn(services, service || '') ? services[service] : null;
    }
    return page;
  }

  function updateArrow(link, target, direction) {
    if (!target) {
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
      link.setAttribute('aria-label', direction === 'previous' ? 'Первая страница' : 'Последняя страница');
      link.tabIndex = -1;
      return;
    }
    link.href = pageURL(target);
    link.removeAttribute('aria-disabled');
    link.removeAttribute('tabindex');
    link.setAttribute('aria-label', `${direction === 'previous' ? 'Предыдущая' : 'Следующая'} страница: ${target.label}`);
  }

  function pageURL(target) {
    const season = new URL(location.href).searchParams.get('season');
    const query = ['all', 'winter', 'spring', 'summer', 'autumn'].includes(season) ? { season } : {};
    return destinationURL(target.file, destination.id, query).href;
  }

  function render() {
    const index = pages.findIndex(item => item.id === currentPage());
    const changed = index !== activeIndex;
    activeIndex = index;
    navigation.hidden = index < 0;
    document.body.classList.toggle('has-page-navigation', index >= 0);
    if (index < 0) return;
    navigation.dataset.currentPage = pages[index].id;
    label.textContent = pages[index].label;
    current.textContent = String(index + 1);
    position.setAttribute('aria-label', `Страница ${index + 1} из ${pages.length}`);
    updateArrow(previous, pages[index - 1], 'previous');
    updateArrow(next, pages[index + 1], 'next');
    pageLinks.forEach((link, position) => {
      link.href = pageURL(pages[position]);
      if (position === index) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (changed) showActiveLink();
  }
  document.addEventListener('change', event => {
    if (page === 'service-booking' && event.target?.name === 'service') render();
  });
  window.addEventListener('pageshow', render);
  window.addEventListener('popstate', render);
  window.addEventListener('hashchange', render);
  window.addEventListener('resize', () => {
    if (viewportWidth === innerWidth) return;
    viewportWidth = innerWidth;
    showActiveLink();
  });
  document.fonts?.ready.then(showActiveLink);
  // Season controls can update the URL with replaceState, without a hash event.
  // Refresh ordinary hrefs just before activation, including modified clicks.
  navigation.addEventListener('pointerdown', render);
  navigation.addEventListener('click', render);
  render();
}
