// Service requests are local previews. No endpoint, storage or transmission of
// contact details is involved in this workflow.
const services = Object.freeze({
  banya: {
    name: 'Баня',
    title: 'Бронирование бани.',
    page: './banya.html?city=mozhaysk',
    description: 'Отдельная заявка на посещение бани. Дата, время и число гостей относятся только к бане.',
    back: 'Вернуться к бане',
    action: 'Забронировать баню',
  },
  restaurant: {
    name: 'Столик в ресторане',
    title: 'Столик в ресторане.',
    page: './restaurant.html?city=mozhaysk',
    description: 'Отдельная заявка на столик в ресторане. Дата, время и число гостей относятся только к ресторану.',
    back: 'Вернуться к ресторану',
    action: 'Забронировать столик',
  },
  pavilion: {
    name: 'Аренда павильона',
    title: 'Аренда павильона.',
    page: './pavilions.html?city=mozhaysk',
    description: 'Заявка на аренду павильона для праздника или встречи. Укажите желаемую дату, время и число гостей.',
    back: 'Вернуться к павильонам',
    action: 'Оставить заявку на аренду',
  },
});

const visitFields = ['service', 'date', 'time', 'guests'];
const fieldNames = [...visitFields, 'name', 'phone', 'email', 'notes'];
const fieldLabels = {
  service: 'Услуга', date: 'Дата', time: 'Время', guests: 'Гости',
  name: 'Имя', phone: 'Телефон', email: 'Email', notes: 'Пожелания',
};

function moscowParts(now) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
}

export function serviceLocalDate(now = new Date()) {
  const { year, month, day } = moscowParts(now);
  return `${year}-${month}-${day}`;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateVisit(values, now) {
  const errors = {};
  if (!Object.hasOwn(services, values.service || '')) errors.service = 'Выберите услугу.';
  const today = serviceLocalDate(now);
  if (!validDate(values.date)) errors.date = 'Укажите корректную дату посещения.';
  else if (values.date < today) errors.date = 'Дата посещения не может быть в прошлом.';
  const timeValid = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(values.time || '');
  if (!timeValid) errors.time = 'Укажите желаемое время посещения.';
  else if (validDate(values.date) && values.date === today) {
    const { hour, minute } = moscowParts(now);
    const currentMinutes = Number(hour) * 60 + Number(minute);
    const [hours, minutes] = values.time.split(':').map(Number);
    if (hours * 60 + minutes <= currentMinutes) errors.time = 'Выберите время позже текущего времени по Москве.';
  }
  const guests = Number(values.guests);
  if (values.service === 'pavilion') {
    if (!Number.isSafeInteger(guests) || guests < 1) errors.guests = 'Укажите целое число гостей больше нуля.';
  } else if (!Number.isInteger(guests) || guests < 1 || guests > 20) errors.guests = 'Укажите целое число гостей от 1 до 20.';
  return errors;
}

export function normalizeServicePhone(value) {
  const phone = String(value || '').trim();
  if (!phone || phone.length > 40 || !/^\+?[\d\s().-]+$/.test(phone)) return null;
  let digits = phone.replace(/\D/g, '');
  if (phone.startsWith('+')) {
    if (!phone.startsWith('+7') || digits.length !== 11) return null;
    digits = digits.slice(1);
  } else if (digits.length === 11 && /^[78]/.test(digits)) {
    digits = digits.slice(1);
  }
  return /^\d{10}$/.test(digits) ? `+7${digits}` : null;
}

export function formatServicePhone(digits) {
  const national = String(digits || '').replace(/\D/g, '').slice(0, 10);
  if (!national) return '';
  let formatted = `(${national.slice(0, 3)}`;
  if (national.length >= 3) formatted += ')';
  if (national.length > 3) formatted += ` ${national.slice(3, 6)}`;
  if (national.length > 6) formatted += `-${national.slice(6, 8)}`;
  if (national.length > 8) formatted += `-${national.slice(8, 10)}`;
  return formatted;
}

function initializePhoneInput(input) {
  const countDigits = value => (value.match(/\d/g) || []).length;
  let internalInput = false;
  input.closest('.service-phone-control')?.addEventListener('click', event => {
    if (event.target !== input) input.focus();
  });

  function caretAfterDigit(value, count) {
    if (!count) return value.startsWith('(') ? 1 : 0;
    let seen = 0;
    for (let index = 0; index < value.length; index += 1) {
      if (/\d/.test(value[index])) seen += 1;
      if (seen === count) {
        let caret = index + 1;
        while (caret < value.length && !/\d/.test(value[caret])) caret += 1;
        return caret;
      }
    }
    return value.length;
  }

  function render(digits, caretDigits, notify = false) {
    input.value = formatServicePhone(digits);
    delete input.dataset.invalidPhone;
    if (document.activeElement === input) {
      const caret = caretAfterDigit(input.value, caretDigits);
      input.setSelectionRange(caret, caret);
    }
    if (notify) {
      internalInput = true;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      internalInput = false;
    }
  }

  function rejectCountry() {
    render('', 0, true);
    input.dataset.invalidPhone = 'true';
    input.setAttribute('aria-invalid', 'true');
    const error = document.getElementById('service-error-phone');
    if (error) {
      error.textContent = 'Код страны зафиксирован: +7. Введите 10 цифр номера.';
      error.hidden = false;
    }
  }

  input.addEventListener('beforeinput', event => {
    if (event.isComposing) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const digits = input.value.replace(/\D/g, '');
    const from = countDigits(input.value.slice(0, start));
    const to = countDigits(input.value.slice(0, end));
    if (event.inputType === 'insertText' && event.data) {
      // The country prefix is outside this editable field. Ordinary typing
      // accepts only the ten national digits; full numbers work through paste.
      if (!/^\d+$/.test(event.data) || digits.length - (to - from) + event.data.length > 10) event.preventDefault();
      return;
    }
    if (start !== end || !['deleteContentBackward', 'deleteContentForward'].includes(event.inputType)) return;
    const backward = event.inputType === 'deleteContentBackward';
    const adjacent = backward ? input.value[start - 1] : input.value[start];
    if (!adjacent || /\d/.test(adjacent)) return;
    const index = backward ? from - 1 : from;
    if (index < 0 || index >= digits.length) return;
    event.preventDefault();
    render(digits.slice(0, index) + digits.slice(index + 1), backward ? from - 1 : from, true);
  });

  input.addEventListener('paste', event => {
    if (!event.clipboardData) return;
    event.preventDefault();
    const text = event.clipboardData.getData('text').trim();
    const canonical = normalizeServicePhone(text);
    // A full number replaces the national field even when the caret is in
    // its middle. A short digit fragment is inserted at the current selection.
    if (canonical) {
      render(canonical.slice(2), 10, true);
      return;
    }
    const fragment = text.replace(/\D/g, '');
    if (!/^\d[\d\s().-]*$/.test(text) || fragment.length > 10) {
      rejectCountry();
      return;
    }
    const digits = input.value.replace(/\D/g, '');
    const start = countDigits(input.value.slice(0, input.selectionStart ?? input.value.length));
    const end = countDigits(input.value.slice(0, input.selectionEnd ?? input.value.length));
    const combined = digits.slice(0, start) + fragment + digits.slice(end);
    if (combined.length > 10) return;
    render(combined, start + fragment.length, true);
  });

  input.addEventListener('input', event => {
    if (internalInput || event.isComposing) return;
    const raw = input.value;
    const before = raw.slice(0, input.selectionStart ?? raw.length);
    const canonical = normalizeServicePhone(raw);
    const rawDigits = raw.replace(/\D/g, '');
    if ((raw.startsWith('+') && !canonical) || rawDigits.length > 10 && !canonical || /[^\d\s().-]/.test(raw.replace(/^\+/, ''))) {
      rejectCountry();
      return;
    }
    const removedCountry = canonical && rawDigits.length === 11 ? 1 : 0;
    render(canonical ? canonical.slice(2) : rawDigits, Math.max(0, countDigits(before) - removedCountry));
  });
  if (input.value) {
    const canonical = normalizeServicePhone(input.value);
    render(canonical ? canonical.slice(2) : '', 0);
  }
}

export function validateServiceRequest(values, now = new Date()) {
  const errors = validateVisit(values, now);
  if (!values.name?.trim()) errors.name = 'Укажите ваше имя.';
  else if (values.name.trim().length > 100) errors.name = 'Сократите имя до 100 символов.';
  if (!normalizeServicePhone(values.phone)) errors.phone = 'Введите 10 цифр номера после +7.';
  const email = values.email?.trim() || '';
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) errors.email = 'Укажите email в формате name@example.com.';
  if ((values.notes || '').length > 1000) errors.notes = 'Сократите пожелания до 1000 символов.';
  return errors;
}

function readableDate(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function initServiceBooking() {
  const form = document.getElementById('service-request-form');
  if (!form || form.dataset.serviceReady) return;
  const result = document.getElementById('service-request-result');
  const details = document.getElementById('service-result-details');
  const resultTitle = document.getElementById('service-result-title');
  const edit = document.getElementById('service-edit-request');
  const errorSummary = document.getElementById('service-form-errors');
  const submit = form.querySelector('[type="submit"]');
  const next = document.getElementById('service-visit-next');
  const visitStep = document.getElementById('service-visit-step');
  const contactStep = document.getElementById('service-contact-step');
  const editVisit = document.getElementById('service-edit-visit');
  const visitSummary = document.getElementById('service-visit-summary');
  const controls = Object.fromEntries(fieldNames.map(name => [name, form.elements.namedItem(name)]));
  if (!result || !details || !resultTitle || !edit || !errorSummary || !submit || !next || !visitStep || !contactStep || !editVisit || !visitSummary || Object.values(controls).some(control => !control)) return;

  const fixedService = Object.hasOwn(services, form.dataset.service || '') ? form.dataset.service : null;
  const readValues = () => {
    const values = Object.fromEntries(new FormData(form));
    if (fixedService) values.service = fixedService;
    values.phone = controls.phone.dataset.invalidPhone ? '' : normalizeServicePhone(values.phone) || values.phone;
    return values;
  };
  initializePhoneInput(controls.phone);
  const queryService = new URLSearchParams(location.search).get('service');
  if (fixedService) controls.service.value = fixedService;
  else if (queryService && Object.hasOwn(services, queryService)) controls.service.value = queryService;
  let step = 'visit';

  function clearErrors() {
    fieldNames.forEach(clearError);
    errorSummary.replaceChildren();
    errorSummary.hidden = true;
  }

  function showStep(nextStep, focus = true) {
    step = nextStep;
    document.querySelectorAll('[data-service-step-indicator]').forEach(indicator => {
      if (indicator.dataset.serviceStepIndicator === step) indicator.setAttribute('aria-current', 'step');
      else indicator.removeAttribute('aria-current');
    });
    visitStep.hidden = step !== 'visit';
    contactStep.hidden = step !== 'contact';
    submit.disabled = step !== 'contact';
    if (!focus) return;
    if (step === 'contact') controls.name.focus();
    else (fixedService ? controls.date : controls.service).focus();
  }

  function clearError(name) {
    const error = document.getElementById(`service-error-${name}`);
    if (!error || !controls[name]) return;
    error.hidden = true;
    error.textContent = '';
    controls[name].removeAttribute('aria-invalid');
  }

  function refreshDateLimit() {
    controls.date.min = serviceLocalDate();
  }

  function updateService() {
    if (fixedService) controls.service.value = fixedService;
    const service = services[controls.service.value];
    const title = document.querySelector('[data-service-page-title]');
    const description = document.getElementById('service-aside-description');
    const link = document.getElementById('service-details-link');
    if (title) title.textContent = service?.title || 'Бронирование услуги.';
    if (description) description.textContent = service?.description || 'Выберите баню или столик в ресторане. Дата, время и число гостей относятся только к выбранной услуге.';
    if (link) {
      link.hidden = !service;
      if (service) link.href = service.page;
    }
    const submitLabel = document.getElementById('service-submit-label');
    if (submitLabel) submitLabel.textContent = service?.action || 'Подготовить заявку';
    // Fixed service pages retain their own #reservation link and heading.
    if (fixedService) return;
    const url = new URL(location.href);
    url.search = '';
    if (service) url.searchParams.set('service', controls.service.value);
    else url.searchParams.delete('service');
    url.searchParams.set('city', 'mozhaysk');
    // Only service/city navigation state enters the URL; contact fields do not.
    history.replaceState(history.state, '', url);
    const bookingLink = document.querySelector('[data-service-booking-link]');
    if (bookingLink) bookingLink.href = url.href.split('#')[0];
  }

  function showErrors(errors) {
    clearErrors();
    const heading = document.createElement('p');
    heading.textContent = 'Проверьте отмеченные поля.';
    const list = document.createElement('ul');
    for (const [name, message] of Object.entries(errors)) {
      controls[name].setAttribute('aria-invalid', 'true');
      const error = document.getElementById(`service-error-${name}`);
      if (error) {
        error.textContent = message;
        error.hidden = false;
      }
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${controls[name].id}`;
      link.textContent = `${fieldLabels[name]}: ${message}`;
      item.append(link);
      list.append(item);
    }
    errorSummary.replaceChildren(heading, list);
    errorSummary.hidden = false;
    const first = Object.keys(errors).find(name => controls[name].type !== 'hidden');
    if (first) controls[first].focus();
  }

  function renderSummary(values) {
    const service = services[values.service];
    const rows = [
      ['Услуга', service.name],
      ['Место', 'Можайское водохранилище'],
      ['Дата', readableDate(values.date)],
      ['Желаемое время', `${values.time} по Москве`],
      ['Число гостей', String(Number(values.guests))],
      ['Имя', values.name.trim()],
      ['Телефон', values.phone.trim()],
    ];
    if (values.email?.trim()) rows.push(['Email', values.email.trim()]);
    if (values.notes?.trim()) rows.push(['Пожелания', values.notes.trim()]);
    details.replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      row.append(term, description);
      return row;
    }));
    const back = document.getElementById('service-result-back');
    if (back) {
      back.href = service.page;
      const label = document.createElement('span');
      label.textContent = service.back;
      const arrow = back.querySelector('svg');
      back.replaceChildren(label);
      if (arrow) back.append(arrow);
    }
  }

  function advanceToContacts() {
    if (form.hidden) return;
    refreshDateLimit();
    const values = readValues();
    const errors = validateVisit(values, new Date());
    if (Object.keys(errors).length) {
      showStep('visit', false);
      showErrors(errors);
      return;
    }
    clearErrors();
    const guests = Number(values.guests);
    const guestWord = guests % 10 === 1 && guests % 100 !== 11 ? 'гость' : guests % 10 >= 2 && guests % 10 <= 4 && (guests % 100 < 12 || guests % 100 > 14) ? 'гостя' : 'гостей';
    visitSummary.textContent = `${readableDate(values.date)} · ${values.time} по Москве · ${guests} ${guestWord}`;
    showStep('contact');
  }

  form.addEventListener('input', event => {
    if (fieldNames.includes(event.target.name)) clearError(event.target.name);
    errorSummary.hidden = true;
  });
  form.addEventListener('change', event => {
    if (fieldNames.includes(event.target.name)) clearError(event.target.name);
    if (event.target.name === 'service') updateService();
    refreshDateLimit();
  });
  next.addEventListener('click', advanceToContacts);
  editVisit.addEventListener('click', () => {
    clearErrors();
    showStep('visit');
  });
  form.addEventListener('keydown', event => {
    if (step === 'visit' && event.key === 'Enter' && !event.isComposing && !['BUTTON', 'TEXTAREA'].includes(event.target.tagName)) {
      event.preventDefault();
      advanceToContacts();
    }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (form.hidden) return;
    if (step === 'visit') {
      advanceToContacts();
      return;
    }
    refreshDateLimit();
    const values = readValues();
    const errors = validateServiceRequest(values);
    if (Object.keys(errors).length) {
      if (Object.keys(errors).some(name => visitFields.includes(name))) showStep('visit', false);
      showErrors(errors);
      return;
    }
    clearErrors();
    renderSummary(values);
    form.hidden = true;
    result.hidden = false;
    submit.disabled = true;
    document.querySelectorAll('[data-service-step-indicator]').forEach(indicator => indicator.removeAttribute('aria-current'));
    resultTitle.focus({ preventScroll: true });
    result.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
  edit.addEventListener('click', () => {
    result.hidden = true;
    form.hidden = false;
    refreshDateLimit();
    clearErrors();
    showStep('contact');
  });
  window.addEventListener('pageshow', refreshDateLimit);
  form.dataset.serviceReady = 'true';
  refreshDateLimit();
  updateService();
  next.disabled = false;
  showStep('visit', false);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initServiceBooking, { once: true });
  else initServiceBooking();
}
