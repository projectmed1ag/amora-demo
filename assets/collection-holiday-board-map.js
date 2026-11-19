import { boardEscape as esc, boardIcon, boardMark, boardPhoto, isBoardActivity } from './collection-holiday-board.js?v=20261119-row-actions-1';
import { clock, createInterestItem, createServiceItem } from './collection-holiday-engine.js?v=20261119-board-1';

import { holidayMapPoints as points, drawHolidayMapPath } from './collection-holiday-map-path.js?v=20261119-showcase-1';

const places = {
  bike: 'rental', buggy: 'rental', 'sport-rental': 'rental', 'table-tennis': 'rental',
  sup: 'pier', beach: 'pier', walk: 'reception', restaurant: 'restaurant', banya: 'banya',
};
const pointActivities = {
  rental: ['activity', 'bike'], reception: ['activity', 'walk'], pier: ['activity', 'beach'],
  restaurant: ['service', 'restaurant'], banya: ['service', 'banya'],
};

export const hasBoardLocation = item => Boolean(placeFor(item) || item.route);

function placeFor(item) {
  return places[item.interest || item.service];
}

export function mountBoardMap(panel, { plan, day, lodging, marks, localDate, localMinute, selectedId }) {
  const active = day.items.filter(item => item.kind === 'service' || isBoardActivity(item));
  const complete = item => marks.has(boardMark(item, plan.answers));
  const next = day.date < localDate ? undefined : active.find(item => !complete(item) && (day.date !== localDate || item.end > localMinute));
  let event = active.find(item => item.id === selectedId) || next;
  let destination = event && placeFor(event);
  const last = active.filter(item => event && item.end <= event.start && complete(item) && placeFor(item)).at(-1);
  let origin = last ? placeFor(last) : 'house';
  const locationLabel = key => key === 'house' && lodging ? lodging : points[key].label;
  const agenda = day.items.filter(item => item.meal || active.includes(item));

  panel.innerHTML = `<div class="holiday-map-head">
    <div><h3 id="holiday-map-title" class="planner-sr-only">Схема территории</h3>
      <p>Схема территории. Точные места и проходы уточняйте у команды отеля.</p>
    </div>
    <button type="button" class="planner-button planner-button-light" data-map-next${next ? '' : ' disabled'}>Следующее занятие</button>
  </div>
  <div class="holiday-map-art">
      <img src="./images/holiday-board-map.webp" width="1440" height="960" alt="Иллюстрация территории с хаусботами, причалом и лесными тропами">
      <canvas width="1440" height="960" aria-hidden="true"></canvas>
      ${Object.entries(points).map(([key, point]) => `<button type="button" class="holiday-map-pin" data-map-point="${key}" style="--pin-x:${point.xy[0]}%;--pin-y:${point.xy[1]}%" aria-label="${esc(locationLabel(key))}" title="${esc(locationLabel(key))}">
        <span class="holiday-map-pin-icon">${boardIcon(key)}</span><span class="holiday-map-pin-label">${key === 'house' && lodging ? 'Мой хаусбот' : point.label}</span>
      </button>`).join('')}
  </div>
  <div class="holiday-map-layout">
    <div class="holiday-map-guide holiday-board-surface">
      <div class="holiday-map-info" aria-live="polite"></div>
      <div class="planner-field"><label for="holiday-origin">Откуда идём</label>
        <select id="holiday-origin">${Object.keys(points).map(key => `<option value="${key}">${esc(locationLabel(key))}</option>`).join('')}</select>
      </div>
      ${lodging ? '<p class="holiday-map-lodging">Выбранный хаусбот отмечен в общей зоне размещения.</p>' : '<button type="button" class="planner-edit" data-board-choose-room>Выбрать свой хаусбот</button>'}
    </div>
    <div class="holiday-map-agenda holiday-board-surface">
      <h4>День ${plan.days.indexOf(day) + 1}</h4>
      ${agenda.length ? `<ol class="holiday-map-schedule" aria-label="План выбранного дня">${agenda.map(item => {
        const label = `${clock(item.start)} · ${{ breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин' }[item.meal] || item.title}`;
        return `<li>${item.meal ? `<span>${esc(label)}</span>` : `<button type="button" data-map-item="${esc(item.id)}">${esc(label)}</button>`}</li>`;
      }).join('')}</ol>` : '<p>В этот день пока нет занятий.</p>'}
      <button type="button" class="planner-edit" data-board-tab="schedule">План дня</button>
    </div>
  </div>`;

  const select = panel.querySelector('select');
  const info = panel.querySelector('.holiday-map-info');
  const canvas = panel.querySelector('canvas');
  function render() {
    select.value = origin;
    for (const button of panel.querySelectorAll('[data-map-point]')) {
      button.setAttribute('aria-pressed', String(button.dataset.mapPoint === destination));
      button.toggleAttribute('data-map-origin', button.dataset.mapPoint === origin);
    }
    for (const button of panel.querySelectorAll('[data-map-item]')) {
      button.setAttribute('aria-pressed', String(button.dataset.mapItem === event?.id));
    }
    drawHolidayMapPath(canvas, origin, destination);
    const recommendation = pointActivities[destination];
    const suggested = !event && recommendation && (recommendation[0] === 'activity'
      ? createInterestItem(recommendation[1], day.date, plan.answers) : createServiceItem(plan.answers, recommendation[1]));
    const title = event?.title || suggested?.title || (destination && locationLabel(destination)) || 'Куда пойдём?';
    const description = destination && origin === destination ? 'Вы уже выбрали эту точку как место старта.'
      : destination ? `${locationLabel(origin)} → ${locationLabel(destination)}. Путь показан на схеме.`
      : event ? (event.route ? 'Для этого занятия доступен отдельный маршрут.' : 'Место встречи уточните у команды отеля.')
        : 'Выберите точку на карте или добавьте занятие в план.';
    const activity = event || suggested;
    const icon = activity?.interest || activity?.service || destination || 'map';
    const photo = boardPhoto(icon);
    info.innerHTML = `${photo ? `<img class="holiday-map-activity-photo" src="${photo}" alt="">` : ''}
      <div class="holiday-map-activity"><h4>${boardIcon(icon)}${esc(title)}</h4>
      ${event ? `<span>${clock(event.start)}–${clock(event.end)}${complete(event) ? ' · Выполнено' : ''}</span>` : suggested ? `<span>${suggested.duration} мин в плане</span>` : ''}
      <p>${esc(description)}</p>${activity?.route ? `<a href="${esc(activity.route)}" target="_blank" rel="noopener noreferrer">${esc(activity.routeLabel || 'Открыть маршрут')}</a>` : ''}
      ${activity?.interest === 'bike' ? '<a href="./contacts.html?city=mozhaysk">Согласовать маршрут</a>' : ''}
      ${event ? `<button type="button" class="planner-button planner-button-light" data-map-schedule-item="${esc(event.id)}">Открыть в расписании</button>` : ''}
      ${suggested ? `<button type="button" class="planner-button holiday-primary" data-map-add="${recommendation.join(':')}" data-tile-title="${esc(title)}">Добавить в план</button>` : ''}</div>`;
  }
  function selectItem(item) {
    if (!item) return;
    event = item;
    destination = placeFor(item);
    render();
  }
  panel.onclick = click => {
    const button = click.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-map-next')) selectItem(next);
    if (button.dataset.mapItem) selectItem(active.find(item => item.id === button.dataset.mapItem));
    if (button.dataset.mapPoint) {
      event = undefined;
      destination = button.dataset.mapPoint;
      render();
    }
  };
  select.addEventListener('change', () => {
    origin = select.value;
    render();
  });
  render();
}
