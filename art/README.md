# Art workbench

```bash
npm run dev        # http://localhost:4000/art/ — the game server also hosts the workbench (dev only); rebuilds on save, live-reloads the pages
```

Every figure in the game is generated per run now, so the workbench is a set of rollers and viewers over the generators, not an authoring tool for
hand-drawn art (the paper-doll rigs, `art/chars` and the sheet builder, are gone).

| Page | What it shows |
|---|---|
| `/art/heroes.html?seed=N` | the hero roller: eight random parties standing together (or, in roster view, one seed's four players in every class), animated at the game's speeds (`docs/20-generated-heroes.md`) |
| `/art/mobs.html?seed=N` | the monster roller: a seed's generated cast with stats, powers and moves (`docs/15-random-bestiary.md`) |
| `/art/walk.html` | the level walk: a whole level of the road, scenery, weather and road-scene stops, with no monsters |
| `/art/screens.html?seed=N` | the title screen drawn by the game's own renderer, live; `?seed=N` picks the monsters, people and heroes on it |

Each page is an esbuild bundle of `art/<page>.ts` served from memory, so it reloads on any save under `src/` or `art/`.

From the command line: `node tools/hero-sheet.mjs`, `node tools/folk-sheet.mjs`, `node tools/monster-sheet.mjs` and `node tools/scenery-sheet.mjs` write contact sheets.
