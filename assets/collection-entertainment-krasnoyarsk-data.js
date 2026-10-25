import { collectionImageSource } from './collection-image-sources.js?v=20261025-original-quality-1';

// Regional photographs: store each scene once and derive responsive candidates.
const root = "images/krasnoyarsk/entertainment-v2/";
const records = [
  ["children-01","Летняя семейная прогулка по видовой тропе над речной долиной","summer"],
  ["children-02","Развивающие игры с деревянным конструктором на свежем воздухе","spring"],
  ["children-03","Знакомство с козами в контактном зоопарке осенью","autumn"],
  ["children-winter","Зимняя семейная прогулка по снежной лесной тропе","winter"],
  ["firepit-01","Костровая терраса над речной долиной на закате","summer"],
  ["firepit-02","Зимний вечер у костра на заснеженной лесной террасе","winter"],
  ["firepit-03","Осенний костёр и деревянные кресла над речной долиной","autumn"],
  ["firepit-spring","Весенний отдых у костровой чаши среди сосен","spring"],
  ["barbecue-01","Летняя беседка с мангалом у каменистого берега","summer"],
  ["barbecue-02","Приготовление овощей на мангале в зимней беседке","winter"],
  ["barbecue-03","Осенний обед в деревянной беседке","autumn"],
  ["barbecue-spring","Весенний пикник с приготовлением овощей на мангале","spring"],
  ["rental-01","Подготовка горных велосипедов к летней прогулке","summer"],
  ["rental-02","Весенняя игра в настольный теннис на открытом воздухе","spring"],
  ["rental-03","Мячи и спортивный инвентарь для осеннего отдыха","autumn"],
  ["routes-01","Летняя тропа среди сосен с видом на водохранилище","summer"],
  ["routes-02","Весенняя прогулочная тропа на лесном склоне","spring"],
  ["routes-03","Каменистая видовая тропа с деревянными перилами над рекой","summer"],
  ["routes-autumn","Осенняя тропа среди золотистых лиственниц над водой","autumn"],
  ["routes-winter","Заснеженная прогулочная тропа среди сибирских сосен","winter"],
  ["fishing-01","Летняя рыбалка с каменистого берега водохранилища","summer"],
  ["fishing-02","Подготовка рыболовных снастей осенним утром","autumn"],
  ["fishing-03","Зимняя рыбалка на заснеженном водохранилище","winter"],
  ["fishing-spring-natural-v3","Рыбак с удочкой на невысоком весеннем берегу","spring"],
  ["sup-01","Подготовка к SUP-прогулке на сибирском водоёме","summer"],
  ["sup-02","Занятие на SUP-доске в Красноярском крае","summer"],
  ["sup-03","SUP-прогулка у лесистых берегов в Красноярском крае","summer"],
  ["sunbathing-01","Шезлонги на солнечной деревянной площадке у воды","summer"],
  ["sunbathing-02","Летний отдых с книгой у каменистого берега","summer"],
  ["sunbathing-03","Отдых на пледах на травяном берегу водохранилища","summer"],
  ["ice-rink-01","Зимний каток среди хвойного леса в Красноярском крае","winter"],
  ["ice-rink-02","Катание на коньках на лесном катке в Красноярском крае","winter"],
  ["ice-rink-03","Детское катание на коньках с родителем в Красноярском крае","winter"],
  ["snowmobiles-01","Снегоходный маршрут среди сибирского хвойного леса","winter"],
  ["snowmobiles-02","Прогулка на снегоходе в Красноярском крае","winter"],
  ["snowmobiles-03","Снегоход в пункте проката Красноярского отеля","winter"],
  ["tubing-01","Семейное катание на ватрушках в Красноярском крае","winter"],
  ["tubing-02","Отдых с ватрушкой на пологой зимней горке","winter"],
  ["tubing-03","Прокат ватрушек в Красноярском крае","winter"],
  ["buggy-01","Летняя поездка на багги по хвойному лесу","summer"],
  ["buggy-02","Подготовка к весенней поездке на багги","spring"],
  ["buggy-03","Зимняя остановка на багги у заснеженной лесной тропы","winter"],
  ["buggy-autumn","Осенняя поездка на багги среди золотистых лиственниц","autumn"],
  ["events-01","Летний семейный обед в просторном деревянном павильоне","summer"],
  ["events-02","Зимний семейный праздник в тёплом павильоне","winter"],
  ["events-03","Осеннее чаепитие за праздничным столом в павильоне","autumn"],
  ["events-spring","Подготовка весеннего семейного праздника в павильоне","spring"],
  ["garden-01","Летний уход за растениями в парниках и огороде","summer"],
  ["garden-02","Весенняя посадка рассады в парнике","spring"],
  ["garden-03","Осенний сбор урожая у парника","autumn"]
];
const photographs = records.map(([stem, alt, season]) => ({
  ...collectionImageSource(`${root}${stem}-1536.webp`), alt, season,
}));
const galleries = {"children":[0,1,2],"firepit":[4,5,6],"barbecue":[8,9,10],"rental":[12,13,14],"routes":[15,16,17],"fishing":[20,21,22],"sup":[24,25,26],"sunbathing":[27,28,29],"ice-rink":[30,31,32],"snowmobiles":[33,34,35],"tubing":[36,37,38],"buggy":[39,40,41],"events":[43,44,45],"garden":[47,48,49]};
const seasons = {"winter":{"children":[3],"firepit":[5],"barbecue":[9],"routes":[19],"fishing":[22],"ice-rink":[30,31,32],"snowmobiles":[33,34,35],"tubing":[36,37,38],"buggy":[41],"events":[44]},"spring":{"children":[1],"firepit":[7],"barbecue":[11],"rental":[13],"routes":[16],"fishing":[23],"buggy":[40],"events":[46],"garden":[48]},"summer":{"children":[0],"firepit":[4],"barbecue":[8],"rental":[12],"routes":[15],"fishing":[20],"sup":[24,25,26],"sunbathing":[27,28,29],"buggy":[39],"events":[43],"garden":[47]},"autumn":{"children":[2],"firepit":[6],"barbecue":[10],"rental":[14],"routes":[18],"fishing":[21],"buggy":[42],"events":[45],"garden":[49]}};
export function getEntertainmentPhotographs(id, season = "all") {
  const indices = season === "all" ? galleries[id] : seasons[season]?.[id];
  return (indices || []).map(index => photographs[index]);
}
