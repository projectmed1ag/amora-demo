import { interests, services, attractions, mapRoute, demoOrigin, demoOriginLabel, minimumWalkMinutes } from './collection-holiday-data.js';
import { buildHolidayPlan, planToText, validateAnswers, addDays, dateLabel, clock } from './collection-holiday-engine.js';
import { destinationDateParts, destinationLocalDate } from './collection-destinations.js?v=20261024-all-hotels-1';

const root = document.getElementById('planner-app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const today = () => destinationLocalDate(new Date(), 'mozhaysk');
const nowMinute = () => { const { hour, minute } = destinationDateParts(new Date(), 'mozhaysk'); return Number(hour) * 60 + Number(minute); };
const initialDate = addDays(today(), 1);
const answers = {
  startDate: initialDate, endDate: initialDate, arrival: '10:00', departure: '20:00',
  adults: 2, children: 0, ages: [], familyMode: 'together', pace: 'balanced', wake: '09:00', rest: '21:00',
  interests: [], services: [], preferred: Object.fromEntries(services.map(s => [s.id, s.preferred])),
  places: ['nikolsky'], transport: 'auto', origin: demoOrigin, travelMinutes: 45,
};
const questions = {
  dates: 'Когда и на сколько вы приедете?', party: 'Кто едет отдыхать?', rhythm: 'Какой ритм вам ближе?',
  interests: 'Чем хочется наполнить отдых?', routes: 'Куда отправимся за пределы отеля?',
  services: 'Добавим что-нибудь особенное?', review: 'Всё верно? Составим вашу программу.',
};
const stepFields = { dates: ['startDate', 'endDate', 'arrival', 'departure'], party: ['adults', 'children', 'ages', 'familyMode'], rhythm: ['pace', 'wake'], interests: ['interests'], routes: ['places', 'transport', 'travelMinutes'], services: ['services', 'restaurant', 'banya', 'barbecue'], review: [] };
let current = 'dates', plan;
const travelByMode = { auto: 45, walk: 120 };
const steps = () => ['dates', 'party', 'rhythm', 'interests', ...(answers.interests.includes('sights') ? ['routes'] : []), 'services', 'review'];
const checked = value => value ? ' checked' : '';
const selected = value => value ? ' selected' : '';
const field = (name, label, type, value, extra = '') => `<div class="planner-field"><label for="plan-${name}">${label}</label><input id="plan-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
const choice = (name, value, title, detail, active, type = 'radio') => `<label class="planner-choice"><input type="${type}" name="${name}" value="${value}"${checked(active)}><span><strong>${title}</strong>${detail ? `<small>${detail}</small>` : ''}</span></label>`;

function agesMarkup() {
  return `<div class="planner-age-grid">${Array.from({ length: Math.max(0, Math.min(10, answers.children || 0)) }, (_, i) => field(`age-${i}`, `Возраст ребёнка ${i + 1}`, 'number', answers.ages[i] ?? '', 'min="0" max="17" step="1" inputmode="numeric" required')).join('')}</div>`;
}

function summaryLines() {
  return [
    ['Когда', `${answers.startDate} → ${answers.endDate}`, `${answers.arrival}–${answers.departure} · по Москве`],
    ['Компания', `${answers.adults} взрослых${answers.children ? `, ${answers.children} детей` : ', без детей'}`, answers.children ? `Возраст: ${answers.ages.map(age => age === '' ? '?' : age).join(', ')} лет` : 'Время для вас'],
    ['Ритм', { calm: 'Спокойный', balanced: 'Всего понемногу', active: 'Активный' }[answers.pace], `День с ${answers.wake} до ${answers.rest}`],
    ['Интересы', answers.interests.map(id => interests.find(item => item.id === id)?.title).join(', ') || 'Ещё выбираем', ''],
    ['Пожелания', answers.services.map(id => services.find(item => item.id === id)?.title).join(', ') || 'Без дополнительных услуг', ''],
  ];
}

function answerLabel(step) {
  if (step === 'dates') return `${answers.startDate} ${answers.arrival} → ${answers.endDate} ${answers.departure}`;
  if (step === 'party') return `${answers.adults} взрослых${answers.children ? `, детей: ${answers.children}; возраст: ${answers.ages.join(', ')}` : ', без детей'}`;
  if (step === 'rhythm') return `${{ calm: 'Спокойный', balanced: 'Сбалансированный', active: 'Активный' }[answers.pace]} · день ${answers.wake}–${answers.rest}`;
  if (step === 'interests') return answers.interests.map(id => interests.find(item => item.id === id).title).join(', ');
  if (step === 'routes') return `${answers.transport === 'walk' ? 'Пешком' : 'На машине'} · ${answers.places.map(id => attractions.find(item => item.id === id).title).join(', ')}`;
  return answers.services.length ? answers.services.map(id => `${services.find(item => item.id === id).title}, около ${answers.preferred[id]}`).join('; ') : 'Без дополнительных бронирований';
}

function questionMarkup() {
  if (current === 'dates') return `<p class="planner-help">Можно приехать одним днём или остаться с ночёвкой. Учитываю время приезда и отъезда. Всё расписание — по московскому времени.</p><div class="planner-fields">${field('startDate', 'Дата приезда', 'date', answers.startDate, `min="${today()}" required`)}${field('endDate', 'Дата отъезда', 'date', answers.endDate, `min="${answers.startDate}" required`)}${field('arrival', 'Время приезда', 'time', answers.arrival, 'required')}${field('departure', 'Время отъезда', 'time', answers.departure, 'required')}</div>`;
  if (current === 'party') return `<p class="planner-help">С детьми предложу семейные занятия и время для взрослых. Возраст поможет подобрать формат детской программы.</p><div class="planner-fields">${field('adults', 'Взрослые', 'number', answers.adults, 'min="1" max="20" step="1" inputmode="numeric" required')}${field('children', 'Дети до 18 лет', 'number', answers.children, 'min="0" max="10" step="1" inputmode="numeric" required')}</div><div id="plan-children-details"${answers.children ? '' : ' hidden'}><fieldset><legend>Сколько лет детям?</legend><div id="plan-ages">${agesMarkup()}</div></fieldset><fieldset><legend>Как провести семейное время?</legend><div class="planner-choices">${choice('familyMode', 'together', 'В основном вместе', 'Семейные прогулки, игры и общие занятия', answers.familyMode === 'together')}${choice('familyMode', 'separate', 'Часть времени отдельно', 'Детям — программа с аниматором, взрослым — время для себя. Только после подтверждения сопровождения.', answers.familyMode === 'separate')}</div></fieldset></div>`;
  if (current === 'rhythm') return `<div class="planner-choices">${choice('pace', 'calm', 'Никуда не спешить', 'Больше пауз, тишины и отдыха у воды', answers.pace === 'calm')}${choice('pace', 'balanced', 'Всего понемногу', 'Занятия чередуются со свободным временем', answers.pace === 'balanced')}${choice('pace', 'active', 'Больше впечатлений', 'Движение и выезды, с перерывами между занятиями', answers.pace === 'active')}</div><p class="planner-help">Для дней между приездом и отъездом: во сколько удобно начинать и заканчивать программу?</p><div class="planner-fields">${field('wake', 'Начало дня', 'time', answers.wake, 'required')}${field('rest', 'Вечерний отдых с', 'time', answers.rest, 'required')}</div>`;
  if (current === 'interests') return `<p class="planner-help">Отметьте несколько вариантов. Учту сезон: например, в холодные месяцы предложу прогулку вместо велосипеда и тихий отдых вместо пляжа.</p><div class="planner-choices">${interests.map(item => choice('interests', item.id, item.title, item.detail, answers.interests.includes(item.id), 'checkbox')).join('')}</div>`;
  if (current === 'routes') return `<p class="planner-help">Предложу отдельный выезд с дорогой туда и обратно. Места взяты из карты окрестностей сайта.</p><fieldset><legend>Что хотите посмотреть?</legend><div class="planner-choices">${attractions.map(item => choice('places', item.id, item.title, '', answers.places.includes(item.id), 'checkbox')).join('')}</div></fieldset><fieldset><legend>Как добираться?</legend><div class="planner-choices planner-choices-inline">${choice('transport', 'auto', 'На автомобиле', '', answers.transport === 'auto')}${choice('transport', 'walk', 'Пешком', '', answers.transport === 'walk')}</div></fieldset>${field('origin', 'Откуда строить маршрут', 'text', answers.origin, 'maxlength="200"')}<p class="planner-hint">Сейчас: ${demoOriginLabel}. Можно указать свой адрес или координаты.</p><div class="planner-route-preview" id="plan-route-preview"></div>${field('travelMinutes', 'Сколько минут заложить на дорогу в одну сторону?', 'number', answers.travelMinutes, 'min="15" max="240" step="15" inputmode="numeric" required')}<p class="planner-hint">Откройте карту и уточните резерв. Это ваше плановое время, а не расчёт навигатора. В программу войдут оба пути, осмотр и запас на остановки.</p>`;
  if (current === 'services') return `<p class="planner-help">Предложу по одному посещению каждой выбранной услуги за поездку. Если время пересечётся с другим занятием, найду соседнее свободное окно.</p><div class="planner-service-options">${services.map(item => `<div class="planner-service-option">${choice('services', item.id, item.title, item.detail, answers.services.includes(item.id), 'checkbox')}<div class="planner-service-time" data-service-time="${item.id}"${answers.services.includes(item.id) ? '' : ' hidden'}>${field(`preferred-${item.id}`, 'Предпочтительное время', 'time', answers.preferred[item.id])}</div></div>`).join('')}</div><p class="planner-note">Это пожелания к программе. Места, часы работы и аниматор подтверждаются отдельно. Помощник ничего не бронирует автоматически.</p>`;
  return `<p class="planner-help">Соберу дни без пересечений: оставлю время на дорогу, еду, сборы и свободные паузы. Если всё не поместится, покажу, что осталось за рамками программы.</p><dl class="planner-review">${summaryLines().map(([label, text, sub]) => `<div><dt>${label}</dt><dd>${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}</dd></div>`).join('')}</dl>${answers.children ? `<p class="planner-note">${answers.familyMode === 'separate' ? 'Раздельную программу для детей и взрослых отмечу как условную: на весь интервал потребуется подтвердить аниматора.' : 'Детские занятия включу в общую семейную программу. Аниматора можно согласовать отдельно.'}</p>` : ''}`;
}

function capture() {
  const form = root.querySelector('form');
  if (!form) return;
  const data = new FormData(form);
  for (const key of ['startDate', 'endDate', 'arrival', 'departure', 'familyMode', 'pace', 'wake', 'rest', 'transport', 'origin']) if (data.has(key)) answers[key] = data.get(key);
  for (const key of ['adults', 'children', 'travelMinutes']) if (data.has(key)) answers[key] = data.get(key) === '' ? NaN : Number(data.get(key));
  if (current === 'party') answers.ages = Array.from({ length: Math.max(0, Math.min(10, answers.children || 0)) }, (_, i) => data.has(`age-${i}`) ? data.get(`age-${i}`) === '' ? '' : Number(data.get(`age-${i}`)) : answers.ages[i] ?? '');
  for (const key of ['interests', 'places', 'services']) if (({ interests: 'interests', routes: 'places', services: 'services' })[current] === key) answers[key] = data.getAll(key);
  for (const item of services) if (data.has(`preferred-${item.id}`)) answers.preferred[item.id] = data.get(`preferred-${item.id}`);
}

function renderRoutesPreview() {
  const preview = document.getElementById('plan-route-preview');
  if (!preview) return;
  const lowerBound = minimumWalkMinutes(attractions.filter(place => answers.places.includes(place.id)), answers.origin);
  preview.innerHTML = answers.places.map(id => {
    const place = attractions.find(item => item.id === id);
    return `<a href="${esc(mapRoute(place, answers.transport, answers.origin))}" target="_blank" rel="noopener noreferrer">${esc(place.title)} · ${answers.transport === 'walk' ? 'пеший маршрут' : 'на машине'} <span aria-hidden="true">↗</span></a>`;
  }).join('') + (answers.transport === 'walk' ? `<p class="planner-hint">${lowerBound ? `Для выбранных точек нижняя оценка пешей дороги — ${lowerBound} мин в одну сторону. Она рассчитана по расстоянию между точками; реальный путь, особенно с детьми, может занять больше времени.` : 'Вы указали новый адрес. Посмотрите реальное время пешего маршрута на карте и укажите его ниже с запасом.'}</p>` : '');
}

function renderQuestion(focus = true) {
  const sequence = steps(), index = sequence.indexOf(current);
  root.innerHTML = `<div class="planner-layout"><section class="planner-conversation" aria-labelledby="planner-question"><div class="planner-progress"><span>Вопрос ${index + 1} из ${sequence.length}</span><progress value="${index + 1}" max="${sequence.length}" aria-label="Ход составления программы"></progress></div><div class="planner-assistant"><span class="planner-assistant-mark" aria-hidden="true">A</span><p>Помощник A’MORE<small>Соберём поездку по вашим пожеланиям</small></p></div>${index ? `<details class="planner-history"><summary>Ваши предыдущие ответы</summary><ol>${sequence.slice(0, index).map(step => `<li><span>${questions[step]}</span><p>${esc(answerLabel(step))}</p></li>`).join('')}</ol></details>` : ''}<h2 id="planner-question" tabindex="-1">${questions[current]}</h2><form id="holiday-questions" novalidate><div class="planner-errors" role="alert" hidden></div>${questionMarkup()}<div class="planner-question-actions">${index ? '<button type="button" class="planner-button planner-button-light" data-back>Назад</button>' : '<span></span>'}<button class="planner-button" type="submit">${current === 'review' ? 'Составить программу' : 'Продолжить'} <span aria-hidden="true">→</span></button></div></form></section><aside class="planner-sidebar"><p class="planner-eyebrow">Ваш отдых</p><h2>Место для<br>хороших дней.</h2><img src="./images/mozhaysk-render-photos-20261106/panorama/exterior.jpg" width="1672" height="941" alt="Хаусбот с террасой на Можайском водохранилище"><p>В конце получите программу со временем и занятиями. Её можно скопировать или сохранить текстовым файлом.</p><dl>${summaryLines().slice(0, 3).map(([label, text]) => `<div><dt>${label}</dt><dd>${esc(text)}</dd></div>`).join('')}</dl><p class="planner-hint">Расписание — по Москве. Подтверждение услуг остаётся отдельным шагом.</p></aside></div>`;
  const form = root.querySelector('form');
  form.addEventListener('input', event => {
    const oldAges = [...answers.ages];
    if (event.target.name === 'transport') travelByMode[answers.transport] = answers.travelMinutes;
    capture();
    if (event.target.name === 'transport') {
      const lowerBound = answers.transport === 'walk' ? minimumWalkMinutes(attractions.filter(place => answers.places.includes(place.id)), answers.origin) : 0;
      answers.travelMinutes = Math.max(travelByMode[answers.transport], Math.min(240, lowerBound));
      form.elements.travelMinutes.value = answers.travelMinutes;
    }
    if (event.target.name === 'children') {
      answers.ages = Array.from({ length: Math.max(0, Math.min(10, answers.children || 0)) }, (_, i) => oldAges[i] ?? '');
      document.getElementById('plan-children-details').hidden = !answers.children;
      document.getElementById('plan-ages').innerHTML = agesMarkup();
    }
    if (event.target.name === 'startDate') document.getElementById('plan-endDate').min = answers.startDate;
    renderRoutesPreview();
  });
  form.addEventListener('change', () => {
    capture();
    form.querySelectorAll('[data-service-time]').forEach(element => { element.hidden = !answers.services.includes(element.dataset.serviceTime); });
    renderRoutesPreview();
  });
  form.querySelector('[data-back]')?.addEventListener('click', () => { capture(); current = sequence[index - 1]; renderQuestion(); });
  form.addEventListener('submit', event => {
    event.preventDefault(); capture();
    const allErrors = validateAnswers(answers, today(), nowMinute());
    const errors = Object.entries(allErrors).filter(([name]) => current === 'review' || stepFields[current].includes(name));
    if (errors.length) {
      const container = form.querySelector('.planner-errors');
      container.innerHTML = `<p>Уточним несколько деталей:</p><ul>${errors.map(([, text]) => `<li>${esc(text)}</li>`).join('')}</ul>`;
      container.hidden = false; container.tabIndex = -1; container.focus();
      return;
    }
    if (current === 'review') {
      plan = buildHolidayPlan(structuredClone(answers), { today: today(), currentMinute: nowMinute() });
      renderPlan();
    } else { current = steps()[steps().indexOf(current) + 1]; renderQuestion(); }
  });
  renderRoutesPreview();
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

function renderPlan() {
  const text = planToText(plan);
  const confirmations = plan.days.flatMap(day => day.items.filter(item => item.confirmation).map(item => ({ day, item })));
  root.innerHTML = `<section class="planner-result" aria-labelledby="planner-result-title"><div class="planner-result-heading"><div><p class="planner-eyebrow">Личная программа · ${esc(plan.timeZone)}</p><h2 id="planner-result-title" tabindex="-1">Вот как может<br>пройти ваш отдых.</h2><p>${esc(answers.startDate)} — ${esc(answers.endDate)} · Взрослых: ${answers.adults}${answers.children ? ` · Детей: ${answers.children}` : ''}</p></div><div class="planner-result-actions"><button class="planner-button" data-copy>Скопировать текст</button><button class="planner-button planner-button-light" data-download>Скачать .txt</button><button class="planner-edit" data-edit>Изменить ответы</button></div></div><p class="planner-note">Это предложенная программа. Время в ней не означает свободный слот: ресторан, баню, мангальную зону и аниматора нужно подтвердить отдельно.</p><p class="planner-feedback" role="status" aria-live="polite"></p>${plan.unplaced.length ? `<section class="planner-unplaced"><h3>Всё не поместилось</h3><p>Оставил эти пожелания вне расписания, чтобы занятия не пересекались. Можно добавить день или сократить программу.</p><ul>${plan.unplaced.map(item => `<li><strong>${esc(item.title)}</strong> — ${esc(item.reason)}</li>`).join('')}</ul></section>` : ''}<div class="planner-days">${plan.days.map((day, index) => `<article class="planner-day"><div class="planner-day-heading"><span>День ${index + 1}</span><h3>${esc(dateLabel(day.date))}</h3></div><ol>${day.items.map(item => `<li class="planner-event${item.kind === 'free' || item.kind === 'rest' ? ' planner-event-quiet' : ''}"><time>${clock(item.start)}${item.end > item.start ? `<span>— ${clock(item.end)}</span>` : ''}</time><div><h4>${esc(item.title)}</h4><p>${esc(item.detail)}</p>${item.tracks ? `<div class="planner-tracks">${item.tracks.map(track => `<div><span>${esc(track.audience)}</span><h5>${esc(track.title)}</h5><p>${esc(track.detail)}</p></div>`).join('')}</div>` : ''}<div class="planner-event-links">${item.route ? `<a href="${esc(item.route)}" target="_blank" rel="noopener noreferrer">${item.routeLabel || (answers.transport === 'walk' ? 'Пеший маршрут' : 'Маршрут на автомобиле')} ↗</a><a href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">Условия посещения ↗</a>` : ''}${pageLink(item, day)}</div></div></li>`).join('')}</ol></article>`).join('')}</div>${confirmations.length ? `<section class="planner-confirmations"><h3>Что согласовать заранее</h3><ul>${confirmations.map(({ day, item }) => `<li><span>${esc(dateLabel(day.date))}, ${clock(item.start)}–${clock(item.end)}</span><strong>${esc(item.title)}</strong><p>${esc(item.confirmation)}</p></li>`).join('')}</ul></section>` : ''}${plan.notes.length ? `<div class="planner-plan-notes">${plan.notes.map(note => `<p>${esc(note)}</p>`).join('')}</div>` : ''}<details class="planner-text"><summary>Вся программа обычным текстом</summary><label for="planner-plain-text" class="planner-sr-only">Текст программы для копирования</label><textarea id="planner-plain-text" readonly rows="18">${esc(text)}</textarea></details></section>`;
  root.querySelector('[data-edit]').addEventListener('click', () => { current = 'dates'; renderQuestion(); });
  root.querySelector('[data-copy]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); root.querySelector('.planner-feedback').textContent = 'Программа скопирована. Её можно отправить близким или администратору.'; }
    catch { const details = root.querySelector('.planner-text'); details.open = true; const area = details.querySelector('textarea'); area.focus(); area.select(); root.querySelector('.planner-feedback').textContent = 'Автоматическое копирование недоступно. Текст выделен ниже — скопируйте его вручную.'; }
  });
  root.querySelector('[data-download]').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob(['\ufeff', text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `amore-plan-${answers.startDate}.txt`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  root.querySelector('#planner-result-title').focus({ preventScroll: true });
  root.scrollIntoView({ block: 'start', behavior: 'auto' });
}

if (root) renderQuestion(false);
