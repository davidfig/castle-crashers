// A generated boss: a huge monster with a repertoire built from the same moves the hand-made bosses use (a ground slam, a war cry that
// calls the biome's crowd, a charge, and four or five telegraphed specials), so the fight is new each run but every move is one the
// game already reads and the player can learn to dodge.
import { Behavior, type BossDef, type BossMove, type MobDef, type Special } from '../mobs';
import type { Motif, MonsterLook } from '../monsterLook';
import { lookFor, type Faction } from './look';
import { bossTitle } from './names';
import type { BiomePlan } from './plan';
import { Dice, round } from './rand';
import { BOSS_SPECIALS, bossSpecial, type SpecialKind } from './specials';
import { FROZEN, MARSH, TRAIT_BY_ID } from './traits';

export interface MadeBoss {
  def: MobDef;
  look: MonsterLook;
  /** The specials it can cast, in its move order. */
  traits: string[];
}

/** Kinds that hurt, as opposed to the support moves (healing, wards, rallies). */
const HARMFUL: ReadonlySet<SpecialKind> = new Set(['lob', 'nova', 'storm', 'trap', 'beam', 'whiteout', 'leap', 'gust', 'pit', 'wail']);
const SUPPORT: ReadonlySet<SpecialKind> = new Set(['heal', 'ward', 'rally']);

export function makeBoss(bp: BiomePlan, faction: Faction, names: Set<string>, seed: number): MadeBoss {
  const d = new Dice(seed, bp.boss * 104729 + 5);
  const c = bp.bossClassic;
  const frost = bp.biome === FROZEN;
  const ctx = { swarm: bp.swarm, frost, bog: bp.biome === MARSH };

  // four distinct specials, themed by biome, at least two of them harmful and at most one of them support
  const kinds: SpecialKind[] = [];
  for (let guard = 0; kinds.length < 4 && guard < 80; guard++) {
    const k = d.weighted(BOSS_SPECIALS.filter((x) => !kinds.includes(x)), (x) => 1 + (TRAIT_BY_ID.get(x)?.themes?.includes(bp.biome) ? 2.5 : 0));
    if (!k) break;
    if (SUPPORT.has(k) && kinds.some((x) => SUPPORT.has(x))) continue;
    kinds.push(k);
  }
  while (kinds.filter((k) => HARMFUL.has(k)).length < 2) {
    const k = d.pick([...HARMFUL].filter((x) => !kinds.includes(x)));
    kinds[kinds.findIndex((x) => !HARMFUL.has(x))] = k;
  }
  const specials = kinds.map((k) => bossSpecial(k, d, ctx));
  // one more only a wounded boss uses
  const extra = d.pick([...HARMFUL].filter((x) => !kinds.includes(x)));
  const enragedOnly = bossSpecial(extra, d, ctx);

  const moves: BossMove[] = [{ kind: 'roar', weight: round(d.range(2, 2.6), 1) }];
  const slam = d.chance(0.6), charge = d.chance(0.65) || !slam;
  if (slam) moves.push({ kind: 'slam', weight: round(d.range(3, 4), 1) });
  if (charge) moves.push({ kind: 'charge', weight: round(d.range(2.2, 3), 1) });
  const poses = ['slam', 'roar', 'smash'] as const;
  for (const sp of specials) moves.push({ kind: 'special', weight: round(d.range(2, 3.5), 1), pose: d.pick(poses), special: sp });
  moves.push({ kind: 'special', weight: round(d.range(2, 2.5), 1), pose: d.pick(poses), enragedOnly: true, special: enragedOnly });

  const dmg = d.int(22, 25);
  const boss: BossDef = {
    title: '', frost,
    moves,
    slamRadius: d.int(80, 94), slamWindup: d.int(56, 58), slamDamage: d.int(18, 24), roarWindup: d.int(50, 52), summonSize: d.int(8, 10), retinue: d.int(26, 28),
    specialGap: d.int(220, 240), specialGapEnraged: d.int(130, 150), enrageAt: 0.5, enrageSpeed: round(d.range(1.3, 1.4), 2), hpScale: [1, 1.6, 2.1, 2.6],
    lootCoins: d.int(14, 16), lootValue: 12,
  };
  const def: MobDef = {
    name: '', behavior: Behavior.Boss, hp: d.int(650, 760), speed: round(d.range(0.26, 0.31), 2), radius: 22, damage: dmg, atkCooldown: 100, reach: 30, windup: d.int(28, 32),
    knockResist: 0, shield: false, coinChance: 0, coinMin: 0, coinMax: 0, armored: true,
    charge: { chance: 0, speed: round(d.range(2.6, 3.2), 1), distance: d.int(220, 290), windup: d.int(44, 46), cooldown: 0, damage: dmg + 4, minRange: 80, maxRange: d.int(280, 310), dazed: d.int(80, 85) },
    boss,
  };
  void c;

  const motifs: Motif[] = [];
  for (const k of kinds) for (const m of TRAIT_BY_ID.get(k)?.motifs ?? []) if (!motifs.includes(m)) motifs.push(m);
  if (frost && !motifs.includes('frost')) motifs.unshift('frost');
  const look = lookFor(d, { def, traits: new Set(kinds), motifs: motifs.slice(0, 3), boss: true, faction, u: 1 });
  boss.title = bossTitle(look, d, names);
  names.add(boss.title);
  def.name = boss.title.toLowerCase();
  return { def, look, traits: [...kinds, extra] };
}

export type { Special };
