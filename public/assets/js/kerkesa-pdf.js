// Krijon PDF-në e kërkesës zyrtare direkt në shfletues (pa librari, pa server).
// Fleta vizatohet në canvas (A4, 150 DPI) dhe futet si foto JPEG në një PDF me një faqe.
import { WEAPON_CLASSES, dmy } from './kerkesa-doc.js';

const PX = 150 / 25.4; // piksela për mm
const W = Math.round(210 * PX), H = Math.round(297 * PX);
const mm = (v) => v * PX;
const FONT = 'Archivo, "Segoe UI", Arial, sans-serif';

const loadImg = (src) => new Promise((res) => {
  if (!src) return res(null);
  const i = new Image();
  i.crossOrigin = 'anonymous';
  i.onload = () => res(i); i.onerror = () => res(null);
  i.src = src;
});

/** Numri i letërnjoftimit i fshehur, p.sh. ••••••7890 */
export const maskId = (v) => { const s = String(v || ''); return s.length > 4 ? '•'.repeat(s.length - 4) + s.slice(-4) : s; };

function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

async function drawSheet(d, sigSrc, { hideId }) {
  await Promise.all(['400', '700', '800'].map((w) => document.fonts?.load(`${w} 30px Archivo`).catch(() => null)));
  const [logo, sig] = await Promise.all([loadImg('/assets/img/brand/logo-wordmark-dark.webp'), loadImg(sigSrc)]);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
  const L = mm(16), R = W - mm(16), ink = '#0c0c0e', blue = '#13213f';
  c.fillStyle = ink; c.strokeStyle = ink; c.textBaseline = 'alphabetic';

  // Koka me logo
  let y = mm(14);
  const boxH = mm(43);
  c.lineWidth = mm(0.35); roundRect(c, L, y, R - L, boxH, mm(9)); c.stroke();
  if (logo) { const lh = mm(24), lw = lh * (logo.naturalWidth / logo.naturalHeight); c.drawImage(logo, (W - lw) / 2, y + mm(4.5), lw, lh); }
  c.textAlign = 'center';
  c.font = `700 ${mm(3.3)}px ${FONT}`; c.fillText('POLIGONI PATRIOT  |  POLIGONI I SHENJËTARISË – SHOOTING RANGE', W / 2, y + mm(34));
  c.font = `400 ${mm(3.3)}px ${FONT}`; c.fillText('ADRESA: ZIDI SADIK AGES P.N., 50 000, GJAKOVË, REPUBLIKA E KOSOVËS', W / 2, y + mm(39.5));

  y += boxH + mm(16);
  c.font = `700 ${mm(5.4)}px ${FONT}`; c.fillText('Kërkesë për trajnim profesional për armë', W / 2, y);

  // Rreshtat
  y += mm(15);
  c.textAlign = 'left';
  const full = [d.first_name, d.father_name, d.last_name].filter(Boolean).join(' ') || d.full_name || '';
  const rows = [
    ['Emri, emri i babait, mbiemri', full],
    ['Data e lindjes', dmy(d.birth_date)],
    ['Vendi dhe shteti i lindjes', d.birth_place],
    ['Nr. i telefonit', d.phone],
    ['Nr. i letërnjoftimit', hideId ? maskId(d.id_number) : d.id_number],
  ];
  for (const [label, value] of rows) {
    c.fillStyle = ink; c.font = `700 ${mm(3.75)}px ${FONT}`; c.fillText(label, L, y);
    const x0 = L + c.measureText(label).width + mm(3);
    c.lineWidth = mm(0.3); c.beginPath(); c.moveTo(x0, y + mm(1)); c.lineTo(R, y + mm(1)); c.stroke();
    c.fillStyle = blue; c.font = `400 ${mm(4.1)}px ${FONT}`; c.fillText(String(value || ''), x0 + mm(1.5), y - mm(0.6));
    y += mm(12);
  }

  // A / B / C
  y += mm(2);
  c.fillStyle = ink; c.textAlign = 'center'; c.font = `700 ${mm(3.8)}px ${FONT}`;
  c.fillText('Me anë të kësaj kërkese, kërkoj që t\'i nënshtrohem trajnimit profesional për:', W / 2, y);
  c.textAlign = 'left'; y += mm(10);
  const classes = d.weapon_classes || [];
  for (const [k, label] of Object.entries(WEAPON_CLASSES)) {
    const on = classes.includes(k), bx = L + mm(16), s = mm(5);
    c.font = `700 ${mm(3.8)}px ${FONT}`; c.fillStyle = ink; c.fillText(`${k}.`, L + mm(6), y);
    c.lineWidth = mm(0.4); roundRect(c, bx, y - s + mm(0.8), s, s, mm(0.8));
    if (on) { c.fill(); c.strokeStyle = '#fff'; c.lineWidth = mm(0.7); c.beginPath(); c.moveTo(bx + s * 0.22, y - s * 0.38); c.lineTo(bx + s * 0.43, y - s * 0.16); c.lineTo(bx + s * 0.8, y - s * 0.72); c.stroke(); c.strokeStyle = ink; } else c.stroke();
    c.fillText(label, bx + s + mm(30), y);
    y += mm(8.5);
  }

  // Nënshkrimi dhe data
  y += mm(14);
  c.font = `700 ${mm(5.4)}px ${FONT}`; c.fillText('Nënshkrimi', L, y);
  let sx = L + c.measureText('Nënshkrimi').width + mm(3);
  c.lineWidth = mm(0.3); c.beginPath(); c.moveTo(sx, y + mm(1)); c.lineTo(sx + mm(72), y + mm(1)); c.stroke();
  if (sig) { const mw = mm(68), mh = mm(20), k = Math.min(mw / sig.naturalWidth, mh / sig.naturalHeight); c.drawImage(sig, sx + mm(2), y + mm(0.5) - sig.naturalHeight * k, sig.naturalWidth * k, sig.naturalHeight * k); }
  y += mm(14);
  c.fillText('Data', L, y);
  sx = L + c.measureText('Data').width + mm(3);
  c.beginPath(); c.moveTo(sx, y + mm(1)); c.lineTo(sx + mm(55), y + mm(1)); c.stroke();
  c.fillStyle = blue; c.font = `400 ${mm(4.3)}px ${FONT}`; c.fillText(dmy(d.signed_on), sx + mm(2), y - mm(0.6));

  // Fundi
  const fy = H - mm(20);
  c.fillStyle = ink; c.lineWidth = mm(0.3); c.beginPath(); c.moveTo(L, fy); c.lineTo(R, fy); c.stroke();
  c.textAlign = 'center'; c.font = `700 ${mm(3.6)}px ${FONT}`; c.fillText('MOB: +383 49 394 850     E-mail: poligoni.patriot@gmail.com', W / 2, fy + mm(6));
  return cv;
}

/** PDF me një faqe A4 që përmban një foto JPEG. */
function jpegToPdf(jpg, w, h) {
  const enc = new TextEncoder();
  const chunks = []; const offsets = []; let len = 0;
  const put = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; };
  const obj = (n, body) => { offsets[n] = len; put(`${n} 0 obj\n${body}\nendobj\n`); };
  const PW = 595.28, PH = 841.89;
  const content = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
  put('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = len;
  put(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
  put(jpg); put('\nendstream\nendobj\n');
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  obj(6, '<< /Title (Kerkese per trajnim profesional per arme) /Producer (poligonipatriot.com) >>');
  const xref = len;
  put(`xref\n0 7\n0000000000 65535 f \n${[1, 2, 3, 4, 5, 6].map((n) => `${String(offsets[n]).padStart(10, '0')} 00000 n \n`).join('')}`);
  put(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}

export const pdfName = (d, suffix = '') => `Kerkesa-${String(d.first_name || '')}-${String(d.last_name || '')}`
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/-$/, '') + suffix + '.pdf';

/** Krijon PDF-në e kërkesës. hideId: fsheh numrin e letërnjoftimit (për WhatsApp). */
export async function makeKerkesaPdf(d, sigSrc, { hideId = false } = {}) {
  const cv = await drawSheet(d, sigSrc, { hideId });
  const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.9));
  const jpg = new Uint8Array(await blob.arrayBuffer());
  const pdf = jpegToPdf(jpg, cv.width, cv.height);
  return new File([pdf], pdfName(d, hideId ? '' : '-kopja'), { type: 'application/pdf' });
}

export function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
