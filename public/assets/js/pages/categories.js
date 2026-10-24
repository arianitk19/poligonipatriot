import { getCategories, mediaUrl } from '../data.js';
import { esc } from '../ui.js';

const list = document.querySelector('[data-categories]');
if (list) {
  getCategories().then((cats) => {
    list.innerHTML = cats.map((c) => `
      <li>
        <a class="cat-tile" href="/dyqani/?kategoria=${encodeURIComponent(c.slug)}">
          ${c.image ? `<img src="${esc(mediaUrl(c.image))}" alt="" loading="lazy">` : ''}
          <h3 class="t-h3">${esc(c.name)}</h3>
          ${c.description ? `<p>${esc(c.description)}</p>` : ''}
          <span class="mt-5 inline-flex items-center gap-2 text-sm font-semibold">Shiko produktet <svg class="size-4" aria-hidden="true"><use href="#i-arrow"/></svg></span>
        </a>
      </li>`).join('');
  });
}
