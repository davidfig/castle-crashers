// Art workbench dev server: rebuilds art/out on any change under art/ (or tools/art.mjs) and live-reloads the viewers.
//   npm run art            -> http://localhost:5190        the sprite workbench
//                             http://localhost:5190/screens.html   the game's own screens (title, party select, board, story scenes), drawn
//                                                            by the real renderer; bundled from art/screens.ts and served from memory, and it
//                                                            reloads when anything the game draws with (src/) changes
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import * as esbuild from 'esbuild';

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

// The screens page runs the game's own renderer, so it is an esbuild bundle of art/screens.ts (watching src/ through the imports).
// It is served from memory at /screens.js; art/out/*.png (the sheets the bundle imports) are written by the rebuild above.
let screensJs = '', screensErr = '';
const screensCtx = await esbuild.context({
  entryPoints: [join(ART, 'screens.ts')],
  bundle: true, write: false, outfile: join(ART, 'out/screens.js'), sourcemap: 'inline', target: 'es2022', format: 'esm',
  loader: { '.png': 'dataurl' }, define: { __DEV__: 'true' }, logLevel: 'silent',
  plugins: [{ name: 'notify', setup(b) {
    b.onEnd((r) => {
      screensErr = r.errors[0] ? `${r.errors[0].text} (${r.errors[0].location?.file}:${r.errors[0].location?.line})` : '';
      if (!screensErr && r.outputFiles?.[0]) screensJs = r.outputFiles[0].text;
      for (const c of clients) c.write(screensErr ? `data: error ${JSON.stringify(screensErr)}\n\n` : 'data: reload\n\n');
    });
  } }],
});
await screensCtx.watch();

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write('retry: 500\n\n');
    clients.add(res); req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname === '/screens.js') {
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
    res.end(screensJs || `document.getElementById('err').textContent = ${JSON.stringify(screensErr || 'screens bundle not built yet')};`);
    return;
  }
  const rel = normalize(url.pathname === '/' ? '/viewer.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
  try {
    const buf = await readFile(join(ART, rel));
    res.writeHead(200, { 'content-type': TYPES[extname(rel)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(PORT, () => console.log(`art workbench: http://localhost:${PORT}`));
