// Shtresa e të dhënave: Supabase kur është konfiguruar, përndryshe /data/*.json.
import { CONFIG, isSupabaseConfigured } from './config.js';

let clientPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.supabase?.createClient) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Supabase SDK nuk u ngarkua'));
    document.head.appendChild(s);
  });
}

/** Klienti i Supabase (singleton). Kthen null kur nuk është konfiguruar. */
export async function getClient(options = {}) {
  if (!isSupabaseConfigured()) return null;
  if (!clientPromise) {
    clientPromise = loadScript('/assets/vendor/supabase.js').then(() =>
      window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, options.auth
        ? { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'pp-admin-auth' } }
        : { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    );
  }
  return clientPromise;
}

const jsonCache = new Map();
async function local(name) {
  if (!jsonCache.has(name)) {
    jsonCache.set(name, fetch(`/data/${name}.json`).then((r) => {
      if (!r.ok) throw new Error(`/data/${name}.json mungon`);
      return r.json();
    }));
  }
  return jsonCache.get(name);
}

const bySort = (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.name || '').localeCompare(String(b.name || ''), 'sq');

/** URL e plotë për një foto: rrugë lokale (/assets/…) ose rrugë në Storage. */
export function mediaUrl(path) {
  if (!path) return '/assets/img/brand/placeholder.webp';
  if (/^https?:\/\//.test(path) || path.startsWith('/')) return path;
  return `${CONFIG.supabaseUrl}/storage/v1/object/public/${CONFIG.mediaBucket}/${path}`;
}

export async function getCategories() {
  const sb = await getClient();
  if (sb) {
    const { data, error } = await sb.from('categories').select('slug,name,description,image,sort').order('sort');
    if (!error && data) return data;
    console.warn('[data] categories', error);
  }
  return (await local('categories')).sort(bySort);
}

const PRODUCT_FIELDS = 'id,slug,name,brand,category_slug,origin,caliber,capacity,barrel_length,weight,action,description,price,show_price,images,in_stock,featured,sort';

export async function getProducts({ category, featured, limit } = {}) {
  const sb = await getClient();
  if (sb) {
    let q = sb.from('products').select(PRODUCT_FIELDS).eq('published', true).order('sort').order('name');
    if (category) q = q.eq('category_slug', category);
    if (featured) q = q.eq('featured', true);
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (!error && data) return data;
    console.warn('[data] products', error);
  }
  let list = (await local('products')).filter((p) => p.published !== false).sort(bySort);
  if (category) list = list.filter((p) => p.category_slug === category);
  if (featured) list = list.filter((p) => p.featured);
  return limit ? list.slice(0, limit) : list;
}

export async function getProduct(slug) {
  const sb = await getClient();
  if (sb) {
    const { data, error } = await sb.from('products').select(PRODUCT_FIELDS).eq('slug', slug).eq('published', true).maybeSingle();
    if (!error) return data;
    console.warn('[data] product', error);
  }
  return (await local('products')).find((p) => p.slug === slug && p.published !== false) || null;
}

export async function getGallery() {
  const sb = await getClient();
  if (sb) {
    const { data, error } = await sb.from('gallery').select('id,src,thumb,alt,width,height,sort').eq('published', true).order('sort');
    if (!error && data) return data;
    console.warn('[data] gallery', error);
  }
  return (await local('gallery')).filter((g) => g.published !== false).sort(bySort);
}

const DEFAULT_SETTINGS = {
  phone: CONFIG.site.phone,
  phoneDisplay: CONFIG.site.phoneDisplay,
  whatsapp: CONFIG.site.whatsapp,
  email: CONFIG.site.email,
  hoursWeek: '09:00 – 22:00',
  hoursSunday: 'Mbyllur',
  // [ora e hapjes, ora e mbylljes] për çdo ditë; null = mbyllur. 0 = e diel.
  hours: { 0: null, 1: [9, 22], 2: [9, 22], 3: [9, 22], 4: [9, 22], 5: [9, 22], 6: [9, 22] },
  announcement: null, // { text, link, linkText }
};

let settingsPromise = null;
export function getSettings() {
  if (!settingsPromise) {
    settingsPromise = (async () => {
      const sb = await getClient();
      if (!sb) return DEFAULT_SETTINGS;
      try {
        const cached = sessionStorage.getItem('pp:settings');
        if (cached) return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
      } catch { /* storage jo i disponueshëm */ }
      const { data, error } = await sb.from('site_settings').select('value').eq('key', 'site').maybeSingle();
      if (error || !data) return DEFAULT_SETTINGS;
      try { sessionStorage.setItem('pp:settings', JSON.stringify(data.value)); } catch { /* */ }
      return { ...DEFAULT_SETTINGS, ...data.value };
    })();
  }
  return settingsPromise;
}

/** Dërgon një mesazh kontakti. Në mënyrën offline kthen { offline: true }. */
export async function submitMessage(payload) {
  const sb = await getClient();
  if (!sb) return { offline: true };
  const { error } = await sb.from('messages').insert(payload);
  if (error) throw error;
  return { ok: true };
}

/** Dërgon aplikimin për certifikim bashkë me dokumentet (bucket privat). */
export async function submitApplication(payload, files = {}) {
  const sb = await getClient();
  if (!sb) return { offline: true };
  const id = crypto.randomUUID();
  const paths = {};
  for (const [key, file] of Object.entries(files)) {
    if (!file) continue;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${id}/${key}.${ext}`;
    const { error } = await sb.storage.from(CONFIG.applicationsBucket).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    paths[key] = path;
  }
  const { error } = await sb.from('applications').insert({ id, ...payload, id_front_path: paths.front || null, id_back_path: paths.back || null });
  if (error) throw error;
  return { ok: true };
}
