import { getProduct, getProducts, getCategories, mediaUrl } from '../data.js';
import { esc, priceLabel, productCard, whatsappLink } from '../ui.js';
import { getSettings } from '../data.js';

const slug = new URLSearchParams(location.search).get('p');
const box = document.querySelector('[data-product]');
const missing = document.querySelector('[data-missing]');
const crumb = document.querySelector('[data-crumb]');

function setMeta(p, cat) {
  document.title = `${p.name} — Dyqani | Poligoni Patriot`;
  const d = `${p.name}${p.caliber ? `, kalibri ${p.caliber}` : ''}${p.brand ? ` nga ${p.brand}` : ''}. Në dyqanin e Poligonit Patriot në Gjakovë.`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', d);
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', `${location.origin}/dyqani/produkt/?p=${encodeURIComponent(p.slug)}`);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
    image: (p.images || []).map((i) => new URL(mediaUrl(i), location.origin).href), category: cat?.name, description: p.description || d,
  };
  if (p.price != null && p.show_price !== false) ld.offers = { '@type': 'Offer', price: p.price, priceCurrency: 'EUR', availability: p.in_stock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStoreOnly' };
  const s = document.createElement('script'); s.type = 'application/ld+json'; s.textContent = JSON.stringify(ld); document.head.appendChild(s);
}

function render(p, cat, settings) {
  const imgs = (p.images || []).map(mediaUrl);
  const specs = [
    ['Marka', p.brand], ['Kategoria', cat?.name], ['Kalibri', p.caliber], ['Karikatori', p.capacity ? `${p.capacity} fishekë` : null],
    ['Gjatësia e tytës', p.barrel_length], ['Pesha', p.weight], ['Mekanizmi', p.action], ['Origjina', p.origin],
  ].filter(([, v]) => v);
  const msg = `Përshëndetje, jam i interesuar për ${p.name}. A është në dispozicion dhe sa kushton?\n${location.href}`;
  const tel = (settings.phone || '+38349394850').replace(/\s/g, '');

  box.innerHTML = `
    <div class="lg:col-span-7 grid gap-3">
      <div class="pcard-media !aspect-[4/3] cursor-zoom-in" data-main>
        ${imgs[0] ? `<img src="${esc(imgs[0])}" alt="${esc(p.name)}" fetchpriority="high">` : ''}
      </div>
      ${imgs.length > 1 ? `<div class="grid grid-cols-4 sm:grid-cols-5 gap-3" role="list" aria-label="Fotot e produktit">
        ${imgs.map((src, i) => `<button type="button" role="listitem" class="pcard-media !aspect-square ring-2 ${i ? 'ring-transparent' : 'ring-bone'}" data-thumb="${i}" aria-label="Foto ${i + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}
      </div>` : ''}
    </div>
    <div class="lg:col-span-5 content-start grid gap-6">
      <div>
        <p class="text-steel-400">${esc(p.brand || '')}</p>
        <h1 class="t-h1 mt-2">${esc(p.name)}</h1>
        <p class="mt-5 flex flex-wrap items-center gap-3">
          <span class="t-spec text-2xl font-semibold">${esc(priceLabel(p))}</span>
          <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${p.in_stock === false ? 'bg-steel-800 text-steel-300' : 'bg-white/10 text-bone'}">${p.in_stock === false ? 'Pa stok momentalisht' : 'Në dispozicion'}</span>
        </p>
      </div>
      ${specs.length ? `<dl class="border-t border-steel-800">${specs.map(([k, v]) => `<div class="spec-row"><dt>${esc(k)}</dt><dd class="${/Kalibri|Karikatori|Pesha|Gjatësia/.test(k) ? 't-spec' : ''}">${esc(v)}</dd></div>`).join('')}</dl>` : ''}
      ${p.description ? `<div class="prose-pp">${esc(p.description).split(/\n{2,}/).map((x) => `<p>${x.replace(/\n/g, '<br>')}</p>`).join('')}</div>` : ''}
      <div class="grid sm:grid-cols-2 gap-3">
        <a class="btn btn-primary" href="${esc(whatsappLink(msg, settings.whatsapp))}" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-whatsapp"/></svg>Pyet në WhatsApp</a>
        <a class="btn btn-ghost" href="tel:${esc(tel)}"><svg aria-hidden="true"><use href="#i-phone"/></svg>Telefono</a>
      </div>
      <div class="rounded-lg border border-steel-800 p-5 text-sm text-steel-300 flex gap-3">
        <svg class="size-5 flex-none text-patriot mt-0.5" aria-hidden="true"><use href="#i-shield"/></svg>
        <p>Shitja bëhet vetëm për persona që plotësojnë kushtet e Ligjit për armët. Pa leje ende? <a class="link-u text-bone" href="/trajnimet-certifikimet/">Filloni me certifikimin</a>.</p>
      </div>
    </div>`;

  const main = box.querySelector('[data-main] img');
  box.querySelectorAll('[data-thumb]').forEach((b) => b.addEventListener('click', () => {
    main.src = imgs[Number(b.dataset.thumb)];
    box.querySelectorAll('[data-thumb]').forEach((x) => x.classList.replace('ring-bone', 'ring-transparent'));
    b.classList.replace('ring-transparent', 'ring-bone');
  }));
  let current = 0;
  box.querySelectorAll('[data-thumb]').forEach((b) => b.addEventListener('click', () => { current = Number(b.dataset.thumb); }));
  const mainBox = box.querySelector('[data-main]');
  if (main && mainBox) {
    mainBox.setAttribute('role', 'button');
    mainBox.setAttribute('tabindex', '0');
    mainBox.setAttribute('aria-label', `Zmadho foton e ${p.name}`);
    const show = () => openViewer(imgs, current, p.name);
    mainBox.addEventListener('click', show);
    mainBox.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); } });
  }
}

/* Shikuesi i fotos: hapet mbi faqe dhe mbyllet me X, Escape, klikim jashtë ose rrëshqitje poshtë */
function openViewer(imgs, start, name) {
  let i = start;
  const d = document.createElement('dialog');
  d.className = 'pv';
  d.setAttribute('aria-label', `Fotot e ${name}`);
  d.setAttribute('data-lenis-prevent', '');
  const many = imgs.length > 1;
  d.innerHTML = `
    <div class="pv-stage" data-stage>
      <img src="${esc(imgs[i])}" alt="${esc(name)}" data-img>
    </div>
    <div class="pv-bar">
      <span class="pv-name">${esc(name)}</span>
      ${many ? `<span class="pv-count" data-count>${i + 1} / ${imgs.length}</span>` : ''}
    </div>
    <button type="button" class="pv-close" aria-label="Mbyll" data-close><svg aria-hidden="true"><use href="#i-close"/></svg></button>
    ${many ? `<button type="button" class="pv-nav pv-prev" aria-label="Foto e mëparshme" data-prev><svg aria-hidden="true"><use href="#i-arrow"/></svg></button>
    <button type="button" class="pv-nav pv-next" aria-label="Foto tjetër" data-next><svg aria-hidden="true"><use href="#i-arrow"/></svg></button>` : ''}`;
  document.body.append(d);
  const img = d.querySelector('[data-img]');
  const go = (n) => {
    if (!many) return;
    i = (n + imgs.length) % imgs.length;
    img.classList.add('is-swap');
    setTimeout(() => { img.src = imgs[i]; img.classList.remove('is-swap'); d.querySelector('[data-count]').textContent = `${i + 1} / ${imgs.length}`; }, 160);
  };
  const close = () => {
    if (d.classList.contains('is-closing')) return;
    d.classList.add('is-closing');
    setTimeout(() => { d.close(); d.remove(); window.ppLenis?.start(); document.documentElement.classList.remove('pv-open'); }, 280);
  };
  d.querySelector('[data-close]').addEventListener('click', close);
  d.querySelector('[data-prev]')?.addEventListener('click', () => go(i - 1));
  d.querySelector('[data-next]')?.addEventListener('click', () => go(i + 1));
  d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  d.addEventListener('click', (e) => { if (e.target === d || e.target.hasAttribute('data-stage')) close(); });
  d.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') go(i - 1); if (e.key === 'ArrowRight') go(i + 1); });
  // rrëshqitje me gisht: majtas/djathtas ndërron foton, poshtë mbyll
  let sx = 0, sy = 0;
  d.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  d.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? i + 1 : i - 1);
    else if (dy > 80) close();
  });
  window.ppLenis?.stop();
  document.documentElement.classList.add('pv-open');
  d.showModal();
  d.querySelector('[data-close]').focus({ preventScroll: true });
}

async function init() {
  if (!slug) { box.classList.add('hidden'); missing.classList.remove('hidden'); crumb.textContent = 'Produkti'; return; }
  const [p, cats, settings] = await Promise.all([getProduct(slug), getCategories(), getSettings()]);
  if (!p) { box.classList.add('hidden'); missing.classList.remove('hidden'); crumb.textContent = 'Nuk u gjet'; document.title = 'Produkti nuk u gjet — Poligoni Patriot'; return; }
  const cat = cats.find((c) => c.slug === p.category_slug);
  crumb.textContent = p.name;
  render(p, cat, settings);
  setMeta(p, cat);

  const all = await getProducts({ category: p.category_slug });
  const related = all.filter((x) => x.slug !== p.slug).sort((a, b) => (b.brand === p.brand) - (a.brand === p.brand)).slice(0, 4);
  if (related.length) {
    document.querySelector('[data-related]').innerHTML = related.map((x) => productCard(x)).join('');
    document.querySelector('[data-related-wrap]').classList.remove('hidden');
  }
}
init().catch((e) => { console.error(e); box.classList.add('hidden'); missing.classList.remove('hidden'); });

/* Butoni X: kthehet aty ku ishte vizitori (dyqani me filtrat e tij), ose te dyqani */
const closeBtn = document.querySelector('[data-pd-close]');
if (closeBtn) {
  const fromSite = document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1;
  const leave = (e) => {
    e?.preventDefault();
    if (fromSite) history.back(); else location.href = '/dyqani/';
  };
  closeBtn.addEventListener('click', leave);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.querySelector('dialog[open]') && !document.querySelector('[data-dock].is-open')) leave(e);
  });
}
