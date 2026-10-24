// Native image loading paints the first photograph as soon as the browser can
// display it. Never conceal that frame behind JavaScript, decode or a fade.
// Keep the shared entry point for pages and older optional controllers.
export function initCollectionMotion(scope = document) {
  const photographs = [...scope.querySelectorAll('.home-hero > img')];
  const clear = () => photographs.forEach(image => {
    image.classList.remove('collection-hero-pending', 'collection-hero-revealing');
  });
  clear();
  return clear;
}
