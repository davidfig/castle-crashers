// A simple scripted player used for headless balance playtests (npm run playtest).
// Behaviour: advance right, hold attack, nova when a crowd is close, dash when hurt and surrounded.
import { CLASSES } from '../data/classes';
import { Btn, createInputFrame, type InputFrame } from './input';
import { WORLD_W } from './constants';
import { Kind } from './entities';
import { costMul, novaCost } from './abilityMods';
import { Ev, EV_STRIDE } from './events';
import { UPGRADE_INDEX, UPGRADES } from '../data/upgrades';
import { Phase, createSim, type GameState } from './state';
import { step } from './step';

export interface BotResult {
  seed: number;
  outcome: 'won' | 'lost' | 'timeout';
  ticks: number;
  kills: number;
  progress: number;
  novas: number;
  minHp: number;
  /** Boon triggers that fired (Ev.Proc events). */
  procs: number;
}

/** What the bot starts with: a class and boons (id -> rank), to see what a build does to a run. */
export interface BotBuild {
  classId?: number;
  boons?: Record<string, number>;
}

export function botInput(s: GameState, slot: number, out: InputFrame): void {
  const p = s.players[slot];
  const e = s.ents;
  out.buttons = 0;
  out.moveX = 0;
  out.moveY = 0;
  if (!p.active || p.downed) return;
  const cls = CLASSES[p.classId];
  const px = e.x[p.ent], py = e.y[p.ent];

  let near = 0, close = 0;
  let cx = 0, cy = 0;
  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Mob) continue;
    const dx = e.x[i] - px, dy = e.y[i] - py;
    const d2 = dx * dx + dy * dy;
    if (d2 < 60 * 60) { near++; cx += dx; cy += dy; }
    if (d2 < 24 * 24) close++;
  }

  // Advance, but drift toward the thickest part of the fight when crowded.
  let mx = 1, my = 0;
  if (near > 0) { mx = cx / near > 0 ? 0.4 : -0.1; my = Math.sign(cy / near) * 0.5; }
  if (close > 8 && e.hp[p.ent] < cls.hp * 0.4) { mx = -1; my = 0; }
  out.moveX = Math.round(mx * 127);
  out.moveY = Math.round(my * 127);

  // Read charge telegraphs: leave the locked lane, and dash if a charger is about to arrive.
  let dodgeNow = false;
  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Mob || e.mode[i] === 0) continue;
    const ox = px - e.x[i], oy = py - e.y[i];
    if (e.mode[i] === 3) {
      // Boss slam: get out of the ring, and dash if it is about to land on us.
      const d = Math.sqrt(ox * ox + oy * oy);
      if (d < 100) {
        out.moveX = Math.round((ox / (d || 1)) * 127);
        out.moveY = Math.round((oy / (d || 1)) * 127);
        if (d < 92 && e.wind[i] < 14 && p.cdDash === 0) dodgeNow = true;
      }
      continue;
    }
    if (e.mode[i] !== 1 && e.mode[i] !== 2) continue; // other boss moves (roar, smash) have no lane
    const along = ox * e.ax[i] + oy * e.ay[i];
    const lateral = ox * -e.ay[i] + oy * e.ax[i];
    if (along < -10 || along > 230 || Math.abs(lateral) > 16) continue;
    const side = lateral >= 0 ? 1 : -1;
    out.moveX = Math.round(-e.ay[i] * side * 127);
    out.moveY = Math.round(e.ax[i] * side * 127);
    if (e.mode[i] === 2 && along < 48 && p.cdDash === 0) dodgeNow = true;
  }
  if (dodgeNow) out.buttons |= Btn.Dodge;

  if (cls.auraDrain) {
    // A toggle with hysteresis: switch it on once enemies are close and stamina has built up, keep it on until they are gone or it is
    // nearly dry (a single threshold flickers: stamina does not regenerate while the aura drains it, then waits out the regen delay).
    const want = near >= 1 && !p.winded && p.stamina > (p.auraOn ? 4 : 45);
    if (want !== p.auraOn && (p.prevButtons & Btn.Attack) === 0) out.buttons |= Btn.Attack;
  } else out.buttons |= Btn.Attack;
  // The big sweep when a crowd is close and there is stamina to spare.
  if (near >= 8 && p.cdSpecial === 0 && !p.winded && p.stamina >= cls.specialCost * costMul(p.ranks, 1) + 10) out.buttons |= Btn.Ability2;
  if (near >= 7 && p.fury >= novaCost(p.ranks, cls.novaCost, cls.furyMax)) out.buttons |= Btn.Ability1;
  // Panic-dashing out of a scrum keeps a reserve of stamina for swinging; dodging a telegraph (above) does not.
  if (close >= 6 && e.hp[p.ent] < cls.hp * 0.6 && p.cdDash === 0 && p.stamina >= cls.dashCost * costMul(p.ranks, 3) + 30 && s.tick % 3 === 0) out.buttons |= Btn.Dodge;
}

export function runBot(seed: number, maxTicks: number, build: BotBuild = {}): BotResult {
  const s = createSim(seed);
  if (build.classId !== undefined) {
    s.players[0].classId = build.classId;
    s.ents.hp[s.players[0].ent] = s.ents.maxhp[s.players[0].ent] = CLASSES[build.classId].hp;
  }
  for (const [id, r] of Object.entries(build.boons ?? {})) {
    const i = UPGRADE_INDEX[id];
    if (i === undefined) throw new Error(`no upgrade ${id}`);
    s.players[0].ranks[i] = Math.min(r, UPGRADES[i].maxRank);
  }
  let procs = 0;
  const inputs = [0, 1, 2, 3].map(createInputFrame);
  let novas = 0;
  let minHp = 100;
  let prevCd = 0;
  for (let t = 0; t < maxTicks && s.phase === Phase.Playing; t++) {
    botInput(s, 0, inputs[0]);
    step(s, inputs);
    for (let k = 0; k < s.events.n; k++) if (s.events.data[k * EV_STRIDE] === Ev.Proc) procs++;
    s.events.n = 0;
    const p = s.players[0];
    if (p.cdAbility1 > prevCd) novas++;
    prevCd = p.cdAbility1;
    const hp = s.ents.hp[p.ent];
    if (hp < minHp) minHp = hp;
  }
  const p = s.players[0];
  return {
    seed,
    outcome: s.phase === Phase.Won ? 'won' : s.phase === Phase.Lost ? 'lost' : 'timeout',
    ticks: s.tick,
    kills: s.kills,
    progress: Math.round((s.ents.x[p.ent] / WORLD_W) * 100),
    novas,
    minHp: Math.round(minHp),
    procs,
  };
}
