// Dev server: one process, one port.
//   /             the game (public/, with the esbuild bundle served from memory at /dist/main.js)
//   /art/         the art workbench (dev only: nothing under art/ is ever part of public/ or the production build)
//   /art/screens.html   the game's own screens, drawn by the real renderer
//   /art/mobs.html      the monster roller: roll a seed's generated cast with stats and powers
//   /art/heroes.html    the hero roller: a seed's four players, each in every class, animated
//   /art/walk.html      the level walk: a whole level of the road, scenery, weather and road-scene stops, with no monsters
// Everything rebuilds on save and live-reloads the art pages. Builds are retried when they fail (files caught mid-write),
// the last good bundle keeps being served while a build is broken, and no error in a build, watcher or request can kill the process.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { pickPort } from './port.mjs';
import { createJob, watchTree, log, warn } from './dev-kit.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'art');
const PUBLIC = join(ROOT, 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.map': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2' };

// Last-resort guards: log and keep serving.
process.on('uncaughtException', (e) => warn('uncaught exception (ignored):', e));
process.on('unhandledRejection', (e) => warn('unhandled rejection (ignored):', e));

// ---------- live reload for the art pages ----------
const clients = new Set();
const broadcast = (msg) => {
  for (const c of clients) { try { c.write(`data: ${msg}\n\n`); } catch { clients.delete(c); } }
};
const notify = (err) => broadcast(err ? `error ${JSON.stringify(err)}` : 'reload');

// ---------- esbuild bundles, served from memory ----------
/** Keeps an esbuild context alive (recreating it if the esbuild service itself dies) and exposes its latest good output. */
function bundle(name, urlFor, options, { onBuilt = () => {}, watchDirs, accept }) {
  let ctx = null;
  const files = new Map(); // url path -> { type, body }, replaced only by a successful build
  let lastErr = '';
  const task = async () => {
    try {
      ctx ??= await esbuild.context({ ...options, write: false, logLevel: 'silent' });
      const r = await ctx.rebuild();
      const next = new Map();
      for (const f of r.outputFiles ?? []) next.set(urlFor(f.path), { type: TYPES[extname(f.path)] ?? 'application/octet-stream', body: Buffer.from(f.contents) });
      files.clear();
      for (const [k, v] of next) files.set(k, v);
    } catch (e) {
      if (!e?.errors) { try { await ctx?.dispose(); } catch { /* service already gone */ } ctx = null; } // not a build error: start a fresh service next try
      throw e;
    }
  };
  const job = createJob(name, task, (err) => { lastErr = err ?? ''; if (!err) log(`${name}: built`); onBuilt(err); });
  for (const d of watchDirs) watchTree(d, job.kick, accept);
  return { job, files, error: () => lastErr };
}

const notNoise = (f) => !/(^|[/\\])(\.DS_Store|.*~|.*\.swp|4913)$/.test(f);

const game = bundle('game', (p) => '/dist/' + p.split(sep).pop(), {
  entryPoints: [join(ROOT, 'src/main.ts')],
  bundle: true, outfile: join(PUBLIC, 'dist/main.js'), sourcemap: 'external', target: 'es2022', format: 'esm',
  loader: { '.png': 'dataurl' }, define: { __DEV__: 'true' },
}, { watchDirs: [join(ROOT, 'src')], accept: notNoise });

// The screens page runs the game's own renderer, so it is a bundle of art/screens.ts (watching src/ through its imports).
const screens = bundle('screens', (p) => '/art/' + p.split(sep).pop(), {
  entryPoints: [join(ART, 'screens.ts')],
  bundle: true, outfile: join(ART, 'screens.js'), sourcemap: 'inline', target: 'es2022', format: 'esm',
  loader: { '.png': 'dataurl' }, define: { __DEV__: 'true' },
}, { onBuilt: notify, watchDirs: [join(ROOT, 'src'), ART], accept: notNoise });

// The monster roller runs the bestiary generator and monster composer in the browser, so it is a bundle of art/mobs.ts too.
const mobs = bundle('mobs', (p) => '/art/' + p.split(sep).pop(), {
  entryPoints: [join(ART, 'mobs.ts')],
  bundle: true, outfile: join(ART, 'mobs.js'), sourcemap: 'inline', target: 'es2022', format: 'esm',
  loader: { '.png': 'dataurl' }, define: { __DEV__: 'true' },
}, { onBuilt: notify, watchDirs: [join(ROOT, 'src'), ART], accept: notNoise });

// The hero roller runs the party generator and hero composer in the browser, so it is a bundle of art/heroes.ts.
const heroes = bundle('heroes', (p) => '/art/' + p.split(sep).pop(), {
  entryPoints: [join(ART, 'heroes.ts')],
  bundle: true, outfile: join(ART, 'heroes.js'), sourcemap: 'inline', target: 'es2022', format: 'esm',
  loader: { '.png': 'dataurl' }, define: { __DEV__: 'true' },
}, { onBuilt: notify, watchDirs: [join(ROOT, 'src'), ART], accept: notNoise });

// The level walk runs a real level of a seed's road with the monsters taken out, so it is a bundle of art/walk.ts as well.
const walk = bundle('walk', (p) => '/art/' + p.split(sep).pop(), {
  entryPoints: [join(ART, 'walk.ts')],
  bundle: true, outfile: join(ART, 'walk.js'), sourcemap: 'inline', target: 'es2022', format: 'esm',
  loader: { '.png': 'dataurl' }, define: { __DEV__: 'true' },
}, { onBuilt: notify, watchDirs: [join(ROOT, 'src'), ART], accept: notNoise });

// ---------- HTTP ----------
const stubGame = (msg) => `document.body.style.cssText = 'background:#200;color:#fcc;font:14px monospace;padding:1em;white-space:pre-wrap';
document.body.textContent = ${JSON.stringify(`Build failed, retrying on the next save:\n${msg}`)};`;

async function serveFile(res, root, rel) {
  const path = join(root, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403); res.end(); return true; }
  try {
    const buf = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(buf);
    return true;
  } catch { return false; }
}

function serveMemory(res, entry) {
  res.writeHead(200, { 'content-type': entry.type, 'cache-control': 'no-store' });
  res.end(entry.body);
}

async function handle(req, res) {
  let path = decodeURIComponent(req.url.split(/[?#]/)[0]).replace(/\/{2,}/g, '/');

  if (path === '/art/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write('retry: 500\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    res.on('error', () => clients.delete(res));
    return;
  }
  if (path === '/art/screens.js') {
    const f = screens.files.get('/art/screens.js');
    if (f) return serveMemory(res, f);
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
    return res.end(`document.getElementById('err').textContent = ${JSON.stringify(screens.error() || 'screens bundle not built yet')};`);
  }
  if (path === '/art/mobs.js') {
    const f = mobs.files.get('/art/mobs.js');
    if (f) return serveMemory(res, f);
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
    return res.end(`document.getElementById('err').textContent = ${JSON.stringify(mobs.error() || 'mobs bundle not built yet')};`);
  }
  if (path === '/art/heroes.js') {
    const f = heroes.files.get('/art/heroes.js');
    if (f) return serveMemory(res, f);
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
    return res.end(`document.getElementById('err').textContent = ${JSON.stringify(heroes.error() || 'heroes bundle not built yet')};`);
  }
  if (path === '/art/walk.js') {
    const f = walk.files.get('/art/walk.js');
    if (f) return serveMemory(res, f);
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
    return res.end(`document.getElementById('err').textContent = ${JSON.stringify(walk.error() || 'walk bundle not built yet')};`);
  }
  if (path === '/art' ) { res.writeHead(302, { location: '/art/' }); return res.end(); }
  if (path.startsWith('/art/')) {
    path = path.slice(4);
    if (path === '/') path = '/heroes.html';
    if (await serveFile(res, ART, path)) return;
    res.writeHead(404); return res.end('not found');
  }
  const g = game.files.get(path);
  if (g) return serveMemory(res, g);
  if (path === '/dist/main.js') { // no good build yet: show why instead of a blank page
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
    return res.end(stubGame(game.error() || 'first build in progress, reload in a moment'));
  }
  if (path.endsWith('/')) path += 'index.html';
  if (path === '/index.html') { // dev only: a floating Art button to jump to the workbench (production never gets it)
    try {
      const html = (await readFile(join(PUBLIC, 'index.html'), 'utf8')).replace('</body>', '<script src="/art/switch.js"></script></body>');
      res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
      return res.end(html);
    } catch { /* fall through to the plain file */ }
  }
  if (await serveFile(res, PUBLIC, path)) return;
  res.writeHead(404); res.end('not found');
}

const server = createServer((req, res) => {
  handle(req, res).catch((e) => {
    warn(`request ${req.url} failed:`, e);
    try { if (!res.headersSent) res.writeHead(500); res.end('server error'); } catch { /* socket gone */ }
  });
});
server.on('clientError', (_e, sock) => { try { sock.destroy(); } catch { /* ignore */ } });
server.on('error', (e) => warn('server error:', e));

const port = await pickPort(Number(process.env.PORT) || 4000, { name: 'dev server', marker: '/' });
const banner = () => {
  console.log(`\n  game:           http://localhost:${port}/`);
  console.log(`  art workbench:  http://localhost:${port}/art/   (dev only)\n`);
};
server.listen(port, banner);

// First builds. Failures retry; none are fatal.
await Promise.all([game.job.runNow(), screens.job.runNow(), mobs.job.runNow(), heroes.job.runNow(), walk.job.runNow()]);
banner(); // again, now that the build chatter has scrolled past
