# Cleric tree

Template and rules: [22](../22-class-trees.md); the warrior's and mage's trees ([warrior.md](warrior.md), [mage.md](mage.md)) are the other built ones. Status: `✓` exists, needs only gating; `◐` small tweak; `＋` new. **Adds** is as in the warrior doc. Three answers to "keep everyone alive": the **Mender** mends, the **Zealot** punishes what hurts them, the **Sentinel** stands between them and it.

## Skill slots

| Slot | Button | Starting skill | Alternatives (branch, node) |
|---|---|---|---|
| **Swing** | Attack | Holy aura (toggle) | **Healing Bolt** (Mender 3), **Mace** (Zealot 3) |
| **Big Swing** | Ability 2 | Holy burst | **Judgment Beam** (Zealot 5) |
| **Nova** | Ability 1 (fury) | Holy nova | **Sanctuary Ring** (Mender 5), **Beacon** (Sentinel 3) |
| **Dodge** | Dodge | Heal roll | **Aegis Roll** (Sentinel 5) |

The tracks of all four slots are in the base pool and scale whatever fills the slot; a skill lists the ones it uses. The aura's Count and the burst's Count cards are not offered to the cleric at all (they belong to other classes), so no cleric skill has a Count track except Aegis Roll (an extra roll).

| Skill | What it does (starting numbers) | Size | Count | Speed | Power |
|---|---|---|---|---|---|
| **Healing Bolt** | The aura becomes a bolt (reach 130) at the most wounded ally in front: it mends 12. With nobody hurt, it smites the nearest foe for 6 (and counts as an aura pulse for Radiance). Loosed only at a target; 10 stamina | reach | (none) | quicker | mending and damage |
| **Sanctuary Ring** | A ring (radius 70, 95 at a full bar) set down where you stand for 8 s (12 at full): the heroes in it are mended 4 every half second, and every foe in it is pushed toward the edge; 45 fury | radius | (none) | recovers | mending |
| **Mace** | The aura becomes a two-hit melee swing (reach 40, 6 damage, the warrior's weight); the aura's drain goes, and Radiance (an aura boon) is left out of the pool | reach | (none) | quicker | damage |
| **Judgment Beam** | The holy burst becomes a beam 200 long down the aim line: 22 damage to every foe on it, 16 mended in every hero on it (you too); 40 stamina | length | (none) | recovers | damage and mending |
| **Beacon** | A lamp set a step ahead for 9 s (120 HP): foes within 110 go for it like a Stone, and the heroes beside it take 25% less damage. One at a time (planting again moves it); 45 fury | (none) | (none) | recovers | the ward (5% a rank) |
| **Aegis Roll** | The heal roll becomes a plain roll that shields every hero within 70 for 3 s: they take 40% less damage | roll length and shield reach | an extra roll | recovers | the shield lasts longer |

## A — Mender (mend them)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Radiance | BOON | Radiance (the aura, or a bolt that strikes a foe, mends those beside you) | ✓ |
| 2 | Vigil | BOON | Vigil (revives come sooner) | ✓ |
| 3 | Healing Bolt | **SKILL** | Healing Bolt (Swing) and its tracks | ＋ built |
| 4 | Cold Comfort | BOON | Blood Tithe (every 10th kill heals) | ✓ |
| 5 | Sanctuary Ring | **SKILL** | Sanctuary Ring (Nova) and its tracks | ＋ built |
| 6 | **Second Chance** (keystone) | CAPACITY | One more revive a run, for any ally. *Achievement: revive 5 allies in a run.* | ＋ not built |

## B — Zealot (punish it)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Holy Wrath | BOON | Holy Wrath (the heal roll also smites; left out while Aegis Roll is equipped) | ✓ |
| 2 | Executioner | BOON | Executioner (+50% vs wounded) | ✓ |
| 3 | Mace | **SKILL** | Mace (Swing) and its tracks | ＋ built |
| 4 | Zeal | BOON | Bloodlust (kills give stamina back) | ✓ |
| 5 | Judgment Beam | **SKILL** | Judgment Beam (Big Swing) and its tracks | ＋ built |
| 6 | **Frenzy** (keystone) | RULE | Frenzy (attacks 50% faster) joins the pool. *Achievement: 100 kills with the Mace or the Beam.* | ✓ |

## C — Sentinel (stand between)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Warding | BOON | Warding (allies near you take less) | ✓ |
| 2 | Martyr | BOON | Martyr (your fall heals the party) | ✓ |
| 3 | Beacon | **SKILL** | Beacon (Nova) and its tracks | ＋ built |
| 4 | Avenger | BOON | Avenger (an ally falls: your power refills) | ✓ |
| 5 | Aegis Roll | **SKILL** | Aegis Roll (Dodge) and its tracks | ＋ built |
| 6 | **Phoenix** (keystone) | RULE | Phoenix (the first fall each level rises in flame) joins the pool. *Achievement: survive a level after dropping below 10% health three times.* | ✓ |

## Bridges and cosmetics

| Node | Needs | Adds | Grants | |
|---|---|---|---|---|
| Healing Strikes (A×B) | A3 + B3 | BOON | A smite mends the most wounded ally nearby | ＋ not built |
| Hallowed Ground (B×C) | B3 + C3 | BOON | Foes standing by the Beacon are scorched | ＋ not built |
| Guardian Angel (A×C) | A3 + C3 | BOON | An ally about to fall is pulled back to 1 HP, once a level | ＋ not built |
| Cosmetic ×2 | root | cosmetic | Gold-trim robe; title "Mother of the Fallen" | cosmetic |

## Built (prototype)

Playable in the town: become the cleric at its stand, then use the Trainer. Built: every node above except Second Chance and the three bridges (drawn, cannot be bought); all six skills, with icons. The cleric's tree is its own save (`RoadState.trees[2]`). Simplifications:

- One tree per class per account, not per character; a party's clerics share a loadout.
- The Beacon is a totem (`BEACON` in `data/totems.ts`, role `taunt`, planted by `sim/clericSkills.ts`): it holds foes exactly as the shaman's Stone does, is bitten and breaks, and the shaman's totem renderer draws it. It is in no totem bag.
- Judgment Beam is the mage's line strike (`sim/mageSkills.ts` `lineStrike`) with a holy element and `bolt.heal`; Healing Bolt and Judgment Beam show as the existing holy arc and beam effects; the Sanctuary Ring, the Beacon's lamp and the Aegis shimmer are drawn with dotted rings and the totem look, not final art.
- A downed ally is not mended by the bolt or the ring (the revive is its own thing); the Beacon's taunt and ward do not need the owner to stand near.
- Skills that replace the aura leave out Radiance only for the Mace; Aegis Roll leaves out Holy Wrath.

## Notes

- Zealot is the solo-friendly branch (the Mace and the Beam hurt things); Mender and Sentinel are party branches (their boons drop out of solo offers via `needsParty`), but Healing Bolt still smites alone. A solo cleric should be steered to Zealot early.
- A cleric that takes Mender and Sentinel holds two Nova-slot skills (the Ring and the Beacon) and picks one; Zealot is the only branch that touches the Big Swing.
