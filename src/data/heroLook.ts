// The recipe for a generated player character's picture. The party generator (data/heroes) writes one per (player slot, class) from the run seed;
// the sprite composer (render/heroArt.ts) turns it into a sheet. Pure data: no DOM, no randomness here.
import type { HumanLook } from './humanLook';

/** The six classes, in the order of CLASSES (data/classes.ts). */
export const HERO_CLASS_NAMES = ['warrior', 'mage', 'cleric', 'rogue', 'archer', 'shaman'] as const;
export type HeroClass = (typeof HERO_CLASS_NAMES)[number];

/**
 * What a class always wears and carries. These are the class-defining parts: they are never rolled away, only varied in shape and colour, so a
 * glance tells the class whoever the person under them is.
 */
export interface ClassKit {
  /** Headgear that says the class. */
  head: string;
  /** What the hero fights with. */
  weapon: string;
  /** The rest of the identifying gear (a shield, a quiver, a scarf, a totem bag). */
  gear: string[];
}

export const CLASS_KITS: Record<HeroClass, ClassKit> = {
  warrior: { head: 'crested great helm', weapon: 'short sword', gear: ['shield', 'steel pauldrons'] },
  mage: { head: 'pointed hat', weapon: 'staff with an orb', gear: ['long robe'] },
  cleric: { head: 'mitre', weapon: "shepherd's crook", gear: ['stole', 'sun pendant'] },
  rogue: { head: 'hood and mask', weapon: 'twin daggers', gear: ['long scarf', 'crouch'] },
  archer: { head: 'feathered cap', weapon: 'bow', gear: ['quiver'] },
  shaman: { head: 'feather headdress', weapon: 'totem staff', gear: ['totem bag', 'pelt mantle', 'face paint'] },
};

/** One player slot's colour this run: the dominant garment colour (`cloth`), its shade and its light, and the hue's name. Rolled per run (data/heroes/roll.ts). */
export interface SlotColor { name: string; hue: number; cloth: number; deep: number; light: number }

/** Colours of the gear, rolled per hero (the person's own palette is `body.palette`). */
export interface HeroGearPalette {
  /** Steel, or whatever the metal is: iron, bronze, silver. */
  metal: number;
  /** Shafts and bows. */
  wood: number;
  /** The glow of an orb, an eye, a gem. */
  glow: number;
  /** Feathers, fur, the odd bright accent. */
  feather: number;
  /** A second cloth colour for the headgear and trim of the class kit (a hat, a cap, a headband): the slot hue's neighbour or opposite, rolled. */
  second: number;
  /** The slot colour ramp: base, deep (shade) and light. */
  cloth: number;
  deep: number;
  light: number;
}

export interface HeroLook {
  /** Seeds every small choice the composer makes, so one look is always the same picture. */
  seed: number;
  cls: HeroClass;
  slot: number;
  /** The person: height, build, hair, beard, face and skin. Their clothes and headgear are the class kit's, not the body's. */
  body: HumanLook;
  pal: HeroGearPalette;
  /** Which variant of each class-defining part this hero has (every class table says what its numbers mean). */
  hat: number;
  weapon: number;
  off: number;
  /** A flourish: pendant, hem trim, feather count, paint. */
  adorn: number;
}

/** One composed sheet: the shape the game's hero sets read (see render/hero.ts), plus its pixels. */
export interface HeroSheet {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  /** The feet-centre pixel inside a frame. */
  pivot: [number, number];
  /** Pixels of art above the ground line, for overhead bars. */
  top: number;
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
  anims: Record<string, { frames: string[]; ms: number[] }>;
}
