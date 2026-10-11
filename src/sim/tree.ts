// Class trees in the sim (docs/22-class-trees.md; the data is data/trees): building a node with renown, equipping a skill, choosing which
// branches feed the offer pool, and the pool a hero is dealt from. All of it lives in `RoadState.trees` (one per class), so a save holds it.
import { SKILL_INDEX } from '../data/skills';
import { nodeActive, nodeIndex, poolFor, TREES } from '../data/trees';
import { emit, Ev } from './events';
import { TownEv } from './gen/road';
import { applyMeta, type GameState } from './state';

/** Does hero `slot` have node `id` working: owned, and in an active branch (a class tree's rule nodes check this). */
export function nodeOn(s: GameState, slot: number, id: string): boolean {
  const classId = s.players[slot].classId, tree = TREES[classId], r = s.road;
  if (!tree || !r) return false;
  const i = nodeIndex(tree, id), save = r.trees[classId];
  return i >= 0 && !!save.owned[i] && nodeActive(tree, save, tree.nodes[i]);
}

/** Why a node cannot be built now, or '' if it can. */
export function whyNot(s: GameState, classId: number, i: number): string {
  const tree = TREES[classId], r = s.road;
  if (!tree || !r) return 'NO TREE';
  const n = tree.nodes[i], save = r.trees[classId];
  if (save.owned[i]) return 'OWNED';
  if (!n.ready) return 'COMING';
  const need = n.requires.find((id) => !save.owned[nodeIndex(tree, id)]);
  if (need) return `NEEDS ${tree.nodes[nodeIndex(tree, need)].name}`;
  if (r.renown < n.cost) return `NEEDS ${n.cost - r.renown} MORE RENOWN`;
  return '';
}

/** Builds node `i` of hero `slot`'s class tree with renown (shared by the party, like the town's places). A skill is equipped as it is bought. */
export function buyNode(s: GameState, slot: number, i: number): boolean {
  const p = s.players[slot], tree = TREES[p.classId], r = s.road;
  if (!tree || !r || whyNot(s, p.classId, i)) { if (r) emit(s.events, Ev.Town, s.ents.x[p.ent], s.ents.y[p.ent], TownEv.Dear, 0, slot); return false; }
  const n = tree.nodes[i];
  r.renown -= n.cost;
  r.trees[p.classId].owned[i] = 1;
  if (n.skill) equipSkill(s, p.classId, n.skill);
  emit(s.events, Ev.Town, s.ents.x[p.ent], s.ents.y[p.ent], TownEv.Built, 0, slot);
  return true;
}

/** Puts skill `skill` in its slot (0 = the slot's own skill again) for every hero of class `classId`. The party's heroes of that class share it. */
export function equipSkill(s: GameState, classId: number, skill: number, slot = SKILL_INDEX[skill]?.slot ?? 0): void {
  s.road!.trees[classId].loadout[slot] = skill;
  for (let k = 0; k < s.players.length; k++) if (s.players[k].active) applyMeta(s, k);
}

/** Node `i`, if it is an owned skill: equip it (or put the slot's own skill back if it is the one already equipped). */
export function toggleSkill(s: GameState, slot: number, i: number): boolean {
  const p = s.players[slot], tree = TREES[p.classId], r = s.road;
  if (!tree || !r || !r.trees[p.classId].owned[i]) return false;
  const sk = tree.nodes[i].skill;
  if (!sk) return false;
  const at = SKILL_INDEX[sk].slot;
  equipSkill(s, p.classId, r.trees[p.classId].loadout[at] === sk ? 0 : sk, at);
  return true;
}

/** Turns a branch of class `classId`'s tree on or off in the pool; a third branch switched on drops the one that has been on longest. */
export function toggleBranch(s: GameState, classId: number, branch: number): void {
  const f = s.road!.trees[classId].focus;
  const at = f.indexOf(branch);
  if (at >= 0) f.splice(at, 1);
  else { f.push(branch); if (f.length > 2) f.shift(); }
}

/** The offer pool of hero `slot`: undefined = everything (no tree, no road, or a road made without one: the headless sims and bot balance runs keep the open pool). */
export function heroPool(s: GameState, slot: number): Uint8Array | undefined {
  const classId = s.players[slot].classId;
  return s.road?.treeGated ? poolFor(classId, s.road.trees[classId]) : undefined;
}
