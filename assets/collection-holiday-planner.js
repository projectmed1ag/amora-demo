import { onsiteInterests, services, attractions, mapRoute, demoOrigin, demoOriginLabel, outingTransports, childActivityOptions } from './collection-holiday-data.js?v=20261108-route-pdf-1';
import { breakfastNotice, buildHolidayPlan, planToText, validateAnswers, addDays, dateLabel, dateNumber, clock, excursionSettings, outingDurationMinutes, availableInterestInStay, interestSeasonLabel } from './collection-holiday-engine.js?v=20261108-route-pdf-1';
import { holidayLodgings } from './collection-holiday-lodging.js';
import { canEditScheduleItem, scheduleReplacementOptions, applyScheduleEdit, replayScheduleEdits } from './collection-holiday-edits.js?v=20261108-route-pdf-1';
import { loadHolidayDraft, saveHolidayDraft, clearHolidayDraft } from './collection-holiday-draft.js?v=20261108-route-pdf-1';
import { mountPlanRequests } from './collection-holiday-requests.js?v=20261108-route-pdf-1';
import { hotelEventLabels, mountHotelEvents } from './collection-holiday-events.js?v=20261108-route-pdf-1';
import { destinationDateParts, destinationLocalDate } from './collection-destinations.js?v=20261024-all-hotels-1';

const root = document.getElementById('planner-app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const today = () => destinationLocalDate(new Date(), 'mozhaysk');
const nowMinute = () => { const { hour, minute } = destinationDateParts(new Date(), 'mozhaysk'); return Number(hour) * 60 + Number(minute); };
const initialDate = addDays(today(), 1);
const defaultAnswers = {
  startDate: initialDate, endDate: initialDate, arrival: '10:00', departure: '20:00', lodging: '',
  adults: 2, children: 0, ages: [], childActivities: [], familyMode: 'together', pace: 'balanced', wake: '09:00', rest: '21:00',
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
let planEdits = [], unappliedEdits = [], undoEdit, itemEditor, pdfInProgress = false, preparedPdf;
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
  ...(!bookingCompact ? ['dates'] : []), 'party',
  ...(!bookingCompact && overnight() ? ['lodging'] : []),
  'rhythm', 'outings', ...(!stayingAtHotel() ? ['routes'] : []), 'services', 'review',
];
const selectedPlaces = () => attractions.filter(place => answers.places.includes(place.id));
const outingModeLabel = () => stayingAtHotel() ? 'Без выездов к достопримечательностям' : 'Выезды к достопримечательностям';
const selectedInterests = () => onsiteInterests.filter(item => answers.interests.includes(item.id));
const interestsLabel = () => selectedInterests().map(item => item.title).join(', ')
  || (answers.suggestActivities ? 'Помощник подберёт занятия' : 'Свободное время');
const canBuildFirstPlan = () => !quickEdit && current === 'outings' && answers.suggestActivities && stayingAtHotel();
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
  const saved = saveHolidayDraft(draftScope, { answers, step: completed ? 'review' : current, edits: planEdits, completed });
  showDraftStatus(saved ? 'Черновик сохранён в этом браузере.' : 'Браузер не смог сохранить черновик.', saved);
  return saved;
}

function agesMarkup() {
  return `<div class="planner-age-grid">${Array.from({ length: Math.max(0, Math.min(10, answers.children || 0)) }, (_, i) => field(`age-${i}`, `Возраст ребёнка ${i + 1}`, 'number', answers.ages[i] ?? '', 'min="0" max="17" step="1" inputmode="numeric" required')).join('')}</div>`;
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
    family: 'Детям и всей семье',
    nature: 'На природе и у воды',
    active: 'Спорт и активный отдых',
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
    ${choice('suggestActivities', 'yes', 'Предложите за меня', 'Помощник учтёт ваш ритм, сезон и состав компании.', answers.suggestActivities && !selectedInterests().length, 'checkbox')}
    <div class="planner-activity-groups">${Object.entries(groups).map(([id, title]) => {
      const items = inSeason.filter(item => (item.group || 'nature') === id);
      if (!items.length) return '';
      const open = ['family', 'nature'].includes(id) || (id === 'active' && answers.pace === 'active')
        || items.some(selected);
      return `<details class="planner-options planner-activity-group"${open ? ' open' : ''}>
        <summary>${title}</summary>
        <div class="planner-choices planner-choices-inline">${items.map(item =>
          choice('interests', item.id, esc(item.title), esc(item.detail), selected(item), 'checkbox')
        ).join('')}</div>
      </details>`;
    }).join('')}</div>
    ${outOfSeason.length ? `<details class="planner-options planner-offseason" data-out-of-season${outOfSeason.some(selected) ? ' open' : ''}>
      <summary>Занятия вне сезона (${outOfSeason.length})</summary>
      <div class="planner-choices planner-choices-inline">${outOfSeason.map(item =>
        choice('interests', item.id, esc(item.title), esc(`Сезон: ${interestSeasonLabel(item.id)}`), selected(item), 'checkbox', !selected(item))
      ).join('')}</div>
    </details>` : ''}
  </div>`;
}

function outingsMarkup() {
  return `<fieldset>
      <legend>Занятия в отеле и рядом</legend>
      <div class="planner-selection-help">
        <p class="planner-help">Можно выбрать несколько занятий или оставить это время свободным.</p>
        <p class="planner-selection-count" role="status" data-interest-count>${interestCountLabel()}</p>
      </div>
      ${interestsMarkup()}
    </fieldset>
    <fieldset>
      <legend>Поездки к достопримечательностям</legend>
      <div class="planner-choices">
        ${choice('outingMode', 'stay', 'Без выездов к достопримечательностям', '', stayingAtHotel())}
        ${choice('outingMode', 'visit', 'Добавить выезды', 'На следующем шаге выберете места и транспорт.', !stayingAtHotel())}
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
  if (current === 'services') return `<p class="planner-help">Выберите, что включить в программу. Помощник предложит по одному посещению на поездку и подберёт свободное время.</p><div class="planner-service-options">${services.map(item => `<div class="planner-service-option">${choice('services', item.id, item.title, `${item.detail} · ${item.duration / 60} ч в плане`, answers.services.includes(item.id), 'checkbox')}<div class="planner-service-time" data-service-time="${item.id}"${answers.services.includes(item.id) ? '' : ' hidden'}>${field(`preferred-${item.id}`, 'Предпочтительное время', 'time', answers.preferred[item.id])}</div></div>`).join('')}</div><p class="planner-note">Ресторан и баню можно согласовать с отелем из готового плана. Условия аренды мангальной зоны уточняются отдельно.</p>`;
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
  const base = buildHolidayPlan(structuredClone(answers), alreadyPlanned ? {} : { today: today(), currentMinute: nowMinute() });
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
  if (current === 'review') return 'Составить программу';
  const sequence = steps();
  const next = sequence[sequence.indexOf(current) + 1];
  return {
    party: 'Указать гостей', lodging: 'Выбрать размещение', rhythm: 'Выбрать ритм',
    outings: 'Выбрать занятия', routes: 'Настроить поездки', services: 'Выбрать услуги', review: 'Проверить программу',
  }[next] || 'Продолжить';
}

function renderQuestion(focus = true) {
  releasePreparedPdf();
  const sequence = steps(), index = sequence.indexOf(current);
  const history = previousSteps();
  const stickyActions = ['lodging', 'outings', 'routes', 'services', 'review'].includes(current);
  const title = current === 'party'
    ? quickEdit ? 'Как проведём семейный отдых?' : bookingCompact ? 'Сколько из гостей — дети?' : questions.party
    : questions[current];
  root.innerHTML = `<div class="planner-layout">
    <section class="planner-conversation" aria-labelledby="planner-question">
      <div class="planner-progress">${quickEdit ? '<span>Настройка плана</span>' : `<span>Вопрос ${index + 1} из <b data-step-count>${sequence.length}</b></span><progress value="${index + 1}" max="${sequence.length}" aria-label="Ход составления программы"></progress>`}</div>
      <div class="planner-assistant">
        <div class="planner-assistant-mark">
          <span class="amore-logo" aria-hidden="true"><span class="brand-name">A’MORE</span><span class="brand-collection">COLLECTION</span></span>
          <span class="planner-assistant-caption">Помощник по отдыху</span>
        </div>
      </div>
      <details class="planner-step-summary${history.length ? ' has-history' : ''}">
        <summary><span class="planner-summary-desktop">Ваши предыдущие ответы</span><span class="planner-summary-mobile">${history.length ? 'Ваш отдых и ответы' : 'Ваш отдых'}</span></summary>
        <ol class="planner-summary-desktop">${history.map(step => `<li><span>${questions[step]}</span><p>${esc(answerLabel(step))}</p></li>`).join('')}</ol>
        <dl class="planner-summary-values planner-summary-mobile" data-trip-summary="history">${summaryValuesMarkup(true)}</dl>
      </details>
      <h2 id="planner-question" tabindex="-1">${title}</h2>
      <form id="holiday-questions" novalidate>
        <div class="planner-errors" role="alert" hidden></div>
        ${questionMarkup()}
        <div class="planner-question-actions${stickyActions ? ' planner-question-actions-sticky' : ''}">
          ${index > 0 || quickEdit ? `<button type="button" class="planner-button planner-button-light" data-back>${quickEdit ? 'Отмена' : 'Назад'}</button>` : ''}
          <button class="planner-button planner-next" type="submit"><span data-continue-label>${continueLabel()}</span> <span aria-hidden="true">→</span></button>
          ${!quickEdit && current === 'outings' ? `<button class="planner-button planner-button-light" type="submit" data-first-plan${canBuildFirstPlan() ? '' : ' hidden'}>Составить первый план</button>` : ''}
        </div>
        ${current === 'rhythm' && overnight() ? `<details class="planner-options planner-rhythm-options"><summary>Настроить время начала дня и вечернего отдыха</summary><div class="planner-fields">${field('wake', 'Начало дня', 'time', answers.wake, 'required')}${field('rest', 'Вечерний отдых с', 'time', answers.rest, 'required')}</div></details>` : ''}
      </form>
    </section>
    <aside class="planner-sidebar">
      <h2>Ваш отдых</h2>
      ${index === 0 ? '<img src="./images/mozhaysk-render-photos-20261106/panorama/exterior.jpg" width="1672" height="941" alt="Хаусбот с террасой на Можайском водохранилище"><p>В конце вы получите расписание, которое можно скачать в PDF.</p>' : ''}
      <dl class="planner-summary-values" data-trip-summary>${summaryValuesMarkup()}</dl>
    </aside>
  </div>`;
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
        if (!input.checked && document.activeElement === input) input.closest('details').querySelector('summary').focus();
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
    } else if (event.target.checked && event.target.name === 'interests') {
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
      rebuildPlan();
      renderPlan();
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
  return `<li class="planner-event${quiet}"${item.id ? ` data-schedule-id="${esc(item.id)}"` : ''}${addable ? ` data-free-start="${item.start}"` : ''}>
    <time>${clock(item.start)}${item.end > item.start ? `<span>— ${clock(item.end)}</span>` : ''}</time>
    <div>
      ${hotelEvent ? `<p class="planner-eyebrow">${esc(hotelEventLabels[item.eventType])}</p>` : ''}
      <h4 tabindex="-1">${esc(item.title)}</h4>
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
      ${editable ? `<div class="planner-event-actions" role="group" aria-label="Действия для занятия «${esc(item.title)}»">
        ${Object.entries(itemActions).filter(([type]) => !hotelEvent || type === 'remove').map(([type, label]) => `<button type="button" class="planner-event-edit" data-item-action="${type}"${type === 'remove' ? '' : ` aria-expanded="false" aria-controls="${editorId}"`}>${label}</button>`).join('')}
      </div>` : ''}
      ${addable ? `<div class="planner-event-actions">
        <button type="button" class="planner-event-edit" data-item-action="add" aria-expanded="false" aria-controls="${editorId}">Добавить занятие</button>
      </div>` : ''}
      ${editable || addable ? `<div id="${editorId}" class="planner-item-editor" hidden></div>` : ''}
      ${undoEdit && undoEdit.type !== 'remove' && undoEdit.itemId === item.id ? undoMarkup() : ''}
    </div>
  </li>`;
}

function focusSchedule(itemId, date) {
  const item = itemId && root.querySelector(`[data-schedule-id="${CSS.escape(itemId)}"] > div > h4`);
  const target = item || root.querySelector(`[data-schedule-date="${CSS.escape(date)}"] h3`) || root.querySelector('#planner-result-title');
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'nearest' });
}

function saveItemEdit(edit, date) {
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
  focusSchedule(edit.itemId, edit.date || date);
}

function closeItemEditor(restoreFocus = false) {
  if (!itemEditor) return;
  const { panel, button } = itemEditor;
  panel.replaceChildren();
  panel.hidden = true;
  button.setAttribute('aria-expanded', 'false');
  root.querySelector('[data-pdf]').disabled = pdfInProgress;
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
}

function renderPlan({ scroll = true, message = '', save = true } = {}) {
  releasePreparedPdf();
  itemEditor = undefined;
  if (save) persistDraft(true);
  const lodging = lodgingLabel();
  const text = planToText(plan, { lodging });
  const hasExcursions = plan.days.some(day => day.items.some(item => item.kind === 'excursion'));
  const format = !stayingAtHotel() && !hasExcursions ? 'Без выездов к достопримечательностям' : outingModeLabel();
  const confirmations = plan.days.flatMap(day => day.items.filter(item => item.confirmation).map(item => ({ day, item })));
  root.innerHTML = `<section class="planner-result" aria-labelledby="planner-result-title">
    <div class="planner-result-heading">
      <div>
        <p class="planner-eyebrow">Личная программа · ${esc(plan.timeZone)}</p>
        <h2 id="planner-result-title" tabindex="-1">Вот как может<br>пройти ваш отдых.</h2>
        <p>${esc(answers.startDate)} — ${esc(answers.endDate)} · Взрослых: ${answers.adults}${answers.children ? ` · Детей: ${answers.children}` : ''}<br>${format}</p>
      </div>
      <div class="planner-result-actions">
        <button class="planner-button" data-pdf${pdfInProgress ? ' disabled' : ''}>Скачать PDF</button>
        ${holidayApiBase ? '<button type="button" class="planner-button planner-button-light" data-plan-request aria-expanded="false" aria-controls="planner-plan-request">Согласовать с отелем</button>' : ''}
        <button class="planner-button planner-button-light" data-copy>Скопировать текст</button>
        <button class="planner-edit" data-edit-outings>Изменить занятия и поездки</button>
        <button class="planner-edit" data-edit-services>Изменить услуги</button>
        ${answers.children ? '<button class="planner-edit" data-edit-family>Изменить семейный отдых</button>' : ''}
        ${bookingCompact ? bookingEditButtons() : lodgingEditButton()}
        <button class="planner-edit" data-edit>Изменить ответы</button>
      </div>
    </div>
    <p class="planner-feedback" role="status">${esc(message)}</p>
    <p class="planner-feedback" data-pdf-ready hidden><a data-pdf-link>Скачать готовый PDF</a></p>
    ${holidayApiBase ? '<section id="planner-plan-request" class="planner-item-editor planner-request" data-plan-request-panel aria-labelledby="planner-request-title" hidden></section>' : ''}
    ${lodgingResult()}
    <p class="planner-note"><strong>${esc(breakfastNotice)}</strong> Это предварительная программа. Размещение, время посещения услуг и сопровождение детей подтверждаются отдельно.</p>
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
    <div class="planner-days">
      ${plan.days.map((day, index) => `<article class="planner-day" data-schedule-date="${esc(day.date)}">
        <div class="planner-day-heading"><span>День ${index + 1}</span><h3 tabindex="-1">${esc(dateLabel(day.date))}</h3></div>
        ${undoEdit?.type === 'remove' && undoEdit.date === day.date ? undoMarkup() : ''}
        <ol>${day.items.map((item, index) => eventMarkup(item, day, index)).join('')}</ol>
      </article>`).join('')}
    </div>
    ${confirmations.length ? `<section class="planner-confirmations">
      <h3>Что согласовать заранее</h3>
      <ul>${confirmations.map(({ day, item }) => `<li>
        <span>${esc(dateLabel(day.date))}, ${timeRange(item)}</span>
        <strong>${esc(item.title)}</strong><p>${esc(item.confirmation)}</p>
      </li>`).join('')}</ul>
    </section>` : ''}
    ${plan.notes.length ? `<div class="planner-plan-notes">${plan.notes.map(note => `<p>${esc(note)}</p>`).join('')}</div>` : ''}
    <details class="planner-text">
      <summary>Вся программа обычным текстом</summary>
      <label for="planner-plain-text" class="planner-sr-only">Текст программы для копирования</label>
      <textarea id="planner-plain-text" readonly rows="18">${esc(text)}</textarea>
      <button class="planner-button planner-button-light" data-download>Скачать .txt</button>
    </details>
  </section>`;
  const feedback = root.querySelector('.planner-feedback');
  const pdfButton = root.querySelector('[data-pdf]');
  const pdfReady = root.querySelector('[data-pdf-ready]');
  const pdfLink = root.querySelector('[data-pdf-link]');
  void mountPlanBooking();
  if (holidayApiBase) {
    mountPlanRequests(root, plan, holidayApiBase);
    mountHotelEvents(root.querySelector('[data-hotel-events]'), plan, draftCity, edit => saveItemEdit(edit, edit.date), holidayApiBase);
  }
  root.querySelector('.planner-days').addEventListener('click', event => {
    const button = event.target.closest('[data-item-action]');
    if (!button) return;
    const day = plan.days.find(candidate => candidate.date === button.closest('[data-schedule-date]').dataset.scheduleDate);
    const row = button.closest('.planner-event');
    const item = day?.items.find(candidate => button.dataset.itemAction === 'add'
      ? candidate.kind === 'free' && candidate.start === Number(row.dataset.freeStart)
      : candidate.id === row.dataset.scheduleId);
    if (!item) return;
    if (button.dataset.itemAction === 'remove') {
      const error = saveItemEdit({ type: 'remove', itemId: item.id, itemTitle: item.title }, day.date);
      if (error) feedback.textContent = error;
    } else openItemEditor(button, item, day);
  });
  root.querySelector('[data-undo-item]')?.addEventListener('click', () => {
    const { plan: previous, itemId, date } = undoEdit;
    plan = previous;
    planEdits.pop();
    undoEdit = undefined;
    renderPlan({ scroll: false, message: 'Последняя правка отменена.' });
    focusSchedule(itemId, date);
  });
  pdfButton.addEventListener('click', async () => {
    if (pdfInProgress) return;
    if (preparedPdf) {
      pdfLink.click();
      return;
    }
    const schedule = plan;
    pdfInProgress = true;
    pdfButton.disabled = true;
    feedback.textContent = 'Готовим PDF…';
    try {
      const { prepareHolidayPdfDownload } = await import('./collection-holiday-pdf.js?v=20261109-career-type-1');
      const result = await prepareHolidayPdfDownload(schedule, { lodging });
      if (!pdfButton.isConnected) {
        result.release();
        return;
      }
      preparedPdf = result;
      pdfLink.href = result.url;
      pdfLink.download = result.filename;
      pdfReady.hidden = false;
      feedback.textContent = 'PDF готов. Если скачивание не началось, воспользуйтесь ссылкой ниже.';
      pdfLink.click();
    } catch (error) {
      console.error('Holiday plan PDF export failed', error);
      feedback.textContent = 'PDF не удалось подготовить. Можно повторить попытку или скачать текстовый файл.';
    } finally {
      pdfInProgress = false;
      const currentButton = root.querySelector('[data-pdf]');
      if (currentButton) currentButton.disabled = Boolean(itemEditor);
    }
  });
  bindBookingEdits(root, 'result');
  root.querySelector('[data-edit]').addEventListener('click', () => { current = steps()[0]; renderQuestion(); });
  root.querySelector('[data-edit-outings]').addEventListener('click', () => editOutings('result'));
  root.querySelector('[data-edit-services]').addEventListener('click', () => openQuickEdit('services', 'result'));
  root.querySelector('[data-edit-family]')?.addEventListener('click', () => openQuickEdit('party', 'result'));
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

function restoreDraft() {
  const bookingDraft = bookingScope ? loadHolidayDraft(bookingScope, defaultAnswers) : null;
  if (bookingHandoff || bookingDraft) draftScope = bookingScope;
  const draft = draftScope === draftCity ? loadHolidayDraft(draftCity, defaultAnswers) : bookingDraft;
  const bookingUnavailable = bookingScope && draftScope === draftCity;
  if (!draft) {
    if (bookingHandoff) {
      Object.assign(answers, bookingDefaults());
      bookingCompact = canUseCompactBooking();
      current = steps()[0];
      const saved = saveHolidayDraft(draftScope, { answers, step: current, edits: planEdits, completed: false });
      const dateError = validateAnswers(answers, today(), nowMinute()).endDate;
      showDraftStatus(dateError || bookingStatus, saved);
    } else if (bookingUnavailable) showDraftStatus(bookingFallbackStatus, false);
    renderQuestion(false);
    return;
  }
  Object.assign(answers, draft.answers);
  bookingCompact = canUseCompactBooking();
  planEdits = draft.edits;
  current = steps().includes(draft.step) ? draft.step : steps()[0];
  const restoredStatus = 'Черновик восстановлен из этого браузера.';
  showDraftStatus(bookingUnavailable ? `${bookingFallbackStatus} ${restoredStatus}` : restoredStatus);
  if (draft.completed && !Object.keys(validateAnswers(answers)).length) {
    rebuildPlan({ alreadyPlanned: true });
    renderPlan({ scroll: false, save: false });
    return;
  }
  const errors = validateAnswers(answers, today(), nowMinute());
  if (errors.startDate || errors.arrival) {
    bookingCompact = false;
    current = 'dates';
  } else if (draft.completed) current = steps()[0];
  renderQuestion(false);
}

if (root) {
  let statusBeforeReset;
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
    if (!clearHolidayDraft(draftScope)) {
      showDraftStatus('Браузер не смог удалить черновик.');
      return;
    }
    Object.assign(answers, structuredClone(defaultAnswers), bookingDefaults());
    bookingCompact = canUseCompactBooking();
    current = steps()[0];
    plan = quickEdit = undoEdit = itemEditor = undefined;
    planEdits = [];
    unappliedEdits = [];
    showDraftStatus(bookingHandoff ? bookingStatus : '', false);
    renderQuestion(false);
    root.querySelector('#planner-question').focus();
  });
  restoreDraft();
}
