import { getGallery, mediaUrl } from '../data.js';
import { esc } from '../ui.js';

const PAGE = 32;
const list = document.querySelector('[data-gallery]');
const more = document.querySelector('[data-more]');
const lb = document.querySelector('[data-lightbox]');
const lbImg = lb.querySelector('[data-lb-img]');
const lbCount = lb.querySelector('[data-lb-count]');
let items = [];
let shown = 0;
let current = 0;

function renderMore() {
  const next = items.slice(shown, shown + PAGE);
  list.insertAdjacentHTML('beforeend', next.map((g, i) => `
    <li class="break-inside-avoid">
      <button type="button" class="g-item" data-i="${shown + i}" aria-label="Hap foton ${shown + i + 1}">
        <img src="${esc(mediaUrl(g.thumb || g.src))}" alt="${esc(g.alt || 'Poligoni Patriot')}" loading="lazy" decoding="async"
             ${g.width && g.height ? `width="${g.width}" height="${g.height}"` : ''}>
      </button>
    </li>`).join(''));
  shown += next.length;
  more.hidden = shown >= items.length;
}

function open(i) {
  current = (i + items.length) % items.length;
  const g = items[current];
  lbImg.src = mediaUrl(g.src);
  lbImg.alt = g.alt || 'Poligoni Patriot';
  lbCount.textContent = `${current + 1} / ${items.length}`;
  if (!lb.open) lb.showModal();
  // ngarko paraprakisht fotot fqinje
  [current + 1, current - 1].forEach((k) => { const n = items[(k + items.length) % items.length]; if (n) new Image().src = mediaUrl(n.src); });
}

getGallery().then((data) => {
  items = data;
  list.innerHTML = '';
  if (!items.length) { list.outerHTML = '<p class="text-steel-400">Ende nuk ka foto në galeri.</p>'; return; }
  renderMore();
});

more.addEventListener('click', renderMore);
list.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) open(Number(b.dataset.i)); });
lb.querySelector('[data-lb-close]').addEventListener('click', () => lb.close());
lb.querySelector('[data-lb-prev]').addEventListener('click', () => open(current - 1));
lb.querySelector('[data-lb-next]').addEventListener('click', () => open(current + 1));
lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') open(current + 1); if (e.key === 'ArrowLeft') open(current - 1); });
let x0 = null;
lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
lb.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) open(current + (dx < 0 ? 1 : -1)); x0 = null; });
