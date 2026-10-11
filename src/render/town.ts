// The starting town on screen (docs/21-the-road.md, step 6; where things stand is data/town.ts, what they do sim/town.ts): a stand per class
// with the hero as that class on it (empty for the class the nearest hero already is), the town's places with their rank and price in renown, the heat shrine, and the gate the road begins at. Over them, what a hero
// standing beside one can do there, and the renown left to spend.
import { CLASSES } from '../data/classes';
import { META } from '../data/meta';
import { TREES } from '../data/trees';
import { classStand, heatShrine, metaPlace, TOWN_GATE_X, TOWN_W } from '../data/town';
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { WORLD_H } from '../sim/constants';
import type { GameState } from '../sim/state';
import { townSpot } from '../sim/town';
import { PLAYER_COLORS, type Sprites } from './art';
import { FIELD_Y0 } from './background';
import { drawText } from './draw';
import type { StandingList } from './standing';

/** The town is near enough the screen to draw. */
export function townShown(s: GameState, camX: number): boolean {
  return s.road !== null && camX < TOWN_W + 60;
}

/**
 * The town's stands, places, shrine and gate posts, each standing among the characters by where it touches the ground (a hero who walks
 * behind a stand's hero is hidden by them), with its name and what it costs written on or under it.
 */
export function standingTown(list: StandingList, b: Batcher, S: Sprites, s: GameState, camX: number, oy: number): void {
  if (!townShown(s, camX)) return;
  const r = s.road!;
  const px = (x: number, y: number, w: number, h: number, c: number, a = 1) => b.drawScaled(S.px, Math.round(x), Math.round(y), w, h, hex(c, a));
  const text = (t: string, x: number, y: number, c: number) => drawText(b, S, t, Math.round(x - t.length * 2), Math.round(y), hex(c));
  const at = (sp: { x: number; y: number }) => ({ x: sp.x - camX, y: FIELD_Y0 + oy + sp.y });
  // class stands: the hero as that class, standing ready to be taken up. The look is the nearest hero's (their own person in that class),
  // and the stand of the class they already are is left empty (only its spot and its name).
  const e = s.ents;
  for (let i = 0; i < CLASSES.length; i++) {
    const sp = classStand(i);
    let slot = 0, best = Infinity;
    for (let k = 0; k < s.players.length; k++) {
      const pl = s.players[k];
      if (!pl.active || pl.downed) continue;
      const d = Math.abs(e.x[pl.ent] - sp.x) + Math.abs(e.y[pl.ent] - sp.y);
      if (d < best) { best = d; slot = k; }
    }
    const own = Number.isFinite(best) && s.players[slot].classId === i;
    list.push(sp.y, () => {
      const p = at(sp);
      px(p.x - 7, p.y - 1, 14, 3, 0x000000, own ? 0.15 : 0.3);
      const H = S.heroes[i];
      const A = H?.anims[slot] ?? H?.anims[0];
      if (!own && A) {
        const f = A.idle.frames[Math.floor((s.tick + i * 13) / 24) % A.idle.frames.length];
        b.draw(f, Math.round(p.x - H.pivotX), Math.round(p.y - H.pivotY), false, 0xffffffff);
      }
      text(CLASSES[i].name.toUpperCase(), p.x, p.y + 4, own ? 0xffe9a8 : 0xcfd4dc);
    });
  }
  // the town's places: a booth each, its name and the price of its next rank under it
  META.forEach((m, i) => {
    const sp = metaPlace(i);
    list.push(sp.y, () => {
      const p = at(sp), rank = r.meta[i] ?? 0;
      px(p.x - 18, p.y - 2, 36, 3, 0x000000, 0.25);
      px(p.x - 16, p.y - 22, 32, 20, 0x6a4a2c); px(p.x - 18, p.y - 26, 36, 5, 0x8a2f2f); px(p.x - 16, p.y - 6, 32, 4, 0x4a3220);
      text(m.name, p.x, p.y + 4, 0xffe9a8);
      text(rank >= m.maxRank ? `RANK ${rank} MAX` : `RANK ${rank}  ${m.cost(rank)} RENOWN`, p.x, p.y + 13, rank >= m.maxRank ? 0x8a8f99 : 0xcfd4dc);
    });
  });
  // the heat shrine: a squat stone with an ember on it, brighter the hotter the road
  const hs = heatShrine();
  list.push(hs.y, () => {
    const h = at(hs);
    px(h.x - 7, h.y - 14, 14, 14, 0x5e5a56); px(h.x - 7, h.y - 14, 14, 2, 0x8a8680);
    px(h.x - 2, h.y - 19, 4, 5, 0xff8a3a, 0.4 + 0.12 * s.heat);
    text(`HEAT ${s.heat}`, h.x, h.y + 4, s.heat > 0 ? 0xff9a5a : 0xcfd4dc);
  });
  // the gate: a post at each side of the road (the far one with the lintel and its name), each standing at its own depth
  const gx = TOWN_GATE_X - camX;
  list.push(8, () => {
    const top = FIELD_Y0 + oy + 8;
    px(gx - 3, top - 26, 6, 26, 0x5a3e24);
    px(gx - 8, top - 30, 16, 6, 0x6a4a2c);
    text('THE ROAD', gx, top - 40, 0xffe9a8);
  });
  list.push(WORLD_H - 8, () => {
    const bottom = FIELD_Y0 + oy + WORLD_H - 8;
    px(gx - 3, bottom - 30, 6, 30, 0x5a3e24);
  });
}

/** Over the town, on top of everything: the renown left to spend, and what the hero beside something can do there. */
export function drawTownLabels(b: Batcher, S: Sprites, s: GameState, camX: number, oy: number, hints: readonly string[] | undefined): void {
  if (!townShown(s, camX)) return;
  const r = s.road!;
  const text = (t: string, x: number, y: number, c: number) => drawText(b, S, t, Math.round(x - t.length * 2), Math.round(y), hex(c));
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
    } else if (spot.kind === 'tree') say = TREES[p.classId] ? `${key} OPEN THE ${CLASSES[p.classId].name.toUpperCase()} TREE` : 'NO TREE FOR THIS CLASS YET';
    else say = `${key} RAISE THE HEAT`;
    const e = s.ents, sx = e.x[p.ent] - camX, sy = FIELD_Y0 + oy + e.y[p.ent] - 30;
    b.drawScaled(S.px, Math.round(sx - say.length * 2 - 3), Math.round(sy - 2), say.length * 4 + 6, 9, hex(0x000000, 0.6));
    text(say, sx, sy, PLAYER_COLORS[k]);
  });
}
