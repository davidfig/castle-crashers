// Pick a free port for a dev server, starting at `want`. If it is taken, say so (loudly: another server is probably already
// running, maybe in another terminal or session, and the user may not know) and use the next free one.
import { createServer } from 'node:net';

/** Can `port` be bound on `host`? 'skip' when the host family does not exist here (no IPv6). */
function bind(port, host) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', (e) => resolve(e.code === 'EADDRINUSE' || e.code === 'EACCES' ? 'busy' : 'skip'));
    srv.once('listening', () => srv.close(() => resolve('ok')));
    srv.listen(port, host);
  });
}

/** Free only if it is free on IPv4 (what esbuild binds) and on IPv6 (what node's own servers bind), since each can hold it alone. */
async function free(port) {
  return (await bind(port, '0.0.0.0')) !== 'busy' && (await bind(port, '::')) !== 'busy';
}

/** What answers on `port`, in a few words ('a dev server' if it looks like ours, else 'something'). */
async function whoIsThere(port, marker) {
  try {
    const r = await fetch(`http://localhost:${port}${marker}`, { signal: AbortSignal.timeout(800) });
    return r.ok ? 'it looks like another copy of this dev server' : `something is answering there (HTTP ${r.status})`;
  } catch { return 'something is holding it'; }
}

export async function pickPort(want, { name = 'dev server', marker = '/' } = {}) {
  if (await free(want)) return want;
  const who = await whoIsThere(want, marker);
  for (let p = want + 1; p < want + 50; p++) {
    if (await free(p)) {
      const bar = '='.repeat(64);
      console.warn(`\n${bar}\n  Port ${want} is already in use (${who}).\n  Another ${name} may already be running: check your other terminals and sessions.\n  Starting this one on port ${p} instead.\n${bar}\n`);
      return p;
    }
  }
  throw new Error(`no free port from ${want} to ${want + 49}`);
}
