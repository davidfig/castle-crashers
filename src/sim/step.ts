// One fixed simulation tick. Pure function of (state, inputs); no platform access.
import { CLASSES, type ClassDef } from '../data/classes';
import { ARROW_DAMAGE, ARROW_SPEED, ARROW_TTL, BLAST_RADIUS, Behavior, MOBS, MobType } from '../data/mobs';
import { clamp } from '../engine/math';
import { rngFloat, rngInt, rngRange } from '../engine/rng';
import { Btn, type InputFrame } from './input';
import { VIEW_W, WORLD_H, WORLD_W } from './constants';
import { allocEntity, freeEntity, Kind } from './entities';
import { Ev, emit } from './events';
import { pickMobType } from './gen/mix';
import { cellX, cellY, gatherCircle, rebuildGrid } from './grid';
import { activatePlayer, BLAST_CAP, Phase, type GameState } from './state';

const AGGRO_RANGE = 260;
const AGGRO_SPREAD = 18;
const REVIVE_TICKS = 600;
const INPUT_BUFFER = 6;
const PIERCE = 1;
const BLAST_DAMAGE = 8;
const BLAST_KNOCK = 4;
const REINFORCE_INTERVAL = 130;
const REINFORCE_FLOOR = 220;
const LUNGE_SPEED = 1.3;
/** Mobs that never engaged are dropped this far behind the left edge; engaged ones get much longer to rejoin. */
const LEFT_BEHIND_IDLE = 90;
const LEFT_BEHIND_ENGAGED = 360;
const COIN_CAP = 500;
const COIN_MAGNET = 34;
const COIN_PICKUP = 7;
/** A mob sliding faster than this (px/tick) bowls into whatever it touches. */
const BOWL_SPEED2 = 2.6;
const BOWL_DAMAGE = 3;

export function step(s: GameState, inputs: InputFrame[]): void {
  s.tick++;
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) {
    e.px[i] = e.x[i];
    e.py[i] = e.y[i];
  }
  s.prevCamX = s.camX;
  if (s.phase !== Phase.Playing) return;

  if (s.hitStop > 0) {
    s.hitStop--;
    bufferInputs(s, inputs);
    return;
  }

  rebuildGrid(s.grid, e);
  for (let slot = 0; slot < s.players.length; slot++) updatePlayer(s, slot, inputs[slot]);
  flushBlasts(s);
  updateProjectiles(s);
  updateMobs(s);
  updateCoins(s);
  flushBlasts(s);
  runDirector(s);
  updateCamera(s);
  checkEnd(s);
}

/** Slots are reused (LIFO), so a target list can hold a slot that now belongs to a coin or arrow. */
function isLiveMob(e: GameState['ents'], m: number): boolean {
  return e.alive[m] === 1 && e.kind[m] === Kind.Mob;
}

function stop(s: GameState, ticks: number): void {
  if (ticks > s.hitStop) s.hitStop = ticks;
}

/** During hit-stop the world is frozen but button presses must still register. */
function bufferInputs(s: GameState, inputs: InputFrame[]): void {
  for (let slot = 0; slot < s.players.length; slot++) {
    const p = s.players[slot];
    const inp = inputs[slot];
    const pressed = inp.buttons & ~p.prevButtons;
    p.prevButtons = inp.buttons;
    if (!p.active) continue;
    if (pressed & Btn.Ability1) p.bufAbility1 = INPUT_BUFFER;
    if (pressed & Btn.Dodge) p.bufDodge = INPUT_BUFFER;
  }
}

// ---------------------------------------------------------------------------------------------
// Players

function updatePlayer(s: GameState, slot: number, inp: InputFrame): void {
  const p = s.players[slot];
  const e = s.ents;
  const pressed = inp.buttons & ~p.prevButtons;
  p.prevButtons = inp.buttons;

  if (!p.active) {
    if (inp.buttons & Btn.Join) {
      const lead = leadX(s);
      activatePlayer(s, slot, lead - 40, 40 + slot * 40);
    }
    return;
  }

  const cls = CLASSES[p.classId];
  const i = p.ent;
  if (p.cdAttack > 0) p.cdAttack--;
  if (p.cdAbility1 > 0) p.cdAbility1--;
  if (p.cdDash > 0) p.cdDash--;
  if (p.invuln > 0) p.invuln--;
  if (p.bufAbility1 > 0) p.bufAbility1--;
  if (p.bufDodge > 0) p.bufDodge--;
  if (p.comboTimer > 0) p.comboTimer--;
  if (e.hurt[i] > 0) e.hurt[i]--;
  if (pressed & Btn.Ability1) p.bufAbility1 = INPUT_BUFFER;
  if (pressed & Btn.Dodge) p.bufDodge = INPUT_BUFFER;

  if (p.downed) {
    p.downTimer--;
    if (p.downTimer <= 0 && anyStanding(s)) {
      p.downed = false;
      e.hp[i] = cls.hp * 0.5;
      p.invuln = 90;
      emit(s.events, Ev.Revive, e.x[i], e.y[i], slot);
    }
    return;
  }

  let mx = inp.moveX / 127;
  let my = inp.moveY / 127;
  const len2 = mx * mx + my * my;
  let len = 0;
  if (len2 > 1) {
    len = Math.sqrt(len2);
    mx /= len; my /= len;
  } else if (len2 > 0) {
    len = Math.sqrt(len2);
  }
  // The aim stick, when engaged, overrides movement for facing (and so for attack direction).
  const ax = inp.aimX / 127, ay = inp.aimY / 127;
  const aimLen = Math.sqrt(ax * ax + ay * ay);
  if (aimLen > 0.2) {
    p.faceX = ax / aimLen;
    p.faceY = ay / aimLen;
    if (ax > 0.1) e.face[i] = 1;
    else if (ax < -0.1) e.face[i] = -1;
  } else if (len > 0.2) {
    p.faceX = mx / len;
    p.faceY = my / len;
    if (mx > 0.1) e.face[i] = 1;
    else if (mx < -0.1) e.face[i] = -1;
  }

  if (p.dashT === 0 && p.bufDodge > 0 && p.cdDash === 0) {
    p.dashT = cls.dashTicks;
    p.cdDash = cls.dashCooldown;
    p.invuln = Math.max(p.invuln, cls.dashTicks + 4);
    p.bufDodge = 0;
    if (len > 0.2) { p.dashX = mx / len; p.dashY = my / len; }
    else { p.dashX = p.faceX; p.dashY = p.faceY; }
    emit(s.events, Ev.Dash, e.x[i], e.y[i], p.dashX, p.dashY);
  }

  if (p.dashT > 0) {
    e.x[i] += p.dashX * cls.dashSpeed;
    e.y[i] += p.dashY * cls.dashSpeed;
    p.dashT--;
    dashPlow(s, slot, cls);
  } else {
    e.x[i] += mx * cls.speed;
    e.y[i] += my * cls.speed;
    if (p.lungeT > 0) {
      e.x[i] += p.faceX * LUNGE_SPEED;
      e.y[i] += p.faceY * LUNGE_SPEED;
      p.lungeT--;
    }
    if (p.bufAbility1 > 0 && p.cdAbility1 === 0 && p.fury >= cls.novaCost) {
      nova(s, slot, cls);
      p.bufAbility1 = 0;
    } else if (inp.buttons & Btn.Attack && p.cdAttack === 0) {
      cleave(s, slot, cls);
    }
  }

  // Players are tethered to the screen (docs/03: shared screen, tethered camera).
  e.x[i] = clamp(e.x[i], s.camX + 10, s.camX + VIEW_W - 10);
  e.y[i] = clamp(e.y[i], 2, WORLD_H - 2);
}

function leadX(s: GameState): number {
  let best = 80;
  for (const p of s.players) if (p.active && !p.downed && s.ents.x[p.ent] > best) best = s.ents.x[p.ent];
  return best;
}

function anyStanding(s: GameState): boolean {
  for (const p of s.players) if (p.active && !p.downed) return true;
  return false;
}

function cleave(s: GameState, slot: number, cls: ClassDef): void {
  const p = s.players[slot];
  const e = s.ents;
  const idx = p.comboTimer > 0 ? (p.combo + 1) % cls.combo.length : 0;
  const sw = cls.combo[idx];
  p.combo = idx;
  p.cdAttack = sw.cooldown;
  p.comboTimer = sw.cooldown + cls.comboWindow;
  p.lungeT = sw.lunge;
  const cx = e.x[p.ent], cy = e.y[p.ent];
  const heavy = idx === cls.combo.length - 1;
  // Facing scaled by range so the presentation can size the slash arc; c = arc dot.
  emit(s.events, heavy ? Ev.Finisher : Ev.Swing, cx, cy, p.faceX * sw.range, p.faceY * sw.range, sw.dot, slot);

  const n = gatherCircle(s.grid, e, cx, cy, sw.range, s.scratch);
  let hits = 0;
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (!isLiveMob(e, m)) continue;
    const dx = e.x[m] - cx, dy = e.y[m] - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 6 && dx * p.faceX + dy * p.faceY < sw.dot * dist) continue;
    const inv = dist > 0.001 ? 1 / dist : 0;
    const r = damageMob(s, m, sw.damage, dist > 0.001 ? dx * inv : p.faceX, dist > 0.001 ? dy * inv : p.faceY, sw.knock, slot, sw.pierce ? PIERCE : 0);
    if (r === 1) hits++;
  }

  // Finisher: a straight wave that carves down the field, shoving everything along the line.
  if (sw.wave > 0) {
    emit(s.events, Ev.Wave, cx, cy, p.faceX * sw.wave, p.faceY * sw.wave);
    const wn = gatherCircle(s.grid, e, cx, cy, sw.wave, s.scratch);
    for (let k = 0; k < wn; k++) {
      const m = s.scratch[k];
      if (!isLiveMob(e, m) || e.hurt[m] >= 6) continue; // already caught by the arc this tick
      const dx = e.x[m] - cx, dy = e.y[m] - cy;
      const along = dx * p.faceX + dy * p.faceY;
      if (along < 0 || along > sw.wave) continue;
      const lateral = dx * -p.faceY + dy * p.faceX;
      if (lateral > sw.waveWidth || lateral < -sw.waveWidth) continue;
      const r = damageMob(s, m, sw.damage * 0.6, p.faceX, p.faceY, sw.knock * 0.8, slot, PIERCE);
      if (r === 1) hits++;
    }
  }

  destroyArrows(s, cx, cy, sw.range, p.faceX, p.faceY, sw.dot);
  if (hits > 0) {
    p.fury = Math.min(cls.furyMax, p.fury + Math.min(cls.furyPerSwingCap, hits * cls.furyPerHit));
    stop(s, Math.min(6, sw.hitStop + Math.floor(hits / 5)));
  }
}

function nova(s: GameState, slot: number, cls: ClassDef): void {
  const p = s.players[slot];
  const e = s.ents;
  const cx = e.x[p.ent], cy = e.y[p.ent];
  const big = p.fury >= cls.furyMax;
  const radius = big ? cls.novaBigRadius : cls.novaRadius;
  const damage = big ? cls.novaBigDamage : cls.novaDamage;
  p.fury = big ? 0 : p.fury - cls.novaCost;
  p.cdAbility1 = cls.novaCooldown;
  emit(s.events, Ev.Nova, cx, cy, radius, big ? 1 : 0);
  const killsBefore = s.kills;
  const n = gatherCircle(s.grid, e, cx, cy, radius, s.scratch);
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (!isLiveMob(e, m)) continue;
    const dx = e.x[m] - cx, dy = e.y[m] - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const inv = dist > 0.001 ? 1 / dist : 0;
    damageMob(s, m, damage, dist > 0.001 ? dx * inv : 1, dist > 0.001 ? dy * inv : 0, cls.novaKnock * (big ? 1.4 : 1), slot, PIERCE);
  }
  destroyArrows(s, cx, cy, radius, 0, 0, -2);
  stop(s, 4 + Math.min(4, Math.floor((s.kills - killsBefore) / 6)));
}

function dashPlow(s: GameState, slot: number, cls: ClassDef): void {
  const p = s.players[slot];
  const e = s.ents;
  const cx = e.x[p.ent], cy = e.y[p.ent];
  const n = gatherCircle(s.grid, e, cx, cy, 9, s.scratch);
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (!isLiveMob(e, m) || e.stun[m] > 0) continue;
    const dx = e.x[m] - cx, dy = e.y[m] - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const inv = dist > 0.001 ? 1 / dist : 0;
    damageMob(s, m, cls.dashDamage, dist > 0.001 ? dx * inv : p.dashX, dist > 0.001 ? dy * inv : p.dashY, cls.dashKnock, slot, 0);
  }
}

/** Arrows inside the swing/blast are knocked out of the air. */
function destroyArrows(s: GameState, cx: number, cy: number, r: number, fx: number, fy: number, minDot: number): void {
  const e = s.ents;
  const r2 = r * r;
  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Proj) continue;
    const dx = e.x[i] - cx, dy = e.y[i] - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    if (minDot > -1.5 && d2 > 36 && dx * fx + dy * fy < minDot * Math.sqrt(d2)) continue;
    emit(s.events, Ev.Arrow, e.x[i], e.y[i]);
    freeEntity(e, i);
  }
}

/** Returns 0 = ignored, 1 = hit, 2 = blocked by a shield. */
function damageMob(s: GameState, m: number, dmg: number, dirX: number, dirY: number, knock: number, owner: number, flags: number): number {
  const e = s.ents;
  const def = MOBS[e.sub[m]];
  if (def.shield && !(flags & PIERCE) && dirX * e.face[m] < 0) {
    // Attacker is on the shield side.
    e.vx[m] += dirX * knock * 0.25;
    e.hurt[m] = 2;
    e.flags[m] |= 1;
    emit(s.events, Ev.Block, e.x[m], e.y[m], e.face[m]);
    return 2;
  }
  e.hp[m] -= dmg;
  const k = knock * def.knockResist;
  e.vx[m] += dirX * k;
  e.vy[m] += dirY * k;
  e.hurt[m] = 6;
  e.stun[m] = Math.round(6 + 6 * def.knockResist);
  e.flags[m] |= 1; // being hit wakes the mob
  if (owner >= 0) e.by[m] = owner;
  if (def.behavior !== Behavior.Bomber) e.wind[m] = 0; // hits interrupt telegraphs; lit fuses keep burning
  if (e.hp[m] <= 0) {
    emit(s.events, Ev.Kill, e.x[m], e.y[m], e.sub[m], (owner >= 0 || e.by[m] >= 0) ? 1 : 0, dirX * k, dirY * k);
    if (owner < 0) owner = e.by[m]; // a chain reaction credits whoever started it
    if (def.behavior === Behavior.Bomber) queueBlast(s, e.x[m], e.y[m], owner, 0);
    if (owner >= 0) {
      const p = s.players[owner];
      const cls = CLASSES[p.classId];
      s.kills++;
      p.kills++;
      p.fury = Math.min(cls.furyMax, p.fury + cls.furyPerKill);
      if (!p.downed) e.hp[p.ent] = Math.min(cls.hp, e.hp[p.ent] + cls.healPerKill);
    }
    dropLoot(s, m, dirX, dirY);
    freeEntity(e, m);
  } else {
    emit(s.events, Ev.Hit, e.x[m], e.y[m], dmg);
  }
  return 1;
}

function hurtPlayer(s: GameState, slot: number, dmg: number): void {
  const p = s.players[slot];
  const e = s.ents;
  if (p.downed || p.invuln > 0) return;
  const i = p.ent;
  const cls = CLASSES[p.classId];
  e.hp[i] -= dmg;
  e.hurt[i] = 8;
  p.invuln = 24;
  p.fury = Math.min(cls.furyMax, p.fury + 3); // pain feeds the rage
  stop(s, 2);
  emit(s.events, Ev.PlayerHurt, e.x[i], e.y[i], slot);
  if (e.hp[i] <= 0) {
    e.hp[i] = 0;
    p.downed = true;
    p.downTimer = REVIVE_TICKS;
    emit(s.events, Ev.PlayerDown, e.x[i], e.y[i], slot);
  }
}

// ---------------------------------------------------------------------------------------------
// Explosions (bombers)

function queueBlast(s: GameState, x: number, y: number, owner: number, harmsPlayers: number): void {
  if (s.blastN >= BLAST_CAP) return;
  const o = s.blastN * 4;
  s.blasts[o] = x; s.blasts[o + 1] = y; s.blasts[o + 2] = owner; s.blasts[o + 3] = harmsPlayers;
  s.blastN++;
}

function flushBlasts(s: GameState): void {
  const e = s.ents;
  let guard = 0;
  while (s.blastN > 0 && guard++ < 256) {
    s.blastN--;
    const o = s.blastN * 4;
    const x = s.blasts[o], y = s.blasts[o + 1], owner = s.blasts[o + 2], harm = s.blasts[o + 3];
    emit(s.events, Ev.Blast, x, y, BLAST_RADIUS);
    stop(s, 2);
    const n = gatherCircle(s.grid, e, x, y, BLAST_RADIUS, s.scratch);
    for (let k = 0; k < n; k++) {
      const m = s.scratch[k];
      if (!isLiveMob(e, m)) continue;
      const dx = e.x[m] - x, dy = e.y[m] - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const inv = dist > 0.001 ? 1 / dist : 0;
      damageMob(s, m, BLAST_DAMAGE, dist > 0.001 ? dx * inv : 1, dist > 0.001 ? dy * inv : 0, BLAST_KNOCK, owner, PIERCE);
    }
    if (harm) {
      for (let slot = 0; slot < s.players.length; slot++) {
        const p = s.players[slot];
        if (!p.active || p.downed) continue;
        const dx = e.x[p.ent] - x, dy = e.y[p.ent] - y;
        if (dx * dx + dy * dy <= BLAST_RADIUS * BLAST_RADIUS) hurtPlayer(s, slot, MOBS[MobType.Bomber].damage);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Projectiles

function updateProjectiles(s: GameState): void {
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Proj) continue;
    e.x[i] += e.vx[i];
    e.y[i] += e.vy[i];
    e.hp[i] -= 1;
    if (e.hp[i] <= 0 || e.x[i] < 0 || e.x[i] > WORLD_W || e.y[i] < -4 || e.y[i] > WORLD_H + 4) {
      freeEntity(e, i);
      continue;
    }
    for (let slot = 0; slot < s.players.length; slot++) {
      const p = s.players[slot];
      if (!p.active || p.downed) continue;
      const dx = e.x[p.ent] - e.x[i], dy = e.y[p.ent] - e.y[i];
      if (dx * dx + dy * dy < 36) {
        if (p.invuln === 0) {
          hurtPlayer(s, slot, ARROW_DAMAGE);
          freeEntity(e, i);
        }
        break;
      }
    }
  }
}

function fireArrow(s: GameState, i: number): void {
  const e = s.ents;
  const a = allocEntity(e, Kind.Proj, 0, e.x[i], e.y[i], ARROW_TTL);
  if (a < 0) return;
  e.vx[a] = e.ax[i] * ARROW_SPEED;
  e.vy[a] = e.ay[i] * ARROW_SPEED;
  emit(s.events, Ev.Fire, e.x[i], e.y[i], e.ax[i], e.ay[i]);
}

// ---------------------------------------------------------------------------------------------
// Mobs

function updateMobs(s: GameState): void {
  const e = s.ents;
  const g = s.grid;
  const players = s.players;

  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Mob) continue;
    if (e.x[i] < s.camX - ((e.flags[i] & 1) ? LEFT_BEHIND_ENGAGED : LEFT_BEHIND_IDLE)) {
      // Cleared ground stays cleared: whatever is left far behind the screen is gone.
      freeEntity(e, i);
      continue;
    }
    if (e.hurt[i] > 0) e.hurt[i]--;
    if (e.atk[i] > 0) e.atk[i]--;

    const def = MOBS[e.sub[i]];
    const x = e.x[i], y = e.y[i];

    // Nearest standing player.
    let target = -1;
    let best = Infinity;
    for (let k = 0; k < players.length; k++) {
      const p = players[k];
      if (!p.active || p.downed) continue;
      const dx = e.x[p.ent] - x, dy = e.y[p.ent] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; target = k; }
    }
    if (target < 0) continue;

    if (!(e.flags[i] & 1)) {
      if (best < AGGRO_RANGE * AGGRO_RANGE) e.flags[i] |= 1;
      else continue;
    }

    const tx = e.x[players[target].ent] - x, ty = e.y[players[target].ent] - y;
    const dist = Math.sqrt(best);
    const inv = dist > 0.001 ? 1 / dist : 0;
    const dirX = tx * inv, dirY = ty * inv;

    // Separation from neighbours (also spreads the aggro through a clump).
    // A mob sliding fast from a knockback also bowls into what it touches.
    const flying = e.vx[i] * e.vx[i] + e.vy[i] * e.vy[i] > BOWL_SPEED2;
    let sepX = 0, sepY = 0;
    const gx = cellX(x, g), gy = cellY(y, g);
    const y0 = gy > 0 ? gy - 1 : 0, y1 = gy < g.rows - 1 ? gy + 1 : gy;
    const x0 = gx > 0 ? gx - 1 : 0, x1 = gx < g.cols - 1 ? gx + 1 : gx;
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        for (let j = g.head[yy * g.cols + xx]; j !== -1; j = g.next[j]) {
          if (j === i || !e.alive[j] || e.kind[j] !== Kind.Mob) continue;
          const dx = x - e.x[j], dy = y - e.y[j];
          const d2 = dx * dx + dy * dy;
          if (d2 < AGGRO_SPREAD * AGGRO_SPREAD && (e.flags[j] & 1)) e.flags[i] |= 1;
          const minD = def.radius + MOBS[e.sub[j]].radius;
          if (flying && e.stun[j] === 0 && e.hp[i] > 0 && d2 < (minD + 2) * (minD + 2)) {
            const d = Math.sqrt(d2) || 1;
            const v = Math.sqrt(e.vx[i] * e.vx[i] + e.vy[i] * e.vy[i]);
            damageMob(s, j, BOWL_DAMAGE, -dx / d, -dy / d, v * 0.9, e.by[i], 0);
            e.vx[i] *= 0.75;
            e.vy[i] *= 0.75;
          }
          if (d2 >= minD * minD) continue;
          if (d2 < 1e-6) {
            sepX += i < j ? 0.3 : -0.3;
            sepY += i < j ? 0.2 : -0.2;
          } else {
            const d = Math.sqrt(d2);
            const push = (minD - d) / minD * 0.6;
            sepX += (dx / d) * push;
            sepY += (dy / d) * push;
          }
        }
      }
    }

    const speed = def.speed * (0.85 + (Math.imul(i, 2654435761) >>> 28) / 15 * 0.3);
    let mvX = 0, mvY = 0;
    let detonated = false;

    if (e.stun[i] > 0) {
      e.stun[i]--;
    } else if (def.behavior === Behavior.Melee) {
      if (e.wind[i] > 0) {
        if (--e.wind[i] === 0) {
          // Strike lands where the player is *now*; stepping away in time dodges it.
          if (dist <= def.reach + 4) hurtPlayer(s, target, def.damage);
          e.atk[i] = def.atkCooldown;
        }
      } else if (dist <= def.reach && e.atk[i] === 0) {
        e.wind[i] = def.windup;
      } else if (dist > def.reach * 0.9) {
        mvX = dirX * speed;
        mvY = dirY * speed;
      }
    } else if (def.behavior === Behavior.Ranged) {
      const onScreen = x > s.camX + 6 && x < s.camX + VIEW_W - 6;
      if (!onScreen) {
        // Never shoot from offscreen: walk back into view first.
        mvX = dirX * speed;
        mvY = dirY * speed;
        e.wind[i] = 0;
      } else if (e.wind[i] > 0) {
        if (--e.wind[i] === 0) {
          fireArrow(s, i);
          e.atk[i] = def.atkCooldown;
        }
      } else {
        if (dist > def.reach * 1.1) { mvX = dirX * speed; mvY = dirY * speed; }
        else if (dist < def.reach * 0.6) { mvX = -dirX * speed; mvY = -dirY * speed; }
        if (e.atk[i] === 0 && dist < def.reach * 1.4 && dist > 25) {
          e.wind[i] = def.windup;
          e.ax[i] = dirX; // aim is locked at the start of the telegraph
          e.ay[i] = dirY;
        }
      }
    } else {
      // Bomber: run in, light the fuse, boom.
      if (e.wind[i] > 0) {
        if (--e.wind[i] === 0) {
          queueBlast(s, x, y, -1, 1);
          freeEntity(e, i);
          detonated = true;
        }
      } else if (dist <= def.reach) {
        e.wind[i] = def.windup;
      } else {
        mvX = dirX * speed;
        mvY = dirY * speed;
      }
    }
    if (detonated) continue;

    if (tx > 1) e.face[i] = 1;
    else if (tx < -1) e.face[i] = -1;

    e.x[i] = clamp(x + mvX + sepX + e.vx[i], 0, WORLD_W);
    e.y[i] = clamp(y + mvY + sepY + e.vy[i], 0, WORLD_H);
    e.vx[i] *= 0.8;
    e.vy[i] *= 0.8;
  }
}

// ---------------------------------------------------------------------------------------------
// Loot: coins to start with

function dropLoot(s: GameState, m: number, dirX: number, dirY: number): void {
  const e = s.ents;
  const def = MOBS[e.sub[m]];
  if (def.coinChance <= 0 || rngFloat(s.rngLoot) >= def.coinChance) return;
  const value = def.coinMin + rngInt(s.rngLoot, def.coinMax - def.coinMin + 1);
  const x = e.x[m], y = e.y[m];
  const i = s.coinCount >= COIN_CAP ? -1 : allocEntity(e, Kind.Coin, value, x, y, 1);
  if (i < 0) {
    // Too many pickups on the field: the coin goes straight into the purse.
    s.gold += value;
    emit(s.events, Ev.Coin, x, y, value);
    return;
  }
  e.vx[i] = dirX * 0.6 + rngRange(s.rngLoot, -1.1, 1.1);
  e.vy[i] = dirY * 0.4 + rngRange(s.rngLoot, -0.8, 0.8);
  e.z[i] = 3;
  e.vz[i] = rngRange(s.rngLoot, 1.5, 2.9);
  s.coinCount++;
}

function freeCoin(s: GameState, i: number): void {
  freeEntity(s.ents, i);
  s.coinCount--;
}

function updateCoins(s: GameState): void {
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Coin) continue;
    // Coins never expire; they are only lost once they fall behind the screen.
    if (e.x[i] < s.camX - 40) { freeCoin(s, i); continue; }
    if (e.atk[i] < 255) e.atk[i]++; // age

    // arc + bounce
    e.x[i] = clamp(e.x[i] + e.vx[i], 0, WORLD_W);
    e.y[i] = clamp(e.y[i] + e.vy[i], 0, WORLD_H);
    e.z[i] += e.vz[i];
    e.vz[i] -= 0.14;
    if (e.z[i] <= 0) {
      e.z[i] = 0;
      e.vz[i] = e.vz[i] < -0.9 ? -e.vz[i] * 0.45 : 0;
      e.vx[i] *= 0.7;
      e.vy[i] *= 0.7;
    }

    // Nearest standing player: magnetise once landed, collect on touch.
    let target = -1, best = Infinity;
    for (let k = 0; k < s.players.length; k++) {
      const p = s.players[k];
      if (!p.active || p.downed) continue;
      const dx = e.x[p.ent] - e.x[i], dy = e.y[p.ent] - e.y[i];
      const d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; target = k; }
    }
    if (target < 0 || e.atk[i] < 10) continue;
    const dist = Math.sqrt(best);
    if (dist < COIN_PICKUP) {
      const value = e.sub[i];
      s.gold += value;
      s.players[target].coins += value;
      emit(s.events, Ev.Coin, e.x[i], e.y[i], value);
      freeCoin(s, i);
    } else if (dist < COIN_MAGNET) {
      const pull = 0.9 + (1 - dist / COIN_MAGNET) * 3.4;
      const pe = s.players[target].ent;
      e.x[i] += ((e.x[pe] - e.x[i]) / dist) * pull;
      e.y[i] += ((e.y[pe] - e.y[i]) / dist) * pull;
      e.z[i] = e.z[i] > 0 ? e.z[i] * 0.8 : 0;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Reinforcements: keep pressure on so there are no lulls between the authored clumps.

function runDirector(s: GameState): void {
  if (--s.spawnTimer > 0) return;
  s.spawnTimer = REINFORCE_INTERVAL;
  const e = s.ents;
  let awake = 0;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && (e.flags[i] & 1)) awake++;
  if (awake >= REINFORCE_FLOOR || e.capacity - e.count < 300) return;
  if (s.camX > WORLD_W - VIEW_W - 100) return;

  const r = s.rngSpawn;
  const t = clamp(s.camX / WORLD_W, 0, 1);
  const baseX = s.camX + VIEW_W + 24; // reinforcements only ever arrive from ahead
  const size = 6 + Math.floor(t * 10);
  for (let k = 0; k < size; k++) {
    const type = pickMobType(r, t);
    const i = allocEntity(e, Kind.Mob, type, baseX + rngRange(r, 0, 40), rngRange(r, 6, WORLD_H - 6), MOBS[type].hp);
    if (i < 0) return;
    e.flags[i] = 1;
    e.face[i] = -1;
  }
}

// ---------------------------------------------------------------------------------------------
// Camera & end conditions

function updateCamera(s: GameState): void {
  const e = s.ents;
  let sum = 0, n = 0;
  for (const p of s.players) {
    if (!p.active || p.downed) continue;
    sum += e.x[p.ent];
    n++;
  }
  if (n === 0) return;
  const target = clamp(sum / n - VIEW_W / 2 + 24, 0, WORLD_W - VIEW_W);
  // The camera only ever scrolls forward, so ground you have cleared stays behind you.
  if (target > s.camX) s.camX += (target - s.camX) * 0.1;
}

function checkEnd(s: GameState): void {
  const e = s.ents;
  let anyActive = false;
  let allDown = true;
  for (const p of s.players) {
    if (!p.active) continue;
    anyActive = true;
    if (!p.downed) {
      allDown = false;
      if (e.x[p.ent] >= WORLD_W - 70) { s.phase = Phase.Won; return; }
    }
  }
  if (anyActive && allDown) s.phase = Phase.Lost;
}
