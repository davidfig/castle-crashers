# Mage tree

Template and rules: [22](../22-class-trees.md); the warrior's tree ([warrior.md](warrior.md)) is the other built one. Status: `✓` exists, needs only gating; `◐` small tweak; `＋` new. **Adds** is as in the warrior doc (SKILL, BOON, FUSION, RULE...). Branches are three ways the same kit behaves: the **Pyromancer** burns, the **Cryomancer** holds things still, the **Stormcaller** chains.

**Fantasy:** elemental destruction, chosen. Every starting skill is a slot a branch skill can replace; a mage's run is shaped by which four it carries.

## Skill slots

| Slot | Button | Starting skill | Alternatives (branch, node) |
|---|---|---|---|
| **Swing** | Attack | Fireball | **Flamethrower** (Pyromancer 3), **Chain Bolt** (Stormcaller 3) |
| **Big Swing** | Ability 2 (mana) | Lobbed megaball | **Meteor** (Pyromancer 5), **Lightning Strike** (Stormcaller 5) |
| **Nova** | Ability 1 (fury) | Fire nova | **Frost Nova** (Cryomancer 3) |
| **Dodge** | Dodge (mana) | Blink | **Ice Slide** (Cryomancer 5) |

The tracks (size, count, speed, power) of all four slots are in the base pool and scale whatever fills the slot; a skill lists the ones it uses and the pool leaves out the rest.

| Skill | What it does (starting numbers) | Size | Count | Speed | Power |
|---|---|---|---|---|---|
| **Flamethrower** | The fireball becomes a cone of fire (reach 58, about 60 degrees), held down: 2.2 damage to every foe in it every 5 ticks, 2.5 mana a swing; the mage walks at 60% | reach | wider cone | quicker | damage |
| **Chain Bolt** | A bolt at the nearest foe in front (within 150) that jumps to the nearest unhit foe within 70 of the last, three times, each hit 85% of the last (8 damage first); 20 mana, only loosed at a foe | hop reach | +1 hop | quicker | damage |
| **Meteor** | Marks a spot 110 ahead; 50 ticks later a blast of radius 62 and 30 damage lands there (weaker at the edge); 45 mana | blast radius | (none) | recovers | damage |
| **Lightning Strike** | An instant bolt 230 long down the aim line: 16 damage and a stun to everything on it, then arcs to two more foes near the last (60%); 40 mana | length | (none) | recovers | damage |
| **Frost Nova** | A ring (radius 85, 125 at a full bar) that freezes every foe in it for 60 ticks (100 at full) and hurts a little; 40 fury | radius | (none) | recovers | freeze time |
| **Ice Slide** | The blink becomes a long slide, kept up while dodge is held (20 ticks, 0.45 mana a tick after): invulnerable, and foes it touches are frozen for 50 ticks | slide length | extra slide | recovers | freeze time |

Frozen is the existing stun on a mob (it stands still); a blue tint and a proper chill that slows rather than stops come with the monster-victim half of the element table ([16](../16-skills-and-elements.md#toward-hero-skills)).

## A — Pyromancer (burn it down)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Twin Flame | BOON | Twin Flame (extra fanned shots) | ✓ |
| 2 | Echo Blast | BOON | Echo Blast (blasts go off twice) | ✓ |
| 3 | Flamethrower | **SKILL** | Flamethrower (Swing) and its tracks | ＋ built |
| 4 | Last Stand | BOON, FUSION | Last Stand (a low-health shockwave); opens Undying | ✓ |
| 5 | Meteor | **SKILL** | Meteor (Big Swing) and its tracks | ＋ built |
| 6 | **Glass Fang** (keystone) | BOON, RULE | Glass Fang (2x dealt, 1.5x taken) joins the pool. *Achievement: clear a level without being hit.* | ✓ |

## B — Cryomancer (hold it still)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Quicksilver | BOON | Quicksilver (a blink feeds your power) | ✓ |
| 2 | Farewell | BOON | Farewell (a dodge leaves a blast where you were) | ✓ |
| 3 | Frost Nova | **SKILL** | Frost Nova (Nova) and its tracks | ＋ built |
| 4 | Cold Heart | BOON | Blood Tithe (every 10th kill heals) | ✓ |
| 5 | Ice Slide | **SKILL** | Ice Slide (Dodge) and its tracks | ＋ built |
| 6 | **Absolute Zero** (keystone) | RULE | Every 20 s a whiteout freezes the screen. *Achievement: freeze 100 foes in one run.* | ＋ not built |

## C — Stormcaller (chain it)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Chain Spark | BOON | Chain Spark (hits arc to nearby foes) | ✓ |
| 2 | Bloodlust | BOON | Bloodlust (kills give mana back) | ✓ |
| 3 | Chain Bolt | **SKILL** | Chain Bolt (Swing) and its tracks | ＋ built |
| 4 | Tempest | FUSION | Tempest (Chain Spark + Shatter: sparks explode) | ✓ |
| 5 | Lightning Strike | **SKILL** | Lightning Strike (Big Swing) and its tracks | ＋ built |
| 6 | **Overload** (keystone) | RULE | A kill by lightning bursts into a chain of its own. *Achievement: one chain that hits 10 foes.* | ＋ not built |

## Bridges and cosmetics

A bridge needs the position-3 node of both its branches, which here means both skills owned.

| Node | Needs | Adds | Grants | |
|---|---|---|---|---|
| Steam (A×B) | A3 + B3 | BOON | A frozen foe hit by fire takes a burst of extra damage and thaws | ＋ not built |
| Wet Wire (B×C) | B3 + C3 | BOON | A frozen foe is hit harder by lightning and arcs to it first | ＋ not built |
| Fire and Fury (A×C) | A3 + C3 | FUSION | Wildfire (Farewell + Swift Feet): a dodge lays three blasts | ✓ |
| Cosmetic ×2 | root | cosmetic | Grey-robe skin; title "Burned the Library" | cosmetic |

## Built (prototype)

Playable in the town: become the mage at its stand, then use the Trainer. Built: every node above except Absolute Zero, Overload, Steam and Wet Wire (drawn, cannot be bought); all six skills, with icons. The mage tree is its own save (`RoadState.trees[1]`), separate from the warrior's, and so are its loadout and active branches. Simplifications:

- One tree per class per account, not per character (the profile has no characters yet); a party's mages share a loadout.
- Fire does not burn mobs yet (a mob has no burning status), so the Flamethrower is a cone of quick hits, and Burning Ground (the old A4) is dropped from this tree for now.
- Frozen is a stun: a frozen foe stands still and is not tinted. A frozen foe is not yet hit harder by anything, so the bridges that rely on it wait.
- The skills' visuals reuse the existing cone, arc, beam, nova and burst effects, plus a ring and a falling streak for the Meteor's mark; no new art beyond the icons.
- Slot 0/1 skills that replace a ranged attack (`shot`, `specialShot`) switch it off by overriding the field to `undefined`; `ClassDef` gained `chain`, `meteor`, `bolt`, `dashStun` and `Swing.flame` for them.

## Notes

- Pyromancer and Stormcaller both replace the Swing and Big Swing slots, so a mage that takes both branches picks one of each pair; Cryomancer is the only branch that touches the Nova and the Dodge, which makes it the one to pair with either.
- The mage is the most fragile class (70 HP); Frost Nova and Ice Slide are its defensive tools, and the Flamethrower trades range for damage, so a mage that carries it is a short-range class.
- The mage's three nova/fireball families overlap (Split, Echo, Twin Flame); the focus cap keeps a build from holding all three at once.
