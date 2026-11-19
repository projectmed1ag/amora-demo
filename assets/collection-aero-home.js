import { destinationDateParts, destinationLocalDate } from './collection-destinations.js?v=20261024-all-hotels-1';
import { addDays, validateTripDates } from './collection-holiday-engine.js?v=20261119-quarter-hour-1';
import { isQuarterHour, timeStepMessage, useQuarterHourSelect } from './collection-time-slots.js?v=20261119-quarter-hour-1';

const form = document.querySelector('.aero-planner');
for (const input of form.querySelectorAll('input[type="time"]')) useQuarterHourSelect(input);
const { startDate, endDate } = form.elements;
const error = document.getElementById('aero-planner-error');
const city = form.elements.city.value;
const today = () => destinationLocalDate(new Date(), city);
const tomorrow = addDays(today(), 1);
let invalidField;

startDate.value ||= tomorrow;
endDate.value ||= startDate.value;

function clearError() {
  invalidField?.removeAttribute('aria-invalid');
  invalidField?.removeAttribute('aria-describedby');
  invalidField = undefined;
  error.hidden = true;
}

function updateLimits() {
  startDate.min = today();
  endDate.min = startDate.value || startDate.min;
}

updateLimits();
form.addEventListener('input', () => {
  clearError();
  updateLimits();
});

form.addEventListener('submit', event => {
  const { hour, minute } = destinationDateParts(new Date(), city);
  const values = Object.fromEntries(new FormData(form));
  const errors = validateTripDates(values, today(), Number(hour) * 60 + Number(minute));
  for (const field of ['arrival', 'departure']) {
    if (values[field] && !isQuarterHour(values[field])) errors[field] = timeStepMessage;
  }
  const firstError = Object.entries(errors)[0];
  if (!firstError) return;

  event.preventDefault();
  clearError();
  const [name, message] = firstError;
  invalidField = form.elements[name];
  invalidField.setAttribute('aria-invalid', 'true');
  invalidField.setAttribute('aria-describedby', error.id);
  error.textContent = message;
  error.hidden = false;
  invalidField.focus();
});
