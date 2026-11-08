import { onsiteInterests, services, attractions, childActivityOptions, outingTransports, routeIdeas, mapRoute, demoOrigin, demoOriginLabel, estimateOutingTravel, demoLocalRoute, localRouteDescriptions } from './collection-holiday-data.js?v=20261108-route-pdf-1';
import { getSeasonForDate, seasonLabels } from './collection-seasons.js';

const DAY = 86400000;
const breakfastStart = 7 * 60;
const breakfastEnd = 11 * 60;
const outingReserveMinutes = 30;
const visitReserveMinutes = 75;
const maxStayDays = 31;
const interestCatalog = new Map(onsiteInterests.map(item => [item.id, item]));
export const minutes = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN;
export const clock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
export const breakfastNotice = `Завтрак подают ежедневно с ${clock(breakfastStart)} до ${clock(breakfastEnd)}.`;
export const isBreakfastTime = (start, end) => start >= breakfastStart && end <= breakfastEnd;
export function dateNumber(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || value.startsWith('0000')) return NaN;
  const n = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value ? n : NaN;
}
export const addDays = (value, count) => new Date(dateNumber(value) + count * DAY).toISOString().slice(0, 10);
export const dateLabel = value => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'short', timeZone: 'UTC' }).format(new Date(dateNumber(value)));
export const availableInterestOnDate = (id, date) => Boolean(interestCatalog.get(id)?.seasons.includes(getSeasonForDate(date)));
export const isWarm = date => availableInterestOnDate('bike', date);

export function availableInterestInStay(id, startDate, endDate) {
  const count = (dateNumber(endDate) - dateNumber(startDate)) / DAY + 1;
  if (!(count >= 1 && count <= maxStayDays)) return false;
  for (let index = 0; index < count; index++) {
    if (availableInterestOnDate(id, addDays(startDate, index))) return true;
  }
  return false;
}

export function interestSeasonLabel(id) {
  const seasons = interestCatalog.get(id)?.seasons ?? [];
  return seasons.length === Object.keys(seasonLabels).length ? 'Круглый год' : seasons.map(season => seasonLabels[season]).join(', ');
}

export function unavailableInterestReason(id) {
  return `Занятие вне сезона для выбранных дат. На сайте оно указано для следующих сезонов — ${interestSeasonLabel(id).toLocaleLowerCase('ru')}.`;
}

const transportConfirmations = {
  taxi: 'Проверьте вместимость, стоимость и возможность заказать такси на обратный путь.',
  transfer: 'Уточните в отеле возможность трансфера, время подачи, вместимость, стоимость и обратную поездку.',
  guided: 'Уточните у отеля или организатора программу, место встречи, продолжительность, транспорт и обратную дорогу.',
};

export function includesSightseeing(a) {
  if (a.outingMode != null) return a.outingMode === 'visit';
  return Array.isArray(a.interests) && a.interests.includes('sights');
}

export function excursionSettings(a, id) {
  const outing = a.outings?.[id];
  const transport = outing?.transport ?? a.transport;
  return {
    transport,
    excursionDate: outing?.excursionDate ?? a.excursionDate ?? '',
    excursionTime: outing?.excursionTime ?? a.excursionTime ?? '',
    ...estimateOutingTravel(attractions.find(place => place.id === id), transport, a.origin || demoOrigin),
    visitMinutes: visitReserveMinutes,
  };
}

export const outingDurationMinutes = ({ travelMinutes }) => travelMinutes * 2 + visitReserveMinutes + outingReserveMinutes;

export function validateAnswers(a, today = '', currentMinute = -1) {
  const errors = {};
  const start = dateNumber(a.startDate), end = dateNumber(a.endDate);
  if (!Number.isFinite(start) || (today && a.startDate < today)) errors.startDate = 'Выберите дату начала отдыха не раньше сегодняшнего дня.';
  if (!Number.isFinite(end) || end < start) errors.endDate = 'Дата отъезда должна быть не раньше даты приезда.';
  else if ((end - start) / DAY >= maxStayDays) errors.endDate = 'Помощник составляет программу максимум на 31 календарный день.';
  if (!Number.isFinite(minutes(a.arrival))) errors.arrival = 'Укажите время приезда.';
  else if (a.startDate === today && minutes(a.arrival) <= currentMinute) errors.arrival = 'Выберите время приезда позже текущего московского времени.';
  if (!Number.isFinite(minutes(a.departure))) errors.departure = 'Укажите время отъезда.';
  else if (start === end && minutes(a.departure) <= minutes(a.arrival)) errors.departure = 'Для отдыха одним днём отъезд должен быть позже приезда.';
  if (!Number.isInteger(a.adults) || a.adults < 1 || a.adults > 20) errors.adults = 'Укажите от 1 до 20 взрослых.';
  if (!Number.isInteger(a.children) || a.children < 0 || a.children > 10) errors.children = 'Укажите от 0 до 10 детей.';
  else if (a.adults + a.children > 20) errors.children = 'Этот помощник составляет программу для компании до 20 человек.';
  if (a.children && (a.ages?.length !== a.children || a.ages.some(age => !Number.isInteger(age) || age < 0 || age > 17))) errors.ages = 'Укажите возраст каждого ребёнка от 0 до 17 лет.';
  if (a.children > 0 && a.childActivities != null) {
    const selected = Array.isArray(a.childActivities) ? a.childActivities.map(id => childActivityOptions.find(option => option.id === id)) : null;
    if (!selected || selected.some(option => !option)) errors.childActivities = 'Проверьте выбранные детские занятия.';
    else if (!errors.ages && selected.some(option => !a.ages.some(age => age >= option.minAge))) errors.childActivities = 'Выберите занятия, которые подходят по возрасту хотя бы одному ребёнку.';
  }
  if (!['calm', 'balanced', 'active'].includes(a.pace)) errors.pace = 'Выберите желаемый темп.';
  if (!['together', 'separate'].includes(a.familyMode)) errors.familyMode = 'Выберите формат семейного отдыха.';
  if (a.interests != null && (!Array.isArray(a.interests) || a.interests.some(id => id !== 'sights' && !interestCatalog.has(id)))) errors.interests = 'Проверьте выбранные занятия.';
  if (a.outingMode != null && !['stay', 'visit'].includes(a.outingMode)) errors.outingMode = 'Выберите отдых на территории или выезды к достопримечательностям.';
  if (!Number.isFinite(minutes(a.wake)) || !Number.isFinite(minutes(a.rest)) || minutes(a.rest) - minutes(a.wake) < 120) errors.wake = 'Между началом дня и вечерним отдыхом должно быть хотя бы 2 часа.';
  if (a.services?.some(id => !services.some(item => item.id === id))) errors.services = 'Проверьте выбранные услуги.';
  for (const id of a.services || []) if (!Number.isFinite(minutes(a.preferred?.[id]))) errors[id] = 'Укажите предпочтительное время.';
  if (includesSightseeing(a)) {
    const selected = Array.isArray(a.places) ? [...new Set(a.places)] : [];
    const destinations = attractions.filter(place => selected.includes(place.id));
    if (!selected.length || destinations.length !== selected.length) errors.places = 'Выберите хотя бы одну достопримечательность.';
    const perPlace = a.outingMode === 'visit' || a.outings != null;
    for (const place of destinations) {
      const outing = excursionSettings(a, place.id);
      const report = (field, message) => {
        const key = perPlace ? `outing-${place.id}-${field}` : field;
        errors[key] = perPlace ? `${place.title}. ${message}` : message;
      };
      if (!Object.hasOwn(outingTransports, outing.transport)) report('transport', 'Выберите способ добраться.');
      if (outing.excursionDate && (!Number.isFinite(dateNumber(outing.excursionDate)) || outing.excursionDate < a.startDate || outing.excursionDate > a.endDate)) report('excursionDate', 'Выберите дату выезда в пределах поездки.');
      if (outing.excursionTime && !Number.isFinite(minutes(outing.excursionTime))) report('excursionTime', 'Укажите желаемое время отправления.');
    }
  }
  return errors;
}

function freeRanges(day, from = day.start, to = day.end, buffer = 0) {
  let cursor = Math.max(day.start, from);
  const end = Math.min(day.end, to);
  const free = [];
  for (const item of [...day.items].sort((a, b) => a.start - b.start)) {
    const busyStart = item.start - buffer, busyEnd = item.end + buffer;
    if (busyEnd <= cursor || busyStart >= end) continue;
    if (busyStart > cursor) free.push([cursor, Math.min(busyStart, end)]);
    cursor = Math.max(cursor, busyEnd);
  }
  if (cursor < end) free.push([cursor, end]);
  return free;
}

export function withScheduleGaps(day, pace) {
  const items = day.items.filter(item => item.kind !== 'free');
  for (const [start, end] of freeRanges({ ...day, items })) {
    const short = end - start < 30;
    items.push({ kind: 'free', title: short ? 'Переход и небольшой перерыв' : pace === 'calm' ? 'Свободное время без планов' : 'Свободное время и восстановление',
      start, end, duration: end - start,
      detail: short ? 'Время собраться и спокойно перейти к следующему занятию.' : 'Программа оставляет место для отдыха и ваших спонтанных желаний.' });
  }
  return { ...day, items: items.sort((a, b) => a.start - b.start) };
}

function availableStart(day, duration, preferred, from, to, target) {
  const candidates = freeRanges(day, from, to, 15).filter(([a, b]) => b - a >= duration)
    .map(([a, b]) => Math.max(a, Math.min(target, b - duration)));
  candidates.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b);
  return candidates[0];
}

function scheduleItem(day, item, start) {
  const end = start + item.duration;
  const placed = { ...item, start, end };
  if (item.tracks) placed.tracks = item.tracks.map(track => ({ ...track, start, end }));
  day.items.push(placed);
  return placed;
}

function insert(day, item, preferred, from = day.start, to = day.end) {
  const start = availableStart(day, item.duration, preferred, from, to, Math.ceil(preferred / 15) * 15);
  return start === undefined ? null : scheduleItem(day, item, start);
}

function orderedDays(days, kind) {
  const weight = day => kind ? day.items.filter(item => item.kind === kind).length : 0;
  return [...days].sort((a, b) => weight(a) - weight(b));
}

function placeAcross(days, item, preferred, options = {}) {
  for (const day of orderedDays(days, options.oncePerDay)) {
    const placed = insert(day, typeof item === 'function' ? item(day) : item, preferred, options.from ?? 0, options.to ?? 1440);
    if (placed) return placed;
  }
  return null;
}

function placeClosestOuting(days, item, preferred, { from, to, oncePerDay }) {
  const slots = orderedDays(days, oncePerDay)
    .map(day => ({ day, start: availableStart(day, item.duration, preferred, from, to, preferred) }))
    .filter(slot => slot.start !== undefined);
  slots.sort((a, b) => Math.abs(a.start - preferred) - Math.abs(b.start - preferred));
  return slots.length ? scheduleItem(slots[0].day, item, slots[0].start) : null;
}

function activity(id, a) {
  if (id === 'beach') return {
    title: 'Спокойный отдых у воды', duration: a.pace === 'calm' ? 120 : 60,
    detail: 'Оставьте время для чтения и отдыха с видом на водохранилище. К берегу можно выйти при подходящей погоде.',
  };
  const suggestion = {
    walk: { title: 'Прогулка у воды', duration: 60, detail: routeIdeas.walk, page: 'leisure-nature.html' },
    bike: { title: 'Велопрогулка', duration: a.pace === 'active' ? 90 : 60, detail: routeIdeas.bike, page: 'leisure-active.html' },
    buggy: { title: 'Багги с инструктором', duration: 90, detail: routeIdeas.buggy, page: 'leisure-buggy.html', confirmation: 'Подтвердить прокат, инструктора и условия участия.' },
  }[id];
  if (!suggestion) {
    const { title, detail, duration, page, confirmation } = interestCatalog.get(id);
    return { title, detail, duration, page, ...(confirmation && { confirmation }) };
  }
  if (['walk', 'bike'].includes(id) && (!a.origin?.trim() || a.origin.trim() === demoOrigin)) return {
    ...suggestion,
    detail: `${localRouteDescriptions[id]} Это временная точка старта A’MORE Collection. Точное место въезда в отель уточняется. Проверьте движение и состояние дороги.`,
    route: demoLocalRoute(id), routeLabel: id === 'bike' ? 'Пример веломаршрута' : 'Пример пешего маршрута',
  };
  if (id === 'buggy' && a.children) {
    if (canSplitFamily(a)) return parallelActivity(a, suggestion, 'Багги для взрослых и детская программа');
    return { ...suggestion, title: 'Семейный выезд на багги — по согласованию', detail: `${suggestion.detail} Сначала подтвердите допустимый возраст и состав семейного экипажа. Пока условия не подтверждены, используйте этот интервал для совместной прогулки, без поездки на багги.` };
  }
  return suggestion;
}

export function createInterestItem(id, date, a) {
  if (!availableInterestOnDate(id, date)) return null;
  return { kind: 'activity', ...activity(id, a), interest: id };
}

function childrenProgramme(a, together = false) {
  if (a.childActivities?.length) {
    const selected = childActivityOptions.filter(option => a.childActivities.includes(option.id));
    const youngest = Math.min(...a.ages);
    const alternatives = selected.length > 1 ? 'В этом блоке можно выбрать одно из занятий. ' : '';
    const title = option => !together && option.id === 'walk' ? 'Короткая прогулка' : option.title;
    const activities = selected.map(option => {
      const age = youngest < option.minAge ? ` (от ${option.minAge} лет)` : '';
      const detail = option.detail[0].toLocaleLowerCase('ru') + option.detail.slice(1);
      return `${title(option)}${age} — ${detail}.`;
    });
    if (selected.some(option => youngest < option.minAge)) {
      const forAllAges = selected.find(option => youngest >= option.minAge);
      activities.push(forAllAges
        ? `Младшим подойдёт вариант «${title(forAllAges)}» рядом с сопровождающим.`
        : 'Для младших можно устроить спокойную игру рядом с сопровождающим.');
    }
    return alternatives + activities.join(' ');
  }
  const groups = [];
  if (a.ages.some(age => age < 3)) groups.push('До 3 лет — спокойная игра рядом со взрослым, с паузами для сна и кормления');
  if (a.ages.some(age => age >= 3 && age < 7)) groups.push('3–6 лет — короткие творческие игры и задания на внимание');
  if (a.ages.some(age => age >= 7 && age < 13)) groups.push('7–12 лет — командный квест на территории и пауза на перекус');
  if (a.ages.some(age => age >= 13)) groups.push('13–17 лет — командные задания и игры по интересам');
  return groups.map(group => `${group}.`).join(' ');
}

function canSplitFamily(a) {
  return a.children > 0 && a.familyMode === 'separate' && (a.adults >= 2 || a.ages.every(age => age >= 3));
}

function parallelActivity(a, adult, title = 'Параллельная программа для детей и взрослых') {
  const withParent = a.ages.some(age => age < 3);
  const child = {
    audience: withParent ? 'Дети с одним взрослым' : 'Дети',
    title: withParent ? 'Игры и отдых со взрослым' : 'Программа с аниматором по возрасту',
    detail: childrenProgramme(a),
    page: 'leisure-children.html',
  };
  return {
    kind: 'parallel',
    title,
    duration: adult.duration,
    detail: withParent
      ? 'Один взрослый остаётся со всеми детьми на весь интервал. Остальные взрослые занимаются своей программой и возвращаются к указанному времени.'
      : 'Занятия идут одновременно, если аниматор подтвердил сопровождение на весь интервал. Заложите время на встречу с аниматором до и после занятия. Взрослые остаются на связи.',
    tracks: [child, { ...adult, audience: withParent ? 'Остальные взрослые' : 'Взрослые' }],
    fallback: 'Если сопровождение или выбранное занятие не подтверждено, проведите этот интервал вместе: короткая прогулка и игры на территории.',
    confirmation: [withParent ? '' : 'Подтвердить аниматора, условия по возрасту и сопровождение на весь интервал.', adult.confirmation].filter(Boolean).join(' '),
  };
}

function adultBreak(a) {
  if (a.pace === 'active') return { title: 'Бодрая прогулка по территории', duration: 75, detail: 'Выберите доступный круг по территории и оставьте время, чтобы вернуться к месту встречи.', page: 'leisure-nature.html' };
  if (a.pace === 'balanced') return { title: 'Короткая прогулка и передышка', duration: 60, detail: 'Выберите ближайшую прогулочную тропу и оставьте время на отдых перед встречей с детьми.', page: 'leisure-nature.html' };
  return { title: 'Спокойный отдых с видом на воду', duration: 45, detail: 'Время для чтения, отдыха или неспешной прогулки рядом с местом встречи.' };
}

export function familyActivity(a) {
  const youngChild = a.ages.some(age => age < 3);
  return {
    kind: 'family',
    title: youngChild ? 'Семейное время с малышом' : 'Общая семейная программа',
    duration: youngChild || a.pace === 'calm' ? 45 : 75,
    detail: `${childrenProgramme(a, true)} Взрослые участвуют вместе с детьми.`,
    page: 'leisure-children.html',
  };
}

export function createServiceItem(a, id) {
  const service = services.find(item => item.id === id);
  const familyBanya = id === 'banya' && a.children;
  return {
    kind: 'service', service: id, title: service.title, duration: service.duration, page: service.page,
    detail: `${service.detail}. Фактическое наличие мест и режим работы подтверждаются отдельно.`,
    confirmation: familyBanya
      ? 'Уточнить условия посещения с детьми и подтвердить время. Если детям посещение недоступно, выберите другое совместное занятие.'
      : id === 'barbecue' ? 'Согласовать мангальную зону и время с командой отеля.' : 'Проверить и подтвердить выбранное время отдельно.',
  };
}

export function notesForSchedule({ answers, days }) {
  const items = days.flatMap(day => day.items);
  const notes = [];
  if (items.some(item => item.kind === 'excursion') && (!answers.origin?.trim() || answers.origin.trim() === demoOrigin)) notes.push(`${demoOriginLabel} Время в пути ориентировочное, без учёта пробок. Перед поездкой уточните точку старта и сверьтесь с картой.`);
  if (items.some(item => item.kind === 'family') && answers.familyMode === 'separate' && !canSplitFamily(answers)) notes.push('При одном взрослом и ребёнке до 3 лет помощник предлагает совместную программу. Для раздельного отдыха нужно отдельно организовать сопровождение малыша.');
  if (items.some(item => ['walk', 'bike', 'buggy'].includes(item.interest))) notes.push('Маршруты активностей — предложенные схемы. Утверждённые треки отеля пока не предоставлены; точный путь покажет команда отеля или инструктор.');
  return notes;
}

export function buildHolidayPlan(a, { today = '', currentMinute = -1 } = {}) {
  const errors = validateAnswers(a, today, currentMinute);
  if (Object.keys(errors).length) return { errors, days: [], unplaced: [], notes: [] };
  const days = [], unplaced = [];
  const count = (dateNumber(a.endDate) - dateNumber(a.startDate)) / DAY + 1;
  for (let i = 0; i < count; i++) {
    const date = addDays(a.startDate, i), first = i === 0, last = i === count - 1;
    const start = first ? minutes(a.arrival) : minutes(a.wake);
    const departure = last ? minutes(a.departure) : 1440;
    const end = Math.min(departure, first && start >= minutes(a.rest) ? Math.min(1439, start + 45) : minutes(a.rest));
    const day = { date, start, end: Math.max(start, end), items: [] };
    days.push(day);
    if (first && last && departure - start <= 60) {
      day.end = departure;
      day.items.push({ kind: 'visit', title: 'Короткий визит', start, end: departure, duration: departure - start, detail: 'Оставьте время на приезд, короткую передышку и сборы перед отъездом.' });
      continue;
    }
    if (end > start && first) insert(day, { kind: 'arrival', title: 'Приезд и время устроиться', duration: Math.min(30, end - start), detail: 'Спокойно разместиться и познакомиться с территорией.' }, start);
    if (last) {
      const prepareStart = Math.max(first ? minutes(a.arrival) : 0, departure - 30);
      // Departure may be earlier than the usual morning or later than the active day.
      day.items.push({ kind: 'departure', title: departure ? 'Сборы и отъезд' : 'Отъезд в полночь', start: prepareStart, end: departure, duration: departure - prepareStart, detail: departure ? 'Оставьте время проверить вещи и подготовиться к дороге.' : 'Завершение поездки в начале этого календарного дня. Соберите вещи накануне.' });
      // For a very short visit, arrival and departure share the available window.
      const arrival = day.items.find(item => item.kind === 'arrival');
      if (arrival && arrival.end > prepareStart) {
        arrival.end = prepareStart; arrival.duration = prepareStart - arrival.start;
        if (!arrival.duration) day.items.splice(day.items.indexOf(arrival), 1);
      }
    }
    insert(day, { kind: 'meal', meal: 'breakfast', title: 'Завтрак', duration: 45, detail: 'Предложенное время для завтрака.' },
      Math.max(start, breakfastStart), breakfastStart, breakfastEnd);
  }

  for (const id of new Set(a.services || [])) {
    const preferred = minutes(a.preferred[id]);
    const service = createServiceItem(a, id);
    const item = {
      ...service, id: `service:${id}`, baseDetail: service.detail,
      detail: `${service.detail} Ваше пожелание по времени — ${a.preferred[id]}.`,
    };
    const exactTime = preferred >= 11 * 60 && preferred + item.duration <= 21 * 60
      && placeAcross(days, item, preferred, { from: preferred, to: preferred + item.duration, oncePerDay: 'service' });
    if (!exactTime && !placeAcross(days, item, preferred, { from: 11 * 60, to: 21 * 60, oncePerDay: 'service' })) unplaced.push({ id: item.id, title: item.title, reason: 'Для полного сеанса не нашлось свободного времени. Увеличьте длительность отдыха или уберите одно из занятий.' });
  }

  if (includesSightseeing(a)) {
    const priority = outing => (outing.excursionDate ? 2 : 0) + (outing.excursionTime ? 1 : 0);
    const outings = [...new Set(a.places)].map(id => ({ id, ...excursionSettings(a, id) }));
    outings.sort((first, second) => priority(second) - priority(first));
    for (const { id, transport, excursionDate, excursionTime, travelMinutes: road, travelEstimateSource, visitMinutes: visit } of outings) {
      const place = attractions.find(item => item.id === id);
      const transportConfirmation = transportConfirmations[transport];
      const desiredTime = excursionTime ? ` Желаемое отправление ${excursionTime}.` : '';
      const originNote = travelEstimateSource === 'default-origin' ? ' Оценка от условной точки в Горетове.'
        : travelEstimateSource === 'coordinates' ? ' Оценка по расстоянию между точками.' : '';
      const baseDetail = `${outingTransports[transport].title}. Дорога примерно по ${road} мин в каждую сторону. На посещение заложено ${visit} мин, ещё ${outingReserveMinutes} мин на сборы и остановки.${originNote}`;
      const item = {
        id: `excursion:${id}`, kind: 'excursion', placeId: id, transport, travelMinutes: road, travelEstimateSource, visitMinutes: visit,
        title: place.title, duration: outingDurationMinutes({ travelMinutes: road }),
        baseDetail, detail: baseDetail + desiredTime,
        route: mapRoute(place, transport, a.origin || ''), source: place.source,
        routeLabel: transport === 'walk' ? 'Пеший маршрут' : 'Маршрут проезда на карте',
        confirmation: `Сверьте время в пути на карте и часы посещения.${transportConfirmation ? ` ${transportConfirmation}` : ''}`,
      };
      const candidateDays = excursionDate ? days.filter(day => day.date === excursionDate) : days;
      const preferred = excursionTime ? minutes(excursionTime) : 10 * 60;
      const legacyDaytime = a.outingMode == null && !excursionTime;
      const options = { from: legacyDaytime ? 9 * 60 : 0, to: legacyDaytime ? 17 * 60 : 1440, oncePerDay: 'excursion' };
      const scheduled = excursionTime ? placeClosestOuting(candidateDays, item, preferred, options) : placeAcross(candidateDays, item, preferred, options);
      if (!scheduled) {
        const reason = transport === 'walk' && road > 240
          ? `Пешком в одну сторону около ${road} мин. Посещение не поместилось в программу. Выберите транспорт или более близкое место.`
          : excursionDate
            ? 'На выбранную дату не поместился выезд с дорогой туда и обратно. Попробуйте изменить дату выезда или транспорт.'
            : 'Выезд с дорогой туда и обратно не поместился в программу. Попробуйте изменить транспорт или даты отдыха.';
        unplaced.push({ id: item.id, title: place.title, reason });
      } else if (excursionTime && scheduled.start !== preferred) {
        scheduled.detail += ` В расписании выезд сдвинут на ${clock(scheduled.start)}.`;
      }
    }
  }

  const selectedInterests = [...new Set(a.interests || [])].filter(id => id !== 'sights');
  const youngest = a.children ? Math.min(...a.ages) : Infinity;
  const suggestActivities = a.suggestActivities === true && !selectedInterests.length;
  let recurring = selectedInterests;
  if (suggestActivities) {
    recurring = a.pace === 'calm' && youngest >= 7 ? ['beach'] : ['walk'];
    if (a.pace === 'active' && days.some(day => isWarm(day.date))) recurring.push('beach');
  }
  const separate = canSplitFamily(a);
  if (youngest < 7) {
    for (const day of days) insert(day, { kind: 'rest', title: 'Тихий час и перерыв', duration: 60, detail: 'Пауза для ребёнка. Подстройте время под его привычный режим.' }, 14 * 60, 13 * 60, 16 * 60);
  }

  function interestItem(id, date) {
    const item = createInterestItem(id, date, a);
    if (!suggestActivities) return item;
    if (id === 'beach') return { ...item, duration: a.pace === 'calm' ? 60 : 45 };
    if (youngest < 7) return { ...item, title: 'Короткая семейная прогулка у воды', duration: 30 };
    if (a.pace === 'active') return { ...item, title: 'Бодрая прогулка у воды', duration: isWarm(date) ? 75 : 60 };
    return { ...item, duration: 45 };
  }

  function placeInterest(id) {
    const itemId = `activity:${id}`;
    const eligible = days.filter(day => availableInterestOnDate(id, day.date));
    const { preferred, from, to } = interestHours(id);
    const factory = day => ({ ...interestItem(id, day.date), id: itemId });
    const placed = placeAcross(eligible, factory, preferred, { from, to, oncePerDay: 'activity' });
    if (!placed && !suggestActivities) unplaced.push({
      id: itemId, title: interestCatalog.get(id).title,
      reason: eligible.length
        ? 'Не хватило цельного интервала с учётом дороги, еды и отдыха. Измените даты или сократите программу.'
        : unavailableInterestReason(id),
    });
  }

  function interestHours(id, later = false) {
    if (id === 'firepit') return { preferred: 19 * 60 + 30, from: 17 * 60, to: 21 * 60 };
    return { preferred: later ? 15 * 60 : 10 * 60 + 30, from: 9 * 60, to: id === 'beach' ? 19 * 60 : 17 * 60 };
  }

  // A selected buggy ride can be the adult programme in the same block.
  const splitBuggy = separate && recurring.includes('buggy');
  if (splitBuggy) placeInterest('buggy');
  if (a.children) {
    const item = separate ? parallelActivity(a, adultBreak(a)) : familyActivity(a);
    const shortBreak = { title: 'Короткая передышка', duration: 30, detail: 'Отдохните рядом с местом встречи с детьми.' };
    const shortItem = separate ? parallelActivity(a, shortBreak) : { ...item, duration: 30 };
    for (const day of days) {
      if (day.items.some(block => block.kind === 'parallel')) continue;
      if (!insert(day, item, 11 * 60, 9 * 60, 18 * 60)) insert(day, shortItem, 11 * 60, 9 * 60, 18 * 60);
    }
    if (!days.some(day => day.items.some(block => block.kind === 'parallel' || block.kind === 'family'))) {
      unplaced.push({ id: separate ? 'parallel' : 'family', title: separate ? 'Параллельная программа для детей и взрослых' : 'Семейная программа', reason: 'Свободного интервала не хватило. Сократите другие занятия или добавьте день.' });
    }
  }
  for (const id of selectedInterests) if (id !== 'buggy' || !splitBuggy) placeInterest(id);

  for (const day of days) {
    if (!day.items.some(item => item.service === 'restaurant' && item.start < 15 * 60)) insert(day, { kind: 'meal', meal: 'lunch', title: 'Обед в своём ритме', duration: 45, detail: 'Свободное время на обед; столик автоматически не бронируется.' }, 13 * 60, 12 * 60, 15 * 60);
    if (!day.items.some(item => ['restaurant', 'barbecue'].includes(item.service) && item.end > 17 * 60)) insert(day, { kind: 'meal', meal: 'dinner', title: 'Свободное время на ужин', duration: 45, detail: 'Выберите удобный формат ужина.' }, 19 * 60, 18 * 60, 21 * 60);
  }

  if (separate) {
    const shared = { ...familyActivity(a), id: 'family:shared', duration: 45,
      detail: 'Короткая прогулка или семейная игра на территории. Выберите занятие вместе с детьми с учётом погоды и их ритма.' };
    const options = { from: 9 * 60, to: 18 * 60 };
    if (!placeAcross(days, shared, 16 * 60, options) && !placeAcross(days, { ...shared, duration: 30 }, 16 * 60, options)) {
      unplaced.push({ id: shared.id, title: 'Общая семейная программа', reason: 'Не хватило свободного времени. Можно провести раздельный блок вместе или освободить время для общего занятия.' });
    }
  }

  // Optional suggestions fit around meals and the family programme.
  if (suggestActivities) for (const id of recurring) placeInterest(id);

  // Keep the chosen pace on longer stays using the same set of activities.
  days.forEach((day, index) => {
    const target = a.pace === 'active' ? 2 : 1;
    const planned = () => day.items.filter(item => ['activity', 'excursion', 'family', 'parallel'].includes(item.kind)).length;
    const eligible = recurring.filter(id => id !== 'pavilion' && availableInterestOnDate(id, day.date));
    for (let attempt = 0; eligible.length && planned() < target && attempt < target; attempt++) {
      const id = eligible[(index + attempt) % eligible.length];
      if (day.items.some(item => item.interest === id || (id === 'buggy' && separate && item.kind === 'parallel'))) continue;
      const { preferred, from, to } = interestHours(id, attempt > 0);
      insert(day, { ...interestItem(id, day.date), id: `activity:${id}:${day.date}` }, preferred, from, to);
    }
  });

  const schedule = days.map(day => {
    const items = day.items.map(item => ({ ...item, id: item.id || `${item.meal || item.kind}:${day.date}` }));
    return withScheduleGaps({ ...day, items }, a.pace);
  });
  return { errors: {}, answers: a, days: schedule, unplaced, notes: notesForSchedule({ answers: a, days: schedule }), timeZone: 'Московское время (UTC+3)' };
}

export function planToText(plan, { lodging } = {}) {
  if (Object.keys(plan.errors || {}).length) return '';
  const a = plan.answers;
  const lines = ['A’MORE Collection · План отдыха', 'Можайское водохранилище', `${a.startDate} — ${a.endDate} · ${plan.timeZone}`, `Взрослых: ${a.adults}. Детей: ${a.children}${a.children ? ` (возраст: ${a.ages.join(', ')} лет)` : ''}.`];
  if (lodging) lines.push(`Размещение: ${lodging}`);
  lines.push(breakfastNotice, 'Предварительная программа. Время предложено; бронирования и аниматор подтверждаются отдельно.', '');
  for (const day of plan.days) {
    lines.push(dateLabel(day.date).toLocaleUpperCase('ru'));
    for (const item of day.items) {
      lines.push(`${clock(item.start)}${item.end > item.start ? `–${clock(item.end)}` : ''} · ${item.title}`);
      if (item.location) lines.push(`  Место: ${item.location}`);
      if (item.detail) lines.push(`  ${item.detail}`);
      for (const track of item.tracks || []) {
        lines.push(`  ${clock(track.start ?? item.start)}–${clock(track.end ?? item.end)} · ${track.audience}: ${track.title}. ${track.detail}`);
        if (track.route) lines.push(`    Маршрут: ${track.route}`);
      }
      if (item.route) lines.push(`  Маршрут: ${item.route}`);
      if (item.confirmation) lines.push(`  Нужно подтвердить: ${item.confirmation}`);
      if (item.fallback) lines.push(`  Запасной вариант: ${item.fallback}`);
    }
    lines.push('');
  }
  if (plan.unplaced.length) lines.push('НЕ ВОШЛО В РАСПИСАНИЕ', ...plan.unplaced.map(item => `${item.title}: ${item.reason}`), '');
  lines.push(...plan.notes);
  return lines.join('\n');
}
