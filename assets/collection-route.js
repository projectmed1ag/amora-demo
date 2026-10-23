// Compatibility for saved city and activity URLs. The normal Mozhaysk pages
// are complete HTML; this script never renders or rebuilds their content.
(() => {
  const script = document.currentScript;
  const root = script.src ? new URL('../', script.src) : new URL(script.dataset.collectionRoot || './', location.href);
  const url = new URL(location.href);
  const relative = url.pathname.slice(root.pathname.length);
  const [folder, nestedFile] = relative.split('/');
  const cityFolder = ['ruza', 'krasnoyarsk'].includes(folder) ? folder : null;
  const file = cityFolder ? nestedFile : folder;
  if (!/^(hotel|rooms|spaces|about|location|booking|leisure-[a-z]+)\.html$/.test(file || '')) return;
  const cities = new Map([['moscow', 'mozhaysk'], ['petersburg', 'ruza'], ['mozhaysk', 'mozhaysk'], ['ruza', 'ruza'], ['krasnoyarsk', 'krasnoyarsk']]);
  const normalize = city => cities.get(city) || null;
  let saved;
  try { saved = localStorage.getItem('amore-destination'); } catch { /* Storage is optional. */ }
  const isLeisureDetail = file.startsWith('leisure-');
  const city = normalize(url.searchParams.get('city')) || cityFolder || (isLeisureDetail ? 'mozhaysk' : normalize(saved)) || 'mozhaysk';
  let target = `${city === 'mozhaysk' ? '' : city + '/'}${isLeisureDetail && city !== 'mozhaysk' ? 'spaces.html' : file}`;
  const activity = url.searchParams.get('activity');
  if (city === 'mozhaysk' && file === 'spaces.html' && ['active', 'children', 'nature', 'garden', 'together', 'winter', 'tubing', 'rink', 'buggy'].includes(activity)) {
    target = `leisure-${activity}.html`;
    url.searchParams.delete('activity');
  }
  url.searchParams.set('city', city);
  const destination = new URL(target, root);
  destination.search = url.search;
  destination.hash = url.hash;
  if (destination.pathname !== location.pathname) {
    document.documentElement.dataset.collectionRedirect = '';
    location.replace(destination.href);
  } else if (url.search !== location.search) {
    history.replaceState(history.state, '', url);
  }
})();
