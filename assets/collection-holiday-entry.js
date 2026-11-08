import { currentDestinationCity, destinationURL } from './collection-destinations.js?v=20261024-all-hotels-1';

export function initHolidayPlannerEntry() {
  if (currentDestinationCity() !== 'mozhaysk' || document.body.dataset.page === 'holiday-planner' || document.querySelector('.holiday-planner-entry')) return;
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('./collection-holiday-entry.css?v=20261108-cta-1', import.meta.url).href;
  document.head.append(style);
  const link = document.createElement('a');
  link.className = 'holiday-planner-entry';
  link.href = destinationURL('holiday-planner.html', 'mozhaysk');
  link.innerHTML = `<span class="holiday-planner-entry-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16m-12 5h3m3 0h2"/></svg></span>
    <span><strong>План отдыха</strong><small>Соберите свою программу</small></span>
    <svg class="holiday-planner-entry-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9m-4-4 4 4-4 4"/></svg>`;
  document.body.append(link);
}
