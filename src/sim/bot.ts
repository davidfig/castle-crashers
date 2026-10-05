// A simple scripted player used for headless balance playtests (npm run playtest).
// Behaviour: advance right, hold attack, nova when a crowd is close, dash when hurt and surrounded.
import { CLASSES } from '../data/classes';
import { Btn, createInputFrame, type InputFrame } from './input';
import { Kind } from './entities';
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

  out.buttons |= Btn.Attack;
  if (near >= 7 && p.fury >= cls.novaCost) out.buttons |= Btn.Ability1;
  if (close >= 6 && e.hp[p.ent] < cls.hp * 0.6 && p.cdDash === 0 && s.tick % 3 === 0) out.buttons |= Btn.Dodge;
}

export function runBot(seed: number, maxTicks: number): BotResult {
  const s = createSim(seed);
  const inputs = [0, 1, 2, 3].map(createInputFrame);
  let novas = 0;
  let minHp = 100;
  let prevCd = 0;
  for (let t = 0; t < maxTicks && s.phase === Phase.Playing; t++) {
    botInput(s, 0, inputs[0]);
    step(s, inputs);
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
    progress: Math.round((s.ents.x[p.ent] / 4800) * 100),
    novas,
    minHp: Math.round(minHp),
  };
}
