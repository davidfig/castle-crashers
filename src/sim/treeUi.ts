// The class tree as a hero uses it in the town: the trainer opens it, the stick steps a cursor over the grid (a branch to a column, its
// nodes down the rows, the bridges in the last row), the trade button builds a node (or equips an owned skill), Ability 1 switches the
// cursor's branch on or off, Dodge or Level closes it. While it is open the hero can do nothing else (as with the level-up panel).
import { GRID_COLS, GRID_ROWS, nodeAt, TREES } from '../data/trees';
import { Btn, type InputFrame } from './input';
import type { GameState, PlayerState } from './state';
import { buyNode, toggleBranch, toggleSkill } from './tree';

const idle: InputFrame = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };

/** Opens hero `slot`'s tree, with the buttons held now as the first tick's "last" (so the press that opened it does not also build). */
export function openTree(s: GameState, slot: number, held: number): boolean {
  const p = s.players[slot];
  if (!TREES[p.classId] || s.players.some((q) => q.treeOpen)) return false; // one tree on screen at a time
  p.treeOpen = true;
  p.treePrev = held;
  p.cursor = 0;
  p.stickPrev = p.stickPrevY = 0;
  return true;
}

/** The input the rest of the tick sees for a hero: theirs, or nothing while their tree is open. Run after the level-up panel's. */
export function treeInput(s: GameState, p: PlayerState, slot: number, inp: InputFrame): InputFrame {
  if (!p.treeOpen) return inp;
  const raw = inp.buttons, edge = raw & ~p.treePrev;
  p.treePrev = raw;
  if (!s.road?.town || p.downed || !p.active || !TREES[p.classId]) { p.treeOpen = false; p.lock = true; return inp; }
  const tree = TREES[p.classId];
  // the stick steps the cursor one cell per push
  const dx = inp.moveX > 60 ? 1 : inp.moveX < -60 ? -1 : 0, dy = inp.moveY > 60 ? 1 : inp.moveY < -60 ? -1 : 0;
  let col = p.cursor % GRID_COLS, row = Math.floor(p.cursor / GRID_COLS);
  if (dx !== p.stickPrev) { if (dx !== 0) col = Math.max(0, Math.min(GRID_COLS - 1, col + dx)); p.stickPrev = dx; }
  if (dy !== p.stickPrevY) { if (dy !== 0) row = Math.max(0, Math.min(GRID_ROWS - 1, row + dy)); p.stickPrevY = dy; }
  p.cursor = row * GRID_COLS + col;
  const i = nodeAt(tree, col, row);
  if (edge & Btn.Interact && i >= 0) { if (!toggleSkill(s, slot, i)) buyNode(s, slot, i); }
  if (edge & Btn.Ability1 && col < tree.branches.length) toggleBranch(s, p.classId, col);
  if (edge & (Btn.Dodge | Btn.Level | Btn.Ability2)) { p.treeOpen = false; p.lock = true; } // (the held button stays muted until let go)
  idle.buttons = raw & Btn.Join;
  return idle;
}
