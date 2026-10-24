// Paneli admin i Poligonit Patriot — vetëm për administratorët e regjistruar në tabelën public.admins.
import { CONFIG, isSupabaseConfigured } from '../config.js';
import { getClient } from '../data.js';
import { $, $$, esc, toast, confirmBox, slugify, fmtDate, toWebp, rid, uploadMedia, removeMedia, errMsg, badge, mediaUrl, PROGRAMS, REASONS, STATUS, loginEmailFrom, userLabel } from './lib.js';

const app = $('#app');
let sb = null;
let user = null;
let categories = [];

/* ───────────────────────── Paraqitja ───────────────────────── */
const NAV = [
  ['#/', 'Përmbledhja', 'i-grid', 'dash'],
  ['#/produktet', 'Produktet', 'i-box', 'products'],
  ['#/kategorite', 'Kategoritë', 'i-tag', 'categories'],
  ['#/galeria', 'Galeria', 'i-image', 'gallery'],
  ['#/aplikimet', 'Aplikimet', 'i-cert', 'applications'],
  ['#/mesazhet', 'Mesazhet', 'i-inbox', 'messages'],
  ['#/cilesimet', 'Cilësimet', 'i-gear', 'settings'],
  ['#/siguria', 'Siguria', 'i-lock', 'security'],
];

function shell(active) {
  if ($('[data-shell]')) {
    $$('[data-navkey]').forEach((a) => a.toggleAttribute('aria-current', a.dataset.navkey === active));
    return $('#view');
  }
  app.innerHTML = `
  <div class="a-shell" data-shell>
    <aside class="a-side" data-side>
      <a href="#/" class="flex items-center gap-3 px-3 pt-2 pb-6"><img src="/assets/img/brand/logo-light.webp" alt="Poligoni Patriot" class="h-8 w-auto"><span class="text-xs text-steel-400 mt-1">Paneli</span></a>
      <nav class="grid gap-1" aria-label="Paneli">
        ${NAV.map(([h, l, i, k]) => `<a class="a-nav" href="${h}" data-navkey="${k}" ${k === active ? 'aria-current="page"' : ''}><svg aria-hidden="true"><use href="#${i}"/></svg><span>${l}</span><span class="a-count" data-count="${k}"></span></a>`).join('')}
      </nav>
      <div class="mt-auto grid gap-2 pt-6 border-t border-steel-800">
        <a class="a-nav" href="/" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-arrow-ur"/></svg><span>Hap faqen</span></a>
        <button class="a-nav" type="button" data-logout><svg aria-hidden="true"><use href="#i-out"/></svg><span>Dil</span></button>
        <p class="px-3 pt-2 text-xs text-steel-400 truncate t-spec">${esc(userLabel(user))}</p>
      </div>
    </aside>
    <div class="a-main">
      <header class="a-top"><button type="button" class="btn btn-ghost btn-sm lg:hidden" data-menu-toggle aria-label="Menyja">Menyja</button><img src="/assets/img/brand/logo-light.webp" alt="" class="h-7 lg:hidden"></header>
      <main id="view" class="a-view"></main>
    </div>
  </div>`;
  $('[data-logout]').addEventListener('click', async () => { await sb.auth.signOut(); location.hash = '#/'; boot(); });
  $('[data-menu-toggle]').addEventListener('click', () => $('[data-side]').classList.toggle('is-open'));
  $$('.a-nav').forEach((a) => a.addEventListener('click', () => $('[data-side]').classList.remove('is-open')));
  return $('#view');
}

async function refreshCounts() {
  const { data } = await sb.from('admin_stats').select('*').maybeSingle();
  if (!data) return;
  const set = (k, n) => { const el = $(`[data-count="${k}"]`); if (el) { el.textContent = n || ''; el.hidden = !n; } };
  set('applications', data.applications_new);
  set('messages', data.messages_new);
  return data;
}

const head = (title, actions = '', sub = '') => `
  <div class="flex flex-wrap items-end justify-between gap-4 mb-8">
    <div><h1 class="t-h2">${title}</h1>${sub ? `<p class="mt-2 text-steel-400">${sub}</p>` : ''}</div>
    <div class="flex flex-wrap gap-2">${actions}</div>
  </div>`;

/* ───────────────────────── Hyrja ───────────────────────── */
function authCard(inner) {
  app.innerHTML = `
  <div class="min-h-dvh grid place-items-center px-4 py-12">
    <div class="w-full max-w-sm">
      <img src="/assets/img/brand/logo-light.webp" alt="Poligoni Patriot" class="h-10 w-auto mx-auto mb-10">
      <div class="rounded-xl border border-steel-800 bg-steel-900 p-7">${inner}</div>
      <p class="mt-6 text-center text-xs text-steel-400">Qasje vetëm për administratorët.</p>
    </div>
  </div>`;
}

function viewSetup() {
  authCard(`
    <h1 class="t-h3">Supabase nuk është lidhur</h1>
    <p class="mt-3 text-sm text-steel-300">Vendosni <b>supabaseUrl</b> dhe <b>supabaseAnonKey</b> te <code class="text-bone">public/assets/js/config.js</code>, ekzekutoni <code class="text-bone">supabase/schema.sql</code> dhe rindërtoni faqen. Udhëzimet e plota janë te README.md.</p>`);
}

function viewLogin(msg = '') {
  let last = '';
  try { last = localStorage.getItem('pp:admin-phone') || ''; } catch { /* */ }
  authCard(`
    <form class="grid gap-5" data-login novalidate>
      <h1 class="t-h3">Hyr në panel</h1>
      <label class="field"><span>Emaili ose numri i telefonit</span>
        <span class="relative block">
          <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-steel-400 pointer-events-none" aria-hidden="true"><use href="#i-mail"/></svg>
          <input class="input !pl-11" type="text" name="phone" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="emri@gmail.com ose 049 123 456" value="${esc(last)}" required>
        </span>
      </label>
      <label class="field"><span>Fjalëkalimi</span>
        <span class="relative block">
          <input class="input !pr-12" type="password" name="password" autocomplete="current-password" required>
          <button type="button" class="absolute right-1.5 top-1/2 -translate-y-1/2 a-icon" aria-label="Shfaq fjalëkalimin" data-eye><svg aria-hidden="true"><use href="#i-eye"/></svg></button>
        </span>
      </label>
      <p class="field-error" data-err ${msg ? '' : 'hidden'}>${esc(msg)}</p>
      <button class="btn btn-primary" type="submit">Hyr</button>
    </form>`);
  const f = $('[data-login]');
  const err = $('[data-err]', f);
  (last ? f.password : f.phone).focus();
  $('[data-eye]', f).addEventListener('click', (e) => {
    const show = f.password.type === 'password';
    f.password.type = show ? 'text' : 'password';
    e.currentTarget.setAttribute('aria-label', show ? 'Fshih fjalëkalimin' : 'Shfaq fjalëkalimin');
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const login = loginEmailFrom(f.phone.value);
    if (!login) { err.textContent = 'Shkruani emailin ose numrin e plotë, p.sh. 049 123 456.'; err.hidden = false; f.phone.focus(); return; }
    if (!f.password.value) { err.textContent = 'Shkruani fjalëkalimin.'; err.hidden = false; f.password.focus(); return; }
    const b = $('button[type=submit]', f); b.setAttribute('aria-busy', 'true');
    const { error } = await sb.auth.signInWithPassword({ email: login, password: f.password.value });
    b.removeAttribute('aria-busy');
    if (error) {
      err.textContent = /Invalid login credentials/i.test(error.message) ? 'Emaili/numri ose fjalëkalimi nuk janë të saktë.' : errMsg(error);
      err.hidden = false; f.password.select(); return;
    }
    try { localStorage.setItem('pp:admin-phone', f.phone.value.trim()); } catch { /* */ }
    boot();
  });
}

function viewMfa(factors) {
  const f0 = factors[0];
  authCard(`
    <form class="grid gap-5" data-mfa>
      <h1 class="t-h3">Verifikimi me dy hapa</h1>
      <p class="text-sm text-steel-300">Shkruani kodin 6-shifror nga aplikacioni authenticator.</p>
      <label class="field"><span>Kodi</span><input class="input t-spec text-2xl tracking-[0.4em] text-center" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required autofocus></label>
      <p class="field-error" data-err hidden></p>
      <button class="btn btn-primary" type="submit">Verifiko</button>
      <button class="text-sm text-steel-400 hover:text-bone" type="button" data-cancel>Dil</button>
    </form>`);
  const f = $('[data-mfa]');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: f0.id, code: f.code.value.trim() });
    if (error) { const el = $('[data-err]', f); el.textContent = errMsg(error); el.hidden = false; f.code.select(); return; }
    boot();
  });
  $('[data-cancel]', f).addEventListener('click', async () => { await sb.auth.signOut(); boot(); });
}

/* ───────────────────────── Përmbledhja ───────────────────────── */
async function viewDash() {
  const v = shell('dash');
  v.innerHTML = head('Përmbledhja', `<a class="btn btn-primary btn-sm" href="#/produktet/i-ri"><svg aria-hidden="true"><use href="#i-plus"/></svg>Produkt i ri</a>`, 'Mirë se erdhe.') + '<div class="skel h-40"></div>';
  const [stats, apps, msgs] = await Promise.all([
    refreshCounts(),
    sb.from('applications').select('id,full_name,program,status,created_at').order('created_at', { ascending: false }).limit(5),
    sb.from('messages').select('id,name,reasons,status,created_at').order('created_at', { ascending: false }).limit(5),
  ]);
  const s = stats || {};
  const card = (n, l, h) => `<a href="${h}" class="a-stat"><span class="t-spec text-4xl font-bold">${n ?? 0}</span><span class="text-steel-400 text-sm">${l}</span></a>`;
  const rows = (list, kind, href) => list.length ? list.map((r) => `
      <a href="${href}/${r.id}" class="a-row"><span class="font-semibold truncate">${esc(r.full_name || r.name)}</span><span class="text-sm text-steel-400 truncate">${esc(kind === 'applications' ? PROGRAMS[r.program] : (r.reasons || []).map((x) => REASONS[x] || x).join(', '))}</span><span class="text-xs text-steel-400 whitespace-nowrap">${fmtDate(r.created_at)}</span>${badge(kind, r.status)}</a>`).join('') : '<p class="p-5 text-sm text-steel-400">Asgjë ende.</p>';
  v.innerHTML = head('Përmbledhja', `<a class="btn btn-primary btn-sm" href="#/produktet/i-ri"><svg aria-hidden="true"><use href="#i-plus"/></svg>Produkt i ri</a>`, 'Mirë se erdhe.') + `
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
      ${card(s.applications_new, 'Aplikime të reja', '#/aplikimet')}
      ${card(s.messages_new, 'Mesazhe të reja', '#/mesazhet')}
      ${card(s.products_published, `Produkte të publikuara (nga ${s.products ?? 0})`, '#/produktet')}
      ${card(s.gallery, 'Foto në galeri', '#/galeria')}
    </div>
    <div class="mt-10 grid xl:grid-cols-2 gap-6">
      <section class="a-panel"><div class="a-panel-h"><h2 class="font-semibold">Aplikimet e fundit</h2><a class="text-sm link-u" href="#/aplikimet">Të gjitha</a></div>${rows(apps.data || [], 'applications', '#/aplikimet')}</section>
      <section class="a-panel"><div class="a-panel-h"><h2 class="font-semibold">Mesazhet e fundit</h2><a class="text-sm link-u" href="#/mesazhet">Të gjitha</a></div>${rows(msgs.data || [], 'messages', '#/mesazhet')}</section>
    </div>`;
}

/* ───────────────────────── Produktet ───────────────────────── */
async function loadCategories() {
  const { data, error } = await sb.from('categories').select('*').order('sort');
  if (error) throw error;
  categories = data;
  return data;
}

async function viewProducts() {
  const v = shell('products');
  v.innerHTML = head('Produktet', `<a class="btn btn-primary btn-sm" href="#/produktet/i-ri"><svg aria-hidden="true"><use href="#i-plus"/></svg>Produkt i ri</a>`) + '<div class="skel h-96"></div>';
  const [{ data: list, error }] = await Promise.all([sb.from('products').select('*').order('sort').order('name'), loadCategories()]);
  if (error) { v.innerHTML = `<p class="field-error">${esc(errMsg(error))}</p>`; return; }
  const catName = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  v.innerHTML = head('Produktet', `<a class="btn btn-primary btn-sm" href="#/produktet/i-ri"><svg aria-hidden="true"><use href="#i-plus"/></svg>Produkt i ri</a>`, `${list.length} produkte gjithsej`) + `
    <div class="flex flex-wrap gap-3 mb-5">
      <input class="input !min-h-11 max-w-xs" type="search" placeholder="Kërko…" data-q>
      <select class="input !min-h-11 max-w-[14rem]" data-cat><option value="">Të gjitha kategoritë</option>${categories.map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join('')}</select>
    </div>
    <div class="a-panel overflow-x-auto">
      <table class="a-table">
        <thead><tr><th></th><th>Produkti</th><th>Kategoria</th><th class="text-right">Çmimi</th><th>Publikuar</th><th>Në ballinë</th><th>Në stok</th><th></th></tr></thead>
        <tbody data-rows></tbody>
      </table>
    </div>`;
  const tbody = $('[data-rows]', v);
  const draw = () => {
    const q = $('[data-q]', v).value.toLowerCase();
    const c = $('[data-cat]', v).value;
    const rows = list.filter((p) => (!c || p.category_slug === c) && (!q || `${p.name} ${p.brand} ${p.caliber}`.toLowerCase().includes(q)));
    tbody.innerHTML = rows.map((p) => `
      <tr data-id="${p.id}">
        <td><div class="a-thumb">${p.images?.[0] ? `<img src="${esc(mediaUrl(p.images[0]))}" alt="" loading="lazy">` : ''}</div></td>
        <td><a class="font-semibold hover:underline" href="#/produktet/${p.id}">${esc(p.name)}</a><div class="text-xs text-steel-400">${esc([p.brand, p.caliber].filter(Boolean).join(' · '))}</div></td>
        <td class="text-sm text-steel-300">${esc(catName[p.category_slug] || '—')}</td>
        <td class="text-right t-spec">${p.price != null ? `${Number(p.price).toLocaleString('de-DE')} €${p.show_price ? '' : ' <span class="text-steel-400">(fshehur)</span>'}` : '—'}</td>
        ${['published', 'featured', 'in_stock'].map((k) => `<td><label class="a-switch"><input type="checkbox" data-toggle="${k}" ${p[k] ? 'checked' : ''}><span></span></label></td>`).join('')}
        <td class="whitespace-nowrap text-right">
          <a class="a-icon" href="#/produktet/${p.id}" title="Ndrysho" aria-label="Ndrysho"><svg><use href="#i-edit"/></svg></a>
          <button class="a-icon" type="button" data-dup title="Kopjo" aria-label="Kopjo"><svg><use href="#i-copy"/></svg></button>
          <button class="a-icon hover:text-patriot" type="button" data-del title="Fshi" aria-label="Fshi"><svg><use href="#i-trash"/></svg></button>
        </td>
      </tr>`).join('') || '<tr><td colspan="8" class="p-8 text-center text-steel-400">Asnjë produkt nuk përputhet me kërkimin.</td></tr>';
  };
  draw();
  $('[data-q]', v).addEventListener('input', draw);
  $('[data-cat]', v).addEventListener('change', draw);
  tbody.addEventListener('change', async (e) => {
    const t = e.target.closest('[data-toggle]'); if (!t) return;
    const id = t.closest('tr').dataset.id; const k = t.dataset.toggle;
    const { error: er } = await sb.from('products').update({ [k]: t.checked }).eq('id', id);
    if (er) { t.checked = !t.checked; toast(errMsg(er)); return; }
    list.find((p) => p.id === id)[k] = t.checked;
    toast('U ruajt.');
  });
  tbody.addEventListener('click', async (e) => {
    const tr = e.target.closest('tr'); if (!tr) return;
    const p = list.find((x) => x.id === tr.dataset.id);
    if (e.target.closest('[data-del]')) {
      if (!(await confirmBox('Fshi produktin?', `"${p.name}" do të fshihet përgjithmonë bashkë me fotot e ngarkuara.`, 'Fshi'))) return;
      const { error: er } = await sb.from('products').delete().eq('id', p.id);
      if (er) return toast(errMsg(er));
      await removeMedia(sb, p.images || []);
      list.splice(list.indexOf(p), 1); draw(); toast('Produkti u fshi.');
    }
    if (e.target.closest('[data-dup]')) {
      const { id, created_at, updated_at, ...rest } = p;
      const copy = { ...rest, slug: `${p.slug}-kopje-${rid().slice(-4)}`, name: `${p.name} (kopje)`, published: false, images: (p.images || []).filter((x) => x.startsWith('/')) };
      const { data, error: er } = await sb.from('products').insert(copy).select().single();
      if (er) return toast(errMsg(er));
      location.hash = `#/produktet/${data.id}`;
    }
  });
}

async function viewProductEdit(id) {
  const v = shell('products');
  v.innerHTML = '<div class="skel h-[32rem]"></div>';
  await loadCategories();
  let p = { name: '', slug: '', brand: '', category_slug: categories[0]?.slug || null, origin: '', caliber: '', capacity: '', barrel_length: '', weight: '', action: '', description: '', price: null, show_price: true, images: [], in_stock: true, featured: false, published: true, sort: 0 };
  const isNew = id === 'i-ri';
  if (!isNew) {
    const { data, error } = await sb.from('products').select('*').eq('id', id).maybeSingle();
    if (error || !data) { v.innerHTML = `<p class="field-error">Produkti nuk u gjet.</p>`; return; }
    p = data;
  }
  const images = [...(p.images || [])];
  const uploaded = [];
  let slugTouched = !isNew;
  const inp = (name, label, val, extra = '') => `<label class="field"><span>${label}</span><input class="input" name="${name}" value="${esc(val ?? '')}" ${extra}></label>`;

  v.innerHTML = head(isNew ? 'Produkt i ri' : esc(p.name), `${!isNew && p.published ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="/dyqani/produkt/?p=${esc(p.slug)}"><svg aria-hidden="true"><use href="#i-eye"/></svg>Shiko në faqe</a>` : ''}`) + `
  <form class="grid xl:grid-cols-[1fr_22rem] gap-6" data-form novalidate>
    <div class="grid gap-6">
      <section class="a-panel p-6 grid gap-5">
        <div class="grid sm:grid-cols-2 gap-5">
          ${inp('name', 'Emri *', p.name, 'required maxlength="140"')}
          ${inp('slug', 'Slug (URL) *', p.slug, 'required pattern="[a-z0-9-]+" maxlength="80"')}
        </div>
        <div class="grid sm:grid-cols-2 gap-5">
          ${inp('brand', 'Marka', p.brand, 'maxlength="60" list="brands"')}
          <label class="field"><span>Kategoria</span><select class="input" name="category_slug">${categories.map((c) => `<option value="${esc(c.slug)}" ${c.slug === p.category_slug ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>Përshkrimi</span><textarea class="input" name="description" maxlength="6000" rows="6" placeholder="Paragrafë të ndarë me rresht bosh">${esc(p.description || '')}</textarea></label>
      </section>
      <section class="a-panel p-6 grid gap-5">
        <h2 class="font-semibold">Specifikat</h2>
        <div class="grid sm:grid-cols-3 gap-5">
          ${inp('caliber', 'Kalibri', p.caliber, 'placeholder="9x19mm"')}
          ${inp('capacity', 'Karikatori (fishekë)', p.capacity, 'placeholder="15"')}
          ${inp('origin', 'Origjina', p.origin, 'placeholder="Çeki"')}
          ${inp('barrel_length', 'Gjatësia e tytës', p.barrel_length, 'placeholder="102 mm"')}
          ${inp('weight', 'Pesha', p.weight, 'placeholder="720 g"')}
          ${inp('action', 'Mekanizmi', p.action, 'placeholder="Gjysmë-automatik"')}
        </div>
      </section>
      <section class="a-panel p-6 grid gap-5">
        <div class="flex items-center justify-between gap-4"><h2 class="font-semibold">Fotot</h2><span class="text-xs text-steel-400">E para është foto kryesore. Konvertohen automatikisht në WebP.</span></div>
        <div class="grid grid-cols-3 sm:grid-cols-5 gap-3" data-imgs></div>
        <label class="drop" data-drop><input type="file" accept="image/*" multiple class="sr-only" data-file><span class="drop-ui"><svg aria-hidden="true"><use href="#i-image"/></svg><b>Shto foto</b><small data-up-status>Zgjidhni ose tërhiqni fotot këtu</small></span></label>
      </section>
    </div>
    <div class="grid gap-6 content-start xl:sticky xl:top-6">
      <section class="a-panel p-6 grid gap-5">
        <label class="field"><span>Çmimi (€)</span><input class="input t-spec" name="price" type="number" min="0" step="0.01" value="${p.price ?? ''}" placeholder="Bosh = Çmimi në dyqan"></label>
        <label class="a-check"><input type="checkbox" name="show_price" ${p.show_price ? 'checked' : ''}>Shfaq çmimin në faqe</label>
        <label class="a-check"><input type="checkbox" name="in_stock" ${p.in_stock ? 'checked' : ''}>Në stok</label>
        <label class="a-check"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}>Shfaq në ballinë</label>
        <label class="a-check"><input type="checkbox" name="published" ${p.published ? 'checked' : ''}>Publikuar</label>
        ${inp('sort', 'Renditja (numër më i vogël = më lart)', p.sort, 'type="number" step="1"')}
      </section>
      <p class="field-error" data-err hidden></p>
      <div class="grid gap-3">
        <button class="btn btn-primary" type="submit">${isNew ? 'Krijo produktin' : 'Ruaj ndryshimet'}</button>
        <button class="btn btn-ghost" type="button" data-cancel>Anulo</button>
      </div>
    </div>
    <datalist id="brands">${['Glock', 'CZ', 'Beretta', 'Sig Sauer', 'Canik', 'Smith & Wesson', 'Ruger', 'Taurus', 'Arex', 'Sarsılmaz', 'Shadow Systems'].map((b) => `<option value="${b}">`).join('')}</datalist>
  </form>`;

  const f = $('[data-form]', v);
  const imgBox = $('[data-imgs]', v);
  const drawImgs = () => {
    imgBox.innerHTML = images.map((src, i) => `
      <div class="a-img ${i === 0 ? 'is-main' : ''}">
        <img src="${esc(mediaUrl(src))}" alt="">
        <div class="a-img-tools">
          <button type="button" data-move="${i}" data-dir="-1" aria-label="Lëviz majtas" ${i === 0 ? 'disabled' : ''}><svg class="-rotate-90"><use href="#i-up"/></svg></button>
          <button type="button" data-move="${i}" data-dir="1" aria-label="Lëviz djathtas" ${i === images.length - 1 ? 'disabled' : ''}><svg class="rotate-90"><use href="#i-up"/></svg></button>
          <button type="button" data-rm="${i}" aria-label="Hiq foton"><svg><use href="#i-trash"/></svg></button>
        </div>
      </div>`).join('') || '<p class="col-span-full text-sm text-steel-400">Ende pa foto.</p>';
  };
  drawImgs();
  imgBox.addEventListener('click', (e) => {
    const m = e.target.closest('[data-move]'); const r = e.target.closest('[data-rm]');
    if (m) { const i = +m.dataset.move; const j = i + +m.dataset.dir; [images[i], images[j]] = [images[j], images[i]]; drawImgs(); }
    if (r) { images.splice(+r.dataset.rm, 1); drawImgs(); }
  });

  f.name.addEventListener('input', () => { if (!slugTouched) f.slug.value = slugify(f.name.value); });
  f.slug.addEventListener('input', () => { slugTouched = true; f.slug.value = slugify(f.slug.value).replace(/-$/, '') + (f.slug.value.endsWith('-') ? '-' : ''); });

  const status = $('[data-up-status]', v);
  const handleFiles = async (files) => {
    const list = [...files].filter((x) => x.type.startsWith('image/'));
    if (!list.length) return;
    const base = slugify(f.slug.value || f.name.value) || 'produkt';
    for (const [n, file] of list.entries()) {
      status.textContent = `Duke ngarkuar ${n + 1} nga ${list.length}…`;
      try {
        const { blob } = await toWebp(file, 1600, 0.86);
        const path = await uploadMedia(sb, `products/${base}-${rid()}.webp`, blob);
        images.push(path); uploaded.push(path); drawImgs();
      } catch (er) { toast(errMsg(er)); }
    }
    status.textContent = 'Zgjidhni ose tërhiqni fotot këtu';
  };
  const drop = $('[data-drop]', v);
  $('[data-file]', v).addEventListener('change', (e) => { handleFiles(e.target.files); e.target.value = ''; });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); });

  $('[data-cancel]', v).addEventListener('click', async () => { await removeMedia(sb, uploaded.filter((x) => !(p.images || []).includes(x))); location.hash = '#/produktet'; });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('[data-err]', v); err.hidden = true;
    const val = (k) => (f[k].value.trim() || null);
    const row = {
      name: f.name.value.trim(), slug: slugify(f.slug.value), brand: val('brand'), category_slug: f.category_slug.value || null,
      caliber: val('caliber'), capacity: val('capacity'), origin: val('origin'), barrel_length: val('barrel_length'), weight: val('weight'), action: val('action'),
      description: val('description'), price: f.price.value === '' ? null : Number(f.price.value), show_price: f.show_price.checked,
      in_stock: f.in_stock.checked, featured: f.featured.checked, published: f.published.checked, sort: Number(f.sort.value || 0), images,
    };
    if (!row.name || !row.slug) { err.textContent = 'Emri dhe slug-u janë të detyrueshëm.'; err.hidden = false; return; }
    const b = $('button[type=submit]', f); b.setAttribute('aria-busy', 'true');
    const q = isNew ? sb.from('products').insert(row).select().single() : sb.from('products').update(row).eq('id', p.id).select().single();
    const { data, error } = await q;
    b.removeAttribute('aria-busy');
    if (error) { err.textContent = errMsg(error); err.hidden = false; return; }
    const removed = (p.images || []).filter((x) => !images.includes(x));
    await removeMedia(sb, removed);
    uploaded.length = 0;
    toast(isNew ? 'Produkti u krijua.' : 'Ndryshimet u ruajtën.');
    if (isNew) location.hash = `#/produktet/${data.id}`; else { p = data; }
  });
}

/* ───────────────────────── Kategoritë ───────────────────────── */
async function viewCategories() {
  const v = shell('categories');
  v.innerHTML = head('Kategoritë') + '<div class="skel h-72"></div>';
  await loadCategories();
  v.innerHTML = head('Kategoritë', '', 'Emrat dhe përshkrimet shfaqen në dyqan dhe te faqja e shitjes.') + `
    <div class="grid gap-4" data-list>
      ${categories.map((c) => `
      <form class="a-panel p-5 grid md:grid-cols-[7rem_1fr_6rem_auto] gap-4 items-start" data-slug="${esc(c.slug)}">
        <label class="a-thumb !w-28 !h-20 cursor-pointer relative" title="Ndrysho foton">${c.image ? `<img src="${esc(mediaUrl(c.image))}" alt="">` : ''}<input type="file" accept="image/*" class="sr-only" data-img></label>
        <div class="grid gap-3"><input class="input !min-h-11" name="name" value="${esc(c.name)}" maxlength="80" aria-label="Emri"><textarea class="input !min-h-20" name="description" maxlength="400" aria-label="Përshkrimi">${esc(c.description || '')}</textarea><p class="text-xs text-steel-400 t-spec">/dyqani/?kategoria=${esc(c.slug)}</p></div>
        <label class="field"><span class="!text-xs">Renditja</span><input class="input !min-h-11" type="number" name="sort" value="${c.sort}"></label>
        <button class="btn btn-ghost btn-sm" type="submit">Ruaj</button>
      </form>`).join('')}
    </div>
    <form class="a-panel p-5 mt-8 grid sm:grid-cols-[1fr_1fr_auto] gap-4 items-end" data-new>
      <label class="field"><span>Emri i kategorisë së re</span><input class="input !min-h-11" name="name" required maxlength="80"></label>
      <label class="field"><span>Slug</span><input class="input !min-h-11" name="slug" required pattern="[a-z0-9-]+"></label>
      <button class="btn btn-primary btn-sm" type="submit"><svg aria-hidden="true"><use href="#i-plus"/></svg>Shto</button>
    </form>`;
  $$('[data-slug]', v).forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await sb.from('categories').update({ name: form.name.value.trim(), description: form.description.value.trim() || null, sort: Number(form.sort.value || 0) }).eq('slug', form.dataset.slug);
      toast(error ? errMsg(error) : 'Kategoria u ruajt.');
    });
    $('[data-img]', form).addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const { blob } = await toWebp(file, 1400);
        const path = await uploadMedia(sb, `categories/${form.dataset.slug}-${rid()}.webp`, blob);
        const old = categories.find((c) => c.slug === form.dataset.slug)?.image;
        const { error } = await sb.from('categories').update({ image: path }).eq('slug', form.dataset.slug);
        if (error) throw error;
        if (old) await removeMedia(sb, [old]);
        toast('Foto u ndryshua.'); viewCategories();
      } catch (er) { toast(errMsg(er)); }
    });
  });
  const nf = $('[data-new]', v);
  nf.name.addEventListener('input', () => { nf.slug.value = slugify(nf.name.value); });
  nf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await sb.from('categories').insert({ name: nf.name.value.trim(), slug: slugify(nf.slug.value), sort: (categories.at(-1)?.sort || 0) + 10 });
    if (error) return toast(errMsg(error));
    toast('Kategoria u shtua.'); viewCategories();
  });
}

/* ───────────────────────── Galeria ───────────────────────── */
async function viewGallery() {
  const v = shell('gallery');
  v.innerHTML = head('Galeria') + '<div class="skel h-96"></div>';
  const { data: items, error } = await sb.from('gallery').select('*').order('sort');
  if (error) { v.innerHTML = `<p class="field-error">${esc(errMsg(error))}</p>`; return; }
  v.innerHTML = head('Galeria', '', `${items.length} foto · Fotot e reja shtohen në fund.`) + `
    <label class="drop mb-8" data-drop><input type="file" accept="image/*" multiple class="sr-only" data-file><span class="drop-ui"><svg aria-hidden="true"><use href="#i-image"/></svg><b>Ngarko foto</b><small data-up-status>Zgjidhni ose tërhiqni disa foto njëherësh</small></span></label>
    <ul class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-4" data-grid></ul>`;
  const grid = $('[data-grid]', v);
  const draw = () => {
    grid.innerHTML = items.map((g, i) => `
      <li class="a-panel overflow-hidden ${g.published ? '' : 'opacity-50'}" data-id="${g.id}">
        <div class="aspect-square bg-steel-850"><img src="${esc(mediaUrl(g.thumb || g.src))}" alt="" loading="lazy" class="size-full object-cover"></div>
        <div class="p-3 grid gap-2">
          <input class="input !min-h-9 !py-1.5 text-sm" value="${esc(g.alt || '')}" placeholder="Përshkrimi (alt)" data-alt maxlength="200">
          <div class="flex items-center justify-between">
            <label class="a-switch" title="Publikuar"><input type="checkbox" data-pub ${g.published ? 'checked' : ''}><span></span></label>
            <div class="flex">
              <button type="button" class="a-icon" data-mv="-1" aria-label="Lëviz para" ${i === 0 ? 'disabled' : ''}><svg class="-rotate-90"><use href="#i-up"/></svg></button>
              <button type="button" class="a-icon" data-mv="1" aria-label="Lëviz pas" ${i === items.length - 1 ? 'disabled' : ''}><svg class="rotate-90"><use href="#i-up"/></svg></button>
              <button type="button" class="a-icon hover:text-patriot" data-del aria-label="Fshi"><svg><use href="#i-trash"/></svg></button>
            </div>
          </div>
        </div>
      </li>`).join('');
  };
  draw();
  const byId = (el) => items.find((g) => String(g.id) === el.closest('[data-id]').dataset.id);
  grid.addEventListener('change', async (e) => {
    const g = byId(e.target);
    if (e.target.matches('[data-alt]')) { const { error: er } = await sb.from('gallery').update({ alt: e.target.value.trim() || null }).eq('id', g.id); toast(er ? errMsg(er) : 'U ruajt.'); g.alt = e.target.value.trim(); }
    if (e.target.matches('[data-pub]')) { const { error: er } = await sb.from('gallery').update({ published: e.target.checked }).eq('id', g.id); if (er) return toast(errMsg(er)); g.published = e.target.checked; draw(); }
  });
  grid.addEventListener('click', async (e) => {
    const mv = e.target.closest('[data-mv]'); const del = e.target.closest('[data-del]');
    if (!mv && !del) return;
    const g = byId(e.target); const i = items.indexOf(g);
    if (mv) {
      const j = i + Number(mv.dataset.mv); const o = items[j]; if (!o) return;
      const [a, b] = [g.sort, o.sort === g.sort ? g.sort + Number(mv.dataset.mv) : o.sort];
      const r = await Promise.all([sb.from('gallery').update({ sort: b }).eq('id', g.id), sb.from('gallery').update({ sort: a }).eq('id', o.id)]);
      if (r.some((x) => x.error)) return toast('Renditja nuk u ruajt.');
      g.sort = b; o.sort = a; [items[i], items[j]] = [items[j], items[i]]; draw();
    }
    if (del) {
      if (!(await confirmBox('Fshi foton?', 'Fotoja do të hiqet nga galeria përgjithmonë.', 'Fshi'))) return;
      const { error: er } = await sb.from('gallery').delete().eq('id', g.id);
      if (er) return toast(errMsg(er));
      await removeMedia(sb, [g.src, g.thumb]);
      items.splice(i, 1); draw(); toast('Fotoja u fshi.');
    }
  });
  const status = $('[data-up-status]', v);
  const upload = async (files) => {
    const list = [...files].filter((x) => x.type.startsWith('image/'));
    let sort = (items.at(-1)?.sort || 0);
    for (const [n, file] of list.entries()) {
      status.textContent = `Duke ngarkuar ${n + 1} nga ${list.length}…`;
      try {
        const id = rid();
        const full = await toWebp(file, 1800, 0.84);
        const thumb = await toWebp(file, 640, 0.8);
        const src = await uploadMedia(sb, `gallery/${id}.webp`, full.blob);
        const th = await uploadMedia(sb, `gallery/thumbs/${id}.webp`, thumb.blob);
        sort += 10;
        const { data, error: er } = await sb.from('gallery').insert({ src, thumb: th, width: full.width, height: full.height, sort, alt: null }).select().single();
        if (er) throw er;
        items.push(data); draw();
      } catch (er) { toast(errMsg(er)); }
    }
    status.textContent = 'Zgjidhni ose tërhiqni disa foto njëherësh';
    if (list.length) toast(`${list.length} foto u shtuan.`);
  };
  const drop = $('[data-drop]', v);
  $('[data-file]', v).addEventListener('change', (e) => { upload(e.target.files); e.target.value = ''; });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); upload(e.dataTransfer.files); });
}

/* ───────────────────────── Kutia hyrëse: aplikimet & mesazhet ───────────────────────── */
async function viewInbox(kind, selectedId) {
  const isApp = kind === 'applications';
  const navKey = isApp ? 'applications' : 'messages';
  const base = isApp ? '#/aplikimet' : '#/mesazhet';
  const v = shell(navKey);
  const filter = sessionStorage.getItem(`pp:f:${kind}`) || 'active';
  v.innerHTML = head(isApp ? 'Aplikimet për certifikim' : 'Mesazhet e kontaktit') + '<div class="skel h-96"></div>';
  let q = sb.from(kind).select('*').order('created_at', { ascending: false }).limit(300);
  if (filter === 'active') q = q.not('status', 'in', isApp ? '(rejected,completed)' : '(archived)');
  const { data: list, error } = await q;
  if (error) { v.innerHTML = `<p class="field-error">${esc(errMsg(error))}</p>`; return; }
  refreshCounts();
  const sel = list.find((r) => r.id === selectedId) || null;
  const filters = `<div class="flex gap-2">${[['active', 'Aktive'], ['all', 'Të gjitha']].map(([k, l]) => `<button type="button" class="chip" aria-pressed="${filter === k}" data-filter="${k}">${l}</button>`).join('')}</div>`;
  v.innerHTML = head(isApp ? 'Aplikimet për certifikim' : 'Mesazhet e kontaktit', filters, `${list.length} ${isApp ? 'aplikime' : 'mesazhe'}`) + `
    <div class="grid lg:grid-cols-[minmax(0,22rem)_1fr] gap-6">
      <div class="a-panel max-h-[75vh] overflow-y-auto ${sel ? 'hidden lg:block' : ''}">
        ${list.map((r) => `<a href="${base}/${r.id}" class="a-row ${r.id === selectedId ? 'is-active' : ''}">
            <span class="font-semibold truncate">${esc(r.full_name || r.name)}</span>
            <span class="text-sm text-steel-400 truncate">${esc(isApp ? PROGRAMS[r.program] : r.message)}</span>
            <span class="text-xs text-steel-400">${fmtDate(r.created_at)}</span>${badge(kind, r.status)}</a>`).join('') || '<p class="p-6 text-sm text-steel-400">Asgjë këtu.</p>'}
      </div>
      <div data-detail>${sel ? '' : '<div class="a-panel p-10 text-center text-steel-400 hidden lg:block">Zgjidhni një rresht për ta parë.</div>'}</div>
    </div>`;
  $$('[data-filter]', v).forEach((b) => b.addEventListener('click', () => { sessionStorage.setItem(`pp:f:${kind}`, b.dataset.filter); viewInbox(kind, selectedId); }));
  if (!sel) return;

  const tel = sel.phone.replace(/[^\d+]/g, '');
  const wa = tel.replace(/^\+/, '').replace(/^0/, '383');
  const field = (k, val, spec) => `<div class="spec-row"><dt>${k}</dt><dd class="${spec ? 't-spec' : ''} break-words">${val}</dd></div>`;
  const det = $('[data-detail]', v);
  det.innerHTML = `
    <article class="a-panel p-6 grid gap-6">
      <a href="${base}" class="lg:hidden text-sm text-steel-400">‹ Kthehu te lista</a>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div><h2 class="t-h3">${esc(sel.full_name || sel.name)}</h2><p class="text-sm text-steel-400 mt-1">${fmtDate(sel.created_at)}</p></div>
        <label class="field"><span class="!text-xs">Statusi</span><select class="input !min-h-10" data-status>${Object.entries(STATUS[kind]).map(([k, [l]]) => `<option value="${k}" ${k === sel.status ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      <dl class="border-t border-steel-800">
        ${isApp ? field('Programi', esc(PROGRAMS[sel.program])) + field('Numri personal', esc(sel.id_number), true) : field('Arsyeja', esc((sel.reasons || []).map((x) => REASONS[x] || x).join(', ') || '—'))}
        ${field('Telefoni', `<a class="link-u" href="tel:${esc(tel)}">${esc(sel.phone)}</a>`, true)}
        ${field('Emaili', sel.email ? `<a class="link-u" href="mailto:${esc(sel.email)}">${esc(sel.email)}</a>` : '—')}
        ${!isApp && sel.source ? field('Dërguar nga', esc(sel.source)) : ''}
      </dl>
      ${sel.message ? `<div><h3 class="text-sm font-semibold text-steel-400 mb-2">Mesazhi</h3><p class="whitespace-pre-wrap text-steel-200">${esc(sel.message)}</p></div>` : ''}
      ${isApp ? `<div class="grid sm:grid-cols-2 gap-3">${['id_front_path', 'id_back_path'].map((k, i) => sel[k] ? `<button type="button" class="btn btn-ghost" data-doc="${esc(sel[k])}"><svg aria-hidden="true"><use href="#i-card"/></svg>Letërnjoftimi: ${i ? 'ana e pasme' : 'ana e parë'}</button>` : '').join('')}</div><p class="text-xs text-steel-400 -mt-3">Dokumentet hapen me lidhje të përkohshme që skadon pas 2 minutash.</p>` : ''}
      <label class="field"><span>Shënim i brendshëm</span><textarea class="input !min-h-24" data-note maxlength="2000" placeholder="P.sh. thirrur më 12.03, grupi i së shtunës">${esc(sel.note || '')}</textarea></label>
      <div class="flex flex-wrap gap-3">
        <a class="btn btn-primary btn-sm" href="tel:${esc(tel)}"><svg aria-hidden="true"><use href="#i-phone"/></svg>Telefono</a>
        <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/${esc(wa)}"><svg aria-hidden="true"><use href="#i-whatsapp"/></svg>WhatsApp</a>
        ${sel.email ? `<a class="btn btn-ghost btn-sm" href="mailto:${esc(sel.email)}?subject=${encodeURIComponent('Poligoni Patriot')}"><svg aria-hidden="true"><use href="#i-mail"/></svg>Email</a>` : ''}
        <button class="btn btn-ghost btn-sm ml-auto hover:!border-patriot hover:!text-patriot" type="button" data-del><svg aria-hidden="true"><use href="#i-trash"/></svg>Fshi</button>
      </div>
    </article>`;
  $('[data-status]', det).addEventListener('change', async (e) => {
    const { error: er } = await sb.from(kind).update({ status: e.target.value }).eq('id', sel.id);
    toast(er ? errMsg(er) : 'Statusi u ndryshua.'); if (!er) viewInbox(kind, sel.id);
  });
  $('[data-note]', det).addEventListener('change', async (e) => {
    const { error: er } = await sb.from(kind).update({ note: e.target.value.trim() || null }).eq('id', sel.id);
    toast(er ? errMsg(er) : 'Shënimi u ruajt.');
  });
  $$('[data-doc]', det).forEach((b) => b.addEventListener('click', async () => {
    const w = window.open('about:blank', '_blank', 'noopener');
    const { data, error: er } = await sb.storage.from(CONFIG.applicationsBucket).createSignedUrl(b.dataset.doc, 120);
    if (er) { w?.close(); return toast(errMsg(er)); }
    if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
  }));
  $('[data-del]', det).addEventListener('click', async () => {
    if (!(await confirmBox('Fshi përgjithmonë?', isApp ? 'Aplikimi dhe dokumentet e letërnjoftimit do të fshihen përgjithmonë.' : 'Mesazhi do të fshihet përgjithmonë.', 'Fshi'))) return;
    if (isApp) {
      const files = [sel.id_front_path, sel.id_back_path].filter(Boolean);
      if (files.length) { const { error: er } = await sb.storage.from(CONFIG.applicationsBucket).remove(files); if (er) return toast(errMsg(er)); }
    }
    const { error: er } = await sb.from(kind).delete().eq('id', sel.id);
    if (er) return toast(errMsg(er));
    toast('U fshi.'); location.hash = base;
  });
}

/* ───────────────────────── Cilësimet ───────────────────────── */
const DAYS = ['E diel', 'E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë'];
const toTime = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const fromTime = (t) => { const [h, m] = t.split(':').map(Number); return h + (m || 0) / 60; };

async function viewSettings() {
  const v = shell('settings');
  v.innerHTML = head('Cilësimet') + '<div class="skel h-96"></div>';
  const { data } = await sb.from('site_settings').select('value').eq('key', 'site').maybeSingle();
  const s = data?.value || {};
  const hours = s.hours || {};
  const a = s.announcement || {};
  const inp = (name, label, val, extra = '') => `<label class="field"><span>${label}</span><input class="input" name="${name}" value="${esc(val ?? '')}" ${extra}></label>`;
  v.innerHTML = head('Cilësimet', '', 'Ndryshimet shfaqen në faqe menjëherë për vizitorët e rinj.') + `
  <form class="grid xl:grid-cols-2 gap-6" data-form>
    <section class="a-panel p-6 grid gap-5 content-start">
      <h2 class="font-semibold">Kontakti</h2>
      <div class="grid sm:grid-cols-2 gap-5">
        ${inp('phone', 'Telefoni (për thirrje)', s.phone, 'placeholder="+38349394850"')}
        ${inp('phoneDisplay', 'Telefoni (si shfaqet)', s.phoneDisplay, 'placeholder="+383 49 394 850"')}
        ${inp('whatsapp', 'WhatsApp (vetëm shifra)', s.whatsapp, 'pattern="[0-9]+" placeholder="38349394850"')}
        ${inp('email', 'Emaili', s.email, 'type="email"')}
      </div>
    </section>
    <section class="a-panel p-6 grid gap-5 content-start">
      <h2 class="font-semibold">Njoftimi në krye të faqes</h2>
      <label class="a-check"><input type="checkbox" name="ann_on" ${a.text ? 'checked' : ''}>Shfaq njoftimin</label>
      ${inp('ann_text', 'Teksti', a.text, 'maxlength="160" placeholder="P.sh. Të shtunën poligoni është i rezervuar deri në 14:00"')}
      <div class="grid sm:grid-cols-2 gap-5">${inp('ann_link', 'Lidhja (opsionale)', a.link, 'placeholder="/apliko/"')}${inp('ann_linkText', 'Teksti i lidhjes', a.linkText, 'placeholder="Apliko"')}</div>
    </section>
    <section class="a-panel p-6 grid gap-4 xl:col-span-2">
      <h2 class="font-semibold">Orari i punës</h2>
      <p class="text-sm text-steel-400 -mt-2">Përdoret për "Hapur tani / Mbyllur" në të gjithë faqen.</p>
      <div class="grid gap-2">
        ${[1, 2, 3, 4, 5, 6, 0].map((d) => { const h = hours[d]; return `
        <div class="grid grid-cols-[8rem_auto_1fr_1fr] gap-3 items-center" data-day="${d}">
          <span class="font-medium">${DAYS[d]}</span>
          <label class="a-check !text-sm"><input type="checkbox" data-open ${h ? 'checked' : ''}>Hapur</label>
          <input class="input !min-h-10 t-spec" type="time" data-from value="${h ? toTime(h[0]) : '09:00'}" ${h ? '' : 'disabled'} aria-label="Hapet">
          <input class="input !min-h-10 t-spec" type="time" data-to value="${h ? toTime(h[1]) : '22:00'}" ${h ? '' : 'disabled'} aria-label="Mbyllet">
        </div>`; }).join('')}
      </div>
    </section>
    <div class="xl:col-span-2 flex justify-end"><button class="btn btn-primary" type="submit">Ruaj cilësimet</button></div>
  </form>`;
  const f = $('[data-form]', v);
  $$('[data-day]', f).forEach((row) => $('[data-open]', row).addEventListener('change', (e) => { $$('input[type=time]', row).forEach((t) => { t.disabled = !e.target.checked; }); }));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hrs = {};
    $$('[data-day]', f).forEach((row) => { hrs[row.dataset.day] = $('[data-open]', row).checked ? [fromTime($('[data-from]', row).value), fromTime($('[data-to]', row).value)] : null; });
    const wk = [1, 2, 3, 4, 5, 6].map((d) => hrs[d]);
    const same = wk.every((x) => JSON.stringify(x) === JSON.stringify(wk[0]));
    const value = {
      ...s,
      phone: f.phone.value.trim(), phoneDisplay: f.phoneDisplay.value.trim(), whatsapp: f.whatsapp.value.replace(/\D/g, ''), email: f.email.value.trim(),
      hours: hrs,
      hoursWeek: same && wk[0] ? `${toTime(wk[0][0])} – ${toTime(wk[0][1])}` : 'Sipas ditës',
      hoursSunday: hrs[0] ? `${toTime(hrs[0][0])} – ${toTime(hrs[0][1])}` : 'Mbyllur',
      announcement: f.ann_on.checked && f.ann_text.value.trim() ? { text: f.ann_text.value.trim(), link: f.ann_link.value.trim() || null, linkText: f.ann_linkText.value.trim() || null } : null,
    };
    const { error } = await sb.from('site_settings').upsert({ key: 'site', value });
    toast(error ? errMsg(error) : 'Cilësimet u ruajtën.');
  });
}

/* ───────────────────────── Siguria ───────────────────────── */
async function viewSecurity() {
  const v = shell('security');
  const { data: fl } = await sb.auth.mfa.listFactors();
  const all = fl?.all || [];
  const verified = all.filter((x) => x.status === 'verified');
  v.innerHTML = head('Siguria', '', 'Mbroni llogarinë: vetëm ju keni qasje në këtë panel.') + `
  <div class="grid xl:grid-cols-2 gap-6">
    <section class="a-panel p-6 grid gap-5 content-start">
      <h2 class="font-semibold">Verifikimi me dy hapa (2FA)</h2>
      ${verified.length
        ? `<p class="text-sm text-ok flex gap-2 items-center"><svg class="size-5"><use href="#i-shield"/></svg>Aktiv. Hyrja kërkon kodin nga aplikacioni authenticator.</p>
           ${verified.map((x) => `<div class="flex items-center justify-between gap-3 border border-steel-800 rounded-md px-4 py-3"><span>${esc(x.friendly_name || 'Authenticator')}</span><button type="button" class="btn btn-ghost btn-sm" data-unenroll="${x.id}">Çaktivizo</button></div>`).join('')}`
        : `<p class="text-sm text-steel-300">Rekomandohet fort. Përdorni Google Authenticator, Microsoft Authenticator, 1Password ose Authy.</p><button type="button" class="btn btn-primary btn-sm justify-self-start" data-enroll>Aktivizo 2FA</button><div data-enroll-box></div>`}
    </section>
    <form class="a-panel p-6 grid gap-5 content-start" data-pw>
      <h2 class="font-semibold">Ndrysho fjalëkalimin</h2>
      <label class="field"><span>Fjalëkalimi i ri (min. 8 karaktere)</span><input class="input" type="password" name="password" minlength="8" autocomplete="new-password" required></label>
      <button class="btn btn-ghost btn-sm justify-self-start" type="submit">Ruaj fjalëkalimin</button>
    </form>
  </div>`;
  // pastro faktorët e pambaruar nga tentativat e mëparshme
  for (const x of all.filter((y) => y.status !== 'verified')) await sb.auth.mfa.unenroll({ factorId: x.id });

  $('[data-enroll]', v)?.addEventListener('click', async () => {
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Paneli Patriot ${new Date().toLocaleDateString('sq-AL')}` });
    if (error) return toast(errMsg(error));
    const box = $('[data-enroll-box]', v);
    box.innerHTML = `
      <div class="grid sm:grid-cols-[11rem_1fr] gap-5 items-start">
        <img src="${data.totp.qr_code}" alt="Kodi QR për aplikacionin authenticator" class="w-44 h-44 rounded-md bg-white p-2">
        <form class="grid gap-3" data-verify>
          <p class="text-sm text-steel-300">1. Skanoni kodin QR me aplikacionin.<br>2. Shkruani kodin 6-shifror që shfaqet.</p>
          <p class="text-xs text-steel-400 break-all">Ose shkruani manualisht: <span class="t-spec text-bone">${esc(data.totp.secret)}</span></p>
          <input class="input t-spec text-xl tracking-[0.35em] text-center" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required>
          <button class="btn btn-primary btn-sm" type="submit">Verifiko dhe aktivizo</button>
        </form>
      </div>`;
    $('[data-verify]', box).addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error: er } = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code: e.target.code.value.trim() });
      if (er) return toast(errMsg(er));
      toast('2FA u aktivizua.'); viewSecurity();
    });
  });
  $$('[data-unenroll]', v).forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmBox('Çaktivizo 2FA?', 'Llogaria do të mbrohet vetëm me fjalëkalim.', 'Çaktivizo'))) return;
    const { error } = await sb.auth.mfa.unenroll({ factorId: b.dataset.unenroll });
    toast(error ? errMsg(error) : '2FA u çaktivizua.'); viewSecurity();
  }));
  $('[data-pw]', v).addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password: e.target.password.value });
    toast(error ? errMsg(error) : 'Fjalëkalimi u ndryshua.'); if (!error) e.target.reset();
  });
}

/* ───────────────────────── Ruteri ───────────────────────── */
async function route() {
  const [, a, b] = (location.hash.replace(/^#/, '') || '/').split('/');
  try {
    if (!a) return await viewDash();
    if (a === 'produktet') return b ? await viewProductEdit(b) : await viewProducts();
    if (a === 'kategorite') return await viewCategories();
    if (a === 'galeria') return await viewGallery();
    if (a === 'aplikimet') return await viewInbox('applications', b);
    if (a === 'mesazhet') return await viewInbox('messages', b);
    if (a === 'cilesimet') return await viewSettings();
    if (a === 'siguria') return await viewSecurity();
    location.hash = '#/';
  } catch (e) {
    console.error(e);
    const v = $('#view') || app;
    v.innerHTML = `<div class="a-panel p-8"><h2 class="t-h3">Diçka nuk shkoi</h2><p class="mt-3 text-steel-300">${esc(errMsg(e))}</p></div>`;
  }
}

let routed = false;
async function boot() {
  if (!isSupabaseConfigured()) return viewSetup();
  sb = sb || await getClient({ auth: true });
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return viewLogin();
  user = session.user;
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
    const { data: fl } = await sb.auth.mfa.listFactors();
    return viewMfa((fl?.totp || []).filter((x) => x.status === 'verified'));
  }
  const { data: me } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!me) {
    await sb.auth.signOut();
    return viewLogin('Kjo llogari nuk ka qasje në panel.');
  }
  if (!routed) { window.addEventListener('hashchange', route); routed = true; }
  app.innerHTML = '';
  route();
}

boot().then(() => {
  sb?.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') viewLogin();
  });
});
