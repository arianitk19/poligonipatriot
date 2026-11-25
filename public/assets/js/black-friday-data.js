// ─────────────────────────────────────────────────────────────
//  BLACK FRIDAY 2026 — të dhënat e ofertës
//  Çmimet dhe të dhënat ndryshohen vetëm këtu.
//  Oferta shfaqet automatikisht deri më 05.12.2026 23:59 (ora e Kosovës)
//  dhe pas kësaj zhduket vetë nga faqja.
//  `slug` = produkti përkatës në dyqan (nëse ekziston), që aty të
//  shfaqet edhe çmimi Black Friday.
// ─────────────────────────────────────────────────────────────
export const BF_END = '2026-12-05T23:59:59+01:00';
export const BF_END_LABEL = '05.12.2026';

const IMG = '/assets/img/black-friday/';

export const BF_ITEMS = [
  { id: 'radikal-rpx9', type: 'pistolete', brand: 'Radikal', model: 'RPX9', img: `${IMG}radikal-rpx9.webp`,
    specs: [['Kalibri', '9×19 mm'], ['Magazina', '15']], old: 700, price: 580, slug: 'radikal-rpx9' },
  { id: 'brg9-tactical', type: 'pistolete', brand: 'BRG', model: 'BRG9 Tactical', img: `${IMG}brg9-tactical.webp`,
    specs: [['Kalibri', '9×19 mm'], ['Magazina', '20'], ['Kategoria', 'B1']], old: 1000, price: 850 },
  { id: 'balistik-defence-adam-9s', type: 'pistolete', brand: 'Balistik Defence', model: 'Adam 9S', img: `${IMG}balistik-defence-adam-9s.webp`,
    specs: [['Kalibri', '9×19 mm'], ['Magazina', '10'], ['Kategoria', 'B1']], old: 1200, price: 900 },
  { id: 'balistik-defence-adam-45s', type: 'pistolete', brand: 'Balistik Defence', model: 'Adam 45 S', tag: 'Krom', img: `${IMG}balistik-defence-adam-45s.webp`,
    specs: [['Kalibri', '.45 ACP'], ['Magazina', '8'], ['Kategoria', 'B1']], old: 1400, price: 1000, slug: 'balistik-defence-adam-45s' },
  { id: 'tt-tokarev-33', type: 'pistolete', brand: 'TT', model: 'Tokarev 33', img: `${IMG}tt-tokarev-33.webp`,
    specs: [['Kalibri', '7.62×25 mm'], ['Magazina', '8'], ['Kategoria', 'B1']], old: 1100, price: 800 },
  { id: 'radikal-pa-5', type: 'pa-vijaska', brand: 'Radikal', model: 'PA-5', img: `${IMG}radikal-pa-5.webp`,
    specs: [['Kalibri', '12GA'], ['Magazina', '4+1'], ['Kategoria', 'B6']], old: 600, price: 350, slug: 'radikal-pa-5' },
  { id: 'radikal-p-3', type: 'pa-vijaska', brand: 'Radikal', model: 'P-3', img: `${IMG}radikal-p-3.webp`,
    specs: [['Kalibri', '12GA'], ['Magazina', '4+1'], ['Kategoria', 'B6']], old: 500, price: 250, slug: 'radikal-p-3' },
  { id: 'radikal-mkx-1', type: 'pa-vijaska', brand: 'Radikal', model: 'MKX-1', img: `${IMG}radikal-mkx-1.webp`,
    specs: [['Kalibri', '12GA'], ['Magazina', '6+1'], ['Kategoria', 'B6']], old: 700, price: 500, slug: 'radikal-mkx-1-bardhe' },
  { id: 'radikal-sax-1', type: 'pa-vijaska', brand: 'Radikal', model: 'SAX-1', img: `${IMG}radikal-sax-1.webp`,
    specs: [['Kalibri', '12GA'], ['Magazina', '4+1'], ['Kategoria', 'B5']], old: 700, price: 580, slug: 'radikal-sax-1-kamuflazh' },
  { id: 'radikal-sax-2', type: 'pa-vijaska', brand: 'Radikal', model: 'SAX-2', img: `${IMG}radikal-sax-2.webp`,
    specs: [['Kalibri', '12GA'], ['Magazina', '6+1'], ['Kategoria', 'B5']], old: 750, price: 600, slug: 'radikal-sax-2' },
  { id: 'radikal-gk2', type: 'pa-vijaska', brand: 'Radikal', model: 'GK-2', img: `${IMG}radikal-gk2.webp`,
    specs: [['Kalibri', '12GA'], ['Magazina', '2'], ['Kategoria', 'C1']], old: 850, price: 680, slug: 'radikal-gk2' },
].map((it) => ({ ...it, pct: Math.floor(((it.old - it.price) / it.old) * 100), save: it.old - it.price }));

export const BF_TYPES = { pistolete: 'Pistoleta', 'pa-vijaska': 'Armë pa vijaska' };
export const BF_MAX_PCT = Math.max(...BF_ITEMS.map((i) => i.pct));

const END_MS = Date.parse(BF_END);
export const bfActive = (now = Date.now()) => now <= END_MS;
export const bfRemaining = (now = Date.now()) => Math.max(0, END_MS - now);

/** Oferta për një produkt të dyqanit (sipas slug-ut), vetëm sa është aktive. */
export function bfDeal(slug) {
  if (!slug || !bfActive()) return null;
  return BF_ITEMS.find((i) => i.slug === slug) || null;
}

export const bfName = (it) => `${it.brand} ${it.model}`;
export const eur = (n) => `${new Intl.NumberFormat('de-DE').format(n)} €`;

/** Numëruesi: mbush elementet [data-d] [data-h] [data-m] [data-s] (ose një [data-left] të shkurtër). */
export function startCountdown(root, onEnd) {
  if (!root) return;
  const pad = (n) => String(n).padStart(2, '0');
  const q = (k) => root.querySelector(`[data-${k}]`);
  const tick = () => {
    const ms = bfRemaining();
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (q('d')) q('d').textContent = pad(d);
    if (q('h')) q('h').textContent = pad(h);
    if (q('m')) q('m').textContent = pad(m);
    if (q('s')) q('s').textContent = pad(sec);
    if (q('left')) q('left').textContent = d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
    if (ms <= 0) { clearInterval(t); onEnd?.(); }
  };
  const t = setInterval(tick, 1000);
  tick();
}
