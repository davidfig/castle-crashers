// Sprite workbench dev server: rebuilds art/out on any change under art/ (or tools/art.mjs) and live-reloads the viewer.
//   npm run art            -> http://localhost:5190
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'art');
const PORT = Number(process.env.ART_PORT) || 5190;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };

const clients = new Set();
let building = false, again = false;
async function rebuild() {
  if (building) { again = true; return; }
  building = true;
  // Build in a fresh process every time: Node caches imported modules (lib.mjs, palette.mjs, art.mjs itself),
  // so an in-process rebuild would keep serving stale art after those files change.
  const err = await new Promise((resolve) => {
    let out = '';
    const p = spawn(process.execPath, [join(ROOT, 'tools/art.mjs')], { cwd: ROOT });
    p.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
    p.stderr.on('data', (d) => { out += d; process.stderr.write(d); });
    p.on('close', (code) => resolve(code === 0 ? null : (out.split('\n').find((l) => /Error/.test(l)) ?? 'build failed')));
  });
  for (const c of clients) c.write(err ? `data: error ${JSON.stringify(err)}\n\n` : 'data: reload\n\n');
  building = false;
  if (again) { again = false; rebuild(); }
}
let t;
const kick = () => { clearTimeout(t); t = setTimeout(rebuild, 60); };
watch(ART, { recursive: true }, (_e, f) => { if (f && !f.startsWith('out')) kick(); });
watch(join(ROOT, 'tools/art.mjs'), kick);
await rebuild();

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write('retry: 500\n\n');
    clients.add(res); req.on('close', () => clients.delete(res));
    return;
  }
  const rel = normalize(url.pathname === '/' ? '/viewer.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
  try {
    const buf = await readFile(join(ART, rel));
    res.writeHead(200, { 'content-type': TYPES[extname(rel)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(PORT, () => console.log(`art workbench: http://localhost:${PORT}`));
