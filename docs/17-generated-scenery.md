# 17 — Generated Scenery and the Road's Biomes

Every run draws its own scenery, and the biomes no longer change at the edge of a level: the road turns from one into the next over a long stretch, passing through every mix on the way (90% one, 10% the other, then 60/40, then the other way round). All of it is render-only (the sim never sees it) and a pure function of the run's seed, so a replay, a second client and a screenshot all agree. Background doc for the look itself: [11 Backgrounds](11-backgrounds.md).

## One place for every biome

- **`BIOMES` (`src/data/biomes.ts`)** are the five *archetypes* (Meadow, Haunted Keep, Frozen Pass, Sunken Marsh, Scorched Dunes). Nothing draws them directly; each run varies them. A stage of the road is the few levels one enemy biome lasts (`LEVELS_PER_BIOME`), and stage *k* uses archetype `levelPlan(seed, k * LEVELS_PER_BIOME).biome`, so the enemies, music and story of a stage still suit its place.
- **`generateWorld(seed, archetypes, stageLen)` (`src/data/scenery/world.ts`)** makes the run's `World`: one `GenBiome` per stage (`def`: a full `BiomeDef`; `recipe`: archetype, slot, seed, tone) and the `Road`. `src/main.ts` calls it at the start of a run (`applyScenery`), the painter draws it into the atlas, and `setWorld` (`render/sceneryWorld.ts`) makes it the scenery in play. The title and menus show the world of the next run to be played.
- **One road, no level boundaries in it.** The scenery is drawn in road coordinates (a level's camera plus `roadOffset(level)`, a level and its store being `ROAD_STRIDE` long), the same coordinates as before, so nothing changes at the cut between a field and its store. What is new is that *where the biomes change is the road's business*, not the level's.

## What varies from run to run

Each biome starts as its archetype and is varied by `varyBiome` (data) and `paintBiome` (pictures), both from the biome's seed:

| What | How |
|---|---|
| **Colour** | A `Tone` (`data/scenery/tone.ts`): the hue of the archetype's *band* (foliage green, snow-shadow blue, ...) is rotated, the sky turns by its own small amount, saturation and lightness move. Applied to every colour in the definition (sky looks, fog, ground, path, crest, ridge) **and** to every pixel the painter draws, so data and pictures always agree. Bold turns are rare (an autumn meadow, a blighted keep, a jade desert). The name follows (`Autumn Meadow`, `Rimed Frozen Pass`). |
| **Shapes** | Every strip's geometry seed is moved to the biome's, and its sizes and counts are rolled (tree counts, ridge amplitudes): the mountains, tree lines, ruins, dunes are cut anew. Floor tiles and patches are re-seeded. |
| **Horizon** | A strip may be swapped for another that suits the place (`LAYER_ALTS`: snow peaks behind a meadow, bare winter trees in the pass), and each layer's scroll factor drifts a few percent. |
| **Ground** | The decor table is re-weighted (0.45x to 1.8x), some of the rarer kinds are left out, density, patch cell and chance and the path's width are rolled. Beside the hand-drawn decals every archetype has **generated** ones (`render/propGen.ts`: grass tufts, flowers in a palette of *this run's* colours, rocks, shrubs, crystals, toadstools), drawn from the seed. |
| **Sky and air** | Cloud, fog and ambient-speck counts and strengths, haze height and strength. |

Not varied (yet): the destination landmark (only the Meadow's keep), the sim's biome.

## The road and its turns

`planRoad(seed, stages, stageLen)` (`data/scenery/road.ts`) lays one `Span` per boundary between two stages.

- **Where and how long.** Centred within 12% of a stage of the boundary, and 0.9 to 1.7 `ROAD_STRIDE` long (about 3000 to 5500 px, one to two levels, against about 1300 before). Two neighbouring turns, each as long and as far off-centre as allowed, still leave `MIN_PLATEAU` (1800 px) of one pure biome between them (tested).
- **The share curve.** `profile(span, u)` is the share (0..1) of the road that belongs to the new biome at position `u` along the turn: a monotone cubic through 3 to 5 random knots whose slopes differ by up to a factor of six, flat at both ends. So a turn has stretches that are almost all one biome with a sprinkling of the other, steeper changes between, and a gentle finish; no two turns match, and no stretch stalls (a minimum slope is tested), so nothing lingers half faded.
- **Handing over.** `spanIndexAt(road, x)` picks the turn for the view centred at `x` and switches in the middle of the plateau between two turns. There both turns show a single biome across the whole view and the margins the scenery looks past it, so the switch cannot be seen (tested).

## How a mix is drawn

Unchanged in principle from [11 Backgrounds](11-backgrounds.md#biome-transitions-done): both biomes are drawn and **every element belongs to exactly one**; nothing is colour-blended and the view is never faded. What changed for long, partial mixes:

- **`Scenery` (`render/scenery.ts`)** now reads the share from the span's curve: `share(x)`, `slope(x)`, `keep(i, x, h)` (is this element biome *i*'s: `h < share`), `weight(i, x, h)` for things that move or overlap. A share of 0.1 really gives the new biome about a tenth of the elements.
- **Ground** is owned per 8 px cell (`GROUND_CELL`, noise `groundNoise`: big soft blobs, smaller lumps, a ragged edge), evened out so the share is the true fraction. A 16 px floor tile is drawn whole where its four quarters agree and quarter by quarter along the shore. Decals, patches, path columns, the crest and the ridge ask the same question of the same cell, so a decal never stands on the other biome's floor.
- **Strips, clouds, fog, specks** fade between biomes over `FADE_PX` (180) of road wherever the curve is steep or gentle (the fade is scaled by the local slope), so a strip never sits half faded on a plateau of the curve.
- **The sky** is a wash by column: `skyShare` is the same curve, the horizon turning first and the top of the sky lagging (`SKY_LEAN`).
- **Level progress per biome.** `Scenery.prog[i]` is the progress through the current level for the biome whose stage it is, and -1 for the other: a mist that burns off, and the destination landmark, belong to the level's own biome.
- **Weather** is the road's own, in fronts that cross biomes (see [11 Backgrounds](11-backgrounds.md#weather-done) and `data/scenery/sky.ts`); `World.sky` is part of the world.

## The painter and the atlas

`render/sceneryArt.ts` draws a world: for each biome it makes exactly the strips, floor tiles, decals and patches the biome's definition names (`LAYER_MAKERS`, `GROUND_MAKERS`, `DECOR_MAKERS`, `PATCH_MAKERS` in `sceneryProps.ts`), recolours them to the tone, and `installSceneryArt` packs them into the atlas's **scenery band** (`SCENERY_BAND_H`, 2048 x 1024) and points `Sprites.layers / groundSets / decor / patch / layerLights` at them, under the key `slot:name` (`3:mrStilts`). A world of five biomes paints in about 100 ms and needs about 1.5M px of the band's 2.1M (tested). The static atlas no longer holds any biome art except the stippled mottles, the fog wisps, flames, clouds, sun and moon, and the keep landmark.

## Dev aids

- `?seed=N&levels=15`: the whole road of seed N. `&roadx=N` draws the scenery N px further along the road than the level really is (jump to any mix); `&world=N` changes the scenery's seed alone; `&scenery=frozen` makes every stage that archetype (a road of one kind of place, still turning between varieties); `&biome=N` forces both the enemies' and the scenery's archetype.
- `node tools/scenery-sheet.mjs --seed 12 --biome 2 [--archetype A] [--out sheet.png]` writes a contact sheet of one biome of a world: strips, tiles, decals, patches. Look at it before and after changing a generator.

## Adding to it

- **A new generated decal:** add a generator to `render/propGen.ts`, register variants in `sceneryProps.ts` (`variants('gFooX', n, ...)`), and name them in an archetype's decor table (`data/biomes.ts`). Colours are the archetype's own (the painter moves them to the tone).
- **A new strip:** add a maker to `LAYER_MAKERS` (`sceneryArt.ts`), name it in an archetype's `layers`; optionally list it as an alternative (`LAYER_ALTS`, `world.ts`). The tests fail until every name has a maker and every maker is used.
- **A new archetype:** add a `BiomeDef` to `BIOMES`, a `TONES` entry and base name in `world.ts`, and its enemy roster (`ROSTERS`).
- Keep objects in a strip 12 to 18 px clear of its edges and ridges blending to a common height at both ends, so any variant can follow any other.

## Open

- The destination landmark could be generated for every biome, not only the Meadow's keep.
- Reaching a biome out of the stage order, or an extra hybrid biome part-way between two (a stretch that never reaches 100%), needs only a different `Road`; the renderer already handles any share.
