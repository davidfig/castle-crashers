// A class tree's shape (docs/22-class-trees.md): three branches of six nodes, three bridges between them. One grid, so the cursor and the
// drawing share it: column = branch (0..2), row 0..5 = the branch's nodes in order, row 6 = the bridges (column = which pair).

export interface TreeNode {
  id: string;
  name: string;
  /** Branch 0..2, or -1 for a bridge. */
  branch: number;
  /** 0..5 within a branch, 6 for a bridge. */
  row: number;
  /** Column on the grid (a branch's own, or the bridge's slot). */
  col: number;
  /** Renown. */
  cost: number;
  /** Node ids that must be owned first. */
  requires: readonly string[];
  /** What it adds (docs/trees/*.md): the label shown on the node. */
  adds: 'SKILL' | 'BOON' | 'TRACKS' | 'FUSION' | 'KIT' | 'CAPACITY' | 'RULE';
  /** What it does, in short lines for the detail panel (at most 50 characters each). */
  text: readonly string[];
  /** Boon ids (data/upgrades.ts) it adds to the offer pool. */
  grants?: readonly string[];
  /** A skill it adds (data/skills.ts): it replaces the class's skill in that skill's slot while equipped. */
  skill?: number;
  /** An achievement the keystone is meant to need (not yet tracked: shown, not enforced). */
  gate?: string;
  /** A picture for a node that grants no boon or skill of its own (a UI-kit icon name): a stand-in until it has its own. */
  icon?: string;
  /** Built in the game. False = drawn, but cannot be bought yet. */
  ready: boolean;
}

export interface ClassTree {
  classId: number;
  branches: readonly string[];
  /** The ids of boons in the pool before any node is owned. */
  base: readonly string[];
  nodes: readonly TreeNode[];
}

/** What a run and the profile keep of a tree: which nodes are owned (a flag per node, in `nodes` order), the (up to two) active branches, and the loadout: the skill id in each of the four slots (0 = the class's own). */
export interface TreeSave {
  owned: number[];
  focus: number[];
  loadout: number[];
}
