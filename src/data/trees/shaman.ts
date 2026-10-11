// The shaman's tree (docs/trees/shaman.md). The shaman does no damage of its own: its skills are totems, set on the three buttons in place of the Stone
// (Attack), the Ember (Ability 1) and the Cannon (Ability 2), and a step in place of the roll. The Bastion holds and wards, the Pyre hurts and
// freezes, the Spirit sustains. Each branch sells two (nodes 3 and 5).
import type { ClassTree, TreeNode } from './types';

const n = (id: string, name: string, branch: number, row: number, cost: number, requires: string[], adds: TreeNode['adds'], text: string[], rest: Partial<TreeNode> = {}): TreeNode =>
  ({ id, name, branch, row, col: branch, cost, requires, adds, text, ready: true, ...rest });

export const SHAMAN_TREE: ClassTree = {
  classId: 5,
  branches: ['BASTION', 'PYRE', 'SPIRIT'],
  // (a thin pool on purpose: no track cards, because the totems do not use them, and the rest comes from the nodes)
  base: ['heavy', 'thick', 'swift', 'windfall', 'wind'],
  nodes: [
    // A - Bastion
    n('s-a1', 'WARDING', 0, 0, 15, [], 'BOON', ['ALLIES NEAR YOU TAKE 10% LESS.'], { grants: ['ward'] }),
    n('s-a2', 'MARTYR', 0, 1, 15, [], 'BOON', ['YOUR FALL HEALS THE PARTY.'], { grants: ['martyr'] }),
    n('s-a3', 'WARD TOTEM', 0, 2, 60, ['s-a1'], 'SKILL', ['REPLACES THE STONE (ATTACK). A TOTEM WHOSE RING SHIELDS', 'THE HEROES IN IT: THEY TAKE 30% LESS.'], { skill: 31 }),
    n('s-a4', 'LAST STAND', 0, 3, 30, ['s-a2'], 'BOON', ['A LOW-HEALTH SHOCKWAVE.'], { grants: ['last'] }),
    n('s-a5', 'GRAVITY WELL', 0, 4, 60, ['s-a3', 's-a4'], 'SKILL', ['REPLACES THE CANNON (ABILITY 2). A TOTEM THAT HAULS EVERY', 'MOB IN ITS RING TOWARD IT, EVERY BEAT.'], { skill: 32 }),
    n('s-a6', 'LAST BASTION', 0, 5, 150, ['s-a5'], 'RULE', ['A STONE CANNOT FALL FOR 4S AFTER ITS HEALTH IS GONE.'], { gate: 'A STONE SURVIVES 60 BITES IN ONE LEVEL', ready: false, icon: 'boon-last' }),
    // B - Pyre
    n('s-b1', 'BLOODLUST', 1, 0, 15, [], 'BOON', ['KILLS GIVE STAMINA BACK (TOTEM KILLS COUNT).'], { grants: ['lust'] }),
    n('s-b2', 'EXECUTIONER', 1, 1, 15, [], 'BOON', ['+50% DAMAGE TO THE WOUNDED.'], { grants: ['exec'] }),
    n('s-b3', 'FROST TOTEM', 1, 2, 60, ['s-b1'], 'SKILL', ['REPLACES THE EMBER (ABILITY 1). A TOTEM WHOSE RING', 'FREEZES EVERY MOB IN IT FOR A MOMENT, EVERY BEAT.'], { skill: 33 }),
    n('s-b4', 'WAR BANNER', 1, 3, 30, ['s-b2'], 'BOON', ['ALLIES NEAR YOU HIT 12% HARDER.'], { grants: ['banner'] }),
    n('s-b5', 'STORM TOTEM', 1, 4, 60, ['s-b3', 's-b4'], 'SKILL', ['REPLACES THE CANNON (ABILITY 2). A TOTEM THAT STRIKES THE', 'TWO NEAREST MOBS IN ITS RING WITH LIGHTNING.'], { skill: 34 }),
    n('s-b6', 'GLASS FANG', 1, 5, 150, ['s-b5'], 'RULE', ['GLASS FANG JOINS THE POOL: 2X DAMAGE DEALT (TOTEMS TOO),', '1.5X TAKEN.'], { grants: ['glass'], gate: 'A TOTEM DEALS 200 DAMAGE BEFORE IT EXPIRES' }),
    // C - Spirit
    n('s-c1', 'AVENGER', 2, 0, 15, [], 'BOON', ['AN ALLY FALLS: YOUR POWER REFILLS.'], { grants: ['rally'] }),
    n('s-c2', 'FAREWELL', 2, 1, 15, [], 'BOON', ['A DODGE LEAVES A BLAST WHERE YOU WERE.'], { grants: ['gift'] }),
    n('s-c3', 'SPIRIT STEP', 2, 2, 60, ['s-c1'], 'SKILL', ['REPLACES THE ROLL. A ROLL THAT SETS A SPIRIT TOTEM', 'DOWN WHERE YOU BEGAN: IT MENDS THE HEROES IN ITS RING.'], { skill: 35 }),
    n('s-c4', 'BLOOD TITHE', 2, 3, 30, ['s-c2'], 'BOON', ['EVERY 10TH KILL HEALS.'], { grants: ['tithe'] }),
    n('s-c5', 'WAR DRUM', 2, 4, 60, ['s-c3', 's-c4'], 'SKILL', ['REPLACES THE EMBER (ABILITY 1). A TOTEM WHOSE RING MAKES', 'THE HEROES IN IT DEAL 20% MORE.'], { skill: 36 }),
    n('s-c6', 'PHOENIX', 2, 5, 150, ['s-c5'], 'RULE', ['PHOENIX JOINS THE POOL: THE FIRST FALL A LEVEL RISES IN FLAME.'], { grants: ['phoenix'], gate: 'THREE TOTEM KINDS STANDING AT ONCE, TWICE IN A LEVEL' }),
    // bridges
    n('s-ab', 'BAIT AND BURN', -1, 6, 60, ['s-a3', 's-b3'], 'BOON', ['A MOB HELD BY A STONE TAKES 25% MORE FROM TOTEMS.'], { ready: false, col: 0, icon: 'boon-exec' }),
    n('s-bc', 'HEARTH', -1, 6, 60, ['s-b3', 's-c3'], 'BOON', ['A SPIRIT AND AN EMBER TOGETHER MEND THE PARTY ON A KILL.'], { ready: false, col: 1, icon: 'boon-tithe' }),
    n('s-ac', 'GREAT WALL', -1, 6, 60, ['s-a3', 's-c3'], 'BOON', ['WARD AND SPIRIT RINGS THAT OVERLAP SHARE THEIR EFFECTS.'], { ready: false, col: 2, icon: 'boon-ward' }),
  ],
};
