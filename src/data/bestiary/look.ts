// From a generated monster's stats and powers to the recipe for its picture (`MonsterLook`): a monster that shoots carries a bow,
// one that casts carries a staff, a flame-wreathed one is hot-coloured, a charger has horns. The body plan and the colours are
// otherwise dice, softened by a per-biome-per-run colour family so a biome's monsters read as kin. They are creatures of a fantasy bestiary (species.ts), not a dice roll over parts.
import { Behavior, ProjStyle, type MobDef } from '../mobs';
import type { BackKind, CrownKind, HeldKind, MonsterLook, MonsterPalette, Motif } from '../monsterLook';
import { ELEMENTS } from '../elements';
import { Dice, clamp } from './rand';
import { SPECIES, speciesWeight, type Species } from './species';
import { FROZEN } from './traits';

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
  /** The biome it lives in (ROSTERS order). */
  biome: number;
  /** Species already in this run's cast (counted), so the cast stays varied; updated as monsters are made. */
  seen?: Map<string, number>;
  /** 0..1 position in the biome's roster (a boss is 1). */
  u: number;
  /** The elements its powers are made of, the one it leans on first (none: a plain brawler). They set its colours, its eyes and its motifs. */
  elements?: readonly number[];
}

/** Natural colours for the creature (or the biome's cloth for robed ones); an element lights the eyes and trims it, and only tints a body made of it. */
function paletteFor(d: Dice, f: Faction, sp: Species, biome: number, elements: readonly number[] = []): MonsterPalette {
  const el = elements.length > 0 ? ELEMENTS[elements[0]] : null;
  let h = sp.cloth ? d.pick(f.hues) + d.range(-10, 10) : d.range(sp.hue[0], sp.hue[1]);
  let s = sp.cloth ? f.sat * 0.8 : d.range(sp.sat[0], sp.sat[1]);
  let l = sp.cloth ? clamp(f.light - 0.06, 0.28, 0.42) : d.range(sp.light[0], sp.light[1]);
  // a frozen land bleaches fur and hide; a dry one scorches it
  if (biome === FROZEN && !sp.cloth && sp.id !== 'skeleton' && sp.id !== 'yeti') { l = Math.min(0.82, l + 0.14); s *= 0.7; h = h * 0.6 + 205 * 0.4; }
  const natural = { h, s, l };
  if (el && (sp.tint || elements[0] === 5 && sp.id === 'sprite')) { h = el.hue + d.range(-10, 10); s = elements[0] === 6 || elements[0] === 8 ? 0.45 : d.range(0.5, 0.7); l = elements[0] === 5 ? 0.3 : elements[0] === 2 || elements[0] === 6 || elements[0] === 8 ? 0.58 : 0.45; }
  else if (el && sp.id === 'slime') { h = el.hue + d.range(-12, 12); s = Math.max(s, 0.45); l = clamp(l, 0.4, 0.58); }
  else if (el && sp.id === 'golem') { h = natural.h; s = natural.s; l = natural.l; }
  const base = hsl(h, s, l);
  const eye = el ? el.glow : hsl(d.pick(sp.id === 'skeleton' || sp.id === 'zombie' || sp.id === 'wraith' ? [0, 280, 160] : [48, 40, 0, 90, 20]), 0.9, 0.58);
  // trim: the second element's colour, else a natural contrast (a belly, a cloak lining)
  let accent: number;
  if (elements.length > 1) accent = ELEMENTS[elements[1]].core;
  else if (el && (sp.tint || d.chance(0.55))) accent = el.core;
  else accent = hsl(natural.h + d.pick(sp.trim), clamp(natural.s + 0.1, 0.2, 0.7), clamp(natural.l + d.range(0.08, 0.2), 0.3, 0.78));
  const metal = f.warmMetal ? hsl(d.range(24, 40), 0.35, 0.52) : hsl(d.range(205, 225), 0.14, 0.6);
  return { base, accent, eye, metal };
}

function heldFor(d: Dice, def: MobDef, traits: ReadonlySet<string>, sp: Species, boss: boolean): HeldKind {
  const hands = sp.limbs === 'biped';
  if (def.behavior === Behavior.Bomber) return 'bomb'; // the lit-fuse pose needs one in hand (a bloat or a skull carries it on its back)
  if (!hands) return def.behavior === Behavior.Caster && sp.build[0] === 'floater' && d.chance(0.4) ? 'orb' : 'none';
  if (def.behavior === Behavior.Caster) return d.pick<HeldKind>(['staff', 'staff', 'orb', 'none']);
  if (def.behavior === Behavior.Ranged) {
    switch (def.shot?.style) {
      case ProjStyle.Harpoon: return 'spear';
      case ProjStyle.Glob: return 'sling';
      case ProjStyle.Falcon: return 'none';
      case ProjStyle.Orb: case ProjStyle.Mote: return d.pick<HeldKind>(['orb', 'staff', 'orb']);
      default: return 'bow';
    }
  }
  if (traits.has('shield')) return 'shield';
  return d.pick(sp.held);
}

/** Builds the look: picks the creature it is, then dresses it the way that creature is, tinted by what its powers are made of. */
export function lookFor(d: Dice, inp: LookInput): MonsterLook {
  const { def, traits, motifs, boss, faction } = inp;
  const r = def.radius;
  const size = boss ? Math.round(d.range(46, 58)) : Math.round(clamp((r - 2) / 0.2 + d.range(-1.5, 2), 7, 26));
  const sp = d.weighted(SPECIES, (x) => speciesWeight(x, { role: def.behavior, biome: inp.biome, size, boss, traits, motifs, seen: inp.seen })) ?? SPECIES[0];
  inp.seen?.set(sp.id, (inp.seen.get(sp.id) ?? 0) + 1);
  const picked = d.pick(sp.build);
  // a squat boss in armour, or a squat giant on four legs, reads as a dome: stand it up
  const build = boss && sp.id === 'knight' ? 'tall' : picked === 'squat' && size >= 24 && sp.limbs === 'quad' ? 'wedge' : picked;
  const limbs = sp.limbs;
  const held = heldFor(d, def, traits, sp, boss);
  const arms: 0 | 1 | 2 = limbs !== 'biped' ? 0 : held === 'none' ? 2 : held === 'shield' || held === 'bow' || held === 'sling' ? 2 : d.pick<1 | 2>([1, 2, 2]);
  const head = d.pick(sp.head);
  // what its powers need shows on top of its kind: a charger is horned, a healer haloed, a flame-wreathed one burns
  const crown: CrownKind = (traits.has('heal') || traits.has('ward')) && !boss && sp.id !== 'skeleton' ? 'halo'
    : (traits.has('charge') || traits.has('launch')) && sp.crown.includes('horns') ? 'horns'
    : boss ? (sp.crown.includes('horns') ? 'horns' : sp.crown.includes('crown') ? 'crown' : d.pick<CrownKind>(['crown', ...sp.crown]))
    : d.pick(sp.crown);
  const back: BackKind = traits.has('flame') ? 'flame'
    : (traits.has('gust') || traits.has('falcon')) && !sp.back.includes('wings') && limbs === 'biped' && sp.stout[1] < 1.2 ? 'wings'
    : traits.has('thorns') && limbs !== 'none' && build !== 'serpent' ? 'spikes'
    : traits.has('armor') && sp.build.includes('squat') && d.chance(0.4) ? 'shell'
    : d.pick(sp.back);
  const eyes = d.int(sp.eyes[0], sp.eyes[1]);
  const teeth = sp.teeth && def.behavior !== Behavior.Caster;
  const jaw = d.pick(sp.jaw), pattern = d.pick(sp.pattern);
  // a boss dresses for it
  const worn = boss && sp.worn.includes('pauldron') && d.chance(0.5) ? 'pauldron' : d.pick(sp.worn);

  // species' own tells, then what its powers add
  const uniq = [...new Set<Motif>([...sp.motifs, ...motifs.filter((m) => !(sp.id === 'skeleton' && m === 'bandage'))])].slice(0, 3);
  const stout = Math.round(d.range(sp.stout[0], sp.stout[1]) * (boss ? 1.05 : 1) * 100) / 100;

  return {
    seed: d.u32(),
    kind: sp.id,
    size, stout,
    build, head, limbs, arms, back, crown, held, pattern, jaw, worn, eyes, teeth,
    motifs: uniq,
    palette: paletteFor(d, faction, sp, inp.biome, inp.elements),
    boss,
  };
}
