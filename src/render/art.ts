// Procedural placeholder art: sprites are defined as tiny text bitmaps and packed into one atlas
// at startup. Swap for real PNG atlases (tools/pack-atlas) once there is art. The biome backgrounds' builders live in
// bgArt.ts, and the pixel helpers they share in pix.ts.
import type { Frame } from '../platform/gl/batcher';
import { buildHeroSets, type HeroSet } from './hero';
import { buildMobArt, type MobArt } from './mobArt';
import { makeCrag, makeFog, makeKeep, makeMottle, makeMoon, makeCloud, makeDither } from './bgArt';
import { bitmap, makeEllipse, type Pix } from './pix';
import { buildUiArt, type UiArt } from './uiArt';
import { buildNpcSets, type NpcName, type NpcSet } from './npcArt';

export const PLAYER_COLORS = [0xe0443a, 0x3a7be0, 0xe8c43a, 0xa04ae0];

const GLYPHS: Record<string, string> = {
  '0': '###' + '#.#' + '#.#' + '#.#' + '###',
  '1': '.#.' + '##.' + '.#.' + '.#.' + '###',
  '2': '###' + '..#' + '###' + '#..' + '###',
  '3': '###' + '..#' + '###' + '..#' + '###',
  '4': '#.#' + '#.#' + '###' + '..#' + '..#',
  '5': '###' + '#..' + '###' + '..#' + '###',
  '6': '###' + '#..' + '###' + '#.#' + '###',
  '7': '###' + '..#' + '.#.' + '.#.' + '.#.',
  '8': '###' + '#.#' + '###' + '#.#' + '###',
  '9': '###' + '#.#' + '###' + '..#' + '###',
  A: '.#.' + '#.#' + '###' + '#.#' + '#.#',
  B: '##.' + '#.#' + '##.' + '#.#' + '##.',
  C: '.##' + '#..' + '#..' + '#..' + '.##',
  D: '##.' + '#.#' + '#.#' + '#.#' + '##.',
  E: '###' + '#..' + '##.' + '#..' + '###',
  F: '###' + '#..' + '##.' + '#..' + '#..',
  G: '.##' + '#..' + '#.#' + '#.#' + '.##',
  H: '#.#' + '#.#' + '###' + '#.#' + '#.#',
  I: '###' + '.#.' + '.#.' + '.#.' + '###',
  J: '..#' + '..#' + '..#' + '#.#' + '.#.',
  K: '#.#' + '#.#' + '##.' + '#.#' + '#.#',
  L: '#..' + '#..' + '#..' + '#..' + '###',
  M: '#.#' + '###' + '###' + '#.#' + '#.#',
  N: '##.' + '#.#' + '#.#' + '#.#' + '#.#',
  O: '.#.' + '#.#' + '#.#' + '#.#' + '.#.',
  P: '##.' + '#.#' + '##.' + '#..' + '#..',
  Q: '.#.' + '#.#' + '#.#' + '##.' + '.##',
  R: '##.' + '#.#' + '##.' + '#.#' + '#.#',
  S: '.##' + '#..' + '.#.' + '..#' + '##.',
  T: '###' + '.#.' + '.#.' + '.#.' + '.#.',
  U: '#.#' + '#.#' + '#.#' + '#.#' + '###',
  V: '#.#' + '#.#' + '#.#' + '#.#' + '.#.',
  W: '#.#' + '#.#' + '###' + '###' + '#.#',
  X: '#.#' + '#.#' + '.#.' + '#.#' + '#.#',
  Y: '#.#' + '#.#' + '.#.' + '.#.' + '.#.',
  Z: '###' + '..#' + '.#.' + '#..' + '###',
  ':': '...' + '.#.' + '...' + '.#.' + '...',
  '.': '...' + '...' + '...' + '...' + '.#.',
  '-': '...' + '...' + '###' + '...' + '...',
  '/': '..#' + '..#' + '.#.' + '#..' + '#..',
  '!': '.#.' + '.#.' + '.#.' + '...' + '.#.',
  '+': '...' + '.#.' + '###' + '.#.' + '...',
  '%': '#.#' + '..#' + '.#.' + '#..' + '#.#',
  '?': '###' + '..#' + '.#.' + '...' + '.#.',
};


/** Atlas texture width. Wide enough for the player sheets to pack four or five across. */
const ATLAS_W = 2048;
/** Height of the strip reserved for the generated monsters of the current run (a cast is ~1-1.3M px; see monsterArt.test.ts). */
const MONSTER_BAND_H = 1024;
/** Height of the strip reserved for a run's generated scenery (five biomes' strips, tiles, decals and patches are ~1.4M px). */
export const SCENERY_BAND_H = 1024;

export interface Sprites {
  atlas: HTMLCanvasElement;
  px: Frame;
  /** Indexed by MobType: the walk cycle (4 frames); other poses live in mobArt. */
  mob: Frame[][];
  shadow: Frame[];
  /** Indexed by MobType: a fallen body of that enemy. */
  corpse: Frame[];
  /** Coins: [small, big] x [face-on, edge-on]. */
  coin: Frame[][];
  /** The red health potion mobs drop. */
  potion: Frame;
  /** The yellow stamina potion. */
  staminaPotion: Frame;
  /** A treasure chest: [shut, open]. */
  chest: Frame[];
  /** Shrines by ShrineKind (curse, charge, greed, mercy): a stone pillar with a glowing crystal. */
  shrine: Frame[];
  /** Player sprites from the art workbench: one set per class (CLASSES order), each with a sheet per player slot (see hero.ts). */
  heroes: HeroSet[];
  /** Enemy art in play: the hand-made sheets, or a run's generated monsters once `installMonsterArt` has drawn them (see monsterSprites.ts). */
  mobArt: MobArt;
  /** The hand-made enemy art, kept so the classic roster can be put back. */
  classicMobArt: MobArt;
  /** The strip of the atlas generated monsters are drawn into: a run's cast is repainted here, over the last run's. */
  monsterBand: { x: number; y: number; w: number; h: number };
  /** The strip of the atlas a run's generated scenery is drawn into (sceneryArt.ts). */
  sceneryBand: { x: number; y: number; w: number; h: number };
  /** Ground tile sets (16 px tiles, several variants each), by the key a biome's ground names. */
  groundSets: Record<string, Frame[]>;
  /** Parallax strips (256 wide) by the key a biome layer names, several variants each. Objects stay clear of the edges, so the renderer can chain any variants in any order. */
  layers: Record<string, Frame[]>;
  /** Torch positions and lit-window rectangles (those have a size), in px from a strip's top-left, for each variant of a layer that has them. */
  layerLights: Record<string, { x: number; y: number; w?: number; h?: number }[][]>;
  /** Wisps of ground fog (white, dithered; tint when drawn) and a two-frame torch flame. */
  fog: Frame[];
  /** Larger wisps for broad banks of mist. */
  fogLarge: Frame[];
  flame: Frame[];
  /** 256x2 masks for dithering sky bands: 25%, 50%, 75%. */
  dither: Frame[];
  /** A 32px white disc (sun, tinted when drawn) and a crescent moon. */
  disc: Frame;
  moon: Frame;
  clouds: Frame[];
  /** Distant landmarks by key, each in 8 sizes from far to near: stone, lit windows, a white silhouette for haze, and the rocky peak it stands on (with its own silhouette). */
  landmarks: Record<string, { body: Frame[]; glow: Frame[]; mask: Frame[]; crag: Frame[]; cragMask: Frame[] }>;
  /** Small flat ground decals (tufts, flowers, rocks), by the key a biome's decor table names. */
  decor: Record<string, Frame>;
  /** Flat patches on the ground (wildflowers, clover, blood, rubble, puddles...) and white stippled mottles to tint. */
  patch: Record<string, Frame>;
  glyph: Record<string, Frame>;
  /** The UI kit: story font, panel flourishes, cursor and icons (uiArt.ts). */
  ui: UiArt;
  /** Story figures from the art workbench: the Registrar and the peddler (npcArt.ts). */
  npcs: Record<NpcName, NpcSet>;
}

export function buildSprites(heroImages: HTMLImageElement[], mobImages: HTMLImageElement[], npcImages: HTMLImageElement[] = []): Sprites {
  const blank: Frame = { u0: 0, v0: 0, u1: 0, v1: 0, w: 0, h: 0 };
  const mk = (): Frame => ({ ...blank });
  const items: { w: number; h: number; rgba: Uint8ClampedArray; frame: Frame }[] = [];
  const add = (b: { w: number; h: number; rgba: Uint8ClampedArray }): Frame => {
    const frame = mk();
    items.push({ ...b, frame });
    return frame;
  };

  const px = add({ w: 1, h: 1, rgba: new Uint8ClampedArray([255, 255, 255, 255]) });

  const shadow = [add(makeEllipse(8, 3)), add(makeEllipse(12, 4)), add(makeEllipse(16, 5))];

  const cpal = { y: 0xc98a14, Y: 0xffd84a, W: 0xfff6b0 };
  const coin = [
    [add(bitmap(['.yy.', 'yYWy', 'yYYy', '.yy.'], cpal, 'coinS')), add(bitmap(['yY', 'yY', 'yY', 'yY'], cpal, 'coinSe'))],
    [add(bitmap(['.yyyy.', 'yYYYYy', 'yYWWYy', 'yYYYYy', 'yYYYYy', '.yyyy.'], cpal, 'coinB')), add(bitmap(['yY', 'yY', 'yY', 'yY', 'yY', 'yY'], cpal, 'coinBe'))],
  ];
  // a corked flask of red: dark glass rim, bright liquid, a glint
  const potion = add(bitmap(['..kk..', '..cc..', '.gwwg.', 'gRRRRg', 'gRWRRg', 'gRRRRg', '.gggg.'], { k: 0x6b4a2a, c: 0xc9a46a, g: 0x5a1020, w: 0xe8f0f0, R: 0xe02848, W: 0xffb0c0 }, 'potion'));
  const staminaPotion = add(bitmap(['..kk..', '..cc..', '.gwwg.', 'gYYYYg', 'gYWYYg', 'gYYYYg', '.gggg.'], { k: 0x6b4a2a, c: 0xc9a46a, g: 0x6a5410, w: 0xe8f0f0, Y: 0xf2c818, W: 0xfff4a0 }, 'staminaPotion'));

  const chp = { k: 0x2a1608, B: 0x9a5a22, b: 0x6e3c14, Y: 0xffd84a, W: 0xfff6b0 };
  const chest = [
    add(bitmap(['.kkkkkkkkkk.', 'kBBBBBBBBBBk', 'kBbBBBBBBbBk', 'kkkkkYYkkkkk', 'kBBBBYYBBBBk', 'kBbBBYkBBbBk', 'kBBBBBBBBBBk', 'kkkkkkkkkkkk'], chp, 'chestShut')),
    add(bitmap(['.kkkkkkkkkk.', 'kbbbbbbbbbbk', 'kbBBBBBBBBbk', '.kYYWYYWYYk.', 'kYYWYYYWYYYk', 'kBBBBBBBBBBk', 'kBbBBBBBBbBk', 'kkkkkkkkkkkk'], chp, 'chestOpen')),
  ];
  // crystal [dark, mid, light] per shrine kind: blood red, storm blue, gold, pale mercy white
  const crystals: [number, number, number][] = [[0x8a1a18, 0xe0442e, 0xffa090], [0x1a56c8, 0x4aa0ff, 0xb8e0ff], [0xb87a10, 0xffc02a, 0xfff0a0], [0x9aa0c8, 0xe8ecff, 0xffffff]];
  const shrine = crystals.map(([d, m, l], k) => add(bitmap(['....mm....', '...mLLm...', '..mLLWLm..', '...mLLm...', '....dd....', '..sSSSSs..', '..sSSSSt..', '...sSSt...', '...sSSt...', '...sSSt...', '..sSSSSt..', '.sSSSSSSt.', '.tttttttt.'], { d, m, L: l, W: 0xffffff, s: 0x8a8f9c, S: 0xb4b9c6, t: 0x4a4e5a }, `shrine${k}`)));

  // The ground, strips, decals and patches are a run's own generated scenery (sceneryArt.ts): `installSceneryArt` draws them into the
  // scenery band and fills these tables. Only the stippled mottles are fixed.
  const groundSets: Record<string, Frame[]> = {};
  const layerLights: Record<string, { x: number; y: number; w?: number; h?: number }[][]> = {};
  const layers: Record<string, Frame[]> = {};
  const decor: Record<string, Frame> = {};
  const patch: Record<string, Frame> = {
    mottle0: add(makeMottle(96, 40, 1)),
    mottle1: add(makeMottle(128, 54, 2)),
    mottle2: add(makeMottle(72, 32, 3)),
    mottle3: add(makeMottle(110, 46, 4)),
  };
  const widths = [20, 26, 33, 42, 53, 66, 80, 96];
  const keeps = widths.map(makeKeep);
  const crags = widths.map((w) => makeCrag(w, 72));
  const landmarks = {
    keep: {
      crag: crags.map((c) => add(c.body)),
      cragMask: crags.map((c) => add(c.mask)),
      body: keeps.map((k) => add(k.body)),
      glow: keeps.map((k) => add(k.glow)),
      mask: keeps.map((k) => add(k.mask)),
    },
  };
  const fog = [[192, 32, 1], [160, 26, 2], [224, 36, 3], [128, 22, 4]].map(([w, h, sd]) => add(makeFog(w, h, sd)));
  const fogLarge = [[352, 52, 5], [304, 44, 6], [400, 58, 7]].map(([w, h, sd]) => add(makeFog(w, h, sd)));
  const fp = { f: 0xff8a30, F: 0xffd868 };
  const flame = [add(bitmap(['.F.', 'fFf', 'fFf', '.f.'], fp, 'flame0')), add(bitmap(['.F.', '.Ff', 'fFf', '.f.'], fp, 'flame1'))];
  const dither = [1, 2, 3].map((l) => add(makeDither(l)));
  const discPix = makeEllipse(32, 32);
  for (let i = 0; i < discPix.rgba.length; i += 4) discPix.rgba.fill(255, i, i + 3); // white, so it can be tinted
  const disc = add(discPix);
  const moon = add(makeMoon(20));
  const clouds = [add(makeCloud(30, 11, 3)), add(makeCloud(44, 14, 4)), add(makeCloud(22, 9, 5))];

  const ui = buildUiArt(add);
  const glyph: Record<string, Frame> = {};
  for (const [ch, bits] of Object.entries(GLYPHS)) {
    const rgba = new Uint8ClampedArray(3 * 5 * 4);
    for (let i = 0; i < 15; i++) if (bits[i] === '#') rgba.set([255, 255, 255, 255], i * 4);
    glyph[ch] = add({ w: 3, h: 5, rgba });
  }

  // Shelf-pack the procedural sprites into a 512-wide strip with 1px padding (the atlas itself is ATLAS_W wide).
  const W = 512;
  const order = [...items].sort((a, b) => b.h - a.h);
  let x = 0, y = 0, rowH = 0;
  const placed: { it: (typeof items)[number]; x: number; y: number }[] = [];
  for (const it of order) {
    if (x + it.w + 1 > W) { x = 0; y += rowH + 1; rowH = 0; }
    placed.push({ it, x, y });
    x += it.w + 1;
    if (it.h > rowH) rowH = it.h;
  }
  // The atlas is wider than the procedural shelf: enemy sheets stack under the procedural sprites, and the player sheets
  // (5 classes x 4 colours) are shelf-packed, tallest first, into the free space beside the procedural strip and then below it.
  const stripH = y + rowH + 1;
  let usedH = stripH;
  // Enemy and story-figure sheets are shelf-packed, tallest first, across the full atlas width (stacked in one column they would
  // pass the 16384 px texture limit once there are dozens of enemies).
  const sheets = [...mobImages, ...npcImages];
  const sheetPlaces: { x: number; y: number }[] = new Array(sheets.length);
  {
    let sx = 0, sy = stripH, sh = 0;
    for (const i of sheets.map((_, k) => k).sort((a, b) => sheets[b].height - sheets[a].height)) {
      const im = sheets[i];
      if (sx + im.width + 1 > ATLAS_W) { sx = 0; sy += sh + 1; sh = 0; }
      sheetPlaces[i] = { x: sx, y: sy };
      sx += im.width + 1;
      sh = Math.max(sh, im.height);
    }
    usedH = sy + sh + 1;
  }
  const mobPlaces = sheetPlaces.slice(0, mobImages.length);
  const npcPlaces = sheetPlaces.slice(mobImages.length);
  const heroPlaces: { x: number; y: number }[] = new Array(heroImages.length);
  {
    // Region A: the free space right of the procedural strip. Region B: full width below the enemy sheets.
    const regions = [{ x0: W, y0: 0, w: ATLAS_W - W, h: stripH }, { x0: 0, y0: usedH, w: ATLAS_W, h: Infinity }];
    let ri = 0, cx = regions[0].x0, cy = regions[0].y0, rh = 0, bottom = usedH;
    const byHeight = heroImages.map((_, i) => i).sort((a, b) => heroImages[b].height - heroImages[a].height);
    for (const i of byHeight) {
      const im = heroImages[i];
      for (;;) {
        const R = regions[ri];
        if (cx + im.width + 1 > R.x0 + R.w) { cx = R.x0; cy += rh + 1; rh = 0; }
        if (cy + im.height + 1 > R.y0 + R.h && ri < regions.length - 1) { ri++; cx = regions[ri].x0; cy = regions[ri].y0; rh = 0; continue; }
        break;
      }
      heroPlaces[i] = { x: cx, y: cy };
      cx += im.width + 1;
      rh = Math.max(rh, im.height);
      bottom = Math.max(bottom, cy + im.height + 1);
    }
    usedH = bottom;
  }
  const monsterBand = { x: 0, y: usedH, w: ATLAS_W, h: MONSTER_BAND_H };
  usedH += MONSTER_BAND_H;
  const sceneryBand = { x: 0, y: usedH, w: ATLAS_W, h: SCENERY_BAND_H };
  usedH += SCENERY_BAND_H;
  let H = 1;
  while (H < usedH) H <<= 1;

  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  for (const p of placed) {
    ctx.putImageData(new ImageData(new Uint8ClampedArray(p.it.rgba), p.it.w, p.it.h), p.x, p.y);
    const f = p.it.frame;
    f.u0 = p.x / ATLAS_W; f.v0 = p.y / H; f.u1 = (p.x + p.it.w) / ATLAS_W; f.v1 = (p.y + p.it.h) / H;
    f.w = p.it.w; f.h = p.it.h;
  }

  heroImages.forEach((img, k) => ctx.drawImage(img, heroPlaces[k].x, heroPlaces[k].y));
  mobImages.forEach((img, k) => ctx.drawImage(img, mobPlaces[k].x, mobPlaces[k].y));
  npcImages.forEach((img, k) => ctx.drawImage(img, npcPlaces[k].x, npcPlaces[k].y));
  const heroes = buildHeroSets(heroPlaces, ATLAS_W, H);
  const mobArt = buildMobArt(mobPlaces, ATLAS_W, H);
  const npcs = buildNpcSets(npcPlaces, ATLAS_W, H);
  const mob = mobArt.walk;
  // Corpses (the boss's too) are the authored `dead` frame of each enemy sheet (the first walk frame laid on its side, built by tools/art.mjs).
  const corpse = mobArt.anims.map((a) => a.dead[0]);

  return { atlas: canvas, px, mob, shadow, corpse, coin, potion, staminaPotion, chest, shrine, heroes, mobArt, classicMobArt: mobArt, monsterBand, sceneryBand, groundSets, layers, layerLights, fog, fogLarge, flame, dither, disc, moon, clouds, landmarks, decor, patch, glyph, ui, npcs };
}
