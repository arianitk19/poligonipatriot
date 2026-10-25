import '../hero-target.js';
import { getProducts } from '../data.js';
import { productCard } from '../ui.js';

/* "Nga dyqani": në desktop armët rrëshqasin pa ndalim mbi shiritat; në telefon lëvizen me gisht. */
const list = document.querySelector('[data-featured]');
if (list) {
  getProducts({ limit: 40 })
    .then((all) => {
      const items = [...all.filter((p) => p.featured), ...all.filter((p) => !p.featured)].slice(0, 10);
      if (!items.length) { list.innerHTML = ''; return; }
      const html = items.map((p) => productCard(p)).join('');
      list.innerHTML = html + html; // kopja e dytë e bën lëvizjen të pafund
      const cards = [...list.children];
      cards.slice(items.length).forEach((li) => { li.classList.add('is-dup'); li.setAttribute('aria-hidden', 'true'); li.inert = true; });
      startRail(list, items.length);
    })
    .catch(() => { list.innerHTML = '<li class="text-steel-400">Produktet nuk u ngarkuan. Provoni sërish më vonë.</li>'; });
}

function startRail(track, count) {
  const rail = track.closest('[data-shop-rail]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let anim = null;
  let duration = 0;
  let shift = 1;
  let target = 1;
  let raf = 0;
  let resumeT = 0;

  // Ndryshim i butë i shpejtësisë (ngadalësim/ndalim kur preket ose kalon miu sipër)
  const ease = () => {
    if (!anim) return;
    const r = anim.playbackRate + (target - anim.playbackRate) * 0.08;
    anim.updatePlaybackRate(Math.abs(r - target) < 0.01 ? target : r);
    raf = Math.abs(r - target) < 0.01 ? 0 : requestAnimationFrame(ease);
  };
  const setSpeed = (v) => { target = v; if (!raf) raf = requestAnimationFrame(ease); };

  const build = () => {
    const t = anim ? anim.currentTime : 0;
    anim?.cancel(); anim = null;
    rail.classList.toggle('is-static', reduce.matches);
    if (reduce.matches) return;
    shift = track.children[count].offsetLeft - track.children[0].offsetLeft; // gjerësia e një seti
    duration = count * (innerWidth < 1024 ? 5200 : 7000);
    anim = track.animate([{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(${-shift}px,0,0)` }], { duration, iterations: Infinity });
    anim.currentTime = t % duration;
  };

  build();
  let lastW = innerWidth;
  addEventListener('resize', () => { if (innerWidth === lastW) return; lastW = innerWidth; clearTimeout(build.t); build.t = setTimeout(build, 200); });
  rail.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') setSpeed(0); });
  rail.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') setSpeed(1); });
  rail.addEventListener('focusin', () => setSpeed(0));
  rail.addEventListener('focusout', () => setSpeed(1));

  // Telefon: prek për ta ndalur, tërhiq me gisht majtas/djathtas, lësho dhe vazhdon vetë
  let sx = 0, sy = 0, st = 0, dragging = false, moved = false;
  rail.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !anim) return;
    clearTimeout(resumeT);
    target = 0; anim.updatePlaybackRate(0);
    sx = e.clientX; sy = e.clientY; st = anim.currentTime; dragging = true; moved = false;
  });
  rail.addEventListener('pointermove', (e) => {
    if (!dragging || !anim) return;
    const dx = e.clientX - sx;
    if (!moved && Math.abs(e.clientY - sy) > Math.abs(dx) && Math.abs(e.clientY - sy) > 8) { dragging = false; return; }
    if (Math.abs(dx) > 6) moved = true;
    if (moved) anim.currentTime = ((st - (dx / shift) * duration) % duration + duration) % duration;
  });
  const release = () => {
    if (!anim) return;
    dragging = false;
    clearTimeout(resumeT);
    resumeT = setTimeout(() => setSpeed(1), 1400);
  };
  rail.addEventListener('pointerup', release);
  rail.addEventListener('pointercancel', release);
  rail.addEventListener('click', (e) => { if (moved) { e.preventDefault(); moved = false; } }, true);

  // pa lëvizje kur seksioni nuk shihet
  new IntersectionObserver(([e]) => { if (anim) (e.isIntersecting ? anim.play() : anim.pause()); }).observe(rail);
}
