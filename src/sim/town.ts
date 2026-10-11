// The starting town in the sim (docs/21-the-road.md, step 6; where things stand is data/town.ts): the trade button, pressed beside a class's
// stand, makes the hero that class; beside one of the town's places, builds it up with renown (a lasting upgrade, data/meta.ts, which also
// takes hold in this run at once); beside the heat shrine, raises the road's heat by one (round to none again). All of it is in the sim, so
// a save holds it and every client agrees.
import { CLASSES } from '../data/classes';
import { HEAT_MAX } from '../data/heat';
import { META, META_INDEX, TREASURY_GOLD } from '../data/meta';
import { classStand, heatShrine, metaPlace, TOWN_REACH_X, TOWN_REACH_Y } from '../data/town';
import { emit, Ev } from './events';
import { TownEv } from './gen/road';
import { Btn, type InputFrame } from './input';
import { applyMeta, resetHero, type GameState } from './state';

/** What hero `k` stands beside in the town: a class's stand, a place, the heat shrine, or nothing. */
export function townSpot(s: GameState, k: number): { kind: 'class' | 'meta' | 'heat'; i: number } | undefined {
  const p = s.players[k];
  if (!p.active || p.downed) return undefined;
  const x = s.ents.x[p.ent], y = s.ents.y[p.ent];
  const near = (sp: { x: number; y: number }) => Math.abs(x - sp.x) < TOWN_REACH_X && Math.abs(y - sp.y) < TOWN_REACH_Y;
  for (let i = 0; i < CLASSES.length; i++) if (near(classStand(i))) return { kind: 'class', i };
  for (let i = 0; i < META.length; i++) if (near(metaPlace(i))) return { kind: 'meta', i };
  if (near(heatShrine())) return { kind: 'heat', i: 0 };
  return undefined;
}

/** Builds up place `i` with renown: one rank more for every later run, and for this one now. */
function build(s: GameState, k: number, i: number): void {
  const r = s.road!, m = META[i], rank = r.meta[i] ?? 0;
  const x = s.ents.x[s.players[k].ent], y = s.ents.y[s.players[k].ent];
  if (rank >= m.maxRank) { emit(s.events, Ev.Town, x, y, TownEv.Maxed, i, k); return; }
  const cost = m.cost(rank);
  if (r.renown < cost) { emit(s.events, Ev.Town, x, y, TownEv.Dear, i, k); return; }
  r.renown -= cost;
  r.meta[i] = rank + 1;
  if (i === META_INDEX.treasury) s.gold += TREASURY_GOLD;
  for (let j = 0; j < s.players.length; j++) if (s.players[j].active) applyMeta(s, j);
  emit(s.events, Ev.Town, x, y, TownEv.Built, i, k);
}

/** The trade button in the town (called at the start of a tick there, before the heroes move, as the store's is). */
export function townTrade(s: GameState, inputs: readonly InputFrame[]): void {
  for (let k = 0; k < s.players.length; k++) {
    const p = s.players[k];
    if (!p.active || p.panel || !(inputs[k].buttons & ~p.rawPrev & Btn.Interact)) continue;
    const at = townSpot(s, k);
    if (!at) continue;
    const x = s.ents.x[p.ent], y = s.ents.y[p.ent];
    if (at.kind === 'class') {
      if (p.classId !== at.i) resetHero(s, k, at.i);
      emit(s.events, Ev.Town, x, y, TownEv.Class, at.i, k);
    } else if (at.kind === 'meta') build(s, k, at.i);
    else {
      s.heat = s.road!.heat = (s.heat + 1) % (HEAT_MAX + 1);
      emit(s.events, Ev.Town, x, y, TownEv.Heat, s.heat, k);
    }
  }
}
