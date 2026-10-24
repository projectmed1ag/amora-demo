// The current destination owns its rooms, local clock and document paths.
// Resolve assets from this module so nested city pages also work on GitHub Pages.
const collectionRoot = new URL('../', import.meta.url);
const categories = ['standard', 'comfort', 'junior-suite', 'suite'];
const categoryNames = ['Стандарт', 'Комфорт', 'Полулюкс', 'Люкс'];

function roomCategories(city, guests, areas, alts, concept = false) {
  return Object.freeze(categories.map((id, index) => Object.freeze({
    id,
    name: categoryNames[index],
    guests: guests[index],
    area: areas[index],
    image: concept ? `concept-covers/${id}-v1` : id,
    imageWidth: concept ? 1086 : 1536,
    imageHeight: concept ? 1448 : 1024,
    alt: alts[index],
    src: `images/rooms/${city}/${concept ? `concept-covers/${id}-v1` : id}.jpg`,
    mobileSrc: `images/mobile/rooms/${city}/${concept ? `concept-covers/${id}-v1` : id}.jpg`,
  })));
}

export const collectionDestinations = Object.freeze({
  mozhaysk: Object.freeze({
    id: 'mozhaysk',
    name: 'Можайское водохранилище',
    folder: '',
    stayLabel: 'Хаусбот',
    stayPlural: 'Хаусботы',
    timeZone: 'Europe/Moscow',
    timeLabel: 'по Москве',
    timeHelp: 'По московскому времени',
    rooms: roomCategories('mozhaysk', [2, 4, 4, 6], [24, 34, 46, 64], [
      'Хаусбот Стандарт', 'Хаусбот Комфорт', 'Хаусбот Полулюкс', 'Хаусбот Люкс',
    ], true),
  }),
  ruza: Object.freeze({
    id: 'ruza',
    name: 'Руза',
    folder: 'ruza/',
    stayLabel: 'Номер',
    stayPlural: 'Номера',
    timeZone: 'Europe/Moscow',
    timeLabel: 'по Москве',
    timeHelp: 'По московскому времени',
    rooms: roomCategories('ruza', [2, 4, 4, 6], [26, 36, 48, 68], [
      'Уютная спальня с тёплым деревом и берёзами за окном',
      'Лесной номер Комфорт с креслом и большим угловым окном',
      'Полулюкс в Рузе со спальной зоной и гостиной среди леса',
      'Тёплая гостиная лесного люкса с отдельной спальней и террасой',
    ]),
  }),
  krasnoyarsk: Object.freeze({
    id: 'krasnoyarsk',
    name: 'Красноярский край',
    folder: 'krasnoyarsk/',
    stayLabel: 'Номер',
    stayPlural: 'Номера',
    timeZone: 'Asia/Krasnoyarsk',
    timeLabel: 'по Красноярску',
    timeHelp: 'По красноярскому времени',
    rooms: roomCategories('krasnoyarsk', [2, 4, 4, 6], [28, 38, 52, 76], [
      'Спальня с тёмным деревом и видом на сибирские холмы',
      'Номер Комфорт с тёмным деревом, креслом и видом на речную долину',
      'Сибирский полулюкс с диваном, спальней и панорамным видом',
      'Гостиная сибирского люкса с отдельной спальней и панорамой холмов',
    ]),
  }),
});

export function normalizeDestination(city) {
  return Object.hasOwn(collectionDestinations, city || '') ? city : null;
}

export function currentDestinationCity() {
  const declared = normalizeDestination(globalThis.document?.documentElement.dataset.city);
  if (declared) return declared;
  if (globalThis.location) {
    const url = new URL(location.href);
    const path = url.pathname.startsWith(collectionRoot.pathname)
      ? url.pathname.slice(collectionRoot.pathname.length) : url.pathname;
    const folder = normalizeDestination(path.split('/').filter(Boolean)[0]);
    return folder || normalizeDestination(url.searchParams.get('city')) || 'mozhaysk';
  }
  return 'mozhaysk';
}

export function getDestination(city = currentDestinationCity()) {
  return collectionDestinations[normalizeDestination(city) || 'mozhaysk'];
}

export function destinationURL(page, city = currentDestinationCity(), query = {}) {
  const destination = getDestination(city);
  const url = new URL(`${destination.folder}${page.replace(/^\.\//, '')}`, collectionRoot);
  url.searchParams.set('city', destination.id);
  Object.entries(query).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, value);
  });
  return url;
}

export function destinationAsset(path) {
  return new URL(path.replace(/^\.\//, ''), collectionRoot).href;
}

export function destinationDateParts(now = new Date(), city = currentDestinationCity()) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: getDestination(city).timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
}

export function destinationLocalDate(now = new Date(), city = currentDestinationCity()) {
  const { year, month, day } = destinationDateParts(now, city);
  return `${year}-${month}-${day}`;
}
