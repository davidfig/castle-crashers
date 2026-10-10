// A generated boss: a huge monster with a repertoire built from the same skills the ordinary monsters use (a ground slam, a war cry that calls the biome's
// crowd, a charge, and four or five telegraphed skills), so the fight is new each run but every move is one the game already reads and the player can learn
// to dodge. The boss has an element it is made of, and most of its skills are made of it, with the odd one out in another.
import { ELEMENTS } from '../elements';
import { Behavior, type BossDef, type BossMove, type MobDef } from '../mobs';
import type { Motif, MonsterLook } from '../monsterLook';
import { lookFor, type Faction } from './look';
import { bossTitle } from './names';
import type { BiomePlan } from './plan';
import { Dice, round } from './rand';
import { BOSS_SPECIALS, bossSpecial, ELEMENTAL_KINDS, type SpecialKind } from './specials';
import { BIOME_ELEMENTS, FROZEN, MARSH, SKILL_RULES, pickAffinity } from './traits';

export interface MadeBoss {
  def: MobDef;
  look: MonsterLook;
  /** The skills it can cast, in its move order, as `kind:element`. */
  traits: string[];
  elements: number[];
}

/** Kinds that hurt, as opposed to the support moves (healing, wards, rallies). */
const HARMFUL: ReadonlySet<SpecialKind> = new Set(['lob', 'nova', 'storm', 'trap', 'beam', 'whiteout', 'leap', 'gust', 'pit', 'wail', 'bolt', 'ring', 'cone', 'totem']);
const SUPPORT: ReadonlySet<SpecialKind> = new Set(['heal', 'ward', 'rally']);

export function makeBoss(bp: BiomePlan, faction: Faction, names: Set<string>, seed: number): MadeBoss {
  const d = new Dice(seed, bp.boss * 104729 + 5);
  const frost = bp.biome === FROZEN;
  const primary = pickAffinity(d, bp.biome, 0.04);
  // each skill is made of the boss's element, now and then another of the biome's
  const elementFor = (kind: SpecialKind): number => (!ELEMENTAL_KINDS.has(kind) ? 0 : d.chance(0.72) ? primary : d.pick(BIOME_ELEMENTS[bp.biome]));
  const ctxFor = (el: number) => ({ swarm: bp.swarm, frost: frost && !el, bog: bp.biome === MARSH && !el, element: el, power: 1.3 });

  // four distinct skills, themed by biome, at least two of them harmful and at most one of them support
  const kinds: SpecialKind[] = [];
  for (let guard = 0; kinds.length < 4 && guard < 80; guard++) {
    const k = d.weighted(BOSS_SPECIALS.filter((x) => !kinds.includes(x)), (x) => 1 + (SKILL_RULES[x]?.themes?.includes(bp.biome) ? 2.5 : 0) + (primary && SKILL_RULES[x]?.natural?.includes(primary) ? 2 : 0));
    if (!k) break;
    if (SUPPORT.has(k) && kinds.some((x) => SUPPORT.has(x))) continue;
    kinds.push(k);
  }
  while (kinds.filter((k) => HARMFUL.has(k)).length < 2) {
    const k = d.pick([...HARMFUL].filter((x) => !kinds.includes(x)));
    kinds[kinds.findIndex((x) => !HARMFUL.has(x))] = k;
  }
  const elems = kinds.map(elementFor);
  const specials = kinds.map((k, i) => bossSpecial(k, d, ctxFor(elems[i])));
  // one more only a wounded boss uses
  const extra = d.pick([...HARMFUL].filter((x) => !kinds.includes(x)));
  const extraEl = elementFor(extra);
  const enragedOnly = bossSpecial(extra, d, ctxFor(extraEl));

  const moves: BossMove[] = [{ kind: 'roar', weight: round(d.range(2, 2.6), 1) }];
  const slam = d.chance(0.6), charge = d.chance(0.65) || !slam;
  if (slam) moves.push({ kind: 'slam', weight: round(d.range(3, 4), 1) });
  if (charge) moves.push({ kind: 'charge', weight: round(d.range(2.2, 3), 1) });
  const poses = ['slam', 'roar', 'smash'] as const;
  for (const sp of specials) moves.push({ kind: 'special', weight: round(d.range(2, 3.5), 1), pose: d.pick(poses), special: sp });
  moves.push({ kind: 'special', weight: round(d.range(2, 2.5), 1), pose: d.pick(poses), enragedOnly: true, special: enragedOnly });

  const dmg = d.int(22, 25);
  const boss: BossDef = {
    title: '', frost: frost || primary === 2,
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

  const elements: number[] = [];
  if (primary) elements.push(primary);
  for (const el of [...elems, extraEl]) if (el && !elements.includes(el)) elements.push(el);
  const motifs: Motif[] = [];
  for (const el of elements.slice(0, 2)) if (!motifs.includes(ELEMENTS[el].motif)) motifs.push(ELEMENTS[el].motif);
  for (const k of kinds) for (const m of SKILL_RULES[k]?.motifs ?? []) if (!motifs.includes(m) && motifs.length < 3) motifs.push(m);
  if (frost && !motifs.includes('frost') && motifs.length < 3) motifs.push('frost');
  const look = lookFor(d, { def, traits: new Set(kinds), motifs: motifs.slice(0, 3), boss: true, faction, u: 1, elements });
  boss.title = bossTitle(look, d, names, elements);
  names.add(boss.title);
  def.name = boss.title.toLowerCase();
  const label = (k: SpecialKind, el: number): string => (el ? `${k}:${ELEMENTS[el].name}` : k);
  return { def, look, traits: [...kinds.map((k, i) => label(k, elems[i])), label(extra, extraEl)], elements };
}
