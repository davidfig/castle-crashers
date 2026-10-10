// What an element does when a skill made of it lands (data/elements.ts says what each *is*). Fire burns, ice chills (and freezes a hero
// who is already chilled), lightning jumps to the heroes beside the one it struck and shocks their stamina, poison bleeds, shadow silences,
// holy blinds, earth binds, wind blows away and scrambles, arcane hexes, blood bleeds and heals the one who struck.
// Today the victims are heroes and the casters are mobs; nothing here depends on that, so a hero's skills can reuse it (victim = a mob) later.
import { Element } from '../data/elements';
import { Ev, emit } from './events';
import type { GameState } from './state';
import { hurtPlayer, HURT_DOT, poisonPlayer } from './step';
import { shovePlayer } from './abilities';
import { Kind } from './entities';

/** Lightning leaps to a hero this close to the one it struck (px), up to `CHAIN_JUMPS` of them, for this fraction of the damage. */
const CHAIN_RANGE = 90;
const CHAIN_JUMPS = 2;
const CHAIN_FRACTION = 0.6;

/** The potency stored on an entity (`elite` x 10; 0 = 1). */
export const powerOf = (stored: number): number => (stored === 0 ? 1 : stored / 10);
/** Potency as stored (a byte). */
export const storePower = (power: number | undefined): number => Math.max(1, Math.min(255, Math.round((power ?? 1) * 10)));

const dur = (base: number, power: number): number => Math.max(1, Math.round(base * (0.55 + 0.45 * power)));

/** Hero `slot` was hit by the element's skill at (`sx`, `sy`) for `dmg`: apply the element's effect. `src` is the casting mob (or -1). Call only when the hit landed (not dodged). */
export function elementHit(s: GameState, slot: number, el: number, power: number, dmg: number, sx: number, sy: number, src = -1): void {
  const p = s.players[slot];
  if (!p.active || p.downed) return;
  const e = s.ents;
  switch (el) {
    case Element.Fire:
      poisonPlayer(s, slot, dur(120, power), true);
      break;
    case Element.Ice:
      if (p.slowT > 0) p.rootT = Math.max(p.rootT, dur(26, power)); // chilled already: frozen solid
      p.slowT = Math.max(p.slowT, dur(90, power));
      break;
    case Element.Lightning:
      p.witherT = Math.max(p.witherT, dur(90, power));
      chain(s, slot, dmg, sx, sy, el);
      break;
    case Element.Poison:
      poisonPlayer(s, slot, dur(180, power), false);
      break;
    case Element.Shadow:
      p.silenceT = Math.max(p.silenceT, dur(80, power));
      break;
    case Element.Holy:
      p.rootT = Math.max(p.rootT, dur(22, power));
      p.silenceT = Math.max(p.silenceT, dur(22, power));
      break;
    case Element.Earth:
      p.rootT = Math.max(p.rootT, dur(34, power));
      push(s, slot, sx, sy, 18);
      break;
    case Element.Wind:
      push(s, slot, sx, sy, 60 * (0.6 + 0.4 * power));
      p.confuseT = Math.max(p.confuseT, dur(40, power));
      break;
    case Element.Arcane:
      p.hexT = Math.max(p.hexT, dur(160, power));
      break;
    case Element.Blood:
      poisonPlayer(s, slot, dur(140, power), false);
      if (src >= 0 && e.alive[src] === 1 && e.kind[src] === Kind.Mob) e.hp[src] = Math.min(e.maxhp[src], e.hp[src] + dmg * 0.5);
      break;
  }
}

/** The same, for a field or a pool that keeps biting: milder per application, since it comes again and again. */
export function elementPulse(s: GameState, slot: number, el: number, power: number, sx: number, sy: number): void {
  const p = s.players[slot];
  if (!p.active || p.downed) return;
  switch (el) {
    case Element.Fire: poisonPlayer(s, slot, dur(40, power), true); break;
    case Element.Ice: p.slowT = Math.max(p.slowT, dur(40, power)); break;
    case Element.Lightning:
      p.witherT = Math.max(p.witherT, dur(36, power));
      chain(s, slot, 2, sx, sy, el, 1);
      break;
    case Element.Poison: poisonPlayer(s, slot, dur(70, power), false); break;
    case Element.Shadow: p.witherT = Math.max(p.witherT, dur(60, power)); break;
    case Element.Holy: p.silenceT = Math.max(p.silenceT, dur(16, power)); break;
    case Element.Earth: p.slowT = Math.max(p.slowT, dur(48, power)); break;
    case Element.Wind: push(s, slot, sx, sy, 5); break;
    case Element.Arcane: p.hexT = Math.max(p.hexT, dur(70, power)); break;
    case Element.Blood: poisonPlayer(s, slot, dur(60, power), false); break;
  }
}

/** Damage a hero with an element's skill: the hit, and (if it landed, not dodged) the element's effect. `slow` is the old plain slow. */
export function strikeHero(s: GameState, slot: number, dmg: number, el: number | undefined, power: number, sx: number, sy: number, src = -1, slow = 0): void {
  const p = s.players[slot];
  const open = p.invuln === 0 && !p.downed;
  hurtPlayer(s, slot, dmg, slow);
  if (open && el) elementHit(s, slot, el, power, dmg, sx, sy, src);
}

/** A bite of a field or pool: a little damage over time and the element's pulse. */
export function pulseHero(s: GameState, slot: number, dmg: number, el: number | undefined, power: number, sx: number, sy: number): void {
  if (dmg > 0) hurtPlayer(s, slot, dmg, 0, HURT_DOT);
  if (el) elementPulse(s, slot, el, power, sx, sy);
}

/** Lightning: leap to the nearest other heroes within range of the one struck. */
function chain(s: GameState, slot: number, dmg: number, sx: number, sy: number, el: number, jumps = CHAIN_JUMPS): void {
  const e = s.ents;
  const from = s.players[slot].ent;
  let last = slot;
  const hit = [slot];
  for (let j = 0; j < jumps; j++) {
    let best = -1, bestD = CHAIN_RANGE * CHAIN_RANGE;
    const lx = e.x[s.players[last].ent], ly = e.y[s.players[last].ent];
    for (let k = 0; k < s.players.length; k++) {
      const q = s.players[k];
      if (hit.includes(k) || !q.active || q.downed || q.invuln > 0) continue;
      const dx = e.x[q.ent] - lx, dy = e.y[q.ent] - ly, d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; best = k; }
    }
    if (best < 0) break;
    hit.push(best);
    emit(s.events, Ev.Arc, lx, ly, e.x[s.players[best].ent], e.y[s.players[best].ent], el);
    hurtPlayer(s, best, Math.max(1, Math.round(dmg * CHAIN_FRACTION)));
    last = best;
  }
  if (hit.length === 1) emit(s.events, Ev.Arc, sx, sy, e.x[from], e.y[from], el); // nobody to leap to: the bolt still strikes
}

/** Shoves the hero `dist` px away from (`sx`, `sy`). */
function push(s: GameState, slot: number, sx: number, sy: number, dist: number): void {
  const e = s.ents;
  const t = s.players[slot].ent;
  const dx = e.x[t] - sx, dy = e.y[t] - sy, d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.5) shovePlayer(s, slot, 1, 0, dist);
  else shovePlayer(s, slot, dx / d, dy / d, dist);
}
