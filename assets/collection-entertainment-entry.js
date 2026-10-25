// Reuse the original photograph selected and preloaded in the head. Do not
// replace it with a reduced candidate when the module graph initializes.
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
  const picture = image.parentElement?.matches('picture.collection-picture') ? image.parentElement : null;
  if (picture) picture.replaceWith(image);
  image.dataset.gallerySource = entry.source;
  image.removeAttribute('data-gallery-preview');
  image.loading = 'eager';
  image.fetchPriority = 'high';
  image.decoding = 'async';
  image.alt = entry.alt;
  image.removeAttribute('sizes');
  image.removeAttribute('srcset');
  image.width = entry.width;
  image.height = entry.height;
  image.src = entry.url;
  image.style.backgroundImage = 'none';
  figure.dataset.galleryEntry = '';
  document.documentElement.dataset.galleryEntryReady = 'true';
  if (entry.anchor) requestAnimationFrame(() => story.scrollIntoView({ block: 'start', behavior: 'instant' }));
})();
