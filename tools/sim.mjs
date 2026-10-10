// Headless balance simulator: simulated players (src/ai) play whole routes with no renderer, spread over every core.
//   npm run sim                                          every class at three skills, 6 seeds each, the full route
//   npm run sim -- --class=warrior,mage --skill=novice,expert --runs=20
//   npm run sim -- --party=warrior:expert,cleric:average --runs=10      one explicit party (a "class:skill" per hero)
//   npm run sim -- --levels=3 --heat=2 --json=out.json                  a short route at heat 2, raw reports to a file
// More: --seed0=N  --start=N (first level)  --boost=N (level-ups to spend first)  --workers=N  --levels-table (per-level detail for each scenario)
//       --upto=N (play only N levels from --start: a stretch of the route; "win" then means surviving them)  --killers (what ended the losing runs)  --boons (boons the winners ended with)  --quiet
import * as esbuild from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const BUNDLE = '.tmp/ai.mjs';

if (isMainThread) {
  mkdirSync('.tmp', { recursive: true });
  await esbuild.build({
    entryPoints: ['src/ai/index.ts'], bundle: true, outfile: BUNDLE, platform: 'node', format: 'esm', target: 'node20',
    define: { __DEV__: 'true' }, logLevel: 'warning',
  });
  const argv = process.argv.slice(2);
  const flags = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
  const list = (v, d) => (v ? String(v).split(',') : d);
  const ai = await import('../' + BUNDLE + '?' + Date.now());

  // scenarios: a party each
  const scenarios = [];
  if (flags.party) {
    const party = flags.party.split(',').map((h) => { const [c, sk = 'average'] = h.split(':'); return { classId: Number.isNaN(Number(c)) ? c : Number(c), skill: Number.isNaN(Number(sk)) ? sk : Number(sk) }; });
    scenarios.push({ label: party.map((m) => `${m.classId}:${m.skill}`).join('+'), party });
  } else {
    const classes = list(flags.class, ['warrior', 'mage', 'cleric', 'rogue', 'archer']);
    const skills = list(flags.skill, ['novice', 'average', 'expert']);
    const size = Number(flags.players ?? 1);
    for (const c of classes) for (const sk of skills) {
      // a bigger party fills out with the other classes in turn, all at the same skill
      const all = ['warrior', 'mage', 'cleric', 'rogue', 'archer'];
      const party = [{ classId: c, skill: Number.isNaN(Number(sk)) ? sk : Number(sk) }];
      for (let k = 1; k < size; k++) party.push({ classId: all[(all.indexOf(c) + k) % all.length], skill: party[0].skill });
      scenarios.push({ label: size > 1 ? `${c}+${size - 1}:${sk}` : `${c}:${sk}`, party });
    }
  }
  const runs = Number(flags.runs ?? 6);
  const seed0 = Number(flags.seed0 ?? 1);
  const common = { levels: flags.levels ? Number(flags.levels) : undefined, startLevel: flags.start ? Number(flags.start) : undefined, heat: flags.heat ? Number(flags.heat) : undefined, boost: flags.boost ? Number(flags.boost) : undefined, stopAfter: flags.upto ? Number(flags.upto) : undefined };
  const jobs = [];
  scenarios.forEach((sc, si) => { for (let r = 0; r < runs; r++) jobs.push({ si, opts: { seed: seed0 + r, party: sc.party, ...common } }); });

  const n = Math.max(1, Math.min(Number(flags.workers ?? Math.max(1, cpus().length - 1)), jobs.length));
  const results = new Array(jobs.length);
  const t0 = Date.now();
  let next = 0, done = 0;
  await new Promise((resolve, reject) => {
    for (let w = 0; w < n; w++) {
      const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { bundle: BUNDLE } });
      const feed = () => {
        if (next >= jobs.length) { worker.postMessage(null); return; }
        const id = next++;
        worker.postMessage({ id, opts: jobs[id].opts });
      };
      worker.on('message', (m) => {
        if (m.error) { reject(new Error(m.error)); return; }
        results[m.id] = m.report;
        done++;
        if (!flags.quiet && process.stderr.isTTY) process.stderr.write(`\r${done}/${jobs.length} runs  ${((Date.now() - t0) / 1000).toFixed(0)}s `);
        feed();
      });
      worker.on('error', reject);
      worker.on('exit', () => { if (done === jobs.length) resolve(); });
      feed();
    }
  });
  if (!flags.quiet && process.stderr.isTTY) process.stderr.write('\n');

  const per = scenarios.map((sc, si) => ({ ...sc, reports: results.filter((_, j) => jobs[j].si === si) }));
  const pct = (x) => `${x.toFixed(0)}%`.padStart(5);
  const f1 = (x) => x.toFixed(1);
  const total = per[0].reports[0]?.total ?? 0;
  const ticks = results.reduce((a, r) => a + r.ticks, 0);
  const secs = (Date.now() - t0) / 1000;
  console.log(`${per.length} scenario(s) x ${runs} seeds from ${seed0}, route of ${total} level(s)${common.heat ? `, heat ${common.heat}` : ''}  (${secs.toFixed(1)}s on ${n} workers: ${(ticks / 1e6).toFixed(1)}M ticks = ${(ticks / 3600 / 60).toFixed(0)} hours of play, ${(ticks / secs / 1000).toFixed(0)}k ticks/s)`);
  console.log('');
  console.log('scenario'.padEnd(26) + 'win%  cleared  dies@  minutes  kills  heroLv  downs  timeouts');
  const sums = per.map((sc) => ({ sc, sum: ai.summarize(sc.reports) }));
  for (const { sc, sum } of sums) {
    console.log(`${sc.label.padEnd(26)}${pct(sum.winPct)} ${f1(sum.levelsCleared).padStart(6)}/${total} ${(sum.medianDeathLevel === null ? '-' : String(sum.medianDeathLevel + 1)).padStart(5)} ${f1(sum.minutes).padStart(8)} ${sum.kills.toFixed(0).padStart(6)} ${f1(sum.finalLevel).padStart(7)} ${f1(sum.downsPerRun).padStart(6)} ${String(sum.timeouts).padStart(8)}`);
  }
  if (flags['levels-table'] || per.length === 1) {
    for (const { sc, sum } of sums) {
      console.log(`\n${sc.label}: per level`);
      console.log('lvl biome boss reach%  clear%  secs  dmg%  lowHP  downs  kills  gold  top damage sources');
      for (const l of sum.levels) {
        console.log(`${String(l.index + 1).padStart(3)} ${String(l.biome).padStart(5)} ${(l.boss ? 'boss' : '').padEnd(4)} ${pct(l.reachedPct)}  ${pct(l.clearPct)} ${l.seconds.toFixed(0).padStart(5)} ${l.damagePct.toFixed(0).padStart(5)} ${l.lowestHp.toFixed(2).padStart(6)} ${l.downs.toFixed(1).padStart(6)} ${l.kills.toFixed(0).padStart(6)} ${l.gold.toFixed(0).padStart(5)}  ${l.killers.slice(0, 4).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ')}`);
      }
    }
  }
  if (flags.curve) {
    const curve = ai.difficultyCurve(per.flatMap((p) => p.reports));
    console.log(`\ndifficulty curve (all ${per.flatMap((p) => p.reports).length} runs pooled)`);
    console.log('lvl biome boss runs  clear%  dies%  secs  dmg%  vsMed  lowHP  top damage sources');
    for (const l of curve) console.log(`${String(l.index + 1).padStart(3)} ${String(l.biome).padStart(5)} ${(l.boss ? 'boss' : '').padEnd(4)} ${String(l.reached).padStart(4)} ${pct(l.clearPct)} ${pct(l.deathPct)} ${l.seconds.toFixed(0).padStart(5)} ${l.damagePct.toFixed(0).padStart(5)} ${l.vsMedian.toFixed(2).padStart(6)} ${l.lowestHp.toFixed(2).padStart(6)}  ${l.killers.slice(0, 4).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ')} ${l.flag}`);
  }
  if (flags.killers) for (const { sc, sum } of sums) console.log(`\n${sc.label}: what ended the lost runs\n  ` + (sum.killers.map(([k, v]) => `${k} x${v}`).join(', ') || 'nothing (all won)'));
  if (flags.boons) for (const { sc, sum } of sums) console.log(`\n${sc.label}: boons held at the end (heroes)\n  ` + sum.boons.slice(0, 20).map(([k, v]) => `${k} ${v}`).join(', '));
  if (flags.json) { writeFileSync(flags.json, JSON.stringify(per.map((p) => ({ label: p.label, party: p.party, reports: p.reports })), null, 1)); console.log(`\nwrote ${flags.json}`); }
} else {
  const ai = await import(new URL('../' + workerData.bundle + '?' + Date.now(), import.meta.url).href);
  parentPort.on('message', (m) => {
    if (m === null) { process.exit(0); }
    try { parentPort.postMessage({ id: m.id, report: ai.runRoute(m.opts) }); }
    catch (err) { parentPort.postMessage({ id: m.id, error: String(err && err.stack || err) }); }
  });
}
