// How each class is played. A tactic reads the pilot's view and target and fills in the plan: where to stand, where to aim, which buttons.
// The pilot does the rest (steering round dangers, dodging, the level-up panel). Skill enters through `abilityOk` (did the player think of
// it), `aimErr` and the pilot's reaction; the plays themselves are what a decent player of that class would do.
import { MOBS, Behavior } from '../data/mobs';
import { costMul, novaCost, rankOf, SIZE_MELEE, SIZE_RANGED } from '../sim/abilityMods';
import { UPGRADE_INDEX } from '../data/upgrades';
import { Kind } from '../sim/entities';
import type { GameState } from '../sim/state';
import { VIEW_W } from '../sim/constants';
import type { Pilot } from './pilot';

type Tactic = (p: Pilot, s: GameState) => void;

/** Is the target worth spending an ability on (a boss, an elite, something with a shield or lots of health)? */
function tough(s: GameState, p: Pilot): boolean {
  const e = s.ents;
  if (p.te < 0) return false;
  const def = MOBS[e.sub[p.te]];
  return def.behavior === Behavior.Boss || e.elite[p.te] > 0 || e.maxhp[p.te] >= 40;
}

/** Drop out of the fight to get stamina back: true while resting. Resting ends once the pool has refilled enough to swing again. */
function rest(p: Pilot, s: GameState, need: number, resume: number, retreat = true): boolean {
  const pl = s.players[p.slot];
  if (p.recovering) { if (!pl.winded && pl.stamina >= resume) p.recovering = false; }
  else if (pl.winded || pl.stamina < need) p.recovering = true;
  if (!p.recovering) return false;
  if (!retreat) return true;
  const v = p.view;
  // back away from the nearest foe (kite) while the pool refills
  p.plan.hasGoal = true;
  const away = Math.max(60, 110 - v.nearestDist);
  const dx = v.x - p.tx, dy = v.y - p.ty;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  p.plan.gx = v.x + (dx / d) * away;
  p.plan.gy = v.y + (dy / d) * away * 0.6;
  return true;
}

/**
 * A foe holding its standoff just past a shut gate cannot be reached by a sword. A player pulls it in: back off beyond its standoff
 * (the screen's left side) so it walks into the field, then goes after it. True while that is what the hero is doing.
 */
function lure(p: Pilot, s: GameState, reach: number): boolean {
  const gate = p.maxX(s);
  // (once the pull has begun it carries on until the foe is well inside the gate, or it would step back out again at the first chase)
  if (p.luring ? p.tx < gate - 50 : p.tx - gate <= reach - 6) { p.luring = false; return false; }
  p.luring = true;
  const plan = p.plan;
  plan.hasGoal = true;
  plan.gx = s.camX + 30;
  plan.gy = p.ty;
  plan.attack = false;
  return true;
}

/** Edge of the swing arc: how far the target sits from the hero's centre where a blow still lands. */
function meleeReach(p: Pilot, s: GameState, base: number): number {
  const pl = s.players[p.slot];
  return base * (1 + SIZE_MELEE * rankOf(pl.ranks, 0, 0));
}

/** Extra reach a big target gives (the boss is hit when any part of it is in range). */
function bodyReach(s: GameState, p: Pilot): number {
  const def = MOBS[s.ents.sub[p.te]];
  return def.behavior === Behavior.Boss ? def.radius : 0;
}

/**
 * A shot that splits fans its arrows evenly round the aim line (sim/step.ts `fireArrows`). With an even number none of them flies down
 * the line, so a lone target between two of them is missed at range. A player turns the fan so the nearest arrow is on target: this is
 * how far (in turns) to turn it for a volley of `count` over `spread`.
 */
function fanBias(count: number, spread: number): number {
  if (count <= 1 || count % 2 === 1) return 0;
  const k = count / 2;
  return (k / (count - 1) - 0.5) * spread;
}

/** The bias for the hero's basic shot (the Twin Flame boon and the basic attack's Split track both add arrows). */
function shotBias(pl: GameState['players'][number]): number {
  const twin = pl.ranks[UPGRADE_INDEX.twin] + rankOf(pl.ranks, 0, 1);
  return fanBias(1 + twin, 0.05 * twin);
}

// ---------------------------------------------------------------------------------------------
// Warrior: hold the line. Stand just inside sword reach (outside most enemies'), swing, sweep a crowd, quake a column, charge to cross a gap.

const warrior: Tactic = (p, s) => {
  const v = p.view, pl = s.players[p.slot], cls = v.cls, plan = p.plan;
  const reach = meleeReach(p, s, cls.combo[0].range);
  const body = bodyReach(s, p);
  const attackCost = cls.attackCost * costMul(pl.ranks, 0);
  p.aimAt(p.tx, p.ty);
  if (lure(p, s, reach + body)) return;
  if (rest(p, s, attackCost + 4, 32)) { plan.attack = false; abilities(p, s); return; }
  p.standOff(Math.max(10, reach + body - 8));
  if (p.td <= reach + body - 2 && p.canSpend(attackCost, p.dodgeReserve())) plan.attack = true;
  // Close a gap with the charge when the fight is far and nothing is about to land
  if (p.abilityOk && p.td > 150 && v.c70 === 0 && p.threats.n === 0 && pl.cdDash === 0 && p.canSpend(cls.dashCost + 40) && v.hpFrac > 0.7 && v.x < p.tx - 120) {
    plan.roll = true; plan.rollX = (p.tx - v.x) / p.td; plan.rollY = (p.ty - v.y) / p.td; plan.holdRoll = 14;
  }
  abilities(p, s);

  function abilities(pp: Pilot, ss: GameState): void {
    if (!pp.abilityOk) return;
    const sp = cls.special;
    // the big sweep: a knot of foes in the arc, or something tough in reach
    const spReach = meleeReach(pp, ss, sp.range);
    const inArc = pp.view.c40 + Math.max(0, pp.view.c70 - pp.view.c40) * 0.5;
    if (pl.cdSpecial === 0 && pp.canSpend(cls.specialCost * costMul(pl.ranks, 1), pp.dodgeReserve() * 0.6) && pp.td <= spReach + body && (inArc >= 3 || (tough(ss, pp) && inArc >= 1))) plan.special = true;
    // the quake: a column of foes in the lane, found by trying a few directions
    if (pl.fury >= novaCost(pl.ranks, cls.novaCost, cls.furyMax) && pl.cdAbility1 === 0) {
      const q = cls.quake!;
      const big = pl.fury >= cls.furyMax;
      const len = (big ? q.bigLength : q.length) * 1.0, w = (big ? q.bigWidth : q.width) * 1.0;
      let bestN = 0, bx = 0, by = 0;
      const lim = Math.min(pp.view.n, 8);
      for (let k = 0; k < lim; k++) {
        const d = pp.view.dist[k] || 1;
        const ux = pp.view.dx[k] / d, uy = pp.view.dy[k] / d;
        const n = pp.laneCount(ux, uy, len, w);
        if (n > bestN) { bestN = n; bx = ux; by = uy; }
      }
      const surrounded = pp.view.c40 >= 4 && pp.view.hpFrac < 0.6;
      if (bestN >= (big ? 3 : 4) || (surrounded && bestN >= 2) || (tough(ss, pp) && bestN >= 1 && big)) {
        plan.nova = true;
        plan.hasAim = true; plan.ax = bx; plan.ay = by;
      }
    }
  }
};

// ---------------------------------------------------------------------------------------------
// Mage: a cannon behind the line. Keep out of reach, drop fireballs on the thickest knot, lob the big one at range, blink out of trouble.

const mage: Tactic = (p, s) => {
  const v = p.view, pl = s.players[p.slot], cls = v.cls, plan = p.plan;
  const shotCost = cls.attackCost * costMul(pl.ranks, 0);
  const spCost = cls.specialCost * costMul(pl.ranks, 1);
  const rangeMul = 1 + 0.2 * rankOf(pl.ranks, 0, 2);
  const shotRange = cls.shot!.speed * cls.shot!.ttl * rangeMul;
  // where to aim: the knot of foes the splash covers best, within the fireball's reach
  const splash = cls.shot!.splash! * (1 + SIZE_RANGED * rankOf(pl.ranks, 0, 0));
  const c = p.cluster(splash, 30, shotRange * 0.92);
  let aimK = c.k >= 0 ? c.k : p.tk;
  if (aimK < 0) aimK = 0;
  const ax = v.x + v.dx[aimK], ay = v.y + v.dy[aimK];
  p.aimAt(ax, ay, shotBias(pl));
  // distance: stay clear of anything that bites, near enough to reach
  keepAway(p, 95, shotRange * 0.85);
  const reserve = cls.dashCost * costMul(pl.ranks, 3);
  if (v.dist[aimK] <= shotRange * 0.95 && p.canSpend(shotCost, reserve * (v.c70 > 0 ? 1 : 0.4))) plan.attack = true;
  if (p.abilityOk) {
    // the lobbed fireball bursts a fixed distance away: use it on a knot that sits about there
    const spec = cls.specialShot!;
    const lobRange = spec.speed * spec.ttl;
    const c2 = p.cluster(spec.splash!, lobRange * 0.75, lobRange * 1.12);
    if (pl.cdSpecial === 0 && c2.n >= 3 && p.canSpend(spCost, reserve * 0.5)) { plan.special = true; p.aimAt(v.x + v.dx[c2.k], v.y + v.dy[c2.k]); plan.attack = false; }
    if (pl.fury >= novaCost(pl.ranks, cls.novaCost, cls.furyMax) && pl.cdAbility1 === 0 && (v.c70 >= 5 || (v.c40 >= 3 && v.hpFrac < 0.6))) plan.nova = true;
  }
  // Blink away when something is on top of the mage
  blinkAway(p, s);
};

// ---------------------------------------------------------------------------------------------
// Archer: far, fast, in lines. Arrows pierce a column and hit harder the farther they fly, so shoot long and keep moving.

const archer: Tactic = (p, s) => {
  const v = p.view, pl = s.players[p.slot], cls = v.cls, plan = p.plan;
  const shot = cls.shot!;
  const range = shot.speed * shot.ttl * (1 + 0.2 * rankOf(pl.ranks, 0, 2));
  // aim along the line that threads the most foes (and prefer the far end of a long line, where the arrow hits hardest)
  let bestK = Math.max(0, p.tk), bestScore = -1;
  const lim = Math.min(v.n, 10);
  for (let k = 0; k < lim; k++) {
    const d = v.dist[k] || 1;
    if (d > range * 0.97) continue;
    const ux = v.dx[k] / d, uy = v.dy[k] / d;
    const n = p.laneCount(ux, uy, range, 7);
    const score = n * 10 + Math.min(d, range) * 0.05 + (k === p.tk ? 4 : 0);
    if (score > bestScore) { bestScore = score; bestK = k; }
  }
  p.aimAt(v.x + v.dx[bestK], v.y + v.dy[bestK], shotBias(pl));
  keepAway(p, 105, range * 0.8);
  const attackCost = cls.attackCost * costMul(pl.ranks, 0);
  // an arrow costs next to nothing, but every shot restarts the regen clock, so firing the moment a point comes back pins the pool near
  // empty: a player lets go until it has refilled
  const resting = rest(p, s, 4, 30, false);
  if (!resting && v.dist[bestK] <= range && p.canSpend(attackCost, 0)) plan.attack = true;
  if (p.abilityOk) {
    const spCost = cls.specialCost * costMul(pl.ranks, 1);
    const sp = cls.specialShot!;
    const cone = p.laneCount(plan.ax, plan.ay, sp.speed * sp.ttl * 0.9, 38 + 0.2 * 0);
    if (pl.cdSpecial === 0 && cone >= 4 && p.canSpend(spCost, p.dodgeReserve() * 0.6)) plan.special = true;
    // the rain falls a fixed reach ahead: aim at a knot that sits there
    const rain = cls.rain!;
    if (pl.fury >= novaCost(pl.ranks, cls.novaCost, cls.furyMax) && pl.cdAbility1 === 0) {
      const c = p.cluster(rain.radius, rain.reach * 0.6, rain.reach * 1.5);
      if (c.n >= 5 || (v.c70 >= 6 && v.hpFrac < 0.6)) {
        plan.nova = true;
        if (c.k >= 0) p.aimAt(v.x + v.dx[c.k], v.y + v.dy[c.k]);
      }
    }
  }
  blinkAway(p, s);
};

// ---------------------------------------------------------------------------------------------
// Cleric: stays in the thick of it with the aura on, mends the party with the dodge and the nova, bursts a crowd that closes in.

const cleric: Tactic = (p, s) => {
  const v = p.view, pl = s.players[p.slot], cls = v.cls, plan = p.plan;
  const aura = cls.combo[0].range * (1 + SIZE_MELEE * rankOf(pl.ranks, 0, 0));
  // hysteresis: switch on near foes with stamina in hand, off when dry
  const want = v.nearestDist < aura + 12 && !pl.winded && pl.stamina > (pl.auraOn ? 6 : 38);
  plan.attack = want;
  if (lure(p, s, aura)) { plan.attack = false; return; }
  // where: close enough that the aura bites, with the inner ring if the crowd allows; fall back to rest when dry
  if (!want && (pl.winded || pl.stamina < 38)) {
    const dx = v.x - p.tx, dy = v.y - p.ty, d = Math.sqrt(dx * dx + dy * dy) || 1;
    plan.hasGoal = true; plan.gx = v.x + (dx / d) * 70; plan.gy = v.y + (dy / d) * 40;
  } else {
    const around = v.c120 > 0 && v.c40 === 0 ? 1 : 0;
    p.standOff(around ? 16 : 20 + MOBS[s.ents.sub[p.te]].radius);
  }
  // keep near the party to heal it
  if (v.allies > 0 && v.weakAlly >= 0 && v.weakAllyFrac < 0.55 && v.c40 === 0) { plan.hasGoal = true; plan.gx = v.weakAllyX; plan.gy = v.weakAllyY; }
  if (!p.abilityOk) return;
  const novaOk = pl.fury >= novaCost(pl.ranks, cls.novaCost, cls.furyMax) && pl.cdAbility1 === 0;
  const hurt = v.hpFrac < 0.55 || (v.weakAlly >= 0 && v.weakAllyFrac < 0.45);
  if (novaOk && (hurt || v.c40 >= 4 || v.c70 >= 7)) plan.nova = true;
  if (pl.cdSpecial === 0 && p.canSpend(cls.specialCost * costMul(pl.ranks, 1), 6) && (v.c40 >= 3 || (tough(s, p) && v.c40 >= 1))) plan.special = true;
  // the heal-roll: a mend for her and anyone near, when it is worth the stamina
  if (!plan.roll && pl.cdDash === 0 && hurt && v.hpFrac < 0.7 && p.canSpend(cls.dashCost, 0) && p.dodgeOk) { plan.roll = true; plan.rollX = 0; plan.rollY = 0; }
};

// ---------------------------------------------------------------------------------------------
// Rogue: hidden until he strikes. Slip up on a knot of foes and open with the wide ambush, then work behind them, then fade out again.

const rogue: Tactic = (p, s) => {
  const v = p.view, pl = s.players[p.slot], cls = v.cls, plan = p.plan;
  const e = s.ents;
  const hidden = pl.vanishT > 0;
  const reach = meleeReach(p, s, cls.combo[0].range);
  const attackCost = cls.attackCost * costMul(pl.ranks, 0);
  if (hidden && !p.wasHidden) p.hiddenSince = s.tick; // (he has only just slipped away: the wait starts now)
  p.wasHidden = hidden;
  if (hidden && p.tx - p.maxX(s) > reach - 6 && p.td < 140) {
    // the foe he wants is holding its standoff behind a shut gate and cannot see him: step out of hiding (any swing does it) so it comes
    plan.hasGoal = true; plan.gx = v.x; plan.gy = v.y;
    p.aimAt(p.tx, p.ty);
    if (p.canSpend(attackCost)) plan.attack = true;
    return;
  }
  if (hidden) {
    // walk up to the thickest knot, then burst out of the shadows into it
    const c = p.cluster(48, 0, 200);
    const tk = c.k >= 0 ? c.k : Math.max(0, p.tk);
    const reachA = reach * (cls.ambushReach ?? 1);
    p.aimAt(v.x + v.dx[tk], v.y + v.dy[tk]);
    if (v.dist[tk] > reachA - 14) {
      plan.hasGoal = true; plan.gx = v.x + v.dx[tk]; plan.gy = v.y + v.dy[tk];
      // keep clear of bodies on the way in: bumping a foe gives him away
    } else {
      plan.hasGoal = true; plan.gx = v.x; plan.gy = v.y;
    }
    // (with few foes left there is no bigger knot to wait for; a lone straggler is a reason to come out, not to wait forever)
    const worth = c.n >= 3 || (tough(s, p) && c.n >= 1) || v.hpFrac < 0.5 || p.scan.hostiles <= 5 || s.tick - p.hiddenSince > 150;
    if (v.dist[tk] <= reachA - 6 && (worth || !p.abilityOk) && p.canSpend(attackCost)) plan.attack = true;
    return;
  }
  p.aimAt(p.tx, p.ty);
  if (lure(p, s, reach)) return;
  if (rest(p, s, attackCost + 3, 25)) return;
  // work round to the back of the target: a blow on a foe facing away is a backstab
  const face = e.face[p.te];
  const behind = e.x[p.te] - face * (reach - 8);
  const flank = p.skill.spacing > 0.3 && p.td > 12;
  const gap = Math.max(8, reach - 7);
  if (flank && Math.abs(v.y - p.ty) < 60) { plan.hasGoal = true; plan.gx = behind; plan.gy = p.ty + (v.y >= p.ty ? 8 : -8); }
  else p.standOff(gap);
  if (p.td <= reach + 2 && p.canSpend(attackCost, p.dodgeReserve())) plan.attack = true;
  if (!p.abilityOk) return;
  if (pl.cdSpecial === 0 && p.canSpend(cls.specialCost * costMul(pl.ranks, 1), p.dodgeReserve() * 0.5) && v.c40 >= 3) plan.special = true;
  if (pl.fury >= novaCost(pl.ranks, cls.novaCost, cls.furyMax) && pl.cdAbility1 === 0 && (v.c40 >= 4 || (v.c40 >= 3 && v.hpFrac < 0.5))) plan.nova = true;
};

// ---------------------------------------------------------------------------------------------
// Shared ranged footwork

/** Hold the line between `min` px from the nearest bite and `max` px from the target; slide off the field's edge rather than be pinned. */
function keepAway(p: Pilot, min: number, max: number): void {
  const v = p.view, plan = p.plan;
  const s = p.s;
  plan.hasGoal = true;
  // nearest foe that bites
  let threat = -1;
  for (let k = 0; k < v.n; k++) {
    const def = MOBS[s.ents.sub[v.idx[k]]];
    if (def.behavior === Behavior.Ranged || def.behavior === Behavior.Caster) continue;
    threat = k;
    break;
  }
  const spacing = 0.4 + 0.6 * p.skill.spacing;
  if (threat >= 0 && v.dist[threat] < min * spacing + 25) {
    let dx = -v.dx[threat], dy = -v.dy[threat];
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= d; dy /= d;
    // walls: when backed against the left edge or the top/bottom, slide sideways instead
    const leftRoom = v.x - (s.camX + 14);
    if (leftRoom < 50 && dx < 0) { dy = dy >= 0 ? 1 : -1; dx *= 0.2; }
    plan.gx = v.x + dx * 70; plan.gy = v.y + dy * 70;
    return;
  }
  // otherwise close to a comfortable range from the target, but never into the fray
  const td = p.td;
  if (td > max) { plan.gx = v.x + (p.tx - v.x) * 0.5; plan.gy = v.y + (p.ty - v.y) * 0.5; }
  else { plan.gx = v.x; plan.gy = v.y; }
  // do not wander off the edge of the screen on the right
  plan.gx = Math.min(plan.gx, s.camX + VIEW_W - 40);
}

/** Roll out of the way (a mage blinks, an archer rolls) when foes are on top of the hero and about to hit. */
function blinkAway(p: Pilot, s: GameState): void {
  const v = p.view, pl = s.players[p.slot], cls = v.cls, plan = p.plan;
  if (!p.dodgeOk || pl.cdDash > 0 || !p.canSpend(cls.dashCost * costMul(pl.ranks, 3))) return;
  if (v.c24 >= 1 && (v.c40 >= 2 || v.hpFrac < 0.6)) { plan.roll = true; plan.rollX = 0; plan.rollY = 0; }
  void s;
}

export const TACTICS: Readonly<Record<string, Tactic>> = { warrior, mage, cleric, rogue, archer };
export { Kind };
