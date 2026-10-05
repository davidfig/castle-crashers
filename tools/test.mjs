// Bundles every src/**/*.test.ts with esbuild and runs them with node's built-in test runner.
import * as esbuild from 'esbuild';
import { build as buildArt } from './art.mjs';
import { readdirSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
await buildArt(); // render tests read the generated sprite metadata (art/out)
const tests = walk('src').filter((f) => f.endsWith('.test.ts'));
if (tests.length === 0) { console.log('no tests'); process.exit(0); }
rmSync('.tmp/tests', { recursive: true, force: true }); // never run stale builds
mkdirSync('.tmp/tests', { recursive: true });
await esbuild.build({
  entryPoints: tests,
  bundle: true,
  outdir: '.tmp/tests',
  outbase: 'src',
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outExtension: { '.js': '.mjs' },
  define: { __DEV__: 'true' },
  logLevel: 'warning',
});
const files = tests.map((t) => join('.tmp/tests', relative('src', t).replace(/\.ts$/, '.mjs')));
const r = spawnSync('node', ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
