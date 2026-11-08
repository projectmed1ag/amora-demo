import { clock, dateLabel } from './collection-holiday-engine.js';
import { isHotelEventEdit } from './collection-holiday-edits.js?v=20261108-hotel-events-1';

export const hotelEventLabels = {
  event: 'Событие отеля',
  activity: 'Активность отеля',
  'theme-night': 'Тематический вечер',
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function eventEdit(event) {
  return { type: 'hotel-event', itemId: `hotel-event:${event.id}`, itemTitle: event.title, date: event.date, time: event.time, event };
}

export function mountHotelEvents(section, plan, city, onAdd) {
  const status = section.querySelector('[data-events-status]');
  const notice = section.querySelector('[data-events-notice]');
  const list = section.querySelector('[data-events-list]');
  const refresh = section.querySelector('[data-events-refresh]');
  const selected = new Map(plan.days.flatMap(day => day.items
    .filter(item => item.kind === 'hotel-event')
    .map(item => [item.eventId, { item, date: day.date }])));
  const query = new URLSearchParams({ city, dateFrom: plan.answers.startDate, dateTo: plan.answers.endDate });

  async function load() {
    refresh.disabled = true;
    notice.hidden = true;
    list.hidden = true;
    list.replaceChildren();
    status.textContent = 'Загружаем афишу…';
    try {
      const response = await fetch(`/api/local-booking/events?${query}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Events unavailable');
      const { events } = await response.json();
      if (!Array.isArray(events)) throw new Error('Invalid events');
      const edits = events.filter(event => event && event.date >= plan.answers.startDate
        && event.date <= plan.answers.endDate).map(eventEdit).filter(isHotelEventEdit);
      if (!section.isConnected) return;
      const latest = new Map(edits.map(edit => [edit.event.id, edit.event]));
      const changed = [...selected].filter(([id, { item, date }]) => {
        const event = latest.get(id);
        return !event || event.date !== date || event.time !== clock(item.start) || event.endTime !== clock(item.end)
          || event.title !== item.title || event.type !== item.eventType
          || (event.location || '') !== (item.location || '') || (event.description || '') !== (item.detail || '');
      }).map(([, { item }]) => `«${item.title}»`);
      if (changed.length) {
        notice.textContent = `Афиша обновилась. Проверьте время и статус в своём плане: ${changed.join(', ')}.`;
        notice.hidden = false;
      }
      if (!edits.length) {
        status.textContent = 'На даты вашей поездки пока нет запланированных мероприятий.';
        return;
      }
      status.textContent = 'Выберите, что добавить в расписание. Время указано по Москве.';
      list.innerHTML = edits.map(({ event }, index) => `<li class="planner-afisha-event">
        <div>
          <p class="planner-eyebrow">${esc(hotelEventLabels[event.type])}</p>
          <h4>${esc(event.title)}</h4>
          <p class="planner-afisha-time"><time datetime="${esc(event.date)}T${esc(event.time)}+03:00">${esc(dateLabel(event.date))}, ${esc(event.time)}</time>–${esc(event.endTime)}${event.location ? ` · ${esc(event.location)}` : ''}</p>
          ${event.description ? `<p class="planner-afisha-description">${esc(event.description)}</p>` : ''}
        </div>
        ${selected.has(event.id)
          ? '<span class="planner-afisha-added">В плане</span>'
          : `<button type="button" class="planner-button planner-button-light" data-add-event="${index}" aria-label="Добавить в план: ${esc(event.title)}">Добавить в план</button>`}
        <p class="planner-afisha-error" role="alert"></p>
      </li>`).join('');
      for (const button of list.querySelectorAll('[data-add-event]')) {
        button.addEventListener('click', () => {
          const alert = button.closest('li').querySelector('.planner-afisha-error');
          alert.textContent = onAdd(edits[Number(button.dataset.addEvent)]) || '';
        });
      }
      list.hidden = false;
    } catch {
      if (section.isConnected) status.textContent = 'Афиша сейчас недоступна. Попробуйте обновить её позже.';
    } finally {
      refresh.disabled = false;
    }
  }

  refresh.addEventListener('click', load);
  load();
}
