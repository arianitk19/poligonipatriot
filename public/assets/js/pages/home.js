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
  const desktop = matchMedia('(min-width: 1024px)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let anim = null;
  let target = 1;
  let raf = 0;

  // Ndryshim i butë i shpejtësisë (ngadalësim kur kalon miu sipër)
  const ease = () => {
    if (!anim) return;
    const r = anim.playbackRate + (target - anim.playbackRate) * 0.08;
    anim.updatePlaybackRate(Math.abs(r - target) < 0.01 ? target : r);
    raf = Math.abs(r - target) < 0.01 ? 0 : requestAnimationFrame(ease);
  };
  const setSpeed = (v) => { target = v; if (!raf) raf = requestAnimationFrame(ease); };

  const build = () => {
    anim?.cancel(); anim = null;
    if (!desktop.matches || reduce.matches) return;
    const first = track.children[0];
    const second = track.children[count];
    const shift = second.offsetLeft - first.offsetLeft; // gjerësia e një seti, me hapësirat
    anim = track.animate([{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(${-shift}px,0,0)` }], { duration: count * 7000, iterations: Infinity });
  };

  build();
  desktop.addEventListener('change', build);
  addEventListener('resize', () => { clearTimeout(build.t); build.t = setTimeout(build, 200); });
  rail.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') setSpeed(0); });
  rail.addEventListener('pointerleave', () => setSpeed(1));
  rail.addEventListener('focusin', () => setSpeed(0));
  rail.addEventListener('focusout', () => setSpeed(1));
  // pa lëvizje kur seksioni nuk shihet
  new IntersectionObserver(([e]) => { if (anim) (e.isIntersecting ? anim.play() : anim.pause()); }).observe(rail);
}
