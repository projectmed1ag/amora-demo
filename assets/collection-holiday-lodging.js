import { additionalHouses } from './collection-additional-house-data.js';
import { collectionDestinations, destinationAsset, destinationURL } from './collection-destinations.js?v=20261024-all-hotels-1';

const destination = collectionDestinations.mozhaysk;
const galleryCovers = {
  standard: 'images/rooms/mozhaysk/standard-houseboat/exterior-day.jpg',
  comfort: 'images/rooms/mozhaysk/plan-interiors/fd78-bedroom.jpg',
  'junior-suite': 'images/rooms/mozhaysk/plan-interiors/fd144-living-reverse.jpg',
  suite: 'images/rooms/mozhaysk/plan-interiors/fd156-bedroom.jpg',
};

export const holidayLodgings = Object.freeze([...destination.rooms, ...additionalHouses].map(room => Object.freeze({
  id: room.id,
  name: room.name,
  label: `${destination.stayLabel} «${room.name}»`,
  capacity: room.guests,
  photo: destinationAsset(galleryCovers[room.id] || `images/mozhaysk-render-photos-20261106/${room.id}/exterior.jpg`),
  detailsHref: destinationURL(`rooms.html#stay-${room.id}`, destination.id).href,
  bookingHref: destinationURL('booking.html', destination.id, { room: room.id }).href,
})));

export function eligibleHolidayLodgings(guestCount) {
  return holidayLodgings.filter(room => room.capacity >= guestCount);
}
