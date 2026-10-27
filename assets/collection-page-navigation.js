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
  navigation.append(previous, label, position, next);
  footer.after(navigation);

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
    const season = new URL(location.href).searchParams.get('season');
    const query = ['all', 'winter', 'spring', 'summer', 'autumn'].includes(season) ? { season } : {};
    link.href = destinationURL(target.file, destination.id, query).href;
    link.removeAttribute('aria-disabled');
    link.removeAttribute('tabindex');
    link.setAttribute('aria-label', `${direction === 'previous' ? 'Предыдущая' : 'Следующая'} страница: ${target.label}`);
  }

  function render() {
    const index = pages.findIndex(item => item.id === currentPage());
    navigation.hidden = index < 0;
    document.body.classList.toggle('has-page-navigation', index >= 0);
    if (index < 0) return;
    navigation.dataset.currentPage = pages[index].id;
    label.textContent = pages[index].label;
    current.textContent = String(index + 1);
    position.setAttribute('aria-label', `Страница ${index + 1} из ${pages.length}`);
    updateArrow(previous, pages[index - 1], 'previous');
    updateArrow(next, pages[index + 1], 'next');
  }
  document.addEventListener('change', event => {
    if (page === 'service-booking' && event.target?.name === 'service') render();
  });
  window.addEventListener('pageshow', render);
  window.addEventListener('popstate', render);
  window.addEventListener('hashchange', render);
  // Season controls can update the URL with replaceState, without a hash event.
  // Refresh ordinary hrefs just before activation, including modified clicks.
  navigation.addEventListener('pointerdown', render);
  navigation.addEventListener('click', render);
  render();
}
