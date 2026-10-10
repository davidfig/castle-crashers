// Things to find on the field: chests that sell a pick for gold, and shrines that sell a gamble (docs/03, "Shrines and chests").
// They stand still where the seed put them. A hero opens one by standing close until its ring fills; nothing needs a button, so
// nothing fights with Stand Down. A mini-boss's death leaves a free chest.
//
//   chest   spend gold (dearer with each one opened): a free level (a boon pick), or a purse, or a draught. Two misses in a row and the third is a pick.
//   curse   summon elites out of the hill; kill them all for a free level each and a purse.
//   charge  stay inside the ring while it fills; packs keep coming; the party is mended and learns something when it is full.
//   greed   pay with blood (nearly half your health) for a heap of gold.
//   mercy   everything hostile on screen lays down its arms; the party is mended and the weary get a reroll. (Only on the road where mercy exists.)
//
// Per-entity state is spread over the shared arrays: `elite` is the state (0 waiting, 1 free chest, 2 running, 3 spent), `buff` the ring
// (0..CHANNEL), `by` who is opening it, `rem` a running shrine's own meter, `cool` its age, `cool2` its wave timer.
import { createRng, rngFloat, rngInt, rngRange } from '../engine/rng';
import { MOBS } from '../data/mobs';
import { CLASSES } from '../data/classes';
import { MAX_LEVEL, xpToNext } from '../data/upgrades';
import { VIEW_W, WORLD_H, WORLD_W } from './constants';
import { allocEntity, BYSTANDER, Kind, ShrineKind, SURRENDERED } from './entities';
import { Ev, emit } from './events';
import { activePlayers, eliteTypes, spawnElite } from './gen/level';
import { grantXp, laySurrender, levelProgress, scatterCoins, spawnFlankPack, spawnPotion } from './step';
import type { GameState } from './state';

/** Ticks a hero must stand at a site for its ring to fill. */
export const CHANNEL = 40;
/** What `Ev.Site` reports in `a`. */
export const SiteEv = { Open: 0, Start: 1, Done: 2, Deny: 3, Spawn: 4 } as const;
/** `elite` states of a site. */
export const SiteState = { Waiting: 0, Free: 1, Running: 2, Spent: 3 } as const;

const SITE_STREAM = 7000;
const REACH_X = 26, REACH_Y = 20;
const CHARGE_NEED = 600;
const CHARGE_RADIUS = 60;
const CHARGE_WAVE = 220;
const CURSE_QUIET = 60;
const GREED_COST = 0.45;
const MERCY_REACH = 120;

/** What the next chest costs. Every chest opened makes the next dearer; heat makes them all dearer. */
export function chestCost(s: GameState): number { // (a kill is worth about a third of a gold piece, so the first chest is a good stretch of the road)
  return Math.round(Math.min(400, 50 + 30 * s.chestsOpened) * (1 + 0.1 * s.heat));
}

/** Lay out the field's chests and shrines: two of each, spread along the road and never in the way of a staged scene or beat. A function of the seed alone. */
export function placeSites(s: GameState, boss: boolean): void {
  const r = createRng(s.seed, SITE_STREAM);
  const shrines: number[] = [ShrineKind.Curse, ShrineKind.Charge, ShrineKind.Greed];
  if (s.surrender) shrines.push(ShrineKind.Mercy);
  const picked: number[] = [];
  while (picked.length < 2) picked.push(shrines.splice(rngInt(r, shrines.length), 1)[0]);
  // Chest, shrine, chest, shrine, in a shuffled order of two slots each.
  const order: ('chest' | number)[] = ['chest', 'chest', picked[0], picked[1]];
  for (let k = order.length - 1; k > 0; k--) { const j = rngInt(r, k + 1); [order[k], order[j]] = [order[j], order[k]]; }
  const span = boss ? 0.78 : 0.86;
  order.forEach((what, k) => {
    const t = 0.1 + span * ((k + 0.25 + rngFloat(r) * 0.5) / order.length);
    const x = 760 + t * (WORLD_W - 1100);
    const y = rngRange(r, 52, WORLD_H - 52);
    if (s.plan.some((c) => (c.scene || c.beat) && Math.abs(c.x - x) < 330)) return;
    const i = allocEntity(s.ents, what === 'chest' ? Kind.Chest : Kind.Shrine, what === 'chest' ? 0 : what, x, y, 1);
    if (i >= 0) s.ents.face[i] = rngFloat(r) < 0.5 ? 1 : -1;
  });
}

/** A chest left where a mini-boss fell: free to open. */
function dropChest(s: GameState, x: number, y: number): void {
  const i = allocEntity(s.ents, Kind.Chest, 0, Math.max(20, Math.min(WORLD_W - 20, x)), Math.max(10, Math.min(WORLD_H - 10, y)), 1);
  if (i < 0) return;
  s.ents.elite[i] = SiteState.Free;
  s.ents.z[i] = 10;
  emit(s.events, Ev.Site, x, y, SiteEv.Spawn, 0);
}

/** A mini-boss died at slot `m`: a free chest, two draughts and a taste of experience. */
export function onEliteDown(s: GameState, m: number): void {
  const e = s.ents;
  const x = e.x[m], y = e.y[m];
  dropChest(s, x, y);
  for (let k = 0; k < 2; k++) spawnPotion(s, x, y, (k ? 1 : -1) * rngRange(s.rngLoot, 0.8, 1.6), rngRange(s.rngLoot, -0.5, 0.5));
  scatterCoins(s, x, y, 24 + 6 * s.heat);
  grantXp(s, 12, x, y);
  emit(s.events, Ev.Site, x, y, SiteEv.Done, 9);
}

/** A free level: the hero levels up with no experience paid, and gets the pick. */
export function freeLevel(s: GameState, slot: number): void {
  const p = s.players[slot];
  if (!p.active || p.level >= MAX_LEVEL) return;
  p.level++;
  p.pending++;
  emit(s.events, Ev.LevelUp, s.ents.x[p.ent], s.ents.y[p.ent], slot);
}

/** The standing hero closest to (x, y) within the given reach, or -1. */
export function heroAt(s: GameState, x: number, y: number, rx: number, ry: number): number {
  const e = s.ents;
  let best = -1, bestD = Infinity;
  for (let k = 0; k < s.players.length; k++) {
    const p = s.players[k];
    if (!p.active || p.downed) continue;
    const dx = Math.abs(e.x[p.ent] - x), dy = Math.abs(e.y[p.ent] - y);
    if (dx > rx || dy > ry) continue;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

export function healParty(s: GameState, frac: number): void {
  for (const p of s.players) {
    if (!p.active || p.downed) continue;
    const hp = CLASSES[p.classId].hp;
    s.ents.hp[p.ent] = Math.min(hp, s.ents.hp[p.ent] + hp * frac);
  }
}

/** Every tick: rings fill, and whatever is running runs. */
export function updateSites(s: GameState): void {
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) {
    const kind = e.kind[i];
    if (kind !== Kind.Chest && kind !== Kind.Shrine) continue;
    if (e.cool[i] < 65535) e.cool[i]++;
    if (e.z[i] > 0 || e.vz[i] !== 0) { e.z[i] += e.vz[i]; e.vz[i] -= 0.14; if (e.z[i] <= 0) { e.z[i] = 0; e.vz[i] = 0; } } // a dropped chest lands
    const st = e.elite[i];
    if (st === SiteState.Spent) continue;
    if (st === SiteState.Running) { runShrine(s, i); continue; }
    if (e.x[i] < s.camX - 200) continue; // far behind: nobody will be back
    const hero = heroAt(s, e.x[i], e.y[i], REACH_X, REACH_Y);
    if (hero < 0) { if (e.buff[i] > 0) e.buff[i] = Math.max(0, e.buff[i] - 2); continue; }
    if (!canOpen(s, i, hero)) {
      e.buff[i] = 0;
      if (e.cool[i] % 90 === 1) emit(s.events, Ev.Site, e.x[i], e.y[i], SiteEv.Deny, kind === Kind.Chest ? 4 : e.sub[i]);
      continue;
    }
    e.buff[i]++;
    e.by[i] = hero;
    if (e.buff[i] >= CHANNEL) { e.buff[i] = 0; activate(s, i, hero); }
  }
}

function hostilesNear(s: GameState, x: number): number {
  const e = s.ents;
  let n = 0;
  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Mob || e.elite[i] !== 0 || MOBS[e.sub[i]].boss) continue;
    if (e.flags[i] & (8 | BYSTANDER | SURRENDERED)) continue;
    if (Math.abs(e.x[i] - x) < MERCY_REACH + VIEW_W / 4 && e.x[i] > s.camX - 6 && e.x[i] < s.camX + VIEW_W + 120) n++;
  }
  return n;
}

function canOpen(s: GameState, i: number, hero: number): boolean {
  const e = s.ents;
  if (e.kind[i] === Kind.Chest) return e.elite[i] === SiteState.Free || s.gold >= chestCost(s);
  switch (e.sub[i]) {
    case ShrineKind.Greed: return e.hp[s.players[hero].ent] > CLASSES[s.players[hero].classId].hp * (GREED_COST + 0.1);
    case ShrineKind.Mercy: return hostilesNear(s, e.x[i]) > 0;
    default: return true;
  }
}

function activate(s: GameState, i: number, hero: number): void {
  const e = s.ents;
  const x = e.x[i], y = e.y[i];
  const p = s.players[hero];
  if (e.kind[i] === Kind.Chest) {
    const free = e.elite[i] === SiteState.Free;
    if (!free) { s.gold -= chestCost(s); s.chestsOpened++; }
    e.elite[i] = SiteState.Spent;
    openChest(s, hero, x, y, free);
    return;
  }
  switch (e.sub[i]) {
    case ShrineKind.Curse: {
      e.elite[i] = SiteState.Running;
      e.cool[i] = 0;
      const types = eliteTypes(s.biome);
      const n = activePlayers(s) >= 3 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const m = spawnElite(s, types[rngInt(s.rngSpawn, types.length)], 2, Math.max(s.camX + 40, Math.min(s.camX + VIEW_W - 40, x + (k - (n - 1) / 2) * 50)), k % 2 ? WORLD_H + 22 + k * 12 : -14 - k * 12);
        if (m >= 0) e.flags[m] = 3; // awake and "entering": over the hill, like any other arrival
      }
      const lo = Math.max(s.camX + 20, x - 120), hi = Math.min(s.camX + VIEW_W - 8, x + 120);
      spawnFlankPack(s, true, 8 * Math.round(1 + 0.5 * (activePlayers(s) - 1)), levelProgress(s), lo, hi);
      emit(s.events, Ev.Site, x, y, SiteEv.Start, ShrineKind.Curse);
      break;
    }
    case ShrineKind.Charge:
      e.elite[i] = SiteState.Running;
      e.cool[i] = 0; e.rem[i] = 0; e.cool2[i] = 60;
      emit(s.events, Ev.Site, x, y, SiteEv.Start, ShrineKind.Charge);
      break;
    case ShrineKind.Greed: {
      e.elite[i] = SiteState.Spent;
      const hp = CLASSES[p.classId].hp;
      e.hp[p.ent] = Math.max(1, e.hp[p.ent] - hp * GREED_COST);
      scatterCoins(s, x, y, 80 + 7 * p.level + 10 * s.heat, 6);
      emit(s.events, Ev.Site, x, y, SiteEv.Done, ShrineKind.Greed);
      break;
    }
    default: { // Mercy
      e.elite[i] = SiteState.Spent;
      for (let m = 0; m < e.highWater; m++) {
        if (e.kind[m] !== Kind.Mob || e.elite[m] !== 0 || MOBS[e.sub[m]].boss) continue;
        if (e.flags[m] & (8 | BYSTANDER | SURRENDERED)) continue;
        if (e.x[m] > s.camX - 6 && e.x[m] < s.camX + VIEW_W + 120) laySurrender(s, m);
      }
      healParty(s, 0.5);
      for (const q of s.players) if (q.active) q.rerolls++;
      emit(s.events, Ev.Site, x, y, SiteEv.Done, ShrineKind.Mercy);
    }
  }
}

function openChest(s: GameState, hero: number, x: number, y: number, free: boolean): void {
  const roll = rngFloat(s.rngLoot);
  const pick = free || roll < 0.5 || s.chestMiss >= 2;
  emit(s.events, Ev.Site, x, y, SiteEv.Open, pick ? 0 : roll < 0.8 ? 1 : 2);
  if (pick) { freeLevel(s, hero); s.chestMiss = 0; if (free) scatterCoins(s, x, y, 20 + 5 * s.heat); return; }
  s.chestMiss++;
  if (roll < 0.8) scatterCoins(s, x, y, chestCost(s) * 1.5, 5);
  else {
    for (let k = 0; k < 3; k++) spawnPotion(s, x, y, rngRange(s.rngLoot, -1.5, 1.5), rngRange(s.rngLoot, -1, 1));
    healParty(s, 0.25);
  }
}

function runShrine(s: GameState, i: number): void {
  const e = s.ents;
  const x = e.x[i], y = e.y[i];
  if (e.sub[i] === ShrineKind.Curse) {
    if (e.cool[i] < CURSE_QUIET || e.cool[i] % 20 !== 0) return;
    for (let m = 0; m < e.highWater; m++) if (e.kind[m] === Kind.Mob && e.elite[m] === 2) return;
    e.elite[i] = SiteState.Spent;
    for (let k = 0; k < s.players.length; k++) freeLevel(s, k);
    scatterCoins(s, x, y, 60 + 10 * s.heat, 6);
    emit(s.events, Ev.Site, x, y, SiteEv.Done, ShrineKind.Curse);
    return;
  }
  // Charge: the ring fills only with somebody standing in it, and the packs keep coming while it does.
  if (heroAt(s, x, y, CHARGE_RADIUS, CHARGE_RADIUS * 0.7) < 0) return;
  e.rem[i]++;
  if (--e.cool2[i] <= 0) {
    e.cool2[i] = CHARGE_WAVE;
    const lo = Math.max(s.camX + 20, x - 140), hi = Math.min(s.camX + VIEW_W - 8, x + 140);
    spawnFlankPack(s, (e.rem[i] / CHARGE_WAVE) % 2 < 1, Math.round(10 * (1 + 0.6 * (activePlayers(s) - 1))), levelProgress(s), lo, hi);
  }
  if (e.rem[i] >= CHARGE_NEED) {
    e.elite[i] = SiteState.Spent;
    healParty(s, 0.4);
    grantXp(s, xpToNext(Math.max(1, s.players.find((p) => p.active)?.level ?? 1)) * 0.5, x, y);
    scatterCoins(s, x, y, 40 + 8 * s.heat, 5);
    emit(s.events, Ev.Site, x, y, SiteEv.Done, ShrineKind.Charge);
  }
}

/** Fraction (0..1) of a running Charge shrine's ring, for the presentation. */
export function chargeFrac(s: GameState, i: number): number {
  return Math.min(1, s.ents.rem[i] / CHARGE_NEED);
}
