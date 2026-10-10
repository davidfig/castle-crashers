// The recipe for a generated person's picture. The folk generator (data/humans) writes one per story figure from the run seed; the
// sprite composer (render/humanArt.ts) turns it into a sheet. Pure data: no DOM, no randomness here.

/** What a person does; sets the wardrobe they are drawn from. The story figures each fill one. */
export type FolkRole = 'noble' | 'herald' | 'captain' | 'clerk' | 'peddler' | 'elder' | 'commoner';
export type HumanBuild = 'slight' | 'average' | 'broad' | 'stout';
export type HairStyle = 'bald' | 'crop' | 'short' | 'mop' | 'long' | 'bun' | 'braid' | 'tonsure' | 'wild';
export type BeardKind = 'none' | 'stubble' | 'moustache' | 'goatee' | 'full' | 'long';
export type Headwear = 'none' | 'cap' | 'hood' | 'brim' | 'plume' | 'helm' | 'crown' | 'circlet' | 'coif';
export type Garment = 'tunic' | 'robe' | 'tabard' | 'coat' | 'plate';
export type CloakKind = 'none' | 'short' | 'long' | 'fur';
export type HeldKind = 'none' | 'staff' | 'trumpet' | 'scroll' | 'ledger' | 'sword' | 'sceptre' | 'cane' | 'lantern';
export type Extra = 'spectacles' | 'chain' | 'sash' | 'pauldrons' | 'scarf' | 'belt' | 'pack' | 'apron' | 'trimHem';

export interface HumanPalette {
  skin: number;
  hair: number;
  /** The garment. */
  cloth: number;
  /** Second garment colour: sleeves, tabard bars, cloak lining. */
  accent: number;
  /** Metal, gold and braid. */
  trim: number;
  /** Boots, belt, pack. */
  leather: number;
}

export interface HumanLook {
  /** Seeds every small choice the composer makes, so one look is always the same picture. */
  seed: number;
  role: FolkRole;
  /** Standing height in px, head to sole, not counting hats, plumes or what they hold: 16 (a child-sized clerk) .. 21 (a tall captain). */
  height: number;
  build: HumanBuild;
  /** Forward stoop in px (0 upright .. 2 bent over a staff). */
  stoop: number;
  hair: HairStyle;
  beard: BeardKind;
  head: Headwear;
  garment: Garment;
  /** Hem: 0 to the hip, 1 to the knee, 2 to the ankle. */
  hem: 0 | 1 | 2;
  cloak: CloakKind;
  held: HeldKind;
  extras: readonly Extra[];
  /** Face: eye spacing 0 close .. 2 wide, a brow line, and a nose size 0..2. */
  eyes: 0 | 1 | 2;
  brow: boolean;
  nose: 0 | 1 | 2;
  palette: HumanPalette;
}

/** One sheet as the game's own NPC sheet data (the shape tools/art.mjs writes to art/out/<name>.json), plus its pixels. */
export interface HumanSheet {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  /** The feet-centre pixel inside a frame. */
  pivot: [number, number];
  cell: [number, number];
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
  anims: Record<string, { frames: string[]; ms: number[] }>;
}
