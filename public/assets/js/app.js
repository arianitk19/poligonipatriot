// Sjellja e përbashkët e faqes: koka, menytë, orari "hapur tani", njoftimet.
import { getSettings, DEFAULT_SETTINGS } from './data.js';
import { CONFIG } from './config.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* Koka bëhet e mbyllët pasi fillon lëvizja */
const header = $('[data-header]');
if (header) {
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ───── Desktop: panelet "mega" ───── */
const menus = $$('[data-menu]');
const scrim = $('[data-scrim]');
let openMenu = null;
let closeTimer = null;

function setPanel(m, on, swap = false) {
  const btn = $('button', m);
  const panel = $('.mega', m);
  btn.setAttribute('aria-expanded', String(on));
  panel.classList.toggle('is-swap', on && swap);
  panel.classList.toggle('is-open', on);
  panel.inert = !on;
}
function openMega(m) {
  clearTimeout(closeTimer);
  if (openMenu === m) return;
  const swap = Boolean(openMenu);
  if (openMenu) setPanel(openMenu, false);
  setPanel(m, true, swap);
  openMenu = m;
  header?.classList.add('is-mega');
  scrim?.classList.add('is-on');
}
function closeMega(delay = 0) {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    if (!openMenu) return;
    setPanel(openMenu, false);
    openMenu = null;
    header?.classList.remove('is-mega');
    scrim?.classList.remove('is-on');
  }, delay);
}

menus.forEach((m) => {
  const btn = $('button', m);
  const panel = $('.mega', m);
  btn.addEventListener('click', () => (openMenu === m ? closeMega() : openMega(m)));
  if (matchMedia('(hover: hover)').matches) {
    let enterTimer;
    m.addEventListener('pointerenter', () => { clearTimeout(closeTimer); enterTimer = setTimeout(() => openMega(m), openMenu ? 0 : 70); });
    m.addEventListener('pointerleave', () => { clearTimeout(enterTimer); closeMega(220); });
  }
  m.addEventListener('focusout', (e) => { if (!m.contains(e.relatedTarget)) closeMega(120); });
  m.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openMenu === m) { closeMega(); btn.focus(); }
    if (e.key === 'ArrowDown' && e.target === btn) { e.preventDefault(); openMega(m); setTimeout(() => $('.mega-link', panel)?.focus(), 60); }
  });

  // pamja paraprake ndryshon sipas lidhjes ku ndodhet kursori
  const imgs = $$('.mega-media img', panel);
  const cap = $('[data-media-caption]', panel);
  const links = $$('.mega-link', panel);
  const show = (i) => {
    links.forEach((l, k) => l.classList.toggle('is-active', k === i));
    imgs.forEach((im, k) => im.classList.toggle('is-active', k === i));
    if (cap && imgs[i]) {
      cap.classList.add('is-swap');
      setTimeout(() => { cap.textContent = imgs[i].dataset.caption || ''; cap.classList.remove('is-swap'); }, 160);
    }
  };
  links.forEach((l, i) => { l.addEventListener('pointerenter', () => show(i)); l.addEventListener('focus', () => show(i)); });
  panel.addEventListener('pointerleave', () => links.forEach((l) => l.classList.remove('is-active')));
});
scrim?.addEventListener('click', () => closeMega());
document.addEventListener('click', (e) => { if (openMenu && !e.target.closest('[data-menu]')) closeMega(); });
addEventListener('scroll', () => { if (openMenu) closeMega(); }, { passive: true });

/* ───── Celular: menyja në ekran të plotë ───── */
const burger = $('[data-burger]');
const mnav = $('#mobile-nav');
if (burger && mnav) {
  let hideTimer;
  const set = (on) => {
    clearTimeout(hideTimer);
    const r = burger.getBoundingClientRect();
    mnav.style.setProperty('--ox', `${r.left + r.width / 2}px`);
    mnav.style.setProperty('--oy', `${r.top + r.height / 2}px`);
    burger.setAttribute('aria-expanded', String(on));
    burger.setAttribute('aria-label', on ? 'Mbyll menynë' : 'Hap menynë');
    if (on) {
      mnav.hidden = false;
      mnav.scrollTop = 0;
      document.body.classList.add('nav-open');
      requestAnimationFrame(() => requestAnimationFrame(() => mnav.classList.add('is-open')));
    } else {
      mnav.classList.remove('is-open');
      document.body.classList.remove('nav-open');
      hideTimer = setTimeout(() => {
        mnav.hidden = true;
        $$('[data-acc]', mnav).forEach((b) => b.setAttribute('aria-expanded', 'false'));
      }, 850);
    }
  };
  burger.addEventListener('click', () => set(!mnav.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mnav.classList.contains('is-open')) { set(false); burger.focus(); } });
  matchMedia('(min-width: 80rem)').addEventListener('change', (e) => e.matches && set(false));
  // seksionet që hapen (Shërbimet, Rreth nesh): hapet vetëm njëri
  $$('[data-acc]', mnav).forEach((b) => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-expanded') !== 'true';
    $$('[data-acc]', mnav).forEach((x) => x.setAttribute('aria-expanded', 'false'));
    b.setAttribute('aria-expanded', String(on));
  }));
  // hap automatikisht grupin e faqes ku ndodhemi
  const clean = (p) => p.replace(/index\.html$/, '');
  const here = clean(location.pathname);
  $$('.m-panel a', mnav).forEach((a) => {
    if (clean(a.pathname) === here) { a.setAttribute('aria-current', 'page'); a.closest('li').querySelector('[data-acc]')?.setAttribute('data-here', ''); }
  });
  burger.addEventListener('click', () => {
    const h = $('[data-acc][data-here]', mnav);
    if (h && mnav.classList.contains('is-open')) h.setAttribute('aria-expanded', 'true');
  });
  // klikimi i një lidhjeje mbyll menynë butë
  mnav.addEventListener('click', (e) => { if (e.target.closest('a:not([target])')) { mnav.classList.remove('is-open'); document.body.classList.remove('nav-open'); } });
}

/* Ora në Kosovë, pavarësisht zonës kohore të vizitorit */
function kosovoNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: CONFIG.site.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}
const fmtHour = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
/** Statusi sipas orarit, në kohën e Kosovës.
 *  Kthen { open, label, state, meta, time, progress } — progress (0–1) vetëm kur është hapur. */
export function openStatus(hours) {
  const { day, minutes } = kosovoNow();
  const today = hours[day];
  if (today && minutes >= today[0] * 60 && minutes < today[1] * 60) {
    const progress = (minutes - today[0] * 60) / ((today[1] - today[0]) * 60);
    return { open: true, state: 'Hapur tani', meta: 'Mbyllet në', time: fmtHour(today[1]), progress, label: `Hapur tani · mbyllet në ${fmtHour(today[1])}` };
  }
  if (today && minutes < today[0] * 60) {
    return { open: false, state: 'Mbyllur', meta: 'Hapet sot në', time: fmtHour(today[0]), progress: 0, label: `Mbyllur tani · hapet sot në ${fmtHour(today[0])}` };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (hours[d]) {
      const name = i === 1 ? 'nesër' : ['të dielën', 'të hënën', 'të martën', 'të mërkurën', 'të enjten', 'të premten', 'të shtunën'][d];
      return { open: false, state: 'Mbyllur', meta: `Hapet ${name} në`, time: fmtHour(hours[d][0]), progress: 0, label: `Mbyllur tani · hapet ${name} në ${fmtHour(hours[d][0])}` };
    }
  }
  return { open: false, state: 'Mbyllur', meta: '', time: '', progress: 0, label: 'Mbyllur' };
}

/* Statusi në hero: hapur/mbyllur, ora e radhës dhe sa ka kaluar nga orari i ditës */
function renderStatusChip(hours) {
  const st = openStatus(hours);
  $$('[data-status-chip]').forEach((el) => {
    el.dataset.state = st.open ? 'open' : 'closed';
    $('[data-sc-state]', el).textContent = st.state;
    $('[data-sc-meta]', el).innerHTML = st.time ? `${st.meta} <b>${st.time}</b>` : '';
    const bar = $('[data-sc-bar]', el);
    if (bar) bar.style.setProperty('--p', st.open ? st.progress.toFixed(3) : 0);
    el.setAttribute('aria-label', st.label);
  });
}
let chipHours = DEFAULT_SETTINGS.hours;
if ($('[data-status-chip]')) {
  renderStatusChip(chipHours);
  setInterval(() => renderStatusChip(chipHours), 30000);
}

/* Të dhënat e kontaktit dhe njoftimi nga paneli admin */
getSettings().then((s) => {
  $$('[data-setting]').forEach((el) => { const v = s[el.dataset.setting]; if (v) el.textContent = v; });
  $$('[data-setting-href]').forEach((el) => {
    const k = el.dataset.settingHref;
    if (k === 'phone' && s.phone) el.href = `tel:${s.phone.replace(/\s/g, '')}`;
    if (k === 'whatsapp' && s.whatsapp) el.href = el.href.replace(/wa\.me\/\d+/, `wa.me/${s.whatsapp}`);
    if (k === 'email' && s.email) el.href = `mailto:${s.email}`;
  });
  const st = openStatus(s.hours);
  $$('[data-open-status]').forEach((el) => {
    el.innerHTML = `<span class="open-dot${st.open ? ' is-open' : ''}" style="background:${st.open ? '#fff' : 'var(--color-steel-600)'}"></span>${st.label}`;
  });
  chipHours = s.hours; renderStatusChip(chipHours);
  const a = s.announcement;
  const bar = $('#announce');
  if (bar && a?.text) {
    $('[data-announce-text]', bar).textContent = a.text;
    if (a.link) { const l = $('[data-announce-link]', bar); l.href = a.link; l.textContent = a.linkText || 'Më shumë'; l.classList.remove('hidden'); }
    bar.classList.remove('hidden');
  }
});

/* Shfaqje e butë për elementet .reveal */
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' })
  : null;
export function observeReveal(root = document) {
  $$('.reveal:not(.is-in)', root).forEach((el) => (io ? io.observe(el) : el.classList.add('is-in')));
}
observeReveal();

/* Njoftim i shkurtër në fund të ekranit */
let toastTimer;
export function toast(msg, ms = 3200) {
  const t = $('[data-toast]');
  if (!t) return;
  $('[data-toast-text]', t).textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), ms);
}

/* Video të heshtura që luhen vetëm kur janë në ekran (kursen bateri) */
$$('video[data-autoplay]').forEach((v) => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const vio = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.2 });
  vio.observe(v);
});

/* Harta ngarkohet vetëm me klik (privatësi + shpejtësi) */
$$('[data-map]').forEach((box) => {
  const btn = $('[data-map-load]', box);
  btn?.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = 'https://www.google.com/maps?q=42.36872,20.45724&z=15&hl=sq&output=embed';
    f.title = 'Harta: Poligoni Patriot, Magjistralja Gjakovë–Prizren km 2';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    f.className = 'absolute inset-0 size-full border-0';
    f.style.filter = 'grayscale(1) invert(.92) contrast(.9)';
    box.replaceChildren(f);
  });
});

/* Butoni i zërit në videot me audio */
$$('[data-sound-video]').forEach((box) => {
  const v = $('video', box);
  const b = $('[data-sound-toggle]', box);
  b?.addEventListener('click', () => {
    v.muted = !v.muted;
    if (!v.muted) { v.currentTime = 0; v.play().catch(() => {}); }
    b.setAttribute('aria-label', v.muted ? 'Aktivizo zërin' : 'Çaktivizo zërin');
    $('use', b).setAttribute('href', v.muted ? '#i-mute' : '#i-sound');
  });
});

/* Foto që ndjek kursorin në rreshtat e shërbimeve */
document.querySelectorAll('.path-row').forEach((row) => {
  row.addEventListener('pointermove', (e) => {
    const r = row.getBoundingClientRect();
    row.style.setProperty('--mx', `${Math.min(Math.max(e.clientX - r.left, 160), r.width - 160)}px`);
  });
});

/* Animacionet e pafundme (ilustrime, shirita) ndalen kur dalin nga ekrani */
if ('IntersectionObserver' in window) {
  const io2 = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('is-offscreen', !e.isIntersecting)), { rootMargin: '120px 0px' });
  $$('.range-art, .cert-art, .std-strip, .ribbon, .marquee, .hero-art, .mnav-rings').forEach((el) => io2.observe(el));
}
