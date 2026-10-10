// Draws a GameState into the low-res framebuffer. Reads state only; never mutates the sim.
import { CLASSES } from '../data/classes';
import { lerp } from '../engine/math';
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { RAIN_FLIGHT, RAIN_HEIGHT, RAIN_SPREAD, rainLaunchTick, rainOffset } from '../sim/rain';
import { LEVEL_CAM_END, TOP_ENTRY_DEPTH, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from '../sim/constants';
import { ELEM_MASK, Kind, ShrineKind, ZoneKind } from '../sim/entities';
import { drawElemAura, drawElemProj, drawHeroElemCues, drawElemZone, elemTelegraph, Glyph, glyphColor } from './elementDraw';
import { elemId } from './elementFx';
import { CHANNEL, chargeFrac, chestCost, SiteState } from '../sim/sites';
import { HEAT_NAMES } from '../data/heat';
import { BOSS_SPECIAL, isWarded, SP_CLING, SP_LEAP, SP_WIND } from '../sim/abilities';
import { Phase, type GameState } from '../sim/state';
import { BLAST_RADIUS, Behavior, LEGACY_BOSS_MOVES, MOBS, NovaStyle, ProjStyle, isBossType } from '../data/mobs';
import { PLAYER_COLORS, type Sprites } from './art';
import { drawWeather, stormCover } from './weather';
import { drawAmbient, drawCrest, drawFog, drawGround, drawHaze, drawParallax, drawRidge, drawSky, FIELD_Y0, GROUND_TOP } from './background';
import { dayPhase, moodAt } from '../data/biomes';
import { LEVELS_PER_BIOME } from '../campaign/route';
import { roadOffset, Scenery } from './scenery';
import { getWorld, levelsPlayed, roadShift } from './sceneryWorld';
import { BLINK_TICKS, FIRE_RING_LIFE, SLASH_TICKS, type Fx } from './fx';
import { drawCamps, drawStore, drawStoreHints, drawStoreWares, type StoreView } from './camp';
import { drawQuestBoard, drawQuestGivers, drawQuestHud, drawQuestMarks, drawQuestNpc, type QuestView } from './quests';
import { drawLevelUp } from './levelup';
import { drawBoonPops, drawBoonStrip } from './boonHud';
import { drawMercy } from './mercy';
import { heroFrame } from './hero';
import { mobPose } from './mobArt';
import { heldOf, shadowSize } from './mobStyle';
import { activeBestiary } from '../data/bestiary';
import type { FrameStats } from '../platform/perf';
import type { RoadCast } from './roadCast';

/** The biomes on screen this frame (see scenery.ts): the two the road is turning between. */
const scenery = new Scenery();
/** The biome stage the level on screen belongs to (an index into the world's biomes), set each frame. */
let stageSlot = 0;

/**
 * Sets `scenery` up for this frame and returns the road coordinate of the camera's zero. The scenery is drawn in road coordinates (the
 * level's camera plus where that level starts along the road; the store's plus the level's length), so the horizon, ground and hashes carry
 * on across the store and into the next level; the biomes turn from one into the next wherever the run's road says (a stretch of a level or two,
 * not tied to where a level ends). The time of day is the road's clock, so it runs on across levels and biomes.
 */
function setUpScenery(s: GameState, progress: number, camXf: number): number {
  const played = levelsPlayed();
  const base = roadOffset(played);
  const road = base + (s.store ? LEVEL_CAM_END : 0) + roadShift();
  const world = getWorld();
  if (!world) throw new Error('drawFrame: no scenery installed (see installSceneryArt)');
  stageSlot = Math.min(world.biomes.length - 1, Math.floor(played / LEVELS_PER_BIOME));
  scenery.setRoad(world, road + camXf + VIEW_W / 2);
  const here = s.store ? 1 : progress;
  for (let i = 0; i < scenery.n; i++) scenery.prog[i] = scenery.slot[i] === stageSlot ? here : -1;
  const phase = dayPhase(played + here);
  for (let i = 0; i < scenery.n; i++) moodAt(scenery.biome[i], phase, scenery.mood[i]);
  return road;
}

/** Ticks a killed mob takes to topple over before it lies still (a boss is slower: it is heavier). */
const FALL_TICKS = 18;
const BOSS_FALL_TICKS = 36;

/**
 * A body going over: the standing figure pivots about its feet from upright to the way the corpse lies (`t` 0..1), speeding up as gravity takes it,
 * and ends at the corpse's own angle (`rot`, a random lean) so the hand-over to the lying frame is seamless. The figure sinks as it tips, so its side
 * meets the ground rather than hanging in the air.
 */
function drawToppling(b: Batcher, S: Sprites, type: number, sx: number, feetY: number, flip: boolean, rot: number, t: number, tint: number): void {
  const f = S.mob[type][0];
  const pose = topplePose(f.w, f.h, flip, rot, t);
  b.draw(f, sx + pose.cx - f.w / 2, feetY + (f.drop ?? 0) + pose.cy - f.h / 2, flip, tint, 0, pose.angle);
}

/**
 * Where a toppling figure of size w x h is `t` (0..1) of the way over: the centre of its sprite relative to its feet, and the angle it is turned by.
 * It pivots about the feet from upright to lying (a quarter turn toward its head side, plus the random lean `rot` it will lie at), slow at first and
 * quick at the end, and sinks as it tips so its side (half its width) comes to rest on the ground line.
 */
export function topplePose(w: number, h: number, flip: boolean, rot: number, t: number): { cx: number; cy: number; angle: number } {
  const e = 0.5 * t * t * (3 - 2 * t) + 0.5 * t * t;
  const angle = (flip ? -1 : 1) * (Math.PI / 2) * e + rot * e;
  const sinT = Math.sin(angle), cosT = Math.cos(angle);
  return { cx: (h / 2) * sinT, cy: -((h / 2) * Math.abs(cosT) + (w / 2) * Math.abs(sinT)), angle };
}
const order = new Int32Array(4096);
const sortedBuf = new Int32Array(4096);
/** Enemies still climbing up from behind the hill at the top edge (drawn before the ground, so the hill covers them). */
const enterTop = new Int32Array(4096);
/**
 * The climb: over RISE_RUN px of walking (above the field's top edge) an enemy goes from entirely behind the hill
 * to standing on its crest. LIFT is how far below the crest its feet start, a little more than a sprite is tall,
 * so the head appears first. A long run and a small lift make the rise slow enough to read.
 */
const RISE_RUN = 56;
const LIFT = 15;

/** Screen y of an entity's feet. Enemies still coming down the near slope from the hill are drawn on the slope. */
function feetY(e: GameState['ents'], i: number, alpha: number): number {
  const y = lerp(e.py[i], e.y[i], alpha);
  if (e.kind[i] === Kind.Mob && (e.flags[i] & 2) && y < TOP_ENTRY_DEPTH && e.y[i] < WORLD_H / 2) return slopeY(y);
  return FIELD_Y0 + y;
}

/** Screen y of the feet of an enemy that has crested the hill and is walking down the near slope onto the field. */
function slopeY(y: number): number {
  return GROUND_TOP + (FIELD_Y0 + TOP_ENTRY_DEPTH - GROUND_TOP) * (y / TOP_ENTRY_DEPTH);
}
/**
 * How far a struck body is washed toward white, fading over its 6 hurt ticks. It must stay well short of solid white: a fully
 * whitened enemy is invisible against snow and pale ground, so a knocked-back mob seemed to vanish for a moment.
 */
/** A four-point sparkle `arm` px long, centred on (x, y): a plus with a white-hot core. */
function star(b: Batcher, S: Sprites, x: number, y: number, arm: number, color: number, alpha: number): void {
  b.drawScaled(S.px, x - arm - 1, y - 1, arm * 2 + 3, 3, hex(0xb86a10, alpha * 0.55)); // a dark amber edge so it holds against snow
  b.drawScaled(S.px, x - 1, y - arm - 1, 3, arm * 2 + 3, hex(0xb86a10, alpha * 0.55));
  b.drawScaled(S.px, x - arm, y, arm * 2 + 1, 1, hex(color, alpha));
  b.drawScaled(S.px, x, y - arm, 1, arm * 2 + 1, hex(color, alpha));
  b.drawScaled(S.px, x - 1, y - 1, 3, 3, hex(0xffffff, alpha));
}

/** A filled circle of radius r from one horizontal strip per pixel row. */
function drawDisc(b: Batcher, S: Sprites, cx: number, cy: number, r: number, color: number): void {
  const n = Math.max(1, Math.round(r));
  for (let dy = -n; dy <= n; dy++) {
    const half = Math.sqrt(Math.max(0, r * r - dy * dy));
    const w = Math.max(1, Math.round(half * 2));
    b.drawScaled(S.px, Math.round(cx - w / 2), Math.round(cy) + dy, w, 1, color);
  }
}

function hitFlash(hurt: number): number {
  return hurt > 0 ? 0.12 + 0.06 * hurt : 0;
}

const bucket = new Int32Array(WORLD_H + 3);

export interface DebugInfo {
  stats: FrameStats;
  simLag: boolean;
  drawCalls: number;
  sprites: number;
  /** Replaces "press R to fight again" under the win/lose banner (campaign runs continue to the summary instead). */
  endPrompt?: string;
  /** "LEVEL 1 OF 2": where the party is on its route. */
  routeLabel?: string;
  /** Per player slot: the key or button that opens the level-up panel on that player's device. */
  levelKeys?: string[];
  /** In the store: per player slot, the key or button that buys, for a hero standing beside a ware ('' for one who is not). */
  storeHints?: string[];
  /** In the store: the goods on the ground. */
  storeView?: StoreView;
  /** In the store: the people offering quests (render/quests.ts). */
  questView?: QuestView;
  /** No "BATTLE WON" banner: the level was won and the road goes straight on. */
  hideEndBanner?: boolean;
  /** The road scene on this level, whose figures stand among the creatures (see roadCast.ts). */
  cast?: RoadCast;
}

export function drawText(b: Batcher, S: Sprites, text: string, x: number, y: number, color: number, scale = 1, shadow = true): number {
  const str = text.toUpperCase();
  const sc = hex(0x000000, 0.7);
  for (let pass = shadow ? 0 : 1; pass < 2; pass++) {
    let cx = x;
    for (let i = 0; i < str.length; i++) {
      const g = S.glyph[str[i]];
      if (g) {
        if (pass === 0) b.drawScaled(g, cx + scale, y + scale, g.w * scale, g.h * scale, sc);
        else b.drawScaled(g, cx, y, g.w * scale, g.h * scale, color);
      }
      cx += 4 * scale;
    }
  }
  return text.length * 4 * scale;
}

function bar(b: Batcher, S: Sprites, x: number, y: number, w: number, h: number, frac: number, fill: number, back = 0x201818): void {
  b.drawScaled(S.px, x - 1, y - 1, w + 2, h + 2, hex(0x000000, 0.8));
  b.drawScaled(S.px, x, y, w, h, hex(back));
  const fw = Math.max(0, Math.round(w * Math.min(1, frac)));
  if (fw > 0) b.drawScaled(S.px, x, y, fw, h, hex(fill));
}

export function drawFrame(b: Batcher, S: Sprites, s: GameState, fx: Fx, camXf: number, alpha: number, dbg: DebugInfo): void {
  const [shx, shy] = fx.shake();
  const camX = Math.floor(camXf) + shx;
  const oy = shy;
  const e = s.ents;
  const ft = s.tick + alpha; // fractional tick: the drifting scenery moves every frame, not once per sim tick

  // --- sky + parallax layers (the light changes with how far the party has advanced)
  const progress = s.store ? 1 : Math.min(1, Math.max(0, camXf / (WORLD_W - VIEW_W)));
  const road = setUpScenery(s, progress, camXf);
  const mood = scenery.mood[scenery.n === 2 && scenery.share(camXf + road + VIEW_W / 2) > 0.5 ? 1 : 0]; // the air takes the light of whichever biome has most of the view
  drawSky(b, S, scenery, camXf + road, ft, -shx, oy, stormCover(getWorld()!.sky, camXf + road + VIEW_W / 2));
  drawParallax(b, S, scenery, camXf + road, -shx, oy, ft);
  drawHaze(b, S, scenery, camXf + road, oy);

  // --- enemies coming over the top: they climb up from behind the hill (head first, the hill hiding their
  // lower body along its curved crest), stand on the crest, then walk down the near slope onto the field.
  let nTop = 0;
  for (let i = 0; i < e.highWater; i++) {
    if (e.alive[i] && e.kind[i] === Kind.Mob && (e.flags[i] & 2) && e.y[i] < 0) enterTop[nTop++] = i;
  }
  for (let k = 0; k < nTop; k++) {
    const i = enterTop[k];
    const y = lerp(e.py[i], e.y[i], alpha);
    const sx = lerp(e.px[i], e.x[i], alpha) - camX;
    if (y <= -RISE_RUN || sx < -20 || sx > VIEW_W + 20) continue; // still entirely behind the hill
    const u = (y + RISE_RUN) / RISE_RUN; // 0 = just behind the hill, 1 = standing on the crest
    drawMob(b, S, e, i, s.tick, sx, GROUND_TOP + LIFT * (1 - u) + oy, e.face[i] < 0, hitFlash(e.hurt[i]));
  }

  // --- ground, then the hill's crest in front of the climbers
  drawGround(b, S, scenery, camX + road, oy, ft);
  drawCrest(b, S, scenery, camX + road, oy);
  drawFog(b, S, scenery, camX + road, oy, ft);
  drawCamps(b, S, s, camX, oy);
  if (s.store) { drawStore(b, S, s, camX, oy); drawQuestGivers(b, S, s, camX, oy, dbg.questView); }

  // --- corpses
  const cTint = hex(0xffffff, 0.92);
  for (let k = 0; k < fx.cCount; k++) {
    const i = (fx.cHead + k) % fx.cx.length;
    const sx = fx.cx[i] - camX;
    if (sx < -12 || sx > VIEW_W + 12) continue;
    const fall = isBossType(fx.ctype[i]) ? BOSS_FALL_TICKS : FALL_TICKS;
    const age = fx.now - fx.cborn[i] + alpha;
    if (age < fall) { drawToppling(b, S, fx.ctype[i], sx, FIELD_Y0 + fx.cy[i] + oy, fx.cflip[i] === 1, fx.crot[i], age / fall, cTint); continue; }
    // lying where it fell (the boss's body too, and the club it dropped)
    const f = S.corpse[fx.ctype[i]];
    b.draw(f, sx - f.w / 2, FIELD_Y0 + fx.cy[i] - f.h + oy, fx.cflip[i] === 1, cTint, 0, fx.crot[i]);
  }

  // --- spent arrows lying where they fell
  for (let k = 0; k < fx.aCount; k++) {
    const i = (fx.aHead + k) % fx.ax.length;
    const sx = fx.ax[i] - camX;
    if (sx < -10 || sx > VIEW_W + 10) continue;
    const sy = FIELD_Y0 + fx.ay[i] + oy;
    const dx = fx.adx[i], dy = fx.ady[i] * 0.5; // the ground is foreshortened
    for (let t = -3; t <= 3; t++) b.drawScaled(S.px, Math.round(sx + dx * t), Math.round(sy + dy * t), 1, 1, hex(t === 3 ? 0xd8d0b8 : t < -1 ? 0xe8e0c8 : 0x9a7a40, 0.92));
  }

  // --- ground zones: lobbed rocks about to land, poison pools
  for (let i = 0; i < e.highWater; i++) {
    if (!e.alive[i] || e.kind[i] !== Kind.Zone) continue;
    const sx = e.x[i] - camX;
    if (sx < -40 || sx > VIEW_W + 40) continue;
    drawZone(b, S, e, i, sx, FIELD_Y0 + e.y[i] + oy, s.tick);
  }

  // --- visible entities, bucket-sorted by depth
  bucket.fill(0);
  let n = 0;
  for (let i = 0; i < e.highWater; i++) {
    if (!e.alive[i]) continue;
    const ix = lerp(e.px[i], e.x[i], alpha);
    const sx = ix - camX;
    if (sx < -20 || sx > VIEW_W + 20) continue;
    if (e.kind[i] === Kind.Coin || e.kind[i] === Kind.Potion || e.kind[i] === Kind.Zone || e.kind[i] === Kind.Chest || e.kind[i] === Kind.Shrine) continue; // pickups and ground zones are drawn in their own passes
    if (e.kind[i] === Kind.Mob && (e.flags[i] & 2) && e.y[i] < 0) continue; // climbing the far side of the hill: drawn earlier
    const yb = Math.min(WORLD_H, Math.max(0, Math.floor(e.y[i]))) + 1;
    bucket[yb]++;
    order[n++] = i;
  }
  for (let k = 1; k < bucket.length; k++) bucket[k] += bucket[k - 1];
  const sorted = sortedBuf;
  for (let k = 0; k < n; k++) {
    const i = order[k];
    const yb = Math.min(WORLD_H, Math.max(0, Math.floor(e.y[i])));
    sorted[bucket[yb]++] = i;
  }

  // --- coins: spinning gold that arcs out of kills, blinking before it expires
  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Coin) continue;
    const sx = lerp(e.px[i], e.x[i], alpha) - camX;
    if (sx < -8 || sx > VIEW_W + 8) continue;
    const big = e.sub[i] >= 3 ? 1 : 0;
    const spin = ((s.tick >> 3) + i) & 3; // face, face, edge, edge... a cheap spin
    const f = S.coin[big][spin === 2 ? 1 : 0];
    const sy = FIELD_Y0 + lerp(e.py[i], e.y[i], alpha) + oy;
    const z = e.z[i];
    b.drawScaled(S.px, sx - 1, sy - 0.5, 3, 1, hex(0x000000, 0.3));
    // Twinkle: each coin glints on its own cycle so loot stands out from corpses.
    const ph = (s.tick + i * 11) % 36;
    const peak = ph >= 3 && ph <= 6;
    b.draw(f, sx - f.w / 2, sy - z - f.h, false, 0xffffffff, peak ? 0.55 : 0);
    if (ph < 10) {
      const gx = sx + (big ? 2 : 1), gy = sy - z - f.h - 1;
      if (peak) {
        // four-point star
        const arm = ph === 4 || ph === 5 ? 3 : 2;
        b.drawScaled(S.px, gx - arm, gy, arm * 2 + 1, 1, hex(0xffffff, 0.95));
        b.drawScaled(S.px, gx, gy - arm, 1, arm * 2 + 1, hex(0xffffff, 0.95));
      } else {
        b.drawScaled(S.px, gx, gy, 1, 1, hex(0xfff6b0, 0.9));
      }
    }
  }

  // --- potions: a flask that bobs where it landed, with a green (health) or yellow (stamina) glint so a pickup stands out in the melee
  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Potion) continue;
    const sx = lerp(e.px[i], e.x[i], alpha) - camX;
    if (sx < -8 || sx > VIEW_W + 8) continue;
    const f = e.sub[i] === 1 ? S.staminaPotion : S.potion;
    const sy = FIELD_Y0 + lerp(e.py[i], e.y[i], alpha) + oy;
    const bob = e.z[i] > 0 ? 0 : Math.round(Math.sin((s.tick + i * 7) * 0.12) + 1);
    b.drawScaled(S.px, sx - 2, sy - 0.5, 5, 1, hex(0x000000, 0.3));
    b.draw(f, sx - f.w / 2, sy - e.z[i] - f.h - bob, false);
    const ph = (s.tick + i * 13) % 40;
    if (ph < 6) b.drawScaled(S.px, sx + 2, sy - e.z[i] - f.h - bob - 1 - (ph >> 1), 1, 1, hex(e.sub[i] === 1 ? 0xfff08a : 0x7dffa0, 0.9));
  }

  // --- chests and shrines: props on the ground with a price or a name over them and a ring that fills while a hero stands close
  for (let i = 0; i < e.highWater; i++) {
    const kind = e.kind[i];
    if (!e.alive[i] || (kind !== Kind.Chest && kind !== Kind.Shrine)) continue;
    const sx = Math.round(e.x[i] - camX);
    if (sx < -60 || sx > VIEW_W + 60) continue;
    const sy = Math.round(FIELD_Y0 + e.y[i] + oy);
    const st = e.elite[i];
    const spent = st === SiteState.Spent;
    const pulse = 0.5 + 0.5 * Math.sin((s.tick + i * 9) * 0.1);
    b.draw(S.shadow[1], sx - S.shadow[1].w / 2, sy - 3, false, hex(0x000000, 0.35));
    let top = sy;
    if (kind === Kind.Chest) {
      const f = S.chest[spent ? 1 : 0];
      const y0 = sy - f.h - Math.max(0, e.z[i]);
      b.draw(f, sx - f.w / 2, y0, false, spent ? hex(0xc0c0c0) : 0xffffffff);
      top = y0;
      if (!spent) {
        const free = st === SiteState.Free;
        const cost = chestCost(s);
        const label = free ? 'FREE' : String(cost);
        drawText(b, S, label, sx - label.length * 2, y0 - 8, hex(free || s.gold >= cost ? 0xffd35a : 0xe0503a), 1, true);
        if (free && (s.tick + i) % 50 < 6) b.drawScaled(S.px, sx + 3, y0 - 1, 2, 2, hex(0xffffff, 0.9));
      }
    } else {
      const sub = e.sub[i];
      const f = S.shrine[sub];
      const y0 = sy - f.h;
      b.draw(f, sx - f.w / 2, y0, false, spent ? hex(0x777777) : 0xffffffff);
      top = y0;
      const col = [0xe0442e, 0x4aa0ff, 0xffc02a, 0xe8ecff][sub];
      if (st === SiteState.Waiting) drawText(b, S, ['CURSE', 'CHARGE', 'GREED', 'MERCY'][sub], sx - ['CURSE', 'CHARGE', 'GREED', 'MERCY'][sub].length * 2, y0 - 8, hex(col), 1, true);
      if (st === SiteState.Running) {
        groundRing(b, S, sx, sy, 10 + 3 * pulse, 14, hex(col, 0.9));
        if (sub === ShrineKind.Charge) {
          // the field of the charge: a ring that fills clockwise as the meter climbs
          const frac = chargeFrac(s, i), dots = 48;
          for (let d = 0; d < dots; d++) {
            const a = (d / dots) * Math.PI * 2 - Math.PI / 2;
            b.drawScaled(S.px, sx + Math.cos(a) * 60 - 1, sy + Math.sin(a) * 60 * 0.7 - 1, 2, 2, hex(col, d / dots < frac ? 0.95 : 0.28));
          }
        }
      }
    }
    if (e.buff[i] > 0 && st !== SiteState.Running) {
      const w = 18, f = Math.min(1, e.buff[i] / CHANNEL);
      b.drawScaled(S.px, sx - w / 2 - 1, top - 5, w + 2, 4, hex(0x000000, 0.7));
      b.drawScaled(S.px, sx - w / 2, top - 4, Math.round(w * f), 2, hex(0xffd35a));
    }
  }

  // --- the cleric's aura: while it is on, a ring of holy light turns steadily on the ground around her (the damage is continuous, see sim/step.ts)
  for (const pl of s.players) {
    if (!pl.active || pl.downed || !pl.auraOn) continue;
    const r = CLASSES[pl.classId].combo[0].range;
    const ax = lerp(e.px[pl.ent], e.x[pl.ent], alpha) - camX, ay = FIELD_Y0 + lerp(e.py[pl.ent], e.y[pl.ent], alpha) + oy;
    const spin = s.tick * 0.07;
    const pulse = 0.5 + 0.5 * Math.sin(s.tick * 0.12);
    // a soft golden pool on the ground, so the reach of the aura reads at a glance
    b.drawScaled(S.disc, Math.round(ax - r), Math.round(ay - r * 0.85), r * 2, r * 1.7, hex(0xffc030, 0.2 + 0.08 * pulse));
    // the outer ring: a bright, turning band of dots with a larger star at every fourth
    for (let d = 0; d < 32; d++) {
      const a = (d / 32) * Math.PI * 2 + spin;
      const x = Math.round(ax + Math.cos(a) * r), y = Math.round(ay + Math.sin(a) * r * 0.85);
      if ((d & 3) === 0) star(b, S, x, y, 3, 0xffe27a, 1);
      else b.drawScaled(S.px, x - 1, y - 1, 2, 2, hex(0xe8961a, 0.85));
    }
    // big stars close in, turning the other way and twinkling
    for (let d = 0; d < 6; d++) {
      const a = -spin * 1.5 + d * (Math.PI / 3), rr = r * (0.38 + 0.1 * Math.sin(s.tick * 0.1 + d * 2));
      star(b, S, Math.round(ax + Math.cos(a) * rr), Math.round(ay + Math.sin(a) * rr * 0.85) - 3, (d + (s.tick >> 3)) & 1 ? 4 : 3, 0xffe27a, 1);
    }
  }

  const shadowTint = hex(0x000000, 0.32);
  for (let k = 0; k < n; k++) {
    const i = sorted[k];
    const sx = lerp(e.px[i], e.x[i], alpha) - camX;
    const sy = feetY(e, i, alpha) + oy;
    if (e.kind[i] === Kind.Proj) continue;
    if (e.kind[i] === Kind.Mob && isBossType(e.sub[i])) {
      b.drawScaled(S.shadow[2], sx - 36, sy - 8, 72, 14, shadowTint);
      continue;
    }
    let sh = S.shadow[1];
    let tint = shadowTint;
    if (e.kind[i] === Kind.Mob) sh = S.shadow[shadowSize(e.sub[i])];
    else if (e.kind[i] === Kind.Player) tint = hex(PLAYER_COLORS[e.sub[i]], 0.55);
    b.draw(sh, sx - sh.w / 2, sy - sh.h / 2 - 1, false, tint);
  }

  // the road scene's figures stand among the creatures, in depth order (they are sorted by field y)
  const cast = dbg.cast;
  let nextFig = 0;
  const figCount = cast ? cast.figures.length : 0;
  for (let k = 0; k < n; k++) {
    const i = sorted[k];
    while (cast && nextFig < figCount && cast.figures[nextFig].y <= e.y[i]) cast.drawFigure(b, S, nextFig++, camX, oy, s.tick);
    const sx = lerp(e.px[i], e.x[i], alpha) - camX;
    const sy = feetY(e, i, alpha) + oy;
    const flip = e.face[i] < 0;
    let flash = hitFlash(e.hurt[i]);
    if (e.kind[i] === Kind.Proj) {
      // arrow: bright head, dim tail, flying a little above the ground
      const vl = Math.sqrt(e.vx[i] * e.vx[i] + e.vy[i] * e.vy[i]) || 1;
      const dx = e.vx[i] / vl, dy = e.vy[i] / vl;
      // A player's projectile (sub = 1 + slot) is drawn by its class's shot: a fireball for splash shots, a golden arrow otherwise.
      const owner = e.sub[i] > 0 ? s.players[e.sub[i] - 1] : null;
      const shot = owner ? ((e.flags[i] & 4) ? CLASSES[owner.classId].specialShot : CLASSES[owner.classId].shot) : null;
      if (shot && shot.splash && (e.flags[i] & 4)) {
        // the mage's great fireball: a big, slow, flickering orb with a smoky ember trail
        const flick = ((s.tick >> 1) + i) & 1;
        // a lobbed ball climbs and falls in an arc over its flight, with a shadow marking where it will land
        const lift = shot.lob ? 4 * 46 * Math.min(1, Math.max(0, (shot.ttl - e.hp[i]) / shot.ttl)) * (1 - Math.min(1, Math.max(0, (shot.ttl - e.hp[i]) / shot.ttl))) : 0;
        if (shot.lob) drawDisc(b, S, sx, sy, 6 - lift / 14, hex(0x000000, 0.25));
        const cy = sy - 12 - lift;
        for (let t = 6; t >= 1; t--) {
          const w = 12 - t;
          drawDisc(b, S, sx - dx * t * 5, cy - dy * t * 5, w / 2, hex(t > 3 ? 0xa02a1e : 0xd8402e, 0.5 - t * 0.06));
        }
        drawDisc(b, S, sx, cy, 9, hex(0xd8402e, 0.4 + flick * 0.1));
        drawDisc(b, S, sx, cy, 7, hex(0xff8a30, 0.85));
        drawDisc(b, S, sx, cy, 5, hex(0xffb340));
        drawDisc(b, S, sx, cy, 3, hex(0xffe890));
        drawDisc(b, S, sx - flick * 0.5, cy - flick * 0.5, 1.5, hex(0xffffff));
      } else if (shot && shot.splash) {
        // the mage's main fireball: the great one's orb at about two thirds its size, with a short ember trail
        const flick = ((s.tick >> 1) + i) & 1;
        const cy = sy - 10;
        for (let t = 5; t >= 1; t--) drawDisc(b, S, sx - dx * t * 3.5, cy - dy * t * 3.5, (8 - t) / 2 * 0.9, hex(t > 2 ? 0xa02a1e : 0xd8402e, 0.55 - t * 0.09));
        drawDisc(b, S, sx, cy, 6.8, hex(0xd8402e, 0.4 + flick * 0.1));
        drawDisc(b, S, sx, cy, 5.4, hex(0xff8a30, 0.85));
        drawDisc(b, S, sx, cy, 3.8, hex(0xffb340));
        drawDisc(b, S, sx, cy, 2.3, hex(0xffe890));
        drawDisc(b, S, sx - flick * 0.5, cy - flick * 0.5, 1.1, hex(0xffffff));
      } else if (shot) {
        // dark enough to read on snow: a deep brown tail, a burnt-gold shaft and a dark-edged amber head (no white)
        b.drawScaled(S.px, sx - dx * 5, sy - 7 - dy * 5, 2, 2, hex(0x5a3a12));
        b.drawScaled(S.px, sx - dx * 2.5, sy - 7 - dy * 2.5, 2, 2, hex(0xa86f12));
        b.drawScaled(S.px, sx - 1, sy - 8, 4, 4, hex(0x3a2408, 0.8));
        b.drawScaled(S.px, sx, sy - 7, 2, 2, hex(0xf0b830));
      } else if (!owner && e.mode[i] >= ProjStyle.Orb) {
        drawElemProj(b, S, sx, sy, dx, dy, e.mode[i], e.flags[i] & ELEM_MASK, e.flags[i], s.tick, i);
      } else if (e.mode[i] === ProjStyle.Shard) {
        // a splinter of ice thrown off a shattering husk: a small pale blue sliver that glints
        b.drawScaled(S.px, Math.round(sx - dx * 2), Math.round(sy - 6 - dy * 2), 1, 1, hex(ICE.mid, 0.7));
        b.drawScaled(S.px, Math.round(sx - 1), Math.round(sy - 7), 3, 3, hex(ICE.deep));
        b.drawScaled(S.px, Math.round(sx), Math.round(sy - 6), 1, 1, hex(ICE.light)); // a dark body so it shows on the snow
        if (((s.tick >> 1) + i) & 1) b.drawScaled(S.px, Math.round(sx + dx * 2), Math.round(sy - 6 + dy * 2), 1, 1, hex(0xffffff));
      } else if (e.mode[i] === ProjStyle.Harpoon) {
        drawHarpoon(b, S, sx, sy - 7, dx, dy);
      } else if (e.mode[i] === ProjStyle.Glob) {
        // a glob of marsh venom: a fat green-black blob that wobbles, with a drip behind it
        const wob = ((s.tick >> 1) + i) & 1;
        b.drawScaled(S.px, Math.round(sx - dx * 4), Math.round(sy - 6 - dy * 4), 2, 2, hex(0x4a6a1a, 0.7));
        b.drawScaled(S.px, Math.round(sx - 2), Math.round(sy - 9), 5, 5, hex(0x24340c, 0.85));
        b.drawScaled(S.px, Math.round(sx - 1), Math.round(sy - 8 + wob), 3, 3, hex(0x8cc83a));
        b.drawScaled(S.px, Math.round(sx), Math.round(sy - 8), 1, 1, hex(0xd8f890));
      } else if (e.mode[i] === ProjStyle.Falcon) {
        // a falcon stooping on its prey: a dark body, wings that beat, a pale breast
        const beat = ((s.tick >> 2) + i) & 1;
        const wy = Math.round(sy - 9);
        b.drawScaled(S.px, Math.round(sx - dx * 5), Math.round(sy - 8 - dy * 5), 2, 1, hex(0x3a2a18, 0.5));
        b.drawScaled(S.px, Math.round(sx - 4), beat ? wy - 2 : wy + 1, 3, 1, hex(0x5a3a1c));
        b.drawScaled(S.px, Math.round(sx + 2), beat ? wy - 2 : wy + 1, 3, 1, hex(0x5a3a1c));
        b.drawScaled(S.px, Math.round(sx - 2), wy, 5, 3, hex(0x3a2410));
        b.drawScaled(S.px, Math.round(sx - 1), wy + 1, 3, 1, hex(0xd8c090));
        b.drawScaled(S.px, Math.round(sx + (dx >= 0 ? 2 : -2)), wy, 1, 1, hex(0xf0c040));
      } else if (e.mode[i] === ProjStyle.Fire) {
        // a flaming arrow: a streak of embers behind a burning head
        const flick = ((s.tick >> 1) + i) & 1;
        for (let t = 5; t >= 1; t--) b.drawScaled(S.px, Math.round(sx - dx * t * 2.5), Math.round(sy - 7 - dy * t * 2.5), 2, 2, hex(t > 3 ? 0x9a2a10 : 0xe86a1a, 0.9 - t * 0.12));
        b.drawScaled(S.px, Math.round(sx - 2), Math.round(sy - 9), 4, 4, hex(0x4a1808, 0.8));
        b.drawScaled(S.px, Math.round(sx - 1), Math.round(sy - 8 - flick), 3, 3, hex(0xff8a30));
        b.drawScaled(S.px, Math.round(sx), Math.round(sy - 7), 1, 1, hex(0xffe890));
      } else if (e.mode[i] === ProjStyle.Bone) {
        // a thrown bone: pale, tumbling
        const spin = ((s.tick >> 1) + i) & 1;
        b.drawScaled(S.px, sx - dx * 4, sy - 7 - dy * 4, 2, 2, hex(0xa39a98));
        b.drawScaled(S.px, sx - 1, sy - 8, spin ? 4 : 2, spin ? 2 : 4, hex(0xefe9da));
      } else {
        b.drawScaled(S.px, sx - dx * 5, sy - 7 - dy * 5, 2, 2, hex(0x8b5a2b));
        b.drawScaled(S.px, sx - dx * 2.5, sy - 7 - dy * 2.5, 2, 2, hex(0xd9c9a0));
        b.drawScaled(S.px, sx, sy - 7, 2, 2, hex(0xffffff));
      }
      continue;
    }
    if (e.kind[i] === Kind.Mob && isBossType(e.sub[i])) {
      drawBoss(b, S, e, i, s.tick, sx, sy, flip, flash);
    } else if (e.kind[i] === Kind.Mob) {
      drawMob(b, S, e, i, s.tick, sx, sy, flip, flash);
    } else if (e.kind[i] === Kind.Npc) {
      drawQuestNpc(b, S, s, i, sx, sy, flip, flash);
    } else {
      const slot = e.sub[i];
      const p = s.players[slot];
      // Hero art comes from the art workbench (hero.ts). Frames are cells with the feet-centre at (pivotX, pivotY),
      // so mirror the pivot column when facing left.
      const H = S.heroes[p.classId] ?? S.heroes[0];
      const place = (f: { w: number }) => sx - (flip ? f.w - 1 - H.pivotX : H.pivotX);
      if (p.downed) {
        const df = heroFrame(H, s, fx, slot, false);
        b.draw(df, place(df), sy - H.pivotY, flip, 0xffffffff);
        drawText(b, S, String(Math.ceil(p.downTimer / 60)), sx - 2, sy - 22, 0xffffffff);
        continue;
      }
      const moving = Math.abs(e.x[i] - e.px[i]) + Math.abs(e.y[i] - e.py[i]) > 0.05;
      const f = heroFrame(H, s, fx, slot, moving);
      // a charging hero is invulnerable but doesn't blink: he gets the orc's motion trail instead
      const charging = p.dashT > 0 && CLASSES[p.classId].dashKind === 'charge';
      const blink = p.invuln > 0 && !charging && (s.tick & 2) !== 0;
      const tint = p.vanishT > 0 ? hex(0xffffff, 0.3) : blink ? hex(0xffffff, 0.5) : 0xffffffff;
      // Teleport arrival: re-form from a thin bright column into the full sprite.
      let arrive = -1;
      for (let k = 0; k < fx.blt.length; k++) {
        if (fx.blt[k] >= 0 && Math.abs(fx.blx1[k] - e.x[i]) < 3 && Math.abs(fx.bly1[k] - e.y[i]) < 3) arrive = Math.min(1, fx.blt[k] / (BLINK_TICKS * 0.2));
      }
      if (arrive >= 0 && arrive < 1) {
        const e1 = 1 - (1 - arrive) * (1 - arrive);
        const w = f.w * (0.45 + 0.55 * e1), h = f.h * (1.2 - 0.2 * e1);
        const x0 = sx - (flip ? f.w - 1 - H.pivotX : H.pivotX) + (f.w - w) / 2;
        b.drawScaled(f, x0, sy - H.pivotY - (h - f.h), w, h, hex(0xd8c4ff, 0.7 + 0.3 * e1), flip, 0.7 * (1 - e1));
      } else {
        if (charging) {
          // motion trail: fading ghosts behind the charger, plus kicked-up dust at his heels
          for (let g = 3; g >= 1; g--) b.draw(f, place(f) - p.dashX * g * 6, sy - H.pivotY - p.dashY * g * 6, flip, hex(0xffffff, 0.34 - g * 0.08), 0.3);
          for (let k = 0; k < 2; k++) {
            const t = ((s.tick * 0.7 + k * 7 + i * 3) % 12) / 12;
            b.drawScaled(S.px, Math.round(sx - p.dashX * (4 + t * 10)), Math.round(sy - p.dashY * (4 + t * 10) - 1 - t * 3), 2, 1, hex(0xc8b488, 0.7 * (1 - t)));
          }
        }
        b.draw(f, place(f), sy - H.pivotY, flip, tint, flash);
      }
      if (p.silenceT > 0) {
        // silenced: a violet cross hanging over the head
        const cx = Math.round(sx), cy = Math.round(sy - H.top - 12);
        for (const [dx, dy] of [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]]) b.drawScaled(S.px, cx + dx, cy + dy, 1, 1, hex(0xb890ff));
      }
      if (p.rootT > 0) groundRing(b, S, sx, sy, 7, 10, hex(ICE.steel, 0.95)); // held fast in a snare
      if (p.rootT > 0 && p.slowT > 0 && p.silenceT === 0) b.draw(f, place(f), sy - H.pivotY, flip, hex(0x6ad0ff, 0.6), 0.25); // frozen solid: the hero turns ice-blue
      drawHeroElemCues(b, S, p, sx, sy - H.top, s.tick, i);
      if (p.hexT > 0) {
        // hexed: a violet sigil turning on the ground and a pip over the head
        groundRing(b, S, sx, sy, 8, 12, hex(0x9a4ad0, 0.55 + 0.3 * (((s.tick >> 3) & 1))));
        b.drawScaled(S.px, Math.round(sx - 1), Math.round(sy - H.top - 14), 3, 3, hex(0x9a4ad0));
        b.drawScaled(S.px, Math.round(sx), Math.round(sy - H.top - 13), 1, 1, hex(0xe0b0ff));
      }
      if (p.witherT > 0) {
        // withered: grey flecks falling off the hero
        for (let q = 0; q < 2; q++) {
          const t = ((s.tick * 0.5 + q * 11 + i * 3) % 18) / 18;
          b.drawScaled(S.px, Math.round(sx - 3 + q * 5), Math.round(sy - H.top + t * 10), 1, 1, hex(0x8a8070, 0.85 * (1 - t)));
        }
      }
      if (p.poisonT > 0) {
        // venom (green bubbles) or burning (embers) rising off the body
        const cx = Math.round(sx), hy = Math.round(sy - H.top);
        for (let q = 0; q < 3; q++) {
          const t = ((s.tick * 0.7 + q * 9 + i * 5) % 20) / 20;
          b.drawScaled(S.px, cx - 3 + q * 3 + (q === 1 ? 1 : 0), Math.round(hy + 8 - t * 12), 1, 1, hex(p.burning ? (q & 1 ? 0xffb030 : 0xff6a20) : (q & 1 ? 0xd8f890 : 0x8cc83a), 0.9 * (1 - t)));
        }
      }
      if (p.confuseT > 0) {
        // lost in a whiteout: question marks circling the head
        for (let q = 0; q < 3; q++) {
          const a = s.tick * 0.2 + q * 2.094;
          drawText(b, S, '?', Math.round(sx + Math.cos(a) * 6 - 2), Math.round(sy - H.top - 3 + Math.sin(a) * 2), hex(0xbfe8ff), 1);
        }
      }
      // overhead hp + ability pips
      const cls = CLASSES[p.classId];
      bar(b, S, Math.round(sx - 8), Math.round(sy - H.top - 6), 16, 2, e.hp[i] / cls.hp, 0x4fd05a);
      // Stamina: only shown while it is not full (or the hero is winded), so a rested hero stays uncluttered.
      if (p.stamina < cls.staminaMax - 0.5 || p.winded) {
        const sty = Math.round(sy - H.top - 9);
        const col = p.winded ? ((s.tick >> 2) & 1 ? 0xff5a4a : 0xb83a2e) : p.stamina < cls.dashCost ? 0xe0a030 : 0x5ab8f0;
        bar(b, S, Math.round(sx - 8), sty, 16, 2, p.stamina / cls.staminaMax, col, 0x161c28);
        if (p.winded) drawText(b, S, 'WINDED', Math.round(sx - 12), sty - 7, hex(0xff8a7a));
      }
      const fy = Math.round(sy - H.top - 3);
      const fx0 = Math.round(sx - 8);
      const full = p.fury >= cls.furyMax;
      const canNova = p.fury >= cls.novaCost;
      b.drawScaled(S.px, fx0, fy, Math.round(16 * p.fury / cls.furyMax), 2, hex(full ? ((s.tick >> 2) & 1 ? 0xffffff : 0xffd35a) : canNova ? 0xffc23a : 0xa07a30));
      b.drawScaled(S.px, fx0 + 8, fy, 1, 2, hex(0x000000, 0.7)); // nova cost notch
      // big-swing pip: bright when it is ready and affordable
      const spReady = p.cdSpecial === 0 && !p.winded && p.stamina >= cls.specialCost;
      b.drawScaled(S.px, fx0 + 18, fy, 2, 2, hex(spReady ? 0xffd35a : 0x6a5a30));
    }
  }
  while (cast && nextFig < figCount) cast.drawFigure(b, S, nextFig++, camX, oy, s.tick);

  // --- teleport: the wizard's afterimage dissolves upward at the origin, with a light column at each end
  for (let k = 0; k < fx.blt.length; k++) {
    if (fx.blt[k] < 0) continue;
    const u = fx.blt[k] / BLINK_TICKS, fade = 1 - u;
    let pl = -1, best = 12;
    for (let q = 0; q < s.players.length; q++) {
      const ei = s.players[q].ent;
      if (ei === undefined || ei < 0) continue;
      const d = Math.abs(s.ents.x[ei] - fx.blx1[k]) + Math.abs(s.ents.y[ei] - fx.bly1[k]);
      if (d < best) { best = d; pl = q; }
    }
    if (pl >= 0) {
      const Hh = S.heroes[s.players[pl].classId] ?? S.heroes[0];
      const gf = heroFrame(Hh, s, fx, pl, false);
      const gw = gf.w * (1 - u * 0.85), gh = gf.h * (1 + u * 0.8);
      const gx = fx.blx0[k] - camX - (s.players[pl].faceX < 0 ? gf.w - 1 - Hh.pivotX : Hh.pivotX) + (gf.w - gw) / 2;
      b.drawScaled(gf, gx, FIELD_Y0 + fx.bly0[k] + oy - Hh.pivotY - (gh - gf.h), gw, gh, hex(0xb78cff, fade * 0.8), s.players[pl].faceX < 0, 0.6);
    }
    for (let side = 0; side < 2; side++) {
      const cx = (side === 0 ? fx.blx0[k] : fx.blx1[k]) - camX, cy = FIELD_Y0 + (side === 0 ? fx.bly0[k] : fx.bly1[k]) + oy;
      const w = Math.max(1, Math.round(6 * (side === 0 ? fade : u < 0.5 ? u * 2 : 2 - u * 2)));
      const a = side === 0 ? fade : 1 - u;
      b.drawScaled(S.px, cx - w / 2, cy - 34, w, 34, hex(0xe6d8ff, a * 0.55));
    }
  }

  // --- shockwave rings
  for (let r = 0; r < fx.rr.length; r++) {
    if (fx.rt[r] < 0) continue;
    const t = fx.rt[r] / 18;
    const radius = fx.rr[r] * (1 - (1 - t) * (1 - t));
    const dots = Math.min(160, Math.ceil(radius * 1.6));
    const base = fx.rc[r];
    const col = ((base & 0x00ffffff) | (Math.round(255 * (1 - t)) << 24)) >>> 0;
    if (fx.rbig[r] >= 4) {
      // The mage's ring of fire: a ring of fireballs flying out from him, each with a smoky ember trail back toward where he stood,
      // over a faint scorched ring on the ground. Slower than the other novas (the ring lives longer, see Fx.update).
      const big = fx.rbig[r] === 5;
      const tf = fx.rt[r] / FIRE_RING_LIFE;
      const rad = fx.rr[r] * (1 - Math.pow(1 - tf, 1.6));
      const cxr = fx.rx[r] - camX, cyr = FIELD_Y0 + fx.ry[r] + oy;
      const a = Math.min(1, 2.2 * (1 - tf));
      const balls = big ? 14 : 10;
      for (let d = 0; d < 48; d++) {
        const ang = (d / 48) * Math.PI * 2;
        b.drawScaled(S.px, cxr + Math.cos(ang) * rad * 0.9, cyr + Math.sin(ang) * rad * 0.9, 2, 2, hex(0x3a1a10, a * 0.3));
      }
      for (let d = 0; d < balls; d++) {
        const ang = (d / balls) * Math.PI * 2 + 0.3;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const px = cxr + ca * rad, py = cyr + sa * rad - 8;
        const flick = ((s.tick >> 1) + d) & 1;
        const size = (big ? 5.5 : 4.2) * (1 - tf * 0.35);
        for (let k = 5; k >= 1; k--) drawDisc(b, S, px - ca * k * 4, py - sa * k * 4, size * (1 - k * 0.14), hex(k > 2 ? 0xa02a1e : 0xd8402e, a * (0.5 - k * 0.07)));
        drawDisc(b, S, px, py, size + 1.8, hex(0xd8402e, a * (0.4 + flick * 0.1)));
        drawDisc(b, S, px, py, size, hex(0xff8a30, a * 0.9));
        drawDisc(b, S, px, py, size * 0.7, hex(0xffb340, a));
        drawDisc(b, S, px, py, size * 0.4, hex(0xffe890, a));
        drawDisc(b, S, px - flick * 0.5, py - flick * 0.5, size * 0.2, hex(0xffffff, a));
      }
      continue;
    }
    if (fx.rbig[r] >= 2) {
      // A holy halo: a bold two-pixel ring squashed onto the ground, with big four-point stars turning around it. It stays bright
      // for most of its life and only fades at the end, and the stars have a dark gold edge so they read against any ground.
      const heavy = fx.rbig[r] === 3;
      const cxr = fx.rx[r] - camX, cyr = FIELD_Y0 + fx.ry[r] + oy;
      const a = Math.min(1, 2.2 * (1 - t));
      const bright = hex(heavy ? 0xffffff : 0xfff3b0, a);
      const edge = hex(0xb07a10, a);
      const n = Math.max(16, Math.ceil(radius * 0.9));
      for (let d = 0; d < n; d++) {
        const ang = (d / n) * Math.PI * 2;
        const px = cxr + Math.cos(ang) * radius, py = cyr + Math.sin(ang) * radius * 0.6;
        b.drawScaled(S.px, px - 1, py - 1, 3, 3, edge);
      }
      for (let d = 0; d < n; d++) {
        const ang = (d / n) * Math.PI * 2;
        b.drawScaled(S.px, cxr + Math.cos(ang) * radius, cyr + Math.sin(ang) * radius * 0.6, 2, 2, bright);
      }
      const stars = heavy ? 8 : 6;
      const arm = heavy ? 5 : 4;
      for (let d = 0; d < stars; d++) {
        const ang = (d / stars) * Math.PI * 2 + t * 2.2;
        const sx = Math.round(cxr + Math.cos(ang) * radius), sy = Math.round(cyr + Math.sin(ang) * radius * 0.6 - 2);
        b.drawScaled(S.px, sx - arm - 1, sy - 1, arm * 2 + 3, 3, edge);
        b.drawScaled(S.px, sx - 1, sy - arm - 1, 3, arm * 2 + 3, edge);
        b.drawScaled(S.px, sx - arm, sy, arm * 2 + 1, 1, bright);
        b.drawScaled(S.px, sx, sy - arm, 1, arm * 2 + 1, bright);
        b.drawScaled(S.px, sx - 1, sy - 1, 3, 3, bright);
      }
      continue;
    }
    const thick = fx.rbig[r] ? 3 : 2;
    for (let d = 0; d < dots; d++) {
      const ang = (d / dots) * Math.PI * 2;
      b.drawScaled(S.px, fx.rx[r] + Math.cos(ang) * radius - camX, FIELD_Y0 + fx.ry[r] + Math.sin(ang) * radius + oy, thick, thick, col);
    }
    if (fx.rbig[r]) {
      const r2 = radius * 0.85;
      for (let d = 0; d < dots; d++) {
        const ang = (d / dots) * Math.PI * 2;
        b.drawScaled(S.px, fx.rx[r] + Math.cos(ang) * r2 - camX, FIELD_Y0 + fx.ry[r] + Math.sin(ang) * r2 + oy, 2, 2, hex(0xffd35a, (1 - t) * 0.8));
      }
    }
  }

  // --- foreground ridge along the bottom of the field
  drawRidge(b, S, scenery, camX + road, oy, ft);
  drawAmbient(b, S, scenery, camX + road, oy, ft);

  // --- launched bodies: tumbling mobs knocked out of the pack
  for (let i = 0; i < fx.nb; i++) {
    const sx = fx.bx[i] - camX;
    if (sx < -16 || sx > VIEW_W + 16) continue;
    const f = S.mob[fx.btype[i]][0];
    const flash = fx.bage[i] < 4 ? 0.9 : 0;
    // it turns through the air, head first, to the very pose it will lie in when it lands (so the landing is not a jump)
    const p = Math.min(1, (fx.bage[i] + alpha) / Math.max(1, fx.bdur[i]));
    const pose = topplePose(f.w, f.h, fx.bflip[i] === 1, fx.brot[i], p);
    b.draw(f, sx - f.w / 2, FIELD_Y0 + fx.by[i] - fx.bz[i] + (f.drop ?? 0) + pose.cy - f.h / 2 + oy, fx.bflip[i] === 1, 0xffffffff, flash, pose.angle);
  }

  // --- slash arcs: a bold arc with a bright leading edge sweeping through the swing
  for (let k = 0; k < fx.slt.length; k++) {
    if (fx.slt[k] < 0) continue;
    const prog = Math.min(1, fx.slt[k] / SLASH_TICKS);
    const fade = 1 - Math.max(0, (fx.slt[k] - SLASH_TICKS) / 5);
    const h = fx.slh[k], dir = fx.slDir[k], heavy = fx.slHeavy[k] === 1;
    const head = -h + 2 * h * prog;
    const trail = Math.min(2 * h, heavy ? 3.2 : 2.4);
    const steps = Math.max(10, Math.ceil(fx.slr[k] * trail / 1.6));
    const thick = heavy ? 4 : 3;
    // follow the hero as they move (lunge, walking) instead of staying where the swing began
    let ox = fx.slx[k], oyw = fx.sly[k];
    const slot = fx.slSlot[k];
    if (slot >= 0 && s.players[slot].active) {
      const pe = s.players[slot].ent;
      ox = lerp(e.px[pe], e.x[pe], alpha);
      oyw = lerp(e.py[pe], e.y[pe], alpha);
    }
    const cx = ox - camX, cy = FIELD_Y0 + oyw - 6 + oy;
    for (let q = 0; q <= steps; q++) {
      const u = q / steps; // 0 = tail, 1 = head
      const rel = head - trail * (1 - u);
      if (rel < -h) continue;
      const ang = fx.sla[k] + rel * dir;
      const rad = fx.slr[k] * (0.78 + 0.22 * u);
      const alpha = Math.min(1, 0.25 + u * 1.2) * fade;
      const col = hex(heavy ? (u > 0.75 ? 0xffffff : 0xffd35a) : (u > 0.8 ? 0xffffff : 0xcfe0f0), alpha);
      b.drawScaled(S.px, cx + Math.cos(ang) * rad - 1, cy + Math.sin(ang) * rad * 0.8 - 1, thick, thick, col);
      if (heavy && (q & 1)) b.drawScaled(S.px, cx + Math.cos(ang) * rad * 0.62, cy + Math.sin(ang) * rad * 0.62 * 0.8, 2, 2, hex(0xff9a3a, alpha * 0.9));
    }
    // leading edge: a bright blade line from the hero out to the arc
    const ha = fx.sla[k] + head * dir;
    const blade = Math.ceil(fx.slr[k] / 2.5);
    for (let q = 2; q <= blade; q++) {
      const rr = (q / blade) * fx.slr[k];
      b.drawScaled(S.px, cx + Math.cos(ha) * rr - 1, cy + Math.sin(ha) * rr * 0.8 - 1, 2, 2, hex(0xffffff, (0.35 + 0.65 * q / blade) * fade));
    }
  }

  // --- particles
  for (let i = 0; i < fx.n; i++) {
    const sx = fx.x[i] - camX;
    if (sx < -4 || sx > VIEW_W + 4) continue;
    const a = Math.min(1, fx.life[i] / 6);
    const c = a < 1 ? (fx.col[i] & 0x00ffffff) | (Math.round(((fx.col[i] >>> 24) & 255) * a) << 24) : fx.col[i];
    const sz = fx.big[i] ? 2 : 1;
    b.drawScaled(S.px, sx, FIELD_Y0 + fx.y[i] - fx.z[i] + oy, sz, sz, c >>> 0);
  }

  drawWeather(b, S, getWorld()!.sky, mood, camX + road, oy, ft);

  drawBoonPops(b, S, fx, camX, oy);
  drawMercy(b, S, s, camX, alpha, oy);
  drawHud(b, S, s, fx, dbg);
  drawLevelUp(b, S, s, dbg.levelKeys);
  drawQuestMarks(b, S, s, camX, oy, alpha);
  drawQuestHud(b, S, s);
  if (s.store) { drawStoreWares(b, S, s, camX, oy, dbg.storeView, dbg.storeHints); drawQuestBoard(b, S, s, camX, oy, dbg.questView, dbg.storeHints); drawStoreHints(b, S, s, camX, oy); }
}

function drawHud(b: Batcher, S: Sprites, s: GameState, fx: Fx, dbg: DebugInfo): void {
  const e = s.ents;
  // progress bar: where the party is on the way to the far end
  const bw = 200, bx = (VIEW_W - bw) / 2;
  b.drawScaled(S.px, bx - 1, 5, bw + 2, 5, hex(0x000000, 0.7));
  b.drawScaled(S.px, bx, 6, bw, 3, hex(0x2a3340));
  for (const p of s.players) {
    if (!p.active) continue;
    const t = Math.min(1, Math.max(0, e.x[p.ent] / s.worldW));
    b.drawScaled(S.px, bx + Math.round(t * (bw - 2)), 4, 2, 7, hex(PLAYER_COLORS[e.sub[p.ent]]));
  }
  drawText(b, S, 'GOAL', bx + bw + 6, 5, hex(0xffd35a));
  if (dbg.routeLabel) drawText(b, S, dbg.routeLabel, bx - 6 - dbg.routeLabel.length * 4, 5, hex(0xcfd8e0));

  // Boss health bar: a wide bar under the progress bar while the boss is on (or about to enter) the screen.
  if (e.boss >= 0 && e.alive[e.boss] && e.x[e.boss] < s.camX + VIEW_W + 140) {
    const bi = e.boss;
    const frac = Math.max(0, e.hp[bi] / e.maxhp[bi]);
    const enraged = (e.flags[bi] & 4) !== 0;
    const w = 280, x = (VIEW_W - w) / 2, y = 21;
    b.drawScaled(S.px, x - 2, y - 2, w + 4, 10, hex(0x000000, 0.8));
    b.drawScaled(S.px, x, y, w, 6, hex(0x2a1414));
    b.drawScaled(S.px, x, y, Math.round(w * frac), 6, hex(enraged ? ((s.tick >> 2) & 1 ? 0xff5a3a : 0xd82a1a) : 0xc8402e));
    b.drawScaled(S.px, x + w / 2, y - 1, 1, 8, hex(0xffffff, 0.45)); // the enrage line
    const title = MOBS[e.sub[bi]].boss!.title, label = enraged ? title + '  ENRAGED' : title;
    drawText(b, S, label, Math.round(VIEW_W / 2 - label.length * 2), 13, hex(enraged ? 0xff7a5a : 0xffe0c0));
  }

  // party strip
  let row = 0;
  for (const p of s.players) {
    if (!p.active) continue;
    const slot = e.sub[p.ent];
    const y = 6 + row * 11;
    drawText(b, S, `P${slot + 1}`, 6, y, hex(PLAYER_COLORS[slot]));
    bar(b, S, 22, y + 1, 40, 3, e.hp[p.ent] / CLASSES[p.classId].hp, 0x4fd05a);
    drawText(b, S, String(p.kills), 68, y, 0xffffffff);
    const cls = CLASSES[p.classId];
    b.drawScaled(S.px, 22, y + 5, Math.round(40 * p.fury / cls.furyMax), 1, hex(p.fury >= cls.novaCost ? 0xffc23a : 0xa07a30));
    row++;
  }

  if (fx.streak >= 5) {
    const sc = fx.streak >= 25 ? 3 : 2;
    const txt = `${fx.streak} KILLS`;
    const pop = fx.streakPop > 0.3 ? 1 : 0;
    const fade = Math.min(1, fx.streakT / 40);
    drawText(b, S, txt, Math.round(VIEW_W / 2 - txt.length * 2 * sc), 16 - pop, hex(fx.streak >= 25 ? 0xffd35a : 0xffffff, fade), sc);
  }

  const popY = fx.goldPop > 0.3 ? -1 : 0;
  b.draw(S.coin[0][0], 6, 8 + row * 11 + 1 + popY);
  drawText(b, S, String(s.gold), 13, 8 + row * 11 + popY, hex(fx.goldPop > 0.3 ? 0xffffff : 0xffd84a));
  if (s.heat > 0) drawText(b, S, `HEAT ${s.heat} ${HEAT_NAMES[s.heat]}`, 13 + String(s.gold).length * 4 + 8, 8 + row * 11 + popY, hex(0xff8a4a));
  drawBoonStrip(b, S, s);

  let mobs = 0;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob) mobs++;
  const st = dbg.stats;
  const good = hex(0xcfd8e0), bad = hex(0xff6a5a), warn = hex(0xffd35a);
  const lines: [string, number][] = [
    [`FPS ${st.fps}`, st.fps < 55 ? bad : good],
    [`DROPS ${st.drops} /10S`, st.drops > 0 ? bad : good],
    [`WORST ${st.worstMs.toFixed(0)}MS`, st.worstMs > st.typicalMs * 1.5 + 1 ? bad : good],
  ];
  if (dbg.simLag) lines.push([`SIM LAG ${st.skippedTicks}`, bad]);
  lines.push([`MOBS ${mobs}`, good], [`KILLS ${s.kills}`, good], [`DRAWS ${dbg.drawCalls}/${dbg.sprites}`, good]);
  lines.forEach(([t, c], i) => drawText(b, S, t, VIEW_W - 6 - t.length * 4, 6 + i * 8, c));

  // Frame-time graph: one bar per frame, newest on the right; red bars are dropped frames.
  const gx = VIEW_W - 6 - st.graphLength, gy = 6 + lines.length * 8 + 3, gh = 18;
  b.drawScaled(S.px, gx - 1, gy - 1, st.graphLength + 2, gh + 2, hex(0x000000, 0.55));
  const base = st.typicalMs * 2; // a bar the full height = twice the normal frame time
  b.drawScaled(S.px, gx, gy + gh / 2, st.graphLength, 1, hex(0x4a5a6a, 0.8)); // the "normal frame" line
  for (let k = 0; k < st.graphLength; k++) {
    const ms = st.graph[(st.graphStart + k) % st.graphLength];
    if (ms === 0) continue;
    const h = Math.max(1, Math.min(gh, Math.round((ms / base) * gh)));
    const dropped = ms > st.typicalMs * 1.5 + 1;
    b.drawScaled(S.px, gx + k, gy + gh - h, 1, h, dropped ? bad : ms > st.typicalMs * 1.2 ? warn : hex(0x6ad07a, 0.9));
  }

  drawText(b, S, `MOVE WASD/ARROWS/L-STICK  AIM R-STICK  J/RT ATTACK  I/X BIG SWING  K/A NOVA  L/B DASH  O/PAD-LB LEVEL UP${s.surrender ? '  U/PAD-B STAND DOWN' : ''}  R RESTART`, 6, VIEW_H - 10, hex(0xffffff, 0.8));

  if (s.phase !== Phase.Playing && !dbg.hideEndBanner) {
    b.drawScaled(S.px, 0, VIEW_H / 2 - 30, VIEW_W, 60, hex(0x000000, 0.6));
    const msg = s.phase === Phase.Won ? 'BATTLE WON' : 'ROUTED';
    drawText(b, S, msg, VIEW_W / 2 - msg.length * 6, VIEW_H / 2 - 14, hex(s.phase === Phase.Won ? 0xffd35a : 0xe05050), 3);
    const prompt = dbg.endPrompt ?? 'PRESS R TO FIGHT AGAIN';
    drawText(b, S, prompt, Math.round(VIEW_W / 2 - prompt.length * 2), VIEW_H / 2 + 14, 0xffffffff);
  }
}

/** Windup tells: a "!" over heavy attackers, an aim line for archers and a charge lane (bosses only: ordinary mobs don't show where they'll go), a blast-radius ring for lit bombers. */
function drawTelegraph(b: Batcher, S: Sprites, e: GameState['ents'], i: number, def: (typeof MOBS)[number], sx: number, top: number, feetY: number, tick: number): void {
  if (e.mode[i] === SP_WIND && def.special) {
    drawSpecialTelegraph(b, S, e, i, def.special, sx, top, feetY, tick);
    return;
  }
  if (def.behavior === Behavior.Bomber) {
    const dots = 20;
    const col = hex(0xff5a30, (tick >> 1) & 1 ? 0.8 : 0.35);
    for (let d = 0; d < dots; d++) {
      const ang = (d / dots) * Math.PI * 2;
      b.drawScaled(S.px, sx + Math.cos(ang) * BLAST_RADIUS, feetY + Math.sin(ang) * BLAST_RADIUS, 1, 1, col);
    }
    return;
  }
  const boss = isBossType(e.sub[i]);
  if (boss && def.behavior === Behavior.Ranged) {
    const col = hex(0xff4a3a, 0.65);
    for (let d = 10; d < 160; d += 6) b.drawScaled(S.px, sx + e.ax[i] * d, feetY - 6 + e.ay[i] * d, 1, 1, col);
  }
  if (def.charge !== undefined && e.mode[i] === 1 && boss) {
    // the charge lane: a dotted red path along the locked direction, with an arrowhead
    // shortened to where the charge would hit the edge of the world
    let len = def.charge.distance;
    const ax = e.ax[i], ay = e.ay[i];
    if (ax > 1e-6) len = Math.min(len, (WORLD_W - e.x[i]) / ax);
    else if (ax < -1e-6) len = Math.min(len, -e.x[i] / ax);
    if (ay > 1e-6) len = Math.min(len, (WORLD_H - e.y[i]) / ay);
    else if (ay < -1e-6) len = Math.min(len, -e.y[i] / ay);
    len = Math.max(0, len);
    const blink = (tick >> 2) & 1 ? 0.85 : 0.5;
    const col = hex(0xff3a2a, blink);
    for (let d = 12; d <= len; d += 7) b.drawScaled(S.px, sx + e.ax[i] * d - 1, feetY - 2 + e.ay[i] * d, 2, 2, col);
    for (let k = -2; k <= 2; k++) b.drawScaled(S.px, sx + e.ax[i] * (len + 4) - e.ay[i] * k * 2, feetY - 2 + e.ay[i] * (len + 4) + e.ax[i] * k * 2, 2, 2, col);
    drawText(b, S, '!!', Math.round(sx - 3), Math.round(top - 8), hex(0xff5a3a), 1);
    return;
  }
  if (def.charge !== undefined && e.mode[i] === 1) {
    drawText(b, S, '!!', Math.round(sx - 3), Math.round(top - 8), hex(0xff5a3a), 1);
    return;
  }
  if (def.windup >= 16) drawText(b, S, '!', Math.round(sx - 1), Math.round(top - 8), hex(0xffe14a), 1);
}

/**
 * The Frozen Pass's ice colors. The ground there is near-white snow by day and pale blue by night, so ice effects are mid-saturated
 * blues that read on both, with white only as small highlights (pale cyan on snow disappears).
 */
const ICE = { deep: 0x2f94f0, mid: 0x4aa8f0, light: 0x7ad0ff, steel: 0x6a7488 } as const;

/** A thrown harpoon at (x, y) flying along the unit vector (dx, dy): a long dark shaft, a barbed steel head, and a streak of frost behind it. */
export function drawHarpoon(b: Batcher, S: Sprites, x: number, y: number, dx: number, dy: number): void {
  for (let t = 2; t <= 8; t++) b.drawScaled(S.px, Math.round(x - dx * t), Math.round(y - dy * t), 1, 1, hex(t < 4 ? 0x8a5a30 : 0x6a4a2a));
  b.drawScaled(S.px, Math.round(x - dx * 11), Math.round(y - dy * 11), 1, 1, hex(ICE.deep, 0.8));
  b.drawScaled(S.px, Math.round(x - dx * 14), Math.round(y - dy * 14), 1, 1, hex(ICE.light, 0.5));
  b.drawScaled(S.px, Math.round(x - dx), Math.round(y - dy), 2, 2, hex(0x9aaac8));
  b.drawScaled(S.px, Math.round(x + dx * 1.5), Math.round(y + dy * 1.5), 1, 1, hex(0xffffff));
  b.drawScaled(S.px, Math.round(x - dx * 2 - dy * 2), Math.round(y - dy * 2 + dx * 2), 1, 1, hex(0x7c8cac)); // the barbs
  b.drawScaled(S.px, Math.round(x - dx * 2 + dy * 2), Math.round(y - dy * 2 - dx * 2), 1, 1, hex(0x7c8cac));
}

/** Rings of dots on the ground: radius r around (cx, cy), squashed to look flat. */
function groundRing(b: Batcher, S: Sprites, cx: number, cy: number, r: number, dots: number, color: number): void {
  for (let d = 0; d < dots; d++) {
    const a = (d / dots) * Math.PI * 2;
    b.drawScaled(S.px, cx + Math.cos(a) * r - 1, cy + Math.sin(a) * r * 0.85 - 1, 2, 2, color);
  }
}

/** The tell of a special move while the mob winds up: a danger ring, a ray's lane, or a magic glow. */
export function drawSpecialTelegraph(b: Batcher, S: Sprites, e: GameState['ents'], i: number, sp: NonNullable<(typeof MOBS)[number]['special']>, sx: number, top: number, feetY: number, tick: number): void {
  const p = 1 - e.wind[i] / sp.windup;
  const blink = (tick >> 2) & 1 ? 0.8 : 0.45;
  const glyph = elemTelegraph(b, S, e, i, sp, sx, feetY, tick, p); // elemental skills and the newer kinds draw their own tell
  if (glyph !== Glyph.Unhandled) {
    const gc = hex(glyphColor(elemId(sp.element)));
    if (glyph === Glyph.Bang) drawText(b, S, '!', Math.round(sx - 1), Math.round(top - 8), gc, 1);
    else if (glyph === Glyph.Bang2) drawText(b, S, '!!', Math.round(sx - 3), Math.round(top - 8), gc, 1);
    return;
  }
  switch (sp.kind) {
    case 'nova': {
      const frost = sp.style === NovaStyle.Frost;
      groundRing(b, S, sx, feetY, sp.radius, 40, hex(frost ? ICE.deep : sp.style === NovaStyle.Scream ? 0xb890ff : 0xff3a2a, blink));
      groundRing(b, S, sx, feetY, sp.radius * (0.2 + 0.8 * p), 28, hex(frost ? ICE.light : 0xffe0b0, 0.5 + 0.4 * p));
      if (frost) {
        // icicles rising along the danger ring as the scream builds
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2 + tick * 0.01, h = 1 + Math.round(p * (2 + (k % 3)));
          const ix = Math.round(sx + Math.cos(a) * sp.radius) - 1, iy = Math.round(feetY + Math.sin(a) * sp.radius * 0.85) - h;
          b.drawScaled(S.px, ix, iy, 1, h, hex(ICE.deep, 0.7 + 0.3 * p));
          b.drawScaled(S.px, ix, iy, 1, 1, hex(0xffffff, 0.9)); // a bright tip
        }
      }
      drawText(b, S, '!!', Math.round(sx - 3), Math.round(top - 8), hex(0xff5a3a), 1);
      break;
    }
    case 'beam': {
      // the locked lane, thin at first and then a solid line just before it fires
      const col = hex(p > 0.75 ? 0xffffff : 0xc070ff, p > 0.75 ? 0.9 : blink);
      for (let d = 10; d < sp.range; d += p > 0.75 ? 2 : 5) b.drawScaled(S.px, sx + e.ax[i] * d, feetY - 8 + e.ay[i] * d, 1, 1, col);
      drawText(b, S, '!!', Math.round(sx - 3), Math.round(top - 8), hex(0xc070ff), 1);
      break;
    }
    case 'trap': {
      // the snare's landing spot, marked on the ground ahead of the hero
      const tx = sx + (e.ax[i] - e.x[i]), ty = feetY + (e.ay[i] - e.y[i]);
      groundRing(b, S, tx, ty, sp.radius + 3 - 3 * p, 12, hex(ICE.steel, blink));
      drawText(b, S, '!', Math.round(sx - 1), Math.round(top - 8), hex(0xffe14a), 1);
      break;
    }
    case 'storm': {
      // the blizzard's mark: a ring on the ground where the hero stands, swirling flakes gathering inside it
      const tx = sx + (e.ax[i] - e.x[i]), ty = feetY + (e.ay[i] - e.y[i]);
      groundRing(b, S, tx, ty, sp.radius, 24, hex(ICE.deep, blink));
      for (let k = 0; k < 8; k++) {
        const a = tick * 0.15 + k * 0.785, rr = sp.radius * (0.2 + 0.7 * ((k * 37 + tick) % 60) / 60);
        b.drawScaled(S.px, Math.round(tx + Math.cos(a) * rr), Math.round(ty + Math.sin(a) * rr * 0.7 - 2), 1, 1, hex(ICE.light, 0.55 + 0.4 * p));
      }
      drawText(b, S, '!', Math.round(sx - 1), Math.round(top - 8), hex(ICE.deep), 1);
      break;
    }
    case 'wail': {
      groundRing(b, S, sx, feetY, sp.radius, 36, hex(0xb890ff, blink));
      groundRing(b, S, sx, feetY, sp.radius * (0.2 + 0.8 * p), 24, hex(0xe0d0ff, 0.4 + 0.4 * p));
      drawText(b, S, '!!', Math.round(sx - 3), Math.round(top - 8), hex(0xb890ff), 1);
      break;
    }
    case 'whiteout': {
      groundRing(b, S, sx, feetY, sp.radius, 36, hex(ICE.mid, blink));
      groundRing(b, S, sx, feetY, sp.radius * (0.2 + 0.8 * p), 24, hex(0x9adcf8, 0.4 + 0.4 * p));
      for (let k = 0; k < 10; k++) {
        const a = -tick * 0.18 + k * 0.628, rr = sp.radius * (0.3 + 0.6 * (k % 3) / 2);
        b.drawScaled(S.px, Math.round(sx + Math.cos(a) * rr), Math.round(feetY + Math.sin(a) * rr * 0.7 - 3), 2, 1, hex(0xffffff, 0.35 + 0.4 * p));
      }
      drawText(b, S, '??', Math.round(sx - 3), Math.round(top - 8), hex(0x9adcf8), 1);
      break;
    }
    case 'cling':
    case 'pounce': // a crouch and a cry: the spring comes fast, so the warning is on the mob, not the ground
      drawText(b, S, '!', Math.round(sx - 1), Math.round(top - 8), hex(0xff5a3a), 1);
      break;
    case 'hex':
    case 'dazzle': {
      // the mark, on the ground where the hero stands: a violet ring for a curse, a hot white-gold one for a flash
      const tx = sx + (e.ax[i] - e.x[i]), ty = feetY + (e.ay[i] - e.y[i]);
      const hexc = sp.kind === 'hex';
      groundRing(b, S, tx, ty, sp.radius, 24, hex(hexc ? 0x9a4ad0 : 0xf0a020, blink));
      groundRing(b, S, tx, ty, sp.radius * (0.2 + 0.8 * p), 16, hex(hexc ? 0xd8a8f8 : 0xffe080, 0.4 + 0.4 * p));
      for (let k = 0; k < 6; k++) {
        const a = (hexc ? -1 : 1) * tick * 0.12 + k * 1.047;
        b.drawScaled(S.px, Math.round(tx + Math.cos(a) * sp.radius * 0.6), Math.round(ty + Math.sin(a) * sp.radius * 0.4 - 2), 1, 2, hex(hexc ? 0xb86ae8 : 0xffd060, 0.5 + 0.4 * p));
      }
      drawText(b, S, '!', Math.round(sx - 1), Math.round(top - 8), hex(hexc ? 0x9a4ad0 : 0xf0a020), 1);
      break;
    }
    case 'lure': {
      // a false light: motes streaming in toward the caster, along the whole range it will pull from
      groundRing(b, S, sx, feetY, sp.radius, 40, hex(0x40e0c0, blink * 0.7));
      for (let k = 0; k < 12; k++) {
        const t = ((tick * 0.02 + k / 12) % 1), a = k * 0.5236 + 0.3, rr = sp.radius * (1 - t);
        b.drawScaled(S.px, Math.round(sx + Math.cos(a) * rr), Math.round(feetY + Math.sin(a) * rr * 0.7 - 3), 1, 1, hex(0x9afff0, 0.35 + 0.5 * p));
      }
      drawText(b, S, '~', Math.round(sx - 1), Math.round(top - 8), hex(0x40e0c0), 1);
      break;
    }
    case 'leap': {
      // the landing spot, marked on the ground where the hero stands
      const tx = sx + (e.ax[i] - e.x[i]), ty = feetY + (e.ay[i] - e.y[i]);
      groundRing(b, S, tx, ty, sp.radius, 26, hex(0xff3a2a, blink));
      groundRing(b, S, tx, ty, sp.radius * (0.2 + 0.8 * p), 18, hex(0xd8e890, 0.4 + 0.3 * p));
      drawText(b, S, '!', Math.round(sx - 1), Math.round(top - 8), hex(0xff5a3a), 1);
      break;
    }
    case 'gust': {
      groundRing(b, S, sx, feetY, sp.radius, 36, hex(0xd8a85a, blink));
      groundRing(b, S, sx, feetY, sp.radius * (0.2 + 0.8 * p), 24, hex(0xf0d890, 0.4 + 0.4 * p));
      for (let k = 0; k < 10; k++) {
        const a = tick * 0.2 + k * 0.628, rr = sp.radius * (0.3 + 0.6 * (k % 3) / 2);
        b.drawScaled(S.px, Math.round(sx + Math.cos(a) * rr), Math.round(feetY + Math.sin(a) * rr * 0.7 - 3), 2, 1, hex(0xe8c880, 0.4 + 0.4 * p));
      }
      drawText(b, S, '>>', Math.round(sx - 3), Math.round(top - 8), hex(0xe8c880), 1);
      break;
    }
    case 'pit': {
      // where the sand will give way: a ring on the ground at the hero's spot, sand already trickling in
      const tx = sx + (e.ax[i] - e.x[i]), ty = feetY + (e.ay[i] - e.y[i]);
      groundRing(b, S, tx, ty, sp.radius, 26, hex(0x6a4a1e, blink));
      for (let k = 0; k < 8; k++) {
        const a = tick * 0.15 + k * 0.785, rr = sp.radius * (0.2 + 0.7 * ((k * 37 + tick) % 60) / 60);
        b.drawScaled(S.px, Math.round(tx + Math.cos(a) * rr), Math.round(ty + Math.sin(a) * rr * 0.7 - 1), 1, 1, hex(0xe0c27a, 0.55 + 0.4 * p));
      }
      drawText(b, S, '!', Math.round(sx - 1), Math.round(top - 8), hex(0x8a6a34), 1);
      break;
    }
    case 'heal':
    case 'rally':
    case 'ward': {
      const col = sp.kind === 'heal' ? 0x7dffa0 : sp.kind === 'ward' ? ICE.mid : 0xffc060;
      groundRing(b, S, sx, feetY, sp.radius * (0.3 + 0.7 * p), 30, hex(col, 0.35 + 0.3 * p));
      break;
    }
    case 'summon': {
      for (let k = 0; k < 6; k++) {
        const a = tick * 0.12 + k * 1.047;
        b.drawScaled(S.px, sx + Math.cos(a) * 9 - 1, feetY - 2 + Math.sin(a) * 4, 2, 2, hex(0x8cff9c, 0.5 + 0.4 * p));
      }
      break;
    }
    case 'lob':
      drawText(b, S, '!', Math.round(sx - 1), Math.round(top - 8), hex(0xffe14a), 1);
      break;
    case 'blink':
      for (let k = 0; k < 4; k++) b.drawScaled(S.px, sx + ((tick * 3 + k * 5) % 11) - 5, feetY - 4 - ((tick + k * 3) % 9), 1, 1, hex(0xb78cff, 0.8));
      break;
  }
}

/** The archer's rain: arrows streak up from where he stood, then fall onto the target spot, each landing where the sim says it hits. */
const rainOff: [number, number] = [0, 0];
function drawRain(b: Batcher, S: Sprites, e: GameState['ents'], i: number, sx: number, sy: number): void {
  const count = e.mode[i], t = e.atk[i], seed = e.vx[i];
  const ox = Math.round(sx + (e.ax[i] - e.x[i])), oy = Math.round(sy + (e.ay[i] - e.y[i]));
  // a faint ring on the ground shows where it will come down
  if (t < RAIN_SPREAD + RAIN_FLIGHT) groundRing(b, S, sx, sy, e.rem[i], 22, hex(0xffd35a, 0.18 + 0.12 * ((t >> 2) & 1)));
  for (let n = 0; n < count; n++) {
    const age = t - rainLaunchTick(n, count);
    if (age < 0 || age >= RAIN_FLIGHT) continue;
    rainOffset(seed, n, e.rem[i], rainOff);
    const lx = sx + rainOff[0], ly = sy + rainOff[1];
    // the arrow's whole arc: forward from the bow to the landing spot, up and over (a parabola in height)
    const at = (u: number, out: number[]): void => {
      out[0] = ox + (lx - ox) * u;
      out[1] = oy - 10 + (ly - (oy - 10)) * u - RAIN_HEIGHT * 4 * u * (1 - u);
    };
    const u = (age + 1) / RAIN_FLIGHT;
    at(u, rainP);
    at(Math.max(0, u - 0.05), rainQ);
    const tx = rainP[0] - rainQ[0], ty = rainP[1] - rainQ[1], tl = Math.sqrt(tx * tx + ty * ty) || 1;
    // a short shaft along the direction of flight, bright at the head
    for (let k = 0; k < 5; k++) {
      b.drawScaled(S.px, Math.round(rainP[0] - (tx / tl) * k), Math.round(rainP[1] - (ty / tl) * k), 1, 1, hex(k === 0 ? 0xffffff : k < 3 ? 0xe8e0c8 : 0xb8a070, 0.95 - k * 0.1));
    }
  }
}
const rainP = [0, 0], rainQ = [0, 0];

/** A ground zone: a rock about to land (a red target ring and a falling stone) or a lingering poison pool. */
export function drawZone(b: Batcher, S: Sprites, e: GameState['ents'], i: number, sx: number, sy: number, tick: number): void {
  const r = e.rem[i];
  if (e.sub[i] === ZoneKind.Rain) { drawRain(b, S, e, i, sx, sy); return; }
  if (drawElemZone(b, S, e, i, sx, sy, tick)) return; // zones made of an element (and pools, totems) have their own looks
  if (e.sub[i] === ZoneKind.Trap) {
    if (e.mode[i] !== 2) {
      // still being set: a faint ring that firms up as it arms
      groundRing(b, S, sx, sy, r, 10, hex(ICE.steel, 0.4 + 0.3 * (((tick >> 2) & 1))));
      return;
    }
    // armed: a steel-toothed ring of jaws lying open in the snow, with a stake and a short chain
    groundRing(b, S, sx, sy, r * 0.85, 12, hex(ICE.steel));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      b.drawScaled(S.px, Math.round(sx + Math.cos(a) * r * 0.55), Math.round(sy + Math.sin(a) * r * 0.45 - 1), 1, 2, hex(0xaab2c4));
    }
    b.drawScaled(S.px, Math.round(sx - 1), Math.round(sy - 1), 2, 2, hex(0x5a4a3a));
    return;
  }
  if (e.sub[i] === ZoneKind.Mud) {
    // churned peat: dark wet blotches, no rim (it hurts nothing; it only drags)
    const fade = e.cool2[i] < 60 ? e.cool2[i] / 60 : 1;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + (i % 5), rr = r * (0.2 + ((k * 37 + i * 11) % 60) / 100);
      b.drawScaled(S.px, Math.round(sx + Math.cos(a) * rr - 3), Math.round(sy + Math.sin(a) * rr * 0.7 - 1), 7, 4, hex(k & 1 ? 0x3a2c16 : 0x2a2010, 0.55 * fade));
    }
    if (((tick >> 3) + i) % 5 === 0) b.drawScaled(S.px, Math.round(sx + ((i * 7) % 9) - 4), Math.round(sy - 1), 1, 1, hex(0x8a7a4a, 0.8 * fade)); // a bubble
    return;
  }
  if (e.sub[i] === ZoneKind.Spore) {
    // a drifting cloud of spores: soft yellow-green puffs that rise and turn
    const fade = e.cool2[i] < 60 ? e.cool2[i] / 60 : 1;
    for (let k = 0; k < 10; k++) {
      const a = tick * 0.03 + k * 0.63 + (i % 7), rr = r * (0.15 + ((k * 29 + i * 13) % 70) / 100);
      b.drawScaled(S.px, Math.round(sx + Math.cos(a) * rr - 2), Math.round(sy + Math.sin(a) * rr * 0.6 - 4 - ((tick + k * 5) % 12) * 0.3), 4, 3, hex(k & 1 ? 0xc8d070 : 0xa0b848, 0.32 * fade));
    }
    groundRing(b, S, sx, sy, r * 0.95, 24, hex(0xb8c860, 0.4 * fade));
    return;
  }
  if (e.sub[i] === ZoneKind.Pit) {
    // a sand pit: a ring that darkens as it opens, then sand spiralling in toward a dark funnel
    const open = e.mode[i] === 1;
    const fade = e.cool2[i] < 40 ? e.cool2[i] / 40 : 1;
    groundRing(b, S, sx, sy, r, 28, hex(0x6a4a1e, (open ? 0.85 : ((tick >> 2) & 1 ? 0.8 : 0.4)) * fade));
    if (!open) return;
    for (let k = 0; k < 4; k++) groundRing(b, S, sx, sy, r * (0.25 + 0.2 * k), 16 + k * 4, hex(k < 2 ? 0x2a1a08 : 0x8a6a34, (0.55 - k * 0.08) * fade));
    for (let k = 0; k < 10; k++) {
      const t = ((tick * 0.9 + k * 11) % 40) / 40, a = tick * 0.12 + k * 0.63 + t * 3, rr = r * (1 - t);
      b.drawScaled(S.px, Math.round(sx + Math.cos(a) * rr), Math.round(sy + Math.sin(a) * rr * 0.7 - 1), 1, 1, hex(0xe0c27a, 0.8 * fade));
    }
    return;
  }
  if (e.sub[i] === ZoneKind.Storm && e.mode[i] === 2) {
    // a bog brewing: rank bubbles rising in a sickly ring, thickening until it settles into a poison pool
    const left = e.wind[i];
    const blink = (tick >> 2) & 1 ? 0.8 : 0.45;
    groundRing(b, S, sx, sy, r, 26, hex(0x6a8a1a, blink));
    for (let k = 0; k < 10; k++) {
      const a = tick * 0.1 + k * 0.63, rr = r * (0.2 + 0.75 * (((k * 29 + tick) % 50) / 50));
      b.drawScaled(S.px, Math.round(sx + Math.cos(a) * rr), Math.round(sy + Math.sin(a) * rr * 0.7 - 3 - (left & 3)), 2, 2, hex(0xb8e060, 0.5 + 0.4 * (1 - left / 50)));
    }
    return;
  }
  if (e.sub[i] === ZoneKind.Storm) {
    // a blizzard gathering: swirling flakes in a pale ring, thickening until it settles into ice
    const left = e.wind[i];
    const blink = (tick >> 2) & 1 ? 0.8 : 0.45;
    groundRing(b, S, sx, sy, r, 26, hex(ICE.deep, blink));
    for (let k = 0; k < 12; k++) {
      const a = tick * 0.2 + k * 0.52, rr = r * (0.2 + 0.75 * (((k * 29 + tick) % 50) / 50));
      b.drawScaled(S.px, Math.round(sx + Math.cos(a) * rr), Math.round(sy + Math.sin(a) * rr * 0.7 - 3 - (left & 3)), 1, 1, hex(ICE.light, 0.6 + 0.4 * (1 - left / 50)));
    }
    return;
  }
  if (e.sub[i] === ZoneKind.Frost) {
    // a pool of black ice: a pale blue sheet, a bright rim, and ice crystals standing in it that glint
    const fade = e.cool2[i] < 60 ? e.cool2[i] / 60 : 1;
    const col = hex(ICE.mid, 0.38 * fade);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + (i % 5);
      const rr = r * (0.35 + ((k * 37 + i * 11) % 60) / 100);
      b.drawScaled(S.px, sx + Math.cos(a) * rr - 4, sy + Math.sin(a) * rr * 0.7 - 2, 9, 5, col);
    }
    groundRing(b, S, sx, sy, r * 0.95, 26, hex(ICE.deep, 0.7 * fade));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + (i % 7), rr = r * (0.2 + ((k * 29 + i * 13) % 55) / 100);
      const cx = Math.round(sx + Math.cos(a) * rr), cy = Math.round(sy + Math.sin(a) * rr * 0.7), h = 2 + ((k + i) % 3);
      b.drawScaled(S.px, cx, cy - h, 1, h, hex(0x5ab4f4, 0.95 * fade));
      b.drawScaled(S.px, cx - 1, cy - 1, 3, 1, hex(0x3a9af0, 0.8 * fade));
      if (((tick >> 3) + k + i) % 6 === 0) b.drawScaled(S.px, cx, cy - h - 1, 1, 1, hex(0xffffff, fade)); // a glint
    }
    return;
  }
  if (e.sub[i] === ZoneKind.Poison) {
    const fade = e.cool2[i] < 60 ? e.cool2[i] / 60 : 1;
    const col = hex(0x7ac040, 0.28 * fade);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + (i % 5);
      const rr = r * (0.35 + ((k * 37 + i * 11) % 60) / 100);
      b.drawScaled(S.px, sx + Math.cos(a) * rr - 4, sy + Math.sin(a) * rr * 0.7 - 2, 9, 5, col);
    }
    groundRing(b, S, sx, sy, r * 0.95, 26, hex(0xb8e060, 0.45 * fade));
    // bubbles rising
    for (let k = 0; k < 3; k++) {
      const t = (tick * 0.5 + k * 13 + i * 7) % 24;
      b.drawScaled(S.px, sx + ((k * 17 + i * 5) % (r | 0)) - r / 2, sy - t * 0.5 - 1, 1, 1, hex(0xd8f890, 0.7 * (1 - t / 24) * fade));
    }
    return;
  }
  // pending rock: the target ring pulses, the stone drops from above and lands as the ring is full
  const left = e.wind[i];
  const blink = (tick >> 2) & 1 ? 0.85 : 0.5;
  groundRing(b, S, sx, sy, r, 22, hex(0xff3a2a, blink));
  groundRing(b, S, sx, sy, r * Math.min(1, 0.3 + left * 0 + 0.7 * (1 - left / 46)), 16, hex(0xffd0a0, 0.5));
  const h = left * 2.2;
  b.drawScaled(S.px, sx - 2, sy - h - 3, 5, 5, hex(0x6e6470));
  b.drawScaled(S.px, sx - 2, sy - h - 3, 2, 2, hex(0xa39a98));
}

const DEG = Math.PI / 180;

const STRIKE_TICKS = 8;

/** Draws a weapon as a line of pixels from a pivot, at angle theta (degrees, 0 = forward, +90 = down). */
function drawWeapon(b: Batcher, S: Sprites, px: number, py: number, face: number, theta: number, len: number, color: number, headColor: number, headSize: number): void {
  const dx = Math.cos(theta * DEG) * face, dy = Math.sin(theta * DEG);
  for (let k = 1; k <= len; k++) b.drawScaled(S.px, px + dx * k, py + dy * k, 1, 1, color);
  if (headSize > 0) b.drawScaled(S.px, px + dx * len - headSize / 2 + (face > 0 ? 0 : 0), py + dy * len - headSize / 2, headSize, headSize, headColor);
}

/**
 * Mob animation: a body lean and a raised weapon during the windup, a lunge and a swing at the strike,
 * a drawn bow for archers, a swelling fuse for bombers, and a shield bash for shield bearers.
 */
function drawMob(b: Batcher, S: Sprites, e: GameState['ents'], i: number, tick: number, sx: number, sy: number, flip: boolean, hurtFlash: number): void {
  const type = e.sub[i];
  const def = MOBS[type];
  const face = flip ? -1 : 1;
  if (def.burrow && e.rem[i] === 0) {
    // tunnelling under the sand: only a moving ripple of dust shows
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + tick * 0.15 + i;
      b.drawScaled(S.px, Math.round(sx + Math.cos(a) * 5), Math.round(sy - 1 + Math.sin(a) * 2), 2, 1, hex(0xc8a868, 0.8));
    }
    b.drawScaled(S.px, Math.round(sx - 3), Math.round(sy - 2), 6, 2, hex(0xa88848, 0.9));
    return;
  }
  const gallop = def.charge !== undefined && e.mode[i] === 2;
  const walk = S.mob[type];
  const wf = walk[gallop ? (tick >> 1) % walk.length : ((tick >> 3) + i) % walk.length];
  const wind = e.wind[i];
  const leaping = e.mode[i] === SP_LEAP;
  const winding = wind > 0 && !leaping;
  // archers raise their bow for the windup
  let f = wf;
  const since = def.atkCooldown - e.atk[i];
  const striking = !winding && def.behavior !== Behavior.Bomber && e.atk[i] > 0 && since >= 0 && since < STRIKE_TICKS;
  const chargeWind = def.charge !== undefined && e.mode[i] === 1;
  const charging = def.charge !== undefined && e.mode[i] === 2;
  const dazed = def.charge !== undefined && e.mode[i] === 0 && e.stun[i] > 20;
  const special = e.mode[i] === SP_WIND && def.special !== undefined;
  const p = winding ? Math.min(1, Math.max(0, 1 - wind / (chargeWind ? def.charge!.windup : special ? def.special!.windup : def.windup))) : 0;
  const q = striking ? since / STRIKE_TICKS : 0;
  const moving = Math.abs(e.x[i] - e.px[i]) + Math.abs(e.y[i] - e.py[i]) > 0.05;
  const cling = e.mode[i] === SP_CLING;
  const rising = def.revive !== undefined && e.rem[i] === 1 && e.stun[i] > 20;
  f = mobPose(S.mobArt, type, { winding, windP: p, striking, strikeQ: q, chargeWind, charging, dazed, cast: special, cling, rising, broken: def.shield && e.shieldHp[i] <= 0, moving, hurt: hurtFlash > 0, tick, salt: i });

  const drop = f.drop ?? 0;
  let ox = 0, oy = 0;
  let flash = hurtFlash;
  if (leaping) {
    oy = -e.z[i]; // in the air, with its landing marked on the ground
    const sp = def.special;
    if (sp && (sp.kind === 'leap' || sp.kind === 'pounce')) groundRing(b, S, sx + (e.ax[i] - e.x[i]), sy + (e.ay[i] - e.y[i]), sp.radius, 22, hex(0xff3a2a, (tick >> 2) & 1 ? 0.8 : 0.45));
  } else if (cling) {
    oy = -9; // riding a hero's back, not at their feet
  } else if (charging) {
    ox = face * 3;
  } else if (dazed) {
    oy = 1;
    ox = (((tick >> 3) & 1) ? 1 : -1) * 0.5;
  } else if (chargeWind) {
    // pawing the ground: rock back and stomp
    ox = -face * p * 3;
    oy = -(((tick >> 1) & 1) ? 1 : 0) * (1 + p);
    if (flash === 0) flash = ((tick >> 2) & 1) ? 0.6 * p : 0.1;
  } else if (winding) {
    ox = -face * p * (def.radius >= 5 ? 3 : 2);
    oy = -p * 1.5;
    if (flash === 0) flash = def.behavior === Behavior.Bomber ? ((tick >> 1) & 1 ? 0.8 : 0.1) : ((tick >> 2) & 1 ? 0.45 : 0.1) * p;
  } else if (striking) {
    const lunge = def.shield ? 5 : def.behavior === Behavior.Ranged ? -2 : 3;
    ox = face * lunge * (1 - q);
  } else if (e.atk[i] > 0 && !moving && def.behavior !== Behavior.Bomber) {
    oy = -(((tick >> 2) + i) & 1); // restless hop while waiting out the cooldown beside the target
  }

  // Bomber: swell and shake as the fuse burns.
  if (def.behavior === Behavior.Bomber && winding) {
    const sc = 1 + 0.4 * p;
    const jx = ((tick & 1) ? 1 : -1) * p * 1.5;
    b.drawScaled(f, sx - (f.w * sc) / 2 + jx, sy - f.h * sc + drop, f.w * sc, f.h * sc, 0xffffffff);
    drawTelegraph(b, S, e, i, def, sx, sy - f.h + drop, sy, tick);
    return;
  }

  const x0 = sx - f.w / 2 + ox, y0 = sy - f.h + oy + drop;
  if (charging) {
    // motion trail: fading ghosts behind the charger
    for (let g = 3; g >= 1; g--) b.draw(f, x0 - e.ax[i] * g * 6, y0 - e.ay[i] * g * 6, flip, hex(0xffffff, 0.34 - g * 0.08), 0.3);
  }
  let tint = 0xffffffff;
  if (e.buff[i] > 0) tint = hex(0xffb090); // rallied: flushed and frenzied
  if (isWarded(e, i)) tint = hex(0xb0e4ff); // wrapped in a shaman's ice
  if (special && def.special!.kind === 'blink') tint = hex(0xffffff, 1 - p * 0.85); // fading out
  if (def.flame) {
    // a fire licking around it: an orange ring on the ground and sparks rising
    groundRing(b, S, sx, sy, def.flame.radius, 30, hex(0xe8601a, 0.38 + 0.12 * (((tick >> 2) + i) & 1)));
    for (let k = 0; k < 3; k++) {
      const t = ((tick * 0.8 + k * 9 + i * 5) % 22) / 22, a = k * 2.1 + i;
      b.drawScaled(S.px, Math.round(sx + Math.cos(a) * def.flame.radius * 0.6), Math.round(sy + Math.sin(a) * def.flame.radius * 0.4 - t * 10), 1, 1, hex(k & 1 ? 0xffd060 : 0xff8a30, 0.9 * (1 - t)));
    }
  }
  if (def.elemAura) drawElemAura(b, S, def.elemAura.element, def.elemAura.radius, sx, sy, tick, i);
  if (def.aura) {
    // the permafrost around it: a faint ring on the ground, and flakes drifting in it
    groundRing(b, S, sx, sy, def.aura.radius, 30, hex(ICE.deep, 0.32));
    const a = tick * 0.05 + i;
    b.drawScaled(S.px, Math.round(sx + Math.cos(a) * def.aura.radius * 0.7), Math.round(sy + Math.sin(a) * def.aura.radius * 0.55 - 3), 1, 1, hex(ICE.light, 0.8));
  }
  if (e.elite[i] > 0) {
    // an elite: half again as tall, standing in a ring (gold for a mini-boss, blood red when a curse called it), with a bar for its health
    const gold = e.elite[i] === 1, ring = gold ? 0xffc02a : e.elite[i] === 3 ? 0xc060ff : 0xe0442e;
    groundRing(b, S, sx, sy, 11 + 1.5 * f.w / 10, 22, hex(ring, 0.55 + 0.25 * (((tick >> 3) + i) & 1)));
    const w = f.w * 1.45, h = f.h * 1.45;
    b.drawScaled(f, sx - w / 2 + ox, sy - h + oy + drop * 1.45, w, h, gold ? hex(0xffe8b0) : hex(0xffb8a8), flip, flash);
    const bw = Math.max(16, Math.round(w)), bx = Math.round(sx - bw / 2), by = Math.round(sy - h + oy + drop * 1.45 - 5);
    b.drawScaled(S.px, bx - 1, by - 1, bw + 2, 4, hex(0x000000, 0.75));
    b.drawScaled(S.px, bx, by, Math.max(0, Math.round(bw * e.hp[i] / e.maxhp[i])), 2, hex(ring));
  } else b.draw(f, x0, y0, flip, tint, flash);
  if (isWarded(e, i) && ((tick + i) & 5) === 0) b.drawScaled(S.px, sx + ((i * 11) % 9) - 4, y0 + ((tick * 3 + i) % Math.max(2, f.h)), 1, 1, hex(0xffffff, 0.9));
  if (e.buff[i] > 0 && ((tick + i) & 7) === 0) b.drawScaled(S.px, sx + ((i * 7) % 5) - 2, y0 - 1, 1, 2, hex(0xff8a40, 0.9));
  if (dazed) {
    // stars circling the head
    for (let k = 0; k < 3; k++) {
      const a = tick * 0.15 + k * 2.094;
      b.drawScaled(S.px, sx + Math.cos(a) * 5 - 1, y0 - 3 + Math.sin(a) * 2, 2, 2, hex(0xffe14a));
    }
  }

  // Animated weapons.
  const pivotX = sx + face * (f.w / 2 - 2) + ox, pivotY = sy - f.h * 0.5 + oy + drop;
  const held = heldOf(type);
  if (held === 'sword' || held === 'club' || held === 'axe' || held === 'spear') {
    // The weapon is baked into the body frames (mobPose picks the windup/strike pose); only the swing trail is drawn here,
    // fanned out from the hand.
    const big = def.radius >= 5;
    const len = Math.round(def.radius * 1.6);
    const hx = sx + face * 3 + ox, hy = sy - (big ? 7 : 3) + oy;
    if (striking && q < 0.75) {
      // swing trail
      const a = hex(0xffffff, 0.8 * (1 - q));
      for (let k = 0; k < 6; k++) {
        const th = -100 + k * 28;
        b.drawScaled(S.px, hx + Math.cos(th * DEG) * face * (len + 2), hy + Math.sin(th * DEG) * (len + 2), 1, 1, a);
      }
    }
  } else if (held === 'bow' || held === 'sling') {
    if (winding) {
      // nocked arrow, drawn back toward the aim line
      const ax = e.ax[i], ay = e.ay[i];
      const tail = 1 + p * 3;
      for (let k = -tail; k <= 5; k++) b.drawScaled(S.px, pivotX + 2 + ax * k, pivotY + ay * k, 1, 1, k > 4 ? hex(0xffffff) : hex(0xd9c9a0));
    }
  } else if (held === 'shield' && striking && q < 0.6) {
    const a = hex(0xffffff, 0.9 * (1 - q));
    for (let k = 0; k < 3; k++) b.drawScaled(S.px, sx + face * (9 + k * 2), sy - f.h * 0.6 + (k - 1) * 3, 2, 1, a);
  }

  if (winding) drawTelegraph(b, S, e, i, def, sx, sy - f.h, sy, tick);
}

/**
 * The boss: its own detailed sheet (art/chars/boss.mjs), authored poses for each move, plus code tells.
 * Modes (see step.ts): 1 charge windup, 2 charging, 3 ground slam, 4 war cry, 5 club smash.
 */
function drawBoss(b: Batcher, S: Sprites, e: GameState['ents'], i: number, tick: number, sx: number, sy: number, flip: boolean, hurtFlash: number): void {
  const type = e.sub[i];
  const def = MOBS[type];
  const bd = def.boss!;
  const face = flip ? -1 : 1;
  const mode = e.mode[i], wind = e.wind[i];
  const enraged = (e.flags[i] & 4) !== 0;
  const chargeWind = mode === 1, charging = mode === 2, slam = mode === 3, roar = mode === 4, smash = mode === 5;
  // one of its own specials (a frost nova, a barrage, a rally...): drawn with that special's telegraph and an authored pose
  const move = mode === BOSS_SPECIAL ? (bd.moves ?? LEGACY_BOSS_MOVES)[e.rem[i]] : undefined;
  const cast = move?.kind === 'special' ? move : undefined;
  const leaping = mode === SP_LEAP;
  const winding = mode !== 0 && wind > 0 && mode !== 2 && !leaping;
  const total = chargeWind ? def.charge!.windup : slam ? bd.slamWindup : roar ? bd.roarWindup : cast ? cast.special.windup : def.windup;
  const p = winding ? 1 - wind / total : 0;
  const since = def.atkCooldown - e.atk[i];
  const striking = mode === 0 && e.atk[i] > 0 && since >= 0 && since < STRIKE_TICKS;
  const q = striking ? since / STRIKE_TICKS : 0;
  const dazed = mode === 0 && e.stun[i] > 40;
  const moving = Math.abs(e.x[i] - e.px[i]) + Math.abs(e.y[i] - e.py[i]) > 0.05;
  const f = mobPose(S.mobArt, type, {
    special: slam ? 'slam' : roar ? 'roar' : smash ? 'smash' : cast ? (cast.pose ?? 'roar') : undefined,
    winding: winding && !chargeWind, windP: p, striking, strikeQ: q, chargeWind, charging, dazed, moving,
    hurt: hurtFlash > 0, tick, salt: i,
  });
  const w = f.w, h = f.h;

  let ox = 0, oy = 0, flash = hurtFlash;
  if (leaping) {
    oy = -e.z[i];
    const lp = (bd.moves ?? []).find((m) => m.kind === 'special' && m.special.kind === 'leap');
    if (lp && lp.kind === 'special' && lp.special.kind === 'leap') groundRing(b, S, sx + (e.ax[i] - e.x[i]), sy + (e.ay[i] - e.y[i]), lp.special.radius, 36, hex(0xff3a2a, (tick >> 2) & 1 ? 0.85 : 0.5));
  } else if (charging) ox = face * 10;
  else if (chargeWind) { ox = -face * p * 10; oy = -(((tick >> 1) & 1) ? 3 : 0); }
  else if (slam) { oy = -p * 6; ox = (((tick >> 1) & 1) ? 1 : -1) * p * 2; } // rears up before the slam
  else if (roar) { ox = (((tick >> 1) & 1) ? 1 : -1) * 2; oy = -p * 4; }
  else if (cast) { ox = (((tick >> 1) & 1) ? 1 : -1) * 2 * p; oy = -p * 4; }
  else if (smash) { ox = -face * p * 8; oy = -p * 6; }
  else if (striking) ox = face * 12 * (1 - q);
  else if (dazed) { oy = 3; ox = (((tick >> 3) & 1) ? 1 : -1); }
  if (flash === 0 && (winding || chargeWind)) flash = ((tick >> 2) & 1) ? 0.4 * p : 0.08;
  const tint = enraged ? hex(bd.frost ? 0xb8d8ff : 0xffb8a8) : 0xffffffff;

  const x0 = Math.round(sx - w / 2 + ox), y0 = Math.round(sy - h + oy);
  b.drawScaled(f, x0, y0, w, h, tint, flip, flash);

  // Enraged: glowing red eyes (the eye sits ~17px in front of the cell centre, 36 rows down).
  if (enraged) {
    if (activeBestiary()) b.drawScaled(S.px, Math.round(sx + ox + face * w * 0.18 - 2), y0 + Math.round(h * 0.26), 4, 2, hex(0xff3020, 0.9));
    else b.drawScaled(S.px, Math.round(sx + ox + face * 17 - 2), y0 + 36, 4, 2, hex(0xff3020, 0.9));
  }

  // Tells.
  if (cast) {
    drawSpecialTelegraph(b, S, e, i, cast.special, sx, y0, sy, tick);
  } else if (chargeWind) {
    drawTelegraph(b, S, e, i, def, sx, y0, sy, tick);
  } else if (slam) {
    // the slam zone: a fixed red ring, with a second ring closing in as the strike nears
    const R = bd.slamRadius;
    const blink = (tick >> 2) & 1 ? 0.8 : 0.45;
    for (let d = 0; d < 56; d++) {
      const a = (d / 56) * Math.PI * 2;
      b.drawScaled(S.px, sx + Math.cos(a) * R - 1, sy + Math.sin(a) * R * 0.85 - 1, 2, 2, hex(bd.frost ? ICE.deep : 0xff3a2a, blink));
    }
    const R2 = R * (1 - p * 0.0) * (0.25 + 0.75 * p);
    for (let d = 0; d < 40; d++) {
      const a = (d / 40) * Math.PI * 2;
      b.drawScaled(S.px, sx + Math.cos(a) * R2 - 1, sy + Math.sin(a) * R2 * 0.85 - 1, 2, 2, hex(bd.frost ? ICE.light : 0xffd0a0, 0.5 + 0.4 * p));
    }
    if (bd.frost) {
      // icicles rising along the ring as the blow nears
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * Math.PI * 2, hgt = 1 + Math.round(p * (3 + (k % 4)));
        const ix = Math.round(sx + Math.cos(a) * R) - 1, iy = Math.round(sy + Math.sin(a) * R * 0.85) - hgt;
        b.drawScaled(S.px, ix, iy, 1, hgt, hex(ICE.deep, 0.7 + 0.3 * p));
        b.drawScaled(S.px, ix, iy, 1, 1, hex(0xffffff, 0.9));
      }
    }
    drawText(b, S, '!!', Math.round(sx - 3), y0 - 18, hex(bd.frost ? ICE.deep : 0xff5a3a), 1);
  } else if (roar) {
    for (let k = 0; k < 3; k++) {
      const rr = ((tick * 1.5 + k * 22) % 66) + 6;
      for (let d = 0; d < 36; d++) {
        const a = (d / 36) * Math.PI * 2;
        b.drawScaled(S.px, sx + Math.cos(a) * rr - 1, sy - h * 0.4 + Math.sin(a) * rr * 0.6, 2, 2, hex(bd.frost ? ICE.light : 0xffe27a, 0.7 * (1 - rr / 72)));
      }
    }
    drawText(b, S, '!!!', Math.round(sx - 5), y0 - 18, hex(0xffe27a), 1);
  } else if (smash && winding) {
    drawText(b, S, '!', Math.round(sx - 1), y0 - 16, hex(0xffe14a), 1);
  }
}
