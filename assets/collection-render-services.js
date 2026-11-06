// Progressive enhancement: each photo remains an ordinary image link.
const main = document.querySelector('body.collection-service-page #content');
const links = [...(main?.querySelectorAll('a[data-render-service-photo]') || [])];

if (links.length && typeof HTMLDialogElement !== 'undefined' &&
    typeof HTMLDialogElement.prototype.showModal === 'function') {
  const dialog = document.createElement('dialog');
  dialog.id = 'render-service-gallery-dialog';
  dialog.className = 'render-service-gallery-dialog';
  dialog.setAttribute('aria-labelledby', 'render-service-gallery-photo-title');
  dialog.innerHTML = `
    <div class="render-service-gallery-toolbar">
      <h2 id="render-service-gallery-photo-title"></h2>
      <button class="render-service-gallery-control" type="button" data-render-service-close autofocus>Закрыть <span aria-hidden="true">×</span></button>
    </div>
    <div class="render-service-gallery-stage"></div>
    <p class="render-service-gallery-message" data-render-service-message role="status" hidden></p>
    <div class="render-service-gallery-controls">
      <button class="render-service-gallery-control" type="button" data-render-service-prev aria-label="Предыдущее фото"><span aria-hidden="true">←</span> Назад</button>
      <p class="render-service-gallery-counter" data-render-service-counter aria-live="polite" aria-atomic="true"></p>
      <button class="render-service-gallery-control" type="button" data-render-service-next aria-label="Следующее фото">Далее <span aria-hidden="true">→</span></button>
    </div>
    <a class="render-service-gallery-original" data-render-service-original>Открыть фото отдельно</a>
  `;
  document.body.append(dialog);

  const title = dialog.querySelector('h2');
  const stage = dialog.querySelector('.render-service-gallery-stage');
  const message = dialog.querySelector('[data-render-service-message]');
  const counter = dialog.querySelector('[data-render-service-counter]');
  const original = dialog.querySelector('[data-render-service-original]');
  const close = dialog.querySelector('[data-render-service-close]');
  let index = 0;
  let opener;
  let currentImage;

  function displayPhoto(nextIndex) {
    index = (nextIndex + links.length) % links.length;
    const link = links[index];
    const label = link.dataset.renderServiceTitle || link.querySelector('img')?.alt || 'Фото';
    title.textContent = label;
    counter.textContent = `${index + 1} / ${links.length}`;
    original.href = link.href;
    message.hidden = false;
    message.textContent = 'Загрузка фото…';
    stage.setAttribute('aria-busy', 'true');
    const image = new Image();
    currentImage = image;
    image.alt = link.querySelector('img')?.alt || label;
    image.decoding = 'async';
    image.onload = () => {
      if (currentImage !== image) return;
      message.hidden = true;
      stage.removeAttribute('aria-busy');
    };
    image.onerror = () => {
      if (currentImage !== image) return;
      image.hidden = true;
      stage.removeAttribute('aria-busy');
      message.textContent = 'Не удалось загрузить фото. Попробуйте открыть его отдельно.';
    };
    stage.replaceChildren(image);
    image.src = link.href;
  }

  links.forEach((link, offset) => {
    link.setAttribute('aria-haspopup', 'dialog');
    link.setAttribute('aria-controls', dialog.id);
    link.addEventListener('click', event => {
      // Keep modified clicks and the no-JavaScript path native.
      if (event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      displayPhoto(offset);
      try {
        dialog.showModal();
      } catch {
        return;
      }
      event.preventDefault();
      opener = link;
      document.documentElement.classList.add('render-service-gallery-open');
      close.focus({ preventScroll: true });
    });
  });

  close.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-render-service-prev]').addEventListener('click', () => displayPhoto(index - 1));
  dialog.querySelector('[data-render-service-next]').addEventListener('click', () => displayPhoto(index + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    displayPhoto(index + (event.key === 'ArrowRight' ? 1 : -1));
  });
  // Escape and focus trapping are provided by the native modal dialog.
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('render-service-gallery-open');
    opener?.focus({ preventScroll: true });
  });
}

