// A run's scenery: one generated biome per stage of the road (a stage is the few levels the enemies' biome lasts), and the road that
// turns each into the next. Every biome starts as one of the hand-made archetypes in `BIOMES` (biomes.ts), whose look is then varied
// from the run's seed: its colours move along the hue wheel (an autumn meadow, a violet snowfield), the objects on its ground are
// picked and weighted anew, and the painter (render/sceneryArt.ts) draws all its pictures from the same seed, so no two runs share a
// skyline. The biome stays the stage's archetype in kind, so the enemies, music and story of the stage still suit the place.
// Pure and seeded; render-only (the sim never sees any of it). See docs/17-generated-scenery.md.
import { createRng, rngFloat, rngInt, rngRange, type Rng } from '../../engine/rng';
import { BIOMES, DESTINATION_LAYER, type BiomeDef, type DecorKind, type FogLayer, type Look, type ParallaxLayer } from '../biomes';
import { planRoad, type Road } from './road';
import { planSky, type Sky } from './sky';
import { artFn, skyFn, type Tone } from './tone';

/** What the painter needs to draw a generated biome's pictures: which archetype's pieces, the seed of their shapes, and the colour shift. */
export interface Recipe {
  archetype: number;
  /** The biome's place in the world: its sprites are named `${slot}:${key}` in the atlas. */
  slot: number;
  seed: number;
  tone: Tone;
}

export interface GenBiome {
  def: BiomeDef;
  recipe: Recipe;
}

export interface World {
  seed: number;
  biomes: GenBiome[];
  road: Road;
  /** The weather along the road. */
  sky: Sky;
}

/** The atlas key of the sprite `key` of the biome in `slot`. */
export function slotKey(slot: number, key: string): string { return `${slot}:${key}`; }

/** How each archetype's colours may move: the hue of the colours that turn, and the turns it may take (ordinary ones, then the rarer bold ones). */
interface ToneRange { band: number; width: number; hue: [number, number]; bold?: [number, number][]; boldChance: number; names: readonly [low: string, mid: string, high: string]; }
// (index = archetype, in the order of `BIOMES`)
const TONES: readonly ToneRange[] = [
  { band: 0.3, width: 0.15, hue: [-0.05, 0.06], bold: [[-0.15, -0.09], [0.1, 0.15]], boldChance: 0.4, names: ['Autumn', '', 'Emerald'] },
  { band: 0.73, width: 0.16, hue: [-0.07, 0.08], bold: [[-0.3, -0.22], [0.18, 0.26]], boldChance: 0.3, names: ['Blighted', '', 'Ashen'] },
  { band: 0.6, width: 0.13, hue: [-0.04, 0.05], bold: [[-0.14, -0.09], [0.1, 0.16]], boldChance: 0.3, names: ['Glacial', '', 'Rimed'] },
  { band: 0.22, width: 0.17, hue: [-0.06, 0.06], bold: [[-0.14, -0.1], [0.12, 0.2]], boldChance: 0.35, names: ['Peat', '', 'Fungal'] },
  { band: 0.09, width: 0.11, hue: [-0.025, 0.035], bold: [[-0.07, -0.05], [0.12, 0.2]], boldChance: 0.3, names: ['Crimson', '', 'Jade'] },
];

/**
 * A strip of an archetype's horizon may be another that suits the place: a meadow can lie below snow peaks, a frozen pass can have bare
 * winter trees. `[replacement, chance]` by the template's strip name (the replacement is one of the painter's own strips).
 */
const LAYER_ALTS: Readonly<Record<string, readonly (readonly [string, number])[]>> = {
  mountFar: [['peaksFar', 0.22]],
  mountNear: [['peaksNear', 0.16]],
  hills: [['mountNear', 0.25]],
  pinesFar: [['deadFar', 0.3]],
  pinesNear: [['deadNear', 0.25]],
  mrCypFar: [['deadFar', 0.2]],
  mrCypNear: [['deadNear', 0.2]],
  palmsNear: [['deadNear', 0.2]],
  spiresFar: [['mountFar', 0.15]],
};

const BASE_NAMES = ['Meadow', 'Haunted Keep', 'Frozen Pass', 'Sunken Marsh', 'Scorched Dunes'];

function pick(rng: Rng, lo: number, hi: number): number { return rngRange(rng, lo, hi); }

/** A random tone for archetype `a`. */
export function rollTone(rng: Rng, a: number): Tone {
  const r = TONES[a % TONES.length];
  let hue = pick(rng, r.hue[0], r.hue[1]);
  if (r.bold && rngFloat(rng) < r.boldChance) { const [lo, hi] = r.bold[rngInt(rng, r.bold.length)]; hue = pick(rng, lo, hi); }
  return { band: r.band, width: r.width, hue, skyHue: pick(rng, -0.035, 0.035) + hue * 0.12, sat: pick(rng, 0.88, 1.18), light: pick(rng, 0.94, 1.08) };
}

/** The biome's name: its archetype's, with a word for how far its colours moved. */
export function biomeName(a: number, tone: Tone): string {
  const r = TONES[a % TONES.length];
  const base = BASE_NAMES[a % BASE_NAMES.length];
  const word = tone.hue < r.hue[0] - 0.015 ? r.names[0] : tone.hue > r.hue[1] + 0.015 ? r.names[2] : r.names[1];
  return word ? `${word} ${base}` : base;
}

/** Rolls the decor table anew: each kind is weighted up or down, and some of the rarer ones are left out (the most common few always stay). */
function varyDecor(rng: Rng, table: readonly DecorKind[], slot: number): DecorKind[] {
  const order = table.map((k, i) => i).sort((x, y) => table[y].w - table[x].w);
  const keep = new Set(order.slice(0, 4));
  const out: DecorKind[] = [];
  table.forEach((k, i) => {
    const w = k.w * rngRange(rng, 0.45, 1.8);
    if (!keep.has(i) && table.length > 8 && rngFloat(rng) < 0.18) return;
    out.push({ ...k, sprite: slotKey(slot, k.sprite), alt: k.alt === undefined ? undefined : slotKey(slot, k.alt), w });
  });
  return out;
}

/** The archetype `a`, varied from the recipe's seed and tone: its sprites renamed for the slot, its colours moved, its objects and weather rolled anew. */
export function varyBiome(a: number, slot: number, seed: number, tone: Tone): BiomeDef {
  const t = BIOMES[a % BIOMES.length];
  const rng = createRng(seed, 61 + slot);
  const art = artFn(tone), sky = skyFn(tone), light = skyFn(tone, true);
  const look = (l: Look): Look => ({ ...l, sky: l.sky.map(sky), tint: light(l.tint) });
  const used = new Set(t.layers.map((l) => l.sprite)); // two layers never share a strip
  const layers: ParallaxLayer[] = t.layers.map((l) => {
    if (l.sprite === DESTINATION_LAYER) return { ...l };
    let name = l.sprite;
    for (const [alt, chance] of LAYER_ALTS[l.sprite] ?? []) if (rngFloat(rng) < chance && !used.has(alt)) { name = alt; used.add(alt); }
    // a little drift in how fast each layer slides and how far it sits below the horizon, so no two skylines move alike
    return { ...l, sprite: slotKey(slot, name), k: l.k * rngRange(rng, 0.93, 1.07) };
  });
  const fog: FogLayer[] | undefined = t.fog?.map((f) => ({ ...f, color: sky(f.color), count: Math.max(1, Math.round(f.count * rngRange(rng, 0.6, 1.5))), alpha: f.alpha * rngRange(rng, 0.7, 1.3) }));
  const g = t.ground;
  const floor = g.floor.kind === 'tiles'
    ? { ...g.floor, set: slotKey(slot, g.floor.set) }
    : { ...g.floor, slabs: g.floor.slabs.map(art), mortar: art(g.floor.mortar), lit: art(g.floor.lit) };
  const def: BiomeDef = {
    ...t,
    name: biomeName(a, tone),
    palette: { dawn: look(t.palette.dawn), day: look(t.palette.day), dusk: look(t.palette.dusk), night: look(t.palette.night) },
    layers,
    clouds: t.clouds.map((c) => ({ ...c, count: Math.max(1, Math.round(c.count * rngRange(rng, 0.6, 1.5))), tint: c.tint === undefined ? undefined : light(c.tint) })),
    fog,
    ambient: t.ambient && { ...t.ambient, colors: t.ambient.colors.map(art), count: Math.max(4, Math.round(t.ambient.count * rngRange(rng, 0.6, 1.4))) },
    haze: { height: Math.round(t.haze.height * rngRange(rng, 0.8, 1.3)), alpha: Math.min(0.8, t.haze.alpha * rngRange(rng, 0.8, 1.2)) },
    destination: t.destination && { ...t.destination, aura: art(t.destination.aura) },
    ground: {
      floor,
      path: g.path && { ...g.path, fill: art(g.path.fill), edge: art(g.path.edge), lip: art(g.path.lip), speck: art(g.path.speck), speck2: art(g.path.speck2), ruts: g.path.ruts === undefined ? undefined : art(g.path.ruts), fringe: g.path.fringe?.map(art), half: g.path.half * rngRange(rng, 0.8, 1.15) },
      patches: { sprites: g.patches.sprites.map((s) => slotKey(slot, s)), cell: Math.round(g.patches.cell * rngRange(rng, 0.8, 1.3)), chance: Math.min(0.9, g.patches.chance * rngRange(rng, 0.7, 1.3)) },
      mottle: { ...g.mottle, light: art(g.mottle.light), dark: art(g.mottle.dark) },
      decor: { ...g.decor, density: Math.min(0.7, g.decor.density * rngRange(rng, 0.8, 1.3)), table: varyDecor(rng, g.decor.table, slot) },
    },
    crest: { fill: art(t.crest.fill), edge: art(t.crest.edge) },
    ridge: { fill: art(t.ridge.fill), edge: art(t.ridge.edge), shade: art(t.ridge.shade) },
  };
  return def;
}

/**
 * The world of a run: biome `k` is archetype `archetypes[k]`, varied from the run's seed, and the road turns each into the next.
 * `stageLen` is the road px one biome lasts.
 */
export function generateWorld(seed: number, archetypes: readonly number[], stageLen: number): World {
  const biomes = archetypes.map((a, slot): GenBiome => {
    const rng = createRng(seed, 70 + slot);
    const tone = rollTone(rng, a);
    const bseed = Math.floor(rngFloat(rng) * 0x7fffffff);
    return { def: varyBiome(a, slot, bseed, tone), recipe: { archetype: a, slot, seed: bseed, tone } };
  });
  return { seed, biomes, road: planRoad(seed, archetypes.length, stageLen), sky: planSky(seed, biomes.map((g) => g.def), stageLen) };
}
