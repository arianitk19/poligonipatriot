import { getProducts } from '../data.js';
import { productCard } from '../ui.js';

/* Produktet e zgjedhura */
const list = document.querySelector('[data-featured]');
if (list) {
  getProducts({ featured: true, limit: 8 })
    .then((items) => {
      if (!items.length) items = [];
      list.innerHTML = items.slice(0, 4).map((p) => productCard(p)).join('');
      list.querySelectorAll('.pcard').forEach((el) => el.classList.add('w-[17rem]', 'lg:w-auto', 'snap-start'));
    })
    .catch(() => { list.innerHTML = '<li class="text-steel-400">Produktet nuk u ngarkuan. Provoni sërish më vonë.</li>'; });
}

