// From a generated monster's stats and powers to the recipe for its picture (`MonsterLook`): a monster that shoots carries a bow,
// one that casts carries a staff, a flame-wreathed one is hot-coloured, a charger has horns. The body plan and the colours are
// otherwise dice, softened by a per-biome-per-run colour family so a biome's monsters read as kin. They do not have to make sense.
import { Behavior, ProjStyle, type MobDef } from '../mobs';
import type { BackKind, Build, CrownKind, HeadKind, HeldKind, LimbKind, MonsterLook, MonsterPalette, Motif } from '../monsterLook';
import { Dice, clamp } from './rand';

/** The colour family one biome's monsters share in one run. */
export interface Faction {
  hues: readonly number[];
  sat: number;
  light: number;
  /** Where the family's metal tends: cold steel or warm bronze. */
  warmMetal: boolean;
}

export function makeFaction(d: Dice): Faction {
  const h0 = d.range(0, 360);
  return { hues: [h0, (h0 + d.range(30, 70)) % 360, (h0 + d.range(160, 200)) % 360], sat: d.range(0.38, 0.68), light: d.range(0.36, 0.5), warmMetal: d.chance(0.5) };
}

function hsl(h: number, s: number, l: number): number {
  h = ((h % 360) + 360) % 360 / 360;
  s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number): number => {
    t = (t + 1) % 1;
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return Math.round(v * 255);
  };
  return (f(h + 1 / 3) << 16) | (f(h) << 8) | f(h - 1 / 3);
}

/** What the monster's powers say about its tells: the motif list the picture paints on it. */
export interface LookInput {
  def: MobDef;
  /** Ids of the traits it wears (see traits.ts). */
  traits: ReadonlySet<string>;
  /** Motifs the traits ask for. */
  motifs: readonly Motif[];
  boss: boolean;
  faction: Faction;
  /** 0..1 position in the biome's roster (a boss is 1). */
  u: number;
}

const has = (m: readonly Motif[], x: Motif): boolean => m.includes(x);

function paletteFor(d: Dice, f: Faction, motifs: readonly Motif[], size: number): MonsterPalette {
  let h = d.pick(f.hues) + d.range(-14, 14);
  let s = f.sat + d.range(-0.08, 0.1);
  let l = f.light + (size < 11 ? 0.08 : size > 20 ? -0.04 : 0) + d.range(-0.05, 0.06);
  let eye = hsl(d.pick([0, 48, 180, 300, 90]), 0.9, 0.58);
  const roll = d.f();
  if (has(motifs, 'fire') && roll < 0.7) { h = d.range(4, 34); s = 0.7; l = 0.42; eye = hsl(d.range(40, 56), 1, 0.62); }
  else if (has(motifs, 'frost') && roll < 0.7) { h = d.range(185, 220); s = 0.5; l = 0.6; eye = hsl(190, 0.9, 0.8); }
  else if (has(motifs, 'poison') && roll < 0.65) { h = d.range(80, 135); s = 0.5; l = 0.4; eye = hsl(d.range(70, 95), 1, 0.6); }
  else if ((has(motifs, 'bones') || has(motifs, 'bandage')) && roll < 0.7) { h = d.range(35, 55); s = 0.18; l = 0.74; eye = hsl(d.pick([0, 280]), 0.8, 0.5); }
  else if (has(motifs, 'ghost') && roll < 0.7) { h = d.range(200, 270); s = 0.25; l = 0.7; eye = hsl(d.pick([170, 300]), 0.9, 0.75); }
  else if (has(motifs, 'stone') && roll < 0.7) { h = d.range(20, 50); s = 0.1; l = 0.46; }
  const base = hsl(h, s, l);
  const accent = hsl(h + d.pick([-50, 40, 150, 180, 210]), clamp(s + 0.1, 0.3, 0.8), clamp(l + d.range(-0.05, 0.16), 0.3, 0.72));
  const metal = f.warmMetal ? hsl(d.range(24, 40), 0.35, 0.52) : hsl(d.range(205, 225), 0.14, 0.6);
  return { base, accent, eye, metal };
}

function heldFor(d: Dice, def: MobDef, traits: ReadonlySet<string>, boss: boolean, limbs: LimbKind): HeldKind {
  if (def.behavior === Behavior.Bomber) return 'bomb';
  if (limbs === 'many' || limbs === 'none') return def.behavior === Behavior.Caster && d.chance(0.6) ? 'orb' : 'none';
  if (def.behavior === Behavior.Caster) return d.pick(['staff', 'staff', 'orb', 'orb', 'none']);
  if (def.behavior === Behavior.Ranged) {
    switch (def.shot?.style) {
      case ProjStyle.Harpoon: return 'spear';
      case ProjStyle.Glob: return d.pick(['sling', 'none']);
      case ProjStyle.Falcon: return 'none';
      case ProjStyle.Fire: return d.pick(['bow', 'orb']);
      default: return 'bow';
    }
  }
  if (traits.has('shield')) return 'shield';
  if (limbs === 'quad' && !boss) return d.chance(0.15) ? 'club' : 'none';
  return d.weighted<HeldKind>(['club', 'sword', 'axe', 'spear', 'none'], (k) => (k === 'none' ? 1.2 : 2)) ?? 'club';
}

/** Builds the look. Every choice is the dice's, nudged by what the monster is and does. */
export function lookFor(d: Dice, inp: LookInput): MonsterLook {
  const { def, traits, motifs, boss, faction } = inp;
  const r = def.radius;
  const size = boss ? Math.round(d.range(46, 58)) : Math.round(clamp((r - 2) / 0.2 + d.range(-1.5, 2), 7, 26));
  const tiny = size <= 10, big = size >= 18;
  const caster = def.behavior === Behavior.Caster, ranged = def.behavior === Behavior.Ranged;

  const build = d.weighted<Build>(['blob', 'tall', 'squat', 'wedge', 'round', 'serpent', 'insect', 'floater'], (b) => {
    let w = 1;
    if (has(motifs, 'ghost') && b === 'floater') w += 4;
    if (traits.has('burrow') && b === 'serpent') w += 6;
    if ((traits.has('hop') || traits.has('spores')) && (b === 'round' || b === 'squat' || b === 'blob')) w += 2;
    if (tiny && (b === 'insect' || b === 'blob')) w += 2;
    if (tiny && (b === 'serpent' || b === 'tall')) w -= 0.5;
    if (big && (b === 'squat' || b === 'tall' || b === 'wedge')) w += 2;
    if (big && (b === 'insect' || b === 'floater' || b === 'serpent')) w -= 0.6;
    if (caster && (b === 'tall' || b === 'floater')) w += 2;
    if (ranged && (b === 'tall' || b === 'wedge')) w += 1.5;
    if (def.behavior === Behavior.Bomber && (b === 'round' || b === 'blob' || b === 'insect')) w += 2;
    if (traits.has('weave') && (b === 'wedge' || b === 'insect')) w += 1.5;
    if (boss && (b === 'insect' || b === 'serpent' || b === 'blob')) w -= 0.8;
    return w;
  })!;

  const limbs: LimbKind = build === 'floater' ? (d.chance(0.35) ? 'tentacles' : 'none')
    : build === 'serpent' ? 'none'
    : build === 'insect' ? 'many'
    : (build === 'wedge' || traits.has('pack') || traits.has('weave') || traits.has('charge')) && !boss && d.chance(0.65) ? 'quad'
    : build === 'blob' ? d.pick<LimbKind>(['biped', 'quad', 'none', 'none'])
    : d.chance(boss ? 0.15 : 0.25) ? 'quad' : 'biped';

  const held = heldFor(d, def, traits, boss, limbs);
  const arms: 0 | 1 | 2 = limbs === 'many' || build === 'serpent' ? 0 : held === 'none' ? (limbs === 'biped' ? 2 : 0) : held === 'shield' || held === 'bow' || held === 'sling' ? 2 : d.pick<1 | 2>([1, 2, 2]);

  const head: HeadKind = build === 'blob' && d.chance(0.35) ? 'none'
    : has(motifs, 'bones') && d.chance(0.6) ? 'skull'
    : caster && d.chance(0.5) ? 'hood'
    : (traits.has('armor') || traits.has('shield')) && d.chance(0.5) ? 'helm'
    : (traits.has('drain') || traits.has('spores')) && d.chance(0.4) ? 'maw'
    : limbs === 'quad' && d.chance(0.6) ? 'beast'
    : d.weighted<HeadKind>(['round', 'skull', 'beast', 'horned', 'cyclops', 'maw', 'hood', 'helm'], (h) => (h === 'round' ? 2.5 : h === 'cyclops' ? 0.8 : 1))!;

  const crown: CrownKind = traits.has('charge') || traits.has('launch') || traits.has('berserk') ? d.pick<CrownKind>(['horns', 'horns', 'antlers'])
    : traits.has('heal') || traits.has('ward') ? 'halo'
    : boss || traits.has('rally') || traits.has('summon') ? d.pick<CrownKind>(['crown', 'horns', 'crest'])
    : build === 'insect' ? 'antenna'
    : d.weighted<CrownKind>(['horns', 'antlers', 'ears', 'crest', 'antenna', 'none'], (c) => (c === 'none' ? 3 : 1))!;

  const back: BackKind = traits.has('flame') ? 'flame'
    : traits.has('gust') || traits.has('blink') || traits.has('falcon') ? d.pick<BackKind>(['wings', 'wings', 'cape'])
    : traits.has('thorns') || traits.has('berserk') ? 'spikes'
    : (traits.has('armor') || build === 'round') && d.chance(0.5) ? 'shell'
    : caster && d.chance(0.5) ? 'cape'
    : build === 'serpent' ? d.pick<BackKind>(['fins', 'none', 'spikes'])
    : limbs === 'quad' && d.chance(0.6) ? 'tail'
    : d.weighted<BackKind>(['wings', 'tail', 'shell', 'spikes', 'cape', 'tentacles', 'fins', 'none'], (b) => (b === 'none' ? 4 : b === 'tentacles' || b === 'fins' ? 0.5 : 1))!;

  const eyes = head === 'cyclops' ? 1 : build === 'insect' || (build === 'floater' && d.chance(0.4)) ? d.int(2, 4) : build === 'blob' ? d.int(1, 3) : d.chance(0.12) ? 3 : 2;
  const teeth = !caster && !ranged && d.chance(0.5);

  const all = [...motifs];
  if (all.length < 2 && d.chance(0.35)) all.push(d.pick<Motif>(['fur', 'stone', 'slime', 'glow', 'armor', 'bones', 'thorns', 'bandage']));
  const uniq = [...new Set(all)].slice(0, 3);

  return {
    seed: d.u32(),
    size,
    stout: Math.round(d.range(boss ? 0.95 : 0.78, boss ? 1.3 : traits.has('armor') || traits.has('shield') ? 1.45 : 1.3) * 100) / 100,
    build, head, limbs, arms, back, crown, held, eyes, teeth,
    motifs: uniq,
    palette: paletteFor(d, faction, uniq, size),
    boss,
  };
}
