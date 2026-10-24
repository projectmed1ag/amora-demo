import { getEntertainmentPhotographs } from './collection-entertainment-gallery-data.js?v=20261025-progressive-photos-1';
import { scheduleImagePrefetch, cancelImagePrefetch } from './collection-image-scheduler.js?v=20261025-progressive-photos-1';

const imageRoot = new URL('../', import.meta.url);
const city = document.documentElement.dataset.city || 'mozhaysk';
// 1.15 / 2.15 of the desktop row after its gutters and column gap.
const sizes = '(max-width: 700px) 100vw, (max-width: 800px) 91.6vw, (max-width: 1680px) 46.59vw, 800px';

function setPhotograph(image, photograph, gallerySizes = sizes) {
  image.sizes = gallerySizes;
  image.srcset = photograph.srcset
    ? photograph.srcset.split(',').map(candidate => {
      const [path, ...descriptor] = candidate.trim().split(/\s+/);
      return `${new URL(path, imageRoot).href} ${descriptor.join(' ')}`;
    }).join(', ')
    : photograph.mobileSrc
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
  if (!Array.isArray(photographs) || !photographs.length) return;
  const figure = story.querySelector('.entertainment-photo');
  let image = figure?.querySelector('img');
  if (!figure || !image || figure.dataset.galleryReady !== undefined) return;
  const title = story.querySelector('h2')?.textContent.trim() || 'Развлечения';
  const gallerySizes = figure.dataset.gallerySizes || sizes;
  const overview = story.closest('[data-entertainment-overview]');
  const keyFor = items => items.map(item => item.src).join('|');
  let collectionKey = keyFor(photographs);
  let displayedKey = collectionKey;
  let selected = 0;
  let requested = 0;
  let generation = 0;
  let pointer = null;
  let nearby = false;
  let visible = false;
  const prepared = new Map();
  const prefetchKey = {};

  figure.classList.add('entertainment-gallery');
  figure.dataset.galleryReady = '';
  figure.dataset.galleryIndex = '0';
  figure.setAttribute('role', 'group');
  figure.setAttribute('aria-roledescription', 'галерея');
  figure.setAttribute('aria-label', `Фотографии: ${title}`);
  image.draggable = false;
  // Retain the HTML image and its in-flight request. Reassigning src/srcset
  // during startup needlessly competes with the first requested photograph.
  const imageClass = image.className;
  prepared.set(0, image.hasAttribute('data-gallery-preview')
    ? { preview: image, previewReady: image.complete && image.naturalWidth > 0 }
    : { full: image, fullReady: image.complete && image.naturalWidth > 0 });

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
  function recordFor(index) {
    if (!prepared.has(index)) prepared.set(index, {});
    return prepared.get(index);
  }

  function decode(image) {
    if (image.complete && image.naturalWidth) return Promise.resolve(image);
    return image.decode().then(() => image);
  }

  function preparePreview(index, priority = 'low') {
    const record = recordFor(index);
    if (!record.previewPromise) {
      const preview = record.preview || new Image();
      if (!record.preview) {
        preview.decoding = 'async';
        preview.fetchPriority = priority;
        preview.src = new URL(photographs[index].previewSrc, imageRoot).href;
        preview.alt = photographs[index].alt;
        preview.width = photographs[index].width;
        preview.height = photographs[index].height;
      }
      record.preview = preview;
      record.previewPromise = decode(preview).then(() => {
        record.previewReady = true;
        return preview;
      });
      // Background requests must not produce an unhandled rejection.
      void record.previewPromise.catch(() => {});
    }
    record.preview.fetchPriority = priority;
    return record.previewPromise;
  }

  function prepareFull(index, priority = 'low') {
    const record = recordFor(index);
    if (!record.full) {
      record.full = new Image();
      record.full.decoding = 'async';
      record.full.loading = 'eager';
      record.full.fetchPriority = priority;
      setPhotograph(record.full, photographs[index], gallerySizes);
    }
    record.full.fetchPriority = priority;
    if (record.fullReady && !record.full.complete) {
      record.fullReady = false;
      record.fullPromise = null;
    }
    if (!record.fullPromise) {
      record.fullPromise = decode(record.full).then(() => {
        record.fullReady = true;
        return record.full;
      }).catch(error => {
        record.fullPromise = null;
        throw error;
      });
      void record.fullPromise.catch(() => {});
    }
    return record.fullPromise;
  }

  function warmNeighbours() {
    if (!visible) return;
    const origin = selected;
    const key = collectionKey;
    const token = generation;
    const after = wrap(origin + 1);
    const before = wrap(origin - 1);
    const needed = () => visible && selected === origin && requested === origin && collectionKey === key && generation === token;
    // The photograph already in view gets its sharp version first. Neighbour
    // requests used to delay that upgrade on cold, bandwidth-limited visits.
    void prepareFull(origin, 'high').then(full => {
      if (!needed()) return;
      if (full && image.hasAttribute('data-gallery-preview')) display(full, origin);
      scheduleImagePrefetch(prefetchKey, async () => {
        for (const index of [...new Set([after, before])]) {
          if (!needed()) return;
          await preparePreview(index).catch(() => {});
          if (!needed()) return;
          await prepareFull(index).catch(() => {});
        }
      }, needed);
    }).catch(() => {});
  }

  function display(node, index, preview = false) {
    const old = image;
    image = node;
    image.className = imageClass;
    image.removeAttribute('aria-hidden');
    image.draggable = false;
    image.alt = photographs[index].alt;
    image.toggleAttribute('data-gallery-preview', preview);
    // Swap already decoded nodes atomically. An animated outgoing overlay can
    // remain above the new photograph in background Safari windows.
    if (old !== image) old.replaceWith(image);
    selected = index;
    displayedKey = collectionKey;
    figure.dataset.galleryIndex = String(selected);
    position.textContent = `${selected + 1} / ${photographs.length}`;
    status.textContent = `${title}: фотография ${selected + 1} из ${photographs.length}`;
  }

  async function show(index) {
    requested = wrap(index);
    const target = requested;
    const token = ++generation;
    const record = recordFor(target);
    if (target === selected && displayedKey === collectionKey && !image.hasAttribute('data-gallery-preview')) {
      figure.removeAttribute('aria-busy');
      return;
    }
    figure.setAttribute('aria-busy', 'true');
    try {
      if (record.fullReady && record.full.complete && record.full.naturalWidth) display(record.full, target);
      else {
        cancelImagePrefetch(prefetchKey);
        // Respond with the selected photograph, even while its sharp version
        // is still crossing a slow connection. Never show a different frame.
        const previewReady = preparePreview(target, 'high');
        if (record.previewReady) display(record.preview, target, true);
        // Start the requested sharp photograph immediately. On a cold CDN a
        // preview can have its own round trip; it must not gate the real frame.
        const fullReady = prepareFull(target, 'high');
        const first = await Promise.any([previewReady, fullReady]);
        if (token !== generation) return;
        display(first, target, first === record.preview);
        const full = await fullReady;
        if (token !== generation) return;
        display(full, target);
      }
      figure.removeAttribute('aria-busy');
      warmNeighbours();
    } catch {
      if (token !== generation) return;
      figure.removeAttribute('aria-busy');
      status.textContent = 'Не удалось загрузить фотографию. Попробуйте другую.';
    }
  }

  previous.addEventListener('click', () => { void show(requested - 1); });
  next.addEventListener('click', () => { void show(requested + 1); });
  const anticipate = direction => {
    const target = wrap(requested + direction);
    void preparePreview(target).then(() => prepareFull(target)).catch(() => {});
  };
  previous.addEventListener('pointerenter', () => anticipate(-1));
  next.addEventListener('pointerenter', () => anticipate(1));
  figure.addEventListener('focusin', warmNeighbours);
  figure.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    void show(requested + (event.key === 'ArrowRight' ? 1 : -1));
  });
  figure.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' || event.target.closest('button')) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    warmNeighbours();
    figure.setPointerCapture(event.pointerId);
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      nearby = entries[0].isIntersecting;
      image.fetchPriority = nearby ? 'high' : 'low';
      if (nearby) {
        if (displayedKey !== collectionKey) void show(requested);
        else warmNeighbours();
      }
      else {
        cancelImagePrefetch(prefetchKey);
        // Retain only the displayed node off screen, allowing decoded buffers
        // from previously visited rows to be reclaimed on small devices.
        for (const index of prepared.keys()) if (index !== selected) prepared.delete(index);
      }
    }, { rootMargin: '160px 0px' });
    observer.observe(figure);
    const visibleObserver = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) warmNeighbours();
      else cancelImagePrefetch(prefetchKey);
    });
    visibleObserver.observe(figure);
  }
  figure.addEventListener('pointercancel', () => { pointer = null; });
  figure.addEventListener('pointerup', event => {
    const gesture = pointer;
    pointer = null;
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.3) void show(requested + (dx < 0 ? 1 : -1));
  });
  function updateSeason(season) {
    const items = getEntertainmentPhotographs(story.id, season, city);
    if (!items.length) return;
    figure.dataset.gallerySeason = season;
    const key = keyFor(items);
    controls.hidden = items.length < 2;
    if (key === collectionKey) return;
    generation += 1;
    cancelImagePrefetch(prefetchKey);
    photographs = items;
    collectionKey = key;
    requested = 0;
    selected = 0;
    prepared.clear();
    // Distant rows keep their existing valid node until they approach the
    // viewport. Only the selected season is downloaded and decoded there.
    if (nearby || visible || !('IntersectionObserver' in window)) void show(0);
  }
  const initialSeason = overview?.dataset.season || new URL(location.href).searchParams.get('season') || 'all';
  updateSeason(initialSeason);
  overview?.addEventListener('collection:leisure-season', event => updateSeason(event.detail.season));
  window.addEventListener('pagehide', () => { generation += 1; cancelImagePrefetch(prefetchKey); figure.removeAttribute('aria-busy'); }, { once: true });
}

function initializeEntertainmentGalleries() {
  document.querySelectorAll('[data-entertainment-story]').forEach(story => initializeGallery(story, getEntertainmentPhotographs(story.id, 'all', city)));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeEntertainmentGalleries, { once: true });
else initializeEntertainmentGalleries();
