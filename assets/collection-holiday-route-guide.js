import { attractions, demoLocalRoute, demoOrigin, localRouteDescriptions, mapRoute, outingTransports } from './collection-holiday-data.js?v=20261108-route-pdf-1';
import { excursionSettings, includesSightseeing, isWarm } from './collection-holiday-engine.js?v=20261108-route-pdf-1';
import { referenceRoutes, reservoirRings } from './collection-holiday-map-data.js';
import { localReferenceRoutes } from './collection-holiday-local-routes.js';
import { holidayBasemaps } from './collection-holiday-basemaps.js';

const defaultPoint = demoOrigin.split(',').map(Number);
const ink = '#303442';
const blue = '#416d86';
const hotelMapLabel = 'A  A’MORE · примерное расположение';
const mapCredit = '© OpenStreetMap contributors · openstreetmap.org/copyright';
const radians = Math.PI / 180;
const mercatorY = lat => Math.log(Math.tan(Math.PI / 4 + lat * radians / 2)) / radians;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function coordinates(value) {
  if (!/^[-+]?\d+(?:\.\d+)?\s*,\s*[-+]?\d+(?:\.\d+)?$/.test(value)) return null;
  const [lat, lon] = value.split(',').map(Number);
  // Keep the overview focused on the reservoir and Mozhaysk.
  return Math.abs(lat - defaultPoint[0]) <= .25 && Math.abs(lon - defaultPoint[1]) <= .4 ? [lat, lon] : null;
}

function fitMap(box, points, horizontalPadding, verticalPadding, basemap) {
  const { x, y, width, height } = box;
  const xs = points.map(point => point[1]);
  const ys = points.map(point => mercatorY(point[0]));
  const left = Math.min(...xs), right = Math.max(...xs);
  const low = Math.min(...ys), high = Math.max(...ys);
  let scale = Math.min((width - 2 * horizontalPadding) / (right - left), (height - 2 * verticalPadding) / (high - low));
  let centerX = (left + right) / 2;
  let centerY = (low + high) / 2;
  if (basemap) {
    const [west, south, east, north] = basemap.bounds;
    const bottom = mercatorY(south), top = mercatorY(north);
    const imageScale = Math.max(width / (east - west), height / (top - bottom));
    const candidate = Math.max(imageScale, scale);
    const halfWidth = width / (2 * candidate), halfHeight = height / (2 * candidate);
    const cx = clamp(centerX, west + halfWidth, east - halfWidth);
    const cy = clamp(centerY, bottom + halfHeight, top - halfHeight);
    const markerInset = 12 / candidate;
    if (left >= cx - halfWidth + markerInset && right <= cx + halfWidth - markerInset
      && low >= cy - halfHeight + markerInset && high <= cy + halfHeight - markerInset) {
      scale = candidate;
      centerX = cx;
      centerY = cy;
    } else {
      basemap = null;
    }
  }
  const project = ([lat, lon]) => [
    x + width / 2 + (lon - centerX) * scale,
    y + height / 2 + (centerY - mercatorY(lat)) * scale,
  ];
  return { project, basemap, pointsPerMeter: scale / (111320 * Math.cos(defaultPoint[0] * radians)) };
}

function trace(ctx, project, points) {
  for (const [index, point] of points.entries()) {
    const [px, py] = project(point);
    if (index) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
}

function paintWater(ctx, box, project) {
  const { x, y, width, height } = box;
  ctx.fillStyle = '#f2eee5';
  ctx.fillRect(x, y, width, height);
  ctx.beginPath();
  for (const ring of reservoirRings) {
    trace(ctx, project, ring);
    ctx.closePath();
  }
  ctx.fillStyle = '#b8d6df';
  ctx.fill('evenodd');
  ctx.strokeStyle = '#84a9b9';
  ctx.lineWidth = .7;
  ctx.stroke();
}

function paintBasemap(ctx, box, { project, basemap }) {
  if (!basemap) {
    paintWater(ctx, box, project);
    return;
  }
  const [west, south, east, north] = basemap.bounds;
  const [left, top] = project([north, west]);
  const [right, bottom] = project([south, east]);
  ctx.save();
  ctx.filter = 'saturate(52%)';
  ctx.drawImage(basemap.image, left, top, right - left, bottom - top);
  ctx.restore();
}

function paintMapLabel(ctx, label, x, y) {
  ctx.fillStyle = '#fffffff2';
  ctx.fillRect(x - 4, y - 6, ctx.measureText(label).width + 8, 12);
  ctx.fillStyle = ink;
  ctx.fillText(label, x, y);
}

function drawLocalRoute(ctx, box, legs, color, basemap) {
  const { x, y, width, height } = box;
  const view = fitMap(box, legs.flat(), 34, 29, basemap);
  const { project, pointsPerMeter } = view;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  paintBasemap(ctx, box, view);

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const leg of legs) trace(ctx, project, leg);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 9px Arial, sans-serif';
  for (const [label, point] of [['A', defaultPoint], ['1', legs[1][0]]]) {
    const [px, py] = project(point);
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fillStyle = label === 'A' ? ink : color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, px, py + .5);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = ink;
  ctx.font = 'bold 8px Arial, sans-serif';
  paintMapLabel(ctx, `${hotelMapLabel} (старт и финиш)    1  Разворот`, x + 9, y + 11);
  ctx.font = '7.5px Arial, sans-serif';
  paintMapLabel(ctx, mapCredit, x + 9, y + height - 8);

  const scaleMeters = [500, 250, 100, 50].find(meters => pointsPerMeter * meters <= 85) || 25;
  const barWidth = pointsPerMeter * scaleMeters;
  const barEnd = x + width - 11;
  const barY = y + height - 8;
  ctx.fillStyle = '#fffffff2';
  ctx.fillRect(barEnd - barWidth - 8, barY - 14, barWidth + 16, 18);
  ctx.fillStyle = ink;
  ctx.fillRect(barEnd - barWidth, barY, barWidth, 1);
  ctx.fillRect(barEnd - barWidth, barY - 2, 1, 4);
  ctx.fillRect(barEnd - 1, barY - 2, 1, 4);
  ctx.textAlign = 'center';
  ctx.fillText(`${scaleMeters} м`, barEnd - barWidth / 2, barY - 7);
  ctx.restore();
}

function drawOverview(ctx, box, places, start, paths, basemap, defaultOrigin) {
  const { x, y, width, height } = box;
  const markers = places.map((place, index) => ({ point: place.coordinates, label: String(index + 1) }));
  if (start && !defaultOrigin) markers.unshift({ point: start, label: '0' });
  markers.unshift({ point: defaultPoint, label: 'A' });
  // Frame the roads and places along the reservoir. The printed image can crop its distant western end.
  const context = [[55.634, 35.603], [55.5, 36.025]];
  const points = context.concat(markers.map(marker => marker.point), ...paths.filter(Boolean));
  const view = fitMap(box, points, 36, 22, basemap);
  const { project } = view;

  ctx.save();
  paintBasemap(ctx, box, view);

  if (start) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const [index, place] of places.entries()) {
      ctx.setLineDash(paths[index] ? [] : [4, 4]);
      ctx.beginPath();
      trace(ctx, project, paths[index] || [start, place.coordinates]);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = blue;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  ctx.font = 'bold 9px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labels = [];
  for (const { point, label } of markers) {
    const [px, py] = project(point);
    const offsets = [[0, 0], [13, -13], [13, 13], [-13, -13], [-13, 13]];
    const offset = offsets.find(([dx, dy]) => labels.every(([lx, ly]) => Math.hypot(px + dx - lx, py + dy - ly) >= 17));
    const [dx, dy] = offset || [16, 0];
    const lx = px + dx, ly = py + dy;
    labels.push([lx, ly]);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(lx, ly);
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(lx, ly, 7, 0, Math.PI * 2);
    ctx.fillStyle = label === 'A' || label === '0' ? ink : blue;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, lx, ly + .5);
  }

  ctx.font = 'bold 9px Arial, sans-serif';
  ctx.fillStyle = ink;
  ctx.fillText('С', x + width - 18, y + 14);
  ctx.beginPath();
  ctx.moveTo(x + width - 18, y + 22);
  ctx.lineTo(x + width - 22, y + 32);
  ctx.lineTo(x + width - 14, y + 32);
  ctx.fill();
  ctx.textAlign = 'left';
  paintMapLabel(ctx, hotelMapLabel, x + 9, y + 14);
  ctx.font = '8px Arial, sans-serif';
  paintMapLabel(ctx, mapCredit, x + 9, y + height - 8);
  ctx.restore();
}

function localRoute(mode, title, linkLabel, color, basemap) {
  const { distanceKm, durationSeconds, legs } = localReferenceRoutes[mode];
  const distance = distanceKm < 1
    ? `${Math.round(distanceKm * 20) * 50} м`
    : `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(distanceKm)} км`;
  const minutes = Math.ceil(durationSeconds / 300) * 5;
  return {
    title,
    detail: localRouteDescriptions[mode],
    metrics: `Туда и обратно · около ${distance} · около ${minutes} мин без остановок`,
    href: demoLocalRoute(mode),
    linkLabel,
    drawMap: (ctx, box) => drawLocalRoute(ctx, box, legs, color, basemap),
  };
}

function guideSelection(plan) {
  const { interests = [], outingMode, places = [] } = plan.answers;
  const scheduledTrips = new Map();
  let walk = false;
  let bike = false;
  let seasonalWalk = false;
  let destinationIds = [];
  if (Array.isArray(plan.days)) {
    for (const day of plan.days) {
      for (const item of day.items ?? []) {
        if (item.kind === 'excursion' && item.placeId && !scheduledTrips.has(item.placeId)) {
          scheduledTrips.set(item.placeId, item);
        }
        if (item.kind !== 'activity') continue;
        if (item.interest === 'walk') walk = true;
        if (item.interest === 'bike') {
          // The page records the scheduled activity even if a guest moves it to another date.
          const cycling = item.page === 'leisure-active.html'
            || (item.page !== 'leisure-nature.html' && isWarm(day.date));
          bike ||= cycling;
          walk ||= !cycling;
          seasonalWalk ||= !cycling && !isWarm(day.date);
        }
      }
    }
    destinationIds = [...scheduledTrips.keys()];
  } else if (outingMode !== 'stay') {
    walk = interests.includes('walk');
    bike = interests.includes('bike');
    if (includesSightseeing(plan.answers)) destinationIds = places;
  }
  const destinations = attractions.filter(place => destinationIds.includes(place.id));
  return walk || bike || destinations.length ? { walk, bike, seasonalWalk, destinations, scheduledTrips } : null;
}

export function buildHolidayRouteGuide(plan, { local, overview } = {}, selection = guideSelection(plan)) {
  if (!selection) return null;
  const { walk, bike, seasonalWalk, destinations, scheduledTrips } = selection;
  const { origin } = plan.answers;
  const routeOrigin = origin?.trim() || demoOrigin;
  const defaultOrigin = routeOrigin === demoOrigin;
  const start = coordinates(routeOrigin);
  const trips = destinations.map(place => {
    const scheduled = scheduledTrips.get(place.id);
    const transport = scheduled?.transport ?? excursionSettings(plan.answers, place.id).transport;
    const mode = transport === 'walk' ? 'walk' : 'auto';
    const { title, detail } = outingTransports[transport] || outingTransports.auto;
    return { place, mode, detail: `${title}. ${scheduled?.confirmation || detail}` };
  });
  const paths = trips.map(({ place, mode }) => defaultOrigin ? referenceRoutes[mode][place.id] : null);
  const hasRoadRoutes = paths.some(Boolean);
  const hasDirectionLines = start && paths.some(path => !path);

  return {
    routeTitle: walk && bike ? 'ПЕШКОМ И НА ВЕЛОСИПЕДЕ' : walk ? 'ПЕШИЙ МАРШРУТ' : 'ВЕЛОСИПЕДНЫЙ МАРШРУТ',
    intro: [
      'Старт и финиш — примерная точка A’MORE на перекрёстке Лесной и Прибрежной улиц в Горетове. Расстояние и время в движении приблизительные, по данным Valhalla / FOSSGIS. Перед выходом проверьте состояние дорог и погоду.',
      seasonalWalk ? 'В холодные дни вместо велосипеда предложен пеший маршрут.' : '',
    ].filter(Boolean).join(' '),
    routes: [
      walk && localRoute('walk', 'Пешком · по Прибрежной улице', 'Открыть пеший маршрут в Яндекс Картах', '#416d59', local),
      bike && localRoute('bike', 'На велосипеде · до центра Горетова', 'Открыть веломаршрут в Яндекс Картах', blue, local),
    ].filter(Boolean),
    attractions: trips.map(({ place, mode, detail }, index) => ({
      title: `${index + 1}. ${place.title}`,
      href: mapRoute(place, mode, routeOrigin),
      detail,
    })),
    drawMap: destinations.length
      ? (ctx, box) => drawOverview(ctx, box, destinations, start, paths, overview, defaultOrigin)
      : null,
    mapCaption: [
      'Отмечены места из программы.',
      defaultOrigin ? 'Маршруты начинаются от примерной точки A’MORE на перекрёстке Лесной и Прибрежной улиц в Горетове.'
        : start ? '0 — указанная точка старта.' : 'Ваш старт учитывается в ссылках на Яндекс Карты.',
      hasRoadRoutes ? 'Сплошные линии показывают примеры маршрутов по данным Valhalla / FOSSGIS.' : '',
      hasDirectionLines ? 'Пунктир показывает направление по прямой.' : '',
      'Актуальный путь проверьте по ссылкам.',
    ].filter(Boolean).join(' '),
  };
}

async function loadBasemap(source) {
  const image = new Image();
  image.src = new URL(source.file, import.meta.url).href;
  try {
    await image.decode();
    return { ...source, image };
  } catch {
    return null;
  }
}

export async function prepareHolidayRouteGuide(plan) {
  const selection = guideSelection(plan);
  if (!selection) return null;
  const [local, overview] = await Promise.all([
    selection.walk || selection.bike ? loadBasemap(holidayBasemaps.local) : null,
    selection.destinations.length ? loadBasemap(holidayBasemaps.overview) : null,
  ]);
  return buildHolidayRouteGuide(plan, { local, overview }, selection);
}
