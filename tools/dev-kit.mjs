// Plumbing that keeps the dev server alive while files are being written: a watcher that survives errors, and a build job
// that coalesces bursts of changes and retries a failed build (a half-saved file or a PNG caught mid-write usually builds fine
// a moment later). Nothing here may throw into the process: a failed build is reported and retried, never fatal.
import { watch } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const stamp = () => new Date().toLocaleTimeString();
export const log = (...a) => console.log(`[${stamp()}]`, ...a);
export const warn = (...a) => console.warn(`[${stamp()}]`, ...a);

/**
 * Recursive watch of `dir` that never dies: a watcher error, a closed watcher or a missing directory (it may be mid-rewrite)
 * re-arms the watch after a short pause. `accept(relPath)` filters events; `onChange` is called for each accepted one.
 * Returns a function that stops watching.
 */
export function watchTree(dir, onChange, accept = () => true) {
  let w = null, timer = null, stopped = false;
  const arm = () => {
    if (stopped) return;
    try {
      w = watch(dir, { recursive: true }, (_e, f) => {
        try { if (!f || accept(String(f))) onChange(String(f ?? '')); } catch (e) { warn(`watch handler for ${dir}:`, e); }
      });
      w.on('error', rearm);
      w.on('close', rearm);
    } catch (e) { warn(`cannot watch ${dir} (${e.code ?? e.message}); retrying`); rearm(); }
  };
  const rearm = () => {
    try { w?.close(); } catch { /* already closed */ }
    w = null;
    if (stopped || timer) return;
    timer = setTimeout(() => { timer = null; arm(); }, 500);
  };
  arm();
  return () => { stopped = true; clearTimeout(timer); try { w?.close(); } catch { /* ignore */ } };
}

const BACKOFF = [150, 400, 1000, 2500];

/**
 * A build job. `task()` does one build and throws (any Error, or an esbuild failure with `.errors`) when it fails.
 * `kick()` schedules a run (debounced); runs never overlap, and a change that lands mid-build runs again right after.
 * A failing run is retried with backoff, restarting from the top whenever a newer change arrives; only when the retries
 * run out is the error handed to `onDone(err)`, so a transient failure never reaches the page. `onDone(null)` on success.
 */
export function createJob(name, task, onDone = () => {}, { debounce = 60 } = {}) {
  let running = false, dirty = false, timer = null;

  const describe = (e) => {
    const first = e?.errors?.[0];
    if (first) return `${first.text}${first.location ? ` (${first.location.file}:${first.location.line})` : ''}`;
    return String(e?.message ?? e).split('\n')[0];
  };

  async function run() {
    if (running) { dirty = true; return; }
    running = true;
    try {
      do {
        dirty = false;
        let err = null;
        for (let attempt = 0; attempt <= BACKOFF.length; attempt++) {
          try { await task(); err = null; break; } catch (e) { err = e; }
          if (dirty) break; // newer edits arrived: build those instead of retrying stale ones
          if (attempt < BACKOFF.length) {
            warn(`${name}: build failed (${describe(err)}); retry ${attempt + 1}/${BACKOFF.length}`);
            await sleep(BACKOFF[attempt]);
            if (dirty) break;
          }
        }
        if (dirty && err) continue; // restart with fresh retries before reporting anything
        if (err) warn(`${name}: giving up until the next change: ${describe(err)}`);
        try { onDone(err ? describe(err) : null); } catch (e) { warn(`${name}: onDone threw:`, e); }
      } while (dirty);
    } finally { running = false; }
  }

  return {
    kick() { clearTimeout(timer); timer = setTimeout(() => { run().catch((e) => warn(`${name}:`, e)); }, debounce); },
    /** Run now and resolve when this run (and any follow-ups) finish. Never rejects. */
    async runNow() { clearTimeout(timer); try { await run(); } catch (e) { warn(`${name}:`, e); } },
  };
}
