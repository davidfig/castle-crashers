// Sprite composer for generated people: turns a HumanLook (src/data/humanLook.ts) into the sheet a story figure needs (an idle and a talk
// loop, like the hand-made NPCs in art/chars). Pure code, deterministic: one look is always the same bytes. It shares its shapes, shading
// and house post pass (rim light, ink outline) with the monster composer through pixelKit.ts. People are small (16-21 px), so a face is
// a few pixels; the silhouette (hat, hem, cloak, what they hold) does most of the telling.
import type { HumanLook, HumanSheet } from '../data/humanLook';
import { buildSheet, Cv, CX, GY, ell, line, matOf, mixc, poly, post, rect, crop, ri, mulberry, type Mat } from './pixelKit';

const T_CLOAK = 1, T_BODY = 2, T_LIMB = 3, T_HEAD = 4, T_HAIR = 5, T_HELD = 6, T_FACE = 7;
const INK = 0x1a1420, STEEL = 0x9aa4b0, PAPER = 0xe8e0c8, WOOD = 0x7a4a28, MOUTH = 0x6a2a2a;

interface Pose {
  /** Upper body sinks this many px (breathing). */
  bob: number;
  /** 0 closed, 1 small, 2 open. */
  mouth: 0 | 1 | 2;
  blink: boolean;
  /** The free hand: 0 at the side, 1 raised a little, 2 raised to gesture. */
  gesture: 0 | 1 | 2;
  /** Head nods this many px sideways. */
  nod: number;
}

interface Dim { sw: number; ww: number; flare: number; hw: number; hh: number; ll: number; th: number; arm: number; lw: number }

function dims(l: HumanLook): Dim {
  const H = l.height;
  const sw = { slight: 5, average: 6, broad: 8, stout: 8 }[l.build];
  const ww = l.build === 'stout' ? sw + 1 : l.build === 'slight' ? sw - 1 : sw - (l.build === 'broad' ? 2 : 0);
  const hh = H >= 19 ? 7 : 6;
  const ll = Math.max(4, ri(H * 0.28));
  const th = H - hh - ll;
  return { sw, ww, flare: l.hem === 2 ? 2 : l.hem === 1 ? 1 : 0, hw: l.build === 'slight' ? 6 : 7, hh, ll, th, arm: Math.max(4, th - 1), lw: l.build === 'stout' ? 3 : 2 };
}

const M = (c: number): Mat => matOf(c);

function drawFigure(cv: Cv, l: HumanLook, p: Pose): void {
  const d = dims(l), pal = l.palette;
  const skin = M(pal.skin), cloth = M(pal.cloth), accent = M(pal.accent), trim = M(pal.trim), leather = M(pal.leather);
  const hair = M(pal.hair), steel = M(STEEL), wood = M(WOOD);
  const dark = M(mixc(pal.cloth, 0x1a1030, 0.5));
  const has = (e: string): boolean => (l.extras as readonly string[]).includes(e);
  const plate = l.garment === 'plate';
  const body = cloth;
  const rnd = mulberry(l.seed);

  const yHip = GY - d.ll, ySh = yHip - d.th, bob = p.bob;
  const yHead = ySh - d.hh + 1 + bob + (l.stoop > 1 ? 1 : 0);
  const hx = CX + l.stoop + p.nod; // head centre x
  const hem = l.hem === 2 ? GY - 1 : l.hem === 1 ? yHip + Math.round(d.ll * 0.6) : yHip + 1;
  const sx0 = CX - Math.floor(d.sw / 2), sx1 = sx0 + d.sw; // shoulder span in edge coords

  // ---- cloak behind
  if (l.cloak !== 'none') {
    const long = l.cloak === 'long' ? GY - 2 : l.cloak === 'fur' ? hem - 1 : ySh + Math.round(d.th * 0.8);
    const w = d.sw + 3;
    poly(cv, [[CX - w / 2 + 1, ySh + bob], [CX + w / 2 - 1, ySh + bob], [CX + w / 2 + 1, long], [CX - w / 2 - 1, long]], l.cloak === 'fur' ? M(mixc(pal.accent, 0xf0e8d8, 0.55)) : l.cloak === 'long' ? M(mixc(pal.accent, pal.cloth, 0.3)) : accent, T_CLOAK);
  }
  // ---- pack on the back
  if (has('pack')) ell(cv, CX - Math.floor(d.sw / 2) - 1, ySh + 3 + bob, 3.2, 4, leather, T_CLOAK);

  // ---- legs (only seen under a short hem), boots
  const lx = [CX - 1 - d.lw + 1, CX];
  if (l.hem < 2) {
    for (const x of lx) {
      rect(cv, x - (d.lw === 3 ? 1 : 0) + (x === CX ? 1 : 0), yHip, x - (d.lw === 3 ? 1 : 0) + (x === CX ? 1 : 0) + d.lw - (d.lw === 3 ? 1 : 0), GY - 1, dark, T_LIMB, { bevel: false });
    }
    for (const x of lx) rect(cv, x - (d.lw === 3 ? 1 : 0) + (x === CX ? 1 : 0), GY - 2, x + (x === CX ? 1 : 0) + 2, GY, leather, T_LIMB, { bevel: false });
  } else {
    rect(cv, CX - 3, GY - 1, CX - 1, GY, leather, T_LIMB, { bevel: false });
    rect(cv, CX + 1, GY - 1, CX + 3, GY, leather, T_LIMB, { bevel: false });
  }

  // ---- torso and garment
  const wTop = d.sw / 2, wMid = d.ww / 2, wHem = wMid + d.flare + (l.garment === 'robe' ? 0.5 : 0);
  const cxT = CX + (l.stoop > 0 ? 0.5 : 0);
  poly(cv, [[cxT - wTop, ySh + bob], [cxT + wTop, ySh + bob], [cxT + wMid, yHip], [cxT + wHem, hem], [cxT - wHem, hem], [cxT - wMid, yHip]], body, T_BODY, { hi: 0.5, lo: -0.4 });
  if (l.garment === 'tabard') { // bars of the second colour down the front
    for (let y = ySh + 1 + bob; y < hem; y++) for (const x of [CX - 2, CX + 1]) cv.put(x, y, pal.accent, T_BODY, 0, T_BODY);
  }
  if (l.garment === 'coat' || l.garment === 'robe') { // a placket / lapel line
    for (let y = ySh + 1 + bob; y < hem; y++) cv.put(CX, y, M(mixc(pal.cloth, 0x000000, 0.25)).b, T_BODY, 0, T_BODY);
    if (l.garment === 'coat') for (let k = 0; k < 2; k++) cv.put(CX - 1 + 2 * k, ySh + 1 + k + bob, pal.accent, T_BODY, 0, T_BODY);
  }
  if (plate) {
    poly(cv, [[cxT - wTop, ySh + bob], [cxT + wTop, ySh + bob], [cxT + wMid, yHip - 1], [cxT - wMid, yHip - 1]], M(mixc(STEEL, pal.cloth, 0.12)), T_BODY, { on: T_BODY });
    for (let k = 0; k < 3; k++) cv.put(CX - 1 + k, ySh + 2 + bob, M(STEEL).l, T_BODY, 0, T_BODY);
  }
  if (has('trimHem')) for (let x = Math.ceil(cxT - wHem); x < cxT + wHem; x++) cv.put(x, hem - 1, pal.trim, T_BODY, 0, T_BODY);
  if (has('apron')) rect(cv, CX - 2, ySh + 3 + bob, CX + 2, hem, M(PAPER), T_BODY, { on: T_BODY });
  if (has('belt') || l.garment === 'plate' || l.garment === 'tunic' || l.garment === 'coat') {
    for (let x = Math.ceil(cxT - wMid); x < cxT + wMid; x++) cv.put(x, yHip - 1, pal.leather, T_BODY, 0, T_BODY);
    cv.put(CX, yHip - 1, pal.trim, T_BODY, 0, T_BODY);
  }
  if (has('sash')) for (let k = 0; k < d.th - 1; k++) { const x = CX - 2 + Math.round((k / (d.th - 2)) * 4); cv.put(x, ySh + 1 + k + bob, pal.accent, T_BODY, 0, T_BODY); cv.put(x + 1, ySh + 1 + k + bob, pal.accent, T_BODY, 0, T_BODY); }
  if (has('chain')) for (const x of [CX - 2, CX - 1, CX, CX + 1]) cv.put(x, ySh + 1 + (x === CX - 1 || x === CX ? 1 : 0) + bob, pal.trim, T_BODY, 0, T_BODY);
  if (has('scarf')) rect(cv, CX - 2, ySh + bob, CX + 2, ySh + 1 + bob, M(pal.accent), T_BODY);
  if (l.cloak === 'fur') for (let x = CX - Math.ceil(d.sw / 2); x < CX + Math.ceil(d.sw / 2); x++) cv.put(x, ySh + bob, mixc(pal.accent, 0xf0e8d8, 0.7), T_BODY);

  // ---- arms and hands
  const handY = yHip - 1 + bob;
  const sleeve = plate ? steel : l.garment === 'coat' ? M(mixc(pal.cloth, pal.accent, 0.35)) : cloth;
  const armR: [number, number] = [sx1 + 0.5, handY - (l.held === 'trumpet' ? 3 : 0) - (p.gesture === 2 && l.held === 'none' ? 4 : p.gesture === 1 ? 2 : 0)];
  const armL: [number, number] = [sx0 - 0.5, handY - (p.gesture === 2 && l.held !== 'none' ? 3 : 0)];
  const shR: [number, number] = [sx1 - 1, ySh + 1.5 + bob], shL: [number, number] = [sx0 + 1, ySh + 1.5 + bob];
  line(cv, shL[0], shL[1], armL[0], armL[1], 2, sleeve, T_LIMB);
  line(cv, shR[0], shR[1], armR[0], armR[1], 2, sleeve, T_LIMB);
  rect(cv, ri(armL[0]) - 1, ri(armL[1]), ri(armL[0]) + 1, ri(armL[1]) + 2, skin, T_LIMB, { bevel: false });
  rect(cv, ri(armR[0]) - 1, ri(armR[1]), ri(armR[0]) + 1, ri(armR[1]) + 2, skin, T_LIMB, { bevel: false });
  if (has('pauldrons')) for (const [x, s] of [[sx0 - 1, 0], [sx1 - 2, 1]] as const) { rect(cv, x, ySh + bob, x + 3, ySh + 2 + bob, steel, T_LIMB); void s; }

  drawHeld(cv, l, armR, armL, wood, trim, leather, steel);

  // ---- head
  const hw = d.hw, hr = hw / 2;
  const hy = yHead + d.hh / 2 - 0.5;
  const hcx = hx + (hw % 2 ? 0.5 : 0);
  const hairLong = l.hair === 'long' || l.hair === 'braid' || l.hair === 'wild';
  if (l.hair === 'long') rect(cv, ri(hcx - hr) - 1, ri(yHead + 1), ri(hcx + hr) + 1, ySh + 3 + bob, hair, T_HAIR);
  if (l.hair === 'wild') ell(cv, hcx, hy - 0.5, hr + 1.6, d.hh / 2 + 1.1, hair, T_HAIR);
  if (l.head === 'hood') ell(cv, hcx, hy + 0.5, hr + 1.4, d.hh / 2 + 1.4, cloth, T_HAIR);
  ell(cv, hcx, hy, hr, d.hh / 2, skin, T_HEAD, { e: 2.4 });
  rect(cv, ri(hcx) - 1, ri(yHead + d.hh - 1), ri(hcx) + 1, ySh + 1 + bob, skin, T_HEAD, { bevel: false }); // neck
  for (const x of [ri(hcx - hr) - 1 + 1, ri(hcx + hr) - 1]) if (l.hair !== 'long' && l.head !== 'hood') cv.put(x, ri(hy + 0.5), mixc(pal.skin, 0x802020, 0.2), T_HEAD); // ears
  drawFace(cv, l, p, d, hcx, hy, yHead, rnd);
  drawHair(cv, l, d, hcx, hy, yHead, hair, hairLong);
  drawBeard(cv, l, d, hcx, hy, yHead, hair);
  drawHead(cv, l, d, hcx, hy, yHead, cloth, accent, trim, steel, leather);
  if (has('spectacles')) { const ox = [[-1, 1], [-1, 2], [-2, 2]][l.eyes], e = ri(yHead) + 3; for (const x of [ox[0] - 1, ox[0] + 1, ox[1] - 1, ox[1] + 1]) cv.put(ri(hcx) + x, e, trim.l, T_FACE); }
}

function drawFace(cv: Cv, l: HumanLook, p: Pose, d: Dim, hcx: number, hy: number, yHead: number, rnd: () => number): void {
  void rnd;
  const ey = Math.round(yHead) + 3;
  const ox = [[-1, 1], [-1, 2], [-2, 2]][l.eyes];
  const cx = Math.round(hcx);
  for (const dx of ox) cv.put(cx + dx, ey, p.blink ? mixc(l.palette.skin, 0x301810, 0.5) : INK, T_FACE);
  if (l.brow) for (const dx of ox) cv.put(cx + dx, ey - 1, mixc(l.palette.hair, 0x000000, 0.1), T_FACE);
  if (l.nose > 0) cv.put(cx + 1, ey + 1, mixc(l.palette.skin, 0x6a2a20, 0.35), T_FACE);
  if (l.nose > 1) cv.put(cx, ey + 1, mixc(l.palette.skin, 0x6a2a20, 0.2), T_FACE);
  const my = ey + 2;
  if (my < Math.round(yHead + d.hh)) {
    if (p.mouth === 0) cv.put(cx + 1, my, mixc(l.palette.skin, 0x5a2020, 0.5), T_FACE);
    else { cv.put(cx, my, MOUTH, T_FACE); cv.put(cx + 1, my, MOUTH, T_FACE); if (p.mouth === 2 && my + 1 < Math.round(yHead + d.hh)) cv.put(cx + 1, my + 1, MOUTH, T_FACE); }
  }
}

function drawHair(cv: Cv, l: HumanLook, d: Dim, hcx: number, hy: number, yHead: number, hair: Mat, long: boolean): void {
  void long; void hy;
  const hr = d.hw / 2, top = yHead;
  const x0 = Math.round(hcx - hr), x1 = Math.round(hcx + hr);
  const side = (h: number): void => { rect(cv, x0, top + 1, x0 + 1, top + 1 + h, hair, T_HAIR); rect(cv, x1 - 1, top + 1, x1, top + 1 + h, hair, T_HAIR); };
  switch (l.hair) {
    case 'bald': break;
    case 'crop': ell(cv, hcx, top + 0.4, hr, 1.6, hair, T_HAIR, { on: T_HEAD }); break;
    case 'short': case 'bun': case 'braid':
      ell(cv, hcx, top + 0.5, hr + 0.2, 2, hair, T_HAIR); side(2);
      if (l.hair === 'bun') ell(cv, hcx, top - 1, 1.6, 1.4, hair, T_HAIR);
      if (l.hair === 'braid') line(cv, x1, top + 3, x1 + 1, top + 3 + d.hh, 1, hair, T_HAIR);
      break;
    case 'mop': ell(cv, hcx, top + 0.7, hr + 0.4, 2.3, hair, T_HAIR); for (let x = x0 + 1; x < x1 - 1; x += 2) cv.put(x, top + 2, hair.b, T_HAIR); side(3); break;
    case 'long': ell(cv, hcx, top + 0.5, hr + 0.3, 2, hair, T_HAIR); rect(cv, x0 - 1, top + 1, x0 + 1, top + d.hh + 2, hair, T_HAIR); rect(cv, x1 - 1, top + 1, x1 + 1, top + d.hh + 2, hair, T_HAIR); break;
    case 'tonsure': side(4); for (let x = x0; x < x1; x++) cv.put(x, top + 1, hair.b, T_HAIR, 0, T_HEAD); break;
    case 'wild': ell(cv, hcx, top + 0.5, hr + 1, 2.2, hair, T_HAIR); side(3); break;
  }
}

function drawBeard(cv: Cv, l: HumanLook, d: Dim, hcx: number, hy: number, yHead: number, hair: Mat): void {
  void hy;
  const cx = Math.round(hcx), ey = Math.round(yHead) + 3, bot = Math.round(yHead + d.hh) - 1;
  const hr = d.hw / 2, x0 = Math.round(hcx - hr), x1 = Math.round(hcx + hr);
  const put = (x: number, y: number, c = hair.b): void => cv.put(x, y, c, T_HAIR);
  switch (l.beard) {
    case 'none': break;
    case 'stubble': for (const x of [cx - 1, cx + 2]) put(x, bot, mixc(l.palette.skin, l.palette.hair, 0.45)); put(cx - 2, ey + 1, mixc(l.palette.skin, l.palette.hair, 0.45)); break;
    case 'moustache': for (const x of [cx - 1, cx + 2]) put(x, ey + 1); put(cx - 1, ey + 2); put(cx + 2, ey + 2); put(cx, ey + 1); break;
    case 'goatee': put(cx, bot, hair.b); put(cx + 1, bot, hair.b); put(cx, bot + 1, hair.s); put(cx + 1, bot + 1, hair.s); put(cx - 1, ey + 1); put(cx + 2, ey + 1); break;
    case 'full': case 'long':
      for (let y = ey + 1; y <= bot; y++) for (let x = x0 + (y > ey + 1 ? 1 : 0); x < x1 - (y > ey + 1 ? 1 : 0); x++) {
        if (y <= ey + 2 && (x === cx || x === cx + 1)) continue; // nose and mouth show through
        put(x, y, y === bot ? hair.s : hair.b);
      }
      if (l.beard === 'long') for (let k = 0; k < 4; k++) for (let x = cx - 1 + (k > 1 ? 1 : 0); x < cx + 3 - (k > 1 ? 1 : 0); x++) put(x, bot + 1 + k, k === 3 ? hair.s : hair.b);
      break;
  }
}

function drawHead(cv: Cv, l: HumanLook, d: Dim, hcx: number, hy: number, yHead: number, cloth: Mat, accent: Mat, trim: Mat, steel: Mat, leather: Mat): void {
  const hr = d.hw / 2, top = yHead;
  const x0 = Math.round(hcx - hr), x1 = Math.round(hcx + hr);
  const cx = Math.round(hcx);
  switch (l.head) {
    case 'none': case 'hood': break;
    case 'circlet': for (let x = x0 + 1; x < x1 - 1; x++) cv.put(x, top + 1, trim.b, T_HAIR); cv.put(cx + 1, top + 1, 0xd04040, T_HAIR); break;
    case 'crown':
      rect(cv, x0, top, x1, top + 2, trim, T_HAIR);
      for (let x = x0; x < x1; x += 2) cv.put(x, top - 1, trim.l, T_HAIR);
      cv.put(cx + 1, top + 1, 0xd04040, T_HAIR);
      break;
    case 'cap': ell(cv, hcx, top + 0.6, hr + 0.3, 2, cloth, T_HAIR); rect(cv, x0, top + 1, x1, top + 2, cloth, T_HAIR, { bevel: false }); break;
    case 'coif': ell(cv, hcx, top + 0.8, hr + 0.5, 2.2, M2(0xe6dcc8), T_HAIR); rect(cv, x0 - 0, top + 1, x0 + 1, top + d.hh - 1, M2(0xe6dcc8), T_HAIR); rect(cv, x1 - 1, top + 1, x1, top + d.hh - 1, M2(0xe6dcc8), T_HAIR); break;
    case 'brim': ell(cv, hcx, top + 1.1, hr + 3, 0.9, leather, T_HAIR); rect(cv, x0 + 1, top - 2, x1 - 1, top + 1, leather, T_HAIR); rect(cv, x0 + 1, top, x1 - 1, top + 1, cloth, T_HAIR, { bevel: false }); break;
    case 'plume':
      ell(cv, hcx, top + 0.6, hr + 0.3, 2, cloth, T_HAIR); rect(cv, x0, top + 1, x1, top + 2, accent, T_HAIR, { bevel: false });
      line(cv, x1 - 1, top, x1 + 2, top - 4, 1, M2(0xf4efe2), T_HAIR); cv.put(x1 + 2, top - 3, accent.b, T_HAIR); cv.put(x1, top - 1, accent.b, T_HAIR);
      break;
    case 'helm': ell(cv, hcx, top + 0.7, hr + 0.5, 2.3, steel, T_HAIR); rect(cv, x0, top + 1, x1, top + 2, steel, T_HAIR, { bevel: false }); rect(cv, cx, top + 2, cx + 1, top + 4, steel, T_HAIR, { bevel: false }); rect(cv, x0, top + 2, x0 + 1, top + 5, steel, T_HAIR, { bevel: false }); rect(cv, x1 - 1, top + 2, x1, top + 5, steel, T_HAIR, { bevel: false }); cv.put(cx, top - 1, accent.b, T_HAIR); cv.put(cx + 1, top - 1, accent.b, T_HAIR); break;
  }
}
const M2 = (c: number): Mat => matOf(c);

function drawHeld(cv: Cv, l: HumanLook, r: [number, number], lf: [number, number], wood: Mat, trim: Mat, leather: Mat, steel: Mat): void {
  const rx = Math.round(r[0]), ry = Math.round(r[1]);
  const lx = Math.round(lf[0]), ly = Math.round(lf[1]);
  const put = (x: number, y: number, c: number): void => cv.put(x, y, c, T_HELD);
  switch (l.held) {
    case 'none': break;
    case 'staff': for (let y = ry - 10; y < GY; y++) put(rx, y, y < ry - 8 ? trim.b : wood.b); put(rx - 1, ry - 10, trim.l); put(rx + 1, ry - 10, trim.l); break;
    case 'cane': for (let y = ry; y < GY; y++) put(rx, y, wood.b); put(rx + 1, ry, wood.l); break;
    case 'sceptre': for (let y = ry - 6; y < ry + 2; y++) put(rx, y, trim.b); rect(cv, rx - 1, ry - 8, rx + 2, ry - 6, trim, T_HELD); put(rx, ry - 7, 0xd04040); break;
    case 'sword': for (let y = ry - 8; y < ry - 1; y++) put(rx, y, steel.l); put(rx, ry - 8, 0xffffff); for (const x of [rx - 1, rx + 1]) put(x, ry - 1, trim.b); put(rx, ry, leather.b); put(rx, ry + 1, trim.b); break;
    case 'trumpet': for (let x = rx; x < rx + 5; x++) put(x, ry - 1, trim.b); put(rx + 5, ry - 2, trim.l); put(rx + 5, ry - 1, trim.l); put(rx + 5, ry, trim.l); put(rx - 1, ry - 1, trim.s); break;
    case 'lantern': put(rx, ry + 1, leather.b); rect(cv, rx - 1, ry + 2, rx + 1, ry + 4, M2(0xf6d36a), T_HELD, { bevel: false }); put(rx, ry + 2, 0xffffff); break;
    case 'ledger': rect(cv, lx - 1, ly - 3, lx + 3, ly + 1, leather, T_HELD); for (let y = ly - 3; y < ly + 1; y++) put(lx + 3, y, PAPER); break;
    case 'scroll': rect(cv, lx - 1, ly - 3, lx + 2, ly + 1, M2(PAPER), T_HELD, { bevel: false }); put(lx - 1, ly - 3, leather.b); put(lx - 1, ly, leather.b); break;
  }
}

/** The frames of one pose set: idle breathes and blinks; talk moves the mouth and lifts a hand. */
const IDLE: Pose[] = [
  { bob: 0, mouth: 0, blink: false, gesture: 0, nod: 0 }, { bob: 1, mouth: 0, blink: false, gesture: 0, nod: 0 },
  { bob: 1, mouth: 0, blink: true, gesture: 0, nod: 0 }, { bob: 0, mouth: 0, blink: false, gesture: 0, nod: 0 },
];
const TALK: Pose[] = [
  { bob: 0, mouth: 2, blink: false, gesture: 1, nod: 0 }, { bob: 1, mouth: 1, blink: false, gesture: 2, nod: 1 },
  { bob: 0, mouth: 2, blink: false, gesture: 2, nod: 0 }, { bob: 1, mouth: 0, blink: false, gesture: 1, nod: 1 },
];

/** Composes one person's sheet. Deterministic; never throws for a valid look. */
export function composeHuman(look: HumanLook): HumanSheet {
  const cv = new Cv();
  const ink = mixc(look.palette.cloth, 0x0c0618, 0.85);
  const frames: { name: string; anim: string; spr: ReturnType<typeof crop> }[] = [];
  for (const [anim, poses] of [['idle', IDLE], ['talk', TALK]] as const) {
    poses.forEach((pose, i) => {
      cv.clear();
      drawFigure(cv, look, pose);
      frames.push({ name: `${anim}_${i}`, anim, spr: post(crop(cv), ink) });
    });
  }
  const sheet = buildSheet(frames, () => 'a', 64, 64);
  const any = Object.values(sheet.meta.frames)[0];
  const ms: Record<string, number> = { idle: 333, talk: 200 };
  const anims: HumanSheet['anims'] = {};
  for (const [name, a] of Object.entries(sheet.meta.anims)) anims[name] = { frames: a.frames, ms: a.frames.map(() => ms[name] ?? 250) };
  return { width: sheet.width, height: sheet.height, rgba: sheet.rgba, pivot: [any.w >> 1, any.h - 1], cell: [any.w, any.h], frames: sheet.meta.frames, anims };
}
