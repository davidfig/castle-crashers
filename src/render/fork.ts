// A crossroads on the road (docs/21-the-road.md, step 5): the road splits into an upper and a lower way, each with a signpost naming the
// place it leads to and the boss waiting at its end; a line of stones runs between them up to where the party's choice is counted. The
// party chooses by walking (sim/gen/road.ts, `forkChoice`); once it has, the chosen sign is lit and the other dimmed.
import { MOBS } from '../data/mobs';
import { ROSTERS } from '../data/roster';
import { biomeName, rollTone } from '../data/scenery/world';
import { createRng } from '../engine/rng';
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { FORK_SIGNS, type Calm } from '../sim/gen/road';
import { VIEW_W, WORLD_H } from '../sim/constants';
import type { GameState } from '../sim/state';
import type { Sprites } from './art';
import { FIELD_Y0 } from './background';
import { drawText } from './draw';
import { getWorld } from './sceneryWorld';
import type { StandingList } from './standing';

/** Field y of the upper and the lower road's signposts. */
const SIGN_Y = [WORLD_H * 0.22, WORLD_H * 0.8];

/** The crossroads near the screen, if any. */
function forkInView(s: GameState, camX: number): Calm | undefined {
  return s.road?.layout.calm.find((c) => c.kind === 'fork' && c.to > camX - 100 && c.from < camX + VIEW_W + 100);
}

/** The name of the place a road leads to: the biome as this run's world would name it in that region, and its boss's title. */
function placeName(biome: number, stage: number): { place: string; boss: string } {
  const world = getWorld();
  const seed = world ? world.seed : 0;
  const tone = rollTone(createRng(seed, 70 + stage), biome); // the same dice the world rolls for that region's tone (data/scenery/world.ts)
  const boss = MOBS[ROSTERS[biome].boss]?.boss?.title ?? '';
  return { place: biomeName(biome, tone).toUpperCase(), boss };
}

/** The ground of a crossroads: the stones between the roads (flat on the ground, under the heroes). */
export function drawForkGround(b: Batcher, S: Sprites, s: GameState, camX: number, oy: number): void {
  const f = forkInView(s, camX);
  if (!f) return;
  const px = (x: number, y: number, w: number, h: number, c: number, a = 1) => b.drawScaled(S.px, Math.round(x), Math.round(y), w, h, hex(c, a));
  // the stones down the middle, from the signposts to the line where the choice is counted
  const mid = FIELD_Y0 + oy + WORLD_H / 2;
  for (let x = f.from + FORK_SIGNS + 40; x < f.commit! + 30; x += 18) {
    const sx = x - camX, h = 3 + ((x * 7) % 3);
    px(sx, mid - h, 8, h + 2, 0x5a5650);
    px(sx + 1, mid - h, 6, 1, 0x8a867e);
  }
}

/** The two signposts, standing among the characters (a hero walking behind one is hidden by it), each with the words on its board. */
export function standingForkSigns(list: StandingList, b: Batcher, S: Sprites, s: GameState, camX: number, oy: number): void {
  const f = forkInView(s, camX);
  if (!f) return;
  const px = (x: number, y: number, w: number, h: number, c: number, a = 1) => b.drawScaled(S.px, Math.round(x), Math.round(y), w, h, hex(c, a));
  const chosen = s.road!.choices.length >= f.stage! ? s.road!.choices[f.stage! - 1] : -1;
  for (let side = 0; side < 2; side++) {
    list.push(SIGN_Y[side], () => {
      const sx = f.from + FORK_SIGNS - camX, sy = FIELD_Y0 + oy + SIGN_Y[side];
      const dim = chosen >= 0 && chosen !== side;
      px(sx - 1, sy - 30, 3, 30, dim ? 0x3a2a1c : 0x5a3e24); // the post
      px(sx - 22, sy - 34, 44, 12, 0x000000, 0.35);
      px(sx - 21, sy - 35, 42, 10, dim ? 0x4a3a2a : chosen === side ? 0xb08a4a : 0x8a6a3c); // the board
      px(sx + 21, sy - 33, 4, 6, dim ? 0x4a3a2a : chosen === side ? 0xb08a4a : 0x8a6a3c); // its pointed end
      px(sx - 21, sy - 35, 42, 1, 0xc8a870, dim ? 0.3 : 1);
      // where the road leads, and whose lair is at its end
      const { place, boss } = placeName(f.options![side], f.stage!);
      const c = hex(dim ? 0x6a6a6a : chosen === side ? 0xffe9a8 : 0xffffff);
      [place, boss ? `LAIR: ${boss}` : ''].filter(Boolean).forEach((t, i) => {
        const w = t.length * 4 + 6;
        b.drawScaled(S.px, Math.round(sx) + 30, Math.round(sy) - 38 + i * 9, w, 9, hex(0x000000, 0.55));
        drawText(b, S, t, Math.round(sx) + 33, Math.round(sy) - 36 + i * 9, c);
      });
    });
  }
}

/** The signposts' words: where each road leads, whose lair is at its end, and what to do (over the heroes). */
/** What to do at the crossroads, on top of everything. */
export function drawForkLabels(b: Batcher, S: Sprites, s: GameState, camX: number, oy: number): void {
  const f = forkInView(s, camX);
  if (!f) return;
  const chosen = s.road!.choices.length >= f.stage! ? s.road!.choices[f.stage! - 1] : -1;
  const hint = chosen < 0 ? 'UP OR DOWN: CHOOSE YOUR ROAD' : `THE PARTY TAKES THE ${chosen === 0 ? 'UPPER' : 'LOWER'} ROAD`;
  const hx = Math.round(f.from + FORK_SIGNS + 60 - camX), hy = Math.round(FIELD_Y0 + oy + WORLD_H / 2 - 18);
  b.drawScaled(S.px, hx - 3, hy - 2, hint.length * 4 + 6, 9, hex(0x000000, 0.5));
  drawText(b, S, hint, hx, hy, hex(chosen < 0 ? 0xffd35a : 0x9aa8c0));
}
