// Draws the campaign screens (Writ board, hub scenes, run summary) from src/campaign/view.ts data.
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { VIEW_H, VIEW_W } from '../sim/constants';
import { CARD_WIDTH_CHARS, wrap, type Screen, type Tone } from '../campaign/view';
import { drawText } from './draw';
import { BIOMES, makeBlendedMood, moodAt } from '../data/biomes';
import { drawCrest, drawFog, drawGround, drawHaze, drawParallax, drawSky } from './background';
import { PLAYER_COLORS, type Sprites } from './art';
import { LINE_H, storyWidth } from '../data/storyFont';
import { CLASSES } from '../data/classes';
import { drawBackdrop, SCENE_FLOOR } from './sceneArt';
import { npcFrame } from './npcArt';
import { drawCard, drawCursor, drawDivider, drawIcon, drawNpc, drawPanel, drawStory, PAGE_TONE } from './ui';
import { GLASS } from './uiArt';
import { drawTitle } from './titleArt';

const TONE: Record<Tone, number> = { normal: 0xe8ecf4, dim: 0x93a0bc, gold: GLASS.G, red: 0xe88a7a };
const MARGIN = 24;

function rect(b: Batcher, S: Sprites, x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
  b.drawScaled(S.px, x, y, w, h, hex(color, alpha));
}

function backdrop(b: Batcher, S: Sprites): void {
  const bands = [0x120c24, 0x15102b, 0x1a1436, 0x1f1840, 0x251d4a];
  const h = Math.ceil(VIEW_H / bands.length);
  bands.forEach((c, i) => rect(b, S, 0, i * h, VIEW_W, h, c));
}

const thumbMood = makeBlendedMood();
/** The source row of the game's backdrop shown at the top of a thumbnail (the horizon sits at row 112). */
const THUMB_TOP = 74;

/** A picture of a biome as the game draws it at the start of a level (sky, far hills, the field), cropped into a box. */
function biomeThumb(b: Batcher, S: Sprites, biome: number, x: number, y: number, w: number, h: number, tick: number): void {
  const def = BIOMES[biome];
  if (!def) return;
  moodAt(def, 0.1, thumbMood);
  const oy = y - THUMB_TOP;
  b.setClip(x, y, x + w, y + h);
  drawSky(b, S, def, thumbMood, 0, tick, x, oy);
  drawParallax(b, S, def, thumbMood, 0, 0, x, oy, tick);
  drawHaze(b, S, def, thumbMood, oy);
  drawGround(b, S, def, thumbMood, -x, oy, tick);
  drawCrest(b, S, def, thumbMood, -x, oy);
  drawFog(b, S, def, thumbMood, -x, oy, tick, 0.1);
  b.clearClip();
  // a frame, and the biome's name on a dark plate
  rect(b, S, x - 1, y - 1, w + 2, 1, 0x000000, 0.8);
  rect(b, S, x - 1, y + h, w + 2, 1, 0x000000, 0.8);
  rect(b, S, x - 1, y, 1, h, 0x000000, 0.8);
  rect(b, S, x + w, y, 1, h, 0x000000, 0.8);
  const name = def.name.toUpperCase();
  rect(b, S, x, y + h - 11, name.length * 4 + 8, 11, 0x000000, 0.6);
  drawText(b, S, name, x + 4, y + h - 8, hex(0xffe9a8));
}

/** Characters per wrapped line on a Writ notice (a card is about 190 px wide; the story font runs 5-6 px a character). */
const BOARD_WRAP = 29;

/** A crimson wax seal with a gold star: it marks a milestone Writ. */
function drawSeal(b: Batcher, S: Sprites, x: number, y: number): void {
  const widths = [5, 9, 11, 13, 13, 13, 13, 13, 11, 9, 5];
  widths.forEach((w, k) => b.drawScaled(S.px, x + (13 - w) / 2, y + k, w, 1, hex(k < 3 ? GLASS.R : k > 7 ? GLASS.r : GLASS.R)));
  drawIcon(b, S, 'star', x + 2, y + 1, 1);
}

/** `tick` drives the footer blink only. */
export function drawScreen(b: Batcher, S: Sprites, scr: Screen, tick: number): void {
  if (scr.kind === 'title') { drawTitle(b, S, tick); return; }
  backdrop(b, S);
  if (scr.kind !== 'text') drawStory(b, S, scr.header, MARGIN, 14, GLASS.G, 2, GLASS.lead);
  if (scr.kind === 'select') {
    drawStory(b, S, scr.sub, MARGIN, 38, TONE.dim);
    const n = scr.slots.length, gap = 8;
    const cw = Math.floor((VIEW_W - 2 * MARGIN + 8 - gap * (n - 1)) / n);
    scr.slots.forEach((sl, i) => {
      const x = MARGIN - 4 + i * (cw + gap), y = 58, h = 152;
      const cx = x + Math.floor(cw / 2);
      const col = PLAYER_COLORS[i];
      drawPanel(b, S, x, y, cw, h, { fill: 'ink', accent: sl.ready ? 0x4fd05a : sl.joined ? col : GLASS.z });
      drawStory(b, S, `P${i + 1}`, x + 10, y + 9, sl.joined ? col : TONE.dim);
      if (!sl.joined) {
        const t = 'Press attack to join';
        if ((tick >> 5) % 2 === 0) drawStory(b, S, t, cx - Math.floor(storyWidth(t) / 2), y + 58, TONE.dim);
        return;
      }
      const H = S.heroes[sl.classId] ?? S.heroes[0];
      const f = H.anims[i].idle.frames[(tick >> 4) % H.anims[i].idle.frames.length];
      b.drawScaled(S.px, cx - 14, y + 62, 28, 3, hex(0x000000, 0.35)); // a pedestal shadow
      b.draw(f, cx - H.pivotX, y + 62 - H.pivotY, false, 0xffffffff);
      const nm = sl.name[0] + sl.name.slice(1).toLowerCase();
      const nw = storyWidth(nm);
      drawStory(b, S, nm, cx - Math.floor(nw / 2), y + 72, TONE.gold);
      if (!sl.ready) {
        drawStory(b, S, '<', x + 10, y + 72, TONE.normal);
        drawStory(b, S, '>', x + cw - 16, y + 72, TONE.normal);
      }
      sl.blurb.forEach((t, k) => {
        const line = t[0] + t.slice(1).toLowerCase();
        drawStory(b, S, line, cx - Math.floor(storyWidth(line) / 2), y + 86 + k * 10, k === 0 ? TONE.normal : TONE.dim); // the first line is the class's one strength
      });
      drawIcon(b, S, 'heart', cx - 18, y + 133, 1);
      drawStory(b, S, String(sl.hp), cx - 6, y + 132, TONE.normal);
      if (sl.ready) drawStory(b, S, 'Ready', x + cw - 10 - storyWidth('Ready'), y + 9, 0x4fd05a);
    });
    drawStory(b, S, 'Where you are headed', MARGIN, 218, TONE.dim);
    biomeThumb(b, S, scr.biome, MARGIN, 232, VIEW_W - 2 * MARGIN, 96, tick);
  } else if (scr.kind === 'board') {
    drawStory(b, S, scr.sub, MARGIN, 36, TONE.normal);
    drawStory(b, S, scr.mood, MARGIN, 47, TONE.dim);
    const n = scr.cards.length;
    const gap = 12;
    const cw = Math.floor((VIEW_W - 2 * MARGIN + 8 - gap * (n - 1)) / n);
    scr.cards.forEach((c, i) => {
      const on = i === scr.sel;
      const x = MARGIN - 4 + i * (cw + gap), y = on ? 60 : 64, h = 188;
      // each Writ is a notice on vellum; the chosen one is raised and edged in gold
      drawPanel(b, S, x, y, cw, h, { fill: 'vellum', accent: on ? GLASS.G : GLASS.lead });
      biomeThumb(b, S, c.biome, x + 7, y + 7, cw - 14, 52, tick);
      let ty = y + 66;
      if (c.tag) {
        drawSeal(b, S, x + cw - 24, y + 48);
        drawStory(b, S, 'Milestone', x + 10, ty, GLASS.r);
        ty += 12;
      }
      for (const t of wrap(c.title, BOARD_WRAP)) { drawStory(b, S, t, x + 10, ty, PAGE_TONE.normal); ty += 11; }
      ty += 3;
      drawDivider(b, S, x + 10, ty, cw - 20);
      ty += 7;
      for (const line of c.lines) for (const t of wrap(line, BOARD_WRAP)) { drawStory(b, S, t, x + 10, ty, PAGE_TONE.dim); ty += 11; }
      if (on) drawCursor(b, S, x - 8, y + h / 2 - 3);
    });
  } else if (scr.kind === 'picks') {
    drawText(b, S, scr.sub, MARGIN, 42, hex(TONE.dim));
    const lw = Math.floor((VIEW_W - 2 * MARGIN + 8) / 4);
    scr.lanes.forEach((ln, i) => {
      const x = MARGIN - 4 + i * lw, y = 58, w = lw - 6;
      const col = PLAYER_COLORS[i];
      drawPanel(b, S, x, y, w, 230, { fill: 'ink', accent: ln.active ? col : GLASS.z });
      if (!ln.active) return;
      drawStory(b, S, `P${i + 1} ${ln.name[0]}${ln.name.slice(1).toLowerCase()}`, x + 9, y + 9, col);
      drawText(b, S, `LEVEL ${ln.level}`, x + 9, y + 21, hex(TONE.dim));
      if (ln.ready && ln.cards.length > 0) drawStory(b, S, 'Ready', x + w - 38, y + 9, 0x4fd05a);
      if (ln.cards.length === 0) {
        drawStory(b, S, 'No picks waiting', x + 9, y + 44, TONE.dim);
      } else {
        drawStory(b, S, `${ln.pending} pick${ln.pending > 1 ? 's' : ''} waiting`, x + 9, y + 34, TONE.gold);
        ln.cards.forEach((c, k) => {
          const cy = y + 50 + k * 58;
          drawCard(b, S, x + 8, cy, w - 16, 53, 0, k === ln.cursor);
          drawText(b, S, String(k + 1), x + 13, cy + 7, hex(TONE.gold));
          drawIcon(b, S, c.icon, x + w - 34, cy + 6, 2);
          drawStory(b, S, c.name[0] + c.name.slice(1).toLowerCase(), x + 13, cy + 19, 0xffffff);
          c.text.forEach((t, j) => drawText(b, S, t, x + 13, cy + 32 + j * 8, hex(0xa8b4d8)));
          if (c.rank > 0) drawText(b, S, `R${c.rank}`, x + 22, cy + 7, hex(TONE.dim));
        });
      }
    });
  } else if (scr.kind === 'shop') {
    drawStory(b, S, scr.sub, MARGIN, 36, TONE.dim);
    const gt = `GOLD ${scr.gold}`;
    drawIcon(b, S, 'coin', VIEW_W - MARGIN - gt.length * 8 - 14, 16, 1);
    drawText(b, S, gt, VIEW_W - MARGIN - gt.length * 8, 16, hex(TONE.gold), 2);
    const rx = MARGIN + 20, rw = 400, rh = 40;
    scr.rows.forEach((r, i) => {
      const y = 58 + i * (rh + 6);
      const here = scr.seats.filter((s) => s.active && s.cursor === i);
      drawCard(b, S, rx, y, rw, rh, here.length ? 4 : 0, here.length > 0);
      drawIcon(b, S, r.icon, rx + 8, y + 12, 2);
      drawStory(b, S, r.name[0] + r.name.slice(1).toLowerCase(), rx + 34, y + 6, r.sold ? TONE.dim : TONE.normal);
      r.text.forEach((t, j) => drawText(b, S, t, rx + 34, y + 20 + j * 8, hex(0xa8b4d8)));
      const pt = String(r.price);
      drawText(b, S, pt, rx + rw - 12 - pt.length * 8, y + 14, hex(r.sold ? TONE.dim : r.afford ? TONE.gold : TONE.red), 2);
      here.forEach((s, k) => b.drawScaled(S.px, rx - 8 - k * 5, y + 2, 4, rh - 4, hex(PLAYER_COLORS[s.slot])));
      if (r.sold) {
        b.drawScaled(S.px, rx, y, rw, rh, hex(0x000000, 0.55));
        drawStory(b, S, 'Sold', rx + rw / 2 - 18, y + 12, TONE.dim, 2);
      }
    });
    const sx = rx + rw + 24;
    scr.seats.forEach((s) => {
      if (!s.active) return;
      const y = 58 + s.slot * 30;
      drawStory(b, S, `P${s.slot + 1} ${s.name[0]}${s.name.slice(1).toLowerCase()}`, sx, y, PLAYER_COLORS[s.slot]);
      drawStory(b, S, s.ready ? 'Done' : 'Shopping', sx, y + 12, s.ready ? 0x4fd05a : TONE.dim);
    });
    drawNpc(b, S, scr.figure.name, VIEW_W - 76, 306, 4, scr.figure.talking, tick);
    if (scr.note) drawText(b, S, scr.note, MARGIN, VIEW_H - 34, hex(TONE.gold));
  } else if (scr.kind === 'doors') {
    drawText(b, S, scr.sub, MARGIN, 42, hex(TONE.dim));
    const n = scr.doors.length, gap = 16;
    const dw = Math.floor((VIEW_W - 2 * MARGIN + 8 - gap * (n - 1)) / n);
    scr.doors.forEach((d, i) => {
      const x = MARGIN - 4 + i * (dw + gap), y = 62, h = 190;
      const on = i === scr.sel;
      drawPanel(b, S, x, y, dw, h, { fill: 'ink', accent: on ? GLASS.G : GLASS.lead });
      biomeThumb(b, S, d.biome, x + 6, y + 6, dw - 12, 118, tick);
      drawStory(b, S, d.tag, x + 12, y + 132, TONE.gold);
      drawStory(b, S, d.label, x + 12, y + 146, 0xffffff, 2);
      drawIcon(b, S, d.icon, x + 12, y + 170, 1);
      drawStory(b, S, 'Battle', x + 26, y + 170, TONE.dim);
      if (on) drawCursor(b, S, x - 8, y + h / 2 - 3);
    });
  } else if (scr.kind === 'scene') {
    drawScene(b, S, scr, tick);
    return;
  } else {
    drawPage(b, S, scr, tick);
    return;
  }
  if ((tick >> 5) % 2 === 0) drawText(b, S, scr.footer, Math.round(VIEW_W / 2 - scr.footer.length * 2), VIEW_H - 18, hex(TONE.normal));
}

/** A read-it screen: a vellum page, a crimson header over a gold rule, ink text in the story font. */
function drawPage(b: Batcher, S: Sprites, scr: Extract<Screen, { kind: 'text' }>, tick: number): void {
  const x = 26, y = 12, w = VIEW_W - 52, h = VIEW_H - 24;
  drawPanel(b, S, x, y, w, h, { fill: 'vellum' });
  drawStory(b, S, scr.header, x + 22, y + 18, GLASS.r, 2);
  drawDivider(b, S, x + 20, y + 40, w - 40);
  let ty = y + 52;
  for (const l of scr.body) {
    if (l.text) drawStory(b, S, l.text, x + 22, ty, PAGE_TONE[l.tone]);
    ty += LINE_H;
  }
  if (scr.figure) {
    // the speaker stands on the page's right, over a little dais of gold rule
    const fx = x + w - 84, fy = y + h - 44;
    b.drawScaled(S.px, fx - 40, fy + 1, 80, 1, hex(GLASS.g));
    drawNpc(b, S, scr.figure.name, fx, fy, 4, scr.figure.talking, tick);
  }
  if ((tick >> 5) % 2 === 0) drawText(b, S, scr.footer, Math.round(VIEW_W / 2 - scr.footer.length * 2), y + h - 16, hex(GLASS.b));
}

/** A hub scene: the place it happens, the party and the Registrar standing in it, and one beat of the talk in a panel below. */
function drawScene(b: Batcher, S: Sprites, scr: Extract<Screen, { kind: 'scene' }>, tick: number): void {
  drawBackdrop(b, S, scr.backdrop, tick);
  b.drawScaled(S.px, 0, 0, VIEW_W, 26, hex(0x000000, 0.35));
  drawStory(b, S, scr.header, MARGIN, 7, GLASS.G, 2, GLASS.lead);
  // the party, at left; whoever is speaking bobs a little
  scr.party.forEach((name, i) => {
    const id = Math.max(0, CLASSES.findIndex((c) => c.name === name));
    const H = S.heroes[id] ?? S.heroes[0];
    const anim = H.anims[0].idle;
    const f = npcFrame(anim, (tick * 1000) / 60 + i * 400);
    const bob = scr.voices.includes(name as never) && (tick >> 3) % 2 === 0 ? -2 : 0;
    const sc = 3, x = 110 + i * 86, y = SCENE_FLOOR + 6;
    b.drawScaled(S.px, x - 9 * sc, y - sc, 18 * sc, 2 * sc, hex(0x000000, 0.3));
    b.drawScaled(f, x - H.pivotX * sc, y - H.pivotY * sc + bob * sc / 2, f.w * sc, f.h * sc);
  });
  drawNpc(b, S, 'registrar', VIEW_W - 92, SCENE_FLOOR + 6, 4, scr.speaker === 'registrar', tick);
  // the talk
  const px = 20, py = 262, pw = VIEW_W - 40, ph = 92;
  drawPanel(b, S, px, py, pw, ph, { fill: 'ink' });
  let ty = py + 13;
  for (const l of scr.lines) { drawStory(b, S, l.text, px + 16, ty, TONE[l.tone]); ty += LINE_H; }
  for (let i = 0; i < scr.pages; i++) b.drawScaled(S.px, px + 16 + i * 7, py + ph - 14, 4, 4, hex(i === scr.page ? GLASS.G : GLASS.z));
  if ((tick >> 5) % 2 === 0) drawText(b, S, scr.footer, px + pw - 16 - scr.footer.length * 4, py + ph - 15, hex(TONE.normal));
}
