import { answerHolidayChat } from './collection-holiday-chat-intents.js?v=20261119-quarter-hour-1';
import { answerHolidayChatFollowup } from './collection-holiday-chat-followups.js?v=20261119-quarter-hour-1';
import { answerHolidayChatEvents } from './collection-holiday-chat-events.js?v=20261120-programme-download-1';
import { answerHolidayChatHotel } from './collection-holiday-chat-hotel.js?v=20261112-chat-3';

const family = { label: 'Для детей', description: 'Игры и прогулки', icon: 'family', query: 'Что есть в отеле для детей?' };
const examples = [
  { label: 'Подобрать занятие', description: 'Идеи на свободное время', icon: 'trail', query: 'Подбери занятие в свободное время', featured: true },
  { label: 'Что дальше?', description: 'Ближайшее занятие', icon: 'clock', query: 'Что дальше?' },
  { label: 'Что завтра?', description: 'План на день', icon: 'calendar', query: 'Что завтра?' },
  { label: 'Афиша отеля', description: 'События на ваши даты', icon: 'ticket', query: 'Какие события в отеле на даты моей поездки?' },
  { label: 'Возможности отеля', description: 'От бани до проката', icon: 'house', query: 'Какие есть плюшки в отеле?' },
  family,
];
const guideExamples = [
  { label: 'Ближайшие события', description: 'Афиша отеля', icon: 'ticket', query: 'Какие ближайшие события в отеле?', featured: true },
  family,
  { label: 'Ресторан и меню', description: 'Завтраки и детское меню', icon: 'restaurant', query: 'Расскажи про ресторан' },
  { label: 'Баня', description: 'Сеансы и парение', icon: 'steam', query: 'Расскажи про баню' },
  { label: 'Развлечения', description: 'Чем заняться по сезону', icon: 'trail', query: 'Расскажи про развлечения на территории' },
  { label: 'Как добраться', description: 'Маршрут и трансфер', icon: 'pin', query: 'Как добраться до отеля?' },
];

const icons = {
  chat: 'M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2.5 6h.01m4.5 0h.01m4.5 0h.01',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  calendar: 'M7 3v4m10-4v4M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  trail: 'm2 17 6-8 4 5 4-7 6 10H2Zm6-3 2 3m5-4 2 4',
  ticket: 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4V7Zm10 2v1m0 2v1m0 2v1',
  house: 'm3 11 9-7 9 7m-16-1v10h14V10m-9 10v-6h4v6',
  family: 'M11 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm8 3a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM3 20v-2a5 5 0 0 1 10 0v2m1 0h7v-1a4 4 0 0 0-5-3.9',
  restaurant: 'M4 3v5a3 3 0 0 0 6 0V3M7 3v18m12 0V3c-3 2-4 5-4 9h4',
  steam: 'M4 16h16l-1.5 4h-13L4 16Zm3-3c-2-3 2-3 0-6m5 6c-2-3 2-4 0-8m5 8c-2-3 2-3 0-6',
  pin: 'M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 0 1 14 0ZM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
};

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function action(label, className, onClick) {
  const button = element('button', className, label);
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}

function icon(name, className) {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS(namespace, 'path');
  path.setAttribute('d', icons[name]);
  svg.append(path);
  return svg;
}

export function mountHolidayChat(host, { state, getPlan, getClock, getEvents, getGuideDates, applyEdit, preparePdf, interpretMessage }) {
  state.messages ??= [];
  state.suggestions ??= [];
  const guide = !getPlan();
  const defaults = guide ? guideExamples : examples;
  let waiting = false;
  const panel = element('section', 'planner-chat');
  panel.dataset.mode = guide ? 'guide' : 'plan';
  const summary = element('div', 'planner-chat-summary');
  const title = element('h2', '', guide ? 'Чем помочь с поездкой?' : 'Что хотите сделать с планом?');
  title.id = `${host.id}-title`;
  panel.setAttribute('aria-labelledby', title.id);
  summary.append(icon('chat', 'planner-chat-header-icon'), title);

  const body = element('div', 'planner-chat-body');
  const messages = element('ol', 'planner-chat-messages');
  messages.setAttribute('role', 'log');
  messages.setAttribute('aria-label', 'Переписка с помощником');
  messages.setAttribute('aria-live', 'polite');
  messages.tabIndex = 0;
  const options = element('div', 'planner-chat-options');

  const form = element('form', 'planner-chat-form');
  const label = element('label', '', 'Сообщение');
  const composer = element('div', 'planner-chat-composer');
  const input = element('input');
  input.id = `${host.id || 'planner-chat'}-input`;
  input.type = 'text';
  input.maxLength = 300;
  input.placeholder = guide ? 'Вопрос об отеле' : 'Вопрос о плане';
  input.enterKeyHint = 'send';
  input.autocomplete = 'off';
  input.value = state.input ?? '';
  label.htmlFor = input.id;
  const send = element('button', 'planner-button', 'Отправить');
  send.type = 'submit';
  const hint = element('p', 'planner-chat-hint');
  hint.id = `${input.id}-hint`;
  hint.hidden = true;
  const processing = element('p', 'planner-chat-processing', 'Подбираю ответ…');
  processing.setAttribute('role', 'status');
  processing.hidden = true;
  composer.append(input, send);
  form.append(label, composer, hint, processing);
  body.append(summary, messages, options, form);
  panel.append(body);

  function scrollMessages() {
    messages.scrollTop = messages.scrollHeight;
  }

  function appendPdfAction(row) {
    const label = 'Скачать обновлённый PDF';
    const className = 'planner-chat-choice planner-chat-pdf';
    const status = element('span', 'planner-chat-pdf-status');
    status.setAttribute('role', 'status');
    const button = action(label, className, async () => {
      if (button.hasAttribute('aria-disabled')) return;
      button.setAttribute('aria-disabled', 'true');
      status.textContent = 'Готовим PDF…';
      try {
        const file = await preparePdf();
        if (!button.isConnected) return;
        if (!file) {
          status.textContent = '';
          return;
        }
        const link = element('a', className, label);
        link.href = file.url;
        link.download = file.filename;
        const hadFocus = document.activeElement === button;
        button.replaceWith(link);
        status.textContent = 'PDF готов. Если скачивание не началось, нажмите на ссылку ещё раз.';
        if (hadFocus) {
          link.focus({ preventScroll: true });
          scrollMessages();
        }
        link.click();
      } catch {
        status.textContent = 'PDF не удалось подготовить. Попробуйте ещё раз.';
      } finally {
        button.removeAttribute('aria-disabled');
      }
    });
    row.append(button, status);
  }

  function messageNode({ role, text, links, pdf }) {
    const row = element('li', `planner-chat-message planner-chat-message-${role}`);
    row.append(element('span', 'planner-chat-author', role === 'user' ? 'Вы' : 'Помощник'), element('p', '', text));
    if (links?.length) {
      const list = element('ul', 'planner-chat-links');
      for (const { label, href } of links) {
        const url = new URL(href, document.baseURI);
        if (url.origin !== location.origin) continue;
        const link = element('a', '', label);
        link.href = url.href;
        if (!href.startsWith('#')) {
          link.target = '_blank';
          link.rel = 'noopener';
        }
        const item = element('li');
        item.append(link);
        list.append(item);
      }
      if (list.childElementCount) row.append(list);
    }
    if (pdf && preparePdf) appendPdfAction(row);
    return row;
  }

  function rememberMessage(message) {
    state.messages.push(message);
    if (state.messages.length > 32) state.messages.shift();
  }

  function showMessage(message) {
    messages.hidden = false;
    messages.append(messageNode(message));
    if (messages.childElementCount > 32) messages.firstElementChild.remove();
    scrollMessages();
  }

  function addMessage(role, text, links) {
    const message = { role, text, links };
    rememberMessage(message);
    showMessage(message);
  }

  function cancelProposal() {
    state.pending = null;
    state.suggestions = [];
    addMessage('assistant', 'Изменение отменено.');
    renderOptions();
    input.focus();
  }

  function confirmProposal() {
    const { selected, plan } = state.pending ?? {};
    if (waiting || !getPlan() || !selected) return;
    if (plan !== getPlan()) {
      state.pending = null;
      state.suggestions = [];
      addMessage('assistant', 'План изменился. Повторите просьбу, чтобы я проверил новое расписание.');
      renderOptions();
      input.focus();
      return;
    }

    // A successful edit rebuilds the chat from its message history.
    state.pending = null;
    state.suggestions = [];
    state.focusEditResult = true;
    const success = { role: 'assistant', text: 'План обновлён.', pdf: true };
    rememberMessage(success);
    const error = applyEdit(selected.edit);
    if (error) {
      success.text = error;
      success.pdf = false;
      showMessage(success);
      state.focusEditResult = false;
      renderOptions();
      input.focus();
    }
  }

  function renderOptions() {
    options.replaceChildren();
    const pending = state.pending;
    let hintText = '';
    if (['add', 'move'].includes(pending?.selected?.edit.type)) {
      hintText = 'Чтобы сдвинуть время, напишите «на час позже».';
    } else if (pending && !pending.selected && pending.proposals.length > 1) {
      hintText = 'Выберите вариант или напишите «давай второй вариант».';
    }
    hint.textContent = hintText;
    hint.hidden = waiting || !hintText;
    if (hint.hidden) input.removeAttribute('aria-describedby');
    else input.setAttribute('aria-describedby', hint.id);
    if (waiting) return;
    if (pending?.selected) {
      options.append(element('p', 'planner-chat-preview', pending.selected.label));
      if (pending.selected.notice) options.append(element('p', 'planner-chat-notice', pending.selected.notice));
      const actions = element('div', 'planner-chat-actions');
      actions.append(
        action('Применить', 'planner-button planner-chat-apply', confirmProposal),
        action('Отмена', 'planner-button planner-button-light planner-chat-cancel', cancelProposal),
      );
      if (pending.proposals.length > 1) {
        actions.append(action('Другие варианты', 'planner-button planner-button-light', () => {
          pending.selected = null;
          renderOptions();
          options.querySelector('button')?.focus();
        }));
      }
      options.append(actions);
    } else {
      const choices = pending?.proposals ?? (state.suggestions.length ? state.suggestions : defaults);
      const showTopics = choices === defaults && state.messages.length === 0;
      const list = element('ul', showTopics ? 'planner-chat-suggestions' : '');
      for (const [index, choice] of choices.entries()) {
        const row = element('li');
        const label = pending && choices.length > 1 ? `${index + 1}. ${choice.label}` : choice.label;
        const button = action(showTopics ? '' : label, showTopics ? 'planner-chat-topic' : 'planner-chat-choice', () => {
          if (pending) {
            pending.selected = choice;
            renderOptions();
            options.querySelector('.planner-chat-apply')?.focus();
          } else void sendMessage(choice.query);
        });
        if (showTopics) {
          const copy = element('span', 'planner-chat-topic-copy');
          const description = element('small', '', choice.description);
          description.id = `${host.id}-topic-${index}`;
          button.setAttribute('aria-label', choice.label);
          button.setAttribute('aria-describedby', description.id);
          copy.append(element('strong', '', label), description);
          button.append(icon(choice.icon, 'planner-chat-topic-icon'), copy);
          if (choice.featured) button.dataset.featured = 'true';
        }
        row.append(button);
        list.append(row);
      }
      if (pending?.recommendation?.hasMore) {
        const row = element('li');
        row.append(action('Ещё занятия', 'planner-chat-choice planner-chat-more', () => void sendMessage('Покажи другие занятия')));
        list.append(row);
      }
      options.append(list);
    }
  }

  async function sendMessage(value, typed = false) {
    if (waiting) return;
    const question = value.trim();
    if (!question) {
      input.focus();
      return;
    }
    input.value = state.input = '';
    addMessage('user', question);
    const plan = getPlan();
    const clock = getClock();
    if (state.pending && state.pending.plan !== plan) {
      state.pending = null;
      state.suggestions = [];
    }
    const followup = plan ? answerHolidayChatFollowup(plan, question, state.pending, clock) : null;
    const eventAnswer = followup ? null : answerHolidayChatEvents(plan, question, clock, getEvents, getGuideDates?.());
    const localPlanAnswer = plan && !followup && !eventAnswer
      ? answerHolidayChat(plan, question, { ...clock, recommendation: state.pending?.recommendation }) : null;
    let answer = followup ?? eventAnswer ?? (localPlanAnswer?.local ? localPlanAnswer
      : answerHolidayChatHotel(plan, question, clock) ?? localPlanAnswer) ?? {
      text: 'Могу рассказать об отеле, занятиях и афише. Чтобы подобрать занятие на свободное время или изменить расписание, откройте «План отдыха» и составьте программу.',
      local: true,
    };
    const loadingEvents = typeof answer.then === 'function';
    if (loadingEvents || (typed && !followup && !answer.local && plan && typeof interpretMessage === 'function')) {
      waiting = send.disabled = true;
      processing.hidden = false;
      state.pending = null;
      state.suggestions = [];
      renderOptions();
      try {
        if (loadingEvents) answer = await answer;
        else {
          const result = await interpretMessage(question);
          const interpreted = typeof result === 'string' ? result.trim() : '';
          if (interpreted && interpreted.length <= input.maxLength && panel.isConnected && plan === getPlan()) {
            answer = answerHolidayChat(plan, interpreted, getClock());
          }
        }
      } catch {
        if (loadingEvents) answer = { text: 'Афиша сейчас недоступна. Попробуйте спросить чуть позже.' };
      } finally {
        waiting = send.disabled = false;
        processing.hidden = true;
      }
      if (!panel.isConnected) return;
      if (plan !== getPlan()) {
        addMessage('assistant', 'План изменился. Повторите просьбу, чтобы я проверил новое расписание.');
        renderOptions();
        input.focus();
        return;
      }
    }
    addMessage('assistant', answer.text, answer.links);
    if (!answer.keepPending) {
      const proposals = answer.proposals ?? [];
      const selected = proposals[answer.selectedIndex] ?? (proposals.length === 1 ? proposals[0] : null);
      const recommendation = followup ? state.pending?.recommendation : answer.recommendation;
      state.pending = proposals.length ? { plan, proposals, selected, recommendation } : null;
      state.suggestions = answer.suggestions ?? [];
    }
    renderOptions();
    if (!answer.keepPending && !input.value && (state.pending || state.suggestions.length)) {
      options.querySelector('button')?.focus();
    } else input.focus();
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    void sendMessage(input.value, true);
  });
  input.addEventListener('input', () => { state.input = input.value; });
  if (state.pending && (guide || state.pending.plan !== getPlan())) {
    state.pending = null;
    state.suggestions = [];
  }
  messages.hidden = state.messages.length === 0;
  for (const message of state.messages) messages.append(messageNode(message));
  renderOptions();
  host.replaceChildren(panel);
  scrollMessages();
  if (state.focusEditResult) {
    state.focusEditResult = false;
    const download = messages.lastElementChild?.querySelector('.planner-chat-pdf');
    (download || input).focus();
  }

  return {
    show({ focus = false } = {}) {
      scrollMessages();
      if (focus) {
        title.tabIndex = -1;
        title.focus({ preventScroll: true });
      }
    },
  };
}
