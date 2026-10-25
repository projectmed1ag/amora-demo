import { getEntertainmentPhotographs } from './collection-entertainment-photographs.js?v=20261025-sharp-gallery-1';
import { scheduleImagePrefetch, cancelImagePrefetch } from './collection-image-scheduler.js?v=20261025-progressive-photos-1';

// Keep a small shared cache of detached frames, rather than every decoded
// photograph from every visited season. Displayed DOM images remain browser-owned.
const frameCache = new Map();
const visibleLoads = new Set();
// Only one approaching row may download at once. Visible/user-selected frames
// bypass this queue; low-priority rows must not flood a slow connection.
const approaching = new Map();
let approachRunning = false;
function pumpApproaching() {
  if (approachRunning || !approaching.size) return;
  approachRunning = true;
  setTimeout(async () => {
    try {
      while (visibleLoads.size) await Promise.allSettled([...visibleLoads]);
      for (const [key, job] of approaching) if (!job.needed()) approaching.delete(key);
      const first = [...approaching].sort((a, b) => a[1].distance() - b[1].distance())[0];
      if (!first) return;
      approaching.delete(first[0]);
      await first[1].run();
    } catch { /* A failed optional frame must not stall the queue. */ }
    finally { approachRunning = false; pumpApproaching(); }
  }, 120);
}

const avifSupported = new Promise(resolve => {
  const probe = new Image();
  probe.onload = () => resolve(probe.naturalWidth > 0);
  probe.onerror = () => resolve(false);
  probe.src = 'data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAANZtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAAA+gABAAAAAAAAAB0AAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABhdjAxAAAAAA5waXRtAAAAAAABAAAAVmlwcnAAAAA4aXBjbwAAAAxhdjFDgSACAAAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAABZpcG1hAAAAAAAAAAEAAQOBAgMAAAAlbWRhdBIACgc4AAaQENBpMhAZQmMEwAA0AACQQMkcYIpq';
});
function trimFrames() {
  const detached = [...frameCache].filter(([, record]) => !record.pending && !record.full?.isConnected);
  while (detached.length > 8) frameCache.delete(detached.shift()[0]);
}

const imageRoot = new URL('../', import.meta.url);
const city = document.documentElement.dataset.city || 'mozhaysk';
// 1.15 / 2.15 of the desktop row after its gutters and column gap.
const sizes = '(max-width: 700px) 100vw, (max-width: 800px) 91.6vw, (max-width: 1680px) 46.59vw, 800px';

function setPhotograph(image, photograph, gallerySizes = sizes, avif = false) {
  image.sizes = gallerySizes;
  // The regional galleries keep over 2x density on phones without downloading
  // a desktop photograph just because the screen reports DPR 3.
  const mobile = matchMedia('(max-width: 700px)').matches;
  const responsive = avif
    ? (mobile ? photograph.avifMobileSrcset : photograph.avifSrcset)
    : (mobile && photograph.mobileSrcset) || photograph.srcset;
  image.srcset = responsive
    ? responsive.split(',').map(candidate => {
      const [path, ...descriptor] = candidate.trim().split(/\s+/);
      return `${new URL(path, imageRoot).href} ${descriptor.join(' ')}`;
    }).join(', ')
    : photograph.mobileSrc
      ? `${new URL(photograph.mobileSrc, imageRoot).href} ${photograph.mobileWidth}w, ${new URL(photograph.src, imageRoot).href} ${photograph.width}w`
      : '';
  image.src = new URL(avif
    ? (mobile ? photograph.avifMobileSrc : photograph.avifSrc)
    : (mobile && photograph.mobileSrc) || photograph.src, imageRoot).href;
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
  const initialPicture = image.parentElement;
  if (initialPicture?.matches('picture.collection-picture')) {
    // A remaining <source> would override later gallery frames. Keep the same
    // image node and chosen candidate while turning it into an ordinary frame.
    const selected = image.currentSrc;
    if (!selected) {
      // Native source selection normally finishes before this module executes.
      // If it has not, wait for that decision instead of guessing AVIF support
      // and starting a second, fallback request.
      if (figure.dataset.galleryPicturePending !== undefined) return;
      figure.dataset.galleryPicturePending = '';
      let frame;
      const cleanup = () => {
        cancelAnimationFrame(frame);
        image.removeEventListener('load', retry);
        image.removeEventListener('error', fallback);
        delete figure.dataset.galleryPicturePending;
      };
      const retry = () => {
        if (!image.isConnected) { cleanup(); return; }
        if (!image.currentSrc) return;
        cleanup();
        initializeGallery(story, photographs);
      };
      const fallback = () => {
        cleanup();
        // A failed native candidate may still use the authored WebP fallback.
        if (initialPicture.isConnected) initialPicture.replaceWith(image);
        initializeGallery(story, photographs);
      };
      image.addEventListener('load', retry, { once: true });
      image.addEventListener('error', fallback, { once: true });
      frame = requestAnimationFrame(retry);
      return;
    }
    const selectedSource = [...initialPicture.querySelectorAll('source[srcset]')].find(source =>
      source.srcset.split(',').some(candidate => {
        const path = candidate.trim().split(/\s+/)[0];
        return path && new URL(path, image.baseURI).href === selected;
      }));
    if (selectedSource) {
      image.sizes = selectedSource.sizes || image.sizes;
      image.srcset = selectedSource.srcset;
      image.src = selected;
    }
    initialPicture.replaceWith(image);
  }
  const title = story.querySelector('h2')?.textContent.trim() || 'Развлечения';
  const gallerySizes = figure.dataset.gallerySizes || sizes;
  const overview = story.closest('[data-entertainment-overview]');
  const keyFor = items => items.map(item => item.src).join('|');
  const cacheKey = photograph => `${photograph.src}|${matchMedia('(max-width: 700px)').matches ? 'mobile' : gallerySizes}`;
  let collectionKey = keyFor(photographs);
  let displayedKey = '';
  let selected = 0;
  let requested = 0;
  let generation = 0;
  let pointer = null;
  let nearby = false;
  let visible = false;
  const prefetchKey = {};

  figure.classList.add('entertainment-gallery');
  figure.dataset.galleryReady = '';
  figure.dataset.galleryIndex = '0';
  figure.setAttribute('role', 'group');
  figure.setAttribute('aria-roledescription', 'галерея');
  figure.setAttribute('aria-label', `Фотографии: ${title}`);
  image.draggable = false;
  const imageClass = image.className;
  // Early entry loading may already have the correct seasonal/anchor frame.
  // Keep its native request, including the browser's AVIF/WebP choice.
  const original = getEntertainmentPhotographs(story.id, 'all', city)[0];
  const initialSource = image.dataset.gallerySource || (!image.hasAttribute('data-gallery-preview') ? original?.src : null);
  if (initialSource === photographs[0].src && !image.hasAttribute('data-gallery-preview')) {
    frameCache.set(cacheKey(photographs[0]), { full: image, fullReady: image.complete && image.naturalWidth > 0 });
    displayedKey = collectionKey;
  }

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
  controls.hidden = photographs.length < 2;
  controls.append(previous, position, next);
  figure.append(controls, status);

  const wrap = index => (index + photographs.length) % photographs.length;
  function recordFor(index) {
    const key = cacheKey(photographs[index]);
    const record = frameCache.get(key) || {};
    frameCache.delete(key);
    frameCache.set(key, record);
    return record;
  }

  function decode(node) {
    return node.decode().then(() => {
      if (!node.naturalWidth) throw new Error('Empty photograph');
      return node;
    });
  }

  function prepareFull(index, priority = 'low') {
    const photograph = photographs[index];
    const record = recordFor(index);
    if (record.full) record.full.fetchPriority = priority;
    if (!record.fullPromise) {
      record.pending = true;
      record.fullPromise = (async () => {
        const create = format => {
          const node = new Image();
          node.decoding = 'async';
          node.loading = 'eager';
          node.fetchPriority = priority;
          setPhotograph(node, photograph, gallerySizes, format);
          return node;
        };
        let avif;
        if (!record.full) {
          avif = photograph.avifSrc && await avifSupported;
          record.full = create(avif);
        } else avif = /\.avif(?:[?#]|$)/i.test(record.full.currentSrc || record.full.src);
        try { await decode(record.full); }
        catch (error) {
          if (!avif || !photograph.avifSrc) throw error;
          // Native entry frames and dynamic frames share the same fallback.
          record.full = create(false);
          await decode(record.full);
        }
        record.fullReady = true;
        return record.full;
      })().catch(error => {
        record.full = null;
        record.fullReady = false;
        record.fullPromise = null;
        throw error;
      }).finally(() => { record.pending = false; trimFrames(); });
      void record.fullPromise.catch(() => {});
    }
    return record.fullPromise;
  }

  function display(node, index) {
    const old = image;
    image = node;
    image.className = imageClass;
    image.removeAttribute('aria-hidden');
    image.removeAttribute('data-gallery-preview');
    image.removeAttribute('style');
    image.dataset.gallerySource = photographs[index].src;
    image.draggable = false;
    image.alt = photographs[index].alt;
    // Only decoded full frames replace the current photograph. A cold request
    // keeps the previous sharp image and counter until the requested one is ready.
    if (old !== image) old.replaceWith(image);
    selected = index;
    displayedKey = collectionKey;
    figure.dataset.galleryIndex = String(selected);
    position.textContent = `${selected + 1} / ${photographs.length}`;
    status.textContent = `${title}: фотография ${selected + 1} из ${photographs.length}`;
    trimFrames();
  }

  function warmNeighbours() {
    if (!visible || story.hidden || requested !== selected || displayedKey !== collectionKey) return;
    const origin = selected;
    const key = collectionKey;
    const token = generation;
    const needed = () => visible && !story.hidden && selected === origin && requested === origin && collectionKey === key && generation === token;
    scheduleImagePrefetch(prefetchKey, async () => {
      for (const index of [...new Set([wrap(origin + 1), wrap(origin - 1)])]) {
        if (!needed()) return;
        await prepareFull(index).catch(() => {});
      }
    }, needed);
  }

  async function show(index) {
    requested = wrap(index);
    const target = requested;
    const token = ++generation;
    const record = recordFor(target);
    cancelImagePrefetch(prefetchKey);
    if (target === selected && displayedKey === collectionKey && record.fullReady && image === record.full) {
      figure.removeAttribute('aria-busy');
      warmNeighbours();
      return;
    }
    figure.setAttribute('aria-busy', 'true');
    status.textContent = 'Загрузка фотографии';
    const pending = prepareFull(target, visible ? 'high' : 'low');
    if (visible) visibleLoads.add(pending);
    try {
      const full = await pending;
      if (token !== generation) return;
      display(full, target);
      figure.removeAttribute('aria-busy');
      warmNeighbours();
    } catch {
      if (token !== generation) return;
      figure.removeAttribute('aria-busy');
      status.textContent = 'Не удалось загрузить фотографию. Попробуйте ещё раз.';
    } finally { visibleLoads.delete(pending); }
  }

  // A viewport of lead time prepares the next row before it appears. The
  // shared queue reserves bandwidth for explicit switches and visible frames.
  function warmCurrent() {
    approaching.delete(prefetchKey);
    if (story.hidden || !nearby) return;
    if (visible) { void show(requested); return; }
    if (displayedKey === collectionKey && selected === requested && !image.hasAttribute('data-gallery-preview')) return;
    approaching.set(prefetchKey, {
      needed: () => nearby && !visible && !story.hidden,
      distance: () => {
        const rect = figure.getBoundingClientRect();
        return rect.top >= innerHeight ? rect.top - innerHeight : -rect.bottom;
      },
      run: () => show(requested),
    });
    pumpApproaching();
  }
  previous.addEventListener('click', () => { void show(requested - 1); });
  next.addEventListener('click', () => { void show(requested + 1); });
  const anticipate = direction => {
    if (visible) void prepareFull(wrap(requested + direction)).catch(() => {});
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
      if (nearby) warmCurrent();
      else { approaching.delete(prefetchKey); cancelImagePrefetch(prefetchKey); }
    }, { rootMargin: '800px 0px' });
    observer.observe(figure);
    const visibleObserver = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) { nearby = true; warmCurrent(); }
      else cancelImagePrefetch(prefetchKey);
    });
    visibleObserver.observe(figure);
  } else { nearby = true; visible = true; warmCurrent(); }
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
    figure.dataset.gallerySeason = season;
    // Invalidate pending work even for a row hidden in this season.
    if (!items.length) {
      generation += 1;
      approaching.delete(prefetchKey);
      cancelImagePrefetch(prefetchKey);
      figure.removeAttribute('aria-busy');
      return;
    }
    const key = keyFor(items);
    controls.hidden = items.length < 2;
    if (key === collectionKey) return;
    generation += 1;
    cancelImagePrefetch(prefetchKey);
    photographs = items;
    collectionKey = key;
    requested = 0;
    // Keep the old sharp DOM frame until the new seasonal one is decoded.
    if (nearby && !story.hidden) warmCurrent();
  }
  const initialSeason = overview?.dataset.season || document.documentElement.dataset.galleryEntrySeason || new URL(location.href).searchParams.get('season') || 'all';
  updateSeason(initialSeason);
  overview?.addEventListener('collection:leisure-season', event => updateSeason(event.detail.season));
  window.addEventListener('pagehide', () => {
    generation += 1;
    approaching.delete(prefetchKey);
    cancelImagePrefetch(prefetchKey);
    figure.removeAttribute('aria-busy');
  }, { once: true });
}

function initializeEntertainmentGalleries() {
  const season = document.querySelector('[data-entertainment-overview]')?.dataset.season || document.documentElement.dataset.galleryEntrySeason || new URL(location.href).searchParams.get('season') || 'all';
  document.querySelectorAll('[data-entertainment-story]').forEach(story => {
    const items = getEntertainmentPhotographs(story.id, season, city);
    initializeGallery(story, items.length ? items : getEntertainmentPhotographs(story.id, 'all', city));
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeEntertainmentGalleries, { once: true });
else initializeEntertainmentGalleries();
