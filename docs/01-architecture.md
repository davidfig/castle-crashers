# 01 — Architecture

## Dependency policy (Decided — ADR-0001)

**Zero runtime dependencies.** We write our own WebGL renderer, input, audio, math, ECS, and (later) networking layer.

Dev-time tooling is allowed and kept small:

| Tool | Why |
|---|---|
| `typescript` | Language |
| `esbuild` (or `vite`) | Bundling and dev server |
| `vitest` | Unit tests for the simulation (optional, dev-only) |

Anything else needs an ADR. Tools that generate assets at build time (e.g. sprite atlas packer) should be our own small scripts in `tools/`.

## Core principle: deterministic simulation, separate from rendering

```
 input devices ──► InputFrame[] ──► Sim.step(state, inputs, dt=1/60) ──► state
                                                                          │
                                                          Renderer.draw(state, alpha)
```

- The **simulation** is a pure-ish function of `(state, inputs)`. It never touches the DOM, WebGL, Web Audio, `Math.random`, `Date.now`, or `performance.now`.
- The **renderer** reads state and interpolates between the previous and current tick. It never mutates sim state.
- **Presentation events** (sound, screen shake, particles, hit-stop visuals) are emitted by the sim into an event queue that the presentation layer consumes. The sim doesn't know whether anyone is listening.
- All randomness in the sim goes through a **seeded PRNG** stored in sim state (e.g. sfc32 or xoshiro128**), with separate streams for level gen, loot, combat, and cosmetic randomness.

This one decision buys us: replays, tests, rollback/lockstep netcode, host-authoritative netcode, "seed of the day", and bug reproduction by seed + inputs.

### Determinism caveats

JS numbers are IEEE doubles; basic ops (`+ - * /`, `Math.sqrt`) are deterministic across engines, but transcendental functions (`Math.sin`, `Math.cos`, …) are **not guaranteed** identical. Rules:
- Sim code uses our own `math/` helpers (lookup tables or polynomial approximations) instead of `Math.sin/cos/atan2/pow`.
- Positions/velocities may be floats, but iteration order must be stable (arrays in insertion order, never object key order from user data).
- No `Map`/`Set` iteration whose order depends on non-deterministic insertion.

Alternative (not chosen yet): fixed-point integers for the sim. See [open-questions](open-questions.md).

## Game loop

- Fixed timestep: **60 Hz** sim ticks, accumulator-based.
- Render at display rate via `requestAnimationFrame`, interpolating by `alpha = accumulator / dt`.
- Clamp max catch-up ticks per frame (e.g. 5) to avoid spiral of death.
- Hit-stop is implemented *in the sim* (entities skip ticks) so it's deterministic.

## Proposed source layout

```
src/
  main.ts                 entry; wires platform to game
  engine/
    ecs/                  entity-component storage, queries
    math/                 vec2, rect, fixed trig tables, easing
    rng.ts                seeded PRNG streams
    events.ts             typed sim -> presentation event queue
  platform/               everything that touches the browser
    loop.ts               fixed-step loop (uses the wall clock, so it lives here)
    gl/                   context, shaders, buffers, textures, batcher
    input/                keyboard, gamepad, device -> InputFrame
    audio/                Web Audio mixer, sfx, music
    storage/              localStorage/IndexedDB save
    net/                  transport interfaces (stubbed for now)
  sim/                    deterministic game rules (no platform imports!)
    state.ts              root GameState type
    step.ts               Sim.step
    systems/              movement, combat, ai, loot, xp, status, ...
    gen/                  procedural generation (see 07)
  data/                   classes, enemies, items, abilities as typed data
  render/                 draws GameState: world, entities, lighting, fx
  ui/                     character-anchored UI (see 06)
  meta/                   renown, class trees, profile, persistence
assets/
  sprites/ audio/ ...
tools/                    atlas packer, data validators
docs/
```

**Hard rule:** `sim/` and `data/` may not import from `platform/`, `render/`, or `ui/`. Enforce with a lint script or a tsconfig project reference.

## Entity model

Horde scale means **struct-of-arrays typed arrays** (decided; see ADR-0005): one `Float64Array`/`Uint8Array` per field, a free-list for slot reuse, and a `highWater` mark for iteration. No per-entity objects, no allocation in the tick. Mobs are looked up spatially through a uniform **spatial hash grid** rebuilt each tick (`sim/grid.ts`), which AoE abilities, separation, and chain-reaction knockback all use.

Original plan, still the direction for richer entities:
- Entities are integer IDs (index + generation).
- Components are plain typed data in struct-of-arrays or per-type dense arrays.
- Systems are functions `(world, ctx) => void` run in a fixed, explicit order each tick.
- Entity IDs in sim state must be stable and reproducible (no random IDs) so they can be referenced across a network.

## Data-driven content

Classes, abilities, enemies, items, biomes are declared as typed TS objects in `src/data/` (or JSON validated at build). Behavior that can't be expressed as data (a special boss pattern) is a named function in `sim/` referenced by id. This keeps content addition cheap and makes balance passes edit-only.

## Save data

- `Profile` (meta): renown, unlocked class-tree nodes, stats, settings. Versioned with a `schemaVersion` and migration functions.
- `RunSave` (optional): mid-run resume. Because sim is deterministic, a run can be saved as `seed + input log` or as a serialized state snapshot. Snapshot is simpler; start there.
- Storage: `localStorage` for small profile; IndexedDB if size grows.

## Testing

- Sim is unit-testable headlessly in Node. Golden tests: `seed + scripted inputs => expected state hash after N ticks`.
- A state-hash function is part of the engine (used for tests and desync detection later).
