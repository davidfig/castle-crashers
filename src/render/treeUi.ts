// The class tree on screen (docs/22-class-trees.md): the trainer's booth in the town, and, over everything, the tree a hero has open: three
// branch columns of six nodes and a row of bridges, the cursor, what the highlighted node does and why it cannot be built yet.
import { trainerSpot } from '../data/town';
import { SKILL_INDEX, SLOTS } from '../data/skills';
import { GRID_COLS, GRID_ROWS, nodeAt, nodeActive, TREES } from '../data/trees';
import { NOUNS, UPGRADE_INDEX, UPGRADES } from '../data/upgrades';
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import type { GameState } from '../sim/state';
import { whyNot } from '../sim/tree';
import { PLAYER_COLORS, type Sprites } from './art';
import { FIELD_Y0 } from './background';
import { drawText } from './draw';
import { TOWN_W } from '../data/town';
import type { StandingList } from './standing';

/** The trainer's booth in the town, standing among the characters by where it touches the ground. */
export function standingTrainer(list: StandingList, b: Batcher, S: Sprites, s: GameState, camX: number, oy: number): void {
  if (!s.road || camX >= TOWN_W + 60) return;
  const sp = trainerSpot();
  list.push(sp.y, () => {
    const x = sp.x - camX, y = FIELD_Y0 + oy + sp.y;
    const px = (rx: number, ry: number, w: number, h: number, c: number, a = 1) => b.drawScaled(S.px, Math.round(rx), Math.round(ry), w, h, hex(c, a));
    px(x - 18, y - 2, 36, 3, 0x000000, 0.25);
    px(x - 16, y - 22, 32, 20, 0x4a4a6a); px(x - 18, y - 26, 36, 5, 0x6a3a8a); px(x - 16, y - 6, 32, 4, 0x34344c);
    drawText(b, S, 'TRAINER', Math.round(x - 14), Math.round(y + 4), hex(0xffe9a8));
    drawText(b, S, 'CLASS TREE', Math.round(x - 20), Math.round(y + 13), hex(0xcfd4dc));
  });
}

const PANEL_X = 40, PANEL_Y = 22, PANEL_W = 560, PANEL_H = 316;
const COL_W = 176, COL_GAP = 8, CELL_H = 28, CELL_GAP = 2, GRID_X = 48, GRID_Y = 104;
/** The highlighted node's description sits above the grid, under the title, where it is easy to find. */
const DETAIL_Y = PANEL_Y + 22, DETAIL_H = 44;

/** The tree of the first hero who has it open, on top of everything. */
export function drawTree(b: Batcher, S: Sprites, s: GameState, hints: readonly string[] | undefined): void {
  const slot = s.players.findIndex((p) => p.treeOpen);
  if (slot < 0 || !s.road) return;
  const p = s.players[slot], tree = TREES[p.classId], save = s.road.trees[p.classId];
  if (!tree) return;
  const rect = (x: number, y: number, w: number, h: number, c: number, a = 1) => b.drawScaled(S.px, Math.round(x), Math.round(y), w, h, hex(c, a));
  const text = (t: string, x: number, y: number, c: number) => drawText(b, S, t, Math.round(x), Math.round(y), hex(c));
  const frame = (x: number, y: number, w: number, h: number, c: number, t = 1) => { rect(x, y, w, t, c); rect(x, y + h - t, w, t, c); rect(x, y, t, h, c); rect(x + w - t, y, t, h, c); };
  const color = PLAYER_COLORS[slot];
  rect(0, 0, 640, 360, 0x000000, 0.55);
  rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 0x14121c, 0.96);
  frame(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, color, 2);
  text(`${(['WARRIOR', 'MAGE', 'CLERIC', 'ROGUE', 'ARCHER', 'SHAMAN'][tree.classId] ?? 'CLASS')} TREE`, PANEL_X + 10, PANEL_Y + 8, 0xffe9a8);
  const rn = `RENOWN ${s.road.renown}`;
  text(rn, PANEL_X + PANEL_W - 10 - rn.length * 4, PANEL_Y + 8, 0xffd35a);
  // the loadout: the skill in each of the four slots (a starting skill is written in its own name)
  const nouns = NOUNS[tree.classId];
  const load = Array.from({ length: SLOTS }, (_, k) => `${nouns[k]}: ${save.loadout[k] ? SKILL_INDEX[save.loadout[k]].short : 'START'}`).join('   ');
  text(load, PANEL_X + 110, PANEL_Y + 8, 0xcfd4dc);

  // branch headers
  for (let c = 0; c < tree.branches.length; c++) {
    const x = GRID_X + c * (COL_W + COL_GAP), on = save.focus.includes(c);
    rect(x, GRID_Y - 14, COL_W, 11, on ? 0x3a5a3a : 0x2a2a30);
    text(tree.branches[c], x + 4, GRID_Y - 12, on ? 0xd8ffd8 : 0x8a8f99);
    const tag = on ? 'ACTIVE' : 'OFF';
    text(tag, x + COL_W - 4 - tag.length * 4, GRID_Y - 12, on ? 0x9aff9a : 0x6a6f79);
  }
  // the grid
  for (let row = 0; row < GRID_ROWS; row++) for (let col = 0; col < GRID_COLS; col++) {
    const i = nodeAt(tree, col, row);
    if (i < 0) continue;
    const n = tree.nodes[i];
    const x = GRID_X + col * (COL_W + COL_GAP), y = GRID_Y + row * (CELL_H + CELL_GAP) + (row === 6 ? 6 : 0);
    const owned = !!save.owned[i], why = owned ? '' : whyNot(s, p.classId, i);
    const active = nodeActive(tree, save, n);
    const slotOf = n.skill ? SKILL_INDEX[n.skill].slot : -1;
    const equipped = !!n.skill && save.loadout[slotOf] === n.skill && owned;
    const buyable = !owned && why === '';
    const fill = owned ? (active ? 0x3a3220 : 0x2a2618) : buyable ? 0x24303c : 0x1c1c24;
    rect(x, y, COL_W, CELL_H, fill);
    frame(x, y, COL_W, CELL_H, equipped ? 0xffe070 : owned ? 0xb89a48 : buyable ? 0x9ab8d8 : 0x3a3a46);
    const dim = !owned && !buyable;
    const pic = n.skill ? SKILL_INDEX[n.skill].icon : n.grants?.[0] ? UPGRADES[UPGRADE_INDEX[n.grants[0]]].icon : n.icon;
    const frame16 = pic ? S.ui.icons[pic] : undefined;
    if (frame16) b.drawScaled(frame16, x + 4, y + 6, frame16.w, frame16.h, hex(0xffffff, owned || buyable ? 1 : 0.4));
    const tx = x + 24;
    text(n.name, tx, y + 5, owned ? 0xffe9a8 : dim ? 0x6a6f79 : 0xe8eef6);
    if (n.skill) { const tag = nouns[slotOf]; text(tag, x + COL_W - 5 - tag.length * 4, y + 5, owned ? 0xffa04a : dim ? 0x6a5a4a : 0xff9a3a); }
    const sub = equipped ? 'EQUIPPED' : owned ? (n.skill ? 'OWNED - TRADE TO EQUIP' : 'OWNED') : why === 'COMING' ? 'COMING' : why.startsWith('NEEDS') && !why.includes('RENOWN') ? why : `${n.adds} - ${n.cost} RENOWN`;
    text(sub.length > 37 ? sub.slice(0, 37) : sub, tx, y + 16, equipped ? 0xffe070 : owned ? 0xb89a48 : dim ? 0x5a5f69 : 0x9ab8d8);
    if (owned && !active) rect(x, y, COL_W, CELL_H, 0x000000, 0.35);
    if (p.cursor === row * GRID_COLS + col) frame(x - 2, y - 2, COL_W + 4, CELL_H + 4, color, 2);
  }
  // the highlighted node
  const col = p.cursor % GRID_COLS, row = Math.floor(p.cursor / GRID_COLS), i = nodeAt(tree, col, row);
  const dy = DETAIL_Y;
  rect(PANEL_X + 8, dy, PANEL_W - 16, DETAIL_H, 0x24222e);
  frame(PANEL_X + 8, dy, PANEL_W - 16, DETAIL_H, 0x4a4660);
  if (i >= 0) {
    const n = tree.nodes[i], owned = !!save.owned[i], why = owned ? '' : whyNot(s, p.classId, i);
    text(`${n.name}  ${n.adds}  ${n.cost} RENOWN`, PANEL_X + 14, dy + 4, 0xffe9a8);
    n.text.slice(0, 3).forEach((t, k) => text(t, PANEL_X + 14, dy + 13 + k * 8, 0xcfd4dc));
    const status = owned ? (n.skill ? (save.loadout[SKILL_INDEX[n.skill].slot] === n.skill ? `EQUIPPED - TRADE TO PUT THE ${nouns[SKILL_INDEX[n.skill].slot]} BACK` : 'OWNED - TRADE TO EQUIP') : 'OWNED') : why === '' ? 'TRADE TO BUILD' : why;
    text(status, PANEL_X + PANEL_W - 14 - status.length * 4, dy + 4, owned || why === '' ? 0x9aff9a : 0xff9a8a);
    if (n.gate) text(`KEYSTONE GATE (NOT YET ENFORCED): ${n.gate}`, PANEL_X + 14, Math.min(dy + 13 + n.text.length * 8, dy + 35), 0x8a8f99);
  } else text('NOTHING HERE', PANEL_X + 14, dy + 4, 0x8a8f99);
  const key = hints?.[slot] ?? '';
  const help = `STICK MOVE   ${key || 'TRADE'} BUILD / EQUIP   ABILITY 1 BRANCH ON/OFF (TWO AT A TIME)   DODGE CLOSE`;
  text(help, PANEL_X + Math.round((PANEL_W - help.length * 4) / 2), PANEL_Y + PANEL_H - 10, 0x8a8f99);
}
