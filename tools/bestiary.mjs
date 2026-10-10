// Prints the random bestiary of a run seed: every monster's role, numbers and powers, biome by biome.
//   node tools/bestiary.mjs [seed]          (default: a random one)
import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('.tmp', { recursive: true });
await esbuild.build({
  stdin: { contents: "export { generateBestiary } from './src/data/bestiary'; export { ROSTERS } from './src/data/roster'; export { Behavior, CLASSIC_MOBS } from './src/data/mobs'; export { ELEMENTS } from './src/data/elements';", resolveDir: '.', loader: 'ts' },
  bundle: true, outfile: '.tmp/bestiary-tool.mjs', platform: 'node', format: 'esm', target: 'node20', define: { __DEV__: 'true' }, logLevel: 'warning',
});
const m = await import('../.tmp/bestiary-tool.mjs?' + Date.now());
const seed = process.argv[2] !== undefined ? Number(process.argv[2]) >>> 0 : (Math.random() * 2 ** 32) >>> 0;
const b = m.generateBestiary(seed);
const ROLE = ['melee', 'ranged', 'bomber', 'boss', 'caster'];
const BIOME = ['Meadow', 'Haunted Keep', 'Frozen Pass', 'Sunken Marsh', 'Scorched Dunes'];
console.log(`bestiary for seed ${seed}`);
const line = (t) => {
  const d = b.defs[t], l = b.looks[t];
  const sp = d.special;
  const mods = sp ? [sp.count > 1 && `x${sp.count}`, sp.pattern && `pattern ${sp.pattern}`, sp.residue && 'residue', sp.pierce && 'pierce', sp.splash && 'splash', sp.homing && 'homing'].filter(Boolean).join(' ') : '';
  const extra = [sp && `special:${sp.kind}${sp.element ? '/' + m.ELEMENTS[sp.element].name : ''} ${mods}`, d.charge && !d.boss && 'charge', d.shot && `shot:${d.shot.count}x${d.shot.element ? '/' + m.ELEMENTS[d.shot.element].name : ''}`, d.shield && 'shield'].filter(Boolean).join(' ');
  return `  ${String(t).padStart(2)} ${d.name.padEnd(22)} ${ROLE[d.behavior].padEnd(6)} hp ${String(d.hp).padStart(3)} dmg ${String(d.damage).padStart(2)} spd ${d.speed.toFixed(2)} r ${d.radius.toFixed(1)}  ${l.build}/${l.limbs}/${l.head}/${l.held}  {${b.elements[t].map((x) => m.ELEMENTS[x].name).join('+') || '-'}} [${b.traits[t].join(', ')}] ${extra}`;
};
m.ROSTERS.forEach((r, bi) => {
  console.log(`\n${BIOME[bi]}`);
  for (const en of r.entries) console.log(line(en.type));
  const d = b.defs[r.boss];
  console.log(line(r.boss) + `\n      ${d.boss.title}: ${d.boss.moves.map((mv) => (mv.kind === 'special' ? mv.special.kind : mv.kind) + (mv.enragedOnly ? '*' : '')).join(' ')}`);
});
