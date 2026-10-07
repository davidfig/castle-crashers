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

Characters are **paper-doll rigs** in `art/chars/*.mjs`: hand-pixeled ASCII parts + per-frame placements. No rotation or
resampling of pixel art ever happens. Output per character: `art/out/<name>.png` (rows = animations), `<name>.json`
(frames, anims, pivot, palette), plus palette-swap variants (`<name>.p1.png` …).

## House style (applied by the builder, not by hand)
- Parts are drawn with **flat 2–3 value fills**: no outlines, no highlights.
- `post` pass: 1px **rim light** on top/left silhouette edges, 1px **ink** on bottom/right edges.
- Light is always upper-left. One master palette (`art/palette.mjs`); ramps of ≤4 steps per material.
- Heroes are faceless: the only living pixels are the glow slit (`E`/`F`, swapped per player). Enemies never glow
  (except a deliberate weak point, e.g. the Slab's crack).
- Silhouette must read at 1×: Warden = horn helm + wing pauldron + bell cloak; Gaunt = hunch + bird skull; Slab = door.
- `fx*` frame entries (slash smears) are drawn behind the character and skip the edge pass.

Helpers in `art/lib.mjs`: `shear` (pose a part by sliding rows), `weapon` (rasterize a blade at any angle),
`smear` (slash crescent), `limb` (thick polyline arm), `rot90ccw`.

## Timing and ground line
- Anims take either `fps` or per-frame `ms: [...]` (use `ms` for attacks: slow windup, near-instant strike, held impact).
  The JSON carries `ms` for every anim.
- `pivot[1]` (the ground line) is derived by the builder from the lowest sole of `leg*` parts in idle/walk, so weapons
  and capes can hang lower without lifting the character off the ground. Name leg parts `leg…`.

## Non-player characters
Story figures that stand beside text on the menus are built the same way: `registrar.mjs` and `peddler.mjs` use the robed rig with an
`idle` and a `talk` loop and no combat poses. The game draws them pixel-doubled (see `src/render/npcArt.ts`, `docs/13-ui-art.md`).
