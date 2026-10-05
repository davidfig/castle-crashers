// Per-enemy balance probe: the scripted bot fights a small group of one enemy type in an empty arena, and we report how much of the
// hero's health it cost and how long the fight took. Compare enemies of the same tier by "hp lost per 100 enemy hp".
//   node tools/balance.mjs            every enemy, warrior + mage + archer, 4 seeds
//   node tools/balance.mjs yeti ram   only those enemies
import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('.tmp', { recursive: true });
await esbuild.build({
  stdin: {
    contents: `
      export { botInput } from '../src/sim/bot';
      export { createSim } from '../src/sim/state';
      export { step } from '../src/sim/step';
      export { allocEntity, freeEntity, Kind } from '../src/sim/entities';
      export { MOBS, MobType } from '../src/data/mobs';
      export { CLASSES } from '../src/data/classes';
      export { createInputFrame } from '../src/sim/input';
      export { ROSTERS } from '../src/data/roster';
    `,
    resolveDir: new URL('../.tmp', import.meta.url).pathname, sourcefile: 'entry.ts', loader: 'ts',
  },
  bundle: true, outfile: '.tmp/balance.mjs', platform: 'node', format: 'esm', target: 'node20', define: { __DEV__: 'true' }, logLevel: 'warning',
});
const m = await import('../.tmp/balance.mjs?' + Date.now());
const only = process.argv.slice(2);
// BAL='frostwolf.damage=3,frostwolf.retreat=30' tries stat changes without editing mobs.ts (special.* reaches into the special).
for (const kv of (process.env.BAL ?? '').split(',').filter(Boolean)) {
  const [path, val] = kv.split('=');
  const [name, ...keys] = path.split('.');
  let o = m.MOBS.find((d) => d.name === name);
  while (keys.length > 1) o = o[keys.shift()];
  o[keys[0]] = Number(val);
}
const CLASSES = [0, 1, 4];
const SEEDS = process.env.SEEDS ? process.env.SEEDS.split(',').map(Number) : [1, 2, 3, 4];
const BIOME_OF = new Map();
m.ROSTERS.forEach((r, b) => r.entries.forEach((en) => BIOME_OF.set(en.type, b)));
const BIOME_NAMES = ['Meadow', 'Keep', 'Pass'];

function duel(type, n, classId, seed) {
  const s = m.createSim(seed);
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === m.Kind.Mob) m.freeEntity(e, i);
  s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length;
  const p = s.players[0];
  p.classId = classId;
  const cls = m.CLASSES[classId];
  e.hp[p.ent] = cls.hp; e.maxhp[p.ent] = cls.hp;
  e.x[p.ent] = 100; e.y[p.ent] = 100; e.px[p.ent] = 100; e.py[p.ent] = 100;
  s.camX = 0; s.prevCamX = 0;
  for (let k = 0; k < n; k++) {
    const i = m.allocEntity(e, m.Kind.Mob, type, 230 + (k % 4) * 14, 70 + Math.floor(k / 4) * 18 + (k % 4) * 6, m.MOBS[type].hp);
    e.flags[i] = 1; e.face[i] = -1;
  }
  const inputs = [0, 1, 2, 3].map(m.createInputFrame);
  let lost = 0, prev = cls.hp, t = 0, left = n;
  for (; t < 2400; t++) {
    m.botInput(s, 0, inputs[0]);
    m.step(s, inputs);
    const hp = e.hp[p.ent];
    if (hp < prev) lost += prev - hp;
    prev = hp;
    // healing from kills would hide the damage, so count it as taken back: track only losses, as above
    left = 0;
    for (let i = 0; i < e.highWater; i++) if (e.alive[i] && e.kind[i] === m.Kind.Mob) left++;
    if (left === 0 || p.downed) break;
  }
  return { lost: Math.min(lost, cls.hp * 2), t, win: left === 0 && !p.downed, hp: cls.hp };
}

const rows = [];
for (let type = 0; type < m.MOBS.length; type++) {
  const d = m.MOBS[type];
  if (d.name === 'warlord' || d.name === 'rimeking' || type === m.MobType.Boss) continue;
  if (only.length && !only.includes(d.name)) continue;
  const n = Math.max(1, Math.min(10, Math.round(60 / d.hp)));
  let lost = 0, ticks = 0, wins = 0, runs = 0, frac = 0;
  for (const c of CLASSES) for (const sd of SEEDS) {
    const r = duel(type, n, c, sd);
    lost += r.lost; frac += r.lost / r.hp; ticks += r.t; wins += r.win ? 1 : 0; runs++;
  }
  rows.push({ name: d.name, biome: BIOME_NAMES[BIOME_OF.get(type)] ?? '-', n, hp: d.hp, lostPct: (100 * frac) / runs, secs: ticks / runs / 60, win: wins / runs, per100: ((100 * frac) / runs) / ((n * d.hp) / 100) });
}
console.log('biome   enemy           n   hp  heroHP%lost  secs  cleared  lost% per 100 enemy hp');
for (const r of rows) console.log(`${r.biome.padEnd(7)} ${r.name.padEnd(15)} ${String(r.n).padStart(2)} ${String(r.hp).padStart(4)} ${r.lostPct.toFixed(0).padStart(9)}% ${r.secs.toFixed(1).padStart(6)} ${(r.win * 100).toFixed(0).padStart(6)}% ${r.per100.toFixed(0).padStart(10)}`);
