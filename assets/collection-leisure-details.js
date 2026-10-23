import { leisureGroups, seasonNote } from './mozhaysk-leisure-data.js?v=20261023-leisure-catalog-1';

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

const groups = new Map(leisureGroups.map((group) => [group.id, group]));
const details = {
  active: {
    groupIds: ['active'],
    title: 'Движение и игра.',
    image: 'active',
    imageAlt: 'Велосипеды у прогулочной тропы среди деревьев',
    itemIds: ['bicycles', 'tennis', 'balls'],
  },
  children: {
    groupIds: ['children'],
    title: 'Детям.',
    image: 'zoo',
    imageAlt: 'Семья наблюдает за животными за ограждением зоопарка',
    itemIds: ['zoo', 'play-area', 'games'],
  },
  nature: {
    groupIds: ['nature'],
    title: 'Тропы и берег.',
    image: 'nature',
    imageAlt: 'Рыбалка у тихого лесного озера',
    itemIds: ['paths', 'fishing'],
  },
  garden: {
    groupIds: ['garden'],
    title: 'Садовые парники.',
    image: 'garden',
    imageAlt: 'Садовые парники с зеленью у прогулочной дорожки',
    itemIds: ['greenhouses'],
  },
  together: {
    groupIds: ['events', 'barbecue'],
    title: 'Время вместе.',
    intro: 'Праздники, встречи и неспешные вечера за общим столом.',
    overviewId: 'events',
    image: 'events',
    imageAlt: 'Открытый деревянный павильон со столами рядом с природой',
    itemIds: ['pavilion', 'barbecue'],
  },
  firepit: {
    groupIds: ['firepit'],
    title: 'Костровая зона.',
    imageURL: './images/hotel/moscow/bungalows/experience/night-firepit.jpg',
    imageAlt: 'Костровая зона с креслами на берегу',
    imageCaption: false,
    itemIds: ['firepit'],
  },
  winter: {
    groupIds: ['winter'],
    title: 'Зимние дни.',
    image: 'buggy',
    imageAlt: 'Багги на заснеженной дороге среди деревьев',
    itemIds: ['tubing', 'rink', 'buggy'],
  },
  tubing: {
    groupIds: ['winter'],
    itemIndexes: [0],
    title: 'Ватрушки.',
    intro: 'Время для снежных прогулок и семейного отдыха.',
    overviewId: 'winter',
    image: 'winter',
    imageAlt: 'Семья с ватрушками на прогулке по заснеженной тропе',
    itemIds: ['tubing'],
    note: 'Зимние занятия зависят от погоды. Условия катания можно уточнить у команды отеля.',
  },
  rink: {
    groupIds: ['winter'],
    itemIndexes: [1],
    title: 'Каток.',
    intro: 'Встречаемся на льду.',
    overviewId: 'winter',
    image: 'rink',
    imageAlt: 'Зимний каток для отдыха на коньках',
    itemIds: ['rink'],
    note: 'Работа катка зависит от погоды. Условия посещения можно уточнить у команды отеля.',
  },
  buggy: {
    groupIds: ['winter'],
    itemIndexes: [2],
    title: 'Багги зимой.',
    intro: 'Заснеженные окрестности в новом ритме.',
    overviewId: 'winter',
    image: 'buggy',
    imageAlt: 'Багги на заснеженной дороге среди деревьев',
    itemIds: ['buggy'],
    note: 'Доступность зимних прогулок зависит от погоды.',
  },
};

const arrow = '<svg width="22" height="12" viewBox="0 0 22 12" fill="none" aria-hidden="true"><path d="M1 6h19M15 1l5 5-5 5" stroke="currentColor" stroke-width="1.2"/></svg>';

export function renderLeisureDetails(activity) {
  const detail = Object.hasOwn(details, activity) ? details[activity] : null;
  if (!detail) return null;

  const selectedGroups = detail.groupIds.map((id) => groups.get(id));
  const groupItems = selectedGroups.flatMap((group) => group.items);
  const items = detail.itemIndexes ? detail.itemIndexes.map((index) => groupItems[index]) : groupItems;
  const overviewURL = `./spaces.html?city=mozhaysk#${detail.overviewId || activity}`;
  const intro = detail.intro || selectedGroups[0].intro;
  const singleItem = items.length === 1;
  const titleLines = {
    active: 'Движение<br> и игра.',
    nature: 'Тропы<br> и берег.',
    garden: 'Садовые<br> парники.',
    together: 'Время<br> вместе.',
    winter: 'Зимние<br> дни.',
    buggy: 'Багги<br> зимой.',
  };

  return `<section class="cl-detail cl-detail-${activity}${singleItem ? ' cl-detail-single' : ''}" aria-labelledby="cl-detail-title">
    <div class="cl-detail-hero">
      <figure class="cl-detail-photo">
        <img src="${escapeHTML(detail.imageURL || `./images/mozhaysk/leisure-${detail.image}.jpg`)}" width="1200" height="800" alt="${escapeHTML(detail.imageAlt)}" fetchpriority="high">
        ${detail.imageCaption === false ? '' : '<figcaption>Атмосфера отдыха · иллюстрация</figcaption>'}
      </figure>
      <header class="cl-detail-heading">
        <a class="cl-back" href="${overviewURL}">${arrow}<span>Все занятия</span></a>
        <div class="cl-detail-title-copy">
          <h1 id="cl-detail-title">${titleLines[activity] || escapeHTML(detail.title)}</h1>
          <p>${escapeHTML(intro)}</p>
        </div>
        <svg class="cl-detail-edge" viewBox="0 0 100 340" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 0H68C22 88 20 145 51 205C75 252 100 295 100 340H0Z"/></svg>
      </header>
    </div>
    <div class="cl-detail-body">
      <div class="cl-detail-items" data-count="${items.length}">
        ${items.map((item, index) => `<article id="${detail.itemIds[index]}">
          ${singleItem ? '' : `<span class="cl-detail-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><h2>${escapeHTML(item.title)}</h2>`}
          <p>${escapeHTML(item.description)}</p>
        </article>`).join('')}
      </div>
      ${detail.groupIds.includes('winter') ? `<p class="cl-season-note">${escapeHTML(detail.note || seasonNote)}</p>` : ''}
      <div class="cl-detail-actions"><a class="cl-link" href="${overviewURL}"><span>Все занятия</span>${arrow}</a></div>
    </div>
  </section>`;
}
