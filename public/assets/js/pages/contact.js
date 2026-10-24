import { submitMessage } from '../data.js';
import { fieldError, isEmail, isPhone, looksLikeBot, showDone, friendlyError } from '../forms.js';
import { toast } from '../app.js';

const form = document.querySelector('[data-contact-form]');
const started = Date.now();

// Arsyeja e parazgjedhur nga URL-ja (p.sh. /kontakti/?arsye=anetaresimi)
const pre = new URLSearchParams(location.search).get('arsye');
if (pre) form.querySelectorAll('input[name="reasons"]').forEach((c) => { if (c.value === pre) c.checked = true; });

function validate() {
  const f = form.elements;
  let ok = true;
  const req = (name, cond, msg) => { fieldError(form, name, cond ? '' : msg); if (!cond) ok = false; };
  req('name', f.name.value.trim().length >= 2, 'Shkruani emrin.');
  req('phone', isPhone(f.phone.value), 'Shkruani një numër telefoni të vlefshëm.');
  req('email', !f.email.value.trim() || isEmail(f.email.value.trim()), 'Emaili nuk duket i saktë.');
  const reasons = [...form.querySelectorAll('input[name="reasons"]:checked')].map((c) => c.value);
  fieldError(form, 'reasons', reasons.length ? '' : 'Zgjidhni të paktën një arsye.'); if (!reasons.length) ok = false;
  req('message', f.message.value.trim().length >= 5, 'Shkruani mesazhin.');
  return ok ? { name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim() || null, reasons, message: f.message.value.trim() } : null;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = validate();
  const err = form.querySelector('[data-form-error]');
  err.hidden = true;
  if (!data) { form.querySelector('[aria-invalid="true"]')?.focus(); return; }
  if (looksLikeBot(form, started)) { showDone(form); return; }
  const btn = form.querySelector('button[type="submit"]');
  btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Duke dërguar…';
  try {
    const r = await submitMessage({ ...data, source: location.pathname });
    if (r.offline) toast('Mënyra demo: lidhni Supabase te config.js që mesazhet të ruhen.');
    showDone(form);
  } catch (ex) {
    console.error(ex);
    err.textContent = friendlyError(ex); err.hidden = false;
  } finally {
    btn.removeAttribute('aria-busy'); btn.textContent = 'Dërgo mesazhin';
  }
});
