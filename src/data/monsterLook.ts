// The recipe for a generated monster's picture. The bestiary generator (bestiary.ts) writes one per enemy slot from the enemy's
// stats and powers; the sprite composer (render/monsterArt.ts) turns it into a sheet. Pure data: no DOM, no randomness here.

/** The overall plan of the body. */
export type Build = 'blob' | 'tall' | 'squat' | 'wedge' | 'round' | 'serpent' | 'insect' | 'floater';
export type HeadKind = 'round' | 'skull' | 'beast' | 'horned' | 'cyclops' | 'maw' | 'hood' | 'helm'
  | 'long' // a long snout out front (crocodile, horse, hound)
  | 'toad' // wide and flat, eyes bulging on top
  | 'cone' // pointed skull
  | 'mask' // a carved mask over the face
  | 'none';
/** What it walks on. `none` is for floaters and serpents. */
export type LimbKind = 'biped' | 'quad' | 'many' | 'tentacles' | 'none';
export type BackKind = 'wings' | 'tail' | 'shell' | 'spikes' | 'cape' | 'tentacles' | 'fins' | 'flame'
  | 'quills' | 'mane' | 'pack' | 'crystals' | 'banner' | 'none';
export type CrownKind = 'horns' | 'antlers' | 'ears' | 'crest' | 'halo' | 'crown' | 'antenna'
  | 'mohawk' | 'hat' | 'sprout' | 'horn' /* one, unicorn-style */ | 'stalks' /* eyes on stalks */ | 'none';
/** What it carries; baked into every pose, and shown striking/aiming/casting in the matching poses. */
export type HeldKind = 'club' | 'sword' | 'axe' | 'spear' | 'bow' | 'staff' | 'shield' | 'bomb' | 'orb' | 'sling'
  | 'mace' | 'hammer' | 'dagger' | 'trident' | 'scythe' | 'torch' | 'pick' | 'none';
/** Held things swung in melee (the game draws a swing trail off them). */
export const MELEE_HELD: ReadonlySet<HeldKind> = new Set<HeldKind>(['club', 'sword', 'axe', 'spear', 'mace', 'hammer', 'dagger', 'trident', 'scythe', 'torch', 'pick']);
/** Markings on the body. */
export type PatternKind = 'none' | 'belly' | 'stripes' | 'spots' | 'patches' | 'scales' | 'chevron' | 'mottled';
/** What the mouth has besides lips. */
export type JawKind = 'plain' | 'fangs' | 'tusks' | 'beak' | 'mandibles' | 'whiskers' | 'beard';
/** Something worn on the body. */
export type WornKind = 'none' | 'belt' | 'pauldron' | 'necklace' | 'scarf' | 'sash' | 'collar' | 'bracers';
/** Tells of its powers painted onto the body (embers, frost, drips, bandages, plates...). A look may carry several. */
export type Motif = 'fire' | 'frost' | 'poison' | 'ghost' | 'armor' | 'bones' | 'fur' | 'slime' | 'glow' | 'stone' | 'bandage' | 'thorns'
  // element tells (data/elements.ts): each element paints its own
  | 'lightning' | 'holy' | 'wind' | 'arcane' | 'blood' | 'shadow';

export interface MonsterPalette {
  /** Main body colour (0xRRGGBB); the composer derives its shade and light. */
  base: number;
  /** Second colour for belly, ornaments, wings, cloth. */
  accent: number;
  /** Eye / glow colour. */
  eye: number;
  /** Colour of anything held or worn that is hard: blades, plates, bows, horns. */
  metal: number;
}

export interface MonsterLook {
  /** Seeds every small choice the composer makes (pose jitter, stamp variants), so one look is always the same picture. */
  seed: number;
  /** The fantasy creature it is (goblin, skeleton, wolf...; see data/bestiary/species.ts). Names and the roller read it; the composer does not. */
  kind?: string;
  /** Target standing height in px, body and head together, not counting what it holds or any wings/horns: ~7 (a mite) to ~26 (a brute); a boss is 44..64. */
  size: number;
  /** Width relative to height before the build's own proportions are applied (0.7 lean .. 1.4 stout). */
  stout: number;
  build: Build;
  head: HeadKind;
  limbs: LimbKind;
  /** Arms with hands (0, 1 or 2); a creature with none still may hold nothing. */
  arms: 0 | 1 | 2;
  back: BackKind;
  crown: CrownKind;
  held: HeldKind;
  /** Body markings, jaw and worn gear. Left out, the composer picks from the seed (patterns) or draws none. */
  pattern?: PatternKind;
  jaw?: JawKind;
  worn?: WornKind;
  /** 1..4. */
  eyes: number;
  /** Visible fangs/teeth. */
  teeth: boolean;
  motifs: readonly Motif[];
  palette: MonsterPalette;
  /** A boss: a bigger, more detailed figure that also gets the slam/roar/smash poses. */
  boss: boolean;
}

/** One sheet as the game's own sheet metadata (frames, anims). */
export interface MonsterSheetMeta {
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
  anims: Record<string, { frames: string[] }>;
}

/** A composed sheet: raw RGBA pixels (width x height) plus the metadata that names the frames inside it. */
export interface MonsterSheet {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  meta: MonsterSheetMeta;
}
