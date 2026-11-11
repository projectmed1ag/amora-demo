import { destinationURL } from './collection-destinations.js?v=20261024-all-hotels-1';
import { addDays, breakfastNotice, dateNumber } from './collection-holiday-engine.js?v=20261108-route-pdf-1';
import { getSeasonActivities, getSeasonForDate } from './collection-seasons.js';

const city = 'mozhaysk';
const link = (label, page, query) => ({ label, href: destinationURL(page, city, query).href });
const prompt = (label, query = label) => ({ label, query });
const prompts = {
  breakfast: prompt('Завтрак', 'Во сколько завтрак в отеле?'),
  restaurant: prompt('Ресторан', 'Расскажи про ресторан'),
  banya: prompt('Баня', 'Расскажи про баню'),
  family: prompt('Для детей', 'Что есть в отеле для детей?'),
  rental: prompt('Прокат', 'Что есть в прокате?'),
  leisure: prompt('Развлечения', 'Расскажи про развлечения на территории'),
  events: prompt('Афиша', 'Какие события в отеле на даты моей поездки?'),
};

function reply(text, links, suggestions) {
  return { text, links, suggestions, local: true };
}

function askedSeasons(plan, value, now) {
  const byName = [
    ['winter', /(?:зимой|зимни[а-я]*)/u], ['spring', /(?:весной|весенни[а-я]*)/u],
    ['summer', /(?:летом|летни[а-я]*)/u], ['autumn', /(?:осенью|осенни[а-я]*)/u],
  ].filter(([, pattern]) => pattern.test(value)).map(([season]) => season);
  if (byName.length) return byName;
  const relativeDay = /послезавтра/u.test(value) ? 2 : /завтра/u.test(value) ? 1 : /сегодня/u.test(value) ? 0 : null;
  const date = Number.isFinite(dateNumber(now?.date)) ? now.date : null;
  if (date && relativeDay !== null) return [getSeasonForDate(addDays(date, relativeDay))].filter(Boolean);
  const seasons = [...new Set(plan?.days?.map(day => getSeasonForDate(day.date)).filter(Boolean))];
  return seasons.length ? seasons : [getSeasonForDate(date)].filter(Boolean);
}

function familyReply(seasons, value) {
  if (/зоопарк/u.test(value)) {
    return reply('Контактный зоопарк указан в каталоге на весну, лето и осень. Перед посещением уточните часы работы и правила контакта с животными.', [
      link('Контактный зоопарк', 'leisure-children.html#zoo'),
    ], [prompts.family]);
  }
  const starts = 'С детьми можно погулять по территории и поиграть в развивающие игры.';
  const seasonal = 'Контактный зоопарк и детские игровые зоны указаны в каталоге на весну, лето и осень.';
  return reply(`${starts} ${seasonal}`, [
    link('Занятия для детей', 'leisure-children.html'),
    link('Детское меню', 'restaurant.html#menu-kids'),
  ], [prompts.breakfast, ...(seasons.some(season => season !== 'winter') ? [prompts.rental] : []), prompts.events]);
}

const seasonalHighlights = {
  winter: { label: 'Зимой', titles: ['Каток', 'Ватрушки', 'Снегоходы'] },
  spring: { label: 'Весной', titles: ['Велосипеды', 'Настольный теннис', 'Садовые парники'] },
  summer: { label: 'Летом', titles: ['SUP-прогулки', 'Велосипеды', 'Места для загара'] },
  autumn: { label: 'Осенью', titles: ['Пешие тропы', 'Велосипеды', 'Садовые парники'] },
};

function leisureReply(seasons) {
  const highlights = seasons.flatMap(season => {
    const { label, titles } = seasonalHighlights[season];
    const names = getSeasonActivities(season, city).filter(item => titles.includes(item.title))
      .map(({ title }) => title.replace(/^[А-ЯЁ]/u, char => char.toLocaleLowerCase('ru')));
    return names.length ? [`${label} в каталоге есть ${names.join(', ')}.`] : [];
  });
  return reply([
    'Для спокойного отдыха подойдут пешие тропы, беседки и костровая зона у воды.',
    ...highlights,
    'Условия для занятий на открытом воздухе зависят от погоды и наличия инвентаря.',
  ].join(' '), [link('Развлечения на территории', 'spaces.html', { season: seasons[0] })], [prompts.family, prompts.rental, prompts.events]);
}

const editRequest = /^(?:добав|встав|перенес|перенест|передвин|сдвин|убер|убрат|удал|замен|подбер|подобр|предлож|посовет)/u;
const scheduleQuestion = /(?:что (?:у (?:нас|меня)(?![а-я])|запланирован|в (?:моем )?плане|(?:можно |будет |дальше )?после (?:завтрака|обеда|ужина))|у меня в плане|(?:во сколько|когда) (?:у нас|у меня) )/u;
const hotelOverview = /(?:плюшк|удобств|какие (?:еще )?(?:есть )?(?:услуги|возможности)|что (?:еще )?есть (?:в отеле|на территории)(?=[.!?]*$)|чем особен[а-я]* отель|расскажи(?:те)? (?:об отеле|про отель))/u;
const tariffQuestion = /(?:акци[ияю]|скидк|спецпредложен|промокод|бонус|привилеги|бесплатн|входит|включен|включат|оплачива[ею]тся|сколько стоит проживание)/u;

export function answerHolidayChatHotel(plan, input, now) {
  const value = String(input ?? '').toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/\s+/gu, ' ').trim();
  const command = value.replace(/^(?:(?:а|пожалуйста|можно|можешь|можете)[ ,]+)+/u, '');
  if (editRequest.test(command) || scheduleQuestion.test(value)) return null;

  const tariff = tariffQuestion.test(value);
  if (/завтрак/u.test(value)) {
    const conditions = tariff ? ' Условия включения завтрака в стоимость уточните при бронировании.' : '';
    return reply(`${breakfastNotice}${conditions}`, [link('Меню завтраков', 'restaurant.html#menu-breakfast')], [prompts.restaurant]);
  }
  if (tariff) {
    return reply('Условия тарифа и действующие предложения уточните у команды отеля при бронировании.', [
      link('Бронирование', 'booking.html'), link('Контакты отеля', 'contacts.html'),
    ]);
  }
  if (/(?:ресторан|детское меню|(?:где|что) поесть|забронировать столик|меню обеда|меню ужина)/u.test(value)) {
    const hours = /(?:во сколько|часы работы|режим работы|когда откры|до скольки|до которого часа|когда закры)/u.test(value);
    const text = hours
      ? `${breakfastNotice} Часы работы ресторана в остальное время уточните у команды отеля.`
      : 'В ресторане есть завтраки, салаты, супы, горячие блюда и отдельное детское меню. Столик можно запросить на странице ресторана.';
    return reply(text, [link('Меню и бронирование столика', 'restaurant.html#menu'), link('Детское меню', 'restaurant.html#menu-kids')], [prompts.breakfast]);
  }
  if (/(?:^|[^а-я])(?:бан[яюиеь]|парн(?:ая|ой|ую|ые|ых|ыми|ом)(?![а-я])|парени|саун)/u.test(value)) {
    return reply('В деревянной бане у берега есть парная и комната отдыха. На сайте можно выбрать сеанс на два, три или четыре часа. Парение, веники, принадлежности и чай заказывают отдельно.', [link('Сеансы и дополнения', 'banya.html#menu')]);
  }
  if (/(?:беседк|мангал|барбекю|костров|павильон|пикник)/u.test(value)) {
    return reply('На территории есть беседки и мангалы для пикников, костровая зона у берега и павильоны для семейных праздников. Условия аренды и доступность на ваши даты уточнит команда отеля.', [
      link('Беседки и мангалы', 'spaces.html#barbecue'), link('Костровая зона', 'leisure-firepit.html#firepit'), link('Аренда павильонов', 'pavilions.html'),
    ]);
  }
  if (/(?:прокат|велосипед|настольн[а-я]* теннис|инвентар)/u.test(value) && !/(?:каток|коньк|ватрушк|тюбинг|снегоход)/u.test(value)) {
    return reply('С весны по осень в каталоге проката указаны велосипеды для взрослых и детей, настольный теннис, мячи и спортивный инвентарь. Наличие и условия на выбранный день уточнит команда отеля.', [link('Прокат инвентаря', 'spaces.html#rental', { season: 'summer' })], [prompts.leisure]);
  }
  if (/(?:зоопарк|детск[а-я]* (?:зон|площад|развлеч)|для (?:маленьких )?детей|развивающ[а-я]* игр|(?:можно ли|что есть|чем заняться) с ребенком)/u.test(value)) {
    return familyReply(askedSeasons(plan, value, now), value);
  }

  if (/(?:хаусбот|размещени|(?:что есть|удобства) в (?:доме|номере))/u.test(value)) {
    return reply('Хаусботы различаются по площади, вместимости и планировке. Например, у «Люкса» есть отдельная спальня, гостиная и терраса с видом на воду. Условия выбранного варианта указаны на странице бронирования.', [
      link('Описания хаусботов', 'rooms.html'), link('Бронирование', 'booking.html'),
    ]);
  }
  if (/(?:sup|(?:^|[^а-я])сап[ыа]?(?![а-я]))/u.test(value)) {
    return reply('SUP-прогулки указаны в летнем каталоге. Перед выходом на воду уточните погоду, наличие досок и спасательных жилетов, допустимый возраст и условия участия.', [
      link('SUP-прогулки', 'leisure-sup.html#sup'),
    ], [prompts.leisure]);
  }
  if (/(?:парник|теплиц)/u.test(value)) {
    return reply('На весну, лето и осень в каталоге указана прогулка к садовым парникам на территории отеля. Доступ на выбранную дату уточнит команда отеля.', [
      link('Садовые парники', 'leisure-garden.html#greenhouses'),
    ], [prompts.leisure]);
  }
  if (/рыбалк/u.test(value)) {
    return reply('Рыбалка на водохранилище указана в каталоге на все сезоны. Перед выходом уточните подходящее место, условия и ограничения для выбранной даты.', [
      link('Рыбалка на водохранилище', 'spaces.html#fishing'),
    ], [prompts.leisure]);
  }
  if (/(?:каток|катк[аеу]|коньк|ватрушк|тюбинг|снегоход)/u.test(value)) return leisureReply(['winter']);
  if (/(?:пеш[а-я]* троп|развлечени|досуг|чем заняться (?:в отеле|на территории))/u.test(value)) {
    return leisureReply(askedSeasons(plan, value, now));
  }
  if (/(?:трансфер|как добраться|контакт[ыа]|(?:^|[^а-я])адрес(?![а-я]))/u.test(value)) {
    return reply('Маршрут и контакты есть на сайте отеля. Возможность трансфера, время подачи и стоимость уточнит команда отеля.', [
      link('Как добраться', 'location.html'), link('Контакты отеля', 'contacts.html'),
    ]);
  }
  if (hotelOverview.test(value)) {
    return reply('На Можайском водохранилище можно остановиться в хаусботе с видом на воду, посетить ресторан с детским меню, сходить в баню у берега или устроить пикник в беседке. Для прогулок есть пешие тропы, а занятия и прокат зависят от сезона.', [
      link('Хаусботы', 'rooms.html'), link('Все развлечения', 'spaces.html'),
    ], [prompts.breakfast, prompts.banya, prompts.family, prompts.rental, prompts.events]);
  }
  return null;
}
