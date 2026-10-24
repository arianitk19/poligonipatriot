// Shenjestra në hero: e pastër në fillim; çdo klikim (desktop) ose prekje (telefon) lë një goditje.
const NS = 'http://www.w3.org/2000/svg';
const MAX_HITS = 14;

const hero = document.querySelector('[data-hero]');
const svg = hero?.querySelector('.hero-target');
const layer = svg?.querySelector('[data-hits]');

if (hero && svg && layer) {
  const art = hero.querySelector('.hero-art');
  const readout = svg.querySelector('[data-hit-readout]');
  const coarse = matchMedia('(hover: none)').matches;
  const hint = coarse ? 'PREKNI SHENJËN' : 'KLIKONI MBI SHENJË';
  let shots = 0;
  let total = 0;
  if (readout) readout.textContent = hint;

  // Pika e klikimit në koordinatat e SVG-së (qendra e shenjës = 0,0)
  const toSvg = (x, y) => {
    const pt = svg.createSVGPoint();
    pt.x = x; pt.y = y;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  // Pikët sipas unazave ISSF: unaza n ka rreze 25·(11−n)
  const scoreOf = (r) => (r > 250 ? 0 : Math.min(10, 11 - Math.ceil(Math.max(r, 0.01) / 25)));

  const el = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };

  function shoot(x, y) {
    const r = Math.hypot(x, y);
    const score = scoreOf(r);
    const inRed = r <= 100;
    shots += 1;
    total += score;

    // vrima duket njësoj e madhe në ekran, edhe kur shenja është më e vogël (telefon)
    const k = Math.min(1.8, Math.max(1, 640 / (svg.getBoundingClientRect().width || 640)));
    const g = el('g', { class: 'hit', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(2)})` });
    g.append(el('circle', { class: 'hit-wave', r: 6 }));

    // Fijet e letrës që shqyhen rreth vrimës
    const hole = el('g', { class: 'hit-hole' });
    hole.append(el('circle', { r: 7.4, fill: '#fff', 'fill-opacity': inRed ? 0.2 : 0.13 }));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random() * 0.8;
      const l = 7 + Math.random() * 3.4;
      hole.append(el('path', { d: `M${(Math.cos(a) * 5.2).toFixed(2)} ${(Math.sin(a) * 5.2).toFixed(2)}L${(Math.cos(a) * l).toFixed(2)} ${(Math.sin(a) * l).toFixed(2)}`, stroke: '#fff', 'stroke-opacity': 0.35, 'stroke-width': 0.55 }));
    }
    hole.append(el('circle', { r: 5.2, fill: '#0a0a0b' }));
    hole.append(el('circle', { r: 5.2, stroke: '#fff', 'stroke-opacity': 0.55, 'stroke-width': 0.6 }));
    g.append(hole);

    // Shkëndija
    const sparks = el('g', { class: 'hit-sparks' });
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const wrap = el('g', { transform: `rotate(${((a * 180) / Math.PI).toFixed(0)})` });
      const s = el('path', { d: 'M0 0H5', stroke: i % 3 ? '#fff' : '#ff6a4d', 'stroke-width': 0.9, 'stroke-linecap': 'round' });
      s.style.setProperty('--dx', `${(14 + Math.random() * 14).toFixed(0)}px`);
      wrap.append(s);
      sparks.append(wrap);
    }
    g.append(sparks);
    g.append(el('circle', { class: 'hit-flash', r: 10 }));

    const label = el('text', { class: `hit-score${score === 10 ? ' is-ten' : ''}`, y: -16, 'text-anchor': 'middle' });
    label.textContent = score ? String(score) : 'JASHTË';
    g.append(label);

    layer.append(g);
    while (layer.children.length > MAX_HITS) {
      const old = layer.firstElementChild;
      if (old.classList.contains('is-out')) { old.remove(); continue; }
      old.classList.add('is-out');
      setTimeout(() => old.remove(), 600);
      break;
    }

    if (art) {
      art.classList.remove('is-hit');
      void art.offsetWidth; // rinis animacionin
      art.classList.add('is-hit');
    }
    if (readout) readout.textContent = `${shots} GODITJE · ${total} PIKË`;
    if (coarse && navigator.vibrate) navigator.vibrate(8);
  }

  hero.addEventListener('click', (e) => {
    if (e.target.closest('a, button, input, label, select, textarea, [data-status-chip]')) return;
    if (String(getSelection?.() || '').length) return;
    const p = toSvg(e.clientX, e.clientY);
    if (Math.hypot(p.x, p.y) > 262) return; // jashtë shenjës
    shoot(p.x, p.y);
  });

  // Kursori "shënjestër" mbi shenjë (desktop)
  if (!coarse) {
    let raf = 0;
    hero.addEventListener('pointermove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const p = toSvg(e.clientX, e.clientY);
        const over = Math.hypot(p.x, p.y) <= 262 && !e.target.closest('a, button, [data-status-chip]');
        hero.classList.toggle('is-aiming', over);
      });
    });
    hero.addEventListener('pointerleave', () => hero.classList.remove('is-aiming'));
  }
}
