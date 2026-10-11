// The class tree skills on the field (sim/skills.ts and the class files beside it; patches, smoke and the drawn bow too): the Planted Standard with its reach, Rage's red glow, the Roar's ring.
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import type { GameState } from '../sim/state';
import type { Sprites } from './art';
import { FIELD_Y0 } from './background';
import type { StandingList } from './standing';

/** A dotted ring on the ground. */
function ring(b: Batcher, S: Sprites, cx: number, cy: number, r: number, n: number, color: number, alpha: number): void {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    b.drawScaled(S.px, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 2, 2, hex(color, alpha));
  }
}

export function standingSkills(list: StandingList, b: Batcher, S: Sprites, s: GameState, camX: number, oy: number): void {
  const e = s.ents;
  for (let k = 0; k < s.players.length; k++) {
    const p = s.players[k];
    if (!p.active) continue;
    if (p.stdT > 0) {
      list.push(p.stdY, () => {
        const x = p.stdX - camX, y = FIELD_Y0 + oy + p.stdY;
        const fade = p.stdT < 90 && (s.tick >> 3) & 1 ? 0.3 : 1;
        ring(b, S, x, y, p.stdR, Math.max(16, Math.round(p.stdR / 3)), 0xffd35a, 0.45 * fade);
        const px = (rx: number, ry: number, w: number, h: number, c: number) => b.drawScaled(S.px, Math.round(rx), Math.round(ry), w, h, hex(c, fade));
        px(x - 5, y - 1, 10, 2, 0x000000);
        px(x - 1, y - 30, 2, 30, 0x6a4a2c); // the pole
        const wave = Math.round(Math.sin(s.tick * 0.12) * 1.5);
        px(x + 1, y - 30, 14, 9, 0xb02a2a); px(x + 1, y - 30, 14, 1, 0xffd35a); px(x + 1, y - 22 + wave, 14, 1, 0xffd35a);
        px(x + 6, y - 28, 4, 4, 0xffd35a);
      });
    }
    if (p.rageOn) {
      const hy = e.y[p.ent];
      list.push(hy + 1, () => {
        const x = e.x[p.ent] - camX, y = FIELD_Y0 + oy + hy;
        ring(b, S, x, y, 13 + Math.round(Math.sin(s.tick * 0.3) * 2), 14, 0xff3a2a, 0.7);
        for (let f = 0; f < 3; f++) {
          const fy = ((s.tick * 0.8 + f * 9) % 22);
          b.drawScaled(S.px, Math.round(x - 7 + f * 7), Math.round(y - 14 - fy), 2, 3, hex(f === 1 ? 0xffa03a : 0xff3a2a, 1 - fy / 24));
        }
      });
    }
    if (p.meteorT > 0) {
      // a Meteor marked: a ring closing on the spot, and the streak of the rock coming down
      list.push(p.meteorY, () => {
        const x = p.meteorX - camX, y = FIELD_Y0 + oy + p.meteorY, t = p.meteorT;
        ring(b, S, x, y, 8 + t * 0.9, 18, 0xff5a2a, 0.75);
        ring(b, S, x, y, 4, 8, 0xffd35a, 0.9);
        for (let f = 0; f < 6; f++) b.drawScaled(S.px, Math.round(x + 14 - f * 2 - t * 0.2), Math.round(y - 20 - t * 3.2 - f * 6), 3, 3, hex(f < 2 ? 0xffd35a : 0xff5a2a, 1 - f / 7));
      });
    }
    if (p.sanctT > 0) {
      // a Sanctuary Ring standing: a ring of gold on the ground, a soft inner ring, blinking as it runs out
      list.push(p.sanctY - 1, () => {
        const x = p.sanctX - camX, y = FIELD_Y0 + oy + p.sanctY, fade = p.sanctT < 90 && (s.tick >> 3) & 1 ? 0.3 : 1;
        // a faint light on the ground inside the ring, so what stands in it can be told at a glance
        for (let dy = -p.sanctR; dy <= p.sanctR; dy += 2) { const hw = Math.sqrt(p.sanctR * p.sanctR - dy * dy); b.drawScaled(S.px, Math.round(x - hw), Math.round(y + dy), Math.round(hw * 2), 2, hex(0xffe9a8, 0.09 * fade)); }
        ring(b, S, x, y, p.sanctR, Math.round(p.sanctR * 1.1), 0xfff2b0, 0.95 * fade);
        ring(b, S, x, y, p.sanctR * 0.6, Math.round(p.sanctR * 0.6), 0x9affc8, 0.45 * fade);
      });
    }
    if (p.aegisT > 0) {
      const hy = e.y[p.ent];
      list.push(hy + 1, () => {
        const x = e.x[p.ent] - camX, y = FIELD_Y0 + oy + hy;
        ring(b, S, x, y, 12, 12, 0xfff0a0, Math.min(0.8, p.aegisT / 60));
        ring(b, S, x, y - 10, 9, 10, 0xfff0a0, Math.min(0.5, p.aegisT / 60));
      });
    }
    if (p.patchT > 0) {
      // a patch of ground left behind: caltrops, spikes or a trap, blinking as it runs out
      list.push(p.patchY - 1, () => {
        const x = p.patchX - camX, y = FIELD_Y0 + oy + p.patchY, fade = p.patchT < 60 && (s.tick >> 3) & 1 ? 0.35 : 1;
        const px = (rx: number, ry: number, w: number, h: number, c: number, a = 1) => b.drawScaled(S.px, Math.round(rx), Math.round(ry), w, h, hex(c, a * fade));
        if (p.patchLook === 2) {
          // a toothed trap: a ring of jaws
          for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; px(x + Math.cos(a) * 9 - 1, y + Math.sin(a) * 5 - 1, 2, 3, 0xd4daf0); }
          px(x - 8, y - 1, 16, 2, 0x4a526e); px(x - 1, y - 4, 2, 8, 0x4a526e);
          return;
        }
        const n = Math.max(6, Math.round(p.patchR / 2.5));
        for (let k = 0; k < n; k++) {
          const a = k * 2.399963, rad = p.patchR * Math.sqrt((k + 0.5) / n), cx = x + Math.cos(a) * rad, cy = y + Math.sin(a) * rad;
          if (p.patchLook === 1) { px(cx - 1, cy - 4, 2, 4, 0xd4daf0); px(cx - 2, cy, 4, 1, 0x4a526e); } // a spike
          else { px(cx - 2, cy, 5, 1, 0x8f98b8); px(cx, cy - 2, 1, 5, 0xd4daf0); } // a caltrop
        }
        ring(b, S, x, y, p.patchR, Math.round(p.patchR * 0.9), p.patchLook === 1 ? 0xb9744a : 0x8f98b8, 0.35 * fade);
      });
    }
    if (p.smokeT > 0) {
      // a Smoke Bomb's cloud: puffs of grey about the rogue, thinning as it ends
      list.push(p.smokeY + 2, () => {
        const x = p.smokeX - camX, y = FIELD_Y0 + oy + p.smokeY, a = Math.min(0.6, p.smokeT / 90);
        for (let k = 0; k < 16; k++) {
          const ang = k * 2.399963 + s.tick * 0.01, rad = p.smokeR * Math.sqrt((k + 0.5) / 16), cx = x + Math.cos(ang) * rad, cy = y + Math.sin(ang) * rad * 0.8 - 6;
          b.drawScaled(S.px, Math.round(cx - 6), Math.round(cy - 3), 12, 7, hex(k & 1 ? 0xcfd4dc : 0x8f98b8, a));
        }
        ring(b, S, x, y, p.smokeR, Math.round(p.smokeR * 0.8), 0xcfd4dc, 0.3 * a);
      });
    }
    if (p.drawT > 0) {
      // a bow drawn: a little bar over the archer that fills, and brightens when full
      const hy = e.y[p.ent];
      list.push(hy + 2, () => {
        const x = e.x[p.ent] - camX, y = FIELD_Y0 + oy + hy - 30, f = Math.min(1, p.drawT / 36);
        b.drawScaled(S.px, Math.round(x - 11), Math.round(y - 1), 22, 5, hex(0x000000, 0.7));
        b.drawScaled(S.px, Math.round(x - 10), Math.round(y), Math.round(20 * f), 3, hex(f >= 1 ? 0xfff0a0 : 0xe8a02a));
      });
    }
    if (p.roarT > 0) {
      const hy = e.y[p.ent];
      list.push(hy - 1, () => {
        const x = e.x[p.ent] - camX, y = FIELD_Y0 + oy + hy;
        ring(b, S, x, y, p.roarR, Math.max(16, Math.round(p.roarR / 3)), 0xffe9a8, Math.min(0.5, p.roarT / 120));
      });
    }
  }
}
