export const homeHeader = "\n<a class=\"home-brand amore-logo\" href=\"./hotel.html?city=mozhaysk\" aria-label=\"A’MORE Collection — на главную\"><span class=\"brand-name\">A’MORE</span><span class=\"brand-collection\">COLLECTION</span></a>\n<nav class=\"home-nav\" id=\"home-nav\" aria-label=\"Разделы сайта\">\n<a href=\"./hotel.html?city=mozhaysk\" aria-current=\"page\">Главная</a>\n<a href=\"./rooms.html?city=mozhaysk\">Хаусботы</a>\n<a href=\"./spaces.html?city=mozhaysk\">Развлечения и активный отдых</a>\n<a href=\"./about.html?city=mozhaysk\">Об отеле</a>\n</nav>\n<div class=\"home-header-end\"><a href=\"./\">Отели</a><button class=\"home-menu\" type=\"button\" aria-label=\"Открыть меню\" aria-controls=\"home-nav\" aria-expanded=\"false\"><span></span><span></span></button></div>\n";
export const homeFooter = "<a class=\"home-brand amore-logo\" href=\"./hotel.html?city=mozhaysk\" aria-label=\"A’MORE Collection — на главную\"><span class=\"brand-name\">A’MORE</span><span class=\"brand-collection\">COLLECTION</span></a><span>Московская область,<br>Можайское водохранилище</span><a class=\"home-link\" href=\"./\"><span>Все отели</span><svg viewBox=\"0 0 28 20\" aria-hidden=\"true\"><path d=\"M2 10h22m-6-6 6 6-6 6\"/></svg></a>";
export function addCollectionStyle(id, file) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = new URL(file, import.meta.url).href;
  link.setAttribute('blocking', 'render');
  document.head.append(link);
}

export function applyCollectionShell(page, { light = false } = {}) {
  document.body.classList.add('collection-home-page', 'collection-site-page');
  document.documentElement.classList.add('collection-home-root');
  addCollectionStyle('collection-home-style', './collection-home.css?v=20261025-first-photo-2');
  addCollectionStyle('collection-site-shell-style', './collection-site-shell.css?v=header-2');
  addCollectionStyle('collection-brand-style', './collection-brand.css?v=original-1');
  let header = document.querySelector('.site-header, .home-header');
  if (!header) {
    header = document.createElement('header');
    document.body.prepend(header);
  }
  header.className = `home-header${light ? ' home-header-light' : ''}`;
  header.innerHTML = homeHeader;
  const active = page === 'location' ? 'about' : page;
  header.querySelectorAll('[aria-current]').forEach(link => link.removeAttribute('aria-current'));
  if (active === 'booking') {
    header.querySelector('a[href*="rooms.html"]').classList.add('is-current-section');
  } else {
    const file = active === 'home' ? 'hotel' : active;
    header.querySelector(`.home-nav a[href*="${file}.html"]`)?.setAttribute('aria-current', 'page');
  }
  let footer = document.querySelector('.site-footer, .home-footer');
  if (!footer) {
    footer = document.createElement('footer');
    document.body.append(footer);
  }
  footer.className = 'home-footer';
  footer.innerHTML = homeFooter;
  document.querySelector('#destination-dialog')?.remove();
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.content = light ? '#f6f3ed' : '#1c241b';

  const menu = header.querySelector('.home-menu');
  const nav = header.querySelector('.home-nav');
  const close = () => {
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Открыть меню');
    header.classList.remove('menu-open');
  };
  menu.addEventListener('click', () => {
    if (menu.getAttribute('aria-expanded') === 'true') return close();
    menu.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-label', 'Закрыть меню');
    header.classList.add('menu-open');
    nav.querySelector('a').focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      close();
      menu.focus();
    }
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) close();
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) close();
  });
  header.addEventListener('focusout', event => {
    if (event.relatedTarget && !header.contains(event.relatedTarget)) close();
  });
  window.matchMedia('(min-width: 1600px)').addEventListener('change', close);
}
