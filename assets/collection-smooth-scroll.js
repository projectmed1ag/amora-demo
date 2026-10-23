// Deliberate chapter-link movement without taking control of wheel or touch.
// All ordinary anchors remain usable when this optional module is unavailable.
export function createChapterScroller({ getOffset = () => 0, onUpdate = () => {} } = {}) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const navigationKeys = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar', 'Tab', 'Escape',
  ]);
  const initialHash = location.hash;
  const removers = [];
  let movement = null;
  let interactionVersion = 0;
  let initialScheduled = false;
  let initialSuperseded = false;
  let destroyed = false;

  const easeInOutCubic = progress => progress < .5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

  function destinationTop(target) {
    const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const offset = Math.max(0, Number(getOffset()) || 0);
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    return Math.min(maximum, Math.max(0, top));
  }

  function forceInstantScrolling() {
    const style = document.documentElement.style;
    const previousValue = style.getPropertyValue('scroll-behavior');
    const previousPriority = style.getPropertyPriority('scroll-behavior');
    // Otherwise an existing CSS scroll-behavior:smooth would ease every frame
    // again, making the controlled animation lag behind its own positions.
    style.setProperty('scroll-behavior', 'auto', 'important');
    return () => {
      if (previousValue) style.setProperty('scroll-behavior', previousValue, previousPriority);
      else style.removeProperty('scroll-behavior');
    };
  }

  function cancel() {
    if (!movement) return;
    const canceled = movement;
    movement = null;
    cancelAnimationFrame(canceled.frame);
    canceled.restoreStyle();
    canceled.resolve(false);
    onUpdate();
  }

  function writeHash(target) {
    if (!target.id) return;
    const url = new URL(location.href);
    url.hash = target.id;
    if (url.href !== location.href) history.pushState(history.state, '', url);
  }

  function move(target, { focus = true, immediate = false, updateHistory = true } = {}) {
    cancel();
    if (destroyed || !target?.isConnected) return Promise.resolve(false);
    if (updateHistory) writeHash(target);
    const start = window.scrollY;
    const end = destinationTop(target);
    const distance = Math.abs(end - start);
    const restoreStyle = forceInstantScrolling();
    const scroll = top => window.scrollTo({ top, left: window.scrollX, behavior: 'auto' });
    const finishFocus = () => {
      if (focus && target.isConnected) target.focus({ preventScroll: true });
    };

    if (immediate || reducedMotion.matches || distance < 1) {
      scroll(end);
      restoreStyle();
      finishFocus();
      onUpdate();
      return Promise.resolve(true);
    }

    const duration = Math.min(1200, Math.max(850, 850 + distance * .08));
    return new Promise(resolve => {
      const current = {
        target, resolve, restoreStyle, frame: 0,
        startedAt: performance.now(),
      };
      movement = current;
      const tick = now => {
        if (movement !== current) return;
        if (!target.isConnected) {
          cancel();
          return;
        }
        const progress = Math.min(1, Math.max(0, (now - current.startedAt) / duration));
        // Re-measure the destination as photographs/font metrics settle. The
        // animation never assumes that every chapter has a viewport height.
        const destination = destinationTop(target);
        scroll(start + (destination - start) * easeInOutCubic(progress));
        onUpdate();
        if (progress < 1) {
          current.frame = requestAnimationFrame(tick);
          return;
        }
        movement = null;
        current.restoreStyle();
        finishFocus();
        current.resolve(true);
      };
      current.frame = requestAnimationFrame(tick);
    });
  }

  function navigateTo(target, options) {
    initialSuperseded = true;
    return move(target, options);
  }

  function interrupt(event) {
    if (event.type === 'keydown' && !navigationKeys.has(event.key)) return;
    interactionVersion += 1;
    initialSuperseded = true;
    cancel();
  }

  function listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    removers.push(() => target.removeEventListener(type, listener, options));
  }

  ['wheel', 'touchstart', 'pointerdown'].forEach(type => {
    listen(window, type, interrupt, { passive: true });
  });
  listen(window, 'keydown', interrupt, { passive: true });
  ['resize', 'popstate', 'hashchange', 'pagehide'].forEach(type => listen(window, type, interrupt));
  const onMotionChange = () => {
    if (reducedMotion.matches) cancel();
  };
  listen(reducedMotion, 'change', onMotionChange);

  async function alignInitialHash() {
    if (initialScheduled || !initialHash || destroyed) return false;
    initialScheduled = true;
    const version = interactionVersion;
    // Generated chapter IDs do not exist during the browser's initial
    // fragment lookup. Wait for their layout, without overriding a visitor
    // who has already begun using the page.
    try { await document.fonts?.ready; } catch { /* Fallback fonts are usable. */ }
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (destroyed || initialSuperseded || version !== interactionVersion || location.hash !== initialHash) return false;
    let id;
    try { id = decodeURIComponent(initialHash.slice(1)); } catch { return false; }
    const target = document.getElementById(id);
    if (!target) return false;
    return move(target, { immediate: true, focus: false, updateHistory: false });
  }

  function destroy() {
    destroyed = true;
    initialSuperseded = true;
    cancel();
    removers.forEach(remove => remove());
  }

  return { navigateTo, alignInitialHash, cancel, destroy };
}
