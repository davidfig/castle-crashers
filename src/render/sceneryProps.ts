// The small pieces of ground scenery as makers: flat decals (tufts, flowers, bones, cacti...) from text bitmaps, and the patches laid over the
// floor (flowers, blood, puddles, ripples...). A biome's painter (sceneryArt.ts) calls the ones its ground names and recolours them for its tone.
// Moved here from the sprite atlas builder, which used to draw every biome's pieces once at startup.
import { makeBlob, makeIce, makePatch, makePuddle, makeMarshWater, makeSandRipples } from './bgArt';
import { bitmap } from './pix';
import { brightHue, flowerPalette, genCrystal, genFlower, genMushroom, genRock, genShrub, genTuft } from './propGen';
import type { Pix } from './pix';
import { hslToRgb } from '../data/scenery/tone';

const gp = { g: 0x3f7a33, G: 0x5fa04a, h: 0x2f6228 };
const mp = { s: 0x3e5a28, S: 0x587a34, b: 0x4a3020, B: 0x6a4a2c, d: 0x2c4420 }; // marsh:
const cp = { g: 0x4f7a3a, G: 0x6a9a4a, d: 0x365a2a, P: 0xe86aa0, Y: 0xf4d048 }; // dunes:

/** Decals by key (the keys the archetypes' decor tables name). `o` is the biome's seed offset: the hand-drawn ones ignore it, the generated ones (`g...`) draw from it. */
export const DECOR_MAKERS: Record<string, (o: number) => Pix> = {
    tuft0: () => bitmap(['.G..G.', '.GG.Gg', 'gGgGgg', 'ghgggh'], gp, 'tuft0'),
    tuft1: () => bitmap(['..G..', '.GgG.', 'GgGgG', 'hggGh'], gp, 'tuft1'),
    tuft2: () => bitmap(['G..G', 'GgGg', 'hggh'], gp, 'tuft2'),
    flowerW: () => bitmap(['.p.', 'pYp', '.s.', '.s.'], { ...gp, p: 0xf4f0e0, Y: 0xf0c040, s: 0x3f7a33 }, 'flowerW'),
    flowerY: () => bitmap(['.p.', 'pYp', '.s.', '.s.'], { ...gp, p: 0xf2d848, Y: 0xd88a20, s: 0x3f7a33 }, 'flowerY'),
    flowerP: () => bitmap(['.p.', 'pYp', '.s.', '.s.'], { ...gp, p: 0xe888b4, Y: 0xf8e060, s: 0x3f7a33 }, 'flowerP'),
    flowerB: () => bitmap(['.p.', 'pYp', '.s.', '.s.'], { ...gp, p: 0x84a4ec, Y: 0xf8f0c0, s: 0x3f7a33 }, 'flowerB'),
    pebble: () => bitmap(['.ss.', 'sSSs', '.dd.'], { s: 0x8a8a84, S: 0xaaaaa2, d: 0x6a6a66 }, 'pebble'),
    rock: () => bitmap(['..rrr..', '.rRRRr.', 'rRRrrrr', '.ddddd.'], { r: 0x7e7e78, R: 0xa0a09a, d: 0x5e5e5a }, 'rock'),
    mushroom: () => bitmap(['.rr.', 'rwrr', '.ss.', '.ss.'], { r: 0xc8453a, w: 0xf4ecd8, s: 0xe0d8c0 }, 'mushroom'),
    iceshard0: () => bitmap(['..c..', '.cCc.', 'cCcCc', 'dcccd'], { c: 0xa8d8f0, C: 0xe0f4ff, d: 0x78a8c8 }, 'iceshard0'),
    iceshard1: () => bitmap(['.c.', 'cCc', 'cCc', 'dcd'], { c: 0xa8d8f0, C: 0xe8f8ff, d: 0x78a8c8 }, 'iceshard1'),
    snowrock: () => bitmap(['.wwww.', 'wWWWWw', 'rrRRrr', '.dddd.'], { w: 0xe8f0fa, W: 0xffffff, r: 0x7a8498, R: 0x9aa4b8, d: 0x566078 }, 'snowrock'),
    snowmound: () => bitmap(['..www..', '.wWWWw.', 'wWwwWWw', '.sssss.'], { w: 0xf4f8ff, W: 0xffffff, s: 0xc8d6ea }, 'snowmound'),
    twigsS: () => bitmap(['b..b.', '.bbb.', 'b...b'], { b: 0x6e5e56 }, 'twigsS'),
    sapling: () => bitmap(['..W..', '.WgW.', 'WgggW', '.WgW.', 'WgggW', '..t..'], { W: 0xf4f8ff, g: 0x2c5a48, t: 0x4a3a30 }, 'sapling'),
    tracks: () => bitmap(['d..d..', '.d..d.'], { d: 0xb4c4dc }, 'tracks'),
    deadshrub: () => bitmap(['.b.b.', 'bbwbb', '.bbb.'], { b: 0x6e5e56, w: 0xe8f0fa }, 'deadshrub'),
    clover: () => bitmap(['.gg.gg.', 'gGGgGGg', '.gg.gg.', '...s...'], { g: 0x3f7a33, G: 0x6ab04e, s: 0x2f6228 }, 'clover'),
    wheat: () => bitmap(['.Y..Y.', '.yY.yY', '.y.Yy.', 'gyygyg', 'gggggg'], { y: 0xb8a040, Y: 0xe0d070, g: 0x3f7a33 }, 'wheat'),
    bush: () => bitmap(['..gGg..', '.gGGGg.', 'gGGgGGg', 'ggGggGg', '.hhhhh.'], { g: 0x3a7030, G: 0x58a048, h: 0x2a5222 }, 'bush'),
    daisies: () => bitmap(['.w..w.', 'wYw.wY', '.g..g.'], { w: 0xf8f4e4, Y: 0xf0c040, g: 0x3f7a33 }, 'daisies'),
    twig: () => bitmap(['b..bb', '.bbb.', 'bb...'], { b: 0x6a5236 }, 'twig'),
    stump: () => bitmap(['.bbbb.', 'bBBBBb', 'bBkkBb', '.bbbb.', '.d..d.'], { b: 0x5a4430, B: 0xa88a5a, k: 0x7a6240, d: 0x3e2e20 }, 'stump'),
    mossrock: () => bitmap(['..rrr..', '.rRRRr.', 'mrRRrrm', 'mmrrrmm'], { r: 0x7e7e78, R: 0xa0a09a, m: 0x4a7a3c }, 'mossrock'),
    // the Haunted Keep
    bone0: () => bitmap(['w.....w', 'wwwwwww', 'w.....w'], { w: 0xcfc8b4 }, 'bone0'),
    bone1: () => bitmap(['...ww', '..ww.', '.ww..', 'ww...'], { w: 0xc4bda8 }, 'bone1'),
    skull: () => bitmap(['.www.', 'wwwww', 'wkwkw', '.www.', '.w.w.'], { w: 0xd6cfba, k: 0x1a1620 }, 'skull'),
    rubble0: () => bitmap(['..rr.', '.rRRr', 'rrrrr'], { r: 0x5a566a, R: 0x7a768c }, 'rubble0'),
    rubble1: () => bitmap(['.rr..', 'rRRrr', 'drrrd'], { r: 0x4e4a5e, R: 0x6e6a82, d: 0x38354a }, 'rubble1'),
    weeds0: () => bitmap(['B..B.', '.bB.B', 'bbbbb'], { b: 0x6a5a3a, B: 0x8a7448 }, 'weeds0'),
    weeds1: () => bitmap(['..B', '.bB', 'bbb'], { b: 0x5e5034, B: 0x7e6a42 }, 'weeds1'),
    moss0: () => bitmap(['.mm.', 'mMmm', '.mm.'], { m: 0x34543a, M: 0x4a7a4c }, 'moss0'),
    crack0: () => bitmap(['k..k.....', '.kk.kk...', '...k..kk.'], { k: 0x1c1a26 }, 'crack0'),
    candle0: () => bitmap(['.f.', '.c.', '.c.', 'ccc'], { f: 0xffc040, c: 0xd8d0b8 }, 'candle0'),
    candle1: () => bitmap(['.F.', '.c.', '.c.', 'ccc'], { F: 0xff8a30, c: 0xd8d0b8 }, 'candle1'),
    glowcap: () => bitmap(['.gg.', 'gGGg', '.ss.', '.ss.'], { g: 0x30a090, G: 0x70f0d0, s: 0xb0c0b0 }, 'glowcap'),
    brazier0: () => bitmap(['..f..', '.fFf.', 'bbbbb', '.bbb.', '..b..', '.b.b.'], { f: 0xff8a30, F: 0xffd060, b: 0x3a363e }, 'brazier0'),
    brazier1: () => bitmap(['.f.f.', '.fFf.', 'bbbbb', '.bbb.', '..b..', '.b.b.'], { f: 0xff7020, F: 0xffc050, b: 0x3a363e }, 'brazier1'),
    // marsh: cattails, reeds, marsh grass, lilies, a sunk log, a mossy stump, a frog statue, bones, bog flowers, toadstools, a rusted helm
    mrCattail0: () => bitmap(['...b..', '...B..', '...b..', '...s..', 's..s.s', 's.ss.s', 'sSss.s', '.sssS.'], mp, 'mrCattail0'),
    mrCattail1: () => bitmap(['..b...', '..B..b', '..b..B', '..s..b', '.ss..s', 's.s.ss', 's.sS.s', '.ssss.'], mp, 'mrCattail1'),
    mrReeds0: () => bitmap(['.s...s.', '.s..s..', 's..Ss.s', 's.s.s.s', 'sSs.sSs', '.sssss.'], mp, 'mrReeds0'),
    mrReeds1: () => bitmap(['..s....', '.s.s.s.', '.s.s.s.', 's.sSs.s', 'sssSsss', '.ssssS.'], mp, 'mrReeds1'),
    mrGrass0: () => bitmap(['.S..S.', '.sS.sS', 'sSsSss', 'dsssds'], mp, 'mrGrass0'),
    mrGrass1: () => bitmap(['..S..', '.sSs.', 'sSsSs', 'dssds'], mp, 'mrGrass1'),
    mrLily: () => bitmap(['.gGgg.', 'gGGpGg', '.gggg.'], { ...mp, g: 0x3c5a24, G: 0x4e6c2c, p: 0xd0a4b4 }, 'mrLily'),
    mrLilies: () => bitmap(['.gGg.....', 'gGGGg.gg.', '.ggg.gGGg', '...gg.ggg', '..gGGg...'], { ...mp, g: 0x38541f, G: 0x4a6828 }, 'mrLilies'),
    mrLog: () => bitmap(['..mmmm..mm...', '.bBBBbbBBbm..', 'bBkBBbbBBkBb.', '.wwwwwwwwwwww'], { b: 0x4a3a28, B: 0x5e4a32, k: 0x3a2c1e, m: 0x44602c, w: 0x2f4338 }, 'mrLog'),
    mrStump: () => bitmap(['.mMm.m.', 'mbbbbbm', 'bBBkBBb', 'bBbbbBb', '.d.d.d.'], { b: 0x4c3c2a, B: 0x62503a, k: 0x3a2c1e, m: 0x44602c, M: 0x5a7a34, d: 0x2a2018 }, 'mrStump'),
    mrFrog: () => bitmap(['.k..k.', 'kgkkgk', 'gGGGGg', 'gGgGgg', 'ggmmgg', 'ddddd.'], { g: 0x5c6a58, G: 0x748270, k: 0x2a2e26, m: 0x44602c, d: 0x3a4236 }, 'mrFrog'),
    mrSkull: () => bitmap(['.www.', 'wwwww', 'wkwkw', '.www.', '.w.w.'], { w: 0xb8b296, k: 0x1a1a14 }, 'mrSkull'),
    mrRibs: () => bitmap(['..w.w.w..', '.wWwWwWw.', 'w.w.w.w.w', '....w....'], { w: 0xa8a28a, W: 0xc0baa0 }, 'mrRibs'),
    mrBone: () => bitmap(['w.....w', 'wwwwwww', 'w.....w'], { w: 0xaaa48c }, 'mrBone'),
    mrFlowerP: () => bitmap(['.p.', 'pPp', '.s.', '.s.', 'sSs'], { p: 0x8a60a0, P: 0xd8c0e0, s: 0x3e5a28, S: 0x587a34 }, 'mrFlowerP'),
    mrFlowerW: () => bitmap(['.w.', 'wYw', '.s.', 'sSs'], { w: 0xdad4be, Y: 0xd8b840, s: 0x3e5a28, S: 0x587a34 }, 'mrFlowerW'),
    mrShroom: () => bitmap(['.oo..oo', 'oOoo.oOo', '.ss..ss.', '.ss..s..'].map((r) => r.padEnd(8, '.')), { o: 0x9a5a30, O: 0xc8a070, s: 0xc8bea0 }, 'mrShroom'),
    mrGlow: () => bitmap(['.gg.', 'gGGg', '.ss.', '.ss.'], { g: 0x58a838, G: 0xb8f070, s: 0xa8b890 }, 'mrGlow'),
    mrHelm: () => bitmap(['.rRRr.', 'rRrrRr', 'rkkkkr', 'dr..rd'], { r: 0x7a4a30, R: 0x9a6a40, k: 0x1e1a16, d: 0x4a3020 }, 'mrHelm'),
    mrMoss: () => bitmap(['.mm.mm.', 'mMmmMmm', '.mmmm..'], { m: 0x3a5226, M: 0x4e6a30 }, 'mrMoss'),
      cactus: () => bitmap(['....Gg...', '.g..Gg.g.', 'gG..Gg.Gg', 'gG..GgGGg', 'gGg.GGGg.', '.gGGGGg..', '...GGg...', '...Ggg...', '...Ggd...', '..ddddd..'], cp, 'cactus'),
      cactusBloom: () => bitmap(['....PY...', '.P..Gg.P.', 'gG..Gg.Gg', 'gG..GgGGg', 'gGg.GGGg.', '.gGGGGg..', '...GGg...', '...Ggg...', '...Ggd...', '..ddddd..'], cp, 'cactusBloom'),
      cactusBarrel: () => bitmap(['..PP..', '.GgGg.', 'GgGgGg', 'GgGgGg', '.dddd.'], cp, 'cactusBarrel'),
      scrubDry: () => bitmap(['b..B..b', '.bB.Bb.', 'bbBbbBb', '.bbbbb.'], { b: 0x8a7440, B: 0xb09a58 }, 'scrubDry'),
      scrubTuft: () => bitmap(['y..y.y', '.yy.y.', 'yYyyYy', '.bbbb.'], { y: 0xb4a050, Y: 0xd0bc6c, b: 0x8a7440 }, 'scrubTuft'),
      tumbleweed: () => bitmap(['.t.tt.', 'tt.t.t', 't.tt.t', 'tt.tt.', '.t.t.t', '..tt..'], { t: 0x9c8048 }, 'tumbleweed'),
      skullBleached: () => bitmap(['.ooo.', 'owwwo', 'okwko', '.owo.', '.o.o.'], { w: 0xf0e6cc, o: 0x9c8a62, k: 0x4a3a2a }, 'skullBleached'),
      ribcage: () => bitmap(['.w.w.w.w..', 'oooooooooo', '.w.w.w.w..'], { w: 0xeadec0, o: 0x9c8a62 }, 'ribcage'),
      sherd: () => bitmap(['.rr.', 'rRrr', '.dr.'], { r: 0xb8602c, R: 0xd88040, d: 0x7a3a1c }, 'sherd'),
      sandrock: () => bitmap(['..rrr..', '.rRRRr.', 'rRRrrrr', '.ddddd.'], { r: 0xb8946a, R: 0xd0aa7c, d: 0x8a6a48 }, 'sandrock'),
      statuehead: () => bitmap(['..rrrrr..', '.rRRRRRr.', 'rRRRRRRRr', 'rRkRRRkRr', 'rRRRaRRRr', 'rRRkkkRRr', '.rrrrrrr.', 'ssssssssss'.slice(0, 9)], { r: 0xa8844c, R: 0xc8a266, k: 0x5a4228, a: 0x8a6a3a, s: 0xd8be88 }, 'statuehead'),
      flagstake: () => bitmap(['bRRR.', 'bRRrR', 'bRr..', 'b....', 'b....', 'b....', 'b....', 'b....'], { b: 0x6a4a2a, R: 0xb02830, r: 0x80181c }, 'flagstake'),
      camelbones: () => bitmap(['ww............', '.ww...........', '..w...........', '..wwwwwwwwww..', '....w.w.w.w.w.', '....w.w.w.w.w.', '....w.w...w.w.', '....w.w...w.w.'].map((r) => r.padEnd(14, '.').slice(0, 14)), { w: 0xe2d6b6 }, 'camelbones'),
      sandpebble: () => bitmap(['.ss.', 'sSdd'], { s: 0xb8946a, S: 0xd0aa7c, d: 0x8a6a48 }, 'sandpebble'),
};

/** `n` variants of a generated decal kind, as `${name}0`..`${name}${n - 1}`. */
function variants(name: string, n: number, make: (o: number, v: number) => Pix): Record<string, (o: number) => Pix> {
  const out: Record<string, (o: number) => Pix> = {};
  for (let v = 0; v < n; v++) out[`${name}${v}`] = (o) => make(o, v);
  return out;
}

const GRASS: [number, number, number] = [0x2f6228, 0x4b8039, 0x5fa04a];
const DRY: [number, number, number] = [0x7a6a34, 0xa89448, 0xd0bc6c];
const FROST: [number, number, number] = [0x6a7a98, 0xa8b8d0, 0xf0f6ff];
const BOG: [number, number, number] = [0x2c4420, 0x3e5a28, 0x587a34];
const GREY_ROCK: [number, number, number, number] = [0x5e5e5a, 0x7e7e78, 0xa0a09a, 0x4a7a3c];
const SAND_ROCK: [number, number, number, number] = [0x8a6a48, 0xb8946a, 0xd0aa7c, 0x7a8a4a];
const SNOW_ROCK: [number, number, number, number] = [0x566078, 0x7a8498, 0xe8f0fa, 0xdce8f4];
const GRAVE_ROCK: [number, number, number, number] = [0x38354a, 0x4e4a5e, 0x6e6a82, 0x34543a];
const BOG_ROCK: [number, number, number, number] = [0x2e3a2c, 0x46543e, 0x66765a, 0x4e6a30];

// generated decals: grass, flowers (a palette of colours per biome), rocks, shrubs, crystals and mushrooms, kinds for each archetype's ground
Object.assign(
  DECOR_MAKERS,
  variants('gTuftM', 3, (o, v) => genTuft(o, v, GRASS)),
  variants('gTuftD', 3, (o, v) => genTuft(o, v, DRY)),
  variants('gTuftF', 2, (o, v) => genTuft(o, v, FROST, 5)),
  variants('gTuftB', 3, (o, v) => genTuft(o, v, BOG, 8)),
  variants('gFlowerM', 6, (o, v) => { const pal = flowerPalette(o, 4)[v % 4]; return genFlower(o, v, [pal[0], pal[1], pal[2], 0x3f7a33]); }),
  variants('gFlowerB', 3, (o, v) => { const pal = flowerPalette(o + 5, 3)[v % 3]; return genFlower(o, v + 9, [pal[0], pal[1], pal[2], 0x3e5a28]); }),
  variants('gRockM', 3, (o, v) => genRock(o, v, GREY_ROCK, 0.4)),
  variants('gRockS', 3, (o, v) => genRock(o, v, SAND_ROCK, 0)),
  variants('gRockF', 3, (o, v) => genRock(o, v, SNOW_ROCK, 0)),
  variants('gRockK', 3, (o, v) => genRock(o, v, GRAVE_ROCK, 0.3)),
  variants('gRockB', 3, (o, v) => genRock(o, v, BOG_ROCK, 0.6)),
  variants('gShrubM', 2, (o, v) => genShrub(o, v, [0x2a5222, 0x3a7030, 0x58a048, hslToRgb(brightHue(o, 7), 0.7, 0.5)])),
  variants('gShrubD', 2, (o, v) => genShrub(o, v, [0x5a4a28, 0x8a7440, 0xb09a58, 0xc86a3a], 0.15)),
  variants('gCrystalF', 3, (o, v) => genCrystal(o, v, [0x78a8c8, 0xa8d8f0, 0xe8f8ff])),
  variants('gCrystalK', 3, (o, v) => genCrystal(o, v, [0x3a2a6a, 0x7a58c8, 0xc8b0ff])),
  variants('gMushM', 3, (o, v) => { const h = brightHue(o, 20 + v); return genMushroom(o, v, [hslToRgb(h, 0.65, 0.5), hslToRgb(h, 0.6, 0.36), 0xf4ecd8, 0xe0d8c0]); }),
  variants('gMushB', 3, (o, v) => genMushroom(o, v, [0x9a5a30, 0x6a3a20, 0xc8a070, 0xc8bea0])),
);

/** Patches by key; `o` shifts the shape's seed, so each run's patches are cut differently. */
export const PATCH_MAKERS: Record<string, (o: number) => Pix> = {
    wildflowers: (o) => makePatch(52, 20, 11 + o, [0x3f7a33, 0x4b8039, 0x497d37], [0xf8f0e0, 0xf4e060, 0xf0a8c0, 0x9cb4f0, 0xffffff], 0.17),
    wildflowers2: (o) => makePatch(70, 24, 12 + o, [0x3f7a33, 0x4b8039, 0x497d37], [0xf4e060, 0xf8f0e0, 0xe888b4], 0.14),
    clover: (o) => makePatch(40, 16, 13 + o, [0x3a7030, 0x2f6228, 0x3f7a33], [0x6ab04e, 0x80c860], 0.16),
    puddle1: (o) => makePuddle(26, 12, 6 + o),
    snowshadow: (o) => makePatch(60, 22, 21 + o, [0xc4d4ea, 0xccdaee], [0xb0c2de], 0.2),
    snowshadow2: (o) => makePatch(80, 26, 22 + o, [0xc4d4ea, 0xccdaee], [0xb0c2de, 0xffffff], 0.14),
    ice0: (o) => makeIce(44, 17, 23 + o),
    ice1: (o) => makeIce(30, 12, 24 + o),
    blood0: (o) => makeBlob(40, 16, 7 + o, 0x5a1c28, 0x4a1620, 0x3a1019),
    blood1: (o) => makeBlob(26, 11, 8 + o, 0x621f2c, 0x501822, 0x3e121c),
    rubble: (o) => makeBlob(34, 14, 9 + o, 0x4c485c, 0x5e5a72, 0x34314a),
    moss: (o) => makeBlob(38, 15, 10 + o, 0x2c4a30, 0x38603c, 0x233a28),
    // marsh: standing water, lily pools, algae scum and wet mud
    mrWater0: (o) => makeMarshWater(44, 16, 31 + o, false),
    mrWater1: (o) => makeMarshWater(30, 12, 32 + o, false),
    mrWater2: (o) => makeMarshWater(58, 20, 34 + o, false),
    mrLily0: (o) => makeMarshWater(40, 15, 33 + o, true),
    mrLily1: (o) => makeMarshWater(52, 18, 35 + o, true),
    mrScum: (o) => makePatch(56, 20, 36 + o, [0x44522a, 0x3e4c26, 0x4a5830], [0x5c6c34, 0x6c7a3c], 0.12),
    mrScum2: (o) => makePatch(40, 15, 37 + o, [0x44522a, 0x3e4c26], [0x5c6c34], 0.1),
    mrMud: (o) => makePatch(70, 24, 38 + o, [0x38382a, 0x3c3b2b, 0x353528], [0x44503a], 0.04),
    sandripple: (o) => makeSandRipples(64, 22, 31 + o, 0xc9ac76, 0xe8d09c),
    sandripple2: (o) => makeSandRipples(86, 26, 32 + o, 0xc9ac76, 0xe8d09c),
    sandripple3: (o) => makeSandRipples(48, 18, 33 + o, 0xc4a670, 0xe6cd98),
    drypatch: (o) => makePatch(50, 18, 34 + o, [0xd2b57c, 0xcdb078], [0xb4a050, 0x9c8648, 0xc8b268], 0.14),
};
