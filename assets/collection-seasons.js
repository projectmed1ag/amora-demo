import { leisureGroups } from './mozhaysk-leisure-data.js?v=20261023-leisure-catalog-1';
import { currentDestinationCity, destinationURL, getDestination } from './collection-destinations.js?v=20261024-all-hotels-1';

// Shared by the leisure page and date-based booking suggestions. These helpers
// never read browser state, change source data or imply real-time availability.
export const seasonLabels = Object.freeze({
  winter: 'Зима',
  spring: 'Весна',
  summer: 'Лето',
  autumn: 'Осень',
});

export function getSeasonForDate(value) {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;

  const month = date.getUTCMonth() + 1;
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'autumn';
}

function sourceActivity(groupId, title, page, anchor, audience, seasons) {
  const item = leisureGroups.find(group => group.id === groupId)?.items?.find(activity => activity.title === title);
  if (!item) return null;
  return Object.freeze({
    title: item.title,
    description: item.description,
    page,
    anchor,
    audience,
    seasons: Object.freeze(seasons),
  });
}

const warmSeasons = ['spring', 'summer', 'autumn'];
const allSeasons = ['winter', ...warmSeasons];
const activities = Object.freeze([
  sourceActivity('rental', 'Велосипеды', 'spaces.html', 'rental', 'movement', warmSeasons),
  sourceActivity('rental', 'Настольный теннис', 'spaces.html', 'rental', 'movement', warmSeasons),
  sourceActivity('rental', 'Мячи', 'spaces.html', 'rental', 'movement', warmSeasons),
  sourceActivity('rental', 'Спортивный инвентарь', 'spaces.html', 'rental', 'movement', warmSeasons),
  sourceActivity('winter', 'Каток', 'spaces.html', 'ice-rink', 'movement', ['winter']),
  sourceActivity('motor', 'Снегоходы', 'spaces.html', 'snowmobiles', 'movement', ['winter']),
  sourceActivity('motor', 'Багги', 'spaces.html', 'buggy', 'movement', allSeasons),
  sourceActivity('winter', 'Ватрушки', 'spaces.html', 'tubing', 'movement', ['winter']),
  Object.freeze({
    title: 'SUP-прогулки',
    description: 'Летние прогулки на SUP.',
    page: 'leisure-sup.html',
    anchor: 'sup',
    audience: 'movement',
    seasons: Object.freeze(['summer']),
  }),
  Object.freeze({
    title: 'Костровая зона',
    description: 'Костровая зона на берегу.',
    page: 'leisure-firepit.html',
    anchor: 'firepit',
    audience: 'relaxation',
    seasons: Object.freeze(allSeasons),
  }),
  sourceActivity('routes', 'Пешие тропы', 'spaces.html', 'routes', 'movement', allSeasons),
  sourceActivity('routes', 'Велотропы', 'spaces.html', 'routes', 'movement', warmSeasons),
  sourceActivity('fishing', 'Рыбалка', 'spaces.html', 'fishing', 'movement', allSeasons),
  sourceActivity('children', 'Контактный зоопарк', 'spaces.html', 'children', 'children', warmSeasons),
  sourceActivity('children', 'Детские игровые зоны', 'spaces.html', 'children', 'children', warmSeasons),
  sourceActivity('children', 'Развивающие игры', 'spaces.html', 'children', 'children', allSeasons),
  sourceActivity('picnic', 'Мангалы', 'spaces.html', 'barbecue', 'relaxation', allSeasons),
  sourceActivity('picnic', 'Беседки', 'spaces.html', 'barbecue', 'relaxation', allSeasons),
  sourceActivity('sunbathing', 'Места для загара', 'spaces.html', 'sunbathing', 'relaxation', ['summer']),
  sourceActivity('events', 'Павильоны для праздников', 'spaces.html', 'events', 'relaxation', allSeasons),
  sourceActivity('garden', 'Садовые парники', 'spaces.html', 'garden', 'relaxation', warmSeasons),
].filter(Boolean));

export function getSeasonActivities(season, city = currentDestinationCity()) {
  if (!Object.prototype.hasOwnProperty.call(seasonLabels, season)) return [];
  const destination = getDestination(city);
  return activities
    .filter(activity => activity.seasons.includes(season))
    .map(({ title, description, page, anchor, audience }) => {
      const url = destinationURL(destination.id === 'mozhaysk' ? page : 'spaces.html', destination.id, { season });
      url.hash = anchor;
      return { title, description, href: url.href, audience };
    });
}
