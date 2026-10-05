# 07 — Procedural Generation

Every run is built from a **run seed**. All generation uses seeded, independent RNG streams derived from it, so a run can be reproduced exactly (and shared as a seed string).

```
runSeed ──► split ─► streams: map, rooms, enemies, loot, events, combat, cosmetic
```

Changing how a stream is consumed (e.g. loot) must not shift unrelated streams (e.g. room layout). Always derive per-room sub-seeds as `hash(runSeed, 'room', roomIndex)`.

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
