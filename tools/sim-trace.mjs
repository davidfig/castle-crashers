// Watch one simulated run as text: a status line every N ticks (where the hero is, what is nearest, whether the camera is held at a gate).
//   node tools/sim-trace.mjs rogue expert 3            class, skill, seed  (route of 3 levels)
//   node tools/sim-trace.mjs mage average 7 15 300     ... route of 15 levels, a line every 300 ticks
import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';
mkdirSync('.tmp', { recursive: true });
await esbuild.build({ entryPoints: ['src/ai/index.ts'], bundle: true, outfile: '.tmp/ai.mjs', platform: 'node', format: 'esm', target: 'node20', define: { __DEV__: 'true' }, logLevel: 'warning' });
const ai = await import('../.tmp/ai.mjs?' + Date.now());
const [cls = 'warrior', skill = 'average', seed = '1', levels = '3', every = '600'] = process.argv.slice(2);
const r = ai.runRoute({
  seed: Number(seed), party: [{ classId: Number.isNaN(Number(cls)) ? cls : Number(cls), skill: Number.isNaN(Number(skill)) ? skill : Number(skill) }], levels: Number(levels),
  onTick(s, lv) {
    if (s.tick % Number(every) !== 0) return;
    const e = s.ents, p = s.players[0];
    let hostile = 0, near = -1, nd = 1e9;
    for (let i = 0; i < e.highWater; i++) if (e.alive[i] && e.kind[i] === 2) { hostile++; const d = Math.hypot(e.x[i] - e.x[p.ent], e.y[i] - e.y[p.ent]); if (d < nd) { nd = d; near = i; } }
    console.log(`L${lv + 1} t${s.tick} cam${s.camX.toFixed(0)} hero(${e.x[p.ent].toFixed(0)},${e.y[p.ent].toFixed(0)}) hp${e.hp[p.ent].toFixed(0)} st${p.stamina.toFixed(0)}${p.winded ? 'W' : ''} gate${s.gateIdx}/${s.gates.length} mobs${hostile} nearest ${near < 0 ? '-' : `sub${e.sub[near]}@${nd.toFixed(0)} flags${e.flags[near]} mode${e.mode[near]} (${e.x[near].toFixed(0)},${e.y[near].toFixed(0)})`} lvl${p.level} pend${p.pending}${p.panel ? ' PANEL' : ''}`);
  },
});
console.log(r.outcome, JSON.stringify(r.death ?? {}), r.levels.map((l) => `${l.index + 1}:${l.outcome}:${(l.ticks / 60).toFixed(0)}s`).join(' '));
