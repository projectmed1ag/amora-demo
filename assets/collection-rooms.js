import { applyCollectionShell } from './collection-site-shell.js?v=20261023-photo-response-3';

const arrow = '<svg viewBox="0 0 28 20" aria-hidden="true"><path d="M2 10h22m-6-6 6 6-6 6"/></svg>';

function addStyles(id, file) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = new URL(file, import.meta.url).href;
  link.setAttribute('blocking', 'render');
  document.head.append(link);
}

export function enhanceCollectionRooms() {
  applyCollectionShell('rooms');
  document.body.classList.add('collection-rooms-page');
  addStyles('collection-rooms-style', './collection-rooms.css?v=20261023-photo-response-3');

  const main = document.querySelector('#content');
  const articles = [...main.querySelectorAll('.room-houseboat')];
  const categories = articles.map(article => ({
    id: article.querySelector('[data-room-photos]').dataset.roomPhotos,
    title: article.querySelector('h2').textContent,
  }));
  const heading = main.querySelector('.page-heading');
  const hero = document.createElement('section');
  hero.className = 'home-hero stays-hero';
  hero.id = 'top';
  hero.setAttribute('aria-labelledby', 'page-title');
  hero.innerHTML = `
    <img src="./images/rooms/mozhaysk/standard-houseboat/exterior-day.jpg"
      width="1920" height="1080" fetchpriority="high"
      alt="Панорамный хаусбот с открытой террасой на Можайском водохранилище">
    <div class="home-hero-bottom">
      <h1 id="page-title">Хаусботы<br>у большой воды.</h1>
    </div>`;
  const navigation = document.createElement('section');
  navigation.className = 'stays-navigation';
  navigation.setAttribute('aria-labelledby', 'stays-choice-title');
  navigation.innerHTML = `<h2 id="stays-choice-title">Ваше место для отдыха.</h2>
    <nav aria-label="Категории хаусботов">${categories.map(({ id, title }) =>
      `<a href="#stay-${id}">${title}</a>`).join('')}</nav>`;
  heading.replaceWith(hero, navigation);

  // Keep the existing gallery nodes: the original app has already bound their
  // thumbnail, slideshow and accessible photo-dialog controls.
  articles.forEach((article, index) => {
    article.id = `stay-${categories[index].id}`;
    const copy = article.querySelector('.room-card-copy');
    const number = document.createElement('p');
    number.className = 'stays-number';
    number.textContent = String(index + 1).padStart(2, '0');
    number.setAttribute('aria-hidden', 'true');
    copy.prepend(number);
    const booking = copy.querySelector('.primary-action');
    booking.classList.add('home-link');
    booking.innerHTML = `<span>Выбрать хаусбот</span>${arrow}`;
    article.querySelectorAll('.room-slide img').forEach(img => {
      img.sizes = '(max-width: 700px) 100vw, 60vw';
    });
  });

  main.querySelector('.concept-note')?.remove();
  const next = main.querySelector('.page-next');
  next.className = 'stays-next';
  next.innerHTML = `<h2>За порогом —<br>целый день.</h2>
    <a class="home-link" href="./spaces.html?city=mozhaysk"><span>Все развлечения</span>${arrow}</a>`;

  if (location.hash) {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); }
    catch { return; }
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }
}
