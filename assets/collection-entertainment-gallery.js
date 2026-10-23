import { entertainmentGalleries } from './collection-entertainment-gallery-data.js?v=20261023-gallery-2';

const imageRoot = new URL('../', import.meta.url);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sizes = '(max-width: 800px) calc(100vw - 40px), (max-width: 1680px) 54vw, 800px';

function setPhotograph(image, photograph) {
  image.sizes = sizes;
  image.srcset = photograph.mobileSrc
    ? `${new URL(photograph.mobileSrc, imageRoot).href} ${photograph.mobileWidth}w, ${new URL(photograph.src, imageRoot).href} ${photograph.width}w`
    : '';
  image.src = new URL(photograph.src, imageRoot).href;
  image.alt = photograph.alt;
  image.width = photograph.width;
  image.height = photograph.height;
}

function arrowButton(direction, title) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.galleryDirection = direction;
  button.setAttribute('aria-label', `${direction === 'previous' ? 'Предыдущая' : 'Следующая'} фотография: ${title}`);
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
  return button;
}

function initializeGallery(story, photographs) {
  if (!Array.isArray(photographs) || photographs.length < 2) return;
  const figure = story.querySelector('.entertainment-photo');
  const image = figure?.querySelector('img');
  if (!figure || !image || figure.dataset.galleryReady !== undefined) return;
  const title = story.querySelector('h2')?.textContent.trim() || 'Развлечения';
  let selected = 0;
  let requested = 0;
  let generation = 0;
  let pointer = null;
  let transition = null;
  let outgoing = null;
  const prepared = new Map();

  figure.classList.add('entertainment-gallery');
  figure.dataset.galleryReady = '';
  figure.dataset.galleryIndex = '0';
  figure.setAttribute('role', 'group');
  figure.setAttribute('aria-roledescription', 'галерея');
  figure.setAttribute('aria-label', `Фотографии: ${title}`);
  image.draggable = false;
  setPhotograph(image, photographs[0]);

  const controls = document.createElement('div');
  controls.className = 'entertainment-gallery-controls';
  const previous = arrowButton('previous', title);
  const next = arrowButton('next', title);
  const position = document.createElement('span');
  position.className = 'entertainment-gallery-position';
  position.setAttribute('aria-hidden', 'true');
  position.textContent = `1 / ${photographs.length}`;
  const status = document.createElement('span');
  status.className = 'sr-only';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  controls.append(previous, position, next);
  figure.append(controls, status);

  const wrap = index => (index + photographs.length) % photographs.length;
  function warm(index) {
    if (!prepared.has(index)) {
      const preload = new Image();
      preload.decoding = 'async';
      setPhotograph(preload, photographs[index]);
      const ready = preload.decode().catch(error => { prepared.delete(index); throw error; });
      prepared.set(index, ready);
    }
    return prepared.get(index);
  }

  function clearTransition() {
    transition?.cancel();
    transition = null;
    outgoing?.remove();
    outgoing = null;
  }

  async function show(index) {
    requested = wrap(index);
    const target = requested;
    const token = ++generation;
    if (target === selected) {
      clearTransition();
      setPhotograph(image, photographs[selected]);
      figure.removeAttribute('aria-busy');
      return;
    }
    figure.setAttribute('aria-busy', 'true');
    try {
      await warm(target);
      if (token !== generation) return;
      clearTransition();
      outgoing = image.cloneNode();
      outgoing.className = 'entertainment-gallery-outgoing';
      outgoing.alt = '';
      outgoing.setAttribute('aria-hidden', 'true');
      figure.insertBefore(outgoing, controls);
      image.loading = 'eager';
      setPhotograph(image, photographs[target]);
      await image.decode();
      if (token !== generation) return;
      selected = target;
      figure.dataset.galleryIndex = String(selected);
      position.textContent = `${selected + 1} / ${photographs.length}`;
      status.textContent = `${title}: фотография ${selected + 1} из ${photographs.length}`;
      figure.removeAttribute('aria-busy');
      if (!reducedMotion.matches && outgoing?.animate) {
        transition = outgoing.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' });
        await transition.finished.catch(() => {});
      }
      if (token === generation) clearTransition();
    } catch {
      if (token !== generation) return;
      clearTransition();
      setPhotograph(image, photographs[selected]);
      figure.removeAttribute('aria-busy');
      status.textContent = 'Не удалось загрузить фотографию. Попробуйте другую.';
    }
  }

  previous.addEventListener('click', () => { void show(requested - 1); });
  next.addEventListener('click', () => { void show(requested + 1); });
  previous.addEventListener('pointerenter', () => { void warm(wrap(requested - 1)).catch(() => {}); });
  next.addEventListener('pointerenter', () => { void warm(wrap(requested + 1)).catch(() => {}); });
  figure.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    void show(requested + (event.key === 'ArrowRight' ? 1 : -1));
  });
  figure.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' || event.target.closest('button')) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    figure.setPointerCapture(event.pointerId);
  });
  figure.addEventListener('pointercancel', () => { pointer = null; });
  figure.addEventListener('pointerup', event => {
    const gesture = pointer;
    pointer = null;
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.3) void show(requested + (dx < 0 ? 1 : -1));
  });
  window.addEventListener('pagehide', () => { generation += 1; clearTransition(); figure.removeAttribute('aria-busy'); }, { once: true });
}

function initializeEntertainmentGalleries() {
  document.querySelectorAll('[data-entertainment-story]').forEach(story => initializeGallery(story, entertainmentGalleries[story.id]));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeEntertainmentGalleries, { once: true });
else initializeEntertainmentGalleries();
