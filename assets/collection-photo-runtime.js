const arrow = '<svg viewBox="0 0 28 20" aria-hidden="true"><path d="M2 10h22m-6-6 6 6-6 6"/></svg>';
const close = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"/></svg>';
const initialized = new WeakSet();

function photoFrom(image, title = '') {
  if (!image) return null;
  const src = image.dataset.roomSrc || image.getAttribute('src');
  if (!src) return null;
  return { src, alt: image.alt, title: title.trim() || image.alt };
}

function captionText(figure) {
  return figure?.querySelector('figcaption')?.textContent.replace(/^\s*\d+\s*/, '').trim() || '';
}

// The page's photographs and captions remain in the HTML. Only the optional
// enlarged view is created here; no page content or shell is regenerated.
function createViewer(kind) {
  const room = kind === 'room';
  const prefix = room ? 'room' : 'editorial';
  const dialog = document.createElement('dialog');
  dialog.className = `${prefix}-photo-dialog`;
  dialog.setAttribute('aria-labelledby', `${prefix}-photo-title`);
  dialog.innerHTML = `<div class="${prefix}-photo-toolbar">
    <h2 id="${prefix}-photo-title"></h2>
    <button type="button" data-photo-close aria-label="Закрыть фотографии">${room ? '×' : close}</button>
    </div><div class="${prefix}-photo-stage"><img alt="">
    <p class="${prefix}-photo-error" data-photo-error hidden>Не удалось загрузить фотографию. Попробуйте другой кадр.</p></div>
    <div class="${prefix}-photo-controls">
    <button type="button" data-photo-prev aria-label="Предыдущее фото">${room ? '‹' : arrow}</button>
    <p data-photo-status aria-live="polite" aria-atomic="true"></p>
    <button type="button" data-photo-next aria-label="Следующее фото">${room ? '›' : arrow}</button></div>`;
  // Retain the existing gallery selectors used by its stylesheet and controls.
  if (!room) ['close', 'error', 'prev', 'status', 'next'].forEach(name => {
    dialog.querySelector(`[data-photo-${name}]`).setAttribute(`data-editorial-photo-${name}`, '');
  });
  document.body.append(dialog);

  const image = dialog.querySelector('img');
  const error = dialog.querySelector('[data-photo-error]');
  const title = dialog.querySelector('h2');
  const status = dialog.querySelector('[data-photo-status]');
  const closeButton = dialog.querySelector('[data-photo-close]');
  const previous = dialog.querySelector('[data-photo-prev]');
  const next = dialog.querySelector('[data-photo-next]');
  let active;
  let current = 0;
  let returnFocus;

  function show(index) {
    if (!active?.photos.length) return;
    current = (index + active.photos.length) % active.photos.length;
    const photo = active.photos[current];
    error.hidden = true;
    image.hidden = false;
    image.alt = photo.alt;
    image.src = photo.src;
    title.textContent = room ? active.title : photo.title;
    status.textContent = `${String(current + 1).padStart(2, '0')} / ${String(active.photos.length).padStart(2, '0')}`;
    previous.hidden = next.hidden = active.photos.length < 2;
  }

  function closeViewer() {
    if (dialog.open) dialog.close();
  }

  image.addEventListener('error', () => {
    image.hidden = true;
    error.hidden = false;
  });
  image.addEventListener('load', () => {
    image.hidden = false;
    error.hidden = true;
  });
  previous.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  closeButton.addEventListener('click', closeViewer);
  dialog.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    show(current + (event.key === 'ArrowLeft' ? -1 : 1));
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) closeViewer();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove(`${prefix}-photo-open`);
    active?.onClose?.(current);
    active = undefined;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  });

  return {
    open(group, index, trigger) {
      // Browsers without native dialogs still offer the full photograph.
      if (typeof dialog.showModal !== 'function') {
        window.location.assign(group.photos[index].src);
        return;
      }
      active = group;
      returnFocus = trigger;
      show(index);
      if (!dialog.open) dialog.showModal();
      document.documentElement.classList.add(`${prefix}-photo-open`);
      closeButton.focus({ preventScroll: true });
    },
  };
}

function initRooms(main) {
  const galleries = [...main.querySelectorAll('[data-room-photos]')];
  if (!galleries.length) return;
  const viewer = createViewer('room');
  galleries.forEach(gallery => {
    const trigger = gallery.querySelector('[data-room-gallery]');
    if (!trigger) return;
    const slides = [...trigger.querySelectorAll('.room-slide')];
    const records = slides.map((slide, originalIndex) => ({
      slide,
      originalIndex,
      photo: photoFrom(slide.querySelector('img')),
    })).filter(record => record.photo);
    if (!records.length) return;
    const thumbs = [...gallery.querySelectorAll('[data-room-thumb]')];
    const title = gallery.closest('.room-houseboat')?.querySelector('h2')?.textContent.trim() || 'Хаусбот';
    let current = Math.max(0, records.findIndex(record => record.slide.classList.contains('is-current')));
    let requested = current;
    let selection = 0;
    const failed = new Set();

    function commit(index) {
      current = index;
      records.forEach((record, offset) => {
        record.slide.classList.toggle('is-current', offset === current);
        record.slide.setAttribute('aria-hidden', String(offset !== current));
      });
      thumbs.forEach((thumb, offset) => {
        const originalIndex = Number(thumb.dataset.roomThumb ?? offset);
        thumb.setAttribute('aria-pressed', String(originalIndex === records[current].originalIndex));
      });
      trigger.href = records[current].photo.src;
    }

    async function select(index) {
      requested = (index + records.length) % records.length;
      const target = requested;
      const token = ++selection;
      if (target === current) {
        gallery.removeAttribute('aria-busy');
        return;
      }
      const image = records[target].slide.querySelector('img');
      // Hidden full-size frames stay in data attributes until requested. Tiny
      // thumbnails and the current frame remain ordinary, usable HTML images.
      if (image.dataset.roomSrc) {
        image.loading = 'eager';
        if (image.dataset.roomSrcset) image.srcset = image.dataset.roomSrcset;
        image.src = image.dataset.roomSrc;
        delete image.dataset.roomSrc;
        delete image.dataset.roomSrcset;
      }
      gallery.setAttribute('aria-busy', 'true');
      try {
        if (image.decode) await image.decode();
        else if (!image.complete) await new Promise((resolve, reject) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', reject, { once: true });
        });
        if (!image.naturalWidth) throw new Error('Photo unavailable');
        if (token !== selection) return;
        failed.delete(target);
        commit(target);
        gallery.removeAttribute('aria-busy');
      } catch {
        failed.add(target);
        if (token !== selection) return;
        gallery.removeAttribute('aria-busy');
        move(1);
      }
    }

    function move(direction) {
      let candidate = requested;
      for (let count = 0; count < records.length; count++) {
        candidate = (candidate + direction + records.length) % records.length;
        if (!failed.has(candidate)) return select(candidate);
      }
    }

    gallery.querySelector('[data-room-prev]')?.addEventListener('click', () => move(-1));
    gallery.querySelector('[data-room-next]')?.addEventListener('click', () => move(1));
    thumbs.forEach((thumb, offset) => {
      const index = records.findIndex(record => record.originalIndex === Number(thumb.dataset.roomThumb ?? offset));
      if (index >= 0) thumb.addEventListener('click', () => select(index));
    });
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.addEventListener('click', event => {
      event.preventDefault();
      viewer.open({ title, photos: records.map(record => record.photo), onClose: select }, current, trigger);
    });

    records.forEach((record, index) => {
      const image = record.slide.querySelector('img');
      function unavailable() {
        failed.add(index);
        if (index === current) move(1);
      }
      image.addEventListener('error', unavailable);
      image.addEventListener('load', () => failed.delete(index));
      if (image.getAttribute('src') && image.complete && !image.naturalWidth) unavailable();
    });
    // Photos change only on request. There are no timers to interrupt reading,
    // keyboard focus, reduced-motion preferences, or a background browser tab.
    commit(current);
  });
}

function initGallery(main) {
  const figures = [...main.querySelectorAll('.editorial-gallery-cover, .gallery-photo')];
  const records = figures.map(figure => ({
    figure,
    photo: photoFrom(figure.querySelector('img'), captionText(figure)),
    trigger: figure.querySelector('.editorial-hero-photo-trigger, .editorial-gallery-trigger'),
  })).filter(record => record.photo);
  if (!records.length) return;
  const viewer = createViewer('editorial');
  const group = { photos: records.map(record => record.photo) };
  records.forEach((record, index) => {
    if (!record.trigger) return;
    record.trigger.setAttribute('aria-haspopup', 'dialog');
    record.trigger.addEventListener('click', event => {
      event.preventDefault();
      viewer.open(group, index, record.trigger);
    });
  });
}

export function initCollectionPhotos(page = document.body.dataset.page) {
  const main = document.querySelector('#content');
  if (!main || initialized.has(main)) return;
  if (page === 'rooms') initRooms(main);
  else if (page === 'gallery') initGallery(main);
  else return;
  initialized.add(main);
}
