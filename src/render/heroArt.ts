// Sprite composer for generated player characters (docs/20-generated-heroes.md): turns a HeroLook (data/heroLook.ts) into the sheet the game's hero
// sets read (render/hero.ts): idle, walk, sweep, finisher, recover, cast, hurt and down loops, plus the mage's shoot. Pure code, deterministic: one look
// is always the same bytes. The person (head, hair, build) is drawn here with the same face code as the story figures (humanArt.ts); the class-defining
// parts come from heroKit.ts; the poses are the hand-made rigs' own tables (data/heroes/poses.ts), so every frame the game picks is where it expects.
import type { HeroLook, HeroSheet } from '../data/heroLook';
import { POSES, type HPose } from '../data/heroes/poses';
import { buildSheet, crop, Cv, CX, GY, ell, line, matOf, mixc, poly, post, rect, ri, mulberry, type Mat } from './pixelKit';
import { drawBeard, drawFace, drawHair, type Dim } from './humanArt';
import { KITS, LEAD, T_BODY, T_HAIR, T_HEAD, T_HELD, T_LIMB, blade, weaponDef, type Ctx } from './heroKit';

const M = (c: number): Mat => matOf(c);
const REST: HPose = { hand: [14, 9] };

interface Geo { sw: number; ww: number; hw: number; hh: number; ll: number; th: number }

function geo(L: HeroLook, crouch: number): Geo {
  const b = L.body;
  const sw = { slight: 5, average: 6, broad: 7, stout: 7 }[b.build];
  const ww = b.build === 'slight' ? sw - 1 : sw;
  const hh = 6, ll = 3;
  return { sw, ww, hw: b.build === 'slight' ? 6 : 7, hh, ll, th: Math.max(3, b.height - hh - ll - crouch) };
}

/** Draws one standing figure for one pose. `bare` leaves off what is held (the measuring pass for the overhead bar). */
function drawHero(cv: Cv, L: HeroLook, p: HPose, ground: number, bare = false): void {
  const kit = KITS[L.cls], b = L.body, pal = b.palette;
  const g = geo(L, kit.crouch);
  const lean = p.lean ?? 0, bob = p.bob ?? 0;
  const cx = CX + lean;
  const yHip = GY - g.ll, ySh = yHip - g.th;
  const hem = kit.hem === 2 ? GY - 1 : kit.hem === 1 ? yHip + 2 : yHip + 1;
  const sway = kit.hem > 0 ? (p.rb === 1 ? 1 : p.rb === 2 ? -1 : 0) : 0;
  const wTop = g.sw / 2, wMid = g.ww / 2, wHem = wMid + kit.flare;
  const yHead = ySh - g.hh + 1 + bob + (p.hy ?? 0);
  const hcx = CX + lean + (p.hx ?? 0) + (g.hw % 2 ? 0.5 : 0);
  const hr = g.hw / 2;
  const hy = yHead + g.hh / 2 - 0.5;
  const rigX = (rx: number): number => CX + (rx - 11), rigY = (ry: number): number => GY - 1 - (ground - ry);
  const hand: [number, number] = [rigX(p.hand[0] + lean), rigY(p.hand[1] + bob)];

  const garment = kit.garment(L);
  const c: Ctx = {
    cv, L, p, cx, ySh, yHip, hem, bob, wTop, wMid, wHem, hcx, yHead, hr, x0: ri(hcx - hr), x1: ri(hcx + hr), hh: g.hh, hand,
    rig: (rx, ry) => [rigX(rx), rigY(ry)],
    skin: M(pal.skin), cloth: M(L.pal.cloth), deep: M(L.pal.deep), light: M(L.pal.light), leather: M(pal.leather), metal: M(L.pal.metal),
    wood: M(L.pal.wood), trim: M(pal.trim), hair: M(pal.hair), bare,
  };
  const body = M(garment), sleeve = body, dark = M(mixc(garment, LEAD, 0.5));
  const rnd = mulberry(L.seed);

  kit.behind?.(c);

  // ---- feet and legs: boots under a long hem, legs and boots under a short one, walking by the pose's strides
  const lb = p.lb ?? 0, lf = p.lf ?? 0, lbl = p.lbl ?? 0, lfl = p.lfl ?? 0;
  const boot = M(pal.leather);
  for (const [x, foot, lift] of [[cx - 1.5, lb, lbl], [cx + 1.5, lf, lfl]] as const) {
    const bx = ri(x + foot), by = GY - 1 - lift;
    if (kit.hem < 2) line(cv, x, yHip, x + foot * 0.8, by - 1, 2, dark, T_LIMB);
    rect(cv, bx - 1, by - (kit.hem < 2 ? 1 : 0), bx + 1, by + 1, boot, T_LIMB, { bevel: false });
  }

  // ---- torso and what it wears
  poly(cv, [[cx - wTop, ySh + bob], [cx + wTop, ySh + bob], [cx + wMid, yHip], [cx + wHem + sway, hem], [cx - wHem + sway, hem], [cx - wMid, yHip]], body, T_BODY, { hi: 0.5, lo: -0.4 });
  kit.body?.(c);

  // ---- the arm that hangs, and what is held in that hand
  const sx0 = cx - g.sw / 2, sx1 = cx + g.sw / 2;
  const offX = sx0 - 0.5, offY = yHip - 1 + bob;
  line(cv, sx0 + 1, ySh + 1.5 + bob, offX, offY, 2, sleeve, T_LIMB);
  rect(cv, ri(offX) - 1, ri(offY), ri(offX) + 1, ri(offY) + 2, c.skin, T_LIMB, { bevel: false });
  kit.offhand?.(c);

  // ---- the head
  kit.backHead?.(c);
  const d: Dim = { sw: g.sw, ww: g.ww, flare: kit.flare, hw: g.hw, hh: g.hh, ll: g.ll, th: g.th, arm: 4, lw: 2 };
  const closed = kit.closed?.(L) ?? false;
  const hairLong = b.hair === 'long' || b.hair === 'braid' || b.hair === 'wild';
  if (!closed) {
    if (b.hair === 'long') rect(cv, ri(hcx - hr) - 1, ri(yHead + 1), ri(hcx + hr) + 1, ySh + 3 + bob, c.hair, T_HAIR);
    if (b.hair === 'wild') ell(cv, hcx, hy - 0.5, hr + 1.6, g.hh / 2 + 1.1, c.hair, T_HAIR);
  }
  ell(cv, hcx, hy, hr, g.hh / 2, c.skin, T_HEAD, { e: 2.4 });
  rect(cv, ri(hcx) - 1, ri(yHead + g.hh - 1), ri(hcx) + 1, ySh + 1 + bob, c.skin, T_HEAD, { bevel: false }); // neck
  if (!closed) {
    drawFace(cv, b, { bob: 0, mouth: 0, blink: false, gesture: 0, nod: 0 }, d, hcx, hy, yHead, rnd);
    drawHair(cv, b, d, hcx, hy, yHead, c.hair, hairLong);
    drawBeard(cv, b, d, hcx, hy, yHead, c.hair);
    kit.face?.(c);
  }
  kit.headgear(c);

  // ---- the weapon arm, the hand, the shoulders, and the weapon itself
  line(cv, sx1 - 1, ySh + 1.5 + bob, hand[0] - 0.5, hand[1] - 0.5, 2, sleeve, T_LIMB);
  rect(cv, hand[0] - 1, hand[1] - 1, hand[0] + 1, hand[1], sleeve, T_LIMB, { bevel: false });
  rect(cv, hand[0] - 1, hand[1], hand[0] + 1, hand[1] + 1, c.skin, T_LIMB, { bevel: false });
  kit.shoulders?.(c);
  kit.weapon(c);
}

/** A hero down on the ground: stage 0 sinks to the knees, 1 and 2 lie flat (one row lower each), the headgear and weapon fallen beside. */
function drawDown(cv: Cv, L: HeroLook, stage: number): void {
  const kit = KITS[L.cls], pal = L.body.palette;
  if (stage === 0) {
    drawHero(cv, L, { ...REST, ...POSES[L.cls].poses.hurt0, bob: 3, lean: -1, hy: 1, ang: L.cls === 'warrior' ? 90 : -90, hand: [13, 12], rb: 1, lf: 0, lb: 0, shield: [0, 1] }, POSES[L.cls].ground);
    return;
  }
  const y = GY - 1 + (stage === 2 ? 0 : -1);
  const body = M(kit.garment(L));
  // the body, flat: a bar of garment, the boots at one end, the head at the other
  poly(cv, [[CX - 3, y - 3], [CX + 4, y - 3], [CX + 5, y + 0.5], [CX - 4, y + 0.5]], body, T_BODY);
  rect(cv, CX + 4, y - 2, CX + 7, y, M(pal.leather), T_LIMB, { bevel: false });
  ell(cv, CX - 6, y - 1.5, 2.6, 2.4, M(pal.skin), T_HEAD);
  if (L.body.hair !== 'bald') ell(cv, CX - 6.5, y - 2.4, 2.7, 1.6, M(pal.hair), T_HAIR);
  // the headgear, knocked off beside the head
  const fh = kit.fallen(L);
  ell(cv, CX - 11, y - fh.h / 2, fh.w / 2, fh.h / 2, M(fh.col), T_HELD);
  if (fh.spike) line(cv, CX - 11 - fh.w / 2, y - 1, CX - 15 - fh.w / 2, y - 1, 1, M(fh.col), T_HELD);
  // the weapon (or, for the archer, the bow) on the ground
  const base = { ...REST, hand: [14, 14] };
  void base;
  if (L.cls === 'archer') {
    const wood = M(L.pal.wood);
    for (let dx = -5; dx <= 5; dx++) cv.put(CX + 4 + dx + 5, y + 0 - Math.round(2 * (1 - (dx / 5) ** 2)), wood.b, T_HELD);
    for (let dx = -5; dx <= 5; dx++) cv.put(CX + 4 + dx + 5, y, 0xe8e0c8, T_HELD);
  } else if (L.cls === 'rogue') {
    blade(cv, CX + 9, y - 1, 0, weaponDef(L), T_HELD);
    blade(cv, CX + 12, y, 0, weaponDef(L), T_HELD);
  } else blade(cv, CX + 6, y - 0.5, 0, weaponDef(L), T_HELD);
}

type AnimSpec = Record<string, { names: string[]; ms: number[] }>;
const seq = (prefix: string, n: number): string[] => Array.from({ length: n }, (_, k) => prefix + k);

function animsFor(L: HeroLook): AnimSpec {
  const table = POSES[L.cls].poses;
  const count = (prefix: string): number => { let n = 0; while (table[prefix + n]) n++; return n; };
  const castMs: Record<string, number[]> = {
    warrior: [180, 150, 70, 130, 200], mage: [170, 120, 110, 140, 200], cleric: [170, 120, 110, 140, 200], shaman: [170, 120, 110, 140, 200],
    rogue: [130, 60, 90, 160], archer: [200, 200, 220, 70, 200],
  };
  const a: AnimSpec = {
    idle: { names: seq('idle', 4), ms: [333, 333, 333, 333] },
    walk: { names: seq('walk', 4), ms: L.cls === 'rogue' ? [100, 100, 100, 100] : [125, 125, 125, 125] },
    sweep: { names: seq('sw', 5), ms: [30, 30, 30, 30, 30] },
    finisher: { names: seq('fin', 6), ms: [30, 30, 30, 30, 30, 30] },
    recover: { names: seq('rec', 2), ms: [100, 120] },
    cast: { names: seq('cast', count('cast')), ms: castMs[L.cls] },
    hurt: { names: ['hurt0'], ms: [167] },
    down: { names: seq('down', 3), ms: [200, 200, 200] },
  };
  if (table.sh0) a.shoot = { names: seq('sh', count('sh')), ms: [60, 60, 60, 60] };
  return a;
}

/** Composes one hero's sheet. Deterministic; never throws for a valid look. */
export function composeHero(L: HeroLook, min?: { E: number; top: number }): HeroSheet {
  const cv = new Cv();
  const spec = animsFor(L), table = POSES[L.cls];
  const frames: { name: string; anim: string; spr: ReturnType<typeof crop> }[] = [];
  const seen = new Set<string>();
  for (const [anim, a] of Object.entries(spec)) {
    for (const name of a.names) {
      if (!seen.has(name)) {
        seen.add(name);
        cv.clear();
        if (anim === 'down') drawDown(cv, L, Number(name.slice(4)));
        else drawHero(cv, L, table.poses[name] ?? REST, table.ground);
        frames.push({ name, anim, spr: post(crop(cv), LEAD) });
      } else frames.push({ name, anim, spr: frames.find((f) => f.name === name)!.spr });
    }
  }
  // buildSheet lists a frame under the anim it was first given; a pose shared by two anims keeps its first name for both (see anims below)
  const sheet = buildSheet(frames.filter((f, i) => frames.findIndex((q) => q.name === f.name) === i), () => 'a', 64, 64, min);
  // the overhead bar height: the figure bare-handed in its idle pose, plus the outline
  cv.clear();
  drawHero(cv, L, table.poses.idle0, table.ground, true);
  const bare = crop(cv);
  const any = Object.values(sheet.meta.frames)[0];
  const anims: HeroSheet['anims'] = {};
  for (const [anim, a] of Object.entries(spec)) anims[anim] = { frames: a.names, ms: a.ms };
  return { width: sheet.width, height: sheet.height, rgba: sheet.rgba, pivot: [any.w >> 1, any.h - 1], top: bare.gy + 1, frames: sheet.meta.frames, anims };
}
