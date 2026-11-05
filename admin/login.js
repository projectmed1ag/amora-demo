(() => {
  'use strict';
  const views = new Set(['calendar', 'overview', 'bookings']);
  const cities = new Set(['mozhaysk', 'ruza', 'krasnoyarsk']);
  const names = { calendar: 'Шахматка', overview: 'Обзор дня', bookings: 'Бронирования' };
  const $ = selector => document.querySelector(selector);
  const form = $('#login-form');
  const usernameInput = $('#demo-username');
  const passwordInput = $('#demo-password');
  const submit = $('#unlock-demo');
  const toggle = $('#toggle-password');
  const error = $('#login-error');
  let payload = null;
  let memoryKey = null;
  let frame = null;
  let activeView = 'bookings';
  let busy = false;
  const supported = !!(globalThis.isSecureContext && globalThis.crypto?.subtle && typeof TextEncoder === 'function' && typeof TextDecoder === 'function');
  function showError(message = '') { error.textContent = message; error.hidden = !message; }
  function announce(message) { $('#gate-announcer').textContent = message; }
  function setBusy(value) {
    busy = value;
    form.setAttribute('aria-busy', String(value));
    submit.disabled = value || !supported;
    usernameInput.disabled = value || !supported;
    passwordInput.disabled = value || !supported;
    toggle.disabled = value || !supported;
    submit.textContent = value ? 'Открываем…' : 'Открыть демонстрацию';
  }
  function bytes(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('format');
    return Uint8Array.from(atob(value), character => character.charCodeAt(0));
  }
  function validateEnvelope(envelope) {
    if (envelope?.version !== 1 || envelope.algorithm !== 'AES-256-GCM' || envelope.kdf?.name !== 'PBKDF2' || envelope.kdf.hash !== 'SHA-256' || envelope.kdf.iterations !== 600000) throw new Error('format');
    const salt = bytes(envelope.kdf.salt);
    const iv = bytes(envelope.iv);
    const ciphertext = bytes(envelope.ciphertext);
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17 || ciphertext.length > 5000000) throw new Error('format');
    return { salt, iv, ciphertext };
  }
  async function loadEnvelope() {
    let response;
    try { response = await fetch(new URL('demo.enc.json', location.href), { cache: 'no-store', credentials: 'omit' }); }
    catch { throw new Error('network'); }
    if (!response.ok) throw new Error('network');
    try { return validateEnvelope(await response.json()); }
    catch { throw new Error('format'); }
  }
  async function deriveKey(password, salt) {
    const encoded = new TextEncoder().encode(password);
    try {
      const material = await crypto.subtle.importKey('raw', encoded, 'PBKDF2', false, ['deriveKey']);
      return await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    } finally { encoded.fill(0); }
  }
  function validatePayload(value) {
    if (value?.version !== 1 || typeof value.script !== 'string' || typeof value.styles !== 'string' || typeof value.publicRoot !== 'string') throw new Error('format');
    const root = new URL(value.publicRoot);
    if (root.protocol !== 'https:') throw new Error('format');
    for (const view of views) if (typeof value.variants?.[view]?.template !== 'string') throw new Error('format');
    return value;
  }
  function updateGuestLink(city = 'mozhaysk') {
    if (!payload || !cities.has(city)) return;
    const url = new URL((city === 'mozhaysk' ? '' : city + '/') + 'booking.html', payload.publicRoot);
    url.searchParams.set('city', city);
    $('#public-booking').href = url.href;
  }
  function frameBridge(parentOrigin) {
    const allowedViews = new Set(['calendar', 'overview', 'bookings']);
    const allowedCities = new Set(['mozhaysk', 'ruza', 'krasnoyarsk']);
    const send = (action, values = {}) => parent.postMessage({ type: 'amora-demo', action, ...values }, parentOrigin);
    document.addEventListener('click', event => {
      const link = event.target.closest('a');
      if (!link) return;
      event.preventDefault();
      const href = link.getAttribute('href') || '';
      const target = href.match(/^(calendar|overview|bookings)\.html(?:[?#].*)?$/)?.[1];
      if (allowedViews.has(target)) send('navigate', { view: target });
      else if (href === 'index.html') send('choose-view');
    }, true);
    document.addEventListener('auxclick', event => { if (event.target.closest('a')) event.preventDefault(); }, true);
    const context = () => {
      const city = document.getElementById('city')?.value;
      if (allowedCities.has(city)) send('context', { city });
    };
    document.addEventListener('change', context);
    context();
  }
  function showView(view) {
    if (!payload || !views.has(view)) return;
    activeView = view;
    if (frame) { frame.srcdoc = ''; frame.remove(); }
    frame = document.createElement('iframe');
    frame.className = 'demo-frame';
    frame.title = 'A’MORE — ' + names[view] + ' · демонстрация';
    frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals');
    frame.referrerPolicy = 'no-referrer';
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(18)), value => value.toString(16).padStart(2, '0')).join('');
    const imageOrigin = new URL(payload.publicRoot).origin;
    const csp = "default-src 'none'; img-src " + imageOrigin + " data:; font-src data:; style-src 'unsafe-inline'; script-src 'nonce-" + nonce + "'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'";
    const styles = payload.styles.replace(/<\/style/gi, '<\\/style');
    const program = (payload.script + '\n;(' + frameBridge.toString() + ')(' + JSON.stringify(location.origin) + ');').replace(/<\/script/gi, '<\\/script');
    frame.srcdoc = payload.variants[view].template
      .replace('</head>', () => '<meta http-equiv="Content-Security-Policy" content="' + csp + '"><style>' + styles + '</style></head>')
      .replace('</body>', () => '<script nonce="' + nonce + '">' + program + '</script></body>');
    $('#frame-host').append(frame);
    document.querySelectorAll('[data-view]').forEach(button => {
      if (button.dataset.view === view) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    document.title = names[view] + ' · демонстрация — A’MORE Collection';
    announce('Открыт вариант «' + names[view] + '». Данные тестовые.');
  }
  function lock() {
    if (frame) { frame.srcdoc = ''; frame.remove(); frame = null; }
    payload = null;
    memoryKey = null;
    usernameInput.value = '';
    passwordInput.value = '';
    passwordInput.type = 'password';
    toggle.textContent = 'Показать';
    toggle.setAttribute('aria-label', 'Показать пароль');
    toggle.setAttribute('aria-pressed', 'false');
    $('#workspace-view').hidden = true;
    $('#login-view').hidden = false;
    showError();
    setBusy(false);
    document.title = 'Вход в демонстрацию — A’MORE Collection';
    usernameInput.focus();
    announce('Демонстрация заблокирована. Введите логин и пароль, чтобы открыть её снова.');
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !supported || !usernameInput.value || !passwordInput.value) return;
    let password = passwordInput.value;
    setBusy(true);
    showError();
    try {
      if (usernameInput.value.trim() !== 'admin') throw new Error('decrypt');
      const envelope = await loadEnvelope();
      memoryKey = await deriveKey(password, envelope.salt);
      password = '';
      passwordInput.value = '';
      let plaintext;
      try { plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: envelope.iv, tagLength: 128 }, memoryKey, envelope.ciphertext); }
      catch { throw new Error('decrypt'); }
      const plainBytes = new Uint8Array(plaintext);
      try { payload = validatePayload(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plainBytes))); }
      finally { plainBytes.fill(0); }
      $('#login-view').hidden = true;
      $('#workspace-view').hidden = false;
      updateGuestLink();
      showView(activeView);
      $('#view-navigation [aria-current="page"]').focus();
    } catch (failure) {
      if (frame) { frame.srcdoc = ''; frame.remove(); frame = null; }
      payload = null;
      memoryKey = null;
      $('#workspace-view').hidden = true;
      $('#login-view').hidden = false;
      const messages = {
        network: 'Не удалось загрузить демонстрацию. Проверьте соединение и попробуйте ещё раз.',
        format: 'Файл демонстрации недоступен или повреждён. Обновите страницу и попробуйте снова.',
        decrypt: 'Логин или пароль не подошли.',
      };
      showError(messages[failure.message] || 'Не удалось открыть демонстрацию в этом браузере. Попробуйте обновить страницу.');
    } finally {
      password = '';
      passwordInput.value = '';
      setBusy(false);
      if (!payload) passwordInput.focus();
    }
  });
  toggle.addEventListener('click', () => {
    const visible = passwordInput.type === 'password';
    passwordInput.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Скрыть' : 'Показать';
    toggle.setAttribute('aria-label', visible ? 'Скрыть пароль' : 'Показать пароль');
    toggle.setAttribute('aria-pressed', String(visible));
    passwordInput.focus();
  });
  $('#lock-demo').addEventListener('click', lock);
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  window.addEventListener('message', event => {
    if (!payload || !frame || event.source !== frame.contentWindow || event.origin !== 'null') return;
    const data = event.data;
    if (!data || typeof data !== 'object' || data.type !== 'amora-demo') return;
    if (data.action === 'navigate' && views.has(data.view)) showView(data.view);
    else if (data.action === 'choose-view') { $('#view-navigation button').focus(); $('#view-navigation').scrollIntoView({ block: 'nearest' }); }
    else if (data.action === 'context' && cities.has(data.city)) updateGuestLink(data.city);
  });
  window.addEventListener('pagehide', () => { if (payload) lock(); });
  setBusy(false);
  if (!supported) {
    showError('Для демонстрации нужен HTTPS или localhost и современный браузер с WebCrypto.');
  }
})();
