# 04 — Classes & Progression

Progression has **two layers**:

1. **In-run:** XP → levels → pick an upgrade. Items found. Resets every run.
2. **Meta:** *Renown* earned per run → spend it to unlock nodes on each class's **class tree**. Persists forever.

The link between them: meta unlocks **expand what you can be offered during a run**. They don't hand you stats directly (mostly). This keeps runs feeling fresh and keeps new players from being locked out by raw power.

## Classes (v1 target roster)

| Class | Role | Core fantasy | Signature mechanic (proposed) |
|---|---|---|---|
| **Warrior** | Frontline tank/bruiser | Hold the line | *Fury* built by cleaving, killing and being hit; spent on an AoE nova (bigger at full). *Stamina* funds swings, dashes and the big-swing special |
| **Mage** | Ranged AoE glass cannon | Elemental destruction | Mana + element attunement (fire/ice/lightning) switching |
| **Cleric** | Support/healer, light melee | Keep everyone alive | Holy *Favor* resource; healing aura, revive speed, smite |
| **Rogue** | Fast melee burst | Hit and vanish | Combo points, stealth/backstab, dodge-through |
| **Archer** | Ranged single-target/kiting | Precision from afar | Charged shots, trap placement, weak-point hits |
| *(later)* **Paladin, Druid, Necromancer, Bard** | | | See "Future classes" |

Each class defines (in `src/data/classes/`): base stats, light-attack chain, dodge/block, 2 starting abilities, resource type, sprite set, palette rows, and a class tree.

### What each class is best at

Each class owns one thing the others cannot match; a kit that does not reinforce it is a bug.

| Class | Excels at | How (in `src/data/classes.ts` / `sim/step.ts`) |
|---|---|---|
| Warrior | Holding the line | Most HP, the shoulder-charge plows a lane, the quake shoves a whole column back |
| Mage | Crowds (area damage) | A big splash fireball (40 stamina a shot) and a lobbed fireball special that arcs over the front line and bursts where it lands |
| Cleric | Keeping the party alive | Heal pulse on the dodge, healing nova, point-blank aura |
| **Rogue** | Single-target burst by flanking | Hidden from the moment he is up (mobs ignore him) until he attacks, is hurt, or a mob runs into him; then he waits `hideCooldown` ticks (240) to hide again. The strike out of hiding is an `ambush` ×6 sweep, 1.8× the reach and a wide arc, over everything in front of him; `backstab` ×2.5 on a mob facing away. Front-on and seen he is no better than the warrior. His dodge is a plain roll |
| **Archer** | Safe damage from range | `longShot`: arrows gain up to +120% damage over their flight, so full-range shots hit ×2.2. Piercing volley; rain of arrows for zones |

### Stats

Keep small and legible: **Vitality** (HP), **Strength** (physical dmg), **Magic** (spell dmg/heal), **Agility** (speed, crit, dodge), **Defense** (damage reduction), plus a derived **Luck** hook for drops. Classes weight stats differently; items modify them.

## In-run progression

- Kill enemies / clear rooms → XP. Level cap per run (proposed **~20**).
- Each **level-up** offers **3 choices** drawn from the pool of everything *you've unlocked in your class tree* plus generic perks. Pick one; it applies instantly.
  - **Non-blocking:** a level-up is a pending pick. The player opens it with the Level button, into their lane of the sky band at the top of the screen, when they choose; gameplay continues. Unchosen offers never expire: they wait, and are resolved at the camp between levels at the latest. See [06 UI](06-ui.md).
- Choices come in kinds:
  - **Ability unlock/upgrade** (new ability, or +rank to an existing one)
  - **Passive** (stat or trigger-based: "crits explode", "dodging leaves frost")
  - **Mutation** (changes how an ability works: pierce, bounce, split, element swap)
- Rarity-weighted offers so builds *emerge*. Synergy tags (e.g. `fire`, `projectile`, `holy`, `melee`) bias offers toward what you already have, with some chance of a wild card.
- **Ability slots:** a small number of active slots (proposed 4: 2 class + 2 free). Extra abilities go to a "bench" and can be swapped in on the fly via the near-character swap ring.

### Boons and the trigger framework (built)

Upgrades are being turned from stat ranks into **boons** that change what happens (`kind: 'trigger'` in `src/data/upgrades.ts`; the stat ones stay as the plain filler). The sim calls `onKill`, `onHit`, `onDodge` and `onHurt` (`src/sim/boons.ts`) where those happen. A trigger never acts mid-fight: it queues an effect (a burst, an arc to neighbours, a shockwave) that `flushProcs` resolves after the tick's blows, so chain reactions never nest. A per-tick budget (`PROC_BUDGET`) caps a boon-heavy horde, effect damage carries the `PROC` flag so it does not set off hit triggers again, and `boonCd` holds per-boon cooldowns (hashed). Four boons prove it: Chain Spark (hits arc), Bloodlust (kills give stamina back), Farewell (a dodge blasts where you were), Last Stand (a low-health shockwave). Phase 2 added three more generic ones (Shatter: the special bursts around you; Blood Tithe: every 10th kill heals; Executioner: more damage to the wounded) and the first **class-restricted** boons (`classes` on the upgrade; `offerFor` takes the hero's class): Warrior's Split Earth (the quake forks into lanes) and Iron Recoil (being hit shoves foes), Mage's Twin Flame (extra fanned shots, also the archer's), Echo Blast (blasts go off twice) and Quicksilver (a blink refills fury and the first ability). The rest of the roster has its own: **Cleric** Radiance (the aura mends the party), Holy Wrath (the heal pulse also smites), Vigil (a cleric nearby speeds up revives); **Rogue** Death Dance (a kill from hiding refunds the dodge's stamina), Keen Edge (bigger flank multipliers), Pickpocket (flank hits steal gold); **Archer** Eagle Eye (long shots hit harder), Downpour (more arrows in the rain), Arrow Ring (a dodge looses a ring of arrows). **Offers** (`offerFor`): each card has a tier (common, rare, legendary; stats are common, triggers rare) that sets its weight and its border (steel, lapis, gold). Stats thin out and rares grow with the level. A candidate is likelier for each tag it shares with what the hero holds (+100% per tag, up to three) and for a boon already held (+50%), so builds deepen. The first card is always a trigger and the last is a wildcard drawn without the synergy bias; the guaranteed one lands in a random position. **Feedback (Phase 4):** every upgrade has its own 16x16 picture (`src/render/boonIcons.ts`, named `boon-<id>`: a themed enamel disc with a 10x10 symbol; the card, the camp's picks and the merchant use them); the level-up card shows the picture, rank, name, two lines of text and its first tags (triggers in lilac); each hero's boons sit as a row of badges (rank in the corner) under their level-up pill; and when a trigger fires the sim emits `Ev.Proc` and the picture pops and rises over the hero (`Fx` pops, once per boon per moment, so a chain reaction is one picture). Dev aid: `?boons=spark:2,lust&pending=2` gives every hero boons and waiting picks in a run. **Party and legendary boons (Phase 5):** *War Banner* (allies within 90 px, the bearer included, hit +12% per rank) and *Warding* (they take -10%) work alone too; *Martyr* (falling heals allies near you and sends a shockwave) and *Avenger* (an ally falls: your fury, stamina and cooldowns refill) need company, so `offerFor` leaves them out for a solo hero (`ctx.party`). Three **legendaries** (gold border, rare): *Glass Fang* (2x damage dealt, 1.5x taken), *Phoenix* (the first fall each level instead rises at half health in a burst of flame), *Frenzy* (attack cooldowns 50% faster). A boon can name a class-tree node in `unlock`; `offerFor` takes `ctx.unlocked` (the character's unlocked node ids) and leaves out anything not in it. While the tree does not exist the game passes nothing and everything is in the pool; when it does, the legendaries open with node `legend`, and any boon can be gated the same way. Still to do: sound (the game has no audio yet), rerolls, companions, legendaries, tag-weighted offers, trigger visuals, and a UI that shows tags.

### Ability scaling

The basic attack and the special each have four **tracks** a hero can raise up to four times each, in any mix (`src/sim/abilityMods.ts`; eight boons, `bsize`..`bpower` and `ssize`..`spower`; the card reads in that class's own words, `cardFor`):

| Track | Melee (warrior, rogue) | Aura (cleric) | Ranged (mage fireball, archer arrow) |
|---|---|---|---|
| Size | reach +12% a rank (the wave too) | radius +12% | blast and hit radius +25% |
| Count | the arc opens 0.3 wider (to all round); a special's wave forks into a pair of extra lanes | (not offered) | +1 shot fanned (the archer's special fan: +2) |
| Speed | recovers 8% quicker (a special's cooldown too) | pulses 8% quicker | shots fly 20% faster (so also farther) |
| Power | +20% damage | +20% | +20% |

Each rank also raises the **cost** of that ability (size +12%, count +20%, speed +8%, power +12% of the base cost per rank), so a hero who stacks every track pays about 3x, and a hero who cannot afford the dearer cost cannot cast it (the mage's mana is his stamina).

The **nova** (ability 1, paid in fury: the warrior's quake, the mage's, cleric's and rogue's radial nova, the archer's rain) and the **dodge** (paid in stamina) scale the same way, with eight more boons (`nsize`..`npower`, `dsize`..`dpower`):

| Track | Nova | Dodge |
|---|---|---|
| Size | radius +12% (quake: length and width; rain: radius) | reach +15%: roll and charge distance, blink distance, vanish time, plow and heal radius |
| Count | an echo pulse 12 ticks later at 60% strength (quake: two more lanes; rain: +8 arrows) | one more dodge straight after the first (an 8-tick gap), once per burst |
| Speed | recovers 8% quicker (to half) | the cooldown 10% shorter (to 40%) |
| Power | +20% damage (and the cleric's healing) | +25% charge damage or heal; a blink, vanish or plain roll leaves a blast where it began |

A nova's rank is half as dear as a stamina ability's (+6% / +10% / +4% / +6% fury, never more than a full bar, which always casts the big one): it is a crowd-breaker that only fighting fills, and at full price the bot's mage was worse for every rank. The dodge's rank costs stamina at the full rate.

### Checking boons (Phase 6)

- `npm test`: each hook has a test (`src/sim/boons.test.ts`), plus a stress test that gives two heroes every boon at top rank, on every class, plays 1,500 ticks with the bot, and asserts the run replays to the same hash, nothing goes non-finite, and the boon queues drain every tick (it found a real bug: effects queued by an end-of-tick blast were left over until the next tick; `step` now settles both queues before the tick ends).
- `npm run playtest -- --class=1 --boons=spark:2,lust:1` plays a build; `npm run playtest -- --sweep` plays every boon at top rank against its class's bare run (mean of N seeds) and flags the ones that are `STRONG` (+12 points of progress) or `INERT` (the bot's run is identical, so it never gave the boon a chance). It also times all boons at once against none over the same 1,200 ticks: about 50 us a tick, negligible.
- (The scripted bot is the blunt instrument; the skill-graded players of [14](14-ai-playtesting.md) dodge, kite, flank and choose cards, and play each class to its strengths.) What the bot can and cannot tell you: it plays head-on and rarely dodges, so Rogue's flank boons, Farewell, Quicksilver, Arrow Ring and the cleric's boons come out inert, and its death point sits at the first gate (about 36% of the field), which makes progress a coarse measure (kills and time survived say more). It is good for catching outliers and crashes, not for fine balance; that needs real playtesters.
- First sweep: Powder Kegs (kills burst into blasts) at rank 3 tripled a warrior's kills (the clear outlier, from chains of bursts), so it is now 18% to 30% of kills bursting for 4.5 to 7.5 damage in a 26 to 34 px ring, down from 35% to 55% for 8 to 12 in 32 to 44 px. It still snowballed in long runs, so it has been **removed**. Twin Flame is the best archer boon (the weakest class bare). Nothing is slow, and nothing the bot could exercise hurts.

## Meta progression: Renown & class trees

### Renown

- Earned at end of every run (win or lose): from rooms cleared, bosses killed, challenges completed, distance reached, party achievements.
- **Renown belongs to a character, not the account** (Decided, ADR-0004). A **character** is a saved instance of a class: it has a name, its own renown balance, and its own class-tree progress.
- You can create **multiple characters of the same class** (e.g. two Warriors: one grown as a Guardian, one as a Berserker) to try different builds in parallel. Each progresses independently; renown never moves between characters.
- A run is played *by* characters. The party picks existing characters (or creates new ones) at the hub. Two players may bring same-class characters.
- Account-level data (codex, settings, achievements, cosmetics unlocked globally) is shared; only renown and tree progress are per character.
- Open: character slot limit, and whether a character can be retired/deleted (see [open-questions](open-questions.md)).

### Class tree

- A node graph per class (3–4 branches, ~25–40 nodes). Branches map to sub-identities, e.g. Warrior: **Guardian / Berserker / Warlord**; Mage: **Pyromancer / Cryomancer / Stormcaller**.
- Node types:
  - **Unlock:** adds abilities/mutations/passives to the in-run offer pool.
  - **Slot/Capacity:** extra bench slot, extra revive, extra starting item choice.
  - **Starting kit:** begin runs with a particular weapon or consumable.
  - **Keystone:** a build-defining rule change (rare, 1–2 per branch).
  - **Cosmetic/lore:** skins, titles, codex entries. Cheap and fun.
- Tree shape is *prerequisite-gated* (adjacent unlock), so players choose a direction.
- **Focus toggling is free** between runs: the tree is a *loadout* of what's **active**, plus a *collection* of what's **unlocked**. Unlocked nodes cost renown once; you may toggle which branches feed your offer pool (up to a "focus" cap). Because builds are explored via separate characters, there is no full respec; focus toggling is a light steering tool, not a way to undo spending.
- "Unlocks as you work through the game": some nodes are gated by **in-game achievements** (beat boss X with the class, finish a run without dodging) rather than just renown, so the tree doubles as a goals list.

### Data shape (sketch)

```ts
interface ClassTreeNode {
  id: string;
  classId: string;
  branch: string;
  kind: 'unlock' | 'capacity' | 'startingKit' | 'keystone' | 'cosmetic';
  cost: number;                 // renown
  requires: string[];           // prerequisite node ids
  achievement?: string;         // optional gating condition id
  grants: Grant[];              // ability ids, perk ids, slot counts, etc.
}
```

## Pacing targets (starting numbers)

- First run: reach level ~6–8, earn enough renown for 1–2 early nodes.
- A class's full tree: ~15–25 runs of play.
- Level-up cadence in run: roughly every 90–120 seconds early, slowing later.

## Future classes

Paladin (tank/healer hybrid), Druid (shapeshift), Necromancer (minions), Bard (party buffs). Each new class must bring a **distinct resource** and a **distinct party role** to be worth adding.
