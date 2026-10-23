const arrow = '<svg viewBox="0 0 28 20" aria-hidden="true"><path d="M2 10h22m-6-6 6 6-6 6"/></svg>';
const close = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"/></svg>';
const initialized = new WeakSet();

function photoFrom(image, title = '') {
  if (!image) return null;
  const src = image.dataset.roomSrc || image.getAttribute('src');
  if (!src) return null;
  return {
    src,
    srcset: image.dataset.roomSrcset || image.getAttribute('srcset') || '',
    image,
    alt: image.alt,
    title: title.trim() || image.alt,
  };
}

// A ready image can be selected synchronously. Do not run decode() again for
// every click: that used to add another asynchronous turn even for cached frames.
const imageLoads = new WeakMap();
function imageReady(image) {
  const cached = imageLoads.get(image);
  const source = image.currentSrc || image.src;
  if (cached && (!cached.decoded || (image.complete && image.naturalWidth && cached.source === source))) return cached.ready;
  const entry = { decoded: false, source };
  entry.ready = (async () => {
    if (!image.complete) await new Promise((resolve, reject) => {
      function done() {
        image.removeEventListener('load', loaded);
        image.removeEventListener('error', broken);
      }
      function loaded() { done(); resolve(); }
      function broken() { done(); reject(new Error('Photo unavailable')); }
      image.addEventListener('load', loaded, { once: true });
      image.addEventListener('error', broken, { once: true });
    });
    if (!image.naturalWidth) throw new Error('Photo unavailable');
    if (image.decode) {
      try { await image.decode(); } catch (error) {
        // A responsive candidate may change while the viewport is resized.
        if (!image.complete || !image.naturalWidth) throw error;
      }
    }
    entry.decoded = true;
    entry.source = image.currentSrc || image.src;
    return image;
  })().catch(error => {
    if (imageLoads.get(image) === entry) imageLoads.delete(image);
    throw error;
  });
  imageLoads.set(image, entry);
  return entry.ready;
}

function readyPhotoSource(photo) {
  return [photo.image, photo.preview].find(image => image?.complete && image.naturalWidth)?.currentSrc || '';
}

function swipePhotos(surface, move) {
  let origin;
  let suppressClickUntil = 0;
  surface.style.touchAction = 'pan-y pinch-zoom';
  surface.addEventListener('pointerdown', event => {
    suppressClickUntil = 0;
    if (!event.isPrimary) { origin = undefined; return; }
    if (event.pointerType === 'mouse') return;
    origin = { x: event.clientX, y: event.clientY, id: event.pointerId };
    surface.setPointerCapture?.(event.pointerId);
  });
  surface.addEventListener('pointercancel', () => { origin = undefined; });
  surface.addEventListener('pointerup', event => {
    if (!origin || event.pointerId !== origin.id) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    origin = undefined;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    suppressClickUntil = performance.now() + 450;
    move(dx < 0 ? 1 : -1);
  });
  surface.addEventListener('click', event => {
    if (performance.now() >= suppressClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
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

  let image = dialog.querySelector('img');
  const stage = image.parentElement;
  const error = dialog.querySelector('[data-photo-error]');
  const title = dialog.querySelector('h2');
  const status = dialog.querySelector('[data-photo-status]');
  const closeButton = dialog.querySelector('[data-photo-close]');
  const previous = dialog.querySelector('[data-photo-prev]');
  const next = dialog.querySelector('[data-photo-next]');
  const prepared = new WeakMap();
  let active;
  let current = 0;
  let requested = 0;
  let selection = 0;
  let failed = new Set();
  let returnFocus;

  function sizesFor(photo) {
    const source = [photo.image, photo.preview].find(candidate => candidate?.naturalWidth);
    const ratio = source ? source.naturalWidth / source.naturalHeight : 1.5;
    // object-fit: contain limits portrait images by height. Request the size
    // actually painted in the dialog, rather than the largest JPEG every time.
    const width = Math.min(stage.clientWidth || innerWidth - 40, (stage.clientHeight || innerHeight * .62) * ratio);
    return `${Math.max(1, Math.ceil(width))}px`;
  }

  function prepare(photo, priority = 'low') {
    const sizes = sizesFor(photo);
    let variants = prepared.get(photo);
    if (!variants) prepared.set(photo, variants = new Map());
    if (variants.has(sizes)) {
      const entry = variants.get(sizes);
      if (priority === 'high') entry.image.fetchPriority = 'high';
      return entry;
    }
    const frame = new Image();
    frame.alt = photo.alt;
    frame.decoding = 'async';
    frame.loading = 'eager';
    frame.fetchPriority = priority;
    if (photo.srcset) {
      frame.sizes = sizes;
      frame.srcset = photo.srcset;
    }
    frame.src = photo.src;
    const entry = { image: frame, ready: imageReady(frame).then(() => {
      frame.dataset.decoded = 'true';
      return frame;
    }) };
    variants.set(sizes, entry);
    // Prefetch failures must not become unhandled promise rejections.
    entry.ready.catch(() => { variants.delete(sizes); });
    return entry;
  }

  function commit(frame, index) {
    if (image !== frame) image.replaceWith(frame);
    image = frame;
    current = index;
    image.hidden = false;
    error.hidden = true;
    title.textContent = room ? active.title : active.photos[index].title;
    status.textContent = `${String(index + 1).padStart(2, '0')} / ${String(active.photos.length).padStart(2, '0')}`;
    previous.hidden = next.hidden = active.photos.length < 2;
  }

  function warmNeighbors(index) {
    if (!active || active.photos.length < 2) return;
    const offsets = navigator.connection?.saveData ? [1] : [1, -1];
    for (const offset of offsets) {
      const candidate = (index + offset + active.photos.length) % active.photos.length;
      if (!failed.has(candidate)) prepare(active.photos[candidate]);
    }
  }

  function show(index) {
    if (!active?.photos.length) return;
    requested = (index + active.photos.length) % active.photos.length;
    const target = requested;
    const token = ++selection;
    const photo = active.photos[target];
    const entry = prepare(photo, 'high');
    stage.setAttribute('aria-busy', 'true');
    if (entry.image.complete && entry.image.naturalWidth && entry.image.dataset.decoded === 'true') {
      commit(entry.image, target);
      stage.removeAttribute('aria-busy');
      warmNeighbors(target);
      return;
    }
    // Reuse the page's already loaded responsive frame (or room thumbnail)
    // while the dialog-sized variant is prepared. Never clear a painted frame.
    const previewSource = readyPhotoSource(photo);
    let previewReady;
    if (previewSource) {
      const preview = new Image();
      preview.alt = photo.alt;
      preview.decoding = 'async';
      preview.src = previewSource;
      previewReady = imageReady(preview).then(() => {
        if (token === selection && active && entry.image.dataset.decoded !== 'true') commit(preview, target);
      });
      previewReady.catch(() => {});
    }
    entry.ready.then(frame => {
      frame.dataset.decoded = 'true';
      if (token !== selection || !active) return;
      failed.delete(target);
      commit(frame, target);
      stage.removeAttribute('aria-busy');
      warmNeighbors(target);
    }).catch(async () => {
      if (token !== selection || !active) return;
      failed.add(target);
      stage.removeAttribute('aria-busy');
      if (previewReady) {
        try {
          await previewReady;
          if (token !== selection || !active) return;
          if (current === target && image.complete && image.naturalWidth) return;
        } catch {}
      }
      move(1);
    });
    warmNeighbors(target);
  }

  function move(direction) {
    if (!active) return;
    let candidate = requested;
    for (let count = 0; count < active.photos.length; count++) {
      candidate = (candidate + direction + active.photos.length) % active.photos.length;
      if (!failed.has(candidate)) return show(candidate);
    }
    // Retain the last good image if every requested original is unavailable.
    error.hidden = false;
  }

  function closeViewer() {
    if (dialog.open) dialog.close();
  }

  swipePhotos(stage, move);
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  closeButton.addEventListener('click', closeViewer);
  dialog.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) closeViewer();
  });
  dialog.addEventListener('close', () => {
    ++selection;
    stage.removeAttribute('aria-busy');
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
      failed = new Set();
      current = requested = index;
      returnFocus = trigger;
      // Opening a different group must not briefly reveal the previous room.
      image.hidden = true;
      title.textContent = room ? active.title : active.photos[index].title;
      status.textContent = '';
      error.hidden = true;
      if (!dialog.open) dialog.showModal();
      document.documentElement.classList.add(`${prefix}-photo-open`);
      show(index);
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
    records.forEach(record => {
      record.image = record.slide.querySelector('img');
      record.photo.preview = thumbs.find((thumb, offset) => Number(thumb.dataset.roomThumb ?? offset) === record.originalIndex)?.querySelector('img');
    });
    let current = Math.max(0, records.findIndex(record => record.slide.classList.contains('is-current')));
    let requested = current;
    let selection = 0;
    let nearby = false;
    const failed = new Set();
    const prepared = new Map();

    function clearPreview(record) {
      record.slide.style.removeProperty('background-image');
      record.slide.style.removeProperty('background-size');
      record.slide.style.removeProperty('background-position');
      record.slide.style.removeProperty('background-repeat');
      record.image.style.removeProperty('opacity');
    }

    function prepare(index, priority = 'low') {
      const record = records[index];
      const image = record.image;
      if (priority === 'high') image.fetchPriority = 'high';
      if (prepared.has(index) && (image.dataset.decoded !== 'true' || image.complete)) return prepared.get(index);
      image.decoding = 'async';
      image.loading = 'eager';
      image.fetchPriority = priority;
      if (image.dataset.roomSrc) {
        if (image.dataset.roomSrcset) image.srcset = image.dataset.roomSrcset;
        image.src = image.dataset.roomSrc;
        delete image.dataset.roomSrc;
        delete image.dataset.roomSrcset;
      }
      const ready = imageReady(image).then(() => {
        image.dataset.decoded = 'true';
        failed.delete(index);
        clearPreview(record);
        return image;
      }).catch(error => {
        failed.add(index);
        prepared.delete(index);
        throw error;
      });
      prepared.set(index, ready);
      ready.catch(() => {});
      return ready;
    }

    function warmNeighbors() {
      if (!nearby || records.length < 2) return;
      const offsets = navigator.connection?.saveData ? [1] : [1, -1];
      for (const offset of offsets) {
        const index = (current + offset + records.length) % records.length;
        if (!failed.has(index)) prepare(index);
      }
    }

    function commit(index) {
      current = index;
      records.forEach((record, offset) => {
        // Visibility is a committed state, not an animation completion. This
        // also keeps Safari/background tabs from retaining the outgoing frame.
        record.slide.hidden = offset !== current;
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
      const record = records[target];
      if (record.image.dataset.decoded === 'true' && record.image.complete && record.image.naturalWidth) {
        commit(target);
        gallery.removeAttribute('aria-busy');
        warmNeighbors();
        return;
      }
      gallery.setAttribute('aria-busy', 'true');
      // A cold, non-adjacent selection responds with its already cached thumb.
      // The sharp frame replaces it after decode without hiding the photograph.
      const preview = record.photo.preview;
      function showPreview() {
        if (token !== selection || (record.image.dataset.decoded === 'true' && record.image.complete && record.image.naturalWidth)) return;
        record.slide.style.backgroundImage = `url(${JSON.stringify(preview.currentSrc)})`;
        record.slide.style.backgroundSize = record.photo.src.includes('/concept-covers/') ? 'contain' : 'cover';
        record.slide.style.backgroundPosition = 'center';
        record.slide.style.backgroundRepeat = 'no-repeat';
        record.image.style.opacity = '0';
        commit(target);
      }
      if (preview) {
        preview.loading = 'eager';
        preview.fetchPriority = 'high';
        if (preview.complete && preview.naturalWidth) showPreview();
        else imageReady(preview).then(showPreview).catch(() => {});
      }
      try {
        await prepare(target, 'high');
        if (token !== selection) return;
        commit(target);
        gallery.removeAttribute('aria-busy');
        warmNeighbors();
      } catch {
        if (token !== selection) return;
        gallery.removeAttribute('aria-busy');
        // An available cached thumbnail is still the correct selected picture.
        // Keep it visible if its larger variant fails, including offline use.
        if (preview) {
          try {
            await imageReady(preview);
            if (token !== selection) return;
            showPreview();
            if (record.slide.style.backgroundImage) return;
          } catch {}
        }
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

    swipePhotos(trigger, move);
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
        if (index === current) select(index);
      }
      image.addEventListener('error', () => {
        failed.add(index);
        if (index === current && !gallery.hasAttribute('aria-busy')) select(index);
      });
      image.addEventListener('load', () => failed.delete(index));
      if (image.getAttribute('src') && image.complete && !image.naturalWidth) unavailable();
    });
    // Only galleries about to enter the viewport prepare their two neighbours.
    // Farther room frames remain dormant; no autoplay or repeating timers run.
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        nearby = entries.some(entry => entry.isIntersecting);
        if (nearby) {
          // Small visible controls take priority over speculative large frames.
          thumbs.forEach(thumb => {
            const preview = thumb.querySelector('img');
            if (preview) { preview.loading = 'eager'; preview.fetchPriority = 'high'; }
          });
          prepare(current);
          warmNeighbors();
        }
      }, { rootMargin: '180px 0px', threshold: 0 });
      observer.observe(gallery);
    } else {
      gallery.addEventListener('pointerenter', () => { nearby = true; warmNeighbors(); }, { once: true });
      gallery.addEventListener('focusin', () => { nearby = true; warmNeighbors(); }, { once: true });
    }
    thumbs.forEach((thumb, offset) => {
      const index = records.findIndex(record => record.originalIndex === Number(thumb.dataset.roomThumb ?? offset));
      if (index < 0) return;
      ['pointerenter', 'focus'].forEach(event => thumb.addEventListener(event, () => prepare(index)));
    });
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
