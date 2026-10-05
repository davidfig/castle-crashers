# 09 — Input, Audio, Assets

## Input

All through browser APIs; no libraries.

- **Keyboard:** `KeyboardEvent.code` (layout-independent). Support two keyboard layouts simultaneously (P1: WASD + JKL..., P2: arrows + numpad/`;'` etc.). Fully remappable.
- **Gamepad:** `navigator.getGamepads()` polled once per render frame, sampled into per-tick `InputFrame`s. Handle connect/disconnect events, standard mapping, deadzones (radial), and axis quantization.
- **Mouse:** hub/menu only; not used in runs.
- **Input buffering:** the *device layer* records press times; the *sim* has a short buffer window (≈6 ticks) for attack/jump/dodge to make combos forgiving.
- **Device → player assignment:** see [08](08-multiplayer.md#local-multiplayer-specifics).
- Because the sim is 60 Hz and the render loop might run at 144 Hz, sample input at the start of each *sim tick* from the latest polled state, and track button *edges* between polls so a quick tap isn't lost.

Default bindings (proposal):

| Action | Gamepad | Keyboard P1 |
|---|---|---|
| Move | Left stick / D-pad | WASD |
| Attack | X / West | J |
| Jump | A / South | K |
| Dodge | B / East | L |
| Ability 1 | Y / North | U |
| Ability 2 | RB | I |
| Interact | LB | E |
| Swap (hold) | RT / LT | Space |
| Quick-use | D-pad Up | Q |

## Audio

- **Web Audio API** directly: a master gain → bus gains (music, sfx, ui) → `AudioContext.destination`.
- SFX: short samples decoded to `AudioBuffer` at load; played through pooled `AudioBufferSourceNode`s with per-sound polyphony caps and slight pitch/volume randomization (cosmetic RNG, **not** the sim stream).
- Positional feel: simple stereo pan from screen x; distance attenuation unnecessary at this scale.
- Music: layered stems (base + combat intensity) that crossfade by "danger" level published from the presentation event stream.
- Browsers require a user gesture to start audio: the title/"press to start" screen unlocks the context.
- Sound is triggered by **presentation events** emitted by the sim ([01](01-architecture.md)), never directly by sim code.
- Formats: `.ogg` / `.mp3` fallback for Safari; or `.wav` for tiny SFX to avoid encoding quirks. Decide in tooling setup.

## Asset pipeline

```
assets/sprites/*.png (+ .json meta)  ──► tools/pack-atlas ──► public/atlas.png + atlas.json
assets/audio/*.ogg                   ──► copied / optionally sprite-packed
assets/fonts/*.png                   ──► bitmap font atlas section
assets/levels/chunks/*.json          ──► validated by tools/validate-content
```

- **Art format:** PNG with a restricted palette. Source files authored in Aseprite (or similar) and exported as frames + JSON tags; export step is manual initially.
- **Atlas packer:** a small Node script (own code) using a simple shelf/maxrects algorithm, with 1px padding/extrusion to prevent bleeding. Outputs frame rects, pivots, and animation tags.
- **Naming:** `class/animation_frame` (e.g. `warrior/attack1_02`). Animation definitions live in data and reference those names.
- **Loading:** `fetch` → `createImageBitmap` → `texImage2D`; audio `decodeAudioData`. A loader reports progress to a simple loading screen.
- **Hot reload (dev):** the dev server watches `assets/` and `src/data/`, rebuilds, and reloads atlas/data without a full page refresh where possible.

## Art direction notes

- **Resolution:** 480×270 internal. Characters ~32–48 px tall; bosses 64–128 px.
- **Style:** chunky, expressive, readable silhouettes, strong outlines or selective outlines, limited palette, per-class color identity.
- **Player identification** for 4 players: colored ground ring + palette swap + small number glyph.
- Animation counts per class (v1 minimum): idle, walk, run?, jump/fall, light ×3, heavy/ability ×2, dodge, hurt, down, revive, victory.
