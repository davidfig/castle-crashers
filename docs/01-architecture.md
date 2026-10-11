# 01 — Architecture

## Dependency policy (Decided — ADR-0001)

**Zero runtime dependencies.** We write our own WebGL renderer, input, audio, math, entity storage, and (later) networking layer.

Dev-time tooling is allowed and kept small:

| Tool | Why |
|---|---|
| `typescript` | Language |
| `esbuild` | Bundling (`tools/build.mjs`) and the dev server (`tools/dev.mjs`) |
| `@types/node` | Types for the Node tooling and tests (dev-only) |

Tests use the built-in `node:test` runner over esbuild bundles (`tools/test.mjs`); there is no vitest.

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
- Sim code uses our own `engine/math.ts` helpers (lookup tables or polynomial approximations) instead of `Math.sin/cos/atan2/pow`.
- Positions/velocities may be floats, but iteration order must be stable (arrays in insertion order, never object key order from user data).
- No `Map`/`Set` iteration whose order depends on non-deterministic insertion.

Alternative (not chosen yet): fixed-point integers for the sim. See [open-questions](open-questions.md).

## Game loop

- Fixed timestep: **60 Hz** sim ticks, accumulator-based.
- Render at display rate via `requestAnimationFrame`, interpolating by `alpha = accumulator / dt`.
- Clamp max catch-up ticks per frame (e.g. 5) to avoid spiral of death.
- Hit-stop is implemented *in the sim* (entities skip ticks) so it's deterministic.

## Source layout

What exists today (the original plan had `engine/ecs`, `ui/`, `meta/`, `platform/storage` and `platform/net`; see the notes after the tree):

```
src/
  main.ts                 entry; wires platform to game, modes (title, select, level, camp...)
  engine/
    math.ts               lookup-table trig (sinTurns/cosTurns), clamp, lerp
    rng.ts                seeded PRNG streams
  platform/               everything that touches the browser
    loop.ts               fixed-step loop (uses the wall clock, so it lives here)
    perf.ts               frame-time meter
    gl/                   context, shaders, instanced sprite batcher, renderer
    input/                keyboard, gamepad, device -> InputFrame
    audio/                Web Audio mixer, sfx, generative music
  sim/                    deterministic game rules (no platform imports!)
    state.ts              root GameState type
    step.ts               Sim.step
    entities.ts grid.ts   struct-of-arrays entities, spatial hash
    events.ts input.ts    typed sim -> presentation event queue; InputFrame
    hash.ts snapshot.ts   state hash; save/restore of the sim
    abilities.ts boons.ts quests.ts shop.ts sites.ts ...   rule modules called from step
    gen/                  procedural generation (see 07)
  data/                   classes, bestiary, scenery, humans, heroes, items as typed data/generators
  campaign/               the run's ledger, route, camp, board, storage (localStorage), tutorial
  ai/                     simulated players (see 14)
  render/                 draws GameState: world, entities, fx, and the character-anchored UI
tools/                    dev server, build, tests, determinism check, balance/sim, sheet viewers
art/                      dev-only art workbench (served at /art/)
public/                   index.html and the built bundle
docs/
```

**Hard rule:** `sim/`, `data/`, `campaign/` and `ai/` may not import from `platform/`, `render/`, or `ui/`. Enforced by `pnpm check` (`tools/check-sim.mjs`), which also bans nondeterministic APIs in `sim/`, `engine/`, `data/`, `campaign/` and `ai/`.

## Entity model

Horde scale means **struct-of-arrays typed arrays** (decided; see ADR-0005): one `Float64Array`/`Uint8Array` per field, a free-list for slot reuse, and a `highWater` mark for iteration. No per-entity objects, no allocation in the tick. Mobs are looked up spatially through a uniform **spatial hash grid** rebuilt each tick (`sim/grid.ts`), which AoE abilities, separation, and chain-reaction knockback all use.

Original plan, still the direction for richer entities:
- Entities are integer IDs (index + generation).
- Components are plain typed data in struct-of-arrays or per-type dense arrays.
- Systems are functions `(world, ctx) => void` run in a fixed, explicit order each tick.
- Entity IDs in sim state must be stable and reproducible (no random IDs) so they can be referenced across a network.

## Data-driven content

Classes, abilities, items and biome archetypes are typed TS objects in `src/data/`; enemies, scenery, people and heroes are generated per run from the seed (`data/bestiary`, `data/scenery`, `data/humans`, `data/heroes`). Behavior that can't be expressed as data (a special boss pattern) is a named function in `sim/` referenced by id. This keeps content addition cheap and makes balance passes edit-only.

## Save data

- `Profile` (meta): renown, unlocked class-tree nodes, stats, settings. Versioned with a `schemaVersion` and migration functions. Today the persisted meta is the campaign `Ledger` (`campaign/ledger.ts`, `campaign/storage.ts`, versioned with `LEDGER_VERSION`); renown and class trees are not built yet.
- `RunSave` (optional): mid-run resume. Because sim is deterministic, a run can be saved as `seed + input log` or as a serialized state snapshot. Snapshot is simpler, and is what exists (`sim/snapshot.ts`, versioned).
- Storage: `localStorage` for small profile; IndexedDB if size grows.

## Testing

- Sim is unit-testable headlessly in Node. Golden tests: `seed + scripted inputs => expected state hash after N ticks`.
- A state-hash function (`sim/hash.ts`) is part of the sim (used for tests and desync detection later).
