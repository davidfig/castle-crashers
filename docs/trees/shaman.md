# Shaman tree

Template and rules: [22](../22-class-trees.md); the shaman itself is [18](../18-shaman-and-totems.md). The other built trees are [warrior](warrior.md), [mage](mage.md), [cleric](cleric.md), [rogue](rogue.md), [archer](archer.md). Status: `✓` exists, needs only gating; `＋` new. **Adds** is as in the warrior doc.

The shaman is the odd one: it deals no damage of its own, so its skills are **totems**. The three direct buttons each plant one (Attack the Stone, Ability 1 the Ember, Ability 2 the Cannon), and a tree skill puts a different totem on a button in its place; the roll can become a step that plants a totem. The Alt extras and the shaman's two herding moves (Gale, Gather) are unchanged. Branches follow the totem jobs: the **Bastion** holds and wards, the **Pyre** hurts and freezes, the **Spirit** sustains.

## Skill slots (the buttons)

| Slot | Button | Starting totem | Alternatives (branch, node) |
|---|---|---|---|
| **Swing** | Attack | Stone | **Ward Totem** (Bastion 3) |
| **Big Swing** | Ability 2 | Cannon | **Gravity Well** (Bastion 5), **Storm Totem** (Pyre 5) |
| **Nova** | Ability 1 | Ember | **Frost Totem** (Pyre 3), **War Drum** (Spirit 5) |
| **Dodge** | Dodge | Roll | **Spirit Step** (Spirit 3) |

| Totem | Role | What it does (starting numbers) |
|---|---|---|
| **Ward Totem** | shields | The heroes inside its ring (80) take 30% less damage; 720 ticks, 60 HP, 14 stamina |
| **Gravity Well** | pulls | Every 20 ticks, every mob in its ring (110) is hauled toward it; 540 ticks, 50 HP, 18 stamina |
| **Frost Totem** | freezes | Every 30 ticks, every mob in its ring (80) is held 24 ticks; 600 ticks, 40 HP, 14 stamina |
| **Storm Totem** | strikes | The two nearest mobs in its ring (90) are struck by lightning every 75 ticks (the totem that was one of the Alt extras, now on a button) |
| **War Drum** | drives | The heroes inside its ring (90) deal 20% more damage; 720 ticks, 50 HP, 14 stamina |
| **Spirit Step** | mends | The roll sets a Spirit totem (mends the heroes in its ring) down where it began, free on top of the roll's stamina |

The shaman's tracks (size, count, speed, power) are not offered: none of the totems use them, so the base pool has no track cards. A fresh shaman's pool is thin on purpose (Heavy Hands, Thick Skin, Swift Feet, Windfall, Second Wind); everything else comes from the nodes. Totem damage and kills are the shaman's own, so Heavy Hands, Executioner, Bloodlust and Glass Fang work on them.

## A — Bastion (hold)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Warding | BOON | Warding (allies near you take less) | ✓ |
| 2 | Martyr | BOON | Martyr (your fall heals the party) | ✓ |
| 3 | Ward Totem | **SKILL** | Ward Totem (Attack) | ＋ built |
| 4 | Last Stand | BOON | Last Stand (a low-health shockwave) | ✓ |
| 5 | Gravity Well | **SKILL** | Gravity Well (Ability 2) | ＋ built |
| 6 | **Last Bastion** (keystone) | RULE | A Stone cannot fall for 4 s after its health is gone. *Achievement: a Stone survives 60 bites in a level.* | ＋ not built |

## B — Pyre (hurt)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Bloodlust | BOON | Bloodlust (kills give stamina back; totem kills count) | ✓ |
| 2 | Executioner | BOON | Executioner (+50% vs wounded) | ✓ |
| 3 | Frost Totem | **SKILL** | Frost Totem (Ability 1) | ＋ built |
| 4 | War Banner | BOON | War Banner (allies near you hit harder) | ✓ |
| 5 | Storm Totem | **SKILL** | Storm Totem (Ability 2) | ＋ built |
| 6 | **Glass Fang** (keystone) | RULE | Glass Fang (2x dealt, totems too; 1.5x taken) joins the pool. *Achievement: a totem deals 200 damage before it expires.* | ✓ |

## C — Spirit (sustain)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Avenger | BOON | Avenger (an ally falls: your power refills) | ✓ |
| 2 | Farewell | BOON | Farewell (a dodge leaves a blast where you were) | ✓ |
| 3 | Spirit Step | **SKILL** | Spirit Step (Dodge) | ＋ built |
| 4 | Blood Tithe | BOON | Blood Tithe (every 10th kill heals) | ✓ |
| 5 | War Drum | **SKILL** | War Drum (Ability 1) | ＋ built |
| 6 | **Phoenix** (keystone) | RULE | Phoenix (the first fall each level rises in flame) joins the pool. *Achievement: three totem kinds standing at once, twice in a level.* | ✓ |

## Bridges and cosmetics

| Node | Needs | Adds | Grants | |
|---|---|---|---|---|
| Bait and Burn (A×B) | A3 + B3 | BOON | A mob held by a Stone takes 25% more from totems | ＋ not built |
| Hearth (B×C) | B3 + C3 | BOON | A Spirit and an Ember together mend the party on a kill | ＋ not built |
| Great Wall (A×C) | A3 + C3 | BOON | Ward and Spirit rings that overlap share their effects | ＋ not built |
| Cosmetic ×2 | root | cosmetic | Feather-mantle skin; title "Planter of Stones" | cosmetic |

## Built (prototype)

Playable in the town: become the shaman at its stand, then use the Trainer. Built: every node except Last Bastion and the three bridges (drawn, cannot be bought); all six skills (each totem a `TotemKind` row in `data/totems.ts` with a role handled in `sim/totems.ts`), with icons. The shaman's tree is its own save (`RoadState.trees[5]`). Simplifications:

- One tree per class per account; a party's shamans share a loadout. A tree totem is a `variantOf` replacement of the totem on a button: the HUD's button bar, the plant and its cost all follow it.
- The **Mirror Totem** of the earlier design (reflects projectiles) is not built and has no node (its icon is drawn). It needs a way for a totem to send an enemy shot back.
- The Stone's Deep Roots and the other stat tweaks to the starting totems are not in this tree: a node adds cards and skills, not numbers ([22](../22-class-trees.md)).
- Frost holds mobs with the existing stun, not a slow; the Gravity Well hauls them with the same shove the shaman's Gather uses.

## Notes

- Pyre and Bastion both replace the Cannon (Ability 2) with their fifth node, and Pyre and Spirit both replace the Ember (Ability 1), so a shaman with two branches picks one of each pair; the Spirit Step is the only dodge replacement, and the Ward Totem the only replacement for the Stone.
- Dropping the Stone (for a Ward Totem) drops the taunt that holds a crowd on the totem line: a Ward-first shaman relies on the Gravity Well, the Frost Totem and the herding moves to keep a crowd off the party.
