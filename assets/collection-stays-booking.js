import { destinationLocalDate } from './collection-destinations.js?v=20261024-all-hotels-1';
import { addDays } from './collection-holiday-engine.js?v=20261118-aero-home-1';
import { holidayLodgings } from './collection-holiday-lodging.js';

const form = document.querySelector('.aero-stays-booking-form');
const { city, checkin, checkout, guests, room } = form.elements;
const maxGuests = Math.max(...holidayLodgings.map(lodging => lodging.capacity));

guests.max = String(maxGuests);

function updateRooms() {
  if (!guests.validity.valid) return;
  const selected = room.value;
  const options = holidayLodgings.filter(lodging => lodging.capacity >= Number(guests.value));
  room.replaceChildren(new Option('Выберите хаусбот', ''), ...options.map(lodging => new Option(lodging.name, lodging.id)));
  room.value = options.some(lodging => lodging.id === selected) ? selected : '';
}

function updateDateLimits() {
  checkin.min = destinationLocalDate(new Date(), city.value);
  checkout.min = addDays(checkin.value >= checkin.min ? checkin.value : checkin.min, 1);
}

guests.addEventListener('input', updateRooms);
checkin.addEventListener('input', updateDateLimits);
form.addEventListener('submit', event => {
  event.preventDefault();
  updateDateLimits();
  if (!form.reportValidity()) return;

  const target = new URL(form.action);
  target.search = new URLSearchParams({ city: city.value, room: room.value });
  // The booking redirect forwards the same handoff used by the vacation planner.
  target.hash = new URLSearchParams({
    plan: '1',
    checkIn: checkin.value,
    checkOut: checkout.value,
    roomId: room.value,
    guests: guests.value,
  }).toString();
  window.location.assign(target);
});

updateDateLimits();
updateRooms();
form.querySelector('button[type="submit"]').disabled = false;
