import { breakfastNotice, clock, dateLabel, excursionSettings } from './collection-holiday-engine.js?v=20261108-route-pdf-1';
import { childActivityOptions, outingTransports } from './collection-holiday-data.js?v=20261108-route-pdf-1';
import { prepareHolidayRouteGuide } from './collection-holiday-route-guide.js?v=20261108-map-labels-1';
import { getSeasonForDate } from './collection-seasons.js';

const width = 960;
const height = 540;
const margin = 38;
const bottom = 492;
const contentWidth = width - margin * 2;
const timeColumn = 103;
const ink = '#303442';
const muted = '#535a66';
const accent = '#796341';
const gold = '#a89268';
const paper = '#f8f6f0';
const rule = '#ded8cc';
const notice = 'Предложенное расписание. Размещение, услуги, трансфер и сопровождение детей подтверждаются отдельно.';

const bodyStyle = { font: '12.5px Arial, sans-serif', lineHeight: 16, color: muted };
const titleStyle = { font: 'bold 14px Arial, sans-serif', lineHeight: 18, color: ink };
const emphasisStyle = { ...bodyStyle, color: accent };
const linkStyle = { ...bodyStyle, color: '#355a7a' };
const smallStyle = { font: 'bold 11px Arial, sans-serif', lineHeight: 15, color: accent };
const trackStyle = { font: 'bold 12px Arial, sans-serif', lineHeight: 16, color: ink };
const display = size => `600 ${size}px "AMore Condensed", "Arial Narrow", Arial, sans-serif`;
const headingStyle = { font: display(38), lineHeight: 45, color: ink };
const galleryPhoto = name => `../images/mobile/mozhaysk/entertainment-gallery-v1/${name}.webp`;
const seasonalPhoto = (season, name) => `../images/mobile/mozhaysk/entertainment-seasons-v1/${season}-${name}.webp`;
const tripPhotos = {
  cover: '../images/mobile/rooms/mozhaysk/standard-houseboat/exterior-day.jpg',
  overview: '../images/mozhaysk-render-photos-20261106/panorama/exterior.jpg',
  quiet: [
    '../images/mozhaysk-render-photos-20261106/residence/exterior.jpg',
    '../images/mobile/rooms/mozhaysk/standard-houseboat/exterior-evening.jpg',
    '../images/mozhaysk-render-photos-20261106/panorama/exterior-angle-2.jpg',
  ],
};
const activityPhotos = {
  zoo: ['children-03'],
  garden: ['garden-01', 'garden-02', 'garden-03'],
  'play-area': ['children-02'],
  'learning-games': ['children-01'],
  family: ['children-01', 'children-02'],
  walk: ['routes-01', 'routes-03'],
  bike: ['routes-02', 'rental-01'],
  beach: ['routes-03'],
  sunbathing: ['sunbathing-01', 'sunbathing-02'],
  fishing: ['fishing-01'],
  sup: ['sup-01', 'sup-02'],
  buggy: ['buggy-01', 'buggy-02'],
  'table-tennis': ['rental-02'],
  'ball-games': ['rental-03'],
  'sport-rental': ['rental-03'],
  firepit: ['firepit-01', 'firepit-02'],
  barbecue: ['barbecue-01', 'barbecue-02', 'barbecue-03'],
  pavilion: ['events-01', 'events-02'],
};
const winterPhotos = {
  skating: ['ice-rink-02', 'ice-rink-03'],
  snowmobile: ['snowmobiles-02', 'snowmobiles-03'],
  tubing: ['tubing-02', 'tubing-03'],
  family: ['children-01'],
  walk: ['routes-01'],
  beach: ['routes-01'],
  buggy: ['buggy-01'],
  firepit: ['firepit-01'],
  barbecue: ['barbecue-01'],
  pavilion: ['events-01'],
};
const primaryKinds = new Set(['activity', 'excursion', 'parallel', 'family', 'service', 'custom']);
const dayNumber = index => String(index + 1).padStart(2, '0');
const longDate = iso => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
const shortLabel = iso => dateLabel(iso).replace(/^(.)/u, character => character.toLocaleUpperCase('ru'));

function wrap(ctx, text, maxWidth, style) {
  ctx.font = style.font;
  const lines = [];
  let line = '';
  for (const word of String(text).trim().split(/\s+/u)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
      continue;
    }
    line = '';
    for (const character of word) {
      if (line && ctx.measureText(line + character).width > maxWidth) {
        lines.push(line);
        line = '';
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return { ...style, lines, height: lines.length * style.lineHeight };
}

function paint(ctx, block, x, y) {
  ctx.font = block.font;
  ctx.fillStyle = block.color;
  for (const [index, line] of block.lines.entries()) {
    ctx.fillText(line, x, y + index * block.lineHeight);
  }
  return y + block.height;
}

function childHighlights(answers) {
  const options = childActivityOptions.filter(option => answers.childActivities?.includes(option.id));
  if (!options.length) return '';
  const youngest = Math.min(...answers.ages);
  return options.map(option => `${option.id === 'walk' ? 'Прогулка' : option.title}${youngest < option.minAge ? ` (от ${option.minAge} лет)` : ''}`).join(' или ');
}

function scheduleRow(ctx, item, availableWidth, answers, hasLocalMaps) {
  const childIdeas = childHighlights(answers);
  let detail = '';
  if (item.kind === 'excursion') {
    const settings = excursionSettings(answers, item.placeId);
    const transport = item.transport ?? settings.transport;
    const travelMinutes = item.travelMinutes ?? settings.travelMinutes;
    const travelEstimateSource = item.travelEstimateSource ?? settings.travelEstimateSource;
    const visitMinutes = item.visitMinutes ?? settings.visitMinutes;
    const tripFacts = [
      outingTransports[transport]?.title,
      Number.isFinite(travelMinutes) ? `дорога примерно по ${travelMinutes} мин в каждую сторону` : '',
      Number.isFinite(travelMinutes) && travelEstimateSource === 'default-origin' ? 'оценка от Горетова' : '',
      Number.isFinite(visitMinutes) ? `на посещение заложено ${visitMinutes} мин` : '',
    ];
    if (!item.edited && settings.excursionTime && settings.excursionTime !== clock(item.start)) {
      tripFacts.push(`желаемый выезд ${settings.excursionTime}`);
    }
    detail = tripFacts.filter(Boolean).join(' · ') || item.detail;
  } else if (item.kind === 'family') {
    if (item.edited) {
      detail = item.detail;
    } else if (answers.familyMode === 'separate' && (answers.adults >= 2 || answers.ages.every(age => age >= 3))) {
      detail = 'Семейная прогулка или игра на территории';
    } else {
      detail = childIdeas ? `Вместе с детьми: ${childIdeas}` : item.detail;
    }
  } else if (item.kind === 'activity') {
    detail = hasLocalMaps && ['walk', 'bike'].includes(item.interest) ? 'Карта, расстояние и время — в разделе маршрутов.' : item.detail;
  } else if (item.kind === 'hotel-event') {
    detail = ['Мероприятие отеля', item.location, item.detail].filter(Boolean).join(' · ');
  } else if (item.kind === 'custom') {
    detail = item.detail;
  }
  const blocks = [
    wrap(ctx, item.kind === 'free' && !item.edited ? 'Свободное время' : item.title, availableWidth, item.kind === 'free' ? bodyStyle : titleStyle),
    ...(detail ? [wrap(ctx, detail, availableWidth, bodyStyle)] : []),
  ];
  for (const track of item.tracks || []) {
    const kids = track.audience.startsWith('Дети');
    const custom = kids && childIdeas;
    blocks.push(
      wrap(ctx, `${track.audience}: ${custom || track.title}`, availableWidth, trackStyle),
    );
    if (kids && !custom) blocks.push(wrap(ctx, track.detail, availableWidth, bodyStyle));
  }
  return { time: timeRange(item.start, item.end), blocks, height: 6 + blocks.reduce((sum, block) => sum + block.height, 0) };
}

function timeRange(start, end) {
  return end > start ? `${clock(start)} - ${clock(end)}` : clock(start);
}

function jpeg(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Не удалось подготовить страницу PDF.'));
    }, 'image/jpeg', 0.9);
  });
}

function makePdf(pages, pixelWidth, pixelHeight) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [0];
  let length = 0;
  function write(part) {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes instanceof Blob ? bytes.size : bytes.byteLength;
  }
  function object(...parts) {
    // Cross-reference entries point to byte offsets, including the JPEG streams.
    offsets.push(length);
    write(`${offsets.length - 1} 0 obj\n`);
    parts.forEach(write);
    write('\nendobj\n');
  }

  write('%PDF-1.4\n%âãÏÓ\n');
  object('<< /Type /Catalog /Pages 2 0 R >>');
  const pageRefs = pages.map((_, index) => `${3 + index * 3} 0 R`).join(' ');
  object(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`);
  const annotations = [];
  const firstAnnotationId = 3 + pages.length * 3;
  for (const [index, page] of pages.entries()) {
    const pageId = 3 + index * 3;
    const linkRefs = page.links.map(link => {
      const id = firstAnnotationId + annotations.length;
      annotations.push(link);
      return `${id} 0 R`;
    });
    const annotationEntry = linkRefs.length ? ` /Annots [${linkRefs.join(' ')}]` : '';
    const drawing = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
    object(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 ${pageId + 2} 0 R >> >> /Contents ${pageId + 1} 0 R${annotationEntry} >>`);
    object(`<< /Length ${drawing.length} >>\nstream\n${drawing}endstream`);
    object(
      `<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.image.size} >>\nstream\n`,
      page.image, '\nendstream',
    );
  }
  for (const { x, y, width: linkWidth, height: linkHeight, href } of annotations) {
    // PDF coordinates start at the lower-left corner, unlike Canvas coordinates.
    const rect = [x, height - y - linkHeight, x + linkWidth, height - y]
      .map(value => value.toFixed(2)).join(' ');
    const uri = href.replace(/[\\()]/g, '\\$&');
    object(`<< /Type /Annot /Subtype /Link /Rect [${rect}] /Border [0 0 0] /A << /S /URI /URI (${uri}) >> >>`);
  }
  const start = length;
  const entries = offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  write(`xref\n0 ${offsets.length}\n0000000000 65535 f \n${entries}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}

function coverImage(ctx, image, x, y, w, h) {
  ctx.fillStyle = ink;
  ctx.fillRect(x, y, w, h);
  if (!image) return;
  const ratio = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / ratio, sh = h / ratio;
  ctx.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function photosForActivity(activity, season) {
  if (activity === 'restaurant') return ['../images/responsive/home/mozhaysk/restaurant-768.webp'];
  if (activity === 'banya') return ['../images/mobile/home/mozhaysk/banya-interior.jpg'];
  if (season === 'winter' && winterPhotos[activity]) {
    return winterPhotos[activity].map(name => seasonalPhoto(season, name));
  }
  if (activity === 'fishing' && season === 'winter') return [galleryPhoto('fishing-03')];
  if (activity === 'fishing' && season === 'autumn') return [galleryPhoto('fishing-02')];
  if ((season === 'spring' || season === 'autumn') && (activity === 'garden' || activity === 'walk')) {
    const name = activity === 'garden' ? 'garden-01' : 'routes-01';
    return [seasonalPhoto(season, name), ...(activityPhotos[activity] || []).map(galleryPhoto)];
  }
  return (activityPhotos[activity] || []).map(galleryPhoto);
}

function selectDayPhotos(days) {
  const uses = new Map([[tripPhotos.cover, 1], [tripPhotos.overview, 1]]);
  let previous = tripPhotos.overview;
  return days.map(day => {
    const season = getSeasonForDate(day.date);
    const themes = day.items.flatMap(item => photosForActivity(
      item.kind === 'activity' ? item.interest : item.service, season,
    ));
    const context = [
      ...(day.items.some(item => item.kind === 'excursion') ? photosForActivity('walk', season) : []),
      ...(day.items.some(item => item.kind === 'family' || item.tracks?.length) ? photosForActivity('family', season) : []),
    ];
    const candidates = [...new Set([...themes, ...context, ...tripPhotos.quiet])].filter(path => path !== previous);
    const choice = candidates.reduce((best, path) => (uses.get(path) || 0) < (uses.get(best) || 0) ? path : best);
    uses.set(choice, (uses.get(choice) || 0) + 1);
    previous = choice;
    return choice;
  });
}

function dayHighlights(day) {
  const events = day.items.filter(item => item.kind === 'hotel-event');
  const activities = day.items.filter(item => primaryKinds.has(item.kind));
  return [...events, ...activities].slice(0, 3).sort((first, second) => first.start - second.start)
    .map(item => item.title).join(' · ') || 'Отдых в своём ритме';
}

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Не удалось загрузить изображение для PDF: ${path}`));
    image.src = new URL(path, import.meta.url).href;
  });
}

export async function buildHolidayPdf(plan, { lodging = '' } = {}) {
  if (!plan.days.length) throw new Error('Сначала составьте программу отдыха.');
  const dayPhotos = selectDayPhotos(plan.days);
  const photoPaths = [...new Set([tripPhotos.cover, tripPhotos.overview, ...dayPhotos])];
  const [wordmark, routeGuide, images] = await Promise.all([
    loadImage('./collection-pdf-wordmark.png'),
    prepareHolidayRouteGuide(plan),
    Promise.all(photoPaths.map(async path => [path, await loadImage(path).catch(() => null)])),
    // The canvas font already includes Cyrillic-capable system fallbacks.
    document.fonts?.load(display(52), 'ПРОГРАММА ОТДЫХА').catch(() => {}),
  ]);
  const photos = Object.fromEntries(images);
  const pages = [];
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.scale(scale, scale);
  ctx.textBaseline = 'top';
  let pageLinks = [];

  const at = (text, x, y, w = contentWidth, style = bodyStyle) => paint(ctx, wrap(ctx, text, w, style), x, y);
  const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const line = (x, y, w, color = rule) => rect(x, y, w, 0.65, color);
  function openPage(section) {
    pageLinks = [];
    rect(0, 0, width, height, paper);
    rect(0, 0, width, 78, ink);
    const logoHeight = 46;
    ctx.drawImage(wordmark, margin, (78 - logoHeight) / 2, wordmark.naturalWidth * logoHeight / wordmark.naturalHeight, logoHeight);
    ctx.save();
    ctx.fillStyle = '#f7f2e7';
    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('МОЖАЙСКОЕ ВОДОХРАНИЛИЩЕ', width - margin, 25);
    ctx.fillStyle = '#d7c6a6';
    ctx.fillText(section, width - margin, 45);
    ctx.restore();
    line(0, 77, width, gold);
  }
  async function savePage(cover = false) {
    if (!cover) {
      line(margin, 506, contentWidth, gold);
      at('A’MORE COLLECTION   /   ПРОГРАММА ОТДЫХА', margin, 515, contentWidth, smallStyle);
    }
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = smallStyle.font;
    ctx.fillStyle = cover ? '#fff' : accent;
    ctx.fillText(String(pages.length + 1).padStart(2, '0'), width - margin, 515);
    ctx.restore();
    pages.push({ image: await jpeg(canvas), links: pageLinks });
  }
  function link(label, value, x, y, w) {
    let url;
    try { url = new URL(value, location.href); } catch { return y; }
    if (!['https:', 'http:'].includes(url.protocol)) return y;
    const block = wrap(ctx, label, w, linkStyle);
    ctx.font = block.font;
    block.lines.forEach((text, i) => {
      const top = y + i * block.lineHeight;
      const span = ctx.measureText(text).width;
      ctx.fillStyle = block.color;
      ctx.fillText(text, x, top);
      ctx.fillRect(x, top + 13, span, 0.6);
      pageLinks.push({ x: x - 1, y: top - 1, width: span + 2, height: block.lineHeight + 1, href: url.href });
    });
    return y + block.height;
  }
  function map(draw, x, y, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    draw(ctx, { x, y, width: w, height: h });
    ctx.restore();
  }
  function photoPanel(path, x, y, w, h, number) {
    coverImage(ctx, photos[path] || photos[tripPhotos.cover], x, y, w, h);
    const gradient = ctx.createLinearGradient(0, y + h * .50, 0, y + h);
    gradient.addColorStop(0, '#22263100');
    gradient.addColorStop(1, '#222631ed');
    rect(x, y, w, h, gradient);
    if (number) {
      ctx.save();
      ctx.textAlign = 'right';
      ctx.font = display(95);
      ctx.fillStyle = '#fff';
      ctx.fillText(number, x + w - 16, y + h - 112);
      ctx.restore();
    }
  }
  function sectionHeading(title, kicker) {
    at(kicker, margin, 101, contentWidth, smallStyle);
    return at(title, margin, 122, contentWidth, headingStyle) + 10;
  }

  const { startDate, endDate, adults, children, ages } = plan.answers;
  const dateRange = startDate === endDate ? longDate(startDate) : `${longDate(startDate).replace(/ \d{4} г\.$/u, '')} — ${longDate(endDate)}`;
  const guestLine = `Взрослых: ${adults}   ·   Детей: ${children}${children ? ` (возраст: ${ages.join(', ')})` : ''}`;

  openPage('ЛИЧНЫЙ МАРШРУТ');
  coverImage(ctx, photos[tripPhotos.cover], 0, 78, width, height - 78);
  const wash = ctx.createLinearGradient(0, 0, width, 0);
  wash.addColorStop(0, '#181e2cef');
  wash.addColorStop(.52, '#181e2cbd');
  wash.addColorStop(1, '#181e2c22');
  rect(0, 78, width, height - 78, wash);
  const bottomWash = ctx.createLinearGradient(0, 418, 0, height);
  bottomWash.addColorStop(0, '#181e2c00');
  bottomWash.addColorStop(1, '#181e2ccc');
  rect(0, 418, width, height - 418, bottomWash);
  line(0, 77, width, gold);
  const white = { ...bodyStyle, color: '#fff' };
  const coverTitle = { font: display(78), lineHeight: 75, color: '#fff' };
  at('МОЖАЙСКОЕ ВОДОХРАНИЛИЩЕ', margin, 134, 550, { ...smallStyle, color: '#e8d8b9' });
  at('ПРОГРАММА', margin - 2, 154, 570, coverTitle);
  at('ОТДЫХА', margin - 2, 226, 570, coverTitle);
  line(margin, 319, 70, gold);
  at(dateRange, margin, 335, 530, { ...titleStyle, color: '#fff' });
  at(guestLine, margin, 360, 520, white);
  if (lodging) at(`Размещение: ${lodging}`, margin, 381, 520, white);
  at(plan.timeZone, margin, 401, 520, white);
  at(breakfastNotice, margin, 431, 550, { ...titleStyle, color: '#fff' });
  at(notice, margin, 458, 540, white);
  await savePage(true);

  if (plan.days.length > 1) {
    const w = 558;
    function overviewPage(continued = false) {
      openPage('ОБЗОР ПОЕЗДКИ');
      photoPanel(tripPhotos.overview, 624, 100, 298, 389);
      at(continued ? 'ДНИ ПОЕЗДКИ · ПРОДОЛЖЕНИЕ' : 'ДНИ ПОЕЗДКИ', margin, 105, w, smallStyle);
      return at('Ваш отдых в A’MORE', margin, 125, w, headingStyle) + 8;
    }
    let y = overviewPage();
    for (const [index, day] of plan.days.entries()) {
      const highlights = wrap(ctx, dayHighlights(day), w - 155, bodyStyle);
      const rowHeight = Math.max(highlights.height, 18) + 12;
      if (y + rowHeight > bottom) { await savePage(); y = overviewPage(true); }
      line(margin, y, w);
      at(`ДЕНЬ ${dayNumber(index)}`, margin, y + 6, 64, smallStyle);
      at(shortLabel(day.date), margin + 65, y + 6, 89, bodyStyle);
      paint(ctx, highlights, margin + 155, y + 6);
      y += rowHeight;
    }
    await savePage();
  }

  for (const [index, day] of plan.days.entries()) {
    const number = dayNumber(index);
    const photoWidth = 254;
    const gap = 30;
    const scheduleWidth = contentWidth - photoWidth - gap;
    const photoLeft = index % 2 === 1;
    const tx = photoLeft ? margin + photoWidth + gap : margin;
    const px = photoLeft ? margin : width - margin - photoWidth;
    function dayPage(continued = false) {
      openPage(`РАСПИСАНИЕ   /   ДЕНЬ ${number}`);
      photoPanel(dayPhotos[index], px, 100, photoWidth, 389, number);
      at(`ДЕНЬ ${number}${continued ? '   /   ПРОДОЛЖЕНИЕ' : ''}`, tx, 103, scheduleWidth, smallStyle);
      return at(shortLabel(day.date), tx, 123, scheduleWidth, headingStyle) + 6;
    }
    const items = day.items.filter(item => item.kind !== 'free' || item.edited || item.end - item.start >= 45);
    const rows = items.map(item => scheduleRow(ctx, item, scheduleWidth - timeColumn, plan.answers, routeGuide?.routes.length));
    let y = dayPage();
    if (!rows.length) at('На этот день нет запланированных занятий.', tx, y, scheduleWidth);
    for (const row of rows) {
      if (y + row.height > bottom) { await savePage(); y = dayPage(true); }
      line(tx, y, scheduleWidth);
      at(row.time, tx, y + 3, timeColumn - 7, smallStyle);
      let ry = y + 3;
      for (const block of row.blocks) ry = paint(ctx, block, tx + timeColumn, ry);
      y += row.height;
    }
    await savePage();
  }

  const confirmations = plan.days.flatMap(day => day.items.filter(item => item.confirmation).map(item => ({
    title: `${shortLabel(day.date)} · ${timeRange(item.start, item.end)} · ${item.title}`, detail: item.confirmation,
  })));
  const fallbacks = [...new Set(plan.days.flatMap(day => day.items.map(item => item.fallback).filter(Boolean)))];
  const options = childActivityOptions.filter(option => plan.answers.childActivities?.includes(option.id));
  const hasFamilyProgramme = plan.days.some(day => day.items.some(item =>
    item.kind === 'family' || item.tracks?.some(track => track.audience.startsWith('Дети'))));
  if (hasFamilyProgramme && options.some(option => plan.answers.ages.some(age => age < option.minAge))) {
    fallbacks.push('Если выбранное занятие не подходит младшим по возрасту, предложите им спокойную игру рядом с сопровождающим.');
  }
  const groups = [
    ['Что согласовать заранее', confirmations],
    ['Что не вошло в расписание', plan.unplaced.map(item => ({ title: item.title, detail: item.reason }))],
    ['Если планы изменятся', fallbacks.map(detail => ({ detail }))],
    ['Что учесть', plan.notes.map(detail => ({ detail }))],
  ].filter(([, items]) => items.length);
  if (groups.length) {
    const groupStyle = { ...titleStyle, color: accent };
    function notesPage(continued) {
      openPage('ПАМЯТКА ГОСТЯ');
      return sectionHeading('Перед поездкой', continued ? 'ПАМЯТКА ГОСТЯ · ПРОДОЛЖЕНИЕ' : 'ПАМЯТКА ГОСТЯ');
    }
    let y = notesPage(false);
    for (const [title, items] of groups) {
      const rows = items.map(item => {
        const blocks = [item.title && wrap(ctx, item.title, contentWidth, titleStyle), wrap(ctx, item.detail, contentWidth, bodyStyle)].filter(Boolean);
        return { blocks, h: blocks.reduce((sum, block) => sum + block.height, 10) };
      });
      if (y + groupStyle.lineHeight + rows[0].h + 4 > bottom) { await savePage(); y = notesPage(true); }
      y = at(title, margin, y, contentWidth, groupStyle) + 4;
      for (const { blocks, h } of rows) {
        if (y + h > bottom) {
          await savePage();
          y = at(title, margin, notesPage(true), contentWidth, groupStyle) + 4;
        }
        line(margin, y, contentWidth);
        y += 5;
        for (const block of blocks) y = paint(ctx, block, margin, y);
        y += 5;
      }
      y += 13;
    }
    await savePage();
  }

  const mapWidth = 560;
  const sideX = margin + mapWidth + 25;
  const sideWidth = contentWidth - mapWidth - 25;
  for (const route of routeGuide?.routes ?? []) {
    openPage('МАРШРУТЫ ОТ ОТЕЛЯ');
    const y = sectionHeading(route.title, 'МАРШРУТЫ ОТ ОТЕЛЯ');
    if (route.drawMap) map(route.drawMap, margin, y, mapWidth, 260);
    let sy = at(route.metrics, sideX, y + 5, sideWidth, titleStyle) + 12;
    sy = at(route.detail, sideX, sy, sideWidth) + 10;
    sy = at(routeGuide.intro || '', sideX, sy, sideWidth) + 12;
    if (route.href) link(route.linkLabel || 'Открыть маршрут на карте', route.href, sideX, sy, sideWidth);
    await savePage();
  }
  if (routeGuide?.drawMap || routeGuide?.attractions.length) {
    openPage('МАРШРУТЫ ОТ ОТЕЛЯ');
    let y = sectionHeading('Карта достопримечательностей', 'МАРШРУТЫ ОТ ОТЕЛЯ');
    const hasMap = Boolean(routeGuide.drawMap);
    if (hasMap) {
      const caption = wrap(ctx, routeGuide.mapCaption || '', mapWidth, emphasisStyle);
      const mapHeight = Math.min(260, bottom - y - caption.height - 8);
      map(routeGuide.drawMap, margin, y, mapWidth, mapHeight);
      paint(ctx, caption, margin, y + mapHeight + 8);
    }
    let x = hasMap ? sideX : margin;
    let w = hasMap ? sideWidth : contentWidth;
    const legendTitle = 'РАССТОЯНИЕ И ВРЕМЯ В ОДНУ СТОРОНУ';
    y = at(legendTitle, x, y, w, smallStyle) + 4;
    for (const place of routeGuide.attractions) {
      let metrics = wrap(ctx, place.metrics || '', w, trackStyle);
      let detail = wrap(ctx, place.detail || '', w, bodyStyle);
      const linkHeight = wrap(ctx, place.title, w, linkStyle).height;
      if (y + metrics.height + detail.height + linkHeight + 15 > bottom) {
        await savePage();
        openPage('МАРШРУТЫ ОТ ОТЕЛЯ');
        y = sectionHeading('Маршруты к достопримечательностям', 'ССЫЛКИ НА КАРТУ');
        x = margin;
        w = contentWidth;
        y = at(legendTitle, x, y, w, smallStyle) + 4;
        metrics = wrap(ctx, place.metrics || '', w, trackStyle);
        detail = wrap(ctx, place.detail || '', w, bodyStyle);
      }
      y = link(place.title, place.href, x, y + 5, w) + 2;
      y = paint(ctx, metrics, x, y);
      y = paint(ctx, detail, x, y) + 8;
      line(x, y, w);
    }
    await savePage();
  }
  return makePdf(pages, canvas.width, canvas.height);
}

export async function prepareHolidayPdfDownload(plan, options) {
  const blob = await buildHolidayPdf(plan, options);
  const url = URL.createObjectURL(blob);
  return {
    url,
    filename: `amore-plan-${plan.answers.startDate}.pdf`,
    release: () => URL.revokeObjectURL(url),
  };
}
