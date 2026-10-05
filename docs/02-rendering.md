# 02 — Rendering

**Target:** WebGL2 (fall back is not planned; WebGL2 is available in all current major browsers).

## Pixel-art strategy

- Render the whole scene to a **low-resolution offscreen framebuffer** (**640×360**, 16:9, scales to 1080p at 3× and 4K at 6×). Characters are small: heroes ~10–16 px tall, grunts ~8 px, brutes ~12–14 px, bosses 32–64 px. The wide canvas and small sprites give the 'battlefield' feel (see [ADR-0005](decisions/0005-horde-scale-battlefield.md)).
- Blit that framebuffer to the canvas with **nearest-neighbor** filtering at the largest **integer scale** that fits; letterbox the remainder. No fractional scaling → no shimmering pixels.
- All sprites are drawn at integer pixel positions in the low-res buffer (snap in the vertex shader or on CPU). Sub-pixel movement is tracked in the sim; rendering rounds.
- Optional later: a post-process pass at output resolution (CRT/scanline/bloom) toggled in settings.

## Camera

- Side-scrolling with depth lanes (Castle Crashers style): entities have `x`, `y` (depth lane on ground plane), and `z` (height above ground). Screen y = `groundY + y*laneScale - z`.
- Camera follows the **centroid of living players** but **only scrolls forward** (left to right), so cleared ground stays behind you; zooms *never*, since pixel scale is fixed. If players spread beyond screen width, the camera clamps and tethers (see [03](03-gameplay-combat.md), co-op rules).
- Camera shake is additive offset applied on integer pixels.

## Draw order

Y-sorted by ground-plane `y` (depth) for entities, with layers:

1. Parallax backgrounds (2–4 layers, scroll factors < 1)
2. Ground/tile layer
3. Ground decals (blood, scorch, shadows)
4. Y-sorted entities + props + foreground tiles
5. Particles / projectiles in air
6. Lighting overlay (optional)
7. World-space UI anchored to characters (see [06](06-ui.md))
8. Screen-space overlay (damage flash, transitions)

## Sprite batcher

The core of the renderer. One dynamic vertex buffer, one draw call per (texture, blend mode) batch.

- Instanced quads: per-instance `[x, y, w, h, u0, v0, u1, v1, rotation?, tint rgba, flags]`.
- Texture atlas(es) built by `tools/pack-atlas` at build time → `atlas.png` + `atlas.json`. Aim for a single 2048² or 4096² atlas for the whole game so most frames are one draw call.
- Flags: flip X/Y, additive blend, palette-swap row, flash-white (hit flash), outline.
- Sorting happens on CPU before upload; batches break only when texture or blend changes.

## Palette & color

- Define a master palette (~32–48 colors) in `docs`/data and keep art to it for cohesion.
- **Palette swapping** via an indexed-color texture + palette lookup row: used for player colors (P1–P4 tints), enemy variants, elite recolors, and status effects. This is cheap and very "classic".
- Hit flash: shader uniform/flag that mixes to white.

## Lighting (optional, post-v1.0 prototype)

- Low-res light buffer, multiply-blended over the scene. Torches, spell glows, and fire are additive lights.
- Keep it stylized (banded light levels) to stay pixel-consistent.

## Text

- Bitmap font in the atlas (our own glyph table; 5×7 or 6×8 px). No browser font rendering inside the game view.
- Damage numbers, item names, and prompts are all drawn through the sprite batcher.

## Animation

- Frame-based sprite animation defined in data: `{ frames, durations, loop, events }`.
- Animation events (e.g. "hitbox active on frame 3") are authoritative for the sim: the sim owns animation *state* (so combat timing is deterministic); the renderer just maps state → atlas frame.
- Squash/stretch and tint tweens are cosmetic, driven from presentation events.

## Performance budget

| Item | Budget |
|---|---|
| Entities drawn | 2,000+ sprites/frame (hordes) |
| Draw calls | < 20 (currently 1 for the whole scene) |
| Frame time (render) | < 4 ms on mid-range laptop iGPU |
| Allocations in hot path | zero (reuse typed arrays) |

## Debug tools

Toggleable overlays: hitboxes/hurtboxes, entity IDs, grid of depth lanes.

**Frame-time meter (implemented, top-right):**
- `FPS` turns red below 55.
- `DROPS n /10S`: frames in the last ~10 s that took more than 1.5x the display's usual frame time (+1 ms). It is relative, so a hitch is a hitch on 60 Hz and on 144 Hz displays alike. Startup frames (shader compile) and hidden-tab gaps are ignored, and a sustained slowdown does not teach the meter that slow is normal.
- `WORST nMS`: the longest frame in the same window.
- `SIM LAG n`: appears for ten seconds after the simulation fell so far behind it had to skip ticks (the loop caps catch-up at 5 ticks per frame).
- A 120-frame graph underneath, one bar per frame: green normal, amber slightly long, red dropped; the grey line is a normal frame, and a full-height bar is twice that.
