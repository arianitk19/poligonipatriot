// Asistenti virtual i Poligonit Patriot (në këndin e poshtëm).
// Përgjigjet menjëherë nga informacionet e faqes; për çdo gjë tjetër e kalon bisedën te stafi në WhatsApp.
import { getSettings, getProducts } from './data.js';
import { openStatus } from './app.js';
import { answer, productChip } from './assistant.js';
import { esc } from './ui.js';

const dock = document.querySelector('[data-dock]');
if (dock) {
  const btn = dock.querySelector('[data-dock-btn]');
  const card = dock.querySelector('#wa-card');
  const body = dock.querySelector('[data-dock-body]');
  const form = dock.querySelector('[data-dock-form]');
  const statusEl = dock.querySelector('[data-dock-status]');
  const sub = dock.querySelector('[data-dock-sub]');
  const waLinks = dock.querySelectorAll('[data-dock-wa]');
  const KEY = 'pp:chat';
  let settings = null;
  let started = false;
  let busy = false;
  let lastQuestion = '';
  let productsPromise = null;
  const products = () => (productsPromise ||= getProducts().catch(() => []));

  const TOPICS = [
    ['Orari & adresa', 'Cili është orari dhe ku gjendeni?'],
    ['Si të certifikohem', 'Si të certifikohem për armë?'],
    ['Poligoni', 'Si funksionon poligoni?'],
    ['Anëtarësimi', 'Si bëhem anëtar?'],
    ['Armët në dyqan', 'Çfarë armësh keni në dyqan?'],
    ['Servisi', 'A bëni servis dhe riparim armësh?'],
  ];

  const waNumber = () => settings?.whatsapp || '38349394850';
  const waHref = (text) => {
    const page = location.pathname.startsWith('/dyqani/produkt') ? `\n${location.href}` : '';
    return `https://wa.me/${waNumber()}?text=${encodeURIComponent((text || 'Përshëndetje, kam një pyetje.') + page)}`;
  };
  const now = () => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Belgrade' }).format(new Date());
  const scrollDown = () => requestAnimationFrame(() => body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' }));

  const history = {
    read() { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch { return []; } },
    push(q) { try { const h = this.read(); h.push(q); sessionStorage.setItem(KEY, JSON.stringify(h.slice(-12))); } catch { /* pa storage */ } },
  };

  getSettings().then((s) => {
    settings = s;
    const st = openStatus(s.hours);
    dock.querySelector('.dock-ico').style.setProperty('--dot', st.open ? '#ffffff' : '#8d8d93');
    statusEl.innerHTML = `<i class="dock-live${st.open ? ' is-open' : ''}"></i>${st.open ? 'Online · përgjigje menjëherë' : 'Asistenti online · stafi hapet ' + esc(st.meta.replace(/^Hapet /, '').replace(/ në$/, '')) + ' në ' + st.time}`;
    sub.textContent = st.open ? 'Asistenti · online' : 'Asistenti virtual';
  });

  function bubble(html, who = 'bot', extra = '') {
    const el = document.createElement('div');
    el.className = `msg msg-${who}`;
    el.innerHTML = `<div class="bubble${who === 'me' ? ' is-me' : ''}">${html}</div>${extra}`;
    body.append(el);
    scrollDown();
    return el;
  }
  const chipsHtml = () => `<div class="quick" role="list">${TOPICS.map(([l], i) => `<button type="button" role="listitem" data-topic="${i}">${l}</button>`).join('')}</div>`;
  const actionsHtml = (actions = []) => (actions.length ? `<div class="msg-actions">${actions.map((a, i) => {
    if (a.wa) return `<a class="msg-act is-wa" href="${esc(waHref(a.text || lastQuestion))}" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-whatsapp"/></svg>${esc(a.label)}</a>`;
    if (a.ask) return `<button type="button" class="msg-act" data-ask="${esc(a.ask)}">${esc(a.label)}</button>`;
    const ext = /^https?:/.test(a.href);
    return `<a class="msg-act${i === 0 ? ' is-primary' : ''}" href="${esc(a.href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${esc(a.label)}<svg aria-hidden="true"><use href="#i-arrow"/></svg></a>`;
  }).join('')}</div>` : '');

  async function reply(question, { instant = false } = {}) {
    const res = await answer(question, { settings: settings || (await getSettings()), products });
    let prods = res.products || [];
    if (res.featured) prods = (await products()).filter((p) => p.featured).slice(0, 3);
    const extra = (prods.length ? `<div class="chat-prods">${prods.map(productChip).join('')}</div>` : '')
      + actionsHtml(res.actions) + (res.chips ? chipsHtml() : '');
    if (!instant) {
      const typing = document.createElement('div');
      typing.className = 'typing';
      typing.setAttribute('aria-label', 'Duke shkruar');
      typing.innerHTML = '<i></i><i></i><i></i>';
      body.append(typing);
      scrollDown();
      await new Promise((r) => setTimeout(r, 420 + Math.min(900, res.text.length * 2.2)));
      typing.remove();
    }
    bubble(res.text, 'bot', extra);
  }

  async function ask(q, { save = true, instant = false } = {}) {
    if (busy && !instant) return;
    busy = true;
    lastQuestion = q;
    bubble(esc(q), 'me');
    if (save) history.push(q);
    try { await reply(q, { instant }); } finally { busy = false; }
  }

  async function start() {
    if (started) return;
    started = true;
    const past = history.read();
    const welcome = `<b>Përshëndetje!</b> Jam asistenti virtual i Poligonit Patriot. Ju përgjigjem menjëherë për orarin, trajnimet dhe certifikimin, poligonin, anëtarësimin dhe armët në dyqan.<time>${now()}</time>`;
    if (past.length) {
      bubble(welcome);
      for (const q of past) await ask(q, { save: false, instant: true });
      return;
    }
    body.innerHTML = '<div class="typing" aria-label="Duke shkruar"><i></i><i></i><i></i></div>';
    await new Promise((r) => setTimeout(r, 650));
    body.innerHTML = '';
    bubble(welcome, 'bot', chipsHtml());
  }

  const open = () => {
    card.hidden = false;
    dock.classList.add('is-open');
    dock.classList.remove('is-compact');
    btn.setAttribute('aria-expanded', 'true');
    start();
    if (matchMedia('(hover: hover)').matches) setTimeout(() => form.msg.focus({ preventScroll: true }), 60);
  };
  const close = () => {
    card.hidden = true;
    dock.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  };

  btn.addEventListener('click', () => (card.hidden ? open() : close()));
  dock.querySelector('[data-dock-close]').addEventListener('click', () => { close(); btn.focus(); });
  waLinks.forEach((l) => l.addEventListener('click', (e) => { e.preventDefault(); window.open(waHref(lastQuestion), '_blank', 'noopener'); }));
  body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-topic]');
    if (t) { ask(TOPICS[Number(t.dataset.topic)][1]); return; }
    const a = e.target.closest('[data-ask]');
    if (a) ask(a.dataset.ask);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = form.msg.value.trim().slice(0, 300);
    if (!t) { form.msg.focus(); return; }
    form.reset();
    ask(t);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !card.hidden) { close(); btn.focus(); } });
  document.addEventListener('pointerdown', (e) => { if (!card.hidden && !dock.contains(e.target)) close(); });
}
