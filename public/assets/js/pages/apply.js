import { submitApplication } from '../data.js';
import { fieldError, isEmail, isPhone, looksLikeBot, compressImage, showDone, friendlyError } from '../forms.js';
import { toast } from '../app.js';

const form = document.querySelector('[data-apply-form]');
const progress = form.querySelector('[data-progress]');
const started = Date.now();
const MAX = 5 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const pre = new URLSearchParams(location.search).get('programi');
if (pre) { const r = form.querySelector(`input[name="program"][value="${CSS.escape(pre)}"]`); if (r) r.checked = true; }

// Zonat e ngarkimit me tërheqje
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
