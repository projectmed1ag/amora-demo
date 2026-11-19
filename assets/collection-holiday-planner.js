import { onsiteInterests, services, attractions, mapRoute, demoOrigin, demoOriginLabel, outingTransports, childActivityOptions } from './collection-holiday-data.js?v=20261108-route-pdf-1';
import { breakfastNotice, buildHolidayPlan, planToText, validateAnswers, validateTripDates, addDays, dateLabel, dateNumber, clock, excursionSettings, outingDurationMinutes, availableInterestInStay, interestSeasonLabel, familyAdultInterests } from './collection-holiday-engine.js?v=20261119-family-1';
import { holidayLodgings } from './collection-holiday-lodging.js';
import { canEditScheduleItem, canMoveScheduleItem, scheduleReplacementOptions, applyScheduleEdit, replayScheduleEdits } from './collection-holiday-edits.js?v=20261108-route-pdf-1';
import { loadHolidayDraft, saveHolidayDraft, clearHolidayDraft } from './collection-holiday-draft.js?v=20261119-family-1';
import { mountPlanRequests } from './collection-holiday-requests.js?v=20261108-route-pdf-1';
import { hotelEventLabels, loadHotelEvents, mountHotelEvents } from './collection-holiday-events.js?v=20261112-chat-3';
import { destinationDateParts, destinationLocalDate } from './collection-destinations.js?v=20261024-all-hotels-1';
import { mountHolidayChat } from './collection-holiday-chat.js?v=20261116-chat-pdf-1';
import { activityTiles, alternativesMarkup, badgesMarkup, boardIcon, boardMark, boardPalette, boardPhoto, buildBoardAlternatives, isBoardActivity } from './collection-holiday-board.js?v=20261119-row-actions-1';
import { hasBoardLocation, mountBoardMap } from './collection-holiday-board-map.js?v=20261119-row-actions-1';

const root = document.getElementById('planner-app');
const masthead = document.getElementById('planner-masthead');
const viewSwitch = document.getElementById('planner-assistant');
const planView = document.getElementById('planner-plan-view');
const chatView = document.getElementById('planner-chat');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const today = () => destinationLocalDate(new Date(), 'mozhaysk');
const nowMinute = () => { const { hour, minute } = destinationDateParts(new Date(), 'mozhaysk'); return Number(hour) * 60 + Number(minute); };
const initialDate = addDays(today(), 1);
const defaultAnswers = {
  startDate: initialDate, endDate: initialDate, arrival: '09:00', departure: '20:00', lodging: '',
  adults: 2, children: 0, ages: [], childActivities: [], familyMode: 'together', adultActivity: '', pace: 'balanced', wake: '09:00', rest: '21:00',
  interests: [], suggestActivities: false, services: [], preferred: Object.fromEntries(services.map(s => [s.id, s.preferred])),
  outingMode: 'stay', places: [], outings: {}, origin: demoOrigin,
  transport: 'auto',
};
const answers = structuredClone(defaultAnswers);
const questions = {
  dates: 'Когда и на сколько вы приедете?', party: 'Кто едет отдыхать?', lodging: 'Где хотите остановиться?', rhythm: 'Какой ритм вам ближе?',
  outings: 'Чем хотите заняться?',
  routes: 'Куда поедем и как доберёмся?',
  services: 'Что добавить в расписание — ресторан, баню или мангальную зону?', review: 'Всё верно? Составим вашу программу.',
};
const stepFields = { dates: ['startDate', 'endDate', 'arrival', 'departure'], party: ['adults', 'children', 'ages', 'familyMode', 'childActivities'], lodging: ['lodging'], rhythm: ['pace', 'wake'], outings: ['outingMode', 'interests', 'suggestActivities'], routes: ['places'], services: ['services', 'restaurant', 'banya', 'barbecue'], review: [] };
let current = 'dates', plan, quickEdit;
let chatState = {}, chat;
let planEdits = [], unappliedEdits = [], undoEdit, itemEditor, pdfPreparation, preparedPdf;
let priorityMeals = true, marks = new Set(), boardRecord, autoRecord, selectedDay, selectedMapItem;
let boardTab = 'schedule';
const isAutoRoute = () => new URLSearchParams(location.search).get('mode') === 'auto';
const isFamilyRoute = () => new URLSearchParams(location.search).get('mode') === 'family';
const draftBanner = document.getElementById('planner-draft');
const draftCity = 'mozhaysk';
const { token: bookingToken, scope: bookingScope, handoff: bookingHandoff } = bookingContext();
const bookingStatus = 'Даты, хаусбот и число гостей взяты из бронирования. Уточните состав компании.';
const bookingFallbackStatus = 'Чтобы перенести данные бронирования, откройте планировщик со страницы подтверждения.';
let draftScope = draftCity;
let bookingCompact = false;
const localBookingHost = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname);
const holidayApiBase = coordinationApiBase();
const lodgingAvailabilityUrl = holidayApiBase
  ? new URL(localBookingHost ? 'availability' : 'planner-availability', holidayApiBase) : null;
let bookingConfigRequest;
const overnight = () => answers.endDate > answers.startDate;
const guestCount = () => answers.adults + answers.children;
const stayingAtHotel = () => answers.outingMode === 'stay';
const steps = () => [
  'outings',
  ...(!bookingCompact ? ['dates'] : []), 'party',
  ...(!bookingCompact && overnight() ? ['lodging'] : []),
  'rhythm', ...(!stayingAtHotel() ? ['routes'] : []), 'services', 'review',
];
const selectedPlaces = () => attractions.filter(place => answers.places.includes(place.id));
const outingModeLabel = () => stayingAtHotel() ? 'Без выездов к достопримечательностям' : 'Выезды к достопримечательностям';
const selectedInterests = () => onsiteInterests.filter(item => answers.interests.includes(item.id));
const interestsLabel = () => selectedInterests().map(item => item.title).join(', ')
  || (answers.suggestActivities ? 'Помощник подберёт занятия' : 'Свободное время');
const canBuildFirstPlan = () => !quickEdit && current === 'outings' && stayingAtHotel()
  && !Object.keys(validateAnswers(answers, today(), nowMinute())).length;
const isBookedLodging = roomId => bookingHandoff?.lodging === roomId && answers.startDate === bookingHandoff.startDate
  && answers.endDate === bookingHandoff.endDate && guestCount() <= bookingHandoff.adults;
const lodgingOptions = () => holidayLodgings.filter(item => item.capacity >= guestCount() || isBookedLodging(item.id));
const lodgingChoice = () => overnight() ? lodgingOptions().find(item => item.id === answers.lodging) : undefined;
const lodgingLabel = () => overnight() ? lodgingChoice()?.label || 'Пока не выбрано' : 'Без ночёвки';
const checked = value => value ? ' checked' : '';
const outingField = (id, name) => `outing-${id}-${name}`;
const field = (name, label, type, value, extra = '') => `<div class="planner-field"><label for="plan-${name}">${label}</label><input id="plan-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
const choice = (name, value, title, detail, active, type = 'radio', disabled = false) => `<label class="planner-choice"><input type="${type}" name="${name}" value="${value}"${checked(active)}${disabled ? ' disabled' : ''}><span><strong>${title}</strong>${detail ? `<small>${detail}</small>` : ''}</span></label>`;

function coordinationApiBase() {
  if (localBookingHost) return new URL('/api/local-booking/', location.origin);
  const configured = root?.dataset.holidayApiBase?.trim();
  if (!configured) return null;
  try {
    const base = new URL(configured, location.href);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) return null;
    base.pathname = `${base.pathname.replace(/\/+$/, '')}/`;
    return base;
  } catch {
    return null;
  }
}

function validatedBookingHandoff(saved) {
  if (saved?.city !== draftCity) return null;
  const { checkIn, checkOut, roomId, guests } = saved;
  if (!(dateNumber(checkOut) > dateNumber(checkIn))) return null;
  if (!Number.isInteger(guests) || guests < 1 || guests > 20 || !holidayLodgings.some(room => room.id === roomId)) return null;
  return { startDate: checkIn, endDate: checkOut, lodging: roomId, adults: guests };
}

function bookingContext() {
  const url = new URL(location.href);
  if (url.searchParams.get('city') !== draftCity) return {};
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (fragment.get('stay') === '1') {
    const stay = {
      city: draftCity, checkIn: fragment.get('checkIn'), checkOut: fragment.get('checkOut'),
      roomId: fragment.get('roomId'), guests: Number(fragment.get('guests')),
    };
    const handoff = validatedBookingHandoff(stay);
    if (handoff) {
      const tripKey = `${draftCity}:stay:${stay.checkIn}:${stay.checkOut}:${stay.roomId}:${stay.guests}`;
      let token;
      try {
        token = sessionStorage.getItem(tripKey) || crypto.randomUUID();
        sessionStorage.setItem(tripKey, token);
        sessionStorage.setItem(`amore-holiday-booking:${token}`, JSON.stringify(stay));
        url.hash = '';
        url.searchParams.set('booking', token);
        history.replaceState(history.state, '', url);
      } catch {
        // Keep the fragment available on reload when browser storage is blocked.
      }
      return { token, scope: token ? `${draftCity}:booking:${token}` : tripKey, handoff };
    }
  }
  const token = url.searchParams.get('booking');
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(token || '')) return {};
  const scope = `${draftCity}:booking:${token}`;
  try {
    const saved = JSON.parse(sessionStorage.getItem(`amore-holiday-booking:${token}`));
    return { token, scope, handoff: validatedBookingHandoff(saved) };
  } catch {
    return { token, scope };
  }
}

function bookingDefaults() {
  if (!bookingHandoff || bookingHandoff.startDate !== today()) return bookingHandoff;
  const minute = nowMinute();
  const nextQuarter = Math.min(1439, Math.ceil((minute + 1) / 15) * 15);
  return clock(minute) >= defaultAnswers.arrival && minute < 1439
    ? { ...bookingHandoff, arrival: clock(nextQuarter) } : bookingHandoff;
}

function matchesBooking() {
  return bookingHandoff && answers.startDate === bookingHandoff.startDate && answers.endDate === bookingHandoff.endDate
    && answers.lodging === bookingHandoff.lodging && (!Number.isFinite(guestCount()) || guestCount() === bookingHandoff.adults);
}

function canUseCompactBooking() {
  return Boolean(matchesBooking() && !Object.keys(validateAnswers(answers, today(), nowMinute())).some(key => stepFields.dates.includes(key)));
}

function showDraftStatus(message, canReset = true) {
  if (!draftBanner) return;
  draftBanner.hidden = !message;
  const status = draftBanner.querySelector('[data-draft-status]');
  if (status.textContent !== message) status.textContent = message;
  draftBanner.querySelector('[data-reset-draft]').hidden = !canReset;
  const resetActions = draftBanner.querySelector('[data-reset-actions]');
  if (resetActions) resetActions.hidden = true;
}

function persistDraft(completed = false) {
  if (quickEdit) return;
  const record = { answers: structuredClone(answers), step: completed ? 'review' : current, edits: [...planEdits], completed, priorityMeals, marks: [...marks] };
  const automatic = !completed && isAutoRoute();
  if (automatic) autoRecord = record;
  else boardRecord = record;
  const saved = saveHolidayDraft(automatic ? `${draftScope}:auto` : draftScope, record);
  showDraftStatus(saved ? 'Черновик сохранён в этом браузере.' : 'Браузер не смог сохранить черновик.', saved);
  return saved;
}

function agesMarkup({ children, ages } = answers) {
  return `<div class="planner-age-grid">${Array.from({ length: Math.max(0, Math.min(10, children || 0)) }, (_, i) => field(`age-${i}`, `Возраст ребёнка ${i + 1}`, 'number', ages[i] ?? '', 'min="0" max="17" step="1" inputmode="numeric" required')).join('')}</div>`;
}

const childActivityChoices = () => childActivityOptions.filter(option => answers.ages.some(age => Number.isInteger(age) && age <= 17 && age >= option.minAge));
const familyModeLabel = () => answers.familyMode === 'separate' ? 'Часть времени вместе, часть отдельно' : 'Отдыхаем всей семьёй';

function childActivityMarkup() {
  const choices = childActivityChoices();
  return choices.length ? `<div class="planner-choices">${choices.map(item =>
    choice('childActivities', item.id, item.title, item.detail, answers.childActivities.includes(item.id), 'checkbox')
  ).join('')}</div>` : '<p class="planner-help">Укажите возраст детей, чтобы увидеть подходящие варианты.</p>';
}

function bookingEditButtons() {
  return `<button type="button" class="planner-edit" data-edit-booking="dates">Изменить даты и время</button>
    <button type="button" class="planner-edit" data-edit-booking="lodging">Изменить размещение</button>`;
}

function lodgingEditButton() {
  return lodgingAvailabilityUrl && overnight()
    ? '<button type="button" class="planner-edit" data-edit-booking="lodging">Проверить или изменить хаусбот</button>' : '';
}

function bookingPartyMarkup() {
  return `<div class="planner-note planner-booking-summary">
    <strong>Из бронирования</strong>
    <div>${esc(dateLabel(answers.startDate))} — ${esc(dateLabel(answers.endDate))} · ${esc(lodgingLabel())}</div>
    <div>Гостей · ${bookingHandoff.adults}</div>
    <div>Время для плана · ${esc(answers.arrival)}–${esc(answers.departure)} по Москве</div>
    <div class="planner-booking-actions">${bookingEditButtons()}</div>
  </div>
  <div class="planner-fields">
    ${field('children', 'Дети до 18 лет', 'number', answers.children, `min="0" max="${Math.min(10, bookingHandoff.adults - 1)}" step="1" inputmode="numeric" required`)}
    <p class="planner-help" aria-live="polite">Взрослые · <span data-booked-adults>${Number.isInteger(answers.adults) && answers.adults > 0 ? answers.adults : '—'}</span></p>
  </div>`;
}

function partyMarkup() {
  const counts = bookingCompact ? bookingPartyMarkup() : `<div class="planner-fields">
    ${field('adults', 'Взрослые', 'number', answers.adults, 'min="1" max="20" step="1" inputmode="numeric" required')}
    ${field('children', 'Дети до 18 лет', 'number', answers.children, 'min="0" max="10" step="1" inputmode="numeric" required')}
  </div>`;
  return `${quickEdit ? `<p class="planner-help">Возраст детей: ${esc(answers.ages.join(', '))}. Можно изменить формат отдыха и занятия.</p>` : counts}
  <div id="plan-children-details"${answers.children > 0 ? '' : ' hidden'}>
    ${quickEdit ? '' : `<fieldset><legend>Сколько лет детям?</legend><div id="plan-ages">${agesMarkup()}</div></fieldset>`}
    <fieldset>
      <legend>Как проведём время?</legend>
      <div class="planner-choices">
        ${choice('familyMode', 'together', 'Отдыхаем всей семьёй', 'Прогулки, игры и занятия для детей и взрослых вместе', answers.familyMode === 'together')}
        ${choice('familyMode', 'separate', 'Часть времени вместе, часть отдельно', 'Общие занятия и время порознь: дети с сопровождающим, взрослые отдыхают', answers.familyMode === 'separate')}
      </div>
    </fieldset>
    <details class="planner-options" data-child-options${quickEdit && answers.childActivities.length ? ' open' : ''}>
      <summary>Выбрать детские занятия</summary>
      <p class="planner-help">Можно пропустить — тогда помощник предложит занятия по возрасту.</p>
      <div data-child-activities>${childActivityMarkup()}</div>
    </details>
  </div>`;
}

function tripSummaryLines() {
  return [
    ['Когда', `${answers.startDate} → ${answers.endDate}`, `${answers.arrival}–${answers.departure} · по Москве`],
    ['Компания', `Взрослых: ${answers.adults || '—'} · Детей: ${Number.isFinite(answers.children) ? answers.children : '—'}`, answers.children ? `Возраст: ${answers.ages.map(age => age === '' ? '?' : age).join(', ')}` : ''],
    ['Размещение', lodgingLabel(), ''],
  ];
}

function previousSteps() {
  const sequence = steps();
  return quickEdit ? [] : sequence.slice(0, Math.max(0, sequence.indexOf(current)));
}

function summaryValuesMarkup(includeHistory = false) {
  const history = includeHistory ? previousSteps().filter(step => ['rhythm', 'outings', 'routes', 'services'].includes(step))
    .map(step => step === 'outings' ? ['Занятия', interestsLabel()] : [questions[step], answerLabel(step)]) : [];
  return [...tripSummaryLines(), ...(answers.children > 0 ? [['Семейный формат', familyModeLabel()]] : []), ['Формат отдыха', outingModeLabel()], ...history]
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('');
}

function renderSummaryValues() {
  for (const summary of root.querySelectorAll('[data-trip-summary]')) {
    summary.innerHTML = summaryValuesMarkup(summary.dataset.tripSummary === 'history');
  }
}

function summaryLines() {
  return [
    ...tripSummaryLines(),
    ...(answers.children > 0 ? [['Семейный формат', familyModeLabel(), answers.childActivities.length
      ? childActivityOptions.filter(item => answers.childActivities.includes(item.id)).map(item => item.title).join(', ')
      : 'Занятия по возрасту детей']] : []),
    ['Ритм', { calm: 'Спокойный', balanced: 'Всего понемногу', active: 'Активный' }[answers.pace], overnight() ? `День с ${answers.wake} до ${answers.rest}` : ''],
    ['Занятия', interestsLabel(), ''],
    ['Формат отдыха', outingModeLabel(), ''],
    ...(!stayingAtHotel() ? selectedPlaces().map(place => {
      const { transport, excursionDate, excursionTime, travelMinutes, travelEstimateSource, visitMinutes } = excursionSettings(answers, place.id);
      const preference = [outingTransports[transport].title, excursionDate ? dateLabel(excursionDate) : 'День подберёт помощник', excursionTime && `около ${excursionTime}`].filter(Boolean).join(' · ');
      const originNote = travelEstimateSource === 'default-origin' ? ' от Горетова' : '';
      return [place.title, preference, `Дорога${originNote} около ${travelMinutes} мин в одну сторону · на посещение заложено ${visitMinutes} мин`];
    }) : []),
    ['Пожелания', answers.services.map(id => services.find(item => item.id === id)?.title).join(', ') || 'Без дополнительных услуг', ''],
  ];
}

function answerLabel(step) {
  if (step === 'dates') return `${answers.startDate} ${answers.arrival} → ${answers.endDate} ${answers.departure}`;
  if (step === 'party') return `${answers.adults} взрослых${answers.children ? `, детей: ${answers.children}; возраст: ${answers.ages.join(', ')}` : ', без детей'}`;
  if (step === 'lodging') return lodgingLabel();
  if (step === 'rhythm') return `${{ calm: 'Спокойный', balanced: 'Сбалансированный', active: 'Активный' }[answers.pace]} · день ${answers.wake}–${answers.rest}`;
  if (step === 'outings') return `${interestsLabel()} · ${outingModeLabel()}`;
  if (step === 'routes') return selectedPlaces().map(place => `${place.title} · ${outingTransports[excursionSettings(answers, place.id).transport].title}`).join('; ');
  return answers.services.length ? answers.services.map(id => `${services.find(item => item.id === id).title}, около ${answers.preferred[id]}`).join('; ') : 'Без дополнительных бронирований';
}

function lodgingMarkup() {
  const options = lodgingOptions();
  const later = choice('lodging', '', 'Выбрать позже', '', !answers.lodging);
  const catalog = '<p class="planner-catalog"><a href="./rooms.html?city=mozhaysk" target="_blank" rel="noopener">Посмотреть фотографии и описание хаусботов ↗</a></p>';
  if (lodgingAvailabilityUrl && overnight() && options.length && answers.startDate >= today()) {
    return `<div class="planner-lodging-availability" data-lodging-availability>
      <p class="planner-lodging-status" role="status">Проверяем свободные хаусботы на ваши даты…</p>
      <div data-lodging-options></div>
      <button type="button" class="planner-edit" data-lodging-retry hidden>Проверить ещё раз</button>
      <div class="planner-choices">${later}</div>
    </div>${catalog}`;
  }
  const prompt = options.length
    ? 'Показываю хаусботы, в которых поместится вся компания. Свободные даты можно проверить отдельно в сервисе бронирования.'
    : 'Для всей компании понадобится несколько хаусботов. Составьте общий план, а размещение можно подобрать отдельно в каталоге.';
  return `<p class="planner-help">${prompt}</p>
    <div class="planner-choices">
      ${options.map(item => choice('lodging', item.id, esc(item.label), isBookedLodging(item.id) ? 'Из бронирования' : `До ${item.capacity} гостей`, answers.lodging === item.id)).join('')}
      ${later}
    </div>${catalog}`;
}

function mountLodgingAvailability(form) {
  const panel = form.querySelector('[data-lodging-availability]');
  if (!panel) return;
  const status = panel.querySelector('[role="status"]');
  const cards = panel.querySelector('[data-lodging-options]');
  const retry = panel.querySelector('[data-lodging-retry]');
  const next = form.querySelector('.planner-next');
  const later = panel.querySelector('input[value=""]');
  const rooms = lodgingOptions();
  const url = new URL(lodgingAvailabilityUrl);
  url.search = new URLSearchParams({
    city: draftCity, checkin: answers.startDate, checkout: answers.endDate, guests: guestCount(),
  });
  if (localBookingHost) url.searchParams.set('kind', 'stay');
  let unavailable = new Map();
  let loading = true;
  let message = status.textContent;
  let bookingFailure = false;

  const selectionError = () => unavailable.get(answers.lodging) || '';
  function updateStatus() {
    const warning = selectionError();
    const text = warning || message;
    if (status.textContent !== text) status.textContent = text;
    status.classList.toggle('planner-lodging-status-warning', Boolean(warning || bookingFailure));
    next.disabled = Boolean(warning || (loading && answers.lodging));
  }

  async function load() {
    loading = true;
    cards.setAttribute('aria-busy', 'true');
    retry.hidden = true;
    bookingFailure = false;
    message = 'Проверяем свободные хаусботы на ваши даты…';
    updateStatus();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let inventory;
    try {
      const response = await fetch(url, { cache: 'no-store', credentials: 'omit', signal: controller.signal });
      const result = await response.json();
      if (response.status === 400 && result?.error?.field === 'guests') {
        message = 'В календаре нет вариантов для такого числа гостей. Размещение можно уточнить отдельно.';
      } else {
        if (!response.ok || result?.city !== draftCity || !Array.isArray(result.options)
          || result.checkin !== url.searchParams.get('checkin') || result.checkout !== url.searchParams.get('checkout')
          || result.guests !== Number(url.searchParams.get('guests'))
          || (localBookingHost && (result.mode !== 'local-demo' || result.kind !== 'stay'))) {
          throw new Error('Invalid availability response');
        }
        inventory = new Map(result.options.filter(item => item && typeof item.id === 'string'
          && Number.isInteger(item.capacity) && item.capacity >= 0
          && Number.isInteger(item.available) && item.available >= 0).map(item => [item.id, item]));
        if (!inventory.size) throw new Error('Empty availability response');
      }
    } catch {
      bookingFailure = true;
      message = 'Не удалось проверить доступность. Можно повторить проверку или продолжить планирование.';
    } finally {
      clearTimeout(timer);
    }
    if (!form.isConnected) return;

    unavailable = new Map();
    const groups = { free: [], busy: [], unknown: [] };
    for (const room of rooms) {
      const booked = isBookedLodging(room.id);
      const item = inventory?.get(room.id);
      let state = 'unknown';
      let detail = 'Доступность уточняется отдельно';
      if (booked || item?.available > 0) {
        state = 'free';
        detail = booked ? 'Из вашего бронирования' : 'Свободен на ваши даты';
      } else if (item) {
        state = 'busy';
        detail = item.capacity === 0 ? 'Сейчас не бронируется'
          : item.capacity < guestCount() ? 'Не подходит по вместимости' : 'Занят на выбранные даты';
        unavailable.set(room.id, `${room.label}: ${detail.toLowerCase()}. Выберите другой вариант или «Выбрать позже». Остальные ответы сохранены.`);
      }
      groups[state].push(`<label class="planner-choice planner-lodging-card" data-availability="${state}">
        <input type="radio" name="lodging" value="${esc(room.id)}"${checked(room.id === answers.lodging && state !== 'busy')}${state === 'busy' ? ' disabled' : ''}>
        <span><strong>${esc(room.label)}</strong><small>До ${room.capacity} гостей · ${detail}</small></span>
      </label>`);
    }
    const labels = { free: 'Доступные варианты', busy: 'Недоступные варианты', unknown: 'Проверяются отдельно' };
    cards.innerHTML = Object.entries(groups).filter(([, items]) => items.length).map(([state, items]) =>
      `<fieldset class="planner-lodging-group"><legend>${labels[state]}</legend><div class="planner-choices">${items.join('')}</div></fieldset>`
    ).join('');
    if (inventory) message = groups.free.length ? 'Доступность проверена на выбранные даты.'
      : 'На эти даты в календаре нет свободных хаусботов для вашей компании. Можно изменить даты или выбрать размещение позже.';
    later.checked = !answers.lodging;
    loading = false;
    cards.removeAttribute('aria-busy');
    retry.hidden = !bookingFailure;
    updateStatus();
  }

  retry.addEventListener('click', () => {
    status.tabIndex = -1;
    status.focus();
    void load();
  });
  void load();
  return {
    updateStatus,
    error: () => loading && answers.lodging ? 'Дождитесь проверки доступности или выберите размещение позже.' : selectionError(),
  };
}

function interestCountLabel() {
  return answers.suggestActivities ? 'Подбор помощника' : `Выбрано: ${selectedInterests().length}`;
}

function interestsMarkup() {
  const groups = {
    nature: 'На природе и у воды',
    active: 'Спорт и активный отдых',
    family: 'Детям и всей семье',
    gatherings: 'Посиделки и праздники',
  };
  const inSeason = [];
  const outOfSeason = [];
  for (const item of onsiteInterests) {
    const list = availableInterestInStay(item.id, answers.startDate, answers.endDate) ? inSeason : outOfSeason;
    list.push(item);
  }
  const selected = item => answers.interests.includes(item.id);
  return `<div class="planner-choices">
    ${quickEdit ? choice('suggestActivities', 'yes', 'Предложите за меня', 'Помощник учтёт ваш ритм, сезон и состав компании.', answers.suggestActivities && !selectedInterests().length, 'checkbox') : ''}
    <div class="planner-activity-groups">${Object.entries(groups).map(([id, title]) => {
      const items = inSeason.filter(item => (item.group || 'nature') === id);
      if (!items.length) return '';
      return `<section class="holiday-pick-group">
        <h3>${title}</h3>
        <div class="holiday-pick-grid">${activityTiles(items.map(item => ({ ...item, selected: selected(item) })))}</div>
      </section>`;
    }).join('')}</div>
    ${outOfSeason.length ? `<section class="holiday-pick-group" data-out-of-season>
      <h3 tabindex="-1">Занятия вне сезона</h3>
      <div class="holiday-pick-grid">${activityTiles(outOfSeason.map(item => ({ ...item, detail: `Сезон: ${interestSeasonLabel(item.id)}`, selected: selected(item), disabled: !selected(item) })))}</div>
    </section>` : ''}
  </div>`;
}

function outingsMarkup() {
  return `<fieldset>
      <legend>Занятия в отеле и рядом</legend>
      <div class="planner-selection-help">
        <p class="planner-help">${quickEdit ? 'Выберите занятия для обновлённого плана.' : 'Отметьте любимые занятия. Помощник учтёт ваши пожелания и дополнит их подходящими по сезону идеями.'}</p>
        <p class="planner-selection-count" role="status" data-interest-count>${interestCountLabel()}</p>
      </div>
      ${interestsMarkup()}
    </fieldset>
    <fieldset>
      <legend>Поездки к достопримечательностям</legend>
      <div class="planner-choices">
        ${choice('outingMode', 'stay', 'Без выездов к достопримечательностям', '', stayingAtHotel())}
        ${choice('outingMode', 'visit', 'Добавить выезды', 'Места и транспорт можно выбрать на этапе настройки поездок.', !stayingAtHotel())}
      </div>
    </fieldset>`;
}

function outingCard(place) {
  const { id, title } = place;
  const settings = excursionSettings(answers, id);
  const transportName = outingField(id, 'transport');
  return `<fieldset class="planner-outing" data-outing="${id}"${answers.places.includes(id) ? '' : ' hidden'}>
    <legend>${esc(title)}</legend>
    <div class="planner-field">
      <label for="plan-${transportName}">Как доберёмся</label>
      <select id="plan-${transportName}" name="${transportName}">
        ${Object.entries(outingTransports).map(([value, option]) => `<option value="${value}"${settings.transport === value ? ' selected' : ''}>${esc(option.title)}</option>`).join('')}
      </select>
    </div>
    <p class="planner-outing-overview" data-outing-overview aria-live="polite"></p>
    <details class="planner-options">
      <summary>Желаемый день и время выезда</summary>
      <div class="planner-fields">
        ${field(outingField(id, 'excursionDate'), 'День поездки (по желанию)', 'date', settings.excursionDate, `min="${esc(answers.startDate)}" max="${esc(answers.endDate)}"`)}
        ${field(outingField(id, 'excursionTime'), 'Желаемое время выезда', 'time', settings.excursionTime)}
      </div>
    </details>
    <p class="planner-hint" data-outing-hint></p>
    <div class="planner-route-preview" data-outing-route></div>
  </fieldset>`;
}

function routesMarkup() {
  return `<p class="planner-help">Выберите места и транспорт. Помощник оценит время в дороге и подберёт свободное окно, если вы не укажете день и час.</p>
    <fieldset><legend>Что хотите посмотреть?</legend>
      <div class="planner-choices">${attractions.map(place => choice('places', place.id, place.title, '', answers.places.includes(place.id), 'checkbox')).join('')}</div>
    </fieldset>
    ${attractions.map(outingCard).join('')}
    <details class="planner-options">
      <summary>Изменить точку старта</summary>
      ${field('origin', 'Откуда строить маршруты', 'text', answers.origin, 'maxlength="200"')}
      <p class="planner-hint">${demoOriginLabel} Для другого старта укажите свой адрес или координаты.</p>
    </details>`;
}

function familyModeNote() {
  if (answers.familyMode !== 'separate') return 'Детские занятия включу в общую семейную программу.';
  if (answers.ages.some(age => Number.isInteger(age) && age < 3)) return answers.adults > 1
    ? 'Во время раздельных занятий один взрослый останется с детьми, а остальные смогут отдохнуть отдельно.'
    : 'С ребёнком до трёх лет запланирую совместные занятия с единственным взрослым.';
  return 'Раздельные занятия возможны при подтверждённом сопровождении детей на весь интервал.';
}

function questionMarkup() {
  if (current === 'dates') return `<p class="planner-help">Можно приехать одним днём или остаться с ночёвкой. Учитываю время приезда и отъезда. Всё расписание — по московскому времени.</p><div class="planner-fields">${field('startDate', 'Дата приезда', 'date', answers.startDate, `min="${today()}" required`)}${field('endDate', 'Дата отъезда', 'date', answers.endDate, `min="${answers.startDate}" required`)}${field('arrival', 'Время приезда', 'time', answers.arrival, 'required')}${field('departure', 'Время отъезда', 'time', answers.departure, 'required')}</div>`;
  if (current === 'party') return partyMarkup();
  if (current === 'rhythm') return `<div class="planner-choices">${choice('pace', 'calm', 'Никуда не спешить', 'Больше пауз, тишины и отдыха у воды', answers.pace === 'calm')}${choice('pace', 'balanced', 'Всего понемногу', 'Занятия чередуются со свободным временем', answers.pace === 'balanced')}${choice('pace', 'active', 'Больше впечатлений', 'Больше времени для занятий по интересам', answers.pace === 'active')}</div>`;
  if (current === 'lodging') return lodgingMarkup();
  if (current === 'outings') return outingsMarkup();
  if (current === 'routes') return `${quickEdit ? '<button type="button" class="planner-edit" data-change-outing-mode>Изменить занятия и поездки</button>' : ''}${routesMarkup()}`;
  if (current === 'services') return `<p class="planner-help">Помощник включит выбранные услуги в предварительное расписание.</p><div class="planner-service-options holiday-pick-grid">${services.map(item => `<div class="planner-service-option">${activityTiles([{ ...item, selected: answers.services.includes(item.id) }])}<div class="planner-service-time" data-service-time="${item.id}"${answers.services.includes(item.id) ? '' : ' hidden'}>${field(`preferred-${item.id}`, 'Предпочтительное время', 'time', answers.preferred[item.id])}</div></div>`).join('')}</div><p class="planner-note">Ресторан и баню можно согласовать с отелем из готового плана. Условия аренды мангальной зоны уточняются отдельно.</p>`;
  return `<p class="planner-help">Соберу дни без пересечений: оставлю время на дорогу, еду, сборы и свободные паузы. Если всё не поместится, покажу, что осталось за рамками программы.</p><dl class="planner-review">${summaryLines().map(([label, text, sub]) => `<div><dt>${esc(label)}</dt><dd>${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}</dd></div>`).join('')}</dl>
    <button type="button" class="planner-edit" data-edit-outings>Изменить занятия и поездки</button>
    <button type="button" class="planner-edit" data-edit-services>Изменить услуги</button>
    ${bookingCompact ? bookingEditButtons() : lodgingEditButton()}
    ${answers.children ? '<button type="button" class="planner-edit" data-edit-family>Изменить семейный отдых</button>' : ''}
    ${answers.children ? `<p class="planner-note">${familyModeNote()}</p>` : ''}`;
}

function capture() {
  const form = root.querySelector('form');
  if (!form) return;
  const data = new FormData(form);
  for (const key of ['startDate', 'endDate', 'arrival', 'departure', 'lodging', 'familyMode', 'pace', 'wake', 'rest', 'outingMode', 'origin']) if (data.has(key)) answers[key] = data.get(key);
  for (const key of ['adults', 'children']) if (data.has(key)) answers[key] = data.get(key) === '' ? NaN : Number(data.get(key));
  if (current === 'party' && bookingCompact && data.has('children')) {
    answers.adults = bookingHandoff.adults - answers.children;
    form.querySelector('[data-booked-adults]').textContent = Number.isInteger(answers.adults) && answers.adults > 0 ? answers.adults : '—';
  }
  if (current === 'party') answers.ages = Array.from({ length: Math.max(0, Math.min(10, answers.children || 0)) }, (_, i) => data.has(`age-${i}`) ? data.get(`age-${i}`) === '' ? '' : Number(data.get(`age-${i}`)) : answers.ages[i] ?? '');
  if (current === 'party') {
    answers.childActivities = data.getAll('childActivities').filter(id => childActivityChoices().some(item => item.id === id));
    if (!answers.children) answers.familyMode = 'together';
  }
  if (current === 'outings') {
    answers.interests = data.getAll('interests');
    answers.suggestActivities = data.has('suggestActivities') && !answers.interests.length;
  }
  if (current === 'routes') answers.places = data.getAll('places');
  if (current === 'services') answers.services = data.getAll('services');
  if (current === 'routes') {
    for (const { id } of attractions) {
      const value = name => data.get(outingField(id, name));
      answers.outings[id] = {
        transport: value('transport'),
        excursionDate: value('excursionDate'),
        excursionTime: value('excursionTime'),
      };
    }
  }
  for (const item of services) if (data.has(`preferred-${item.id}`)) answers.preferred[item.id] = data.get(`preferred-${item.id}`);
}

function renderRoutesPreview() {
  for (const card of root.querySelectorAll('[data-outing]')) {
    const place = attractions.find(item => item.id === card.dataset.outing);
    card.hidden = !answers.places.includes(place.id);
    if (card.hidden) continue;
    const settings = excursionSettings(answers, place.id);
    const { transport, excursionDate, excursionTime, travelMinutes, travelEstimateSource, visitMinutes } = settings;
    const total = outingDurationMinutes(settings);
    const duration = Number.isFinite(total) && total > 0
      ? [Math.floor(total / 60) && `${Math.floor(total / 60)} ч`, total % 60 && `${total % 60} мин`].filter(Boolean).join(' ')
      : '';
    const schedule = excursionDate || excursionTime
      ? [excursionDate ? dateLabel(excursionDate) : 'Подберём день', excursionTime && `около ${excursionTime}`].filter(Boolean).join(' · ')
      : 'Подберём день и время';
    card.querySelector('[data-outing-overview]').textContent = [
      `Дорога около ${travelMinutes} мин в одну сторону`,
      `на посещение заложено ${visitMinutes} мин`,
      duration && `около ${duration} на всю поездку с запасом`,
      schedule,
    ].filter(Boolean).join(' · ');
    card.querySelector('[data-outing-hint]').textContent = [
      outingTransports[transport].detail,
      travelEstimateSource === 'default-origin' ? 'Оценка рассчитана от Горетова. Для расчёта от своей точки укажите её координаты.' : '',
      transport === 'walk' && travelMinutes > 240 ? 'Пешком дорога займёт больше четырёх часов в одну сторону. Можно выбрать другой транспорт.' : '',
    ].filter(Boolean).join(' ');
    const label = transport === 'walk' ? 'Пеший маршрут' : 'Маршрут по дорогам';
    card.querySelector('[data-outing-route]').innerHTML = `<a href="${esc(mapRoute(place, transport, answers.origin))}" target="_blank" rel="noopener noreferrer">${label} в Яндекс Картах <span aria-hidden="true">↗</span></a>`;
  }
}

function openQuickEdit(step, source, placeId) {
  quickEdit = { source, placeId, returnStep: current, answers: structuredClone(answers) };
  current = step;
  renderQuestion();
  if (placeId) {
    const options = root.querySelector(`[data-outing="${placeId}"] .planner-options`);
    options.open = true;
    options.querySelector('summary').focus();
  }
}

function bindBookingEdits(scope, source) {
  for (const control of scope.querySelectorAll('[data-edit-booking]')) {
    control.addEventListener('click', () => {
      if (source !== 'result') capture();
      openQuickEdit(control.dataset.editBooking, source);
    });
  }
}

function clearOutingDatesOutsideStay() {
  for (const outing of Object.values(answers.outings)) {
    if (outing.excursionDate < answers.startDate || outing.excursionDate > answers.endDate) outing.excursionDate = '';
  }
}

function closeQuickEdit(cancelled) {
  const { source, placeId, returnStep, answers: previous } = quickEdit;
  const datesChanged = previous.startDate !== answers.startDate || previous.endDate !== answers.endDate;
  if (!cancelled && current === 'dates' && datesChanged && lodgingAvailabilityUrl && overnight()) {
    current = 'lodging';
    renderQuestion();
    return;
  }
  quickEdit = undefined;
  if (cancelled) Object.assign(answers, previous);
  else if (current === 'dates' || current === 'lodging') {
    if (datesChanged) {
      if (!overnight() || (Number.isFinite(guestCount()) && !lodgingChoice())) answers.lodging = '';
      clearOutingDatesOutsideStay();
    }
    bookingCompact = bookingCompact && Boolean(matchesBooking());
  }
  if (source === 'result') {
    if (!cancelled) rebuildPlan({ alreadyPlanned: true });
    const controlStillExists = placeId && plan.days.some(day => day.items.some(item => item.placeId === placeId));
    renderPlan({ scroll: !controlStillExists, message: cancelled ? '' : 'Расписание обновлено.' });
    if (controlStillExists) root.querySelector(`[data-edit-place="${CSS.escape(placeId)}"]`)?.focus();
  } else {
    current = source === 'question' ? returnStep : 'review';
    renderQuestion();
  }
}

function rebuildPlan({ alreadyPlanned = false } = {}) {
  if (plan && (plan.answers.startDate !== answers.startDate || plan.answers.endDate !== answers.endDate)) chatState = {};
  const base = buildHolidayPlan(structuredClone(answers), {
    priorityMeals, ...(alreadyPlanned ? {} : { today: today(), currentMinute: nowMinute() }),
  });
  const changedTrips = new Set((plan?.days || []).flatMap(day => day.items).filter(item => {
    if (!item.placeId) return false;
    const before = excursionSettings(plan.answers, item.placeId);
    const after = excursionSettings(answers, item.placeId);
    return before.excursionDate !== after.excursionDate || before.excursionTime !== after.excursionTime;
  }).map(item => item.id));
  planEdits = planEdits.filter(edit => edit.type !== 'move' || !changedTrips.has(edit.itemId));
  const result = replayScheduleEdits(base, planEdits);
  plan = result.plan;
  unappliedEdits = result.errors;
  const failed = new Set(unappliedEdits.map(({ edit }) => edit));
  planEdits = planEdits.filter(edit => !failed.has(edit));
  undoEdit = undefined;
}

function editOutings(source) {
  openQuickEdit('outings', source);
}

function continueLabel() {
  if (quickEdit && current === 'outings' && !stayingAtHotel()) return 'Выбрать места';
  if (quickEdit) return quickEdit.source === 'result' ? 'Пересчитать план' : 'Применить';
  if (current === 'review') return 'Показать 3 варианта';
  const sequence = steps();
  const next = sequence[sequence.indexOf(current) + 1];
  return {
    dates: 'Указать даты и гостей', party: 'Указать гостей', lodging: 'Выбрать размещение', rhythm: 'Выбрать ритм',
    outings: 'Выбрать занятия', routes: 'Настроить поездки', services: 'Выбрать услуги', review: 'Проверить программу',
  }[next] || 'Продолжить';
}

function showPlannerView(view, { focus = false, scroll = false } = {}) {
  const showChat = view === 'chat';
  document.body.classList.toggle('holiday-chat-open', showChat);
  planView.hidden = showChat;
  chatView.hidden = !showChat;
  for (const button of viewSwitch.querySelectorAll('[data-planner-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.plannerView === view));
  }
  if (showChat) chat?.show({ focus });
  else if (focus) root.querySelector('#planner-question, #planner-result-title')?.focus({ preventScroll: true });
  if (scroll) masthead.scrollIntoView({ block: 'start', behavior: 'auto' });
}

function guideDates() {
  if (!Number.isFinite(dateNumber(answers.startDate)) || !Number.isFinite(dateNumber(answers.endDate))) return [];
  const start = answers.startDate < today() ? today() : answers.startDate;
  const dates = [];
  for (let date = start; date <= answers.endDate && dates.length < 31; date = addDays(date, 1)) dates.push(date);
  return dates;
}

function renderAssistant(activePlan, { applyEdit, preparePdf } = {}) {
  chat = mountHolidayChat(chatView, {
    state: chatState,
    getPlan: () => activePlan,
    getClock: chatClock,
    getEvents: dates => loadHotelEvents(draftCity, dates, holidayApiBase),
    getGuideDates: activePlan ? undefined : guideDates,
    preparePdf,
    openPlanSection: id => {
      showPlannerView('plan');
      const target = document.getElementById(id);
      if (!target) return;
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'center' });
    },
    interpretMessage: activePlan && localBookingHost ? interpretChatMessage : undefined,
    applyEdit,
  });
}

function renderQuestion(focus = true) {
  releasePreparedPdf();
  setBoardHeading('pick');
  root.dataset.boardScreen = 'pick';
  showPlannerView('plan');
  renderAssistant();
  const sequence = steps(), index = sequence.indexOf(current);
  const history = previousSteps();
  const stickyActions = ['lodging', 'outings', 'routes', 'services', 'review'].includes(current);
  const title = current === 'outings' && !quickEdit ? 'Выберите фишки отдыха' : current === 'party'
    ? quickEdit ? 'Как проведём семейный отдых?' : bookingCompact ? 'Сколько из гостей — дети?' : questions.party
    : questions[current];
  root.innerHTML = `<div class="planner-layout">
    <section class="planner-conversation holiday-board-surface" aria-labelledby="planner-question">
      <div class="planner-step-header">
        ${!quickEdit ? '<button type="button" class="planner-edit" data-back-to-board>Вернуться к доске</button>' : ''}
        <div class="planner-progress">${quickEdit ? '<span>Настройка плана</span>' : `<span>Шаг ${index + 1} из <b data-step-count>${sequence.length}</b></span><progress value="${index + 1}" max="${sequence.length}" aria-label="Ход составления программы"></progress>`}</div>
      </div>
      <h2 id="planner-question" tabindex="-1">${title}</h2>
      <form id="holiday-questions" novalidate>
        <div class="planner-errors" role="alert" hidden></div>
        ${questionMarkup()}
        <div class="planner-question-actions${stickyActions ? ' planner-question-actions-sticky' : ''}">
          ${index > 0 || quickEdit ? `<button type="button" class="planner-button planner-button-light" data-back>${quickEdit ? 'Отмена' : 'Назад'}</button>` : ''}
          <button class="planner-button planner-next" type="submit"><span data-continue-label>${continueLabel()}</span> <span aria-hidden="true">→</span></button>
          ${!quickEdit && current === 'outings' ? `<button class="planner-button planner-button-light" type="submit" data-first-plan${canBuildFirstPlan() ? '' : ' hidden'}>Показать 3 варианта</button>` : ''}
        </div>
        ${current === 'rhythm' && overnight() ? `<details class="planner-options planner-rhythm-options"><summary>Настроить время начала дня и вечернего отдыха</summary><div class="planner-fields">${field('wake', 'Начало дня', 'time', answers.wake, 'required')}${field('rest', 'Вечерний отдых с', 'time', answers.rest, 'required')}</div></details>` : ''}
      </form>
      <details class="planner-step-summary${history.length ? ' has-history' : ''}">
        <summary><span class="planner-summary-desktop">Ваши предыдущие ответы</span><span class="planner-summary-mobile">${history.length ? 'Ваш отдых и ответы' : 'Ваш отдых'}</span></summary>
        <ol class="planner-summary-desktop">${history.map(step => `<li><span>${questions[step]}</span><p>${esc(answerLabel(step))}</p></li>`).join('')}</ol>
        <dl class="planner-summary-values planner-summary-mobile" data-trip-summary="history">${summaryValuesMarkup(true)}</dl>
      </details>
    </section>
    <aside class="planner-sidebar">
      <h2>Ваш отдых</h2>
      ${index === 0 ? '<img src="./images/mozhaysk-render-photos-20261106/panorama/exterior.jpg" width="1672" height="941" alt="Хаусбот с террасой на Можайском водохранилище"><p>В конце вы получите расписание, которое можно скачать в PDF.</p>' : ''}
      <dl class="planner-summary-values" data-trip-summary>${summaryValuesMarkup()}</dl>
    </aside>
  </div>`;
  root.querySelector('[data-back-to-board]')?.addEventListener('click', () => { capture(); persistDraft(); returnToBoard(); });
  const form = root.querySelector('form');
  const lodgingAvailability = mountLodgingAvailability(form);
  bindBookingEdits(form, current === 'review' ? 'review' : 'question');
  form.querySelector('[data-edit-outings]')?.addEventListener('click', () => editOutings('review'));
  form.querySelector('[data-edit-services]')?.addEventListener('click', () => openQuickEdit('services', 'review'));
  form.querySelector('[data-edit-family]')?.addEventListener('click', () => openQuickEdit('party', 'review'));
  form.querySelector('[data-change-outing-mode]')?.addEventListener('click', () => {
    capture();
    current = 'outings';
    renderQuestion();
  });
  const syncForm = () => {
    form.querySelectorAll('[data-service-time]').forEach(element => { element.hidden = !answers.services.includes(element.dataset.serviceTime); });
    form.querySelector('[data-continue-label]').textContent = continueLabel();
    const firstPlan = form.querySelector('[data-first-plan]');
    if (firstPlan) firstPlan.hidden = !canBuildFirstPlan();
    const interestCount = form.querySelector('[data-interest-count]');
    if (interestCount) {
      const label = interestCountLabel();
      if (interestCount.textContent !== label) interestCount.textContent = label;
      for (const input of form.querySelectorAll('[data-out-of-season] input')) {
        if (!input.checked && document.activeElement === input) input.closest('[data-out-of-season]').querySelector('h3').focus();
        input.disabled = !input.checked;
      }
    }
    const progress = root.querySelector('.planner-progress progress');
    if (progress) {
      progress.max = steps().length;
      root.querySelector('[data-step-count]').textContent = progress.max;
    }
    renderSummaryValues();
    renderRoutesPreview();
    lodgingAvailability?.updateStatus();
    persistDraft();
  };
  form.addEventListener('input', event => {
    const oldChildCount = answers.children;
    if (event.target.checked && event.target.name === 'suggestActivities') {
      for (const interest of form.querySelectorAll('[name="interests"]:checked')) interest.checked = false;
    } else if (event.target.checked && event.target.name === 'interests' && form.elements.suggestActivities) {
      form.elements.suggestActivities.checked = false;
    }
    capture();
    if (event.target.name === 'children' && !Object.is(oldChildCount, answers.children)) {
      document.getElementById('plan-children-details').hidden = !(answers.children > 0);
      document.getElementById('plan-ages').innerHTML = agesMarkup();
      if (!answers.children) form.querySelector('[name="familyMode"][value="together"]').checked = true;
    }
    if (event.target.name === 'children' || event.target.name.startsWith('age-')) {
      form.querySelector('[data-child-activities]').innerHTML = childActivityMarkup();
    }
    if (event.target.name === 'startDate') {
      const endDate = form.elements.endDate;
      endDate.min = answers.startDate;
      if (answers.endDate < answers.startDate) endDate.value = answers.endDate = answers.startDate;
    }
    syncForm();
  });
  form.addEventListener('change', () => {
    capture();
    syncForm();
  });
  form.querySelector('[data-back]')?.addEventListener('click', () => {
    if (quickEdit) closeQuickEdit(true);
    else { capture(); current = sequence[index - 1]; renderQuestion(); }
  });
  form.addEventListener('submit', event => {
    event.preventDefault(); capture();
    const firstPlan = event.submitter?.hasAttribute('data-first-plan') && canBuildFirstPlan();
    const generatingPlan = current === 'review' || firstPlan;
    const allErrors = validateAnswers(answers, today(), nowMinute());
    if (answers.lodging && !lodgingChoice() && overnight() && (current === 'lodging' || generatingPlan)) {
      allErrors.lodging = 'Выберите размещение, подходящее по вместимости, или вернитесь к выбору позже.';
    }
    const availabilityError = lodgingAvailability?.error();
    if (availabilityError) allErrors.lodging = availabilityError;
    const errors = Object.entries(allErrors).filter(([name]) => generatingPlan
      || stepFields[current].includes(name) || (current === 'routes' && name.startsWith('outing-')));
    if (errors.length) {
      persistDraft();
      for (const [name] of errors) {
        const options = form.elements[name]?.closest?.('details') || (name === 'childActivities' && form.querySelector('[data-child-options]'));
        if (options) options.open = true;
      }
      const container = form.querySelector('.planner-errors');
      container.innerHTML = `<p>Уточним несколько деталей:</p><ul>${errors.map(([, text]) => `<li>${esc(text)}</li>`).join('')}</ul>`;
      container.hidden = false; container.tabIndex = -1; container.focus();
      return;
    }
    if (!quickEdit && current === 'dates') clearOutingDatesOutsideStay();
    if (current === 'party' && !lodgingChoice()) answers.lodging = '';
    if (quickEdit) {
      if (current === 'outings' && !stayingAtHotel()) { current = 'routes'; renderQuestion(); }
      else closeQuickEdit(false);
      return;
    }
    if (generatingPlan) {
      renderAlternatives();
    } else { current = steps()[steps().indexOf(current) + 1]; renderQuestion(); }
  });
  renderRoutesPreview();
  if (focus) persistDraft();
  if (focus) root.querySelector('#planner-question').focus({ preventScroll: true });
  if (focus) root.scrollIntoView({ block: 'start', behavior: 'auto' });
}

function pageLink(item, day) {
  if (!item.page) return '';
  const url = new URL(item.page, location.href);
  url.searchParams.set('city', 'mozhaysk');
  if (['banya', 'restaurant'].includes(item.service)) {
    url.searchParams.set('from', 'holiday-plan'); url.searchParams.set('date', day.date);
    url.searchParams.set('time', clock(item.start)); url.searchParams.set('guests', answers.adults + answers.children);
    url.hash = 'reservation';
  }
  const text = item.service === 'barbecue' ? 'Уточнить мангальную зону' : item.service ? 'Проверить время отдельно' : 'Подробнее о занятии';
  return `<a href="${esc(url.href)}">${text} <span aria-hidden="true">↗</span></a>`;
}

function timeRange(item) {
  return `${clock(item.start)}${item.end > item.start ? `–${clock(item.end)}` : ''}`;
}

function eventLinks(item, day) {
  const routeLabel = item.routeLabel || 'Маршрут на карте';
  return `<div class="planner-event-links">
    ${item.route ? `<a href="${esc(item.route)}" target="_blank" rel="noopener noreferrer">${esc(routeLabel)} ↗</a>` : ''}
    ${item.source ? `<a href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">Условия посещения ↗</a>` : ''}
    ${pageLink(item, day)}
    ${['lunch', 'dinner'].includes(item.meal) ? pageLink({ ...item, page: 'restaurant.html', service: 'restaurant' }, day).replace('Проверить время отдельно', 'Запросить столик') : ''}
    ${item.placeId && !stayingAtHotel() && answers.places.includes(item.placeId) ? `<button type="button" class="planner-event-edit" data-edit-place="${esc(item.placeId)}">Настройки поездки</button>` : ''}
  </div>`;
}

const itemActions = { move: 'Перенести', replace: 'Заменить', remove: 'Убрать' };

function undoMarkup() {
  return `<div class="planner-item-feedback">
    <p role="status">${esc(undoEdit.message)}</p>
    <button type="button" class="planner-edit" data-undo-item>Отменить последнюю правку</button>
  </div>`;
}

function eventMarkup(item, day, index) {
  const quiet = ['free', 'rest'].includes(item.kind) ? ' planner-event-quiet' : '';
  const editorId = `planner-editor-${day.date}-${index}`;
  const addable = item.kind === 'free' && item.end - item.start >= 30;
  const editable = canEditScheduleItem(item);
  const hotelEvent = item.kind === 'hotel-event';
  const trackable = isBoardActivity(item);
  const marked = trackable && marks.has(boardMark(item, plan.answers));
  const icon = item.interest || item.service || item.meal || item.kind;
  const photo = boardPhoto(icon);
  const title = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин' }[item.meal] || item.title;
  const detailId = `board-detail-${day.date}-${index}`;
  const canLocate = hasBoardLocation(item);
  return `<li class="planner-event${quiet}"${item.id ? ` data-schedule-id="${esc(item.id)}"` : ''}${addable ? ` data-free-start="${item.start}"` : item.kind === 'free' ? ' data-transition' : ''}${canMoveScheduleItem(item) ? ' data-board-movable' : ''}${marked ? ' data-done' : ''}>
    <time>${clock(item.start)}${item.end > item.start ? `<span>— ${clock(item.end)}</span>` : ''}</time>
    <div>
      ${item.kind !== 'free' ? `<div class="holiday-event-header">
        ${photo ? `<img class="holiday-event-photo" src="${photo}" width="138" height="56" alt="" draggable="false">` : `<span class="holiday-event-symbol">${boardIcon(icon)}</span>`}
        <div class="holiday-event-label">
          <h4 tabindex="-1">${esc(title)}</h4>
          ${item.confirmation ? '<span class="holiday-event-confirm">Уточнить время и условия</span>' : ''}
          ${item.kind === 'parallel' ? `<span class="holiday-parallel-summary">${[...item.tracks].reverse().map(track => `<span><strong>${esc(track.audience)}</strong> · ${esc(track.title)}</span>`).join('')}</span>` : ''}
          ${trackable ? `<span class="holiday-event-done"${marked ? '' : ' hidden'}>Выполнено</span>` : ''}
        </div>
        <div class="holiday-row-actions">
          <button type="button" class="holiday-row-toggle" data-board-details aria-expanded="false" aria-controls="${detailId}" aria-label="Действия и подробности — ${esc(title)}">${boardIcon('grip')}</button>
          ${editable ? `<button type="button" class="holiday-row-remove" data-item-action="remove" aria-label="Удалить — ${esc(title)}" title="Удалить">${boardIcon('trash')}</button>` : ''}
        </div>
      </div><div class="holiday-event-detail" id="${detailId}" hidden>
      ${hotelEvent ? `<p class="planner-eyebrow">${esc(hotelEventLabels[item.eventType])}</p>` : ''}
      ${item.location ? `<p><strong>${esc(item.location)}</strong></p>` : ''}
      ${item.detail ? `<p>${esc(item.detail)}</p>` : ''}
      ${item.tracks?.length ? `<div class="planner-tracks">
        ${item.tracks.map(track => `<div>
          <span>${esc(track.audience)} · ${timeRange(track)}</span>
          <h5>${esc(track.title)}</h5>
          <p>${esc(track.detail)}</p>
          ${eventLinks(track, day)}
        </div>`).join('')}
      </div>` : ''}
      ${item.fallback ? `<p class="planner-fallback"><strong>Если планы изменятся</strong> ${esc(item.fallback)}</p>` : ''}
      ${eventLinks(item, day)}
      ${trackable || canLocate ? `<div class="holiday-event-action-row">
        ${canLocate ? '<button type="button" class="planner-event-edit" data-board-locate>На карте</button>' : ''}
        ${trackable ? `<button type="button" class="planner-event-edit holiday-mark" data-board-mark aria-pressed="${marked}">${marked ? 'Выполнено' : 'Отметить выполненным'}</button>` : ''}
      </div>` : ''}
      ${editable ? `<div class="planner-event-actions" role="group" aria-label="Действия для занятия «${esc(item.title)}»">
        ${canMoveScheduleItem(item) ? '<button type="button" class="planner-button" data-board-pick-move>Перенести</button>' : ''}
        ${Object.entries(itemActions).filter(([type]) => !hotelEvent || type === 'remove').map(([type, label]) => `<button type="button" class="planner-button planner-button-light" data-item-action="${type}"${type === 'remove' ? '' : ` aria-expanded="false" aria-controls="${editorId}"`}>${type === 'move' ? 'Указать точное время' : label}</button>`).join('')}
      </div>` : ''}
      </div>` : addable ? `<button type="button" class="holiday-slot-add" data-item-action="add" aria-expanded="false" aria-controls="${editorId}">${boardIcon('plus')} <span>Добавить занятие</span></button>` : `<span class="holiday-transition-label">${esc(item.title)}</span>`}
      ${editable || addable ? `<div id="${editorId}" class="planner-item-editor" hidden></div>` : ''}
      ${undoEdit && undoEdit.type !== 'remove' && undoEdit.itemId === item.id ? undoMarkup() : ''}
    </div>
  </li>`;
}

function focusSchedule(itemId, date) {
  revealBoardDay(date, 'schedule');
  const item = itemId && root.querySelector(`[data-schedule-id="${CSS.escape(itemId)}"] h4`);
  const target = item || root.querySelector(`[data-schedule-date="${CSS.escape(date)}"] h3`) || root.querySelector('#planner-result-title');
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'nearest' });
}

function saveItemEdit(edit, date, { focus = true } = {}) {
  const result = applyScheduleEdit(plan, edit);
  if (result.error) return result.error;
  const messages = {
    add: 'Занятие добавлено.',
    'hotel-event': 'Мероприятие добавлено в план.',
    move: 'Занятие перенесено.',
    replace: 'Занятие заменено.',
    remove: 'Занятие убрано. Это время свободно.',
  };
  undoEdit = { plan, itemId: edit.itemId, date, type: edit.type, message: messages[edit.type] };
  plan = result.plan;
  planEdits.push(edit);
  renderPlan({ scroll: false });
  if (focus && edit.type === 'remove') {
    root.querySelector('.planner-day:not([hidden]) [data-undo-item]')?.focus();
  } else if (focus) focusSchedule(edit.itemId, edit.date || date);
}

function chatClock() {
  const now = new Date();
  const { hour, minute } = destinationDateParts(now, draftCity);
  return { date: destinationLocalDate(now, draftCity), minute: Number(hour) * 60 + Number(minute) };
}

async function interpretChatMessage(message) {
  try {
    const response = await fetch(new URL('chat-interpret', holidayApiBase), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) return null;
    const { command } = await response.json();
    return typeof command === 'string' && command.length <= 300 ? command : null;
  } catch {
    return null;
  }
}

function closeItemEditor(restoreFocus = false) {
  if (!itemEditor) return;
  const { panel, button } = itemEditor;
  panel.replaceChildren();
  panel.hidden = true;
  button.setAttribute('aria-expanded', 'false');
  root.querySelector('[data-pdf]').disabled = Boolean(pdfPreparation);
  if (restoreFocus) button.focus();
  itemEditor = undefined;
}

function openItemEditor(button, item, day) {
  const alreadyOpen = itemEditor?.button === button;
  closeItemEditor();
  if (alreadyOpen) return;
  const type = button.dataset.itemAction;
  const panel = document.getElementById(button.getAttribute('aria-controls'));
  const adding = type === 'add';
  const choosing = adding || type === 'replace';
  const title = adding ? 'Добавить занятие' : `${itemActions[type]} «${item.title}»`;
  const duration = item.end - item.start;
  const gap = adding ? { windowStart: item.start, windowEnd: item.end } : undefined;
  panel.innerHTML = `<form aria-label="${esc(title)}" novalidate>
    <h5>${esc(title)}</h5>
    <div class="planner-errors" role="alert" tabindex="-1" hidden></div>
    <p>${adding ? `Свободное время ${timeRange(item)} · ${duration} мин. Выберите занятие или добавьте своё.`
      : choosing ? 'Выберите занятие из списка или добавьте своё.' : `Длительность занятия — ${duration} мин.`}</p>
    <div class="planner-fields">
      ${adding ? '' : `<div class="planner-field"><label for="plan-item-date">День</label>
        <select id="plan-item-date" name="date">${plan.days.map(candidate => `<option value="${esc(candidate.date)}"${candidate.date === day.date ? ' selected' : ''}>${esc(dateLabel(candidate.date))}</option>`).join('')}</select>
      </div>`}
      ${field('item-time', 'Начало', 'time', clock(item.start), 'required')}
    </div>
    ${choosing ? `<div class="planner-field"><label for="plan-item-replacement">Новое занятие</label><select id="plan-item-replacement" name="replacement" required></select></div>
      <div class="planner-fields" data-custom-activity hidden>
        ${field('item-title', 'Название', 'text', '', 'maxlength="100" required')}
        ${field('item-duration', 'Длительность, мин', 'number', adding ? Math.min(30, duration) : duration, `min="1" step="1" required${adding ? ` max="${duration}"` : ''}`)}
      </div>` : ''}
    <div class="planner-item-editor-actions">
      <button type="submit" class="planner-button">Сохранить</button>
      <button type="button" class="planner-button planner-button-light" data-cancel-item>Отмена</button>
    </div>
  </form>`;
  panel.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  root.querySelector('[data-pdf]').disabled = true;
  itemEditor = { panel, button };
  const form = panel.querySelector('form');
  const alert = form.querySelector('.planner-errors');
  form.addEventListener('input', () => { alert.hidden = true; });
  if (choosing) {
    const date = form.elements.date;
    const replacement = form.elements.replacement;
    const custom = panel.querySelector('[data-custom-activity]');
    function showCustomFields() {
      custom.hidden = replacement.value !== 'custom';
      for (const input of custom.querySelectorAll('input')) input.disabled = custom.hidden;
    }
    function renderOptions() {
      const selected = replacement.value;
      const options = scheduleReplacementOptions(plan, adding ? day.date : date.value, gap);
      replacement.innerHTML = '<option value="">Выберите занятие</option>' + options.map(option =>
        `<option value="${esc(option.id)}">${esc(option.title)}${option.id !== 'custom' ? ` · ${option.duration} мин` : ''}</option>`
      ).join('');
      if (options.some(option => option.id === selected)) replacement.value = selected;
      showCustomFields();
    }
    date?.addEventListener('change', renderOptions);
    replacement.addEventListener('change', showCustomFields);
    renderOptions();
  }
  panel.querySelector('[data-cancel-item]').addEventListener('click', () => closeItemEditor(true));
  form.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeItemEditor(true); }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const edit = {
      type, itemId: adding ? `added:${crypto.randomUUID()}` : item.id,
      itemTitle: adding ? form.elements.replacement.selectedOptions[0]?.textContent : item.title,
      date: adding ? day.date : data.get('date'), time: data.get('item-time'),
      ...(choosing ? { replacementId: data.get('replacement'), title: data.get('item-title'), duration: Number(data.get('item-duration')) } : {}),
      ...gap,
    };
    if (adding && edit.replacementId === 'custom') edit.itemTitle = edit.title;
    const error = saveItemEdit(edit, day.date);
    if (!error) return;
    alert.textContent = error;
    alert.hidden = false;
    alert.focus();
  });
  (adding ? form.elements['item-time'] : form.elements.date).focus();
}

function lodgingResult() {
  const lodging = lodgingChoice();
  if (!lodging) return '';
  const booked = isBookedLodging(lodging.id);
  const local = !booked && localBookingHost;
  const bookingUrl = new URL(lodging.bookingHref);
  if (!booked && !local) {
    bookingUrl.hash = new URLSearchParams({
      plan: '1', checkIn: answers.startDate, checkOut: answers.endDate, roomId: lodging.id, guests: String(guestCount()),
    }).toString();
  }
  return `<section class="planner-lodging-result" aria-label="Выбранное размещение">
    <div><p class="planner-eyebrow">Выбранное размещение</p><strong>${esc(lodging.label)}</strong><p${local ? ' data-plan-booking-status role="status"' : ''}>${booked ? 'Категория перенесена из бронирования' : `До ${lodging.capacity} гостей · доступность проверяется отдельно`}</p></div>
    <div class="planner-lodging-links">
      <a href="${esc(lodging.detailsHref)}" target="_blank" rel="noopener">О хаусботе ↗</a>
      ${local ? '<button type="button" class="planner-edit" data-plan-booking hidden>Перейти к бронированию</button>'
        : booked ? '' : `<a href="${esc(bookingUrl.href)}" target="_blank" rel="noopener">Перейти к бронированию ↗</a>`}
    </div>
  </section>`;
}

async function mountPlanBooking() {
  const button = root.querySelector('[data-plan-booking]');
  if (!button) return;
  const status = root.querySelector('[data-plan-booking-status]');
  const lodging = lodgingChoice();
  bookingConfigRequest ??= fetch('/api/local-booking/config', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : null)
    .catch(() => null)
    .finally(() => { bookingConfigRequest = undefined; });
  const config = await bookingConfigRequest;
  if (!button.isConnected) return;
  if (config?.mode !== 'local-demo' || !Array.isArray(config.roomCategories)) {
    status.textContent = 'Локальный календарь бронирования сейчас недоступен.';
    return;
  }
  if (answers.startDate < today()) {
    status.textContent = 'Дата приезда уже прошла. Для бронирования выберите новые даты в плане.';
    return;
  }
  const capacity = config.roomCapacities?.[draftCity]?.[lodging.id];
  if (!config.roomCategories.some(room => room?.id === lodging.id) || !Number.isInteger(capacity) || capacity < 1) {
    status.textContent = 'Эта категория недоступна в локальном бронировании.';
    return;
  }
  if (capacity < guestCount()) {
    status.textContent = `Для этой категории в локальном бронировании доступно до ${capacity} гостей.`;
    return;
  }
  button.hidden = false;
  status.textContent = 'Даты, хаусбот и число гостей перенесём в бронирование.';
  button.addEventListener('click', () => {
    if (!persistDraft(true)) {
      status.textContent = 'Браузер не смог сохранить программу. Она остаётся открытой на этой странице.';
      return;
    }
    try {
      const token = crypto.randomUUID();
      const { startDate: checkIn, endDate: checkOut } = answers;
      const scope = draftScope === bookingScope ? { bookingToken } : {};
      sessionStorage.setItem(`amore-holiday-plan-to-booking:${token}`, JSON.stringify({
        city: draftCity, checkIn, checkOut, roomId: lodging.id, guests: guestCount(), ...scope,
      }));
      const url = new URL(lodging.bookingHref);
      url.searchParams.set('plan', token);
      location.assign(url.href);
    } catch {
      status.textContent = 'Не удалось перенести данные в бронирование. Программа остаётся открытой.';
    }
  });
}

function releasePreparedPdf() {
  preparedPdf?.release();
  preparedPdf = undefined;
  pdfPreparation = undefined;
}

function setBoardHeading(tab) {
  document.body.dataset.holidayView = tab;
  const title = { map: 'Карта отдыха', badges: 'Достижения', pick: 'Подбор отдыха', family: 'Раздельный отдых' }[tab] || 'План отдыха';
  masthead.querySelector('h1').textContent = title;
  document.title = `${title} — A’MORE Collection`;
}

function revealBoardDay(date, tab = boardTab) {
  const day = plan.days.find(item => item.date === date) || plan.days[0];
  if (!day || root.dataset.boardScreen !== 'board') return;
  selectedDay = day.date;
  boardTab = tab;
  setBoardHeading(tab);
  const dayTabs = root.querySelector('.holiday-day-tabs');
  if (dayTabs) {
    dayTabs.hidden = tab === 'badges';
    const active = dayTabs.querySelector(`[data-board-day="${day.date}"]`);
    root.querySelector('#holiday-day-content').setAttribute('aria-labelledby', active.id);
    for (const button of dayTabs.querySelectorAll('[data-board-day]')) {
      button.tabIndex = button === active ? 0 : -1;
      button.setAttribute('aria-selected', String(button === active));
    }
    if (!dayTabs.hidden) {
      const offset = active.offsetLeft - dayTabs.scrollLeft;
      if (offset < 0) dayTabs.scrollLeft += offset - 4;
      else if (offset + active.offsetWidth > dayTabs.clientWidth) dayTabs.scrollLeft += offset + active.offsetWidth - dayTabs.clientWidth + 4;
    }
  }
  root.querySelector('#holiday-day-content').hidden = tab === 'badges';
  for (const button of root.querySelectorAll('.holiday-board-tabs [data-board-tab]')) button.setAttribute('aria-pressed', String(button.dataset.boardTab === tab));
  for (const pane of root.querySelectorAll('[data-board-pane]')) pane.hidden = pane.dataset.boardPane !== tab;
  for (const article of root.querySelectorAll('[data-schedule-date]')) article.hidden = article.dataset.scheduleDate !== day.date;
  if (tab === 'schedule') {
    const palette = root.querySelector('[data-board-palette]');
    if (palette.dataset.date !== day.date) {
      palette.dataset.date = day.date;
      palette.innerHTML = boardPalette(scheduleReplacementOptions(plan, day.date));
    }
    const confirmations = day.items.filter(item => item.confirmation);
    const meal = day.items.find(item => item.meal === 'dinner') || day.items.find(item => item.meal === 'lunch');
    root.querySelector('[data-board-confirmations]').innerHTML = `<ul>${confirmations.map(item => `<li>${boardIcon(item.interest || item.service || item.kind)}<div><strong>${esc(item.title)}</strong><small>${timeRange(item)} · ${esc(item.confirmation)}</small>${item.interest === 'bike' ? '<a href="./contacts.html?city=mozhaysk">Согласовать маршрут</a>' : pageLink(item, day)}</div></li>`).join('')}
      ${meal && !confirmations.some(item => item.service === 'restaurant') ? `<li>${boardIcon('restaurant')}<div><strong>Столик на ${meal.meal === 'dinner' ? 'ужин' : 'обед'}</strong>${pageLink({ ...meal, page: 'restaurant.html', service: 'restaurant' }, day).replace('Проверить время отдельно', 'Запросить столик')}</div></li>` : ''}</ul>`;
  }
  if (tab === 'badges') root.querySelector('[data-board-badges]').innerHTML = badgesMarkup(plan, marks);
  if (tab === 'map') {
    const lodging = lodgingOptions().find(room => room.id === answers.lodging)?.label;
    mountBoardMap(root.querySelector('[data-board-pane="map"]'), {
      plan, day, lodging, marks, localDate: today(), localMinute: nowMinute(), selectedId: selectedMapItem,
    });
  }
}

function bindBoard(date) {
  const result = root.querySelector('.planner-result');
  const feedback = result.querySelector('.planner-feedback');
  const schedule = result.querySelector('[data-board-pane="schedule"]');
  const timeline = schedule.querySelector('.holiday-timeline');
  const dayHeight = new ResizeObserver(() => {
    if (!schedule.isConnected) dayHeight.disconnect();
    else if (timeline.offsetHeight) schedule.style.setProperty('--holiday-day-height', `${timeline.offsetHeight}px`);
  });
  dayHeight.observe(timeline);
  let placement, drag, gesture, ghost, frame, ignoreClickUntil = 0;
  const activeDay = () => plan.days.find(day => day.date === selectedDay);
  const windowOf = item => ({ windowStart: item.start, windowEnd: item.end });
  const rowFor = button => button.closest('.planner-event');
  const itemFor = (day, row) => day.items.find(item => item.id === row.dataset.scheduleId);
  const gapFor = (day, row) => day.items.find(item => item.kind === 'free' && item.start === Number(row.dataset.freeStart));

  function editFor(selection, day, gap) {
    const time = clock(gap.start);
    return selection.id
      ? { type: 'add', itemId: 'added:preview', replacementId: selection.id, itemTitle: selection.title, date: day.date, time, ...windowOf(gap) }
      : { type: 'move', itemId: selection.itemId, itemTitle: selection.title, date: day.date, time };
  }

  function fit(selection, day, gap) {
    if (selection.id) return scheduleReplacementOptions(plan, day.date, windowOf(gap)).some(item => item.id === selection.id);
    return !applyScheduleEdit(plan, editFor(selection, day, gap)).error;
  }

  function refreshTargets() {
    const day = activeDay();
    const selection = drag || placement;
    let first;
    for (const row of schedule.querySelectorAll('[data-free-start]')) {
      const active = row.closest('[data-schedule-date]').dataset.scheduleDate === day.date;
      const allowed = Boolean(selection && active && fit(selection, day, gapFor(day, row)));
      row.toggleAttribute('data-drop-allowed', allowed);
      const button = row.querySelector('[data-item-action="add"]');
      button.disabled = Boolean(selection && !allowed);
      button.querySelector('span').textContent = allowed ? (selection.id ? 'Добавить сюда' : 'Перенести сюда') : 'Добавить занятие';
      if (allowed && !first) first = button;
    }
    for (const tile of schedule.querySelectorAll('[data-board-add]')) tile.setAttribute('aria-pressed', String(!tile.disabled && tile.dataset.boardAdd === selection?.id));
    schedule.toggleAttribute('data-placing', Boolean(selection));
    const cancel = result.querySelector('[data-board-cancel-placement]');
    cancel.hidden = !placement;
    return first;
  }

  function startPlacement(selection) {
    closeItemEditor();
    placement = selection;
    const first = refreshTargets();
    describePlacement(first);
    if (first) {
      first.focus({ preventScroll: true });
      first.scrollIntoView({ block: 'nearest' });
    }
  }

  function describePlacement(first) {
    feedback.textContent = first ? `Выберите свободное окно для «${placement.title}».`
      : 'В этот день нет подходящего окна. Выберите другой день или освободите время.';
  }

  function commit(selection, day, gap) {
    const edit = editFor(selection, day, gap);
    if (edit.type === 'add') edit.itemId = `added:${crypto.randomUUID()}`;
    const error = saveItemEdit(edit, day.date);
    if (error) {
      feedback.textContent = error;
      refreshTargets();
    }
  }

  function switchDay(nextDate, tab = boardTab) {
    closeItemEditor();
    selectedMapItem = undefined;
    revealBoardDay(nextDate, tab);
    const first = refreshTargets();
    if (placement && tab === 'schedule') describePlacement(first);
    else feedback.textContent = '';
  }

  result.addEventListener('click', event => {
    if (event.detail && performance.now() < ignoreClickUntil) return;
    const button = event.target.closest('button');
    if (!button) return;
    const day = activeDay();
    const row = rowFor(button);
    const item = row && itemFor(day, row);
    if (button.hasAttribute('data-board-auto')) return openAutomatic();
    if (button.hasAttribute('data-board-choose-room')) return openQuickEdit('lodging', 'result');
    if (button.dataset.boardTab) return switchDay(selectedDay, button.dataset.boardTab);
    if (button.dataset.boardDay && button.dataset.boardDay !== selectedDay) return switchDay(button.dataset.boardDay);
    if (button.hasAttribute('data-board-cancel-placement')) {
      const activeTile = schedule.querySelector('[data-board-add][aria-pressed="true"]');
      placement = undefined;
      feedback.textContent = '';
      refreshTargets();
      (activeTile || result.querySelector('[data-board-tab="schedule"]')).focus();
      return;
    }
    if (button.dataset.boardAdd || button.dataset.mapAdd) {
      const id = button.dataset.boardAdd || button.dataset.mapAdd;
      if (boardTab === 'map') switchDay(selectedDay, 'schedule');
      return startPlacement({ id, title: button.dataset.tileTitle });
    }
    if (button.dataset.mapScheduleItem) return focusSchedule(button.dataset.mapScheduleItem, day.date);
    if (button.hasAttribute('data-board-details')) {
      const detail = document.getElementById(button.getAttribute('aria-controls'));
      const close = !detail.hidden;
      if (close) closeItemEditor();
      detail.hidden = close;
      button.setAttribute('aria-expanded', String(!close));
      return;
    }
    if (button.hasAttribute('data-board-pick-move')) {
      return startPlacement({ itemId: item.id, title: item.title });
    }
    if (button.dataset.itemAction) {
      const type = button.dataset.itemAction;
      if (type === 'add') {
        const gap = gapFor(day, row);
        return placement ? commit(placement, day, gap) : openItemEditor(button, gap, day);
      }
      if (!item) return;
      if (type === 'remove') {
        const error = saveItemEdit({ type: 'remove', itemId: item.id, itemTitle: item.title }, day.date);
        if (error) feedback.textContent = error;
      } else openItemEditor(button, item, day);
      return;
    }
    if (!item) return;
    if (button.hasAttribute('data-board-locate')) {
      selectedMapItem = item.id;
      revealBoardDay(selectedDay, 'map');
      const mapHeading = result.querySelector('#holiday-map-title');
      mapHeading.tabIndex = -1;
      mapHeading.focus();
    }
    if (button.hasAttribute('data-board-mark')) {
      const mark = boardMark(item, plan.answers);
      const completed = !marks.delete(mark);
      if (completed) marks.add(mark);
      button.setAttribute('aria-pressed', String(completed));
      button.textContent = completed ? 'Выполнено' : 'Отметить выполненным';
      row.toggleAttribute('data-done', completed);
      row.querySelector('.holiday-event-done').hidden = !completed;
      feedback.textContent = completed ? `${item.title} — выполнено.` : 'Отметка о выполнении снята.';
      persistDraft(true);
    }
  });
  const dayTabs = [...result.querySelectorAll('[data-board-day]')];
  result.querySelector('.holiday-day-tabs')?.addEventListener('keydown', event => {
    const index = dayTabs.indexOf(event.target);
    if (index < 0) return;
    const last = dayTabs.length - 1;
    const next = { ArrowLeft: index > 0 ? index - 1 : last, ArrowRight: index < last ? index + 1 : 0, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    switchDay(dayTabs[next].dataset.boardDay);
    dayTabs[next].focus({ preventScroll: true });
  });
  result.addEventListener('keydown', event => {
    if (event.key === 'Escape' && placement && !itemEditor) result.querySelector('[data-board-cancel-placement]').click();
  });
  schedule.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest('a, input, select, textarea, .holiday-event-detail, .holiday-row-remove')) return;
    const tile = event.target.closest('[data-board-add]');
    const row = event.target.closest('[data-board-movable]');
    if (!tile && !row) return;
    if (event.pointerType === 'touch' && row && !event.target.closest('[data-board-details]')) return;
    const item = row && itemFor(activeDay(), row);
    const selection = tile ? { id: tile.dataset.boardAdd, title: tile.dataset.tileTitle } : { itemId: item.id, title: item.title };
    gesture = { source: tile || row, selection, pointer: event.pointerId, x: event.clientX, y: event.clientY };
  });
  function positionGhost(clientX, clientY) {
    ghost.style.transform = `translate(${clientX + 13}px, ${clientY + 12}px)`;
    for (const row of schedule.querySelectorAll('[data-drag-over]')) row.removeAttribute('data-drag-over');
    document.elementFromPoint(clientX, clientY)?.closest('[data-drop-allowed]')?.setAttribute('data-drag-over', '');
  }
  function scrollAtEdge() {
    if (!gesture || !drag) return;
    const delta = gesture.y < 65 ? -11 : gesture.y > window.innerHeight - 65 ? 11 : 0;
    if (delta) {
      window.scrollBy(0, delta);
      positionGhost(gesture.x, gesture.y);
    }
    frame = requestAnimationFrame(scrollAtEdge);
  }
  schedule.addEventListener('pointermove', event => {
    if (gesture?.pointer !== event.pointerId) return;
    if (!drag) {
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 8) return;
      schedule.setPointerCapture(event.pointerId);
      drag = gesture.selection;
      placement = undefined;
      closeItemEditor();
      ghost = document.createElement('div');
      ghost.className = 'holiday-drag-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      ghost.textContent = drag.title;
      document.body.append(ghost);
      gesture.source.setAttribute('data-being-dragged', '');
      refreshTargets();
      frame = requestAnimationFrame(scrollAtEdge);
    }
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    positionGhost(gesture.x, gesture.y);
  });
  function finishGesture(event) {
    if (gesture?.pointer !== event.pointerId) return;
    const source = gesture.source;
    gesture = undefined;
    if (!drag) return;
    const target = event.type === 'pointerup' && document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-drop-allowed]');
    const selection = drag;
    drag = undefined;
    ignoreClickUntil = performance.now() + 180;
    source.removeAttribute('data-being-dragged');
    for (const row of schedule.querySelectorAll('[data-drag-over]')) row.removeAttribute('data-drag-over');
    ghost.remove();
    cancelAnimationFrame(frame);
    if (schedule.hasPointerCapture(event.pointerId)) schedule.releasePointerCapture(event.pointerId);
    if (target) {
      const day = activeDay();
      commit(selection, day, gapFor(day, target));
    } else refreshTargets();
  }
  schedule.addEventListener('pointerup', finishGesture);
  schedule.addEventListener('pointercancel', finishGesture);
  schedule.addEventListener('pointerleave', () => { if (!drag) gesture = undefined; });
  revealBoardDay(date);
}

function renderPlan({ scroll = true, message = '', save = true } = {}) {
  releasePreparedPdf();
  root.dataset.boardScreen = 'board';
  itemEditor = undefined;
  if (save) persistDraft(true);
  const lodging = lodgingLabel();
  const text = planToText(plan, { lodging });
  const hasExcursions = plan.days.some(day => day.items.some(item => item.kind === 'excursion'));
  const format = !stayingAtHotel() && !hasExcursions ? 'Без выездов к достопримечательностям' : outingModeLabel();
  const activeDay = plan.days.find(day => day.date === selectedDay) || plan.days[0];
  root.innerHTML = `<section class="planner-result" aria-labelledby="planner-result-title">
    <h2 id="planner-result-title" class="planner-sr-only" tabindex="-1">Ваш план</h2>
    <div class="holiday-placement-status">
      <p class="planner-feedback" role="status">${esc(message)}</p>
      <button type="button" class="planner-edit" data-board-cancel-placement hidden>Отменить выбор фишки</button>
    </div>
    <p class="planner-feedback" data-pdf-ready hidden><a data-pdf-link>Скачать готовый PDF</a></p>
    <div class="holiday-board-toolbar">
      <div class="holiday-board-tabs" role="group" aria-label="Разделы доски">
        <button type="button" data-board-tab="schedule" aria-controls="holiday-board-schedule">Расписание</button>
        <button type="button" data-board-tab="map" aria-controls="holiday-board-map">${boardIcon('map')}Карта</button>
        <button type="button" data-board-tab="badges" aria-controls="holiday-board-badges">${boardIcon('achievement')}Достижения</button>
      </div>
      <div class="holiday-board-top-actions">
        <button type="button" class="planner-button holiday-primary" data-board-auto>Спланируй отдых за меня</button>
        <div class="holiday-trip-controls">
          <button type="button" class="planner-button planner-button-light" data-edit>Изменить даты</button>
          <button type="button" class="planner-button planner-button-light" data-open-family>Раздельный отдых</button>
        </div>
      </div>
    </div>
    ${plan.days.length > 1 ? `<div class="holiday-day-tabs" role="tablist" aria-label="Дни отдыха">
      ${plan.days.map((day, index) => `<button type="button" role="tab" id="holiday-tab-${day.date}" data-board-day="${day.date}" aria-controls="holiday-day-content" aria-selected="${activeDay === day}" tabindex="${activeDay === day ? 0 : -1}">
        <strong>День ${index + 1}</strong><span>${esc(dateLabel(day.date))}</span>
      </button>`).join('')}
    </div>` : ''}
    <div id="holiday-day-content"${plan.days.length > 1 ? ` role="tabpanel" aria-labelledby="holiday-tab-${activeDay.date}"` : ''}>
    <div id="holiday-board-schedule" class="holiday-board-layout" data-board-pane="schedule">
      <div data-board-palette></div>
      <div class="holiday-board-surface holiday-timeline">
        <div class="planner-days">
          ${plan.days.map((day, index) => `<article class="planner-day" data-schedule-date="${esc(day.date)}"${activeDay !== day ? ' hidden' : ''}>
            <div class="planner-day-heading holiday-day-heading">
              <div><h3 tabindex="-1">День ${index + 1}</h3><span>${esc(dateLabel(day.date))}</span></div>
            </div>
            ${undoEdit?.type === 'remove' && undoEdit.date === day.date ? undoMarkup() : ''}
            <ol>${day.items.map((item, entry) => eventMarkup(item, day, entry)).join('')}</ol>
          </article>`).join('')}
        </div>
        <p class="holiday-board-note">${esc(breakfastNotice)}</p>
      </div>
      <aside class="holiday-board-sidebar">
        <img class="holiday-board-photo" src="./images/mozhaysk-render-photos-20261106/panorama/exterior.jpg" width="1672" height="941" alt="Хаусбот на Можайском водохранилище">
        <div class="holiday-board-surface holiday-coordination">
          <h3>Согласовать с отелем</h3>
          <div class="holiday-coordination-list" data-board-confirmations role="region" aria-label="Пункты для согласования" tabindex="0"></div>
          ${holidayApiBase ? '<button type="button" class="planner-button" data-plan-request aria-expanded="false" aria-controls="planner-plan-request">Открыть заявки на согласование</button>' : ''}
        </div>
      </aside>
    </div>
    <section id="holiday-board-map" class="holiday-board-surface holiday-map" data-board-pane="map" aria-labelledby="holiday-map-title" hidden></section>
    </div>
    <section id="holiday-board-badges" class="holiday-board-surface holiday-badge-panel" data-board-pane="badges" aria-labelledby="holiday-badge-title" hidden>
      <h3 id="holiday-badge-title">Достижения</h3><p>Отмечайте занятия в расписании. Достижения сохраняются в этом браузере.</p>
      <div data-board-badges></div>
    </section>
    ${holidayApiBase ? '<section id="planner-plan-request" class="planner-item-editor planner-request" data-plan-request-panel aria-labelledby="planner-request-title" hidden></section>' : ''}
    <details class="holiday-board-tools"><summary>Экспорт, размещение и настройки программы</summary>
      <div class="holiday-trip-controls">
        <button class="planner-button" data-pdf>Скачать PDF</button>
        <button type="button" class="planner-button planner-button-light planner-chat-trigger" data-open-holiday-chat aria-controls="planner-chat">Написать помощнику</button>
        <button class="planner-button planner-button-light" data-copy>Скопировать текст</button>
        <button class="planner-edit" data-edit-outings>Изменить занятия и поездки</button>
        <button class="planner-edit" data-edit-services>Изменить услуги</button>
        ${bookingCompact ? bookingEditButtons() : lodgingEditButton()}
      </div>
      ${lodgingResult()}
      <p class="planner-note">${format}. Время услуг и сопровождение детей подтверждаются отдельно.</p>
    </details>
    ${holidayApiBase ? `<section class="planner-afisha" data-hotel-events aria-labelledby="planner-afisha-title">
      <div class="planner-afisha-heading">
        <div><p class="planner-eyebrow">Мероприятия отеля</p><h3 id="planner-afisha-title">Афиша на ваши даты</h3></div>
        <button type="button" class="planner-edit" data-events-refresh>Обновить афишу</button>
      </div>
      <p class="planner-afisha-status" role="status" data-events-status></p>
      <p class="planner-afisha-notice" role="status" data-events-notice hidden></p>
      <ul class="planner-afisha-list" data-events-list hidden></ul>
    </section>` : ''}
    ${unappliedEdits.length ? `<section class="planner-unplaced">
      <h3>Правки, которые не удалось применить</h3>
      <p>После пересчёта изменились даты или время занятий. Эти пункты можно поправить в новом расписании.</p>
      <ul>${unappliedEdits.map(({ edit, error }) => `<li><strong>${esc(edit.itemTitle)}</strong> — ${esc(error)}</li>`).join('')}</ul>
    </section>` : ''}
    ${plan.unplaced.length ? `<section class="planner-unplaced">
      <h3>Что не вошло в расписание</h3>
      <p>Чтобы занятия не пересекались, можно добавить день или сократить программу.</p>
      <ul>${plan.unplaced.map(item => `<li><strong>${esc(item.title)}</strong> — ${esc(item.reason)}</li>`).join('')}</ul>
    </section>` : ''}
    ${plan.notes.length ? `<div class="planner-plan-notes">${plan.notes.map(note => `<p>${esc(note)}</p>`).join('')}</div>` : ''}
    <details class="planner-text">
      <summary>Вся программа обычным текстом</summary>
      <label for="planner-plain-text" class="planner-sr-only">Текст программы для копирования</label>
      <textarea id="planner-plain-text" readonly rows="18">${esc(text)}</textarea>
      <button class="planner-button planner-button-light" data-download>Скачать .txt</button>
    </details>
  </section>`;
  bindBoard(activeDay.date);
  const feedback = root.querySelector('.planner-feedback');
  const pdfButton = root.querySelector('[data-pdf]');
  const pdfReady = root.querySelector('[data-pdf-ready]');
  const pdfLink = root.querySelector('[data-pdf-link]');
  async function preparePdf() {
    if (!pdfButton.isConnected) return null;
    if (preparedPdf) return preparedPdf;
    if (pdfPreparation) return pdfPreparation;
    const schedule = plan;
    pdfButton.disabled = true;
    pdfPreparation = (async () => {
      try {
        const { prepareHolidayPdfDownload } = await import('./collection-holiday-pdf.js?v=20261109-career-type-1');
        const result = await prepareHolidayPdfDownload(schedule, { lodging });
        if (!pdfButton.isConnected) {
          result.release();
          return null;
        }
        preparedPdf = result;
        pdfLink.href = result.url;
        pdfLink.download = result.filename;
        return result;
      } finally {
        if (pdfButton.isConnected) {
          pdfPreparation = undefined;
          pdfButton.disabled = Boolean(itemEditor);
        }
      }
    })();
    return pdfPreparation;
  }
  renderAssistant(plan, {
    preparePdf,
    applyEdit: edit => {
      const source = plan.days.find(day => day.items.some(item => item.id === edit.itemId));
      return saveItemEdit(edit, source?.date || edit.date, { focus: false }) || '';
    },
  });
  root.querySelector('[data-open-holiday-chat]').addEventListener('click', () => showPlannerView('chat', { focus: true, scroll: true }));
  void mountPlanBooking();
  if (holidayApiBase) {
    mountPlanRequests(root, plan, holidayApiBase);
    mountHotelEvents(root.querySelector('[data-hotel-events]'), plan, draftCity, edit => saveItemEdit(edit, edit.date), holidayApiBase);
  }
  for (const undoButton of root.querySelectorAll('[data-undo-item]')) undoButton.addEventListener('click', () => {
    const { plan: previous, itemId, date } = undoEdit;
    plan = previous;
    planEdits.pop();
    undoEdit = undefined;
    renderPlan({ scroll: false, message: 'Последняя правка отменена.' });
    focusSchedule(itemId, date);
  });
  pdfButton.addEventListener('click', async () => {
    if (!preparedPdf) feedback.textContent = 'Готовим PDF…';
    try {
      const result = preparedPdf ?? await preparePdf();
      if (!result || !pdfButton.isConnected) return;
      pdfReady.hidden = false;
      feedback.textContent = 'PDF готов. Если скачивание не началось, воспользуйтесь ссылкой ниже.';
      pdfLink.click();
    } catch (error) {
      console.error('Holiday plan PDF export failed', error);
      feedback.textContent = 'PDF не удалось подготовить. Можно повторить попытку или скачать текстовый файл.';
    }
  });
  bindBookingEdits(root, 'result');
  root.querySelector('[data-edit]').addEventListener('click', () => openQuickEdit('dates', 'result'));
  root.querySelector('[data-edit-outings]').addEventListener('click', () => editOutings('result'));
  root.querySelector('[data-edit-services]').addEventListener('click', () => openQuickEdit('services', 'result'));
  root.querySelector('[data-open-family]').addEventListener('click', openFamily);
  for (const button of root.querySelectorAll('[data-edit-place]')) {
    button.addEventListener('click', () => openQuickEdit('routes', 'result', button.dataset.editPlace));
  }
  root.querySelector('[data-copy]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); feedback.textContent = 'Программа скопирована. Её можно отправить близким или администратору.'; }
    catch { const details = root.querySelector('.planner-text'); details.open = true; const area = details.querySelector('textarea'); area.focus(); area.select(); feedback.textContent = 'Автоматическое копирование недоступно. Текст выделен ниже — скопируйте его вручную.'; }
  });
  root.querySelector('[data-download]').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob(['\ufeff', text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `amore-plan-${answers.startDate}.txt`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  if (scroll) {
    root.querySelector('#planner-result-title').focus({ preventScroll: true });
    root.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
}

function setPlannerRoute(mode, replace = false) {
  const url = new URL(location.href);
  if (mode) {
    url.searchParams.set('mode', mode);
    url.searchParams.delete('assistant');
  } else url.searchParams.delete('mode');
  if (url.href !== location.href) history[replace ? 'replaceState' : 'pushState'](history.state, '', url);
}

function showAutomatic({ resume = false, focus = true } = {}) {
  const saved = autoRecord || loadHolidayDraft(`${draftScope}:auto`, defaultAnswers);
  Object.assign(answers, structuredClone(saved?.answers || boardRecord?.answers || defaultAnswers));
  const boardDates = boardRecord?.answers;
  if (!resume && boardDates && Object.keys(validateTripDates(answers, today(), nowMinute())).length) {
    for (const field of stepFields.dates) answers[field] = boardDates[field];
  }
  bookingCompact = canUseCompactBooking();
  quickEdit = undefined;
  current = resume && steps().includes(saved?.step) ? saved.step : 'outings';
  renderQuestion(focus);
}

function openAutomatic() {
  persistDraft(true);
  setPlannerRoute('auto');
  showAutomatic();
}

function openFamily() {
  persistDraft(true);
  setPlannerRoute('family');
  renderFamily();
}

function renderFamily({ focus = true } = {}) {
  releasePreparedPdf();
  const previous = boardRecord.answers;
  const savedEdits = boardRecord.edits;
  Object.assign(answers, structuredClone(previous));
  bookingCompact = canUseCompactBooking();
  quickEdit = undefined;
  const bookedTotal = bookingCompact ? bookingHandoff.adults : 0;
  const adultChoices = familyAdultInterests.map(item => ({
    ...item, disabled: !availableInterestInStay(item.id, previous.startDate, previous.endDate),
  }));
  const adultChoice = adultChoices.some(item => item.id === previous.adultActivity && !item.disabled) ? previous.adultActivity : '';
  const childIcons = { creative: 'garden', games: 'ball-games', quest: 'learning-games', walk: 'walk' };
  const tile = (name, item, type, selected, icon = item.id) => `<label class="holiday-tile">
    <input type="${type}" name="${name}" value="${item.id}"${checked(selected)}${item.disabled ? ' disabled' : ''}>
    ${boardIcon(icon)}<strong>${esc(item.title)}</strong>${item.disabled ? '<small>Вне сезона</small>' : ''}${'minAge' in item && item.minAge ? `<small>От ${item.minAge} лет</small>` : ''}
  </label>`;
  setBoardHeading('family');
  root.dataset.boardScreen = 'family';
  showPlannerView('plan');
  renderAssistant();
  root.innerHTML = `<form class="holiday-family" novalidate aria-labelledby="planner-question">
    <p id="planner-question" class="holiday-family-intro" tabindex="-1">Выберите занятия для взрослых и детей. Планировщик подберёт общее время для обеих программ.</p>
    <div class="planner-errors" role="alert" tabindex="-1" hidden></div>
    <section class="holiday-board-surface holiday-family-party" aria-labelledby="family-party-title">
      <h2 id="family-party-title">Кто едет</h2>
      <div class="planner-fields">${field('adults', 'Взрослые', 'number', previous.adults, `min="1" max="20" inputmode="numeric" required${bookedTotal ? ' readonly' : ''}`)}
      ${field('children', 'Дети до 18 лет', 'number', previous.children, `min="0" max="${bookedTotal ? Math.min(10, bookedTotal - 1) : 10}" inputmode="numeric" required`)}</div>
      <div data-family-ages>${agesMarkup(previous)}</div>
      <fieldset class="holiday-family-mode"><legend>Формат отдыха</legend><div class="planner-choices">
        ${choice('familyMode', 'separate', 'Раздельно', '', true)}
        ${choice('familyMode', 'together', 'Вместе', '', false)}
      </div></fieldset>
    </section>
    <div class="holiday-family-programmes">
      <fieldset class="holiday-board-surface holiday-family-programme" data-family-adults>
        <legend>Для взрослых</legend>
        <div class="holiday-family-options">
          ${tile('adultActivity', { id: '', title: 'Подобрать занятие' }, 'radio', !adultChoice, 'achievement')}
          ${adultChoices.map(item => tile('adultActivity', item, 'radio', item.id === adultChoice)).join('')}
        </div>
      </fieldset>
      <fieldset class="holiday-board-surface holiday-family-programme">
        <legend>Для детей</legend>
        <div class="holiday-family-options">${childActivityOptions.map(item => tile('childActivities', item, 'checkbox', previous.childActivities.includes(item.id), childIcons[item.id])).join('')}</div>
        <p class="planner-help" data-family-child-help></p>
      </fieldset>
    </div>
    <p class="planner-note" data-family-support aria-live="polite"></p>
    <div class="holiday-family-actions">
      <button type="button" class="planner-button planner-button-light" data-family-back>К плану отдыха</button>
      <button type="submit" class="planner-button holiday-primary">Сохранить программу</button>
    </div>
  </form>`;
  const form = root.querySelector('form');
  const fields = form.elements;
  const errors = form.querySelector('.planner-errors');
  const ageFields = form.querySelector('[data-family-ages]');
  const childFields = [...form.querySelectorAll('[name="childActivities"]')];
  const readNumber = input => input.value === '' ? NaN : Number(input.value);
  const readAges = () => [...ageFields.querySelectorAll('input')].map(readNumber);
  const childCount = () => Math.max(0, Math.min(10, readNumber(fields.children) || 0));
  function syncFamily() {
    const ages = readAges();
    const known = ages.filter(age => Number.isInteger(age) && age >= 0 && age <= 17);
    const separate = fields.familyMode.value === 'separate';
    const adultPanel = form.querySelector('[data-family-adults]');
    adultPanel.hidden = adultPanel.disabled = !separate;
    for (const input of childFields) {
      const age = childActivityOptions.find(item => item.id === input.value).minAge;
      input.disabled = !known.some(value => value >= age);
      if (input.disabled) input.checked = false;
    }
    form.querySelector('[data-family-child-help]').textContent = known.length ? 'Можно выбрать несколько занятий или доверить выбор планировщику.' : 'Укажите возраст детей, чтобы выбрать подходящие занятия.';
    const withToddler = known.some(age => age < 3);
    const support = form.querySelector('[data-family-support]');
    support.hidden = !separate || !childCount();
    support.textContent = withToddler ? (readNumber(fields.adults) > 1 ? 'С ребёнком до трёх лет один взрослый остаётся с детьми на весь интервал.' : 'Если взрослый один и ребёнку меньше трёх лет, планировщик предложит совместное занятие.') : 'Сопровождение детей аниматором нужно подтвердить у отеля на весь интервал.';
  }
  form.addEventListener('input', event => {
    errors.hidden = true;
    if (event.target === fields.children && Number.isInteger(childCount())) {
      const ages = readAges();
      if (ages.length !== childCount()) ageFields.innerHTML = agesMarkup({ children: childCount(), ages: ages.map(age => Number.isFinite(age) ? age : '') });
      if (bookedTotal) fields.adults.value = bookedTotal - childCount();
    }
    syncFamily();
  });
  form.querySelector('[data-family-back]').addEventListener('click', () => returnToBoard({ replace: true }));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const next = { ...structuredClone(previous), adults: readNumber(fields.adults), children: readNumber(fields.children),
      ages: readAges(), familyMode: data.get('familyMode'), adultActivity: data.get('adultActivity') || '', childActivities: data.getAll('childActivities') };
    const issues = validateAnswers(next);
    if (next.familyMode === 'separate' && next.children === 0) issues.children = 'Добавьте хотя бы одного ребёнка для раздельного отдыха.';
    if (bookedTotal && next.adults + next.children !== bookedTotal) issues.children = 'Число гостей должно совпадать с бронированием.';
    let result;
    if (!Object.keys(issues).length) {
      if (next.lodging && holidayLodgings.find(item => item.id === next.lodging)?.capacity < next.adults + next.children) next.lodging = '';
      result = replayScheduleEdits(buildHolidayPlan(next, { priorityMeals: boardRecord.priorityMeals }), savedEdits);
      if (result.errors.length) issues.edits = `Новые занятия пересекаются с правками в плане: ${result.errors.map(({ edit }) => edit.itemTitle).join(', ')}. Выберите другое занятие или освободите время.`;
    }
    if (Object.keys(issues).length) {
      errors.innerHTML = `<ul>${Object.values(issues).map(message => `<li>${esc(message)}</li>`).join('')}</ul>`;
      errors.hidden = false;
      errors.focus();
      return;
    }
    Object.assign(answers, next);
    priorityMeals = boardRecord.priorityMeals;
    planEdits = [...savedEdits];
    marks = new Set(boardRecord.marks);
    plan = result.plan;
    unappliedEdits = [];
    undoEdit = undefined;
    boardTab = 'schedule';
    setPlannerRoute('', true);
    renderPlan({ message: 'Семейная программа обновлена.' });
  });
  syncFamily();
  if (focus) {
    root.querySelector('#planner-question').focus({ preventScroll: true });
    masthead.scrollIntoView({ block: 'start' });
  }
}

function returnToBoard({ replace = false, focus = true } = {}) {
  setPlannerRoute('', replace);
  const record = boardRecord;
  Object.assign(answers, structuredClone(record.answers));
  priorityMeals = record.priorityMeals;
  marks = new Set(record.marks);
  planEdits = [...record.edits];
  plan = quickEdit = undefined;
  bookingCompact = canUseCompactBooking();
  rebuildPlan({ alreadyPlanned: true });
  showPlannerView('plan');
  renderPlan({ scroll: focus, save: false });
}

function renderAlternatives() {
  const proposalList = buildBoardAlternatives(answers);
  persistDraft();
  setBoardHeading('pick');
  root.dataset.boardScreen = 'variants';
  root.innerHTML = `<section class="holiday-alternatives" aria-labelledby="planner-question">
    <button type="button" class="planner-edit" data-back-alt>Изменить выбор</button>
    <h2 id="planner-question" tabindex="-1">Выберите программу отдыха</h2>
    <p>Посмотрите расписание каждого варианта. Выбранный план откроется на доске, где можно передвинуть занятия и добавить свои.</p>
    ${alternativesMarkup(proposalList)}
  </section>`;
  root.querySelector('[data-back-alt]').addEventListener('click', () => renderQuestion());
  for (const choice of root.querySelectorAll('[data-choose-variant]')) {
    choice.addEventListener('click', () => {
      const proposal = proposalList.find(item => item.id === choice.dataset.chooseVariant);
      Object.assign(answers, structuredClone(proposal.input));
      plan = proposal.plan;
      priorityMeals = true;
      planEdits = [];
      unappliedEdits = [];
      undoEdit = undefined;
      chatState = {};
      selectedDay = undefined;
      selectedMapItem = undefined;
      boardTab = 'schedule';
      setPlannerRoute('', true);
      renderPlan({ message: `Выбрана программа «${proposal.title}».` });
    });
  }
  root.querySelector('#planner-question').focus({ preventScroll: true });
  root.scrollIntoView({ block: 'start' });
}

function restoreDraft() {
  const url = new URL(location.href);
  const fromHome = !bookingScope && !bookingHandoff && url.searchParams.get('city') === draftCity
    && url.searchParams.get('from') === 'hotel';
  if (fromHome) draftScope = `${draftCity}:home`;
  const bookingDraft = bookingScope ? loadHolidayDraft(bookingScope, defaultAnswers) : null;
  if (bookingHandoff || bookingDraft) draftScope = bookingScope;
  const draft = draftScope === bookingScope ? bookingDraft : loadHolidayDraft(draftScope, defaultAnswers);
  const incoming = fromHome ? Object.fromEntries(stepFields.dates.map(field => [field, url.searchParams.get(field) || ''])) : null;
  const incomingValid = incoming && !Object.keys(validateTripDates(incoming, today(), nowMinute())).length;
  const booked = bookingDefaults();
  if (draft?.completed && !incomingValid && !Object.keys(validateAnswers(draft.answers)).length) {
    boardRecord = draft;
    showDraftStatus('Черновик восстановлен из этого браузера.');
  } else {
    const fresh = { ...structuredClone(defaultAnswers), ...booked, ...(incomingValid ? incoming : {}) };
    if (Object.keys(validateAnswers(fresh)).length) Object.assign(fresh, structuredClone(defaultAnswers));
    boardRecord = { answers: fresh, edits: [], marks: [], priorityMeals: true };
    if (draft && !draft.completed && !incomingValid) autoRecord = draft;
    if (incomingValid) {
      stepFields.dates.forEach(field => url.searchParams.delete(field));
      if (saveHolidayDraft(draftScope, { ...boardRecord, step: 'review', completed: true })) history.replaceState(history.state, '', url);
    }
    if (bookingHandoff) showDraftStatus(bookingStatus, false);
    else if (bookingScope && draftScope === draftCity) showDraftStatus(bookingFallbackStatus, false);
  }
  if (isAutoRoute()) showAutomatic({ resume: true, focus: false });
  else if (isFamilyRoute()) renderFamily({ focus: false });
  else returnToBoard({ focus: false });
}

if (root) {
  let statusBeforeReset;
  viewSwitch.hidden = false;
  viewSwitch.addEventListener('click', event => {
    const button = event.target.closest('[data-planner-view]');
    if (button) showPlannerView(button.dataset.plannerView, { focus: true });
  });
  draftBanner?.querySelector('[data-reset-draft]')?.addEventListener('click', () => {
    statusBeforeReset = draftBanner.querySelector('[data-draft-status]').textContent;
    showDraftStatus('Удалить сохранённый черновик и начать заново?', false);
    draftBanner.querySelector('[data-reset-actions]').hidden = false;
    draftBanner.querySelector('[data-confirm-reset]').focus();
  });
  draftBanner?.querySelector('[data-cancel-reset]')?.addEventListener('click', () => {
    showDraftStatus(statusBeforeReset);
    draftBanner.querySelector('[data-reset-draft]').focus();
  });
  draftBanner?.querySelector('[data-confirm-reset]')?.addEventListener('click', () => {
    if (!clearHolidayDraft(isAutoRoute() ? `${draftScope}:auto` : draftScope)) {
      showDraftStatus('Браузер не смог удалить черновик.');
      return;
    }
    if (isAutoRoute()) {
      autoRecord = { answers: structuredClone(boardRecord.answers), step: 'outings' };
      showDraftStatus('', false);
      showAutomatic();
      return;
    }
    const fresh = { ...structuredClone(defaultAnswers), ...bookingDefaults() };
    boardRecord = { answers: fresh, edits: [], marks: [], priorityMeals: true };
    selectedDay = selectedMapItem = undefined;
    boardTab = 'schedule';
    chatState = {};
    undoEdit = undefined;
    showDraftStatus(bookingHandoff ? bookingStatus : '', false);
    returnToBoard();
  });
  window.addEventListener('popstate', () => {
    if (isAutoRoute()) showAutomatic({ resume: true });
    else if (isFamilyRoute()) renderFamily();
    else returnToBoard();
  });
  restoreDraft();
  if (new URLSearchParams(location.search).get('assistant') === 'chat') {
    showPlannerView('chat', { scroll: location.hash === '#planner-assistant' });
  }
}
