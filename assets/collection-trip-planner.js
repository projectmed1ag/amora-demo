import { getSeasonForDate, getSeasonActivities, seasonLabels } from './collection-seasons.js?v=20261024-all-hotels-1';
import { destinationURL } from './collection-destinations.js?v=20261024-all-hotels-1';

function leisureURL(season, hash = '') {
  const url = destinationURL('spaces.html', undefined, { season });
  url.hash = hash;
  return url;
}

function updateLeisureLinks(season) {
  document.querySelectorAll('.home-nav a[href*="spaces.html"], .home-more-leisure a, .home-leisure-overview').forEach(link => {
    const url = new URL(link.href, location.href);
    url.searchParams.set('season', season);
    link.href = url;
  });
}

function seasonsForStay(checkin, checkout) {
  if (!getSeasonForDate(checkin)) return [];
  const start = Date.parse(`${checkin}T00:00:00Z`);
  const checkoutTime = Date.parse(`${checkout}T00:00:00Z`);
  const end = Number.isFinite(checkoutTime) && checkoutTime > start ? checkoutTime - 86400000 : start;
  const found = new Set();
  let cursor = new Date(start);
  for (let month = 0; cursor.getTime() <= end && month < 13; month += 1) {
    found.add(getSeasonForDate(cursor.toISOString().slice(0, 10)));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return [...found].filter(Boolean);
}

function initializeBookingSeasons() {
  if (document.body.dataset.page !== 'booking') return;
  const form = document.getElementById('booking-form');
  const summary = document.querySelector('.booking-summary-copy');
  if (!form || !summary) return;
  const section = document.createElement('section');
  section.className = 'booking-seasonal';
  section.setAttribute('aria-labelledby', 'booking-seasonal-title');
  section.innerHTML = '<h2 id="booking-seasonal-title">Чем заняться</h2><p role="status" aria-live="polite"></p><ul class="booking-seasonal-list"></ul><a class="booking-seasonal-overview" hidden>Все развлечения</a>';
  summary.append(section);
  const message = section.querySelector('p');
  const list = section.querySelector('ul');
  const overview = section.querySelector('a.booking-seasonal-overview');

  function render() {
    const seasonsInStay = seasonsForStay(form.elements.checkin.value, form.elements.checkout.value);
    list.replaceChildren();
    overview.hidden = !seasonsInStay.length;
    if (!seasonsInStay.length) {
      message.textContent = 'Выберите даты отдыха — покажем занятия по сезону.';
      return;
    }
    message.textContent = `${seasonsInStay.map(season => seasonLabels[season]).join(' · ')}. Занятия зависят от погоды и наличия инвентаря.`;
    const seen = new Set();
    const activities = seasonsInStay.flatMap(season => getSeasonActivities(season)).filter(activity => {
      if (seen.has(activity.title)) return false;
      seen.add(activity.title);
      return true;
    });
    activities.slice(0, 6).forEach(activity => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = activity.href;
      link.textContent = activity.title;
      item.append(link);
      list.append(item);
    });
    overview.href = leisureURL(seasonsInStay[0]);
    updateLeisureLinks(seasonsInStay[0]);
  }

  form.addEventListener('input', event => { if (['checkin', 'checkout'].includes(event.target.name)) render(); });
  form.addEventListener('change', event => { if (['checkin', 'checkout'].includes(event.target.name)) render(); });
  render();
}

function initialize() {
  initializeBookingSeasons();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
