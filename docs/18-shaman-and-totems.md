# 18 — Shaman and Totems

**Status: playable prototype built** (see "Prototype" at the end); everything else is design. A class that deals no damage itself and fights entirely through **totems** it plants: spirit pillars that pulse an area effect around themselves for a while. It is also the first class designed against the **slot-and-tree model** that every class is meant to grow into (see "Fit with the class tree").

## Fantasy and niche

The shaman is a **one-player party**. Each totem is a party member with one job: a tank that holds the enemy, a damage dealer, a gun turret, a healer. The shaman does no damage of their own; they decide *what stands where*, and with two non-damaging herding moves they decide *where the enemy goes*. The warrior holds the line, the mage clears crowds, the archer is safe at range; the shaman builds the line and feeds the enemy into it.

Excels at (the row for the table in [04](04-classes-progression.md)): **running a whole fight from a few well-placed totems and steering the enemy into them.**

Hard rules:

- **The shaman does no damage of their own.** Every point of damage, heal, taunt or fireball comes from a totem; the shaman's own moves only shove mobs about.
- **Totem kills are the shaman's kills** (XP, fury, boons): a totem's damage is the owner's (`by` on the entity, `owner` on the shot).
- **Works alone and in a party** (see "Solo and co-op").

### Why this shape (the first prototype was not fun)

The first prototype planted a rotating bag of inert totems. Two verbs (plant, move), and the enemy chased the shaman, so the game was spam and dodge. Two changes fix it. **Totems draw enemies** (the Stone taunts), so the shaman stops being the bait and can stand and act. **The shaman steers** (Gale, Gather), so there is always something to do after a plant. And the totems are *different jobs*, so which one you plant is a decision.

## Totems

A totem is an entity (`Kind.Totem`) with hit points, an owner, a lifetime and a beat. It is drawn as a post with a ring on the ground; the ring flashes on each beat.

**One live totem per kind per hero:** planting a kind again *moves* the old one and mends it to full (so replanting a hurt Stone is a heal for stamina). That keeps the field readable and bounds the cost.

### Starting totems (data/totems.ts, sim/totems.ts)

| Totem | Role | What it does | Numbers (prototype) |
|---|---|---|---|
| **Stone** | Tank | **Taunt**: any melee or ranged foe within its reach goes for the stone, not for the party, and bites it (one bite per 8 ticks at most, so a crowd does not melt it) | reach 120, 140 HP, 15 s, 14 stamina |
| **Ember** | Damage | Every beat, hurts every mob in its ring | ring 46, 3 damage every 40 ticks, 40 HP, 10 s, 12 stamina |
| **Cannon** | Turret | Every beat, lobs a splash fireball at the nearest mob on screen in range | range 170, 9 damage + splash 30, every 55 ticks, 50 HP, 10 s, 18 stamina |
| **Storm** | Lightning | Every beat, strikes the two nearest mobs in its ring | ring 90, 5 damage each every 75 ticks, 40 HP, 10 s, 14 stamina |
| **Spirit** | Healer | Every beat, mends heroes in its ring, and a nearby totem double | ring 52, 3 HP every 60 ticks, 40 HP, 12 s, 12 stamina |

Enemy arrows that reach a totem are spent on it (any totem), so ranged enemies can break one that stands in their line.

Later totems (the tree): Storm (chain lightning), Frost (slow), War Drum (ally damage), Mirror (reflects), Gravity, Ward, and so on, each a new `TotemKind`, not new code. Overlap bonuses (a rooted and burning mob takes more; two kinds with overlapping rings help each other) need mob statuses ([16](16-skills-and-elements.md)).

### The shaman's own moves (non-damaging)

| Move | What it does | Numbers |
|---|---|---|
| **Gale** | Shoves every mob within 70 px away from the shaman, and staggers it for 10 ticks: it peels a crowd off | 20 stamina, 50-tick cooldown |
| **Gather** | Hauls every mob within 140 px toward the nearest Stone (or the shaman, with none standing): it feeds a crowd to the rings | 24 stamina, 70-tick cooldown |

## Controls: a hybrid (direct buttons for the core, a cycle for the rest)

The design problem: a tree can grow the roster to 15 or 20 totems, and selecting before every plant is menu work in the middle of a fight, which [06 UI](06-ui.md) rules out. A pure one-button-per-action scheme runs out of buttons at about eight; a pure cycle scheme slows the shaman's reactions (an ally drops: cycle to the Spirit, check, plant) and turns planting into queue management (the first prototype, whose totems did nothing, felt exactly like that). So the control is a **hybrid**, with a loadout behind it:

- **Choosing** which totems you bring is slow and happens at camp (not built yet): the tree unlocks kinds, and you assign them to slots.
- **The core totems are one press each**, on the existing buttons, so the basics are muscle memory.
- **The rest of the roster is the "extras" list**: hold Alt and plant the *selected* extra, and step the selection with a button that is free and instant.

| Button | Plain | With Alt held (E, or A on a pad) |
|---|---|---|
| Attack | Stone | plant the selected extra |
| Ability 1 | Ember | step the selection forward (wraps) |
| Ability 2 | Cannon | Gather |
| Dodge | the dodge roll | Gale |

The extras are Spirit and Storm for now. **Q steps the selection back** (with or without Alt; keyboard only, P2 uses `-`). Planting does not advance the selection, so replanting the same extra is one press.

- **Alt is a held modifier, not a mode.** Release it and you are back on the plain bank. A pending press is remembered for 8 ticks, so a press during the plant gap still lands; stepping the selection acts at once, so it works in a hit-stop and while winded, and costs nothing.
- **On a pad** the chords are thumb-on-A with the index fingers on the triggers and bumper (RT, RB, LT), which is why Alt is A. The one slot the pad cannot chord is X (under the same thumb), so stepping forward is on Ability 1 only on the keyboard; on a pad, plan to move it to a trigger chord or give it a bumper once we know how it plays. Stepping back has no pad binding yet.
- **The row over the shaman** shows what each button does right now: a square per button with the totem's colour and letter, dim when it cannot be done yet (stamina, the plant gap, a herd's cooldown), a white pip on a kind that is already standing, and a white bar over the row while Alt is held. In the Alt bank the first square is the selected extra and the step button shows an arrow with a chip of the extra it would select next. So the bank in use and the selection are always visible.
- Growth: the tree adds extras (the selection list gets longer, not the button count), and a second Alt layer if the core needs to grow.

Alternatives weighed: pure one-button-per-action (the previous prototype: instant, but no room); pure cycle (scales, but slow to react, and queue management); a swap ring for every plant (too slow); a smart auto-pick (opaque). The hybrid is the one to feel-test against the pure schemes.

## Scaling: more than four powers

The four buttons stay; **what is slotted** grows. Tree nodes (see [04](04-classes-progression.md)) add:

| Axis | Examples |
|---|---|
| **More totems** | 15 to 20 kinds, each a `TotemDef` |
| **More slots** | A second Alt layer, or chords, so the loadout can hold more than eight actions |
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

This is where "scale all characters via skill trees" lands, and the loadout is the template:

- Every class has **slots** (Basic, Special, Nova, Dodge, and for the shaman a bank of eight actions). **What fills a slot comes from the tree** (`Grant`: ability ids, perk ids, slot counts).
- A totem is plain data: `TotemDef { element, pulse, beat, hp, radius, lifetime }`. The pulse reuses the `Special`/`ShotDef` skill data and the element table of [16](16-skills-and-elements.md) **with a hero as the caster**, so this class and the "hero skills" work in 16 are the same work.
- The warrior's slots could hold combo finishers; the mage's, spell mutations. One shape, many classes.

## What it needs from the code

1. **Mob statuses.** [16](16-skills-and-elements.md) notes mobs have no slow, root or burn (`elementHit` is written against heroes). Ember, Stone and Storm need the monster-victim half. This is the largest piece and is shared with hero skills generally.
2. **A hero-owned totem entity** (owner, HP, beat timer, kind), targetable by mobs, with damage credited to the owner (`sim/entities.ts`, `sim/step.ts`).
3. **A `totems?` branch on `ClassDef`** beside `quake` and `rain`, replacing the combo as `shot` does for ranged classes (`data/classes.ts`). The class order is shared with `data/heroLook.ts` and `render/hero.ts`.
4. **Input and UI:** the camp loadout screen (assign kinds to slots) and the action row over the hero ([06](06-ui.md)).
5. **Art:** a shaman sprite and set, totem sprites and ring draw ([13](13-ui-art.md)).
6. **Balance:** sim tests against `CLASSIC_MOBS`. The scripted bot plays head-on and barely moves, which suits a plant-and-hold class badly (as with the rogue and archer), so trust the skill-graded players of [14](14-ai-playtesting.md) over it.

Balance target: worse than the warrior's damage when played badly, better when played well. A pure-Ember shaman that never moves out-damages the warrior on a stationary crowd and falls behind against fast mobs and bosses that walk through the rings.

## Build order

1. Done: the playable prototype (four totems with real effects, Gale and Gather, one button per action).
2. Mob statuses (burn, slow, root), in parallel.
3. The four starting totems and the four buttons.
4. The generic slot data shape, so the tree is not shaman-only.
5. Tree nodes, boons, mutations, links.

## Open questions

- **Can mobs kill totems?** Leaning yes, with generous HP; the risk is frustration if totems die in two hits.
- **Solo viability.** Assumed yes (totems carry a whole run); confirm with playtests.
- **Aim.** Is the hold-to-lob worth its complexity?
- **Cap rule.** One live per kind versus a total cap of 3: leaning per-kind.
- **Pool size.** How many totems at launch of the tree, and how many of the eight slots a new character has filled.

## Prototype (built)

What exists:

- **Class:** `shaman` is class 5 (`data/classes.ts`, `ClassDef.totems` = `{ plain, alt, cooldown, reach }`). Art is generated like every hero (feather headdress, totem staff, totem bag: `render/heroKit.ts`); story voices and road reactions borrow the cleric's until the shaman has writing of their own. Base stats: 70 HP, speed 1.5, the warrior's stamina.
- **Sim:** `sim/totems.ts`. Totems are entities (`Kind.Totem`: `sub` kind, `by` owner, `rem` ticks left, `cool` ticks to the beat, `atk` bite cooldown), so the entity hash covers them. `bagInput` turns a press into a pending action (`PlayerState.bufPlant` code, `plantT` ticks remembered); `step.ts` runs it when the stamina and the gap allow. **Taunt reuses the quest captive's "lure" path**: `tauntOf` gives the mob AI a totem to aim at instead of the nearest hero, and a melee strike on it calls `biteTotem` where a captive's calls `biteCaptive`. The Cannon's fireball is a player projectile with `CANNON_FLAG` (8), resolved against `CANNON_SHOT` by `shotOf`, so it splashes, credits its owner and draws like the mage's. Ember uses `damageMob` with `PROC`.
- **Input:** `Btn.Alt` (held): keyboard E / `=`, pad A. With Alt held the Dodge press is the fourth action, not a roll. `Btn.Swap` (Q / `-`) steps the extra selection back. `PlayerState.pick` is the selected extra (an index into `ClassDef.totems.extras`).
- **Render:** `render/totems.ts`: the post, its ring (a burning or mending ring at its radius; a faint dotted ring for the Stone's reach; a small ring for the Cannon), a health bar once hurt, a blink in the last two seconds; and the action row over the shaman.
- **Dev:** `?class=shaman` (a name or an index) plays slot 0 as that class in an entered-seed run, e.g. `?mute=1&seed=5&class=shaman&tutorial=0`. The scripted bot plants in a cycle whenever a mob is close. The tutorial passes the two ability steps at once for a hero who plants.
- **Tests:** `sim/totems.test.ts`: each button plants its totem; one per kind (moving and mending); stamina, the gap and the buffer; Alt-dodge is Gale and not a roll; Ember's ring and the credit; the Stone holds a mob away from a far hero and is bitten; a broken or expired totem; the Cannon's kill; the Spirit's heal (hero and Stone); Gale and Gather move mobs and never hurt them; deterministic replay.

Not yet: the camp loadout screen, a pad binding for stepping the selection, any totem beyond the five, the shaman's special (Spirit Call) and nova, mob statuses (slow, root, burn), sound, and real art. Numbers are first guesses: the first things to feel are whether the Stone holds a crowd long enough to matter, whether the Cannon and Ember kill fast enough to feel like a party member, and whether Gather and Gale feel like steering or like noise.
