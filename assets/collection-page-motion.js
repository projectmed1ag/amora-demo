// Reveal only initializes after content exists. The base page remains readable
// when scripting, IntersectionObserver or Web Animations are unavailable.
function initializePageMotion() {
  const scope = document.querySelector('#content, #hotels');
  if (!scope || !('IntersectionObserver' in window)) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const processed = new WeakSet();
  const pending = new Set();
  const animations = new Set();
  let scanFrame = 0;
  const entry = document.body.classList.contains('collection-entry-page');
  const home = document.body.dataset.page === 'home';

  function reveal(element) {
    element.classList.remove('is-motion-pending');
    pending.delete(element);
    observer.unobserve(element);
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) reveal(target);
    });
  }, { threshold: .08, rootMargin: '0px 0px -4% 0px' });

  function animateFirstView(element, index, photograph) {
    if (!element.animate || reducedMotion.matches) return;
    const keyframes = photograph && entry
      ? [{ opacity: .65 }, { opacity: 1 }]
      : [{ opacity: .6, transform: 'translate3d(0,12px,0)' }, { opacity: 1, transform: 'none' }];
    const animation = element.animate(keyframes, {
      duration: photograph ? 1100 : 900,
      delay: Math.min(index * 70, 140),
      easing: 'cubic-bezier(.22,1,.36,1)',
    });
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
  }

  function prepare(element, index = 0) {
    if (processed.has(element) || !element.getClientRects().length) return;
    if (element.matches('nav, form, dialog, input, button, [role="navigation"]')) return;
    if (element.closest('form, dialog, .home-header, .site-header, .home-footer, .site-footer')) return;
    processed.add(element);
    element.classList.add('collection-motion-item');
    const rect = element.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (reducedMotion.matches) return;
    // Above-the-fold copy never disappears or waits on an observer callback.
    if (inView) {
      animateFirstView(element, index, element.matches('img, picture, figure, .hotel-picture'));
      return;
    }
    // Previously passed content must stay visible after history restoration.
    if (rect.bottom <= 0) return;
    element.style.setProperty('--collection-motion-delay', `${Math.min(index * 70, 210)}ms`);
    element.classList.add('is-motion-pending');
    pending.add(element);
    observer.observe(element);
  }

  function scan() {
    scanFrame = 0;
    if (entry) {
      scope.querySelectorAll('.hotel').forEach((hotel, index) => {
        hotel.querySelectorAll('.hotel-picture, .hotel-content').forEach(element => prepare(element, index));
      });
      return;
    }
    if (home) {
      [...scope.children].filter(element => element.tagName === 'SECTION').forEach(section => {
        if (section.classList.contains('home-hero')) {
          section.querySelectorAll('.home-hero-bottom > div, :scope > img').forEach((element, index) => prepare(element, index));
          return;
        }
        [...section.children].forEach((element, index) => {
          if (element.classList.contains('home-photo-grid')) {
            [...element.children].forEach((panel, panelIndex) => prepare(panel, panelIndex));
          } else if (!element.matches('a, p.home-caption')) {
            prepare(element, index);
          }
        });
      });
    } else {
      scope.querySelectorAll([
        '.stays-hero-heading', '.home-hero > img', '.room-houseboat',
        '.cl-intro-copy', '.cl-intro-photo', '.cl-panel', '.cl-story-photo',
        '.cl-story-copy', '.cl-detail-photo', '.cl-detail-heading',
        '.editorial-story > div', '.editorial-story > figure',
        '.editorial-gallery-photo', '.photo-gallery > figure',
        '.page-heading > h1', '.page-heading > p',
        '.page-story > figure', '.page-story > div',
      ].join(',')).forEach((element, index) => prepare(element, index % 3));
    }
    pending.forEach(element => {
      if (!element.isConnected) { pending.delete(element); observer.unobserve(element); }
    });
  }

  function showPending() {
    [...pending].forEach(reveal);
    animations.forEach(animation => animation.cancel());
    animations.clear();
  }

  document.addEventListener('focusin', event => {
    const element = event.target.closest('.collection-motion-item');
    if (element) reveal(element);
  });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) showPending(); });
  // Dynamic legacy room and gallery content receives the same motion once.
  new MutationObserver(() => {
    if (!scanFrame) scanFrame = requestAnimationFrame(scan);
  }).observe(scope, { childList: true, subtree: true });
  window.addEventListener('pageshow', () => {
    pending.forEach(element => {
      const rect = element.getBoundingClientRect();
      if (rect.top < innerHeight && rect.bottom > 0) reveal(element);
    });
  });
  scan();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePageMotion, { once: true });
} else {
  initializePageMotion();
}
