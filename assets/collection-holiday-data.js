import { nearbyPlaces } from './mozhaysk-nearby-data.js';
import { localReferenceRoutes } from './collection-holiday-local-routes.js';

export const attractions = nearbyPlaces.map(({ id, title, coordinates, source }) => ({ id, title, coordinates, source }));
export const demoOrigin = '55.6114867,35.7982525';
export const demoOriginLabel = 'Временная точка старта A’MORE Collection — перекрёсток Лесной и Прибрежной улиц в Горетове. Точное место въезда в отель уточняется.';
export const localRouteDescriptions = {
  walk: 'От перекрёстка Лесной и Прибрежной улиц по Прибрежной до Зелёной улицы и обратно.',
  bike: 'От перекрёстка Лесной и Прибрежной улиц до центра Горетова по местным дорогам и обратно.',
};

// One-way estimates from the reference routes in collection-holiday-map-data.js.
// Valhalla / FOSSGIS · OpenStreetMap contributors (ODbL), 7 November 2026.
const referenceTravelSeconds = {
  auto: { borodino: 2298.38, nikolsky: 1549.51, luzhetsky: 1460.293 },
  walk: { borodino: 20878.072, nikolsky: 14935.898, luzhetsky: 14277.625 },
};

function parseCoordinates(value) {
  if (!/^[+-]?\d+(?:\.\d+)?\s*,\s*[+-]?\d+(?:\.\d+)?$/.test(value)) return null;
  const [lat, lon] = value.split(',').map(Number);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
}

const referenceOrigin = parseCoordinates(demoOrigin);

function straightLineKm([lat, lon], [targetLat, targetLon]) {
  const radians = n => n * Math.PI / 180;
  const angle = Math.sin(radians(targetLat - lat) / 2) ** 2
    + Math.cos(radians(lat)) * Math.cos(radians(targetLat)) * Math.sin(radians(targetLon - lon) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(angle), Math.sqrt(Math.max(0, 1 - angle)));
}

function distanceMinutes(point, destination, mode) {
  // A planning allowance for longer paths and different paces, without geocoding or live traffic.
  const speed = mode === 'walk' ? 4 : 35;
  const estimatedMinutes = straightLineKm(point, destination) * 1.4 / speed * 60;
  return Math.max(10, Math.ceil(estimatedMinutes / 5) * 5);
}

export function estimateOutingTravel(place, transport, origin = demoOrigin) {
  if (!place) return { travelMinutes: NaN, travelEstimateSource: 'unavailable' };
  const value = typeof origin === 'string' ? origin.trim() : '';
  const point = parseCoordinates(value);
  const atReferenceOrigin = !value || point?.every((coordinate, index) => coordinate === referenceOrigin[index]);
  const mode = transport === 'walk' ? 'walk' : 'auto';
  const seconds = referenceTravelSeconds[mode][place.id];
  if (atReferenceOrigin && seconds) return { travelMinutes: Math.ceil(seconds / 300) * 5, travelEstimateSource: 'reference' };
  if (value && !point) return {
    travelMinutes: seconds ? Math.ceil(seconds / 300) * 5 : distanceMinutes(referenceOrigin, place.coordinates, mode),
    travelEstimateSource: 'default-origin',
  };
  return {
    travelMinutes: distanceMinutes(point || referenceOrigin, place.coordinates, mode),
    travelEstimateSource: 'coordinates',
  };
}
export const interests = [
  { id: 'beach', title: 'Пляж и отдых у воды', detail: 'Тишина, книга и свободное время' },
  { id: 'walk', title: 'Прогулки', detail: 'Неспешный маршрут с остановками' },
  { id: 'bike', title: 'Велосипеды', detail: 'Прогулка по разрешённым велотропам' },
  { id: 'buggy', title: 'Багги', detail: 'Выезд по маршруту с инструктором' },
  { id: 'sights', title: 'Достопримечательности', detail: 'Бородино, Можайск и окрестности' },
];
export const onsiteInterests = interests.filter(item => item.id !== 'sights');
export const childActivityOptions = [
  { id: 'creative', title: 'Рисование и поделки', detail: 'Спокойные творческие занятия', minAge: 3 },
  { id: 'games', title: 'Подвижные игры', detail: 'Игры на территории с учётом погоды', minAge: 3 },
  { id: 'quest', title: 'Игра-квест', detail: 'Поиск подсказок и командные задания', minAge: 7 },
  { id: 'walk', title: 'Семейная прогулка', detail: 'Короткий маршрут с остановками', minAge: 0 }
];
export const outingTransports = {
  auto: { title: 'На своей машине', detail: 'Поедете самостоятельно. В расписании будет время на дорогу в обе стороны.' },
  walk: { title: 'Пешком', detail: 'Для близких мест. Проверьте реальный путь и запас времени на карте.' },
  taxi: { title: 'На такси', detail: 'Можно заказать машину самостоятельно. Учтите время подачи и обратной поездки.' },
  transfer: { title: 'Помощь с трансфером', detail: 'Попросите отель уточнить возможность поездки, время подачи и стоимость.' },
  guided: { title: 'Экскурсия с перевозкой', detail: 'Попросите отель уточнить возможность экскурсии с гидом и транспортом.' },
};
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
  const { turnaround } = localReferenceRoutes[mode];
  url.searchParams.set('mode', 'routes');
  url.searchParams.set('rtext', `${demoOrigin}~${turnaround}~${demoOrigin}`);
  url.searchParams.set('rtt', mode === 'bike' ? 'bc' : 'pd');
  return url.href;
}
