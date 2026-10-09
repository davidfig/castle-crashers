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

## Weather (done)

Rain, snow, fog and lightning drawn over the world. Render-only, like everything else here: a pure function of `(biome weather, level progress, level seed, camera x, tick)`.

- **Data:** `BiomeDef.weather` is a list of `WeatherDef { kind, curve?, wind?, swing? }` (`'rain' | 'snow' | 'fog' | 'lightning' | 'sandstorm'`); several run at once (a storm is rain plus lightning).
- **Strength over a biome (`weatherLevel`, `biomes.ts`):** a route plays several levels in each biome (`LEVELS_PER_BIOME`), and the weather runs across **all of them**: each level draws its own slice of one shared span (`weatherSpan` in `route.ts`: one seed per biome, plus the level's `from`..`to` of the biome's progress), so a storm that is raging as one level ends is still raging in the store and in the next level, and clears only at the end of the biome's last level. `setWeatherRoute` (called from `main.ts` whenever a level or store begins) hands `drawWeather` the current level's span and the next one's (the store shows the end of one level and the start of the next). A one-level dev run is its own whole span. Strength is the product of three things:
  - the authored `curve` (the shape of the biome, e.g. a storm that builds; flat by default);
  - **random surges**: smooth noise from the biome's seed (knots about every 0.11 of a level's length, each kind on its own rhythm), so the weather swells, eases and returns at different points every biome, deep lulls included (`swing`, default 0.85), identical on every client and replay;
  - **the ends**: it eases in over the first 5% of the biome and is gone by `WEATHER_END` (0.92 of the biome), so the biome finishes in clear air before the next one's weather begins.
- **Drawing (`src/render/weather.ts`, `drawWeather`, after the particles and before the HUD):**
  - *Rain:* up to 340 slanted streaks (`wind` leans them), each at its own depth: nearer ones fall faster, land lower on the field and are brighter; each splashes for five ticks on landing. Heavy rain also dims the whole view.
  - *Snow:* up to 190 swaying flakes at several depths; white ones for the sky, blue-grey ones so they show on snow.
  - *Fog:* a veil that thickens toward the horizon (in the mood's horizon color) plus big mist banks drifting nearer the camera than the ground fog.
  - *Sandstorm:* a tan veil over everything (heavier toward the horizon), fast dust banks, and up to 520 streaks of grain racing along the wind (`wind`'s sign sets the direction), with a slow gust that swells and slackens it all.
  - *Lightning:* one strike at most per 240-tick window (`strikeAt`, a pure function of the tick): a jagged forked bolt from the clouds to the horizon for the first few ticks and a screen flash that goes hard, flickers, flashes again and fades. Strike odds follow the strength, so lulls are quiet. No thunder yet (the sim and audio never see it).
- **Assigned:** Meadow, showers across all three levels (drizzle, then settling in, heaviest in the third); Haunted Keep, a storm that builds with lightning; Frozen Pass, snowfall and a late whiteout; Sunken Marsh, drizzle and fog. Scorched Dunes, a sandstorm that gathers toward the end.
- **Preview:** in dev builds `?weather=rain,lightning:0.5,fog,sandstorm` forces weather on any level, held steady (no surges or fades; the number after the colon is its strength), and `?weather=none` turns it off. Combine with `?biome=N`.

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
   - **Sunken Marsh (done, biome 3).** `SUNKEN_MARSH` in `biomes.ts`; `?biome=3` forces scenery and enemies. A drowned bog under a heavy overcast.
     - *Sky:* a grey-green murky dawn, a hazy overcast day (the sun low behind the cloud banks, never clear), a poisonous yellow-green dusk, then a dark bog night with a big pale crescent (`moonScale` 2.4) and stars showing through gaps in dense clouds (two `clouds` layers of 12 to 14, tinted grey-green).
     - *Parallax:* a hazy far shore (`makeMountains`), a far reed bank (`makeMarshReeds`), a line of stilt huts, jetties and rotten pilings (`makeMarshStilts`; the huts' windows are recorded in `layerLights` and lit a sickly yellow by `ParallaxLayer.windows`), then a hazy and a near-black line of bald cypress, dead snags and mangroves on prop roots, all hung with moss (`makeMarshTrees`). Variants chain as elsewhere.
     - *Ground:* dark olive-brown peat tiles (`makeMarshFloor`, kept mid-dark and low-contrast so the enemies' saturated yellow-greens, ochres and pale bellies pop), soft mottling, murky green pools with a dark wet bank, sheen dashes and lily pads (`makeMarshWater`), algae scum and wet-mud patches (`makePatch`), a churned wet-mud track (the `path` ribbon: dark edge, water gleaming in the ruts, reed fringe; no boardwalk, the path system has no planks), and decals: marsh grass, cattails, reeds (these sway), lilies, a half-sunk log, a mossy stump, a moss-stone frog statue, skulls, ribs and bones, bog flowers, toadstools, glowing toadstools (`glow`) and a rusted helmet.
     - *Weather:* two heavy low mist banks (`big` fog) and 44 drifting fireflies, gnats and spores (`ambient`, yellow-green). No `destination` landmark yet.
     - *Readability:* checked with a full horde (bots) and in the boss arena.
   - **Modular ruins.** The ruins skyline is assembled from pieces (`makeRuins`): wall segments (crenellated or broken, some with window holes), towers (crenellated, shattered, roofed or flat, with arrow slits), gatehouses with arched openings, pitched-roof halls with chimneys and collapsed patches, buttresses, spires, broken pillars and rubble. Pieces are joined edge to edge (overlapping a pixel) into buildings of 1 to 5 pieces with at least one tall anchor; buildings bunch into clusters with wide gaps between (about half follow right alongside the last). Tree lines use `scatter` for the same uneven spacing: mostly tight gaps and the odd wide one, instead of even slots.
   - **Torchlight.** `ParallaxLayer.lights` lights the torch positions baked into a layer's strips (`Sprites.layerLights`, recorded per variant by `makeRuins`). The brackets are in the stone; the flame (two frames) and a warm three-disc glow are drawn live, each torch flickering on its own phase. They are emissive: the glow is not dimmed by the time of day and grows at night.
   - **Lit windows.** Tower arrow slits (1 x 3) and hall windows (2 x 3) are cut into the stone dark and recorded as rectangles beside the torches (`layerLights`, entries with a size). `ParallaxLayer.windows` lights them live: a share of them (`lit`, 0.7 in the Keep) glow, each in a color picked per window (mostly warm yellow, the odd eerie teal), with a small halo that grows at night, and the odd lit window blinks out for a moment. Emissive, like the torches, so the time of day doesn't dim them.
   - **Ground fog.** `BiomeDef.fog`: layers of dithered wisps (`makeFog`: lobed clouds thinning to the rim, ordered-dithered to single pixels) that wrap around a 960 px loop, scroll with the camera by `k` and slide by `drift` per tick. A thin layer sits near the horizon and a wider one over the floor. Drawn over the floor and decals but under the characters, so a horde stays readable.
   - **Scorched Dunes (scenery done, biome 4).** `SCORCHED_DUNES` in `biomes.ts`, paired with `ROSTERS[4]`; `?biome=4` forces both. Marked `dunes:` in `art.ts`; generators under `// ---- Scorched Dunes` at the end of `bgArt.ts`.
     - *Sky:* a pale gold dawn, a blinding bleached noon (almost no sky colour, tint white, sun high), a blazing orange-crimson sunset, then a cold deep-blue night with full stars and a big moon (`moonScale` 2.4). A tall heat-shimmer haze (`haze`) and a few thin high clouds.
     - *Parallax:* far flat red-rose mesas, buttes and a crumbling step-pyramid on the horizon (`makeDesertSkyline`: sandstone blocks lit on the left, shaded on the right, with strata bands, over a low dune foot), a ridge of far dunes (`makeDunes`: the lee face of each crest shaded, faint ripples), a mid skyline of obelisks, wind-carved arches, broken columns and mesas in ochre, nearer dunes, and a line of wind-bent dead palms and flat-topped acacias (`makeDeadPalms`) as dark silhouettes. All in variants, as the other biomes.
     - *Ground:* a calm mid-sand floor (`makeSand`: three close shades with sparse grain, flecks and short ripple streaks; no pure white), gentle wind-ripple patches (`makeSandRipples`) and dry-scrub patches, a worn caravan track (packed darker sand, ruts, scrub fringe), and sparse flat decals: cacti (some in bloom), dry scrub and tumbleweeds, bleached skulls and ribcages, pottery sherds, sandstone rocks, a half-buried statue head, a tattered flag on a stake and a camel skeleton.
     - *Weather:* low sandy fog bands (fast `drift`) instead of mist and 70 sand streaks driven by a strong wind (`ambient.bias` 0.85 to the right), with `wind` swaying scrub and flags.
     - *Readability:* enemies here are deep crimson, indigo, rust, bronze and teal on bright sand, so the floor stays between cream and ochre tan (brightest tile pixel about 0xeed6a2), the mottle is gentle (alpha 0.2), and the path and patches differ from it by only a step or two.
   - To do:
5. **Art pipeline.** Background sheet type in the art workbench (`tools/art.mjs`), a separate background atlas loaded per biome, and a scrolling preview mode for iteration. Authored art for parallax silhouettes; procedural for gradients, tiles and scatter.
6. **Level integration.** Node types override sky and tint (boss arena, rest camp), biome transitions once there is a run map, and entity ambient tint so characters match the light.

## Open

- Should characters pick up the ambient tint (phase 6), or stay fully lit for readability? Default: a light tint only, so enemies stay readable at night.
- Night biomes: stars and moon are cosmetic; no gameplay visibility effects.
