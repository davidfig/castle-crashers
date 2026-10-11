// A run's party (docs/20-generated-heroes.md). `generateParty(seed)` is a pure function of the run seed: each of the four player slots is one person
// (face, hair, build, skin) in the slot's colour, and the same person is drawn in every class they might pick, always wearing that class's own
// defining headgear, weapon and gear. It has its own random streams (never the sim's) and nothing in the sim reads it: heroes are pictures.
import { HERO_CLASS_NAMES, type HeroClass, type HeroLook, type SlotColor } from '../heroLook';
import type { HumanLook } from '../humanLook';
import { Dice } from '../bestiary/rand';
import { rollHero, rollPerson, rollSlotColors } from './roll';

export const PARTY_SLOTS = 4;
const PARTY_SALT = 0x6870;

export interface Party {
  seed: number;
  /** The four players' colours this run (the HUD uses them too, see installHeroArt). */
  colors: SlotColor[];
  /** The four people, one per player slot. */
  people: HumanLook[];
  /** looks[slot][class index in HERO_CLASS_NAMES order]. */
  looks: HeroLook[][];
}

export function generateParty(seed: number): Party {
  const colors = rollSlotColors(new Dice(seed, PARTY_SALT + 40));
  const people = colors.map((color, slot) => rollPerson(new Dice(seed, PARTY_SALT + slot), color));
  const looks = people.map((person, slot) => HERO_CLASS_NAMES.map((cls, c) => rollHero(person, cls, slot, colors[slot], new Dice(seed, PARTY_SALT + 16 + slot * 8 + c))));
  return { seed, colors, people, looks };
}

export function heroLook(party: Party, slot: number, cls: HeroClass): HeroLook {
  return party.looks[slot][HERO_CLASS_NAMES.indexOf(cls)];
}

export { HERO_CLASS_NAMES };
export type { HeroClass, HeroLook };
