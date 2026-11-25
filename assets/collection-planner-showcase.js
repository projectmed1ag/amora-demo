const video = document.querySelector('.planner-showcase-video');
const playback = document.querySelector('.planner-showcase-playback');

if (video && playback) {
  const label = playback.querySelector('span');
  const sources = [
    { width: 1000, src: video.querySelector('source')?.getAttribute('src') },
    { width: 1600, src: video.dataset.sourceHd },
    { width: 2560, src: video.dataset.sourceHigh },
  ].filter(source => source.src);
  let selectedSource = sources[0];
  const syncPlayback = () => { label.textContent = video.paused ? 'Смотреть ролик' : 'Пауза ролика'; };
  const play = () => {
    const requiredWidth = Math.ceil(video.getBoundingClientRect().width * (window.devicePixelRatio || 1));
    const source = sources.find(candidate => candidate.width >= requiredWidth) || sources.at(-1);
    if (source && source !== selectedSource) {
      const position = video.currentTime;
      if (position > 0) {
        video.addEventListener('loadedmetadata', () => {
          video.currentTime = Math.min(position, video.duration);
        }, { once: true });
      }
      selectedSource = source;
      video.src = source.src;
    }
    return video.play().catch(syncPlayback);
  };
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
