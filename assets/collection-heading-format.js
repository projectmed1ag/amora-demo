const headingSelector = 'h1,h2,h3,h4,h5,h6';
let initialized = false;

function formatHeading(heading) {
  const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
  let node;
  let lastText;
  while ((node = walker.nextNode())) {
    if (node.data.trim()) lastText = node;
  }
  if (lastText && /\.(\s*)$/.test(lastText.data)) {
    lastText.data = lastText.data.replace(/\.(\s*)$/, '$1');
  }
}

export function initHeadingFormat() {
  if (initialized) return;
  initialized = true;
  document.querySelectorAll(headingSelector).forEach(formatHeading);
  const pending = new Set();
  let frame = 0;
  const enqueue = node => {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!element) return;
    const heading = element.closest(headingSelector);
    if (heading) pending.add(heading);
    element.querySelectorAll?.(headingSelector).forEach(item => pending.add(item));
  };
  new MutationObserver(records => {
    records.forEach(record => {
      if (record.type === 'characterData') enqueue(record.target);
      else record.addedNodes.forEach(enqueue);
    });
    if (!pending.size || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      pending.forEach(heading => {
        if (heading.isConnected) formatHeading(heading);
      });
      pending.clear();
    });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
