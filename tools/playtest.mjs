// Headless balance playtest: a scripted bot plays several seeds; prints how each run went.
import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('.tmp', { recursive: true });
await esbuild.build({
  entryPoints: ['src/sim/bot.ts'], bundle: true, outfile: '.tmp/bot.mjs',
  platform: 'node', format: 'esm', target: 'node20', define: { __DEV__: 'true' }, logLevel: 'warning',
});
const { runBot } = await import('../.tmp/bot.mjs?' + Date.now());
const seeds = process.argv.slice(2).map(Number);
if (seeds.length === 0) seeds.push(1, 2, 3, 4, 5, 6);
const maxTicks = 60 * 60 * 6;
console.log('seed outcome  time   kills  progress  novas  minHp');
for (const seed of seeds) {
  const t0 = process.hrtime.bigint();
  const r = runBot(seed, maxTicks);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(
    `${String(r.seed).padEnd(4)} ${r.outcome.padEnd(8)} ${(r.ticks / 60).toFixed(0).padStart(4)}s ${String(r.kills).padStart(6)} ${String(r.progress + '%').padStart(8)} ${String(r.novas).padStart(6)} ${String(r.minHp).padStart(6)}   (${ms.toFixed(0)}ms sim)`,
  );
}
