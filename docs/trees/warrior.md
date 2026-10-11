# Warrior tree

Template and rules: [22](../22-class-trees.md). Status: `✓` exists, needs only gating; `◐` small tweak; `＋` new. "Tracks" = the four scaling boons (size/count/speed/power) of an ability ([04](../04-classes-progression.md#ability-scaling)).

**Adds** says what kind of thing a node puts in front of the character:

| Adds | Meaning |
|---|---|
| **SKILL** | a new active ability; it **replaces one of the warrior's four starting skills** (the slot it names) while equipped |
| **MUTATION** | changes how an existing skill works (the quake forks, the roll plows) |
| BOON | a trigger or passive card in the level-up pool |
| TRACKS | the size/count/speed/power cards of one skill |
| FUSION | opens a fusion card whose parents are both reachable |
| KIT / CAPACITY | a starting item or resource / an extra slot, revive or card choice |
| RULE | a keystone rule change |

**Fantasy:** hold the line. Three ways to do it: *take* the blows (Guardian), *give* them back harder (Berserker), *make the line bigger* (Warlord). Each branch has its own skill (node 3).

**Root (free):** Fury and stamina as built, and the four starting skills (Swing, Big Swing, Quake, Charge). Base pool: Heavy Hands, Thick Skin, Swift Feet, Windfall, Second Wind, Shatter, the tracks of all four slots (Size, Count, Speed, Power each; they scale whatever skill is in the slot) and **Split Earth** (a quake mutation, only offered while the quake is equipped). Everything else comes from a node's grants (grants live in the tree, see [22](../22-class-trees.md)).

## Skill slots (proposed: the loadout that makes replays different)

The goal is variety in the kit, so **every starting skill is a slot a tree skill can replace**. The warrior has four, on the buttons it already has; the loadout holds one skill per slot, chosen in the tree (the town, or a camp), and the tree shows each skill's slot on its node.

| Slot | Button | Starting skill | Alternatives (node) |
|---|---|---|---|
| **Swing** | Attack | Sword combo | **Pike** (C5) |
| **Big Swing** | Ability 2 (stamina) | Wave sweep | **Whirlwind** (B5) |
| **Quake** | Ability 1 (fury) | Quake | **Taunting Roar** (A3), **Rage** (B3), **Planted Standard** (C3) |
| **Charge** | Dodge (stamina) | Shoulder-charge | **Shield Rush** (A5) |

So a warrior's run is shaped by four picks (one of them with four options), and each branch hands out two skills in different slots. Each skill brings its own four tracks (size, count, speed, power); the tracks of the starting skills sit in the base pool and scale whatever is in that slot. A card for a skill that is not equipped is left out of offers (as Split Earth is without the quake).

The three new skills (all proposed numbers):

| Skill | Slot | What it does |
|---|---|---|
| **Shield Rush** (Guardian) | Charge | Shield up and rush forward 60% of the charge's distance: frontal hits are blocked for the rush, and every foe caught is carried along and slammed at the end (stagger). 22 stamina |
| **Whirlwind** (Berserker) | Big Swing | A 40-tick spin hitting everything within 46 px every 8 ticks for 6 damage; you walk at 60% speed. 35 stamina to start and a drain while it spins, so it can be cut short |
| **Pike** (Warlord) | Swing | The basic attack becomes a long thrust (reach 70, a narrow line that pierces), 28 ticks a swing and 10 damage; the finisher is a wide sweep. Shoves foes back from the line |

## The quake-slot skills (built)

Each costs fury, uses the quake's 30-tick cooldown, and is bigger at a full bar. All numbers are starting points. A skill brings its own four tracks, so the ability-1 tracks mean something different per skill:

| Skill | Node | What it does | Size | Count | Speed | Power |
|---|---|---|---|---|---|---|
| **Quake** (default) | root | Shockwave down the field, 190 long (270 big) | length and width | two more lanes | recovers quicker | damage |
| **Taunting Roar** | A3 | 50 fury. Mobs within 90 px (130 big) switch to you for 3 s (5 big) and stagger 10 ticks; you take -30% damage while any are taunted | radius | an echo roar 12 ticks later | recovers quicker | damage reduction while taunting |
| **Rage** | B3 | 40 fury to start, a toggle. While it lasts fury drains 0.25 a tick; you deal +50% damage and swing 25% faster, take +25% damage, and kills refill fury. Ends when the bar is empty or pressed again | swing reach | swings send a wave | drains slower | the damage bonus |
| **Planted Standard** | C3 | 40 fury. Plants a standard where you stand for 10 s: allies within 110 px (you too) deal +15% and take -10%. One at a time; planting again moves it. Alone it is still worth it | aura radius | a second standard may stand | lasts longer | strength of the aura |

## A — Guardian (take it)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Iron Recoil | BOON | Iron Recoil (being hit shoves foes) | ✓ |
| 2 | Hard Knocks | BOON | Hard Knocks: each hit you take makes your hits 15% stronger for 3 s (stacks to 3). Works solo | ◐ built |
| 3 | Taunting Roar | **SKILL** | Taunting Roar and its four tracks | ＋ |
| 4 | Last Stand | BOON, FUSION | Last Stand; opens the *Undying* fusion (Last Stand + Thick Skin) | ✓ |
| 5 | Shield Rush | **SKILL** | Shield Rush (Charge slot) and its four tracks | ＋ |
| 6 | **Immovable** (keystone) | RULE | Hits never shove or stagger you; -25% damage from the front, +25% from behind. *Achievement: take 500 damage in one run and finish the level.* | ＋ |

## B — Berserker (give it back)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | Bloodlust | BOON | Bloodlust (kills give stamina) | ✓ |
| 2 | Executioner | BOON | Executioner (+50% vs wounded) | ✓ |
| 3 | Rage | **SKILL** | Rage and its four tracks | ＋ |
| 4 | Blood Tithe | BOON, FUSION | Blood Tithe; opens *Bloodmoon* (Tithe + Executioner) | ✓ |
| 5 | Whirlwind | **SKILL** | Whirlwind (Big Swing slot) and its four tracks | ＋ |
| 6 | **Frenzy** (keystone) | BOON, RULE | Frenzy (attack 50% faster) joins the pool *and* is offered as the first card once per run. *Achievement: 40 kills inside one fury bar.* | ✓ |

## C — Warlord (make it bigger)

| # | Node | Adds | Grants | |
|---|---|---|---|---|
| 1 | War Banner | BOON | War Banner joins the pool | ✓ |
| 2 | Warding | BOON | Warding joins the pool | ✓ |
| 3 | Planted Standard | **SKILL** | Planted Standard and its four tracks | ＋ |
| 4 | Rally | BOON, FUSION | Avenger, and the *War Cry* (Banner + Warding) fusion (auras reach 2x farther, standard included) | ✓ |
| 5 | Pike | **SKILL** | Pike (Swing slot) and its four tracks | ＋ |
| 6 | **Marshal** (keystone) | RULE | Allies within the banner's reach feed your fury with their kills, and your auras reach 50% farther. Solo: the same, from your own kills at +25%. *Achievement: win a run with a party of three or more.* | ＋ |

## Bridges and cosmetics

A bridge needs the position-3 node of both its branches, which for the warrior means **both skills owned**.

| Node | Needs | Adds | Grants | |
|---|---|---|---|---|
| Pain Is Power (A×B) | A3 + B3 | BOON | Being hit gives fury (a trigger boon, rare) | ＋ |
| Blood Banner (B×C) | B3 + C3 | BOON | Banner allies heal a little on your kills | ＋ |
| Shield Wall (A×C) | A3 + C3 | BOON | A hit to an ally in banner reach is shared 50/50 with you | ＋ |
| Cosmetic ×2 | root | cosmetic | Dented helm skin; title "Held the Gate" | cosmetic |

## Built (prototype)

Playable in the town (`?renown=400` for renown to spend; it is written to the profile). Walk to the **Trainer** booth, trade opens the tree. Built: every node marked `✓`, Hard Knocks, the **skill-slot loadout** (one skill per slot, equipped in the tree, shown in the tree's header) and all six skills: Taunting Roar, Rage and Planted Standard (Quake slot), Shield Rush (Charge), Whirlwind (Big Swing), Pike (Swing; no finisher). Not built (drawn, cannot be bought): Immovable, Marshal and the three bridges. Keystone achievements are shown but not enforced. Simplifications to revisit:

- One tree per account, not per character (the profile has no characters yet); the loadout is shared by every warrior in the party.
- A skill's tracks: only the ones its `SkillDef.tracks` lists are offered (the others are left out of the pool). Rage has no Size or Count, the three Quake-slot skills no Count, Whirlwind no Count.
- Replacement skills are data (`data/skills.ts`): a skill overrides fields of the class's definition while equipped (`variantOf`); Pike, Whirlwind and Shield Rush add two fields to `ClassDef` (`spin`, `dashSlam`). The Quake-slot skills have code of their own (`sim/skills.ts`).
- The skills' visuals are a ring and a banner (Quake slot) and the existing sweep or pulse effects, not final art.
- A fresh warrior's pool is base-only (the tracks of all four slots, Shatter, Split Earth, the stat cards); a bot warrior on it cannot win a two-level route, so headless sims and the balance probe deal from the open pool (`RoadState.treeGated`) until the tree is part of what they simulate.

## Notes

- **One skill per slot.** Owning several is fine; the character equips one per slot (at the town or a camp), and a card for a skill that is not equipped (Split Earth without the quake, a Rage track under the Roar) is left out of offers. That is a change to `offerFor` (a boon names the skill it needs).
- **The starting skills stay good,** so a warrior with no branch skill is not worse off. The skills are sidegrades with a different job, not upgrades.
- **Warrior-only shape change.** Skills sit at nodes 3 and 5, so no branch has the template's kit/capacity node 5, the old track nodes (Quake Mastery, Hold the Line, Big Swing) are gone (their tracks are in the base pool and ride with each skill), and Standard Bearer is dropped. Revisit once the other classes get skills.
- Guardian is the safest first branch (its skill is the easiest to use); Berserker is the highest ceiling; Warlord is the party branch and its keystone is weak solo by design.
- Open: does a mutation like Split Earth need the quake, or can Split Earth's fork also apply to Rage's wave? Does Rage need a dodge-cancel so a player is not locked into its drawbacks?
