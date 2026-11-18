import { getSeasonForDate, getSeasonActivities, seasonLabels } from './collection-seasons.js?v=20261024-image-load-1';

const knownSeason = value => Object.hasOwn(seasonLabels, value || '');

function readSelection(defaultSeason = 'all') {
  const url = new URL(location.href);
  const date = [url.searchParams.get('date'), url.searchParams.get('checkin')].find(value => getSeasonForDate(value)) || '';
  const season = url.searchParams.get('season');
  return { season: getSeasonForDate(date) || (season === 'all' || knownSeason(season) ? season : defaultSeason), date };
}

function preserveDetailSeason() {
  const { season, date } = readSelection();
  if (season === 'all' && new URL(location.href).searchParams.get('season') !== 'all') return;
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
  const switcher = controls?.querySelector('[data-season-switch]');
  const status = overview.querySelector('[data-season-status]');
  const stories = [...overview.querySelectorAll('[data-entertainment-story]')];
  const allActivities = new Set(Object.keys(seasonLabels).flatMap(season => getSeasonActivities(season).map(item => item.title)));
  if (!controls || !dateInput || !status) return;

  const useCurrentSeason = overview.dataset.defaultSeason === 'current';
  const hasAllSeasons = buttons.some(button => button.dataset.seasonChoice === 'all');
  const defaultSeason = useCurrentSeason || !hasAllSeasons
    ? getSeasonForDate(new Date().toLocaleDateString('sv-SE', {
      timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
    })) || 'winter'
    : 'all';

  function positionIndicator(animate = false) {
    const active = switcher?.querySelector('button[aria-pressed="true"]');
    if (!active) return;
    switcher.toggleAttribute('data-moving', animate);
    switcher.style.setProperty('--season-x', `${active.offsetLeft}px`);
    switcher.style.setProperty('--season-y', `${active.offsetTop}px`);
    switcher.style.setProperty('--season-width', `${active.offsetWidth}px`);
    switcher.style.setProperty('--season-height', `${active.offsetHeight}px`);
    switcher.dataset.positioned = '';
  }

  function hashStory() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return null; }
    return document.getElementById(id)?.closest('[data-entertainment-story]') || null;
  }

  function render(season, { date = '', updateURL = true, alignHash = false, clearHash = false } = {}) {
    if (season !== 'all' && !knownSeason(season)) return;
    if (season === 'all' && !hasAllSeasons) season = defaultSeason;
    let visible = season === 'all' ? allActivities : new Set(getSeasonActivities(season).map(item => item.title));
    const target = alignHash ? hashStory() : null;
    if (target && ![...target.querySelectorAll('[data-entertainment-activity]')].some(item => visible.has(item.dataset.entertainmentActivity))) {
      season = hasAllSeasons ? 'all' : target.dataset.seasons.split(/\s+/).find(knownSeason) || defaultSeason;
      date = '';
      visible = season === 'all' ? allActivities : new Set(getSeasonActivities(season).map(item => item.title));
      if (!hasAllSeasons) updateURL = true;
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
    overview.dispatchEvent(new CustomEvent('collection:leisure-season', { detail: { season } }));
    overview.querySelectorAll('.entertainment-rental-link').forEach(link => {
      const target = new URL(link.href, location.href);
      if (season === 'all') target.searchParams.delete('season');
      else target.searchParams.set('season', season);
      if (date) target.searchParams.set('date', date);
      else target.searchParams.delete('date');
      link.href = target.href;
    });
    overview.dataset.seasonReady = '';
    const animateIndicator = !controls.hidden && updateURL;
    controls.hidden = false;
    positionIndicator(animateIndicator);
    status.textContent = `${season === 'all' ? 'Все виды отдыха' : seasonLabels[season]}${date ? ' · по выбранной дате' : ''}. Показано занятий: ${count}.`;
    if (updateURL) {
      const url = new URL(location.href);
      if (season === 'all' && !useCurrentSeason) url.searchParams.delete('season');
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
  function renderFromURL() {
    const { season, date } = readSelection(defaultSeason);
    render(season, { date, alignHash: true, updateURL: !useCurrentSeason || season === 'all' && !hasAllSeasons });
  }
  window.addEventListener('popstate', renderFromURL);
  window.addEventListener('hashchange', renderFromURL);
  renderFromURL();
  if (switcher && 'ResizeObserver' in window) new ResizeObserver(() => positionIndicator()).observe(switcher);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeSeasonalLeisure, { once: true });
else initializeSeasonalLeisure();
