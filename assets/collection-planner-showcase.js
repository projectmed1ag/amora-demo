const video = document.querySelector('.planner-showcase-video');

if (video && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.intersectionRatio >= 0.25)) return;
    observer.disconnect();
    video.play().catch(() => {
      // The native play button stays available when autoplay is blocked.
    });
  }, { threshold: 0.25 });

  observer.observe(video);
}
