// Biome definitions for the world behind and under the action (see docs/11-backgrounds.md).
// Render-only: nothing here may be read by the sim. (Which biome a level is comes from `biomeIndex` in roster.ts.)
import { biomeIndex } from './roster';

/** A look of the sky and light, reached at a point in the level; looks in between are blended. */
export interface Mood {
  /** Level progress (0..1) at which the look is fully in effect. */
  at: number;
  /** Sky gradient bands, top to horizon. */
  sky: readonly number[];
  /** Multiplies the background art (parallax layers, ground, clouds), 0xRRGGBB. */
  tint: number;
  /** Screen y of the sun's center; below the horizon (> ~110) it is set. */
  sunY: number;
  /** Screen y of the moon's center; below the horizon it is down. */
  moonY: number;
  /** Star brightness, 0..1. */
  stars: number;
  /** Northern lights, 0..1 (default none). */
  aurora?: number;
}

/** The pseudo-sprite that marks where the destination landmark sits among the parallax layers. */
export const DESTINATION_LAYER = '@destination';

/** The next biome, seen far off on the horizon and growing closer as the level goes on. */
export interface Destination {
  /** Key into `Sprites.landmarks`. */
  landmark: string;
  /** Screen x of its center (as a fraction of the view width) at the start and at the end of the level. */
  x0: number;
  x1: number;
  /** Pixels its base sits above the horizon at the start and at the end (high at first, so it clears the tree lines). */
  lift0: number;
  lift1: number;
  /** Glow behind it, 0xRRGGBB. */
  aura: number;
}

/** The kinds of weather a level can have; see `render/weather.ts`. */
export type WeatherKind = 'rain' | 'snow' | 'fog' | 'lightning' | 'sandstorm';

/**
 * One weather effect on a level. Several can run at once (a storm is rain plus lightning). Render-only: nothing here may
 * be read by the sim.
 */
export interface WeatherDef {
  kind: WeatherKind;
  /** The authored shape of the level, as strength (0..1) at points along its progress, blended linearly and held flat past the ends (default: full strength). Random surges and the clear ending are applied on top, see `weatherLevel`. */
  curve?: readonly (readonly [at: number, level: number])[];
  /** Skip the random surges and the clear start and end, holding the curve's strength (the `?weather=` dev preview). */
  steady?: boolean;
  /** How deep the random lulls go, 0 (steady) to 1 (it can clear entirely); default 0.85. */
  swing?: number;
  /** Sideways push on rain and snow, px per tick (right is positive; default none). A sandstorm blows right at this speed's sign and scale (default 1). */
  wind?: number;
}

/** Progress by which all weather has died away, so a level ends in clear air before the next biome (see `weatherLevel`). */
export const WEATHER_END = 0.92;
/** Weather eases in over this much progress at the start of a level. */
const WEATHER_FADE_IN = 0.05;
/** Random knots of the surge noise sit this far apart in progress. */
const SURGE_SPAN = 0.11;

function surgeHash(seed: number, salt: number, k: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35) ^ Math.imul(k + 1, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * The strength (0..1) of a weather effect at level `progress`. Three things multiply:
 *  - the authored `curve` (the shape of the level, e.g. a storm that builds; default flat at full strength);
 *  - random surges: smooth noise from the level `seed`, so the weather swells, eases and returns at points that differ
 *    every level but are the same on every client and replay. `swing` is how deep the lulls go (default 0.85: it can
 *    nearly clear), and each kind of weather gets its own rhythm;
 *  - the ends: it eases in over the first few percent and is gone by `WEATHER_END`.
 * `progress` runs over the whole biome (a route has several levels in each, see `weatherSpan`), so weather carries from one
 * level into the next and clears only at the end of the biome; `span` is how many levels that is, so the surges keep their
 * per-level rhythm.
 */
export function weatherLevel(w: WeatherDef, progress: number, seed = 0, span = 1): number {
  let base = 1;
  const c = w.curve;
  if (c && c.length > 0) {
    if (progress <= c[0][0]) base = c[0][1];
    else if (progress >= c[c.length - 1][0]) base = c[c.length - 1][1];
    else {
      for (let i = 1; i < c.length; i++) {
        if (progress <= c[i][0]) {
          const [a0, v0] = c[i - 1], [a1, v1] = c[i];
          base = a1 > a0 ? v0 + (v1 - v0) * ((progress - a0) / (a1 - a0)) : v1;
          break;
        }
      }
    }
  }
  if (w.steady) return base;
  const salt = WEATHER_KINDS.indexOf(w.kind);
  // knots jitter off the even grid so the rhythm is not regular
  const pos = (progress * span) / SURGE_SPAN, k = Math.floor(pos);
  const t = pos - k, e = t * t * (3 - 2 * t);
  const n = surgeHash(seed, salt, k) * (1 - e) + surgeHash(seed, salt, k + 1) * e;
  const swing = w.swing ?? 0.85;
  const surge = 1 - swing + swing * Math.min(1, n * 1.25); // the top quarter of the noise holds full strength
  const fadeIn = Math.min(1, Math.max(0, progress / WEATHER_FADE_IN));
  const fadeOut = Math.min(1, Math.max(0, (WEATHER_END - progress) / 0.1));
  return base * surge * fadeIn * fadeOut;
}

const WEATHER_KINDS: readonly WeatherKind[] = ['rain', 'snow', 'fog', 'lightning', 'sandstorm']; // append only: a kind's index seeds its surges

export interface ParallaxLayer {
  /** Key into `Sprites.layers`: the 256px strip this layer repeats. */
  sprite: string;
  /** Scroll factor: 0 is fixed to the screen, 1 moves with the field. */
  k: number;
  /** Pixels to push the strip below the horizon (default 0). */
  dy?: number;
  /** Flickering torches at the positions baked into this layer's strips: glow color, radius px, opacity. */
  lights?: { color: number; r: number; a: number };
  /** Lit windows at the window positions baked into the strips: window colors (picked per window), opacity, and the share (0..1) that are lit. */
  windows?: { colors: readonly number[]; a: number; lit: number };
}

/** A band of drifting ground fog: wisps that slide slowly along the floor, drawn over it and under the characters. */
export interface FogLayer {
  /** Scroll factor against the camera (1 = fixed to the ground). */
  k: number;
  /** World px drifted per tick. */
  drift: number;
  count: number;
  /** Screen y range the wisps sit in. */
  y0: number;
  y1: number;
  /** Peak opacity, 0..1. */
  alpha: number;
  color: number;
  /** Use the larger wisps (default: the small ones). */
  big?: boolean;
  /** Level progress by which this fog has burned off (it thins over the 0.25 before): morning mist. Default: never. */
  until?: number;
}

/** Specks carried on the wind (petals, embers, dust): drawn over everything, sparse, in the foreground. */
export interface AmbientDef {
  colors: readonly number[];
  count: number;
  /** Each speck picks its own heading; this is its speed in world px per tick (varying 0.5x to 1.3x between specks). */
  speed: number;
  /** A gentle prevailing wind added to every speck's own motion, px per tick (right, down). */
  bias: readonly [number, number];
  /** Side-to-side meander, px. */
  wobble: number;
  /** Opacity, 0..1. */
  alpha: number;
  /** Size in px (a speck tumbles between w x h and h x w). */
  w: number;
  h: number;
  /** Screen y range they float in. */
  y0: number;
  y1: number;
  /** Parallax range against the camera: nearer specks (higher) cross the screen faster. */
  k: readonly [number, number];
}

/** A band of drifting clouds. Clouds wrap every 768 px, so `count` sets the density. */
export interface CloudLayer {
  k: number;
  /** Pixels drifted per tick. */
  drift: number;
  count: number;
  y0: number;
  y1: number;
  /** Opacity, 0..1. */
  alpha: number;
  /** Extra tint on top of the time of day (default none), 0xRRGGBB: darker for storm clouds. */
  tint?: number;
}

export interface DecorKind {
  /** Key into `Sprites.decor`. */
  sprite: string;
  /** Relative weight. */
  w: number;
  /** May sit on the path (small stones yes, flowers no). */
  onPath?: boolean;
  /** Sways in the wind (the biome's `wind`), a pixel to either side. */
  sway?: boolean;
  /** A second frame, swapped with the first every few ticks (a flickering flame). */
  alt?: string;
  /** A soft glow around it (not dimmed by the time of day): color, radius in px, opacity. */
  glow?: { color: number; r: number; a: number };
}

/**
 * The floor surface. `tiles` repeats flat 16 px tiles (good for grass). `flagstones` is a paved floor: rows of irregular
 * slabs, staggered like brickwork. Everything keeps one constant size, because in this game characters do not shrink
 * with depth (as in Castle Crashers or Knights of the Round), so a floor that shrank toward the horizon would not match
 * them; the rows are simply squashed to suggest looking down at the floor from the side.
 */
export type FloorDef =
  | { kind: 'tiles'; set: string }
  | {
      kind: 'flagstones';
      /** Slab colors, picked per slab. */
      slabs: readonly number[];
      /** The gaps between slabs. */
      mortar: number;
      /** The lit top edge of each slab. */
      lit: number;
      /** Row height, px. */
      rowH: number;
      /** Shortest and longest slab, px. */
      slabW: readonly [number, number];
    };

/** The ground: a floor surface, an optional winding path, scattered patches, soft mottling, and small flat decals. */
export interface GroundDef {
  /** What the floor is made of. */
  floor: FloorDef;
  /** A worn road winding along the field, drawn as a continuous ribbon: mean half-width and colors (none: the floor itself is the way). */
  path?: { half: number; fill: number; edge: number; lip: number; speck: number; speck2: number; /** Wheel ruts along the road. */ ruts?: number; /** Grass colors fraying the road's edge. */ fringe?: readonly number[] };
  /** Patches (wildflowers, clover, blood, rubble, puddles...) scattered over a grid of `cell` px, one per cell with probability `chance`. */
  patches: { sprites: readonly string[]; cell: number; chance: number };
  /** Large stippled light and dark blotches over the floor; `alpha` is their opacity. */
  mottle: { light: number; dark: number; alpha: number };
  /** Decals: one candidate per `cellW` x `cellH` cell, kept with probability `density`. */
  decor: { cellW: number; cellH: number; density: number; table: readonly DecorKind[] };
}

export interface BiomeDef {
  name: string;
  /** Sorted by `at`; the first is used before it and the last after it. */
  timeline: readonly Mood[];
  /** Far to near. */
  layers: readonly ParallaxLayer[];
  clouds: readonly CloudLayer[];
  /** The moon's size as a multiple of its 20 px sprite (default 1). */
  moonScale?: number;
  /** Fog drifting along the ground (default none). */
  fog?: readonly FogLayer[];
  /** Specks on the wind (default none). */
  ambient?: AmbientDef;
  /** How far grass and decals sway in the wind, px (default none). */
  wind?: number;
  /** Rain, snow, fog and lightning over the level, each with its own strength along the way (default none). */
  weather?: readonly WeatherDef[];
  /** Where the party is headed; drawn at the `DESTINATION_LAYER` entry in `layers`. */
  destination?: Destination;
  /** Haze gathered at the horizon, in front of the far layers: its height in px and peak opacity (in the horizon sky's color). */
  haze: { height: number; alpha: number };
  ground: GroundDef;
  /** Hill crest: body and highlight colors. */
  crest: { fill: number; edge: number };
  /** Foreground ridge along the bottom: body, highlight, shade. */
  ridge: { fill: number; edge: number; shade: number };
}

const BASE_BIOMES: readonly BiomeDef[] = [
  {
    name: 'Meadow',
    timeline: [
      { at: 0, sky: [0x4a7fb5, 0x5a8fc2, 0x6c9fcc, 0x82b2d6, 0x9cc5df, 0xb4d6e8, 0xc9e3ee], tint: 0xffffff, sunY: 34, moonY: 170, stars: 0 },
      { at: 0.55, sky: [0x4a7fb5, 0x5a8fc2, 0x6c9fcc, 0x82b2d6, 0x9cc5df, 0xb4d6e8, 0xc9e3ee], tint: 0xffffff, sunY: 52, moonY: 170, stars: 0 },
      { at: 0.8, sky: [0x5a7fb0, 0x7a8fba, 0xa89cb0, 0xd8a890, 0xf0b878, 0xf8c880, 0xffd890], tint: 0xffe6c8, sunY: 96, moonY: 170, stars: 0 },
      { at: 1, sky: [0x1c2048, 0x2e2e5e, 0x54427a, 0x8a5282, 0xc06482, 0xe48a7a, 0xf4a870], tint: 0xb0a0c8, sunY: 135, moonY: 40, stars: 0.7 },
    ],
    layers: [
      { sprite: 'mountFar', k: 0.08 },
      { sprite: 'mountNear', k: 0.2 },
      { sprite: DESTINATION_LAYER, k: 0.03 },
      { sprite: 'hills', k: 0.38, dy: 1 },
      { sprite: 'treesFar', k: 0.5, dy: 1 },
      { sprite: 'trees', k: 0.66, dy: 2 },
    ],
    // a morning mist that burns off over the first half of the level
    fog: [
      { k: 0.5, drift: 0.04, count: 4, y0: 106, y1: 150, alpha: 0.25, color: 0xf4f8fa, until: 0.6, big: true },
      { k: 1, drift: 0.07, count: 5, y0: 130, y1: 300, alpha: 0.15, color: 0xeaf2f4, until: 0.5, big: true },
    ],
    // petals tumbling across the field, each on its own heading
    ambient: { colors: [0xf8c8d8, 0xf8f0e0, 0xf4e060, 0xffffff, 0xf0a8c0], count: 30, speed: 0.4, bias: [0.12, 0.02], wobble: 3, alpha: 0.95, w: 3, h: 2, y0: 120, y1: 330, k: [0.9, 1.6] },
    wind: 1,
    destination: { landmark: 'keep', x0: 0.84, x1: 0.7, lift0: 30, lift1: 12, aura: 0x9a3a7a },
    clouds: [
      { k: 0.04, drift: 0.015, count: 4, y0: 8, y1: 44, alpha: 0.7 },
      { k: 0.1, drift: 0.04, count: 3, y0: 26, y1: 66, alpha: 0.95 },
    ],
    haze: { height: 28, alpha: 0.45 },
    // showers across all three levels: a light drizzle from the first, settling in by the second, heaviest in the third (the curve spans the whole biome, see `weatherLevel`)
    weather: [{ kind: 'rain', curve: [[0, 0.5], [0.4, 0.8], [0.8, 1], [1, 0.8]], wind: 0.25 }],
    ground: {
      floor: { kind: 'tiles', set: 'grass' },
      path: { half: 14, fill: 0x8c6c44, edge: 0x6a4e30, lip: 0xa07f54, speck: 0x7a5c38, speck2: 0x9c7c52, ruts: 0x765836, fringe: [0x4b8039, 0x5fa04a, 0x3f7a33] },
      patches: { sprites: ['wildflowers', 'wildflowers2', 'clover'], cell: 190, chance: 0.5 },
      mottle: { light: 0x8cc860, dark: 0x1e4a24, alpha: 0.2 },
      decor: {
        cellW: 20, cellH: 14, density: 0.4,
        table: [
          { sprite: 'tuft0', w: 6, sway: true }, { sprite: 'tuft1', w: 6, sway: true }, { sprite: 'tuft2', w: 4, sway: true },
          { sprite: 'wheat', w: 3, sway: true }, { sprite: 'clover', w: 3 },
          { sprite: 'flowerW', w: 1, sway: true }, { sprite: 'flowerY', w: 2, sway: true }, { sprite: 'flowerP', w: 1, sway: true }, { sprite: 'flowerB', w: 1, sway: true },
          { sprite: 'daisies', w: 1.2, sway: true }, { sprite: 'twig', w: 1, onPath: true },
          { sprite: 'pebble', w: 2, onPath: true }, { sprite: 'rock', w: 1, onPath: true }, { sprite: 'mossrock', w: 0.6 },
          { sprite: 'mushroom', w: 0.5 }, { sprite: 'bush', w: 0.4 }, { sprite: 'stump', w: 0.25 },
        ],
      },
    },
    crest: { fill: 0x3f7a33, edge: 0x5fa04a },
    ridge: { fill: 0x2a5526, edge: 0x5a9a44, shade: 0x3d7a32 },
  },
  {
    name: 'Haunted Keep',
    // dusk violet -> deep night -> a sickly pre-dawn
    timeline: [
      { at: 0, sky: [0x1a1838, 0x2a2050, 0x40285e, 0x5a3066, 0x7a3a68, 0x984a64, 0xb05a5c], tint: 0xc0b0d4, sunY: 190, moonY: 62, stars: 0.35 },
      { at: 0.5, sky: [0x080a1c, 0x0e1230, 0x141a3e, 0x1c244e, 0x242e5a, 0x2c386a, 0x344276], tint: 0xaabae0, sunY: 190, moonY: 36, stars: 1 },
      { at: 1, sky: [0x10141e, 0x1a2230, 0x24343a, 0x30463e, 0x405a44, 0x587050, 0x748a5c], tint: 0xb4c8b8, sunY: 190, moonY: 46, stars: 0.25 },
    ],
    layers: [
      { sprite: 'spiresFar', k: 0.06 },
      { sprite: 'cragsNear', k: 0.18 },
      { sprite: 'ruins', k: 0.34, lights: { color: 0xff9640, r: 15, a: 0.2 }, windows: { colors: [0xffc860, 0xffc860, 0xffb040, 0x60e8d4], a: 0.95, lit: 0.7 } },
      { sprite: 'deadFar', k: 0.5, dy: 1 },
      { sprite: 'deadNear', k: 0.66, dy: 2 },
    ],
    moonScale: 2,
    clouds: [
      { k: 0.04, drift: 0.02, count: 4, y0: 6, y1: 40, alpha: 0.55, tint: 0x606880 },
      { k: 0.1, drift: 0.05, count: 3, y0: 24, y1: 62, alpha: 0.7, tint: 0x505870 },
    ],
    haze: { height: 36, alpha: 0.5 },
    // a storm that builds: rain thickens and the lightning starts as the night deepens
    weather: [
      { kind: 'rain', curve: [[0, 0], [0.25, 0.5], [0.6, 0.9], [1, 0.7]], wind: 0.5 },
      { kind: 'lightning', curve: [[0, 0], [0.3, 0.3], [0.65, 1], [1, 0.8]] },
    ],
    fog: [
      { k: 0.5, drift: 0.03, count: 6, y0: 112, y1: 158, alpha: 0.34, color: 0xb4b2dc },
      { k: 1, drift: 0.06, count: 8, y0: 150, y1: 320, alpha: 0.2, color: 0xa8a6d0 },
    ],
    ground: {
      floor: { kind: 'flagstones', slabs: [0x6a667e, 0x666278, 0x706c86], mortar: 0x44425a, lit: 0x86849e, rowH: 6, slabW: [14, 30] },
      patches: { sprites: ['blood0', 'blood1', 'rubble', 'moss', 'puddle1'], cell: 190, chance: 0.42 },
      mottle: { light: 0x8a88b8, dark: 0x0a0812, alpha: 0.16 },
      decor: {
        cellW: 22, cellH: 16, density: 0.44,
        table: [
          { sprite: 'bone0', w: 4 }, { sprite: 'bone1', w: 3 }, { sprite: 'skull', w: 1.5, onPath: true },
          { sprite: 'rubble0', w: 5, onPath: true }, { sprite: 'rubble1', w: 3, onPath: true },
          { sprite: 'weeds0', w: 4 }, { sprite: 'weeds1', w: 3 }, { sprite: 'moss0', w: 3 }, { sprite: 'crack0', w: 4, onPath: true },
          { sprite: 'candle0', w: 0.6, alt: 'candle1', glow: { color: 0xffb050, r: 14, a: 0.1 } },
          { sprite: 'glowcap', w: 1, glow: { color: 0x40e0c0, r: 12, a: 0.12 } },
          { sprite: 'brazier0', w: 0.35, alt: 'brazier1', glow: { color: 0xff9040, r: 30, a: 0.12 } },
        ],
      },
    },
    crest: { fill: 0x2c2a3c, edge: 0x4a4660 },
    ridge: { fill: 0x16141f, edge: 0x3a364a, shade: 0x24202e },
  },
];

/** The Frozen Pass: the high country, snow and ice, with the northern lights at the end of the day. */
export const FROZEN_PASS: BiomeDef = {
  name: 'Frozen Pass',
  // crisp morning -> bright midday -> a low rose-gold afternoon -> a deep blue night with the northern lights
  timeline: [
    { at: 0, sky: [0x7aa8d8, 0x8cb8e0, 0xa0c8e8, 0xb4d6ee, 0xc8e2f4, 0xdcecf8, 0xeef6fc], tint: 0xffffff, sunY: 70, moonY: 170, stars: 0 },
    { at: 0.5, sky: [0x5a98d8, 0x70aae0, 0x88bce8, 0xa0cef0, 0xb8dcf6, 0xd0eafa, 0xe6f4fe], tint: 0xffffff, sunY: 52, moonY: 170, stars: 0 },
    { at: 0.78, sky: [0x6a88c8, 0x8a98cc, 0xb0a4cc, 0xd8b0c0, 0xf0c0b0, 0xf8d0b0, 0xfce0c0], tint: 0xffe4e8, sunY: 100, moonY: 170, stars: 0 },
    { at: 1, sky: [0x0a1030, 0x101a44, 0x182858, 0x20386c, 0x2c4a80, 0x3a5c92, 0x4c70a4], tint: 0x90a8d8, sunY: 140, moonY: 40, stars: 1, aurora: 0.9 },
  ],
  layers: [
    { sprite: 'peaksFar', k: 0.06 },
    { sprite: 'peaksNear', k: 0.18 },
    { sprite: 'pinesFar', k: 0.42, dy: 1 },
    { sprite: 'pinesNear', k: 0.64, dy: 2 },
  ],
  clouds: [
    { k: 0.04, drift: 0.03, count: 5, y0: 8, y1: 46, alpha: 0.75 },
    { k: 0.1, drift: 0.06, count: 4, y0: 24, y1: 68, alpha: 0.9 },
  ],
  haze: { height: 34, alpha: 0.5 },
  // snowfall that thickens to a whiteout toward the end
  weather: [
    { kind: 'snow', curve: [[0, 0.3], [0.5, 1], [1, 0.8]], wind: -0.35 },
    { kind: 'fog', curve: [[0, 0], [0.6, 0], [0.85, 0.7], [1, 0.9]] },
  ],
  // spindrift lying low over the snow
  fog: [
    { k: 0.5, drift: 0.07, count: 4, y0: 108, y1: 150, alpha: 0.3, color: 0xffffff, big: true },
    { k: 1, drift: 0.12, count: 5, y0: 150, y1: 320, alpha: 0.16, color: 0xf2f8ff, big: true },
  ],
  // snow blowing across on a stiff wind from the right
  ambient: { colors: [0xffffff, 0xffffff, 0xb4c6e2, 0x9db2d4], count: 70, speed: 0.12, bias: [-0.32, 0.3], wobble: 2, alpha: 0.9, w: 2, h: 2, y0: 112, y1: 340, k: [0.8, 1.8] },
  wind: 1,
  ground: {
    floor: { kind: 'tiles', set: 'snow' },
    // a trail trodden into the snow: grey slush with dirt in it, not a river
    path: { half: 13, fill: 0xc9ccd6, edge: 0xa6abbb, lip: 0xe6e9f0, speck: 0xa89c98, speck2: 0xdadee8, ruts: 0xa8aebe, fringe: [0xffffff, 0xe8f0fa] },
    patches: { sprites: ['snowshadow', 'snowshadow2', 'snowshadow', 'ice0', 'ice1'], cell: 170, chance: 0.6 },
    mottle: { light: 0xffffff, dark: 0x7e96c0, alpha: 0.3 },
    decor: {
      cellW: 22, cellH: 15, density: 0.34,
      table: [
        { sprite: 'snowmound', w: 5 }, { sprite: 'iceshard0', w: 3 }, { sprite: 'iceshard1', w: 2 },
        { sprite: 'snowrock', w: 2, onPath: true }, { sprite: 'twigsS', w: 0.6, onPath: true },
        { sprite: 'sapling', w: 1.5 }, { sprite: 'tracks', w: 1.2, onPath: true }, { sprite: 'deadshrub', w: 0.8, sway: true },
      ],
    },
  },
  crest: { fill: 0xdce6f4, edge: 0xffffff },
  ridge: { fill: 0xb4c4dc, edge: 0xffffff, shade: 0xd0dcec },
};

/** The Sunken Marsh: a drowned bog under a heavy overcast, reed banks and stilt huts on the horizon, fireflies and mist. */
export const SUNKEN_MARSH: BiomeDef = {
  name: 'Sunken Marsh',
  // marsh: a grey-green murky dawn -> a heavy hazy day (low sun behind the overcast) -> a poisonous yellow-green dusk -> a dark bog night
  timeline: [
    { at: 0, sky: [0x4e5c52, 0x5c6c5e, 0x6c7c68, 0x7e8c72, 0x909c7a, 0xa0a882, 0xb0b48a], tint: 0xdce6d0, sunY: 112, moonY: 175, stars: 0 },
    { at: 0.38, sky: [0x66766a, 0x76867a, 0x86948a, 0x96a292, 0xa6b09c, 0xb4bca6, 0xc2c8b0], tint: 0xeef4e4, sunY: 80, moonY: 175, stars: 0 },
    { at: 0.7, sky: [0x2a3a2e, 0x3c4c2c, 0x546230, 0x6e7a30, 0x8a9234, 0xa8a83a, 0xc4b845], tint: 0xe6e8b0, sunY: 118, moonY: 175, stars: 0 },
    { at: 1, sky: [0x0a1214, 0x0e1a1c, 0x14262a, 0x1a3234, 0x223e3c, 0x2a4a44, 0x34584c], tint: 0xb4d0c8, sunY: 190, moonY: 42, stars: 0.75 },
  ],
  layers: [
    { sprite: 'mrShore', k: 0.06 },
    { sprite: 'mrReedFar', k: 0.2 },
    { sprite: 'mrStilts', k: 0.34, windows: { colors: [0xe8e070, 0xe8e070, 0xd8c860], a: 0.8, lit: 0.6 } },
    { sprite: 'mrCypFar', k: 0.5, dy: 1 },
    { sprite: 'mrCypNear', k: 0.66, dy: 2 },
  ],
  moonScale: 2.4,
  // low, heavy overcast: dense grey-green banks
  clouds: [
    { k: 0.04, drift: 0.02, count: 14, y0: 2, y1: 50, alpha: 0.95, tint: 0x8a9a88 },
    { k: 0.1, drift: 0.04, count: 12, y0: 16, y1: 74, alpha: 0.95, tint: 0x788a78 },
  ],
  haze: { height: 36, alpha: 0.55 },
  // steady drizzle and a fog that never quite lifts
  weather: [
    { kind: 'rain', curve: [[0, 0.25], [0.5, 0.5], [1, 0.35]], wind: 0.2 },
    { kind: 'fog', curve: [[0, 0.4], [1, 0.6]] },
  ],
  // heavy low bands of mist, hanging on the water all day
  fog: [
    { k: 0.5, drift: 0.03, count: 5, y0: 104, y1: 150, alpha: 0.32, color: 0xa4b498, big: true },
    { k: 1, drift: 0.05, count: 6, y0: 140, y1: 320, alpha: 0.17, color: 0x90a284, big: true },
  ],
  // fireflies, gnats and spores drifting over the water
  ambient: { colors: [0xe4ee6c, 0xc8e45c, 0xf2f4a0, 0xb4d468], count: 44, speed: 0.1, bias: [0.04, -0.01], wobble: 5, alpha: 0.85, w: 2, h: 2, y0: 118, y1: 335, k: [0.8, 1.6] },
  wind: 1,
  ground: {
    floor: { kind: 'tiles', set: 'marsh' },
    // a churned wet-mud track, with water gleaming in the ruts and reed fringing the edges
    path: { half: 14, fill: 0x544a31, edge: 0x2e2a1b, lip: 0x655a3c, speck: 0x433a26, speck2: 0x4c5e50, ruts: 0x372f1f, fringe: [0x3e5a28, 0x4e6a30, 0x32481f] },
    patches: { sprites: ['mrWater0', 'mrWater1', 'mrWater2', 'mrLily0', 'mrLily1', 'mrScum', 'mrScum2', 'mrMud', 'mrMud'], cell: 170, chance: 0.6 },
    mottle: { light: 0x6e7a46, dark: 0x1a2014, alpha: 0.14 },
    decor: {
      cellW: 20, cellH: 14, density: 0.36,
      table: [
        { sprite: 'mrGrass0', w: 6, sway: true }, { sprite: 'mrGrass1', w: 6, sway: true },
        { sprite: 'mrCattail0', w: 2.5, sway: true }, { sprite: 'mrCattail1', w: 2.5, sway: true },
        { sprite: 'mrReeds0', w: 2, sway: true }, { sprite: 'mrReeds1', w: 2, sway: true },
        { sprite: 'mrLily', w: 1.2 }, { sprite: 'mrLilies', w: 1 }, { sprite: 'mrMoss', w: 1.5, onPath: true },
        { sprite: 'mrLog', w: 0.7 }, { sprite: 'mrStump', w: 0.6 }, { sprite: 'mrFrog', w: 0.25 },
        { sprite: 'mrSkull', w: 0.5, onPath: true }, { sprite: 'mrRibs', w: 0.45 }, { sprite: 'mrBone', w: 0.8, onPath: true },
        { sprite: 'mrFlowerP', w: 0.8, sway: true }, { sprite: 'mrFlowerW', w: 0.8, sway: true },
        { sprite: 'mrShroom', w: 0.8 }, { sprite: 'mrGlow', w: 0.9, glow: { color: 0x90f060, r: 12, a: 0.12 } },
        { sprite: 'mrHelm', w: 0.2 },
      ],
    },
  },
  crest: { fill: 0x2a3622, edge: 0x44562e },
  ridge: { fill: 0x141c12, edge: 0x36462a, shade: 0x202c1a },
};

/** The Scorched Dunes: a bleached desert of dune ridges, red mesas, a ruined ziggurat and dead palms, under a white-hot sky. */
export const SCORCHED_DUNES: BiomeDef = {
  name: 'Scorched Dunes',
  // dunes: pale gold dawn -> blinding bleached noon -> blazing orange-crimson sunset -> a cold deep-blue night with huge stars and a big moon
  timeline: [
    { at: 0, sky: [0xdcb878, 0xe8c888, 0xf0d498, 0xf6dea8, 0xfae6b8, 0xfcecc8, 0xfff2d6], tint: 0xfff0d8, sunY: 84, moonY: 170, stars: 0 },
    { at: 0.45, sky: [0xdce6ea, 0xe6eeec, 0xeef2ec, 0xf4f4ea, 0xf8f6ec, 0xfcf8f0, 0xfffcf4], tint: 0xffffff, sunY: 34, moonY: 170, stars: 0 },
    { at: 0.78, sky: [0x4a2858, 0x862c52, 0xc4403c, 0xe8662c, 0xf88c30, 0xfcb048, 0xffd070], tint: 0xffc090, sunY: 100, moonY: 170, stars: 0 },
    { at: 1, sky: [0x03051a, 0x070b2a, 0x0d1538, 0x15214a, 0x1e3058, 0x2a4068, 0x3a5078], tint: 0x7c96dc, sunY: 140, moonY: 38, stars: 1 },
  ],
  layers: [
    { sprite: 'mesasFar', k: 0.05 },
    { sprite: 'dunesFar', k: 0.14, dy: 1 },
    { sprite: 'ruinsDune', k: 0.3 },
    { sprite: 'dunesNear', k: 0.46, dy: 1 },
    { sprite: 'palmsNear', k: 0.66, dy: 2 },
  ],
  // a few thin streaks of high cloud
  clouds: [
    { k: 0.04, drift: 0.05, count: 2, y0: 10, y1: 40, alpha: 0.35 },
  ],
  moonScale: 2.4,
  // heat shimmer at the horizon
  haze: { height: 44, alpha: 0.62 },
  // blowing sand that comes and goes in gusts
  weather: [{ kind: 'sandstorm', curve: [[0, 0.3], [0.5, 0.8], [1, 1]], wind: 1 }],
  // low bands of blown sand instead of mist
  fog: [
    { k: 0.5, drift: 0.28, count: 4, y0: 110, y1: 152, alpha: 0.26, color: 0xe8cf9c, big: true },
    { k: 1, drift: 0.45, count: 4, y0: 150, y1: 320, alpha: 0.09, color: 0xe2c68c, big: true },
  ],
  // sand streaks driven by a strong wind from the left
  ambient: { colors: [0xeed6a2, 0xd8bc84, 0xf4e4ba, 0xc8a870], count: 70, speed: 0.1, bias: [0.85, 0.06], wobble: 1, alpha: 0.7, w: 3, h: 1, y0: 112, y1: 340, k: [0.8, 1.8] },
  wind: 1,
  ground: {
    floor: { kind: 'tiles', set: 'sand' },
    patches: { sprites: ['sandripple', 'sandripple2', 'sandripple3', 'drypatch'], cell: 160, chance: 0.55 },
    mottle: { light: 0xf0dcaa, dark: 0xb89868, alpha: 0.2 },
    decor: {
      cellW: 22, cellH: 15, density: 0.3,
      table: [
        { sprite: 'sandpebble', w: 3, onPath: true }, { sprite: 'sandrock', w: 1.6, onPath: true }, { sprite: 'scrubTuft', w: 3, sway: true },
        { sprite: 'scrubDry', w: 2, sway: true }, { sprite: 'tumbleweed', w: 1, sway: true, onPath: true },
        { sprite: 'cactus', w: 1.1 }, { sprite: 'cactusBloom', w: 0.5 }, { sprite: 'cactusBarrel', w: 1 },
        { sprite: 'skullBleached', w: 0.6, onPath: true }, { sprite: 'ribcage', w: 0.5 }, { sprite: 'sherd', w: 1, onPath: true },
        { sprite: 'statuehead', w: 0.15 }, { sprite: 'flagstake', w: 0.3, sway: true }, { sprite: 'camelbones', w: 0.12 },
      ],
    },
  },
  crest: { fill: 0xd2ac74, edge: 0xe8cc98 },
  ridge: { fill: 0xb08a58, edge: 0xcfae7c, shade: 0x9a7648 },
};

/** Every biome's scenery, in the order of `ROSTERS` in roster.ts (the biome index picks both). */
export const BIOMES: readonly BiomeDef[] = [...BASE_BIOMES, FROZEN_PASS, SUNKEN_MARSH, SCORCHED_DUNES];

/** Alias kept for tests and previews: all of the scenery. */
export const ALL_SCENERY: readonly BiomeDef[] = BIOMES;

/**
 * The scenery for biome `index` (the sim's `state.biome`, an index into `BIOMES`). In dev builds `?scenery=frozen`
 * previews a biome's scenery by name without changing the enemies (`?biome=N` changes both).
 */
export function sceneryFor(index: number): BiomeDef {
  const want = typeof __DEV__ !== 'undefined' && __DEV__ ? (globalThis as { __scenery?: string }).__scenery : undefined;
  if (want) {
    const found = ALL_SCENERY.find((b) => b.name.toLowerCase().includes(want.toLowerCase()));
    if (found) return found;
  }
  return BIOMES[index];
}

/** The biome for a level seed (the same index the sim uses to pick the enemies; see `biomeIndex`). */
export function pickBiome(seed: number): BiomeDef {
  return sceneryFor(biomeIndex(seed));
}

/** Scratch result of `moodAt`, reused so the draw path allocates nothing. */
export interface BlendedMood {
  sky: number[];
  tint: number;
  sunY: number;
  moonY: number;
  stars: number;
  aurora: number;
}

export function makeBlendedMood(): BlendedMood {
  return { sky: [], tint: 0xffffff, sunY: 0, moonY: 0, stars: 0, aurora: 0 };
}

/** Blends two 0xRRGGBB colors. */
export function mix(a: number, b: number, t: number): number {
  const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
  return (r << 16) | (g << 8) | bl;
}

/** The sky and light at `progress` (0..1 through the level), written into `out`. */
export function moodAt(biome: BiomeDef, progress: number, out: BlendedMood): BlendedMood {
  const tl = biome.timeline;
  let i = 0;
  while (i < tl.length - 1 && progress >= tl[i + 1].at) i++;
  const a = tl[i], b = tl[Math.min(i + 1, tl.length - 1)];
  const t = b.at > a.at ? Math.min(1, Math.max(0, (progress - a.at) / (b.at - a.at))) : 0;
  out.sky.length = a.sky.length;
  for (let k = 0; k < a.sky.length; k++) out.sky[k] = mix(a.sky[k], b.sky[k], t);
  out.tint = mix(a.tint, b.tint, t);
  out.sunY = a.sunY + (b.sunY - a.sunY) * t;
  out.moonY = a.moonY + (b.moonY - a.moonY) * t;
  out.stars = a.stars + (b.stars - a.stars) * t;
  out.aurora = (a.aurora ?? 0) + ((b.aurora ?? 0) - (a.aurora ?? 0)) * t;
  return out;
}

/**
 * The weather for a level's biome. In dev builds `?weather=rain,lightning:0.5` replaces it (kinds from `rain`, `snow`, `fog`,
 * `lightning`, `sandstorm`, each with an optional strength after a colon; `?weather=none` clears it), to preview an effect anywhere.
 */
export function weatherFor(biome: BiomeDef): readonly WeatherDef[] {
  const want = typeof __DEV__ !== 'undefined' && __DEV__ ? (globalThis as { __weather?: string }).__weather : undefined;
  if (want === undefined) return biome.weather ?? NO_WEATHER;
  const out: WeatherDef[] = [];
  for (const part of want.split(',')) {
    const [name, lvl] = part.trim().split(':');
    const kind = WEATHER_KINDS.find((k) => k === name);
    if (kind) out.push({ kind, steady: true, curve: [[0, lvl === undefined ? 1 : Math.min(1, Math.max(0, Number(lvl) || 0))]], wind: kind === 'snow' ? -0.3 : kind === 'rain' ? 0.3 : kind === 'sandstorm' ? 1 : 0 });
  }
  return out;
}

const NO_WEATHER: readonly WeatherDef[] = [];
