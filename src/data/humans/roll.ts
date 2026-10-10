// Rolls one person of an office: a wardrobe drawn from the office's own tables, then a face, then colours. Every table is plain data; the
// dice are the only source of choice, so (seed, office) is the whole of a person.
import type { BeardKind, CloakKind, Extra, FolkRole, Garment, HairStyle, HeldKind, Headwear, HumanBuild, HumanLook, HumanPalette } from '../humanLook';
import type { Dice } from '../bestiary/rand';
import { clamp } from '../bestiary/rand';

/** The court's colours for a run: a cloth hue the King, Herald and Captain share (each in their own depth), and the metal that trims it. */
export interface Livery { hue: number; sat: number; trim: number; second: number }

export function hsl(h: number, s: number, l: number): number {
  h = (((h % 360) + 360) % 360) / 360;
  const f = (n: number): number => { const k = (n + h * 12) % 12; const a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

const GOLD = 0xe3b94a, SILVER = 0xc9d2dc, BRASS = 0xc89a46;
export function crownLivery(d: Dice): Livery {
  const hue = d.pick([0, 12, 215, 225, 270, 285, 150, 168]);
  return { hue, sat: d.range(0.42, 0.62), trim: d.chance(0.7) ? GOLD : SILVER, second: d.pick([hue + 150, hue + 180, hue - 150, 48, 0]) };
}

const SKIN = [0xf2cba5, 0xe8b78f, 0xd9a073, 0xc0865a, 0xa56a43, 0x7f4c2e, 0x5e3720] as const;
const HAIR_DARK = [0x1c1620, 0x2e211a, 0x4a3022, 0x6b4426] as const;
const HAIR_LIGHT = [0x9a5a2a, 0xc2893a, 0xdcb45c, 0xb6452a] as const;
const HAIR_OLD = [0xc9c6cc, 0xe8e6ea, 0x9a98a0] as const;
const LEATHER = [0x5a3a22, 0x6e4a2a, 0x3e2a1e] as const;

type W<T> = readonly (readonly [T, number])[];
const wp = <T>(d: Dice, table: W<T>): T => d.weighted(table, (e) => e[1])![0];

interface Spec {
  height: [number, number];
  build: W<HumanBuild>;
  stoop: [number, number];
  hair: W<HairStyle>;
  beard: W<BeardKind>;
  head: W<Headwear>;
  garment: W<Garment>;
  hem: W<0 | 1 | 2>;
  cloak: W<CloakKind>;
  held: W<HeldKind>;
  extras: W<Extra | null>[];
  old: boolean;
}

const SPECS: Record<FolkRole, Spec> = {
  noble: {
    height: [17, 19], stoop: [0, 0], old: false,
    build: [['average', 3], ['stout', 3], ['broad', 2]],
    hair: [['short', 3], ['long', 2], ['crop', 2], ['bald', 1]],
    beard: [['none', 3], ['full', 3], ['goatee', 2], ['moustache', 2]],
    head: [['crown', 6], ['circlet', 3], ['none', 1]],
    garment: [['robe', 5], ['coat', 5]], hem: [[2, 5], [1, 4]],
    cloak: [['fur', 5], ['long', 4], ['none', 1]],
    held: [['sceptre', 5], ['none', 4], ['sword', 1]],
    extras: [[['chain', 4], ['sash', 2], [null, 2]], [['trimHem', 5], [null, 2]], [['belt', 3], [null, 2]]],
  },
  herald: {
    height: [17, 19], stoop: [0, 0], old: false,
    build: [['slight', 3], ['average', 4]],
    hair: [['short', 3], ['mop', 3], ['crop', 2], ['long', 1]],
    beard: [['none', 6], ['moustache', 3], ['goatee', 1]],
    head: [['plume', 7], ['cap', 3]],
    garment: [['tabard', 1]], hem: [[1, 1]],
    cloak: [['none', 5], ['short', 4]],
    held: [['trumpet', 1]],
    extras: [[['sash', 4], ['chain', 2], [null, 1]], [['belt', 1]], [['trimHem', 3], [null, 2]]],
  },
  captain: {
    height: [18, 21], stoop: [0, 0], old: false,
    build: [['broad', 5], ['average', 3], ['stout', 1]],
    hair: [['crop', 4], ['short', 3], ['bald', 1]],
    beard: [['stubble', 4], ['moustache', 3], ['none', 2], ['full', 2]],
    head: [['helm', 6], ['none', 2], ['cap', 1]],
    garment: [['plate', 5], ['coat', 3]], hem: [[1, 4], [0, 2]],
    cloak: [['long', 5], ['short', 3], ['none', 1]],
    held: [['sword', 1]],
    extras: [[['pauldrons', 5], [null, 2]], [['belt', 1]], [['sash', 2], [null, 4]]],
  },
  clerk: {
    height: [16, 18], stoop: [0, 1], old: false,
    build: [['slight', 6], ['average', 3]],
    hair: [['short', 3], ['tonsure', 3], ['bald', 2], ['mop', 2]],
    beard: [['none', 6], ['moustache', 2], ['goatee', 1]],
    head: [['cap', 4], ['coif', 2], ['none', 4]],
    garment: [['robe', 7], ['coat', 2]], hem: [[2, 6], [1, 2]],
    cloak: [['none', 1]],
    held: [['ledger', 5], ['scroll', 5]],
    extras: [[['spectacles', 6], [null, 4]], [['belt', 4], [null, 2]], [['scarf', 2], [null, 6]]],
  },
  peddler: {
    height: [16, 19], stoop: [0, 1], old: false,
    build: [['stout', 3], ['average', 4], ['slight', 2]],
    hair: [['mop', 3], ['short', 3], ['wild', 2], ['braid', 1]],
    beard: [['none', 3], ['stubble', 3], ['full', 2], ['moustache', 2]],
    head: [['brim', 6], ['cap', 3], ['hood', 2]],
    garment: [['coat', 5], ['tunic', 4]], hem: [[1, 5], [0, 3]],
    cloak: [['short', 4], ['none', 4]],
    held: [['cane', 3], ['lantern', 3], ['none', 3]],
    extras: [[['pack', 1]], [['apron', 3], [null, 4]], [['scarf', 3], [null, 3]]],
  },
  elder: {
    height: [15, 18], stoop: [1, 2], old: true,
    build: [['slight', 6], ['average', 3]],
    hair: [['long', 4], ['bald', 3], ['tonsure', 2], ['wild', 2]],
    beard: [['long', 6], ['full', 3], ['none', 1]],
    head: [['hood', 4], ['none', 4], ['coif', 2]],
    garment: [['robe', 1]], hem: [[2, 1]],
    cloak: [['short', 3], ['none', 4]],
    held: [['staff', 7], ['cane', 3]],
    extras: [[['scarf', 2], [null, 5]], [['belt', 3], [null, 3]]],
  },
  commoner: {
    height: [15, 19], stoop: [0, 1], old: false,
    build: [['slight', 3], ['average', 5], ['stout', 3], ['broad', 2]],
    hair: [['short', 3], ['mop', 3], ['long', 2], ['braid', 2], ['bun', 2], ['wild', 1], ['crop', 2]],
    beard: [['none', 6], ['stubble', 2], ['moustache', 1], ['full', 1]],
    head: [['none', 5], ['cap', 3], ['brim', 2], ['hood', 1], ['coif', 2]],
    garment: [['tunic', 6], ['coat', 2], ['robe', 2]], hem: [[0, 3], [1, 4], [2, 2]],
    cloak: [['none', 6], ['short', 2]],
    held: [['none', 6], ['cane', 1], ['lantern', 1]],
    extras: [[['apron', 3], [null, 5]], [['belt', 3], [null, 3]], [['scarf', 2], [null, 5]]],
  },
};

function palette(d: Dice, role: FolkRole, livery: Livery, hairStyle: HairStyle, old: boolean): HumanPalette {
  const skin = d.pick(SKIN);
  const hair = old ? d.pick(HAIR_OLD) : d.chance(0.6) ? d.pick(HAIR_DARK) : d.pick(HAIR_LIGHT);
  const leather = d.pick(LEATHER);
  let cloth: number, accent: number, trim = d.chance(0.5) ? BRASS : SILVER;
  const court = role === 'noble' || role === 'herald' || role === 'captain';
  if (court) {
    trim = livery.trim;
    // The King is in the full colour, the Herald a shade lighter with the second colour in his bars, the Captain darker and plainer.
    const L = role === 'noble' ? 0.36 : role === 'herald' ? 0.42 : 0.3;
    const S = role === 'captain' ? livery.sat * 0.6 : livery.sat;
    cloth = hsl(livery.hue + d.range(-6, 6), S, L);
    accent = role === 'captain' ? hsl(livery.hue, S * 0.7, 0.2) : hsl(livery.second, 0.5, role === 'herald' ? 0.5 : 0.3);
  } else if (role === 'clerk') {
    cloth = hsl(d.pick([28, 35, 215, 240, 0]), d.range(0.12, 0.3), d.range(0.26, 0.36));
    accent = hsl(d.range(0, 360), 0.25, 0.4);
  } else if (role === 'elder') {
    cloth = hsl(d.pick([100, 130, 30, 200, 260]), d.range(0.15, 0.3), d.range(0.28, 0.38));
    accent = hsl(d.range(0, 360), 0.2, 0.34);
  } else {
    cloth = hsl(d.range(0, 360), d.range(0.28, 0.55), d.range(0.3, 0.46));
    accent = hsl(d.range(0, 360), d.range(0.3, 0.6), d.range(0.34, 0.5));
  }
  return { skin, hair: hairStyle === 'bald' ? skin : hair, cloth, accent, trim, leather };
}

export function rollHuman(d: Dice, role: FolkRole, livery: Livery): HumanLook {
  const s = SPECS[role];
  const hair = wp(d, s.hair);
  const extras: Extra[] = [];
  for (const t of s.extras) { const e = wp(d, t); if (e) extras.push(e); }
  const garment = wp(d, s.garment);
  return {
    seed: d.u32(),
    role,
    height: d.int(s.height[0], s.height[1]),
    build: wp(d, s.build),
    stoop: d.int(s.stoop[0], s.stoop[1]),
    hair,
    beard: wp(d, s.beard),
    head: wp(d, s.head),
    garment,
    hem: wp(d, s.hem),
    cloak: wp(d, s.cloak),
    held: wp(d, s.held),
    extras: extras.filter((e, i) => extras.indexOf(e) === i),
    eyes: d.int(0, 2) as 0 | 1 | 2,
    brow: d.chance(role === 'elder' || role === 'captain' ? 0.8 : 0.4),
    nose: clamp(d.int(0, 2) + (s.old ? 1 : 0), 0, 2) as 0 | 1 | 2,
    palette: palette(d, role, livery, hair, s.old),
  };
}
