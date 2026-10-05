// One fixed simulation tick. Pure function of (state, inputs); no platform access.
import { CLASSES, type ArrowDef, type ClassDef, type Swing } from '../data/classes';
import { ARROW_DAMAGE, ARROW_SPEED, ARROW_TTL, BLAST_RADIUS, Behavior, LEGACY_BOSS_MOVES, ProjStyle, MOBS, MobType, isBossType, type BossDef, type ChargeDef, type MobDef } from '../data/mobs';
import { clamp, cosTurns, sinTurns } from '../engine/math';
import { rngFloat, rngInt, rngRange } from '../engine/rng';
import { Btn, type InputFrame } from './input';
import { TOP_ENTRY_DEPTH, VIEW_W, WORLD_H, WORLD_W } from './constants';
import { allocEntity, BERSERK, BYSTANDER, freeEntity, Kind, SURRENDERED } from './entities';
import { damageMul, goldMul, MAX_LEVEL, offerFor, speedMul, takenMul, UPGRADE_INDEX, UPGRADES, xpToNext } from '../data/upgrades';
import { STAND_RADIUS, STAND_SLOW, STAND_TICKS, SURRENDER_FLEE, SURRENDER_HOLD, surrenderChance } from '../data/surrender';
import { Ev, emit } from './events';
import { pickMobType, pickSupport } from './gen/mix';
import { BOSS_SPECIAL, BurstStyle, clingStep, fireSpecial, fireSpecialOf, hasSpecial, isWarded, onMobDeath, RALLY_SPEED, shovePlayer, SP_CLING, SP_INIT, SP_WIND, startSpecial, startSpecialOf, updateZones } from './abilities';
import { cellX, cellY, gatherCircle, rebuildGrid } from './grid';
import { activatePlayer, BLAST_CAP, Phase, type GameState, type PlayerState } from './state';
import { activePlayers, hasBoss, partyScale, streamLevel } from './gen/level';

export const REVIVE_TICKS = 600;
const INPUT_BUFFER = 6;
const PIERCE = 1;
const BLAST_DAMAGE = 8;
const BLAST_KNOCK = 4;
/** Reinforcement and flank triggers are spaced in px of forward progress (the camera), not in time: a party that stands still faces no growing horde. */
const REINFORCE_INTERVAL = 200;
const REINFORCE_FLOOR = 220;
/** Flank waves (top/bottom entrances): base gap in px of advance, how much shorter it gets at full depth, and pack size. */
const FLANK_INTERVAL = 620;
const FLANK_INTERVAL_DEEP = 220;
/** Wave size for a party of one: comparable to an authored encounter (22-70 enemies), growing with depth. */
const FLANK_SIZE = 28;
const FLANK_SIZE_DEEP = 32;
const LUNGE_SPEED = 1.3;
/** Mobs left this far behind the left edge of the screen are gone for good (closer ones can still rejoin). */
const LEFT_BEHIND = 360;
const COIN_CAP = 500;
const COIN_MAGNET = 80;
const COIN_PICKUP = 12;
/** A mob sliding faster than this (px/tick) bowls into whatever it touches. */
const BOWL_SPEED2 = 2.6;
const BOWL_DAMAGE = 3;
/** Walking speed of a hero who is slowed (a ghoul's claws, a scream, a poison pool). */
const SLOW_FACTOR = 0.55;
/** hurtPlayer flag: damage over time: it ignores and does not grant the brief invulnerability, and does not freeze the game. */
export const HURT_DOT = 1;
/** A staged story beat plays once the lead hero is this close to it (px). */
const BEAT_REACH = 90;
/** XP for killing the boss (an ordinary kill is 1). */
const XP_BOSS = 40;

export function step(s: GameState, inputs: InputFrame[]): void {
  s.tick++;
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) {
    e.px[i] = e.x[i];
    e.py[i] = e.y[i];
  }
  s.prevCamX = s.camX;
  if (s.phase === Phase.Lost) { retreatMobs(s); return; }
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
  updateZones(s);
  updateMobs(s);
  updateCoins(s);
  flushBlasts(s);
  const advance = Math.max(0, s.camX - s.trigCamX);
  s.trigCamX = Math.max(s.trigCamX, s.camX);
  runDirector(s, advance);
  runFlanks(s, advance);
  updateCamera(s);
  streamLevel(s);
  checkBeat(s);
  checkEnd(s);
}

/** Slots are reused (LIFO), so a target list can hold a slot that now belongs to a coin or arrow. */
function isLiveMob(e: GameState['ents'], m: number): boolean {
  return e.alive[m] === 1 && e.kind[m] === Kind.Mob;
}

export function stop(s: GameState, ticks: number): void {
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
    if (pressed & Btn.Ability2) p.bufAbility2 = INPUT_BUFFER;
    if (pressed & Btn.Dodge) p.bufDodge = INPUT_BUFFER;
  }
}

// ---------------------------------------------------------------------------------------------
// Players

/** A hero standing down fights with nothing and walks slowly. Reused, so no frame is mutated and nothing allocates. */
const standingInput: InputFrame = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };

/** What a hero with the level-up panel open (or a pick button still held) does: nothing. Reused; no frame is mutated. */
const panelInput: InputFrame = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };
const PICK_BUTTONS = Btn.Attack | Btn.Ability1 | Btn.Ability2 | Btn.Level;

/** Spend one pending level on offer card `card`. */
export function choosePick(s: GameState, slot: number, card: number): void {
  const p = s.players[slot];
  const levelNumber = p.level - p.pending + 1;
  const up = offerFor(s.offerSeed, slot, levelNumber, p.ranks)[card];
  if (up === undefined) return;
  if (p.ranks[up] < UPGRADES[up].maxRank) p.ranks[up]++;
  if (up === UPGRADE_INDEX.wind) s.ents.hp[p.ent] = CLASSES[p.classId].hp;
  p.pending--;
  p.panel = false;
  p.lock = true;
  emit(s.events, Ev.Pick, s.ents.x[p.ent], s.ents.y[p.ent], slot, up);
}

/**
 * The level-up panel (docs/06-ui.md). The game never pauses. The Level button opens or closes the panel; while it is open
 * the three face buttons choose a card, and this hero can do nothing else: no movement, attacks, abilities or dodge.
 * Returns the input the rest of the tick should see.
 */
function levelUpInput(s: GameState, p: PlayerState, inp: InputFrame): InputFrame {
  const raw = inp.buttons;
  const edge = raw & ~p.rawPrev;
  p.rawPrev = raw;
  if (!p.active) return inp;
  const wasOpen = p.panel;
  if (p.downed) p.panel = false;
  else if (edge & Btn.Level) p.panel = p.panel ? false : p.pending > 0;
  else if (p.panel) {
    const card = edge & Btn.Attack ? 0 : edge & Btn.Ability1 ? 1 : edge & Btn.Ability2 ? 2 : -1;
    if (card >= 0) choosePick(s, s.players.indexOf(p), card);
  }
  if (!p.panel && !wasOpen) {
    if (p.lock) { if (raw & PICK_BUTTONS) { panelInput.moveX = inp.moveX; panelInput.moveY = inp.moveY; panelInput.aimX = inp.aimX; panelInput.aimY = inp.aimY; panelInput.buttons = raw & ~PICK_BUTTONS; return panelInput; } p.lock = false; }
    return inp;
  }
  if (!p.panel) { p.lock = true; } // closed this tick: the button that closed it is still down
  panelInput.moveX = panelInput.moveY = panelInput.aimX = panelInput.aimY = 0;
  panelInput.buttons = raw & Btn.Join;
  return panelInput;
}

/** Everybody in the party gains XP from a kill; heroes level together. */
function grantXp(s: GameState, amount: number, x: number, y: number): void {
  for (let k = 0; k < s.players.length; k++) {
    const p = s.players[k];
    if (!p.active) continue;
    p.xp += amount;
    while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
      p.xp -= xpToNext(p.level);
      p.level++;
      p.pending++;
      emit(s.events, Ev.LevelUp, x, y, k);
    }
  }
}

function updatePlayer(s: GameState, slot: number, inp: InputFrame): void {
  const p = s.players[slot];
  const e = s.ents;
  inp = levelUpInput(s, p, inp);
  if (p.active && !p.downed && s.surrender && (inp.buttons & Btn.Interact)) {
    p.standT++;
    standingInput.moveX = Math.round(inp.moveX * STAND_SLOW);
    standingInput.moveY = Math.round(inp.moveY * STAND_SLOW);
    standingInput.aimX = inp.aimX;
    standingInput.aimY = inp.aimY;
    standingInput.buttons = inp.buttons & ~(Btn.Attack | Btn.Ability1 | Btn.Ability2);
    inp = standingInput;
  } else p.standT = 0;
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
  if (p.cdSpecial > 0) p.cdSpecial--;
  if (p.invuln > 0) p.invuln--;
  if (p.vanishT > 0 && --p.vanishT === 0) p.invuln = Math.min(p.invuln, 8);
  if (p.silenceT > 0) p.silenceT--;
  if (p.bufAbility1 > 0) p.bufAbility1--;
  if (p.bufAbility2 > 0) p.bufAbility2--;
  if (p.bufDodge > 0) p.bufDodge--;
  if (p.comboTimer > 0) p.comboTimer--;
  p.healBudget = Math.min(cls.healBudgetMax, p.healBudget + cls.healPerSecond / 60);
  // Stamina comes back once the regen delay (since the last spend) has passed; a winded hero is back on their
  // feet once enough has recovered.
  if (p.staminaDelay > 0) p.staminaDelay--;
  else p.stamina = Math.min(cls.staminaMax, p.stamina + cls.staminaRegen);
  if (p.winded && p.stamina >= cls.windedRecover) p.winded = false;
  if (e.hurt[i] > 0) e.hurt[i]--;
  if (pressed & Btn.Ability1) p.bufAbility1 = INPUT_BUFFER;
  if (pressed & Btn.Ability2) p.bufAbility2 = INPUT_BUFFER;
  if (pressed & Btn.Dodge) p.bufDodge = INPUT_BUFFER;

  if (p.downed) {
    p.downTimer--;
    if (p.downTimer <= 0 && anyStanding(s)) {
      p.downed = false;
      e.hp[i] = cls.hp * 0.5;
      p.stamina = cls.staminaMax;
      p.winded = false;
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

  if (p.dashT === 0 && p.bufDodge > 0 && p.cdDash === 0 && !p.winded && p.stamina >= cls.dashCost) {
    spendStamina(s, slot, cls.dashCost);
    p.dashT = cls.dashTicks;
    p.rootT = 0; // a dodge-roll tears free of a snare
    p.cdDash = cls.dashCooldown;
    p.invuln = Math.max(p.invuln, cls.dashTicks + 4);
    p.bufDodge = 0;
    if (len > 0.2) { p.dashX = mx / len; p.dashY = my / len; }
    else { p.dashX = p.faceX; p.dashY = p.faceY; }
    const kind = cls.dashKind;
    emit(s.events, Ev.Dash, e.x[i], e.y[i], p.dashX, p.dashY, kind === 'charge' ? 1 : kind === 'vanish' ? 2 : kind === 'teleport' ? 3 : kind === 'heal' ? 4 : 0);
    if (kind === 'vanish') {
      p.vanishT = cls.dashPower ?? 90;
      p.invuln = Math.max(p.invuln, p.vanishT);
    } else if (kind === 'teleport') {
      const nx = clamp(e.x[i] + p.dashX * (cls.dashPower ?? 80), s.camX + 10, s.camX + VIEW_W - 10);
      const ny = clamp(e.y[i] + p.dashY * (cls.dashPower ?? 80), 2, WORLD_H - 2);
      emit(s.events, Ev.Teleport, e.x[i], e.y[i], nx, ny);
      e.x[i] = nx;
      e.y[i] = ny;
      p.invuln = Math.max(p.invuln, 14);
    } else if (kind === 'heal') {
      healPulse(s, e.x[i], e.y[i], cls.dashRadius ?? 60, cls.dashPower ?? 12);
    }
  }

  if (p.dashT > 0) {
    e.x[i] += p.dashX * cls.dashSpeed;
    e.y[i] += p.dashY * cls.dashSpeed;
    p.dashT--;
    if (cls.dashDamage > 0) dashPlow(s, slot, cls);
  } else {
    if (p.slowT > 0) p.slowT--;
    const rooted = p.rootT > 0;
    if (rooted) p.rootT--;
    const turn = p.confuseT > 0 ? (p.confuseT--, -1) : 1; // a whiteout reverses the way the stick moves you
    const speed = rooted ? 0 : (p.winded ? cls.speed * cls.windedSpeed : cls.speed) * (p.slowT > 0 ? SLOW_FACTOR : 1) * speedMul(p.ranks);
    e.x[i] += mx * speed * turn;
    e.y[i] += my * speed * turn;
    if (p.lungeT > 0) {
      e.x[i] += p.faceX * LUNGE_SPEED;
      e.y[i] += p.faceY * LUNGE_SPEED;
      p.lungeT--;
    }
    if (cls.auraDrain) {
      // The attack button flips the aura; while it is on it pulses every cooldown and the stamina bleeds away until it runs out.
      if (pressed & Btn.Attack && (p.auraOn || (!p.winded && p.stamina > 0))) p.auraOn = !p.auraOn;
      if (p.auraOn) {
        spendStamina(s, slot, cls.auraDrain);
        if (p.winded) p.auraOn = false;
        else if (p.cdAttack === 0) swing(s, slot, cls, cls.combo[0], false);
      }
    }
    const acted = p.cdAttack + p.cdSpecial + p.cdAbility1;
    if (p.silenceT === 0 && p.bufAbility1 > 0 && p.cdAbility1 === 0 && p.fury >= cls.novaCost) {
      nova(s, slot, cls);
      p.bufAbility1 = 0;
    } else if (p.silenceT === 0 && p.bufAbility2 > 0 && p.cdSpecial === 0 && !p.winded && p.stamina >= cls.specialCost && (p.cdAttack === 0 || p.auraOn)) {
      // Ability 2: the big sweep. It costs stamina and has its own cooldown.
      spendStamina(s, slot, cls.specialCost);
      p.cdSpecial = cls.specialCooldown;
      p.bufAbility2 = 0;
      if (cls.specialShot) {
        fireArrows(s, slot, cls.specialShot, cls.specialShot.count, cls.specialShot.spread, !!cls.specialShot.pierce);
        p.cdAttack = cls.specialShot.cooldown;
      } else swing(s, slot, cls, cls.special, true);
    } else if (inp.buttons & Btn.Attack && !cls.auraDrain && p.cdAttack === 0 && !p.winded && p.stamina >= cls.attackCost) {
      if (cls.shot) {
        spendStamina(s, slot, cls.attackCost);
        fireArrows(s, slot, cls.shot, 1, 0, false);
        p.cdAttack = cls.shot.cooldown;
      } else cleave(s, slot, cls);
    }
    // Striking from the shadows ends a vanish.
    if (p.vanishT > 0 && p.cdAttack + p.cdSpecial + p.cdAbility1 > acted) {
      p.vanishT = 0;
      p.invuln = Math.min(p.invuln, 8);
    }
  }

  if (p.pullT > 0) {
    // hauled by a harpoon or launched by a ram
    e.x[i] += p.pullX;
    e.y[i] += p.pullY;
    p.pullT--;
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

/** Stamina spent: the regen clock restarts, and running dry leaves the hero winded. */
function spendStamina(s: GameState, slot: number, cost: number): void {
  const p = s.players[slot];
  const cls = CLASSES[p.classId];
  p.stamina -= cost;
  p.staminaDelay = cls.staminaRegenDelay;
  if (p.stamina <= 0) {
    p.stamina = 0;
    if (!p.winded) {
      p.winded = true;
      emit(s.events, Ev.Winded, s.ents.x[p.ent], s.ents.y[p.ent], slot);
    }
  }
}

/** The basic attack: a combo of quick sweeps. */
/**
 * Ranged classes: fire `count` arrows from the player along the facing, fanned over `spread` turns. A player's arrow is a Proj
 * with sub = 1 + slot (enemy arrows are sub 0); flag bit 1 marks one that pierces.
 */
function fireArrows(s: GameState, slot: number, a: ArrowDef, count: number, spread: number, pierce: boolean): void {
  const p = s.players[slot];
  const e = s.ents;
  for (let k = 0; k < count; k++) {
    const t = count === 1 ? 0 : (k / (count - 1) - 0.5) * spread;
    const c = cosTurns(t), sn = sinTurns(t);
    const dx = p.faceX * c - p.faceY * sn, dy = p.faceX * sn + p.faceY * c;
    const q = allocEntity(e, Kind.Proj, 1 + slot, e.x[p.ent], e.y[p.ent], a.ttl);
    if (q < 0) break;
    e.vx[q] = dx * a.speed;
    e.vy[q] = dy * a.speed;
    e.flags[q] = pierce ? 2 : 0;
  }
  emit(s.events, Ev.Fire, e.x[p.ent], e.y[p.ent], p.faceX, p.faceY);
}

/** A fireball landing: everything within `a.splash` px (except the mob it struck, already hurt) takes damage and is shoved outward. */
function explodeShot(s: GameState, owner: number, a: ArrowDef, x: number, y: number, struck: number): void {
  const e = s.ents;
  const pl = s.players[owner];
  const cls = CLASSES[pl.classId];
  const radius = a.splash ?? 0;
  emit(s.events, Ev.Blast, x, y, radius);
  const n = gatherCircle(s.grid, e, x, y, radius, s.scratch);
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (m === struck || !isLiveMob(e, m)) continue;
    const dx = e.x[m] - x, dy = e.y[m] - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    // the blast's edge is weaker than a direct hit
    const r = damageMob(s, m, a.damage * (a.splashDamage ?? 0.55), d > 0.001 ? dx / d : 1, d > 0.001 ? dy / d : 0, a.knock * 0.7, owner, 0);
    if (r === 1) pl.fury = Math.min(cls.furyMax, pl.fury + cls.furyPerHit);
  }
}

function cleave(s: GameState, slot: number, cls: ClassDef): void {
  const p = s.players[slot];
  const idx = p.comboTimer > 0 ? (p.combo + 1) % cls.combo.length : 0;
  const sw = cls.combo[idx];
  p.combo = idx;
  spendStamina(s, slot, cls.attackCost);
  swing(s, slot, cls, sw, false);
}

/** One sweep of the weapon: arc hits, an optional wave down the field, fury, hit-stop. `heavy` is the special. */
function swing(s: GameState, slot: number, cls: ClassDef, sw: Swing, heavy: boolean): void {
  const p = s.players[slot];
  const e = s.ents;
  p.cdAttack = sw.cooldown;
  p.comboTimer = sw.cooldown + cls.comboWindow;
  p.lungeT = sw.aoe ? 0 : sw.lunge;
  const cx = e.x[p.ent], cy = e.y[p.ent];
  // Facing scaled by range so the presentation can size the slash arc; c = arc dot.
  if (sw.aoe) emit(s.events, Ev.Pulse, cx, cy, sw.range, heavy ? 1 : 0, 0, slot);
  else emit(s.events, heavy ? Ev.Finisher : Ev.Swing, cx, cy, p.faceX * sw.range, p.faceY * sw.range, sw.dot, slot);

  const n = gatherCircle(s.grid, e, cx, cy, sw.range, s.scratch);
  let hits = 0;
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (!isLiveMob(e, m)) continue;
    const dx = e.x[m] - cx, dy = e.y[m] - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (!sw.aoe && dist > 6 && dx * p.faceX + dy * p.faceY < sw.dot * dist) continue;
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

  destroyArrows(s, cx, cy, sw.range, p.faceX, p.faceY, sw.aoe ? -2 : sw.dot);
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
  // The cleric's nova also heals every standing player inside it (itself included).
  const heal = big ? (cls.novaBigHeal ?? 0) : (cls.novaHeal ?? 0);
  if (heal > 0) {
    for (const q of s.players) {
      if (!q.active || q.downed) continue;
      const dx = e.x[q.ent] - cx, dy = e.y[q.ent] - cy;
      if (dx * dx + dy * dy > radius * radius) continue;
      e.hp[q.ent] = Math.min(CLASSES[q.classId].hp, e.hp[q.ent] + heal);
    }
  }
  stop(s, 4 + Math.min(4, Math.floor((s.kills - killsBefore) / 6)));
}

/** Restores `amount` hp to every standing player within `radius`. */
function healPulse(s: GameState, cx: number, cy: number, radius: number, amount: number): void {
  const e = s.ents;
  emit(s.events, Ev.Heal, cx, cy, radius);
  for (const q of s.players) {
    if (!q.active || q.downed) continue;
    const dx = e.x[q.ent] - cx, dy = e.y[q.ent] - cy;
    if (dx * dx + dy * dy > radius * radius) continue;
    e.hp[q.ent] = Math.min(CLASSES[q.classId].hp, e.hp[q.ent] + amount);
  }
}

function dashPlow(s: GameState, slot: number, cls: ClassDef): void {
  const p = s.players[slot];
  const e = s.ents;
  const cx = e.x[p.ent], cy = e.y[p.ent];
  const n = gatherCircle(s.grid, e, cx, cy, cls.dashRadius ?? 9, s.scratch);
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
    if (e.kind[i] !== Kind.Proj || e.sub[i] !== 0) continue; // players' own arrows are not swatted
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
  if (e.flags[m] & 2) return 0; // still walking in from off-field: immune until it has arrived
  if (owner >= 0) dmg *= damageMul(s.players[owner].ranks);
  if (def.shield && !(flags & PIERCE) && dirX * e.face[m] < 0) {
    // Attacker is on the shield side.
    e.vx[m] += dirX * knock * 0.25;
    e.hurt[m] = 2;
    e.flags[m] |= 1;
    emit(s.events, Ev.Block, e.x[m], e.y[m], e.face[m]);
    return 2;
  }
  if (isWarded(e, m)) {
    // a frost-shaman's ward takes the whole blow and shatters
    e.cool[m] = 0;
    e.hurt[m] = 2;
    e.flags[m] |= 1;
    emit(s.events, Ev.Block, e.x[m], e.y[m], e.face[m]);
    return 2;
  }
  e.hp[m] -= dmg;
  // A charging (or berserk) mob has super armor: it still takes damage, but is neither shoved nor staggered.
  const armored = e.mode[m] === 2 || def.armored === true || (e.flags[m] & BERSERK) !== 0;
  if (!armored) {
    const k = knock * def.knockResist;
    e.vx[m] += dirX * k;
    e.vy[m] += dirY * k;
    e.stun[m] = Math.round(6 + 6 * def.knockResist);
  }
  e.hurt[m] = 6;
  e.flags[m] |= 1; // being hit wakes the mob
  if (owner >= 0) e.by[m] = owner;
  if (!armored && def.behavior !== Behavior.Bomber) {
    e.wind[m] = 0;
    if (e.mode[m] === 1) e.mode[m] = 0; // a hit during the paw-the-ground windup cancels the charge
    if (e.mode[m] === SP_WIND) {
      // a hit breaks a special's telegraph, and the mob has to wait out half the cooldown before trying again
      e.mode[m] = 0;
      if (def.special) e.cool2[m] = Math.max(e.cool2[m], def.special.cooldown >> 1);
    }
  } // hits interrupt telegraphs; lit fuses keep burning
  if (e.hp[m] <= 0 && def.revive !== undefined && e.rem[m] === 0) {
    // the first death does not take: it lies there a moment, then rises again
    e.rem[m] = 1;
    e.hp[m] = e.maxhp[m] * def.revive;
    e.stun[m] = 60;
    e.vx[m] = 0;
    e.vy[m] = 0;
    emit(s.events, Ev.Burst, e.x[m], e.y[m], 22, BurstStyle.Bones);
    return 1;
  }
  if (e.hp[m] <= 0) {
    emit(s.events, Ev.Kill, e.x[m], e.y[m], e.sub[m], (owner >= 0 || e.by[m] >= 0) ? 1 : 0, dirX * knock * def.knockResist, dirY * knock * def.knockResist);
    if (owner < 0) owner = e.by[m]; // a chain reaction credits whoever started it
    if (def.behavior === Behavior.Bomber) queueBlast(s, e.x[m], e.y[m], owner, 0);
    if (owner >= 0) {
      const p = s.players[owner];
      const cls = CLASSES[p.classId];
      s.kills++;
      s.slain[e.sub[m]]++;
      if (e.flags[m] & SURRENDERED) s.betrayed++;
      grantXp(s, def.behavior === Behavior.Boss ? XP_BOSS : 1, e.x[m], e.y[m]);
      p.kills++;
      p.fury = Math.min(cls.furyMax, p.fury + cls.furyPerKill);
      if (!p.downed) {
        const heal = Math.min(cls.healPerKill, p.healBudget, cls.hp - e.hp[p.ent]);
        if (heal > 0) { e.hp[p.ent] += heal; p.healBudget -= heal; }
      }
    }
    if (def.onDeath) onMobDeath(s, m, def.onDeath, dirX, dirY);
    if (def.behavior === Behavior.Boss) bossDeath(s, m);
    else dropLoot(s, m, dirX, dirY);
    freeEntity(e, m);
  } else {
    emit(s.events, Ev.Hit, e.x[m], e.y[m], dmg);
  }
  return 1;
}

export function hurtPlayer(s: GameState, slot: number, dmg: number, slow = 0, flags = 0): void {
  const p = s.players[slot];
  const e = s.ents;
  const dot = (flags & HURT_DOT) !== 0;
  if (p.downed || (p.invuln > 0 && !dot)) return;
  dmg *= takenMul(p.ranks);
  if (slow > p.slowT) p.slowT = slow;
  const i = p.ent;
  const cls = CLASSES[p.classId];
  e.hp[i] -= dmg;
  e.hurt[i] = 8;
  if (!dot) p.invuln = 24;
  p.fury = Math.min(cls.furyMax, p.fury + 3); // pain feeds the rage
  if (!dot) stop(s, 2);
  emit(s.events, Ev.PlayerHurt, e.x[i], e.y[i], slot);
  if (e.hp[i] <= 0) {
    e.hp[i] = 0;
    p.downed = true;
    p.auraOn = false;
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
    if (e.sub[i] > 0) {
      // A player's arrow: hits the first mob it touches (a piercing one keeps going), blocked by shields.
      const owner = e.sub[i] - 1;
      const pl = s.players[owner];
      const ocls = CLASSES[pl.classId];
      const a = (e.flags[i] & 2) ? ocls.specialShot : ocls.shot;
      if (!a) { freeEntity(e, i); continue; }
      const pierce = (e.flags[i] & 2) !== 0;
      const n = gatherCircle(s.grid, e, e.x[i], e.y[i], 5, s.scratch);
      let primary = -1;
      let spent = false;
      for (let k = 0; k < n && !spent; k++) {
        const m = s.scratch[k];
        if (!isLiveMob(e, m) || (pierce && e.hurt[m] >= 6)) continue;
        const vl = Math.sqrt(e.vx[i] * e.vx[i] + e.vy[i] * e.vy[i]) || 1;
        const r = damageMob(s, m, a.damage, e.vx[i] / vl, e.vy[i] / vl, a.knock, owner, pierce ? PIERCE : 0);
        if (r === 0) continue;
        if (r === 1) pl.fury = Math.min(ocls.furyMax, pl.fury + ocls.furyPerHit);
        if (!pierce || r === 2) { primary = m; freeEntity(e, i); spent = true; }
      }
      if (spent && a.splash) explodeShot(s, owner, a, e.x[i], e.y[i], primary);
      continue;
    }
    for (let slot = 0; slot < s.players.length; slot++) {
      const p = s.players[slot];
      if (!p.active || p.downed) continue;
      const dx = e.x[p.ent] - e.x[i], dy = e.y[p.ent] - e.y[i];
      if (dx * dx + dy * dy < 36) {
        if (p.invuln === 0) {
          hurtPlayer(s, slot, e.rem[i] > 0 ? e.rem[i] : ARROW_DAMAGE);
          if (e.buff[i] > 0 && !p.downed) {
            // a harpoon: the line goes taut and hauls the hero back along its flight
            const vl = Math.sqrt(e.vx[i] * e.vx[i] + e.vy[i] * e.vy[i]) || 1;
            shovePlayer(s, slot, -e.vx[i] / vl, -e.vy[i] / vl, e.buff[i]);
          }
          freeEntity(e, i);
        }
        break;
      }
    }
  }
}

function fireArrow(s: GameState, i: number): void {
  const e = s.ents;
  const shot = MOBS[e.sub[i]].shot;
  const n = shot ? shot.count : 1;
  const speed = shot ? shot.speed : ARROW_SPEED;
  for (let k = 0; k < n; k++) {
    const a = allocEntity(e, Kind.Proj, 0, e.x[i], e.y[i], ARROW_TTL);
    if (a < 0) return;
    // a volley fans out symmetrically around the locked aim line
    const turn = shot ? (k - (n - 1) / 2) * shot.spread : 0;
    const c = cosTurns(turn), sn = sinTurns(turn);
    e.vx[a] = (e.ax[i] * c - e.ay[i] * sn) * speed;
    e.vy[a] = (e.ax[i] * sn + e.ay[i] * c) * speed;
    e.rem[a] = shot ? shot.damage : ARROW_DAMAGE;
    e.mode[a] = shot ? shot.style : ProjStyle.Arrow;
    e.buff[a] = shot?.pull ?? 0;
    e.ax[a] = e.x[i]; // where it was thrown from (a harpoon draws its line back to here)
    e.ay[a] = e.y[i];
  }
  emit(s.events, Ev.Fire, e.x[i], e.y[i], e.ax[i], e.ay[i]);
}

// ---------------------------------------------------------------------------------------------
// Mobs

// ---------------------------------------------------------------------------------------------
// The boss

/** Boss modes: 1 charge windup, 2 charging, 3 ground slam, 4 war cry, 5 club smash, 8 one of its specials (`rem` = the index in its `moves`). */
const BOSS_SMASH = 5, BOSS_SLAM = 3, BOSS_ROAR = 4, BOSS_CHARGE_WIND = 1;

function bossDeath(s: GameState, m: number): void {
  const e = s.ents;
  const b = MOBS[e.sub[m]].boss!;
  const x = e.x[m], y = e.y[m];
  e.boss = -1;
  s.bossDeadTick = s.tick;
  emit(s.events, Ev.BossDown, x, y);
  stop(s, 12);
  // A burst of coins, flung out in every direction.
  for (let k = 0; k < b.lootCoins; k++) {
    const i = s.coinCount >= COIN_CAP ? -1 : allocEntity(e, Kind.Coin, b.lootValue, x, y, 1);
    if (i < 0) { s.gold += b.lootValue; continue; }
    const ang = k / b.lootCoins + rngRange(s.rngLoot, -0.03, 0.03); // turns
    const sp = rngRange(s.rngLoot, 0.8, 2.2);
    e.vx[i] = cosTurns(ang) * sp;
    e.vy[i] = sinTurns(ang) * sp * 0.6;
    e.z[i] = 6;
    e.vz[i] = rngRange(s.rngLoot, 2.2, 3.6);
    s.coinCount++;
  }
}

/** The war cry: supporters burst out of the boss's position and rush the party. */
function bossRoar(s: GameState, i: number, b: BossDef, enraged: boolean): void {
  const e = s.ents;
  const r = s.rngSpawn;
  emit(s.events, Ev.Roar, e.x[i], e.y[i]);
  const count = Math.round(b.summonSize * (enraged ? 1.6 : 1) * partyScale(activePlayers(s)));
  for (let k = 0; k < count; k++) {
    if (e.capacity - e.count < 120) return;
    const type = pickSupport(r, enraged, s.biome);
    const ang = rngFloat(r); // turns
    const m = allocEntity(e, Kind.Mob, type, e.x[i] + cosTurns(ang) * 26, clamp(e.y[i] + sinTurns(ang) * 20, 6, WORLD_H - 6), MOBS[type].hp);
    if (m < 0) return;
    e.flags[m] = 1;
    // They burst outward from the boss before settling into the chase.
    e.vx[m] = cosTurns(ang) * 3;
    e.vy[m] = sinTurns(ang) * 1.6;
    e.stun[m] = 8;
  }
}

/**
 * Draw one of the boss's moves by weight, among those that can happen right now (the slam needs a hero close, the charge a run-up,
 * the war cry room in the crowd, a special whatever its own range and conditions ask), and start it. False if none could.
 */
function pickBossMove(s: GameState, i: number, def: MobDef, b: BossDef, target: number, dist: number, dirX: number, dirY: number, edge: number, enraged: boolean): boolean {
  const e = s.ents;
  const moves = b.moves ?? LEGACY_BOSS_MOVES;
  const c = def.charge!;
  const pool: number[] = [];
  for (let k = 0; k < moves.length; k++) if (enraged || !moves[k].enragedOnly) pool.push(k);
  const r = s.rngCombat;
  while (pool.length > 0) {
    let total = 0;
    for (const k of pool) total += moves[k].weight;
    let roll = rngFloat(r) * total, at = 0;
    for (let q = 0; q < pool.length; q++) { roll -= moves[pool[q]].weight; if (roll < 0) { at = q; break; } }
    const k = pool.splice(at, 1)[0];
    const mv = moves[k];
    switch (mv.kind) {
      case 'slam':
        if (edge < b.slamRadius * 0.8) { e.mode[i] = BOSS_SLAM; e.wind[i] = b.slamWindup; return true; }
        break;
      case 'roar':
        if (awakeCount(s) < 320) { e.mode[i] = BOSS_ROAR; e.wind[i] = b.roarWindup; return true; }
        break;
      case 'charge':
        if (dist >= c.minRange && dist <= c.maxRange) {
          e.mode[i] = BOSS_CHARGE_WIND;
          e.wind[i] = c.windup;
          e.ax[i] = dirX;
          e.ay[i] = dirY;
          return true;
        }
        break;
      case 'special':
        if (startSpecialOf(s, i, mv.special, target, dist, dirX, dirY)) {
          e.mode[i] = BOSS_SPECIAL; // (startSpecialOf set the ordinary special mode and the windup; a boss has its own mode)
          e.rem[i] = k;
          return true;
        }
        break;
    }
  }
  return false;
}

function bossStep(s: GameState, i: number, def: MobDef, target: number, dist: number, dirX: number, dirY: number, tx: number): void {
  const e = s.ents;
  const b = def.boss!;
  const c = def.charge!;
  const enraged = (e.flags[i] & 4) !== 0;
  if (e.cool2[i] > 0) e.cool2[i]--;
  if (tx > 1) e.face[i] = 1;
  else if (tx < -1) e.face[i] = -1;
  const edge = dist - def.radius; // distance to the boss's edge, not its centre

  // Enrage once, at half health: a war cry right away, then faster everything.
  if (!enraged && e.hp[i] < e.maxhp[i] * b.enrageAt) {
    e.flags[i] |= 4;
    e.mode[i] = BOSS_ROAR;
    e.wind[i] = b.roarWindup;
    e.stun[i] = 0;
    e.cool2[i] = b.specialGapEnraged;
    emit(s.events, Ev.Roar, e.x[i], e.y[i]);
    return;
  }

  if (e.stun[i] > 0) { e.stun[i]--; return; } // winded after a charge, or recovering from a big move

  const mode = e.mode[i];
  if (mode === BOSS_CHARGE_WIND) {
    // Charge windup: the direction is locked, so it can be sidestepped or dashed.
    if (--e.wind[i] === 0) {
      e.mode[i] = 2;
      e.rem[i] = c.distance;
      emit(s.events, Ev.Charge, e.x[i], e.y[i], e.ax[i], e.ay[i]);
    }
    return;
  }
  if (mode === BOSS_SLAM) {
    if (--e.wind[i] === 0) {
      emit(s.events, Ev.Slam, e.x[i], e.y[i], b.slamRadius, b.frost ? 1 : 0);
      stop(s, 5);
      for (let k = 0; k < s.players.length; k++) {
        const p = s.players[k];
        if (!p.active || p.downed) continue;
        const dx = e.x[p.ent] - e.x[i], dy = e.y[p.ent] - e.y[i];
        if (dx * dx + dy * dy <= b.slamRadius * b.slamRadius) hurtPlayer(s, k, b.slamDamage, b.slamSlow ?? 0);
      }
      e.mode[i] = 0;
      e.stun[i] = 24;
    }
    return;
  }
  if (mode === BOSS_ROAR) {
    if (--e.wind[i] === 0) {
      bossRoar(s, i, b, enraged);
      e.mode[i] = 0;
      e.stun[i] = 28;
    }
    return;
  }
  if (mode === BOSS_SPECIAL) {
    const mv = (b.moves ?? LEGACY_BOSS_MOVES)[e.rem[i]];
    if (mv?.kind === 'special' && --e.wind[i] === 0) {
      fireSpecialOf(s, i, mv.special, target);
      e.mode[i] = 0;
      e.stun[i] = 20; // a beat to recover
      e.cool2[i] = enraged ? b.specialGapEnraged : b.specialGap; // the boss's own pacing, not the special's
    } else if (mv?.kind !== 'special') e.mode[i] = 0;
    return;
  }
  if (mode === BOSS_SMASH) {
    if (--e.wind[i] === 0) {
      // The club comes down where the hero is *now*; stepping out of reach in time dodges it.
      for (let k = 0; k < s.players.length; k++) {
        const p = s.players[k];
        if (!p.active || p.downed) continue;
        const dx = e.x[p.ent] - e.x[i], dy = e.y[p.ent] - e.y[i];
        const r = def.radius + def.reach + 6;
        if (dx * dx + dy * dy <= r * r) hurtPlayer(s, k, def.damage);
      }
      emit(s.events, Ev.Slam, e.x[i] + (e.face[i] > 0 ? 1 : -1) * (def.radius + 8), e.y[i], 26);
      e.mode[i] = 0;
      e.atk[i] = def.atkCooldown;
    }
    return;
  }

  // Free to act: when it is time, draw a move; otherwise smash what is close or walk toward the party.
  if (e.cool2[i] === 0) {
    e.cool2[i] = enraged ? b.specialGapEnraged : b.specialGap;
    if (pickBossMove(s, i, def, b, target, dist, dirX, dirY, edge, enraged)) return;
  }
  if (edge <= def.reach && e.atk[i] === 0) {
    e.mode[i] = BOSS_SMASH;
    e.wind[i] = def.windup;
  } else if (edge > def.reach * 0.7) {
    const speed = def.speed * (enraged ? b.enrageSpeed : 1);
    e.x[i] = clamp(e.x[i] + dirX * speed, 0, WORLD_W);
    e.y[i] = clamp(e.y[i] + dirY * speed, 14, WORLD_H - 14);
  }
}

/** How far along the level the camera is (0 at the start, 1 once the last screen before the boss is reached): drives the enemy mix. */
function levelProgress(s: GameState): number {
  return clamp(s.camX / (WORLD_W - VIEW_W), 0, 1);
}

/** Px beyond a screen edge within which a mob already counts as in view (its sprite is partly visible). */
const HOLD_MARGIN = 8;

function onScreenX(s: GameState, x: number): boolean {
  return x > s.camX + 6 && x < s.camX + VIEW_W - 6;
}

function awakeCount(s: GameState): number {
  const e = s.ents;
  let n = 0;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && !isBossType(e.sub[i])) n++;
  return n;
}

/** One tick of a bull charge: rush along the locked direction, flatten whatever is in the way. */
function chargeStep(s: GameState, i: number, c: ChargeDef, def: MobDef): void {
  const e = s.ents;
  const step = Math.min(e.rem[i], c.speed);
  const x0 = e.x[i], y0 = e.y[i];
  e.x[i] = clamp(x0 + e.ax[i] * step, 0, WORLD_W);
  e.y[i] = clamp(y0 + e.ay[i] * step, 0, WORLD_H);
  const mx = e.x[i] - x0, my = e.y[i] - y0;
  e.rem[i] -= step;
  if (Math.sqrt(mx * mx + my * my) < step * 0.5) e.rem[i] = 0; // ran into the edge of the world
  if (e.ax[i] > 0.1) e.face[i] = 1;
  else if (e.ax[i] < -0.1) e.face[i] = -1;
  e.vx[i] = 0;
  e.vy[i] = 0;
  if ((s.tick & 1) === 0) emit(s.events, Ev.Dust, e.x[i], e.y[i], e.ax[i], e.ay[i]);

  // Trample the hero.
  for (let k = 0; k < s.players.length; k++) {
    const p = s.players[k];
    if (!p.active || p.downed) continue;
    const dx = e.x[p.ent] - e.x[i], dy = e.y[p.ent] - e.y[i];
    const r = def.radius + 5;
    if (dx * dx + dy * dy <= r * r) hurtPlayer(s, k, c.damage);
  }
  // Plow through the rest of the horde (a boss does not flatten its own supporters).
  const n = def.behavior === Behavior.Boss ? 0 : gatherCircle(s.grid, e, e.x[i], e.y[i], 9, s.scratch);
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (m === i || !isLiveMob(e, m) || e.mode[m] === 2) continue;
    damageMob(s, m, 3, e.ax[i], e.ay[i], 4, -1, 0);
  }

  if (e.rem[i] <= 0) {
    e.mode[i] = 0;
    e.stun[i] = c.dazed; // winded: helpless for a moment
    e.cool[i] = c.cooldown;
    e.rem[i] = 0;
  }
}

/** Offscreen margin a retreating mob must clear before it is gone. */
const EXIT_MARGIN = 48;

/**
 * After a party wipe the survivors lose interest and wander off in a random direction. Left/right
 * exits are judged against the camera (not the world), so a mob at either end of the map can still
 * walk off the flank instead of piling up against the clamp.
 */
function retreatMobs(s: GameState): void {
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Mob) continue;
    if ((e.flags[i] & 8) === 0) {
      const turns = rngFloat(s.rngSpawn);
      e.ax[i] = cosTurns(turns);
      e.ay[i] = sinTurns(turns);
      // Leaving over the top is the arrival played backwards: flag 2 makes the renderer draw the slope and the far side of the hill.
      e.flags[i] = e.ay[i] < 0 ? e.flags[i] | 8 | 2 : (e.flags[i] | 8) & ~2;
      e.mode[i] = 0;
      e.stun[i] = 0;
      e.wind[i] = 0;
      if (e.ax[i] > 0.05) e.face[i] = 1;
      else if (e.ax[i] < -0.05) e.face[i] = -1;
    }
    if (e.hurt[i] > 0) e.hurt[i]--;
    if (e.atk[i] > 0) e.atk[i]--;
    const speed = MOBS[e.sub[i]].speed;
    e.x[i] += e.ax[i] * speed + e.vx[i];
    e.y[i] += e.ay[i] * speed + e.vy[i];
    e.vx[i] *= 0.8;
    e.vy[i] *= 0.8;
    if (e.x[i] < s.camX - EXIT_MARGIN || e.x[i] > s.camX + VIEW_W + EXIT_MARGIN || e.y[i] < -TOP_EXIT_DEPTH || e.y[i] > WORLD_H + EXIT_MARGIN) {
      if (e.boss === i) e.boss = -1;
      freeEntity(e, i);
    }
  }
}

/** Heroes who have stood down long enough for it to take: where they stand, gathered once per tick. */
const standX = new Float64Array(4);
const standY = new Float64Array(4);
let standN = 0;

/** How far above the field a mob retreating over the hill must go to be fully hidden behind it (the renderer's RISE_RUN, plus a little). */
const TOP_EXIT_DEPTH = 64;

/** A mob in reach of a standing hero may lay down its arms; the odds depend on what it is. Returns whether it did. */
function trySurrender(s: GameState, i: number, def: MobDef): boolean {
  const chance = surrenderChance(def.name);
  if (chance === 0) return false;
  const e = s.ents;
  for (let k = 0; k < standN; k++) {
    const dx = standX[k] - e.x[i], dy = standY[k] - e.y[i];
    if (dx * dx + dy * dy > STAND_RADIUS * STAND_RADIUS) continue;
    if (rngFloat(s.rngCombat) >= chance) return false;
    e.flags[i] = (e.flags[i] | SURRENDERED) & ~1;
    e.wind[i] = 0; e.mode[i] = 0; e.stun[i] = 0;
    e.vx[i] = 0; e.vy[i] = 0;
    e.rem[i] = SURRENDER_HOLD;
    s.surrenders++;
    emit(s.events, Ev.Surrender, e.x[i], e.y[i], e.sub[i]);
    return true;
  }
  return false;
}

/** A surrendered mob kneels (until the staged beat has played, if it belongs to one), then runs from the party and is gone. */
function surrenderedStep(s: GameState, i: number, def: MobDef): void {
  const e = s.ents;
  if (e.rem[i] < 0) {
    if (s.beatPlayedTick < 0) return;
    e.rem[i] = SURRENDER_HOLD;
  }
  if (e.rem[i] > 0) {
    e.rem[i]--;
    e.x[i] = clamp(e.x[i] + e.vx[i], 0, WORLD_W);
    e.y[i] = clamp(e.y[i] + e.vy[i], 0, WORLD_H);
    e.vx[i] *= 0.8;
    e.vy[i] *= 0.8;
    return;
  }
  const away = e.x[i] < s.camX + VIEW_W / 2 ? -1 : 1;
  e.x[i] += away * def.speed * SURRENDER_FLEE;
  const up = e.y[i] < WORLD_H / 2;
  e.y[i] += (up ? -1 : 1) * def.speed * SURRENDER_FLEE * 0.4;
  e.face[i] = away;
  if (up) e.flags[i] |= 2; // leaving over the top: same hill as arriving (see retreatMobs)
  if (e.x[i] < s.camX - 24 || e.x[i] > s.camX + VIEW_W + 24 || e.y[i] < -TOP_EXIT_DEPTH || e.y[i] > WORLD_H + 14) {
    s.spared[e.sub[i]]++;
    freeEntity(e, i);
  }
}

let vanishedN = 0;

/** Nothing visible to hunt (the only standing player has vanished): shuffle about in a slow, random-ish heading. */
function confusedStep(s: GameState, i: number, def: MobDef): void {
  const e = s.ents;
  if (e.stun[i] > 0) e.stun[i]--;
  e.wind[i] = 0;
  if (e.mode[i] === 1 || e.mode[i] === 2) e.mode[i] = 0;
  const epoch = (s.tick + i * 11) >> 5;
  const h = Math.imul(epoch * 2654435761 + i * 40503, 2246822519) >>> 0;
  let mvX = 0, mvY = 0;
  // roughly a third of the time they just stand and look around
  if ((h & 3) !== 0) {
    const t = ((h >>> 8) & 255) / 256;
    mvX = cosTurns(t) * def.speed * 0.45;
    mvY = sinTurns(t) * def.speed * 0.45;
    if (mvX > 0.05) e.face[i] = 1;
    else if (mvX < -0.05) e.face[i] = -1;
  }
  e.x[i] = clamp(e.x[i] + mvX + e.vx[i], s.camX - LEFT_BEHIND + 2, WORLD_W);
  e.y[i] = clamp(e.y[i] + mvY * 0.6 + e.vy[i], 0, WORLD_H);
  e.vx[i] *= 0.8;
  e.vy[i] *= 0.8;
}

function updateMobs(s: GameState): void {
  const e = s.ents;
  const g = s.grid;
  const players = s.players;
  standN = 0;
  vanishedN = 0;
  for (const p of players) if (p.active && !p.downed && p.vanishT > 0) vanishedN++;
  if (s.surrender) {
    for (const p of players) {
      if (p.active && !p.downed && p.standT >= STAND_TICKS) { standX[standN] = e.x[p.ent]; standY[standN] = e.y[p.ent]; standN++; }
    }
  }

  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Mob) continue;
    if (e.x[i] < s.camX - LEFT_BEHIND) {
      // Cleared ground stays cleared: whatever is left far behind the screen is gone.
      if (e.flags[i] & SURRENDERED) s.spared[e.sub[i]]++;
      freeEntity(e, i);
      continue;
    }
    if (e.hurt[i] > 0) e.hurt[i]--;
    if (e.atk[i] > 0) e.atk[i]--;

    const def = MOBS[e.sub[i]];
    const x = e.x[i], y = e.y[i];
    if (e.buff[i] > 0) {
      e.buff[i]--;
      if (e.atk[i] > 0 && (s.tick & 1) === 0) e.atk[i]--; // rallied: attacks come around faster too
    }
    if (e.cool[i] > 0 && !def.charge) e.cool[i]--; // a frost-shaman's ward wearing off
    if (def.regen && e.hurt[i] === 0 && e.hp[i] < e.maxhp[i]) e.hp[i] = Math.min(e.maxhp[i], e.hp[i] + def.regen);
    if (def.berserk !== undefined && e.hp[i] <= e.maxhp[i] * def.berserk) {
      if (!(e.flags[i] & BERSERK)) {
        e.flags[i] |= BERSERK;
        e.mode[i] = 0;
        e.wind[i] = 0;
        emit(s.events, Ev.Burst, e.x[i], e.y[i], 30, BurstStyle.Scream);
      }
      e.buff[i] = 2; // enraged: the drummer's frenzy, but of its own making
    }
    if (hasSpecial(def)) {
      if (!(e.flags[i] & SP_INIT)) {
        // first tick alive: stagger the first use so a crowd of casters does not all act at once
        e.flags[i] |= SP_INIT;
        e.cool2[i] = 30 + ((Math.imul(i, 2654435761) >>> 20) % Math.max(1, def.special!.cooldown >> 1));
      }
      if (e.cool2[i] > 0) e.cool2[i]--;
    }

    if (e.flags[i] & BYSTANDER) {
      // Stands by its fire: never targets, chases or attacks. Only being hit moves it (knockback decays as usual).
      if (e.stun[i] > 0) e.stun[i]--;
      e.x[i] = clamp(x + e.vx[i], 0, WORLD_W);
      e.y[i] = clamp(y + e.vy[i], 0, WORLD_H);
      e.vx[i] *= 0.8;
      e.vy[i] *= 0.8;
      continue;
    }

    if (e.flags[i] & SURRENDERED) { surrenderedStep(s, i, def); continue; }

    // Nearest standing player (a vanished rogue is skipped; with nobody else to go for, mobs mill about).
    let target = -1;
    let best = Infinity;
    for (let k = 0; k < players.length; k++) {
      const p = players[k];
      if (!p.active || p.downed || p.vanishT > 0) continue;
      const dx = e.x[p.ent] - x, dy = e.y[p.ent] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; target = k; }
    }
    if (target < 0) {
      if (vanishedN > 0) confusedStep(s, i, def);
      continue;
    }

    // Awake from the moment it exists; it holds until it is in view (see HOLD_MARGIN) or the party advances.
    e.flags[i] |= 1;

    const tx = e.x[players[target].ent] - x, ty = e.y[players[target].ent] - y;
    const dist = Math.sqrt(best);
    const inv = dist > 0.001 ? 1 / dist : 0;
    const dirX = tx * inv, dirY = ty * inv;

    if (e.flags[i] & 2) {
      // Walking in over the top or bottom edge: head straight for the field, and only
      // count as "on the field" (and subject to its limits) once fully inside it.
      const inward = y < WORLD_H / 2 ? 1 : -1;
      e.y[i] = y + inward * def.speed * 1.7;
      e.x[i] = clamp(x + dirX * def.speed * 0.6, 0, WORLD_W);
      if (tx > 1) e.face[i] = 1;
      else if (tx < -1) e.face[i] = -1;
      // top entrants finish the descent of the near slope first; bottom entrants just need to be inside
      if (inward > 0 ? e.y[i] >= TOP_ENTRY_DEPTH : e.y[i] <= WORLD_H - 3) e.flags[i] &= ~2;
      continue;
    }

    // Held until the party advances: a mob still ahead of the screen stays put (spawns are triggered by
    // forward progress). Once any part of it is on screen it hunts as usual, and anything the party has
    // passed or knocked off the left edge comes back. Mid-move mobs finish the move.
    if (
      x > s.camX + VIEW_W + HOLD_MARGIN &&
      e.stun[i] === 0 && e.mode[i] === 0 && e.wind[i] === 0 &&
      e.vx[i] * e.vx[i] + e.vy[i] * e.vy[i] < 0.01
    ) continue;

    if (def.aura) {
      // a permafrost around it: heroes inside are chilled and frostbitten
      const au = def.aura;
      for (let k = 0; k < players.length; k++) {
        const pk = players[k];
        if (!pk.active || pk.downed) continue;
        const ax = e.x[pk.ent] - x, ay = (e.y[pk.ent] - y) * 1.3;
        if (ax * ax + ay * ay > au.radius * au.radius) continue;
        if (au.slow > pk.slowT) pk.slowT = au.slow;
        if ((s.tick + i) % au.pulse === 0) hurtPlayer(s, k, au.damage, 0, HURT_DOT);
      }
    }
    if (e.mode[i] === SP_CLING) { clingStep(s, i, def); continue; }

    if (s.surrender && standN > 0 && e.mode[i] !== 2 && trySurrender(s, i, def)) continue;

    if (def.charge) {
      if (e.cool[i] > 0) e.cool[i]--;
      if (e.mode[i] === 2) {
        chargeStep(s, i, def.charge, def);
        continue; // a charge ignores separation, stun and everything else until it ends
      }
    }
    if (def.behavior === Behavior.Boss) {
      bossStep(s, i, def, target, dist, dirX, dirY, tx);
      continue; // the boss runs its own scheduler and is not pushed around by the crowd
    }

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

    let packMul = 1;
    if (def.pack) {
      // a pack hunts harder: every packmate close by (up to three) adds to its speed and its bite
      const n = gatherCircle(s.grid, e, x, y, def.pack.radius, s.scratch);
      let mates = 0;
      for (let k = 0; k < n && mates < 3; k++) { const m = s.scratch[k]; if (m !== i && e.alive[m] === 1 && e.kind[m] === Kind.Mob && e.sub[m] === e.sub[i]) mates++; }
      packMul = 1 + def.pack.bonus * mates;
    }
    const speed = def.speed * packMul * (0.85 + (Math.imul(i, 2654435761) >>> 28) / 15 * 0.3) * (e.buff[i] > 0 ? RALLY_SPEED : 1);
    let mvX = 0, mvY = 0;
    let detonated = false;

    if (e.stun[i] > 0) {
      e.stun[i]--;
    } else if (e.mode[i] === SP_WIND) {
      // Mid-telegraph: planted in place until the move happens.
      if (--e.wind[i] <= 0) fireSpecial(s, i, def, target);
    } else if (
      def.special && e.mode[i] === 0 && e.wind[i] === 0 && e.cool2[i] === 0 &&
      startSpecial(s, i, def, target, dist, dirX, dirY)
    ) {
      // wound up: it stops walking while the move telegraphs
    } else if (def.behavior === Behavior.Melee) {
      const ch = def.charge;
      if (def.retreat !== undefined && e.rem[i] > 0 && e.wind[i] === 0) {
        // hit and run: it has bitten, and now darts away before coming back
        e.rem[i]--;
        mvX = -dirX * speed;
        mvY = -dirY * speed;
      } else if (ch && e.mode[i] === 1) {
        // Pawing the ground: the direction is locked, so sidestepping or dashing it works.
        if (--e.wind[i] === 0) {
          e.mode[i] = 2;
          e.rem[i] = ch.distance;
          emit(s.events, Ev.Charge, x, y, e.ax[i], e.ay[i]);
        }
      } else if (
        ch && e.mode[i] === 0 && e.wind[i] === 0 && e.cool[i] === 0 &&
        dist >= ch.minRange && dist <= ch.maxRange && x > s.camX + 4 && x < s.camX + VIEW_W - 4 &&
        rngFloat(s.rngCombat) < ch.chance
      ) {
        e.mode[i] = 1;
        e.wind[i] = ch.windup;
        e.ax[i] = dirX;
        e.ay[i] = dirY;
      } else if (e.wind[i] > 0) {
        if (--e.wind[i] === 0) {
          // Strike lands where the player is *now*; stepping away in time dodges it.
          if (dist <= def.reach + 4) {
            const hp = players[target];
            const open = hp.invuln === 0 && !hp.downed;
            hurtPlayer(s, target, def.damage * packMul * ((e.flags[i] & BERSERK) ? 1.5 : 1), def.slowOnHit ?? 0);
            if (def.launch && open) shovePlayer(s, target, dirX, dirY, def.launch);
            if (def.retreat !== undefined) e.rem[i] = def.retreat;
          }
          e.atk[i] = def.atkCooldown;
        }
      } else if (dist <= def.reach && e.atk[i] === 0) {
        e.wind[i] = def.windup;
      } else if (dist > def.reach * 0.9) {
        mvX = dirX * speed;
        mvY = dirY * speed;
      }
    } else if (def.behavior === Behavior.Caster) {
      // Keeps a standoff like an archer and lets its special do the work; walks into view first.
      if (!onScreenX(s, x) || dist > def.reach * 1.1) { mvX = dirX * speed; mvY = dirY * speed; }
      else if (dist < def.reach * 0.6) { mvX = -dirX * speed; mvY = -dirY * speed; }
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
    if (def.weave && (mvX !== 0 || mvY !== 0)) {
      // zig-zag: a sideways wobble that is out of step from mob to mob
      const wv = cosTurns(((s.tick * 2 + i * 13) & 127) / 128) * def.weave;
      mvX += -dirY * speed * wv;
      mvY += dirX * speed * wv;
    }

    if (tx > 1) e.face[i] = 1;
    else if (tx < -1) e.face[i] = -1;

    // (from the slot, not the tick's starting `x`/`y`: a blink has moved it since)
    e.x[i] = clamp(e.x[i] + mvX + sepX + e.vx[i], 0, WORLD_W);
    e.y[i] = clamp(e.y[i] + mvY + sepY + e.vy[i], 0, WORLD_H);
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
      const value = Math.round(e.sub[i] * goldMul(s.players[target].ranks));
      s.gold += value;
      s.players[target].coins += value;
      emit(s.events, Ev.Coin, e.x[i], e.y[i], value);
      freeCoin(s, i);
    } else if (dist < COIN_MAGNET) {
      const pull = 1.4 + (1 - dist / COIN_MAGNET) * 4.6;
      const pe = s.players[target].ent;
      e.x[i] += ((e.x[pe] - e.x[i]) / dist) * pull;
      e.y[i] += ((e.y[pe] - e.y[i]) / dist) * pull;
      e.z[i] = e.z[i] > 0 ? e.z[i] * 0.8 : 0;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Reinforcements: keep pressure on so there are no lulls between the authored clumps.

function runDirector(s: GameState, advance: number): void {
  s.spawnTimer -= advance;
  if (s.spawnTimer > 0) return;
  s.spawnTimer = REINFORCE_INTERVAL;
  const e = s.ents;
  let awake = 0;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && (e.flags[i] & 1)) awake++;
  const scale = partyScale(activePlayers(s));
  if (awake >= REINFORCE_FLOOR * scale || e.capacity - e.count < 300) return;
  if (s.camX > WORLD_W - VIEW_W - 100) return;

  // Top-up packs arrive from ahead, past the right edge of the screen.
  const r = s.rngSpawn;
  const t = levelProgress(s);
  const size = Math.round((6 + Math.floor(t * 10)) * scale);
  for (let k = 0; k < size; k++) {
    const type = pickMobType(r, t, s.biome);
    const i = allocEntity(e, Kind.Mob, type, s.camX + VIEW_W + 24 + rngRange(r, 0, 40), rngRange(r, 6, WORLD_H - 6), MOBS[type].hp);
    if (i < 0) return;
    e.flags[i] = 1;
    e.face[i] = -1;
  }
}

// ---------------------------------------------------------------------------------------------
// Flank waves: packs that pour in over the top and bottom edges, in front of the party, so the
// pressure comes from every side and not just from the right.

function frontOfParty(s: GameState): number {
  let front = -1;
  for (const p of s.players) {
    if (p.active && !p.downed && s.ents.x[p.ent] > front) front = s.ents.x[p.ent];
  }
  return front;
}

function spawnFlankPack(s: GameState, top: boolean, size: number, t: number, lo: number, hi: number): void {
  const r = s.rngSpawn;
  const e = s.ents;
  const packX = rngRange(r, lo, hi);
  // A big wave is a broad front that trickles in, not one lump: wider, and strung out in depth.
  const spreadX = 34 + size * 0.7;
  const stagger = 28 + size * 0.9;
  for (let k = 0; k < size; k++) {
    const type = pickMobType(r, t, s.biome);
    const x = clamp(packX + rngRange(r, -spreadX, spreadX), lo - 12, hi);
    const y = top ? -10 - rngRange(r, 0, stagger) : WORLD_H + 26 + rngRange(r, 0, stagger);
    const i = allocEntity(e, Kind.Mob, type, x, y, MOBS[type].hp);
    if (i < 0) return;
    e.flags[i] = 3; // awake + "entering": walks in, then is confined to the field like everyone else
    e.face[i] = rngFloat(r) < 0.5 ? 1 : -1;
  }
}

function runFlanks(s: GameState, advance: number): void {
  s.flankTimer -= advance;
  if (s.flankTimer > 0) return;
  const e = s.ents;
  const t = levelProgress(s);
  // Waves come faster deeper into the battlefield.
  s.flankTimer = FLANK_INTERVAL - FLANK_INTERVAL_DEEP * t;
  if (e.capacity - e.count < 300 || s.camX > WORLD_W - VIEW_W - 100) return;
  const front = frontOfParty(s);
  if (front < 0) return;

  const r = s.rngSpawn;
  const scale = partyScale(activePlayers(s));
  const size = Math.round((FLANK_SIZE + Math.floor(t * FLANK_SIZE_DEEP) + rngInt(r, 10)) * scale);
  // "In front of the players": between the lead hero and the right edge of the screen.
  const hi = s.camX + VIEW_W - 8;
  const lo = Math.min(front + 30, hi - 60);
  const roll = rngFloat(r);
  if (roll < 0.3) {
    // pincer: both edges at once
    spawnFlankPack(s, true, Math.ceil(size / 2), t, lo, hi);
    spawnFlankPack(s, false, Math.ceil(size / 2), t, lo, hi);
  } else {
    spawnFlankPack(s, roll < 0.65, size, t, lo, hi);
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

/** A staged beat (docs/12-story.md) has played once the lead hero has walked up to it. */
function checkBeat(s: GameState): void {
  if (s.beatIndex < 0 || s.beatPlayedTick >= 0 || s.nextClump <= s.beatIndex) return;
  const c = s.plan[s.beatIndex];
  if (leadX(s) < c.x - BEAT_REACH) return;
  s.beatPlayedTick = s.tick;
  emit(s.events, Ev.Beat, c.x, c.y);
}

function checkEnd(s: GameState): void {
  const e = s.ents;
  const bossFight = hasBoss(s);
  let anyActive = false;
  let allDown = true;
  for (const p of s.players) {
    if (!p.active) continue;
    anyActive = true;
    if (!p.downed) {
      allDown = false;
      // With a boss, the run is won by killing it, not by reaching the end.
      if (!bossFight && e.x[p.ent] >= WORLD_W - 70) { s.phase = Phase.Won; return; }
    }
  }
  if (anyActive && allDown) { s.phase = Phase.Lost; return; }
  // The boss is down: give the party a few seconds to gather the loot, then the battle is won.
  if (bossFight && s.bossDeadTick >= 0 && s.tick - s.bossDeadTick >= 180) s.phase = Phase.Won;
}
