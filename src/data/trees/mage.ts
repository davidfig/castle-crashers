// The mage's tree (docs/trees/mage.md). Pyromancer burns, Cryomancer holds still, Stormcaller chains. Each branch sells two skills (nodes 3 and 5)
// that replace the fireball (Swing), the megaball (Big Swing), the fire nova (Nova) or the blink (Dodge).
import type { ClassTree, TreeNode } from './types';

/** The track cards of all four slots: they scale whatever skill is in the slot, so they are open from the start. */
const TRACKS = ['bsize', 'bcount', 'bspeed', 'bpower', 'ssize', 'scount', 'sspeed', 'spower', 'nsize', 'ncount', 'nspeed', 'npower', 'dsize', 'dcount', 'dspeed', 'dpower'];

const n = (id: string, name: string, branch: number, row: number, cost: number, requires: string[], adds: TreeNode['adds'], text: string[], rest: Partial<TreeNode> = {}): TreeNode =>
  ({ id, name, branch, row, col: branch, cost, requires, adds, text, ready: true, ...rest });

export const MAGE_TREE: ClassTree = {
  classId: 1,
  branches: ['PYROMANCER', 'CRYOMANCER', 'STORMCALLER'],
  base: ['heavy', 'thick', 'swift', 'windfall', 'wind', 'pound', ...TRACKS],
  nodes: [
    // A - Pyromancer
    n('m-a1', 'TWIN FLAME', 0, 0, 15, [], 'BOON', ['EXTRA FIREBALLS FAN OUT.'], { grants: ['twin'] }),
    n('m-a2', 'ECHO BLAST', 0, 1, 15, [], 'BOON', ['BLASTS GO OFF TWICE.'], { grants: ['echo'] }),
    n('m-a3', 'FLAMETHROWER', 0, 2, 60, ['m-a1'], 'SKILL', ['REPLACES THE FIREBALL. A SHORT CONE OF FIRE, HELD', 'DOWN, DRAINING MANA A TICK. IT HITS EVERY FOE', 'IN THE CONE.'], { skill: 7 }),
    n('m-a4', 'LAST STAND', 0, 3, 30, ['m-a2'], 'FUSION', ['A LOW-HEALTH SHOCKWAVE, AND UNDYING', '(LAST STAND + THICK SKIN).'], { grants: ['last', 'undying'] }),
    n('m-a5', 'METEOR', 0, 4, 60, ['m-a3', 'm-a4'], 'SKILL', ['REPLACES THE MEGABALL. MARKS A SPOT AHEAD; A', 'HUGE BLAST LANDS ON IT A MOMENT LATER.'], { skill: 8 }),
    n('m-a6', 'GLASS FANG', 0, 5, 150, ['m-a5'], 'RULE', ['GLASS FANG JOINS THE POOL: 2X DAMAGE DEALT,', '1.5X TAKEN.'], { grants: ['glass'], gate: 'CLEAR A LEVEL WITHOUT BEING HIT' }),
    // B - Cryomancer
    n('m-b1', 'QUICKSILVER', 1, 0, 15, [], 'BOON', ['A BLINK REFILLS YOUR FURY AND FIRST ABILITY.'], { grants: ['quick'] }),
    n('m-b2', 'FAREWELL', 1, 1, 15, [], 'BOON', ['A DODGE LEAVES A BLAST WHERE YOU WERE.'], { grants: ['gift'] }),
    n('m-b3', 'FROST NOVA', 1, 2, 60, ['m-b1'], 'SKILL', ['REPLACES THE FIRE NOVA. 40 FURY. A RING OF FROST', 'THAT FREEZES EVERY FOE IT REACHES (LONGER AT A', 'FULL BAR).'], { skill: 9 }),
    n('m-b4', 'COLD HEART', 1, 3, 30, ['m-b2'], 'BOON', ['EVERY 10TH KILL HEALS.'], { grants: ['tithe'] }),
    n('m-b5', 'ICE SLIDE', 1, 4, 60, ['m-b3', 'm-b4'], 'SKILL', ['REPLACES THE BLINK. A LONG SLIDE, KEPT UP WHILE', 'DODGE IS HELD; FOES YOU TOUCH ARE FROZEN.'], { skill: 10 }),
    n('m-b6', 'ABSOLUTE ZERO', 1, 5, 150, ['m-b5'], 'RULE', ['EVERY 20S A WHITEOUT FREEZES THE WHOLE SCREEN.'], { gate: 'FREEZE 100 FOES IN A RUN', ready: false, icon: 'boon-gift' }),
    // C - Stormcaller
    n('m-c1', 'CHAIN SPARK', 2, 0, 15, [], 'BOON', ['HITS ARC TO NEARBY FOES.'], { grants: ['spark'] }),
    n('m-c2', 'BLOODLUST', 2, 1, 15, [], 'BOON', ['KILLS GIVE MANA BACK.'], { grants: ['lust'] }),
    n('m-c3', 'CHAIN BOLT', 2, 2, 60, ['m-c1'], 'SKILL', ['REPLACES THE FIREBALL. A BOLT THAT JUMPS THROUGH', 'THREE FOES, A LITTLE WEAKER EACH HOP.'], { skill: 11 }),
    n('m-c4', 'TEMPEST', 2, 3, 30, ['m-c2'], 'FUSION', ['TEMPEST (CHAIN SPARK + SHATTER): SPARKS EXPLODE.'], { grants: ['tempest'] }),
    n('m-c5', 'LIGHTNING STRIKE', 2, 4, 60, ['m-c3', 'm-c4'], 'SKILL', ['REPLACES THE MEGABALL. AN INSTANT BOLT DOWN YOUR', 'AIM LINE: HITS EVERYTHING ON IT AND STUNS IT.'], { skill: 12 }),
    n('m-c6', 'OVERLOAD', 2, 5, 150, ['m-c5'], 'RULE', ['A KILL BY LIGHTNING BURSTS INTO A CHAIN OF ITS OWN.'], { gate: 'ONE CHAIN THAT HITS 10 FOES', ready: false, icon: 'boon-spark' }),
    // bridges
    n('m-ab', 'STEAM', -1, 6, 60, ['m-a3', 'm-b3'], 'BOON', ['A FROZEN FOE HIT BY FIRE BURSTS AND THAWS.'], { ready: false, col: 0, icon: 'boon-echo' }),
    n('m-bc', 'WET WIRE', -1, 6, 60, ['m-b3', 'm-c3'], 'BOON', ['A FROZEN FOE IS HIT HARDER BY LIGHTNING.'], { ready: false, col: 1, icon: 'boon-spark' }),
    n('m-ac', 'FIRE AND FURY', -1, 6, 60, ['m-a3', 'm-c3'], 'FUSION', ['WILDFIRE (FAREWELL + SWIFT FEET): A DODGE LAYS', 'THREE BLASTS.'], { grants: ['gift', 'wildfire'], col: 2 }),
  ],
};
