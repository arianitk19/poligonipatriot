// Black Friday në ballinë: numëruesi dhe skena me armët që ndërrohen vetë.
import { BF_ITEMS, bfActive, bfName, eur, startCountdown } from '../black-friday-data.js';
import { esc } from '../ui.js';

const sec = document.querySelector('[data-bf-home]');
if (sec && bfActive()) {
  startCountdown(sec.querySelector('[data-bf-count]'), () => sec.remove());

  const stage = sec.querySelector('[data-bf-stage]');
  const dots = sec.querySelector('[data-bf-dots]');
  const DUR = 4200;
  stage.innerHTML = BF_ITEMS.map((it, i) => `
    <a class="bf-slide${it.type === 'pa-vijaska' ? ' is-long' : ''}" href="/black-friday/#${esc(it.id)}" aria-label="${esc(bfName(it))}, ${esc(eur(it.price))} në vend të ${esc(eur(it.old))}" ${i ? 'tabindex="-1"' : ''}>
      <div class="bf-slide-media">
        <img src="${esc(it.img)}" alt="" ${i > 1 ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">
        <span class="bf-slide-off"><b>−${it.pct}%</b><small>ZBRITJE</small></span>
      </div>
      <div class="bf-slide-info">
        <div><p>${esc(it.brand)}</p><h3>${esc(it.model)}</h3></div>
        <div class="bf-slide-price"><s>${esc(eur(it.old))}</s><b class="bf-red">${esc(eur(it.price))}</b></div>
      </div>
    </a>`).join('');
  dots.innerHTML = BF_ITEMS.map((it, i) => `<button type="button" aria-label="${esc(bfName(it))}" style="--dur:${DUR}ms"><i></i></button>`).join('');

  const slides = [...stage.children];
  const btns = [...dots.children];
  let cur = -1, timer = 0, paused = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const show = (n) => {
    cur = (n + slides.length) % slides.length;
    slides.forEach((s, i) => { s.classList.toggle('is-on', i === cur); s.tabIndex = i === cur ? 0 : -1; });
    btns.forEach((b, i) => { b.classList.remove('is-on'); b.classList.toggle('is-done', i < cur); });
    void btns[cur].offsetWidth; btns[cur].classList.add('is-on');
    clearTimeout(timer);
    if (!paused && !reduce) timer = setTimeout(() => show(cur + 1), DUR);
  };
  btns.forEach((b, i) => b.addEventListener('click', () => show(i)));
  // ndalet kur seksioni nuk shihet, vazhdon kur kthehet
  new IntersectionObserver(([e]) => { paused = !e.isIntersecting; if (paused) clearTimeout(timer); else show(cur); }).observe(stage);
  show(0);
}
