// Stand Down and surrender, drawn (docs/12-story.md): the ring a standing hero's mercy reaches, and a white flag over every
// mob that has laid down its arms, so nobody has to guess who is safe to leave alone. Cosmetic; reads state only.
import { lerp } from '../engine/math';
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { STAND_RADIUS, STAND_TICKS } from '../data/surrender';
import { MOBS } from '../data/mobs';
import { VIEW_W } from '../sim/constants';
import { Kind, SURRENDERED } from '../sim/entities';
import type { GameState } from '../sim/state';
import type { Sprites } from './art';
import { FIELD_Y0 } from './background';

export function drawMercy(b: Batcher, S: Sprites, s: GameState, camX: number, alpha: number, oy: number): void {
  if (!s.surrender) return;
  const e = s.ents;
  // the ring: faint while the hero is lowering their weapons, solid once it takes
  for (const p of s.players) {
    if (!p.active || p.downed || p.standT <= 0) continue;
    const sx = lerp(e.px[p.ent], e.x[p.ent], alpha) - camX;
    const sy = FIELD_Y0 + lerp(e.py[p.ent], e.y[p.ent], alpha) + oy;
    const ready = p.standT >= STAND_TICKS;
    const r = ready ? STAND_RADIUS : STAND_RADIUS * (p.standT / STAND_TICKS);
    const col = hex(0xf4f6ff, ready ? 0.55 : 0.3);
    const dots = 36;
    for (let d = 0; d < dots; d++) {
      const a = (d / dots) * Math.PI * 2;
      b.drawScaled(S.px, sx + Math.cos(a) * r - 1, sy + Math.sin(a) * r * 0.85 - 1, 2, 2, col);
    }
  }
  // the flags
  for (let i = 0; i < e.highWater; i++) {
    if (!e.alive[i] || e.kind[i] !== Kind.Mob || !(e.flags[i] & SURRENDERED)) continue;
    const sx = Math.round(lerp(e.px[i], e.x[i], alpha) - camX);
    if (sx < -10 || sx > VIEW_W + 10) continue;
    const sy = Math.round(FIELD_Y0 + lerp(e.py[i], e.y[i], alpha) + oy);
    const top = sy - Math.round(MOBS[e.sub[i]].radius * 2.6) - 12;
    const wave = (s.tick >> 3) & 1;
    b.drawScaled(S.px, sx, top, 1, 8, hex(0x6a5030));            // pole
    b.drawScaled(S.px, sx + 1, top, 5 - wave, 3, hex(0xffffff)); // cloth, rippling
    b.drawScaled(S.px, sx + 1, top + 3, 4 + wave, 1, hex(0xdfe4f0));
  }
}
