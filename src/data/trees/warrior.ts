// The warrior's tree (docs/trees/warrior.md). Guardian takes the blows, Berserker gives them back, Warlord makes the line bigger; each branch sells
// a skill at its third node, which replaces the quake while equipped (sim/skills.ts).
import type { ClassTree, TreeNode } from './types';

/** The track cards of all four slots: they scale whatever skill is in the slot, so they are open from the start. */
const TRACKS = ['bsize', 'bcount', 'bspeed', 'bpower', 'ssize', 'scount', 'sspeed', 'spower', 'nsize', 'ncount', 'nspeed', 'npower', 'dsize', 'dcount', 'dspeed', 'dpower'];

const n = (id: string, name: string, branch: number, row: number, cost: number, requires: string[], adds: TreeNode['adds'], text: string[], rest: Partial<TreeNode> = {}): TreeNode =>
  ({ id, name, branch, row, col: branch, cost, requires, adds, text, ready: true, ...rest });

export const WARRIOR_TREE: ClassTree = {
  classId: 0,
  branches: ['GUARDIAN', 'BERSERKER', 'WARLORD'],
  base: ['heavy', 'thick', 'swift', 'windfall', 'wind', 'pound', 'rift', ...TRACKS],
  nodes: [
    // A - Guardian
    n('w-a1', 'IRON RECOIL', 0, 0, 15, [], 'BOON', ['BEING HIT SHOVES FOES AWAY.'], { grants: ['recoil'] }),
    n('w-a2', 'HARD KNOCKS', 0, 1, 15, [], 'BOON', ['EACH HIT YOU TAKE MAKES YOUR HITS 15%', 'STRONGER FOR 3S (STACKS TO 3).'], { icon: 'boon-heavy' }),
    n('w-a3', 'TAUNTING ROAR', 0, 2, 60, ['w-a1'], 'SKILL', ['REPLACES THE QUAKE. 50 FURY. FOES NEAR YOU', 'TURN ON YOU FOR 3S AND STAGGER; YOU TAKE', '30% LESS WHILE ANY ARE TAUNTED.'], { skill: 1 }),
    n('w-a4', 'LAST STAND', 0, 3, 30, ['w-a2'], 'FUSION', ['LOW HEALTH SHOCKWAVE, AND UNDYING', '(LAST STAND + THICK SKIN).'], { grants: ['last', 'undying'], ready: true }),
    n('w-a5', 'SHIELD RUSH', 0, 4, 60, ['w-a3', 'w-a4'], 'SKILL', ['REPLACES THE CHARGE (DODGE). A SHORT, WIDE RUSH,', 'SHIELD UP: IT CARRIES WHAT IT CATCHES AND', 'SLAMS THEM AT THE END (STAGGER).'], { skill: 4 }),
    n('w-a6', 'IMMOVABLE', 0, 5, 150, ['w-a5'], 'RULE', ['NEVER SHOVED OR STAGGERED. -25% FROM THE', 'FRONT, +25% FROM BEHIND.'], { gate: 'TAKE 500 DAMAGE IN A RUN AND FINISH THE LEVEL', ready: false, icon: 'boon-thick' }),
    // B - Berserker
    n('w-b1', 'BLOODLUST', 1, 0, 15, [], 'BOON', ['KILLS GIVE STAMINA BACK.'], { grants: ['lust'] }),
    n('w-b2', 'EXECUTIONER', 1, 1, 15, [], 'BOON', ['+50% DAMAGE TO THE WOUNDED.'], { grants: ['exec'] }),
    n('w-b3', 'RAGE', 1, 2, 60, ['w-b1'], 'SKILL', ['REPLACES THE QUAKE. 40 FURY, A TOGGLE.', '+50% DAMAGE, SWING 25% FASTER, TAKE +25%.', 'FURY DRAINS; KILLS REFILL IT.'], { skill: 2 }),
    n('w-b4', 'BLOOD TITHE', 1, 3, 30, ['w-b2'], 'FUSION', ['EVERY 10TH KILL HEALS; OPENS BLOODMOON', '(TITHE + EXECUTIONER).'], { grants: ['tithe', 'bloodmoon'] }),
    n('w-b5', 'WHIRLWIND', 1, 4, 60, ['w-b3', 'w-b4'], 'SKILL', ['REPLACES THE BIG SWING. A 40-TICK SPIN HITTING', 'ALL AROUND YOU EVERY 8 TICKS. YOU WALK SLOWLY;', 'STAMINA DRAINS WHILE IT SPINS.'], { skill: 5 }),
    n('w-b6', 'FRENZY', 1, 5, 150, ['w-b5'], 'RULE', ['FRENZY JOINS THE POOL: ATTACK 50% FASTER.'], { grants: ['frenzy'], gate: '40 KILLS INSIDE ONE FURY BAR' }),
    // C - Warlord
    n('w-c1', 'WAR BANNER', 2, 0, 15, [], 'BOON', ['ALLIES NEAR YOU HIT 12% HARDER.'], { grants: ['banner'] }),
    n('w-c2', 'WARDING', 2, 1, 15, [], 'BOON', ['ALLIES NEAR YOU TAKE 10% LESS.'], { grants: ['ward'] }),
    n('w-c3', 'PLANTED STANDARD', 2, 2, 60, ['w-c1'], 'SKILL', ['REPLACES THE QUAKE. 40 FURY. PLANTS A', 'STANDARD FOR 10S: ALLIES NEAR IT (YOU TOO)', 'HIT +15% AND TAKE -10%. ONE AT A TIME.'], { skill: 3 }),
    n('w-c4', 'RALLY', 2, 3, 30, ['w-c2'], 'FUSION', ['AVENGER, AND WAR CRY (BANNER + WARDING):', 'AURAS REACH TWICE AS FAR.'], { grants: ['rally', 'rallycry'] }),
    n('w-c5', 'PIKE', 2, 4, 60, ['w-c3', 'w-c4'], 'SKILL', ['REPLACES THE SWORD. A LONG, NARROW THRUST DOWN', 'A LINE OF FOES: SLOWER AND HEAVIER, NO FINISHER.'], { skill: 6 }),
    n('w-c6', 'MARSHAL', 2, 5, 150, ['w-c5'], 'RULE', ['ALLIES NEAR THE BANNER FEED YOUR FURY.', 'AURAS REACH 50% FARTHER.'], { gate: 'WIN A RUN WITH A PARTY OF THREE', ready: false, icon: 'boon-rally' }),
    // bridges
    n('w-ab', 'PAIN IS POWER', -1, 6, 60, ['w-a3', 'w-b3'], 'BOON', ['BEING HIT GIVES FURY.'], { ready: false, col: 0, icon: 'boon-last' }),
    n('w-bc', 'BLOOD BANNER', -1, 6, 60, ['w-b3', 'w-c3'], 'BOON', ['BANNER ALLIES HEAL ON YOUR KILLS.'], { ready: false, col: 1, icon: 'boon-banner' }),
    n('w-ac', 'SHIELD WALL', -1, 6, 60, ['w-a3', 'w-c3'], 'BOON', ['A HIT TO A BANNER ALLY IS SHARED WITH YOU.'], { ready: false, col: 2, icon: 'boon-ward' }),
  ],
};
