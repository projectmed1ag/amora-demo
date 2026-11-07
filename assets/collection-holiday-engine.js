import { interests, services, attractions, routeIdeas, mapRoute, demoOrigin, demoOriginLabel, minimumWalkMinutes, demoLocalRoute } from './collection-holiday-data.js';

const DAY = 86400000;
export const minutes = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN;
export const clock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
export function dateNumber(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || value.startsWith('0000')) return NaN;
  const n = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value ? n : NaN;
}
export const addDays = (value, count) => new Date(dateNumber(value) + count * DAY).toISOString().slice(0, 10);
export const dateLabel = value => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'short', timeZone: 'UTC' }).format(new Date(dateNumber(value)));
export const isWarm = date => [5, 6, 7, 8, 9].includes(Number(date.slice(5, 7)));
const summer = date => [6, 7, 8].includes(Number(date.slice(5, 7)));

export function validateAnswers(a, today = '', currentMinute = -1) {
  const errors = {};
  const start = dateNumber(a.startDate), end = dateNumber(a.endDate);
  if (!Number.isFinite(start) || (today && a.startDate < today)) errors.startDate = 'Выберите дату начала отдыха не раньше сегодняшнего дня.';
  if (!Number.isFinite(end) || end < start) errors.endDate = 'Дата отъезда должна быть не раньше даты приезда.';
  else if ((end - start) / DAY > 30) errors.endDate = 'Помощник составляет программу максимум на 31 календарный день.';
  if (!Number.isFinite(minutes(a.arrival))) errors.arrival = 'Укажите время приезда.';
  else if (a.startDate === today && minutes(a.arrival) <= currentMinute) errors.arrival = 'Выберите время приезда позже текущего московского времени.';
  if (!Number.isFinite(minutes(a.departure))) errors.departure = 'Укажите время отъезда.';
  else if (start === end && minutes(a.departure) <= minutes(a.arrival)) errors.departure = 'Для отдыха одним днём отъезд должен быть позже приезда.';
  if (!Number.isInteger(a.adults) || a.adults < 1 || a.adults > 20) errors.adults = 'Укажите от 1 до 20 взрослых.';
  if (!Number.isInteger(a.children) || a.children < 0 || a.children > 10) errors.children = 'Укажите от 0 до 10 детей.';
  else if (a.adults + a.children > 20) errors.children = 'Этот помощник составляет программу для компании до 20 человек.';
  if (a.children && (a.ages?.length !== a.children || a.ages.some(age => !Number.isInteger(age) || age < 0 || age > 17))) errors.ages = 'Укажите возраст каждого ребёнка от 0 до 17 лет.';
  if (!['calm', 'balanced', 'active'].includes(a.pace)) errors.pace = 'Выберите желаемый темп.';
  if (!['together', 'separate'].includes(a.familyMode)) errors.familyMode = 'Выберите формат семейного отдыха.';
  if (!a.interests?.length || a.interests.some(id => !interests.some(item => item.id === id))) errors.interests = 'Выберите хотя бы одно занятие.';
  if (!Number.isFinite(minutes(a.wake)) || !Number.isFinite(minutes(a.rest)) || minutes(a.rest) - minutes(a.wake) < 120) errors.wake = 'Между началом дня и вечерним отдыхом должно быть хотя бы 2 часа.';
  if (a.services?.some(id => !services.some(item => item.id === id))) errors.services = 'Проверьте выбранные услуги.';
  for (const id of a.services || []) if (!Number.isFinite(minutes(a.preferred?.[id]))) errors[id] = 'Укажите предпочтительное время.';
  if (a.interests?.includes('sights')) {
    if (!a.places?.length || a.places.some(id => !attractions.some(item => item.id === id))) errors.places = 'Выберите хотя бы одну достопримечательность.';
    if (!['auto', 'walk'].includes(a.transport)) errors.transport = 'Выберите автомобиль или пеший маршрут.';
    if (!Number.isInteger(a.travelMinutes) || a.travelMinutes < 15 || a.travelMinutes > 240) errors.travelMinutes = 'Заложите от 15 до 240 минут на дорогу в одну сторону, сверившись с картой.';
    else if (a.transport === 'walk') {
      const lowerBound = minimumWalkMinutes(attractions.filter(place => a.places?.includes(place.id)), a.origin || demoOrigin);
      if (a.travelMinutes < lowerBound) errors.travelMinutes = lowerBound > 240
        ? 'Для этих точек пешая дорога превышает четырёхчасовой резерв в одну сторону даже по прямой. Выберите более близкое место или автомобиль.'
        : `Для выбранных точек заложите хотя бы ${lowerBound} минут пешком в одну сторону. Это нижняя оценка по расстоянию между точками; проверьте реальное время на карте.`;
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

function insert(day, item, preferred, from = day.start, to = day.end) {
  const candidates = freeRanges(day, from, to, 15).filter(([a, b]) => b - a >= item.duration)
    .map(([a, b]) => Math.max(a, Math.min(Math.ceil(preferred / 15) * 15, b - item.duration)));
  if (!candidates.length) return false;
  candidates.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b);
  const start = candidates[0];
  day.items.push({ ...item, start, end: start + item.duration });
  return true;
}

function placeAcross(days, item, preferred, options = {}) {
  const ordered = [...days].sort((a, b) => {
    const weight = day => options.oncePerDay ? day.items.filter(i => i.kind === options.oncePerDay).length * 100 : 0;
    return weight(a) - weight(b) || days.indexOf(a) - days.indexOf(b);
  });
  return ordered.some(day => insert(day, typeof item === 'function' ? item(day) : item, preferred, options.from ?? 0, options.to ?? 1440));
}

function activity(id, date, a) {
  const winter = !isWarm(date);
  if (id === 'beach') return {
    title: summer(date) ? 'Отдых на пляже' : 'Тихий отдых с видом на воду', duration: a.pace === 'calm' ? 120 : 60,
    detail: summer(date) ? 'Книга, спокойный отдых и время у воды. Зону отдыха выбирайте с учётом погоды.' : 'Вместо пляжного отдыха — уютная пауза с видом на водохранилище; при хорошей погоде можно выйти к берегу.',
    page: summer(date) ? 'spaces.html#sunbathing' : 'leisure-firepit.html',
  };
  if (id === 'bike' && winter) return { title: 'Прогулка вместо велосипеда', duration: 60, detail: `Для холодного сезона велосипед заменён прогулкой. ${routeIdeas.walk}`, page: 'leisure-nature.html' };
  const suggestion = {
    walk: { title: 'Прогулка у воды', duration: 60, detail: routeIdeas.walk, page: 'leisure-nature.html' },
    bike: { title: 'Велопрогулка', duration: a.pace === 'active' ? 90 : 60, detail: routeIdeas.bike, page: 'leisure-active.html' },
    buggy: { title: 'Багги с инструктором', duration: 90, detail: routeIdeas.buggy, page: 'leisure-buggy.html', confirmation: 'Подтвердить прокат, инструктора и условия участия.' },
  }[id];
  if (['walk', 'bike'].includes(id) && (!a.origin?.trim() || a.origin.trim() === demoOrigin)) return {
    ...suggestion,
    detail: `Демонстрационный круг: условный старт в Горетово у усадебного парка → Троицкая церковь → возвращение к парку и отдых у берега. ${suggestion.detail} Сверьте доступность пути и его длительность на карте: это пример программы, не утверждённый трек отеля.`,
    route: demoLocalRoute(id), routeLabel: id === 'bike' ? 'Пример веломаршрута' : 'Пример пешего маршрута', source: attractions.find(place => place.id === 'goretovo').source,
  };
  if (id === 'buggy' && a.children) {
    if (a.familyMode === 'separate' && a.ages.every(age => age >= 3)) return {
      ...suggestion, title: 'Багги для взрослых · программа для детей',
      detail: `${suggestion.detail} Раздельный выезд возможен только с подтверждённым аниматором на всё это время. Иначе — общая семейная прогулка.`,
      tracks: [{ audience: 'Дети', title: 'Игры с аниматором', detail: childrenProgramme(a) }, { audience: 'Взрослые', title: 'Маршрут на багги с инструктором', detail: routeIdeas.buggy }],
      confirmation: 'Подтвердить аниматора на весь выезд взрослых, прокат и маршрут инструктора.',
    };
    return { ...suggestion, title: 'Семейный выезд на багги — по согласованию', detail: `${suggestion.detail} Сначала подтвердите допустимый возраст и состав семейного экипажа. Пока условия не подтверждены, используйте этот интервал для совместной прогулки, без поездки на багги.` };
  }
  return suggestion;
}

function childrenProgramme(a) {
  const youngest = Math.min(...a.ages);
  if (youngest < 3) return 'Спокойная игра и короткая прогулка с родителями. Ритм подстраивается под сон и кормление малыша.';
  const groups = [];
  if (a.ages.some(n => n < 7)) groups.push('младшим — творческие и подвижные игры');
  if (a.ages.some(n => n >= 7 && n < 13)) groups.push('школьникам — командный квест и игры');
  if (a.ages.some(n => n >= 13)) groups.push('подросткам — командные задания и спортивные игры');
  return groups.join('; ') + '. Программу и состав групп согласовать по возрасту детей.';
}

export function buildHolidayPlan(a, { today = '', currentMinute = -1 } = {}) {
  const errors = validateAnswers(a, today, currentMinute);
  if (Object.keys(errors).length) return { errors, days: [], unplaced: [], notes: [] };
  const days = [], notes = [], unplaced = [];
  const count = (dateNumber(a.endDate) - dateNumber(a.startDate)) / DAY + 1;
  for (let i = 0; i < count; i++) {
    const date = addDays(a.startDate, i), first = i === 0, last = i === count - 1;
    const start = first ? minutes(a.arrival) : minutes(a.wake);
    const departure = last ? minutes(a.departure) : 1440;
    const end = Math.min(departure, first && start >= minutes(a.rest) ? Math.min(1439, start + 45) : minutes(a.rest));
    const day = { date, start, end: Math.max(start, end), items: [] };
    days.push(day);
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
  }

  for (const id of a.services) {
    const service = services.find(item => item.id === id);
    const item = {
      kind: 'service', service: id, title: service.title, duration: service.duration, page: service.page,
      detail: `${service.detail}. Предложенное время: ${a.preferred[id]}. Фактическое наличие мест и режим работы подтверждаются отдельно.`,
      confirmation: id === 'barbecue' ? 'Согласовать мангальную зону и время с командой отеля.' : 'Проверить и подтвердить выбранное время отдельно.',
    };
    if (!placeAcross(days, item, minutes(a.preferred[id]), { from: 11 * 60, to: 21 * 60, oncePerDay: 'service' })) unplaced.push({ title: service.title, reason: 'Для полного сеанса не нашлось свободного времени. Увеличьте длительность отдыха или уберите одно из занятий.' });
  }

  if (a.interests.includes('sights')) {
    if (!a.origin?.trim() || a.origin.trim() === demoOrigin) notes.push(`Маршруты построены от демонстрационной точки: ${demoOriginLabel}. Время дороги заложено как резерв; замените точку старта и сверьтесь с картой перед поездкой.`);
    for (const id of a.places) {
      const place = attractions.find(item => item.id === id);
      const visit = 75, road = a.travelMinutes;
      const item = { kind: 'excursion', title: place.title, duration: road * 2 + visit + 30,
        detail: `${a.transport === 'walk' ? 'Пешком' : 'На автомобиле'}: дорога туда ${road} мин → осмотр и время на перекус ${visit} мин → дорога обратно ${road} мин; ещё 30 мин на сборы и остановки. Время дороги — ваш резерв, а не расчёт навигатора. Проверьте маршрут и часы посещения перед поездкой.`,
        route: mapRoute(place, a.transport, a.origin || ''), source: place.source,
        confirmation: 'Сверить время в пути на карте и часы посещения.' };
      if (!placeAcross(days, item, 10 * 60, { from: 9 * 60, to: 17 * 60, oncePerDay: 'excursion' })) unplaced.push({ title: place.title, reason: a.transport === 'walk' ? 'Пеший маршрут с обратной дорогой не помещается в дневное время. Выберите более близкое место или автомобиль; фактическое время сверяйте по карте.' : 'Не помещается поездка с дорогой туда и обратно в дневное время. Измените резерв дороги, даты или другие занятия.' });
    }
  }

  for (const id of a.interests.filter(id => id !== 'sights')) {
    const factory = day => ({ ...activity(id, day.date, a), kind: 'activity', interest: id });
    if (!placeAcross(days, factory, 10 * 60 + 30, { from: 9 * 60, to: id === 'beach' ? 19 * 60 : 17 * 60, oncePerDay: 'activity' })) unplaced.push({ title: interests.find(item => item.id === id).title, reason: 'Не хватило цельного интервала с учётом дороги, еды и отдыха. Измените даты или сократите программу.' });
  }

  if (a.children) {
    const separate = a.familyMode === 'separate' && a.ages.every(age => age >= 3);
    const youngest = Math.min(...a.ages);
    const childDetail = childrenProgramme(a);
    const item = separate ? {
      kind: 'parallel', title: 'Время для детей и взрослых', duration: 90,
      detail: 'Раздельная программа возможна только после подтверждения аниматора на весь этот интервал. Если он недоступен — проведите это время вместе с детьми.',
      tracks: [
        { audience: 'Дети', title: 'Занятия с аниматором', detail: childDetail },
        { audience: 'Взрослые', title: a.pace === 'active' ? 'Прогулка и время вдвоём' : 'Спокойный отдых у воды', detail: a.pace === 'active' ? routeIdeas.walk : 'Отдых без спешки, пока дети участвуют в согласованной программе.' },
      ], confirmation: 'Подтвердить аниматора, возрастные группы и сопровождение на весь интервал.' } : {
      kind: 'family', title: youngest < 3 ? 'Семейное время с малышом' : 'Общая семейная программа', duration: youngest < 3 ? 45 : 75,
      detail: childDetail + (youngest < 3 ? ' Для самостоятельной детской группы сначала нужно отдельно согласовать сопровождение.' : ' Можно пригласить аниматора; участие и время нужно подтвердить.'),
      confirmation: youngest < 3 ? undefined : 'Если нужен аниматор — согласовать участие заранее.', page: 'leisure-children.html' };
    let familySlots = 0;
    for (const day of days) if (insert(day, item, 11 * 60, 9 * 60, 18 * 60)) familySlots += 1;
    if (!familySlots) unplaced.push({ title: 'Детская программа', reason: 'В выбранном интервале недостаточно времени. Сократите другие занятия или добавьте день.' });
    if (youngest < 7) for (const day of days) insert(day, { kind: 'rest', title: 'Тихий час и перерыв', duration: 60, detail: 'Пауза для ребёнка; фактическое время подстройте под его привычный режим.' }, 14 * 60, 13 * 60, 16 * 60);
    if (a.familyMode === 'separate' && youngest < 3) notes.push('Для малыша до 3 лет оставлена программа вместе со взрослым. Раздельный отдых можно планировать после отдельного согласования сопровождения.');
  }

  for (const day of days) {
    if (!day.items.some(item => item.service === 'restaurant' && item.start < 15 * 60)) insert(day, { kind: 'meal', title: 'Обед в своём ритме', duration: 45, detail: 'Свободное время на обед; столик автоматически не бронируется.' }, 13 * 60, 12 * 60, 15 * 60);
    if (!day.items.some(item => ['restaurant', 'barbecue'].includes(item.service) && item.end > 17 * 60)) insert(day, { kind: 'meal', title: 'Свободное время на ужин', duration: 45, detail: 'Выберите удобный формат ужина.' }, 19 * 60, 18 * 60, 21 * 60);
    if (day.start < 10 * 60) insert(day, { kind: 'meal', title: 'Неспешный завтрак', duration: 45, detail: 'Начать день без спешки.' }, day.start, day.start, 10 * 60);
  }

  // Longer stays retain the chosen pace instead of becoming empty after each
  // preference has appeared once. Repeats use only the guest's selected interests.
  const recurring = a.interests.filter(id => id !== 'sights');
  days.forEach((day, index) => {
    const target = a.pace === 'active' ? 2 : 1;
    const planned = () => day.items.filter(item => ['activity', 'excursion', 'family', 'parallel'].includes(item.kind)).length;
    for (let attempt = 0; recurring.length && planned() < target && attempt < target; attempt++) {
      const id = recurring[(index + attempt) % recurring.length];
      insert(day, { ...activity(id, day.date, a), kind: 'activity', interest: id }, attempt ? 15 * 60 : 10 * 60 + 30, 9 * 60, id === 'beach' ? 19 * 60 : 17 * 60);
    }
  });

  for (const day of days) {
    const gaps = freeRanges(day);
    for (const [start, end] of gaps) {
      day.items.push({ kind: 'free', title: end - start < 30 ? 'Переход и небольшой перерыв' : a.pace === 'calm' ? 'Свободное время без планов' : 'Свободное время и восстановление', start, end, duration: end - start,
        detail: end - start < 30 ? 'Время собраться и спокойно перейти к следующему занятию.' : 'Программа оставляет место для отдыха и ваших спонтанных желаний.' });
    }
    day.items.sort((a, b) => a.start - b.start);
  }
  if (a.interests.includes('bike') && days.some(day => !isWarm(day.date))) notes.push('Для холодных месяцев велопрогулка заменяется пешей. Наличие проката и состояние троп нужно уточнить по погоде.');
  if (a.interests.includes('beach') && days.some(day => !summer(day.date))) notes.push('За пределами лета вместо пляжа предложен спокойный отдых с видом на воду.');
  if (a.interests.some(id => ['walk', 'bike', 'buggy'].includes(id))) notes.push('Маршруты активностей — предложенные схемы. Утверждённые треки отеля пока не предоставлены; точный путь покажет команда отеля или инструктор.');
  return { errors: {}, answers: a, days, unplaced, notes, timeZone: 'Московское время (UTC+3)' };
}

export function planToText(plan) {
  if (Object.keys(plan.errors || {}).length) return '';
  const a = plan.answers;
  const lines = ['A’MORE Collection · План отдыха', 'Можайское водохранилище', `${a.startDate} — ${a.endDate} · ${plan.timeZone}`, `Взрослых: ${a.adults}. Детей: ${a.children}${a.children ? ` (возраст: ${a.ages.join(', ')} лет)` : ''}.`, 'Предварительная программа. Время предложено; бронирования и аниматор подтверждаются отдельно.', ''];
  for (const day of plan.days) {
    lines.push(dateLabel(day.date).toLocaleUpperCase('ru'));
    for (const item of day.items) {
      lines.push(`${clock(item.start)}${item.end > item.start ? `–${clock(item.end)}` : ''} · ${item.title}`, `  ${item.detail}`);
      for (const track of item.tracks || []) lines.push(`  ${track.audience}: ${track.title}. ${track.detail}`);
      if (item.route) lines.push(`  Маршрут: ${item.route}`);
      if (item.confirmation) lines.push(`  Нужно подтвердить: ${item.confirmation}`);
    }
    lines.push('');
  }
  if (plan.unplaced.length) lines.push('НЕ ВОШЛО В РАСПИСАНИЕ', ...plan.unplaced.map(item => `${item.title}: ${item.reason}`), '');
  lines.push(...plan.notes);
  return lines.join('\n');
}
