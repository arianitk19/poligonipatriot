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
  els.count.innerHTML = `<b>${list.length}</b> ${list.length === 1 ? 'armë' : 'armë'}`;
  renderBar(list.length);
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
/* ───── Shiriti i kërkimit dhe filtrat ───── */
const bar = {
  clear: $('[data-clear]'), badge: $('[data-badge]'), tags: $('[data-tags]'), panel: $('[data-panel]'),
  scrim: $('[data-sb-scrim]'), apply: $('[data-apply]'), open: $('[data-open-filters]'),
};
const SORTS = { name: 'Emri A–Z', 'price-asc': 'Çmimi ↑', 'price-desc': 'Çmimi ↓' };
function renderBar(n) {
  bar.clear.hidden = !els.q.value;
  const active = [state.brand, state.caliber, state.sort].filter(Boolean).length;
  bar.badge.hidden = !active; bar.badge.textContent = active;
  [els.brand, els.caliber, els.sort].forEach((s) => s.closest('.sb-field').classList.toggle('is-set', Boolean(s.value)));
  bar.apply.textContent = n ? `Shfaq ${n} armë` : 'Asnjë armë';
  const tags = [];
  if (state.q) tags.push(['q', `“${state.q}”`]);
  if (state.brand) tags.push(['brand', state.brand]);
  if (state.caliber) tags.push(['caliber', state.caliber]);
  if (state.sort) tags.push(['sort', SORTS[state.sort]]);
  bar.tags.innerHTML = tags.map(([k, v]) => `<button type="button" class="sb-tag" data-untag="${k}" aria-label="Hiq filtrin ${esc(v)}">${esc(v)}<svg aria-hidden="true"><use href="#i-close"/></svg></button>`).join('');
}
bar.tags.addEventListener('click', (e) => {
  const b = e.target.closest('[data-untag]');
  if (!b) return;
  state[b.dataset.untag] = '';
  if (b.dataset.untag === 'q') els.q.value = '';
  if (b.dataset.untag === 'sort') els.sort.value = '';
  render();
});
bar.clear.addEventListener('click', () => { els.q.value = ''; state.q = ''; render(); els.q.focus(); });
const mobile = matchMedia('(max-width: 1023px)');
if (matchMedia('(max-width: 639px)').matches) els.q.placeholder = 'Kërko armën ose markën…';
function openPanel() {
  if (!mobile.matches) return;
  bar.panel.classList.add('is-open'); bar.scrim.hidden = false;
  requestAnimationFrame(() => bar.scrim.classList.add('is-on'));
  document.documentElement.classList.add('sheet-open');
  window.ppLenis?.stop();
}
function closePanel() {
  bar.panel.classList.remove('is-open'); bar.scrim.classList.remove('is-on');
  document.documentElement.classList.remove('sheet-open');
  window.ppLenis?.start();
  setTimeout(() => { bar.scrim.hidden = true; }, 350);
}
bar.open.addEventListener('click', openPanel);
document.querySelectorAll('[data-close-filters]').forEach((b) => b.addEventListener('click', closePanel));
bar.scrim.addEventListener('click', closePanel);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && bar.panel.classList.contains('is-open')) closePanel(); });
$('[data-reset-sheet]').addEventListener('click', () => { Object.assign(state, { brand: '', caliber: '', sort: '' }); els.sort.value = ''; render(); });
els.q.addEventListener('keydown', (e) => { if (e.key === 'Enter') els.q.blur(); });

let t;
els.q.addEventListener('input', () => { bar.clear.hidden = !els.q.value; clearTimeout(t); t = setTimeout(() => { state.q = els.q.value.trim(); render(); }, 160); });
els.brand.addEventListener('change', () => { state.brand = els.brand.value; render(); });
els.caliber.addEventListener('change', () => { state.caliber = els.caliber.value; render(); });
els.sort.addEventListener('change', () => { state.sort = els.sort.value; render(); });
document.querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', () => {
  Object.assign(state, { q: '', brand: '', caliber: '', sort: '' });
  els.q.value = ''; els.sort.value = '';
  render();
}));

// vija poshtë shiritit vetëm kur ai ngjitet lart
{
  const sb = $('[data-shopbar]');
  const sentinel = document.createElement('div');
  sb.before(sentinel);
  new IntersectionObserver(([e]) => sb.classList.toggle('is-stuck', !e.isIntersecting), { rootMargin: '-90px 0px 0px 0px' }).observe(sentinel);
}

// Në telefon paneli i filtrave jeton te <body> (që të mos ndikohet nga shiriti që lëviz); në desktop rri në rresht
{
  const row = $('.sb-row');
  const place = () => {
    if (mobile.matches) { if (bar.panel.parentElement !== document.body) document.body.append(bar.scrim, bar.panel); }
    else if (bar.panel.parentElement !== row) { closePanel(); row.append(bar.panel); }
  };
  place();
  mobile.addEventListener('change', place);
}
