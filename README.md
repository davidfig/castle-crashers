# Horde Roguelike (working title)

Locally co-op, pixel-art fantasy roguelike. Small heroes push left to right across large battlefields through hundreds of enemies, using AoE abilities. TypeScript + WebGL2, zero runtime dependencies. Design docs are in [docs/](docs/README.md).

## Run it

```bash
pnpm install
pnpm dev           # http://localhost:4000 (override with PORT=...)
```

Optional URL params: `?seed=1234` for a reproducible battlefield, `?mute=1` for no sound or music (leaves the saved N / M toggles alone); dev builds also take `?boss=1` (start at the boss arena), `?bots=3` (bot-controlled extra players), `?tutorial=1` (play the first-time controls tutorial; `0` skips it) and `&auto=1` (a bot plays player 1 too).

## Controls

| | Keyboard 1 | Keyboard 2 | Gamepad |
|---|---|---|---|
| Move | WASD | Arrows | Left stick / D-pad |
| Attack (cleave) | J | , | X |
| Big swing (special, costs stamina) | I | ; | X |
| Nova (AoE, costs fury) | K | . | A / Y |
| Dash | L | / | LT |

Any device pressing a button claims the next free player slot (up to 4). `R` or Start restarts.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | esbuild watch + live reload dev server |
| `pnpm kill` | stop every running dev server (all worktrees) |
| `pnpm build` | minified bundle to `public/dist/` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | unit and determinism tests (node's built-in runner) |
| `pnpm playtest` | scripted bot plays several seeds headlessly; prints win/lose, kills, min HP |
| `pnpm check` | lints `sim/`, `engine/`, `data/` for nondeterministic APIs and forbidden imports |

## Layout

See [docs/01-architecture.md](docs/01-architecture.md). The key rule: `src/sim/` is deterministic and never touches the browser; `src/render/` and `src/platform/` read sim state and never change it.
