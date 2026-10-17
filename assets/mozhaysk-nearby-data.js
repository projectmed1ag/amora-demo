// Curated on 2026-10-17. WGS84 coordinates, [latitude, longitude].
// These are off-site attractions, not hotel facilities. No hotel location or
// journey times are inferred. Coordinate provenance is retained per place.
export const nearbyPlaces = [
  {
    id: 'borodino',
    title: 'Музей Бородино',
    category: 'История · Бородинское поле',
    description: 'Познакомьтесь с историей Бородинского сражения в главной экспозиции музея-заповедника, а затем прогуляйтесь по мемориальному полю. Отметка на карте — главное здание музея у батареи Раевского.',
    coordinates: [55.5179006, 35.8226631],
    source: 'https://www.borodino.ru/',
    coordinateSource: 'https://www.openstreetmap.org/node/5593692924',
    photo: {
      src: './images/mozhaysk/nearby/borodino.jpg',
      width: 960, height: 720,
      alt: 'Главное здание Бородинского музея-заповедника с вывеской над входом',
      author: 'Дубопробка', year: '2010',
      source: 'https://commons.wikimedia.org/wiki/File:Borodino%27s_museum_principal.jpg',
      license: 'Общественное достояние',
      licenseURL: 'https://commons.wikimedia.org/wiki/File:Borodino%27s_museum_principal.jpg',
    },
  },
  {
    id: 'nikolsky',
    title: 'Ново-Никольский собор',
    category: 'Архитектура · Можайск',
    description: 'Необычная неоготическая архитектура на высоком холме исторического Можайского кремля. Рассмотрите детали собора и продолжите знакомство со старым городом.',
    coordinates: [55.509163, 36.010438],
    source: 'https://welcome.mosreg.ru/ideas/hram-so-skul-pturoj-nikoly-mozajskogo',
    coordinateSource: 'https://www.openstreetmap.org/way/334359779',
    photo: {
      src: './images/mozhaysk/nearby/nikolsky.jpg',
      width: 960, height: 640,
      alt: 'Ново-Никольский собор на кремлёвском холме Можайска, вид с воздуха',
      author: 'Ludvig14', year: '2020',
      source: 'https://commons.wikimedia.org/wiki/File:MozhayskKremlin_0934.jpg',
      license: 'CC BY-SA 4.0',
      licenseURL: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
  },
  {
    id: 'luzhetsky',
    title: 'Лужецкий монастырь',
    category: 'Наследие · Можайск',
    description: 'Монастырский ансамбль на берегу Москвы-реки, основанный преподобным Ферапонтом в 1408 году. Поездка для тех, кому интересны история, старинная архитектура и спокойный ритм окрестностей.',
    coordinates: [55.521377, 36.008045],
    source: 'https://luzh-mon.ru/',
    coordinateSource: 'https://www.openstreetmap.org/relation/8387653',
    photo: {
      src: './images/mozhaysk/nearby/luzhetsky.jpg',
      width: 960, height: 656,
      alt: 'Лужецкий монастырь с собором и колокольней у Москвы-реки, вид с воздуха',
      author: 'Ludvig14', year: '2020',
      source: 'https://commons.wikimedia.org/wiki/File:Luzhetsky_Monastery_101_0041.jpg',
      license: 'CC BY-SA 4.0',
      licenseURL: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
  },
  {
    id: 'goretovo',
    title: 'Усадьба Горетово',
    category: 'Прогулка · Горетово',
    description: 'Историческое село у Можайского водохранилища: сохранившийся флигель усадьбы, старый парк и Троицкая церковь. Идея для неспешного знакомства с окрестностями; отметка указывает на флигель.',
    coordinates: [55.6150163, 35.795558],
    source: 'https://mosculture.ru/object_mo/usadba-goretovo-1-glavnyj-dom-vt-tret-xix-v-2-tserkov-svyatoj-troitsy-1737-1773-gg-3-park-vt-pol-xviii-xix-vv/',
    coordinateSource: 'https://www.openstreetmap.org/node/3946301213',
    photo: {
      src: './images/mozhaysk/nearby/goretovo.jpg',
      width: 960, height: 540,
      alt: 'Сохранившийся флигель усадьбы Горетово с белыми колоннами среди деревьев',
      author: 'Vikont5782', year: '2018',
      source: 'https://commons.wikimedia.org/wiki/File:Единственный_уцелевший_от_усадьбы_01.jpg',
      license: 'CC BY-SA 4.0',
      licenseURL: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
  },
];

// No API key, tile proxy, prefetch or offline tile download. Browser caching
// and Referer are left intact; change the provider here if hosting changes.
export const nearbyBasemap = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  maxZoom: 18,
};
