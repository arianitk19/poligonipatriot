// Nënshkrimi digjital: funksionon me gisht (telefon), stilolaps dhe maus (laptop).
// Vijat ruhen në koordinata të normalizuara, ndaj nënshkrimi kalon pa humbje
// nga fusha e vogël te ekrani i plotë dhe anasjelltas.

const INK = '#13213f';

export function createSignaturePad(canvas, { onChange, ink = INK } = {}) {
  const ctx = canvas.getContext('2d');
  let strokes = [];
  let current = null;
  let size = { w: 1, h: 1 };

  const fit = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    size = { w: r.width, h: r.height };
    redraw();
  };

  // Trashësia ndryshon sipas shpejtësisë dhe presionit, si te një stilolaps i vërtetë
  const widthFor = (p, prev, scale) => {
    const base = Math.max(1.4, Math.min(3.6, scale / 190));
    if (!prev) return base;
    const dt = Math.max(1, p.t - prev.t);
    const v = Math.hypot((p.x - prev.x) * size.w, (p.y - prev.y) * size.h) / dt;
    const pressure = p.p > 0 && p.p !== 0.5 ? 0.6 + p.p * 0.8 : 1;
    return Math.max(base * 0.45, Math.min(base * 1.35, base * (1.25 - v * 0.35))) * pressure;
  };

  function drawStroke(c, s, W, H, color) {
    c.strokeStyle = color; c.fillStyle = color; c.lineCap = 'round'; c.lineJoin = 'round';
    const scale = Math.min(W, H * 2.5);
    if (s.length === 1) {
      c.beginPath(); c.arc(s[0].x * W, s[0].y * H, widthFor(s[0], null, scale) / 2, 0, Math.PI * 2); c.fill();
      return;
    }
    let w = widthFor(s[0], null, scale);
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1], b = s[i];
      const nw = widthFor(b, a, scale);
      w = w * 0.7 + nw * 0.3; // zbutje e trashësisë
      const mx0 = i > 1 ? (s[i - 2].x + a.x) / 2 : a.x, my0 = i > 1 ? (s[i - 2].y + a.y) / 2 : a.y;
      const mx1 = (a.x + b.x) / 2, my1 = (a.y + b.y) / 2;
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(mx0 * W, my0 * H);
      c.quadraticCurveTo(a.x * W, a.y * H, mx1 * W, my1 * H);
      c.stroke();
    }
    const l = s[s.length - 1], p = s[s.length - 2];
    c.lineWidth = w; c.beginPath(); c.moveTo(((p.x + l.x) / 2) * W, ((p.y + l.y) / 2) * H); c.lineTo(l.x * W, l.y * H); c.stroke();
  }

  function redraw() {
    ctx.clearRect(0, 0, size.w, size.h);
    for (const s of strokes) drawStroke(ctx, s, size.w, size.h, ink);
    if (current) drawStroke(ctx, current, size.w, size.h, ink);
  }

  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)), t: e.timeStamp || performance.now(), p: e.pressure };
  };

  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; redraw(); }); };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    current = [point(e)];
    canvas.classList.add('is-drawing');
    schedule();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!current) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs.length ? evs : [e]) {
      const p = point(ev); const last = current[current.length - 1];
      if (Math.hypot((p.x - last.x) * size.w, (p.y - last.y) * size.h) > 0.8) current.push(p);
    }
    schedule();
  });
  const end = () => {
    if (!current) return;
    strokes.push(current); current = null;
    canvas.classList.remove('is-drawing');
    schedule(); onChange?.();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);

  new ResizeObserver(fit).observe(canvas);
  fit();

  return {
    get strokes() { return strokes.map((s) => s.slice()); },
    set strokes(v) { strokes = (v || []).map((s) => s.slice()); redraw(); onChange?.(); },
    isEmpty: () => strokes.length === 0,
    /** Gjatësia e vijave në px; shmang "nënshkrimet" me një pikë të vetme. */
    inkLength() {
      let L = 0;
      for (const s of strokes) for (let i = 1; i < s.length; i++) L += Math.hypot((s[i].x - s[i - 1].x) * 1000, (s[i].y - s[i - 1].y) * 400);
      return L;
    },
    clear() { strokes = []; current = null; redraw(); onChange?.(); },
    undo() { strokes.pop(); redraw(); onChange?.(); },
    refit: fit,
    /** PNG me sfond transparent, i prerë rreth nënshkrimit, gati për printim. */
    async toFile(name = 'nenshkrimi.png') {
      const W = 1500, H = 600;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      for (const s of strokes) drawStroke(g, s, W, H, ink);
      const data = g.getImageData(0, 0, W, H).data;
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const pad = 18; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W, x1 + pad); y1 = Math.min(H, y1 + pad);
      const out = document.createElement('canvas'); out.width = Math.max(1, x1 - x0); out.height = Math.max(1, y1 - y0);
      out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
      const blob = await new Promise((r) => out.toBlob(r, 'image/png'));
      return new File([blob], name, { type: 'image/png' });
    },
  };
}

/* ───────── Nënshkrimi me tastierë (emri i shkruar me shkronja dore) ───────── */
export const SIG_FONTS = {
  vibes: { family: 'PP Sig Vibes', scale: 1 },
  dancing: { family: 'PP Sig Dancing', scale: 0.82 },
  caveat: { family: 'PP Sig Caveat', scale: 0.92 },
};

export const loadSigFonts = (text = 'Nënshkrimi') =>
  Promise.all(Object.values(SIG_FONTS).map((f) => document.fonts.load(`64px "${f.family}"`, text).catch(() => null)));

/** PNG transparent me emrin e shkruar me fontin e zgjedhur, i prerë rreth shkrimit. */
export async function typedSignatureFile(text, fontKey = 'vibes', { ink = INK, name = 'nenshkrimi.png' } = {}) {
  const f = SIG_FONTS[fontKey] || SIG_FONTS.vibes;
  await document.fonts.load(`120px "${f.family}"`, text).catch(() => null);
  const W = 1500, H = 600;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let size = 230 * f.scale;
  g.font = `${size}px "${f.family}", cursive`;
  const w = g.measureText(text).width;
  if (w > W * 0.9) { size *= (W * 0.9) / w; g.font = `${size}px "${f.family}", cursive`; }
  g.fillStyle = ink; g.textBaseline = 'alphabetic'; g.textAlign = 'center';
  g.fillText(text, W / 2, H * 0.68);
  const data = g.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const pad = 18; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W, x1 + pad); y1 = Math.min(H, y1 + pad);
  const out = document.createElement('canvas'); out.width = Math.max(1, x1 - x0); out.height = Math.max(1, y1 - y0);
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  const blob = await new Promise((r) => out.toBlob(r, 'image/png'));
  return new File([blob], name, { type: 'image/png' });
}
