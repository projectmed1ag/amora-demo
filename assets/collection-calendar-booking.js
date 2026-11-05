import { collectionDestinations, destinationAsset, destinationLocalDate } from './collection-destinations.js?v=20261024-all-hotels-1';

const DAY = 86_400_000;
function cityFromURL(url) {
  const query = url.searchParams.get('city');
  if (Object.hasOwn(collectionDestinations, query)) return query;
  const folders = url.pathname.split('/').filter(Boolean);
  for (const city of ['ruza', 'krasnoyarsk']) if (folders.includes(city)) return city;
  if (!folders.includes('prototypes') && ['hotel.html', 'booking.html', 'rooms.html'].includes(folders.at(-1))) return 'mozhaysk';
  return null;
}
function contextCity() {
  const declared = document.documentElement.dataset.city;
  if (Object.hasOwn(collectionDestinations, declared)) return declared;
  const current = cityFromURL(new URL(location.href));
  if (current) return current;
  if (document.referrer) {
    const previous = new URL(document.referrer);
    if (previous.origin === location.origin) {
      const city = cityFromURL(previous);
      if (city) return city;
    }
  }
  return 'ruza';
}
const bookingCity = contextCity();
let TODAY = destinationLocalDate(new Date(), bookingCity);
const requestedRoom = new URL(location.href).searchParams.get('room');
const initialRoom = collectionDestinations[bookingCity].rooms.some(room => room.id === requestedRoom) ? requestedRoom : 'comfort';
const INITIAL = { city: bookingCity, guests: 2, category: initialRoom, month: TODAY.slice(0, 7) + '-01', start: null, end: null };
const state = { ...INITIAL };
const baseRates = { standard: 8000, comfort: 9000, 'junior-suite': 12000, suite: 16000 };
const blockedDays = { standard: [10, 11, 20], comfort: [12, 13], 'junior-suite': [16, 17], suite: [21, 22] };
const cityRate = { ruza: 1, mozhaysk: 1.1, krasnoyarsk: 1.2 };
const $ = selector => document.querySelector(selector);
const date = value => new Date(`${value}T00:00:00Z`);
const iso = value => value.toISOString().slice(0, 10);
const addDays = (value, count) => iso(new Date(date(value).getTime() + DAY * count));
const nights = (start, end) => Math.round((date(end) - date(start)) / DAY);
const fullDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const number = new Intl.NumberFormat('ru-RU');
const money = amount => `${number.format(amount)} ₽`;
const destination = () => collectionDestinations[state.city];
const category = () => destination().rooms.find(room => room.id === state.category);

function node(tag, className = '', text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function plural(count, one, few, many) {
  if (count % 100 >= 11 && count % 100 <= 14) return many;
  if (count % 10 === 1) return one;
  return count % 10 >= 2 && count % 10 <= 4 ? few : many;
}

function guestText(count) { return `${count} ${plural(count, 'гость', 'гостя', 'гостей')}`; }
function nightText(count) { return `${count} ${plural(count, 'ночь', 'ночи', 'ночей')}`; }
function isBlocked(value) { return blockedDays[state.category].includes(date(value).getUTCDate()); }
function rate(value) {
  const weekday = date(value).getUTCDay();
  const weekend = weekday === 5 ? 1000 : weekday === 6 ? 2000 : 0;
  return Math.round((baseRates[state.category] + weekend) * cityRate[state.city] / 100) * 100;
}

function rangeProblem(start = state.start, end = state.end) {
  if (!start) return 'Выберите дату заезда.';
  if (start < TODAY) return `Выберите заезд начиная с ${shortDate.format(date(TODAY))}.`;
  if (isBlocked(start)) return `Заезд ${shortDate.format(date(start))} недоступен для категории «${category().name}». Выберите другую дату заезда.`;
  if (!end) return 'Теперь выберите дату выезда.';
  if (nights(start, end) <= 0) return 'Дата выезда должна быть позже даты заезда.';
  if (category().guests < state.guests) return 'Для выбранного числа гостей нужна более вместительная категория.';
  for (let day = start; day < end; day = addDays(day, 1)) {
    if (isBlocked(day)) return `Ночь ${shortDate.format(date(day))} недоступна для категории «${category().name}». Выберите другой период или категорию.`;
  }
  return '';
}

function canCheckout(value) {
  return Boolean(state.start && value > state.start && !rangeProblem(state.start, value));
}

function isDateSelectable(value) {
  return value >= TODAY && (!isBlocked(value) || canCheckout(value));
}

function totalPrice() {
  if (!state.start || !state.end || rangeProblem()) return 0;
  let result = 0;
  for (let day = state.start; day < state.end; day = addDays(day, 1)) result += rate(day);
  return result;
}

function periodText() {
  if (!state.start) return 'Выберите даты отдыха';
  if (!state.end) return `${shortDate.format(date(state.start))} — выберите выезд`;
  const start = date(state.start);
  const end = date(state.end);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  const dates = sameMonth ? `${start.getUTCDate()} — ${shortDate.format(end)}` : `${shortDate.format(start)} — ${shortDate.format(end)}`;
  return `${dates} · ${nightText(nights(state.start, state.end))} · ${guestText(state.guests)}`;
}

function renderCategory() {
  const select = $('#stay-category');
  select.replaceChildren();
  destination().rooms.forEach(room => {
    const option = node('option', '', room.name);
    option.value = room.id;
    option.disabled = room.guests < state.guests;
    if (option.disabled) option.textContent = `${room.name} · до ${room.guests} гостей`;
    select.append(option);
  });
  select.value = state.category;
  const room = category();
  $('#category-photo').src = destinationAsset(room.src);
  $('#category-photo').alt = room.alt;
  $('#category-caption').textContent = `${room.area} м² · до ${room.guests} гостей`;
  $('#arrival-caption').textContent = `Заезд с 15:00 · выезд до 12:00 · ${destination().timeLabel}`;
  document.documentElement.dataset.city = state.city;
}

function renderCalendar(focusDate = null) {
  const month = date(state.month);
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const dayCount = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leading = (month.getUTCDay() + 6) % 7;
  const cellCount = Math.ceil((leading + dayCount) / 7) * 7;
  $('#month-heading').textContent = monthFormat.format(month).replace(' г.', '');
  $('#month-prev').disabled = state.month <= TODAY.slice(0, 7) + '-01';
  const grid = $('#month-grid');
  grid.replaceChildren();
  for (let index = 0; index < cellCount; index++) {
    const day = index - leading + 1;
    if (day < 1 || day > dayCount) {
      const blank = node('div', 'month-blank');
      blank.setAttribute('aria-hidden', 'true');
      grid.append(blank);
      continue;
    }
    const value = iso(new Date(Date.UTC(year, monthIndex, day)));
    const past = value < TODAY;
    const unavailable = isBlocked(value);
    const checkoutOnly = unavailable && !past && canCheckout(value);
    const classes = ['month-day'];
    if (value === TODAY) classes.push('is-today');
    if (unavailable && !past && !checkoutOnly) classes.push('is-unavailable');
    if (checkoutOnly) classes.push('is-checkout-only');
    if (state.start && state.end && value > state.start && value < state.end) classes.push('is-range');
    if (value === state.start) classes.push('is-start');
    if (value === state.end) classes.push('is-end');
    const button = node('button', classes.join(' '));
    button.type = 'button';
    button.dataset.date = value;
    button.disabled = past || (unavailable && !checkoutOnly);
    button.setAttribute('aria-pressed', String(value === state.start || value === state.end || Boolean(state.start && state.end && value > state.start && value < state.end)));
    const selected = value === state.start ? ', заезд' : value === state.end ? ', выезд' : '';
    button.setAttribute('aria-label', `${fullDate.format(date(value))}${selected}${past ? ', прошедшая дата' : checkoutOnly ? ', только выезд, ночёвка недоступна' : unavailable ? ', занятая ночь, заезд недоступен' : `, ${money(rate(value))} за ночь`}`);
    button.append(node('span', 'day-number', day));
    if (value === TODAY) button.append(node('span', 'day-today', 'сегодня'));
    if (!unavailable) {
      const price = node('span', 'day-price', number.format(rate(value)));
      price.append(node('span', 'day-currency', ' ₽'));
      button.append(price);
    } else if (checkoutOnly) button.append(node('span', 'day-checkout', 'только выезд'));
    button.addEventListener('click', () => selectDate(value));
    grid.append(button);
  }
  const blocked = blockedDays[state.category].filter(day => day <= dayCount).map(day => String(day)).join(', ');
  const help = document.querySelector('.calendar-help p');
  if (help) help.textContent = 'Цена за ночь · Занятые ночи нельзя забронировать';
  $('#availability-note').textContent = `В демо заняты ночи ${blocked} ${shortDate.format(new Date(Date.UTC(year, monthIndex, 1))).split(' ').slice(1).join(' ')} для категории «${category().name}». Выезд в занятую дату разрешён после свободных ночей.`;
  if (focusDate) grid.querySelector(`[data-date="${focusDate}"]`)?.focus();
}

function showDateError(message) {
  $('#dates-error').textContent = message;
  $('#dates-error').hidden = !message;
}

function refreshToday() {
  const localToday = destinationLocalDate(new Date(), bookingCity);
  if (localToday === TODAY) return '';
  TODAY = localToday;
  const currentMonth = TODAY.slice(0, 7) + '-01';
  if (state.month < currentMonth) state.month = currentMonth;
  let message = '';
  if (state.start && state.start < TODAY) {
    state.start = null;
    state.end = null;
    message = 'Наступил новый день: выбранный заезд уже в прошлом. Даты сброшены. Выберите новый период.';
  }
  renderCalendar();
  renderSummary();
  if (message) showDateError(message);
  else if (state.end) showDateError(rangeProblem());
  if ($('#contact-dialog').open) {
    $('#contact-trip').textContent = `${destination().name} · ${category().name} · ${periodText()}`;
    updatePayment();
    const problem = rangeProblem();
    $('#confirm-demo').disabled = Boolean(problem);
    if (problem) {
      $('#contact-error').textContent = message || problem;
      $('#contact-error').hidden = false;
    }
  }
  return message;
}

function renderSummary() {
  const problem = rangeProblem();
  const total = totalPrice();
  $('#selected-period').textContent = periodText();
  $('#selected-category').textContent = category().name;
  $('#selected-location').textContent = `Расположение: ${destination().name}`;
  $('#trip-price').textContent = total ? money(total) : '—';
  $('#trip-deposit').textContent = total ? `Предоплата от ${money(Math.round(total * .3))}` : 'Выберите доступный период';
  $('#continue-booking').disabled = Boolean(problem);
  $('#selection-instruction').textContent = !state.start
    ? 'Выберите дату заезда, затем дату выезда.'
    : !state.end
      ? 'Выберите дату выезда, в том числе с пометкой «только выезд». Чтобы снять заезд, нажмите на него ещё раз.'
      : isBlocked(state.end)
        ? 'Заезд и выезд выбраны. Повторное нажатие на заезд сбросит даты, на выезд — снимет дату выезда.'
        : 'Выбраны заезд и выезд. Повторное нажатие на заезд сбросит даты.';
}

function resetDates(focusDate = null) {
  refreshToday();
  state.start = null;
  state.end = null;
  showDateError('');
  renderCalendar(focusDate);
  renderSummary();
}

function selectDate(value) {
  refreshToday();
  const checkoutOnly = isBlocked(value) && canCheckout(value);
  if (value < TODAY || (isBlocked(value) && !checkoutOnly)) {
    const checkoutProblem = state.start && value > state.start ? rangeProblem(state.start, value) : '';
    showDateError(value < TODAY
      ? `Выберите заезд начиная с ${shortDate.format(date(TODAY))}.`
      : checkoutProblem || `Ночь ${shortDate.format(date(value))} занята. Эту дату можно выбрать только для выезда после свободных ночей. Для заезда выберите свободную дату.`);
    return;
  }
  if (value === state.start) { resetDates(value); return; }
  showDateError('');
  if (checkoutOnly) {
    state.end = state.end === value ? null : value;
  } else if (!state.start || state.end || value < state.start) {
    state.start = value;
    state.end = null;
  } else {
    const problem = rangeProblem(state.start, value);
    if (problem) { showDateError(problem); return; }
    state.end = value;
  }
  renderCalendar(value);
  renderSummary();
}

function changeMonth(change) {
  refreshToday();
  const current = date(state.month);
  const next = iso(new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + change, 1)));
  if (next < TODAY.slice(0, 7) + '-01') return;
  state.month = next;
  renderCalendar();
}

function updateChoice() {
  const dateMessage = refreshToday();
  const previous = state.category;
  const available = destination().rooms.filter(room => room.guests >= state.guests);
  if (!available.some(room => room.id === state.category)) state.category = available[0].id;
  $('#capacity-notice').textContent = previous !== state.category ? `Для ${guestText(state.guests)} выбрана категория «${category().name}» с подходящей вместимостью.` : '';
  let clearedMessage = '';
  if (state.start && (state.start < TODAY || isBlocked(state.start))) {
    clearedMessage = state.start < TODAY
      ? `Заезд ${shortDate.format(date(state.start))} уже в прошлом. Даты сброшены. Выберите новую дату заезда.`
      : `Заезд ${shortDate.format(date(state.start))} недоступен для категории «${category().name}». Даты сброшены. Выберите новую дату заезда.`;
    state.start = null;
    state.end = null;
  }
  renderCategory();
  renderCalendar();
  renderSummary();
  const problem = clearedMessage || dateMessage || (state.end ? rangeProblem() : '');
  showDateError(problem);
}

function updatePayment() {
  const total = totalPrice();
  const deposit = Math.round(total * .3);
  $('#payment-deposit').textContent = money(deposit);
  $('#payment-full').textContent = money(total);
  $('#contact-due').textContent = money($('#contact-form input[name="payment"]:checked').value === 'full' ? total : deposit);
}

function openContact() {
  const dateMessage = refreshToday();
  const problem = rangeProblem();
  if (problem) { showDateError(dateMessage || problem); return; }
  $('#contact-trip').textContent = `${destination().name} · ${category().name} · ${periodText()}`;
  $('#contact-error').hidden = true;
  $('#confirm-demo').disabled = false;
  updatePayment();
  $('#contact-dialog').showModal();
  $('#contact-name').focus();
}

function contactProblem() {
  if ($('#contact-name').value.trim().length < 2) return ['Укажите имя и фамилию — не менее двух символов.', '#contact-name'];
  const phone = $('#contact-phone').value.trim();
  const digits = phone.replace(/\D/g, '');
  if (!/^\+?[\d\s()-]+$/.test(phone) || digits.length < 10 || digits.length > 15) return ['Проверьте телефон: нужно от 10 до 15 цифр.', '#contact-phone'];
  const email = $('#contact-email');
  if (!email.value.trim() || !email.validity.valid) return ['Укажите корректный адрес электронной почты.', '#contact-email'];
  if (!$('#demo-consent').checked) return ['Подтвердите, что понимаете тестовый характер бронирования.', '#demo-consent'];
  return null;
}

function renderSuccess() {
  const total = totalPrice();
  const payment = $('#contact-form input[name="payment"]:checked').value;
  $('#success-greeting').textContent = `${$('#contact-name').value.trim()}, вы прошли весь путь бронирования. Ниже — выбранные вами параметры.`;
  const details = $('#success-details');
  details.replaceChildren();
  const values = [
    ['Расположение', destination().name], ['Категория', `${category().name} · ${category().area} м²`],
    ['Даты', `${fullDate.format(date(state.start))} — ${fullDate.format(date(state.end))}`],
    ['Проживание', `${nightText(nights(state.start, state.end))} · ${guestText(state.guests)}`],
    ['Итого', money(total)], ['Вариант оплаты', payment === 'full' ? 'Полная оплата' : 'Предоплата 30%'],
    ['В демо к оплате', money(payment === 'full' ? total : Math.round(total * .3))]
  ];
  values.forEach(([label, value]) => {
    const field = node('div');
    field.append(node('dt', '', label), node('dd', '', value));
    details.append(field);
  });
  $('#contact-dialog').close();
  $('#booking-view').hidden = true;
  $('#success-view').hidden = false;
  $('#success-heading').focus();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

$('#month-prev').addEventListener('click', () => changeMonth(-1));
$('#month-next').addEventListener('click', () => changeMonth(1));
$('#reset-dates').addEventListener('click', () => resetDates());
$('#stay-guests').addEventListener('change', event => { state.guests = Number(event.target.value); updateChoice(); });
$('#stay-category').addEventListener('change', event => { state.category = event.target.value; updateChoice(); });
$('#continue-booking').addEventListener('click', openContact);
$('#close-contact').addEventListener('click', () => $('#contact-dialog').close());
$('#sample-data').addEventListener('click', () => {
  $('#contact-name').value = 'Анна Смирнова';
  $('#contact-phone').value = '+7 900 000-00-00';
  $('#contact-email').value = 'guest@example.com';
  const problem = rangeProblem();
  $('#contact-error').textContent = problem;
  $('#contact-error').hidden = !problem;
});
document.querySelectorAll('#contact-form input[name="payment"]').forEach(input => input.addEventListener('change', updatePayment));
$('#contact-form').addEventListener('submit', event => {
  event.preventDefault();
  const dateMessage = refreshToday();
  const rangeError = rangeProblem();
  if (rangeError) { $('#contact-error').textContent = dateMessage || rangeError; $('#contact-error').hidden = false; return; }
  const error = contactProblem();
  if (error) { $('#contact-error').textContent = error[0]; $('#contact-error').hidden = false; $(error[1]).focus(); return; }
  renderSuccess();
});
$('#restart-booking').addEventListener('click', () => {
  refreshToday();
  Object.assign(state, INITIAL, { month: TODAY.slice(0, 7) + '-01' });
  $('#stay-guests').value = String(state.guests);
  $('#contact-form').reset();
  $('#success-view').hidden = true;
  $('#booking-view').hidden = false;
  updateChoice();
  $('#page-title').focus();
  window.scrollTo({ top: 0, behavior: 'instant' });
});

$('#month-grid').addEventListener('keydown', event => {
  const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  const movement = moves[event.key];
  if (!movement || !event.target.matches('button[data-date]')) return;
  event.preventDefault();
  refreshToday();
  let target = addDays(event.target.dataset.date, movement);
  const direction = movement > 0 ? 1 : -1;
  for (let attempt = 0; attempt < 40 && !isDateSelectable(target); attempt++) target = addDays(target, direction);
  if (!isDateSelectable(target)) return;
  state.month = target.slice(0, 7) + '-01';
  renderCalendar(target);
});

window.addEventListener('pageshow', () => refreshToday());
window.addEventListener('focus', () => refreshToday());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshToday();
});

renderCategory();
renderCalendar();
renderSummary();
