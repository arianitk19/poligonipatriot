import { getProducts, getCategories } from '../data.js';
import { productCard, esc } from '../ui.js';

const $ = (s) => document.querySelector(s);
const grid = $('[data-grid]');
const els = { q: $('[data-q]'), brand: $('[data-brand]'), caliber: $('[data-caliber]'), sort: $('[data-sort]'), cats: $('[data-cats]'), count: $('[data-count]'), empty: $('[data-empty]') };
const title = $('[data-cat-title]');
const desc = $('[data-cat-desc]');
const defaultDesc = desc.textContent;

const params = new URLSearchParams(location.search);
const state = { cat: params.get('kategoria') || '', q: params.get('q') || '', brand: params.get('marka') || '', caliber: params.get('kalibri') || '', sort: params.get('renditja') || '' };
let products = [];
let categories = [];

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

function syncUrl() {
  const p = new URLSearchParams();
  if (state.cat) p.set('kategoria', state.cat);
  if (state.q) p.set('q', state.q);
  if (state.brand) p.set('marka', state.brand);
  if (state.caliber) p.set('kalibri', state.caliber);
  if (state.sort) p.set('renditja', state.sort);
  history.replaceState(null, '', `${location.pathname}${p.toString() ? '?' + p : ''}`);
}

function options(select, values, label) {
  const cur = select.value;
  select.innerHTML = `<option value="">${label}</option>` + values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  select.value = values.includes(cur) ? cur : '';
}

function render() {
  const inCat = products.filter((p) => !state.cat || p.category_slug === state.cat);
  options(els.brand, [...new Set(inCat.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)), 'Të gjitha markat');
  options(els.caliber, [...new Set(inCat.map((p) => p.caliber).filter(Boolean))].sort(), 'Të gjithë kalibrat');
  els.brand.value = state.brand; els.caliber.value = state.caliber;

  const q = norm(state.q);
  let list = inCat.filter((p) =>
    (!state.brand || p.brand === state.brand) &&
    (!state.caliber || p.caliber === state.caliber) &&
    (!q || norm([p.name, p.brand, p.caliber, p.origin].join(' ')).includes(q)));

  const price = (p) => (p.price != null && p.show_price !== false ? p.price : null);
  if (state.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'sq'));
  if (state.sort === 'price-asc') list.sort((a, b) => (price(a) ?? Infinity) - (price(b) ?? Infinity));
  if (state.sort === 'price-desc') list.sort((a, b) => (price(b) ?? -Infinity) - (price(a) ?? -Infinity));

  grid.innerHTML = list.map((p, i) => productCard(p, { lazy: i > 7 })).join('');
  els.empty.classList.toggle('hidden', list.length > 0);
  els.count.textContent = `${list.length} ${list.length === 1 ? 'produkt' : 'produkte'}`;
  const filtered = state.q || state.brand || state.caliber || state.sort;
  document.querySelectorAll('[data-reset]').forEach((b) => b.classList.toggle('hidden', !filtered && b.closest('[data-empty]') === null));

  els.cats.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === state.cat)));
  const c = categories.find((x) => x.slug === state.cat);
  title.textContent = c ? c.name : 'Dyqani';
  desc.textContent = c?.description || defaultDesc;
  document.title = `${c ? c.name : 'Dyqani'} — Poligoni Patriot`;
  syncUrl();
}

Promise.all([getProducts(), getCategories()]).then(([p, c]) => {
  products = p;
  categories = c;
  const counts = Object.fromEntries(c.map((x) => [x.slug, p.filter((y) => y.category_slug === x.slug).length]));
  els.cats.innerHTML = `<button type="button" class="chip" data-cat="">Të gjitha <span class="count">${p.length}</span></button>` +
    c.filter((x) => counts[x.slug] || x.slug === state.cat).map((x) => `<button type="button" class="chip" data-cat="${esc(x.slug)}">${esc(x.name)} <span class="count">${counts[x.slug] || 0}</span></button>`).join('');
  els.q.value = state.q; els.sort.value = state.sort;
  render();
}).catch((e) => {
  console.error(e);
  grid.innerHTML = '';
  els.count.textContent = 'Katalogu nuk u ngarkua. Provoni sërish.';
});

els.cats.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  state.cat = b.dataset.cat; state.brand = ''; state.caliber = '';
  render();
});
let t;
els.q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = els.q.value.trim(); render(); }, 160); });
els.brand.addEventListener('change', () => { state.brand = els.brand.value; render(); });
els.caliber.addEventListener('change', () => { state.caliber = els.caliber.value; render(); });
els.sort.addEventListener('change', () => { state.sort = els.sort.value; render(); });
document.querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', () => {
  Object.assign(state, { q: '', brand: '', caliber: '', sort: '' });
  els.q.value = ''; els.sort.value = '';
  render();
}));
