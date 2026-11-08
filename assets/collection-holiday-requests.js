import { clock, dateLabel } from './collection-holiday-engine.js';

const receiptKey = 'amore-holiday-request-receipts:mozhaysk';
const statuses = { pending: 'На рассмотрении', confirmed: 'Подтверждено', declined: 'Отклонено' };
const serviceLabels = { restaurant: 'Ресторан', banya: 'Баня', transfer: 'Трансфер', childcare: 'Сопровождение детей' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const recentReceipts = new Map();

export function requestableServices(plan) {
  const { adults, children } = plan.answers;
  const result = [];
  for (const day of plan.days) {
    for (const item of day.items) {
      const time = { date: day.date, time: clock(item.start), endTime: clock(item.end) };
      if (['restaurant', 'banya'].includes(item.service)) {
        result.push({ ...time, type: item.service, title: item.title, guests: adults + children, detail: item.confirmation || '' });
      }
      if (item.kind === 'excursion' && ['transfer', 'guided'].includes(item.transport)) {
        result.push({ ...time, type: 'transfer', title: item.title, guests: adults + children,
          detail: item.transport === 'guided' ? 'Нужна экскурсия с транспортом и гидом.' : 'Нужен трансфер туда и обратно.' });
      }
      const child = item.tracks?.find(track => track.audience === 'Дети');
      if (children && child) {
        result.push({ ...time, time: clock(child.start ?? item.start), endTime: clock(child.end ?? item.end),
          type: 'childcare', title: child.title, guests: children,
          detail: `Возраст детей: ${plan.answers.ages.join(', ')}. ${child.detail || ''}`.slice(0, 1000) });
      }
    }
  }
  return result;
}

function receipts(storageKey) {
  const recent = recentReceipts.get(storageKey) || [];
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) {
      for (const item of saved) {
        if (typeof item?.id === 'string' && typeof item.code === 'string' && typeof item.statusToken === 'string'
          && !recent.some(receipt => receipt.id === item.id)) recent.push(item);
      }
    }
  } catch {}
  recentReceipts.set(storageKey, recent);
  return recent;
}

function remember(storageKey, request) {
  const { id, code, statusToken } = request;
  const recent = [{ id, code, statusToken }, ...receipts(storageKey).filter(item => item.id !== id)].slice(0, 30);
  recentReceipts.set(storageKey, recent);
  try {
    localStorage.setItem(storageKey, JSON.stringify(recent));
    return true;
  } catch {
    return false;
  }
}

async function requestJSON(url, options = {}) {
  const unavailable = 'Не удалось связаться с сервисом заявок. Попробуйте ещё раз.';
  const response = await fetch(url, { cache: 'no-store', ...options, credentials: 'omit', redirect: 'error' }).catch(() => null);
  if (!response) throw new Error(unavailable);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.request) {
    throw new Error(data?.error?.message || unavailable);
  }
  return data.request;
}

const schedule = item => `${dateLabel(item.date)} · ${item.time}–${item.endTime} · ${item.type === 'childcare' ? 'Детей' : 'Гостей'}: ${item.guests}`;
const serviceTitle = item => item.title === serviceLabels[item.type] ? item.title : `${serviceLabels[item.type]} · ${item.title}`;

export function mountPlanRequests(root, plan, apiBase) {
  const toggle = root.querySelector('[data-plan-request]');
  const panel = root.querySelector('[data-plan-request-panel]');
  const candidates = requestableServices(plan);
  const endpoint = new URL('plan-requests', apiBase);
  const local = endpoint.origin === location.origin && endpoint.pathname === '/api/local-booking/plan-requests';
  const storageKey = local ? receiptKey : `${receiptKey}:${endpoint.href}`;
  let selectedReceipt, viewEpoch = 0, lastBody, idempotencyKey;
  let sending = false;

  function focusPanel() {
    panel.querySelector('#planner-request-title').focus({ preventScroll: true });
    panel.scrollIntoView({ block: 'start', behavior: 'auto' });
  }

  function shell() {
    const saved = receipts(storageKey);
    panel.innerHTML = `<h3 id="planner-request-title" tabindex="-1">Согласовать с отелем</h3>
      ${saved.length ? `<div class="planner-request-toolbar">
        <label class="planner-field">Мои заявки<select data-receipts>${saved.map(item =>
          `<option value="${esc(item.id)}"${item.id === selectedReceipt?.id ? ' selected' : ''}>${esc(item.code)}</option>`).join('')}</select></label>
        <button type="button" class="planner-button planner-button-light" data-refresh-request>Обновить статусы</button>
        <button type="button" class="planner-edit" data-new-request>Новая заявка</button>
      </div>` : ''}
      <p class="planner-feedback" role="status" data-request-message></p>
      <div data-request-content></div>`;
    panel.querySelector('[data-receipts]')?.addEventListener('change', event => {
      void showReceipt(saved.find(item => item.id === event.target.value));
    });
    panel.querySelector('[data-refresh-request]')?.addEventListener('click', () => {
      const id = panel.querySelector('[data-receipts]').value;
      void showReceipt(saved.find(item => item.id === id));
    });
    panel.querySelector('[data-new-request]')?.addEventListener('click', () => showForm(true));
  }

  function showRequest(request, message = '') {
    shell();
    panel.querySelector('[data-request-message]').textContent = message;
    panel.querySelector('[data-request-content]').innerHTML = `<h4>Заявка ${esc(request.code)}</h4>
      <ul class="planner-request-list">${request.services.map(item => `<li>
        <strong>${esc(serviceTitle(item))}</strong>
        <span class="planner-request-meta">${esc(schedule(item))}</span>
        <span class="planner-request-state" data-request-state="${esc(item.status)}">${esc(statuses[item.status] || item.status)}</span>
        ${item.note ? `<p>${esc(item.note)}</p>` : ''}
      </li>`).join('')}</ul>`;
  }

  async function showReceipt(receipt) {
    if (!receipt || sending) return;
    const epoch = ++viewEpoch;
    selectedReceipt = receipt;
    shell();
    const message = panel.querySelector('[data-request-message]');
    message.textContent = 'Загружаем статусы заявки…';
    try {
      const request = await requestJSON(`${endpoint.href}/${encodeURIComponent(receipt.id)}`, { headers: { 'X-Plan-Request-Token': receipt.statusToken } });
      if (epoch === viewEpoch) showRequest(request);
    } catch (error) {
      if (epoch === viewEpoch) message.textContent = error.message;
    }
  }

  function showForm(focus = false) {
    if (sending) return;
    viewEpoch++;
    selectedReceipt = undefined;
    shell();
    const content = panel.querySelector('[data-request-content]');
    if (!candidates.length) {
      content.innerHTML = '<p>В плане пока нет услуг для согласования. Добавьте ресторан, баню, выезд с трансфером или отдельное занятие для детей с аниматором.</p>';
      return;
    }
    content.innerHTML = `<p>Выберите услуги из расписания. Отель ответит по каждой отдельно.</p>
      <form aria-label="Заявка на согласование услуг">
        <fieldset><legend>Какие услуги согласовать</legend>
          <div class="planner-choices">${candidates.map((item, index) => `<label class="planner-choice">
            <input type="checkbox" name="service" value="${index}" checked>
            <span><strong>${esc(serviceTitle(item))}</strong><small>${esc(schedule(item))}</small>
              ${item.detail ? `<small>${esc(item.detail)}</small>` : ''}</span>
          </label>`).join('')}</div>
        </fieldset>
        <div class="planner-fields">
          <div class="planner-field"><label for="plan-request-name">Имя</label><input id="plan-request-name" name="guestName" autocomplete="name" maxlength="120" required></div>
          <div class="planner-field"><label for="plan-request-contact">Телефон или email</label><input id="plan-request-contact" name="contact" maxlength="254" required></div>
        </div>
        <p>Отель сможет связаться с вами по этому контакту. Статусы заявки доступны в этом браузере.</p>
        <p class="planner-errors" role="alert" tabindex="-1" hidden></p>
        <button type="submit" class="planner-button">Отправить заявку</button>
      </form>`;
    const form = content.querySelector('form');
    const errorLine = form.querySelector('[role="alert"]');
    const submit = form.querySelector('[type="submit"]');
    if (focus) form.elements.guestName.focus();
    form.addEventListener('input', () => { errorLine.hidden = true; });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending) return;
      const data = new FormData(form);
      const selected = data.getAll('service').map(index => candidates[Number(index)]);
      if (!selected.length) {
        errorLine.textContent = 'Выберите хотя бы одну услугу.';
        errorLine.hidden = false;
        errorLine.focus();
        return;
      }
      const payload = {
        city: 'mozhaysk', guestName: data.get('guestName').trim(), contact: data.get('contact').trim(), services: selected,
      };
      const body = JSON.stringify(payload);
      if (body !== lastBody) {
        lastBody = body;
        idempotencyKey = crypto.randomUUID();
      }
      sending = true;
      submit.disabled = true;
      submit.textContent = 'Отправляем…';
      try {
        const request = await requestJSON(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, idempotencyKey }),
        });
        const stored = remember(storageKey, request);
        selectedReceipt = receipts(storageKey)[0];
        lastBody = undefined;
        showRequest(request, stored ? 'Заявка отправлена. Услуги ожидают ответа отеля.'
          : 'Заявка отправлена. Браузер не смог сохранить доступ к статусам после закрытия страницы.');
        focusPanel();
      } catch (error) {
        errorLine.textContent = error.message;
        errorLine.hidden = false;
        errorLine.focus();
      } finally {
        sending = false;
        submit.disabled = false;
        submit.textContent = 'Отправить заявку';
      }
    });
  }

  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    if (panel.hidden) return;
    if (!panel.hasChildNodes()) {
      const latest = receipts(storageKey)[0];
      if (latest) void showReceipt(latest);
      else showForm();
    }
    focusPanel();
  });
}
