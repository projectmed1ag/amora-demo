import { dayReference } from './collection-holiday-chat-intents.js?v=20261112-chat-3';
import { dateLabel, dateNumber, minutes } from './collection-holiday-engine.js?v=20261108-route-pdf-1';
import { hotelEventEdit } from './collection-holiday-events.js?v=20261112-chat-3';
import { applyScheduleEdit, isHotelEventEdit } from './collection-holiday-edits.js?v=20261108-route-pdf-1';

const themeNight = /(?<![а-я])тематическ[а-я]+ вечер[а-я]*(?![а-я])/u;
const eventWord = /(?<![а-я])(?:афиш[а-я]*|мероприяти[а-я]*|событи[а-я]*|мастер-класс[а-я]*)(?![а-я])/u;
const evening = /(?<![а-я])(?:вечером|по вечерам|на вечер|вечерн[а-я]+)(?![а-я])/u;
const personalPlan = /(?<![а-я])(?:в (?:(?:моем|нашем) )?плане|по плану|наш[ие] планы)(?![а-я])/u;
const addCommand = /^(?:(?:пожалуйста|можно|давай(?:те)?|можешь|можете)[, ]+)*(?:добавь(?:те)?|добавить|включи(?:те)?|включить)(?=$|[ ,])/u;
const otherEdit = /^(?:(?:пожалуйста|можно|давай(?:те)?|можешь|можете)[, ]+)*(?:убери(?:те)?|убрать|удали(?:те)?|удалить|перенеси(?:те)?|перенести|замени(?:те)?|заменить)(?=$|[ ,])/u;
const quoted = /«([^»]+)»|"([^"]+)"/u;
const clockPattern = /(?<![\d:])(\d{1,2}:\d{2})(?![\d:])/u;
const eveningStart = 17 * 60;
const normalize = value => value.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/gu, ' ').trim();
const nameKey = value => normalize(value.replace(/[«»“”"]/gu, ''));
const reply = (text, options) => ({ text, local: true, ...options });
const unavailable = () => reply('Афиша отеля сейчас недоступна. Попробуйте спросить о мероприятиях позже.');

function eventTitle(input, value, command, reference) {
  const quote = input.match(quoted);
  if (quote) return quote[1] || quote[2];
  if (!command) return '';
  const title = value.slice(command[0].length, reference?.index).trim()
    .replace(/^в (?:мой )?план(?: |$)/u, '').split(/ (?:из афиши|в план)(?![а-я])/u)[0]
    .replace(/ (?:на|в)$/u, '');
  return /^(?:событие|мероприятие|тематический вечер)(?: (?:вечером|на вечер))?$/u.test(title) ? '' : title;
}

const alreadyAdded = (plan, event) => plan.days.some(day => day.items.some(item => item.eventId === event.id));
const isPast = (event, now) => event.date < now.date || (event.date === now.date && minutes(event.time) < now.minute);
const slotLabel = event => `${event.title} · ${dateLabel(event.date)} · ${event.time}–${event.endTime}`;

function eventDescription(event, plan, short) {
  const location = event.location ? ` · ${event.location}` : '';
  const status = alreadyAdded(plan, event) ? ' · в вашем плане' : '';
  const description = event.description?.trim() || '';
  const detail = short && description.length > 180 ? `${description.slice(0, 177).trimEnd()}…` : description;
  return `${slotLabel(event)}${location}${status}${detail ? `\n${detail}` : ''}`;
}

function addSuggestion(event) {
  const title = event.title.replace(/[«»“”"]/gu, '');
  return { label: `Добавить ${event.title} · ${dateLabel(event.date)} в ${event.time}`, query: `Добавь «${title}» из афиши на ${event.date} в ${event.time}` };
}

function addEvent(plan, event, now) {
  if (alreadyAdded(plan, event)) return reply(`«${event.title}» уже в вашем плане.`);
  if (isPast(event, now)) return reply('Это мероприятие уже началось. Выберите другое событие из афиши.');
  const edit = hotelEventEdit(event);
  const { error } = applyScheduleEdit(plan, edit);
  if (error) return reply(error);
  return reply(`${eventDescription(event, plan)}\n\nДобавить мероприятие в ваш план?`, {
    proposals: [{ label: slotLabel(event), edit }],
  });
}

async function readEvents(plan, { dates, theme, late, time, name, adding }, now, getEvents) {
  let events;
  try {
    events = await getEvents({ dateFrom: dates[0], dateTo: dates.at(-1) });
  } catch {
    return unavailable();
  }
  if (!Array.isArray(events)) return unavailable();

  const published = events.filter(event => event && isHotelEventEdit(hotelEventEdit(event))
    && dates.includes(event.date) && (!theme || event.type === 'theme-night')
    && (!late || minutes(event.time) >= eveningStart) && (!time || event.time === time));
  const ordered = published.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const match = nameKey(name);
  let matches = ordered;
  if (match) {
    matches = ordered.filter(event => nameKey(event.title) === match);
    if (!matches.length) matches = ordered.filter(event => nameKey(event.title).includes(match));
  }
  if (!matches.length) {
    if (name) return reply(`Событие «${name}» не нашлось в опубликованной афише на эти даты.`);
    const when = dates.length === 1 ? `На ${dateLabel(dates[0])}` : 'На выбранные даты поездки';
    const category = theme ? 'тематические вечера' : late ? 'вечерние мероприятия' : 'мероприятия';
    return reply(`${when} ${category} пока не опубликованы.`);
  }
  if (adding && matches.length === 1) return addEvent(plan, matches[0], now);

  const shown = matches.slice(0, 5);
  const heading = adding ? 'Какое мероприятие добавить?' : 'Афиша отеля';
  const descriptions = shown.map(event => eventDescription(event, plan, shown.length > 1)).join('\n\n');
  const links = matches.length > shown.length ? [{ label: 'Полная афиша', href: '#planner-afisha-title' }] : undefined;
  const suggestions = shown.filter(event => !alreadyAdded(plan, event) && !isPast(event, now)).map(addSuggestion);
  return reply(`${heading}\n\n${descriptions}`, { suggestions, links });
}

export function answerHolidayChatEvents(plan, input, now, getEvents) {
  const raw = String(input ?? '');
  const value = normalize(raw).replace(/[.!?]+$/u, '');
  const query = value.replace(quoted, '').replace(/\s+/gu, ' ').trim();
  const theme = themeNight.test(query);
  const late = evening.test(query);
  const venue = /(?<![а-я])(?:в|у) отел[ея](?![а-я])/u.test(query);
  const asksWhat = /^(?:а )?(?:что|куда сходить)(?![а-я])/u.test(query);
  const hotelQuestion = venue && asksWhat
    && /(?<![а-я])(?:сегодня|завтра|послезавтра|будет|проводится|происходит)(?![а-я])/u.test(query);
  const eveningQuestion = late && asksWhat && !/(?<![а-я])у (?:нас|меня)(?![а-я])/u.test(query);
  if (!theme && !eventWord.test(query) && !eveningQuestion && !hotelQuestion) return null;
  if (personalPlan.test(query) && !/афиш/u.test(query)) return null;
  if (otherEdit.test(query)) return null;

  const allDates = plan?.days?.map(day => day.date).sort() ?? [];
  if (!allDates.length) return reply('Составьте план отдыха, чтобы я мог показать афишу на даты поездки.');
  const date = Number.isFinite(dateNumber(now?.date)) ? now.date : allDates[0];
  const minute = Number.isInteger(now?.minute) ? now.minute : 0;
  const reference = dayReference(query, plan, date);
  if (reference && dayReference(query.slice(reference.index + reference.value.length), plan, date)) {
    return reply('Уточните одну дату или спросите афишу на всю поездку.');
  }
  const dates = reference ? allDates.filter(day => reference.dates.includes(day)) : allDates;
  if (!dates.length) return reply(`Эта дата вне вашей поездки. Отдых запланирован с ${dateLabel(allDates[0])} по ${dateLabel(allDates.at(-1))}.`);
  if (typeof getEvents !== 'function') return unavailable();
  const command = value.match(addCommand);
  const name = eventTitle(raw, value, command, reference);
  const time = query.match(clockPattern)?.[1].padStart(5, '0');
  return readEvents(plan, { dates, theme, late, time, name, adding: Boolean(command) }, { date, minute }, getEvents);
}
