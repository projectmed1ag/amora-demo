import { createChapterScroller } from './collection-smooth-scroll.js?v=20261027-native-home-scroll-1';

// The browser owns wheel, keyboard and touch scrolling. Only an explicit
// chapter link requests a smooth anchor movement; it can be interrupted.
export function createHomeScroller({ main, getTargets, getOffset, onUpdate = () => {} }) {
  const observed = new WeakSet();
  const restoringPosition = ['back_forward', 'reload'].includes(
    performance.getEntriesByType('navigation')[0]?.type,
  );
  let scroller;
  const aliases = {
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

  function loadPhotograph(photo) {
    if (!photo.dataset.imageSrc && !photo.dataset.imageSrcset) return;
    photo.decoding = 'async';
    photo.loading = 'eager';
    photo.fetchPriority = 'auto';
    if (photo.dataset.imageSrcset) photo.srcset = photo.dataset.imageSrcset;
    if (photo.dataset.imageSrc) photo.src = photo.dataset.imageSrc;
    delete photo.dataset.imageSrc;
    delete photo.dataset.imageSrcset;
    delete photo.dataset.imageDeferred;
    observer?.unobserve(photo);
  }

  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) loadPhotograph(target);
    });
  }, { rootMargin: '600px 0px' }) : null;

  function hashTarget() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return {}; }
    const targets = getTargets();
    let target = targets.find(element => element.id === id);
    const alias = !target && aliases[id];
    if (alias) {
      target = targets.find(element => element.id === alias);
      if (target) {
        const url = new URL(location.href);
        url.hash = alias;
        history.replaceState(history.state, '', url);
      }
    }
    target?.querySelectorAll('img[data-image-src], img[data-image-srcset]').forEach(loadPhotograph);
    return { target, alias };
  }

  function syncTargets() {
    main.querySelectorAll('img[data-image-src], img[data-image-srcset]').forEach(photo => {
      if (observed.has(photo)) return;
      observed.add(photo);
      const rect = photo.getBoundingClientRect();
      if (!observer || rect.top < innerHeight + 600 && rect.bottom > -600) loadPhotograph(photo);
      else observer.observe(photo);
    });
    // IDs and old link aliases must exist before capturing the initial hash.
    hashTarget();
    scroller ||= createChapterScroller({ getOffset, onUpdate });
  }

  function onHashChange() {
    const { target, alias } = hashTarget();
    // A renamed fragment has no native destination. Ordinary Back/Forward
    // and pageshow keep the browser's exact restored reading position.
    if (target && alias) void scroller.navigateTo(target, { immediate: true, focus: false, updateHistory: false });
    onUpdate();
  }
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('pageshow', syncTargets);

  return {
    syncTargets,
    alignInitialHash: () => restoringPosition ? Promise.resolve(false) : scroller?.alignInitialHash(),
    cancel: () => scroller?.cancel(),
    navigateTo(target, options) {
      target.querySelectorAll('img[data-image-src], img[data-image-srcset]').forEach(loadPhotograph);
      return scroller.navigateTo(target, options);
    },
    destroy() {
      observer?.disconnect();
      scroller?.destroy();
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('pageshow', syncTargets);
    },
  };
}
