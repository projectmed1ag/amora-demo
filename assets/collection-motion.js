// Photos enhance progressively; text and navigation never wait for this module.
let disposeMotion;

export function initCollectionMotion(scope = document) {
  disposeMotion?.();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pending = new Set();
  const cleanups = [];

  scope.querySelectorAll('.home-hero > img').forEach(image => {
    if (image.complete || reducedMotion.matches) return;

    let finished = false;
    let watchdog;
    let animationWatchdog;
    const clearClasses = () => image.classList.remove('collection-hero-pending', 'collection-hero-revealing');
    const finishAnimation = () => {
      clearTimeout(animationWatchdog);
      image.classList.remove('collection-hero-revealing');
    };
    const reveal = (animate = true) => {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      pending.delete(reveal);
      image.removeEventListener('load', loaded);
      image.removeEventListener('error', failed);
      image.classList.remove('collection-hero-pending');
      if (animate && !reducedMotion.matches) {
        image.classList.add('collection-hero-revealing');
        // Cleanup also works when a browser omits the animationend event.
        animationWatchdog = setTimeout(finishAnimation, 500);
      }
    };
    const loaded = () => {
      if (!image.decode) return reveal();
      try { Promise.resolve(image.decode()).then(() => reveal(), () => reveal()); }
      catch { reveal(); }
    };
    const failed = () => reveal(false);
    const cleanup = () => {
      reveal(false);
      clearTimeout(animationWatchdog);
      clearClasses();
      image.removeEventListener('animationend', finishAnimation);
      image.removeEventListener('animationcancel', finishAnimation);
    };

    pending.add(reveal);
    cleanups.push(cleanup);
    image.addEventListener('load', loaded);
    image.addEventListener('error', failed);
    image.addEventListener('animationend', finishAnimation);
    image.addEventListener('animationcancel', finishAnimation);
    image.classList.add('collection-hero-pending');
    // A stalled response or decoder can never leave a photograph hidden.
    watchdog = setTimeout(() => reveal(false), 6000);
    // Catch a warm-cache load that finished while listeners were installed.
    if (image.complete) image.naturalWidth ? loaded() : failed();
  });

  const onMotionChange = () => {
    if (!reducedMotion.matches) return;
    pending.forEach(reveal => reveal(false));
    cleanups.forEach(cleanup => cleanup());
  };
  reducedMotion.addEventListener('change', onMotionChange);

  disposeMotion = () => {
    reducedMotion.removeEventListener('change', onMotionChange);
    cleanups.forEach(cleanup => cleanup());
  };
  return disposeMotion;
}
