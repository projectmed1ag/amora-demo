import { renderLeisureDetails } from './collection-leisure-details.js?v=20261023-entertainment-2';
import { renderNearbyPlaces } from './collection-nearby.js?v=20261025-progressive-photos-1';

const arrow = '<svg viewBox="0 0 28 20" aria-hidden="true" focusable="false"><path d="M2 10h22m-6-6 6 6-6 6"/></svg>';
const detailURL = activity => `./spaces.html?city=mozhaysk&amp;activity=${activity}`;
const panels = [
  { id: 'active', activity: 'active', title: 'Движение', copy: 'Велосипеды · Теннис · Мячи', image: 'blend-active', alt: 'Иллюстрация: семейная велопрогулка по лесной тропе' },
  { id: 'children', activity: 'children', title: 'Детям', copy: 'Зоопарк · Детская зона · Игры', image: 'blend-zoo', alt: 'Иллюстрация: ребёнок наблюдает за животными в зоопарке' },
  { id: 'nature', activity: 'nature', title: 'У воды', copy: 'Прогулочные тропы · Рыбалка', image: 'blend-nature', alt: 'Иллюстрация: семейная рыбалка на берегу лесного озера' },
];
const winterPanels = [
  { id: 'tubing', activity: 'tubing', title: 'Ватрушки', image: 'winter', alt: 'Иллюстрация: семейный отдых с ватрушками на снегу' },
  { id: 'rink', activity: 'rink', title: 'Каток', image: 'rink', alt: 'Иллюстрация: зимний каток среди деревьев' },
  { id: 'buggy', activity: 'buggy', title: 'Багги зимой', image: 'buggy', alt: 'Иллюстрация: багги на заснеженной лесной дороге' },
];

function panel(item, index, winter = false) {
  return `<section class="cl-panel cl-panel-${item.id}${winter ? ' cl-winter-panel' : ''}" id="${item.id}" aria-labelledby="cl-${item.id}-title">
    <img src="./images/mozhaysk/leisure-${item.image}.jpg" alt="${item.alt}" width="1200" height="800" ${winter ? 'loading="lazy"' : 'loading="eager"'} ${index === 0 && !winter ? 'fetchpriority="high"' : ''}>
    <div class="cl-panel-copy">${winter ? `<h3 id="cl-${item.id}-title"><a class="cl-link cl-panel-link" href="${detailURL(item.activity)}"><span>${item.title}</span>${arrow}</a></h3>` : `<h2 id="cl-${item.id}-title">${item.title}</h2><p>${item.copy}</p><a class="cl-link cl-panel-link" href="${detailURL(item.activity)}" aria-label="Подробнее: ${item.title}"><span>Подробнее</span>${arrow}</a>`}</div>
  </section>`;
}

function story({ id, activity, title, copy, image, alt }) {
  return `<section class="cl-story cl-story-${id}" id="${id}" aria-labelledby="cl-${id}-title">
    ${id === 'events' ? '<span id="barbecue" class="cl-anchor" aria-hidden="true"></span>' : ''}
    <div class="cl-story-photo"><img src="./images/mozhaysk/leisure-${image}.jpg" alt="${alt}" width="1200" height="800" loading="lazy"></div>
    <div class="cl-story-copy"><svg class="cl-story-edge" viewBox="0 0 100 340" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 0H68C22 88 20 145 51 205C75 252 100 295 100 340H0Z"/></svg>
      <h2 id="cl-${id}-title">${title}</h2><p>${copy}</p><a class="cl-link cl-story-link" href="${detailURL(activity)}" aria-label="Подробнее: ${title.replace('<br>', ' ')}"><span>Подробнее</span>${arrow}</a>
    </div>
  </section>`;
}

export function renderCollectionLeisure() {
  const activity = new URLSearchParams(location.search).get('activity');
  if (activity) {
    const details = renderLeisureDetails(activity);
    if (details) return details;
  }
  return `<div class="cl-overview">
    <header class="cl-intro" id="top">
      <img class="cl-intro-photo" src="./images/mozhaysk/leisure-blend-lake.jpg" alt="" width="1600" height="500" fetchpriority="high">
      <div class="cl-intro-copy"><h1>Каждый день —<br>новая история.</h1><p>Выберите свой ритм семейного отдыха.</p></div>
      <p class="cl-intro-aside">Больше,<br>чем отдых.</p>
    </header>
    <div class="cl-primary-row">${panels.map((item, index) => panel(item, index)).join('')}</div>
    ${story({ id: 'garden', activity: 'garden', title: 'Среди<br>зелени.', copy: 'Садовые парники для неспешного отдыха.', image: 'garden', alt: 'Иллюстрация: садовые парники среди зелени и деревьев' })}
    ${story({ id: 'events', activity: 'together', title: 'Время<br>вместе.', copy: 'Павильон для мероприятий<br>Шашлычные зоны', image: 'blend-events', alt: 'Иллюстрация: семейный вечер в деревянном павильоне у воды' })}
    <section class="cl-winter" id="winter" aria-labelledby="cl-winter-title">
      <header class="cl-winter-heading"><h2 id="cl-winter-title">Зимние дни.</h2><p>У зимы — свои маленькие радости.</p></header>
      <div class="cl-winter-row">${winterPanels.map((item, index) => panel(item, index, true)).join('')}</div>
      <p class="cl-image-note">Атмосфера отдыха · иллюстрации</p>
    </section>
    ${renderNearbyPlaces()}
  </div>`;
}
