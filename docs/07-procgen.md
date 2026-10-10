# 07 — Procedural Generation

Every run is built from a **run seed**. All generation uses seeded, independent RNG streams derived from it, so a run can be reproduced exactly (and shared as a seed string).

```
runSeed ──► split ─► streams: map, rooms, enemies, loot, events, combat, cosmetic, story
```

Changing how a stream is consumed (e.g. loot) must not shift unrelated streams (e.g. room layout). Always derive per-room sub-seeds as `hash(runSeed, 'room', roomIndex)`. The `story` stream generates the run's Clan, Writ text and Witness vignette fills; see [12 Story](12-story.md).

## Run structure

```
Run
 ├─ Biome 1 (e.g. Forest Road)
 │    ├─ Node graph of encounters (branching path)
 │    └─ Boss
 ├─ Biome 2 (Haunted Keep)
 ...
 └─ Final Biome → Final Boss
```

- **Biome order** is chosen from a pool (some fixed final).
- Each biome is a short **node graph** (Slay-the-Spire-style forks) with 5–8 steps. Players see node *types* (not exact content) and the party picks a direction by walking through a **fork door** in the world (no map menu; a small signpost/UI shows icons near the doors).

### The camp (between levels)

The fork and the camp are not the same thing. Between levels the party stops at a **camp**: the one place in a run where the action stops and menus are allowed (the rule that nothing pauses applies *during* levels). All players are on one screen with a panel each, and ready up when finished. In order:

1. **Spoils.** Heads, spared, gold, XP, and the story: the Registrar's remark, aftermath scenes ([12](12-story.md)).
2. **Leftover picks.** Any level-up the player did not choose during the level ([06](06-ui.md)). Simultaneous per player.
3. **Merchant or fire**, by the node type: a shop (shared gold, hand-over between players) or a rest (heal, revive, class banter).
4. **The doors.** The crossroads: the party walks through one of two or three doors, each with an icon for what lies behind it, with a thin strip showing the route so far. No separate map screen. Forks between biomes are the big choices; within a biome the doors choose the next node type.

**Implemented (v0).** A campaign run is a route of two levels (`ROUTE_LEVELS` in `src/campaign/route.ts`) with one camp between them. Level 1 has no boss and is won by reaching the far end; the last level ends in the boss. At the camp: the spoils; then, if anyone has a pick waiting, a panel per player (attack / ability 1 / ability 2 choose a card, the Level button keeps the rest for later; simultaneous, read per player slot); then the doors, two roads into different biomes, chosen with left/right and attack. The party rests to full health on the way through. What the party carries into the next level (`src/sim/carry.ts`): class, level, XP, pending picks, upgrade ranks, health, gold, and the run's tallies (so the run summary covers the whole route). Offers are drawn from the *run* seed, so a pick offers the same cards at the camp as it did in the level. Entered-seed runs are one level unless `?levels=N`. **The merchant (v0):** after the picks, a peddler's stock for the camp: three different upgrade scrolls and the Veterans Lesson (+1 level, with a pick to make), drawn from the run seed and priced up the deeper the route goes (`src/data/wares.ts`). Gold is the party's shared purse. The goods lie on the ground in front of the peddler's stall with their prices beside them; a hero who walks up to one and presses the trade button buys it for themselves, and each good is one-of-a-kind, so the first there gets it. There is no menu. Not yet: rest as a choice, node types beyond a battle, a fork with more than two roads, and walking through the doors instead of choosing from a screen.

**Dev shortcut.** `?camp=spoils|picks|doors` goes straight to that part of the camp after a won first level, with no need to play the level. Optional: `&players=N` (1-4, classes in order), `&class=N` (the first hero's class), `&gold=N`, `&pending=N` (level-ups waiting per hero), `&level=N`, `&kills=N`, `&chapter=N` (the wording of the story). For example `/?store=1&players=3&gold=300`.

### Node types

| Type | Description |
|---|---|
| Combat | Standard arena-style or corridor fight |
| Elite | Tougher enemies with modifiers, better loot |
| Treasure | Chests, traps, mimics |
| Merchant | Spend shared gold |
| Shrine | Risk/reward: buff, curse, sacrifice, reroll |
| Event | Small scripted vignette with choices (via world interactions) |
| Rest | Campfire: heal, swap class gear, drop-in a new player |
| Mini-boss / Boss | Biome capstone |

## Room generation

Rooms are horizontally scrolling **strips** (with some vertical/depth variation), assembled from hand-authored pieces + procedural dressing. We *don't* generate pure noise; we generate **layouts from handcrafted chunks** with parameter variation.

1. **Pick a template** for the node type and biome (e.g. "wide arena", "corridor with ambush", "bridge", "multi-tier courtyard").
2. **Assemble chunks** left to right from the biome's chunk library, matching connector heights/edges.
3. **Place encounters:** define *spawn waves* with triggers (enter zone, kill count, timer). Each wave pulls from the biome's enemy pool using a **budget system**:
   - `roomBudget = f(depth, playerCount, nodeType)`
   - Each enemy has a `cost`; fill waves to budget respecting role caps (not all ranged, at least one frontline, etc.).
4. **Place props/breakables/loot** using weighted tables and distance-from-path rules.
5. **Dress** with parallax set + decoration scatter (seeded, cosmetic stream).
6. **Validate:** reachability, no unwinnable blocking, spawn points not inside geometry, minimum player space. Retry with a derived seed on failure.

### Tilemap/collision

- Tile size 16×16 px. Collision is mostly **ground-plane polygons/lane bounds** + a small number of obstacle tiles (walls, pits). Beat-'em-up depth lanes mean we don't need full 2D platforming collision.
- Hazards (pits, spikes, fire jets) are entities placed by the chunk, activated by timers.

## Enemy & modifier selection

- Biome defines pools by tier. Depth unlocks higher tiers.
- **Run modifiers** (chosen in hub or randomly from shrines): "Glass cannons" (everyone takes more dmg), "Swarm" (more, weaker enemies), "Cursed loot", etc. They stack into a single `RunConfig` that feeds generators.
- **Elite modifiers** assigned from a pool by the enemy stream.

## Loot generation

- Loot tables by source (enemy, chest, boss). Rolled with the **loot stream** when the source dies/opens (not at room gen), so "reroll" and player-driven randomness don't desync the rest of the run.
- Pity counters & anti-duplicate rules in state (deterministic).

## Level-up offer generation

Uses a per-player **offer stream**, seeded by `(runSeed, playerSlot, levelNumber)`. This keeps offers stable across pause/resume or desync recovery.

## Seeds & sharing

- Seed is displayed in the run-end screen. Hub has "Enter seed" and "Daily seed".
- The sim records `(seed, class picks, modifiers, input log)` optionally for replays.

## Authoring tools (future)

- `tools/chunk-editor` — a tiny browser tool to author chunks (can be built on our own renderer).
- Validation CLI: loads all chunks/templates, runs thousands of seeds headlessly, asserts validity & budgets.

## Streamed encounters (implemented)

The level is **planned** at the start (`planLevel(seed)`: a cheap list of ~48 encounters with position, size, shape and progress, a pure function of the seed) but **spawned lazily**: `streamLevel` spawns an encounter once the camera is within ~520 px of it, i.e. out of sight. Each encounter has its own random stream (`1000 + index`), so its contents don't depend on when it streams in; only its size does, via the party-size scale at that moment (see [03](03-gameplay-combat.md)). Streaming starts after ~2 s so players who join right away are counted, and holds back if the 4,096-entity budget is nearly full. A side benefit: only the encounters near the camera exist, so the opening has a few hundred enemies instead of ~2,200.

## Battlefield layout (implemented v0)

The current generator (`src/sim/gen/level.ts`) lays ~46 encounters along the field, thickening toward the far end. Enemies come from **every height** of the field, not just the middle:
- **Blobs** (3 of every 4 encounters): a loose cluster centered anywhere from the top edge to the bottom edge, with wide vertical spread so it spills across several lanes.
- **Lines** (every 4th): a thin vertical wall of enemies spanning the full field height, so the front arrives from all lanes at once. The final stand is two such walls.
- Reinforcements (the director) arrive from ahead (any height) or walk in over the top or bottom edge; see [03](03-gameplay-combat.md).
- A test guards the distribution (no band of the field may hold under ~12% of the level's enemies).
