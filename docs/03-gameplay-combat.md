# 03 — Gameplay & Combat

## Moment-to-moment

Side-scrolling horde battler on a wide battlefield. Heroes are small and the field is deep; players move in 8 directions across the field while hundreds of enemies close in. **Area-of-effect is the main verb**: every class's kit is built around clearing groups (cleave arcs, novas, projectiles that pierce, ground effects), not single-target duels. The original beat-'em-up lane model still applies (x along the field, y across its depth). Players move in 8 directions (left/right plus up/down across lanes), jump, attack, use abilities, dodge, and interact.

### Controls (logical actions)

| Action | Notes |
|---|---|
| Move | 8-way; lane movement on Y |
| Jump | Z axis; air attacks |
| Attack | Light combo chain (class-defined), directional variants |
| Ability 1 / 2 | Class abilities, cooldown- or resource-based. Mappable slots; swap via contextual UI |
| Dodge/Block | Class-dependent (roll, block, blink) |
| Interact | Pick up / hand over / open |
| Item quick-use | Uses the "ready" consumable |
| Swap (hold) | Opens the near-character swap ring; game continues |

Physical bindings live in [09](09-input-audio-assets.md). The sim only sees logical `InputFrame`s.

## Combat model

- **Hitboxes and hurtboxes** are AABBs in (x, y-lane-thickness, z) space. A hit needs overlap on all three axes; lane thickness is small (~±8 px) so you must line up with enemies.
- Attacks have **startup / active / recovery** frames, defined in data per animation.
- **Hit-stop** (2–6 ticks) on hit, scaled by attack weight. **Knockback** and **launch** (z velocity) enable juggles.
- **Status effects:** burn, freeze/chill, poison, stun, slow, bleed, shield, haste, taunt. Stack rules are data-driven.
- **Damage types:** physical, fire, ice, lightning, holy, shadow. Enemies have resistances/weaknesses. Keep the list short so it's readable.
- **Basic attack = a sweep, not a poke.** Design rule: a basic strike must feel like a small nova, because against a horde, hitting 3 enemies feels like nothing. The warrior's 3-hit combo is built on three levers: **mass**, **motion** and **spectacle**.
  - *Mass:* hits 1–2 are wide sweeps (up to ~180° ahead, reach ~40 px) that one-shot goblins. Hit 3 is a heavy finisher (~240° arc, bigger damage) that **breaks shields** and also cuts a **straight wave ~120 px down the facing line**, so it carves a lane through the horde. Swings are deliberately slower (21/42 tick cooldowns): fewer, heavier blows.
  - *Motion:* knockback is strong (a goblin is shoved ~30 px). Mobs that survive a blow and slide fast **bowl into others**, damaging and launching them (credit goes to the original attacker), so a hit ripples outward. Mobs that die are **launched as tumbling bodies** in the direction of the blow and land as corpses. The hero **lunges** forward a few pixels on each swing.
  - *Spectacle:* a bold slash arc with a bright blade edge sweeps through the swing; the camera kicks along the swing direction (harder on the finisher); screen shake scales with how many enemies were hit; hit-stop grows with the number of hits.
  - Each cleave that connects builds **fury**.
- **Fury loop (warrior):** cleaving and killing build fury (and taking hits does too: pain feeds rage). **Nova** (ability) costs 50 fury and pierces shields; casting it at **100 fury** unleashes a bigger, harder nova. Aggression feeds the AoE, and the AoE clears space for more aggression. Kills also heal a little.
- **Dash:** brief invulnerable burst that plows through small mobs (light damage + knockback). Short cooldown; the answer to telegraphs.
- **Hit-stop:** a sim-level global freeze (1 tick on a normal hit, 3–4 on finisher/nova, scaling with kills) gives hits weight. Button presses are still buffered during the freeze.
- **Attack animation:** every mob telegraphs visibly: a lean back and a raised weapon (goblin dagger, orc axe) during the windup, a lunge and weapon swing on the strike, a drawn bow with a nocked arrow and aim line for archers, a swelling, shaking fuse for bombers, and a shield bash. Mobs waiting out a cooldown beside you hop restlessly instead of standing still.
- **Telegraph interrupts:** hits cancel an enemy's windup (not a lit bomber's fuse), so aggressive play is rewarded; stepping out of range dodges a strike.
- **Forward-only battlefield:** the camera never scrolls back and the hero cannot leave the screen to the left, so cleared ground **stays cleared**. Reinforcements come only from *ahead* (just off the right edge) whenever too few mobs are awake, so there are no lulls, and nothing spawns behind you. Mobs that never engaged are removed once they fall ~90 px behind the left edge; engaged mobs get ~360 px to rejoin, so a mob knocked or flanking offscreen still comes back and attacks. Archers never shoot from offscreen: they walk back into view first.

### Enemy roster (v0)

| Enemy | Role | The question it asks |
|---|---|---|
| Goblin | Fodder, fast | Fuel for fury; arrives in waves |
| Orc | Slow brute, big telegraphed smash | Interrupt it, dash out, or nova it down |
| Archer | Ranged, keeps its distance, red aim line then a dodgeable arrow | Close in, dash the line, or swat arrows out of the air with a cleave/nova |
| Shield bearer | Blocks frontal non-piercing hits | Use the finisher, nova, or get behind it |
| Bomber | Fast, explodes on a short fuse | Kill it *away from you*, or into a pack: its blast chain-kills nearby mobs and credits you |

Use `npm run playtest` to run a scripted bot over several seeds for balance sanity (win/lose, kills, minimum HP).
- **Friendly fire:** Default **off for damage, on for knockback/status that is explicitly "area"**? (Open question; see [open-questions](open-questions.md).) Proposed: off for damage, but players can be *pushed* by allies' heavy hits for comedy/utility. Configurable per run as a modifier.

## Enemies

- **Archetypes:** grunt (melee), brute (slow, high HP, armor), skirmisher (fast, hit-and-run), ranged (archer/caster), summoner, shielded, flyer, swarm.
- **AI:** cheap per-mob behaviors, run for hundreds at a time: idle until aggro'd (by proximity or because a neighbour was), then chase the nearest standing player, separate from neighbours via the spatial grid, stop at attack reach, attack on a cooldown. Aggro spreads through a clump so a pack wakes up as a wave. Because enemies are numerous and individually weak, readability comes from **scale and silhouette**, not telegraph-per-enemy; elites, ranged units and bosses still get explicit windups. An attack-token system is deferred until ranged/elite enemies need it.
- **Telegraphs:** every damaging enemy attack has a clear windup and a visible shape/flash. Readability beats difficulty.
- **Elites/Mini-bosses:** modifiers (e.g. *Frenzied, Shielded, Vampiric, Splitting*) drawn from a pool and applied at generation time.
- **Scaling:** enemy count and HP scale by **player count** and **depth**; XP rewards scale to keep leveling pace constant regardless of party size.

## Bosses

- One boss per biome end, plus optional mini-bosses mid-biome.
- Multi-phase with distinct patterns; patterns are named sim functions referenced from data.
- Co-op friendly: bosses have arena-wide attacks that require spacing, and **revive windows** on player downs.

## Co-op rules

- **Shared screen, tethered camera.** Players can't leave the screen. If one lags, the camera waits within a limit, then gently pulls the straggler (a "rubber-band" that does damage-free teleport after N seconds).
- **Downed & revive:** at 0 HP a player goes down for ~10 s; allies revive by holding Interact. If all are down, the run ends. Revive count per run is limited (rises with meta unlocks).
- **Shared resources:** gold is shared; XP is individual but with a **catch-up bonus** for lower-level players so a revived/late player doesn't fall behind.
- **Drop-in/drop-out:** a player can join at a checkpoint/campfire room mid-run, starting at the party's average level.
- **Difficulty scaling** by party size is automatic (see enemies).

## Run flow

```
Hub (meta) → choose class(es) + modifiers → Run:
  Biome 1: room, room, room, ..., mini-boss, Rest room
  Biome 2: ...
  ...
  Final boss → Victory / Defeat → Renown payout → Hub
```

**Rest rooms:** campfire/shop-like safe rooms with no menus that pause the game: you walk to things (a merchant NPC, a shrine, a forge) and interact with in-world prompts. Details in [06](06-ui.md).

## Death & failure

- Run ends when all players are down simultaneously.
- You keep: renown, any meta unlocks, discovered items (codex). You lose: items, in-run levels, gold.
- No permadeath of *characters* across runs; the *run* is the unit of risk.
