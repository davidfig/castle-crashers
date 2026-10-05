// Draws the party's barks (src/data/story/barks.ts): a short line above whoever speaks. Purely cosmetic.
// Triggers are read off the sim state each frame; nothing here feeds back.
import { CLASSES } from '../data/classes';
import { lerp } from '../engine/math';
import { createRng, rngInt, Stream } from '../engine/rng';
import { BARK_TRIGGERS, COIN_MARKS, pickBark, STREAK_MARKS, SURRENDER_MARKS, type BarkTrigger } from '../data/story/barks';
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { VIEW_W } from '../sim/constants';
import { MAX_PLAYERS } from '../sim/constants';
import { Phase, type GameState } from '../sim/state';
import type { Sprites } from './art';
import { FIELD_Y0 } from './background';
import { storyWidth } from '../data/storyFont';
import { drawStory, drawPanel } from './ui';

/** How long a line stays up, and the quiet gap before the next, in sim ticks. */
const SHOW_TICKS = 210;
const GAP_TICKS = 50;
const START_TICK = 100;
const QUEUE_MAX = 2;
/** Ambient chatter comes every 25-40 seconds of play. */
const IDLE_MIN = 1500;
const IDLE_SPAN = 900;
/** A heavy exchange: this many kills inside the window makes someone react. */
const CLEAR_WINDOW = 180;
const CLEAR_KILLS = 45;
const CLEAR_COOLDOWN = 1500;
const HURT_FRACTION = 0.3;
const HURT_COOLDOWN = 1800;
/** How many recent lines are remembered (across runs too) so a moment does not repeat itself. */
const RECENT = 40;

interface Line { slot: number; text: string; downedOk: boolean }

export class Barks {
  private startDone = false;
  private bossDone = false;
  private campDone = false;
  private endDone = false;
  private streakMark = 0;
  private coinMark = 0;
  private surrenderMark = 0;
  private betrayedSeen = 0;
  private betrayCool = 0;
  private idleCount = 0;
  private idleAt = 0;
  private windowAt = 0;
  private windowKills = 0;
  private clearCool = 0;
  private hurtCool: number[] = new Array(MAX_PLAYERS).fill(0);
  private wasDown: boolean[] = new Array(MAX_PLAYERS).fill(false);
  private queue: Line[] = [];
  private cur: Line | undefined;
  private shownAt = 0;
  private nextAt = 0;
  /** Survives reset(): the next run avoids what the last one said. */
  private recent: string[] = [];

  constructor() { this.reset(); }

  reset(): void {
    this.startDone = this.bossDone = this.campDone = this.endDone = false;
    this.streakMark = this.coinMark = this.surrenderMark = this.betrayedSeen = this.betrayCool = this.idleCount = 0;
    this.idleAt = START_TICK + IDLE_MIN;
    this.windowAt = this.windowKills = this.clearCool = 0;
    this.hurtCool.fill(0);
    this.wasDown.fill(false);
    this.queue = [];
    this.cur = undefined;
    this.shownAt = this.nextAt = 0;
  }

  /** Reads the sim for new triggers and advances the line on screen. `chapter` is the campaign chapter (1 for off-ledger runs). */
  update(s: GameState, chapter: number): void {
    const t = s.tick;
    if (!this.startDone && t >= START_TICK) { this.startDone = true; this.say(s, 'start', chapter, 0); }
    if (this.streakMark < STREAK_MARKS.length && s.kills >= STREAK_MARKS[this.streakMark]) { this.say(s, 'streak', chapter, this.streakMark + 1); this.streakMark++; }
    if (this.coinMark < COIN_MARKS.length && s.gold >= COIN_MARKS[this.coinMark]) { this.say(s, 'coin', chapter, this.coinMark + 1); this.coinMark++; }
    if (this.surrenderMark < SURRENDER_MARKS.length && s.surrenders >= SURRENDER_MARKS[this.surrenderMark]) { this.say(s, 'surrender', chapter, this.surrenderMark); this.surrenderMark++; }
    if (s.betrayed > this.betrayedSeen) {
      this.betrayedSeen = s.betrayed;
      if (t >= this.betrayCool) { this.say(s, 'betray', chapter, s.betrayed); this.betrayCool = t + 420; }
    }
    if (!this.bossDone && s.ents.boss >= 0) { this.bossDone = true; this.say(s, 'boss', chapter, 0); }
    if (!this.campDone && s.beatPlayedTick >= 0) { this.campDone = true; this.say(s, 'camp', chapter, 0); }

    // a heavy exchange: lots of kills in a short window
    if (t - this.windowAt >= CLEAR_WINDOW) {
      if (s.kills - this.windowKills >= CLEAR_KILLS && t >= this.clearCool) { this.say(s, 'clear', chapter, t >> 6); this.clearCool = t + CLEAR_COOLDOWN; }
      this.windowAt = t;
      this.windowKills = s.kills;
    }
    for (let k = 0; k < s.players.length; k++) {
      const p = s.players[k];
      if (!p.active) continue;
      if (p.downed && !this.wasDown[k]) this.say(s, 'down', chapter, t >> 6, undefined, k);
      this.wasDown[k] = p.downed;
      if (!p.downed && t >= this.hurtCool[k] && s.ents.hp[p.ent] < CLASSES[p.classId].hp * HURT_FRACTION) {
        this.hurtCool[k] = t + HURT_COOLDOWN;
        this.say(s, 'hurt', chapter, (t >> 6) + k, k);
      }
    }
    // ambient chatter, only when the road is quiet
    if (t >= this.idleAt && !this.cur && this.queue.length === 0 && s.phase === Phase.Playing) {
      this.say(s, 'idle', chapter, this.idleCount);
      this.idleCount++;
      this.idleAt = t + IDLE_MIN + rngInt(createRng((s.seed + this.idleCount) >>> 0, Stream.story), IDLE_SPAN);
    }
    // the end of the run is the loudest moment: it cuts in
    if (!this.endDone && s.phase !== Phase.Playing) {
      this.endDone = true;
      this.queue = [];
      this.cur = undefined;
      this.say(s, s.phase === Phase.Won ? 'win' : 'lost', chapter, 0, undefined, undefined, true);
    }

    if (this.cur && t - this.shownAt >= SHOW_TICKS) { this.cur = undefined; this.nextAt = t + GAP_TICKS; }
    if (!this.cur && this.queue.length > 0 && t >= this.nextAt) { this.cur = this.queue.shift(); this.shownAt = t; }
  }

  /**
   * Someone says the line for `trigger` in their own voice: `prefer` if given (the hero who is hurt), never `exclude`
   * (the hero who is down), else the first of a shuffled order who has a line. `downedOk` lets a fallen hero speak (a rout).
   */
  private say(s: GameState, trigger: BarkTrigger, chapter: number, salt: number, prefer?: number, exclude?: number, downedOk = false): void {
    const active: number[] = [];
    for (let k = 0; k < s.players.length; k++) {
      const p = s.players[k];
      if (p.active && k !== exclude && (downedOk || !p.downed)) active.push(k);
    }
    if (active.length === 0) return;
    const r = createRng((s.seed + salt * 977 + BARK_TRIGGERS.indexOf(trigger) * 31) >>> 0, Stream.story);
    const first = prefer !== undefined && active.includes(prefer) ? active.indexOf(prefer) : rngInt(r, active.length);
    const avoid = new Set(this.recent);
    for (let j = 0; j < active.length; j++) {
      const slot = active[(first + j) % active.length];
      const text = pickBark(s.seed, trigger, CLASSES[s.players[slot].classId].name, chapter, salt, avoid);
      if (text === undefined) continue;
      if (downedOk || this.queue.length < QUEUE_MAX) {
        this.queue.push({ slot, text, downedOk });
        this.recent.push(text);
        if (this.recent.length > RECENT) this.recent.shift();
      }
      return;
    }
  }

  draw(b: Batcher, S: Sprites, s: GameState, camXf: number, alpha: number): void {
    const c = this.cur;
    if (!c) return;
    const p = s.players[c.slot];
    if (!p.active || (p.downed && !c.downedOk)) return;
    const age = s.tick - this.shownAt;
    const fade = Math.min(1, age / 8, (SHOW_TICKS - age) / 20);
    const e = s.ents;
    const sx = lerp(e.px[p.ent], e.x[p.ent], alpha) - Math.floor(camXf);
    const sy = FIELD_Y0 + lerp(e.py[p.ent], e.y[p.ent], alpha);
    const tw = storyWidth(c.text);
    const w = tw + 10;
    const x = Math.round(Math.max(4, Math.min(VIEW_W - w - 4, sx - w / 2)));
    const y = Math.round(sy - 52 - (1 - fade) * 3);
    // a vellum bubble with a lead edge and a little tail, the text in ink; it fades in and out
    b.drawScaled(S.px, x - 1, y - 1, w + 2, 15, hex(0x1a1030, 0.85 * fade));
    b.drawScaled(S.px, x, y, w, 13, hex(0xf4ead2, fade));
    b.drawScaled(S.px, Math.round(sx) - 2, y + 14, 5, 1, hex(0x1a1030, 0.85 * fade));
    b.drawScaled(S.px, Math.round(sx) - 1, y + 15, 3, 1, hex(0x1a1030, 0.85 * fade));
    drawStory(b, S, c.text, x + 5, y + 2, 0x1a1030);
  }
}
