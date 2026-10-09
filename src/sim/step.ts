// One fixed simulation tick. Pure function of (state, inputs); no platform access.
import { CLASSES, type ArrowDef, type ClassDef, type RainDef, type Swing } from '../data/classes';
import { ARROW_DAMAGE, ARROW_SPEED, ARROW_TTL, BLAST_RADIUS, Behavior, LEGACY_BOSS_MOVES, ProjStyle, MOBS, MobType, isBossType, type BossDef, type ChargeDef, type MobDef } from '../data/mobs';
import { clamp, cosTurns, sinTurns } from '../engine/math';
import { rngFloat, rngInt, rngRange } from '../engine/rng';
import { Btn, type InputFrame } from './input';
import { TOP_ENTRY_DEPTH, VIEW_W, WORLD_H, WORLD_W } from './constants';
import { allocEntity, BERSERK, BYSTANDER, freeEntity, Kind, SURRENDERED, ZoneKind } from './entities';
import { rainLandTick, rainOffset } from './rain';
import { ARC_PER_RANK, costMul, DODGE_CHAIN_COOLDOWN, DODGE_CHAIN_WINDOW, DODGE_POWER, DODGE_QUICK, DODGE_REACH, LANE_TURN, NOVA_ECHO_POWER, NOVA_ECHO_TICKS, NOVA_QUICK, NOVA_SIZE, novaCost, POWER_PER_RANK, RAIN_PER_COUNT, QUICK_MELEE, QUICK_RANGED, rankOf, SIZE_MELEE, SIZE_RANGED, type AbilityKind } from './abilityMods';
import { damageMul, goldMul, MAX_LEVEL, OFFER_SIZE, offerFor, speedMul, takenMul, UPGRADE_INDEX, UPGRADES, xpToNext } from '../data/upgrades';
import { STAND_RADIUS, STAND_SLOW, STAND_TICKS, SURRENDER_FLEE, SURRENDER_HOLD, surrenderChance } from '../data/surrender';
import { Ev, emit } from './events';
import { pickMobType, pickSupport } from './gen/mix';
import { BOSS_SPECIAL, BurstStyle, clingStep, dropMud, leapStep, SP_LEAP, fireSpecial, fireSpecialOf, hasSpecial, isWarded, onMobDeath, RALLY_SPEED, shovePlayer, SP_CLING, SP_INIT, SP_WIND, onScreen, startSpecial, startSpecialOf, updateZones } from './abilities';
import { cellX, cellY, gatherCircle, rebuildGrid } from './grid';
import { activatePlayer, BLAST_CAP, Phase, type GameState, type PlayerState } from './state';
import { bannerMul, burstAt, executeMul, flushProcs, frenzyTick, onAura, onDodge, onDown, onExplode, onHit, onHurt, onKill, onSpecial, pop, rebirth, tickBoons, vigilBonus, wardMul } from './boons';
import { activePlayers, hasBoss, partyScale, streamLevel } from './gen/level';

export const REVIVE_TICKS = 600;
const INPUT_BUFFER = 6;
export const PIERCE = 1;
/** A chip hit (the cleric's aura, landing every few ticks): damage and a small shove, but no stun and no interrupting a wind-up, or it would lock everything in reach in place. */
const CHIP = 2;
/** damage flag: dealt by a boon's effect, so it does not set off hit triggers again (a kill it causes still can, within the tick's budget). */
export const PROC = 4;
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
/** Potions: dropped by kills, walked over to drink (no magnet, and only a hurt hero can drink one). */
const POTION_CAP = 12;
const POTION_PICKUP = 12;
/** A potion heals this fraction of the drinker's full health. */
const POTION_HEAL = 0.3;
/** Drops are rate limited: a bigger horde must not mean more healing. Budget per second per hero, and its cap. */
const POTION_PER_SECOND = 0.1;
const POTION_BUDGET_MAX = 2;
/** A mob sliding faster than this (px/tick) bowls into whatever it touches. */
const BOWL_SPEED2 = 2.6;
const BOWL_DAMAGE = 3;
/** Walking speed of a hero who is slowed (a ghoul's claws, a scream, a poison pool). */
const SLOW_FACTOR = 0.55;
/** hurtPlayer flag: damage over time: it ignores and does not grant the brief invulnerability, and does not freeze the game. */
export const HURT_DOT = 1;
/** A hexed hero takes this much more damage. */
const HEX_TAKEN = 1.5;
/** A poisoned (or burning) hero loses a point of health every this many ticks. */
const POISON_PULSE = 24;

/** Poison (or set alight) hero `slot` for `ticks`: it bleeds a little at a time and a fresh dose only ever lengthens it. */
export function poisonPlayer(s: GameState, slot: number, ticks: number, burning = false): void {
  const p = s.players[slot];
  if (p.downed || ticks <= 0) return;
  if (ticks > p.poisonT) { p.poisonT = ticks; p.burning = burning; }
}
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

  tickBoons(s);
  passGates(s);
  rebuildGrid(s.grid, e);
  for (let slot = 0; slot < s.players.length; slot++) updatePlayer(s, slot, inputs[slot]);
  flushBlasts(s);
  updateProjectiles(s);
  updateZones(s);
  updateRain(s);
  updateMobs(s);
  updateCoins(s);
  updatePotions(s);
  // A blast can kill something that queues a boon effect, and an effect can kill a bomber: settle both queues before the tick ends.
  for (let pass = 0; pass < 4; pass++) {
    flushBlasts(s);
    flushProcs(s);
    if (s.blastN === 0 && s.procN === 0) break;
  }
  const advance = Math.max(0, s.camX - s.trigCamX);
  s.trigCamX = Math.max(s.trigCamX, s.camX);
  runDirector(s, advance);
  runFlanks(s, advance);
  updateCamera(s);
  streamLevel(s);
  checkGate(s);
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
/** Pressed while choosing: Ability 1 and 2 take cards 2 and 3 outright; Attack, Dodge and Interact (a pad's A, B and Y) take the highlighted one. */
const CONFIRM = Btn.Attack | Btn.Dodge | Btn.Interact;
const PICK_BUTTONS = CONFIRM | Btn.Ability1 | Btn.Ability2 | Btn.Level;

/**
 * Card choosing, shared by the in-level panel and the camp: the stick (or movement keys) steps a highlight along the cards, one step
 * per push (`dir` is -1/0/1 along the card layout), and a confirm button takes the highlighted card. Returns the card to take, or -1.
 */
export function pickCard(p: PlayerState, dir: number, edge: number): number {
  if (dir !== p.stickPrev) {
    if (dir !== 0) p.cursor = clamp(p.cursor + dir, 0, OFFER_SIZE - 1);
    p.stickPrev = dir;
  }
  if (edge & Btn.Ability1) return 1;
  if (edge & Btn.Ability2) return 2;
  if (edge & CONFIRM) return p.cursor;
  return -1;
}

/** Spend one pending level on offer card `card`. */
export function choosePick(s: GameState, slot: number, card: number): void {
  const p = s.players[slot];
  const levelNumber = p.level - p.pending + 1;
  const up = offerFor(s.offerSeed, slot, levelNumber, p.ranks, p.classId, { party: activePlayers(s) })[card];
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
  else if (edge & Btn.Level) { p.panel = p.panel ? false : p.pending > 0; p.cursor = 0; p.stickPrev = 0; }
  else if (p.panel) {
    const card = pickCard(p, inp.moveX > 60 ? 1 : inp.moveX < -60 ? -1 : 0, edge);
    if (card >= 0) { choosePick(s, s.players.indexOf(p), card); p.cursor = 0; }
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
  frenzyTick(s, slot);
  if (p.cdAbility1 > 0) p.cdAbility1--;
  if (p.cdDash > 0) p.cdDash--;
  if (p.cdSpecial > 0) p.cdSpecial--;
  if (p.invuln > 0) p.invuln--;
  if (p.vanishT > 0 && --p.vanishT === 0) p.invuln = Math.min(p.invuln, 8);
  if (p.silenceT > 0) p.silenceT--;
  if (p.poisonT > 0) {
    p.poisonT--;
    if (p.poisonT % POISON_PULSE === 0) hurtPlayer(s, slot, 1, 0, HURT_DOT);
    if (p.poisonT === 0) p.burning = false;
  }
  if (p.bufAbility1 > 0) p.bufAbility1--;
  if (p.bufAbility2 > 0) p.bufAbility2--;
  if (p.bufDodge > 0) p.bufDodge--;
  if (p.comboTimer > 0) p.comboTimer--;
  if (p.echoLeft > 0 && !p.downed && --p.echoT <= 0) { echoPulse(s, slot, cls); p.echoLeft--; p.echoT = NOVA_ECHO_TICKS; }
  // Stamina comes back once the regen delay (since the last spend) has passed; a winded hero is back on their
  // feet once enough has recovered.
  if (p.hexT > 0) p.hexT--;
  if (p.witherT > 0) { p.witherT--; p.staminaDelay = Math.max(p.staminaDelay, 2); } // withered: nothing comes back
  if (p.staminaDelay > 0) p.staminaDelay--;
  else p.stamina = Math.min(cls.staminaMax, p.stamina + cls.staminaRegen);
  if (p.winded && p.stamina >= cls.windedRecover) p.winded = false;
  if (e.hurt[i] > 0) e.hurt[i]--;
  if (pressed & Btn.Ability1) p.bufAbility1 = INPUT_BUFFER;
  if (pressed & Btn.Ability2) p.bufAbility2 = INPUT_BUFFER;
  if (pressed & Btn.Dodge) p.bufDodge = INPUT_BUFFER;

  if (p.downed) {
    p.downTimer -= 1 + vigilBonus(s, slot);
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

  if (p.chainT > 0 && --p.chainT === 0) p.dashChain = 0;
  const dodgeCost = cls.dashCost * costMul(p.ranks, 3);
  const dodgeReach = 1 + DODGE_REACH * rankOf(p.ranks, 3, 0);
  const powerRank = rankOf(p.ranks, 3, 3), dodgePower = 1 + DODGE_POWER * powerRank;
  if (p.dashT === 0 && p.bufDodge > 0 && p.cdDash === 0 && !p.winded && p.stamina >= dodgeCost) {
    spendStamina(s, slot, dodgeCost);
    p.dashT = cls.dashTicks;
    p.rootT = 0; // a dodge-roll tears free of a snare
    // Dodge scaling (sim/abilityMods.ts): Count chains extra dodges with a short gap; Speed shortens the long cooldown.
    if (p.chainT === 0) p.dashChain = rankOf(p.ranks, 3, 1);
    if (p.dashChain > 0) { p.dashChain--; p.cdDash = DODGE_CHAIN_COOLDOWN; p.chainT = DODGE_CHAIN_WINDOW; }
    else p.cdDash = Math.round(cls.dashCooldown * Math.max(0.4, 1 - DODGE_QUICK * rankOf(p.ranks, 3, 2)));
    p.invuln = Math.max(p.invuln, cls.dashTicks + 4);
    p.bufDodge = 0;
    if (len > 0.2) { p.dashX = mx / len; p.dashY = my / len; }
    else { p.dashX = p.faceX; p.dashY = p.faceY; }
    const kind = cls.dashKind;
    const fromX = e.x[i], fromY = e.y[i];
    emit(s.events, Ev.Dash, e.x[i], e.y[i], p.dashX, p.dashY, kind === 'charge' ? 1 : kind === 'vanish' ? 2 : kind === 'teleport' ? 3 : kind === 'heal' ? 4 : 0);
    onDodge(s, slot, e.x[i], e.y[i]);
    if (kind === 'vanish') {
      p.vanishT = Math.round((cls.dashPower ?? 90) * dodgeReach);
      p.vanishX = e.x[i];
      p.vanishY = e.y[i];
    } else if (kind === 'teleport') {
      const nx = clamp(e.x[i] + p.dashX * (cls.dashPower ?? 80) * dodgeReach, s.camX + 10, heroMaxX(s));
      const ny = clamp(e.y[i] + p.dashY * (cls.dashPower ?? 80) * dodgeReach, 2, WORLD_H - 2);
      emit(s.events, Ev.Teleport, e.x[i], e.y[i], nx, ny);
      e.x[i] = nx;
      e.y[i] = ny;
      p.invuln = Math.max(p.invuln, 14);
    } else if (kind === 'heal') {
      healPulse(s, e.x[i], e.y[i], (cls.dashRadius ?? 60) * dodgeReach, (cls.dashPower ?? 12) * dodgePower);
    }
    // Power on a dodge with no strike of its own (a blink, a vanish, a plain roll) leaves a blast where it began.
    if (kind !== 'charge' && kind !== 'heal' && powerRank > 0) burstAt(s, slot, fromX, fromY, 26 + 2 * powerRank, 2 + 2 * powerRank);
  }

  if (p.dashT > 0) {
    e.x[i] += p.dashX * cls.dashSpeed * dodgeReach;
    e.y[i] += p.dashY * cls.dashSpeed * dodgeReach;
    p.dashT--;
    if (cls.dashDamage > 0) dashPlow(s, slot, cls, dodgeReach, dodgePower);
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
      // The attack button flips the aura; while it is on it hurts everything in reach every few ticks, a constant grind, and the stamina bleeds away until it runs out.
      if (pressed & Btn.Attack && (p.auraOn || (!p.winded && p.stamina > 0))) p.auraOn = !p.auraOn;
      if (p.auraOn) {
        spendStamina(s, slot, cls.auraDrain * costMul(p.ranks, 0));
        if (p.winded) p.auraOn = false;
        else if (p.cdAttack === 0) swing(s, slot, cls, cls.combo[0], false);
      }
    }
    const acted = p.cdAttack + p.cdSpecial + p.cdAbility1;
    if (p.silenceT === 0 && p.bufAbility1 > 0 && p.cdAbility1 === 0 && p.fury >= novaCost(p.ranks, cls.novaCost, cls.furyMax)) {
      nova(s, slot, cls);
      p.bufAbility1 = 0;
    } else if (p.silenceT === 0 && p.bufAbility2 > 0 && p.cdSpecial === 0 && !p.winded && p.stamina >= cls.specialCost * costMul(p.ranks, 1) && (p.cdAttack === 0 || p.auraOn)) {
      // Ability 2: the big sweep. It costs stamina and has its own cooldown.
      spendStamina(s, slot, cls.specialCost * costMul(p.ranks, 1));
      p.cdSpecial = cls.specialShot ? cls.specialCooldown : Math.round(cls.specialCooldown * (1 - QUICK_MELEE * rankOf(p.ranks, 1, 2))); // a quicker melee special also comes round sooner
      p.bufAbility2 = 0;
      if (cls.specialShot) {
        const split = rankOf(p.ranks, 1, 1) * (cls.specialShot.count > 1 ? 2 : 1); // Split: a fan gains two arrows a rank, a single ball one more ball
        fireArrows(s, slot, cls.specialShot, cls.specialShot.count + split, cls.specialShot.spread + 0.06 * split, !!cls.specialShot.pierce, true);
        p.cdAttack = cls.specialShot.cooldown;
      } else swing(s, slot, cls, cls.special, true);
      onSpecial(s, slot);
    } else if (inp.buttons & Btn.Attack && !cls.auraDrain && p.cdAttack === 0 && !p.winded && p.stamina >= cls.attackCost * costMul(p.ranks, 0)) {
      if (cls.shot) {
        spendStamina(s, slot, cls.attackCost * costMul(p.ranks, 0));
        const twin = p.ranks[UPGRADE_INDEX.twin] + rankOf(p.ranks, 0, 1); // Twin Flame and the basic Split both add shots
        fireArrows(s, slot, cls.shot, 1 + twin, 0.05 * twin, !!cls.shot.pierce);
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
  e.x[i] = clamp(e.x[i], s.camX + 10, heroMaxX(s));
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
function fireArrows(s: GameState, slot: number, a: ArrowDef, count: number, spread: number, pierce: boolean, special = false): void {
  const p = s.players[slot];
  const e = s.ents;
  const speed = a.speed * (1 + QUICK_RANGED * rankOf(p.ranks, special ? 1 : 0, 2));
  for (let k = 0; k < count; k++) {
    const t = count === 1 ? 0 : (k / (count - 1) - 0.5) * spread;
    const c = cosTurns(t), sn = sinTurns(t);
    const dx = p.faceX * c - p.faceY * sn, dy = p.faceX * sn + p.faceY * c;
    const q = allocEntity(e, Kind.Proj, 1 + slot, e.x[p.ent], e.y[p.ent], a.ttl);
    if (q < 0) break;
    e.vx[q] = dx * speed;
    e.vy[q] = dy * speed;
    e.flags[q] = (pierce ? 2 : 0) | (special ? 4 : 0);
  }
  emit(s.events, Ev.Fire, e.x[p.ent], e.y[p.ent], p.faceX, p.faceY);
}

/** A fireball landing: everything within `a.splash` px (except the mob it struck, already hurt) takes damage and is shoved outward. */
function explodeShot(s: GameState, owner: number, a: ArrowDef, x: number, y: number, struck: number, scale = 1): void {
  const e = s.ents;
  const pl = s.players[owner];
  const cls = CLASSES[pl.classId];
  const ab: AbilityKind = a === cls.specialShot ? 1 : 0;
  const radius = (a.splash ?? 0) * scale * (1 + SIZE_RANGED * rankOf(pl.ranks, ab, 0));
  const power = 1 + POWER_PER_RANK * rankOf(pl.ranks, ab, 3);
  emit(s.events, Ev.Blast, x, y, radius);
  onExplode(s, owner, x, y, radius, a.damage * power * (a.splashDamage ?? 0.55) * scale);
  const n = gatherCircle(s.grid, e, x, y, radius, s.scratch);
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (m === struck || !isLiveMob(e, m)) continue;
    const dx = e.x[m] - x, dy = e.y[m] - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    // the blast's edge is weaker than a direct hit
    const r = damageMob(s, m, a.damage * power * (a.splashDamage ?? 0.55) * scale, d > 0.001 ? dx / d : 1, d > 0.001 ? dy / d : 0, a.knock * 0.7, owner, 0);
    if (r === 1) pl.fury = Math.min(cls.furyMax, pl.fury + cls.furyPerHit);
  }
}

function cleave(s: GameState, slot: number, cls: ClassDef): void {
  const p = s.players[slot];
  const idx = p.comboTimer > 0 ? (p.combo + 1) % cls.combo.length : 0;
  const sw = cls.combo[idx];
  p.combo = idx;
  spendStamina(s, slot, cls.attackCost * costMul(p.ranks, 0));
  swing(s, slot, cls, sw, false);
}

/**
 * The rogue's damage multiplier against `m` (`dx` = the mob's x offset from him): a strike out of a vanish always lands as an ambush;
 * otherwise it is a backstab when the mob faces the same way as the line from him to it, i.e. away from him.
 */
function flankMul(s: GameState, p: PlayerState, cls: ClassDef, m: number, dx: number): number {
  const keen = 0.5 * p.ranks[UPGRADE_INDEX.keen];
  if (p.vanishT > 0 && cls.ambush) return cls.ambush + keen;
  if (cls.backstab && dx * s.ents.face[m] > 0) return cls.backstab + keen;
  return 1;
}

/** One sweep of the weapon: arc hits, an optional wave down the field, fury, hit-stop. `heavy` is the special. */
function swing(s: GameState, slot: number, cls: ClassDef, sw: Swing, heavy: boolean): void {
  const p = s.players[slot];
  const e = s.ents;
  // Ability scaling (sim/abilityMods.ts): the basic attack and the special each grow along size, count, speed and power.
  const ab: AbilityKind = heavy ? 1 : 0;
  const reach = 1 + SIZE_MELEE * rankOf(p.ranks, ab, 0);
  const range = sw.range * reach, wave = sw.wave * reach, waveWidth = sw.waveWidth * reach;
  const split = rankOf(p.ranks, ab, 1);
  const dot = sw.aoe ? sw.dot : Math.max(-1, sw.dot - ARC_PER_RANK * split);
  const damage = sw.damage * (1 + POWER_PER_RANK * rankOf(p.ranks, ab, 3));
  const cooldown = Math.max(Math.ceil(sw.cooldown / 2), Math.round(sw.cooldown * (1 - QUICK_MELEE * rankOf(p.ranks, ab, 2))));
  p.cdAttack = cooldown;
  p.comboTimer = cooldown + cls.comboWindow;
  p.lungeT = sw.aoe ? 0 : sw.lunge;
  const cx = e.x[p.ent], cy = e.y[p.ent];
  // Facing scaled by range so the presentation can size the slash arc; c = arc dot.
  if (sw.aoe) { if (heavy) emit(s.events, Ev.Pulse, cx, cy, range, 1, 0, slot); } // (the cleric's plain aura has no per-hit burst: the renderer draws it turning)
  else emit(s.events, heavy ? Ev.Finisher : Ev.Swing, cx, cy, p.faceX * range, p.faceY * range, dot, slot);

  const n = gatherCircle(s.grid, e, cx, cy, range, s.scratch);
  let hits = 0;
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (!isLiveMob(e, m)) continue;
    const dx = e.x[m] - cx, dy = e.y[m] - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (!sw.aoe && dist > 6 && dx * p.faceX + dy * p.faceY < dot * dist) continue;
    const inv = dist > 0.001 ? 1 / dist : 0;
    const flank = flankMul(s, p, cls, m, dx);
    const r = damageMob(s, m, damage * flank, dist > 0.001 ? dx * inv : p.faceX, dist > 0.001 ? dy * inv : p.faceY, sw.knock, slot, (sw.pierce ? PIERCE : 0) | (sw.aoe && !heavy ? CHIP : 0));
    if (r === 1) { hits++; if (flank > 1) s.gold += p.ranks[UPGRADE_INDEX.pick]; } // Pickpocket
  }

  // Finisher: a straight wave that carves down the field, shoving everything along the line. Split adds a pair of forked lanes a rank.
  if (wave > 0) {
    const laneN = 1 + 2 * split;
    const lx = Lanes.x, ly = Lanes.y;
    for (let l = 0; l < laneN; l++) {
      const turn = l === 0 ? 0 : (l % 2 === 1 ? 1 : -1) * Math.ceil(l / 2) * LANE_TURN;
      const c = cosTurns(turn), sn = sinTurns(turn);
      lx[l] = p.faceX * c - p.faceY * sn;
      ly[l] = p.faceX * sn + p.faceY * c;
      emit(s.events, Ev.Wave, cx, cy, lx[l] * wave, ly[l] * wave);
    }
    const wn = gatherCircle(s.grid, e, cx, cy, wave, s.scratch);
    for (let k = 0; k < wn; k++) {
      const m = s.scratch[k];
      if (!isLiveMob(e, m) || e.hurt[m] >= 6) continue; // already caught by the arc this tick
      const dx = e.x[m] - cx, dy = e.y[m] - cy;
      for (let l = 0; l < laneN; l++) {
        const along = dx * lx[l] + dy * ly[l];
        if (along < 0 || along > wave) continue;
        const lateral = dx * -ly[l] + dy * lx[l];
        if (lateral > waveWidth || lateral < -waveWidth) continue;
        const r = damageMob(s, m, damage * 0.6 * flankMul(s, p, cls, m, dx), lx[l], ly[l], sw.knock * 0.8, slot, PIERCE);
        if (r === 1) hits++;
        break;
      }
    }
  }

  destroyArrows(s, cx, cy, range, p.faceX, p.faceY, sw.aoe ? -2 : dot);
  if (sw.aoe && !heavy) onAura(s, slot, hits);
  if (hits > 0) {
    p.fury = Math.min(cls.furyMax, p.fury + Math.min(cls.furyPerSwingCap, hits * cls.furyPerHit));
    if (!(sw.aoe && !heavy)) stop(s, Math.min(6, sw.hitStop + Math.floor(hits / 5))); // (the constant aura never freezes the game)
  }
}

function nova(s: GameState, slot: number, cls: ClassDef): void {
  const p = s.players[slot];
  if (cls.rain) { castRain(s, slot, cls, cls.rain); return; }
  if (cls.quake) { castQuake(s, slot, cls, cls.quake); return; }
  const big = p.fury >= cls.furyMax;
  p.fury = big ? 0 : p.fury - novaCost(p.ranks, cls.novaCost, cls.furyMax);
  p.cdAbility1 = novaRecovery(p, cls);
  radialBlast(s, slot, cls, big, 1);
  // Count: the nova pulses again, a little weaker each time (see echoPulse).
  p.echoLeft = rankOf(p.ranks, 2, 1);
  p.echoT = NOVA_ECHO_TICKS;
  p.echoBig = big;
}

/** The nova's ability-1 cooldown, shortened by its Speed ranks. */
function novaRecovery(p: PlayerState, cls: ClassDef): number {
  return Math.round(cls.novaCooldown * Math.max(0.5, 1 - NOVA_QUICK * rankOf(p.ranks, 2, 2)));
}

/** One more pulse of a radial nova, at the hero's place now. */
function echoPulse(s: GameState, slot: number, cls: ClassDef): void {
  radialBlast(s, slot, cls, s.players[slot].echoBig, NOVA_ECHO_POWER);
}

/** A ring of damage (and the cleric's healing) all round a hero: the whole of a radial nova, or an echo of it at `scale` of the strength. */
function radialBlast(s: GameState, slot: number, cls: ClassDef, big: boolean, scale: number): void {
  const p = s.players[slot];
  const e = s.ents;
  const cx = e.x[p.ent], cy = e.y[p.ent];
  const radius = (big ? cls.novaBigRadius : cls.novaRadius) * (1 + NOVA_SIZE * rankOf(p.ranks, 2, 0));
  const damage = (big ? cls.novaBigDamage : cls.novaDamage) * (1 + POWER_PER_RANK * rankOf(p.ranks, 2, 3)) * scale;
  emit(s.events, Ev.Nova, cx, cy, radius, big ? 1 : 0);
  const killsBefore = s.kills;
  const n = gatherCircle(s.grid, e, cx, cy, radius, s.scratch);
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (!isLiveMob(e, m)) continue;
    const dx = e.x[m] - cx, dy = e.y[m] - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const inv = dist > 0.001 ? 1 / dist : 0;
    damageMob(s, m, damage, dist > 0.001 ? dx * inv : 1, dist > 0.001 ? dy * inv : 0, cls.novaKnock * (big ? 1.4 : 1) * scale, slot, PIERCE);
  }
  destroyArrows(s, cx, cy, radius, 0, 0, -2);
  // The cleric's nova also heals every standing player inside it (itself included).
  const heal = (big ? (cls.novaBigHeal ?? 0) : (cls.novaHeal ?? 0)) * (1 + POWER_PER_RANK * rankOf(p.ranks, 2, 3)) * scale;
  if (heal > 0) {
    for (const q of s.players) {
      if (!q.active || q.downed) continue;
      const dx = e.x[q.ent] - cx, dy = e.y[q.ent] - cy;
      if (dx * dx + dy * dy > radius * radius) continue;
      e.hp[q.ent] = Math.min(CLASSES[q.classId].hp, e.hp[q.ent] + heal);
    }
  }
  stop(s, Math.round((4 + Math.min(4, Math.floor((s.kills - killsBefore) / 6))) * scale));
}

const Lanes = { x: new Float64Array(16), y: new Float64Array(16) };

/** The warrior's shockwave: everything in a long, narrow lane in front of him is hurt and thrown down the lane. */
function castQuake(s: GameState, slot: number, cls: ClassDef, q: NonNullable<ClassDef['quake']>): void {
  const p = s.players[slot];
  const e = s.ents;
  const cx = e.x[p.ent], cy = e.y[p.ent];
  const big = p.fury >= cls.furyMax;
  const grow = 1 + NOVA_SIZE * rankOf(p.ranks, 2, 0);
  const length = (big ? q.bigLength : q.length) * grow, width = (big ? q.bigWidth : q.width) * grow;
  const damage = (big ? cls.novaBigDamage : cls.novaDamage) * (1 + POWER_PER_RANK * rankOf(p.ranks, 2, 3));
  p.fury = big ? 0 : p.fury - novaCost(p.ranks, cls.novaCost, cls.furyMax);
  p.cdAbility1 = novaRecovery(p, cls);
  // Split Earth: the shockwave forks into extra lanes fanned either side of the facing.
  const forks = p.ranks[UPGRADE_INDEX.rift] + rankOf(p.ranks, 2, 1); // Split Earth and the nova's Count both fork the quake
  const laneN = 1 + 2 * forks;
  if (forks > 0) pop(s, slot, 'rift');
  const lx = Lanes.x, ly = Lanes.y;
  for (let l = 0; l < laneN; l++) {
    const turn = l === 0 ? 0 : (l % 2 === 1 ? 1 : -1) * Math.ceil(l / 2) * 0.09;
    const c = cosTurns(turn), sn = sinTurns(turn);
    lx[l] = p.faceX * c - p.faceY * sn;
    ly[l] = p.faceX * sn + p.faceY * c;
    emit(s.events, Ev.Quake, cx, cy, lx[l] * length, ly[l] * length, width, big ? 1 : 0);
  }
  const killsBefore = s.kills;
  const n = gatherCircle(s.grid, e, cx, cy, length + width, s.scratch);
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (!isLiveMob(e, m)) continue;
    const dx = e.x[m] - cx, dy = e.y[m] - cy;
    for (let l = 0; l < laneN; l++) {
      const fx = lx[l], fy = ly[l];
      const along = dx * fx + dy * fy;
      const lateral = dx * -fy + dy * fx;
      if (along < -6 || along > length || Math.abs(lateral) > width) continue;
      // shoved down the lane (and a little to the side it is already on), harder the nearer it is
      const push = 1 - 0.4 * (along / length);
      damageMob(s, m, damage, fx + (lateral / width) * 0.25 * -fy, fy + (lateral / width) * 0.25 * fx, cls.novaKnock * (big ? 1.4 : 1) * push, slot, PIERCE);
      break; // one lane hits a mob once
    }
  }
  for (let t = 0; t <= 4; t++) destroyArrows(s, cx + p.faceX * length * t / 4, cy + p.faceY * length * t / 4, width + 8, 0, 0, -2);
  stop(s, 4 + Math.min(4, Math.floor((s.kills - killsBefore) / 6)));
}

/**
 * The archer's rain: a zone (ZoneKind.Rain) centred `reach` px ahead of him. `ax,ay` remember where he stood (the arrows rise from
 * there), `rem` is the radius, `mode` the arrow count, `vx` the landing seed, `hp` the damage, `buff` 1 + the owner's slot and
 * `atk` the ticks since the cast.
 */
function castRain(s: GameState, slot: number, cls: ClassDef, r: RainDef): void {
  const p = s.players[slot];
  const e = s.ents;
  const big = p.fury >= cls.furyMax;
  p.fury = big ? 0 : p.fury - novaCost(p.ranks, cls.novaCost, cls.furyMax);
  p.cdAbility1 = novaRecovery(p, cls);
  const x = e.x[p.ent], y = e.y[p.ent];
  const tx = clamp(x + p.faceX * r.reach, s.camX + 10, heroMaxX(s));
  const ty = clamp(y + p.faceY * r.reach, 6, WORLD_H - 6);
  const z = allocEntity(e, Kind.Zone, ZoneKind.Rain, tx, ty, 1);
  if (z < 0) return;
  e.ax[z] = x; e.ay[z] = y;
  e.rem[z] = (big ? r.bigRadius : r.radius) * (1 + NOVA_SIZE * rankOf(p.ranks, 2, 0));
  e.mode[z] = Math.min(250, (big ? r.bigArrows : r.arrows) + RAIN_PER_COUNT * (p.ranks[UPGRADE_INDEX.downpour] + rankOf(p.ranks, 2, 1)));
  if (p.ranks[UPGRADE_INDEX.downpour] > 0) pop(s, slot, 'downpour');
  e.vx[z] = (s.tick * 2654435761 + slot * 40503) >>> 0;
  e.hp[z] = r.damage * (1 + POWER_PER_RANK * rankOf(p.ranks, 2, 3));
  e.buff[z] = 1 + slot;
  e.atk[z] = 0;
  emit(s.events, Ev.Fire, x, y, p.faceX, p.faceY);
}

/** Each arrow of a rain lands on its tick: it hurts the mobs around the spot, then lies in the ground. */
function updateRain(s: GameState): void {
  const e = s.ents;
  const off: [number, number] = [0, 0];
  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Zone || e.sub[i] !== ZoneKind.Rain) continue;
    const owner = e.buff[i] - 1, count = e.mode[i], t = e.atk[i]++;
    const r = CLASSES[s.players[owner].classId].rain;
    if (!r) { freeEntity(e, i); continue; }
    for (let n = 0; n < count; n++) {
      if (rainLandTick(n, count) !== t) continue;
      rainOffset(e.vx[i], n, e.rem[i], off);
      const ax = e.x[i] + off[0], ay = clamp(e.y[i] + off[1], 2, WORLD_H - 2);
      emit(s.events, Ev.ArrowSpent, ax, ay, 0, 1);
      const m = gatherCircle(s.grid, e, ax, ay, r.hitRadius, s.scratch);
      for (let k = 0; k < m; k++) {
        const q = s.scratch[k];
        if (!isLiveMob(e, q)) continue;
        const dx = e.x[q] - ax, dy = e.y[q] - ay;
        const d = Math.sqrt(dx * dx + dy * dy);
        const res = damageMob(s, q, e.hp[i], d > 0.001 ? dx / d : 0, d > 0.001 ? dy / d : 1, r.knock, owner, 0);
        if (res === 1) {
          const pl = s.players[owner], cl = CLASSES[pl.classId];
          pl.fury = Math.min(cl.furyMax, pl.fury + cl.furyPerHit);
        }
      }
    }
    if (t > rainLandTick(count - 1, count)) freeEntity(e, i);
  }
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

function dashPlow(s: GameState, slot: number, cls: ClassDef, reach: number, power: number): void {
  const p = s.players[slot];
  const e = s.ents;
  const cx = e.x[p.ent], cy = e.y[p.ent];
  const n = gatherCircle(s.grid, e, cx, cy, (cls.dashRadius ?? 9) * reach, s.scratch);
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (!isLiveMob(e, m) || e.stun[m] > 0) continue;
    const dx = e.x[m] - cx, dy = e.y[m] - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const inv = dist > 0.001 ? 1 / dist : 0;
    damageMob(s, m, cls.dashDamage * power, dist > 0.001 ? dx * inv : p.dashX, dist > 0.001 ? dy * inv : p.dashY, cls.dashKnock, slot, 0);
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
export function damageMob(s: GameState, m: number, dmg: number, dirX: number, dirY: number, knock: number, owner: number, flags: number): number {
  const e = s.ents;
  const def = MOBS[e.sub[m]];
  if (e.flags[m] & 2) return 0; // still walking in from off-field: immune until it has arrived
  if (def.burrow && e.rem[m] === 0) return 0; // under the ground: nothing can touch it
  if (def.evade && rngFloat(s.rngCombat) < def.evade) { // a nimble target: the blow glances off
    emit(s.events, Ev.Burst, e.x[m], e.y[m], 7, BurstStyle.Sand);
    return 0;
  }
  if (def.thorns && owner >= 0) poisonPlayer(s, owner, def.thorns); // its skin is venomous to whatever strikes it
  if (owner >= 0) dmg *= damageMul(s.players[owner].ranks) * executeMul(s, owner, m) * bannerMul(s, owner);
  if (def.shield && !(flags & PIERCE) && dirX * e.face[m] < 0 && (def.shieldHp === undefined || e.shieldHp[m] > 0)) {
    // Attacker is on the shield side: the shield takes the blow, and breaks once it has taken enough.
    e.vx[m] += dirX * knock * 0.25;
    e.hurt[m] = 2;
    e.flags[m] |= 1;
    if (owner >= 0) e.by[m] = owner;
    emit(s.events, Ev.Block, e.x[m], e.y[m], e.face[m]);
    if (def.shieldHp !== undefined) {
      e.shieldHp[m] -= dmg;
      if (e.shieldHp[m] <= 0) {
        e.shieldHp[m] = 0;
        e.stun[m] = Math.max(e.stun[m], 36); // the shock of it knocks the guard open
        e.wind[m] = 0;
        if (e.mode[m] === 1) e.mode[m] = 0;
        e.hurt[m] = 6;
        emit(s.events, Ev.Burst, e.x[m] + e.face[m] * 5, e.y[m], 16, BurstStyle.Flash);
        emit(s.events, Ev.Burst, e.x[m] + e.face[m] * 5, e.y[m], 14, BurstStyle.Bones);
        stop(s, 4);
      }
    }
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
  const armored = e.mode[m] === 2 || e.mode[m] === SP_LEAP || def.armored === true || (e.flags[m] & BERSERK) !== 0;
  if (!armored) {
    const k = knock * def.knockResist;
    e.vx[m] += dirX * k;
    e.vy[m] += dirY * k;
    if (!(flags & CHIP)) e.stun[m] = Math.round(6 + 6 * def.knockResist);
  }
  e.hurt[m] = 6;
  e.flags[m] |= 1; // being hit wakes the mob
  if (owner >= 0) e.by[m] = owner;
  if (!armored && !(flags & CHIP) && def.behavior !== Behavior.Bomber) {
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
      onKill(s, owner, e.x[m], e.y[m]);
    }
    if (def.onDeath) onMobDeath(s, m, def.onDeath, dirX, dirY);
    if (def.behavior === Behavior.Boss) bossDeath(s, m);
    else { dropLoot(s, m, dirX, dirY); dropPotion(s, m, dirX, dirY); }
    freeEntity(e, m);
  } else {
    emit(s.events, Ev.Hit, e.x[m], e.y[m], dmg);
    if (owner >= 0 && !(flags & PROC)) onHit(s, owner, m, dmg);
  }
  return 1;
}

export function hurtPlayer(s: GameState, slot: number, dmg: number, slow = 0, flags = 0): void {
  const p = s.players[slot];
  const e = s.ents;
  const dot = (flags & HURT_DOT) !== 0;
  if (p.downed || (p.invuln > 0 && !dot)) return;
  dmg *= takenMul(p.ranks) * wardMul(s, slot) * (p.hexT > 0 ? HEX_TAKEN : 1);
  if (slow > p.slowT) p.slowT = slow;
  const i = p.ent;
  const cls = CLASSES[p.classId];
  e.hp[i] -= dmg;
  e.hurt[i] = 8;
  if (!dot) p.invuln = 24;
  p.fury = Math.min(cls.furyMax, p.fury + 3); // pain feeds the rage
  if (!dot) stop(s, 2);
  emit(s.events, Ev.PlayerHurt, e.x[i], e.y[i], slot);
  if (e.hp[i] <= 0 && rebirth(s, slot)) return;
  if (e.hp[i] <= 0) {
    e.hp[i] = 0;
    p.downed = true;
    p.auraOn = false;
    p.poisonT = 0;
    p.burning = false;
    p.downTimer = REVIVE_TICKS;
    emit(s.events, Ev.PlayerDown, e.x[i], e.y[i], slot);
    onDown(s, slot);
  } else onHurt(s, slot);
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

/** A fireball that runs out of range splashes at this fraction of its normal blast radius and damage. */
const SPLASH_FIZZLE = 0.6;

/** A falcon veers toward the nearest hero who is not rolling, at a fixed turn rate, so it can be outrun or dodged but not ignored. */
function steerFalcon(s: GameState, i: number): void {
  const e = s.ents;
  let best = Infinity, tx = 0, ty = 0;
  for (const p of s.players) {
    if (!p.active || p.downed || p.dashT > 0) continue;
    const dx = e.x[p.ent] - e.x[i], dy = e.y[p.ent] - e.y[i], d2 = dx * dx + dy * dy;
    if (d2 < best) { best = d2; tx = dx; ty = dy; }
  }
  if (best === Infinity || best < 25) return;
  const sp = Math.sqrt(e.vx[i] * e.vx[i] + e.vy[i] * e.vy[i]) || 1;
  const d = Math.sqrt(best);
  const nx = e.vx[i] + (tx / d * sp - e.vx[i]) * FALCON_TURN, ny = e.vy[i] + (ty / d * sp - e.vy[i]) * FALCON_TURN;
  const nl = Math.sqrt(nx * nx + ny * ny) || 1;
  e.vx[i] = nx / nl * sp;
  e.vy[i] = ny / nl * sp;
}
const FALCON_TURN = 0.07;

function updateProjectiles(s: GameState): void {
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Proj) continue;
    if (e.sub[i] === 0 && e.mode[i] === ProjStyle.Falcon) steerFalcon(s, i);
    e.x[i] += e.vx[i];
    e.y[i] += e.vy[i];
    e.hp[i] -= 1;
    if (e.hp[i] <= 0 && e.sub[i] > 0) {
      // A player's fireball reaching the end of its range fizzles into a small splash.
      const owner = e.sub[i] - 1;
      const pl = s.players[owner];
      const a = (e.flags[i] & 4) ? CLASSES[pl.classId].specialShot : CLASSES[pl.classId].shot;
      const x = e.x[i], y = e.y[i], special = (e.flags[i] & 4) !== 0;
      freeEntity(e, i);
      if (a && a.splash) explodeShot(s, owner, a, x, y, -1, special ? 1 : SPLASH_FIZZLE); // a special runs out of range with its full blast
      else if (a) {
        const vl = Math.sqrt(e.vx[i] * e.vx[i] + e.vy[i] * e.vy[i]) || 1;
        emit(s.events, Ev.ArrowSpent, x, y, e.vx[i] / vl, e.vy[i] / vl);
      }
      continue;
    }
    if (e.hp[i] <= 0 || e.x[i] < 0 || e.x[i] > WORLD_W || e.y[i] < -4 || e.y[i] > WORLD_H + 4) {
      freeEntity(e, i);
      continue;
    }
    if (e.sub[i] > 0) {
      // A player's arrow: hits the first mob it touches (a piercing one keeps going), blocked by shields.
      const owner = e.sub[i] - 1;
      const pl = s.players[owner];
      const ocls = CLASSES[pl.classId];
      const a = (e.flags[i] & 4) ? ocls.specialShot : ocls.shot;
      if (!a) { freeEntity(e, i); continue; }
      const pierce = (e.flags[i] & 2) !== 0;
      const ab: AbilityKind = (e.flags[i] & 4) ? 1 : 0;
      const n = gatherCircle(s.grid, e, e.x[i], e.y[i], (a.radius ?? 5) * (1 + SIZE_RANGED * rankOf(pl.ranks, ab, 0)), s.scratch);
      let primary = -1;
      let spent = false;
      for (let k = 0; k < n && !spent; k++) {
        const m = s.scratch[k];
        if (!isLiveMob(e, m) || (pierce && e.hurt[m] >= 6)) continue;
        const vl = Math.sqrt(e.vx[i] * e.vx[i] + e.vy[i] * e.vy[i]) || 1;
        const flown = (a.ttl - e.hp[i]) / a.ttl; // 0 at the bow, 1 at the end of its range
        const r = damageMob(s, m, a.damage * (1 + POWER_PER_RANK * rankOf(pl.ranks, ab, 3)) * (1 + ((ocls.longShot ?? 0) + 0.4 * pl.ranks[UPGRADE_INDEX.eagle]) * flown), e.vx[i] / vl, e.vy[i] / vl, a.knock, owner, a.shieldPierce ? PIERCE : 0);
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
          if (e.cool2[i] > 0) poisonPlayer(s, slot, e.cool2[i], e.mode[i] === ProjStyle.Fire); // a glob of venom, or a burning arrow
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
    e.cool2[a] = shot?.poison ?? 0;
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
  // Two potions, flung out with the coins: the boss fight is where you earn the way into the next stretch.
  for (let k = 0; k < 2; k++) spawnPotion(s, x, y, (k ? 1 : -1) * rngRange(s.rngLoot, 0.8, 1.6), rngRange(s.rngLoot, -0.5, 0.5));
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

/** Chance per tick that a mob facing away from its target turns round, so a horde doesn't flip in lockstep with the player. */
const TURN_CHANCE = 1 / 24;

/** Face the target's side, but only on a random roll (hashed from tick and slot, so it stays deterministic and leaves the RNG streams alone). */
function turnToward(s: GameState, i: number, tx: number): void {
  const want = tx > 1 ? 1 : tx < -1 ? -1 : 0;
  const e = s.ents;
  if (want === 0 || e.face[i] === want) return;
  const h = Math.imul(s.tick * 2654435761 + i * 40503, 2246822519) >>> 0;
  if ((h >>> 8) / 16777216 < TURN_CHANCE) e.face[i] = want;
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
      if (e.mode[i] !== SP_LEAP) { // (a leap carries on in the air; leapStep lets it land)
        e.mode[i] = 0;
        e.stun[i] = 20; // a beat to recover
      }
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

/** Px within which a mob notices a vanished rogue standing right on it. */
const VANISH_CONTACT = 14;

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
        // (a trapper's is spread over one and a half cooldowns and only runs down once a hero is in its range, see below)
        const span = def.special!.kind === 'trap' ? def.special!.cooldown * 1.5 : def.special!.cooldown >> 1;
        e.cool2[i] = 30 + ((Math.imul(i, 2654435761) >>> 20) % Math.max(1, span));
      }
      // (a trapper's waits for a hero in range: otherwise a group arrives with its cooldowns long spent and sets every trap in one volley)
      if (e.cool2[i] > 0 && def.special!.kind !== 'trap') e.cool2[i]--;
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

    // Nearest standing player. A vanished rogue is not seen: mobs carry on to the spot he vanished from, and only a mob that runs
    // into him (within VANISH_CONTACT) finds him. With nobody else to go for, mobs that reach the empty spot mill about.
    let target = -1;
    let best = Infinity;
    let aimX = 0, aimY = 0;
    for (let k = 0; k < players.length; k++) {
      const p = players[k];
      if (!p.active || p.downed) continue;
      let px = e.x[p.ent], py = e.y[p.ent];
      if (p.vanishT > 0) {
        const cx = px - x, cy = py - y;
        if (cx * cx + cy * cy > VANISH_CONTACT * VANISH_CONTACT) {
          px = p.vanishX; py = p.vanishY;
          const gx = px - x, gy = py - y;
          if (gx * gx + gy * gy < VANISH_CONTACT * VANISH_CONTACT) continue; // reached the empty spot
        }
      }
      const dx = px - x, dy = py - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; target = k; aimX = px; aimY = py; }
    }
    if (target < 0) {
      if (vanishedN > 0) confusedStep(s, i, def);
      continue;
    }

    // Awake from the moment it exists.
    e.flags[i] |= 1;

    const tx = aimX - x, ty = aimY - y;
    const dist = Math.sqrt(best);
    const inv = dist > 0.001 ? 1 / dist : 0;
    const dirX = tx * inv, dirY = ty * inv;

    if (e.flags[i] & 2) {
      // Walking in over the top or bottom edge: head straight for the field, and only
      // count as "on the field" (and subject to its limits) once fully inside it.
      const inward = y < WORLD_H / 2 ? 1 : -1;
      e.y[i] = y + inward * def.speed * 1.7;
      e.x[i] = clamp(x + dirX * def.speed * 0.6, 0, WORLD_W);
      turnToward(s, i, tx);
      // top entrants finish the descent of the near slope first; bottom entrants just need to be inside
      if (inward > 0 ? e.y[i] >= TOP_ENTRY_DEPTH : e.y[i] <= WORLD_H - 3) e.flags[i] &= ~2;
      continue;
    }

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
    if (def.flame) {
      // a fire around it: a hero close by is set alight
      const fr = def.flame.radius;
      for (let k = 0; k < players.length; k++) {
        const pk = players[k];
        if (!pk.active || pk.downed) continue;
        const fx = e.x[pk.ent] - x, fy = (e.y[pk.ent] - y) * 1.3;
        if (fx * fx + fy * fy <= fr * fr) poisonPlayer(s, k, 40, true);
      }
    }
    if (def.burrow && e.rem[i] === 0) {
      // under the sand: it tunnels toward its target unseen, and rises beside it
      if (dist <= def.burrow) {
        e.rem[i] = 1;
        e.stun[i] = 16;
        emit(s.events, Ev.Burst, x, y, 12, BurstStyle.Sand);
      } else {
        e.x[i] = clamp(x + dirX * def.speed * 1.25, 0, WORLD_W);
        e.y[i] = clamp(y + dirY * def.speed * 1.25, 6, WORLD_H - 6);
      }
      turnToward(s, i, tx);
      continue;
    }
    if (e.mode[i] === SP_CLING) { clingStep(s, i, def); continue; }
    if (e.mode[i] === SP_LEAP) { leapStep(s, i, def); continue; }

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

    if (def.special && def.special.kind === 'trap' && e.cool2[i] > 0 && target >= 0 && dist <= def.special.maxRange && onScreen(s, e.x[i])) e.cool2[i]--;

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
          const hpe = players[target].ent;
          if (dist <= def.reach + 4 && Math.hypot(e.x[hpe] - e.x[i], e.y[hpe] - e.y[i]) <= def.reach + 4) { // (a swing at a decoy spot hits nothing)
            const hp = players[target];
            const open = hp.invuln === 0 && !hp.downed;
            hurtPlayer(s, target, def.damage * packMul * ((e.flags[i] & BERSERK) ? 1.5 : 1), def.slowOnHit ?? 0);
            if (def.launch && open) shovePlayer(s, target, dirX, dirY, def.launch);
            if (open && def.poisonOnHit) poisonPlayer(s, target, def.poisonOnHit);
            if (open && def.witherOnHit) hp.witherT = Math.max(hp.witherT, def.witherOnHit);
            if (open && def.drain) e.hp[i] = Math.min(e.maxhp[i], e.hp[i] + def.drain);
            if (open && def.rootOnHit) players[target].rootT = Math.max(players[target].rootT, def.rootOnHit);
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

    // Until it rolls the turn it keeps walking the way it faces, so a horde overshoots and curls round rather than pivoting as one.
    const side = tx > 1 ? 1 : tx < -1 ? -1 : 0;
    if (side !== 0 && e.face[i] !== side && mvX !== 0) mvX = Math.abs(mvX) * e.face[i] * (mvX * side > 0 ? 1 : -1);
    turnToward(s, i, tx);

    if (def.hop && e.stun[i] === 0 && e.mode[i] === 0 && e.wind[i] === 0 && dist > def.hop.minDist && (s.tick + i * 7) % def.hop.every === 0) {
      e.vx[i] += dirX * def.hop.speed; // springs forward
      e.vy[i] += dirY * def.hop.speed * 0.8;
    }
    if (def.trail && (mvX !== 0 || mvY !== 0) && (s.tick + i) % def.trail.every === 0) dropMud(s, e.x[i], e.y[i], def.trail);

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

/** Tougher mobs are likelier to carry a potion; the budget then decides whether the drop actually happens. */
function dropPotion(s: GameState, m: number, dirX: number, dirY: number): void {
  const e = s.ents;
  if (s.potionBudget < 1 || s.potionCount >= POTION_CAP) return;
  if (rngFloat(s.rngLoot) >= Math.min(0.35, 0.03 + 0.012 * MOBS[e.sub[m]].hp)) return;
  s.potionBudget--;
  spawnPotion(s, e.x[m], e.y[m], dirX * 0.6 + rngRange(s.rngLoot, -1.1, 1.1), dirY * 0.4 + rngRange(s.rngLoot, -0.8, 0.8));
}

function spawnPotion(s: GameState, x: number, y: number, vx: number, vy: number): void {
  const e = s.ents;
  const i = allocEntity(e, Kind.Potion, 0, x, y, 1);
  if (i < 0) return;
  e.vx[i] = vx;
  e.vy[i] = vy;
  e.z[i] = 3;
  e.vz[i] = rngRange(s.rngLoot, 1.5, 2.9);
  s.potionCount++;
}

function freePotion(s: GameState, i: number): void {
  freeEntity(s.ents, i);
  s.potionCount--;
}

function updatePotions(s: GameState): void {
  const e = s.ents;
  let heroes = 0;
  for (const p of s.players) if (p.active) heroes++;
  s.potionBudget = Math.min(POTION_BUDGET_MAX, s.potionBudget + (POTION_PER_SECOND * heroes) / 60);
  if (s.potionCount === 0) return;
  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Potion) continue;
    if (e.x[i] < s.camX - 40) { freePotion(s, i); continue; } // lost once it falls behind the screen, like coins
    if (e.atk[i] < 255) e.atk[i]++; // age
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
    if (e.atk[i] < 10) continue;
    for (let k = 0; k < s.players.length; k++) {
      const p = s.players[k];
      if (!p.active || p.downed) continue;
      const hpMax = CLASSES[p.classId].hp;
      if (e.hp[p.ent] >= hpMax) continue; // a hero at full health walks past it, saving it for later
      const dx = e.x[p.ent] - e.x[i], dy = e.y[p.ent] - e.y[i];
      if (dx * dx + dy * dy >= POTION_PICKUP * POTION_PICKUP) continue;
      e.hp[p.ent] = Math.min(hpMax, e.hp[p.ent] + hpMax * POTION_HEAL);
      emit(s.events, Ev.Potion, e.x[i], e.y[i], k);
      freePotion(s, i);
      break;
    }
  }
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
  // A closed gate is the end of the world until the screen is clear.
  const gate = s.gates[s.gateIdx];
  const target = clamp(sum / n - VIEW_W / 2 + 24, 0, gate ? gate.x - VIEW_W + GATE_INSET : WORLD_W - VIEW_W);
  // The camera only ever scrolls forward, so ground you have cleared stays behind you.
  if (target > s.camX) s.camX += (target - s.camX) * 0.1;
}

/** A shut gate stands this far inside the right edge of the screen, so it is seen as a wall and not a line at the border. */
const GATE_INSET = 56;

/** The furthest right a hero can stand: the right edge of the screen, or the shut gate. */
function heroMaxX(s: GameState): number {
  const gate = s.gates[s.gateIdx];
  return gate ? Math.min(s.camX + VIEW_W - 10, gate.x - 8) : s.camX + VIEW_W - 10;
}

/** A camera that is already beyond a gate (it was skipped, not opened) leaves it behind: nothing can hold it back from there. */
function passGates(s: GameState): void {
  while (s.gateIdx < s.gates.length && s.camX + VIEW_W - GATE_INSET > s.gates[s.gateIdx].x + 24) s.gateIdx++;
}

/** How far past the right edge of the screen an enemy still counts as "on screen" for a gate: it is about to walk in. */
const GATE_SIGHT = 120;

/** Hostile enemies that are on the screen or about to be (stragglers far away, and those who have given up or are leaving, do not count). */
function visibleHostiles(s: GameState): number {
  const e = s.ents;
  let n = 0;
  for (let i = 0; i < e.highWater; i++) {
    if (!e.alive[i] || e.kind[i] !== Kind.Mob || (e.flags[i] & (8 | BYSTANDER | SURRENDERED))) continue;
    if (e.x[i] > s.camX - 6 && e.x[i] < s.camX + VIEW_W + GATE_SIGHT) n++;
  }
  return n;
}

/** The barrier opens once the camera is up against it, its wall of enemies has streamed in, and not one is left in sight. */
function checkGate(s: GameState): void {
  const gate = s.gates[s.gateIdx];
  if (!gate || s.nextClump <= gate.clump || s.camX + VIEW_W - GATE_INSET < gate.x - 4) return;
  if (visibleHostiles(s) > 0) return;
  s.gateIdx++;
  s.gateOpenTick = s.tick;
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
