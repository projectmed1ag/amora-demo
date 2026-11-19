const video = document.querySelector('.planner-showcase-video');
const playback = document.querySelector('.planner-showcase-playback');

if (video && playback) {
  const label = playback.querySelector('span');
  const syncPlayback = () => { label.textContent = video.paused ? 'Смотреть ролик' : 'Пауза ролика'; };
  const play = () => video.play().catch(syncPlayback);
  let observer;

  playback.addEventListener('click', () => {
    observer?.disconnect();
    if (video.paused) play();
    else video.pause();
  });
  video.addEventListener('play', syncPlayback);
  video.addEventListener('pause', syncPlayback);
  playback.hidden = false;

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.intersectionRatio >= 0.25)) return;
      observer.disconnect();
      play();
    }, { threshold: 0.25 });
    observer.observe(video);
  }
}
