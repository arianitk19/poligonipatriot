// Ndihmës për ndërtimin e elementeve në faqe.
import { mediaUrl } from './data.js';
import { CONFIG } from './config.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const num = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
export function priceLabel(p) {
  if (p.price != null && p.show_price !== false) return `${num.format(p.price)} €`;
  return 'Çmimi në dyqan';
}

export const productUrl = (p) => `/dyqani/produkt/?p=${encodeURIComponent(p.slug)}`;

export function whatsappLink(text, number = CONFIG.site.whatsapp) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function productSpecsLine(p) {
  return [p.caliber, p.capacity ? `${p.capacity} fishekë` : null].filter(Boolean).join(' · ');
}

export function productCard(p, { lazy = true } = {}) {
  const img = p.images?.[0];
  const specs = productSpecsLine(p);
  return `
  <li class="pcard">
    <a href="${productUrl(p)}" class="grid gap-4 group" aria-label="${esc(p.name)}">
      <div class="pcard-media">
        ${img ? `<img src="${esc(mediaUrl(img))}" alt="${esc(p.name)}" ${lazy ? 'loading="lazy"' : ''} decoding="async">` : ''}
        ${p.in_stock === false ? '<span class="absolute left-3 top-3 rounded bg-steel-950/80 px-2 py-1 text-xs font-semibold text-bone">Pa stok</span>' : ''}
      </div>
      <div class="grid gap-1">
        <p class="text-sm text-steel-400">${esc(p.brand || '')}</p>
        <h3 class="text-lg font-semibold leading-snug group-hover:text-white">${esc(p.name)}</h3>
        <p class="flex items-center justify-between gap-3 text-sm">
          <span class="t-spec text-steel-300">${esc(specs || p.origin || '')}</span>
          <span class="t-spec font-semibold">${esc(priceLabel(p))}</span>
        </p>
      </div>
    </a>
  </li>`;
}
