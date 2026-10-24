// Server lokal me rindërtim automatik. Përdorim: npm run dev  ->  http://localhost:5173
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 5173);
const WATCH = !process.argv.includes('--no-watch');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
};

await build();
const tw = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['@tailwindcss/cli', '-i', 'src/styles/app.css', '-o', 'dist/assets/css/app.css', ...(WATCH ? ['--watch'] : [])],
  { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' }
);

if (WATCH) {
  let timer;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try { const n = await build(); console.log(`↻ ${n} faqe u rindërtuan`); } catch (e) { console.error('✗', e.message); }
    }, 120);
  };
  watch(join(ROOT, 'src'), { recursive: true }, (ev, f) => { if (!String(f).endsWith('.css')) rebuild(); });
  watch(join(ROOT, 'public'), { recursive: true }, rebuild);
}

async function resolve(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let p = join(DIST, clean);
  try {
    const s = await stat(p);
    if (s.isDirectory()) p = join(p, 'index.html');
    return p;
  } catch {
    try { await stat(p + '.html'); return p + '.html'; } catch { return null; }
  }
}

createServer(async (req, res) => {
  let file = await resolve(req.url);
  let code = 200;
  if (!file) { file = join(DIST, '404.html'); code = 404; }
  try {
    const data = await readFile(file);
    res.writeHead(code, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404).end('404');
  }
}).listen(PORT, () => console.log(`\n  Poligoni Patriot  →  http://localhost:${PORT}\n`));

process.on('SIGINT', () => { tw.kill(); process.exit(0); });
