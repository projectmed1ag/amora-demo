import { destinationDateParts, destinationLocalDate } from './collection-destinations.js?v=20261024-all-hotels-1';
import { addDays, dateNumber, validateTripDates } from './collection-holiday-engine.js?v=20261120-split-stay-1';
import { isQuarterHour, timeStepMessage, useQuarterHourSelect } from './collection-time-slots.js?v=20261119-quarter-hour-1';

const form = document.querySelector('.aero-planner');
for (const input of form.querySelectorAll('input[type="time"]')) useQuarterHourSelect(input);
const { startDate, endDate } = form.elements;
const error = document.getElementById('aero-planner-error');
const city = form.elements.city.value;
const today = () => destinationLocalDate(new Date(), city);
const tomorrow = addDays(today(), 1);
const defaultCheckout = addDays(tomorrow, 1);
let invalidField;

startDate.value ||= tomorrow;
endDate.value ||= defaultCheckout;

function clearError() {
  invalidField?.removeAttribute('aria-invalid');
  invalidField?.removeAttribute('aria-describedby');
  invalidField = undefined;
  error.hidden = true;
}

function updateLimits() {
  startDate.min = today();
  const arrival = Number.isFinite(dateNumber(startDate.value)) ? startDate.value : startDate.min;
  endDate.min = addDays(arrival, 1);
}

updateLimits();
form.addEventListener('input', event => {
  clearError();
  updateLimits();
  if (event.target === startDate && endDate.value === defaultCheckout && endDate.value < endDate.min) {
    endDate.value = endDate.min;
  }
});

form.addEventListener('submit', event => {
  const { hour, minute } = destinationDateParts(new Date(), city);
  const values = Object.fromEntries(new FormData(form));
  const datesChosen = values.startDate !== tomorrow || values.endDate !== defaultCheckout;
  const errors = validateTripDates(datesChosen ? values : {
    ...values, startDate: tomorrow, endDate: defaultCheckout,
  }, today(), Number(hour) * 60 + Number(minute));
  if (datesChosen && values.startDate && values.endDate === values.startDate) {
    errors.endDate = 'Для проживания в хаусботе дата выезда должна быть позже даты заезда.';
  }
  for (const field of ['arrival', 'departure']) {
    if (values[field] && !isQuarterHour(values[field])) errors[field] = timeStepMessage;
  }
  const firstError = Object.entries(errors)[0];
  event.preventDefault();
  if (!firstError) {
    const target = new URL(form.action);
    if (!datesChosen) {
      delete values.startDate;
      delete values.endDate;
    }
    target.search = new URLSearchParams(values);
    location.assign(target);
    return;
  }
  clearError();
  const [name, message] = firstError;
  invalidField = form.elements[name];
  invalidField.setAttribute('aria-invalid', 'true');
  invalidField.setAttribute('aria-describedby', error.id);
  error.textContent = message;
  error.hidden = false;
  invalidField.focus();
});
