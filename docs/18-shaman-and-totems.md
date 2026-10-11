# 18 — Shaman and Totems

**Status: design (nothing built).** A class that deals no damage itself and fights entirely through **totems** it plants: spirit pillars that pulse an area effect around themselves for a while. It is also the first class designed against the **slot-and-tree model** that every class is meant to grow into (see "Fit with the class tree").

## Fantasy and niche

The shaman is the **zone-control** class. The warrior holds the line, the mage clears crowds, the archer is safe at range; the shaman decides *where* the fight happens. A prepared position is worth more than a fast hand.

Excels at (the row for the table in [04](04-classes-progression.md)): **making the ground itself dangerous or safe**: slowing, burning, rooting, healing and buffing inside rings it places. A kit that does not reinforce that is a bug.

Hard rules:

- **The shaman does no damage of their own.** The basic attack, special, nova and dodge all deal zero direct damage. Every point of damage, heal, slow or buff comes from a totem.
- **Totem kills are the shaman's kills.** A totem carries an owner (the planting hero); its damage credits that hero for XP, fury and boons. Without this the class cannot level.
- **Works alone and in a party** (see "Solo and co-op").

## Totems

A totem is an entity with an owner, a position, HP, a lifetime, a **beat** (ticks between pulses) and a **pulse**: an effect applied to everything in its radius each beat. The ring is drawn so the radius and the beat are readable.

Defaults, tuned later: lifetime about 12 s, beat about 1 s, small HP (Stone: large). **Mobs may target totems** (a totem that is nearer than a hero draws attacks), so a forward Stone totem is also a way to pull aggro. Totem HP must be generous enough that this is a choice and not a frustration.

**One live totem per kind** by default: replanting Ember moves your old Ember. This keeps the field readable, bounds the sim cost, and makes a rotation natural (no plant overwrites a different totem). Boons can raise it.

### Starting totems

Built on the elements of [16](16-skills-and-elements.md).

| Totem | Element | Pulse | Role |
|---|---|---|---|
| **Ember** | fire | Light damage to every mob in the ring; they **burn** | Raw damage, best on crowds |
| **Stone** | earth | **Slows** mobs, sometimes **roots** one. Most HP | Anchor and aggro sponge |
| **Storm** | lightning | Strikes the 2 nearest mobs; each strike **jumps** to a neighbour | Reach, spread-out mobs |
| **Spirit** | holy / wind | **Heals** heroes in the ring and gives a small speed boost. No damage | Support |

**Overlap bonuses** give depth: a rooted and burning mob takes bonus damage; a Storm strike on a slowed mob jumps further; two different totems whose rings overlap give each other a small bonus. Pool of later totems: Frost, Venom, War Drum (ally damage), Mirror (reflects), Gravity (pulls), Ward (damage reduction), and so on, each a new `TotemDef`, not new code.

## The four buttons

| Slot | Name | What it does | Pays |
|---|---|---|---|
| Basic | **Plant** | Plants the ready totem from the bag (below) | stamina |
| Special (ability 2) | **Spirit Call** | Every live totem pulses now at 1.5x and restarts its beat | stamina |
| Nova (ability 1) | **Great Spirit** | All live totems are empowered for about 6 s (bigger radius, faster beat). At a full bar the shaman also raises a free *Ancestor* totem that runs every live kind's pulse | fury |
| Dodge | **Spirit Step** | A plain roll, no damage. Boons turn it into a hop to the nearest totem | stamina |

**Fury fills from totem hits and kills**, not from being in the fray, so the shaman is paid for a well-placed trap.

Base stats: low HP (about 70, the warrior has 100), average speed, a normal stamina pool with plant costs high enough that spamming is not free.

## Controls: the totem bag

The design problem: a tree can grow the roster to 15 or 20 totems, and picking one before every plant is menu work in the middle of a fight. [06 UI](06-ui.md) rules that out (no modals; a ring selection finishes in under 0.7 s). So **choosing** which totems you bring is slow and happens at camp; **planting** is one button.

1. **The bag has N slots** (3 to start, 6 at most via the tree). At camp, fill it from every unlocked totem **in the order you want**.
2. **Tap Attack** plants the *ready* slot, then the bag advances to the next. The shaman's basic attack is a **combo chain** like every other class's, except each link is a totem (`comboWindow` applies if we choose the reset rule below).
3. **The next two totems show over the shaman's head** as small icons, so the rotation (say Stone, Ember, Spirit) becomes muscle memory and the player always knows what the next press does.
4. **Skip** (a bumper tap or D-pad left/right) moves the ready slot without planting, to answer a surprise (an ally goes down: skip to Spirit). Optional fast paths: right-stick flick or number keys pick a slot directly. These reach the sim as an input action (`totemSelect`), so selection is deterministic and net-ready ([ADR-0003](decisions/0003-non-blocking-ui.md)).
5. **Aim:** a tap plants a short step ahead of the shaman. Optional skill ceiling: hold to lob it farther.

Bar to hit: a new player who only taps Attack plays decently because the default bag order is sensible; a good player reorders the bag per fight and skips on the fly.

Alternatives weighed and rejected: cycle button plus plant button (two thumbs of attention per plant); one button per totem (the pad has four action buttons and the class needs them); a swap ring for every plant (too slow); a smart auto-pick (opaque, cannot be planned around). A smart pick may return later as an optional boon.

## Scaling: more than four powers

The four buttons stay; **what is slotted** grows. Tree nodes (see [04](04-classes-progression.md)) add:

| Axis | Examples |
|---|---|
| **More totems** | 15 to 20 kinds, each a `TotemDef` |
| **Bag size** | 3 to 6 slots |
| **Totem mutations** | Each totem has a small branch. Ember: *Pyre* (bigger, longer), *Cinder* (burn spreads), *Brand* (marked mobs take more damage) |
| **Spirit Call variants** | *Recall* (pick up all totems), *Overload* (2x), *Shift* (swap places with a totem), *Pull* (drag mobs into rings) |
| **Totem links** | Late tree. Two totems in range form a beam that hurts mobs crossing it: planting becomes geometry |
| **Passives** | Standing in your rings, totem kills, two-kind combos feed boons |

### Branches (three, as 04 proposes)

- **Wildfire:** damage totems (Ember, Storm). Burst through chains and links.
- **Earthen Warden:** Stone and control. Roots, slows, aggro, party survival.
- **Spiritcaller:** Spirit, buffs, revives, mobility. The co-op support path.

A keystone per branch changes a rule, for example *One Voice* (only one totem alive, with every kind's effect) or *Ancestral Circle* (totems share one beat).

### Boons (class-restricted, via the trigger framework in 04)

*Long Ritual* (lifetime +40%, cap of each kind +1), *Twin Pulse* (a plant drops two small totems either side), *Shared Flame* (burn spreads between mobs), *Rooted Spirit* (Spirit also revives a fallen ally in the ring, slowly), *Totem Walk* (dodge hops to the nearest totem and plants a free one), *Last Rite* (a destroyed totem pulses at 2x), legendary *Ancestral Chorus* (every ring runs every effect).

## Solo and co-op

Both must work, so two rules:

- **Every effect applies to "heroes in the ring", the shaman included.** A solo Spirit totem heals the shaman; a Drum buffs them. Nothing requires an ally to be useful.
- **The shaman gets a small bonus while standing in their own ring** (faster stamina regeneration, for example), so "plant at your feet and hold" is a good solo loop.

In a party the same totems reach allies, and the class plays as a team fortress (Stone under the warrior, Spirit behind the cleric). Two shamans overlapping different kinds gives a resonance bonus; tests must cover that pairing. Offers follow the existing `ctx.party` rule: party-only boons are left out for a solo hero.

## Fit with the class tree

This is where "scale all characters via skill trees" lands, and the bag is the template:

- Every class has **slots** (Basic, Special, Nova, Dodge, and where it makes sense a bag). **What fills a slot comes from the tree** (`Grant`: ability ids, perk ids, slot counts).
- A totem is plain data: `TotemDef { element, pulse, beat, hp, radius, lifetime }`. The pulse reuses the `Special`/`ShotDef` skill data and the element table of [16](16-skills-and-elements.md) **with a hero as the caster**, so this class and the "hero skills" work in 16 are the same work.
- The warrior's bag could be combo finishers; the mage's, spell mutations. One shape, many classes.

## What it needs from the code

1. **Mob statuses.** [16](16-skills-and-elements.md) notes mobs have no slow, root or burn (`elementHit` is written against heroes). Ember, Stone and Storm need the monster-victim half. This is the largest piece and is shared with hero skills generally.
2. **A hero-owned totem entity** (owner, HP, beat timer, kind), targetable by mobs, with damage credited to the owner (`sim/entities.ts`, `sim/step.ts`).
3. **A `totems?` branch on `ClassDef`** beside `quake` and `rain`, replacing the combo as `shot` does for ranged classes (`data/classes.ts`). The class order is shared with `art/chars` and `render/hero.ts`.
4. **Input:** `totemSelect` action, skip binding, bag-order UI at camp; a HUD preview of the next two totems ([06](06-ui.md)).
5. **Art:** a shaman sprite and set, totem sprites and ring draw ([13](13-ui-art.md)).
6. **Balance:** sim tests against `CLASSIC_MOBS`. The scripted bot plays head-on and barely moves, which suits a plant-and-hold class badly (as with the rogue and archer), so trust the skill-graded players of [14](14-ai-playtesting.md) over it.

Balance target: worse than the warrior's damage when played badly, better when played well. A pure-Ember shaman that never moves out-damages the warrior on a stationary crowd and falls behind against fast mobs and bosses that walk through the rings.

## Build order

1. The control prototype: bag, queue, skip, the HUD preview, with stub totems (no damage), to feel-test before any balance.
2. Mob statuses (burn, slow, root), in parallel.
3. The four starting totems and the four buttons.
4. The generic slot data shape, so the tree is not shaman-only.
5. Tree nodes, boons, mutations, links.

## Open questions

- **Bag reset.** Does the bag return to slot 1 after an idle gap (like `comboWindow`)? That makes slot 1 a reliable opener but punishes a mid-rotation pause.
- **Can mobs kill totems?** Leaning yes, with generous HP; the risk is frustration if totems die in two hits.
- **Solo viability.** Assumed yes (totems carry a whole run); confirm with playtests.
- **Aim.** Is the hold-to-lob worth its complexity?
- **Cap rule.** One live per kind versus a total cap of 3: leaning per-kind.
- **Pool size.** How many totems at launch of the tree, and how many bag slots a new character has.
