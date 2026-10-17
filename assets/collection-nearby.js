import { nearbyPlaces, nearbyBasemap } from './mozhaysk-nearby-data.js?v=nearby-photos-1';

// One lazily-created Leaflet instance, four exact-location markers, no routing
// engine or geolocation. DOM owns the place list and detail; Leaflet owns the
// EPSG:3857 basemap/markers. Badges stay screen-sized, with anchor dots and
// leader lines when two locations overlap. The list survives failed tiles/JS.
// Selection uses a validated ?place= slug (replaceState); camera is ephemeral.
const arrow = '<svg viewBox="0 0 28 20" aria-hidden="true" focusable="false"><path d="M2 10h22m-6-6 6 6-6 6"/></svg>';
const number = index => String(index + 1).padStart(2, '0');
const initialPlace = () => nearbyPlaces.find(place => place.id === new URLSearchParams(location.search).get('place')) || nearbyPlaces[0];
const routeURL = place => `https://yandex.ru/maps/?rtext=~${place.coordinates.join(',')}&rtt=auto&z=12`;

function detail(place) {
  const photo = place.photo;
  return `<figure class="nearby-place-photo">
      <div class="nearby-photo-frame"><img src="${photo.src}" alt="${photo.alt}" width="${photo.width}" height="${photo.height}" loading="lazy" decoding="async"><p class="nearby-photo-fallback" hidden>Фотография временно недоступна</p></div>
      <figcaption>Фото: <a href="${photo.source}" target="_blank" rel="noopener">${photo.author}, ${photo.year}</a> · <a href="${photo.licenseURL}" target="_blank" rel="noopener">${photo.license}</a></figcaption>
    </figure>
    <p class="nearby-place-category">${place.category}</p>
    <h3>${place.title}</h3>
    <p class="nearby-place-description">${place.description}</p>
    <div class="nearby-place-links">
      <a class="home-link" href="${routeURL(place)}" target="_blank" rel="noopener"><span>Проложить маршрут</span>${arrow}</a>
      <a class="nearby-source" href="${place.source}" target="_blank" rel="noopener">Об этом месте ↗</a>
    </div>`;
}

export function renderNearbyPlaces() {
  const selected = initialPlace();
  return `<section class="cl-nearby" id="nearby" aria-labelledby="nearby-title">
    <header class="nearby-heading">
      <div><p class="nearby-eyebrow">Можайск и окрестности</p><h2 id="nearby-title">Впечатления<br>за пределами отеля.</h2></div>
      <p>Старинные усадьбы, история Бородинского поля и архитектура Можайска. Выберите место для небольшого путешествия.</p>
    </header>
    <div class="nearby-layout">
      <div class="nearby-places">
        <p class="nearby-list-label">Куда отправиться <span>04 места</span></p>
        <ol class="nearby-place-list" aria-label="Интересные места в окрестностях">
          ${nearbyPlaces.map((place, index) => `<li><button type="button" data-nearby-place="${place.id}" aria-pressed="${place.id === selected.id}" aria-controls="nearby-place-detail"><span class="nearby-list-number">${number(index)}</span><span>${place.title}</span><span class="nearby-list-arrow" aria-hidden="true">↗</span></button></li>`).join('')}
        </ol>
        <article class="nearby-place-detail" id="nearby-place-detail" aria-label="Описание выбранного места">${detail(selected)}</article>
      </div>
      <div class="nearby-map-column">
        <div class="nearby-map-stage">
          <div class="nearby-map" id="nearby-map" role="region" aria-label="Карта интересных мест у Можайского водохранилища" aria-describedby="nearby-map-help" data-map-state="idle"></div>
          <div class="nearby-map-toolbar"><button type="button" data-nearby-overview disabled>Все места <span aria-hidden="true">↗</span></button><button type="button" data-nearby-touch aria-pressed="false" disabled>Двигать карту</button></div>
        </div>
        <div class="nearby-map-feedback"><p id="nearby-map-help" role="status">Загружаем карту…</p><button type="button" data-nearby-retry hidden>Повторить</button></div>
      </div>
    </div>
    <p class="nearby-visit-note">Места находятся за пределами отеля. Время работы и условия посещения уточняйте на официальных сайтах. <a href="./photo-credits.html#nearby-photos">Фото и лицензии ↗</a></p>
    <p class="sr-only" data-nearby-announcement aria-live="polite" aria-atomic="true"></p>
  </section>`;
}

export function enhanceNearbyPlaces(section) {
  if (!section || section.dataset.initialized) return;
  section.dataset.initialized = 'true';
  const canvas = section.querySelector('.nearby-map');
  const stage = section.querySelector('.nearby-map-stage');
  const help = section.querySelector('#nearby-map-help');
  const retry = section.querySelector('[data-nearby-retry]');
  const overview = section.querySelector('[data-nearby-overview]');
  const touchToggle = section.querySelector('[data-nearby-touch]');
  const buttons = [...section.querySelectorAll('[data-nearby-place]')];
  const compact = matchMedia('(max-width: 1100px)');
  const coarsePointer = matchMedia('(any-pointer: coarse)');
  const needsTouchControl = () => compact.matches || coarsePointer.matches;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = initialPlace();
  let map, tiles, L, starting, loadTimer, tileErrors = 0, attempts = 0;
  let markers = [];
  let zooming = false, pendingView;
  const detailElement = section.querySelector('#nearby-place-detail');
  // Keep the text, route and image credit available if a photograph fails.
  detailElement.addEventListener('error', event => {
    if (!(event.target instanceof HTMLImageElement)) return;
    event.target.hidden = true;
    detailElement.querySelector('.nearby-photo-fallback').hidden = false;
  }, true);
  // Include the reservoir west of Gorétovo as context, rather than fitting only
  // the town monuments. No unverified hotel pin is added.
  const overviewBounds = [[55.491, 35.60], [55.64, 36.045]];

  function feedback(message, state, canRetry = false) {
    help.textContent = message;
    canvas.dataset.mapState = state;
    retry.hidden = !canRetry;
  }

  function syncMarkerLayout() {
    if (!map) return;
    const pixels = nearbyPlaces.map(place => map.latLngToContainerPoint(place.coordinates));
    markers.forEach((marker, index) => {
      const icon = marker.getElement();
      const overlaps = pixels.some((point, other) => other !== index && pixels[index].distanceTo(point) < 62);
      icon.classList.toggle('is-offset-west', overlaps && index === 1);
      icon.classList.toggle('is-offset-east', overlaps && index === 2);
    });
  }

  function syncMarkers() {
    markers.forEach((marker, index) => {
      const active = nearbyPlaces[index].id === selected.id;
      marker.getElement().classList.toggle('is-selected', active);
      marker.getElement().setAttribute('aria-pressed', String(active));
      marker.setZIndexOffset(active ? 1000 : 0);
    });
    syncMarkerLayout();
  }

  function selectPlace(place, move = true) {
    selected = place;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.nearbyPlace === place.id)));
    detailElement.innerHTML = detail(place);
    section.querySelector('[data-nearby-announcement]').textContent = `Выбрано: ${place.title}. Описание и маршрут — под списком мест.`;
    const url = new URL(location.href);
    url.searchParams.set('place', place.id);
    history.replaceState(history.state, '', url);
    if (map) {
      syncMarkers();
      if (move) moveCamera(() => map.setView(place.coordinates, Math.max(map.getZoom(), 13), { animate: !motion.matches, duration: 0.5 }));
    } else start();
  }

  buttons.forEach(button => button.addEventListener('click', () => selectPlace(nearbyPlaces.find(place => place.id === button.dataset.nearbyPlace))));

  function moveCamera(action) {
    // Leaflet's CSS zoom cannot be interrupted with stop(). Keep the latest
    // requested view, so a quick reset or second place selection is not lost.
    pendingView = action;
    if (zooming) return;
    const next = pendingView;
    pendingView = undefined;
    map.stop();
    next();
  }

  function fitOverview() {
    const bounds = canvas.clientWidth < 600 ? nearbyPlaces.map(place => place.coordinates) : overviewBounds;
    moveCamera(() => map.fitBounds(bounds, { padding: [36, 48], animate: !motion.matches, duration: 0.5 }));
  }

  function syncTouch() {
    if (!map) return;
    const guarded = needsTouchControl();
    const active = !guarded || touchToggle.getAttribute('aria-pressed') === 'true';
    map.dragging[active ? 'enable' : 'disable']();
    map.touchZoom[active ? 'enable' : 'disable']();
    map.doubleClickZoom[active ? 'enable' : 'disable']();
    stage.classList.toggle('is-interactive', active);
    section.classList.toggle('has-touch-map-controls', guarded);
    touchToggle.textContent = active && guarded ? 'Прокручивать страницу' : 'Двигать карту';
  }

  touchToggle.addEventListener('click', () => {
    touchToggle.setAttribute('aria-pressed', String(touchToggle.getAttribute('aria-pressed') !== 'true'));
    syncTouch();
  });
  compact.addEventListener('change', syncTouch);
  coarsePointer.addEventListener('change', syncTouch);
  overview.addEventListener('click', fitOverview);

  function watchTiles() {
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => feedback('Карта загружается медленно. Описания и ссылки на маршруты доступны в списке.', 'slow', true), 12000);
  }

  async function start() {
    if (map || starting) return;
    starting = true;
    feedback('Загружаем карту…', 'loading');
    try {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = new URL('./vendor/leaflet/leaflet.css', import.meta.url).href;
      const cssReady = new Promise((resolve, reject) => {
        stylesheet.onload = resolve;
        stylesheet.onerror = reject;
      });
      if (!document.querySelector('[data-nearby-leaflet-style]')) {
        stylesheet.dataset.nearbyLeafletStyle = '';
        document.head.prepend(stylesheet);
      } else stylesheet.onload = null;
      await Promise.all([import(`./vendor/leaflet/leaflet.js?nearby=${attempts++}`), stylesheet.isConnected ? cssReady : Promise.resolve()]);
      L = window.L;
      map = L.map(canvas, {
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: !needsTouchControl(),
        touchZoom: !needsTouchControl(),
        doubleClickZoom: !needsTouchControl(),
        minZoom: 8,
        maxZoom: nearbyBasemap.maxZoom,
        zoomAnimation: !motion.matches,
        fadeAnimation: !motion.matches,
        markerZoomAnimation: !motion.matches,
        attributionControl: true,
      });
      map.attributionControl.setPrefix(false);
      map.on('zoomstart', () => { zooming = true; });
      map.on('zoomend', () => {
        zooming = false;
        requestAnimationFrame(() => { if (pendingView) moveCamera(pendingView); });
      });
      // Native map controls and keyboard pan/zoom remain available when touch
      // dragging is off, keeping one-finger page scrolling usable on mobile.
      const zoom = L.control.zoom({ position: 'bottomright', zoomInTitle: 'Приблизить карту', zoomOutTitle: 'Отдалить карту' }).addTo(map);
      zoom.getContainer().querySelectorAll('a').forEach(control => control.setAttribute('aria-label', control.title));
      L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
      fitOverview();
      tiles = L.tileLayer(nearbyBasemap.url, {
        attribution: nearbyBasemap.attribution,
        maxZoom: nearbyBasemap.maxZoom,
        keepBuffer: 0,
        updateWhenIdle: true,
        updateWhenZooming: false,
      });
      tiles.on('loading', () => { tileErrors = 0; watchTiles(); });
      tiles.on('tileerror', () => { tileErrors++; });
      tiles.on('load', () => {
        clearTimeout(loadTimer);
        if (tileErrors) feedback('Часть карты не загрузилась. Выбирайте места в списке или повторите загрузку.', 'partial', true);
        else feedback('Выбирайте отметки на карте или места в списке. Масштаб — кнопками + и −.', 'ready');
      });
      tiles.addTo(map);
      markers = nearbyPlaces.map((place, index) => {
        const icon = L.divIcon({
          className: 'nearby-pin',
          html: `<span class="nearby-pin-anchor"></span><span class="nearby-pin-line"></span><span class="nearby-pin-number">${number(index)}</span>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });
        const marker = L.marker(place.coordinates, { icon, keyboard: true, title: place.title, alt: place.title }).addTo(map);
        marker.getElement().setAttribute('aria-label', `${number(index)}. ${place.title}`);
        marker.getElement().addEventListener('keydown', event => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            selectPlace(place);
          }
        });
        marker.on('click', () => selectPlace(place));
        return marker;
      });
      map.on('moveend zoomend', syncMarkerLayout);
      syncMarkers();
      syncTouch();
      overview.disabled = false;
      touchToggle.disabled = false;
      if (new URLSearchParams(location.search).has('place')) map.setView(selected.coordinates, 13, { animate: false });
      new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(canvas);
    } catch {
      clearTimeout(loadTimer);
      map?.remove();
      map = undefined;
      tiles = undefined;
      markers = [];
      zooming = false;
      pendingView = undefined;
      canvas.replaceChildren();
      overview.disabled = true;
      touchToggle.disabled = true;
      feedback('Карта сейчас недоступна. Описания мест и ссылки на маршруты работают в списке.', 'unavailable', true);
      document.querySelector('[data-nearby-leaflet-style]')?.remove();
    } finally { starting = false; }
  }

  retry.addEventListener('click', () => {
    if (map && tiles) { feedback('Загружаем карту…', 'loading'); watchTiles(); tiles.redraw(); }
    else start();
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); start(); }
    }, { rootMargin: '350px' });
    observer.observe(section);
  } else start();
}
