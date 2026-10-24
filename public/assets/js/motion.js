// Lëvizja e faqes: scroll i butë, shfaqje gjatë scroll-it, parallax, butona magnetikë,
// ripple, kursori i shënjestrës, header i zgjuar, progresi dhe butoni "plumb" për lart.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const root = document.documentElement;

/* ───── Intro ───── */
const intro = $('[data-intro]');
if (intro && !root.classList.contains('no-intro')) {
  const done = () => { intro.classList.add('is-done'); setTimeout(() => intro.remove(), 900); };
  if (document.readyState === 'complete') setTimeout(done, 950);
  else addEventListener('load', () => setTimeout(done, 650), { once: true });
  setTimeout(done, 2600); // siguri: mos e mbaj kurrë më gjatë
} else intro?.remove();

/* ───── Scroll i butë (Lenis) ───── */
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new window.Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  // lidhjet e brendshme me # lëvizin butë
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    const t = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (!t) return;
    e.preventDefault();
    lenis.scrollTo(t, { offset: -90 });
  });
  // modalet dhe menyja ndalojnë scroll-in e faqes
  new MutationObserver(() => (document.body.classList.contains('nav-open') ? lenis.stop() : lenis.start())).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}
window.ppLenis = lenis;

/* ───── Ndarja e titujve në fjalë që ngrihen ───── */
function split(el) {
  if (el.dataset.splitDone) return;
  el.dataset.splitDone = '1';
  let i = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const w = document.createElement('span'); w.className = 'w';
          const inner = document.createElement('span'); inner.textContent = part; inner.style.setProperty('--i', i++);
          w.append(inner); frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.matches('svg, img, br')) walk(n);
    });
  };
  walk(el);
}

// Elementet që animohen automatikisht (pa pasur nevojë të shënohen në HTML)
const auto = () => {
  $$('main h1:not(.t-display):not([data-nosplit]), main h2').forEach((h) => { if (!h.closest('[data-hero], .member-card, .a-panel, .bubble')) h.setAttribute('data-split', ''); });
  $$('main .t-display:not([data-hero] .t-display)').forEach((h) => h.setAttribute('data-split', ''));
  $$('main img.object-cover').forEach((img) => {
    if (img.closest('[data-hero], .path-row, .cat-tile, [data-map], .g-item, .a-thumb, .absolute')) return;
    if (img.classList.contains('absolute') || img.hasAttribute('data-parallax')) return;
    img.setAttribute('data-unveil', '');
  });
  $$('main .who-card, main .step, main .rule, main .brand-cell, main .contact-line, main .faq details, main .spec-row, main .cat-tile, main .pcard, main .path-row').forEach((el) => {
    if (!el.closest('[data-hero]')) el.setAttribute('data-rise', '');
  });
  // vonesë e shkallëzuar brenda të njëjtit prind
  const groups = new Map();
  $$('[data-rise]').forEach((el) => { const p = el.parentElement; groups.set(p, (groups.get(p) || 0) + 1); el.style.setProperty('--i', Math.min(groups.get(p) - 1, 8)); });
  $$('[data-split]').forEach(split);
};

let io;
const proxies = new Map();
function observe(scope = document) {
  if (reduce || !('IntersectionObserver' in window)) { $$('[data-split],[data-rise],[data-unveil]', scope).forEach((e) => e.classList.add('is-in')); return; }
  // clip-path i fsheh elementin nga IntersectionObserver, prandaj vëzhgojmë prindin
  io = io || new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    (proxies.get(e.target) || [e.target]).forEach((t) => t.classList.add('is-in'));
    proxies.delete(e.target);
    io.unobserve(e.target);
  }), { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  $$('[data-split]:not(.is-in),[data-rise]:not(.is-in)', scope).forEach((e) => io.observe(e));
  $$('[data-unveil]:not(.is-in)', scope).forEach((e) => {
    const p = e.parentElement || e;
    if (!proxies.has(p)) proxies.set(p, []);
    if (!proxies.get(p).includes(e)) proxies.get(p).push(e);
    io.observe(p);
  });
}
auto();
observe();
// elementet që shtohen më vonë nga JS (produktet, galeria…)
new MutationObserver((muts) => {
  let any = false;
  muts.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.closest?.('main')) any = true; }));
  if (any) { requestAnimationFrame(() => { auto(); observe(); enhanceButtons(); }); }
}).observe($('main') || document.body, { childList: true, subtree: true });

/* ───── Scroll: header, progres, parallax, plumbi ───── */
const header = $('[data-header]');
const bar = $('[data-progress]');
const totop = $('[data-totop]');
const dock = $('[data-dock]');
const parallax = () => $$('[data-parallax]');
let lastY = 0;
let ticking = false;
function onScroll() {
  const y = lenis ? lenis.scroll : window.scrollY;
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const p = Math.min(1, Math.max(0, y / max));
  bar?.style.setProperty('--p', p.toFixed(4));
  totop?.style.setProperty('--p', p.toFixed(4));
  totop?.classList.toggle('is-on', y > 640);
  if (header && !document.body.classList.contains('nav-open')) {
    const down = y > lastY + 4;
    const up = y < lastY - 4;
    if (down && y > 260) header.classList.add('is-hidden');
    if (up || y < 120) header.classList.remove('is-hidden');
    root.classList.toggle('header-hidden', header.classList.contains('is-hidden'));
  }
  dock?.classList.toggle('is-compact', y > 380 && !dock.classList.contains('is-open'));
  if (!reduce) {
    parallax().forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) return;
      const speed = Number(el.dataset.parallax || 0.12);
      const center = r.top + r.height / 2 - innerHeight / 2;
      el.style.transform = `translate3d(0, ${(-center * speed).toFixed(1)}px, 0)`;
    });
  }
  lastY = y;
  ticking = false;
}
const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
if (lenis) lenis.on('scroll', req); else addEventListener('scroll', req, { passive: true });
addEventListener('resize', req);
onScroll();
// në fillim dock-u shfaq etiketën, pastaj ngjishet pak sekonda më vonë
setTimeout(() => { if (!dock?.classList.contains('is-open') && (lenis ? lenis.scroll : scrollY) > 380) dock?.classList.add('is-compact'); }, 4000);
if (dock && (lenis ? lenis.scroll : scrollY) < 380) dock.classList.remove('is-compact');

/* Plumbi qëllon lart */
totop?.addEventListener('click', () => {
  if (totop.classList.contains('is-fired')) return;
  totop.classList.add('is-fired');
  if (lenis) lenis.scrollTo(0, { duration: 1.6, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) });
  else window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  setTimeout(() => { totop.classList.remove('is-fired'); }, 1700);
  header?.classList.remove('is-hidden');
  root.classList.remove('header-hidden');
});

/* ───── Butonat: tekst që rrotullohet, ripple, magnet ───── */
function enhanceButtons() {
  $$('.btn:not([data-roll])').forEach((b) => {
    b.dataset.roll = '1';
    const textNodes = [...b.childNodes].filter((n) => (n.nodeType === 3 && n.textContent.trim()) || (n.nodeType === 1 && n.matches('span:not(.btn-roll)')));
    if (textNodes.length !== 1) return;
    const label = textNodes[0].textContent.trim();
    const roll = document.createElement('span');
    roll.className = 'btn-roll';
    roll.innerHTML = '<span></span><span aria-hidden="true"></span>';
    roll.children[0].textContent = label; roll.children[1].textContent = label;
    if (textNodes[0].nodeType === 1) { textNodes[0].replaceChildren(roll); } else textNodes[0].replaceWith(roll);
  });
  if (fine && !reduce) {
    $$('.btn:not([data-magnetic]), .path-go:not([data-magnetic]), .dock-btn:not([data-magnetic])').forEach((b) => {
      b.dataset.magnetic = '1';
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.22;
        const y = (e.clientY - r.top - r.height / 2) * 0.32;
        b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }
}
enhanceButtons();
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.btn, .chip, .quick button, .dock-btn');
  if (!b || reduce) return;
  const r = b.getBoundingClientRect();
  const s = document.createElement('span');
  s.className = 'ripple';
  s.style.left = `${e.clientX - r.left}px`;
  s.style.top = `${e.clientY - r.top}px`;
  s.style.setProperty('--s', String(Math.ceil(Math.hypot(r.width, r.height) / 6)));
  if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
  b.style.overflow = 'hidden';
  b.append(s);
  setTimeout(() => s.remove(), 750);
});

/* ───── Kursori i shënjestrës ───── */
if (fine && !reduce) {
  const ring = $('.cursor');
  const dot = $('.cursor-dot');
  if (ring && dot) {
    let mx = -100, my = -100, rx = -100, ry = -100;
    addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      ring.classList.add('is-on'); dot.classList.add('is-on');
      const t = e.target.closest?.('a, button, [role="button"], input, select, textarea, label.check, .g-item');
      ring.classList.toggle('is-link', Boolean(t));
    }, { passive: true });
    addEventListener('pointerdown', () => ring.classList.add('is-down'));
    addEventListener('pointerup', () => ring.classList.remove('is-down'));
    document.addEventListener('pointerleave', () => { ring.classList.remove('is-on'); dot.classList.remove('is-on'); });
    const loop = () => {
      rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
      ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
      requestAnimationFrame(loop);
    };
    loop();
  }
}

export { lenis };
