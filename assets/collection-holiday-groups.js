export const guestGroupKey = group => [...group].sort().join('.');
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const agePlural = new Intl.PluralRules('ru');
const ageForms = { one: 'год', few: 'года', many: 'лет', other: 'лет' };
const hasGuestAge = age => Number.isInteger(age) && age >= 0 && age <= 17;
export function guestAgeLabel(age) {
  if (!hasGuestAge(age)) return '';
  return age === 0 ? 'до года' : `${age} ${ageForms[agePlural.select(age)]}`;
}

export function tripGuests({ adults, children, ages }) {
  const guests = [];
  for (let index = 0; index < adults; index++) {
    guests.push({ id: `adult-${index}`, type: 'adult', label: `Взрослый ${index + 1}` });
  }
  for (let index = 0; index < children; index++) {
    guests.push({ id: `child-${index}`, type: 'child', label: `Ребёнок ${index + 1}`, age: ages[index] });
  }
  return guests;
}

export function restoreGuestGroups(saved, guests) {
  const known = new Set(guests.map(guest => guest.id));
  const assigned = new Set();
  const jointGroups = [];
  for (const group of Array.isArray(saved?.groups) ? saved.groups : []) {
    if (!Array.isArray(group) || !group.every(id => known.has(id) && !assigned.has(id))) continue;
    const members = [...new Set(group)];
    if (members.length < 2) continue;
    jointGroups.push(members);
    for (const id of members) assigned.add(id);
  }
  const groups = [...guests.filter(({ id }) => !assigned.has(id)).map(({ id }) => [id]), ...jointGroups];
  const names = Object.fromEntries(guests.flatMap(({ id }) => {
    const name = saved?.names?.[id];
    return typeof name === 'string' && name.trim() ? [[id, name.slice(0, 40)]] : [];
  }));
  const plans = isObject(saved?.plans) ? Object.fromEntries(Object.entries(saved.plans).filter(([key]) =>
    key.split('.').every(id => known.has(id)))) : {};
  const active = groups.some(group => guestGroupKey(group) === saved?.active) ? saved.active : guestGroupKey(groups[0] || []);
  return { groups, names, plans, active, mode: saved?.mode === 'separate' ? 'separate' : 'together' };
}

export function guestGroupLabel(group, guests, names) {
  const members = guests.filter(guest => group.includes(guest.id));
  return members.map(guest => {
    const name = names[guest.id]?.trim() || guest.label;
    return hasGuestAge(guest.age) ? `${name} (${guest.age})` : name;
  }).join(' + ');
}

export function answersForGuestGroup(answers, group) {
  const people = tripGuests(answers).filter(guest => group.includes(guest.id));
  const ages = people.filter(guest => guest.type === 'child').map(guest => guest.age);
  return {
    ...structuredClone(answers),
    adults: people.length - ages.length, children: ages.length, ages,
    familyMode: 'together', adultActivity: '', secondAdultActivity: '', childActivities: [],
    interests: [], suggestActivities: false, services: [], places: [], outings: {}, outingMode: 'stay',
  };
}
