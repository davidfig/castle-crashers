# 0005 — Horde-scale battlefield presentation
Status: Accepted
Date: 2026-10-05

## Context
The original concept leaned toward Castle Crashers: large, detailed characters in small arenas. The desired experience is different: tiny heroes on large battlefield-like levels, moving left to right through **hundreds of enemies on screen at once**, with AoE abilities to make progress.

## Decision
- Internal resolution is **640×360**. Heroes are ~10–16 px tall, common mobs ~8 px, brutes ~12–14 px, bosses 32–64 px.
- Gameplay is AoE-first. Basic attacks are arcs, abilities are radial/line/zone effects.
- Target: **1,500+ simultaneously active mobs** at 60 FPS on a mid-range laptop.
- Entity storage is struct-of-arrays typed arrays with a free-list; enemy spatial queries use a uniform grid rebuilt every tick; rendering uses a single instanced sprite batcher. No per-entity allocations in the tick.
- Individual mob readability is traded for crowd readability; telegraphs are reserved for elites, ranged units and bosses.

## Consequences
- Art is cheaper per sprite (small), so more variety is feasible; silhouettes and color carry identity.
- Sim performance is a first-class constraint: new systems must be O(n) or use the grid.
- UI anchored to characters must stay tiny and legible at this scale (see [06](../06-ui.md)).
- Balance centers on crowd density and AoE reach rather than single-target DPS.
