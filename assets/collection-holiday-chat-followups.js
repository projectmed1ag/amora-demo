import { clock, dateLabel, minutes } from './collection-holiday-engine.js?v=20261108-route-pdf-1';
import { applyScheduleEdit } from './collection-holiday-edits.js?v=20261108-route-pdf-1';

const ordinals = [
  /^(?:перв(?:ый|ую|ое)|1(?:-й|-ую)?)$/u,
  /^(?:втор(?:ой|ую|ое)|2(?:-й|-ую)?)$/u,
  /^(?:трет(?:ий|ью|ье)|3(?:-й|-ю)?)$/u,
  /^(?:четверт(?:ый|ую|ое)|4(?:-й|-ую)?)$/u,
  /^(?:пят(?:ый|ую|ое)|5(?:-й|-ую)?)$/u,
];

function followupText(input) {
  return String(input).toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').trim()
    .replace(/\s+/gu, ' ').replace(/[.!?]+$/u, '')
    .replace(/^(?:(?:а|тогда|давай(?:те)?|выбираю|выбери(?:те)?|беру|берем|можно)[ ,]+)+/u, '');
}

function timeShift(value) {
  const match = value.match(/^(?:на )?(полчаса|час|один час|\d{1,3} (?:минут(?:у|ы)?|час(?:а|ов)?)) (позже|попозже|раньше|пораньше)$/u);
  if (!match) return null;
  const [, amount, direction] = match;
  const count = amount === 'полчаса' ? 30 : amount === 'час' || amount === 'один час' ? 60
    : Number.parseInt(amount, 10) * (amount.includes('час') ? 60 : 1);
  return direction.endsWith('позже') ? count : -count;
}

function shiftedProposal(plan, pending, delta, now) {
  const { proposals, selected } = pending;
  const index = proposals.indexOf(selected);
  if (index < 0) return { text: 'Уточните, какой вариант сдвинуть. Можно написать «второй вариант».', keepPending: true };

  const { edit, bounds } = selected;
  if (edit.type === 'hotel-event') {
    return { text: 'Время события указано в афише отеля. Можно добавить его в это время или выбрать другое событие.', keepPending: true };
  }
  if (!['add', 'move'].includes(edit.type)) {
    return { text: 'Для нового времени напишите, какое занятие перенести.', keepPending: true };
  }

  const start = minutes(edit.time) + delta;
  if (!Number.isInteger(start) || start < 0 || start >= 1440 || edit.date < now?.date
      || (edit.date === now?.date && start < now?.minute)) {
    return { text: 'Новое время выходит за пределы дня или уже прошло. Укажите другое время.', keepPending: true };
  }

  const time = clock(start);
  const shifted = { ...edit, time };
  if (shifted.type === 'add') {
    shifted.itemId = `chat:${edit.date}:${time}:${edit.replacementId}`;
    delete shifted.windowStart;
    delete shifted.windowEnd;
  }
  const result = applyScheduleEdit(plan, shifted);
  if (result.error) {
    return { text: `На ${time} изменить время не получится. ${result.error}`, keepPending: true };
  }
  const changed = result.plan.days.find(day => day.date === edit.date).items.find(item => item.id === shifted.itemId);
  if (bounds && (start < bounds.start || changed.end > bounds.end)) {
    return { text: `В ${time} занятие выйдет за пределы выбранного интервала. Укажите другое время.`, keepPending: true };
  }
  if (shifted.type === 'add') {
    const day = plan.days.find(day => day.date === edit.date);
    const window = day.items.find(item => item.kind === 'free' && start >= item.start && changed.end <= item.end);
    shifted.windowStart = window.start;
    shifted.windowEnd = window.end;
  }

  const label = `${changed.title} · ${dateLabel(edit.date)} · ${time}–${clock(changed.end)}${selected.labelSuffix ?? ''}`;
  const updated = proposals.map((option, optionIndex) => optionIndex === index ? { ...selected, edit: shifted, label } : option);
  return { text: 'Новое время подходит. Применить изменение к плану?', proposals: updated, selectedIndex: index };
}

export function answerHolidayChatFollowup(plan, input, pending, now) {
  const value = followupText(input);
  const ordinal = ordinals.findIndex(pattern => pattern.test(value.replace(/ вариант$/u, '')));
  const delta = timeShift(value);
  if (ordinal < 0 && delta === null) return null;
  if (!pending || pending.plan !== plan || !pending.proposals?.length) {
    return { text: 'Сначала попросите подобрать занятие или предложить другое время. Затем можно уточнить вариант.' };
  }
  if (ordinal >= 0) {
    return ordinal < pending.proposals.length
      ? { text: `Выбран вариант ${ordinal + 1}. Применить его к плану?`, proposals: pending.proposals, selectedIndex: ordinal }
      : { text: `Сейчас вариантов: ${pending.proposals.length}. Выберите один из показанных.`, keepPending: true };
  }
  if (!delta) return { text: 'Укажите, на сколько минут или часов сдвинуть время.', keepPending: true };
  return shiftedProposal(plan, pending, delta, now);
}
