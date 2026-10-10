// Run one simulated route up to a tick and print what the first pilot decided each tick for a few ticks (its plan, the buttons and stick it sent).
//   node tools/sim-peek.mjs warrior expert 6 --levels=3 --at=3000 --n=12
import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';
mkdirSync('.tmp', { recursive: true });
await esbuild.build({ entryPoints: ['src/ai/index.ts'], bundle: true, outfile: '.tmp/ai.mjs', platform: 'node', format: 'esm', target: 'node20', define: { __DEV__: 'true' }, logLevel: 'warning' });
const ai = await import('../.tmp/ai.mjs?' + Date.now());
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, Number(v ?? 1)]; }));
const [cls = 'warrior', skill = 'average', seed = '1'] = pos;
const at = flags.at ?? 1000, n = flags.n ?? 10, level = (flags.level ?? 1) - 1;
let shown = 0;
const BTN = { 1: 'ATK', 2: 'A1', 4: 'DODGE', 8: 'JOIN', 16: 'INT', 32: 'SWAP', 64: 'A2', 128: 'LVL', 256: 'OK' };
const names = (b) => Object.entries(BTN).filter(([k]) => b & k).map(([, v]) => v).join('+') || '-';
ai.runRoute({
  seed: Number(seed), party: [{ classId: Number.isNaN(Number(cls)) ? cls : Number(cls), skill: Number.isNaN(Number(skill)) ? skill : Number(skill) }], levels: flags.levels ?? 3,
  onTick(s, lv, pilots) {
    if (lv !== level || s.tick < at || shown >= n) return;
    shown++;
    const e = s.ents, p = s.players[0];
    console.log(`t${s.tick} hero(${e.x[p.ent].toFixed(0)},${e.y[p.ent].toFixed(0)}) hp${e.hp[p.ent].toFixed(0)} st${p.stamina.toFixed(0)} cdAtk${p.cdAttack} fury${p.fury.toFixed(0)} vanish${p.vanishT} revealT${p.revealT} prevBtn=${names(p.prevButtons)} delay${p.staminaDelay} winded=${p.winded} wither${p.witherT} slow${p.slowT} root${p.rootT} silence${p.silenceT} face(${p.faceX.toFixed(2)},${p.faceY.toFixed(2)})`);
    const pl = pilots[0].plan, v = pilots[0].view;
    console.log(`   plan goal(${pl.hasGoal ? pl.gx.toFixed(0) + ',' + pl.gy.toFixed(0) : '-'}) aim(${pl.hasAim ? pl.ax.toFixed(2) + ',' + pl.ay.toFixed(2) : '-'}) attack=${pl.attack} special=${pl.special} nova=${pl.nova} roll=${pl.roll}  target=${pilots[0].te} td=${pilots[0].td.toFixed(0)} recovering=${pilots[0].recovering} lastDir=${pilots[0].lastDir} stun? dashT${p.dashT} pullT${p.pullT} confuse${p.confuseT} poison${p.poisonT} threats=${pilots[0].threats.n} c24=${v.c24} c40=${v.c40} c70=${v.c70}`);
    { const t = pilots[0].te; if (t >= 0) console.log(`   target sub${e.sub[t]} hp${e.hp[t].toFixed(1)}/${e.maxhp[t]} at(${e.x[t].toFixed(0)},${e.y[t].toFixed(0)}) flags${e.flags[t]} mode${e.mode[t]} elite${e.elite[t]} shield${e.shieldHp[t]} stun${e.stun[t]} wind${e.wind[t]} atk${e.atk[t]}`); }
    if (shown === 1 && flags.mobs) for (let i = 0; i < e.highWater; i++) if (e.alive[i] && e.kind[i] !== 1) console.log(`   ent${i} kind${e.kind[i]} sub${e.sub[i]} (${e.x[i].toFixed(0)},${e.y[i].toFixed(0)}) hp${e.hp[i].toFixed(1)} flags${e.flags[i]} mode${e.mode[i]} elite${e.elite[i]}`);
    if (shown === n) throw new Error('peek-done');
  },
});
