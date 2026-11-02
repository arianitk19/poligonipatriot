// Fleta zyrtare "Kërkesë për trajnim profesional për armë", e plotësuar me të dhënat
// dhe nënshkrimin. Përdoret nga faqja (kopja e aplikantit) dhe nga paneli (printimi).

export const WEAPON_CLASSES = {
  A: 'Armë e shkurtër e zjarrit',
  B: 'Armë e gjatë e zjarrit me vijaska',
  C: 'Armë e gjatë e zjarrit pa vijaska',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 2026-11-02 → 02.11.2026 */
export const dmy = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : ''; };

export function kerkesaDocument(d, signatureSrc) {
  const origin = location.origin;
  const line = (label, value) => `<div class="row"><span class="lbl">${label}</span><span class="val">${esc(value) || '&nbsp;'}</span></div>`;
  const classes = d.weapon_classes || [];
  return `<!doctype html><html lang="sq"><head><meta charset="utf-8"><title>Kërkesë për trajnim — ${esc(d.full_name)}</title>
<style>
@page { size: A4; margin: 14mm 16mm; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; color: #0c0c0e; font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sheet { width: 178mm; min-height: 262mm; margin: 0 auto; display: flex; flex-direction: column; }
.head { border: 1.2px solid #111; border-radius: 9mm; padding: 5mm 8mm 4mm; text-align: center; }
.head img { height: 24mm; width: auto; display: block; margin: 0 auto 2mm; }
.head p { margin: 0.6mm 0; font-size: 9.6pt; letter-spacing: 0.01em; }
h1 { text-align: center; font-size: 15pt; margin: 13mm 0 12mm; }
.row { display: flex; align-items: flex-end; gap: 3mm; margin: 0 0 8.5mm; font-size: 10.5pt; font-weight: 700; }
.row .lbl { white-space: nowrap; }
.row .val { flex: 1; border-bottom: 1px solid #111; padding: 0 1mm 0.6mm; font-weight: 400; color: #13213f; font-size: 11.5pt; min-height: 6mm; }
.intro { text-align: center; font-weight: 700; font-size: 10.8pt; margin: 3mm 0 6mm; }
.opt { display: grid; grid-template-columns: 9mm 6mm 1fr; align-items: center; margin: 0 0 4.5mm 6mm; font-weight: 700; font-size: 10.8pt; }
.box { width: 4.6mm; height: 4.6mm; border: 1.2px solid #111; border-radius: 0.8mm; display: grid; place-items: center; font-size: 10pt; line-height: 1; }
.box.on { background: #111; color: #fff; }
.opt .t { padding-left: 32mm; }
.sig { display: flex; align-items: flex-end; gap: 3mm; margin-top: 14mm; font-size: 15pt; font-weight: 700; }
.sig .val { position: relative; width: 70mm; height: 16mm; border-bottom: 1px solid #111; }
.sig img { position: absolute; left: 2mm; bottom: 0.5mm; max-width: 66mm; max-height: 19mm; }
.date { display: flex; align-items: flex-end; gap: 3mm; margin-top: 11mm; font-size: 15pt; font-weight: 700; }
.date .val { width: 55mm; border-bottom: 1px solid #111; font-size: 12pt; font-weight: 400; color: #13213f; padding: 0 1mm 0.6mm; }
.foot { margin-top: auto; border-top: 1px solid #111; padding-top: 2.4mm; text-align: center; font-weight: 700; font-size: 10pt; }
.meta { margin-top: 2mm; text-align: center; font-size: 7.5pt; color: #6b6b70; }
@media screen { body { background: #e9e9ec; padding: 10mm 0; } .sheet { background: #fff; padding: 14mm 16mm; width: 210mm; box-shadow: 0 10px 40px rgba(0,0,0,.18); } }
</style></head><body>
<div class="sheet">
  <div class="head">
    <img src="${origin}/assets/img/brand/logo-wordmark-dark.webp" alt="Poligoni Patriot">
    <p><b>POLIGONI PATRIOT</b> &nbsp;|&nbsp; POLIGONI I SHENJËTARISË – SHOOTING RANGE</p>
    <p><b>ADRESA:</b> ZIDI SADIK AGES P.N., 50 000, GJAKOVË, REPUBLIKA E KOSOVËS</p>
  </div>
  <h1>Kërkesë për trajnim profesional për armë</h1>
  ${line('Emri, emri i babait, mbiemri', [d.first_name || (d.full_name || '').split(' ')[0], d.father_name, d.last_name || (d.full_name || '').split(' ').slice(1).join(' ')].filter(Boolean).join(' '))}
  ${line('Data e lindjes', dmy(d.birth_date))}
  ${line('Vendi dhe shteti i lindjes', d.birth_place)}
  ${line('Nr. i telefonit', d.phone)}
  ${line('Nr. i letërnjoftimit', d.id_number)}
  <p class="intro">Me anë të kësaj kërkese, kërkoj që t'i nënshtrohem trajnimit profesional për:</p>
  ${Object.entries(WEAPON_CLASSES).map(([k, l]) => `<div class="opt"><span>${k}.</span><span class="box ${classes.includes(k) ? 'on' : ''}">${classes.includes(k) ? '✓' : ''}</span><span class="t">${l}</span></div>`).join('')}
  <div class="sig"><span>Nënshkrimi</span><span class="val">${signatureSrc ? `<img src="${esc(signatureSrc)}" alt="Nënshkrimi">` : ''}</span></div>
  <div class="date"><span>Data</span><span class="val">${dmy(d.signed_on)}</span></div>
  <div class="foot">MOB: +383 49 394 850 &nbsp; E-mail: poligoni.patriot@gmail.com</div>
  <p class="meta">Nënshkruar në mënyrë digjitale përmes poligonipatriot.com${d.id ? ` · Nr. i kërkesës: ${esc(String(d.id).slice(0, 8).toUpperCase())}` : ''}</p>
</div>
</body></html>`;
}

/** Hap dritaren e printimit (ose "Ruaj si PDF") me fletën e plotësuar. */
export function printKerkesa(d, signatureSrc) {
  document.querySelector('iframe[data-print-frame]')?.remove();
  const f = document.createElement('iframe');
  f.setAttribute('data-print-frame', '');
  f.setAttribute('aria-hidden', 'true');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.append(f);
  const doc = f.contentDocument;
  doc.open(); doc.write(kerkesaDocument(d, signatureSrc)); doc.close();
  const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { const w = window.open('', '_blank'); if (w) { w.document.write(kerkesaDocument(d, signatureSrc)); w.document.close(); } } };
  const imgs = [...doc.images];
  Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => setTimeout(go, 150));
}
