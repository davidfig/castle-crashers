// Rolls a player character: first the *person* (face, hair, build, skin, which belong to a player slot and stay the same whatever class
// they pick), then the *kit* for a class on top of them (the class-defining headgear, weapon and gear, which are always there; only their
// shape and colour vary). Every table is plain data and the dice are the only source of choice.
import { CLASS_KITS, HERO_CLASS_NAMES, type HeroClass, type HeroGearPalette, type HeroLook, type SlotColor } from '../heroLook';
import type { HairStyle, HumanBuild, HumanLook } from '../humanLook';
import type { Dice } from '../bestiary/rand';
import { crownLivery, hsl, rollHuman } from '../humans/roll';

/** Variants per class: how many shapes each class-defining part has (the composer draws that many; see render/heroArt.ts). */
export const HERO_VARIANTS: Record<HeroClass, { hat: number; weapon: number; off: number; adorn: number }> = {
  warrior: { hat: 2, weapon: 3, off: 3, adorn: 3 },   // helm (closed / nasal), sword, shield (kite / round / heater), crest (fin / ridge / plume)
  mage: { hat: 3, weapon: 3, off: 1, adorn: 3 },       // hat (bent cone / tall cone / wide brim), staff head (orb / crystal / ring), hat badge (star / moon / none)
  cleric: { hat: 3, weapon: 3, off: 2, adorn: 3 },    // mitre (cross / sun / plain), crook (hook / ringed / flame), vestment (stole / tabard), pendant (sun / cross / none)
  rogue: { hat: 2, weapon: 3, off: 4, adorn: 3 },     // hood (point / tail), dagger (straight / curved / long), mask (half / bandana / full / none: face shown), scarf length
  archer: { hat: 3, weapon: 3, off: 3, adorn: 3 },    // cap (soft / brimmed / hooded), bow (short / long / recurve), quiver (tall / slung / hip), feathers (1 / 2 / 3)
  shaman: { hat: 3, weapon: 3, off: 2, adorn: 3 },    // headdress (fan / antlers / horned skull), totem (face / antler / bone), bag (hide / red), paint (stripes / dots / bar)
};

const METALS = [0x9aa4c4, 0x7d8594, 0xb08a58, 0xc9d2dc] as const;       // steel, iron, bronze, silver
const GOLDS = [0xe3b94a, 0xc89a46, 0xc9d2dc] as const;                   // gold, brass, silver
const WOODS = [0x7a4a28, 0x8a5a30, 0x5a3a22, 0xa07040, 0x4a3426] as const;
const ORBS = [0x7fb4ff, 0xff7a4a, 0xc86aff, 0x5fe0a0, 0xffd84a] as const;
const EYES = [0xefbd44, 0x5fe0a0, 0xff6a5a, 0x7fe8ff] as const;
const FEATHERS = [0xf4efe2, 0xc23458, 0xe0a030, 0x5fb88a, 0x3b6fd0] as const;
const BONES = [0xe6dcc8, 0xd8c8a8, 0xc9d2dc] as const;

const HUE_NAMES: readonly [number, string][] = [[15, 'red'], [40, 'orange'], [62, 'gold'], [90, 'lime'], [150, 'green'], [180, 'teal'], [200, 'cyan'], [235, 'blue'], [265, 'indigo'], [295, 'violet'], [330, 'magenta'], [346, 'rose'], [361, 'red']];
const hueName = (h: number): string => HUE_NAMES.find(([lim]) => h < lim)![1];

/**
 * The four players' colours for a run: hues spread round the wheel (at least ~50 degrees apart, from a random start) and dealt to the slots in a random
 * order, each with its own saturation and lightness, so a party never looks the same twice and four players never share a colour.
 */
export function rollSlotColors(d: Dice): SlotColor[] {
  const start = d.range(0, 360), gap = d.range(85, 95);
  const hues = d.shuffle([0, 1, 2, 3].map((k) => (start + k * gap + d.range(-10, 10) + 720) % 360));
  return hues.map((hue) => {
    const sat = d.range(0.46, 0.74), lum = d.range(0.42, 0.56);
    return { name: hueName(hue), hue, cloth: hsl(hue, sat, lum), deep: hsl(hue, Math.min(0.8, sat + 0.05), lum * 0.52), light: hsl(hue, Math.min(0.95, sat + 0.2), Math.min(0.82, lum + 0.24)) };
  });
}

/** A person from the run seed: any of the folk wardrobes' faces and hair, with the clothes stripped off. Class kits dress them. */
export function rollPerson(d: Dice, color: SlotColor): HumanLook {
  const base = rollHuman(d, 'commoner', crownLivery(d));
  const pal = base.palette;
  return {
    ...base, role: 'commoner', height: d.int(13, 15), stoop: 0, head: 'none', garment: 'tunic', hem: 0, cloak: 'none', held: 'none', extras: [],
    beard: d.chance(0.35) ? base.beard : 'none',
    palette: { ...pal, cloth: color.cloth, accent: color.deep, trim: pal.trim },
  };
}

const CLASS_BUILD: Record<HeroClass, (b: HumanBuild) => HumanBuild> = {
  warrior: (b) => (b === 'slight' ? 'average' : b),
  mage: (b) => (b === 'stout' || b === 'broad' ? 'average' : b),
  cleric: (b) => b,
  rogue: (b) => (b === 'stout' || b === 'broad' ? 'average' : b),
  archer: (b) => (b === 'stout' ? 'average' : b),
  shaman: (b) => b,
};

/** The classes whose hair would be hidden anyway keep their person's style; the rest need hair that sits under a hat. */
const HAT_SAFE: Partial<Record<HeroClass, readonly HairStyle[]>> = {
  warrior: ['crop', 'short'], rogue: ['crop', 'short', 'mop'], archer: ['short', 'mop', 'crop', 'bun', 'braid'],
};

/** One player's person dressed as a class: always the class's own headgear, weapon and gear; the dice only choose the variant and the colours. */
export function rollHero(person: HumanLook, cls: HeroClass, slot: number, sc: SlotColor, d: Dice): HeroLook {
  const v = HERO_VARIANTS[cls];
  const safe = HAT_SAFE[cls];
  const body: HumanLook = { ...person, build: CLASS_BUILD[cls](person.build), hair: safe && !safe.includes(person.hair) ? d.pick(safe) : person.hair };
  if (body.hair === 'bald') body.palette = { ...body.palette, hair: body.palette.skin };
  const pal: HeroGearPalette = {
    metal: cls === 'warrior' || cls === 'rogue' ? d.pick(METALS) : cls === 'shaman' ? d.pick(BONES) : d.pick(GOLDS),
    wood: d.pick(WOODS),
    glow: cls === 'rogue' ? d.pick(EYES) : d.pick(ORBS),
    feather: d.pick(FEATHERS),
    second: hsl(sc.hue + d.pick([-40, -25, 25, 40, 150, 180, 210]), d.range(0.3, 0.62), d.range(0.26, 0.42)),
    cloth: sc.cloth, deep: sc.deep, light: sc.light,
  };
  return {
    seed: d.u32(), cls, slot, body, pal,
    hat: d.int(0, v.hat - 1), weapon: d.int(0, v.weapon - 1), off: d.int(0, v.off - 1), adorn: d.int(0, v.adorn - 1),
  };
}

export { CLASS_KITS, HERO_CLASS_NAMES };
