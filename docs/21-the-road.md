# 21 — The Road (Proposed; snapshot and restore done)

A run is **one long level**: a finite road that starts in the town and ends at the Writ's destination, walked without a cut. There are no levels, no stores between them and no finish lines. The party walks through places that turn gradually into one another, picks a way at forks, makes choices along the way, and the run ends at the destination's final boss. **Falling always ends the run.** The game saves as it goes, so a run can be left at any moment and continued another day, by the same party or a different one, and heroes can join a run already under way.

**Length: about 30 minutes for a party that makes it through.** Today's 15-level route is about that already: winning expert bots take 25 to 37 minutes over about 48,000 px of road (15 levels and their stores; a level and its store overlap by a screen, so this is less than their lengths added up; on the one road, which grows around its calm places, the same levels are about 80,000 px: see step 3) (`pnpm sim -- --class=warrior,archer --skill=expert --runs=3`). An ordinary 2,800 px field takes them 60 to 100 s, a boss field 150 to 300 s. So the target is set by measuring bot runs rather than by pixels: about a third of the time goes to boss fights, the rest to walking and fighting along the road.

This replaces the route of levels and stores in [07](07-procgen.md) ("The camp", "Implemented (v0)") and the per-stage biomes of [17](17-generated-scenery.md). Those docs are updated as each part lands.

## Where we start from

Most of the pieces are already continuous:
- The scenery is drawn in road coordinates (`roadOffset`, `ROAD_STRIDE`) and the road turns between biomes wherever its own plan says ([17](17-generated-scenery.md)).
- Encounters are planned from the seed and spawned lazily (`planLevel` / `streamLevel`, [07](07-procgen.md), "Streamed encounters").
- The peddler sells by walk-up, level-up picks are made in the field, and road scenes are staged in the field.
- Entity positions are `Float64Array`, so long distances are safe.

What is not: every level and every store is its own sim (`newSim` in `main.ts`), stitched together by carrying the party across (`sim/carry.ts`). Difficulty, the enemy mix, the boss, quests, the barks' chapter wording, the music and the balance tools are all counted per level, and the route position lives in `main.ts`, outside the sim (the shop and quest state are in `GameState` now).

## The town: where every run starts

The road begins in the **starting town**, built into the road itself, not a separate screen: the first thing the scenery shows, in the run's own generated look.
- **One screen, no scrolling.** The town fits the view (640 px). The camera holds still while the party is in town; the heroes walk freely between its places.
- **Meta upgrades are built here.** The town's places are where the party spends what carries over between runs (Renown and the class trees of [04](04-classes-progression.md), and whatever else the meta grows into): each place (a trainer, a smithy, a chapel...) is something a hero walks up to and uses, with the per-player panels allowed here because no fight is running. Building up the town is the visible record of that progress.
- **Leaving.** The town's gate at the right edge is the start of the road: when the party walks through it, the camera lets go and the run proper begins. The town's places replace the hub of [12](12-story.md) (the Writ board, the Registrar, the tavern) as far as the run's loop goes.
- **Heroes join here** at the start of a run (the party select becomes walking in at the town).

## The road: a graph of regions, a line of stretches

```
run seed + choices ─► RoadMap (graph of regions)          pure: the same seed and choices give the same road
                         start ─► tier 1 ─► tier 2 ─► spine ─► tier 3 ─► tier 4 ─► destination
                                  (2-3)     (2-3)      (1)      (2-3)     (2-3)       (1)
                      └► each region: a line of stretches, generated as the party nears them
```

- **Regions.** One generated place each (Phase B; until then, one of today's archetypes). A path through the graph passes about five regions, as many as today's stages; the graph holds 10 to 12. Every region in a tier has the same **depth**, so difficulty does not depend on the way taken. **Spine** tiers have a single region, which every route passes through: the story's reserved beats go there ([12](12-story.md), "no route can avoid it"). The destination is the last region; its lair holds the final boss, and beating it wins the run.
- **Stretches.** A region is a line of stretches, each `stretchAt(seed, regionId, k)`, a pure function, so anything ahead can be generated (or regenerated after a load) at any time.

| Stretch | What happens |
|---|---|
| Wilds | Open fighting: encounters planned as today's field, streamed as today |
| Ambush / gate | A wall of enemies or an elite; the camera is held until the screen is clear (today's gates) |
| Site | Shrine, chest, mini-boss (today's `sites.ts`) |
| Scene | A road scene from the story, the field around it cleared |
| Camp | The peddler, a quest-giver, the Registrar's remark; a breather. What the store was, without leaving the road |
| Quiet walk | A short calm stretch: pacing, a view, a set piece (a bridge, a village) |
| Lair | The region's boss, held like a gate |
| Crossroads | The fork into the next tier (below) |

- **Coordinates.** The sim works in absolute road x. A region's stretches sit end to end along the chosen path; anything generated is laid out in region-local x, so a region's content does not depend on how the party got there.
- **Difficulty by distance.** `depthScale` / `depthDamage` take the region's depth plus progress through it; the enemy mix moves through the region's cast with progress. Pacing comes from the stretch order (camps and quiet walks are the breathers), not from level breaks.
- **Forward only, with slack.** The camera never goes back more than `SLACK` (about a quarter screen) behind the furthest it has been, and heroes cannot leave the view. Everything further behind is unloaded.

## Forks and choices

**Forks between regions.** A crossroads closes every region but the last. The road's ribbon splits into a far branch (up the field, toward the horizon) and a near one, with a signpost on each: icons for the place it leads to (its kind and climate) and what lies on it (a camp, a shrine, a lair; in later chapters "settlement" or "stronghold", as [12](12-story.md) plans). The party **chooses by walking**: at the commit line, the branch with more heroes standing on it wins (downed heroes do not count; on a tie, the one the first active hero stands on). The rest are pulled along with the camera. The commit line lies at least a streaming margin before anything of either branch is spawned or visible, so nothing has to be taken back. The road's turn into the chosen region starts after it.

**Detours inside a region.** Now and then the path splits for a short way and rejoins: a side path through a ruin with a chest and an elite, beside the safe road. The same walking rule chooses.

**Choices for the characters.** Some choices belong to one hero, not the party: each hero walks to an option and presses the interact button. All of them are input actions (`uiAction`, [08](08-multiplayer.md)), never menus, so they are deterministic and part of the save.
- Already in the game: shrines (accept or pass), spare or slay ([12](12-story.md), mercy), the peddler's one-of-a-kind goods.
- New: a camp's boon fork (each hero takes one of two), wayfarers on the road (help or rob), offering stones, a class-voiced vow. Conscience-type choices are written to the Ledger when the run ends.
- **Choices can shape the road:** a spared clan can show a hidden branch at the next crossroads ([12](12-story.md), "secret routes"). This works because the road is a function of the seed *and* the choices.

## Saving and continuing

**The save is a snapshot of the sim plus what cannot be regenerated.** Everything generated is rebuilt from the seed on load: the cast, the folk, the party's looks, the regions' art, the road ahead.

```
RunSave { v, gen, config: { seed, heat, party }, choices[], sim: snapshot }
```

- **Prerequisite: all gameplay state lives in `GameState`.** The shop's stock and what was sold, and the quest offers and the quest taken, are in the sim already (step 1 below); the route position still has to move out of `main.ts`. [08](08-multiplayer.md) already requires a serializable `GameState`; this builds `serialize` / `deserialize` (typed arrays cut at `highWater`, the rest as JSON). The guard test: play N ticks, snapshot, restore, play M more; the state hash must equal an unbroken N+M run, across seeds, classes, bosses, totems and quests.
- **When it saves.** About every 10 seconds of play (at a tick boundary, so nothing is lost but the last few seconds), on reaching a camp, at every crossroads commit, on **Save and quit** from the pause menu, and on `pagehide` / `visibilitychange`. One run slot, plus the previous autosave kept as a backup against a damaged write. IndexedDB (the snapshot is up to about 1 MB raw, roughly 100 KB compressed), with localStorage as the fallback.
- **Continuing.** The title shows **Continue**. Regenerate everything from the seed, replay the choices into the road, restore the sim, paint the regions in the atlas window, then hold the field frozen until each player presses a button (like `tutorialHold`), so no one wakes up mid-fight. Players claim slots on that screen, and **the party need not be the one that saved**: a saved hero no one claims leaves the run (their gold stays in the shared purse), and a new player can take a free slot.
- **The generated look of a hero belongs to the slot**, not the player ([20](20-generated-heroes.md)), so a continued run keeps its looks.

## Joining a run under way

A player can join at any moment, not only when continuing: the same drop-in as today, but into a run that may be deep down the road.
- **The newcomer is brought up to strength**: they join at the party's average level (rounded down), with that many picks waiting to be made in the field (offered from the run's seed as any other pick), and the boons and upgrade ranks a hero of that level would usually have by then, so they are useful at once without outshining those who earned it.
- **The horde scales** with the party size as it does now ([03](03-gameplay-combat.md)): encounters spawned after the join are sized for the bigger party.
- Leaving works the other way: a hero who drops out takes nothing with them, and the horde shrinks for encounters still to come.
- **Versions.** `v` is the shape of the save, migrated like the Ledger (`campaign/storage.ts`); a save from a newer build is never overwritten. `gen` is the generators' version. Everything already spawned is in the snapshot, so a newer generator only changes the road not yet generated and the art; a save with an older `gen` still loads (dev builds log it). If a shape change cannot be migrated, the title says so and offers to abandon the run, never a silent corruption.
- **The end of a run.** Winning, falling or abandoning writes the run to the Ledger as today, and deletes the run save.

## Sim changes

- **No world width.** Anything sized by `WORLD_W` becomes a window that moves with the camera (the spatial grid gets a moving origin); `worldW`, `exitX` and the field-end camera clamps go. Everything more than a margin behind the camera's slack line is despawned (corpses, pickups, stragglers, `Fx` ground marks), and a test walks hours of road and checks that the entity count and memory stay flat.
- **Encounters per stretch.** `planLevel` becomes `planStretch`; streaming and the reinforcement director stay, keyed to the stretch's kind and depth.
- **Bosses.** The region's lair holds the camera as a gate does; the destination's lair ends the run.
- **Quests** are taken at a camp and run until the next camp. **Music** turns at the middle of a region's turn. The **barks' wording** follows the region's tier.

## Rendering

- The scenery's `World` becomes the regions along the chosen path. The atlas's scenery band holds a window of three: the region behind, the current one and the next.
- **The commit is when the next region becomes known**, so that is when it is painted, spread over frames, well before any of it is in view. Until the commit the signposts need only icons (or, later, each branch's far landmark).
- The road's turns, the share curve and the element-by-element mixing ([17](17-generated-scenery.md)) are unchanged; only where turns lie changes.

## Order of work

**Phase A: the road, with today's art.** Each step is test-guarded; A3 to A5 run behind `?road=1` until they reach parity.
1. **Snapshot and restore. Done.** `snapshot(s)` / `restore(text)` (`src/sim/snapshot.ts`): the whole `GameState` as JSON, typed arrays as base64 cut where their tail is all one value (so the entity arrays cost only what is in use; a mid-fight save is about 120 KB of text before compression), numbers JSON cannot carry (`Infinity`, `NaN`, `-0`) kept, scratch space and unread events rebuilt instead of saved. It refuses anything that is not plain data, so a `Map`, a class or a closure added to the state fails the tests at once. `snapshot.test.ts` plays bot parties (warrior, shaman, archer; mage and cleric on a boss field; an escort quest; the store) straight through and with a save and restore in the middle, and requires the two to end identical in every byte of the state, not only in `hashState`. The store's trading moved into the sim to make this possible: `GameState.wares` (the goods and what has sold), `offers` and `questTaken` (the quest-givers), traded by the trade button in `updateTrade` (`sim/shop.ts`) with an `Ev.Trade` event for the words shown after a press; `main.ts` and the AI runner no longer trade themselves. Useful by itself for online play later. What a save needs beyond the sim (the run's config, the route position, the choices) comes with step 4.
2. **An unbounded sim. Done.** Nothing in the sim is sized by `WORLD_W` any more: a field is `GameState.worldW` long (`SimOptions.length`, default `WORLD_W`), and `planLevel` lays as many encounters per px whatever the length. The spatial grid covers a window that moves with the camera (`Grid.x0`, from `CAM_SLACK + LEFT_BEHIND` behind it to 900 px past the screen; a mob outside it is filed in the edge column, slower but still correct). The camera keeps `camMax`, the furthest it has been, and backs up at most `CAM_SLACK` (160 px) from there, only while a hero presses against the left edge. `backLine(s)` (`camMax - CAM_SLACK - LEFT_BEHIND`) is the line behind which nothing lives: mobs, shots, passed shrines and chests, zones and totems behind it are removed (`cullBehind`; coins and potions already go once behind the screen; the quest's people are left to the quest). `longroad.test.ts` walks a bot 10,000+ px along a 30,000 px field and checks the live entities (at most ~1,400), the slots in use and the save size stay bounded, the grid at x = 150,000, and a save and restore far along the road. Found on the way: enemies standing past a shut gate (a shooter out of a melee hero's reach) held it shut for good; a gate now counts only the enemies on the party's side of it.
3. **The road. Done, as a first cut, behind `?road=1`.** One sim walks the whole route (`SimOptions.road`, `GameState.road`, `src/sim/gen/road.ts`). For now the road's fighting stretches are today's levels, so the balance of a fight is unchanged while the rest is built. Sim coordinates on the road are road coordinates, so the scenery, weather and time of day line up; the scenery is told where each biome's stretch begins (`stageBounds`, passed to `generateWorld`), since the road grows (below). A level is planned when the screen nears it (`planRoadLevel`: its own `planLevel`, laid along the road, each encounter tagged with its level's seed, biome and slice of the cast so it is the same crowd it always was; its gates; its sites via `placeSites`'s span), and a camp's goods are set out as it nears. Walking into a calm place, what is left of the horde walks off over the hill or behind the ridge (`leaveField`); the trade button trades in a camp. A boss holds the road behind a **lair gate** until it and its retinue are dead; the run is won only by the last level's boss (`checkRoadEnd`), and lost when the party is down. Difficulty (the sim's biome, slice of the cast, damage, stand down) follows the part of the road the camera's centre is in (`roadPart`). `main.ts` keeps one sim for the run and follows the road for the HUD, music, summary and the road scene being staged; the simulated players shop at each camp. **Not yet on the road:** quests and staged beats (step 6), the region graph and other kinds of stretch (with the forks, step 5), saving to disk (step 4), and the AI runner's road mode.

   **The road grows around calm places.** Camps, road scenes (and later towns, quest-givers, anything the party stops at) are *calm places* with ground of their own, and the road is laid out (`layoutRoad`, a pure function of the run's seed) so the horde can never reach one; nothing is held back or cleared away, so nothing pops up when the party walks on. A level with a road scene is cut at the scene and its two stretches are pushed apart; a camp sits between two levels. The gaps follow from how the horde arrives, not from hand-placed clearings:
   - **After** a calm place, the next encounter lies `CLEAR_AFTER` (half a screen + `STREAM_AHEAD` + a crowd's spread, 1,000 px) past its end, so it streams in only once the camera's centre has left the place: off screen, walking in.
   - **Before** one, the last encounter (or gate) lies `CLEAR_BEFORE` (half a screen + a crowd's spread, 480 px) short of it, so the fight is done out of its sight.
   - While a calm place is on screen or just ahead of it, the director sends no packs (`roadDirectorOff`); sites keep off calm ground.
   - A road scene's figures are let go only once they are out of sight behind the screen.

   `road.test.ts` checks this on twelve seeds' whole roads (every encounter against every calm place, sites off calm ground) and on a played run (an expert simulated player through four levels, three camps and road scenes: no hostile on screen, nothing appearing and nothing streaming in while the party is in a calm place; a straggler that follows the party in walks off).

   **The cost is length.** A 15-level road is about 80,000 px instead of 48,000 (each of its 24 calm places adds about 2,200 px of walking: 480 before, its ground, 1,000 after). At a hero's walking pace that is roughly five more minutes on a full run. The 30-minute target is to be met by tuning (fewer or shorter levels, the spacing), measured with bot runs once the AI runner walks the road; towns and other calm places can then fill the walking with something to see.

4. **Saving.** Autosave, Continue, the hold on resume, versions and migration.
5. **Forks and choices.** The crossroads, choosing by walking, painting on commit; detours; the per-hero roadside choices.
6. **The town and joining.** The one-screen town at the start of the road with its places (a first meta upgrade or two to prove the loop), the party select as walking in; newcomers brought up to strength when they join a run under way or continue a save.
7. **Cut over.** Migrate the story, quests, music, HUD, the AI runner, `tools/balance.mjs` and `pnpm sim -- --curve` (measured by distance and stretch, with a single-stretch harness that keeps the sim tests valid); remove levels, the store sim and `carry`; dev params (`?at=N` becomes `?road=X` / `?stretch=N`); update [07](07-procgen.md), [11](11-backgrounds.md), [14](14-ai-playtesting.md), [17](17-generated-scenery.md).

**Phase B: generated places**, one per region instead of five archetypes:
1. Separate the region's theme (a climate vector: cold to hot, dry to drowned, lush to dead, eerie) from the archetype index everywhere it is read: the bestiary's per-biome flavours, the music mode, names, difficulty bumps.
2. Turn the drawing code written for one place each into parametric families (one tree family, one building kit, one relief family, floor materials), checked by rebuilding today's five archetypes as presets.
3. A palette generator with a readability test (floor brightness band, contrast against the run's monster colours).
4. `generatePlace(seed, theme)`; the archetypes live on as `CLASSIC_PLACES` (`?places=classic`). Neighbouring regions are kept apart in climate so a turn reads as a change; a region can drift inside itself (a forest thinning into heath).
5. New families (villages, palisades, giant fungi, crystal growths, ash and cobble floors...), a place roller in `art/`, `tools/place-sheet.mjs`, and a generated destination landmark for every region.

**Later and separate:** terrain on the field itself (pits, bridges, walls) touches collision, pathing, bots and the entry over the hill, and waits until the above is done.

## The story needs rethinking (to do)

The story beats stay, but how they are delivered has to be worked out again for this kind of run. [12](12-story.md) was written for runs of separate levels started from a hub with a Writ board, and some of it no longer fits: no run revisits an earlier run's road (so the Quiet Regions walk, R9, goes or changes), the hub becomes the town at the start of the road, and the per-level chapter wording, road scenes and reserved beats must find their place on one continuous road with forks. Until that rework, keep the beats working where they are (reserved beats on spine regions, road scenes as scene stretches) and avoid building anything new on the old hub.

## Open

- What the town's places offer: which meta upgrades, what they cost, and how the town looks as it is built up.
- What a newcomer joining deep in a run gets exactly (picks to make, or picks made for them; boons drawn how).
