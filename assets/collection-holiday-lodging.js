import { additionalHouses } from './collection-additional-house-data.js';
import { collectionDestinations, destinationURL } from './collection-destinations.js?v=20261024-all-hotels-1';

const destination = collectionDestinations.mozhaysk;

export const holidayLodgings = Object.freeze([...destination.rooms, ...additionalHouses].map(room => Object.freeze({
  id: room.id,
  name: room.name,
  label: `${destination.stayLabel} «${room.name}»`,
  capacity: room.guests,
  detailsHref: destinationURL(`rooms.html#stay-${room.id}`, destination.id).href,
  bookingHref: destinationURL('booking.html', destination.id, { room: room.id }).href,
})));

export function eligibleHolidayLodgings(guestCount) {
  return holidayLodgings.filter(room => room.capacity >= guestCount);
}
