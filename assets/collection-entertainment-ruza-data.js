import { collectionImageSource } from './collection-image-sources.js?v=20261025-original-quality-1';

// Regional photographs: store each scene once and derive responsive candidates.
const root = "images/ruza/entertainment-v2/";
const records = [
  ["children-01","Семья с велосипедами в лесу у Рузы","summer"],
  ["children-02","Детские игры с деревянным конструктором на природе","spring"],
  ["children-03","Ребёнок с родителем наблюдают за козами в контактном зоопарке","autumn"],
  ["children-autumn","Осенняя семейная прогулка среди берёз","autumn"],
  ["children-spring","Весенняя семейная прогулка в Рузе","spring"],
  ["children-winter","Семейная прогулка в зимнем лесу","winter"],
  ["firepit-01","Костровая зона у деревянного дома в сумерках","summer"],
  ["firepit-02","Зимний вечер у костра на берегу озера","winter"],
  ["firepit-03","Крупный план костра и деревянной скамьи на осеннем берегу","autumn"],
  ["firepit-spring","Костровая зона на весеннем берегу","spring"],
  ["barbecue-01","Деревянная беседка с мангалом на летнем берегу","summer"],
  ["barbecue-02","Приготовление еды на мангале зимой","winter"],
  ["barbecue-03","Осенний обед в деревянной беседке","autumn"],
  ["barbecue-spring","Весенний отдых в беседке у мангала","spring"],
  ["rental-01","Велосипеды для летних прогулок по лесу","summer"],
  ["rental-02","Настольный теннис на весенней площадке","spring"],
  ["rental-03","Мячи и ракетки для активного отдыха осенью","autumn"],
  ["routes-01","Летняя прогулочная тропа среди сосен и берёз","summer"],
  ["routes-02","Весенняя дорожка среди смешанного леса","spring"],
  ["routes-03","Береговая тропинка с лавкой у воды","summer"],
  ["routes-autumn","Осенняя тропинка под золотыми берёзами","autumn"],
  ["routes-winter","Заснеженная прогулочная тропа","winter"],
  ["fishing-01","Летняя рыбалка с деревянного пирса","summer"],
  ["fishing-02","Рыбалка на осеннем берегу","autumn"],
  ["fishing-03","Зимняя рыбалка на замёрзшем озере","winter"],
  ["fishing-spring","Весенняя рыбалка на оттаявшем берегу в Рузе","spring"],
  ["sup-01","Подготовка SUP-досок у берёзового берега в Рузе","summer"],
  ["sup-02","Инструктаж перед SUP-прогулкой в Рузе","summer"],
  ["sup-03","SUP-прогулка по спокойной воде в Рузе","summer"],
  ["sunbathing-01","Шезлонги на травяном берегу озера","summer"],
  ["sunbathing-02","Летний отдых у воды на полотенцах","summer"],
  ["sunbathing-03","Чтение в шезлонге у воды","summer"],
  ["ice-rink-01","Семейное катание на лесном катке в Рузе","winter"],
  ["ice-rink-02","Подготовка к катанию на коньках в Рузе","winter"],
  ["ice-rink-03","Первое катание на коньках с родителем в Рузе","winter"],
  ["snowmobiles-01","Зимний маршрут на снегоходе в Рузе","winter"],
  ["snowmobiles-02","Прогулка на снегоходе по лесу в Рузе","winter"],
  ["snowmobiles-03","Снегоход у пункта проката в Рузе","winter"],
  ["tubing-01","Катание на ватрушках на пологой горке в Рузе","winter"],
  ["tubing-02","Семейный отдых с ватрушкой в Рузе","winter"],
  ["tubing-03","Прокат ватрушек для зимних прогулок в Рузе","winter"],
  ["buggy-01","Поездка на багги по лесной дороге летом","summer"],
  ["buggy-02","Багги после весеннего маршрута","spring"],
  ["buggy-03","Зимний маршрут на багги","winter"],
  ["buggy-autumn","Осенний маршрут на багги по лесу","autumn"],
  ["events-01","Летний павильон для семейного праздника","summer"],
  ["events-02","Зимний праздник в тёплом павильоне","winter"],
  ["events-03","Осенний праздник в деревянном павильоне","autumn"],
  ["events-spring","Весенний семейный праздник в павильоне","spring"],
  ["garden-01","Летний парник с овощами","summer"],
  ["garden-02","Весенняя рассада в парнике","spring"],
  ["garden-03","Осенний урожай в парнике","autumn"]
];
const photographs = records.map(([stem, alt, season]) => ({
  ...collectionImageSource(`${root}${stem}-1536.webp`), alt, season,
}));
const galleries = {"children":[0,1,2],"firepit":[6,7,8],"barbecue":[10,11,12],"rental":[14,15,16],"routes":[17,18,19],"fishing":[22,23,24],"sup":[26,27,28],"sunbathing":[29,30,31],"ice-rink":[32,33,34],"snowmobiles":[35,36,37],"tubing":[38,39,40],"buggy":[41,42,43],"events":[45,46,47],"garden":[49,50,51]};
const seasons = {"winter":{"children":[5],"firepit":[7],"barbecue":[11],"routes":[21],"fishing":[24],"ice-rink":[32,33,34],"snowmobiles":[35,36,37],"tubing":[38,39,40],"buggy":[43],"events":[46]},"spring":{"children":[1],"firepit":[9],"barbecue":[13],"rental":[15],"routes":[18],"fishing":[25],"buggy":[42],"events":[48],"garden":[50]},"summer":{"children":[0],"firepit":[6],"barbecue":[10],"rental":[14],"routes":[17],"fishing":[22],"sup":[26,27,28],"sunbathing":[29,30,31],"buggy":[41],"events":[45],"garden":[49]},"autumn":{"children":[2],"firepit":[8],"barbecue":[12],"rental":[16],"routes":[20],"fishing":[23],"buggy":[44],"events":[47],"garden":[51]}};
export function getEntertainmentPhotographs(id, season = "all") {
  const indices = season === "all" ? galleries[id] : seasons[season]?.[id];
  return (indices || []).map(index => photographs[index]);
}
