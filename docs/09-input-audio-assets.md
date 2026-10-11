# 09 — Input, Audio, Assets

## Input

All through browser APIs; no libraries.

- **Keyboard:** `KeyboardEvent.code` (layout-independent). Two keyboard layouts at once (P1: WASD + JKL..., P2: arrows + `,` `.` `;` `/`). Remapping is not built yet; the schemes are the `SCHEMES` table in `platform/input/input.ts`.
- **Gamepad:** `navigator.getGamepads()` polled once per render frame, sampled into per-tick `InputFrame`s. Handle connect/disconnect events, standard mapping, deadzones (radial), and axis quantization.
- **Mouse:** title buttons only (click or tap); not used in runs.
- **Input buffering:** the *device layer* records press times; the *sim* has a short buffer window (≈6 ticks) for attack/jump/dodge to make combos forgiving.
- **Device → player assignment:** see [08](08-multiplayer.md#local-multiplayer-specifics).
- Because the sim is 60 Hz and the render loop might run at 144 Hz, sample input at the start of each *sim tick* from the latest polled state, and track button *edges* between polls so a quick tap isn't lost.

Default bindings (as implemented in `platform/input/input.ts`; there is no jump):

| Action | Gamepad | Keyboard P1 | Keyboard P2 |
|---|---|---|---|
| Move | Left stick / D-pad | WASD | Arrows |
| Attack | RT | J | `,` |
| Ability 1 | X / West | K | `.` |
| Ability 2 | RB | I | `;` |
| Dodge | LT | L | `/` |
| Interact / stand down | B or Y | U | `'` |
| Level-up panel | LB | O | `[` |
| Alt (hold; shaman's second bank) | A | E | `=` |
| Swap / cycle back | none | Q | `-` |

N and M toggle sound and music anywhere; V toggles controller rumble.

## Audio

- **Web Audio API** directly: a master gain → bus gains (music, sfx, ui) → `AudioContext.destination`.
- SFX: currently **synthesized** with Web Audio (oscillators and noise buffers in `platform/audio/audio.ts`), with polyphony caps and slight pitch/volume randomization (cosmetic RNG, **not** the sim stream). Sample playback through pooled `AudioBufferSourceNode`s is the plan if recorded sounds are added.
- Positional feel: simple stereo pan from screen x; distance attenuation unnecessary at this scale.
- Music (`platform/audio/music.ts`): generative layers (pads, melody, heartbeat, drone, plus hats/arpeggio/bass/drums/lead) driven by a battle-energy curve: it builds with the danger level, peaks, then a "relief" phase (warm melody, drive dropped) follows once the field thins. Tempo and chord pace follow the energy.
- Browsers require a user gesture to start audio: the first key press or click (on the title or anywhere) unlocks the context.
- Sound is triggered by **presentation events** emitted by the sim ([01](01-architecture.md)), never directly by sim code.
- Formats (only if recorded audio is added): `.ogg` / `.mp3` fallback for Safari; or `.wav` for tiny SFX to avoid encoding quirks. Undecided; no audio files exist today.

## Asset pipeline

**Today there are no asset files**: sprites, fonts and sounds are generated in code at startup, and `tools/` has no atlas packer or content validator. `public/` holds only `index.html` and the esbuild bundle. The pipeline below is the plan for when hand-made art arrives.

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
- **Hot reload (dev):** `pnpm dev` (`tools/dev.mjs`) watches `src/` and `art/`, rebuilds on save and live-reloads the art workbench pages at `/art/`.

## Art direction notes

- **Resolution:** 640×360 internal ([ADR-0005](decisions/0005-horde-scale-battlefield.md)). Heroes ~10–16 px tall; bosses 32–64 px.
- **Style:** chunky, expressive, readable silhouettes, strong outlines or selective outlines, limited palette, per-class color identity.
- **Player identification** for 4 players: colored ground ring + palette swap + small number glyph.
- Animation counts per class (v1 minimum): idle, walk, run?, jump/fall, light ×3, heavy/ability ×2, dodge, hurt, down, revive, victory.
