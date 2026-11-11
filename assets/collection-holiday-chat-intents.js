import { addDays, clock, dateLabel, dateNumber, minutes } from './collection-holiday-engine.js?v=20261108-route-pdf-1';
import { onsiteInterests } from './collection-holiday-data.js?v=20261108-route-pdf-1';
import { applyScheduleEdit, canEditScheduleItem, scheduleReplacementOptions } from './collection-holiday-edits.js?v=20261108-route-pdf-1';

const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const weekdays = ['воскресень[ея]', 'понедельник[а]?', 'вторник[а]?', 'сред[ыу]', 'четверг[а]?', 'пятниц[ыу]', 'суббот[ыу]'];
const dayWords = ['сегодня', 'послезавтра', 'завтра', ...weekdays];
const datePattern = new RegExp(
  `(?<![а-я0-9.])(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\.\\d{1,2}(?:\\.\\d{4})?|\\d{1,2} (?:${months.join('|')})(?: \\d{4})?|${dayWords.join('|')})(?![а-я0-9.])`, 'u',
);
const actionPattern = /^(?:(?:пожалуйста|можно|можешь|можете)[, ]+)*(перенеси(?:те)?|перенести|передвинь(?:те)?|сдвинь(?:те)?|убери(?:те)?|убрать|удали(?:те)?|удалить|добавь(?:те)?|добавить|вставь(?:те)?|замени(?:те)?|заменить)(?:[, ]+|$)/u;
const clockPattern = /(?<![\d:])(\d{1,2}):(\d{2})(?![\d:])/u;
const hourPattern = /(?:^| )(?:в|на) (\d{1,2})(?: час(?:а|ов)?)?(?: (\d{1,2}) минут[ау]?)?(?![\d.:])(?=$| |[?!,])/u;
const periodPattern = /после (завтрака|обеда|ужина)(?![а-я])/u;
const recommendationPattern = /(?:^|[ ,])(?:подбери(?:те)?|подобрать|предложи(?:те)?|предложить|посоветуй(?:те)?|чем (?:(?:еще|можно|нам|лучше) )*заняться|что (?:(?:еще|можно|нам|бы|лучше) )*(?:сделать|поделать|добавить|попробовать|делать)|что (?:есть|подойдет) для (?:детей|семьи|взрослых)|как (?:нам )?провести (?:время|день|вечер)|куда (?:можно )?(?:сходить|прогуляться)|(?:какие|есть ли) (?:еще )?(?:занятия|развлечения|идеи))(?![а-я])/u;
const moreActivitiesPattern = /^(?:(?:а|давай(?:те)?|пожалуйста|покажи(?:те)?|предложи(?:те)?)[, ]+)*(?:(?:еще|другие) (?:занятия|идеи|варианты|развлечения)|что еще(?: можно (?:сделать|попробовать))?|чем еще заняться)$/u;
const mealNames = { завтрака: 'breakfast', завтраком: 'breakfast', обеда: 'lunch', обедом: 'lunch', ужина: 'dinner', ужином: 'dinner' };
const mealLimitPattern = /(?<![а-я])(до|перед|после) (завтрака|завтраком|обеда|обедом|ужина|ужином)(?![а-я])/gu;
const clockLimitPattern = /(?<![а-я0-9])(?:(с|до|после|в|на) (\d{1,2}:\d{2})|(с|до|после|в) (\d{1,2})(?=$|[ ,!?])(?! минут[а-я]*))/gu;
const durationPattern = /(?<![а-я0-9])(?:(\d{1,3}) (?:минут[уы]?|мин\.?)(?![а-я])|(\d{1,2}) час(?:а|ов)?(?![а-я])|(полтора часа|полчаса|два часа|три часа|час)(?![а-я]))/u;
const recommendedActivities = {
  'activity:walk': { group: 'walk', style: 'active', words: /прогул|прогуляться|пеш(?:ая|ую|ком)/u },
  walk: { group: 'walk', style: 'active', words: /прогул|прогуляться|пеш(?:ая|ую|ком)/u },
  'activity:beach': { group: 'water', style: 'calm', words: /(?:у|возле) воды|водохранилищ/u },
  'activity:sunbathing': { group: 'water', style: 'calm', seasonal: true, words: /(?:загорат|загар|солнц)/u },
  'activity:garden': { group: 'garden', style: 'calm', seasonal: true, words: /парник|растени|садов/u },
  'activity:firepit': { group: 'firepit', style: 'calm', words: /кост(?:ер|р)|у огня/u },
  'activity:fishing': { group: 'fishing', style: 'calm', minFamilyAge: 7, words: /рыбал|порыбач/u },
  'activity:table-tennis': { group: 'table-tennis', style: 'active', minFamilyAge: 7, words: /теннис|пинг-понг/u },
  'activity:ball-games': { group: 'ball-games', style: 'active', minFamilyAge: 3, words: /мяч|подвижн(?:ая|ые) игр/u },
  'activity:skating': { group: 'skating', style: 'active', seasonal: true, minFamilyAge: 7, words: /каток|катк|коньк/u },
  'activity:tubing': { group: 'tubing', style: 'active', seasonal: true, minFamilyAge: 7, words: /ватрушк|тюбинг|снежн(?:ая|ую) горк/u },
  'activity:zoo': { group: 'zoo', style: 'family', seasonal: true, minAge: 3, words: /зоопарк|животн/u },
  'activity:play-area': { group: 'play-area', style: 'family', minAge: 3, words: /(?:игров|детск)[а-я]* (?:зон|площадк)/u },
  'family:short': { group: 'family', style: 'family', minAge: 0 },
  family: { group: 'family', style: 'family', minAge: 0 },
  'activity:learning-games': { group: 'games', style: 'family', minAge: 3, words: /развивающ|логическ|внимание/u },
  rest: { group: 'rest', style: 'calm' },
};
const activityConfirmations = new Map(onsiteInterests.map(({ id, confirmation }) => [id, confirmation]));
const activitiesPerPage = 5;
const reply = text => ({ text });
const normalize = value => value.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ').trim();

export function dayReference(input, plan, today) {
  const match = input.match(datePattern);
  if (!match) return null;
  const [value] = match;
  let dates;
  const relative = { сегодня: 0, завтра: 1, послезавтра: 2 }[value];
  if (relative !== undefined) {
    dates = [addDays(today, relative)];
  } else if (/^\d{4}-/.test(value)) {
    dates = [value];
  } else {
    const dot = value.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/u);
    const word = value.match(/^(\d{1,2}) ([а-я]+)(?: (\d{4}))?$/u);
    if (dot || word) {
      const [, day, month, year] = dot || word;
      const monthNumber = dot ? Number(month) : months.indexOf(month) + 1;
      const suffix = `-${String(monthNumber).padStart(2, '0')}-${day.padStart(2, '0')}`;
      dates = year ? [`${year}${suffix}`] : plan.days.map(item => item.date).filter(date => date.endsWith(suffix));
    } else {
      const weekday = weekdays.findIndex(pattern => new RegExp(`^${pattern}$`, 'u').test(value));
      dates = plan.days.filter(day => new Date(dateNumber(day.date)).getUTCDay() === weekday).map(day => day.date);
    }
  }
  return { dates: dates.filter(date => Number.isFinite(dateNumber(date))), value, index: match.index };
}

function requestedTime(input) {
  const match = input.match(clockPattern);
  if (match) return minutes(`${match[1].padStart(2, '0')}:${match[2]}`);
  const hour = input.match(hourPattern);
  if (hour && !months.some(month => input.slice(hour.index + hour[0].length).trimStart().startsWith(month))) {
    return minutes(`${hour[1].padStart(2, '0')}:${(hour[2] || '0').padStart(2, '0')}`);
  }
  return undefined;
}

function dayChoices(plan, today) {
  return plan.days.filter(day => day.date >= today);
}

function anotherDay(input, reference) {
  return reference && datePattern.test(input.slice(reference.index + reference.value.length));
}

function scheduleText(items) {
  return items.map(({ item, date }) =>
    `${date ? `${dateLabel(date)} · ` : ''}${clock(item.start)} — ${item.title}`).join('\n');
}

function periodStart(day, input) {
  const period = input.match(periodPattern)?.[1];
  if (!period) return null;
  const meal = { завтрака: 'breakfast', обеда: 'lunch', ужина: 'dinner' }[period];
  const event = day.items.find(item => item.meal === meal);
  return event ? { minute: event.end } : { error: 'На этот день в плане нет этого приёма пищи. Укажите точное время.' };
}

function readSchedule(plan, input, today, minute) {
  const date = dayReference(input, plan, today);
  if (anotherDay(input, date)) return reply('Какой день показать? Напишите одну дату поездки.');
  if (date || periodPattern.test(input)) {
    const days = plan.days.filter(day => (date?.dates || [today]).includes(day.date));
    if (!days.length) {
      return {
        text: `На этот день у вас нет расписания. Поездка запланирована с ${dateLabel(plan.days[0].date)} по ${dateLabel(plan.days.at(-1).date)}.`,
        suggestions: [{ label: 'Что дальше?', query: 'Что дальше?' }],
      };
    }
    if (days.length > 1) {
      return {
        text: 'В поездке несколько таких дней. Какой показать?',
        suggestions: days.map(day => ({ label: dateLabel(day.date), query: `Что запланировано на ${day.date}?` })),
      };
    }
    const [day] = days;
    const period = periodStart(day, input);
    if (period?.error) return reply(period.error);
    const time = requestedTime(input);
    if (time !== undefined && !Number.isFinite(time)) return reply('Укажите время от 00:00 до 23:59.');
    const items = day.items.filter(item => item.kind !== 'free'
      && (time === undefined || (item.start <= time && item.end > time))
      && (!period || item.start >= period.minute)).map(item => ({ item }));
    return reply(items.length
      ? `${dateLabel(day.date)} · по времени отеля\n${scheduleText(items)}`
      : `${dateLabel(day.date)} · на это время в плане нет занятий.`);
  }

  const upcoming = dayChoices(plan, today).flatMap(day => day.items.filter(item =>
    item.kind !== 'free' && (day.date > today || item.start >= minute)).map(item => ({ item, date: day.date })));
  const ongoing = plan.days.find(day => day.date === today)?.items.find(item =>
    item.kind !== 'free' && item.start < minute && item.end > minute);
  const parts = [];
  if (ongoing) parts.push(`Сейчас по плану «${ongoing.title}» до ${clock(ongoing.end)}.`);
  if (upcoming.length) parts.push(`Ближайшее в плане · по времени отеля\n${scheduleText(upcoming.slice(0, 4))}`);
  return reply(parts.join('\n\n') || 'В этой поездке больше нет запланированных занятий.');
}

const ignoredWords = new Set(['пожалуйста', 'занятие', 'в', 'на', 'с', 'со', 'по', 'у', 'и']);

function nameWords(value) {
  return (normalize(value).match(/[а-яa-z0-9]+/gu) || []).filter(word => !ignoredWords.has(word))
    .map(word => word.length > 3 ? word.replace(/(?:ами|ями|ого|ему|ому|ыми|ими|ая|яя|ый|ой|ий|ые|ие|ую|юю|ов|ев|а|я|ы|и|у|ю|е|о)$/u, '') : word);
}

function matchingTitles(entries, name, titleFor, { exact = false } = {}) {
  const literal = entries.filter(entry => normalize(titleFor(entry)) === normalize(name));
  if (literal.length || exact) return literal;
  const words = nameWords(name);
  return words.length ? entries.filter(entry => {
    const available = nameWords(titleFor(entry));
    return words.every(word => available.includes(word));
  }) : [];
}

function commandParts(value, plan, today) {
  const quoted = value.match(/^(?:«([^»]+)»|"([^"]+)")\s*(.*)$/u);
  if (quoted) return { name: quoted[1] || quoted[2], temporal: quoted[3].trim(), exact: true };
  const markers = [dayReference(value, plan, today)?.index, value.match(clockPattern)?.index,
    value.match(hourPattern)?.index, value.match(periodPattern)?.index].filter(Number.isInteger);
  const boundary = markers.length ? Math.min(...markers) : value.length;
  const name = value.slice(0, boundary).replace(/(?:^| )(?:на|в|с) $/u, '').replace(/[ ,!?]+$/u, '').trim();
  return { name, temporal: value.slice(name.length).replace(/^[, ]+/u, '').trim(), exact: false };
}

const onDate = (day, edit) => ({ ...edit, date: day.date });
const protectedItem = item => item.kind === 'hotel-event' || item.kind === 'service' || item.kind === 'parallel'
  || item.interest === 'pavilion' || ['transfer', 'guided'].includes(item.transport);

function proposalFor(plan, edit, label) {
  const { error } = applyScheduleEdit(plan, edit);
  return error ? { error } : { proposal: { label, edit } };
}

function timeOptions(day, duration, minimum, preferred, maximum = day.end) {
  return day.items.filter(item => item.kind === 'free').map(window => {
    const first = Math.max(window.start, minimum);
    const last = Math.min(window.end, maximum) - duration;
    if (first > last) return null;
    const rounded = Math.ceil(first / 15) * 15;
    const time = Number.isFinite(preferred) ? Math.max(first, Math.min(last, preferred)) : Math.min(rounded, last);
    return { time, window };
  }).filter(Boolean).sort((a, b) => Number.isFinite(preferred)
    ? Math.abs(a.time - preferred) - Math.abs(b.time - preferred) : a.time - b.time);
}

function editTime(plan, day, duration, temporal, today, minute, createEdit) {
  const time = requestedTime(temporal);
  if (time !== undefined && !Number.isFinite(time)) return reply('Укажите время от 00:00 до 23:59.');
  const period = periodStart(day, temporal);
  if (period?.error) return reply(period.error);
  const minimum = Math.max(day.start, day.date === today ? minute : 0, period?.minute ?? 0);
  let error = '';
  if (time !== undefined) {
    if (time < minimum) error = 'Это время уже прошло или выходит за выбранный интервал.';
    else {
      const window = day.items.find(item => item.kind === 'free' && time >= item.start && time + duration <= item.end);
      const edit = createEdit(time, window);
      const result = proposalFor(plan, edit, `${dateLabel(day.date)} · ${clock(time)}–${clock(time + duration)}`);
      if (result.proposal) return { text: 'Вот предлагаемое изменение. Применить его к плану?', proposals: [result.proposal] };
      error = result.error.replace(/ Выберите свободное время\.$/u, '');
    }
  }
  const proposals = timeOptions(day, duration, minimum, time)
    .map(({ time: start, window }) => proposalFor(plan, createEdit(start, window),
      `${dateLabel(day.date)} · ${clock(start)}–${clock(start + duration)}`).proposal)
    .filter(Boolean).slice(0, 3);
  if (proposals.length) return { text: `${error ? `${error} ` : ''}Можно выбрать свободное время.`, proposals };
  return reply(`${error ? `${error} ` : ''}На этот день подходящего свободного окна нет. Укажите другой день поездки.`);
}

function chooseDate(plan, reference, today) {
  return dayChoices(plan, today).filter(day => !reference || reference.dates.includes(day.date));
}

function recommendationRequest(input) {
  if (/^(?:(?:а|пожалуйста)[, ]+)*не /u.test(input)) return false;
  return recommendationPattern.test(input)
    || /(?:^|[ ,])(?:еще|другие) (?:занятия|развлечения|варианты)(?![а-я])/u.test(input)
    || (/^(?:у (?:нас|меня)|остал(?:ся|ось)) /u.test(input) && durationPattern.test(input)
      && /(?:до|перед) (?:завтрак|обед|ужин)/u.test(input));
}

function recommendationTime(input, reference) {
  const value = reference ? `${input.slice(0, reference.index)} ${input.slice(reference.index + reference.value.length)}` : input;
  const clocks = [...value.matchAll(clockLimitPattern)].filter(match => !/[\d.:]/u.test(value[match.index + match[0].length] ?? ''));
  const limits = clocks.map(([, relation, time, hourRelation, hour]) => ({
    relation: relation ?? hourRelation,
    minute: requestedTime(time ?? `в ${hour}`),
  }));
  if (/(?<![а-я])(?:утром|на утро)(?![а-я])/u.test(value)) limits.push({ relation: 'до', minute: 12 * 60 });
  if (/(?<![а-я])днем(?![а-я])/u.test(value)) limits.push({ relation: 'с', minute: 12 * 60 }, { relation: 'до', minute: 17 * 60 });
  if (/(?<![а-я])(?:вечером|на вечер|провести вечер)(?![а-я])/u.test(value)) limits.push({ relation: 'с', minute: 17 * 60 });
  const stripped = clocks.reduceRight((rest, match) => `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`, value);
  const clockMatch = stripped.match(clockPattern);
  if (clockMatch) limits.push({ relation: 'в', minute: requestedTime(clockMatch[0]) });
  const durationMatch = stripped.match(durationPattern);
  const durationWords = { полчаса: 30, 'полтора часа': 90, 'два часа': 120, 'три часа': 180, час: 60 };
  const duration = !durationMatch ? undefined : durationMatch[1] !== undefined ? Number(durationMatch[1])
    : durationMatch[2] !== undefined ? Number(durationMatch[2]) * 60 : durationWords[durationMatch[3]];
  return {
    limits,
    duration,
    nearMeal: /(?:у (?:нас|меня)|остал(?:ся|ось)) /u.test(value),
    meals: [...value.matchAll(mealLimitPattern)].map(([, relation, name]) => ({ relation, meal: mealNames[name] })),
  };
}

function recommendationMeal(day, meal) {
  return day.items.find(item => item.meal === meal)
    ?? day.items.find(item => (item.service === 'restaurant' || (meal === 'dinner' && item.service === 'barbecue'))
      && ((meal === 'lunch' && item.start < 15 * 60) || (meal === 'dinner' && item.end > 17 * 60)));
}

function recommendationBounds(day, timing, today, minute) {
  let start = Math.max(day.start, day.date === today ? minute : 0);
  let end = day.end;
  let exact;
  for (const limit of timing.limits) {
    if (limit.relation === 'до') end = Math.min(end, limit.minute);
    else if (limit.relation === 'с' || limit.relation === 'после') start = Math.max(start, limit.minute);
    else exact = limit.minute;
  }
  for (const { relation, meal } of timing.meals) {
    const event = recommendationMeal(day, meal);
    if (!event) return { missingMeal: true };
    if (relation === 'после') start = Math.max(start, event.end);
    else {
      end = Math.min(end, event.start);
      if (timing.nearMeal && timing.duration !== undefined) start = Math.max(start, event.start - timing.duration);
    }
  }
  return { start, end, exact };
}

function recommendationsForDay(plan, day, input, timing, bounds, seenGroups) {
  const { answers } = plan;
  const adultOnly = /(?:для взрослых|без детей)/u.test(input);
  const familyRequest = !adultOnly && /(?:семейн|с (?:ребен|деть|малыш)|для (?:ребен|детей|малыш|семьи))/u.test(input);
  const childAge = !adultOnly && answers.children > 0 ? Math.min(...answers.ages) : undefined;
  const requestedStyle = /(?:активн|подвижн|размять)/u.test(input) ? 'active'
    : /(?:спокойн|тих[оие]|расслаб)/u.test(input) ? 'calm' : undefined;
  const style = requestedStyle ?? (familyRequest || childAge !== undefined ? 'family' : answers.pace);
  const hasNamedActivity = Object.values(recommendedActivities).some(activity => activity.words?.test(input));
  const options = new Map();
  for (const window of day.items.filter(item => item.kind === 'free' && item.end - item.start >= 30)) {
    for (const option of scheduleReplacementOptions(plan, day.date, { windowStart: window.start, windowEnd: window.end })) {
      if (Object.hasOwn(recommendedActivities, option.id)) options.set(option.id, option);
    }
  }
  const candidates = [...options.values()].flatMap(option => {
    const { group, minAge, minFamilyAge, seasonal, style: activityStyle, words } = recommendedActivities[option.id];
    if (seenGroups.has(group) || option.duration > (timing.duration ?? Infinity)) return [];
    if (minAge !== undefined && (childAge === undefined || childAge < minAge)) return [];
    if (minFamilyAge !== undefined && (familyRequest || childAge !== undefined) && !(childAge >= minFamilyAge)) return [];
    if (requestedStyle && requestedStyle !== activityStyle
      && !(requestedStyle === 'calm' && group === 'games')) return [];
    const matchesName = words?.test(input) ?? false;
    if (hasNamedActivity && !matchesName) return [];
    const slot = timeOptions(day, option.duration, bounds.start, bounds.exact, bounds.end)[0];
    if (!slot || (bounds.exact !== undefined && bounds.exact !== slot.time)) return [];
    const interest = option.id.replace(/^activity:/u, '');
    const repeated = day.items.some(item => normalize(item.title) === normalize(option.title)
      || (group === 'walk' && item.interest === 'walk')
      || (group === 'family' && item.kind === 'family'));
    const notice = option.id.startsWith('activity:') ? activityConfirmations.get(interest) : undefined;
    const score = Number(answers.interests?.includes(interest) ?? false) * 4
      + Number(style === activityStyle) * 3
      + Number(option.id === 'activity:walk')
      + Number(Boolean(seasonal)) * 2
      - Number(repeated) * 5
      - Number(Boolean(notice))
      - Number(group === 'rest') * 4;
    return [{ option, slot, group, score, activityStyle, notice }];
  });
  candidates.sort((a, b) => b.score - a.score || a.slot.time - b.slot.time || a.option.duration - b.option.duration);

  const groups = new Set();
  const styles = new Set();
  const proposals = [];
  const alternatives = [];
  for (const { option, slot: { time, window }, group, activityStyle, notice } of candidates) {
    if (groups.has(group)) continue;
    const labelSuffix = notice ? ' · уточнить у отеля' : '';
    const label = `${option.title} · ${dateLabel(day.date)} · ${clock(time)}–${clock(time + option.duration)}${labelSuffix}`;
    const edit = onDate(day, { type: 'add', itemId: `chat:${day.date}:${clock(time)}:${option.id}`, itemTitle: option.title,
      replacementId: option.id, time: clock(time), windowStart: window.start, windowEnd: window.end });
    const { proposal } = proposalFor(plan, edit, label);
    if (!proposal) continue;
    groups.add(group);
    const entry = { group, proposal: { ...proposal, bounds: { start: bounds.start, end: bounds.end },
      ...(notice && { notice, labelSuffix }) } };
    (styles.has(activityStyle) ? alternatives : proposals).push(entry);
    styles.add(activityStyle);
  }
  return [...proposals, ...alternatives];
}

function recommendActivity(plan, input, today, minute, previous) {
  const response = (text, extra) => ({ text, ...extra, local: true });
  if (previous) input = previous.input;
  const reference = dayReference(input, plan, today);
  if (anotherDay(input, reference)) return response('Укажите один день, на который подобрать занятие.');
  const days = chooseDate(plan, previous ? { dates: [previous.date] } : reference, today);
  if (!days.length) return response('Укажите предстоящий день в пределах поездки.');
  const timing = recommendationTime(input, reference);
  if (timing.limits.some(limit => !Number.isFinite(limit.minute))) return response('Укажите время от 00:00 до 23:59.');
  if (timing.duration !== undefined && !(timing.duration > 0)) return response('Сколько минут оставить на занятие?');
  const results = [];
  const seenGroups = new Set(previous?.seenGroups ?? []);
  let missingMeal = false;
  for (const day of days) {
    const bounds = recommendationBounds(day, timing, today, minute);
    missingMeal ||= Boolean(bounds.missingMeal);
    if (bounds.missingMeal || bounds.end - bounds.start < 30) continue;
    const entries = recommendationsForDay(plan, day, input, timing, bounds, seenGroups);
    if (!entries.length) continue;
    results.push({ day, entries });
    if (!reference) break;
  }
  if (results.length > 1) return response('На какой день подобрать занятие?', {
    suggestions: results.slice(0, 7).map(({ day }) => ({
      label: dateLabel(day.date),
      query: `${input.slice(0, reference.index)}${day.date}${input.slice(reference.index + reference.value.length)}`,
    })),
  });
  if (results.length) {
    const [{ day, entries }] = results;
    const page = entries.slice(0, activitiesPerPage);
    const proposals = page.map(({ proposal }) => proposal);
    const reminder = proposals.some(proposal => proposal.notice)
      ? ' Для отмеченных вариантов уточните условия у отеля.' : '';
    return response(`${dateLabel(day.date)}. В свободное время на территории отеля подойдут эти занятия. Выберите одно для просмотра.${reminder}`, {
      proposals,
      recommendation: { input, date: day.date, seenGroups: [...seenGroups, ...page.map(({ group }) => group)],
        hasMore: entries.length > page.length },
    });
  }
  if (previous) return response('На этот промежуток я показал все подходящие занятия. Можно попросить подбор на другой день или для другого формата отдыха.', { keepPending: true });
  if (missingMeal) return response('В плане нет указанного приёма пищи, к которому можно привязать занятие. Укажите время или другой день.');
  return response('Для занятия в этот промежуток свободного окна не нашлось. Можно указать другой день или время.');
}

function addActivity(plan, parts, today, minute) {
  if (/^(?:бан[яю]|ресторан|мангал|беседк|трансфер|павильон)/u.test(parts.name)) {
    return reply('Добавьте услугу через «Изменить ответы», затем отправьте её на согласование с отелем.');
  }
  const date = dayReference(parts.temporal, plan, today);
  if (anotherDay(parts.temporal, date)) return reply('Укажите один день для нового занятия.');
  const days = chooseDate(plan, date, today);
  if (!days.length) return reply('Выберите будущий день в пределах поездки.');
  if (days.length > 1) return {
    text: 'На какой день добавить занятие?',
    suggestions: days.slice(0, 7).map(day => ({
      label: dateLabel(day.date), query: `Добавь ${parts.exact ? `«${parts.name}»` : parts.name} ${day.date}${Number.isFinite(requestedTime(parts.temporal)) ? ` в ${clock(requestedTime(parts.temporal))}` : ''}`,
    })),
  };
  const [day] = days;
  const options = scheduleReplacementOptions(plan, day.date).filter(option =>
    option.id !== 'custom' && !option.id.startsWith('service:') && option.id !== 'activity:pavilion');
  const walkAlias = /^(?:прогулк[ау]|пеш(?:ая|ую) прогулк[ау])$/u.test(parts.name);
  const matches = walkAlias ? options.filter(option => option.id === 'walk')
    : matchingTitles(options, parts.name, option => option.title, parts);
  if (matches.length !== 1) return {
    text: matches.length ? 'Какое занятие добавить?' : 'Укажите занятие из доступных вариантов на этот день.',
    suggestions: (matches.length ? matches : options).slice(0, 5).map(option => ({
      label: option.title, query: `Добавь «${option.title}» ${day.date}`,
    })),
  };
  const [option] = matches;
  const result = editTime(plan, day, option.duration, parts.temporal, today, minute, (time, window) =>
    onDate(day, { type: 'add', itemId: `chat:${day.date}:${clock(time)}:${option.id}`, itemTitle: option.title,
      replacementId: option.id, time: clock(time), windowStart: window?.start, windowEnd: window?.end }));
  if (result.proposals) result.text = `«${option.title}». ${result.text}`;
  return result;
}

function editActivity(plan, action, parts, today, minute) {
  const fromTo = action === 'move' && parts.temporal.match(/^с (.+?) на (.+)$/u);
  const target = fromTo ? fromTo[2] : parts.temporal;
  const source = fromTo ? fromTo[1] : action === 'remove' ? parts.temporal : '';
  const date = dayReference(source, plan, today);
  if (anotherDay(source, date)) return reply('Укажите один день, в который стоит нужное занятие.');
  const sourceTime = requestedTime(source);
  const scheduled = plan.days.flatMap(day => day.items.filter(item => canEditScheduleItem(item)
    && (!date || date.dates.includes(day.date)) && (sourceTime === undefined || item.start === sourceTime))
    .map(item => ({ day, item })));
  const matches = matchingTitles(scheduled, parts.name, entry => entry.item.title, parts);
  if (!matches.length) return reply('Такого занятия в плане не нашлось. Напишите его название, как в расписании.');
  if (matches.length > 1) return {
    text: 'В плане несколько подходящих занятий. Какое вы хотите изменить?',
    suggestions: matches.slice(0, 7).map(({ day, item }) => ({
      label: `${dateLabel(day.date)} · ${clock(item.start)} · ${item.title}`,
      query: action === 'remove'
        ? `Убери «${item.title}» ${day.date} в ${clock(item.start)}`
        : `Перенеси «${item.title}» с ${day.date} в ${clock(item.start)} на ${target.replace(/^(?:в|на) /u, '') || day.date}`,
    })),
  };
  const [{ day: originalDay, item }] = matches;
  if (protectedItem(item)) {
    return reply(item.kind === 'hotel-event'
      ? 'Время мероприятия задаёт отель. Убрать его из своей программы можно в расписании.'
      : 'Это занятие связано с согласованием у отеля. Проверьте его в разделе «Согласовать с отелем», прежде чем менять планы.');
  }
  const baseEdit = { type: action, itemId: item.id, itemTitle: item.title };
  if (action === 'remove') return {
    text: `Убрать «${item.title}» из плана?`,
    proposals: [proposalFor(plan, onDate(originalDay, baseEdit),
      `${dateLabel(originalDay.date)} · ${clock(item.start)}`).proposal].filter(Boolean),
  };

  const targetDate = dayReference(target, plan, today);
  if (anotherDay(target, targetDate)) return reply('Укажите один день, на который перенести занятие.');
  const days = targetDate ? chooseDate(plan, targetDate, today) : chooseDate(plan, { dates: [originalDay.date] }, today);
  if (!days.length) return reply('Укажите будущий день в пределах поездки.');
  if (days.length > 1) return {
    text: 'На какую именно дату перенести занятие?',
    suggestions: days.slice(0, 7).map(day => ({
      label: dateLabel(day.date),
      query: `Перенеси «${item.title}» с ${originalDay.date} в ${clock(item.start)} на ${day.date}`,
    })),
  };
  if (days[0] === originalDay && requestedTime(target) === item.start) {
    return reply(`«${item.title}» уже стоит в плане на ${clock(item.start)}.`);
  }
  const result = editTime(plan, days[0], item.duration, target, today, minute, time =>
    onDate(days[0], { ...baseEdit, time: clock(time) }));
  if (result.proposals) result.text = `«${item.title}». ${result.text}`;
  return result;
}

export function answerHolidayChat(plan, input, { date, minute, recommendation } = {}) {
  if (!plan?.days?.length) return reply('Составьте план отдыха, чтобы открыть расписание в чате.');
  const value = normalize(String(input ?? '')).replace(/[.!?]+$/u, '');
  const today = Number.isFinite(dateNumber(date)) ? date : plan.days[0].date;
  const currentMinute = Number.isInteger(minute) ? minute : 0;
  const command = value.match(actionPattern);
  if (command) {
    const verb = command[1];
    if (/^(?:замени|заменить)/u.test(verb)) return reply('Заменить занятие можно кнопкой «Заменить» рядом с ним в расписании.');
    const rest = value.slice(command[0].length);
    if (/(?:^| )не(?: |$)|(?:^| )(?:убери|удали|перенеси|добавь)(?: |$)/u.test(rest)) {
      return reply('Напишите одно действие с одним занятием, чтобы я мог показать точную правку.');
    }
    const parts = commandParts(rest, plan, today);
    if (!parts.name) return reply('Укажите название занятия, которое хотите изменить или добавить.');
    if (/^(?:добав|встав)/u.test(verb)) return addActivity(plan, parts, today, currentMinute);
    return editActivity(plan, /^(?:уб[ер]|удал)/u.test(verb) ? 'remove' : 'move', parts, today, currentMinute);
  }
  if (moreActivitiesPattern.test(value)) return recommendActivity(plan, value, today, currentMinute, recommendation);
  if (recommendationRequest(value)) return recommendActivity(plan, value, today, currentMinute);
  const briefDate = value.replace(/^(?:а )?(?:(?:в|на) )?/u, '');
  if (/^(?:(?:пожалуйста|можно|можешь)[, ]+)*(?:что|покажи(?:те)?|какие планы|расписание|планы?)(?: |[?!.,]|$)/u.test(value)
    || dayReference(briefDate, plan, today)?.value === briefDate) {
    return readSchedule(plan, value, today, currentMinute);
  }
  return {
    text: 'Спросите, что запланировано дальше, или напишите, какое занятие добавить, перенести или убрать.',
    suggestions: [
      { label: 'Что дальше?', query: 'Что дальше?' },
      { label: 'Что завтра?', query: 'Что завтра?' },
    ],
  };
}
