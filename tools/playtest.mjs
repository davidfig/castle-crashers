// Headless balance playtest: a scripted bot plays several seeds; prints how each run went.
//   npm run playtest                       the baseline warrior on seeds 1-6
//   npm run playtest -- 3 4 5              given seeds
//   npm run playtest -- --class=1 --boons=kegs:2,spark:1     a build (class index, boon id:rank)
//   npm run playtest -- --sweep [--seeds=8]   every boon at its top rank against its class's bare run: does it fire, does it help, is it slow
import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('.tmp', { recursive: true });
await esbuild.build({
  entryPoints: { bot: 'src/sim/bot.ts', meta: 'tools/playtest-meta.ts' }, bundle: true, outdir: '.tmp',
  platform: 'node', format: 'esm', target: 'node20', outExtension: { '.js': '.mjs' }, define: { __DEV__: 'true' }, logLevel: 'warning',
});
const stamp = '?' + Date.now();
const { runBot } = await import('../.tmp/bot.mjs' + stamp);
const { UPGRADES, CLASSES } = await import('../.tmp/meta.mjs' + stamp);

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const seeds = process.argv.slice(2).filter((a) => !a.startsWith('--')).map(Number);
const maxTicks = 60 * 60 * 6;

function run(seeds, build, ticksCap = maxTicks) {
  const t0 = process.hrtime.bigint();
  const rs = seeds.map((seed) => runBot(seed, ticksCap, build));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const ticks = rs.reduce((a, r) => a + r.ticks, 0);
  const mean = (f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  return { rs, sig: rs.map((r) => `${r.ticks}/${r.kills}`).join(','), progress: mean((r) => r.progress), kills: mean((r) => r.kills), secs: mean((r) => r.ticks / 60), procs: mean((r) => r.procs), minHp: mean((r) => r.minHp), won: rs.filter((r) => r.outcome === 'won').length, usPerTick: (ms * 1000) / ticks };
}

if (flags.sweep) {
  const n = Number(flags.seeds ?? 8);
  const list = Array.from({ length: n }, (_, i) => i + 1);
  run(list.slice(0, 2), {}); // warm up the JIT so the first run is not the slow one
  const base = new Map();
  const baseOf = (cls) => { if (!base.has(cls)) base.set(cls, run(list, { classId: cls })); return base.get(cls); };
  const rows = [];
  for (const u of UPGRADES) {
    if (u.id === 'wind') continue;
    for (const cls of u.classes ?? [0, 1]) {
      const b = baseOf(cls);
      const r = run(list, { classId: cls, boons: { [u.id]: u.maxRank } });
      rows.push({ inert: r.sig === b.sig, id: u.id, cls: CLASSES[cls].name, kind: u.kind, dProgress: r.progress - b.progress, dKills: r.kills - b.kills, dSecs: r.secs - b.secs, procs: r.procs, slow: r.usPerTick / b.usPerTick, won: r.won });
    }
  }
  // cost of carrying every boon at once: the same first 1200 ticks of the same seeds (so the same fight), with and without
  const all = Object.fromEntries(UPGRADES.filter((u) => u.id !== 'wind').map((u) => [u.id, u.maxRank]));
  for (const cls of [0, 1, 4]) {
    const b = run(list, { classId: cls }, 1200), r = run(list, { classId: cls, boons: all }, 1200);
    console.log(`all boons on ${CLASSES[cls].name}: ${r.usPerTick.toFixed(0)}us/tick vs ${b.usPerTick.toFixed(0)} bare  (${(r.usPerTick / b.usPerTick).toFixed(2)}x), procs ${r.procs.toFixed(0)}`);
  }
  console.log(`baselines (mean of ${n} seeds)`);
  for (const [cls, b] of base) console.log(`  ${CLASSES[cls].name.padEnd(8)} progress ${b.progress.toFixed(1)}%  kills ${b.kills.toFixed(0)}  ${b.secs.toFixed(0)}s  ${b.usPerTick.toFixed(0)}us/tick`);
  console.log('\nboon         class    kind     dProg%  dKills   dSecs   procs   flags');
  for (const r of rows.sort((a, b) => b.dProgress - a.dProgress)) {
    const f = [];
    if (r.inert) f.push('INERT (the bot never gives it a chance)');
    if (r.dProgress < -2) f.push('HURTS');
    if (r.dProgress > 12) f.push('STRONG');
    if (r.won > 0) f.push('WINS');
    console.log(`${r.id.padEnd(12)} ${r.cls.padEnd(8)} ${r.kind.padEnd(8)} ${r.dProgress.toFixed(1).padStart(6)} ${r.dKills.toFixed(0).padStart(7)} ${r.dSecs.toFixed(1).padStart(7)} ${r.procs.toFixed(0).padStart(7)} ${' '}  ${f.join(' ')}`);
  }
} else {
  const build = {};
  if (flags.class !== undefined) build.classId = Number(flags.class);
  if (flags.boons) build.boons = Object.fromEntries(flags.boons.split(',').map((p) => { const [id, r] = p.split(':'); return [id, Number(r ?? 1)]; }));
  if (seeds.length === 0) seeds.push(1, 2, 3, 4, 5, 6);
  console.log('seed outcome  time   kills  progress  novas  minHp  procs');
  for (const seed of seeds) {
    const t0 = process.hrtime.bigint();
    const r = runBot(seed, maxTicks, build);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(
      `${String(r.seed).padEnd(4)} ${r.outcome.padEnd(8)} ${(r.ticks / 60).toFixed(0).padStart(4)}s ${String(r.kills).padStart(6)} ${String(r.progress + '%').padStart(8)} ${String(r.novas).padStart(6)} ${String(r.minHp).padStart(6)} ${String(r.procs).padStart(6)}   (${ms.toFixed(0)}ms sim)`,
    );
  }
}
