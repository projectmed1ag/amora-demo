// Additional catalogue entries are deliberately separate from bookable inventory.
// Existing room data, gallery bindings and booking controls remain their own owners.
const collectionRoot = new URL('../', import.meta.url);
const assetURL = path => new URL(path, collectionRoot).href;
const arrow = '<svg viewBox="0 0 28 20" aria-hidden="true"><path d="M2 10h22m-6-6 6 6-6 6"/></svg>';
const previous = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>';
const next = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 5 7 7-7 7"/></svg>';
const houses = [
  {
    id: 'panorama', name: 'Панорама', bedrooms: '2 спальни', guests: 6, area: 60,
    description: 'Два жилых этажа, две спальни и открытая терраса на крыше. Панорамное остекление открывает вид на водохранилище.',
    detail: 'Спальня в кормовой части',
  },
  {
    id: 'residence', name: 'Резиденция', bedrooms: '5 спален', guests: 10, area: 120,
    description: 'Два жилых этажа, пять спален и открытая терраса на крыше. Общая гостиная с кухней и обеденной зоной для встреч у воды.',
    detail: 'Спальня верхнего этажа',
  },
];

function photosFor(house) {
  return [
    ['exterior', 'Внешний вид'],
    ['living-room', 'Гостиная и кухня'],
    ['bedroom', 'Спальня'],
    ['exterior-angle-2', 'Другой ракурс'],
    ['rooftop-terrace', 'Терраса на крыше'],
    ['interior-detail', house.detail],
  ].map(([file, caption]) => ({
    src: assetURL(`images/mozhaysk-render-photos-20261106/${house.id}/${file}.jpg`),
    caption, alt: `${house.name} — ${caption.toLocaleLowerCase('ru')}`,
  }));
}

function galleryMarkup(house) {
  const photos = photosFor(house);
  return `<div class="additional-houses-gallery" data-additional-gallery="${house.id}" role="group" aria-label="Фотографии хаусбота ${house.name}">
    <div class="additional-houses-photo">
      <button class="additional-houses-open" type="button" data-additional-open aria-label="Открыть фотографии: ${house.name}" aria-haspopup="dialog">
        <img data-additional-image src="${photos[0].src}" alt="${photos[0].alt}" width="1672" height="941" loading="lazy" decoding="async">
      </button>
      <button class="additional-houses-icon additional-houses-photo-arrow additional-houses-photo-prev" type="button" data-additional-prev aria-label="Предыдущее фото: ${house.name}">${previous}</button>
      <button class="additional-houses-icon additional-houses-photo-arrow additional-houses-photo-next" type="button" data-additional-next aria-label="Следующее фото: ${house.name}">${next}</button>
    </div>
    <p class="additional-houses-sr-only" data-additional-status aria-live="polite" aria-atomic="true">Фото 1 из 6</p>
    <p class="additional-houses-photo-error" data-additional-error hidden>Не удалось загрузить фото. Выберите другой кадр.</p>
    <div class="additional-houses-thumbnails" role="group" aria-label="Выбрать фото: ${house.name}">
      ${photos.map((photo, index) => `<button class="additional-houses-thumbnail" type="button" data-additional-thumb="${index}" aria-pressed="${index === 0}" aria-label="${photo.caption}, фото ${index + 1} из 6: ${house.name}"><img src="${photo.src}" alt="" width="1672" height="941" loading="lazy" decoding="async"></button>`).join('')}
    </div>
  </div>`;
}

function houseMarkup(house, home, number) {
  const heading = home ? 'h3' : 'h2';
  const titleID = `additional-house-${house.id}-title`;
  const roomURL = assetURL(`rooms.html?city=mozhaysk#stay-${house.id}`);
  const contactURL = assetURL('contacts.html#contacts-mozhaysk-title');
  return `<article class="additional-houses-card" ${home ? '' : `id="stay-${house.id}" tabindex="-1"`} aria-labelledby="${titleID}">
    ${home ? `<a class="additional-houses-cover" href="${roomURL}" aria-label="Выбрать хаусбот ${house.name}"><img src="${photosFor(house)[0].src}" alt="Хаусбот ${house.name}" width="1672" height="941" loading="lazy" decoding="async"></a>` : galleryMarkup(house)}
    ${home ? `<div class="additional-houses-copy">
      <p class="additional-houses-meta">До ${house.guests} гостей <span aria-hidden="true">·</span> ${house.area} м²</p>
      <${heading} id="${titleID}">${house.name}</${heading}>
      <p class="additional-houses-description">${house.description}</p>
      <a class="additional-houses-action" href="${roomURL}" aria-label="Выбрать хаусбот ${house.name}"><span>Выбрать</span>${arrow}</a>
    </div>` : `<div class="room-card-copy">
      <p class="stays-number" aria-hidden="true">${String(number).padStart(2, '0')}</p><h2 id="${titleID}">${house.name}</h2>
      <dl class="room-specifications"><div><dt>Вместимость</dt><dd>До ${house.guests} гостей</dd></div><div><dt>Площадь</dt><dd>${house.area} м²</dd></div></dl>
      <p>${house.description}</p>
      <ul class="room-features"><li>${house.bedrooms}</li><li>Терраса на крыше</li></ul>
      <a class="primary-action home-link" href="${contactURL}" aria-label="Уточнить доступность хаусбота ${house.name}"><span>Уточнить доступность</span>${arrow}</a>
    </div>`}
  </article>`;
}

function loadStyles() {
  if (document.getElementById('collection-additional-houses-style')) return Promise.resolve();
  const link = document.createElement('link');
  link.id = 'collection-additional-houses-style';
  link.rel = 'stylesheet';
  link.href = new URL('./collection-additional-houses.css?v=20261106-catalogue-7', import.meta.url).href;
  const loaded = new Promise(resolve => {
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
  });
  document.head.append(link);
  return loaded;
}

function createViewer() {
  const dialog = document.createElement('dialog');
  dialog.className = 'additional-houses-dialog';
  dialog.setAttribute('aria-labelledby', 'additional-houses-photo-title');
  dialog.innerHTML = `<div class="additional-houses-dialog-content">
    <div class="additional-houses-dialog-toolbar"><h2 id="additional-houses-photo-title"></h2><button class="additional-houses-icon" type="button" data-additional-close aria-label="Закрыть фотографии"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"/></svg></button></div>
    <div class="additional-houses-dialog-stage"><img alt="" width="1672" height="941"><p class="additional-houses-photo-error" data-additional-dialog-error hidden>Не удалось загрузить фото. Выберите другой кадр.</p></div>
    <div class="additional-houses-gallery-controls"><button class="additional-houses-icon" type="button" data-additional-dialog-prev aria-label="Предыдущее фото">${previous}</button><p data-additional-dialog-status aria-live="polite" aria-atomic="true"></p><button class="additional-houses-icon" type="button" data-additional-dialog-next aria-label="Следующее фото">${next}</button></div>
  </div>`;
  document.body.append(dialog);
  const image = dialog.querySelector('img');
  const error = dialog.querySelector('[data-additional-dialog-error]');
  let active;
  let opener;
  function refresh() {
    const photo = active.photos[active.index];
    dialog.querySelector('h2').textContent = active.house.name;
    image.src = photo.src;
    image.alt = photo.alt;
    error.hidden = true;
    dialog.querySelector('[data-additional-dialog-status]').textContent = `${active.index + 1}/${active.photos.length}`;
  }
  function move(direction) { active.select(active.index + direction); refresh(); }
  image.addEventListener('error', () => { error.hidden = false; });
  dialog.querySelector('[data-additional-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-additional-dialog-prev]').addEventListener('click', () => move(-1));
  dialog.querySelector('[data-additional-dialog-next]').addEventListener('click', () => move(1));
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { opener?.focus({ preventScroll: true }); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  return {
    open(gallery, trigger) {
      // Keep the photograph available in older browsers without native dialog.
      if (typeof dialog.showModal !== 'function') {
        window.location.assign(gallery.photos[gallery.index].src);
        return;
      }
      active = gallery;
      opener = trigger;
      refresh();
      dialog.showModal();
      dialog.querySelector('[data-additional-close]').focus();
    },
  };
}

function bindGallery(element, house, viewer) {
  const photos = photosFor(house);
  const image = element.querySelector('[data-additional-image]');
  const error = element.querySelector('[data-additional-error]');
  const thumbnails = [...element.querySelectorAll('[data-additional-thumb]')];
  const state = {
    house, photos, index: 0,
    select(index) {
      state.index = (index + photos.length) % photos.length;
      const photo = photos[state.index];
      error.hidden = true;
      image.src = photo.src;
      image.alt = photo.alt;
      element.querySelector('[data-additional-status]').textContent = `${photo.caption}, фото ${state.index + 1} из ${photos.length}`;
      thumbnails.forEach((button, i) => button.setAttribute('aria-pressed', String(i === state.index)));
    },
  };
  image.addEventListener('error', () => { error.hidden = false; });
  element.querySelector('[data-additional-prev]').addEventListener('click', () => state.select(state.index - 1));
  element.querySelector('[data-additional-next]').addEventListener('click', () => state.select(state.index + 1));
  thumbnails.forEach((button, index) => button.addEventListener('click', () => state.select(index)));
  element.querySelector('[data-additional-open]').addEventListener('click', event => viewer.open(state, event.currentTarget));
  element.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      state.select(state.index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
}

function initializeAdditionalHouses() {
  if (document.documentElement.dataset.city !== 'mozhaysk' || document.getElementById('additional-houses')) return;
  const page = document.body.dataset.page;
  if (page !== 'home' && page !== 'rooms') return;
  const main = document.querySelector('main#content');
  const home = page === 'home';
  const after = main?.querySelector(home ? ':scope > .home-stays' : ':scope > .room-list');
  if (!after) return;
  const existingRoomCount = home ? 0 : after.querySelectorAll(':scope > .room-houseboat').length;
  const stylesReady = loadStyles();
  const section = document.createElement('section');
  section.id = 'additional-houses';
  section.className = `additional-houses additional-houses--${home ? 'home' : 'rooms'}`;
  section.setAttribute('aria-label', 'Хаусботы Панорама и Резиденция');
  section.innerHTML = `<div class="additional-houses-list">${houses.map((house, index) => houseMarkup(house, home, existingRoomCount + index + 1)).join('')}</div>`;
  after.after(section);
  if (!home) {
    const viewer = createViewer();
    houses.forEach(house => bindGallery(section.querySelector(`[data-additional-gallery="${house.id}"]`), house, viewer));
  }
  void stylesReady.then(() => {
    const house = houses.find(item => location.hash === `#stay-${item.id}`);
    if (!home && house) requestAnimationFrame(() => {
      const target = document.getElementById(`stay-${house.id}`);
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start' });
    });
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeAdditionalHouses, { once: true });
else initializeAdditionalHouses();
