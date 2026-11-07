const root = document.documentElement;
root.classList.add('motion-enabled');

document.addEventListener('DOMContentLoaded', () => {
  const clickTag = window.clickTag || 'https://example.com/landing';
  document.querySelector('.creative').href = clickTag;
}, { once: true });

function startIntro(startAt) {
  if (root.classList.contains('motion-playing')) return;
  const offset = startAt - (performance.timeOrigin + performance.now());
  root.style.setProperty('--start-offset', `${offset}ms`);
  root.classList.add('motion-playing');
}

const waitsForPreview = window.parent !== window && new URLSearchParams(location.search).has('sync');
if (waitsForPreview) {
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== location.origin) return;
    if (event.data?.type !== 'fireplace:start') return;
    if (event.data.showFinal === true) {
      root.classList.remove('motion-enabled');
    } else if (Number.isFinite(event.data.startAt)) {
      startIntro(event.data.startAt);
    }
  });
} else {
  window.addEventListener('load', () => startIntro(performance.timeOrigin + performance.now()), { once: true });
}
