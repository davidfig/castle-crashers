# Archer tree

Template and rules: [22](../22-class-trees.md); the other built trees are [warrior](warrior.md), [mage](mage.md), [cleric](cleric.md), [rogue](rogue.md). Status: `✓` exists, needs only gating; `＋` new. **Adds** is as in the warrior doc. Three ways to be safe at range: one perfect arrow (**Marksman**), ground you control (**Trapper**), never being where they are (**Skirmisher**).

## Skill slots

| Slot | Button | Starting skill | Alternatives (branch, node) |
|---|---|---|---|
| **Swing** | Attack | Arrow | **Charged Shot** (Marksman 3), **Fire Arrow** (Skirmisher 3) |
| **Big Swing** | Ability 2 | Volley | **Piercing Bolt** (Marksman 5) |
| **Nova** | Ability 1 (fury) | Rain of arrows (aimed, held) | **Spike Field** (Trapper 3) |
| **Dodge** | Dodge | Roll | **Snare Trap** (Trapper 5), **Backflip Shot** (Skirmisher 5) |

| Skill | What it does (starting numbers) | Size | Count | Speed | Power |
|---|---|---|---|---|---|
| **Charged Shot** | Hold the attack to draw a bow (36 ticks, the archer walks at half speed); let go (after 8) to loose a piercing shot 260 long down the aim line: 9 damage, up to twice that by how far it was drawn, more by how far each foe is (the long shot and Eagle Eye apply); 6 stamina | length | (none) | draws faster | damage |
| **Fire Arrow** | The arrow becomes a flaming one that bursts where it lands (a splash of 22 radius, 80% of its damage) | blast | +1 arrow | flies faster | damage |
| **Piercing Bolt** | The volley becomes one heavy bolt, 320 long, through every foe on the line (26 damage; 45 stamina) | length | (none) | recovers | damage |
| **Spike Field** | The rain becomes a patch of spikes a step ahead (radius 50, 70 at a full bar; 8 s, 12 at full): foes in it are chipped and held a moment; 50 fury. No aiming | radius | (none) | recovers | damage |
| **Snare Trap** | The roll drops a trap (radius 30, 10 s) where it began: the first foe to touch it springs it, and every foe near is held 2 s | roll length | extra roll | recovers | holds longer |
| **Backflip Shot** | The roll becomes a leap backward (away from where you face), loosing three arrows forward as it goes; 22 stamina | leap length | extra leap | recovers | (none) |

## A — Marksman (one perfect arrow)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Eagle Eye | BOON | Eagle Eye (long shots hit harder) | ✓ |
| 2 | Last Stand | BOON | Last Stand (a low-health shockwave) | ✓ |
| 3 | Charged Shot | **SKILL** | Charged Shot (Swing) and its tracks | ＋ built |
| 4 | Executioner | BOON | Executioner (+50% vs wounded) | ✓ |
| 5 | Piercing Bolt | **SKILL** | Piercing Bolt (Big Swing) and its tracks | ＋ built |
| 6 | **Dead Eye** (keystone) | RULE | The first shot after 2 s of not firing is always full power. *Achievement: 20 elites killed with long shots.* | ＋ not built |

## B — Trapper (control the ground)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Bloodlust | BOON | Bloodlust (kills give stamina back) | ✓ |
| 2 | Farewell | BOON | Farewell (a dodge leaves a blast where you were) | ✓ |
| 3 | Spike Field | **SKILL** | Spike Field (Nova) and its tracks | ＋ built |
| 4 | Blood Tithe | BOON | Blood Tithe (every 10th kill heals) | ✓ |
| 5 | Snare Trap | **SKILL** | Snare Trap (Dodge) and its tracks | ＋ built |
| 6 | **Killing Field** (keystone) | RULE | Everything in a trap or spike patch takes 25% more. *Achievement: 50 kills on trapped foes.* | ＋ not built |

## C — Skirmisher (never where they are)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Arrow Ring | BOON | Arrow Ring (a dodge looses a ring of arrows) | ✓ |
| 2 | Twin Flame | BOON | Twin Flame (extra fanned shots; works with the arrow and the Fire Arrow, not the drawn shot) | ✓ |
| 3 | Fire Arrow | **SKILL** | Fire Arrow (Swing) and its tracks | ＋ built |
| 4 | Downpour | BOON | Downpour (more arrows in the rain; left out while Spike Field replaces the rain) | ✓ |
| 5 | Backflip Shot | **SKILL** | Backflip Shot (Dodge) and its tracks | ＋ built |
| 6 | **Frenzy** (keystone) | RULE | Frenzy (attacks 50% faster) joins the pool. *Achievement: clear a level without melee damage.* | ✓ |

## Bridges and cosmetics

| Node | Needs | Adds | Grants | |
|---|---|---|---|---|
| Tripwire (A×B) | A3 + B3 | BOON | A drawn shot at a trapped foe pierces the line behind it | ＋ not built |
| Kite (B×C) | B3 + C3 | FUSION | Wildfire (Farewell + Swift Feet): a dodge lays three blasts | ✓ |
| Run and Gun (A×C) | A3 + C3 | BOON | After a roll, the next arrow is a free drawn shot | ＋ not built |
| Cosmetic ×2 | root | cosmetic | Green-hood skin; title "Fletcher's Daughter" | cosmetic |

## Built (prototype)

Playable in the town: become the archer at its stand, then use the Trainer. Built: every node except Dead Eye, Killing Field, Tripwire and Run and Gun (drawn, cannot be bought); all six skills, with icons. The archer's tree is its own save (`RoadState.trees[4]`). Simplifications:

- One tree per class per account; a party's archers share a loadout.
- The Fire Arrow bursts (a splash); there is no burn status on a mob yet, so it leaves nothing burning.
- The drawn shot is instant down a line (a hit-scan, shown as the existing beam effect); there is no arrow in flight to dodge or to block.
- The Spike Field and Snare Trap are ground patches (`sim/patches.ts`): damage and a brief stun pulse, not a slow. One patch per hero stands at a time (a new one replaces the old).
- The Piercing Bolt is drawn with the default beam colour (the mage's line strike with the physical element).

## Notes

- Marksman and Skirmisher both replace the Swing slot, so an archer with both branches picks one; the Trapper is the only branch that touches the Nova.
- The Twin Flame in the Skirmisher branch is dead with the Charged Shot equipped (the drawn shot has no fan), which is why it is not in the Marksman branch where it is the Charged Shot's prerequisite.
