// The archer's tree (docs/trees/archer.md). The Marksman wants one perfect arrow, the Trapper controls the ground, the Skirmisher is never where they are.
// Each branch sells two skills (nodes 3 and 5) that replace the arrow (Swing), the volley (Big Swing), the rain (Nova) or the roll (Dodge).
import type { ClassTree, TreeNode } from './types';

/** The track cards of all four slots: they scale whatever skill is in the slot, so they are open from the start. */
const TRACKS = ['bsize', 'bcount', 'bspeed', 'bpower', 'ssize', 'scount', 'sspeed', 'spower', 'nsize', 'ncount', 'nspeed', 'npower', 'dsize', 'dcount', 'dspeed', 'dpower'];

const n = (id: string, name: string, branch: number, row: number, cost: number, requires: string[], adds: TreeNode['adds'], text: string[], rest: Partial<TreeNode> = {}): TreeNode =>
  ({ id, name, branch, row, col: branch, cost, requires, adds, text, ready: true, ...rest });

export const ARCHER_TREE: ClassTree = {
  classId: 4,
  branches: ['MARKSMAN', 'TRAPPER', 'SKIRMISHER'],
  base: ['heavy', 'thick', 'swift', 'windfall', 'wind', 'pound', ...TRACKS],
  nodes: [
    // A - Marksman
    n('ar-a1', 'EAGLE EYE', 0, 0, 15, [], 'BOON', ['LONG SHOTS HIT HARDER.'], { grants: ['eagle'] }),
    n('ar-a2', 'LAST STAND', 0, 1, 15, [], 'BOON', ['A LOW-HEALTH SHOCKWAVE.'], { grants: ['last'] }),
    n('ar-a3', 'CHARGED SHOT', 0, 2, 60, ['ar-a1'], 'SKILL', ['REPLACES THE ARROW. HOLD TO DRAW, LET GO TO LOOSE A', 'PIERCING SHOT DOWN THE AIM LINE: UP TO TWICE AS HARD.'], { skill: 25 }),
    n('ar-a4', 'EXECUTIONER', 0, 3, 30, ['ar-a2'], 'BOON', ['+50% DAMAGE TO THE WOUNDED.'], { grants: ['exec'] }),
    n('ar-a5', 'PIERCING BOLT', 0, 4, 60, ['ar-a3', 'ar-a4'], 'SKILL', ['REPLACES THE VOLLEY. ONE HEAVY BOLT THROUGH THE WHOLE', 'LINE OF FOES, A LONG REACH.'], { skill: 26 }),
    n('ar-a6', 'DEAD EYE', 0, 5, 150, ['ar-a5'], 'RULE', ['THE FIRST SHOT AFTER 2S OF NOT FIRING IS ALWAYS FULL POWER.'], { gate: 'KILL 20 ELITES WITH LONG SHOTS', ready: false, icon: 'boon-eagle' }),
    // B - Trapper
    n('ar-b1', 'BLOODLUST', 1, 0, 15, [], 'BOON', ['KILLS GIVE STAMINA BACK.'], { grants: ['lust'] }),
    n('ar-b2', 'FAREWELL', 1, 1, 15, [], 'BOON', ['A DODGE LEAVES A BLAST WHERE YOU WERE.'], { grants: ['gift'] }),
    n('ar-b3', 'SPIKE FIELD', 1, 2, 60, ['ar-b1'], 'SKILL', ['REPLACES THE RAIN. A PATCH OF SPIKES A STEP AHEAD FOR', '8S: FOES IN IT ARE CHIPPED AND HELD UP.'], { skill: 27 }),
    n('ar-b4', 'BLOOD TITHE', 1, 3, 30, ['ar-b2'], 'BOON', ['EVERY 10TH KILL HEALS.'], { grants: ['tithe'] }),
    n('ar-b5', 'SNARE TRAP', 1, 4, 60, ['ar-b3', 'ar-b4'], 'SKILL', ['REPLACES THE ROLL. IT DROPS A TRAP WHERE IT BEGAN: THE', 'FIRST FOE TO TOUCH IT SPRINGS IT AND ALL NEAR ARE HELD.'], { skill: 28 }),
    n('ar-b6', 'KILLING FIELD', 1, 5, 150, ['ar-b5'], 'RULE', ['EVERYTHING IN A TRAP OR SPIKE PATCH TAKES 25% MORE.'], { gate: '50 KILLS ON TRAPPED FOES', ready: false, icon: 'boon-downpour' }),
    // C - Skirmisher
    n('ar-c1', 'ARROW RING', 2, 0, 15, [], 'BOON', ['A DODGE LOOSES A RING OF ARROWS.'], { grants: ['ring'] }),
    n('ar-c2', 'TWIN FLAME', 2, 1, 15, [], 'BOON', ['EXTRA SHOTS FAN OUT.'], { grants: ['twin'] }),
    n('ar-c3', 'FIRE ARROW', 2, 2, 60, ['ar-c1'], 'SKILL', ['REPLACES THE ARROW. A FLAMING ARROW THAT BURSTS', 'WHERE IT LANDS.'], { skill: 29 }),
    n('ar-c4', 'DOWNPOUR', 2, 3, 30, ['ar-c2'], 'BOON', ['MORE ARROWS IN THE RAIN.'], { grants: ['downpour'] }),
    n('ar-c5', 'BACKFLIP SHOT', 2, 4, 60, ['ar-c3', 'ar-c4'], 'SKILL', ['REPLACES THE ROLL. A LEAP BACK, LOOSING THREE ARROWS', 'FORWARD AS YOU GO.'], { skill: 30 }),
    n('ar-c6', 'FRENZY', 2, 5, 150, ['ar-c5'], 'RULE', ['FRENZY JOINS THE POOL: ATTACK 50% FASTER.'], { grants: ['frenzy'], gate: 'CLEAR A LEVEL WITHOUT MELEE DAMAGE' }),
    // bridges
    n('ar-ab', 'TRIPWIRE', -1, 6, 60, ['ar-a3', 'ar-b3'], 'BOON', ['A DRAWN SHOT AT A TRAPPED FOE PIERCES THE LINE BEHIND.'], { ready: false, col: 0, icon: 'boon-eagle' }),
    n('ar-bc', 'KITE', -1, 6, 60, ['ar-b3', 'ar-c3'], 'FUSION', ['WILDFIRE (FAREWELL + SWIFT FEET): A DODGE LAYS', 'THREE BLASTS.'], { grants: ['gift', 'wildfire'], col: 1 }),
    n('ar-ac', 'RUN AND GUN', -1, 6, 60, ['ar-a3', 'ar-c3'], 'BOON', ['AFTER A ROLL, THE NEXT ARROW IS A FREE DRAWN SHOT.'], { ready: false, col: 2, icon: 'boon-ring' }),
  ],
};
