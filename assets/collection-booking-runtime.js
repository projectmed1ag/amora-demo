import { collectionImageSource } from './collection-image-sources.js?v=20261025-original-quality-1';
import { destinationAsset, destinationLocalDate, getDestination } from './collection-destinations.js?v=20261024-all-hotels-1';

const initializedForms = new WeakSet();
const validatedFields = ['checkin', 'checkout', 'guests', 'name', 'email'];
const findRoom = (id, city) => {
  const rooms = getDestination(city).rooms;
  return rooms.find(room => room.id === id) || rooms[0];
};

export function collectionLocalDate(date = new Date(), city) {
  return destinationLocalDate(date, city);
}

function dateDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return NaN;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
    ? timestamp / 86400000
    : NaN;
}

function nextDate(value) {
  const day = dateDay(value);
  return Number.isFinite(day) ? new Date((day + 1) * 86400000).toISOString().slice(0, 10) : '';
}

export function collectionBookingNights(checkin, checkout) {
  const nights = dateDay(checkout) - dateDay(checkin);
  return Number.isFinite(nights) && nights > 0 ? nights : 0;
}

export function validateCollectionBooking(values, roomId = values.room, today, city) {
  const errors = {};
  const earliestDate = today ?? collectionLocalDate(new Date(), city);
  const checkin = dateDay(values.checkin);
  const checkout = dateDay(values.checkout);
  if (!Number.isFinite(checkin)) errors.checkin = 'Укажите дату заезда.';
  else if (checkin < dateDay(earliestDate)) errors.checkin = 'Дата заезда не может быть в прошлом.';
  if (!Number.isFinite(checkout)) errors.checkout = 'Укажите дату выезда.';
  else if (Number.isFinite(checkin) && checkout <= checkin) errors.checkout = 'Выезд должен быть позже заезда.';

  const room = findRoom(roomId, city);
  const guests = Number(values.guests);
  if (!Number.isInteger(guests) || guests < 1 || guests > room.guests) {
    errors.guests = `Для этой категории выберите от 1 до ${room.guests} гостей.`;
  }
  if (!values.name?.trim()) errors.name = 'Укажите ваше имя.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email?.trim() || '')) {
    errors.email = 'Укажите email в формате name@example.com.';
  }
  return errors;
}

function nightLabel(nights) {
  const last = nights % 10;
  const lastTwo = nights % 100;
  if (last === 1 && lastTwo !== 11) return 'ночь';
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'ночи' : 'ночей';
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

// Enhance the already rendered form; its layout and no-script content stay in HTML.
export function initCollectionBooking() {
  const form = document.getElementById('booking-form');
  if (!form || initializedForms.has(form)) return;
  const destination = getDestination();

  const result = document.getElementById('booking-result');
  const details = document.getElementById('result-details');
  const resultTitle = document.getElementById('result-title');
  const editButton = document.getElementById('edit-booking');
  const capacityNotice = document.getElementById('capacity-notice');
  const submitButton = form.querySelector('[type="submit"]');
  const controls = Object.fromEntries(['room', ...validatedFields].map(name => [name, form.elements.namedItem(name)]));
  if (!result || !details || !resultTitle || !editButton || !submitButton || Object.values(controls).some(control => !control)) return;

  const readValues = () => Object.fromEntries(new FormData(form));
  const queryRoom = new URLSearchParams(location.search).get('room');
  if (queryRoom) controls.room.value = findRoom(queryRoom).id;

  function clearError(name) {
    const error = document.getElementById(`error-${name}`);
    if (!error || !controls[name]) return;
    error.hidden = true;
    error.textContent = '';
    controls[name].removeAttribute('aria-invalid');
  }

  function setSummary(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function updateSummary() {
    const values = readValues();
    const room = findRoom(values.room);
    controls.room.value = room.id;
    if (capacityNotice) capacityNotice.textContent = '';
    if (Number(values.guests) > room.guests) {
      controls.guests.value = String(room.guests);
      if (capacityNotice) capacityNotice.textContent = `В этой категории максимум ${room.guests} гостей. Число гостей обновлено.`;
      clearError('guests');
    }
    for (const option of controls.guests.options) option.disabled = Number(option.value) > room.guests;

    const photo = document.getElementById('summary-photo');
    if (photo && photo.dataset.room !== room.id) {
      let image = photo.querySelector('img');
      if (!image) {
        image = document.createElement('img');
        photo.append(image);
      }
      image.alt = room.alt;
      image.sizes = '(max-width: 700px) 100vw, 44vw';
      const optimized = collectionImageSource(room.src);
      image.srcset = optimized
        ? optimized.variants.filter(frame => frame.width >= Math.min(480, optimized.width)).map(frame => `${destinationAsset(frame.src)} ${frame.width}w`).join(', ')
        : `${destinationAsset(room.mobileSrc)} 768w, ${destinationAsset(room.src)} ${room.imageWidth}w`;
      image.src = destinationAsset(optimized?.src || room.src);
      image.width = optimized?.width || room.imageWidth;
      image.height = optimized?.height || room.imageHeight;
      photo.dataset.room = room.id;
    }
    setSummary('summary-room', room.name);
    setSummary('summary-features', `${room.area} м² · до ${room.guests} гостей`);
    setSummary('summary-guests', controls.guests.value);

    const today = collectionLocalDate();
    controls.checkin.min = today;
    controls.checkout.min = nextDate(Number.isFinite(dateDay(values.checkin)) && values.checkin >= today ? values.checkin : today);
    const nights = collectionBookingNights(values.checkin, values.checkout);
    setSummary('summary-dates', nights
      ? `${formatDate(values.checkin)} — ${formatDate(values.checkout)} · ${nights} ${nightLabel(nights)}`
      : 'Выберите даты');

    const url = new URL(location.href);
    url.searchParams.set('room', room.id);
    url.searchParams.set('city', destination.id);
    history.replaceState(history.state, '', url);
    return room;
  }

  form.addEventListener('input', event => {
    clearError(event.target.name);
    if (['checkin', 'checkout', 'guests'].includes(event.target.name)) updateSummary();
  });
  form.addEventListener('change', event => {
    clearError(event.target.name);
    updateSummary();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const values = readValues();
    const room = findRoom(values.room);
    const errors = validateCollectionBooking(values, room.id);
    validatedFields.forEach(clearError);
    if (Object.keys(errors).length) {
      for (const [name, message] of Object.entries(errors)) {
        controls[name].setAttribute('aria-invalid', 'true');
        const error = document.getElementById(`error-${name}`);
        if (error) {
          error.textContent = message;
          error.hidden = false;
        }
      }
      controls[Object.keys(errors)[0]].focus();
      return;
    }

    const nights = collectionBookingNights(values.checkin, values.checkout);
    const rows = [
      ['Отель', destination.name],
      [destination.stayLabel, room.name],
      ['Даты', `${formatDate(values.checkin)} — ${formatDate(values.checkout)}`],
      ['Продолжительность', `${nights} ${nightLabel(nights)}`],
      ['Гостей', values.guests],
      ['Имя', values.name.trim()],
      ['Email', values.email.trim()],
      ['Стоимость', 'Не рассчитана'],
    ];
    details.replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      row.append(term, description);
      return row;
    }));
    form.hidden = true;
    result.hidden = false;
    resultTitle.focus();
  });
  editButton.addEventListener('click', () => {
    result.hidden = true;
    form.hidden = false;
    controls.room.focus();
  });

  updateSummary();
  initializedForms.add(form);
  form.dataset.ready = 'true';
  submitButton.disabled = false;
}
