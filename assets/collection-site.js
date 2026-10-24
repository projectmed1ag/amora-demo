import { applyCollectionShell, addCollectionStyle } from './collection-site-shell.js?v=20261025-first-photo-2';
import { renderCollectionLeisure } from './collection-leisure.js?v=20261025-progressive-photos-1';
import { enhanceNearbyPlaces } from './collection-nearby.js?v=20261025-progressive-photos-1';

const arrow = '<svg viewBox="0 0 28 20" aria-hidden="true"><path d="M2 10h22m-6-6 6 6-6 6"/></svg>';

function updateNext(main) {
  const next = main.querySelector('.page-next');
  if (!next) return;
  next.className = 'collection-next';
  const link = next.querySelector('a');
  const label = document.createElement('span');
  label.textContent = link.textContent;
  link.className = 'home-link';
  link.replaceChildren(label);
  link.insertAdjacentHTML('beforeend', arrow);
}

export function enhanceCollectionLocation() {
  applyCollectionShell('location');
  document.body.classList.add('collection-location-page');
  addCollectionStyle('collection-site-style', './collection-site.css?v=site-1');
  const main = document.querySelector('#content');
  const heading = main.querySelector('.page-heading');
  const cover = main.querySelector('.page-cover');
  const hero = document.createElement('section');
  hero.className = 'home-hero location-hero';
  hero.id = 'top';
  hero.setAttribute('aria-labelledby', 'page-title');
  const image = cover.querySelector('img');
  image.sizes = '100vw';
  const copy = document.createElement('div');
  copy.className = 'home-hero-bottom';
  const title = heading.querySelector('h1');
  title.innerHTML = 'На Можайском<br>водохранилище.';
  const lead = heading.querySelector('.page-lead');
  lead.className = 'location-hero-lead';
  copy.append(title, lead);
  hero.append(image, copy);
  heading.replaceWith(hero);
  cover.remove();
  updateNext(main);
}

export function enhanceCollectionSpaces() {
  applyCollectionShell('spaces');
  document.body.classList.add('collection-shell', 'mo-family-page', 'collection-leisure-page', 'collection-site-leisure');
  addCollectionStyle('collection-site-style', './collection-site.css?v=site-1');
  const main = document.querySelector('#content');
  main.innerHTML = renderCollectionLeisure();
  const detailTitle = main.querySelector('.cl-detail h1')?.textContent.replace(/\.$/, '');
  document.title = `${detailTitle || 'Развлечения и активный отдых'} — Можайское водохранилище — A’MORE Collection`;
  document.querySelector('meta[name="description"]').content =
    'Развлечения и активный отдых в A’MORE Collection: велосипеды, теннис, мячи, зоопарк, рыбалка, садовые парники, павильон для мероприятий и зимние занятия. Карта окрестностей Можайского водохранилища: Музей Бородино, Можайск и усадьба Горетово.';
  const intro = main.querySelector('.cl-intro');
  if (intro) {
    const lead = intro.querySelector('.cl-intro-copy > p');
    const oldAside = intro.querySelector('.cl-intro-aside');
    const aside = document.createElement('div');
    aside.className = 'cl-intro-aside';
    const tagline = document.createElement('span');
    tagline.innerHTML = oldAside.innerHTML;
    aside.append(lead, tagline);
    const nearbyLink = document.createElement('a');
    nearbyLink.className = 'home-link nearby-jump';
    nearbyLink.href = '#nearby';
    nearbyLink.innerHTML = `<span>Места рядом</span>${arrow}`;
    aside.append(nearbyLink);
    oldAside.replaceWith(aside);
  }
  if (main.querySelector('#nearby')) {
    addCollectionStyle('collection-nearby-style', './collection-nearby.css?v=device-1');
    enhanceNearbyPlaces(main.querySelector('#nearby'));
  }
  main.querySelectorAll('.cl-image-note, .cl-detail-photo figcaption').forEach(note => note.remove());
  if (location.hash) {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); }
    catch { return; }
    const scrollToAnchor = () => document.getElementById(id)?.scrollIntoView({ behavior: 'instant' });
    if (id === 'nearby') {
      const style = document.getElementById('collection-nearby-style');
      const stylesReady = style.sheet ? Promise.resolve() : new Promise(resolve => {
        style.addEventListener('load', resolve, { once: true });
        style.addEventListener('error', resolve, { once: true });
      });
      stylesReady.then(() => document.fonts.ready).then(() => requestAnimationFrame(scrollToAnchor));
    } else requestAnimationFrame(scrollToAnchor);
  }
}
