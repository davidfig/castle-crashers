// The rogue's tree (docs/trees/rogue.md). The Shadow is never seen, the Duelist wins the duel, the Thief takes the loot. Each branch sells two skills
// (nodes 3 and 5) that replace the dagger (Swing), Shadowcut (Big Swing), the blade ring (Nova) or the roll (Dodge).
import type { ClassTree, TreeNode } from './types';

/** The track cards of all four slots: they scale whatever skill is in the slot, so they are open from the start. */
const TRACKS = ['bsize', 'bcount', 'bspeed', 'bpower', 'ssize', 'scount', 'sspeed', 'spower', 'nsize', 'ncount', 'nspeed', 'npower', 'dsize', 'dcount', 'dspeed', 'dpower'];

const n = (id: string, name: string, branch: number, row: number, cost: number, requires: string[], adds: TreeNode['adds'], text: string[], rest: Partial<TreeNode> = {}): TreeNode =>
  ({ id, name, branch, row, col: branch, cost, requires, adds, text, ready: true, ...rest });

export const ROGUE_TREE: ClassTree = {
  classId: 3,
  branches: ['SHADOW', 'DUELIST', 'THIEF'],
  // (Windfall and Second Wind are the Thief's, so they are not here)
  base: ['heavy', 'thick', 'swift', 'pound', ...TRACKS],
  nodes: [
    // A - Shadow
    n('r-a1', 'DEATH DANCE', 0, 0, 15, [], 'BOON', ['AN AMBUSH KILL REFUNDS THE DODGE.'], { grants: ['dance'] }),
    n('r-a2', 'FAREWELL', 0, 1, 15, [], 'BOON', ['A DODGE LEAVES A BLAST WHERE YOU WERE.'], { grants: ['gift'] }),
    n('r-a3', 'SMOKE BOMB', 0, 2, 60, ['r-a1'], 'SKILL', ['REPLACES THE BLADE RING. A CLOUD ROUND YOU FOR 3S: YOU', 'STAY HIDDEN WHATEVER YOU DO, AND FOES IN IT ARE BLINDED.'], { skill: 21 }),
    n('r-a4', 'BLOOD PRICE', 0, 3, 30, ['r-a2'], 'BOON', ['EVERY 10TH KILL HEALS.'], { grants: ['tithe'] }),
    n('r-a5', 'SHADOW STEP', 0, 4, 60, ['r-a3', 'r-a4'], 'SKILL', ['REPLACES THE ROLL. BLINKS BEHIND THE NEAREST FOE AND', 'LEAVES YOU HIDDEN, FACING ITS BACK: AN AMBUSH NEXT.'], { skill: 22 }),
    n('r-a6', 'GHOST', 0, 5, 150, ['r-a5'], 'RULE', ['STANDING STILL FOR A SECOND HIDES YOU.'], { gate: 'CLEAR A LEVEL WITH NO FOE EVER TARGETING YOU', ready: false, icon: 'boon-dance' }),
    // B - Duelist
    n('r-b1', 'KEEN EDGE', 1, 0, 15, [], 'BOON', ['FLANKING HITS HIT HARDER.'], { grants: ['keen'] }),
    n('r-b2', 'EXECUTIONER', 1, 1, 15, [], 'BOON', ['+50% DAMAGE TO THE WOUNDED.'], { grants: ['exec'] }),
    n('r-b3', 'RAPIER', 1, 2, 60, ['r-b1'], 'SKILL', ['REPLACES THE DAGGER. A QUICK LUNGING THRUST; THE FIRST', 'AFTER A DODGE IS A RIPOSTE, TWICE AS HARD.'], { skill: 19 }),
    n('r-b4', 'BLOODLUST', 1, 3, 30, ['r-b2'], 'BOON', ['KILLS GIVE STAMINA BACK.'], { grants: ['lust'] }),
    n('r-b5', 'FAN OF KNIVES', 1, 4, 60, ['r-b3', 'r-b4'], 'SKILL', ['REPLACES SHADOWCUT. FIVE KNIVES THROWN IN A FAN.'], { skill: 20 }),
    n('r-b6', 'FRENZY', 1, 5, 150, ['r-b5'], 'RULE', ['FRENZY JOINS THE POOL: ATTACK 50% FASTER.'], { grants: ['frenzy'], gate: 'KILL A BOSS WITHOUT BEING HIT' }),
    // C - Thief
    n('r-c1', 'PICKPOCKET', 2, 0, 15, [], 'BOON', ['FLANK HITS STEAL GOLD.'], { grants: ['pick'] }),
    n('r-c2', 'WINDFALL', 2, 1, 15, [], 'BOON', ['+25% GOLD.'], { grants: ['windfall'] }),
    n('r-c3', 'THROWING KNIFE', 2, 2, 60, ['r-c1'], 'SKILL', ['REPLACES THE DAGGER. THE ATTACK IS A THROWN KNIFE:', 'RANGED AND LIGHT, WITH NO FLANK BONUS.'], { skill: 23 }),
    n('r-c4', 'SECOND WIND', 2, 3, 30, ['r-c2'], 'BOON', ['HEAL FULLY, NOW.'], { grants: ['wind'] }),
    n('r-c5', 'CALTROPS', 2, 4, 60, ['r-c3', 'r-c4'], 'SKILL', ['REPLACES THE ROLL. THE ROLL LEAVES A SPREAD OF', 'CALTROPS: FOES IN IT ARE CHIPPED AND HELD UP.'], { skill: 24 }),
    n('r-c6', 'MASTER THIEF', 2, 5, 150, ['r-c5'], 'RULE', ['ONCE A LEVEL A FLANK HIT ON AN ELITE STEALS AN ITEM.'], { gate: 'END A RUN WITH 500 GOLD HELD', ready: false, icon: 'boon-pick' }),
    // bridges
    n('r-ab', 'DEATH MARK', -1, 6, 60, ['r-a3', 'r-b3'], 'BOON', ['A FOE YOU AMBUSHED STAYS MARKED: ALL YOUR HITS FLANK.'], { ready: false, col: 0, icon: 'boon-keen' }),
    n('r-bc', 'BOUNTY HUNTER', -1, 6, 60, ['r-b3', 'r-c3'], 'BOON', ['WOUNDED ELITES DROP GOLD ON A HIT.'], { ready: false, col: 1, icon: 'boon-pick' }),
    n('r-ac', 'SHADOW MARKET', -1, 6, 60, ['r-a3', 'r-c3'], 'FUSION', ['WILDFIRE (FAREWELL + SWIFT FEET): A DODGE LAYS', 'THREE BLASTS.'], { grants: ['gift', 'wildfire'], col: 2 }),
  ],
};
