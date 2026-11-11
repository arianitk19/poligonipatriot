import { submitApplication } from '../data.js';
import { fieldError, isPhone, looksLikeBot, showDone, friendlyError } from '../forms.js';
import { toast } from '../app.js';
import { createSignaturePad, typedSignatureFile, loadSigFonts, SIG_FONTS } from '../signature.js';
import { dmy } from '../kerkesa-doc.js';
import { makeKerkesaFiles, toBase64, downloadFile } from '../kerkesa-pdf.js';

const started = Date.now();
const params = new URLSearchParams(location.search);
const pre = params.get('programi');

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

// Mënyra e nënshkrimit: vizatim (gisht/maus) ose me tastierë
let sigMode = 'draw';
let sigFont = 'vibes';
const typeBox = kForm.querySelector('[data-sig-type]');
const drawBox = kForm.querySelector('[data-sig-draw]');
const typedInput = kForm.elements.sig_text;
const typedText = kForm.querySelector('[data-sig-typed-text]');
const typedPad = kForm.querySelector('[data-sig-typed]');
const fontBtns = [...kForm.querySelectorAll('[data-sig-font]')];
function renderTyped() {
  const t = typedInput.value.trim().replace(/\s+/g, ' ');
  const f = SIG_FONTS[sigFont];
  typedText.textContent = t;
  typedText.style.fontFamily = `"${f.family}", cursive`;
  typedText.style.fontWeight = sigFont === 'vibes' ? '400' : '600';
  const box = typedPad.getBoundingClientRect();
  let size = Math.max(28, box.height * 0.42 * f.scale);
  typedText.style.fontSize = `${size}px`;
  if (t && typedText.scrollWidth > box.width * 0.88) typedText.style.fontSize = `${size * (box.width * 0.88) / typedText.scrollWidth}px`;
  fontBtns.forEach((b) => { b.textContent = t || 'Nënshkrimi'; });
  if (t.length >= 3) { fieldError(kForm, 'signature', ''); typedPad.removeAttribute('aria-invalid'); }
}
function setSigMode(m) {
  sigMode = m;
  kForm.querySelectorAll('[data-sig-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.sigMode === m)));
  drawBox.hidden = m !== 'draw'; typeBox.hidden = m !== 'type';
  fieldError(kForm, 'signature', ''); sigWrap.removeAttribute('aria-invalid'); typedPad.removeAttribute('aria-invalid');
  if (m === 'draw') { pad.refit(); return; }
  if (!typedInput.value.trim()) {
    const f = kForm.elements;
    const full = [f.first_name.value, f.last_name.value].map((x) => x.trim()).filter(Boolean).join(' ');
    if (full) typedInput.value = full;
  }
  loadSigFonts(typedInput.value || 'Nënshkrimi').then(renderTyped);
  renderTyped();
  if (!typedInput.value) typedInput.focus({ preventScroll: true });
}
kForm.querySelectorAll('[data-sig-mode]').forEach((b) => b.addEventListener('click', () => setSigMode(b.dataset.sigMode)));
fontBtns.forEach((b) => b.addEventListener('click', () => {
  sigFont = b.dataset.sigFont;
  fontBtns.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  renderTyped();
}));
typedInput.addEventListener('input', renderTyped);
new ResizeObserver(() => { if (sigMode === 'type') renderTyped(); }).observe(typedPad);

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

  let sigMsg = '';
  if (sigMode === 'type') {
    const t = typedInput.value.trim();
    sigMsg = t.length < 3 ? 'Shkruani emrin dhe mbiemrin si nënshkrim.' : '';
    typedPad.toggleAttribute('aria-invalid', Boolean(sigMsg));
  } else {
    sigMsg = pad.isEmpty() ? 'Nënshkruani kërkesën në fushën e nënshkrimit, ose zgjidhni "Shkruaj".' : pad.inkLength() < 60 ? 'Nënshkrimi është shumë i shkurtër. Nënshkruani si zakonisht.' : '';
    sigWrap.toggleAttribute('aria-invalid', Boolean(sigMsg));
  }
  bad('signature', sigMsg);

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

// Kopja e aplikantit: foto (ruhet automatikisht) dhe PDF
let files = null;
const coarse = matchMedia('(hover: none)').matches;
const canShareFiles = (f) => { try { return Boolean(navigator.canShare?.({ files: [f] })); } catch { return false; } };
async function savePhoto() {
  if (!files) return;
  // Në telefon hapet menyja e ndarjes, ku "Ruaj foton" e vendos te Fotot
  if (coarse && canShareFiles(files.jpg)) {
    try { await navigator.share({ files: [files.jpg], title: 'Kërkesa për trajnim' }); return; }
    catch (ex) { if (ex?.name === 'AbortError') return; }
  }
  downloadFile(files.jpg);
}
const MAX_DOCS = 4.5 * 1024 * 1024; // kufiri i bashkëngjitjeve në email (base64)

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
  btn.setAttribute('aria-busy', 'true'); btn.disabled = true;
  try {
    progress.textContent = 'Duke përgatitur nënshkrimin…';
    const sig = sigMode === 'type' ? await typedSignatureFile(typedInput.value.trim().replace(/\s+/g, ' '), sigFont) : await pad.toFile('nenshkrimi.png');
    const sigUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(sig); });

    // Fleta e plotësuar krijohet para dërgimit, që poligoni ta marrë menjëherë në email dhe WhatsApp
    progress.textContent = 'Duke krijuar kërkesën (foto dhe PDF)…';
    files = await makeKerkesaFiles(data, sigUrl);
    let [jpg64, pdf64] = await Promise.all([toBase64(files.jpg), toBase64(files.pdf)]);
    if (jpg64.length + pdf64.length > MAX_DOCS) {
      files = await makeKerkesaFiles(data, sigUrl, { quality: 0.72 });
      [jpg64, pdf64] = await Promise.all([toBase64(files.jpg), toBase64(files.pdf)]);
    }

    progress.textContent = 'Duke dërguar kërkesën te poligoni…';
    const r = await submitApplication({ ...data, doc_jpg: jpg64, doc_pdf: pdf64 }, { nenshkrimi: sig });
    if (r.offline) toast('Mënyra demo: lidhni Supabase te config.js që kërkesat të ruhen.');

    showDone(kForm);
    // Kopja e aplikantit ruhet automatikisht si foto
    downloadFile(files.jpg);
  } catch (ex) {
    console.error(ex);
    err.textContent = friendlyError(ex); err.hidden = false;
  } finally {
    btn.removeAttribute('aria-busy'); btn.disabled = false; progress.textContent = '';
  }
});
document.querySelector('[data-save-photo]').addEventListener('click', savePhoto);
document.querySelector('[data-save-pdf]').addEventListener('click', () => { if (files) downloadFile(files.pdf); });
