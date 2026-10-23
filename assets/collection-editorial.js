import { applyCollectionShell } from './collection-site-shell.js?v=20261023-entertainment-2';

const arrow = '<svg viewBox="0 0 28 20" aria-hidden="true"><path d="M2 10h22m-6-6 6 6-6 6"/></svg>';
const close = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"/></svg>';

const aboutIntro = 'A’MORE Collection — семейный отель на Можайском водохранилище. Хаусботы у воды, лесные прогулки и занятия для всей семьи — здесь легко наполнить день впечатлениями и оставить время для спокойного отдыха.';
const aboutParagraphs = [
  'Прокатитесь на велосипеде, сыграйте в теннис или отправьтесь на рыбалку. Для неспешного дня выбирайте прогулочные тропы и садовые парники, а для активного — подвижные игры с мячом.',
  'Для детей есть зоопарк, игровая зона и игры, к которым можно присоединиться всей семьёй. Вечером собирайтесь с близкими в шашлычных зонах, а для особого повода выбирайте павильон для мероприятий.',
  'Зимой у отдыха своё настроение: ватрушки, каток и прогулки на багги. Доступность зимних занятий зависит от погоды.',
];

function addStyles() {
  if (document.getElementById('collection-editorial-style')) return;
  const link = document.createElement('link');
  link.id = 'collection-editorial-style';
  link.rel = 'stylesheet';
  link.href = new URL('./collection-editorial.css?v=about-1', import.meta.url).href;
  link.setAttribute('blocking', 'render');
  document.head.append(link);
}

function createHero(main, image, page) {
  const heading = main.querySelector('.page-heading');
  const hero = document.createElement('section');
  hero.className = `home-hero editorial-hero editorial-${page}-hero`;
  hero.id = 'top';
  hero.setAttribute('aria-labelledby', 'page-title');
  image.loading = 'eager';
  image.setAttribute('fetchpriority', 'high');
  image.sizes = '100vw';
  const copy = document.createElement('div');
  copy.className = 'home-hero-bottom';
  const title = document.createElement('div');
  const location = heading.querySelector('.eyebrow');
  location.className = 'home-location';
  if (page !== 'gallery') title.append(location);
  title.append(heading.querySelector('h1'));
  const lead = heading.querySelector('.page-lead');
  lead.className = 'editorial-hero-lead';
  copy.append(title, lead);
  hero.append(image, copy);
  heading.replaceWith(hero);
  return hero;
}

function restyleNext(main) {
  const next = main.querySelector('.page-next');
  if (!next) return;
  next.className = 'editorial-next';
  const link = next.querySelector('a');
  const label = document.createElement('span');
  label.textContent = link.textContent;
  link.className = 'home-link';
  link.replaceChildren(label);
  link.insertAdjacentHTML('beforeend', arrow);
}

function enhanceAbout(main) {
  const heading = main.querySelector('.page-heading');
  heading.querySelector('h1').innerHTML = 'Семейный отдых.<br>В своём ритме.';
  heading.querySelector('.page-lead').textContent = aboutIntro;
  document.title = 'Об отеле — семейный отдых на Можайском водохранилище — A’MORE Collection';
  document.querySelector('meta[name="description"]').content = aboutIntro;
  const cover = main.querySelector('.page-cover');
  const hero = createHero(main, cover.querySelector('img'), 'about');
  cover.remove();
  const introduction = document.createElement('section');
  introduction.className = 'about-introduction';
  introduction.setAttribute('aria-labelledby', 'about-family-title');
  introduction.innerHTML = `<h2 id="about-family-title">Ближе к природе.<br>Ближе друг к другу.</h2>
    <div class="about-introduction-copy">${aboutParagraphs.map(text => `<p>${text}</p>`).join('')}
      <nav class="about-introduction-links" aria-label="Узнать больше об отеле">
        <a class="home-link" href="./spaces.html?city=mozhaysk"><span>Выбрать занятие</span>${arrow}</a>
        <a class="home-link" href="./location.html?city=mozhaysk"><span>Расположение отеля</span>${arrow}</a>
      </nav>
    </div>`;
  hero.after(introduction);
  main.querySelectorAll('.page-story').forEach((story, index) => {
    story.classList.add('editorial-story');
    if (index % 2) story.classList.add('editorial-story-dark');
    story.querySelectorAll('img').forEach(image => {
      image.sizes = '(max-width: 700px) 100vw, 58vw';
    });
  });
}

function enhanceGallery(main) {
  const figures = [...main.querySelectorAll('.gallery-photo')];
  if (!figures.length) return;
  const photos = figures.map(figure => ({
    image: figure.querySelector('img'),
    title: figure.querySelector('figcaption').textContent.trim(),
  }));
  const hero = createHero(main, photos[0].image, 'gallery');
  const caption = figures[0].querySelector('figcaption');
  caption.className = 'editorial-hero-caption';
  const cover = document.createElement('figure');
  cover.className = 'editorial-gallery-cover';
  hero.replaceWith(cover);
  cover.append(hero, caption);
  figures[0].remove();

  function addTrigger(container, index, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute('aria-label', `Открыть фото: ${photos[index].title.replace(/^\d+/, '')}`);
    button.setAttribute('aria-haspopup', 'dialog');
    button.addEventListener('click', () => openPhoto(index, button));
    container.append(button);
  }
  addTrigger(hero, 0, 'editorial-hero-photo-trigger');

  figures.slice(1).forEach((figure, offset) => {
    const index = offset + 1;
    figure.classList.add('editorial-gallery-photo');
    const media = figure.querySelector('.media');
    addTrigger(media, index, 'editorial-gallery-trigger');
    figure.querySelector('img').sizes = '(max-width: 700px) 100vw, 50vw';
    const caption = figure.querySelector('figcaption');
    const number = caption.querySelector('span');
    const title = document.createElement('span');
    title.className = 'editorial-gallery-title';
    title.textContent = caption.textContent.replace(number.textContent, '').trim();
    caption.replaceChildren(number, title);
  });

  const dialog = document.createElement('dialog');
  dialog.className = 'editorial-photo-dialog';
  dialog.setAttribute('aria-labelledby', 'editorial-photo-title');
  dialog.innerHTML = `<div class="editorial-photo-toolbar">
    <h2 id="editorial-photo-title"></h2>
    <button type="button" data-editorial-photo-close aria-label="Закрыть фотографии">${close}</button>
    </div><div class="editorial-photo-stage"><img alt=""><p data-editorial-photo-error hidden>Не удалось загрузить фотографию.</p></div>
    <div class="editorial-photo-controls"><button type="button" data-editorial-photo-prev aria-label="Предыдущее фото">${arrow}</button>
    <p data-editorial-photo-status aria-live="polite" aria-atomic="true"></p>
    <button type="button" data-editorial-photo-next aria-label="Следующее фото">${arrow}</button></div>`;
  document.body.append(dialog);
  const currentImage = dialog.querySelector('img');
  const error = dialog.querySelector('[data-editorial-photo-error]');
  const title = dialog.querySelector('h2');
  const status = dialog.querySelector('[data-editorial-photo-status]');
  const closeButton = dialog.querySelector('[data-editorial-photo-close]');
  let current = 0;
  let returnFocus;
  function showPhoto(index) {
    current = (index + photos.length) % photos.length;
    const photo = photos[current];
    error.hidden = true;
    currentImage.hidden = false;
    currentImage.src = photo.image.src;
    currentImage.alt = photo.image.alt;
    title.textContent = photo.title.replace(/^\d+/, '').trim();
    status.textContent = `${String(current + 1).padStart(2, '0')} / ${String(photos.length).padStart(2, '0')}`;
  }
  function openPhoto(index, trigger) {
    returnFocus = trigger;
    showPhoto(index);
    dialog.showModal();
    document.documentElement.classList.add('editorial-photo-open');
    closeButton.focus({ preventScroll: true });
  }
  currentImage.addEventListener('error', () => {
    currentImage.hidden = true;
    error.hidden = false;
  });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-editorial-photo-prev]').addEventListener('click', () => showPhoto(current - 1));
  dialog.querySelector('[data-editorial-photo-next]').addEventListener('click', () => showPhoto(current + 1));
  dialog.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    showPhoto(current + (event.key === 'ArrowLeft' ? -1 : 1));
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('editorial-photo-open');
    returnFocus?.focus({ preventScroll: true });
  });
}

export function enhanceCollectionEditorial(page, city) {
  if (city !== 'mozhaysk' || !['gallery', 'about'].includes(page)) return false;
  applyCollectionShell(page);
  document.body.classList.add('collection-editorial-page', `collection-${page}-page`);
  addStyles();
  const main = document.querySelector('#content');
  if (page === 'gallery') enhanceGallery(main);
  else enhanceAbout(main);
  restyleNext(main);
  return true;
}
