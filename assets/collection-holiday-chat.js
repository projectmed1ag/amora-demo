import { answerHolidayChat } from './collection-holiday-chat-intents.js?v=20261112-chat-3';
import { answerHolidayChatFollowup } from './collection-holiday-chat-followups.js?v=20261112-chat-3';
import { answerHolidayChatEvents } from './collection-holiday-chat-events.js?v=20261112-chat-3';
import { answerHolidayChatHotel } from './collection-holiday-chat-hotel.js?v=20261112-chat-3';

const examples = [
  { label: 'Что дальше?', query: 'Что дальше?' },
  { label: 'Что завтра?', query: 'Что завтра?' },
  { label: 'Подобрать занятие', query: 'Подбери занятие в свободное время' },
  { label: 'Афиша отеля', query: 'Какие события в отеле на даты моей поездки?' },
  { label: 'Возможности отеля', query: 'Какие есть плюшки в отеле?' },
];

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

export function mountHolidayChat(host, { state, getPlan, getClock, getEvents, applyEdit, interpretMessage }) {
  state.messages ??= [];
  state.suggestions ??= [];
  let waiting = false;
  const details = element('details', 'planner-chat');
  details.open = Boolean(state.open);
  const summary = element('summary', 'planner-chat-summary');
  const heading = element('span', 'planner-chat-heading');
  heading.append(element('strong', '', 'Чат с помощником'), element('span', '', 'Расписание, афиша и возможности отеля'));
  const indicator = element('span', 'planner-chat-indicator');
  indicator.setAttribute('aria-hidden', 'true');
  summary.append(heading, indicator);

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
  input.placeholder = 'Например, что у нас сегодня?';
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
  body.append(messages, options, form);
  details.append(summary, body);

  function scrollMessages() {
    messages.scrollTop = messages.scrollHeight;
  }

  function messageNode({ role, text, links }) {
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
    return row;
  }

  function addMessage(role, text, links) {
    const message = { role, text, links };
    state.messages.push(message);
    messages.hidden = false;
    messages.append(messageNode(message));
    if (state.messages.length > 32) {
      state.messages.shift();
      messages.firstElementChild?.remove();
    }
    scrollMessages();
    return message;
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
    if (!selected) return;
    if (plan !== getPlan()) {
      state.pending = null;
      state.suggestions = [];
      addMessage('assistant', 'План изменился. Повторите просьбу, чтобы я проверил новое расписание.');
      renderOptions();
      input.focus();
      return;
    }

    // The planner replaces this DOM synchronously on a successful edit.
    state.pending = null;
    state.suggestions = [];
    state.open = true;
    state.focusComposer = true;
    const success = addMessage('assistant', 'План обновлён. Новый PDF будет содержать эту правку.');
    const error = applyEdit(selected.edit);
    if (error) {
      success.text = error;
      if (messages.lastElementChild) messages.lastElementChild.replaceWith(messageNode(success));
      state.focusComposer = false;
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
      const choices = pending?.proposals ?? (state.suggestions.length ? state.suggestions : examples);
      const list = element('ul');
      for (const [index, choice] of choices.entries()) {
        const row = element('li');
        const label = pending && choices.length > 1 ? `${index + 1}. ${choice.label}` : choice.label;
        row.append(action(label, 'planner-chat-choice', () => {
          if (pending) {
            pending.selected = choice;
            renderOptions();
            options.querySelector('.planner-chat-apply')?.focus();
          } else void sendMessage(choice.query);
        }));
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
    const followup = answerHolidayChatFollowup(plan, question, state.pending, clock);
    const eventAnswer = followup ? null : answerHolidayChatEvents(plan, question, clock, getEvents);
    const localPlanAnswer = followup || eventAnswer ? null
      : answerHolidayChat(plan, question, { ...clock, recommendation: state.pending?.recommendation });
    let answer = followup ?? eventAnswer ?? (localPlanAnswer.local ? localPlanAnswer
      : answerHolidayChatHotel(plan, question, clock) ?? localPlanAnswer);
    const loadingEvents = typeof answer.then === 'function';
    if (loadingEvents || (typed && !followup && !answer.local && typeof interpretMessage === 'function')) {
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
          if (interpreted && interpreted.length <= input.maxLength && details.isConnected && plan === getPlan()) {
            answer = answerHolidayChat(plan, interpreted, getClock());
          }
        }
      } catch {
        if (loadingEvents) answer = { text: 'Афиша сейчас недоступна. Попробуйте спросить чуть позже.' };
      } finally {
        waiting = send.disabled = false;
        processing.hidden = true;
      }
      if (!details.isConnected) return;
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
  details.addEventListener('toggle', () => {
    if (!details.isConnected) return;
    state.open = details.open;
    if (details.open) scrollMessages();
  });

  if (state.pending && state.pending.plan !== getPlan()) {
    state.pending = null;
    state.suggestions = [];
  }
  messages.hidden = state.messages.length === 0;
  for (const message of state.messages) messages.append(messageNode(message));
  renderOptions();
  host.replaceChildren(details);
  scrollMessages();
  if (state.focusComposer) {
    state.focusComposer = false;
    input.focus({ preventScroll: true });
  }

  return {
    open() {
      details.open = state.open = true;
      scrollMessages();
      input.focus();
    },
  };
}
