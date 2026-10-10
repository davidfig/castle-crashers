// Presentation-only effects: particles, corpse decals, shockwave rings, screen shake.
// Fed by the sim's event queue; never feeds back into the sim.
import { EV_STRIDE, Ev, type EventBuf } from '../sim/events';
import { hex } from '../platform/gl/batcher';
import { isBossType } from '../data/mobs';
import { bloodColor } from './mobStyle';
import { VIEW_W, WORLD_H } from '../sim/constants';
import { burstTrauma, CONE_TICKS, elementArc, elementBeam, elementBurst, elementCone, ringColor, type Sink } from './elementFx';

const MAX_P = 4000;
const MAX_SPENT = 4000; // spent arrows lie where they fell, like corpses
const MAX_CORPSES = 20000; // corpses stay on the field for the whole run
const MAX_RINGS = 8;
const MAX_BODIES = 700;
const MAX_SLASHES = 8;
const MAX_CONES = 6;
export const SLASH_TICKS = 8;
/** How long (ticks) the mage's ring of fire takes to fly out; the other rings take 18. */
export const FIRE_RING_LIFE = 34;
/** Teleport: the wizard dissolves upward at the origin and re-forms at the destination over this many ticks. */
export const BLINK_TICKS = 16;
const MAX_BLINKS = 4;
const BODY_MARGIN = 10;
/** Boon pictures floating up over a hero when one of their boons fires. */
const MAX_POPS = 12;
export const POP_TICKS = 46;

export class Fx implements Sink {
  /** Crossing into the next field: what lies on the ground (corpses, spent arrows) keeps its place on screen, so the world coordinates move by `dx`. */
  shift(dx: number): void {
    for (let i = 0; i < this.cx.length; i++) this.cx[i] += dx;
    for (let i = 0; i < this.ax.length; i++) this.ax[i] += dx;
  }

  // particles (ground-plane x,y plus height z)
  n = 0;
  x = new Float32Array(MAX_P);
  y = new Float32Array(MAX_P);
  z = new Float32Array(MAX_P);
  vx = new Float32Array(MAX_P);
  vy = new Float32Array(MAX_P);
  vz = new Float32Array(MAX_P);
  life = new Float32Array(MAX_P);
  col = new Uint32Array(MAX_P);
  big = new Uint8Array(MAX_P);
  /** Per particle: gravity (px/tick^2), velocity damping per tick (1 = none) and a turn of its sideways velocity per tick (radians). */
  gr = new Float32Array(MAX_P);
  dr = new Float32Array(MAX_P);
  sp = new Float32Array(MAX_P);

  // spent arrow decals (ring buffer): x, y, direction
  ax = new Float32Array(MAX_SPENT);
  ay = new Float32Array(MAX_SPENT);
  adx = new Float32Array(MAX_SPENT);
  ady = new Float32Array(MAX_SPENT);
  aHead = 0;
  aCount = 0;

  // corpse decals (ring buffer)
  cx = new Float32Array(MAX_CORPSES);
  cy = new Float32Array(MAX_CORPSES);
  ctype = new Uint8Array(MAX_CORPSES);
  cflip = new Uint8Array(MAX_CORPSES);
  crot = new Float32Array(MAX_CORPSES);
  cHead = 0;
  cCount = 0;

  // shockwave rings
  rx = new Float32Array(MAX_RINGS);
  ry = new Float32Array(MAX_RINGS);
  rr = new Float32Array(MAX_RINGS);
  rt = new Float32Array(MAX_RINGS).fill(-1);
  rc = new Uint32Array(MAX_RINGS);
  rbig = new Uint8Array(MAX_RINGS);

  /** Kill streak: kills within a rolling window, for the HUD counter. */
  /** Brief HUD pop when gold is collected. */
  goldPop = 0;
  streak = 0;
  streakT = 0;
  streakPop = 0;

  // launched bodies: killed mobs tumble away from the blow, then land as corpses
  nb = 0;
  bx = new Float32Array(MAX_BODIES);
  by = new Float32Array(MAX_BODIES);
  bz = new Float32Array(MAX_BODIES);
  bvx = new Float32Array(MAX_BODIES);
  bvy = new Float32Array(MAX_BODIES);
  bvz = new Float32Array(MAX_BODIES);
  btype = new Uint8Array(MAX_BODIES);
  bage = new Float32Array(MAX_BODIES);

  // sweeping slash arcs
  slx = new Float32Array(MAX_SLASHES);
  sly = new Float32Array(MAX_SLASHES);
  sla = new Float32Array(MAX_SLASHES); // center angle (radians)
  slh = new Float32Array(MAX_SLASHES); // half arc (radians)
  slr = new Float32Array(MAX_SLASHES); // range
  slt = new Float32Array(MAX_SLASHES).fill(-1);
  slHeavy = new Uint8Array(MAX_SLASHES);
  slDir = new Int8Array(MAX_SLASHES);
  /** Player slot the slash follows (-1 = fixed in the world). */
  slSlot = new Int8Array(MAX_SLASHES).fill(-1);
  private swingFlip = 1;

  // breaths (cones) sweeping across their fans: origin, direction*length, half-arc (turns), element, ticks elapsed (-1 = free), sweep direction
  cnx = new Float32Array(MAX_CONES);
  cny = new Float32Array(MAX_CONES);
  cnax = new Float32Array(MAX_CONES);
  cnay = new Float32Array(MAX_CONES);
  cnarc = new Float32Array(MAX_CONES);
  cnel = new Uint8Array(MAX_CONES);
  cnt = new Float32Array(MAX_CONES).fill(-1);
  cnflip = new Uint8Array(MAX_CONES);

  // teleport blinks: origin ghost dissolving, destination re-forming
  blx0 = new Float32Array(MAX_BLINKS);
  bly0 = new Float32Array(MAX_BLINKS);
  blx1 = new Float32Array(MAX_BLINKS);
  bly1 = new Float32Array(MAX_BLINKS);
  blt = new Float32Array(MAX_BLINKS).fill(-1);
  private blHead = 0;

  // boon pops: the picture of a boon that just fired, rising over its hero
  ppx = new Float32Array(MAX_POPS);
  ppy = new Float32Array(MAX_POPS);
  pslot = new Uint8Array(MAX_POPS);
  pboon = new Uint8Array(MAX_POPS);
  pt = new Float32Array(MAX_POPS).fill(-1);

  trauma = 0;
  /** Camera kick in the swing direction (px), decays quickly. */
  kx = 0;
  ky = 0;
  private seed = 0x1234567;

  rand(): number {
    let s = this.seed;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this.seed = s >>> 0;
    return (this.seed >>> 0) / 4294967296;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, col: number, big = 0, grav = 0.12, drag = 1, spin = 0): void {
    if (this.n >= MAX_P) return;
    const i = this.n++;
    this.x[i] = x; this.y[i] = y; this.z[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.col[i] = col; this.big[i] = big;
    this.gr[i] = grav; this.dr[i] = drag; this.sp[i] = spin;
  }

  /** Drain the sim's event buffer into effects. */
  consume(ev: EventBuf): void {
    const d = ev.data;
    for (let k = 0; k < ev.n; k++) {
      const o = k * EV_STRIDE;
      const t = d[o], x = d[o + 1], y = d[o + 2], a = d[o + 3], b = d[o + 4], c = d[o + 5], f = d[o + 6];
      switch (t) {
        case Ev.Swing:
          this.addSlash(x, y, a, b, c, false, f);
          break;
        case Ev.Hit:
          if (this.trauma < 0.35) this.trauma = Math.min(0.35, this.trauma + 0.01); // more enemies hit = bigger shake
          this.spawn(x, y, 5, (this.rand() - 0.5) * 2, (this.rand() - 0.5) * 1, 1 + this.rand(), 12, hex(0xfff2a0));
          break;
        case Ev.Kill: {
          if (isBossType(a)) {
            // the boss does not tumble away: it goes down where it stands
            this.addCorpse(x, y, a);
            this.trauma = 1;
            break;
          }
          const speed = Math.sqrt(c * c + f * f);
          if (speed > 1.2 && this.nb < MAX_BODIES) {
            const q = this.nb++;
            this.bx[q] = x; this.by[q] = y; this.bz[q] = 1;
            // exaggerate the launch so the blow reads on a 640px-wide screen
            this.bvx[q] = c * 0.4 + (this.rand() - 0.5) * 0.5;
            this.bvy[q] = f * 0.4 + (this.rand() - 0.5) * 0.3;
            this.bvz[q] = 0.9 + Math.min(1.2, speed * 0.12) + this.rand() * 0.5;
            this.btype[q] = a;
            this.bage[q] = 0;
          } else {
            this.addCorpse(x, y, a);
          }
          const blood = bloodColor(a);
          for (let j = 0; j < 3; j++) this.spawn(x, y, 3, (this.rand() - 0.5) * 3, (this.rand() - 0.5) * 1.5, 1 + this.rand() * 1.5, 18, hex(blood), 1);
          break;
        }
        case Ev.Nova:
          if (c) { // the mage's ring of fire (ring styles 4 and 5)
            this.addRing(x, y, a, hex(0xff8a30), 4 + b);
            this.trauma = Math.min(1, this.trauma + 0.55 + b * 0.25);
            for (let j = 0; j < 40; j++) {
              const ang = (j / 40) * Math.PI * 2;
              const sp = 0.8 + this.rand() * 1.2;
              this.spawn(x, y, 1, Math.cos(ang) * sp, Math.sin(ang) * sp, 0.4 + this.rand() * 0.8, 24, hex(this.rand() < 0.5 ? 0xff8a30 : 0xffd35a, 0.9), 1);
            }
            break;
          }
          this.addRing(x, y, a, hex(0xfff4c0), b);
          this.trauma = Math.min(1, this.trauma + 0.55 + b * 0.25);
          for (let j = 0; j < 36; j++) {
            const ang = (j / 36) * Math.PI * 2;
            const sp = 2 + this.rand() * 2.5;
            this.spawn(x, y, 1, Math.cos(ang) * sp, Math.sin(ang) * sp, 0.3 + this.rand() * 0.5, 22, hex(0xffe9a8, 0.9), 1);
          }
          break;
        case Ev.PlayerHurt:
          this.trauma = Math.min(1, this.trauma + 0.25);
          for (let j = 0; j < 6; j++) this.spawn(x, y, 8, (this.rand() - 0.5) * 3, (this.rand() - 0.5) * 2, 1 + this.rand() * 2, 16, hex(0xe03030), 1);
          break;
        case Ev.PlayerDown:
          this.trauma = Math.min(1, this.trauma + 0.4);
          break;
        case Ev.Pulse:
          this.addRing(x, y, a, hex(b ? 0xffffff : 0xfff6d0), b ? 3 : 2);
          this.trauma = Math.min(1, this.trauma + (b ? 0.3 : 0.12));
          for (let j = 0; j < (b ? 22 : 12); j++) {
            const ang = (j / (b ? 22 : 12)) * Math.PI * 2;
            this.spawn(x, y, 1, Math.cos(ang) * 1.6, Math.sin(ang) * 1.6, 0.3, 14, hex(0xffe9a8, 0.9), 1);
          }
          break;
        case Ev.Teleport: {
          const k2 = this.blHead++ % MAX_BLINKS;
          this.blx0[k2] = x; this.bly0[k2] = y; this.blx1[k2] = a; this.bly1[k2] = b; this.blt[k2] = 0;
          this.addRing(x, y, 22, hex(0xb78cff), 0);
          this.addRing(a, b, 30, hex(0xd8c4ff), 0);
          for (let j = 0; j < 10; j++) this.spawn(x + (this.rand() - 0.5) * 8, y, 1 + this.rand() * 10, 0, 0, 0.9 + this.rand() * 0.8, 20, hex(0xd8c4ff, 0.9), 1);
          for (let j = 0; j < 12; j++) {
            const ang = (j / 12) * Math.PI * 2;
            this.spawn(a, b, 8, Math.cos(ang) * 1.8, Math.sin(ang) * 1.0, 0.2, 14, hex(0xb78cff, 0.9), 1);
          }
          for (let j = 0; j < 8; j++) this.spawn(x, y, 1, (this.rand() - 0.5) * 1.2, -this.rand() * 0.8, 0, 22, hex(0xb78cff, 0.9), 1);
          for (let j = 0; j < 8; j++) this.spawn(a, b, 1, (this.rand() - 0.5) * 1.2, -this.rand() * 0.8, 0, 22, hex(0xd8c4ff, 0.9), 1);
          break;
        }
        case Ev.Heal: {
          // A holy halo on the ground, a second green ring racing out behind it, and a fountain of motes and crosses rising from the whole disc.
          this.addRing(x, y, a, hex(0xfff0b0), 2);
          this.addRing(x, y, a * 0.7, hex(0x7dffa0), 0);
          this.trauma = Math.min(1, this.trauma + 0.12);
          for (let j = 0; j < 44; j++) {
            const t = this.rand() * 6.283, r = a * Math.sqrt(this.rand());
            const green = this.rand() < 0.65;
            this.spawn(x + Math.cos(t) * r, y + Math.sin(t) * r * 0.6, 1 + this.rand() * 4, 0, -0.1, 0.7 + this.rand() * 1.1, 30 + this.rand() * 22, hex(green ? 0x7dffa0 : 0xfff6c8, 0.95), this.rand() < 0.3 ? 1 : 0);
          }
          for (let j = 0; j < 16; j++) {
            const t = (j / 16) * 6.283;
            this.spawn(x, y, 2, Math.cos(t) * 3, Math.sin(t) * 1.8, 0.4, 12, hex(0xffffff, 0.9), 1);
          }
          // light column over the caster
          for (let j = 0; j < 14; j++) this.spawn(x + (this.rand() - 0.5) * 6, y, 2 + j * 2, 0, 0, 0.5 + this.rand() * 0.6, 24, hex(0xd8ffe4, 0.85), 1);
          break;
        }
        case Ev.Dash:
          for (let j = 0; j < 4; j++) this.spawn(x, y, 1, -a * (0.5 + this.rand()), -b * (0.5 + this.rand()), 0.4, 14, hex(0xd8d0b0, 0.8), 1);
          break;
        case Ev.Finisher:
          this.addSlash(x, y, a, b, c, true, f);
          this.trauma = Math.min(1, this.trauma + 0.3);
          break;
        case Ev.Wave: {
          // a,b = direction * length: a burst of streaks racing down the line
          const len = Math.sqrt(a * a + b * b) || 1;
          const dx = a / len, dy = b / len;
          for (let j = 0; j < 26; j++) {
            const u = this.rand();
            const lat = (this.rand() - 0.5) * 22;
            this.spawn(x + dx * len * u * 0.3 - dy * lat, y + dy * len * u * 0.3 + dx * lat, 5 + this.rand() * 3, dx * (5 + this.rand() * 4), dy * (5 + this.rand() * 4), 0, 7 + this.rand() * 5, hex(this.rand() < 0.5 ? 0xffffff : 0xffe9a8), 1);
          }
          break;
        }
        case Ev.Quake: {
          // a crack races down the lane throwing up dirt and stones; the screen shakes
          const len = Math.sqrt(a * a + b * b) || 1;
          const dx = a / len, dy = b / len, width = c, big = f === 1;
          this.trauma = Math.min(1, this.trauma + 0.6 + (big ? 0.25 : 0));
          const n = Math.round(len / 3);
          for (let j = 0; j < n; j++) {
            const u = j / n, along = len * u;
            const lat = (this.rand() - 0.5) * width * 1.4;
            const delay = u; // farther debris flies later: it reads as a travelling wave
            this.spawn(x + dx * along - dy * lat, y + dy * along + dx * lat, 0, (this.rand() - 0.5) * 0.8, (this.rand() - 0.5) * 0.4, 1.4 + this.rand() * 1.8, 18 + delay * 12 + this.rand() * 8, hex(this.rand() < 0.5 ? 0x8a6a40 : 0xc8b488), 1);
            if (j % 3 === 0) this.spawn(x + dx * along, y + dy * along, 2, dx * 3, dy * 3, 0.4, 8, hex(0xfff4c0), 1);
          }
          break;
        }
        case Ev.Blast:
          this.addRing(x, y, a, hex(0xffa040), 0);
          this.trauma = Math.min(1, this.trauma + 0.45);
          for (let j = 0; j < 24; j++) {
            const ang = this.rand() * Math.PI * 2;
            const sp = 0.8 + this.rand() * 2.8;
            this.spawn(x, y, 2, Math.cos(ang) * sp, Math.sin(ang) * sp * 0.6, 0.6 + this.rand() * 1.8, 20 + this.rand() * 10, hex(this.rand() < 0.5 ? 0xff8a30 : 0xffd35a), 1);
          }
          break;
        case Ev.Block:
          for (let j = 0; j < 4; j++) this.spawn(x + a * 5, y, 6, a * (0.5 + this.rand()), (this.rand() - 0.5) * 1.5, 0.5 + this.rand(), 10, hex(0xc8d4e0));
          break;
        case Ev.Fire:
          for (let j = 0; j < 3; j++) this.spawn(x + a * 4, y + b * 4, 8, a * 0.6, b * 0.6, 0.2, 8, hex(0xffffff, 0.8));
          break;
        case Ev.ArrowSpent: {
          const slot = this.aCount < MAX_SPENT ? (this.aHead + this.aCount) % MAX_SPENT : this.aHead;
          if (this.aCount < MAX_SPENT) this.aCount++; else this.aHead = (this.aHead + 1) % MAX_SPENT;
          // fall to the ground with a little scatter in the angle
          const ang = Math.atan2(b, a) + (this.rand() - 0.5) * 0.5;
          this.ax[slot] = x; this.ay[slot] = y; this.adx[slot] = Math.cos(ang); this.ady[slot] = Math.sin(ang);
          for (let j = 0; j < 3; j++) this.spawn(x, y, 3, (this.rand() - 0.5) * 1.2, (this.rand() - 0.5) * 0.6, 0.3 + this.rand() * 0.5, 10, hex(0xb8a070, 0.7), 1);
          break;
        }
        case Ev.Arrow:
          for (let j = 0; j < 4; j++) this.spawn(x, y, 6, (this.rand() - 0.5) * 2, (this.rand() - 0.5) * 2, 0.5 + this.rand(), 10, hex(0xe8e0c8));
          break;
        case Ev.Charge:
          this.trauma = Math.min(1, this.trauma + 0.25);
          for (let j = 0; j < 10; j++) this.spawn(x, y, 1, -a * (1 + this.rand() * 2) + (this.rand() - 0.5), -b * (1 + this.rand() * 2) + (this.rand() - 0.5), 0.4 + this.rand() * 0.8, 16, hex(0xb8a070, 0.8), 1);
          break;
        case Ev.Dust:
          for (let j = 0; j < 2; j++) this.spawn(x - a * 3, y - b * 3, 1, -a * 0.6 + (this.rand() - 0.5) * 0.8, -b * 0.6 + (this.rand() - 0.5) * 0.5, 0.3 + this.rand() * 0.5, 14, hex(0xc8b488, 0.75), 1);
          break;
        case Ev.Winded:
          // sweat flying off a hero who has run out of breath
          for (let j = 0; j < 8; j++) this.spawn(x + (this.rand() - 0.5) * 6, y, 10 + this.rand() * 4, (this.rand() - 0.5) * 2, (this.rand() - 0.5) * 0.8, 0.8 + this.rand() * 1.2, 20, hex(0x9ad8ff), 0);
          break;
        case Ev.Slam: {
          const frost = b === 1; // a frost giant's slam throws up ice, not dust
          this.addRing(x, y, a, hex(frost ? 0x3a9af0 : 0xff6a3a), 1);
          this.trauma = Math.min(1, this.trauma + 0.7);
          for (let j = 0; j < (frost ? 56 : 40); j++) {
            const ang = (j / (frost ? 56 : 40)) * Math.PI * 2;
            const sp = 1.5 + this.rand() * 3;
            this.spawn(x, y, 1, Math.cos(ang) * sp, Math.sin(ang) * sp * 0.7, 0.4 + this.rand() * 1.2, 22, hex(frost ? (j & 1 ? 0x7ad0ff : 0x3a9af0) : 0xc8b488, 0.85), 1);
          }
          break;
        }
        case Ev.Burst: {
          if (b >= 32) { // an element burst: 32 + the element id
            const el = b - 32;
            this.addRing(x, y, a, hex(ringColor(el)), 0);
            this.trauma = Math.min(1, this.trauma + burstTrauma(el));
            elementBurst(this, x, y, a, el);
            break;
          }
          // a = radius, b = style: 0 rock, 1 stomp, 2 scream, 3 bones, 4 poison, 5 frost, 6 mire, 7 sand, 8 wisp, 9 hex, 10 flash
          const style = b;
          const ring = style === 5 ? 0x3a9af0 : style === 2 ? 0xc8a8ff : style === 4 ? 0x9ad048 : style === 3 ? 0xefe9da : style === 6 ? 0x7a9a2a : style === 7 ? 0xd8a85a : style === 8 ? 0x40e0c0 : style === 9 ? 0x9a4ad0 : style === 10 ? 0xffe080 : 0xff9a4a;
          this.addRing(x, y, a, hex(ring), style === 1 ? 1 : 0);
          this.trauma = Math.min(1, this.trauma + (style === 1 ? 0.4 : style === 0 ? 0.25 : 0.1));
          const dust = style === 5 ? 0x7ad0ff : style === 2 ? 0xe0d0ff : style === 4 ? 0x9ad048 : style === 3 ? 0xefe9da : style === 6 ? 0x8aa848 : style === 7 ? 0xe0c27a : style === 8 ? 0x9afff0 : style === 9 ? 0xc89af0 : style === 10 ? 0xfff0b0 : 0xc8b488;
          const n = style === 3 ? 10 : style === 5 ? 30 : 22;
          for (let j = 0; j < n; j++) {
            const ang = (j / n) * Math.PI * 2;
            const sp = (style === 3 ? 1.2 : 1.5) + this.rand() * 2;
            this.spawn(x, y, 1, Math.cos(ang) * sp, Math.sin(ang) * sp * 0.7, 0.4 + this.rand() * 1.1, 20, hex(dust, 0.85), 1);
          }
          break;
        }
        case Ev.Summon:
          for (let j = 0; j < 8; j++) this.spawn(x + (this.rand() - 0.5) * 6, y, 1, (this.rand() - 0.5) * 0.8, (this.rand() - 0.5) * 0.4, 0.6 + this.rand() * 1.2, 24, hex(this.rand() < 0.5 ? 0x8cff9c : 0xb890ff, 0.9), 1);
          break;
        case Ev.HealMob:
          this.addRing(x, y, a, hex(0x7dffa0), 0);
          for (let j = 0; j < 16; j++) {
            const t = this.rand() * 6.283, r = a * (0.2 + this.rand() * 0.8);
            this.spawn(x + Math.cos(t) * r, y + Math.sin(t) * r * 0.6, 1, 0, -0.5 - this.rand() * 0.5, 0, 28, hex(0x9affb0, 0.9), 1);
          }
          break;
        case Ev.Rally:
          this.addRing(x, y, a, hex(0xffc060), 0);
          for (let j = 0; j < 14; j++) {
            const t = this.rand() * 6.283, r = a * (0.2 + this.rand() * 0.8);
            this.spawn(x + Math.cos(t) * r, y + Math.sin(t) * r * 0.6, 1, 0, -0.4 - this.rand() * 0.4, 0, 22, hex(0xff8a40, 0.9), 1);
          }
          break;
        case Ev.Blink:
          for (let j = 0; j < 8; j++) this.spawn(x, y, 3, (this.rand() - 0.5) * 1.2, (this.rand() - 0.5) * 0.6, 0.3 + this.rand() * 0.6, 20, hex(0xb78cff, 0.85), 1);
          for (let j = 0; j < 8; j++) this.spawn(a, b, 3, (this.rand() - 0.5) * 1.2, (this.rand() - 0.5) * 0.6, 0.3 + this.rand() * 0.6, 20, hex(0xd8c4ff, 0.9), 1);
          break;
        case Ev.Arc:
          elementArc(this, x, y, a, b, c);
          break;
        case Ev.Cone:
          this.trauma = Math.min(1, this.trauma + 0.2);
          for (let q = 0; q < MAX_CONES; q++) {
            if (this.cnt[q] >= 0) continue;
            this.cnx[q] = x; this.cny[q] = y; this.cnax[q] = a; this.cnay[q] = b; this.cnarc[q] = c; this.cnel[q] = f; this.cnt[q] = 0; this.cnflip[q] = this.rand() < 0.5 ? 1 : 0;
            break;
          }
          break;
        case Ev.Beam: {
          // a,b = direction * length, c = width: a hot line of motes the length of the ray
          const len = Math.sqrt(a * a + b * b) || 1;
          const dx = a / len, dy = b / len;
          this.trauma = Math.min(1, this.trauma + 0.35);
          if (f) { elementBeam(this, x, y, dx, dy, len, c, f); break; }
          for (let d = 4; d < len; d += 3) {
            const lat = (this.rand() - 0.5) * c * 1.4;
            this.spawn(x + dx * d - dy * lat, y + dy * d + dx * lat, 7 + this.rand() * 2, 0, 0, 0, 9 + this.rand() * 5, hex(this.rand() < 0.4 ? 0xffffff : 0xc070ff), 1);
          }
          break;
        }
        case Ev.Roar:
          this.addRing(x, y, 90, hex(0xffe27a), 1);
          this.trauma = Math.min(1, this.trauma + 0.45);
          for (let j = 0; j < 20; j++) this.spawn(x + (this.rand() - 0.5) * 30, y, 6 + this.rand() * 20, (this.rand() - 0.5) * 3, (this.rand() - 0.5) * 1.5, 0.5 + this.rand(), 26, hex(0xffe27a), 1);
          break;
        case Ev.BossDown:
          this.trauma = 1;
          this.addRing(x, y, 140, hex(0xffffff), 1);
          for (let j = 0; j < 90; j++) {
            const ang = this.rand() * Math.PI * 2;
            const sp = 1 + this.rand() * 4.5;
            this.spawn(x + (this.rand() - 0.5) * 30, y, 4 + this.rand() * 30, Math.cos(ang) * sp, Math.sin(ang) * sp * 0.6, 0.5 + this.rand() * 2.5, 36 + this.rand() * 20, hex(this.rand() < 0.5 ? 0xff8a30 : 0xffd35a), 1);
          }
          break;
        case Ev.Coin:
          this.goldPop = 1;
          for (let j = 0; j < 2; j++) this.spawn(x, y, 5, (this.rand() - 0.5) * 1.2, (this.rand() - 0.5) * 0.6, 0.8 + this.rand(), 12, hex(0xffe27a), 0);
          break;
        case Ev.Potion:
          for (let j = 0; j < 14; j++) this.spawn(x + (this.rand() - 0.5) * 8, y, 2 + this.rand() * 8, (this.rand() - 0.5) * 0.8, -0.1, 0.6 + this.rand() * 0.9, 26 + this.rand() * 14, hex(this.rand() < 0.7 ? (b === 1 ? 0xffe84a : 0x7dffa0) : 0xfff6c8, 0.95), this.rand() < 0.3 ? 1 : 0);
          this.addRing(x, y, 14, hex(b === 1 ? 0xffe84a : 0x7dffa0), 0);
          break;
        case Ev.Proc: {
          // a = slot, b = upgrade index. The same boon firing again within a moment just refreshes its pop, so a chain reaction is one picture.
          let free = -1, same = -1;
          for (let q = 0; q < MAX_POPS; q++) {
            if (this.pt[q] < 0) { if (free < 0) free = q; } else if (this.pslot[q] === a && this.pboon[q] === b) same = q;
          }
          const q = same >= 0 ? (this.pt[same] < 14 ? -2 : same) : free;
          if (q === -2 || q < 0) break;
          this.ppx[q] = x; this.ppy[q] = y; this.pslot[q] = a; this.pboon[q] = b; this.pt[q] = 0;
          for (let j = 0; j < 8; j++) this.spawn(x, y, 22, (this.rand() - 0.5) * 1.4, (this.rand() - 0.5) * 0.6, 0.4 + this.rand() * 0.7, 20 + this.rand() * 10, hex(this.rand() < 0.5 ? 0xffe9a8 : 0xffffff, 0.95), 0);
          break;
        }
        case Ev.Reroll: // a fresh deal (b = 0) or a boon banished for good (b = 1)
          this.addRing(x, y - 14, 18, hex(b === 1 ? 0xe0442e : 0xc9a4ff), 0);
          for (let j = 0; j < 10; j++) this.spawn(x, y, 14, (this.rand() - 0.5) * 2, -this.rand() * 1.2, 0.4 + this.rand() * 0.6, 22, hex(b === 1 ? 0xe0442e : 0xffe9a8, 0.95), 0);
          break;
        case Ev.Site: {
          // a = what (SiteEv), b = kind. Open/Done: gold and light; Start: a big coloured ring; Deny: a small red puff; Spawn: a thud of dust
          const col = a === 3 ? 0xe0503a : a === 1 ? [0xe0442e, 0x4aa0ff, 0xffc02a, 0xe8ecff][b] ?? 0xffffff : 0xffd35a;
          this.addRing(x, y, a === 1 ? 70 : a === 3 ? 12 : 36, hex(col), a === 1 ? 1 : 0);
          if (a === 0 || a === 2) { this.goldPop = 1; for (let j = 0; j < 22; j++) this.spawn(x + (this.rand() - 0.5) * 10, y, 4 + this.rand() * 10, (this.rand() - 0.5) * 2.4, (this.rand() - 0.5) * 1.2, 0.8 + this.rand() * 2, 26 + this.rand() * 14, hex(this.rand() < 0.6 ? 0xffd35a : 0xffffff, 0.95), 1); }
          if (a === 1) this.trauma = Math.max(this.trauma, 0.5);
          break;
        }
        case Ev.Quest: {
          // a = what (QuestEv), b = detail. Done: gold and light; Fail: a grey-red puff; Hurt: red sparks; Swing: a glint; Free: a ring; Spawn: a thud
          if (a === 1) { this.goldPop = 1; this.addRing(x, y, 44, hex(0x7dff9a), 1); for (let j = 0; j < 26; j++) this.spawn(x + (this.rand() - 0.5) * 12, y, 4 + this.rand() * 12, (this.rand() - 0.5) * 2.6, (this.rand() - 0.5) * 1.3, 0.8 + this.rand() * 2, 28 + this.rand() * 16, hex(this.rand() < 0.5 ? 0xffd35a : this.rand() < 0.5 ? 0x7dff9a : 0xffffff, 0.95), 1); }
          else if (a === 2) { this.addRing(x, y, 22, hex(0xe0503a), 0); for (let j = 0; j < 10; j++) this.spawn(x + (this.rand() - 0.5) * 8, y, 2 + this.rand() * 8, (this.rand() - 0.5) * 1.4, (this.rand() - 0.5) * 0.8, 0.4 + this.rand(), 24, hex(this.rand() < 0.5 ? 0x8a8f99 : 0xe0503a, 0.9), 0); }
          else if (a === 4) { for (let j = 0; j < 6; j++) this.spawn(x, y, 8 + this.rand() * 8, (this.rand() - 0.5) * 2, (this.rand() - 0.5) * 0.9, 0.5 + this.rand(), 16, hex(0xe0503a, 0.95), 0); }
          else if (a === 3) { for (let j = 0; j < 3; j++) this.spawn(x + b * 8, y, 8 + this.rand() * 6, b * (0.6 + this.rand()), (this.rand() - 0.5) * 0.5, 0.3 + this.rand() * 0.5, 10, hex(0xffffff, 0.9), 0); }
          else if (a === 5) { this.addRing(x, y, 30, hex(0xffd35a), 0); this.goldPop = 1; }
          else if (a === 6) this.trauma = Math.max(this.trauma, 0.3);
          break;
        }
        case Ev.Revive:
          for (let j = 0; j < 12; j++) this.spawn(x, y, 2, (this.rand() - 0.5) * 2, (this.rand() - 0.5) * 1, 1 + this.rand() * 2, 30, hex(0x7dff9a), 1);
          break;
      }
    }
    ev.n = 0;
  }

  private addCorpse(x: number, y: number, type: number): void {
    const i = (this.cHead + this.cCount) % MAX_CORPSES;
    const slot = this.cCount < MAX_CORPSES ? i : this.cHead;
    if (this.cCount < MAX_CORPSES) this.cCount++; else this.cHead = (this.cHead + 1) % MAX_CORPSES;
    this.cx[slot] = x; this.cy[slot] = y; this.ctype[slot] = type; this.cflip[slot] = this.rand() < 0.5 ? 1 : 0;
    this.crot[slot] = (this.rand() - 0.5) * 0.7; // +-20 degrees so a pile of corpses doesn't look stamped
  }

  private addSlash(x: number, y: number, a: number, b: number, dot: number, heavy: boolean, slot: number): void {
    const len = Math.sqrt(a * a + b * b) || 1;
    const kick = heavy ? 4.5 : 2;
    this.kx = (a / len) * kick;
    this.ky = (b / len) * kick * 0.6;
    for (let i = 0; i < MAX_SLASHES; i++) {
      if (this.slt[i] >= 0) continue;
      const range = Math.sqrt(a * a + b * b) || 1;
      this.slx[i] = x; this.sly[i] = y;
      this.sla[i] = Math.atan2(b, a);
      this.slh[i] = Math.acos(Math.max(-1, Math.min(1, dot)));
      this.slr[i] = range;
      this.slSlot[i] = slot;
      this.slt[i] = 0;
      this.slHeavy[i] = heavy ? 1 : 0;
      this.swingFlip = -this.swingFlip;
      this.slDir[i] = heavy ? 1 : this.swingFlip;
      return;
    }
  }

  private addRing(x: number, y: number, r: number, col: number, big: number): void {
    for (let i = 0; i < MAX_RINGS; i++) {
      if (this.rt[i] < 0) { this.rx[i] = x; this.ry[i] = y; this.rr[i] = r; this.rt[i] = 0; this.rc[i] = col; this.rbig[i] = big; return; }
    }
  }

  /** Advance by dt ticks (frame time * 60). */
  /** The camera's left edge, set each frame: a killed mob's tumble is kept inside the screen. */
  camX = 0;

  update(dt: number): void {
    for (let i = 0; i < this.n; ) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const l = --this.n;
        this.x[i] = this.x[l]; this.y[i] = this.y[l]; this.z[i] = this.z[l];
        this.vx[i] = this.vx[l]; this.vy[i] = this.vy[l]; this.vz[i] = this.vz[l];
        this.life[i] = this.life[l]; this.col[i] = this.col[l]; this.big[i] = this.big[l];
        this.gr[i] = this.gr[l]; this.dr[i] = this.dr[l]; this.sp[i] = this.sp[l];
        continue;
      }
      if (this.sp[i] !== 0) { const t = this.sp[i] * dt, c = Math.cos(t), sn = Math.sin(t), vx = this.vx[i]; this.vx[i] = vx * c - this.vy[i] * sn; this.vy[i] = vx * sn + this.vy[i] * c; }
      if (this.dr[i] !== 1) { const k = Math.pow(this.dr[i], dt); this.vx[i] *= k; this.vy[i] *= k; }
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.z[i] += this.vz[i] * dt;
      this.vz[i] -= this.gr[i] * dt;
      if (this.z[i] < 0) { this.z[i] = 0; this.vz[i] *= -0.3; this.vx[i] *= 0.6; this.vy[i] *= 0.6; }
      i++;
    }
    for (let i = 0; i < this.nb; ) {
      this.bage[i] += dt;
      this.bx[i] += this.bvx[i] * dt;
      this.by[i] += this.bvy[i] * dt;
      this.bz[i] += this.bvz[i] * dt;
      this.bvz[i] -= 0.2 * dt;
      // a body never leaves the play area: it hits the edge and drops there
      const lo = this.camX + BODY_MARGIN, hi = this.camX + VIEW_W - BODY_MARGIN;
      if (this.bx[i] < lo) { this.bx[i] = lo; this.bvx[i] = 0; } else if (this.bx[i] > hi) { this.bx[i] = hi; this.bvx[i] = 0; }
      if (this.by[i] < BODY_MARGIN) { this.by[i] = BODY_MARGIN; this.bvy[i] = 0; } else if (this.by[i] > WORLD_H - BODY_MARGIN) { this.by[i] = WORLD_H - BODY_MARGIN; this.bvy[i] = 0; }
      const drag = Math.pow(0.96, dt);
      this.bvx[i] *= drag;
      this.bvy[i] *= drag;
      if (this.bz[i] <= 0) {
        this.addCorpse(this.bx[i], this.by[i], this.btype[i]);
        for (let j = 0; j < 2; j++) this.spawn(this.bx[i], this.by[i], 1, (this.rand() - 0.5) * 1.2, (this.rand() - 0.5) * 0.6, 0.3, 10, hex(0xcfc9a0, 0.7));
        const l = --this.nb;
        this.bx[i] = this.bx[l]; this.by[i] = this.by[l]; this.bz[i] = this.bz[l];
        this.bvx[i] = this.bvx[l]; this.bvy[i] = this.bvy[l]; this.bvz[i] = this.bvz[l];
        this.btype[i] = this.btype[l]; this.bage[i] = this.bage[l];
        continue;
      }
      i++;
    }
    for (let i = 0; i < MAX_RINGS; i++) {
      if (this.rt[i] >= 0) { this.rt[i] += dt; if (this.rt[i] > (this.rbig[i] >= 4 ? FIRE_RING_LIFE : 18)) this.rt[i] = -1; }
    }
    for (let i = 0; i < MAX_POPS; i++) {
      if (this.pt[i] >= 0) { this.pt[i] += dt; if (this.pt[i] > POP_TICKS) this.pt[i] = -1; }
    }
    for (let i = 0; i < MAX_CONES; i++) {
      if (this.cnt[i] < 0) continue;
      const t0 = this.cnt[i];
      this.cnt[i] += dt;
      elementCone(this, this.cnx[i], this.cny[i], this.cnax[i], this.cnay[i], this.cnarc[i], this.cnel[i], t0 / CONE_TICKS, Math.min(1, this.cnt[i] / CONE_TICKS), this.cnflip[i] === 1);
      if (this.cnt[i] >= CONE_TICKS) this.cnt[i] = -1;
    }
    for (let i = 0; i < MAX_BLINKS; i++) {
      if (this.blt[i] >= 0) { this.blt[i] += dt; if (this.blt[i] > BLINK_TICKS) this.blt[i] = -1; }
    }
    for (let i = 0; i < MAX_SLASHES; i++) {
      if (this.slt[i] >= 0) { this.slt[i] += dt; if (this.slt[i] > SLASH_TICKS + 5) this.slt[i] = -1; }
    }
    this.trauma = Math.max(0, this.trauma - 0.04 * dt);
    const kd = Math.pow(0.78, dt);
    this.kx *= kd;
    this.ky *= kd;
    if (this.streakT > 0) { this.streakT -= dt; if (this.streakT <= 0) this.streak = 0; }
    this.streakPop = Math.max(0, this.streakPop - 0.12 * dt);
    this.goldPop = Math.max(0, this.goldPop - 0.08 * dt);
  }

  shake(): [number, number] {
    const m = this.trauma * this.trauma * 2.5;
    return [Math.round((this.rand() * 2 - 1) * m + this.kx), Math.round((this.rand() * 2 - 1) * m + this.ky)];
  }
}
