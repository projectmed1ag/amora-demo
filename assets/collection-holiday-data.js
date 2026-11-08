import { nearbyPlaces } from './mozhaysk-nearby-data.js';
import { localReferenceRoutes } from './collection-holiday-local-routes.js';
import { getSeasonActivities, seasonLabels } from './collection-seasons.js';

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
  const minimum = mode === 'walk' ? 10 : 5;
  const estimatedMinutes = straightLineKm(point, destination) * 1.4 / speed * 60;
  return Math.max(minimum, Math.ceil(estimatedMinutes));
}

export function estimateOutingTravel(place, transport, origin = demoOrigin) {
  if (!place) return { travelMinutes: NaN, travelEstimateSource: 'unavailable' };
  const value = typeof origin === 'string' ? origin.trim() : '';
  const point = parseCoordinates(value);
  // Coordinates copied from a map may be rounded without changing the departure point.
  const atReferenceOrigin = !point || straightLineKm(point, referenceOrigin) <= 0.02;
  const mode = transport === 'walk' ? 'walk' : 'auto';
  const seconds = referenceTravelSeconds[mode][place.id];
  const hasReference = atReferenceOrigin && Number.isFinite(seconds);
  return {
    travelMinutes: hasReference ? Math.round(seconds / 60) : distanceMinutes(point || referenceOrigin, place.coordinates, mode),
    travelEstimateSource: value && !point ? 'default-origin' : hasReference ? 'reference' : 'coordinates',
  };
}
const allSeasons = Object.keys(seasonLabels);
const siteInterestsBySeason = allSeasons.map(season => [
  season, new Set(getSeasonActivities(season, 'mozhaysk').map(item => item.title)),
]);
const siteSeasons = title => siteInterestsBySeason.filter(([, titles]) => titles.has(title)).map(([season]) => season);
const outdoorConditions = 'Уточните у команды отеля доступность с учётом погоды и текущих условий.';
const equipmentConditions = 'Уточните наличие инвентаря и условия участия у команды отеля.';

export const onsiteInterests = [
  { id: 'beach', group: 'nature', title: 'Спокойный отдых у воды', detail: 'Тишина, книга и свободное время', seasons: allSeasons },
  { id: 'walk', group: 'nature', title: 'Пешие тропы', detail: 'Неспешный маршрут с остановками' },
  { id: 'fishing', group: 'nature', title: 'Рыбалка', detail: 'Рыбалка на водохранилище. Уточните место, условия и ограничения для выбранной даты.', duration: 90, page: 'spaces.html#fishing', confirmation: outdoorConditions },
  { id: 'sunbathing', group: 'nature', title: 'Места для загара', detail: 'Чтение и спокойный отдых на солнце у воды в подходящую погоду.', duration: 60, page: 'spaces.html#sunbathing' },
  { id: 'garden', group: 'nature', title: 'Садовые парники', detail: 'Прогулка к парникам и знакомство с растениями на территории отеля.', duration: 30, page: 'leisure-garden.html', confirmation: outdoorConditions },
  { id: 'bike', group: 'active', title: 'Велосипеды', detail: 'Взрослый и детский прокат, прогулка по велотропам' },
  { id: 'table-tennis', group: 'active', title: 'Настольный теннис', detail: 'Партия в настольный теннис с прокатным инвентарём.', duration: 45, page: 'spaces.html#rental', confirmation: equipmentConditions },
  { id: 'ball-games', group: 'active', title: 'Мячи', detail: 'Совместная игра с мячом на открытом воздухе.', duration: 45, page: 'spaces.html#rental', confirmation: equipmentConditions },
  { id: 'sport-rental', group: 'active', title: 'Спортивный инвентарь', detail: 'Выберите доступный инвентарь в прокате и оставьте время для игры.', duration: 45, page: 'spaces.html#rental', confirmation: equipmentConditions },
  { id: 'sup', group: 'active', title: 'SUP-прогулки', detail: 'Прогулка на доске вдоль берега при подходящих условиях на воде.', duration: 60, page: 'leisure-sup.html', confirmation: 'Уточните погоду, наличие досок и спасательных жилетов, допустимый возраст и условия выхода на воду.' },
  { id: 'buggy', group: 'active', title: 'Багги', detail: 'Выезд по маршруту с инструктором' },
  { id: 'skating', group: 'active', title: 'Каток', detail: 'Катание на коньках на открытом катке.', duration: 60, page: 'spaces.html#ice-rink', confirmation: 'Уточните состояние льда, доступность катка и условия проката.' },
  { id: 'snowmobile', group: 'active', title: 'Снегоходы', detail: 'Поездка по заснеженному маршруту в подходящих условиях.', duration: 90, page: 'spaces.html#snowmobiles', confirmation: 'Согласуйте условия выезда, экипировку и возрастные ограничения с командой отеля.' },
  { id: 'tubing', group: 'active', title: 'Ватрушки', detail: 'Катание на ватрушках на подходящей снежной горке.', duration: 60, page: 'spaces.html#tubing', confirmation: 'Уточните состояние горки, доступность проката и правила катания.' },
  { id: 'zoo', group: 'family', title: 'Контактный зоопарк', detail: 'Знакомство с животными вместе со взрослым. Следуйте правилам зоопарка.', duration: 45, page: 'leisure-children.html#zoo', confirmation: 'Уточните часы посещения и правила контакта с животными.' },
  { id: 'play-area', group: 'family', title: 'Детские игровые зоны', detail: 'Игры в детской зоне на территории с сопровождающим взрослым.', duration: 45, page: 'leisure-children.html#play-area', confirmation: outdoorConditions },
  { id: 'learning-games', group: 'family', title: 'Развивающие игры', detail: 'Игры на внимание, память и логику по возрасту ребёнка.', duration: 30, page: 'leisure-children.html#games' },
  { id: 'firepit', group: 'gatherings', title: 'Костровая зона', detail: 'Встреча с близкими и спокойный отдых у огня на берегу.', duration: 60, page: 'leisure-firepit.html', confirmation: 'Уточните доступность костровой зоны и правила разведения огня.' },
  { id: 'pavilion', group: 'gatherings', title: 'Павильоны для праздников', detail: 'Обсудите аренду павильона для семейного праздника или встречи.', duration: 30, page: 'pavilions.html', confirmation: 'Отдельно согласуйте аренду павильона, время и условия с командой отеля.' },
].map(item => ({ ...item, seasons: item.seasons ?? siteSeasons(item.title) }));

export const interests = [
  ...onsiteInterests,
  { id: 'sights', title: 'Достопримечательности', detail: 'Бородино, Можайск и окрестности' },
];
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
  { id: 'barbecue', title: 'Мангалы и беседки', detail: 'Два часа для неспешного пикника', duration: 120, preferred: '18:00', page: 'spaces.html#barbecue' },
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
