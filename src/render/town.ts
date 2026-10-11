// The starting town on screen (docs/21-the-road.md, step 6; where things stand is data/town.ts, what they do sim/town.ts): a banner stand per
// class, the town's places with their rank and price in renown, the heat shrine, and the gate the road begins at. Over them, what a hero
// standing beside one can do there, and the renown left to spend.
import { CLASSES } from '../data/classes';
import { META } from '../data/meta';
import { classStand, heatShrine, metaPlace, TOWN_GATE_X, TOWN_W } from '../data/town';
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { WORLD_H } from '../sim/constants';
import type { GameState } from '../sim/state';
import { townSpot } from '../sim/town';
import { PLAYER_COLORS, type Sprites } from './art';
import { FIELD_Y0 } from './background';
import { drawText } from './draw';

/** A banner colour per class (by index). */
const CLASS_CLOTH = [0x8a2f2f, 0x2f4f9a, 0xd8c070, 0x3a3a46, 0x3f7a3a, 0x8a5a2a];

/** The town is near enough the screen to draw. */
export function townShown(s: GameState, camX: number): boolean {
  return s.road !== null && camX < TOWN_W + 60;
}

/** The town's stands, places, shrine and gate (on the ground, under the heroes). */
export function drawTownGround(b: Batcher, S: Sprites, s: GameState, camX: number, oy: number): void {
  if (!townShown(s, camX)) return;
  const px = (x: number, y: number, w: number, h: number, c: number, a = 1) => b.drawScaled(S.px, Math.round(x), Math.round(y), w, h, hex(c, a));
  const at = (sp: { x: number; y: number }) => ({ x: sp.x - camX, y: FIELD_Y0 + oy + sp.y });
  // class stands: a pole and a banner in the class's colour
  for (let i = 0; i < CLASSES.length; i++) {
    const p = at(classStand(i));
    px(p.x - 1, p.y - 30, 2, 30, 0x5a3e24);
    px(p.x + 1, p.y - 29, 12, 14, CLASS_CLOTH[i % CLASS_CLOTH.length]);
    px(p.x + 1, p.y - 16, 4, 3, CLASS_CLOTH[i % CLASS_CLOTH.length]); px(p.x + 9, p.y - 16, 4, 3, CLASS_CLOTH[i % CLASS_CLOTH.length]);
    px(p.x - 6, p.y, 13, 2, 0x000000, 0.25);
  }
  // the town's places: a booth each
  META.forEach((_, i) => {
    const p = at(metaPlace(i));
    px(p.x - 16, p.y - 22, 32, 20, 0x6a4a2c); px(p.x - 18, p.y - 26, 36, 5, 0x8a2f2f); px(p.x - 16, p.y - 6, 32, 4, 0x4a3220);
    px(p.x - 18, p.y - 2, 36, 3, 0x000000, 0.25);
  });
  // the heat shrine: a squat stone with an ember on it, brighter the hotter the road
  const h = at(heatShrine());
  px(h.x - 7, h.y - 14, 14, 14, 0x5e5a56); px(h.x - 7, h.y - 14, 14, 2, 0x8a8680);
  px(h.x - 2, h.y - 19, 4, 5, 0xff8a3a, 0.4 + 0.12 * s.heat);
  // the gate: two posts and a lintel across the road
  const gx = TOWN_GATE_X - camX, top = FIELD_Y0 + oy + 8, bottom = FIELD_Y0 + oy + WORLD_H - 8;
  px(gx - 3, top - 26, 6, 40, 0x5a3e24); px(gx - 3, bottom - 30, 6, 34, 0x5a3e24);
  px(gx - 8, top - 30, 16, 6, 0x6a4a2c);
}

/** What each thing in the town is, and what the hero beside it can do there (over the heroes). */
export function drawTownLabels(b: Batcher, S: Sprites, s: GameState, camX: number, oy: number, hints: readonly string[] | undefined): void {
  if (!townShown(s, camX)) return;
  const r = s.road!;
  const text = (t: string, x: number, y: number, c: number) => drawText(b, S, t, Math.round(x - t.length * 2), Math.round(y), hex(c));
  const at = (sp: { x: number; y: number }) => ({ x: sp.x - camX, y: FIELD_Y0 + oy + sp.y });
  for (let i = 0; i < CLASSES.length; i++) {
    const p = at(classStand(i));
    const mine = s.players.some((pl) => pl.active && pl.classId === i);
    text(CLASSES[i].name.toUpperCase(), p.x, p.y + 4, mine ? 0xffe9a8 : 0xcfd4dc);
  }
  META.forEach((m, i) => {
    const p = at(metaPlace(i)), rank = r.meta[i] ?? 0;
    text(m.name, p.x, p.y + 4, 0xffe9a8);
    text(rank >= m.maxRank ? `RANK ${rank} MAX` : `RANK ${rank}  ${m.cost(rank)} RENOWN`, p.x, p.y + 13, rank >= m.maxRank ? 0x8a8f99 : 0xcfd4dc);
  });
  const h = at(heatShrine());
  text(`HEAT ${s.heat}`, h.x, h.y + 4, s.heat > 0 ? 0xff9a5a : 0xcfd4dc);
  text('THE ROAD', TOWN_GATE_X - camX, FIELD_Y0 + oy - 32, 0xffe9a8);
  if (r.town) drawText(b, S, `RENOWN ${r.renown}`, 8, FIELD_Y0 + oy - 12, hex(0xffd35a));
  // the hero beside something: what pressing the trade button does there
  s.players.forEach((p, k) => {
    const spot = townSpot(s, k);
    if (!spot || !r.town) return;
    const key = hints?.[k] ?? '';
    let say: string;
    if (spot.kind === 'class') say = p.classId === spot.i ? CLASSES[spot.i].name.toUpperCase() : `${key} BECOME ${CLASSES[spot.i].name.toUpperCase()}`;
    else if (spot.kind === 'meta') {
      const m = META[spot.i], rank = r.meta[spot.i] ?? 0;
      say = rank >= m.maxRank ? `${m.name} IS BUILT` : `${key} BUILD: ${m.text.join(' ')}`;
    } else say = `${key} RAISE THE HEAT`;
    const e = s.ents, sx = e.x[p.ent] - camX, sy = FIELD_Y0 + oy + e.y[p.ent] - 30;
    b.drawScaled(S.px, Math.round(sx - say.length * 2 - 3), Math.round(sy - 2), say.length * 4 + 6, 9, hex(0x000000, 0.6));
    text(say, sx, sy, PLAYER_COLORS[k]);
  });
}
