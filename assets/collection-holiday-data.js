import { nearbyPlaces } from './mozhaysk-nearby-data.js';

export const attractions = nearbyPlaces.map(({ id, title, coordinates, source }) => ({ id, title, coordinates, source }));
export const demoOrigin = '55.6150163,35.795558';
export const demoOriginLabel = 'Горетово у Можайского водохранилища — условная точка старта, не адрес отеля';
export function minimumWalkMinutes(places, origin = demoOrigin) {
  const point = (origin.trim() || demoOrigin).split(',').map(Number);
  if (point.length !== 2 || !point.every(Number.isFinite) || Math.abs(point[0]) > 90 || Math.abs(point[1]) > 180) return 0;
  const radians = n => n * Math.PI / 180;
  const distances = places.map(place => {
    const [lat, lon] = place.coordinates;
    const angle = Math.sin(radians(lat - point[0]) / 2) ** 2 + Math.cos(radians(point[0])) * Math.cos(radians(lat)) * Math.sin(radians(lon - point[1]) / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(angle), Math.sqrt(Math.max(0, 1 - angle)));
  });
  // A lower bound using straight-line distance at 5 km/h, never a claim about
  // the actual pedestrian path, terrain, pace of children or navigation ETA.
  return Math.max(15, Math.ceil(Math.max(0, ...distances) / 5 * 60 / 15) * 15);
}
export const interests = [
  { id: 'beach', title: 'Пляж и отдых у воды', detail: 'Тишина, книга и свободное время' },
  { id: 'walk', title: 'Прогулки', detail: 'Неспешный маршрут с остановками' },
  { id: 'bike', title: 'Велосипеды', detail: 'Прогулка по разрешённым велотропам' },
  { id: 'buggy', title: 'Багги', detail: 'Выезд по маршруту с инструктором' },
  { id: 'sights', title: 'Достопримечательности', detail: 'Бородино, Можайск и окрестности' },
];
export const services = [
  { id: 'restaurant', title: 'Ресторан', detail: 'Ужин или обед за общим столом', duration: 60, preferred: '19:00', page: 'restaurant.html' },
  { id: 'banya', title: 'Баня', detail: 'Два часа с перерывами на отдых', duration: 120, preferred: '16:00', page: 'banya.html' },
  { id: 'barbecue', title: 'Мангальная зона', detail: 'Два часа для неспешного пикника', duration: 120, preferred: '18:00', page: 'spaces.html#barbecue' },
];

export const routeIdeas = {
  walk: 'Схема: ресепшен → разрешённая прогулочная тропа у берега → остановка с видом на воду → возвращение. Конкретную тропу и её состояние уточните у команды отеля.',
  bike: 'Схема: пункт проката → разрешённая велотропа → видовая остановка → возвращение в прокат. Попросите схему доступных троп и подберите длину круга под свою подготовку.',
  buggy: 'Схема: пункт проката → инструктаж и подбор экипировки → разрешённая трасса с инструктором → возвращение. Трек, условия участия и возможность поездки с детьми согласуются с инструктором.',
};

// Destination coordinates come from the site's curated attraction catalogue.
// No hotel coordinates, exact distances or live journey times are invented.
export function mapRoute(place, mode = 'auto', origin = demoOrigin) {
  const url = new URL('https://yandex.ru/maps/');
  url.searchParams.set('mode', 'routes');
  url.searchParams.set('rtext', `${origin.trim() || demoOrigin}~${place.coordinates.join(',')}`);
  url.searchParams.set('rtt', mode === 'walk' ? 'pd' : 'auto');
  return url.href;
}

export function demoLocalRoute(mode) {
  const url = new URL('https://yandex.ru/maps/');
  url.searchParams.set('mode', 'routes');
  url.searchParams.set('rtext', `${demoOrigin}~Троицкая церковь, Горетово, Можайский округ~${demoOrigin}`);
  url.searchParams.set('rtt', mode === 'bike' ? 'bc' : 'pd');
  return url.href;
}
