// Draws a GameState into the low-res framebuffer. Reads state only; never mutates the sim.
import { CLASSES } from '../data/classes';
import { lerp } from '../engine/math';
import type { Batcher } from '../platform/gl/batcher';
import { hex, rgba } from '../platform/gl/batcher';
import { VIEW_H, VIEW_W, WORLD_H, WORLD_W } from '../sim/constants';
import { Kind } from '../sim/entities';
import { Phase, type GameState } from '../sim/state';
import { BLAST_RADIUS, Behavior, MOBS, MobType } from '../data/mobs';
import { PLAYER_COLORS, type Sprites } from './art';
import { SLASH_TICKS, type Fx } from './fx';
import { heroFrame } from './hero';
import { mobPose } from './mobArt';
import type { FrameStats } from '../platform/perf';

/** Screen y of world y=0 and of the horizon. */
const FIELD_Y0 = 134;
const GROUND_TOP = 112;
const SKY = [0x4a7fb5, 0x5a8fc2, 0x6c9fcc, 0x82b2d6, 0x9cc5df, 0xb4d6e8, 0xc9e3ee];

const SHADOW_FOR = [0, 2, 0, 1, 0];
const order = new Int32Array(4096);
const sortedBuf = new Int32Array(4096);
const bucket = new Int32Array(WORLD_H + 3);

export interface DebugInfo {
  stats: FrameStats;
  simLag: boolean;
  drawCalls: number;
  sprites: number;
}

export function drawText(b: Batcher, S: Sprites, text: string, x: number, y: number, color: number, scale = 1, shadow = true): number {
  const str = text.toUpperCase();
  const sc = hex(0x000000, 0.7);
  for (let pass = shadow ? 0 : 1; pass < 2; pass++) {
    let cx = x;
    for (let i = 0; i < str.length; i++) {
      const g = S.glyph[str[i]];
      if (g) {
        if (pass === 0) b.drawScaled(g, cx + scale, y + scale, g.w * scale, g.h * scale, sc);
        else b.drawScaled(g, cx, y, g.w * scale, g.h * scale, color);
      }
      cx += 4 * scale;
    }
  }
  return text.length * 4 * scale;
}

function bar(b: Batcher, S: Sprites, x: number, y: number, w: number, h: number, frac: number, fill: number, back = 0x201818): void {
  b.drawScaled(S.px, x - 1, y - 1, w + 2, h + 2, hex(0x000000, 0.8));
  b.drawScaled(S.px, x, y, w, h, hex(back));
  const fw = Math.max(0, Math.round(w * Math.min(1, frac)));
  if (fw > 0) b.drawScaled(S.px, x, y, fw, h, hex(fill));
}

export function drawFrame(b: Batcher, S: Sprites, s: GameState, fx: Fx, camXf: number, alpha: number, dbg: DebugInfo): void {
  const [shx, shy] = fx.shake();
  const camX = Math.floor(camXf) + shx;
  const oy = shy;
  const e = s.ents;

  // --- sky + parallax mountains
  const bandH = Math.ceil(GROUND_TOP / SKY.length);
  for (let i = 0; i < SKY.length; i++) b.drawScaled(S.px, 0, i * bandH, VIEW_W, bandH + 1, hex(SKY[i]));
  for (const [f, k] of [[S.mountFar, 0.12], [S.mountNear, 0.3]] as const) {
    const off = Math.floor(camXf * k);
    const start = -(((off % 256) + 256) % 256);
    for (let x = start; x < VIEW_W; x += 256) b.draw(f, x, GROUND_TOP - f.h + oy);
  }

  // --- ground
  const tx0 = Math.floor(camX / 16), tx1 = Math.floor((camX + VIEW_W) / 16);
  const rows = Math.ceil((VIEW_H - GROUND_TOP) / 16);
  for (let ty = 0; ty < rows; ty++) {
    const v = 0.86 + (ty / rows) * 0.14;
    const tint = rgba(Math.round(255 * v), Math.round(255 * v), Math.round(255 * (v + 0.02)));
    for (let tx = tx0; tx <= tx1; tx++) {
      const h = Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663);
      b.draw(S.ground[(h >>> 8) & 3], tx * 16 - camX, GROUND_TOP + ty * 16 + oy, false, tint);
    }
  }
  // start / goal markers
  b.drawScaled(S.px, 40 - camX, FIELD_Y0 + oy - 6, 2, WORLD_H + 12, hex(0xf0e6b0, 0.35));
  b.drawScaled(S.px, WORLD_W - 70 - camX, FIELD_Y0 + oy - 6, 3, WORLD_H + 12, hex(0xffd35a, 0.7));

  // --- corpses
  const cTint = hex(0xffffff, 0.92);
  for (let k = 0; k < fx.cCount; k++) {
    const i = (fx.cHead + k) % fx.cx.length;
    const sx = fx.cx[i] - camX;
    if (sx < -12 || sx > VIEW_W + 12) continue;
    const f = S.corpse[fx.ctype[i]];
    b.draw(f, sx - f.w / 2, FIELD_Y0 + fx.cy[i] - f.h + oy, fx.cflip[i] === 1, cTint);
  }

  // --- visible entities, bucket-sorted by depth
  bucket.fill(0);
  let n = 0;
  for (let i = 0; i < e.highWater; i++) {
    if (!e.alive[i]) continue;
    const ix = lerp(e.px[i], e.x[i], alpha);
    const sx = ix - camX;
    if (sx < -20 || sx > VIEW_W + 20) continue;
    if (e.kind[i] === Kind.Coin) continue; // coins are drawn in their own pass
    const yb = Math.min(WORLD_H, Math.max(0, Math.floor(e.y[i]))) + 1;
    bucket[yb]++;
    order[n++] = i;
  }
  for (let k = 1; k < bucket.length; k++) bucket[k] += bucket[k - 1];
  const sorted = sortedBuf;
  for (let k = 0; k < n; k++) {
    const i = order[k];
    const yb = Math.min(WORLD_H, Math.max(0, Math.floor(e.y[i])));
    sorted[bucket[yb]++] = i;
  }

  // --- coins: spinning gold that arcs out of kills, blinking before it expires
  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Coin) continue;
    const sx = lerp(e.px[i], e.x[i], alpha) - camX;
    if (sx < -8 || sx > VIEW_W + 8) continue;
    const big = e.sub[i] >= 3 ? 1 : 0;
    const spin = ((s.tick >> 3) + i) & 3; // face, face, edge, edge... a cheap spin
    const f = S.coin[big][spin === 2 ? 1 : 0];
    const sy = FIELD_Y0 + lerp(e.py[i], e.y[i], alpha) + oy;
    const z = e.z[i];
    b.drawScaled(S.px, sx - 1, sy - 0.5, 3, 1, hex(0x000000, 0.3));
    // Twinkle: each coin glints on its own cycle so loot stands out from corpses.
    const ph = (s.tick + i * 11) % 36;
    const peak = ph >= 3 && ph <= 6;
    b.draw(f, sx - f.w / 2, sy - z - f.h, false, 0xffffffff, peak ? 0.55 : 0);
    if (ph < 10) {
      const gx = sx + (big ? 2 : 1), gy = sy - z - f.h - 1;
      if (peak) {
        // four-point star
        const arm = ph === 4 || ph === 5 ? 3 : 2;
        b.drawScaled(S.px, gx - arm, gy, arm * 2 + 1, 1, hex(0xffffff, 0.95));
        b.drawScaled(S.px, gx, gy - arm, 1, arm * 2 + 1, hex(0xffffff, 0.95));
      } else {
        b.drawScaled(S.px, gx, gy, 1, 1, hex(0xfff6b0, 0.9));
      }
    }
  }

  const shadowTint = hex(0x000000, 0.32);
  for (let k = 0; k < n; k++) {
    const i = sorted[k];
    const sx = lerp(e.px[i], e.x[i], alpha) - camX;
    const sy = FIELD_Y0 + lerp(e.py[i], e.y[i], alpha) + oy;
    if (e.kind[i] === Kind.Proj) continue;
    let sh = S.shadow[1];
    let tint = shadowTint;
    if (e.kind[i] === Kind.Mob) sh = S.shadow[SHADOW_FOR[e.sub[i]]];
    else tint = hex(PLAYER_COLORS[e.sub[i]], 0.55);
    b.draw(sh, sx - sh.w / 2, sy - sh.h / 2 - 1, false, tint);
  }

  for (let k = 0; k < n; k++) {
    const i = sorted[k];
    const sx = lerp(e.px[i], e.x[i], alpha) - camX;
    const sy = FIELD_Y0 + lerp(e.py[i], e.y[i], alpha) + oy;
    const flip = e.face[i] < 0;
    let flash = e.hurt[i] > 0 ? 0.85 : 0;
    if (e.kind[i] === Kind.Proj) {
      // arrow: bright head, dim tail, flying a little above the ground
      const vl = Math.sqrt(e.vx[i] * e.vx[i] + e.vy[i] * e.vy[i]) || 1;
      const dx = e.vx[i] / vl, dy = e.vy[i] / vl;
      b.drawScaled(S.px, sx - dx * 5, sy - 7 - dy * 5, 2, 2, hex(0x8b5a2b));
      b.drawScaled(S.px, sx - dx * 2.5, sy - 7 - dy * 2.5, 2, 2, hex(0xd9c9a0));
      b.drawScaled(S.px, sx, sy - 7, 2, 2, hex(0xffffff));
      continue;
    }
    if (e.kind[i] === Kind.Mob) {
      drawMob(b, S, e, i, s.tick, sx, sy, flip, flash);
    } else {
      const slot = e.sub[i];
      const p = s.players[slot];
      // Hero art comes from the art workbench (hero.ts). Frames are cells with the feet-centre at (pivotX, pivotY),
      // so mirror the pivot column when facing left.
      const H = S.hero;
      const place = (f: { w: number }) => sx - (flip ? f.w - 1 - H.pivotX : H.pivotX);
      if (p.downed) {
        const df = heroFrame(H, s, fx, slot, false);
        b.draw(df, place(df), sy - H.pivotY, flip, 0xffffffff);
        drawText(b, S, String(Math.ceil(p.downTimer / 60)), sx - 2, sy - 22, 0xffffffff);
        continue;
      }
      const moving = Math.abs(e.x[i] - e.px[i]) + Math.abs(e.y[i] - e.py[i]) > 0.05;
      const f = heroFrame(H, s, fx, slot, moving);
      const blink = p.invuln > 0 && (s.tick & 2) !== 0;
      b.draw(f, place(f), sy - H.pivotY, flip, blink ? hex(0xffffff, 0.5) : 0xffffffff, flash);
      // overhead hp + ability pips
      const cls = CLASSES[p.classId];
      bar(b, S, Math.round(sx - 8), Math.round(sy - H.top - 6), 16, 2, e.hp[i] / cls.hp, 0x4fd05a);
      const fy = Math.round(sy - H.top - 3);
      const fx0 = Math.round(sx - 8);
      const full = p.fury >= cls.furyMax;
      const canNova = p.fury >= cls.novaCost;
      b.drawScaled(S.px, fx0, fy, Math.round(16 * p.fury / cls.furyMax), 2, hex(full ? ((s.tick >> 2) & 1 ? 0xffffff : 0xffd35a) : canNova ? 0xffc23a : 0xa07a30));
      b.drawScaled(S.px, fx0 + 8, fy, 1, 2, hex(0x000000, 0.7)); // nova cost notch
    }
  }

  // --- shockwave rings
  for (let r = 0; r < fx.rr.length; r++) {
    if (fx.rt[r] < 0) continue;
    const t = fx.rt[r] / 18;
    const radius = fx.rr[r] * (1 - (1 - t) * (1 - t));
    const dots = Math.min(160, Math.ceil(radius * 1.6));
    const base = fx.rc[r];
    const col = ((base & 0x00ffffff) | (Math.round(255 * (1 - t)) << 24)) >>> 0;
    const thick = fx.rbig[r] ? 3 : 2;
    for (let d = 0; d < dots; d++) {
      const ang = (d / dots) * Math.PI * 2;
      b.drawScaled(S.px, fx.rx[r] + Math.cos(ang) * radius - camX, FIELD_Y0 + fx.ry[r] + Math.sin(ang) * radius + oy, thick, thick, col);
    }
    if (fx.rbig[r]) {
      const r2 = radius * 0.85;
      for (let d = 0; d < dots; d++) {
        const ang = (d / dots) * Math.PI * 2;
        b.drawScaled(S.px, fx.rx[r] + Math.cos(ang) * r2 - camX, FIELD_Y0 + fx.ry[r] + Math.sin(ang) * r2 + oy, 2, 2, hex(0xffd35a, (1 - t) * 0.8));
      }
    }
  }

  // --- launched bodies: tumbling mobs knocked out of the pack
  for (let i = 0; i < fx.nb; i++) {
    const sx = fx.bx[i] - camX;
    if (sx < -16 || sx > VIEW_W + 16) continue;
    const f = S.mob[fx.btype[i]][0];
    const spin = (Math.floor(fx.bage[i] / 3) & 1) === 1;
    const flash = fx.bage[i] < 4 ? 0.9 : 0;
    b.draw(f, sx - f.w / 2, FIELD_Y0 + fx.by[i] - fx.bz[i] - f.h + oy, spin, 0xffffffff, flash);
  }

  // --- slash arcs: a bold arc with a bright leading edge sweeping through the swing
  for (let k = 0; k < fx.slt.length; k++) {
    if (fx.slt[k] < 0) continue;
    const prog = Math.min(1, fx.slt[k] / SLASH_TICKS);
    const fade = 1 - Math.max(0, (fx.slt[k] - SLASH_TICKS) / 5);
    const h = fx.slh[k], dir = fx.slDir[k], heavy = fx.slHeavy[k] === 1;
    const head = -h + 2 * h * prog;
    const trail = Math.min(2 * h, heavy ? 3.2 : 2.4);
    const steps = Math.max(10, Math.ceil(fx.slr[k] * trail / 1.6));
    const thick = heavy ? 4 : 3;
    // follow the hero as they move (lunge, walking) instead of staying where the swing began
    let ox = fx.slx[k], oyw = fx.sly[k];
    const slot = fx.slSlot[k];
    if (slot >= 0 && s.players[slot].active) {
      const pe = s.players[slot].ent;
      ox = lerp(e.px[pe], e.x[pe], alpha);
      oyw = lerp(e.py[pe], e.y[pe], alpha);
    }
    const cx = ox - camX, cy = FIELD_Y0 + oyw - 6 + oy;
    for (let q = 0; q <= steps; q++) {
      const u = q / steps; // 0 = tail, 1 = head
      const rel = head - trail * (1 - u);
      if (rel < -h) continue;
      const ang = fx.sla[k] + rel * dir;
      const rad = fx.slr[k] * (0.78 + 0.22 * u);
      const alpha = Math.min(1, 0.25 + u * 1.2) * fade;
      const col = hex(heavy ? (u > 0.75 ? 0xffffff : 0xffd35a) : (u > 0.8 ? 0xffffff : 0xcfe0f0), alpha);
      b.drawScaled(S.px, cx + Math.cos(ang) * rad - 1, cy + Math.sin(ang) * rad * 0.8 - 1, thick, thick, col);
      if (heavy && (q & 1)) b.drawScaled(S.px, cx + Math.cos(ang) * rad * 0.62, cy + Math.sin(ang) * rad * 0.62 * 0.8, 2, 2, hex(0xff9a3a, alpha * 0.9));
    }
    // leading edge: a bright blade line from the hero out to the arc
    const ha = fx.sla[k] + head * dir;
    const blade = Math.ceil(fx.slr[k] / 2.5);
    for (let q = 2; q <= blade; q++) {
      const rr = (q / blade) * fx.slr[k];
      b.drawScaled(S.px, cx + Math.cos(ha) * rr - 1, cy + Math.sin(ha) * rr * 0.8 - 1, 2, 2, hex(0xffffff, (0.35 + 0.65 * q / blade) * fade));
    }
  }

  // --- particles
  for (let i = 0; i < fx.n; i++) {
    const sx = fx.x[i] - camX;
    if (sx < -4 || sx > VIEW_W + 4) continue;
    const a = Math.min(1, fx.life[i] / 6);
    const c = a < 1 ? (fx.col[i] & 0x00ffffff) | (Math.round(((fx.col[i] >>> 24) & 255) * a) << 24) : fx.col[i];
    const sz = fx.big[i] ? 2 : 1;
    b.drawScaled(S.px, sx, FIELD_Y0 + fx.y[i] - fx.z[i] + oy, sz, sz, c >>> 0);
  }

  drawHud(b, S, s, fx, dbg);
}

function drawHud(b: Batcher, S: Sprites, s: GameState, fx: Fx, dbg: DebugInfo): void {
  const e = s.ents;
  // progress bar: where the party is on the way to the far end
  const bw = 200, bx = (VIEW_W - bw) / 2;
  b.drawScaled(S.px, bx - 1, 5, bw + 2, 5, hex(0x000000, 0.7));
  b.drawScaled(S.px, bx, 6, bw, 3, hex(0x2a3340));
  for (const p of s.players) {
    if (!p.active) continue;
    const t = Math.min(1, Math.max(0, e.x[p.ent] / WORLD_W));
    b.drawScaled(S.px, bx + Math.round(t * (bw - 2)), 4, 2, 7, hex(PLAYER_COLORS[e.sub[p.ent]]));
  }
  drawText(b, S, 'GOAL', bx + bw + 6, 5, hex(0xffd35a));

  // party strip
  let row = 0;
  for (const p of s.players) {
    if (!p.active) continue;
    const slot = e.sub[p.ent];
    const y = 6 + row * 11;
    drawText(b, S, `P${slot + 1}`, 6, y, hex(PLAYER_COLORS[slot]));
    bar(b, S, 22, y + 1, 40, 3, e.hp[p.ent] / CLASSES[p.classId].hp, 0x4fd05a);
    drawText(b, S, String(p.kills), 68, y, 0xffffffff);
    const cls = CLASSES[p.classId];
    b.drawScaled(S.px, 22, y + 5, Math.round(40 * p.fury / cls.furyMax), 1, hex(p.fury >= cls.novaCost ? 0xffc23a : 0xa07a30));
    row++;
  }

  if (fx.streak >= 5) {
    const sc = fx.streak >= 25 ? 3 : 2;
    const txt = `${fx.streak} KILLS`;
    const pop = fx.streakPop > 0.3 ? 1 : 0;
    const fade = Math.min(1, fx.streakT / 40);
    drawText(b, S, txt, Math.round(VIEW_W / 2 - txt.length * 2 * sc), 16 - pop, hex(fx.streak >= 25 ? 0xffd35a : 0xffffff, fade), sc);
  }

  const popY = fx.goldPop > 0.3 ? -1 : 0;
  b.draw(S.coin[0][0], 6, 8 + row * 11 + 1 + popY);
  drawText(b, S, String(s.gold), 13, 8 + row * 11 + popY, hex(fx.goldPop > 0.3 ? 0xffffff : 0xffd84a));

  let mobs = 0;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob) mobs++;
  const st = dbg.stats;
  const good = hex(0xcfd8e0), bad = hex(0xff6a5a), warn = hex(0xffd35a);
  const lines: [string, number][] = [
    [`FPS ${st.fps}`, st.fps < 55 ? bad : good],
    [`DROPS ${st.drops} /10S`, st.drops > 0 ? bad : good],
    [`WORST ${st.worstMs.toFixed(0)}MS`, st.worstMs > st.typicalMs * 1.5 + 1 ? bad : good],
  ];
  if (dbg.simLag) lines.push([`SIM LAG ${st.skippedTicks}`, bad]);
  lines.push([`MOBS ${mobs}`, good], [`KILLS ${s.kills}`, good], [`DRAWS ${dbg.drawCalls}/${dbg.sprites}`, good]);
  lines.forEach(([t, c], i) => drawText(b, S, t, VIEW_W - 6 - t.length * 4, 6 + i * 8, c));

  // Frame-time graph: one bar per frame, newest on the right; red bars are dropped frames.
  const gx = VIEW_W - 6 - st.graphLength, gy = 6 + lines.length * 8 + 3, gh = 18;
  b.drawScaled(S.px, gx - 1, gy - 1, st.graphLength + 2, gh + 2, hex(0x000000, 0.55));
  const base = st.typicalMs * 2; // a bar the full height = twice the normal frame time
  b.drawScaled(S.px, gx, gy + gh / 2, st.graphLength, 1, hex(0x4a5a6a, 0.8)); // the "normal frame" line
  for (let k = 0; k < st.graphLength; k++) {
    const ms = st.graph[(st.graphStart + k) % st.graphLength];
    if (ms === 0) continue;
    const h = Math.max(1, Math.min(gh, Math.round((ms / base) * gh)));
    const dropped = ms > st.typicalMs * 1.5 + 1;
    b.drawScaled(S.px, gx + k, gy + gh - h, 1, h, dropped ? bad : ms > st.typicalMs * 1.2 ? warn : hex(0x6ad07a, 0.9));
  }

  drawText(b, S, 'MOVE WASD/ARROWS/L-STICK  AIM R-STICK  J/RT ATTACK  K/A NOVA  L/B DASH  R RESTART', 6, VIEW_H - 10, hex(0xffffff, 0.8));

  if (s.phase !== Phase.Playing) {
    b.drawScaled(S.px, 0, VIEW_H / 2 - 30, VIEW_W, 60, hex(0x000000, 0.6));
    const msg = s.phase === Phase.Won ? 'BATTLE WON' : 'ROUTED';
    drawText(b, S, msg, VIEW_W / 2 - msg.length * 6, VIEW_H / 2 - 14, hex(s.phase === Phase.Won ? 0xffd35a : 0xe05050), 3);
    drawText(b, S, 'PRESS R TO FIGHT AGAIN', VIEW_W / 2 - 44, VIEW_H / 2 + 14, 0xffffffff);
  }
}

/** Windup tells: a "!" over heavy attackers, an aim line for archers, a blast-radius ring for lit bombers. */
function drawTelegraph(b: Batcher, S: Sprites, e: GameState['ents'], i: number, def: (typeof MOBS)[number], sx: number, top: number, feetY: number, tick: number): void {
  if (def.behavior === Behavior.Bomber) {
    const dots = 20;
    const col = hex(0xff5a30, (tick >> 1) & 1 ? 0.8 : 0.35);
    for (let d = 0; d < dots; d++) {
      const ang = (d / dots) * Math.PI * 2;
      b.drawScaled(S.px, sx + Math.cos(ang) * BLAST_RADIUS, feetY + Math.sin(ang) * BLAST_RADIUS, 1, 1, col);
    }
    return;
  }
  if (def.behavior === Behavior.Ranged) {
    const col = hex(0xff4a3a, 0.65);
    for (let d = 10; d < 160; d += 6) b.drawScaled(S.px, sx + e.ax[i] * d, feetY - 6 + e.ay[i] * d, 1, 1, col);
  }
  if (def.windup >= 16) drawText(b, S, '!', Math.round(sx - 1), Math.round(top - 8), hex(0xffe14a), 1);
}

const DEG = Math.PI / 180;

const STRIKE_TICKS = 8;

/** Draws a weapon as a line of pixels from a pivot, at angle theta (degrees, 0 = forward, +90 = down). */
function drawWeapon(b: Batcher, S: Sprites, px: number, py: number, face: number, theta: number, len: number, color: number, headColor: number, headSize: number): void {
  const dx = Math.cos(theta * DEG) * face, dy = Math.sin(theta * DEG);
  for (let k = 1; k <= len; k++) b.drawScaled(S.px, px + dx * k, py + dy * k, 1, 1, color);
  if (headSize > 0) b.drawScaled(S.px, px + dx * len - headSize / 2 + (face > 0 ? 0 : 0), py + dy * len - headSize / 2, headSize, headSize, headColor);
}

/**
 * Mob animation: a body lean and a raised weapon during the windup, a lunge and a swing at the strike,
 * a drawn bow for archers, a swelling fuse for bombers, and a shield bash for shield bearers.
 */
function drawMob(b: Batcher, S: Sprites, e: GameState['ents'], i: number, tick: number, sx: number, sy: number, flip: boolean, hurtFlash: number): void {
  const type = e.sub[i];
  const def = MOBS[type];
  const face = flip ? -1 : 1;
  const walk = S.mob[type];
  const wf = walk[((tick >> 3) + i) % walk.length];
  const wind = e.wind[i];
  const winding = wind > 0;
  // archers raise their bow for the windup
  let f = wf;
  const since = def.atkCooldown - e.atk[i];
  const striking = !winding && def.behavior !== Behavior.Bomber && e.atk[i] > 0 && since >= 0 && since < STRIKE_TICKS;
  const p = winding ? 1 - wind / def.windup : 0;
  const q = striking ? since / STRIKE_TICKS : 0;
  const moving = Math.abs(e.x[i] - e.px[i]) + Math.abs(e.y[i] - e.py[i]) > 0.05;
  f = mobPose(S.mobArt, type, { winding, windP: p, striking, strikeQ: q, chargeWind: false, charging: false, dazed: false, moving, hurt: hurtFlash > 0, tick, salt: i });

  let ox = 0, oy = 0;
  let flash = hurtFlash;
  if (winding) {
    ox = -face * p * (type === MobType.Orc ? 3 : 2);
    oy = -p * 1.5;
    if (flash === 0) flash = def.behavior === Behavior.Bomber ? ((tick >> 1) & 1 ? 0.8 : 0.1) : ((tick >> 2) & 1 ? 0.45 : 0.1) * p;
  } else if (striking) {
    const lunge = type === MobType.Shield ? 5 : type === MobType.Archer ? -2 : 3;
    ox = face * lunge * (1 - q);
  } else if (e.atk[i] > 0 && !moving && def.behavior !== Behavior.Bomber) {
    oy = -(((tick >> 2) + i) & 1); // restless hop while waiting out the cooldown beside the target
  }

  // Bomber: swell and shake as the fuse burns.
  if (def.behavior === Behavior.Bomber && winding) {
    const sc = 1 + 0.4 * p;
    const jx = ((tick & 1) ? 1 : -1) * p * 1.5;
    b.drawScaled(f, sx - (f.w * sc) / 2 + jx, sy - f.h * sc, f.w * sc, f.h * sc, 0xffffffff);
    drawTelegraph(b, S, e, i, def, sx, sy - f.h, sy, tick);
    return;
  }

  const x0 = sx - f.w / 2 + ox, y0 = sy - f.h + oy;
  b.draw(f, x0, y0, flip, 0xffffffff, flash);

  // Animated weapons.
  const pivotX = sx + face * (f.w / 2 - 2) + ox, pivotY = sy - f.h * 0.5 + oy;
  if (type === MobType.Goblin || type === MobType.Orc) {
    const orc = type === MobType.Orc;
    // The weapon is baked into the body frames (mobPose picks the windup/strike pose); only the swing trail is drawn here,
    // fanned out from the hand.
    const len = orc ? 9 : 5;
    const hx = sx + face * 3 + ox, hy = sy - (orc ? 7 : 3) + oy;
    if (striking && q < 0.75) {
      // swing trail
      const a = hex(0xffffff, 0.8 * (1 - q));
      for (let k = 0; k < 6; k++) {
        const th = -100 + k * 28;
        b.drawScaled(S.px, hx + Math.cos(th * DEG) * face * (len + 2), hy + Math.sin(th * DEG) * (len + 2), 1, 1, a);
      }
    }
  } else if (type === MobType.Archer) {
    if (winding) {
      // nocked arrow, drawn back toward the aim line
      const ax = e.ax[i], ay = e.ay[i];
      const tail = 1 + p * 3;
      for (let k = -tail; k <= 5; k++) b.drawScaled(S.px, pivotX + 2 + ax * k, pivotY + ay * k, 1, 1, k > 4 ? hex(0xffffff) : hex(0xd9c9a0));
    }
  } else if (type === MobType.Shield && striking && q < 0.6) {
    const a = hex(0xffffff, 0.9 * (1 - q));
    for (let k = 0; k < 3; k++) b.drawScaled(S.px, sx + face * (9 + k * 2), sy - f.h * 0.6 + (k - 1) * 3, 2, 1, a);
  }

  if (winding) drawTelegraph(b, S, e, i, def, sx, sy - f.h, sy, tick);
}
