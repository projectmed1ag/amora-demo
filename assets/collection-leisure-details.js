import { leisureGroups, seasonNote } from './mozhaysk-leisure-data.js?v=publish-1';

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
  const singleWinter = detail.groupIds.includes('winter') && items.length === 1;

  return `<section class="cl-detail${singleWinter ? ' cl-detail-single' : ''}" aria-labelledby="cl-detail-title">
    <a class="cl-back" href="${overviewURL}"><span aria-hidden="true">←</span> Все занятия</a>
    <header class="cl-detail-heading">
      <p class="cl-eyebrow">ДОСУГ · A’MORE COLLECTION</p>
      <h1 id="cl-detail-title">${escapeHTML(detail.title)}</h1>
      <p>${escapeHTML(intro)}</p>
    </header>
    <div class="cl-detail-grid">
      <figure class="cl-detail-photo">
        <img src="./images/mozhaysk/leisure-${detail.image}.jpg" width="1200" height="800" alt="${escapeHTML(detail.imageAlt)}" fetchpriority="high">
        <figcaption>Атмосфера отдыха · иллюстрация</figcaption>
      </figure>
      <div class="cl-detail-items">
        ${items.map((item, index) => `<article id="${detail.itemIds[index]}">
          ${singleWinter ? '' : `<h2>${escapeHTML(item.title)}</h2>`}
          <p>${escapeHTML(item.description)}</p>
        </article>`).join('')}
        ${detail.groupIds.includes('winter') ? `<p class="cl-season-note">${escapeHTML(detail.note || seasonNote)}</p>` : ''}
      </div>
    </div>
    <div class="cl-detail-actions"><a class="cl-link" href="${overviewURL}"><span>Все занятия</span>${arrow}</a></div>
  </section>`;
}
