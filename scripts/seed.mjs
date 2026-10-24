// Gjeneron supabase/seed.sql nga public/data/*.json (produktet, kategoritë, galeria).
// Përdorim: node scripts/seed.mjs   →   pastaj ekzekuto supabase/seed.sql në SQL Editor.
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = async (n) => JSON.parse(await readFile(join(ROOT, 'public/data', `${n}.json`), 'utf8'));

const q = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.length ? `array[${v.map(q).join(',')}]::text[]` : "'{}'::text[]";
  return `'${String(v).replace(/'/g, "''")}'`;
};

const cats = await read('categories');
const products = await read('products');
const gallery = await read('gallery');

let sql = `-- Gjeneruar automatikisht nga scripts/seed.mjs më ${new Date().toISOString()}\n-- Mund të ekzekutohet disa herë: rreshtat ekzistues përditësohen.\nbegin;\n\n`;

sql += '-- Kategoritë\n';
for (const c of cats) {
  sql += `insert into public.categories (slug, name, description, image, sort) values (${[c.slug, c.name, c.description, c.image, c.sort ?? 0].map(q).join(', ')})\n  on conflict (slug) do update set name = excluded.name, description = excluded.description, image = excluded.image, sort = excluded.sort;\n`;
}

const cols = ['slug', 'name', 'brand', 'category_slug', 'origin', 'caliber', 'capacity', 'barrel_length', 'weight', 'action', 'description', 'price', 'show_price', 'images', 'in_stock', 'featured', 'published', 'sort', 'legacy_slug'];
sql += '\n-- Produktet\n';
for (const p of products) {
  sql += `insert into public.products (${cols.join(', ')}) values (${cols.map((k) => q(p[k] ?? (k === 'images' ? [] : null))).join(', ')})\n  on conflict (slug) do update set ${cols.filter((k) => k !== 'slug').map((k) => `${k} = excluded.${k}`).join(', ')};\n`;
}

sql += '\n-- Galeria\n';
for (const g of gallery) {
  sql += `insert into public.gallery (src, thumb, alt, width, height, sort, published) values (${[g.src, g.thumb, g.alt, g.width, g.height, g.sort ?? 0, g.published !== false].map(q).join(', ')})\n  on conflict (src) do update set thumb = excluded.thumb, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;\n`;
}

sql += '\ncommit;\n';
await writeFile(join(ROOT, 'supabase/seed.sql'), sql);
console.log(`✓ supabase/seed.sql: ${cats.length} kategori, ${products.length} produkte, ${gallery.length} foto`);
