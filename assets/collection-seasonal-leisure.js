import { getSeasonForDate, getSeasonActivities, seasonLabels } from './collection-seasons.js?v=20261023-leisure-catalog-1';

const knownSeason = value => Object.hasOwn(seasonLabels, value || '');

function readSelection() {
  const url = new URL(location.href);
  const date = [url.searchParams.get('date'), url.searchParams.get('checkin')].find(value => getSeasonForDate(value)) || '';
  return { season: getSeasonForDate(date) || (knownSeason(url.searchParams.get('season')) ? url.searchParams.get('season') : 'all'), date };
}

function preserveDetailSeason() {
  const { season, date } = readSelection();
  if (season === 'all') return;
  document.querySelectorAll('.cl-back, .cl-detail-actions a').forEach(link => {
    const target = new URL(link.href, location.href);
    if (!target.pathname.endsWith('/spaces.html')) return;
    target.searchParams.set('season', season);
    if (date) target.searchParams.set('date', date);
    link.href = target.href;
  });
}

function initializeSeasonalLeisure() {
  const overview = document.querySelector('[data-entertainment-overview]');
  if (!overview) return preserveDetailSeason();
  const controls = overview.querySelector('[data-season-controls]');
  const dateInput = overview.querySelector('[data-season-date]');
  const buttons = [...overview.querySelectorAll('[data-season-choice]')];
  const status = overview.querySelector('[data-season-status]');
  const stories = [...overview.querySelectorAll('[data-entertainment-story]')];
  const allActivities = new Set(Object.keys(seasonLabels).flatMap(season => getSeasonActivities(season).map(item => item.title)));
  if (!controls || !dateInput || !status) return;

  function hashStory() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return null; }
    return document.getElementById(id)?.closest('[data-entertainment-story]') || null;
  }

  function render(season, { date = '', updateURL = true, alignHash = false, clearHash = false } = {}) {
    if (season !== 'all' && !knownSeason(season)) return;
    let visible = season === 'all' ? allActivities : new Set(getSeasonActivities(season).map(item => item.title));
    const target = alignHash ? hashStory() : null;
    if (target && ![...target.querySelectorAll('[data-entertainment-activity]')].some(item => visible.has(item.dataset.entertainmentActivity))) {
      season = 'all';
      date = '';
      visible = allActivities;
    }
    let count = 0;
    stories.forEach(story => {
      const items = [...story.querySelectorAll('[data-entertainment-activity]')];
      items.forEach(item => { item.hidden = !visible.has(item.dataset.entertainmentActivity); if (!item.hidden) count += 1; });
      const shown = items.filter(item => !item.hidden);
      shown.forEach((item, index) => {
        const separator = item.querySelector('[data-entertainment-separator]');
        if (separator) separator.textContent = index === 0 ? '' : index === shown.length - 1 ? ' и ' : ', ';
      });
      story.hidden = items.every(item => item.hidden);
    });
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.seasonChoice === season)));
    dateInput.value = date;
    overview.dataset.season = season;
    overview.dataset.seasonReady = '';
    controls.hidden = false;
    status.textContent = `${season === 'all' ? 'Все виды отдыха' : seasonLabels[season]}${date ? ' · по выбранной дате' : ''}. Показано занятий: ${count}.`;
    if (updateURL) {
      const url = new URL(location.href);
      if (season === 'all') url.searchParams.delete('season');
      else url.searchParams.set('season', season);
      url.searchParams.delete('checkin');
      url.searchParams.delete('checkout');
      if (date) url.searchParams.set('date', date);
      else url.searchParams.delete('date');
      if (clearHash) url.hash = '';
      history.replaceState(history.state, '', url);
    }
    if (alignHash && target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'instant' }));
  }

  buttons.forEach(button => button.addEventListener('click', () => render(button.dataset.seasonChoice, { clearHash: true })));
  dateInput.addEventListener('change', () => {
    const season = getSeasonForDate(dateInput.value);
    if (season) render(season, { date: dateInput.value, clearHash: true });
    else if (!dateInput.value) render('all', { clearHash: true });
  });
  window.addEventListener('popstate', () => { const selection = readSelection(); render(selection.season, { date: selection.date, alignHash: true }); });
  window.addEventListener('hashchange', () => { const selection = readSelection(); render(selection.season, { date: selection.date, alignHash: true }); });
  const initial = readSelection();
  render(initial.season, { date: initial.date, alignHash: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeSeasonalLeisure, { once: true });
else initializeSeasonalLeisure();
