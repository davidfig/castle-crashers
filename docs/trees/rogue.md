# Rogue tree

Template and rules: [22](../22-class-trees.md); the other built trees are [warrior](warrior.md), [mage](mage.md), [cleric](cleric.md). Status: `✓` exists, needs only gating; `＋` new. **Adds** is as in the warrior doc. Three styles of hit and vanish: the **Shadow** is never seen, the **Duelist** wins the duel, the **Thief** takes the loot.

## Skill slots

| Slot | Button | Starting skill | Alternatives (branch, node) |
|---|---|---|---|
| **Swing** | Attack | Dagger jabs | **Rapier** (Duelist 3), **Throwing Knife** (Thief 3) |
| **Big Swing** | Ability 2 | Shadowcut | **Fan of Knives** (Duelist 5) |
| **Nova** | Ability 1 (fury) | Blade ring | **Smoke Bomb** (Shadow 3) |
| **Dodge** | Dodge | Roll | **Shadow Step** (Shadow 5), **Caltrops** (Thief 5) |

| Skill | What it does (starting numbers) | Size | Count | Speed | Power |
|---|---|---|---|---|---|
| **Rapier** | The jabs become a quick lunging thrust (reach 46, 5 damage, 10 ticks, 3 stamina); the first thrust within 1.5 s of a dodge is a **riposte**, twice as hard. The rogue's flank and ambush multipliers still apply | reach | wider arc | quicker | damage |
| **Throwing Knife** | The attack is a thrown knife: ranged (speed 4, 4 damage, 14 ticks, 4 stamina), no flank bonus | knife size | +1 knife | flies faster | damage |
| **Fan of Knives** | Shadowcut becomes five knives in a fan (4 damage each, 30 stamina) | (none) | +2 knives | flies faster | damage |
| **Smoke Bomb** | A cloud (radius 60, 85 at a full bar) for 3 s (4.5 at full): the rogue is hidden whatever he does, so striking does not give him away and every strike is an ambush; foes in it are blinded 40 ticks; 40 fury | radius | (none) | recovers | lasts longer |
| **Shadow Step** | The roll becomes a blink behind the nearest foe within 150, facing its back, **hidden**: an ambush is next; with no foe near, a short blink; 16 stamina | range | extra step | recovers | (none) |
| **Caltrops** | The roll leaves a patch (radius 34, 6 s) where it began: foes in it take a little damage and are held a moment, every quarter second | roll length and patch reach | extra roll | recovers | (none) |

## A — Shadow (never be seen)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Death Dance | BOON | Death Dance (an ambush kill refunds the dodge) | ✓ |
| 2 | Farewell | BOON | Farewell (a dodge leaves a blast where you were) | ✓ |
| 3 | Smoke Bomb | **SKILL** | Smoke Bomb (Nova) and its tracks | ＋ built |
| 4 | Blood Price | BOON | Blood Tithe (every 10th kill heals) | ✓ |
| 5 | Shadow Step | **SKILL** | Shadow Step (Dodge) and its tracks | ＋ built |
| 6 | **Ghost** (keystone) | RULE | Standing still for a second hides you. *Achievement: clear a level with no foe ever targeting you.* | ＋ not built |

## B — Duelist (win the duel)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Keen Edge | BOON | Keen Edge (flank multipliers up) | ✓ |
| 2 | Executioner | BOON | Executioner (+50% vs wounded) | ✓ |
| 3 | Rapier | **SKILL** | Rapier (Swing) and its tracks | ＋ built |
| 4 | Bloodlust | BOON | Bloodlust (kills give stamina back) | ✓ |
| 5 | Fan of Knives | **SKILL** | Fan of Knives (Big Swing) and its tracks | ＋ built |
| 6 | **Frenzy** (keystone) | RULE | Frenzy (attacks 50% faster) joins the pool. *Achievement: kill a boss without being hit.* | ✓ |

## C — Thief (take the loot)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Pickpocket | BOON | Pickpocket (flank hits steal gold) | ✓ |
| 2 | Windfall | BOON | Windfall (+25% gold; not in the Rogue's base pool) | ✓ |
| 3 | Throwing Knife | **SKILL** | Throwing Knife (Swing) and its tracks | ＋ built |
| 4 | Second Wind | BOON | Second Wind (heal fully, now; not in the base pool) | ✓ |
| 5 | Caltrops | **SKILL** | Caltrops (Dodge) and its tracks | ＋ built |
| 6 | **Master Thief** (keystone) | RULE | Once a level a flank hit on an elite steals an item, not gold. *Achievement: end a run with 500 gold held.* | ＋ not built |

## Bridges and cosmetics

| Node | Needs | Adds | Grants | |
|---|---|---|---|---|
| Death Mark (A×B) | A3 + B3 | BOON | A foe you ambushed stays marked: all your hits on it flank | ＋ not built |
| Bounty Hunter (B×C) | B3 + C3 | BOON | Wounded elites drop gold on a hit | ＋ not built |
| Shadow Market (A×C) | A3 + C3 | FUSION | Wildfire (Farewell + Swift Feet): a dodge lays three blasts | ✓ |
| Cosmetic ×2 | root | cosmetic | Black-cowl skin; title "Never Seen" | cosmetic |

## Built (prototype)

Playable in the town: become the rogue at its stand, then use the Trainer. Built: every node except Ghost, Master Thief, Death Mark and Bounty Hunter (drawn, cannot be bought); all six skills, with icons. The rogue's tree is its own save (`RoadState.trees[3]`). Simplifications:

- One tree per class per account; a party's rogues share a loadout.
- The Fan of Knives and the Throwing Knife are drawn as arrows (the rogue has no knife sprite).
- Smoke Bomb keeps the rogue hidden for its whole length, and a hidden strike is an ambush (x6): it is strong, and meant to be tuned (shorter, or a smaller multiplier while smoke holds) with the skill-graded players of [14](../14-ai-playtesting.md), since the scripted bot plays the rogue inertly.
- The cloud's blinding is the existing stun; no new status.
- Caltrops, like the archer's patches, use `sim/patches.ts` (damage and a brief stun pulse), not a slow.

## Notes

- A rogue that takes Duelist and Thief holds two Swing-slot skills (the Rapier and the Knife) and picks one; Shadow is the only branch that touches the Nova.
- The tree has to keep the rogue's "hidden" state readable: the smoke cloud is drawn as grey puffs, and Shadow Step leaves him darkened as hiding already does.
