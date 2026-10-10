// Stages a road scene (src/data/story/road.ts): a few drawn figures standing in the field, talking. A hero who comes within earshot
// hears the conversation one line at a time; walk away and the figures fall quiet, come back and the line starts over. Nobody has to
// stop: the party that keeps walking simply passes the scene by. Purely cosmetic: it reads the sim and never feeds back.
import { CLASSES } from '../data/classes';
import { storyWidth, LINE_H } from '../data/storyFont';
import { createRng, rngInt, Stream } from '../engine/rng';
import { BYSTANDER, Kind, SURRENDERED } from '../sim/entities';
import { ROAD_REACTIONS, SCENE_BY_ID, scriptFor, type RoadScene, type RoadScript } from '../data/story/road';
import { markHeard, timesHeard } from '../data/story/roadMemory';
import { lerp } from '../engine/math';
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { VIEW_W } from '../sim/constants';
import { Phase, type GameState } from '../sim/state';
import type { Sprites } from './art';
import { FIELD_Y0 } from './background';
import { npcFrame } from './npcArt';
import { drawShadow, drawStory } from './ui';
import { drawProp, PROP_REACH, propsFor, type Prop } from './roadProps';
import { PLAYER_COLORS } from './art';

/** A hero this close (px along the field) to the scene's centre can hear it. */
export const HEAR_RANGE = 170;
const GAP_TICKS = 26;
const FADE_TICKS = 10;
const BUBBLE_MAX_W = 150;
/** A line stays up for a fixed beat plus a little per character, in sim ticks. */
export function lineTicks(text: string): number { return 80 + Math.round(text.length * 3.4); }

/** No hostile creature is alive near `x` (surrendered, bystanding and fleeing ones do not count): a quiet field, where a story can be heard. */
export const CALM_RANGE = 420;
export function fieldCalm(s: GameState, x: number): boolean {
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) {
    if (!e.alive[i] || e.kind[i] !== Kind.Mob) continue;
    if (e.flags[i] & (BYSTANDER | SURRENDERED | 8)) continue;
    if (Math.abs(e.x[i] - x) < CALM_RANGE) return false;
  }
  return true;
}

/** One step of a scene: a line of the script, or a hero's reaction (0 = partway, 1 = at the end). */
export type Beat = { line: number } | { react: 0 | 1 };

export function beatsOf(script: RoadScript): Beat[] {
  const out: Beat[] = [];
  const mid = Math.floor(script.length / 2);
  script.forEach((_, i) => {
    out.push({ line: i });
    if (i === mid - 1) out.push({ react: 0 });
  });
  out.push({ react: 1 });
  return out;
}

/** Something standing in the scene, sorted by depth: a cast member (`k` their index, `npc`) or a piece of set dressing (`prop`, `k` -1). */
export interface Figure { k: number; npc: RoadScene['cast'][number]['npc']; x: number; y: number; rest: 1 | -1; dx: number; prop?: Prop }

/** Greedy word wrap to `max` pixels in the story font. */
export function wrapStory(text: string, max: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && storyWidth(next) > max) { out.push(cur); cur = word; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

export class RoadCast {
  scene: RoadScene | undefined;
  /** The conversation playing this time: the first-time script, or one of the scene's variants. */
  script: RoadScript = [];
  /** Dev aid (?variant=N): 0 the first-time script, k the k-th variant. */
  forced: number | undefined;
  /** This hearing has been counted (so the next meeting plays another conversation). */
  private counted = false;
  /** Figures, sorted by depth (field y) so the renderer can weave them in among the creatures. */
  figures: Figure[] = [];
  x = 0;
  beats: Beat[] = [];
  /** The step being played, and how long it has been up (only counts while someone listens in a calm field). */
  beat = 0;
  age = 0;
  /** Someone is in earshot and the field is quiet: the scene plays. */
  listening = false;
  calm = false;
  done = false;
  /** The hero speaking this step (-1 when a figure speaks), their line, and where they stand. */
  heroSlot = -1;
  heroText = '';
  heroX = 0;
  private lastHero = -1;
  private lastTick = 0;

  /** Finds the scene the level's plan holds (if any). */
  reset(s: GameState): void {
    this.beat = this.age = this.lastTick = 0;
    this.listening = this.calm = this.done = false;
    this.heroSlot = this.lastHero = -1;
    this.scene = undefined;
    this.script = [];
    this.counted = false;
    this.figures = [];
    this.beats = [];
    const c = s.plan.find((p) => p.scene !== undefined);
    const scene = c && SCENE_BY_ID[c.scene!];
    if (!c || !scene) return;
    this.scene = scene;
    this.x = c.x;
    this.script = scriptFor(scene, timesHeard(scene.id), this.forced);
    this.beats = beatsOf(this.script);
    this.figures = scene.cast
      .map((f, k): Figure => ({ k, npc: f.npc, x: c.x + f.dx, y: c.y + f.dy, rest: f.face, dx: f.dx }))
      .concat(propsFor(scene.id, scene.chapter).map((p): Figure => ({ k: -1, npc: scene.cast[0].npc, x: c.x + p.dx, y: c.y + p.dy, rest: 1, dx: p.dx, prop: p })))
      .sort((a, b) => a.y - b.y);
  }

  /** A hero is hearing the scene right now. */
  hearing(): boolean { return this.current() !== undefined; }

  /** What is being said right now: by a figure (`fig` = index into the cast) or a hero (`fig` -1); undefined in the gaps or when nobody listens. */
  current(): { fig: number; text: string; age: number; ticks: number } | undefined {
    const sc = this.scene;
    if (!sc || this.done || !this.listening) return undefined;
    const b = this.beats[this.beat];
    let fig = -1, text: string;
    if ('line' in b) { fig = this.script[b.line].who; text = this.script[b.line].text; } else { if (this.heroSlot < 0) return undefined; text = this.heroText; }
    const ticks = lineTicks(text);
    return this.age < ticks ? { fig, text, age: this.age, ticks } : undefined;
  }

  /** The hero who answers step `react`: someone in earshot and on their feet, the other from last time if there are two. */
  private pickHero(s: GameState, react: 0 | 1): boolean {
    const near: number[] = [];
    for (let k = 0; k < s.players.length; k++) {
      const p = s.players[k];
      if (p.active && !p.downed && Math.abs(s.ents.x[p.ent] - this.x) < HEAR_RANGE) near.push(k);
    }
    if (near.length === 0) return false;
    const pool = near.length > 1 ? near.filter((k) => k !== this.lastHero) : near;
    const r = createRng((s.seed + react * 7919 + this.scene!.chapter * 31) >>> 0, Stream.story);
    const slot = pool[rngInt(r, pool.length)];
    const lines = ROAD_REACTIONS[CLASSES[s.players[slot].classId].name]?.[this.scene!.chapter - 1];
    if (!lines) return false;
    this.heroSlot = slot;
    this.heroText = lines[react];
    this.lastHero = slot;
    return true;
  }

  update(s: GameState): void {
    const sc = this.scene;
    if (!sc) return;
    const dt = Math.max(0, Math.min(8, s.tick - this.lastTick));
    this.lastTick = s.tick;
    let near = false;
    if (s.phase === Phase.Playing) {
      for (const p of s.players) {
        if (p.active && !p.downed && Math.abs(s.ents.x[p.ent] - this.x) < HEAR_RANGE) { near = true; break; }
      }
    }
    this.calm = fieldCalm(s, this.x);
    this.listening = near && this.calm;
    if (this.done) return;
    if (!this.listening) { this.age = 0; this.heroSlot = -1; return; } // walked off, or a fight broke out: the step begins again later
    if (!this.counted) { this.counted = true; if (this.forced === undefined) markHeard(sc.id); }
    // a hero's step needs someone to speak it; with nobody on their feet it is skipped
    const b = this.beats[this.beat];
    if ('react' in b && this.heroSlot < 0 && !this.pickHero(s, b.react)) { this.advance(); return; }
    if ('react' in b && this.heroSlot >= 0) {
      const p = s.players[this.heroSlot];
      if (p.downed || !p.active) { this.heroSlot = -1; this.age = 0; return; }
      this.heroX = s.ents.x[p.ent];
    }
    this.age += dt;
    const text = 'line' in b ? this.script[b.line].text : this.heroText;
    if (this.age >= lineTicks(text) + GAP_TICKS) this.advance();
  }

  private advance(): void {
    this.age = 0;
    this.heroSlot = -1;
    if (++this.beat >= this.beats.length) this.done = true;
  }

  /** Draws figure `n` (an index into `figures`) with its feet at its place in the field. */
  drawFigure(b: Batcher, S: Sprites, n: number, camX: number, oy: number, tick: number): void {
    const sc = this.scene;
    const f = this.figures[n];
    if (!sc) return;
    const sx = Math.round(f.x - camX);
    if (sx < -PROP_REACH - 30 || sx > VIEW_W + PROP_REACH + 30) return;
    const sy = Math.round(FIELD_Y0 + f.y + oy);
    if (f.prop) { drawProp(b, S, f.prop, sx, sy, tick); return; }
    const cur = this.current();
    const talking = cur !== undefined && cur.fig === f.k && cur.age < cur.ticks - 20;
    // listeners turn toward whoever is speaking (a hero too)
    let face = f.rest;
    if (cur) {
      if (cur.fig >= 0) { const them = sc.cast[cur.fig]; if (cur.fig !== f.k && them.dx !== f.dx) face = them.dx > f.dx ? 1 : -1; }
      else if (this.heroX !== f.x) face = this.heroX > f.x ? 1 : -1;
    }
    const set = S.npcs[f.npc];
    const a = set.anims[talking ? 'talk' : 'idle'] ?? set.anims.idle;
    const fr = npcFrame(a, (tick * 1000) / 60 + f.k * 410);
    drawShadow(b, S, sx, sy, 1);
    b.draw(fr, sx - (face > 0 ? set.pivotX : fr.w - set.pivotX), sy - set.pivotY, face < 0);
  }

  /** The speech bubble over whoever is talking, and a small "..." over the scene while it waits to be heard. Drawn above everything. */
  drawBubbles(b: Batcher, S: Sprites, s: GameState, camXf: number, alpha: number): void {
    const sc = this.scene;
    if (!sc || this.figures.length === 0) return;
    const camX = Math.floor(camXf);
    const cur = this.current();
    if (!cur) {
      if (this.done || this.listening || !this.calm) return;
      // an invitation: a pulsing ellipsis over the first figure while the scene is on screen, the field is quiet and it has more to say
      const f = this.figures.find((g) => g.k === 0)!;
      const sx = Math.round(f.x - camX);
      if (sx < 10 || sx > VIEW_W - 10) return;
      const pulse = Math.floor(s.tick / 14) % 4;
      const y = Math.round(FIELD_Y0 + f.y - 50);
      for (let d = 0; d < 3; d++) b.drawScaled(S.px, sx - 6 + d * 5, y - (d === pulse ? 2 : 0), 3, 3, hex(0xf4ead2, 0.9));
      return;
    }
    let sx: number, top: number, edge = 0x1a1030;
    if (cur.fig >= 0) {
      const fig = this.figures.find((g) => g.k === cur.fig)!;
      sx = fig.x - camX;
      top = FIELD_Y0 + fig.y - 44;
    } else {
      const e = s.ents, ent = s.players[this.heroSlot].ent;
      sx = lerp(e.px[ent], e.x[ent], alpha) - camX;
      top = FIELD_Y0 + lerp(e.py[ent], e.y[ent], alpha) - 52;
      edge = PLAYER_COLORS[this.heroSlot]; // a hero's bubble is edged in their colour
    }
    const fade = Math.min(1, cur.age / FADE_TICKS, (cur.ticks - cur.age) / 16);
    const lines = wrapStory(cur.text, BUBBLE_MAX_W);
    const tw = Math.max(...lines.map((l) => storyWidth(l)));
    const w = tw + 12, h = lines.length * LINE_H + 5;
    const x = Math.round(Math.max(4, Math.min(VIEW_W - w - 4, sx - w / 2)));
    const y = Math.round(top - h - (1 - fade) * 3);
    const rim = edge === 0x1a1030 ? hex(edge, 0.85 * fade) : hex(edge, fade);
    b.drawScaled(S.px, x - 1, y - 1, w + 2, h + 2, rim);
    b.drawScaled(S.px, x, y, w, h, hex(0xf4ead2, fade));
    const tx = Math.round(Math.max(x + 3, Math.min(x + w - 6, sx - 2)));
    b.drawScaled(S.px, tx, y + h + 1, 5, 1, rim);
    b.drawScaled(S.px, tx + 1, y + h + 2, 3, 1, rim);
    if (fade < 0.6) return; // text appears only once the bubble is mostly in, so it never flickers over the fade
    lines.forEach((l, i) => drawStory(b, S, l, x + 6, y + 3 + i * LINE_H, 0x1a1030));
  }
}
