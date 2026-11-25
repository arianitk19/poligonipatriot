// Faqja Black Friday: kartat e ofertave, filtrat, renditja dhe numëruesi.
import { BF_ITEMS, BF_END_LABEL, bfActive, bfName, eur, startCountdown } from '../black-friday-data.js';
import { esc, whatsappLink, productUrl } from '../ui.js';

const list = document.querySelector('[data-bf-list]');
const filters = document.querySelector('[data-bf-filters]');
const sortSel = document.querySelector('[data-bf-sort]');
let type = '';
let sort = '';

function card(it) {
  const msg = `Përshëndetje! Jam i interesuar për ofertën Black Friday: ${bfName(it)}, ${eur(it.price)} (nga ${eur(it.old)}). A është në dispozicion?`;
  return `
  <li class="bf-card${it.type === 'pa-vijaska' ? ' is-long' : ''}" id="${esc(it.id)}">
    <div class="bf-card-media">
      <img src="${esc(it.img)}" alt="${esc(bfName(it))}" loading="lazy" decoding="async">
      <span class="bf-card-off">−${it.pct}% <small>ZBRITJE</small></span>
      ${it.tag ? `<span class="bf-card-tag">${esc(it.tag)}</span>` : ''}
    </div>
    <div class="bf-card-body">
      <div>
        <p class="bf-card-brand">${esc(it.brand)}</p>
        <h3 class="bf-card-model">${esc(it.model)}</h3>
      </div>
      <dl class="bf-specs">${it.specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <div class="bf-price">
        <div><s>${esc(eur(it.old))}</s><b class="bf-red">${esc(eur(it.price))}</b></div>
        <span>Kurseni<em>${esc(eur(it.save))}</em></span>
      </div>
      <div class="bf-actions">
        <a class="btn btn-primary" href="${esc(whatsappLink(msg))}" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-whatsapp"/></svg>Porosit në WhatsApp</a>
        <a class="bf-ig" href="https://ig.me/m/poligoni.patriot" target="_blank" rel="noopener" aria-label="Porosit në DM në Instagram"><svg aria-hidden="true"><use href="#i-instagram"/></svg></a>
      </div>
      ${it.slug ? `<a class="link-u text-sm text-steel-300 justify-self-start" href="${esc(productUrl({ slug: it.slug }))}">Shiko produktin në dyqan</a>` : ''}
    </div>
  </li>`;
}

function render() {
  let items = BF_ITEMS.filter((i) => !type || i.type === type);
  if (sort === 'pct') items = [...items].sort((a, b) => b.pct - a.pct);
  if (sort === 'asc') items = [...items].sort((a, b) => a.price - b.price);
  if (sort === 'desc') items = [...items].sort((a, b) => b.price - a.price);
  list.innerHTML = items.map(card).join('');
}

function ended() {
  document.querySelector('[data-bf-count]')?.remove();
  const eb = document.querySelector('[data-bf-eyebrow]');
  if (eb) eb.lastChild.textContent = `Oferta përfundoi më ${BF_END_LABEL}`;
  filters?.remove();
  list.outerHTML = `<div class="bf-ended"><p class="t-h3">Oferta Black Friday ka përfunduar.</p><p class="mt-3 text-steel-400">Faleminderit për interesimin. Shikoni armët e tjera në dyqan.</p><a class="btn btn-primary mt-6" href="/dyqani/">Shko te dyqani</a></div>`;
}

if (list) {
  if (!bfActive()) ended();
  else {
    filters.addEventListener('click', (e) => {
      const b = e.target.closest('[data-type]');
      if (!b) return;
      type = b.dataset.type;
      filters.querySelectorAll('[data-type]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      render();
    });
    sortSel.addEventListener('change', () => { sort = sortSel.value; render(); });
    render();
    startCountdown(document.querySelector('[data-bf-count]'), ended);
    // lidhje direkte te një armë (#radikal-rpx9)
    if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'center' }));
  }
}
