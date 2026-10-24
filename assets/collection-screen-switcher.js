import { scheduleImagePrefetch, cancelImagePrefetch } from './collection-image-scheduler.js?v=20261025-progressive-photos-1';

// Home chapters behave as separate scenes. The document remains readable when
// this enhancement is unavailable and for chapters taller than a small window.
export function createScreenSwitcher({ main, getTargets, getOffset, onUpdate = () => {} }) {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const nativeScrolling = matchMedia('(hover: none) and (pointer: coarse)');
  const initialHash = location.hash;
  const removers = [];
  const decodedPhotos = new WeakMap();
  const prefetchKey = {};
  let current = null;
  let movement = null;
  let queued = null;
  let generation = 0;
  let interacted = false;
  let initialAligned = false;
  let wheelSum = 0;
  let wheelAt = 0;
  let wheelLatched = false;
  let wheelMagnitude = 0;
  let wheelPulseMatches = 0;
  let touch = null;
  let resizeFrame = 0;

  root.classList.add('collection-screen-mode');
  root.dataset.chapterEngine = 'direct';

  const chapters = () => getTargets().filter(element => element.isConnected);
  const header = () => Math.max(0, Number(getOffset()) || 0);
  const bottom = () => {
    const navigation = document.querySelector('.section-navigation');
    return navigation && getComputedStyle(navigation).display === 'grid'
      ? navigation.getBoundingClientRect().height : 0;
  };
  const maximum = () => Math.max(0, root.scrollHeight - innerHeight);
  const clamp = value => Math.max(0, Math.min(maximum(), value));
  const startOf = element => clamp(element.getBoundingClientRect().top + scrollY - header());
  const endOf = element => Math.max(startOf(element), clamp(element.getBoundingClientRect().bottom + scrollY - innerHeight + bottom()));

  function instantScroll(top) {
    const value = root.style.getPropertyValue('scroll-behavior');
    const priority = root.style.getPropertyPriority('scroll-behavior');
    root.style.setProperty('scroll-behavior', 'auto', 'important');
    window.scrollTo({ top: clamp(top), left: 0, behavior: 'auto' });
    if (value) root.style.setProperty('scroll-behavior', value, priority);
    else root.style.removeProperty('scroll-behavior');
  }

  async function warmPhotos(element, priority = 'high', needed = () => true) {
    const pending = [...element.querySelectorAll('img')].filter(photo => photo.getAttribute('src') || photo.getAttribute('srcset'));
    const prepare = photo => {
      if (photo.loading === 'lazy') photo.loading = 'eager';
      photo.decoding = 'async';
      photo.fetchPriority = priority;
      if (photo.dataset.imageSrcset) photo.srcset = photo.dataset.imageSrcset;
      if (photo.dataset.imageSrc) photo.src = photo.dataset.imageSrc;
      delete photo.dataset.imageSrc;
      delete photo.dataset.imageSrcset;
      delete photo.dataset.imageDeferred;
      const source = `${photo.src}|${photo.srcset}|${photo.sizes}`;
      const cached = decodedPhotos.get(photo);
      if (cached?.source === source) return cached.ready;
      if (photo.decode) {
        const ready = photo.decode().catch(() => {});
        decodedPhotos.set(photo, { source, ready });
        return ready;
      }
    };
    if (priority === 'high') return Promise.allSettled(pending.map(prepare));
    for (const photo of pending) {
      if (!needed()) return;
      await prepare(photo);
    }
  }

  function activate(element) {
    if (!element) return;
    current = element;
    chapters().forEach(chapter => chapter.toggleAttribute('data-screen-active', chapter === element));
    // Current scene images go first. Adjacent scenes warm in a single idle
    // queue after the first screen has loaded, rather than all at startup.
    const all = chapters();
    const index = all.indexOf(element);
    const token = generation;
    cancelImagePrefetch(prefetchKey);
    void warmPhotos(element);
    const needed = () => current === element && generation === token;
    scheduleImagePrefetch(prefetchKey, async () => {
      for (const neighbour of [all[index + 1], all[index - 1]]) {
        if (!needed()) return;
        if (neighbour) await warmPhotos(neighbour, 'low', needed);
      }
    }, needed);
    onUpdate();
  }

  function fromScroll() {
    const all = chapters();
    let selected = all[0];
    all.forEach(chapter => { if (chapter.getBoundingClientRect().top <= header() + 40) selected = chapter; });
    return selected;
  }

  function syncTargets() {
    const all = chapters();
    if (!all.includes(current)) activate(fromScroll() || all[0]);
  }

  function cancel() {
    generation += 1;
    cancelImagePrefetch(prefetchKey);
    queued?.resolve(false);
    queued = null;
    if (!movement) return;
    const old = movement;
    movement = null;
    cancelAnimationFrame(old.frame);
    old.resolve?.(false);
    old.cleanup?.();
    onUpdate();
  }

  function writeHash(element, push) {
    const url = new URL(location.href);
    url.hash = element.id;
    if (url.href !== location.href) history[push ? 'pushState' : 'replaceState'](history.state, '', url);
  }

  async function navigateTo(element, { immediate = false, focus = true, updateHistory = true, pushHistory = true } = {}) {
    if (!chapters().includes(element)) return false;
    interacted = true;
    // Keep one fresh intent while the current scene settles. Repeated commands
    // replace that intent rather than restarting the animation or getting lost.
    if (movement && !immediate && !reduced.matches) {
      queued?.resolve(false);
      queued = null;
      if (element === movement.target) return true;
      return new Promise(resolve => {
        queued = { element, options: { focus, updateHistory, pushHistory }, resolve };
      });
    }
    cancel();
    const token = generation;
    const old = current || fromScroll();
    const jump = () => {
      instantScroll(startOf(element));
      activate(element);
      if (updateHistory) writeHash(element, pushHistory);
      if (focus) element.focus({ preventScroll: true });
    };
    warmPhotos(element);
    if (immediate || reduced.matches || old === element && !nativeScrolling.matches) {
      jump();
      return true;
    }
    const task = { target: element, animations: [] };
    movement = task;
    try {
      const viewport = innerHeight - header() - bottom();
      const fits = chapter => chapter && chapter.getBoundingClientRect().height <= viewport + 2;
      const aligned = old && Math.abs(old.getBoundingClientRect().top - header()) <= 2;
      if (!nativeScrolling.matches && old?.animate && element.animate && fits(old) && fits(element) && aligned) {
        // Move the real, opaque sections on compositor layers. No screen
        // captures, frozen browser overlay or full-page reraster is involved.
        // Both transforms and the document jump are installed before painting.
        const direction = chapters().indexOf(element) > chapters().indexOf(old) ? 1 : -1;
        const delta = startOf(element) - scrollY;
        root.classList.add('collection-slide-active');
        old.classList.add('is-chapter-moving');
        element.classList.add('is-chapter-moving');
        task.cleanup = () => {
          task.animations.forEach(animation => animation.cancel());
          old.classList.remove('is-chapter-moving');
          element.classList.remove('is-chapter-moving');
          root.classList.remove('collection-slide-active');
        };
        jump();
        const options = { duration: 520, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' };
        const translate = y => `translate3d(0,${y}px,0)`;
        task.animations.push(old.animate([
          { transform: translate(delta) },
          { transform: translate(delta - direction * viewport) },
        ], options));
        task.animations.push(element.animate([
          { transform: translate(direction * viewport) },
          { transform: translate(0) },
        ], options));
        const clock = document.timeline.currentTime;
        if (clock !== null) task.animations.forEach(animation => { animation.startTime = clock; });
        await Promise.allSettled(task.animations.map(animation => animation.finished));
      } else {
        // Short windows use a continuous document movement.
        // Tall scenes keep their natural reading area instead of being cropped.
        const start = scrollY;
        const finish = startOf(element);
        const started = performance.now();
        activate(element);
        if (updateHistory) writeHash(element, pushHistory);
        await new Promise(resolve => {
          task.resolve = resolve;
          const step = now => {
            if (token !== generation) { resolve(false); return; }
            const progress = Math.min(1, (now - started) / 520);
            const eased = progress * progress * (3 - 2 * progress);
            instantScroll(start + (finish - start) * eased);
            if (progress < 1) task.frame = requestAnimationFrame(step);
            else { if (focus) element.focus({ preventScroll: true }); resolve(true); }
          };
          task.frame = requestAnimationFrame(step);
        });
      }
      return token === generation;
    } catch {
      // Animation support may be disabled by the browser. Preserve navigation.
      task.cleanup?.();
      if (token === generation) jump();
      return token === generation;
    } finally {
      if (movement === task) {
        task.cleanup?.();
        movement = null;
        const pending = queued;
        queued = null;
        if (pending && reduced.matches) pending.resolve(false);
        else if (pending) queueMicrotask(() => {
          navigateTo(pending.element, pending.options).then(pending.resolve);
        });
      }
      onUpdate();
    }
  }

  function isEditable(target) {
    return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"], [role="slider"], [role="spinbutton"]');
  }

  function nestedScroll(target, direction) {
    let element = target instanceof Element ? target : null;
    while (element && element !== document.body && element !== root) {
      const style = getComputedStyle(element);
      if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1) {
        if (direction > 0 ? element.scrollTop + element.clientHeight < element.scrollHeight - 1 : element.scrollTop > 1) return true;
      }
      // An open menu owns its wheel/touch gesture even at its scroll boundary.
      if (element.matches('.home-nav, .site-nav, dialog, [role="dialog"]')) return true;
      element = element.parentElement;
    }
    return false;
  }

  function canRead(direction) {
    if (!current) return false;
    return direction > 0 ? scrollY < endOf(current) - 2 : scrollY > startOf(current) + 2;
  }

  function neighbour(direction, base = queued?.element || movement?.target || current) {
    const all = chapters();
    return all[all.indexOf(base) + direction];
  }

  function wheel(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY) || isEditable(event.target)) return;
    const direction = Math.sign(event.deltaY);
    if (nestedScroll(event.target, direction)) return;
    interacted = true;
    syncTargets();
    const now = performance.now();
    const elapsed = now - wheelAt;
    const quiet = elapsed > 180;
    wheelAt = now;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    const magnitude = Math.abs(delta);
    // A mouse wheel sends steady, separated notches. A trackpad's inertial tail
    // decays and must not schedule more chapters after the visitor stops.
    const matchingPulse = !quiet && elapsed >= 40 && magnitude >= 48
      && Math.abs(magnitude - wheelMagnitude) <= Math.max(1, magnitude * .02);
    wheelPulseMatches = matchingPulse ? wheelPulseMatches + 1 : 0;
    wheelMagnitude = magnitude;
    const notches = wheelPulseMatches >= 2;
    if (movement) {
      event.preventDefault();
      // A tall destination must first be read in place. Its next gesture is
      // ordinary document reading, not a request to skip the unseen content.
      if (endOf(movement.target) > startOf(movement.target) + 2) return;
      if (quiet) { wheelLatched = false; wheelSum = 0; }
      if (!wheelLatched || notches) {
        wheelSum = Math.sign(wheelSum) === direction ? wheelSum + delta : delta;
        if (Math.abs(wheelSum) >= 32) {
          // Continuous mouse notches keep just one following step. Separate
          // gestures can update the intended final chapter in either direction.
          const target = notches && wheelLatched
            ? (queued ? null : neighbour(direction, movement.target))
            : neighbour(direction);
          if (target) void navigateTo(target, { pushHistory: false });
          wheelSum = 0;
          wheelLatched = true;
        }
      }
      return;
    }
    if (wheelLatched && !quiet && !notches) { event.preventDefault(); return; }
    if (quiet) { wheelLatched = false; wheelSum = 0; }
    if (canRead(direction)) {
      // Read a tall chapter naturally, but do not spill into a different scene.
      const edge = direction > 0 ? endOf(current) : startOf(current);
      if (direction > 0 ? scrollY + delta > edge : scrollY + delta < edge) {
        event.preventDefault();
        instantScroll(edge);
        wheelLatched = true;
      }
      return;
    }
    const target = neighbour(direction);
    if (!target) return; // The ordinary footer remains reachable after the last chapter.
    event.preventDefault();
    wheelSum = Math.sign(wheelSum) === direction ? wheelSum + delta : delta;
    if (Math.abs(wheelSum) < 32) return;
    wheelSum = 0;
    wheelLatched = true;
    void navigateTo(target, { pushHistory: false });
  }

  function keydown(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target) || event.target instanceof Element && event.target.closest('a, button, .home-nav, .site-nav')) return;
    const directions = { ArrowDown: 1, PageDown: 1, ' ': event.shiftKey ? -1 : 1, ArrowUp: -1, PageUp: -1 };
    const direction = directions[event.key];
    if (!direction && event.key !== 'Home' && event.key !== 'End') return;
    if (nativeScrolling.matches) { interacted = true; cancel(); return; }
    syncTargets();
    if (direction && movement && endOf(movement.target) > startOf(movement.target) + 2) {
      event.preventDefault();
      return;
    }
    if (!movement && direction && canRead(direction)) return;
    const target = event.key === 'Home' ? chapters()[0] : event.key === 'End' ? chapters().at(-1) : neighbour(direction);
    if (!target) return;
    event.preventDefault();
    if (!event.repeat) void navigateTo(target, { pushHistory: false });
  }

  function touchstart(event) {
    const menuOpen = document.querySelector('.home-menu-toggle:checked, .site-header.menu-open, .site-header [aria-expanded="true"]');
    if (menuOpen || event.touches.length !== 1 || isEditable(event.target)) { touch = null; return; }
    syncTargets();
    if (!movement) {
      const selected = fromScroll();
      if (selected && selected !== current) activate(selected);
    }
    const point = event.touches[0];
    touch = { x: point.clientX, y: point.clientY, lastY: point.clientY, target: event.target, axis: null, blocked: false, reading: false, ignored: false };
    interacted = true;
  }

  function touchmove(event) {
    if (!touch || event.touches.length !== 1) { touch = null; return; }
    const point = event.touches[0];
    const dy = touch.y - point.clientY;
    const dx = touch.x - point.clientX;
    if (!touch.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      touch.axis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }
    // Horizontal photo gestures and pinch zoom keep their normal owner.
    if (touch.axis !== 'vertical' || touch.ignored) return;
    const direction = Math.sign(dy);
    if (nestedScroll(touch.target, direction)) { touch.ignored = true; return; }
    syncTargets();
    if (movement) {
      event.preventDefault();
      touch.blocked = endOf(movement.target) <= startOf(movement.target) + 2 && !!neighbour(direction);
      return;
    }
    if (!touch.blocked && (touch.reading || canRead(direction))) {
      touch.reading = true;
      const delta = touch.lastY - point.clientY;
      // Keep a reading gesture inside its tall chapter, including its momentum.
      // A fresh swipe at the edge advances exactly one chapter, like an arrow.
      event.preventDefault();
      instantScroll(Math.max(startOf(current), Math.min(endOf(current), scrollY + delta)));
      touch.lastY = point.clientY;
      return;
    }
    if (neighbour(direction)) {
      event.preventDefault();
      touch.blocked = true;
    }
  }

  function touchend(event) {
    const gesture = touch;
    touch = null;
    if (!gesture || gesture.ignored || gesture.reading || !gesture.blocked) return;
    const point = event.changedTouches[0];
    if (!point) return;
    const dy = gesture.y - point.clientY;
    if (Math.abs(dy) < 45 || Math.abs(dy) < Math.abs(gesture.x - point.clientX)) return;
    const target = neighbour(Math.sign(dy));
    if (target) void navigateTo(target, { pushHistory: false });
  }

  function hashTarget() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return null; }
    // Preserve links to chapters that have since joined a shared section.
    const mergedChapters = {
      top: 'section-home',
      route: 'section-stays',
      gallery: 'section-stays',
      spaces: 'section-leisure',
      panorama: 'section-home',
      'section-about': 'section-home',
      'section-details': 'section-stays',
      'section-walks': 'section-leisure',
      'section-place': 'section-home',
      'section-water': 'section-leisure',
      'section-evening': 'section-leisure',
    };
    if (mergedChapters[id] && !chapters().some(chapter => chapter.id === id)) {
      id = mergedChapters[id];
      const url = new URL(location.href);
      url.hash = id;
      history.replaceState(history.state, '', url);
    }
    return chapters().find(chapter => chapter.id === id);
  }

  async function alignInitialHash() {
    if (initialAligned) return false;
    initialAligned = true;
    try { await document.fonts?.ready; } catch { /* Existing fonts remain usable. */ }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (interacted || !initialHash || location.hash !== initialHash) return false;
    const target = hashTarget();
    return target ? navigateTo(target, { immediate: true, focus: false, updateHistory: false }) : false;
  }

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    removers.push(() => target.removeEventListener(type, handler, options));
  }
  const gestureOptions = { passive: false };
  function syncInputMode() {
    cancel();
    touch = null;
    wheelSum = 0;
    wheelLatched = false;
    root.classList.toggle('collection-native-scroll', nativeScrolling.matches);
    root.dataset.chapterScroll = nativeScrolling.matches ? 'native' : 'scenes';
    // Only the chapter surface owns vertical swipes. Menus and other pages keep
    // their native scrolling, and mobile browser chrome never resizes a scene.
    window.removeEventListener('wheel', wheel, gestureOptions);
    main.removeEventListener('touchmove', touchmove, gestureOptions);
    main.addEventListener('touchmove', touchmove, gestureOptions);
    if (!nativeScrolling.matches) {
      window.addEventListener('wheel', wheel, gestureOptions);
    }
  }
  syncInputMode();
  listen(nativeScrolling, 'change', syncInputMode);
  removers.push(() => {
    window.removeEventListener('wheel', wheel, gestureOptions);
    main.removeEventListener('touchmove', touchmove, gestureOptions);
  });
  listen(window, 'keydown', keydown);
  listen(main, 'touchstart', touchstart, { passive: true });
  listen(window, 'touchend', touchend, { passive: true });
  listen(window, 'touchcancel', () => { touch = null; }, { passive: true });
  listen(window, 'scroll', () => {
    if (!movement) {
      const selected = fromScroll();
      if (selected && selected !== current) {
        activate(selected);
        // Native reading/Home/End can still move the document. Keep Back's
        // previous scene accurate without overriding initial fragment lookup.
        if (interacted) writeHash(selected, false);
      }
    }
    onUpdate();
  }, { passive: true });
  const alignHistory = () => {
    const target = hashTarget();
    if (target) void navigateTo(target, { immediate: true, focus: false, updateHistory: false });
  };
  listen(window, 'popstate', alignHistory);
  listen(window, 'hashchange', alignHistory);
  listen(window, 'resize', () => {
    cancelAnimationFrame(resizeFrame);
    if (nativeScrolling.matches) {
      // Mobile browser chrome changes viewport height while reading. Never
      // rewind the page or interrupt an ongoing finger/inertial scroll for it.
      resizeFrame = requestAnimationFrame(() => {
        if (!movement) {
          const selected = fromScroll();
          if (selected && selected !== current) activate(selected);
        }
        onUpdate();
      });
      return;
    }
    cancel();
    resizeFrame = requestAnimationFrame(() => { if (current) instantScroll(startOf(current)); onUpdate(); });
  });
  listen(window, 'pagehide', cancel);
  listen(window, 'pageshow', () => { syncTargets(); alignHistory(); });
  listen(reduced, 'change', () => { if (reduced.matches) { cancel(); if (current) instantScroll(startOf(current)); } });

  return {
    navigateTo, alignInitialHash, cancel, syncTargets,
    getCurrentTarget: () => current,
    destroy() {
      cancel();
      cancelAnimationFrame(resizeFrame);
      removers.forEach(remove => remove());
      root.classList.remove('collection-screen-mode', 'collection-native-scroll');
      delete root.dataset.chapterEngine;
      delete root.dataset.chapterScroll;
    },
  };
}
