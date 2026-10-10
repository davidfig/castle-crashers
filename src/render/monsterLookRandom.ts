// Dev/test helper: a random MonsterLook from a seed. Used by the monster-sheet tool and the fuzz tests; the real bestiary
// generator picks looks to match each enemy's stats instead.
import type { BackKind, Build, CrownKind, HeadKind, HeldKind, LimbKind, MonsterLook, Motif } from '../data/monsterLook';

export const BUILDS: readonly Build[] = ['blob', 'tall', 'squat', 'wedge', 'round', 'serpent', 'insect', 'floater'];
export const HEADS: readonly HeadKind[] = ['round', 'skull', 'beast', 'horned', 'cyclops', 'maw', 'hood', 'helm', 'none'];
export const LIMBS: readonly LimbKind[] = ['biped', 'quad', 'many', 'tentacles', 'none'];
export const BACKS: readonly BackKind[] = ['wings', 'tail', 'shell', 'spikes', 'cape', 'tentacles', 'fins', 'flame', 'none'];
export const CROWNS: readonly CrownKind[] = ['horns', 'antlers', 'ears', 'crest', 'halo', 'crown', 'antenna', 'none'];
export const HELDS: readonly HeldKind[] = ['club', 'sword', 'axe', 'spear', 'bow', 'staff', 'shield', 'bomb', 'orb', 'sling', 'none'];
export const MOTIFS: readonly Motif[] = ['fire', 'frost', 'poison', 'ghost', 'armor', 'bones', 'fur', 'slime', 'glow', 'stone', 'bandage', 'thorns', 'lightning', 'holy', 'wind', 'arcane', 'blood', 'shadow'];

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** HSL (h 0..1) to 0xRRGGBB. */
function hsl(h: number, s: number, l: number): number {
  const f = (n: number): number => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

export interface RandomLookOpts { boss?: boolean; size?: number; build?: Build; held?: HeldKind; motifs?: readonly Motif[] }

export function randomLook(seed: number, opts: RandomLookOpts = {}): MonsterLook {
  const r = mulberry(seed * 7919 + 13);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)];
  const boss = !!opts.boss;
  const size = opts.size ?? (boss ? 44 + Math.floor(r() * 21) : 7 + Math.floor(Math.pow(r(), 1.3) * 20));
  const hue = r();
  const nm = r() < 0.55 ? 0 : r() < 0.7 ? 1 : 2 + Math.floor(r() * 2);
  const motifs: Motif[] = [];
  const want = opts.motifs ?? [];
  for (const mo of want) motifs.push(mo);
  if (!opts.motifs) for (let i = 0; i < nm; i++) { const mo = pick(MOTIFS); if (!motifs.includes(mo)) motifs.push(mo); }
  const base = hsl(hue, 0.3 + r() * 0.4, 0.34 + r() * 0.26);
  return {
    seed: Math.floor(r() * 0x7fffffff),
    size,
    stout: 0.7 + r() * 0.7,
    build: opts.build ?? pick(BUILDS),
    head: pick(HEADS),
    limbs: pick(LIMBS),
    arms: pick([0, 1, 2, 2, 2] as const),
    back: r() < 0.45 ? 'none' : pick(BACKS),
    crown: r() < 0.4 ? 'none' : pick(CROWNS),
    held: opts.held ?? (r() < 0.25 ? 'none' : pick(HELDS)),
    eyes: 1 + Math.floor(r() * 4),
    teeth: r() < 0.5,
    motifs,
    palette: {
      base,
      accent: hsl((hue + 0.1 + r() * 0.5) % 1, 0.35 + r() * 0.45, 0.4 + r() * 0.3),
      eye: hsl(r(), 0.9, 0.58 + r() * 0.12),
      metal: hsl(0.55 + r() * 0.15, 0.08 + r() * 0.2, 0.55 + r() * 0.3),
    },
    boss,
  };
}
