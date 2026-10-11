// The class-defining parts of a generated hero (docs/20-generated-heroes.md): the warrior's crested great helm, shield and sword; the mage's pointed hat
// and orb staff; the cleric's mitre and crook; the rogue's hood, mask, scarf and twin daggers; the archer's feathered cap, bow and quiver; the shaman's
// feather headdress, totem staff and bag. heroArt.ts draws the person and calls these for the class on top; none of them is ever left out, so a hero
// reads as their class whoever they are underneath. The numbers a look carries (`hat`, `weapon`, `off`, `adorn`) pick a shape of each part.
import type { HeroLook } from '../data/heroLook';
import type { HPose } from '../data/heroes/poses';
import { Cv, ell, line, matOf, mixc, poly, rect, ri, type Mat } from './pixelKit';

export const T_BACK = 1, T_BODY = 2, T_LIMB = 3, T_HEAD = 4, T_HAIR = 5, T_HELD = 6, T_FACE = 7;
export const LEAD = 0x1a1030, VELLUM = 0xf4ead2, GOLD = 0xefbd44;

const M = (c: number): Mat => matOf(c);

/** Everything a kit part needs to know about where the person is standing this frame. */
export interface Ctx {
  cv: Cv;
  L: HeroLook;
  p: HPose;
  /** Figure centre (edge coords, lean included), shoulder / hip / hem rows, the breathing bob. */
  cx: number; ySh: number; yHip: number; hem: number; bob: number;
  /** Half widths of the torso at the shoulder, waist and hem. */
  wTop: number; wMid: number; wHem: number;
  /** The head: centre x, top row, half width, columns, rows. */
  hcx: number; yHead: number; hr: number; x0: number; x1: number; hh: number;
  /** The weapon hand's pixel, the shoulder it hangs from, and the hanging hand of the other arm. */
  hand: [number, number];
  /** A point of the hand-made rigs' grid (the one the pose tables use) as a canvas pixel, with no lean or bob. */
  rig(rx: number, ry: number): [number, number];
  /** Materials. */
  skin: Mat; cloth: Mat; deep: Mat; light: Mat; leather: Mat; metal: Mat; wood: Mat; trim: Mat; hair: Mat;
  /** Draw nothing that the weapon alone would need (a measuring pass for the overhead bar height). */
  bare: boolean;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Weapons: a shape in (u along the blade from the grip, v across it), rasterised at any angle with the hand at `holdU`.
// ---------------------------------------------------------------------------------------------------------------------------
export interface BladeDef { len: number; grip: number; half: number; holdU: number; mat(u: number, v: number, L: number): number | null }

export function blade(cv: Cv, hx: number, hy: number, ang: number, d: BladeDef, tag = T_HELD): void {
  const a = (ang * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const R = d.len + d.grip + d.half + 4;
  for (let y = Math.floor(hy - R); y <= Math.ceil(hy + R); y++) for (let x = Math.floor(hx - R); x <= Math.ceil(hx + R); x++) {
    const dx = x - hx, dy = y - hy;
    const col = d.mat(dx * c + dy * s + d.holdU, -dx * s + dy * c, d.len);
    if (col !== null) cv.put(x, y, col, tag);
  }
}

const swordDef = (L: HeroLook): BladeDef => {
  const m = M(L.pal.metal), g = L.body.palette.trim, lea = L.body.palette.leather, v = L.weapon;
  const len = [11, 12, 10][v], bw = [1.1, 0.9, 1.7][v], gw = [2.2, 3, 2][v];
  return {
    len, grip: 3, half: bw, holdU: -1,
    mat(u, w, Ln) {
      if (u >= -3 && u < -0.5) return Math.abs(w) <= 0.6 ? lea : null;
      if (u >= -0.5 && u < 1) return Math.abs(w) <= gw ? g : null;
      if (u < 1 || u > Ln) return null;
      const hw = v === 2 ? (u > Ln - 2 ? Math.max(0.3, (Ln - u) * 0.8) : bw) : u > Ln - 2 ? Math.max(0.2, (Ln - u) * 0.5) : bw;
      if (Math.abs(w) > hw) return null;
      return w < 0 ? m.l : m.b;
    },
  };
};

const staffDef = (L: HeroLook): BladeDef => {
  const wood = M(L.pal.wood), gold = M(L.body.palette.trim), glow = L.pal.glow, v = L.weapon, len = 13;
  return {
    len, grip: 4, half: 1, holdU: -1,
    mat(u, w, Ln) {
      if (u >= -4 && u < Ln) return Math.abs(w) <= 0.6 ? (w < 0 ? wood.l : wood.b) : null;
      const du = u - (Ln + 1.6);
      const dd = Math.hypot(du, w);
      if (v === 0) { // an orb in a golden cradle
        if (dd < 1.15) return 0xffffff;
        if (dd < 2.3) return glow;
        if (dd < 3 && Math.abs(w) > 1.2 && du < 0.5) return gold.b;
      } else if (v === 1) { // a crystal
        if (Math.abs(du) + Math.abs(w) * 1.5 < 3.2) return Math.abs(du) + Math.abs(w) * 1.5 < 1.6 ? 0xffffff : glow;
      } else { // a ring around a spark
        if (dd < 0.9) return glow;
        if (dd < 3 && dd >= 2.1) return gold.b;
      }
      return null;
    },
  };
};

const crookDef = (L: HeroLook): BladeDef => {
  const gold = M(L.body.palette.trim), v = L.weapon, len = 11;
  return {
    len, grip: 3, half: 1, holdU: -1,
    mat(u, w, Ln) {
      if (u >= -3 && u < Ln) return Math.abs(w) <= 0.6 ? (w < 0 ? gold.l : gold.b) : null;
      const du = u - (Ln + 1), dd = Math.hypot(du, w - 1.2);
      if (v === 0) return dd < 2.1 && dd > 0.8 && !(du > 0.6 && w > 1) ? gold.b : null;                       // the shepherd's hook
      if (v === 1) return dd < 2.3 && dd > 1.2 ? gold.b : Math.abs(du) < 0.6 && w > 0.5 && w < 2.5 ? gold.l : null;     // a closed ring with a bar
      if (Math.hypot(du, w) < 1.4) return 0xfff0a0;                                                          // a flame
      if (Math.hypot(du - 1.2, w) < 1.4 || (Math.hypot(du + 0.4, w * 1.3) < 1.9 && du < 0.8)) return 0xff8a3a;
      return null;
    },
  };
};

const daggerDef = (L: HeroLook): BladeDef => {
  const m = M(L.pal.metal), g = L.body.palette.trim, v = L.weapon, len = [6, 6, 8][v];
  return {
    len, grip: 2, half: 0.9, holdU: -1,
    mat(u, w, Ln) {
      if (u >= -2 && u < 0) return Math.abs(w) <= 0.5 ? g : null;
      if (u >= 0 && u < 1) return Math.abs(w) <= 1.6 ? g : null;
      if (u < 1 || u > Ln) return null;
      const curve = v === 1 ? 0.12 * (u - 1) * (u - 1) : 0; // a curved blade bends toward its edge
      const hw = u > Ln - 1.5 ? 0.3 : 0.9;
      return Math.abs(w - curve) > hw ? null : w < curve ? m.l : m.b;
    },
  };
};

const totemDef = (L: HeroLook): BladeDef => {
  const wood = M(L.pal.wood), bone = M(L.pal.metal), glow = L.pal.glow, cloth = L.pal.cloth, v = L.weapon, len = 12;
  return {
    len, grip: 4, half: 1.5, holdU: -1,
    mat(u, w, Ln) {
      if (u >= -4 && u < Ln - 1.5) return Math.abs(w) <= 0.6 ? (w < 0 ? wood.l : wood.b) : null;
      const du = u - Ln;
      if (v === 0) { // a carved face: a block with two dark eyes, a coloured stripe and a mouth
        if (du < -1.6 || du > 2.4 || Math.abs(w) > 1.6) return null;
        if (Math.abs(w) > 0.7 && du > 0.2 && du < 1.2) return LEAD;
        if (du > 1.7 && du < 2.4 && Math.abs(w) < 1) return cloth;
        return Math.abs(w) > 1.2 ? wood.s : wood.l;
      }
      if (v === 1) { // an antler crown around a spark
        if (Math.hypot(du - 0.8, w) < 0.8) return glow;
        const arm = Math.abs(Math.abs(w) - (du + 1.5) * 0.45);
        return du > -1.2 && du < 3.5 && arm < 0.6 ? bone.b : null;
      }
      // a bundle: a bone knuckle with feathers trailing from it
      if (Math.hypot(du, w) < 1.5) return bone.l;
      if (du < -0.6 && du > -4.6 && Math.abs(Math.abs(w) - 1.7) < 0.55) return w < 0 ? L.pal.feather : cloth;
      return null;
    },
  };
};

export const weaponDef = (L: HeroLook): BladeDef => {
  switch (L.cls) {
    case 'warrior': return swordDef(L);
    case 'mage': return staffDef(L);
    case 'cleric': return crookDef(L);
    case 'rogue': return daggerDef(L);
    case 'shaman': return totemDef(L);
    default: return staffDef(L); // the archer's bow is drawn by its own routine
  }
};

// ---------------------------------------------------------------------------------------------------------------------------
// Parts shared by several kits
// ---------------------------------------------------------------------------------------------------------------------------
const put = (c: Ctx, x: number, y: number, col: number, tag = T_HELD): void => c.cv.put(ri(x), ri(y), col, tag);

/** A feather: a short curved line with a pale rib. */
function feather(c: Ctx, x: number, y: number, dx: number, dy: number, col: number): void {
  line(c.cv, x, y, x + dx, y + dy, 2, M(col), T_HAIR);
  put(c, x + dx * 0.5, y + dy * 0.5, mixc(col, 0xffffff, 0.55), T_HAIR);
}

/** The head box: where headgear sits. */
const top = (c: Ctx): number => c.yHead;

export interface Kit {
  /** Hem: 0 to the hip, 1 to the knee, 2 to the ankle; and the flare of a skirt. */
  hem: 0 | 1 | 2;
  flare: number;
  /** Rows the stance is lowered by (the rogue's crouch). */
  crouch: number;
  /** A closed helm: nothing of the face shows, so it is not drawn. */
  closed?(L: HeroLook): boolean;
  /** Torso colour. */
  garment(L: HeroLook): number;
  behind?(c: Ctx): void;
  body?(c: Ctx): void;
  offhand?(c: Ctx): void;
  face?(c: Ctx): void;
  /** Headgear that sits behind the head (the sides of a hood), drawn before it. */
  backHead?(c: Ctx): void;
  headgear(c: Ctx): void;
  shoulders?(c: Ctx): void;
  /** The weapon in the hand (the archer's bow too). */
  weapon(c: Ctx): void;
  /** What lies on the ground beside a fallen hero: [x offset, colour, width, height] of the headgear lying there. */
  fallen: (L: HeroLook) => { col: number; w: number; h: number; spike?: boolean };
}

const defaultWeapon = (c: Ctx): void => { if (!c.bare) blade(c.cv, c.hand[0], c.hand[1], c.p.ang ?? -60, weaponDef(c.L)); };

// ---- WARRIOR ----------------------------------------------------------------------------------------------------------------------------------------------
const warrior: Kit = {
  hem: 0, flare: 1, crouch: 0,
  closed: (L) => L.hat === 0,
  garment: (L) => L.pal.cloth,
  body(c) {
    const { cv, cx, yHip, ySh, bob, wMid, wTop } = c;
    for (let x = Math.ceil(cx - wMid); x < cx + wMid; x++) cv.put(x, yHip - 1, c.L.body.palette.leather, T_BODY);
    cv.put(ri(cx), yHip - 1, c.trim.b, T_BODY);
    // a plate gorget under the chin and a light stripe down the surcoat
    for (let y = ySh + 2 + bob; y < yHip - 1; y++) cv.put(ri(cx), y, c.light.b, T_BODY, 0, T_BODY);
    rect(cv, cx - wTop + 1, ySh + bob, cx + wTop - 1, ySh + 1 + bob, c.metal, T_BODY);
  },
  offhand(c) {
    const { cv, L } = c, sh = c.p.shield ?? [0, 0];
    const x = c.cx - 2 + sh[0], y0 = c.yHip - 5 + c.bob + sh[1];
    const field = c.cloth, rim = c.metal, emblem = M(mixc(L.pal.light, 0xfff0c0, 0.4));
    if (L.off === 0) { // kite
      poly(cv, [[x - 2.5, y0], [x + 2.5, y0], [x + 2.5, y0 + 3.5], [x, y0 + 7.2], [x - 2.5, y0 + 3.5]], rim, T_HELD);
      poly(cv, [[x - 1.6, y0 + 1], [x + 1.6, y0 + 1], [x + 1.6, y0 + 3.2], [x, y0 + 5.8], [x - 1.6, y0 + 3.2]], field, T_HELD);
      for (let y = ri(y0 + 1); y < y0 + 5; y++) put(c, x, y, emblem.b, T_HELD);
    } else if (L.off === 1) { // round
      ell(cv, x, y0 + 3, 3.2, 3.2, rim, T_HELD);
      ell(cv, x, y0 + 3, 2.2, 2.2, field, T_HELD);
      put(c, x - 0.5, y0 + 2.5, c.trim.l); put(c, x + 0.5, y0 + 3.5, c.trim.b);
    } else { // heater: flat top, curved point
      poly(cv, [[x - 3, y0 + 0.5], [x + 3, y0 + 0.5], [x + 3, y0 + 3], [x + 1, y0 + 6], [x - 1, y0 + 6], [x - 3, y0 + 3]], rim, T_HELD);
      poly(cv, [[x - 2, y0 + 1.4], [x + 2, y0 + 1.4], [x + 2, y0 + 3], [x + 0.6, y0 + 5], [x - 0.6, y0 + 5], [x - 2, y0 + 3]], field, T_HELD);
      rect(cv, x - 0.5, y0 + 1.4, x + 1.5, y0 + 4, emblem, T_HELD, { bevel: false });
    }
  },
  headgear(c) {
    const { cv, L } = c, hr = c.hr, t = top(c), hcx = c.hcx, x0 = c.x0, x1 = c.x1, steel = c.metal;
    if (L.hat === 0) { // great helm: a closed steel pot with a T-shaped visor slit
      ell(cv, hcx, t + 2.4, hr + 0.9, c.hh / 2 + 0.7, steel, T_HELD);
      for (let x = x0 + 1; x < x1 - 1; x++) cv.put(x, t + 3, LEAD, T_FACE);
      cv.put(ri(hcx), t + 4, LEAD, T_FACE); cv.put(ri(hcx), t + 5, LEAD, T_FACE);
      cv.put(x0 + 1, t + 3, mixc(c.L.pal.glow, 0xffffff, 0.2), T_FACE);
    } else { // nasal helm: a cap, cheek guards and a nose guard; the face shows
      ell(cv, hcx, t + 0.8, hr + 0.7, 2.4, steel, T_HELD);
      rect(cv, x0, t + 1, x1, t + 2, steel, T_HELD, { bevel: false });
      rect(cv, ri(hcx) , t + 2, ri(hcx) + 1, t + 4, steel, T_HELD, { bevel: false });
      rect(cv, x0 - 0, t + 2, x0 + 1, t + 5, steel, T_HELD, { bevel: false });
      rect(cv, x1 - 1, t + 2, x1, t + 5, steel, T_HELD, { bevel: false });
    }
    // the crest, in the player's colour: a swept-back fin, a ridge from brow to nape, or a plume
    const cr = c.cloth;
    if (L.adorn === 0) { line(cv, hcx + 0.5, t - 0.5, hcx - 4.5, t - 3.5, 2, cr, T_HELD); put(c, hcx - 5, t - 4, c.light.b); }
    else if (L.adorn === 1) { rect(cv, x0, t - 2, x1, t - 0.5, cr, T_HELD); for (let x = x0; x < x1; x += 2) put(c, x, t - 3, c.light.b); }
    else { line(cv, hcx, t - 1, hcx - 1.5, t - 4, 2, cr, T_HELD); ell(cv, hcx - 3.4, t - 1.6, 2.2, 3.2, cr, T_HELD); put(c, hcx - 3.4, t - 2, c.light.b); }
  },
  shoulders(c) {
    const { cv, cx, ySh, bob, wTop } = c;
    for (const x of [cx - wTop - 1, cx + wTop - 2]) rect(cv, x, ySh + bob, x + 3, ySh + 2 + bob, c.metal, T_LIMB);
  },
  weapon: defaultWeapon,
  fallen: (L) => ({ col: L.pal.metal, w: 4, h: 3 }),
};

// ---- MAGE -------------------------------------------------------------------------------------------------------------------------------------------------
const mage: Kit = {
  hem: 2, flare: 2, crouch: 0,
  garment: (L) => L.pal.cloth,
  body(c) {
    const { cv, cx, hem, wHem } = c;
    for (let x = Math.ceil(cx - wHem); x < cx + wHem; x++) cv.put(x, hem - 1, c.trim.b, T_BODY, 0, T_BODY);  // golden hem
    if (c.L.adorn === 2) for (let y = c.ySh + 2 + c.bob; y < hem - 1; y += 2) cv.put(ri(cx), y, c.light.b, T_BODY, 0, T_BODY);
    // a rope belt
    for (let x = Math.ceil(cx - c.wMid); x < cx + c.wMid; x++) cv.put(x, c.yHip - 1, mixc(c.L.pal.cloth, 0xf4ead2, 0.5), T_BODY, 0, T_BODY);
  },
  headgear(c) {
    const { cv, L } = c, t = top(c), hcx = c.hcx, hr = c.hr;
    const hat = M(L.pal.second), band = M(c.trim.b);
    if (L.hat === 2) { // wide-brim, short cone, tip drooping
      ell(cv, hcx, t + 1, hr + 3.4, 1, hat, T_HELD);
      poly(cv, [[hcx - hr, t + 1], [hcx + hr, t + 1], [hcx + 1.6, t - 2.5], [hcx - 2.5, t - 4.5], [hcx - 3, t - 2]], hat, T_HELD);
      put(c, hcx - 3, t - 4, hat.b); put(c, hcx - 4, t - 4, hat.s);
    } else if (L.hat === 1) { // a tall straight cone
      ell(cv, hcx, t + 1, hr + 2, 0.9, hat, T_HELD);
      poly(cv, [[hcx - hr - 0.3, t + 1], [hcx + hr + 0.3, t + 1], [hcx + 1, t - 3], [hcx + 0.4, t - 7.5], [hcx - 0.6, t - 7.5], [hcx - 1.4, t - 3]], hat, T_HELD);
    } else { // a tall cone whose tip is bent back
      ell(cv, hcx, t + 1, hr + 2, 0.9, hat, T_HELD);
      poly(cv, [[hcx - hr - 0.3, t + 1], [hcx + hr + 0.3, t + 1], [hcx + 1.4, t - 3], [hcx - 1, t - 6], [hcx - 3.2, t - 6.5], [hcx - 3.2, t - 5], [hcx - 2, t - 3]], hat, T_HELD);
    }
    rect(cv, hcx - hr - 0.4, t, hcx + hr + 0.4, t + 1.5, band, T_HELD, { bevel: false });
    if (L.adorn === 0) { put(c, hcx + 0.4, t - 1.2, 0xfff0a0); put(c, hcx - 0.6, t - 1.2, c.trim.l); put(c, hcx - 0.1, t - 2.2, c.trim.l); put(c, hcx - 0.1, t - 0.2, c.trim.l); } // a star
    else if (L.adorn === 1) { put(c, hcx + 0.5, t - 1.4, 0xfff0a0); put(c, hcx - 0.5, t - 0.6, 0xfff0a0); put(c, hcx + 0.5, t + 0.2, 0xfff0a0); }                                  // a crescent
  },
  weapon: defaultWeapon,
  fallen: (L) => ({ col: L.pal.second, w: 6, h: 3, spike: true }),
};

// ---- CLERIC -----------------------------------------------------------------------------------------------------------------------------------------------
const cleric: Kit = {
  hem: 2, flare: 2, crouch: 0,
  garment: (L) => L.pal.cloth,
  body(c) {
    const { cv, cx, hem, ySh, bob, L } = c, vel = M(VELLUM);
    // the vestment over the robe: a long stole, or a tabard panel, in vellum with golden ends
    const w = L.off === 0 ? 1 : 2;
    for (let y = ySh + 1 + bob; y < hem - 1; y++) for (let x = 0; x < w * 2; x++) cv.put(ri(cx) - w + x, y, x === 0 ? vel.l : x === w * 2 - 1 ? vel.s : vel.b, T_BODY, 0, T_BODY);
    for (let x = 0; x < w * 2; x++) cv.put(ri(cx) - w + x, hem - 1, c.trim.b, T_BODY, 0, T_BODY);
    for (let x = Math.ceil(cx - c.wHem); x < cx + c.wHem; x++) cv.put(x, hem - 1, c.trim.b, T_BODY, 0, T_BODY);
    // the pendant on the chest
    if (L.adorn === 0) { put(c, cx - 1, ySh + 2 + bob, c.trim.l, T_BODY); put(c, cx, ySh + 2 + bob, 0xfff0a0, T_BODY); put(c, cx + 1, ySh + 2 + bob, c.trim.l, T_BODY); put(c, cx, ySh + 3 + bob, c.trim.b, T_BODY); }
    else if (L.adorn === 1) { put(c, cx, ySh + 2 + bob, c.trim.l, T_BODY); put(c, cx, ySh + 3 + bob, c.trim.b, T_BODY); put(c, cx - 1, ySh + 2 + bob, c.trim.b, T_BODY); put(c, cx + 1, ySh + 2 + bob, c.trim.b, T_BODY); }
  },
  headgear(c) {
    const { cv, L } = c, t = top(c), hcx = c.hcx, hr = c.hr, vel = M(VELLUM), band = c.cloth, gold = M(c.trim.b);
    if (L.hat === 1) { // a wide rounded mitre with a sun disc
      ell(cv, hcx, t + 0.4, hr + 0.8, 3, vel, T_HELD);
      rect(cv, hcx - hr - 0.3, t + 1, hcx + hr + 0.3, t + 2, band, T_HELD, { bevel: false });
      ell(cv, hcx + 0.3, t - 0.3, 1.5, 1.5, gold, T_HELD);
      put(c, hcx + 0.3, t - 0.3, 0xfff0a0);
    } else { // a tall pointed mitre (plain, or with a cross); the plain one splits at the tip
      const apex = L.hat === 2 ? t - 6 : t - 5;
      poly(cv, [[hcx - hr - 0.3, t + 1.5], [hcx + hr + 0.3, t + 1.5], [hcx + 1.3, apex + 2], [hcx + 0.5, apex], [hcx - 0.5, apex], [hcx - 1.3, apex + 2]], vel, T_HELD);
      if (L.hat === 2) { put(c, hcx - 0.2, apex, LEAD); put(c, hcx - 0.2, apex + 1, c.cloth.b); }
      rect(cv, hcx - hr - 0.4, t, hcx + hr + 0.4, t + 1.5, band, T_HELD, { bevel: false });
      if (L.hat === 0) { for (let y = ri(t - 3.5); y < t - 0.5; y++) put(c, hcx - 0.1, y, gold.b); put(c, hcx - 1.1, t - 2, gold.b); put(c, hcx + 0.9, t - 2, gold.b); }
    }
  },
  weapon: defaultWeapon,
  fallen: () => ({ col: VELLUM, w: 4, h: 3, spike: true }),
};

// ---- ROGUE ------------------------------------------------------------------------------------------------------------------------------------------------
const rogue: Kit = {
  hem: 1, flare: 0, crouch: 1,
  garment: (L) => mixc(L.pal.deep, LEAD, 0.45),
  behind(c) {
    const { cv, L, p } = c;
    // the long scarf streaming behind, in the player's colour; it sways between frames
    const sway = p.scarf ?? 1, len = 6 + L.adorn * 2 + sway;
    const x = c.cx - 1, y = c.ySh + 1 + c.bob;
    line(cv, x, y, x - len, y + 1 + sway * 0.9, 2, c.cloth, T_BACK);
    line(cv, x - len * 0.55, y + 0.5 + sway * 0.5, x - len - 1, y + 2 + sway * 1.3, 1, c.light, T_BACK);
    // the off-hand dagger, held back where it keeps the silhouette clean
    if (!c.bare) { const [bx, by] = p.back2 ? c.rig(p.back2[0], p.back2[1]) : [c.hand[0] - 6, c.hand[1] + 1]; blade(cv, bx, by, p.ang2 ?? 150, weaponDef(L), T_BACK); }
  },
  body(c) {
    const { cv, cx, ySh, yHip, bob } = c;
    // a leather strap across the chest and a belt
    for (let k = 0; k < yHip - ySh - 1; k++) cv.put(ri(cx) - 2 + Math.round((k / Math.max(1, yHip - ySh - 2)) * 3), ySh + 1 + k + bob, c.L.body.palette.leather, T_BODY, 0, T_BODY);
    for (let x = Math.ceil(cx - c.wMid); x < cx + c.wMid; x++) cv.put(x, yHip - 1, c.L.body.palette.leather, T_BODY, 0, T_BODY);
    cv.put(ri(cx), yHip - 1, c.trim.b, T_BODY, 0, T_BODY);
  },
  face(c) {
    const { cv, L } = c, t = top(c), x0 = c.x0, x1 = c.x1, mask = M(mixc(L.pal.deep, LEAD, 0.55));
    // the mask: half (nose down), a bandana up over the nose, a full mask leaving only the eye band, or none (the face shows)
    const from = L.off === 0 ? t + 4 : t + 3;
    if (L.off < 3) for (let y = from; y < t + c.hh; y++) for (let x = x0; x < x1; x++) cv.put(x, y, mask.b, T_FACE);
    if (L.off === 2) for (let x = x0; x < x1; x++) cv.put(x, t + 2, mask.s, T_FACE);
    // the one gold eye
    cv.put(ri(c.hcx) + 1, t + 3 - (L.off === 0 ? 0 : 0), c.L.pal.glow, T_FACE);
    cv.put(ri(c.hcx) - 1, t + 3, LEAD, T_FACE);
  },
  backHead(c) {
    const { cv, L } = c, t = top(c), hood = M(mixc(L.pal.deep, LEAD, 0.35));
    // the hood: pulled up over the hair and down around the face
    ell(cv, c.hcx, t + 2.4, c.hr + 1.3, 3.4, hood, T_HAIR);
    rect(cv, c.x0 - 1, t + 2, c.x0 + 1, t + c.hh, hood, T_HAIR, { bevel: false });
    rect(cv, c.x1 - 1, t + 2, c.x1 + 1, t + c.hh - 1, hood, T_HAIR, { bevel: false });
  },
  headgear(c) {
    const { cv, L } = c, t = top(c), hcx = c.hcx, hr = c.hr, hood = M(mixc(L.pal.deep, LEAD, 0.35));
    ell(cv, hcx, t + 0.1, hr + 0.7, 1.7, hood, T_HAIR);                                                       // the cowl over the brow
    if (L.hat === 0) poly(cv, [[hcx - 1.5, t - 0.8], [hcx + 0.5, t - 1.2], [hcx - 5, t - 2.8], [hcx - 4.2, t - 0.6]], hood, T_HAIR);   // a point swept back
    else line(cv, hcx - 2.5, t + 0.5, hcx - 5.5, t + 3, 2, hood, T_HAIR);                                      // a tail hanging back
  },
  weapon: defaultWeapon,
  fallen: (L) => ({ col: mixc(L.pal.deep, LEAD, 0.35), w: 5, h: 2 }),
};

// ---- ARCHER -----------------------------------------------------------------------------------------------------------------------------------------------
/** The bow, drawn straight into the frame (carried slanted across the body, or held out with the string drawn back by `pull`). */
function drawBow(c: Ctx): void {
  const { p, L } = c, [gx, gy] = c.hand;
  const wood = M(L.pal.wood), tip = M(mixc(L.pal.wood, 0xf4ead2, 0.45)), R = [5, 7, 6][L.weapon], cv = c.cv;
  const aim = p.aim ?? false, pull = p.pull ?? 0;
  const string = 0xe8e0c8;
  if (!aim) {
    for (let dx = -R; dx <= R; dx++) {
      const t = dx / R, slope = -Math.round(dx / 2), bulge = Math.round(2.4 * (1 - t * t));
      cv.put(gx + dx, gy + slope - bulge, Math.abs(t) > 0.7 ? tip.b : wood.b, T_HELD);
      cv.put(gx + dx, gy + slope, string, T_HELD);
    }
    return;
  }
  const x0 = gx - 2;
  for (let dy = -R; dy <= R; dy++) {
    const bulge = Math.round(2.4 * (1 - (dy / R) ** 2)) - (L.weapon === 2 && Math.abs(dy) > R - 2 ? 1 : 0);
    cv.put(x0 + bulge, gy + dy, Math.abs(dy) > R - 2 ? tip.b : wood.b, T_HELD);
  }
  const nock = [x0 - pull, gy];
  const seg = (a: number[], b: number[]): void => { const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1); for (let i = 0; i <= n; i++) cv.put(ri(a[0] + ((b[0] - a[0]) * i) / n), ri(a[1] + ((b[1] - a[1]) * i) / n), string, T_HELD); };
  seg([x0, gy - R], nock); seg(nock, [x0, gy + R]);
  if (p.arrow) {
    const glow = p.glow ? 0xfff0a0 : 0xf4ead2, head = p.glow ? 0xfff0a0 : 0xd4daf0;
    for (let x = nock[0]; x <= x0 + 5; x++) cv.put(x, gy, glow, T_HELD);
    cv.put(x0 + 6, gy, head, T_HELD); cv.put(x0 + 5, gy - 1, head, T_HELD); cv.put(x0 + 5, gy + 1, head, T_HELD);
    cv.put(nock[0], gy - 1, L.pal.feather, T_HELD); cv.put(nock[0] + 1, gy + 1, L.pal.feather, T_HELD);
  }
}

const archer: Kit = {
  hem: 0, flare: 0, crouch: 0,
  garment: (L) => L.pal.cloth,
  behind(c) {
    const { cv, L } = c, wood = M(mixc(L.body.palette.leather, 0x000000, 0.1)), n = L.adorn + 1;
    const fl = [L.pal.feather, L.pal.light, 0xf4efe2];
    let qx: number, qy: number;
    if (L.off === 0) { qx = c.cx - c.wTop - 2; qy = c.ySh + 2 + c.bob; rect(cv, qx - 1, qy, qx + 2, qy + 5, wood, T_BACK); for (let k = 0; k < n; k++) { cv.put(qx - 1 + k, qy - 2, fl[k % 3], T_BACK); cv.put(qx - 1 + k, qy - 1, fl[k % 3], T_BACK); } }
    else if (L.off === 1) { line(cv, c.cx + c.wTop - 1, c.ySh + 1 + c.bob, c.cx - c.wTop - 1, c.yHip - 1 + c.bob, 3, wood, T_BACK); for (let k = 0; k < n; k++) cv.put(ri(c.cx - c.wTop - 2 + k), c.yHip - 3 + c.bob, fl[k % 3], T_BACK); }
    else { qx = c.cx - c.wMid - 2; qy = c.yHip - 3 + c.bob; rect(cv, qx - 1, qy, qx + 2, qy + 4, wood, T_BACK); for (let k = 0; k < n; k++) cv.put(qx - 1 + k, qy - 1, fl[k % 3], T_BACK); }
  },
  body(c) {
    const { cv, cx, yHip } = c;
    for (let x = Math.ceil(cx - c.wMid); x < cx + c.wMid; x++) cv.put(x, yHip - 1, c.L.body.palette.leather, T_BODY, 0, T_BODY);
    cv.put(ri(cx), yHip - 1, c.trim.b, T_BODY, 0, T_BODY);
    // a laced collar in leather
    for (let x = ri(cx) - 1; x < ri(cx) + 1; x++) cv.put(x, c.ySh + 1 + c.bob, c.L.body.palette.leather, T_BODY, 0, T_BODY);
  },
  backHead(c) {
    if (c.L.hat !== 2) return;
    const { cv } = c, t = top(c), cap = M(c.L.pal.second);
    ell(cv, c.hcx, t + 2.4, c.hr + 1.3, 3.4, cap, T_HAIR);
    rect(cv, c.x0 - 1, t + 2, c.x0 + 1, t + c.hh, cap, T_HAIR, { bevel: false });
    rect(cv, c.x1 - 1, t + 2, c.x1 + 1, t + c.hh - 1, cap, T_HAIR, { bevel: false });
  },
  headgear(c) {
    const { cv, L } = c, t = top(c), hcx = c.hcx, hr = c.hr, x0 = c.x0, x1 = c.x1;
    const cap = M(L.pal.second), n = L.adorn + 1;
    if (L.hat === 1) { // a brimmed hat
      ell(cv, hcx, t + 1.1, hr + 3, 0.9, cap, T_HELD);
      rect(cv, x0 + 1, t - 1.5, x1 - 1, t + 1, cap, T_HELD);
    } else if (L.hat === 2) { // a soft hood-cap that hangs to the shoulders
      ell(cv, hcx, t + 0.4, hr + 0.9, 2, cap, T_HELD);
    } else { // a soft cap
      ell(cv, hcx, t + 0.6, hr + 0.5, 2.2, cap, T_HELD);
      rect(cv, x0, t + 1, x1, t + 2, cap, T_HELD, { bevel: false });
      rect(cv, x0 + 1, t + 2, x1, t + 3, cap, T_HELD, { bevel: false });
    }
    // the feather(s), swept back: always there
    const fc = [L.pal.feather, L.pal.light, 0xf4efe2];
    for (let k = 0; k < n; k++) feather(c, hcx - 1 - k * 0.6, t - 0.5, -4 - k, -3 + k * 1.4, fc[k % 3]);
  },
  weapon: (c) => { if (!c.bare) drawBow(c); },
  fallen: (L) => ({ col: L.pal.second, w: 4, h: 2 }),
};

// ---- SHAMAN -----------------------------------------------------------------------------------------------------------------------------------------------
const shaman: Kit = {
  hem: 1, flare: 1, crouch: 0,
  garment: (L) => L.pal.cloth,
  behind(c) {
    const { cv, L } = c;
    // the totem bag on the hip: a hide pouch on a cord, a carved totem tip showing at its mouth
    const bag = M(L.off === 0 ? mixc(L.body.palette.leather, 0xb89868, 0.3) : mixc(L.pal.deep, L.pal.cloth, 0.4));
    ell(cv, c.cx - c.wMid - 1.2, c.yHip + 0.2 + c.bob, 2.2, 2.4, bag, T_BACK);
    cv.put(ri(c.cx - c.wMid - 1), ri(c.yHip - 2 + c.bob), L.pal.glow, T_BACK);
  },
  body(c) {
    const { cv, cx, ySh, bob, wTop, yHip } = c;
    for (let x = Math.ceil(cx - c.wMid); x < cx + c.wMid; x++) cv.put(x, yHip - 1, c.L.body.palette.leather, T_BODY, 0, T_BODY);
    cv.put(ri(cx), yHip - 1, c.trim.b, T_BODY, 0, T_BODY);
    // the pelt mantle over the shoulders, with a ragged fringe, and a necklace of bone
    const pelt = M(mixc(c.L.pal.wood, 0xc8b898, 0.35));
    rect(cv, cx - wTop - 1, ySh + bob, cx + wTop + 1, ySh + 2 + bob, pelt, T_BODY);
    for (let x = Math.ceil(cx - wTop - 1); x < cx + wTop + 1; x += 2) cv.put(x, ySh + 2 + bob, pelt.s, T_BODY);
    for (const x of [ri(cx) - 1, ri(cx), ri(cx) + 1]) cv.put(x, ySh + 3 + bob + (x === ri(cx) ? 1 : 0), c.L.pal.metal, T_BODY, 0, T_BODY);
  },
  face(c) {
    const { cv, L } = c, t = top(c), hcx = ri(c.hcx), col = L.adorn === 1 ? L.pal.light : L.pal.glow;
    if (L.adorn === 0) { for (const x of [hcx - 2, hcx + 2]) { cv.put(x, t + 4, col, T_FACE); cv.put(x + (x < hcx ? -1 : 1), t + 5, col, T_FACE); } }        // two stripes on each cheek
    else if (L.adorn === 1) { for (const x of [hcx - 2, hcx - 1, hcx + 2, hcx + 3]) cv.put(x, t + 4, col, T_FACE); }                                          // dots under the eyes
    else { for (let x = c.x0; x < c.x1; x++) cv.put(x, t + 3, x === hcx || x === hcx + 1 ? L.pal.glow : col, T_FACE); }                                      // a bar across the eyes
  },
  headgear(c) {
    const { cv, L } = c, t = top(c), hcx = c.hcx, hr = c.hr, x0 = c.x0, x1 = c.x1, band = M(L.pal.second);
    if (L.hat === 2) { // a horned skull cap
      const bone = M(L.pal.metal);
      ell(cv, hcx, t + 0.7, hr + 0.3, 2.2, bone, T_HELD);
      cv.put(ri(hcx) - 1, t + 1, LEAD, T_HELD); cv.put(ri(hcx) + 1, t + 1, LEAD, T_HELD);
      line(cv, x0, t, x0 - 2, t - 4, 2, bone, T_HELD); line(cv, x1 - 1, t, x1 + 1, t - 4, 2, bone, T_HELD);
      return;
    }
    rect(cv, x0, t + 0.5, x1, t + 1.5, band, T_HELD, { bevel: false });
    if (L.hat === 1) { // antlers
      const bone = M(L.pal.metal);
      for (const s of [-1, 1]) {
        const bx = s < 0 ? x0 : x1 - 1;
        line(cv, bx, t + 0.5, bx + s * 2.5, t - 3, 1, bone, T_HELD); line(cv, bx + s * 1.2, t - 1.2, bx + s * 4, t - 1.8, 1, bone, T_HELD); line(cv, bx + s * 2.3, t - 2.8, bx + s * 1.2, t - 5, 1, bone, T_HELD);
      }
    } else { // a fan of feathers
      const fc = [L.pal.feather, L.pal.cloth, L.pal.light, 0xf4efe2, L.pal.feather];
      for (let k = 0; k < 5; k++) { const a = -2.2 + k * 1.1; feather(c, hcx + a * 0.9, t + 0.5, a * 1.5, -3.8 - (k === 2 ? 1.5 : k % 2 === 0 ? 0.5 : 0), fc[k]); }
    }
  },
  weapon: defaultWeapon,
  fallen: (L) => ({ col: L.pal.feather, w: 5, h: 2 }),
};

export const KITS: Record<HeroLook['cls'], Kit> = { warrior, mage, cleric, rogue, archer, shaman };
