import { submitApplication, getSettings } from '../data.js';
import { CONFIG } from '../config.js';
import { fieldError, isEmail, isPhone, looksLikeBot, compressImage, showDone, friendlyError } from '../forms.js';
import { toast } from '../app.js';
import { createSignaturePad } from '../signature.js';
import { printKerkesa, dmy, WEAPON_CLASSES } from '../kerkesa-doc.js';

const started = Date.now();
const params = new URLSearchParams(location.search);
const pre = params.get('programi');

/* ───────────────────────── Zgjedhja e mënyrës (skeda) ───────────────────────── */
const tabs = [...document.querySelectorAll('.apply-modes [role="tab"]')];
function setMode(mode, focus = false) {
  tabs.forEach((t) => {
    const on = t.dataset.mode === mode;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
  });
  document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== mode; });
  if (mode === 'kerkese') pad?.refit();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => setMode(t.dataset.mode));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    setMode(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].dataset.mode, true);
  });
});

/* ───────────────────────── 1. Kërkesa zyrtare me nënshkrim ───────────────────────── */
const kForm = document.querySelector('[data-kerkese-form]');
const now = new Date();
const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
kForm.querySelector('[data-today]').textContent = dmy(todayIso);
kForm.elements.birth_date.max = todayIso;

if (pre === 'shkurtra' || pre === 'te-dyja') kForm.querySelector('input[name="weapon_classes"][value="A"]').checked = true;

const sigWrap = kForm.querySelector('[data-sig-wrap]');
const undoBtn = kForm.querySelector('[data-sig-undo]');
const clearBtn = kForm.querySelector('[data-sig-clear]');
const syncSig = () => {
  const empty = pad.isEmpty();
  sigWrap.classList.toggle('has-ink', !empty);
  undoBtn.disabled = empty; clearBtn.disabled = empty;
  if (!empty) { fieldError(kForm, 'signature', ''); sigWrap.removeAttribute('aria-invalid'); }
};
const pad = createSignaturePad(kForm.querySelector('[data-sig]'), { onChange: () => syncSig() });
undoBtn.addEventListener('click', () => pad.undo());
clearBtn.addEventListener('click', () => pad.clear());

// Ekrani i plotë: fushë e madhe për nënshkrim, sidomos në telefon
const modal = document.querySelector('[data-sig-modal]');
document.body.append(modal);
let xl = null;
function openXL() {
  modal.hidden = false;
  document.documentElement.classList.add('sig-open');
  window.ppLenis?.stop?.();
  if (!xl) xl = createSignaturePad(modal.querySelector('[data-sig-xl]'));
  requestAnimationFrame(() => { xl.refit(); xl.strokes = pad.strokes; });
  modal.querySelector('[data-xl-save]').focus({ preventScroll: true });
}
function closeXL(save) {
  if (save && xl) pad.strokes = xl.strokes;
  modal.hidden = true;
  document.documentElement.classList.remove('sig-open');
  window.ppLenis?.start?.();
  kForm.querySelector('[data-sig-full]').focus({ preventScroll: true });
}
kForm.querySelector('[data-sig-full]').addEventListener('click', openXL);
modal.querySelector('[data-xl-clear]').addEventListener('click', () => xl?.clear());
modal.querySelector('[data-xl-cancel]').addEventListener('click', () => closeXL(false));
modal.querySelector('[data-xl-save]').addEventListener('click', () => closeXL(true));
modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeXL(false); });

// Gabimet hiqen sapo përdoruesi korrigjon fushën
kForm.addEventListener('input', (e) => {
  const n = e.target.name;
  if (['first_name', 'father_name', 'last_name'].includes(n)) { fieldError(kForm, 'name', ''); e.target.removeAttribute('aria-invalid'); }
  else if (n === 'weapon_classes') fieldError(kForm, 'weapon_classes', '');
  else if (n && kForm.querySelector(`[data-error-for="${n}"]`)) fieldError(kForm, n, '');
});

const cap = (s) => s.trim().replace(/\s+/g, ' ');
function validateKerkese() {
  const f = kForm.elements;
  let ok = true;
  const bad = (name, msg) => { fieldError(kForm, name, msg); if (msg) ok = false; };

  const names = ['first_name', 'father_name', 'last_name'];
  const miss = names.filter((n) => cap(f[n].value).length < 2);
  names.forEach((n) => f[n].setAttribute('aria-invalid', String(miss.includes(n))));
  bad('name', miss.length ? 'Shkruani emrin, emrin e babait dhe mbiemrin.' : '');

  const bd = f.birth_date.value;
  const y = Number(bd.slice(0, 4));
  bad('birth_date', !bd ? 'Zgjidhni datën e lindjes.' : bd > todayIso || y < 1900 ? 'Data e lindjes nuk është e saktë.' : '');
  bad('birth_place', cap(f.birth_place.value).length < 2 ? 'Shkruani vendin dhe shtetin e lindjes.' : '');
  bad('phone', isPhone(f.phone.value) ? '' : 'Shkruani një numër telefoni të vlefshëm.');
  bad('id_number', /^\d{8,12}$/.test(f.id_number.value.replace(/\s/g, '')) ? '' : 'Numri i letërnjoftimit duhet të ketë vetëm shifra (zakonisht 10).');

  const classes = [...kForm.querySelectorAll('input[name="weapon_classes"]:checked')].map((i) => i.value);
  bad('weapon_classes', classes.length ? '' : 'Zgjidhni të paktën një nga A, B ose C.');

  const sigMsg = pad.isEmpty() ? 'Nënshkruani kërkesën në fushën e nënshkrimit.' : pad.inkLength() < 60 ? 'Nënshkrimi është shumë i shkurtër. Nënshkruani si zakonisht.' : '';
  bad('signature', sigMsg);
  sigWrap.toggleAttribute('aria-invalid', Boolean(sigMsg));

  bad('consent', f.consent.checked ? '' : 'Duhet të konfirmoni për të vazhduar.');
  if (!ok) return null;

  const first = cap(f.first_name.value), father = cap(f.father_name.value), last = cap(f.last_name.value);
  const hasA = classes.includes('A'), hasLong = classes.includes('B') || classes.includes('C');
  return {
    kind: 'kerkese',
    full_name: `${first} ${last}`,
    first_name: first,
    father_name: father,
    last_name: last,
    birth_date: bd,
    birth_place: cap(f.birth_place.value),
    phone: f.phone.value.trim(),
    id_number: f.id_number.value.replace(/\s/g, ''),
    weapon_classes: classes,
    program: hasA && hasLong ? 'te-dyja' : hasA ? 'shkurtra' : 'gjata',
    signed_on: todayIso,
    consent: true,
  };
}

let lastCopy = null;
let waNumber = CONFIG.site.whatsapp || '38349394850';
getSettings().then((st) => { if (st?.whatsapp) waNumber = String(st.whatsapp).replace(/\D/g, ''); }).catch(() => {});
const coarse = matchMedia('(hover: none)').matches;

// Mesazhi për WhatsApp: pa numrin e letërnjoftimit dhe pa nënshkrimin
function waLink(d, id) {
  const txt = [
    'Përshëndetje Poligoni Patriot! Sapo nënshkrova dhe dërgova kërkesën zyrtare për trajnim profesional për armë.',
    '',
    `Emri: ${d.first_name} ${d.father_name} ${d.last_name}`,
    `Trajnimi: ${d.weapon_classes.map((k) => `${k}. ${WEAPON_CLASSES[k]}`).join(', ')}`,
    `Tel: ${d.phone}`,
    id ? `Nr. i kërkesës: ${String(id).slice(0, 8).toUpperCase()}` : '',
  ].filter((x, i) => x || i === 1).join('\n');
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(txt)}`;
}
kForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = kForm.querySelector('[data-form-error]');
  err.hidden = true;
  const data = validateKerkese();
  if (!data) {
    kForm.querySelector('[aria-invalid="true"], [data-error-for]:not([hidden])')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (looksLikeBot(kForm, started)) { showDone(kForm); return; }
  const btn = kForm.querySelector('button[type="submit"]');
  const progress = kForm.querySelector('[data-progress]');
  btn.setAttribute('aria-busy', 'true');
  // Në kompjuter skeda e WhatsApp hapet tani (brenda klikimit), që shfletuesi të mos e bllokojë
  let waWin = null;
  if (!coarse) { try { waWin = window.open('', '_blank'); if (waWin) { waWin.opener = null; waWin.document.write('<title>WhatsApp</title><body style="background:#0a0a0b;color:#b6b6bb;font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0">Duke hapur WhatsApp…</body>'); } } catch { waWin = null; } }
  try {
    progress.textContent = 'Duke përgatitur nënshkrimin…';
    const sig = await pad.toFile('nenshkrimi.png');
    progress.textContent = 'Duke dërguar kërkesën…';
    const r = await submitApplication(data, { nenshkrimi: sig });
    if (r.offline) toast('Mënyra demo: lidhni Supabase te config.js që kërkesat të ruhen.');
    const sigUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(sig); });
    lastCopy = { data: { ...data, id: r.id }, sigUrl };
    const wa = waLink(data, r.id);
    document.querySelectorAll('[data-wa-after]').forEach((a) => { a.href = wa; });
    showDone(kForm);
    // Pas konfirmimit hapet automatikisht WhatsApp te numri i poligonit
    if (waWin && !waWin.closed) waWin.location.href = wa;
    else setTimeout(() => { location.href = wa; }, 900);
  } catch (ex) {
    console.error(ex);
    waWin?.close();
    err.textContent = friendlyError(ex); err.hidden = false;
  } finally {
    btn.removeAttribute('aria-busy'); progress.textContent = '';
  }
});
document.querySelector('[data-print-copy]').addEventListener('click', () => { if (lastCopy) printKerkesa(lastCopy.data, lastCopy.sigUrl); });

/* ───────────────────────── 2. Aplikimi i shpejtë (me foto të letërnjoftimit) ───────────────────────── */
const form = document.querySelector('[data-apply-form]');
const progress = form.querySelector('[data-progress]');
const MAX = 5 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

if (pre) { const r = form.querySelector(`input[name="program"][value="${CSS.escape(pre)}"]`); if (r) r.checked = true; }

form.querySelectorAll('[data-drop]').forEach((drop) => {
  const input = drop.querySelector('input[type="file"]');
  const label = drop.querySelector('[data-file-name]');
  const set = () => {
    const f = input.files[0];
    drop.classList.toggle('has-file', Boolean(f));
    label.textContent = f ? `${f.name} · ${(f.size / 1024 / 1024).toFixed(1)} MB` : 'Zgjidhni ose tërhiqni skedarin';
    drop.removeAttribute('aria-invalid');
  };
  input.addEventListener('change', set);
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) { input.files = e.dataTransfer.files; set(); } });
});

function checkFile(name) {
  const f = form.elements[name].files[0];
  if (!f) return 'Ngarkoni të dyja anët e letërnjoftimit.';
  if (!OK_TYPES.includes(f.type)) return 'Lejohen vetëm JPG, PNG, WEBP ose PDF.';
  if (f.type === 'application/pdf' && f.size > MAX) return 'PDF-ja duhet të jetë deri në 5 MB.';
  return '';
}

function validate() {
  const f = form.elements;
  let ok = true;
  const req = (name, cond, msg) => { fieldError(form, name, cond ? '' : msg); if (!cond) ok = false; };
  req('full_name', f.full_name.value.trim().split(/\s+/).length >= 2, 'Shkruani emrin dhe mbiemrin.');
  req('id_number', /^\d{8,12}$/.test(f.id_number.value.replace(/\s/g, '')), 'Numri personal duhet të ketë vetëm shifra (zakonisht 10).');
  req('phone', isPhone(f.phone.value), 'Shkruani një numër telefoni të vlefshëm.');
  req('email', isEmail(f.email.value.trim()), 'Shkruani një email të vlefshëm.');
  const program = form.querySelector('input[name="program"]:checked')?.value;
  fieldError(form, 'program', program ? '' : 'Zgjidhni programin.'); if (!program) ok = false;
  const fe = checkFile('front') || checkFile('back');
  form.querySelectorAll('[data-drop]').forEach((d) => { if (!d.querySelector('input').files[0]) d.setAttribute('aria-invalid', 'true'); });
  fieldError(form, 'files', fe); if (fe) ok = false;
  fieldError(form, 'consent', f.consent.checked ? '' : 'Duhet të pajtoheni për të vazhduar.'); if (!f.consent.checked) ok = false;
  if (!ok) return null;
  return { full_name: f.full_name.value.trim(), id_number: f.id_number.value.replace(/\s/g, ''), phone: f.phone.value.trim(), email: f.email.value.trim(), program, message: f.message.value.trim() || null, consent: true };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = form.querySelector('[data-form-error]');
  err.hidden = true;
  const data = validate();
  if (!data) { form.querySelector('[aria-invalid="true"], [data-error-for]:not([hidden])')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (looksLikeBot(form, started)) { showDone(form); return; }
  const btn = form.querySelector('button[type="submit"]');
  btn.setAttribute('aria-busy', 'true');
  try {
    progress.textContent = 'Duke përgatitur dokumentet…';
    const front = await compressImage(form.elements.front.files[0]);
    const back = await compressImage(form.elements.back.files[0]);
    if (front.size > MAX || back.size > MAX) throw new Error('size');
    progress.textContent = 'Duke ngarkuar…';
    const r = await submitApplication(data, { front, back });
    if (r.offline) toast('Mënyra demo: lidhni Supabase te config.js që aplikimet të ruhen.');
    showDone(form);
  } catch (ex) {
    console.error(ex);
    err.textContent = friendlyError(ex); err.hidden = false;
  } finally {
    btn.removeAttribute('aria-busy'); progress.textContent = '';
  }
});

if (params.get('menyra') === 'online') setMode('online');
