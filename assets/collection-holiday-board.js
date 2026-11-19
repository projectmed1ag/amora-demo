import { onsiteInterests, services } from './collection-holiday-data.js?v=20261108-route-pdf-1';
import { availableInterestInStay, buildHolidayPlan, clock, dateLabel, interestSeasonLabel } from './collection-holiday-engine.js?v=20261119-family-1';

export const boardEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const esc = boardEscape;
const schedules = [
  { id: 'calm', title: 'Без спешки', description: 'Спокойные занятия и длинные паузы у воды.', picks: ['beach', 'garden', 'fishing', 'firepit'] },
  { id: 'balanced', title: 'Всего понемногу', description: 'Прогулки и впечатления чередуются с отдыхом.', picks: ['walk', 'garden', 'zoo', 'beach'] },
  { id: 'active', title: 'Больше движения', description: 'Активный досуг с паузами для восстановления.', picks: ['bike', 'skating', 'table-tennis', 'walk', 'tubing', 'ball-games'] },
];
const activities = new Map(onsiteInterests.map(item => [item.id, item]));
const groups = new Set(['activity', 'family', 'parallel', 'excursion', 'custom', 'hotel-event']);
const excludedFromFeatured = new Set(['free', 'rest', 'arrival', 'departure', 'visit', 'meal']);

export function buildBoardAlternatives(answers) {
  const ordered = [...schedules].sort((a, b) => Number(b.id === answers.pace) - Number(a.id === answers.pace));
  const used = new Set();
  const selected = answers.interests.filter(id => activities.has(id));
  const eligible = id => availableInterestInStay(id, answers.startDate, answers.endDate);
  const preferred = selected.filter(eligible);
  return ordered.map(profile => {
    const matching = preferred.filter(id => profile.picks.includes(id) || (profile.id === 'active' && activities.get(id).group === 'active'));
    const suggestions = profile.picks.filter(eligible);
    const choices = [...new Set([...matching, ...preferred, ...suggestions])];
    const distinct = choices.filter(id => !used.has(id));
    const primary = matching.find(id => !used.has(id)) || suggestions.find(id => !used.has(id)) || distinct[0] || choices[0];
    if (primary) used.add(primary);
    const preferredLimit = answers.startDate === answers.endDate ? 2 : 4;
    const tail = (matching.length ? matching : preferred.slice(0, 1)).filter(id => id !== primary).slice(0, preferredLimit - 1);
    if (preferred.length === 1 && preferred[0] !== primary) tail.unshift(preferred[0]);
    const interests = [...new Set([primary, ...tail].filter(Boolean))];
    const input = { ...structuredClone(answers), pace: profile.id, interests, suggestActivities: false };
    const plan = buildHolidayPlan(input, { priorityMeals: true });
    const omitted = selected.filter(id => !interests.includes(id)).map(id => activities.get(id).title);
    return { ...profile, input, plan, omitted };
  });
}

const tileTitles = {
  walk: 'Прогулка', bike: 'Велосипед', beach: 'Отдых у воды', pavilion: 'Павильоны',
  'table-tennis': 'Пинг-понг', 'sport-rental': 'Инвентарь', zoo: 'Зоопарк',
  'play-area': 'Детские зоны', 'learning-games': 'Игры на логику',
};

export function activityTiles(items, { action = 'select' } = {}) {
  return items.map(item => {
    const service = services.some(candidate => candidate.id === item.id);
    const id = service ? `service:${item.id}` : `activity:${item.id}`;
    const input = `<input type="checkbox" name="${service ? 'services' : 'interests'}" value="${item.id}"${item.selected ? ' checked' : ''}${item.disabled ? ' disabled' : ''}>`;
    const body = `${boardIcon(item.id)}<strong>${esc(action === 'add' ? tileTitles[item.id] || item.title : item.title)}</strong>${item.detail && action === 'select' ? `<small>${esc(item.detail)}</small>` : ''}`;
    return action === 'select'
      ? `<label class="holiday-tile">${input}${body}</label>`
      : `<button class="holiday-tile" type="button" data-board-add="${id}" data-tile-title="${esc(item.title)}" aria-label="${esc(item.title)}${item.disabled ? ', вне сезона' : ''}" aria-pressed="false"${item.disabled ? ` disabled title="${esc(interestSeasonLabel(item.id))}"` : ''}>${body}${item.disabled ? '<small>Вне сезона</small>' : ''}</button>`;
  }).join('');
}

const iconNames = {
  beach: 'beach', walk: 'trees', bike: 'bike', banya: 'bath', restaurant: 'utensils',
  breakfast: 'cup', lunch: 'utensils', dinner: 'utensils', barbecue: 'flame', firepit: 'flame',
  garden: 'plant', fishing: 'fish', sunbathing: 'beach', skating: 'skate', tubing: 'snow',
  snowmobile: 'snow', sup: 'water', buggy: 'buggy', 'table-tennis': 'racket',
  'ball-games': 'ball', 'sport-rental': 'ball', zoo: 'paw', 'play-area': 'kite',
  'learning-games': 'puzzle', pavilion: 'home', family: 'kite', parallel: 'kite',
  excursion: 'map', arrival: 'home', departure: 'home', visit: 'home',
  'hotel-event': 'star', achievement: 'trophy', map: 'map', grip: 'grip-vertical', plus: 'plus', trash: 'trash',
  pier: 'anchor', house: 'home', reception: 'home', rental: 'bike',
};

export function boardIcon(id) {
  return `<img class="holiday-icon" src="./assets/holiday-icons/${iconNames[id] || 'star'}.svg" width="28" height="28" alt="" draggable="false">`;
}

const schedulePhotos = {
  breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', restaurant: 'dinner',
  banya: 'banya', bike: 'bike', walk: 'walk', activity: 'walk',
};
const leisurePhotos = {
  fishing: 'fishing-01',
  sunbathing: 'sunbathing-01',
  garden: 'garden-01',
  'table-tennis': 'rental-02',
  'ball-games': 'rental-03',
  'sport-rental': 'rental-03',
  sup: 'sup-01',
  buggy: 'buggy-01',
  skating: 'winter-ice-rink-03',
  snowmobile: 'winter-snowmobiles-02',
  tubing: 'winter-tubing-02',
  zoo: 'children-03',
  'play-area': 'children-02',
  'learning-games': 'children-01',
  family: 'children-01',
  parallel: 'children-02',
  firepit: 'firepit-01',
  pavilion: 'events-01',
  barbecue: 'barbecue-02',
};

export function boardPhoto(id) {
  if (id === 'beach') return './images/fast-v1/leisure-nature-c46809a481f6-192.webp';
  if (Object.hasOwn(schedulePhotos, id)) return `./images/holiday-board/${schedulePhotos[id]}.webp`;
  if (Object.hasOwn(leisurePhotos, id)) return `./images/responsive/entertainment/${leisurePhotos[id]}-384.webp`;
  return '';
}

export function boardPalette(options) {
  const available = new Set(options.map(item => item.id));
  const featured = ['walk', 'bike', 'beach'].map(id => activities.get(id));
  const leisure = [...featured, ...onsiteInterests.filter(item => !featured.includes(item))]
    .map(item => ({ ...item, disabled: !available.has(`activity:${item.id}`) }));
  return `<aside class="holiday-palette holiday-board-surface" aria-labelledby="holiday-palette-title">
    <h3 id="holiday-palette-title">Активности</h3>
    <p class="holiday-palette-hint">Выберите фишку или перетащите её в свободное окно.</p>
    <div class="holiday-palette-grid">${activityTiles(leisure, { action: 'add' })}</div>
    <h4 class="holiday-palette-group-title">Услуги отеля</h4>
    <div class="holiday-palette-grid">${activityTiles(services, { action: 'add' })}</div>
  </aside>`;
}

export function alternativesMarkup(proposals) {
  const signature = ({ days }) => JSON.stringify(days.flatMap(day => day.items.filter(item => !excludedFromFeatured.has(item.kind))
    .map(item => [day.date, item.title, item.start, item.end])));
  const unique = new Set(proposals.map(({ plan }) => signature(plan))).size;
  return `<div class="holiday-variant-grid">${proposals.map(({ id, title, description, plan, omitted }, index) => {
    const items = plan.days.flatMap(day => day.items.filter(item => !excludedFromFeatured.has(item.kind)));
    const preview = [...new Set(items.map(item => item.title))].slice(0, 5);
    return `<article class="holiday-board-surface holiday-variant">
      ${boardIcon(['beach', 'walk', 'bike'][['calm', 'balanced', 'active'].indexOf(id)])}
      <h3>${esc(title)}</h3><p>${esc(description)}</p>
      ${preview.length ? `<ul class="holiday-variant-highlights">${preview.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p>Свободный визит с перерывами.</p>'}
      ${index === 0 ? '<p class="holiday-match">Ближе к вашему темпу</p>' : ''}
      <details><summary>Расписание по дням</summary>${plan.days.map(day => `<div class="holiday-variant-day">
        <strong>${esc(dateLabel(day.date))}</strong><ul>${day.items.filter(item => item.kind !== 'free').map(item => `<li><span>${clock(item.start)}–${clock(item.end)}</span> ${esc(item.title)}</li>`).join('')}</ul>
      </div>`).join('')}${plan.unplaced.length ? `<p>Не поместилось: ${plan.unplaced.map(item => esc(item.title)).join(', ')}.</p>` : ''}${omitted.length ? `<p>Пожелания вне этого варианта: ${omitted.map(esc).join(', ')}.</p>` : ''}</details>
      <button type="button" class="planner-button" data-choose-variant="${id}">Выбрать «${esc(title)}»</button>
    </article>`;
  }).join('')}</div>${unique < proposals.length ? '<p class="planner-note">При этих датах и условиях часть вариантов совпадает. Добавьте времени или измените пожелания, чтобы увидеть больше различий.</p>' : ''}`;
}

export function isBoardActivity(item) {
  return Boolean(item.id && groups.has(item.kind));
}

export function boardMark(item, answers) {
  return JSON.stringify([answers.startDate, answers.endDate, item.id, item.kind, item.title]);
}

export function earnedBadges(plan, marks) {
  const done = plan.days.flatMap(day => day.items).filter(item => isBoardActivity(item) && marks.has(boardMark(item, plan.answers)));
  const badges = [
    { title: 'Первое впечатление', detail: 'Первое выполненное занятие', earned: done.length > 0 },
    { title: 'На двух колёсах', detail: 'Велопрогулка выполнена', earned: done.some(item => item.interest === 'bike') },
    { title: 'По берегу', detail: 'Пешая прогулка выполнена', earned: done.some(item => item.interest === 'walk') },
    { title: 'День удался', detail: 'Выполнены три занятия', earned: done.length >= 3 },
  ];
  return { done: done.length, badges };
}

export function badgesMarkup(plan, marks) {
  const { done, badges } = earnedBadges(plan, marks);
  return `<p class="holiday-badge-count">Выполнено занятий: <strong>${done}</strong></p><ul class="holiday-badges">
    ${badges.map(badge => `<li data-earned="${badge.earned}">${boardIcon(badge.earned ? 'achievement' : 'star')}<div>
      <strong>${badge.title}</strong><span>${badge.detail}</span>
    </div><span class="holiday-badge-status">${badge.earned ? 'Получено' : 'Впереди'}</span></li>`).join('')}
  </ul>`;
}
