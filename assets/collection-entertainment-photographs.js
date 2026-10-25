// Load only the current destination's gallery table; HTML paints the first photograph independently.
const city = globalThis.document?.documentElement.dataset.city || 'mozhaysk';
const loaders = {
  ruza: () => import('./collection-entertainment-ruza-data.js?v=20261025-original-quality-1'),
  krasnoyarsk: () => import('./collection-entertainment-krasnoyarsk-data.js?v=20261025-original-quality-1'),
  mozhaysk: () => import('./collection-entertainment-gallery-data.js?v=20261025-original-quality-1'),
};
const photographs = await (loaders[city] || loaders.mozhaysk)();
export const getEntertainmentPhotographs = photographs.getEntertainmentPhotographs;
