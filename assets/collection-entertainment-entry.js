// The head has already selected and preloaded the first photograph for this
// URL. Attach its native picture before the deferred module graph initializes.
(() => {
  const entry = window.collectionEntertainmentEntry;
  if (!entry) return;
  const overview = document.querySelector('[data-entertainment-overview]');
  if (overview) {
    overview.dataset.season = entry.season;
    overview.querySelectorAll('[data-entertainment-story]').forEach(story => {
      story.hidden = !entry.stories.includes(story.id);
    });
  }
  const story = document.getElementById(entry.story);
  const figure = story?.querySelector('.entertainment-photo');
  const image = figure?.querySelector('img');
  if (!figure || !image || figure.dataset.galleryReady !== undefined) return;
  const picture = document.createElement('picture');
  picture.className = 'collection-picture';
  const path = entry.base + entry.stem;
  const source = (type, candidates, media = '') => {
    const node = document.createElement('source');
    node.type = type;
    if (media) node.media = media;
    node.srcset = candidates;
    node.sizes = entry.sizes;
    picture.append(node);
  };
  source('image/avif', `${path}-800.avif 800w`, '(max-width: 700px)');
  source('image/webp', `${path}-480.webp 480w, ${path}-960.webp 960w`, '(max-width: 700px)');
  source('image/avif', `${path}-800.avif 800w, ${path}-1280.avif 1280w`);
  const old = image.parentElement?.matches('picture.collection-picture') ? image.parentElement : image;
  old.replaceWith(picture);
  picture.append(image);
  image.dataset.gallerySource = entry.source;
  image.removeAttribute('data-gallery-preview');
  image.loading = 'eager';
  image.fetchPriority = 'high';
  image.decoding = 'async';
  image.alt = entry.alt;
  image.sizes = entry.sizes;
  image.srcset = `${path}-480.webp 480w, ${path}-960.webp 960w, ${path}-1536.webp 1536w`;
  image.src = `${path}-1536.webp`;
  image.style.backgroundImage = 'none';
  figure.dataset.galleryEntry = '';
  document.documentElement.dataset.galleryEntryReady = 'true';
  if (entry.anchor) requestAnimationFrame(() => story.scrollIntoView({ block: 'start', behavior: 'instant' }));
})();
