// The cleric's tree (docs/trees/cleric.md). The Mender mends, the Zealot punishes, the Sentinel stands between. Each branch sells two skills (nodes 3
// and 5) that replace the aura (Swing), the holy burst (Big Swing), the holy nova (Nova) or the heal roll (Dodge).
import type { ClassTree, TreeNode } from './types';

/** The track cards of all four slots: they scale whatever skill is in the slot, so they are open from the start. */
const TRACKS = ['bsize', 'bcount', 'bspeed', 'bpower', 'ssize', 'scount', 'sspeed', 'spower', 'nsize', 'ncount', 'nspeed', 'npower', 'dsize', 'dcount', 'dspeed', 'dpower'];

const n = (id: string, name: string, branch: number, row: number, cost: number, requires: string[], adds: TreeNode['adds'], text: string[], rest: Partial<TreeNode> = {}): TreeNode =>
  ({ id, name, branch, row, col: branch, cost, requires, adds, text, ready: true, ...rest });

export const CLERIC_TREE: ClassTree = {
  classId: 2,
  branches: ['MENDER', 'ZEALOT', 'SENTINEL'],
  base: ['heavy', 'thick', 'swift', 'windfall', 'wind', 'pound', ...TRACKS],
  nodes: [
    // A - Mender
    n('cl-a1', 'RADIANCE', 0, 0, 15, [], 'BOON', ['THE AURA MENDS THE PARTY.'], { grants: ['radiance'] }),
    n('cl-a2', 'VIGIL', 0, 1, 15, [], 'BOON', ['REVIVES COME SOONER.'], { grants: ['vigil'] }),
    n('cl-a3', 'HEALING BOLT', 0, 2, 60, ['cl-a1'], 'SKILL', ['REPLACES THE AURA. A BOLT AT THE MOST WOUNDED ALLY IN', 'FRONT: IT MENDS THEM. WITH NONE HURT, IT SMITES THE', 'NEAREST FOE.'], { skill: 13 }),
    n('cl-a4', 'COLD COMFORT', 0, 3, 30, ['cl-a2'], 'BOON', ['EVERY 10TH KILL HEALS YOU.'], { grants: ['tithe'] }),
    n('cl-a5', 'SANCTUARY RING', 0, 4, 60, ['cl-a3', 'cl-a4'], 'SKILL', ['REPLACES THE HOLY NOVA. A RING SET DOWN WHERE YOU', 'STAND FOR 8S: IT MENDS THE HEROES IN IT AND PUSHES', 'FOES OUT.'], { skill: 14 }),
    n('cl-a6', 'SECOND CHANCE', 0, 5, 150, ['cl-a5'], 'CAPACITY', ['ONE MORE REVIVE A RUN, FOR ANY ALLY.'], { gate: 'REVIVE 5 ALLIES IN A RUN', ready: false, icon: 'boon-vigil' }),
    // B - Zealot
    n('cl-b1', 'HOLY WRATH', 1, 0, 15, [], 'BOON', ['THE HEAL ROLL ALSO SMITES.'], { grants: ['wrath'] }),
    n('cl-b2', 'EXECUTIONER', 1, 1, 15, [], 'BOON', ['+50% DAMAGE TO THE WOUNDED.'], { grants: ['exec'] }),
    n('cl-b3', 'MACE', 1, 2, 60, ['cl-b1'], 'SKILL', ['REPLACES THE AURA. A REAL MELEE SWING: SLOWER, AND', 'IT HITS HARD. THE AURA\'S DRAIN GOES.'], { skill: 15 }),
    n('cl-b4', 'ZEAL', 1, 3, 30, ['cl-b2'], 'BOON', ['KILLS GIVE STAMINA BACK.'], { grants: ['lust'] }),
    n('cl-b5', 'JUDGMENT BEAM', 1, 4, 60, ['cl-b3', 'cl-b4'], 'SKILL', ['REPLACES THE HOLY BURST. A BEAM DOWN YOUR AIM LINE:', 'IT SCORCHES FOES AND MENDS THE HEROES IT CROSSES.'], { skill: 16 }),
    n('cl-b6', 'FRENZY', 1, 5, 150, ['cl-b5'], 'RULE', ['FRENZY JOINS THE POOL: ATTACK 50% FASTER.'], { grants: ['frenzy'], gate: '100 KILLS WITH THE MACE OR THE BEAM' }),
    // C - Sentinel
    n('cl-c1', 'WARDING', 2, 0, 15, [], 'BOON', ['ALLIES NEAR YOU TAKE 10% LESS.'], { grants: ['ward'] }),
    n('cl-c2', 'MARTYR', 2, 1, 15, [], 'BOON', ['YOUR FALL HEALS THE PARTY.'], { grants: ['martyr'] }),
    n('cl-c3', 'BEACON', 2, 2, 60, ['cl-c1'], 'SKILL', ['REPLACES THE HOLY NOVA. SETS DOWN A LAMP: FOES NEAR', 'IT TURN ON IT LIKE ON A STONE, AND THE HEROES BESIDE', 'IT TAKE 25% LESS.'], { skill: 17 }),
    n('cl-c4', 'AVENGER', 2, 3, 30, ['cl-c2'], 'BOON', ['AN ALLY FALLS: YOUR POWER REFILLS.'], { grants: ['rally'] }),
    n('cl-c5', 'AEGIS ROLL', 2, 4, 60, ['cl-c3', 'cl-c4'], 'SKILL', ['REPLACES THE HEAL ROLL. A PLAIN ROLL THAT SHIELDS THE', 'HEROES BESIDE YOU FOR 3S (THEY TAKE 40% LESS).'], { skill: 18 }),
    n('cl-c6', 'PHOENIX', 2, 5, 150, ['cl-c5'], 'RULE', ['PHOENIX JOINS THE POOL: THE FIRST FALL A LEVEL RISES IN FLAME.'], { grants: ['phoenix'], gate: 'SURVIVE A LEVEL AFTER FALLING BELOW 10% HEALTH 3 TIMES' }),
    // bridges
    n('cl-ab', 'HEALING STRIKES', -1, 6, 60, ['cl-a3', 'cl-b3'], 'BOON', ['A SMITE MENDS THE MOST WOUNDED ALLY NEAR.'], { ready: false, col: 0, icon: 'boon-wrath' }),
    n('cl-bc', 'HALLOWED GROUND', -1, 6, 60, ['cl-b3', 'cl-c3'], 'BOON', ['FOES STANDING BY THE BEACON ARE SCORCHED.'], { ready: false, col: 1, icon: 'boon-radiance' }),
    n('cl-ac', 'GUARDIAN ANGEL', -1, 6, 60, ['cl-a3', 'cl-c3'], 'BOON', ['AN ALLY ABOUT TO FALL IS PULLED BACK TO 1 HP, ONCE A LEVEL.'], { ready: false, col: 2, icon: 'boon-martyr' }),
  ],
};
