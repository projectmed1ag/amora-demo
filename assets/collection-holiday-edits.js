import { onsiteInterests, services } from './collection-holiday-data.js';
import { clock, createInterestItem, createServiceItem, dateNumber, familyActivity, isBreakfastTime, minutes, notesForSchedule, withScheduleGaps } from './collection-holiday-engine.js';

const fixedKinds = new Set(['arrival', 'departure', 'visit', 'free']);
const hotelEventTypes = new Set(['event', 'activity', 'theme-night']);

export function canEditScheduleItem(item) {
  return Boolean(item?.id && item.end > item.start && !fixedKinds.has(item.kind));
}

export function canMoveScheduleItem(item) {
  return canEditScheduleItem(item) && item.kind !== 'hotel-event';
}

export function isHotelEventEdit(edit) {
  const event = edit?.event;
  if (edit?.type !== 'hotel-event' || !event || typeof event.id !== 'string' || !event.id.trim()
    || edit.itemId !== `hotel-event:${event.id}` || !hotelEventTypes.has(event.type)) return false;
  if (typeof event.title !== 'string' || !event.title.trim() || event.title.length > 120 || edit.itemTitle !== event.title) return false;
  if (typeof event.date !== 'string' || event.date !== edit.date || !Number.isFinite(dateNumber(event.date))) return false;
  if (typeof event.time !== 'string' || event.time !== edit.time || typeof event.endTime !== 'string'
    || !(minutes(event.endTime) > minutes(event.time))) return false;
  return (event.location == null || (typeof event.location === 'string' && event.location.length <= 160))
    && (event.description == null || (typeof event.description === 'string' && event.description.length <= 2000));
}

function hotelEventTemplate(event) {
  const { id, title, type, location, description, time, endTime } = event;
  return {
    kind: 'hotel-event', eventId: id, eventType: type, title,
    duration: minutes(endTime) - minutes(time),
    location: location?.trim() || '', detail: description?.trim() || '',
  };
}

function replacementTemplates(answers, date) {
  const templates = [
    { id: 'rest', kind: 'rest', title: 'Передышка', duration: 30, detail: 'Свободное время для отдыха.' },
    { id: 'walk', kind: 'activity', title: 'Прогулка по территории', duration: 45, detail: 'Выберите открытый маршрут по территории с учётом погоды.', page: 'leisure-nature.html' },
  ];
  if (answers.children) {
    const family = familyActivity(answers);
    templates.push(
      { ...family, id: 'family' },
      { ...family, id: 'family:short', title: 'Короткое семейное занятие', duration: 30 },
    );
  }
  for (const { id } of onsiteInterests) {
    templates.push({ ...createInterestItem(id, date, answers), id: `activity:${id}` });
  }
  for (const { id } of services) templates.push({ ...createServiceItem(answers, id), id: `service:${id}` });
  return templates;
}

function validWindow(start, end) {
  return Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= 1440 && start < end;
}

function fitsFreeWindow(day, start, end) {
  return day.items.some(item => item.kind === 'free' && start >= item.start && end <= item.end);
}

export function scheduleReplacementOptions(plan, date, { windowStart, windowEnd } = {}) {
  const day = plan.days.find(day => day.date === date);
  if (!day) return [];
  const inWindow = windowStart !== undefined || windowEnd !== undefined;
  if (inWindow && (!validWindow(windowStart, windowEnd) || !fitsFreeWindow(day, windowStart, windowEnd))) return [];
  const limit = inWindow ? windowEnd - windowStart : Infinity;
  return [
    ...replacementTemplates(plan.answers, date)
      .filter(option => option.duration <= limit && (inWindow || option.id !== 'family:short'))
      .map(({ id, title, duration }) => ({ id, title, duration })),
    { id: 'custom', title: 'Своё занятие', duration: Math.min(30, limit) },
  ];
}

export function applyScheduleEdit(plan, edit) {
  const reject = error => ({ plan, error });
  if (!['move', 'replace', 'remove', 'add', 'hotel-event'].includes(edit?.type)) return reject('Выберите действие с занятием.');
  const hotelEvent = edit.type === 'hotel-event';
  if (hotelEvent && !isHotelEventEdit(edit)) return reject('Не удалось прочитать дату и время события отеля. Обновите список событий.');
  const adding = edit.type === 'add' || hotelEvent;
  if (adding && (typeof edit.itemId !== 'string' || !edit.itemId.trim())) return reject('Не удалось создать занятие. Попробуйте ещё раз.');
  const sourceDay = plan.days.find(day => day.items.some(item => item.id === edit.itemId));
  const original = sourceDay?.items.find(item => item.id === edit.itemId);
  if (adding && original) return reject('Это занятие уже есть в плане.');
  if (!adding && !original) return reject('Это занятие отсутствует в текущем плане.');
  if (!adding && !canEditScheduleItem(original)) return reject('Это время задаётся датами поездки или рассчитывается автоматически.');
  if (['move', 'replace'].includes(edit.type) && !canMoveScheduleItem(original)) return reject('Отель назначает время события. Его можно убрать из плана.');

  let targetDay = sourceDay;
  let changed;
  let replacementId;
  if (edit.type !== 'remove') {
    targetDay = plan.days.find(day => day.date === (edit.date ?? sourceDay?.date));
    if (!targetDay) return reject(hotelEvent ? 'Дата события выходит за даты отдыха.' : 'Выберите день в пределах поездки.');
    const start = minutes(edit.time ?? (original && clock(original.start)));
    if (!Number.isFinite(start)) return reject('Укажите время начала.');

    let template = original;
    if (hotelEvent) template = hotelEventTemplate(edit.event);
    else if (adding || edit.type === 'replace') {
      replacementId = edit.replacementId;
      if (replacementId === 'custom') {
        const title = typeof edit.title === 'string' ? edit.title.trim() : '';
        if (!title || title.length > 100) return reject('Введите название занятия длиной до 100 символов.');
        if (!Number.isInteger(edit.duration) || edit.duration <= 0) return reject('Укажите длительность в целых минутах.');
        template = { kind: 'custom', title, duration: edit.duration, detail: 'Добавлено вручную.' };
      } else {
        template = replacementTemplates(plan.answers, targetDay.date).find(option => option.id === replacementId);
        if (!template) return reject('Выберите занятие из списка.');
      }
    }

    const end = start + template.duration;
    if (start < targetDay.start || end > targetDay.end) return reject(hotelEvent
      ? 'Событие отеля выходит за пределы расписания этого дня.'
      : 'Занятие выходит за пределы выбранного дня. Укажите другое время или дату.');
    if (template.meal === 'breakfast' && !isBreakfastTime(start, end)) return reject('Завтрак должен полностью уложиться в интервал с 07:00 до 10:00.');
    const conflict = targetDay.items.find(item => item.id !== edit.itemId && item.kind !== 'free' && start < item.end && item.start < end);
    if (conflict) return reject(`Пересечение с «${conflict.title}» в ${clock(conflict.start)}.${hotelEvent ? '' : ' Выберите свободное время.'}`);
    if (adding) {
      const { windowStart, windowEnd } = edit;
      const inWindow = windowStart !== undefined || windowEnd !== undefined;
      if (inWindow && (!validWindow(windowStart, windowEnd) || start < windowStart || end > windowEnd)) return reject('Занятие должно полностью уложиться в выбранное свободное окно.');
      if (!fitsFreeWindow(targetDay, start, end)) return reject('Этот промежуток больше не свободен. Выберите другое время.');
    }

    changed = { ...template, id: edit.itemId, start, end, detail: template.baseDetail ?? template.detail, edited: true };
    if (template.tracks) {
      const shift = start - (template.start ?? start);
      changed.tracks = template.tracks.map(track => ({
        ...track, start: (track.start ?? template.start ?? start) + shift, end: (track.end ?? template.end ?? end) + shift,
      }));
    }
  }

  const days = plan.days.map(day => {
    if (day !== sourceDay && day !== targetDay) return day;
    const items = day.items.filter(item => item.id !== edit.itemId);
    if (day === targetDay && changed) items.push(changed);
    return withScheduleGaps({ ...day, items }, plan.answers.pace);
  });
  const resolved = new Set([edit.itemId, replacementId]);
  if (changed?.kind === 'family') {
    resolved.add('family');
    resolved.add('family:shared');
  }
  const unplaced = plan.unplaced.filter(item => !item.id || !resolved.has(item.id));
  return { plan: { ...plan, days, unplaced, notes: notesForSchedule({ answers: plan.answers, days }) }, error: '' };
}

export function replayScheduleEdits(plan, edits = []) {
  const errors = [];
  let current = plan;
  for (const edit of edits) {
    const result = applyScheduleEdit(current, edit);
    if (result.error) errors.push({ edit, error: result.error });
    else current = result.plan;
  }
  return { plan: current, errors };
}
