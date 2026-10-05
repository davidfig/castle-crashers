// Procedural placeholder art: sprites are defined as tiny text bitmaps and packed into one atlas
// at startup. Swap for real PNG atlases (tools/pack-atlas) once there is art. The biome backgrounds' builders live in
// bgArt.ts, and the pixel helpers they share in pix.ts.
import type { Frame } from '../platform/gl/batcher';
import { buildHeroSets, type HeroSet } from './hero';
import { buildMobArt, type MobArt } from './mobArt';
import {
  makeBlob, makeCloud, makeCrag, makeDeadTrees, makeDither, makeFog, makeGround, makeJagged, makeKeep, makeMottle, makeMoon,
  makeIce, makeMountains, makePatch, makePuddle, makeRuins, makeSnow, makeSnowPeaks, makeSnowPines, makeTrees,
} from './bgArt';
import { makeEllipse, type Pix } from './pix';
import { buildUiArt, type UiArt } from './uiArt';
import { buildNpcSets, type NpcName, type NpcSet } from './npcArt';

export const PLAYER_COLORS = [0xe0443a, 0x3a7be0, 0xe8c43a, 0xa04ae0];

function bitmap(rows: string[], pal: Record<string, number>, name: string): { w: number; h: number; rgba: Uint8ClampedArray } {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  if (__DEV__) {
    for (const r of rows) if (r.length !== w) console.warn(`art: ${name} has ragged row "${r}" (${r.length} != ${w})`);
  }
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] ?? '.';
      const c = pal[ch];
      if (ch === '.' || c === undefined) continue;
      const o = (y * w + x) * 4;
      rgba[o] = (c >> 16) & 255;
      rgba[o + 1] = (c >> 8) & 255;
      rgba[o + 2] = c & 255;
      rgba[o + 3] = 255;
    }
  }
  return { w, h, rgba };
}

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
  /** Player sprites from the art workbench: one set per class (CLASSES order), each with a sheet per player slot (see hero.ts). */
  heroes: HeroSet[];
  /** Enemy art from the art workbench: walk cycles, the raised-bow archer, rotated weapons (see mobArt.ts). */
  mobArt: MobArt;
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

  const groundSets = {
    grass: [0, 1, 2, 3, 4, 5].map((v) => add(makeGround(v))),
    snow: [0, 1, 2, 3, 4, 5].map((v) => add(makeSnow(v))),
  };
  const layerLights: Record<string, { x: number; y: number; w?: number; h?: number }[][]> = {};
  const variants = (n: number, make: (v: number) => Pix, key?: string): Frame[] => Array.from({ length: n }, (_, v) => {
    const pix = make(v);
    if (key && pix.lights) (layerLights[key] ??= []).push(pix.lights);
    return add(pix);
  });
  const layers = {
    mountFar: variants(4, (v) => makeMountains(256, 64, 40, 20, 1.3 + v * 1.9, 0x8aa2c4, 0xaabfd9)),
    mountNear: variants(4, (v) => makeMountains(256, 44, 28, 14, 4.1 + v * 2.3, 0x6c8c84, 0x8aaba0)),
    hills: variants(4, (v) => makeMountains(256, 30, 16, 7, 7.7 + v * 1.7, 0x5c8a64, 0x7aa87c)),
    treesFar: variants(5, (v) => makeTrees(256, 26, 17, 11 + v * 7, [[0x4a7a68, 0x5c9078], [0x456f64, 0x58887a], [0x507c6a, 0x66947c]])),
    trees: variants(6, (v) => makeTrees(256, 36, 10, 3 + v * 5, [[0x2c5a3a, 0x3a7048], [0x35603a, 0x4a8048], [0x3a6a2a, 0x5a8a34], [0x24483a, 0x31604a]])),
    spiresFar: variants(4, (v) => makeJagged(256, 70, 50, 34, 2.1 + v * 1.7, 0x4a4872, 0x66628c)),
    cragsNear: variants(4, (v) => makeJagged(256, 50, 36, 24, 5.3 + v * 2.1, 0x3a385c, 0x524e78)),
    ruins: variants(6, (v) => makeRuins(256, 46, 4 + v * 5, 0x1e1c34, 0x3c3860), 'ruins'),
    deadFar: variants(5, (v) => makeDeadTrees(256, 30, 13, 12 + v * 7, [[0x2a2a40, 0x3a3a54], [0x26263a, 0x34344c]])),
    peaksFar: variants(4, (v) => makeSnowPeaks(256, 76, 52, 38, 1.9 + v * 1.7, { snowLit: 0xf4f8ff, snowShade: 0xc4d4ec, rockLit: 0x8aa0c0, rockShade: 0x5a6e92, edge: 0xffffff })),
    peaksNear: variants(4, (v) => makeSnowPeaks(256, 54, 38, 26, 5.1 + v * 2.3, { snowLit: 0xe4eefa, snowShade: 0xaec0de, rockLit: 0x6c84a8, rockShade: 0x46587c, edge: 0xf4f8ff })),
    pinesFar: variants(5, (v) => makeSnowPines(256, 28, 16, 9 + v * 7, { dark: 0x3c5c6c, light: 0x4c7080, snow: 0xe0ecf8, snowShade: 0xb8cce0 })),
    pinesNear: variants(6, (v) => makeSnowPines(256, 38, 10, 4 + v * 5, { dark: 0x1e4034, light: 0x2c5a48, snow: 0xf4f8ff, snowShade: 0xc0d2e6 })),
    deadNear: variants(5, (v) => makeDeadTrees(256, 40, 7, 7 + v * 5, [[0x14121e, 0x201c2e], [0x181624, 0x262236]])),
  };

  const gp = { g: 0x3f7a33, G: 0x5fa04a, h: 0x2f6228 };
  const decor: Record<string, Frame> = {
    tuft0: add(bitmap(['.G..G.', '.GG.Gg', 'gGgGgg', 'ghgggh'], gp, 'tuft0')),
    tuft1: add(bitmap(['..G..', '.GgG.', 'GgGgG', 'hggGh'], gp, 'tuft1')),
    tuft2: add(bitmap(['G..G', 'GgGg', 'hggh'], gp, 'tuft2')),
    flowerW: add(bitmap(['.p.', 'pYp', '.s.', '.s.'], { ...gp, p: 0xf4f0e0, Y: 0xf0c040, s: 0x3f7a33 }, 'flowerW')),
    flowerY: add(bitmap(['.p.', 'pYp', '.s.', '.s.'], { ...gp, p: 0xf2d848, Y: 0xd88a20, s: 0x3f7a33 }, 'flowerY')),
    flowerP: add(bitmap(['.p.', 'pYp', '.s.', '.s.'], { ...gp, p: 0xe888b4, Y: 0xf8e060, s: 0x3f7a33 }, 'flowerP')),
    flowerB: add(bitmap(['.p.', 'pYp', '.s.', '.s.'], { ...gp, p: 0x84a4ec, Y: 0xf8f0c0, s: 0x3f7a33 }, 'flowerB')),
    pebble: add(bitmap(['.ss.', 'sSSs', '.dd.'], { s: 0x8a8a84, S: 0xaaaaa2, d: 0x6a6a66 }, 'pebble')),
    rock: add(bitmap(['..rrr..', '.rRRRr.', 'rRRrrrr', '.ddddd.'], { r: 0x7e7e78, R: 0xa0a09a, d: 0x5e5e5a }, 'rock')),
    mushroom: add(bitmap(['.rr.', 'rwrr', '.ss.', '.ss.'], { r: 0xc8453a, w: 0xf4ecd8, s: 0xe0d8c0 }, 'mushroom')),
    iceshard0: add(bitmap(['..c..', '.cCc.', 'cCcCc', 'dcccd'], { c: 0xa8d8f0, C: 0xe0f4ff, d: 0x78a8c8 }, 'iceshard0')),
    iceshard1: add(bitmap(['.c.', 'cCc', 'cCc', 'dcd'], { c: 0xa8d8f0, C: 0xe8f8ff, d: 0x78a8c8 }, 'iceshard1')),
    snowrock: add(bitmap(['.wwww.', 'wWWWWw', 'rrRRrr', '.dddd.'], { w: 0xe8f0fa, W: 0xffffff, r: 0x7a8498, R: 0x9aa4b8, d: 0x566078 }, 'snowrock')),
    snowmound: add(bitmap(['..www..', '.wWWWw.', 'wWwwWWw', '.sssss.'], { w: 0xf4f8ff, W: 0xffffff, s: 0xc8d6ea }, 'snowmound')),
    twigsS: add(bitmap(['b..b.', '.bbb.', 'b...b'], { b: 0x6e5e56 }, 'twigsS')),
    sapling: add(bitmap(['..W..', '.WgW.', 'WgggW', '.WgW.', 'WgggW', '..t..'], { W: 0xf4f8ff, g: 0x2c5a48, t: 0x4a3a30 }, 'sapling')),
    tracks: add(bitmap(['d..d..', '.d..d.'], { d: 0xb4c4dc }, 'tracks')),
    deadshrub: add(bitmap(['.b.b.', 'bbwbb', '.bbb.'], { b: 0x6e5e56, w: 0xe8f0fa }, 'deadshrub')),
    clover: add(bitmap(['.gg.gg.', 'gGGgGGg', '.gg.gg.', '...s...'], { g: 0x3f7a33, G: 0x6ab04e, s: 0x2f6228 }, 'clover')),
    wheat: add(bitmap(['.Y..Y.', '.yY.yY', '.y.Yy.', 'gyygyg', 'gggggg'], { y: 0xb8a040, Y: 0xe0d070, g: 0x3f7a33 }, 'wheat')),
    bush: add(bitmap(['..gGg..', '.gGGGg.', 'gGGgGGg', 'ggGggGg', '.hhhhh.'], { g: 0x3a7030, G: 0x58a048, h: 0x2a5222 }, 'bush')),
    daisies: add(bitmap(['.w..w.', 'wYw.wY', '.g..g.'], { w: 0xf8f4e4, Y: 0xf0c040, g: 0x3f7a33 }, 'daisies')),
    twig: add(bitmap(['b..bb', '.bbb.', 'bb...'], { b: 0x6a5236 }, 'twig')),
    stump: add(bitmap(['.bbbb.', 'bBBBBb', 'bBkkBb', '.bbbb.', '.d..d.'], { b: 0x5a4430, B: 0xa88a5a, k: 0x7a6240, d: 0x3e2e20 }, 'stump')),
    mossrock: add(bitmap(['..rrr..', '.rRRRr.', 'mrRRrrm', 'mmrrrmm'], { r: 0x7e7e78, R: 0xa0a09a, m: 0x4a7a3c }, 'mossrock')),
    // the Haunted Keep
    bone0: add(bitmap(['w.....w', 'wwwwwww', 'w.....w'], { w: 0xcfc8b4 }, 'bone0')),
    bone1: add(bitmap(['...ww', '..ww.', '.ww..', 'ww...'], { w: 0xc4bda8 }, 'bone1')),
    skull: add(bitmap(['.www.', 'wwwww', 'wkwkw', '.www.', '.w.w.'], { w: 0xd6cfba, k: 0x1a1620 }, 'skull')),
    rubble0: add(bitmap(['..rr.', '.rRRr', 'rrrrr'], { r: 0x5a566a, R: 0x7a768c }, 'rubble0')),
    rubble1: add(bitmap(['.rr..', 'rRRrr', 'drrrd'], { r: 0x4e4a5e, R: 0x6e6a82, d: 0x38354a }, 'rubble1')),
    weeds0: add(bitmap(['B..B.', '.bB.B', 'bbbbb'], { b: 0x6a5a3a, B: 0x8a7448 }, 'weeds0')),
    weeds1: add(bitmap(['..B', '.bB', 'bbb'], { b: 0x5e5034, B: 0x7e6a42 }, 'weeds1')),
    moss0: add(bitmap(['.mm.', 'mMmm', '.mm.'], { m: 0x34543a, M: 0x4a7a4c }, 'moss0')),
    crack0: add(bitmap(['k..k.....', '.kk.kk...', '...k..kk.'], { k: 0x1c1a26 }, 'crack0')),
    candle0: add(bitmap(['.f.', '.c.', '.c.', 'ccc'], { f: 0xffc040, c: 0xd8d0b8 }, 'candle0')),
    candle1: add(bitmap(['.F.', '.c.', '.c.', 'ccc'], { F: 0xff8a30, c: 0xd8d0b8 }, 'candle1')),
    glowcap: add(bitmap(['.gg.', 'gGGg', '.ss.', '.ss.'], { g: 0x30a090, G: 0x70f0d0, s: 0xb0c0b0 }, 'glowcap')),
    brazier0: add(bitmap(['..f..', '.fFf.', 'bbbbb', '.bbb.', '..b..', '.b.b.'], { f: 0xff8a30, F: 0xffd060, b: 0x3a363e }, 'brazier0')),
    brazier1: add(bitmap(['.f.f.', '.fFf.', 'bbbbb', '.bbb.', '..b..', '.b.b.'], { f: 0xff7020, F: 0xffc050, b: 0x3a363e }, 'brazier1')),
  };
  const patch: Record<string, Frame> = {
    mottle0: add(makeMottle(96, 40, 1)),
    mottle1: add(makeMottle(128, 54, 2)),
    mottle2: add(makeMottle(72, 32, 3)),
    mottle3: add(makeMottle(110, 46, 4)),
    wildflowers: add(makePatch(52, 20, 11, [0x3f7a33, 0x4b8039, 0x497d37], [0xf8f0e0, 0xf4e060, 0xf0a8c0, 0x9cb4f0, 0xffffff], 0.17)),
    wildflowers2: add(makePatch(70, 24, 12, [0x3f7a33, 0x4b8039, 0x497d37], [0xf4e060, 0xf8f0e0, 0xe888b4], 0.14)),
    clover: add(makePatch(40, 16, 13, [0x3a7030, 0x2f6228, 0x3f7a33], [0x6ab04e, 0x80c860], 0.16)),
    puddle1: add(makePuddle(26, 12, 6)),
    snowshadow: add(makePatch(60, 22, 21, [0xc4d4ea, 0xccdaee], [0xb0c2de], 0.2)),
    snowshadow2: add(makePatch(80, 26, 22, [0xc4d4ea, 0xccdaee], [0xb0c2de, 0xffffff], 0.14)),
    ice0: add(makeIce(44, 17, 23)),
    ice1: add(makeIce(30, 12, 24)),
    blood0: add(makeBlob(40, 16, 7, 0x5a1c28, 0x4a1620, 0x3a1019)),
    blood1: add(makeBlob(26, 11, 8, 0x621f2c, 0x501822, 0x3e121c)),
    rubble: add(makeBlob(34, 14, 9, 0x4c485c, 0x5e5a72, 0x34314a)),
    moss: add(makeBlob(38, 15, 10, 0x2c4a30, 0x38603c, 0x233a28)),
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
  let usedH = y + rowH + 1;
  const mobPlaces = mobImages.map((img) => { const pl = { x: 0, y: usedH }; usedH += img.height + 1; return pl; });
  const npcPlaces = npcImages.map((img) => { const pl = { x: 0, y: usedH }; usedH += img.height + 1; return pl; });
  const heroPlaces: { x: number; y: number }[] = new Array(heroImages.length);
  {
    // Region A: the free space right of the procedural strip, as tall as everything stacked so far. Region B: full width below it.
    const regions = [{ x0: W, y0: 0, w: ATLAS_W - W, h: usedH }, { x0: 0, y0: usedH, w: ATLAS_W, h: Infinity }];
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

  return { atlas: canvas, px, mob, shadow, corpse, coin, potion, heroes, mobArt, groundSets, layers, layerLights, fog, fogLarge, flame, dither, disc, moon, clouds, landmarks, decor, patch, glyph, ui, npcs };
}
