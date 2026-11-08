import { attractions, childActivityOptions, interests, outingTransports, services } from './collection-holiday-data.js?v=20261108-route-pdf-1';
import { dateNumber, minutes } from './collection-holiday-engine.js?v=20261108-route-pdf-1';
import { isHotelEventEdit } from './collection-holiday-edits.js?v=20261108-route-pdf-1';
import { holidayLodgings } from './collection-holiday-lodging.js';

const version = 1;
const draftKey = city => `amore-holiday-draft:${city}`;
const steps = new Set(['dates', 'party', 'lodging', 'rhythm', 'outings', 'routes', 'services', 'review']);
const listFields = { childActivities: childActivityOptions, interests, places: attractions, services };
const choices = {
  lodging: ['', ...holidayLodgings.map(room => room.id)],
  familyMode: ['together', 'separate'],
  pace: ['calm', 'balanced', 'active'],
  outingMode: ['stay', 'visit'],
  transport: Object.keys(outingTransports),
};

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const dateValue = value => typeof value === 'string' && (value === '' || Number.isFinite(dateNumber(value)));
const timeValue = value => typeof value === 'string' && (value === '' || Number.isFinite(minutes(value)));
// JSON represents NaN as null. Restore it as an empty, invalid numeric answer.
const numberValue = (value, fallback) => value === null ? NaN : Number.isFinite(value) ? value : fallback;

function restoreAnswers(saved, defaults) {
  const answers = structuredClone(defaults);
  answers.suggestActivities = saved.suggestActivities === true;
  for (const field of ['startDate', 'endDate']) if (dateValue(saved[field])) answers[field] = saved[field];
  for (const field of ['arrival', 'departure', 'wake', 'rest']) if (timeValue(saved[field])) answers[field] = saved[field];
  for (const field of ['adults', 'children']) {
    answers[field] = numberValue(saved[field], defaults[field]);
  }
  for (const [field, values] of Object.entries(choices)) if (values.includes(saved[field])) answers[field] = saved[field];
  if (typeof saved.origin === 'string') answers.origin = saved.origin.slice(0, 200);
  if (Array.isArray(saved.ages)) {
    answers.ages = saved.ages.slice(0, 10).map(age => Number.isFinite(age) ? age : '');
  }
  for (const [field, catalog] of Object.entries(listFields)) {
    if (Array.isArray(saved[field])) {
      answers[field] = [...new Set(saved[field].filter(id => catalog.some(item => item.id === id)))];
    }
  }
  if (!Object.hasOwn(saved, 'suggestActivities') && saved.outingMode === 'stay') {
    // Earlier questionnaires retained these selections when switching to a hotel-only stay.
    answers.interests = (answers.interests || []).filter(id => !['walk', 'bike', 'buggy'].includes(id));
  }

  answers.preferred ||= {};
  for (const { id } of services) {
    if (timeValue(saved.preferred?.[id])) answers.preferred[id] = saved.preferred[id];
  }
  answers.outings ||= {};
  for (const { id } of attractions) {
    const outing = saved.outings?.[id];
    if (!isRecord(outing)) continue;
    answers.outings[id] = {
      transport: choices.transport.includes(outing.transport) ? outing.transport : answers.transport,
      excursionDate: dateValue(outing.excursionDate) ? outing.excursionDate : '',
      excursionTime: timeValue(outing.excursionTime) ? outing.excursionTime : '',
    };
  }
  return answers;
}

function validEdit(edit) {
  if (!isRecord(edit) || typeof edit.itemId !== 'string' || !edit.itemId || typeof edit.itemTitle !== 'string') return false;
  if (edit.type === 'hotel-event') return isHotelEventEdit(edit);
  if (edit.type === 'remove') return true;
  if (!dateValue(edit.date) || !edit.date || !timeValue(edit.time) || !edit.time) return false;
  if (edit.type === 'move') return true;
  if (!['replace', 'add'].includes(edit.type) || typeof edit.replacementId !== 'string' || !edit.replacementId) return false;
  if (edit.type === 'add' && (!Number.isInteger(edit.windowStart) || !Number.isInteger(edit.windowEnd)
    || edit.windowStart < 0 || edit.windowEnd > 1440 || edit.windowStart >= edit.windowEnd)) return false;
  return edit.replacementId !== 'custom' || (typeof edit.title === 'string' && Number.isInteger(edit.duration));
}

function browserStorage(storage) {
  return storage === undefined ? globalThis.localStorage : storage;
}

export function loadHolidayDraft(city, defaults, storage) {
  try {
    const raw = browserStorage(storage)?.getItem(draftKey(city));
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved?.version !== version || !isRecord(saved.answers)) return null;
    return {
      answers: restoreAnswers(saved.answers, defaults),
      step: steps.has(saved.step) ? saved.step : 'dates',
      edits: Array.isArray(saved.edits) ? saved.edits.filter(validEdit) : [],
      completed: saved.completed === true,
    };
  } catch {
    return null;
  }
}

export function saveHolidayDraft(city, draft, storage) {
  try {
    if (!isRecord(draft?.answers)) return false;
    const { answers, step, edits, completed } = draft;
    const target = browserStorage(storage);
    if (!target) return false;
    const savedAnswers = { ...answers, suggestActivities: answers.suggestActivities === true };
    target.setItem(draftKey(city), JSON.stringify({ version, answers: savedAnswers, step, edits, completed }));
    return true;
  } catch {
    return false;
  }
}

export function clearHolidayDraft(city, storage) {
  try {
    const target = browserStorage(storage);
    if (!target) return false;
    target.removeItem(draftKey(city));
    return true;
  } catch {
    return false;
  }
}
