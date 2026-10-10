// Draws the campaign screens (Writ board, hub scenes, run summary) from src/campaign/view.ts data.
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { VIEW_H, VIEW_W } from '../sim/constants';
import { CARD_WIDTH_CHARS, wrap, type Screen, type Tone } from '../campaign/view';
import { drawText } from './draw';
import { moodAt } from '../data/biomes';
import { getWorld } from './sceneryWorld';
import { Scenery } from './scenery';
import { drawCrest, drawFog, drawGround, drawHaze, drawParallax, drawSky } from './background';
import { PLAYER_COLORS, type Sprites } from './art';
import { LINE_H, storyWidth } from '../data/storyFont';
import { CLASSES } from '../data/classes';
import { drawBackdrop, SCENE_FLOOR, STAGE } from './sceneArt';
import { npcFrame } from './npcArt';
import { TIER_BORDER, drawCard, drawCursor, drawDivider, drawIcon, drawNpc, drawPanel, drawShadow, drawStory, PAGE_TONE } from './ui';
import { GLASS } from './uiArt';
import { drawTitle, promptOn } from './titleArt';

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

const thumbScenery = new Scenery();
/** The source row of the game's backdrop shown at the top of a thumbnail (the horizon sits at row 112). */
const THUMB_TOP = 74;

/** A picture of a biome as the game draws it at the start of a level (sky, far hills, the field), cropped into a box. */
function biomeThumb(b: Batcher, S: Sprites, biome: number, x: number, y: number, w: number, h: number, tick: number): void {
  const def = getWorld()?.biomes.find((g) => g.recipe.archetype === biome)?.def; // this run's own take on that kind of place
  if (!def) return;
  thumbScenery.setSolo(def);
  thumbScenery.prog[0] = 0.1;
  moodAt(def, 0.2, thumbScenery.mood[0]); // morning
  const oy = y - THUMB_TOP;
  b.setClip(x, y, x + w, y + h);
  drawSky(b, S, thumbScenery, 0, tick, x, oy);
  drawParallax(b, S, thumbScenery, 0, x, oy, tick);
  drawHaze(b, S, thumbScenery, 0, oy);
  drawGround(b, S, thumbScenery, -x, oy, tick);
  drawCrest(b, S, thumbScenery, -x, oy);
  drawFog(b, S, thumbScenery, -x, oy, tick);
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

/** `tick` drives the footer blink only. `overlay` draws the screen over whatever is already on the canvas (the store's counter over the field) instead of a backdrop. */
export function drawScreen(b: Batcher, S: Sprites, scr: Screen, tick: number, overlay = false): void {
  if (scr.kind === 'title') { drawTitle(b, S, tick); return; }
  if (overlay) rect(b, S, 0, 0, VIEW_W, VIEW_H, 0x080614, 0.82); else backdrop(b, S);
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
        if (promptOn(tick)) drawStory(b, S, t, cx - Math.floor(storyWidth(t) / 2), y + 58, TONE.dim);
        return;
      }
      const H = S.heroes[sl.classId] ?? S.heroes[0];
      const f = H.anims[i].idle.frames[(tick >> 4) % H.anims[i].idle.frames.length];
      drawShadow(b, S, cx, y + 62, 1, 1, col); // the hero's shadow, exactly as in the field
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
    if (scr.biome >= 0) {
      drawStory(b, S, 'Where you are headed', MARGIN, 218, TONE.dim);
      biomeThumb(b, S, scr.biome, MARGIN, 232, VIEW_W - 2 * MARGIN, 96, tick);
    } else {
      // the party select that opens the game: how to join, and how to change the party later
      const lines = ['Up to four can play. A pad or the keys join by pressing attack.', 'Between Writs, press R at the board to change who rides out.'];
      drawPanel(b, S, MARGIN - 4, 226, VIEW_W - 2 * MARGIN + 8, 56, { fill: 'ink' });
      lines.forEach((t, k) => drawStory(b, S, t, MARGIN + 12, 240 + k * 14, k === 0 ? TONE.normal : TONE.dim));
    }
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
          drawCard(b, S, x + 8, cy, w - 16, 53, TIER_BORDER[c.tier], k === ln.cursor);
          drawText(b, S, String(k + 1), x + 13, cy + 7, hex(TONE.gold));
          drawIcon(b, S, c.icon, x + w - 34, cy + 6, 2);
          drawStory(b, S, c.name[0] + c.name.slice(1).toLowerCase(), x + 13, cy + 19, 0xffffff);
          c.text.forEach((t, j) => drawText(b, S, t, x + 13, cy + 32 + j * 8, hex(0xa8b4d8)));
          if (c.rank > 0) drawText(b, S, `R${c.rank}`, x + 22, cy + 7, hex(TONE.dim));
        });
      }
    });
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
  if (promptOn(tick)) drawText(b, S, scr.footer, Math.round(VIEW_W / 2 - scr.footer.length * 2), VIEW_H - 18, hex(TONE.normal));
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
  if (promptOn(tick)) drawText(b, S, scr.footer, Math.round(VIEW_W / 2 - scr.footer.length * 2), y + h - 16, hex(GLASS.b));
}

/** When the party's walk into the current scene began (in screen ticks), which scene it is, and when it was last drawn (a gap means a new visit). */
let walkKey = '', walkStart = 0, walkLast = -1e9;
/** How fast the party walks in, px a tick. */
const WALK_SPEED = 0.7;
/** How far apart the party stands, px: about a hero's width, so they read as a group. */
const PARTY_GAP = 22;

/** A hub scene: the place it happens, the party and the Registrar standing in it, and one beat of the talk in a panel below. */
function drawScene(b: Batcher, S: Sprites, scr: Extract<Screen, { kind: 'scene' }>, tick: number): void {
  drawBackdrop(b, S, scr.backdrop, tick);
  drawStory(b, S, scr.header, MARGIN - 8, 8, GLASS.G, 1, GLASS.lead);
  // the party, where this set puts them, at the game's own size. Where a set says so they walk in from the left when the scene opens (once: the
  // scene's later beats keep them standing), then idle; whoever is speaking bobs a little.
  const stage = STAGE[scr.backdrop], feet = SCENE_FLOOR + 6;
  const sceneKey = `${scr.backdrop}:${scr.header}`;
  if (sceneKey !== walkKey || tick - walkLast > 20) { walkKey = sceneKey; walkStart = tick; }
  walkLast = tick;
  const walkIn = stage.walkIn ?? 0, elapsed = tick - walkStart, arrived = walkIn === 0 || elapsed * WALK_SPEED >= walkIn;
  scr.party.forEach((name, i) => {
    const id = Math.max(0, CLASSES.findIndex((c) => c.name === name));
    const H = S.heroes[id] ?? S.heroes[0];
    const A = H.anims[i % H.anims.length] ?? H.anims[0];
    const f = arrived ? npcFrame(A.idle, (tick * 1000) / 60 + i * 400) : npcFrame(A.walk, (elapsed * 1000) / 60 + i * 130);
    const bob = arrived && scr.voices.includes(name as never) && (tick >> 3) % 2 === 0 ? -1 : 0;
    const x = Math.round(stage.party + i * PARTY_GAP - (arrived ? 0 : walkIn - elapsed * WALK_SPEED));
    drawShadow(b, S, x, feet, 1, 1, PLAYER_COLORS[i % PLAYER_COLORS.length]);
    b.draw(f, x - H.pivotX, feet - H.pivotY + bob);
  });
  if (scr.registrar) drawNpc(b, S, 'registrar', stage.registrar, feet, 1, scr.speaker === 'registrar', tick);
  // the talk
  const px = 20, py = 262, pw = VIEW_W - 40, ph = 92;
  drawPanel(b, S, px, py, pw, ph, { fill: 'ink' });
  let ty = py + 13;
  for (const l of scr.lines) { drawStory(b, S, l.text, px + 16, ty, TONE[l.tone]); ty += LINE_H; }
  for (let i = 0; i < scr.pages; i++) b.drawScaled(S.px, px + 16 + i * 7, py + ph - 14, 4, 4, hex(i === scr.page ? GLASS.G : GLASS.z));
  if (promptOn(tick)) drawText(b, S, scr.footer, px + pw - 16 - scr.footer.length * 4, py + ph - 15, hex(TONE.normal));
}
