// Ngarkohet në <head> para faqes: shmang "kërcimin" e animacioneve dhe vendos nëse shfaqet intro-ja.
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  var seen = false;
  try { seen = sessionStorage.getItem('pp:intro') === '1'; sessionStorage.setItem('pp:intro', '1'); } catch (e) { seen = true; }
  if (seen || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) d.classList.add('no-intro');
})();
