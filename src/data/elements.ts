// The elements a skill can be made of. A skill is a *delivery* (a lobbed strike, a trap, a bolt, a nova...) times an *element* (what it is
// made of, which decides what it does to whoever it hits) times a handful of modifiers (count, pattern, pierce, residue...). The element table
// is the one place that says what fire, ice or lightning *is*: its colours, its name words, the look it gives a monster, and in
// `sim/elements.ts` what it does when it lands. Nothing here knows who casts the skill, so the same table will serve a hero's skill tree.
import type { Motif } from './monsterLook';

/** Element ids are small numbers: they ride in the sim's Uint8 `flags` of zones and projectiles (0..31). Append only. */
export const Element = { Physical: 0, Fire: 1, Ice: 2, Lightning: 3, Poison: 4, Shadow: 5, Holy: 6, Earth: 7, Wind: 8, Arcane: 9, Blood: 10 } as const;
export type ElementId = (typeof Element)[keyof typeof Element];
export const ELEMENT_COUNT = 11;

export interface ElementDef {
  id: ElementId;
  name: string;
  /** What a hit of it does (see `elementHit` in sim/elements.ts). */
  effect: string;
  /** Colours, 0xRRGGBB: the body of an effect, its bright edge, its dark underside, and the sparks thrown off. */
  core: number;
  glow: number;
  deep: number;
  spark: number;
  /** Base hue (degrees) for a monster made of it. */
  hue: number;
  /** The picture motif it paints on a monster (data/monsterLook.ts). */
  motif: Motif;
  /** Words for names: "cinder hound", "rime brute". */
  words: readonly string[];
}

export const ELEMENTS: readonly ElementDef[] = [
  { id: 0, name: 'physical', effect: 'a plain blow', core: 0xd8d0c0, glow: 0xffffff, deep: 0x6a6460, spark: 0xffffff, hue: 30, motif: 'fur', words: ['brute', 'feral', 'savage', 'rough'] },
  { id: 1, name: 'fire', effect: 'sets alight: burns until it burns out', core: 0xff7a20, glow: 0xffc040, deep: 0x8a2a10, spark: 0xfff0a0, hue: 18, motif: 'fire', words: ['cinder', 'ember', 'ash', 'blaze', 'scorch', 'pyre'] },
  { id: 2, name: 'ice', effect: 'chills (slows); a chilled hero hit again is frozen solid for a moment', core: 0x5ac8f4, glow: 0xc8f0ff, deep: 0x2a78c8, spark: 0xffffff, hue: 200, motif: 'frost', words: ['rime', 'frost', 'sleet', 'hoar', 'glacial', 'floe'] },
  { id: 3, name: 'lightning', effect: 'jumps to other heroes nearby, and shocks the hero\'s stamina', core: 0xf0e040, glow: 0xfffaa0, deep: 0x3a5ae0, spark: 0xffffff, hue: 55, motif: 'lightning', words: ['volt', 'spark', 'storm', 'arc', 'thunder', 'static'] },
  { id: 4, name: 'poison', effect: 'poisons: a long slow bleed of damage', core: 0x8cd03a, glow: 0xd8f890, deep: 0x3a5a14, spark: 0xe8ffb0, hue: 100, motif: 'poison', words: ['bile', 'venom', 'blight', 'toxic', 'rot', 'sting'] },
  { id: 5, name: 'shadow', effect: 'silences: no ability buttons for a while', core: 0x7a46b4, glow: 0xb890ff, deep: 0x1c1030, spark: 0xe0d0ff, hue: 270, motif: 'shadow', words: ['gloom', 'dusk', 'wraith', 'hollow', 'umbral', 'shade'] },
  { id: 6, name: 'holy', effect: 'blinds: stuns the hero for a moment', core: 0xffe890, glow: 0xffffff, deep: 0xc89a2a, spark: 0xffffff, hue: 48, motif: 'holy', words: ['sun', 'radiant', 'gilded', 'halo', 'dawn', 'bright'] },
  { id: 7, name: 'earth', effect: 'binds: roots the hero in place and shoves them', core: 0xa8884e, glow: 0xd8c090, deep: 0x4a3a20, spark: 0xe8d8a8, hue: 32, motif: 'stone', words: ['rock', 'slate', 'cairn', 'granite', 'flint', 'tremor'] },
  { id: 8, name: 'wind', effect: 'blows the hero away and scrambles their controls', core: 0xa8e8d8, glow: 0xe8fff8, deep: 0x4a9a8a, spark: 0xffffff, hue: 168, motif: 'wind', words: ['gale', 'gust', 'zephyr', 'squall', 'draft', 'cyclone'] },
  { id: 9, name: 'arcane', effect: 'hexes: the hero takes half again as much damage for a while', core: 0xd050e0, glow: 0xff90ff, deep: 0x601a78, spark: 0xffe0ff, hue: 300, motif: 'arcane', words: ['rune', 'sigil', 'astral', 'cryptic', 'eldritch', 'warp'] },
  { id: 10, name: 'blood', effect: 'makes the hero bleed, and heals the one who struck', core: 0xc01830, glow: 0xff6070, deep: 0x500814, spark: 0xffb0b8, hue: 350, motif: 'blood', words: ['crimson', 'gore', 'scarlet', 'leech', 'sanguine', 'rend'] },
];

export const elementOf = (id: number | undefined): ElementDef => ELEMENTS[id ?? 0] ?? ELEMENTS[0];
