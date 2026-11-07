import { currentDestinationCity, destinationURL } from './collection-destinations.js?v=20261024-all-hotels-1';

export function initHolidayPlannerEntry() {
  if (currentDestinationCity() !== 'mozhaysk' || document.body.dataset.page === 'holiday-planner' || document.querySelector('.holiday-planner-entry')) return;
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('./collection-holiday-entry.css?v=20261106-1', import.meta.url).href;
  document.head.append(style);
  const link = document.createElement('a');
  link.className = 'holiday-planner-entry';
  link.href = destinationURL('holiday-planner.html', 'mozhaysk');
  link.setAttribute('aria-label', 'Помощник: составить программу отдыха');
  link.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v12H9l-4 4V4Z"/><path d="M8 8h8M8 12h5"/></svg><span>План отдыха<small>Помощник A’MORE</small></span>';
  document.body.append(link);
}
