// Ndihmës për panelin admin.
import { CONFIG } from '../config.js';
import { mediaUrl } from '../data.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export { mediaUrl };

let toastTimer;
export function toast(msg, ms = 3000) {
  const t = $('[data-toast]');
  $('[data-toast-text]', t).textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), ms);
}

/** Dialog konfirmimi; kthen true/false. */
export function confirmBox(title, text, okLabel = 'Po, vazhdo') {
  const d = $('[data-confirm]');
  $('[data-confirm-title]', d).textContent = title;
  $('[data-confirm-text]', d).textContent = text;
  $('[data-confirm-ok]', d).textContent = okLabel;
  d.returnValue = '';
  d.showModal();
  return new Promise((r) => d.addEventListener('close', () => r(d.returnValue === 'yes'), { once: true }));
}

export function slugify(s) {
  return String(s || '').toLowerCase().replace(/ë/g, 'e').replace(/ç/g, 'c').replace(/ı/g, 'i').replace(/&/g, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function fmtDate(d) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: CONFIG.site.timezone }).formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

/** Konverton një foto në WebP me gjerësi maksimale; kthen { blob, width, height }. */
export async function toWebp(file, maxSide = 1600, quality = 0.86) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise((r) => c.toBlob(r, 'image/webp', quality));
  if (!blob) throw new Error('Shfletuesi nuk e konvertoi foton në WebP');
  return { blob, width: w, height: h };
}

export const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export async function uploadMedia(sb, path, blob) {
  const { error } = await sb.storage.from(CONFIG.mediaBucket).upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return path;
}

/** Fshin nga Storage vetëm rrugët që janë në bucket (jo fotot lokale /assets/...). */
export async function removeMedia(sb, paths) {
  const list = paths.filter((p) => p && !p.startsWith('/') && !/^https?:/.test(p));
  if (!list.length) return;
  const { error } = await sb.storage.from(CONFIG.mediaBucket).remove(list);
  if (error) console.warn('[media] remove', error);
}

export function errMsg(e) {
  const m = String(e?.message || e || '');
  if (/duplicate key.*slug/i.test(m)) return 'Ky slug ekziston tashmë. Zgjidhni një tjetër.';
  if (/Invalid login credentials/i.test(m)) return 'Emaili ose fjalëkalimi nuk janë të saktë.';
  if (/row-level security|permission denied/i.test(m)) return 'Nuk keni leje për këtë veprim. Hyni sërish ose verifikoni kodin 2FA.';
  if (/Email not confirmed/i.test(m)) return 'Emaili nuk është konfirmuar ende.';
  if (/Invalid TOTP|invalid.*code/i.test(m)) return 'Kodi nuk është i saktë ose ka skaduar.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Nuk ka lidhje me serverin. Kontrolloni internetin.';
  return m || 'Ndodhi një gabim.';
}

export const STATUS = {
  applications: { new: ['E re', 'patriot'], contacted: ['Kontaktuar', 'brass'], approved: ['Pranuar', 'ok'], completed: ['Përfunduar', 'ok'], rejected: ['Refuzuar', 'steel'] },
  messages: { new: ['I ri', 'patriot'], replied: ['Përgjigjur', 'ok'], archived: ['Arkivuar', 'steel'] },
};
export const PROGRAMS = { shkurtra: 'Armë të shkurtra', gjata: 'Armë të gjata', 'te-dyja': 'Të shkurtra dhe të gjata' };
export const REASONS = { trajnimet: 'Trajnime & certifikime', poligoni: 'Poligoni', anetaresimi: 'Anëtarësimi', blerje: 'Blerje armësh & aksesorësh', riparimi: 'Riparimi & mirëmbajtja', 'te-tjera': 'Të tjera' };

export function badge(kind, status) {
  const [label, tone] = STATUS[kind][status] || [status, 'steel'];
  return `<span class="a-badge a-badge-${tone}">${esc(label)}</span>`;
}

/* ───────── Hyrja me numër telefoni ─────────
   Llogaria e adminit krijohet në Supabase me një email teknik që del nga numri:
   049 394 850  →  38349394850@admin.poligonipatriot.com
   Kështu hyni vetëm me numër + fjalëkalim, pa SMS dhe pa email të vërtetë. */
export const ADMIN_DOMAIN = 'admin.poligonipatriot.com';

/** Kthen numrin në formatin ndërkombëtar pa "+", p.sh. "38349394850". Null nëse nuk është i vlefshëm. */
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '383' + d.slice(1);
  else if (d.length <= 9) d = '383' + d;
  d = d.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 15 ? d : null;
}
export const phoneToLogin = (digits) => `${digits}@${ADMIN_DOMAIN}`;

/** Numri si shfaqet: +383 49 394 850 */
export function formatPhone(digits) {
  if (!digits) return '';
  const m = digits.match(/^383(\d{2})(\d{3})(\d{3,4})$/);
  return m ? `+383 ${m[1]} ${m[2]} ${m[3]}` : `+${digits}`;
}
export function userLabel(user) {
  const e = user?.email || '';
  if (e.endsWith(`@${ADMIN_DOMAIN}`)) return formatPhone(e.split('@')[0]);
  return user?.phone ? formatPhone(user.phone) : e;
}

/** Nga ajo që shkruhet në fushën e hyrjes: email i zakonshëm ose numër telefoni → emaili i hyrjes. */
export function loginEmailFrom(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : null;
  const d = normalizePhone(v);
  return d ? phoneToLogin(d) : null;
}
