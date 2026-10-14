// Additional interior concepts based on the user's FD floor plans.
// Category mapping confirmed on 2026-10-14. Existing cover images stay first.
const photo = (file, description) => [
  `./images/rooms/mozhaysk/plan-interiors/${file}.jpg`,
  description,
  768,
  1536,
];

export const mozhayskPlanPhotos = {
  comfort: [
    photo("fd78-living-entry", "Комфорт · FD78: гостиная и обеденная зона с видом на палубу"),
    photo("fd78-living-reverse", "Комфорт · FD78: обратный ракурс гостиной и кухни"),
    photo("fd78-bedroom", "Комфорт · FD78: спальня с боковым окном на воду"),
  ],
  "junior-suite": [
    photo("fd144-living-entry", "Полулюкс · FD144: гостиная первого этажа и выход на палубу"),
    photo("fd144-living-reverse", "Полулюкс · FD144: обратный ракурс гостиной и обеденной зоны"),
    photo("fd144-bedroom", "Полулюкс · FD144: спальня верхнего этажа с выходом на палубу"),
  ],
  suite: [
    photo("fd156-living-entry", "Люкс · FD156: семейная гостиная и обеденная зона у воды"),
    photo("fd156-living-reverse", "Люкс · FD156: обратный ракурс гостиной с кухней"),
    photo("fd156-bedroom", "Люкс · FD156: спальня верхнего этажа с видом на водохранилище"),
  ],
};

export function applyMozhayskPlanPhotos(rooms) {
  for (const room of rooms) {
    const additions = mozhayskPlanPhotos[room.id];
    if (additions) room.photos = [room.image, ...additions];
  }
}
