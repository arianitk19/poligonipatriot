// Widget-i i WhatsApp: kartë bisede me përgjigje të shpejta dhe status sipas orarit.
import { getSettings } from './data.js';
import { openStatus } from './app.js';

const dock = document.querySelector('[data-dock]');
if (dock) {
  const btn = dock.querySelector('[data-dock-btn]');
  const card = dock.querySelector('#wa-card');
  const body = dock.querySelector('[data-dock-body]');
  const form = dock.querySelector('[data-dock-form]');
  const statusEl = dock.querySelector('[data-dock-status]');
  const sub = dock.querySelector('[data-dock-sub]');
  let settings = null;
  let greeted = false;

  const QUICK = [
    ['Trajnim & certifikim', 'Përshëndetje, dua informacion për trajnimin dhe certifikimin për armë.'],
    ['Rezervim në poligon', 'Përshëndetje, dua të rezervoj një termin në poligon.'],
    ['Pyetje për një armë', 'Përshëndetje, kam një pyetje për një armë në dyqanin tuaj.'],
    ['Servis / riparim', 'Përshëndetje, dua të caktoj një termin për servisin e armës.'],
    ['Anëtarësim', 'Përshëndetje, dua të bëhem anëtar i Poligonit Patriot.'],
  ];

  const now = () => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Belgrade' }).format(new Date());
  const send = (text) => {
    const n = settings?.whatsapp || '38349394850';
    const page = location.pathname.startsWith('/dyqani/produkt') ? `\n${location.href}` : '';
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(text + page)}`, '_blank', 'noopener');
  };

  getSettings().then((s) => {
    settings = s;
    const st = openStatus(s.hours);
    dock.style.setProperty('--dot', st.open ? '#ffffff' : '#8d8d93');
    dock.querySelector('.dock-ico').style.setProperty('--dot', st.open ? '#ffffff' : '#8d8d93');
    statusEl.textContent = st.open ? 'Online tani · zakonisht përgjigjemi shpejt' : 'Jashtë orarit · ju përgjigjemi sapo të hapemi';
    sub.textContent = st.open ? 'Online tani' : 'WhatsApp';
  });

  function greet() {
    if (greeted) return;
    greeted = true;
    body.innerHTML = '<div class="typing" aria-label="Duke shkruar"><i></i><i></i><i></i></div>';
    setTimeout(() => {
      body.innerHTML = `
        <div class="bubble">Përshëndetje! Si mund t'ju ndihmojmë sot?<time>${now()}</time></div>
        <div class="quick" role="list">${QUICK.map(([l], i) => `<button type="button" role="listitem" data-q="${i}">${l}</button>`).join('')}</div>
        <p class="text-xs text-steel-400">Ose na telefononi: <a class="text-bone underline underline-offset-2" href="tel:${(settings?.phone || '+38349394850').replace(/\s/g, '')}">${settings?.phoneDisplay || '+383 49 394 850'}</a></p>`;
    }, 750);
  }

  const open = () => {
    card.hidden = false;
    dock.classList.add('is-open');
    dock.classList.remove('is-compact');
    btn.setAttribute('aria-expanded', 'true');
    greet();
    setTimeout(() => form.msg.focus({ preventScroll: true }), 60);
  };
  const close = () => {
    card.hidden = true;
    dock.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  };
  btn.addEventListener('click', () => (card.hidden ? open() : close()));
  dock.querySelector('[data-dock-close]').addEventListener('click', () => { close(); btn.focus(); });
  body.addEventListener('click', (e) => { const q = e.target.closest('[data-q]'); if (q) send(QUICK[Number(q.dataset.q)][1]); });
  form.addEventListener('submit', (e) => { e.preventDefault(); const t = form.msg.value.trim(); send(t || 'Përshëndetje, kam një pyetje.'); form.reset(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !card.hidden) { close(); btn.focus(); } });
  document.addEventListener('pointerdown', (e) => { if (!card.hidden && !dock.contains(e.target)) close(); });
}
