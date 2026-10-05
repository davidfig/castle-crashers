// Presentation-only effects: particles, corpse decals, shockwave rings, screen shake.
// Fed by the sim's event queue; never feeds back into the sim.
import { EV_STRIDE, Ev, type EventBuf } from '../sim/events';
import { hex } from '../platform/gl/batcher';

/** Blood/gib colors per MobType. */
const KILL_COLORS = [0x6fbf3f, 0xb04a30, 0x8a5fb0, 0x9aa5b1, 0xd8402e];
const MAX_P = 4000;
const MAX_CORPSES = 20000; // corpses stay on the field for the whole run
const MAX_RINGS = 8;
const MAX_BODIES = 700;
const MAX_SLASHES = 8;
export const SLASH_TICKS = 8;

export class Fx {
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

  // corpse decals (ring buffer)
  cx = new Float32Array(MAX_CORPSES);
  cy = new Float32Array(MAX_CORPSES);
  ctype = new Uint8Array(MAX_CORPSES);
  cflip = new Uint8Array(MAX_CORPSES);
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

  trauma = 0;
  /** Camera kick in the swing direction (px), decays quickly. */
  kx = 0;
  ky = 0;
  private seed = 0x1234567;

  private rand(): number {
    let s = this.seed;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this.seed = s >>> 0;
    return (this.seed >>> 0) / 4294967296;
  }

  private spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, col: number, big = 0): void {
    if (this.n >= MAX_P) return;
    const i = this.n++;
    this.x[i] = x; this.y[i] = y; this.z[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.col[i] = col; this.big[i] = big;
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
          if (this.trauma < 0.6) this.trauma = Math.min(0.6, this.trauma + 0.018); // more enemies hit = bigger shake
          this.spawn(x, y, 5, (this.rand() - 0.5) * 2, (this.rand() - 0.5) * 1, 1 + this.rand(), 12, hex(0xfff2a0));
          break;
        case Ev.Kill: {
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
          const blood = KILL_COLORS[a] ?? 0x6fbf3f;
          for (let j = 0; j < 3; j++) this.spawn(x, y, 3, (this.rand() - 0.5) * 3, (this.rand() - 0.5) * 1.5, 1 + this.rand() * 1.5, 18, hex(blood), 1);
          break;
        }
        case Ev.Nova:
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
        case Ev.Arrow:
          for (let j = 0; j < 4; j++) this.spawn(x, y, 6, (this.rand() - 0.5) * 2, (this.rand() - 0.5) * 2, 0.5 + this.rand(), 10, hex(0xe8e0c8));
          break;
        case Ev.Coin:
          this.goldPop = 1;
          for (let j = 0; j < 2; j++) this.spawn(x, y, 5, (this.rand() - 0.5) * 1.2, (this.rand() - 0.5) * 0.6, 0.8 + this.rand(), 12, hex(0xffe27a), 0);
          break;
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
  update(dt: number): void {
    for (let i = 0; i < this.n; ) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const l = --this.n;
        this.x[i] = this.x[l]; this.y[i] = this.y[l]; this.z[i] = this.z[l];
        this.vx[i] = this.vx[l]; this.vy[i] = this.vy[l]; this.vz[i] = this.vz[l];
        this.life[i] = this.life[l]; this.col[i] = this.col[l]; this.big[i] = this.big[l];
        continue;
      }
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.z[i] += this.vz[i] * dt;
      this.vz[i] -= 0.12 * dt;
      if (this.z[i] < 0) { this.z[i] = 0; this.vz[i] *= -0.3; this.vx[i] *= 0.6; this.vy[i] *= 0.6; }
      i++;
    }
    for (let i = 0; i < this.nb; ) {
      this.bage[i] += dt;
      this.bx[i] += this.bvx[i] * dt;
      this.by[i] += this.bvy[i] * dt;
      this.bz[i] += this.bvz[i] * dt;
      this.bvz[i] -= 0.2 * dt;
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
      if (this.rt[i] >= 0) { this.rt[i] += dt; if (this.rt[i] > 18) this.rt[i] = -1; }
    }
    for (let i = 0; i < MAX_SLASHES; i++) {
      if (this.slt[i] >= 0) { this.slt[i] += dt; if (this.slt[i] > SLASH_TICKS + 5) this.slt[i] = -1; }
    }
    this.trauma = Math.max(0, this.trauma - 0.025 * dt);
    const kd = Math.pow(0.78, dt);
    this.kx *= kd;
    this.ky *= kd;
    if (this.streakT > 0) { this.streakT -= dt; if (this.streakT <= 0) this.streak = 0; }
    this.streakPop = Math.max(0, this.streakPop - 0.12 * dt);
    this.goldPop = Math.max(0, this.goldPop - 0.08 * dt);
  }

  shake(): [number, number] {
    const m = this.trauma * this.trauma * 6;
    return [Math.round((this.rand() * 2 - 1) * m + this.kx), Math.round((this.rand() * 2 - 1) * m + this.ky)];
  }
}
