// Speculative photographs must not compete with the first painted screen.
// Requested frames bypass this queue; at most one background task runs at once.
const pending = new Map();
let scheduled = false;
let running = false;
let awaitingLoad = false;

export function canPrefetchImages() {
  const connection = navigator.connection;
  // Speculative full photographs cost bandwidth even with a low priority.
  // On constrained or high-latency links reserve it for the selected frame.
  return !connection?.saveData
    && !['slow-2g', '2g', '3g'].includes(connection?.effectiveType)
    && !(connection?.rtt >= 300)
    && !(connection?.downlink > 0 && connection.downlink <= 1.5);
}

function pump() {
  if (scheduled || running || !pending.size) return;
  if (!canPrefetchImages()) { pending.clear(); return; }
  if (document.readyState !== 'complete') {
    if (!awaitingLoad) {
      awaitingLoad = true;
      window.addEventListener('load', () => { awaitingLoad = false; pump(); }, { once: true });
    }
    return;
  }
  scheduled = true;
  // A small quiet period lets visible image requests and input settle first.
  setTimeout(() => {
    const start = () => {
      scheduled = false;
      if (!canPrefetchImages()) { pending.clear(); return; }
      const first = pending.entries().next().value;
      if (!first) return;
      const [key, job] = first;
      pending.delete(key);
      if (document.hidden || !job.needed()) { pump(); return; }
      running = true;
      Promise.resolve().then(() => job.needed() && job.run())
        .catch(() => {})
        .finally(() => { running = false; pump(); });
    };
    if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 800 });
    else start();
  }, 180);
}

export function scheduleImagePrefetch(key, run, needed = () => true) {
  if (!canPrefetchImages()) return;
  pending.set(key, { run, needed });
  pump();
}

export function cancelImagePrefetch(key) {
  pending.delete(key);
}
