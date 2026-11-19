export const TIME_STEP_MINUTES = 15;
export const timeStepMessage = 'Выберите время с шагом 15 минут.';

export const minutes = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN;
export const clock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
export const isQuarterHour = value => minutes(value) % TIME_STEP_MINUTES === 0;
export const ceilQuarterHour = value => Math.ceil(value / TIME_STEP_MINUTES) * TIME_STEP_MINUTES;

const slots = Array.from({ length: 1440 / TIME_STEP_MINUTES }, (_, index) => index * TIME_STEP_MINUTES);

export function quarterHourOptions(value, { min = 0, max = 1439, keepSaved = false } = {}) {
  const selected = minutes(value);
  const saved = keepSaved && Number.isFinite(selected) && !isQuarterHour(value)
    ? `<option value="${clock(selected)}" selected hidden>${clock(selected)} (сохранено)</option>` : '';
  return '<option value="">Выберите время</option>' + saved + slots
    .filter(minute => minute >= min && minute <= max)
    .map(minute => `<option value="${clock(minute)}"${selected === minute ? ' selected' : ''}>${clock(minute)}</option>`)
    .join('');
}

export function useQuarterHourSelect(input) {
  const select = document.createElement('select');
  for (const { name, value } of input.attributes) {
    if (!['type', 'step', 'value'].includes(name)) select.setAttribute(name, value);
  }
  select.innerHTML = quarterHourOptions(input.value);
  input.replaceWith(select);
  return select;
}
