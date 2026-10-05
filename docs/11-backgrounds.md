# 11 — Backgrounds (sky, parallax, ground)

The look of the world behind and under the action. The sim never sees any of this: backgrounds are **render-only**, a pure function of `(biome, level progress, camera x, tick)`, so they cannot affect determinism ([ADR-0002](decisions/0002-deterministic-sim.md)).

## Goals

- Many distinct **biomes** (Meadow, Haunted Keep, ...), each mostly art plus one data entry.
- The sky and light **change during a level** (time of day / mood), driven by how far the party has advanced.
- Cheap: a few dozen quads per frame, no allocation in the draw path.
- The ground plane geometry (horizon, field top, bottom ridge) is shared with the enemy-entry logic, so it stays fixed across biomes for now.

## Data model (`src/data/biomes.ts`)

```
BiomeDef
 ├─ name
 ├─ timeline: Mood[]            keyframes along level progress (0..1), blended linearly
 │    Mood = { at, sky: number[] (gradient bands, top→horizon), tint (multiplies bg art),
 │             sunY, moonY (screen y; below the horizon = down), stars (0..1) }
 ├─ layers: ParallaxLayer[]     far → near: { sprite (key), k (scroll factor), dy?, lights?, windows? }
 ├─ clouds: CloudLayer[]        { k, drift, count, y0, y1, alpha, tint? }
 ├─ moonScale?, haze: { height, alpha }, fog?: FogLayer[]
 ├─ destination?                the next biome's landmark, seen far off (see below)
 ├─ ground: GroundDef           { floor, path?, patches, mottle, decor }
 └─ crest, ridge                the hill crest and the foreground ridge colors
```

- **Progress** = `camX / (WORLD_W - VIEW_W)`, clamped to 0..1. Camera only scrolls forward, so time of day only moves forward too.
- **Biome selection:** `pickBiome(seed)`, a pure hash of the run/level seed (node types and run structure override it later, see [07](07-procgen.md)).
- Moods interpolate per color channel. Layers and ground are tinted by the blended `tint`, so one art set serves day, dusk and night.

## Module layout

- `src/data/biomes.ts`: `BiomeDef`s, `pickBiome` (a hash of the seed; `?biome=N` overrides it in dev builds), `moodAt`.
- `src/render/background.ts`: the draw functions, called from `draw.ts` in the draw order from [02](02-rendering.md): `drawSky` (gradient, stars, sun, moon, clouds), `drawParallax` (strip layers, the destination landmark, torches and windows), `drawHaze`, `drawGround` (floor, mottle, path, patches, decor), `drawFog`, `drawCrest`, `drawRidge`. Also the shared geometry constants (`GROUND_TOP`, `FIELD_Y0`, `RIDGE_TOP`) and the small helpers `shade` (color x mood tint x brightness), `glow`, `depthShade`.
- `src/render/bgArt.ts`: the procedural builders for everything the background draws (ground tiles and patches, mountain, tree and ruin strips, clouds, moon, fog, the landmark and its bluff). `buildSprites` in `art.ts` packs their output into the atlas.
- `src/render/pix.ts`: the pixel-buffer helpers they share (`Pix`, `setPix`, `hash2`, `darken`, `makeEllipse`, `silhouette`).

## Phases

1. **Data-driven (done).** `BiomeDef` + `background.ts`, Meadow ported, time-of-day timeline working (day → golden hour → dusk).
2. **Sky and parallax quality (done).** All procedural for now, to be replaced by authored strips in phase 5.
   - Sky bands dither into each other over 6 px (25/50/75% masks tinted with the next band's color).
   - Sun (reddens as it sinks, with a halo) and crescent moon, each placed by `sunY`/`moonY` in the mood; stars fade in with `stars` and twinkle.
   - Drifting clouds in `BiomeDef.clouds` layers: wrap every 768 px, move with parallax factor `k` plus a per-tick `drift`, and take the mood tint.
   - A horizon haze (stacked alpha strips in the horizon sky color) over the far layers.
   - Five seamless 256 px parallax strips (far mountains, near mountains, hills, a hazy far tree line, a near tree line). Tree lines mix pines, round oaks, fat spruces and bushes in several greens, with gaps, each with its own scroll factor and optional `dy`. Strips are referenced by key in `Sprites.layers`.
   - **Destination landmark (done).** `BiomeDef.destination` shows the next biome far off at the right of the horizon (a layer marked `@destination` among the parallax layers, so mountains sit behind it and the tree lines in front). Over the level it steps up through 8 sizes, drifts toward the middle (`x0` to `x1`), settles from a high perch onto the horizon (`lift0` to `lift1`), clears out of an aerial haze (a silhouette tinted with the horizon sky color), gains an aura, stands on a low rocky bluff (`makeCrag`: a flat top as wide as the castle, stepping out in ledges toward a wider base; lit left faces, shadowed right faces, vertical strata, bright ledge lips; the same shape at every size). The rock runs down behind the ground so it never floats, and is hazed with the castle. It is deliberately low (`lift0` 30 to `lift1` 12, up to 96 px wide): a tall cliff reads as something to climb, which this game's flat field can't support, so the bluff mostly hides behind the near tree line, and its windows glow brighter at dusk. Windows are a separate layer so they stay lit while the stone takes the mood tint. The Haunted Keep landmark is procedural (`makeKeep`) and is reused as the biome's art later.
   - **Meadow polish (done).**
     - *Morning mist:* the Meadow uses the same fog system as the Keep, pale and warm, lighter than the Keep's, in broad banks (`FogLayer.big` uses the larger wisp sprites, 300 to 400 px wide). `FogLayer.until` burns it off by that level progress (it thins over the 0.25 before): the far layer by 0.6, the near one by 0.5, so the first half starts misty and the rest is clear.
     - *Wind:* `BiomeDef.wind` sways grass, wheat and flowers a pixel to either side in a gust that ripples along the ground (`DecorKind.sway`), and leans the tips of the foreground ridge's blades. `BiomeDef.ambient` (`AmbientDef`) carries specks on the wind: 30 petals (pink, white, yellow) that tumble and meander, each on its own heading and speed (`speed`, with a gentle prevailing `bias`), so they wander every which way, at their own parallax depth, drawn last so they pass over everything. The same system can do embers or dust in other biomes.
     - *Path and decals:* the dirt road gets wheel ruts and grass fraying its edges (`path.ruts`, `path.fringe`). The ruts are irregular: the road is cut into 112 px stretches and each rut independently shows in about 38% of them, with ragged starts and ends, the odd gap inside, and a different distance from the middle each stretch, so a rut comes and goes along the road. New decals: clover, tall dry grass (wheat), bushes, daisies, twigs, a stump and mossy rocks, alongside the tufts, flowers, pebbles and mushrooms.
   - **Parallax variety (done).** A single 256 px strip repeated every 256 px, so the same tree or ruin came round again and again (obvious on the near tree lines). Every layer now has 4 to 6 variants (`Sprites.layers[key]` is a list), and the renderer chains strips by a hash of the strip's world index (never the same variant next to itself), so the horizon doesn't visibly repeat. For any variant to follow any other, objects stay at least 12 to 18 px clear of a strip's edges (`place`) and ridges blend to a common height at both ends (`edgeEnv`). Costs about 47 strips in the atlas.
3. **Ground (done for Meadow).** `BiomeDef.ground` (`GroundDef`). Everything is a function of world position through cosmetic hashes, so it holds still as the camera scrolls.
   - Six 16 px grass tiles, with a depth tint (darker and slightly cooler toward the horizon).
   - Light/dark mottling: stippled, irregular blotches (2 px clusters thinning toward a lobed rim, four shapes) on a jittered 192x112 grid.
   - A winding dirt path: a continuous ribbon along an S-curve (`pathY`), drawn in world-aligned 2 px columns with a dark edge, a lit top lip, a ragged outline and scattered specks. (Overlapping blobs were tried first and looked scalloped.)
   - Scattered patches (one per cell with a probability), kept clear of the path. The Meadow's are wildflower beds and dense clover (`makePatch`: grass-colored pixels dithered out toward an irregular edge, with flower or bright-clover accents, so they grow out of the turf). Mud and puddles were tried first and looked out of place on a meadow, so they are gone; puddles remain for the Keep.
   - Flat decals (tufts, flowers, pebbles, rocks, mushrooms) from a weighted `decor.table`; only entries marked `onPath` may sit on the road.
   - Foreground ridge gets one-pixel grass blades along its edge.
   - Decals are flat and drawn under entities, so there is no Y-sorting cost. Tall props (bushes, trees on the field) would need to join the entity sort; not done.
4. **More biomes.** Haunted Keep (done); Frozen Pass (scenery done, waiting on a roster); Volcano, Crypt and Sky Citadel are the other candidates (see [open questions](open-questions.md)).
   - **Haunted Keep** (`BIOMES[1]`, `?biome=1` in dev builds forces it). Its time of day runs violet dusk, deep night (full stars), then a sickly green pre-dawn, with a big crescent moon (`moonScale` 2) and dark storm clouds (`CloudLayer.tint`).
   - Parallax: jagged far peaks, nearer crags, a skyline of ruins (broken walls, shattered and roofed towers, arches, spires), and two lines of gnarled dead trees. Everything is procedural (`makeJagged`, `makeRuins`, `makeDeadTrees`).
   - Ground: a paved floor (`GroundDef.floor`: `tiles` repeats flat 16 px tiles, as the grass does; `flagstones` draws rows of irregular slabs staggered like brickwork). **Constant size, no perspective shrink**: characters and mobs do not scale with depth (as in Castle Crashers and Knights of the Round, which I looked at for reference), so a floor that shrank toward the horizon contradicted them. The rows are just squashed (6 px tall, slabs 14 to 30 px wide: sized to the characters, which are only about 10 to 16 px tall) to suggest looking down at the floor from the side; brightness still falls off toward the horizon as lighting. Slab boundaries come from a hash of a 192 px cell and the row, shifted per row, so they stay put as the camera scrolls. **No path**: the stones are the path. Blood, rubble and moss patches, and decals: bones, skulls, rubble, dead weeds, cracks, candles, glowing mushrooms and braziers
   - It has no `destination` yet (a final-biome landmark, or the next biome, comes with the run map).
   - Readability: checked with a full horde (bots at 6x speed). Dark character outlines vanished against a dark floor, so the floor and night tint were raised to roughly the Meadow's luminance, and the carpet made a deep crimson with a gold edge so it separates from the orcs. Purple archers still blend a little with the violet stone.
   - **Frozen Pass (done, in the rotation as biome 2).** `FROZEN_PASS` in `biomes.ts`, paired with its enemy roster (`ROSTERS[2]` in `src/data/roster.ts`, built from [the roster brief](briefs/frozen-pass-roster.md): Trapper, Snow Sprite, Harpooner, Frost Wolf, Bighorn Ram, Ice Husk, Yeti, Frost Shaman, Blizzard Witch, Whiteout Spirit, Tundra Guard). `?biome=2` forces both; `?scenery=frozen` previews the scenery alone (`sceneryFor`).
     - *Sky:* crisp morning, bright midday, a low rose-gold afternoon, then a deep blue night with the **aurora** (`Mood.aurora`; `drawAurora`: three undulating green, teal and violet curtains drawn as 8 px columns in three bands that brighten toward the hem, shimmering and drifting).
     - *Parallax:* snow-capped peaks (`makeSnowPeaks`: jagged ridges, lit and shaded slopes by facing, a ragged snow line over rock with crevasse streaks), then a hazy far and a near line of snow-laden pines (`makeSnowPines`, each tier capped with snow), all in variants so the horizon doesn't repeat.
     - *Ground:* white snow tiles (`makeSnow`), a grey slush trail with dirt flecks, partial ruts and snow piled along its edges, bluish shadow drifts and glossy ice sheets (`makeIce`), and decals: snow mounds, ice shards, snow-capped rocks, saplings, tracks, the odd twig and dead shrub.
     - *Weather:* low spindrift fog and 70 blowing snowflakes (an `ambient` with `bias` set to blow left and down; pale blue-grey and white so they show on both the white ground and the dark sky and peaks).
     - *Readability:* checked with a full horde: the best contrast of the three, since the characters' dark outlines read well on bright snow.
   - **Modular ruins.** The ruins skyline is assembled from pieces (`makeRuins`): wall segments (crenellated or broken, some with window holes), towers (crenellated, shattered, roofed or flat, with arrow slits), gatehouses with arched openings, pitched-roof halls with chimneys and collapsed patches, buttresses, spires, broken pillars and rubble. Pieces are joined edge to edge (overlapping a pixel) into buildings of 1 to 5 pieces with at least one tall anchor; buildings bunch into clusters with wide gaps between (about half follow right alongside the last). Tree lines use `scatter` for the same uneven spacing: mostly tight gaps and the odd wide one, instead of even slots.
   - **Torchlight.** `ParallaxLayer.lights` lights the torch positions baked into a layer's strips (`Sprites.layerLights`, recorded per variant by `makeRuins`). The brackets are in the stone; the flame (two frames) and a warm three-disc glow are drawn live, each torch flickering on its own phase. They are emissive: the glow is not dimmed by the time of day and grows at night.
   - **Lit windows.** Tower arrow slits (1 x 3) and hall windows (2 x 3) are cut into the stone dark and recorded as rectangles beside the torches (`layerLights`, entries with a size). `ParallaxLayer.windows` lights them live: a share of them (`lit`, 0.7 in the Keep) glow, each in a color picked per window (mostly warm yellow, the odd eerie teal), with a small halo that grows at night, and the odd lit window blinks out for a moment. Emissive, like the torches, so the time of day doesn't dim them.
   - **Ground fog.** `BiomeDef.fog`: layers of dithered wisps (`makeFog`: lobed clouds thinning to the rim, ordered-dithered to single pixels) that wrap around a 960 px loop, scroll with the camera by `k` and slide by `drift` per tick. A thin layer sits near the horizon and a wider one over the floor. Drawn over the floor and decals but under the characters, so a horde stays readable.
   - To do:
5. **Art pipeline.** Background sheet type in the art workbench (`tools/art.mjs`), a separate background atlas loaded per biome, and a scrolling preview mode for iteration. Authored art for parallax silhouettes; procedural for gradients, tiles and scatter.
6. **Level integration.** Node types override sky and tint (boss arena, rest camp), biome transitions once there is a run map, and entity ambient tint so characters match the light.

## Open

- Should characters pick up the ambient tint (phase 6), or stay fully lit for readability? Default: a light tint only, so enemies stay readable at night.
- Night biomes: stars and moon are cosmetic; no gameplay visibility effects.
