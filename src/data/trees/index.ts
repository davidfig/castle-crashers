// The class trees there are (docs/22-class-trees.md): by class index. A class with no tree here keeps the whole pool open.
import { SKILL_INDEX, SLOTS, TRACK_BOONS } from '../skills';
import { UPGRADE_INDEX, UPGRADES } from '../upgrades';
import { ARCHER_TREE } from './archer';
import { CLERIC_TREE } from './cleric';
import { MAGE_TREE } from './mage';
import { ROGUE_TREE } from './rogue';
import { SHAMAN_TREE } from './shaman';
import type { ClassTree, TreeNode, TreeSave } from './types';
import { WARRIOR_TREE } from './warrior';

export type { ClassTree, TreeNode, TreeSave } from './types';

export const TREES: Readonly<Record<number, ClassTree>> = { 0: WARRIOR_TREE, 1: MAGE_TREE, 2: CLERIC_TREE, 3: ROGUE_TREE, 4: ARCHER_TREE, 5: SHAMAN_TREE };
/** Class names by index, for the saved form (a profile names the class, so reordering classes cannot scramble it). */
const CLASS_KEYS = ['warrior', 'mage', 'cleric', 'rogue', 'archer', 'shaman'];
export const CLASS_COUNT = CLASS_KEYS.length;

export const GRID_COLS = 3, GRID_ROWS = 7;

export function nodeIndex(tree: ClassTree, id: string): number { return tree.nodes.findIndex((n) => n.id === id); }
export function nodeAt(tree: ClassTree, col: number, row: number): number { return tree.nodes.findIndex((n) => n.col === col && n.row === row); }

/** Nothing built, the first two branches active, every slot its own skill, for class `classId`'s tree (a class with none gets an empty one). */
export function newTreeSave(classId = 0): TreeSave { return { owned: (TREES[classId]?.nodes ?? []).map(() => 0), focus: [0, 1], loadout: new Array(SLOTS).fill(0) }; }
/** One save per class, in class order (index = classId). */
export function newTreeSaves(): TreeSave[] { return CLASS_KEYS.map((_, c) => newTreeSave(c)); }
export function cloneTreeSaves(t: readonly TreeSave[]): TreeSave[] { return newTreeSaves().map((fresh, c) => (t[c] ? { owned: [...t[c].owned], focus: [...t[c].focus], loadout: [...t[c].loadout] } : fresh)); }

export interface TreeProfile { owned: string[]; focus: number[]; loadout?: number[]; skill?: number }

/** The saved form of every class's tree (node ids, so adding a node later does not shift what players own), keyed by class name; and back. */
export function treesToProfile(t: readonly TreeSave[]): Record<string, { owned: string[]; focus: number[]; loadout: number[] }> {
  const out: Record<string, { owned: string[]; focus: number[]; loadout: number[] }> = {};
  for (const [c, tree] of Object.entries(TREES)) {
    const s = t[Number(c)];
    if (!s) continue;
    out[CLASS_KEYS[Number(c)]] = { owned: tree.nodes.filter((_, i) => s.owned[i]).map((n) => n.id), focus: [...s.focus], loadout: [...s.loadout] };
  }
  return out;
}
function treeFromProfile(classId: number, p: TreeProfile | undefined): TreeSave {
  const t = newTreeSave(classId);
  if (!p) return t;
  TREES[classId].nodes.forEach((n, i) => { if (p.owned.includes(n.id)) t.owned[i] = 1; });
  t.focus = p.focus.filter((b) => b >= 0 && b < 3).slice(0, 2);
  // (a profile from before the slots kept one skill, always in the nova slot)
  const load = p.loadout ?? [0, 0, p.skill ?? 0, 0];
  for (let slot = 0; slot < SLOTS; slot++) { const k = SKILL_INDEX[load[slot] ?? 0]; if (k && k.slot === slot && k.classId === classId) t.loadout[slot] = k.id; }
  return t;
}
/** `trees` keyed by class name; `legacy` is the single (warrior) tree an older profile kept. */
export function treesFromProfile(trees: Record<string, TreeProfile> | undefined, legacy?: TreeProfile): TreeSave[] {
  return newTreeSaves().map((_, c) => {
    if (!TREES[c]) return newTreeSave(c);
    return treeFromProfile(c, trees?.[CLASS_KEYS[c]] ?? (c === 0 ? legacy : undefined));
  });
}

/** A node feeds the pool when its branch is active; a bridge, when the branches of both nodes it joins are. */
export function nodeActive(tree: ClassTree, save: TreeSave, n: TreeNode): boolean {
  if (n.branch >= 0) return save.focus.includes(n.branch);
  return n.requires.every((r) => save.focus.includes(tree.nodes[nodeIndex(tree, r)].branch));
}

/**
 * The offer pool of a character of `classId` with this tree: a flag per upgrade (index = UPGRADES). The base pool plus the grants of every owned
 * node in an *active* branch (a bridge counts when both its branches are active). An equipped skill leaves out the track cards it does not use
 * and whatever else it drops (Split Earth without the quake). A class with no tree: undefined (everything is open).
 */
export function poolFor(classId: number, save: TreeSave | undefined): Uint8Array | undefined {
  const tree = TREES[classId];
  if (!tree || !save) return undefined;
  const pool = new Uint8Array(UPGRADES.length);
  for (const id of tree.base) pool[UPGRADE_INDEX[id]] = 1;
  tree.nodes.forEach((n, i) => {
    if (!save.owned[i] || !n.grants) return;
    if (!nodeActive(tree, save, n)) return;
    for (const g of n.grants) pool[UPGRADE_INDEX[g]] = 1;
  });
  for (let slot = 0; slot < SLOTS; slot++) {
    const k = save.loadout[slot] ? SKILL_INDEX[save.loadout[slot]] : undefined;
    if (!k || k.classId !== classId) continue;
    k.tracks.forEach((t, track) => { if (!t) pool[UPGRADE_INDEX[TRACK_BOONS[slot][track]]] = 0; });
    for (const id of k.drops ?? []) pool[UPGRADE_INDEX[id]] = 0;
  }
  return pool;
}
