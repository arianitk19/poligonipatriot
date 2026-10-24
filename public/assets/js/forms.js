// Ndihmës për formularët publikë: validim, gabime, kompresim fotosh.
export function fieldError(form, name, msg) {
  const el = form.elements[name];
  const target = el instanceof RadioNodeList ? null : el;
  const box = form.querySelector(`[data-error-for="${name}"]`);
  if (target) target.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (box) { box.textContent = msg || box.textContent; box.hidden = !msg; }
  else if (target && msg) {
    let p = target.parentElement.querySelector('.field-error');
    if (!p) { p = document.createElement('p'); p.className = 'field-error'; target.after(p); }
    p.textContent = msg; p.hidden = false;
  } else if (target) {
    const p = target.parentElement.querySelector('.field-error'); if (p) p.hidden = true;
  }
}

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
export const isPhone = (v) => v.replace(/[^\d]/g, '').length >= 8;

/** Kontroll i thjeshtë anti-spam: fusha e fshehur dhe koha minimale e plotësimit. */
export function looksLikeBot(form, startedAt) {
  return Boolean(form.elements.website?.value) || Date.now() - startedAt < 2500;
}

/** Kompreson fotot e mëdha në JPEG (maks. 2000px). PDF-të kalojnë siç janë. */
export async function compressImage(file, maxSide = 2000, quality = 0.85) {
  if (!file || !file.type.startsWith('image/') || file.size < 1.2 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}

export function showDone(form) {
  const done = form.parentElement.querySelector('[data-done]');
  form.hidden = true;
  done.hidden = false;
  done.focus();
  done.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function friendlyError(err) {
  const m = String(err?.message || err || '');
  if (/rate|too many|kufi/i.test(m)) return 'Keni dërguar shumë kërkesa brenda pak kohe. Provoni sërish pas një ore ose na telefononi.';
  if (/network|fetch/i.test(m)) return 'Nuk u lidhëm me serverin. Kontrolloni internetin dhe provoni sërish.';
  if (/size|large|payload/i.test(m)) return 'Skedari është shumë i madh. Përdorni një foto deri në 5 MB.';
  return 'Dërgimi nuk u krye. Provoni sërish ose na telefononi në +383 49 394 850.';
}
