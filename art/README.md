# Art workbench

```bash
npm run art        # http://localhost:5190 — rebuilds on save, live-reloads the viewer
npm run art:build  # one-shot build to art/out/
```

**Screens page** — http://localhost:5190/screens.html (link in the header of the sprite page). The title, the party select, the Writ board and
every story scene (the opening, the hub beats, the aftermaths) drawn by the game's own renderer, live: pick a screen, step through a scene's
beats, choose the party that stands in it, and read the scene's words beside it. It is an esbuild bundle of `art/screens.ts` served from
memory, so it reloads on any save under `src/` or `art/`; a new backdrop in `src/render/sceneArt.ts` or a new scene in `src/data/story/hub.ts`
shows up in its list with no further wiring. Deep links: `?screen=scene:intro:bounty&page=2&party=archer,mage`, `?screen=title`, `?screen=board&chapter=3`.

This workbench is for the figures that are still drawn by hand: the five heroes and the story figures that stand beside text. Enemies
and scenery are generated per run (`docs/15-random-bestiary.md`, `docs/17-generated-scenery.md`) and are not here; see
`tools/monster-sheet.mjs` and `tools/scenery-sheet.mjs` for those.

Characters are **paper-doll rigs** in `art/chars/*.mjs`: hand-pixeled ASCII parts + per-frame placements. No rotation or
resampling of pixel art ever happens. Output per character: `art/out/<name>.png` (rows = animations), `<name>.json`
(frames, anims, pivot, palette), plus palette-swap variants (`<name>.p1.png` …).

## House style (applied by the builder, not by hand)
- Parts are drawn with **flat 2–3 value fills** from the Glass palette (`art/palette.mjs`): jewel tones, a dark lead outline, gold leaf
  for light. Light is always upper-left.
- `post` pass: 1px **rim light** on top/left silhouette edges, 1px **ink** on bottom/right edges.
- Silhouette must read at 1×.
- `fx*` frame entries (slash smears) are drawn behind the character and skip the edge pass.
- Hero rigs list `GLASS_PLAYERS` as their variants (`p1`…`p4`), which swap the cloth ramp per player.

Helpers in `art/lib.mjs`: `shear` (pose a part by sliding rows), `stepLeg` (a walking leg), `weapon` (rasterize a blade at any angle),
`smear` (slash crescent), `ring` (shockwave / heal pulse), `outline`, `rows`. The shared robed body is `art/rigs/robed.mjs`.

## Timing and ground line
- Anims take either `fps` or per-frame `ms: [...]` (use `ms` for attacks: slow windup, near-instant strike, held impact).
  The JSON carries `ms` for every anim.
- `pivot[1]` (the ground line) is derived by the builder from the lowest sole of `leg*` parts in idle/walk, so weapons
  and capes can hang lower without lifting the character off the ground. Name leg parts `leg…`.

## Non-player characters
Story figures that stand beside text on the menus are built the same way: `registrar.mjs` and `peddler.mjs` use the robed rig with an
`idle` and a `talk` loop and no combat poses. The game draws them pixel-doubled (see `src/render/npcArt.ts`, `docs/13-ui-art.md`).
