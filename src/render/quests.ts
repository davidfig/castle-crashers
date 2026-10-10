// Side quests, drawn (docs/15-quests.md): the people in the camp who offer them, the ward and the captive on the field, the marked brute,
// and the tracker that follows the party. Purely presentation: it reads the sim and never feeds back.
import { QUEST_NPCS, missionText, questAsk, questGoalText, rewardText, type QuestArt, type QuestDef } from '../data/quests';
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { lerp } from '../engine/math';
import { CHANNEL } from '../sim/sites';
import { Kind, NpcMode } from '../sim/entities';
import { captiveOf, FailWhy, QuestStatus, wardFrac } from '../sim/quests';
import { VIEW_W } from '../sim/constants';
import type { GameState } from '../sim/state';
import { PLAYER_COLORS, type Sprites } from './art';
import { FIELD_Y0 } from './background';
import { drawText } from './draw';
import { npcFrame } from './npcArt';
import { drawPanel } from './ui';

/** One person in the camp with a quest to give, where they stand (sim coordinates). */
export interface QuestOffer { x: number; y: number; def: QuestDef }
/** What the camp's ground shows of the quests: who is offering, the offer each hero stands beside (-1 for none), and the one the party took. */
export interface QuestView {
  offers: QuestOffer[];
  near: number[];
  taken: number;
  /** A line over an offer just tried ("ACCEPTED"), and the offer it is over. */
  note?: { offer: number; text: string };
}

/** Ticks a swing of the ward's sword lasts (sim/quests.ts `WARD_SWING`, the part that shows). */
const SWING_SHOW = 14;
const WARD_SWING = 46;

/** A story figure standing with its feet at (sx, sy), facing either way. */
function figure(b: Batcher, S: Sprites, art: QuestArt, sx: number, sy: number, flip: boolean, talking: boolean, tick: number, tint = 0xffffffff, flash = 0): void {
  const set = S.npcs[art];
  const a = set.anims[talking ? 'talk' : 'idle'] ?? set.anims.idle;
  const f = npcFrame(a, (tick * 1000) / 60);
  b.draw(f, sx - (flip ? f.w - 1 - set.pivotX : set.pivotX), sy - set.pivotY, flip, tint, flash);
}

function bar(b: Batcher, S: Sprites, x: number, y: number, w: number, frac: number, color: number): void {
  b.drawScaled(S.px, x - 1, y - 1, w + 2, 4, hex(0x000000, 0.75));
  b.drawScaled(S.px, x, y, w, 2, hex(0x2a1414));
  b.drawScaled(S.px, x, y, Math.max(0, Math.round(w * Math.max(0, Math.min(1, frac)))), 2, hex(color));
}

/** Greedy word wrap at `max` characters (the bitmap font is four pixels a glyph). */
export function wrapLines(text: string, max: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && next.length > max) { out.push(cur); cur = word; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

/** A sword in the ward's hand: held up, or sweeping through a swing and doing nothing much. `t` runs 0..1 over the swing, -1 at rest. */
function sword(b: Batcher, S: Sprites, hx: number, hy: number, dir: number, t: number): void {
  const a = t < 0 ? -1.25 : -1.45 + 2.5 * t; // radians from straight up, towards the facing side
  const len = 8;
  for (let k = 1; k <= len; k++) {
    const x = Math.round(hx + Math.sin(a) * k * dir), y = Math.round(hy - Math.cos(a) * k);
    b.drawScaled(S.px, x, y, 1, 1, hex(k > len - 2 ? 0xffffff : 0xcfd8e0));
  }
  b.drawScaled(S.px, Math.round(hx - dir), Math.round(hy), 3, 1, hex(0xc9a24a)); // the guard
}

/** The quest-givers standing in the camp, under the creatures. */
export function drawQuestGivers(b: Batcher, S: Sprites, s: GameState, camX: number, oy: number, view: QuestView | undefined): void {
  if (!view) return;
  view.offers.forEach((o, i) => {
    const sx = Math.round(o.x - camX), sy = Math.round(FIELD_Y0 + o.y + oy);
    if (sx < -40 || sx > VIEW_W + 40) return;
    const npc = QUEST_NPCS[o.def.npc];
    const nearBy = view.near.some((n) => n === i);
    b.drawScaled(S.px, sx - 12, sy - 2, 24, 4, hex(0xffe9a8, nearBy ? 0.22 : view.taken === i ? 0.18 : 0.08));
    b.drawScaled(S.px, sx - 7, sy - 2, 14, 3, hex(0x000000, 0.28));
    figure(b, S, npc.art, sx, sy, false, nearBy || (s.tick >> 7) % 4 === i, s.tick);
  });
}

/** The marks and the panel over the quest-givers, on top of everything: a bobbing "!" over each, and the nearest one's ask in full. */
export function drawQuestBoard(b: Batcher, S: Sprites, s: GameState, camX: number, oy: number, view: QuestView | undefined, hints: readonly string[] | undefined): void {
  if (!view) return;
  const t = s.tick;
  let panel = -1;
  view.offers.forEach((o, i) => {
    const sx = Math.round(o.x - camX), sy = Math.round(FIELD_Y0 + o.y + oy);
    if (sx < -40 || sx > VIEW_W + 40) return;
    const taken = view.taken === i;
    const bob = Math.round(Math.sin(t / 12 + i * 2) * 1.5);
    const near = view.near.some((n) => n === i);
    if (near && panel < 0) panel = i;
    if (!near) {
      const mark = taken ? 'OK' : '!';
      drawText(b, S, mark, Math.round(sx - mark.length * 2), sy - 36 + bob, hex(taken ? 0x7dff9a : 0xffd35a));
      const tag = taken ? 'TAKEN' : missionText(o.def);
      drawText(b, S, tag, Math.round(sx - tag.length * 2), sy - 45 + bob, hex(taken ? 0x7dff9a : 0xcfd8e0));
    }
  });
  if (panel >= 0) {
    const o = view.offers[panel];
    const npc = QUEST_NPCS[o.def.npc];
    const lines = wrapLines(questAsk(o.def), 42);
    const w = 184, h = 36 + lines.length * 8 + 10 + view.near.filter((n) => n === panel).length * 9;
    const cx = Math.round(o.x - camX);
    const x = Math.max(4, Math.min(VIEW_W - w - 4, cx - w / 2)), y = Math.round(FIELD_Y0 + o.y + oy) - 40 - h;
    drawPanel(b, S, x, y, w, h, { fill: 'ink', ornaments: false });
    drawText(b, S, npc.name, x + 8, y + 7, hex(0xffe9a8));
    const mt = missionText(o.def);
    drawText(b, S, mt, x + w - 8 - mt.length * 4, y + 7, hex(0x9ed0ff));
    drawText(b, S, `PAYS ${rewardText(o.def)}`, x + 8, y + 17, hex(0x7dff9a));
    lines.forEach((ln, k) => drawText(b, S, ln, x + 8, y + 28 + k * 8, 0xffffffff));
    let row = 0;
    const base = y + 28 + lines.length * 8 + 4;
    view.near.forEach((n, k) => {
      if (n !== panel) return;
      const text = `${hints?.[k] ?? ''} ${view.taken === panel ? 'CANCEL' : 'ACCEPT'}`;
      drawText(b, S, text, x + 8, base + row * 9, hex(PLAYER_COLORS[k]));
      row++;
    });
  }
  if (view.note) {
    const o = view.offers[view.note.offer];
    if (o) drawText(b, S, view.note.text, Math.round(o.x - camX - view.note.text.length * 2), Math.round(FIELD_Y0 + o.y + oy) - 56, hex(0xffe9a8));
  }
}

/** A health bar, coloured by how much is left. */
function lifeBar(b: Batcher, S: Sprites, x: number, y: number, w: number, frac: number): void {
  bar(b, S, x, y, w, frac, frac > 0.5 ? 0x4fd05a : frac > 0.25 ? 0xe0a030 : 0xe0442e);
}

/** The ward, a captive or a freed captive: a Kind.Npc entity, drawn among the creatures in depth order. */
export function drawQuestNpc(b: Batcher, S: Sprites, s: GameState, i: number, sx: number, sy: number, flip: boolean, flash: number): void {
  const e = s.ents;
  const npc = QUEST_NPCS[e.sub[i]];
  if (!npc) return;
  const t = s.tick;
  sx = Math.round(sx); sy = Math.round(sy);
  const mode = e.mode[i];
  const moving = Math.abs(e.x[i] - e.px[i]) + Math.abs(e.y[i] - e.py[i]) > 0.05;
  const hop = mode === NpcMode.Ward && moving && (t >> 3) & 1 ? 1 : 0;
  if (mode === NpcMode.Captive || mode === NpcMode.Loose) {
    // once the guards have come they are after the captive: show how much the captive has left, and lift the call above it
    const guarded = captiveOf(s) === i;
    const top = guarded ? sy - 37 : sy - 30;
    if (guarded) lifeBar(b, S, sx - 9, sy - 31, 18, Math.max(0, e.hp[i] / e.maxhp[i]));
    if (mode === NpcMode.Loose) {
      // cut free, cowering until the guards are dead: a shiver, and a plea
      figure(b, S, npc.art, sx + ((t >> 2) & 1), sy, flip, false, t, 0xffffffff, flash);
      if ((t >> 4) & 1) drawText(b, S, 'HELP', sx - 8, top, hex(0xffe9a8));
      return;
    }
    figure(b, S, npc.art, sx, sy, flip, false, t, 0xffffffff, flash);
    // bound: rope across the arms and the knees, and a call for help
    b.drawScaled(S.px, sx - 4, sy - 12, 8, 1, hex(0x8a6a3c));
    b.drawScaled(S.px, sx - 3, sy - 7, 6, 1, hex(0x8a6a3c));
    if (e.buff[i] > 0) bar(b, S, sx - 8, top, 16, e.buff[i] / CHANNEL, 0xffd35a);
    else if ((t >> 4) & 1) drawText(b, S, 'HELP', sx - 8, top, hex(0xffe9a8));
    else drawText(b, S, 'STAND CLOSE', sx - 22, top, hex(0xcfd8e0));
    return;
  }
  figure(b, S, npc.art, sx, sy - hop, flip, false, t, 0xffffffff, flash);
  if (mode !== NpcMode.Ward) return;
  const dir = flip ? -1 : 1;
  const swinging = e.atk[i] > WARD_SWING - SWING_SHOW;
  sword(b, S, sx + 5 * dir, sy - 14 - hop, dir, swinging ? (WARD_SWING - e.atk[i]) / SWING_SHOW : -1);
  // a gold chevron over his head and his health under it: this is the one to keep alive
  lifeBar(b, S, sx - 9, sy - 31, 18, Math.max(0, e.hp[i] / e.maxhp[i]));
  const bob = (t >> 4) & 1;
  b.drawScaled(S.px, sx - 2, sy - 36 + bob, 5, 1, hex(0xffd35a));
  b.drawScaled(S.px, sx - 1, sy - 35 + bob, 3, 1, hex(0xffd35a));
  b.drawScaled(S.px, sx, sy - 34 + bob, 1, 1, hex(0xffd35a));
}

/** The marked brute: a red arrow over its head, so it is plain which one the quest wants. */
export function drawQuestMarks(b: Batcher, S: Sprites, s: GameState, camX: number, oy: number, alpha: number): void {
  const q = s.quest;
  if (!q || q.status !== QuestStatus.Active || q.def.mission !== 'bounty' || q.ent < 0) return;
  const e = s.ents;
  const i = q.ent;
  if (!e.alive[i] || e.kind[i] !== Kind.Mob || e.elite[i] !== 3) return;
  const sx = Math.round(lerp(e.px[i], e.x[i], alpha) - camX), sy = Math.round(FIELD_Y0 + lerp(e.py[i], e.y[i], alpha) + oy);
  if (e.y[i] < 0 || sx < -20 || sx > VIEW_W + 20) return;
  const bob = (s.tick >> 3) & 1;
  const top = sy - 40 - bob;
  b.drawScaled(S.px, sx - 3, top, 7, 1, hex(0xc060ff));
  b.drawScaled(S.px, sx - 2, top + 1, 5, 1, hex(0xc060ff));
  b.drawScaled(S.px, sx - 1, top + 2, 3, 1, hex(0xc060ff));
  b.drawScaled(S.px, sx, top + 3, 1, 1, hex(0xc060ff));
  drawText(b, S, 'MARKED', sx - 12, top - 8, hex(0xe0a8ff));
}

const WHY: Record<number, string> = {
  [FailWhy.Died]: 'THEY FELL', [FailWhy.Fell]: 'A HERO FELL', [FailWhy.Late]: 'TOO SLOW', [FailWhy.Missed]: 'NOT DONE', [FailWhy.Lost]: 'THE PARTY FELL',
};
/** How long the verdict is shown in full, in ticks. */
const VERDICT = 300;

/** The tracker in the corner: the goal and how it stands, then, once settled, the verdict. */
export function drawQuestHud(b: Batcher, S: Sprites, s: GameState): void {
  const q = s.quest;
  if (!q) return;
  const npc = QUEST_NPCS[q.def.npc];
  const right = VIEW_W - 6;
  const put = (text: string, y: number, color: number): void => { drawText(b, S, text, right - text.length * 4, y, color); };
  if (q.status === QuestStatus.Active) {
    put(`QUEST  ${npc.name}`, 6, hex(0xffe9a8));
    put(questGoalText(q.def, q.progress), 15, 0xffffffff);
    const life = q.def.mission === 'escort' || captiveOf(s) >= 0;
    if (life) lifeBar(b, S, right - 60, 25, 60, wardFrac(s));
    else if (q.def.mission === 'swift') {
      const left = Math.max(0, q.def.goal * 60 - s.tick);
      const sec = Math.ceil(left / 60);
      put(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, 24, hex(left < 600 ? 0xff7a5a : 0x9ed0ff));
    }
    put(`PAYS ${rewardText(q.def)}`, life || q.def.mission === 'swift' ? 34 : 24, hex(0x7dff9a));
    return;
  }
  const done = q.status === QuestStatus.Done;
  const age = s.tick - q.endTick;
  if (age < VERDICT) {
    const flash = age < 40 && (age >> 2) & 1;
    put(done ? 'QUEST COMPLETE' : 'QUEST FAILED', 6, hex(done ? (flash ? 0xffffff : 0x7dff9a) : 0xff7a5a));
    put(done ? `PAID ${rewardText(q.def)}` : WHY[q.why] ?? 'NOT DONE', 15, done ? hex(0xffe9a8) : hex(0xcfd8e0));
  } else {
    put(done ? 'QUEST DONE' : 'QUEST FAILED', 6, hex(done ? 0x7dff9a : 0xa05a50));
  }
}

