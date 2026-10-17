import { applyCollectionShell } from './collection-site-shell.js?v=device-1';

const arrow = '<svg viewBox="0 0 28 20" aria-hidden="true"><path d="M2 10h22m-6-6 6 6-6 6"/></svg>';

export function enhanceCollectionBooking() {
  applyCollectionShell('booking', { light: true });
  document.body.classList.add('collection-booking-page');

  if (!document.getElementById('collection-booking-style')) {
    const stylesheet = document.createElement('link');
    stylesheet.id = 'collection-booking-style';
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('./collection-booking.css?v=site-1', import.meta.url).href;
    stylesheet.setAttribute('blocking', 'render');
    document.head.append(stylesheet);
  }

  // The original booking renderer has already connected these exact nodes to
  // validation, room selection, the summary and the editable demo result.
  // Add only presentation hooks; replacing the form would discard its handlers.
  const main = document.querySelector('#content');
  main.querySelector('.booking-heading').classList.add('collection-booking-heading');
  main.querySelector('.demo-notice').classList.add('collection-booking-notice');
  main.querySelector('.booking-layout').classList.add('collection-booking-layout');

  for (const button of main.querySelectorAll('#booking-form [type="submit"], #edit-booking')) {
    if (button.querySelector('svg')) continue;
    const label = document.createElement('span');
    label.textContent = button.textContent;
    button.replaceChildren(label);
    button.insertAdjacentHTML('beforeend', arrow);
  }

  const summaryPhoto = main.querySelector('#summary-photo img');
  if (summaryPhoto) summaryPhoto.sizes = '(max-width: 700px) 100vw, 44vw';
}
