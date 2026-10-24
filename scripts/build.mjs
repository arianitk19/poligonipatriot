// Ndërton faqet statike: src/pages + src/partials -> dist/, dhe kopjon public/ -> dist/.
// Pa varësi. Përdorim: node scripts/build.mjs
import { readFile, writeFile, mkdir, readdir, cp, rm, stat } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const SITE = 'https://poligonipatriot.com';

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const partialCache = new Map();
async function partial(name) {
  if (!partialCache.has(name)) {
    partialCache.set(name, await readFile(join(SRC, 'partials', `${name}.html`), 'utf8'));
  }
  return partialCache.get(name);
}

// {{> emri}} përfshin një partial; {{var}} zëvendëson një vlerë nga meta e faqes.
async function render(tpl, vars, depth = 0) {
  if (depth > 8) throw new Error('Përfshirje rekursive e partial-eve');
  let html = tpl;
  const incs = [...html.matchAll(/\{\{>\s*([\w-]+)\s*\}\}/g)];
  for (const m of incs) {
    html = html.replace(m[0], await render(await partial(m[1]), vars, depth + 1));
  }
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => (vars[k] ?? ''));
}

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export async function build({ clean = false } = {}) {
  partialCache.clear();
  if (clean) await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await cp(join(ROOT, 'public'), DIST, { recursive: true, force: true });

  const pages = await walk(join(SRC, 'pages'));
  const sitemap = [];
  for (const file of pages) {
    const raw = await readFile(file, 'utf8');
    const m = raw.match(/^<!--page\s*([\s\S]*?)-->/);
    const meta = m ? JSON.parse(m[1]) : {};
    const body = m ? raw.slice(m[0].length) : raw;
    const rel = relative(join(SRC, 'pages'), file).replace(/\\/g, '/');
    const path = '/' + rel.replace(/index\.html$/, '').replace(/\.html$/, '');
    const vars = {
      title: esc(meta.title ? `${meta.title}` : 'Poligoni Patriot'),
      description: esc(meta.description || ''),
      path,
      canonical: SITE + path,
      ogImage: SITE + (meta.ogImage || '/assets/img/og/og-default.jpg'),
      robots: meta.noindex ? 'noindex, nofollow' : 'index, follow',
      bodyClass: meta.bodyClass || '',
      year: String(new Date().getFullYear()),
      jsonld: meta.jsonld ? `<script type="application/ld+json">${JSON.stringify(meta.jsonld)}</script>` : '',
      scripts: (meta.scripts || []).map((s) => `<script type="module" src="${s}"></script>`).join('\n'),
    };
    vars.content = await render(body, vars);
    let html = await render(await partial(meta.layout || 'layout'), vars);
    if (meta.nav) {
      html = html.replaceAll(`data-nav="${meta.nav}"`, `data-nav="${meta.nav}" aria-current="page"`);
    }
    const outFile = join(DIST, rel);
    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, html);
    if (!meta.noindex && rel !== '404.html') sitemap.push({ path, priority: meta.priority || (path === '/' ? '1.0' : '0.8') });
  }

  const today = new Date().toISOString().slice(0, 10);
  await writeFile(
    join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((p) => `  <url><loc>${SITE}${p.path}</loc><lastmod>${today}</lastmod><priority>${p.priority}</priority></url>`)
      .join('\n')}\n</urlset>\n`
  );
  await writeHostingFiles();
  return pages.length;
}

// Ridrejtimet nga URL-të e vjetra të WordPress-it + header-at e sigurisë.
async function writeHostingFiles() {
  let products = [];
  try { products = JSON.parse(await readFile(join(ROOT, 'public/data/products.json'), 'utf8')); } catch { /* pa të dhëna lokale */ }
  const fixed = [
    ['/home-4-store/', '/'], ['/shop/', '/dyqani/'], ['/dyqani-online/', '/dyqani/'], ['/cart/', '/dyqani/'], ['/checkout/', '/dyqani/'],
    ['/my-account/', '/'], ['/wp-login.php', '/'], ['/wp-admin/', '/admin/'], ['/blog/', '/'], ['/aplikimi/', '/apliko/'],
  ];
  const cats = ['arme-te-shkurta', 'arme-te-gjata', 'shotgune', 'municione', 'optika', 'aksesore-veshje-taktike', 'te-tjera'];
  const prod = products.filter((p) => p.legacy_slug).map((p) => [`/product/${p.legacy_slug}/`, `/dyqani/produkt/?p=${p.slug}`]);

  // Netlify / Cloudflare Pages
  const lines = [
    ...fixed.map(([a, b]) => `${a} ${b} 301`),
    ...cats.map((c) => `/product-category/${c}/* /dyqani/?kategoria=${c === 'te-tjera' ? 'arme-te-shkurta' : c} 301`),
    ...prod.map(([a, b]) => `${a} ${b} 301`),
    '/product/* /dyqani/ 301',
    '/product-category/* /dyqani/ 301',
    '/wp-content/* /404.html 404',
  ];
  await writeFile(join(DIST, '_redirects'), lines.join('\n') + '\n');

  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "media-src 'self' https://*.supabase.co",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    'frame-src https://www.google.com https://maps.google.com',
    "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
  ].join('; ');
  const headers = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()', 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains', 'Content-Security-Policy': csp };
  await writeFile(join(DIST, '_headers'), `/*\n${Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/assets/js/*\n  Cache-Control: public, max-age=3600\n/assets/css/*\n  Cache-Control: public, max-age=3600\n/admin/*\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-store\n`);

  // Apache (Bluehost / cPanel)
  const ht = [
    '# Gjeneruar nga scripts/build.mjs',
    'Options -Indexes',
    'ErrorDocument 404 /404.html',
    'DirectoryIndex index.html',
    '<IfModule mod_rewrite.c>',
    'RewriteEngine On',
    'RewriteCond %{HTTPS} off',
    'RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]',
    'RewriteCond %{HTTP_HOST} ^www\\.(.+)$ [NC]',
    'RewriteRule ^ https://%1%{REQUEST_URI} [L,R=301]',
    ...prod.map(([a, b]) => { const [path, qs] = b.split('?'); return `RewriteRule ^${a.slice(1).replace(/\/$/, '')}/?$ ${path}?${qs} [L,R=301]`; }),
    ...cats.map((c) => `RewriteRule ^product-category/${c}(/.*)?$ /dyqani/?kategoria=${c === 'te-tjera' ? 'arme-te-shkurta' : c} [L,R=301]`),
    ...fixed.map(([a, b]) => `RewriteRule ^${a.slice(1).replace(/\/$/, '').replace(/\./g, '\\.')}/?$ ${b} [L,R=301]`),
    'RewriteRule ^product/ /dyqani/ [L,R=301]',
    'RewriteRule ^product-category/ /dyqani/ [L,R=301]',
    '</IfModule>',
    '<IfModule mod_headers.c>',
    ...Object.entries(headers).map(([k, v]) => `Header always set ${k} "${v}"`),
    '<FilesMatch "\\.(webp|png|jpg|jpeg|svg|woff2|mp4)$">',
    'Header set Cache-Control "public, max-age=31536000, immutable"',
    '</FilesMatch>',
    '</IfModule>',
    '<IfModule mod_deflate.c>',
    'AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript application/json image/svg+xml',
    '</IfModule>',
    'AddType image/webp .webp',
    'AddType application/manifest+json .webmanifest',
  ];
  await writeFile(join(DIST, '.htaccess'), ht.join('\n') + '\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const t = Date.now();
  const n = await build({ clean: process.argv.includes('--clean') });
  console.log(`✓ ${n} faqe u ndërtuan në dist/ (${Date.now() - t} ms)`);
}
