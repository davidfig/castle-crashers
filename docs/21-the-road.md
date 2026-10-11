# 21 — The Road

A run is **one long level**: a finite road that starts in the town and ends at the Writ's destination, walked without a cut. There are no levels, no stores between them and no finish lines. The party walks through places that turn gradually into one another, picks a way at forks, makes choices along the way, and the run ends at the destination's final boss. **Falling always ends the run.** The game saves as it goes, so a run can be left at any moment and continued another day, by the same party or a different one, and heroes can join a run already under way.

**Length: about 30 minutes for a party that makes it through.** Today's 15-level route is about that already: winning expert bots take 25 to 37 minutes over about 48,000 px of road (15 levels and their stores; a level and its store overlap by a screen, so this is less than their lengths added up; on the one road, which grows around its calm places, the same levels are about 46,000 px: see step 3) (`pnpm sim -- --class=warrior,archer --skill=expert --runs=3`). An ordinary 2,800 px field takes them 60 to 100 s, a boss field 150 to 300 s. So the target is set by measuring bot runs rather than by pixels: about a third of the time goes to boss fights, the rest to walking and fighting along the road.

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
- **When it saves.** Every 10 seconds of play (at a tick boundary, so nothing is lost but the last few seconds), on reaching a calm place (a camp, a road scene), at every crossroads commit (step 5), on **Save and quit** (Escape, or a pad's Back / View button) and on `pagehide` / `visibilitychange`. One run slot, plus the previous save kept as a backup against a damaged write. **localStorage, uncompressed**: the last save is written as the page closes, and only a synchronous write is sure to finish then, which rules out IndexedDB and `CompressionStream`. A save is about 60 KB of text early in a run and a few hundred KB in a big fight (entity arrays are cut where they stop being used), so two fit comfortably; it takes about 2 ms.
- **Continuing.** The title shows **Continue** (C, or a pad's Y) with where the run was and who was in it. Regenerate everything from the seed, replay the choices into the road, restore the sim, paint the regions in the atlas window, then hold the field frozen until each player presses a button (like `tutorialHold`), so no one wakes up mid-fight. Players claim slots on that screen, and **the party need not be the one that saved**: a saved hero no one claims leaves the run (their gold stays in the shared purse), and a new player can take a free slot.
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

   **The road grows around calm places.** Camps, road scenes (and later towns, quest-givers, anything the party stops at) are *calm places* with ground of their own, and the road is laid out (`layoutRoad`, a pure function of the run's seed) so the horde can never reach one. A level with a road scene is cut at the scene and its two stretches are pushed apart; a camp sits between two levels. The empty ground is kept as short as these guarantees allow (a 15-level road is about 46,000 px, a little shorter than the old levels and stores), and nothing pops up:
   - **Nothing streams in while the party is in a calm place** (`streamLevel`), and the moment it has left, the next crowd is spawned just off the right edge of the screen wherever its plan puts it (`SPAWN_MARGIN`, `crowdSpread`) and walks in. So the gap after a place (`CLEAR_AFTER`, 260 px) does not have to hide anything: it only has to be long enough that the gate of the encounter after it lets the camera's centre leave the place.
   - **Before** a calm place, the last crowd lies `CLEAR_BEFORE` (a crowd's spread + 60, 220 px) short of it, so its crowd does not reach the ground, and **it holds the party with a gate** until it is dead (`levelEncounters`), so nobody walks into a camp or a scene with a fight still on. What is left when a party walks into a place anyway is sent away unkilled (`leaveField`), which cost kills and experience before the gate.
   - **The camp's goods, gifts and quest-givers are handed to the renderer from the moment the camp is near** (`campShown`), so they stand in place before the party arrives, off the right edge of the screen, and are never created as it gets close.
   - **The director** sends no packs while a calm place is on the screen or just ahead of it, so none walks in on whoever is shopping or listening (`roadDirectorOff`). With the calm places this close that is most of the road between them, so the progress made while it is held back is **banked** (`packDebt`, `flankDebt`, capped at five packs and three waves) and paid out gradually in the next clear stretch; dropping it, as the first cut did, removed about 40% of a level's fighting.
   - Sites keep off calm ground, and a road scene's figures are let go only once they are out of sight behind the screen.

   `road.test.ts` checks this on twelve seeds' whole roads (every encounter against every calm place, sites off calm ground) and on a played run (an expert simulated player through four levels, three camps and road scenes: no hostile on screen, nothing appearing and nothing streaming in while the party is in a calm place; a straggler that follows the party in walks off).

4. **Saving. Done** (on the one road). `src/campaign/runSave.ts`: `makeRunSave` (the snapshot, the run's config, the level and heroes for the title), `writeRunSave` (the previous save becomes the backup, but a damaged one never pushes out a good backup, and a newer build's save is never overwritten), `loadRunSave` (falls back to the backup), `clearRunSave` when the run ends (won, lost or abandoned), versions (`RUN_SAVE_VERSION` for the shape, migrated in `parseRunSave`; the snapshot's own version; `GEN_VERSION` recorded, not enforced). `main.ts` autosaves as above; Continue rebuilds the cast, folk, heroes and scenery from the seed, restores the sim and holds the field frozen (`resumeUpdate`, drawn by `render/resumeHud.ts`): a press takes a slot, attack from someone who has one plays on; a saved hero nobody took leaves the run (`leaveParty`), and a newcomer in an open slot joins beside the party (at level 1 until joining is done properly, step 6). Tests: `runSave.test.ts` (round trip, backup, newer builds, junk, a full store, clearing, a hero leaving). Checked in the browser: autosave, Escape to the title, a reload, Continue, the hold, playing on. Note: a dev run on the road (`?road=1&seed=N`) saves too, over any saved run.
5. **Forks and choices. Done in part.**
   - **Crossroads** (`sim/gen/road.ts`, drawn by `render/fork.ts`). A region is one biome's stretch (`LEVELS_PER_BIOME` levels). Past every region's last camp but the last region's, the road comes to a crossroads, a calm place of its own (`kind: 'fork'`, `FORK_LEN` 900 px, straight after the camp): an upper and a lower road with a signpost each, naming the place it leads to as this run's world names it and the boss whose lair is at its end, stones between them up to the commit line. The two roads are two biomes other than the one being left, ones not yet seen first (`forkOptions`). The party chooses by walking: when a hero on their feet crosses the commit line, the side more of them stand on wins, a tie going to the first hero's side (`forkChoice`). The choice sets the next region's biome (`levelPlan`'s new `biome`), so its enemies, scenery and boss; difficulty stays with the depth. Nothing past a crossroads is planned until then; the commit (`commitFork`) records the choice in `RoadState.choices`, works out the regions' biomes (`roadBiomes`) and lays the road ahead out again, leaving what lies behind as it was (tested). The save carries the choices with the sim. The scenery is repainted for the chosen biome at the commit (no visible hitch in the browser: the worst frame stayed under 10 ms), and on the road each biome turn begins only past its crossroads (`planRoad`'s `after`), never before the choice. `?at=N` takes the upper road at every crossroads on the way.
   - **A camp's gift** (`data/gifts.ts`): two boons on pedestals in every camp on the road, boons any class can use (not legendary, no fusions, nothing that needs a class-tree unlock). Each hero may take one of the two with the trade button, their own choice; the others choose for themselves (`GameState.gifts`, `giftPick`, traded in `updateTrade`).
   - Tests: `road.test.ts` (crossroads in the layout, nothing planned past one, the vote, the road re-laid with the past unchanged, a save after a choice, an expert player choosing its road on a played run), `gifts.test.ts`.
   - **Not yet:** detours inside a region; the other per-hero choices (wayfarers on the road, offering stones, a vow); choices that shape the road ahead (a spared clan showing a hidden branch); the simulated players do not take gifts or aim for a side at a crossroads (they take whichever side they happen to be on).
6. **The town and joining. Done** (on the road).
   - **The town** (`data/town.ts` where things stand, `sim/town.ts` what they do, `render/town.ts`). The road's first calm place, a screen wide (`TOWN_W`): the camera holds on it (`updateCamera`), nothing of the road is planned, and the first fight keeps clear of it like any other calm place; a hero walking out through the gate (`TOWN_GATE_X`) begins the road. A new run on the road skips the lobby and opens here: players join by pressing a button (a device claiming a slot), take up a class at its banner stand with the trade button (`resetHero`), set the road's heat at the shrine (the road is planned at the heat it sets out with), and spend renown at the town's places. The controls tutorial waits until the party has left the town.
   - **What carries over** (`data/meta.ts`, `campaign/profile.ts`). A run earns **renown** (`renownFor`; shown on the summary), kept in a versioned profile (`game.profile`). The town spends it on lasting upgrades, a general layer of power the same for every class: the **Armoury** (damage taken), the **Forge** (damage dealt), the **Stables** (speed), the **Academy** (the level heroes begin at) and the **Treasury** (gold in the purse); what they are worth, what they cost and how they were tuned is in "Difficulty and the town" below. A purchase takes hold in the run at once and is written to the profile straight away, whatever becomes of the run.
   - **Joining** (`joinParty`, `sim/state.ts`): a hero who drops into a run under way (a new device pressing join), or takes an open slot when a saved run is continued, comes at the party's average level (rounded down) with that many level-ups to choose in the field, and with the town's upgrades. Alone, or with a party still at level 1, a fresh hero.
   - Tests: `town.test.ts` (the town's ground, the camera holding and letting go, class stands, building with renown and its refusals, setting out with the town's upgrades, the heat, joining and dropping in, a save in the town, renown and the profile).
   - **Not yet:** more of the meta (the class trees of [04](04-classes-progression.md)); how the town looks as it is built up (it is drawn plainly for now); a newcomer chooses their class only in the town (one joining mid-run plays the class their slot last had, or the slot's default).
7. **Cut over. Done.** The road is the only way to play. `main.ts` keeps one sim per run (title, town, road, summary); the lobby, the per-level sims, the store sim (`GameState.store`), the carry between sims (`sim/carry.ts`), walking on from a won field and the dev shortcuts for them (`?store`, `?boss`, `?goto`, `?scene`, `?quest`, `?road`) are gone; `?seed`, `?levels`, `?at`, `?class`, `?bots`, `?skill`, `?boons`, `?pending`, `?gold`, `?calm` (now enforced every tick), `?beat` and `?demo` (still a field of its own) remain. Single-field sims (`createSim` without `road`) stay as the sim tests' harness.
   - **Quests on the road**: givers stand in the camps in the middle of a region (none before a crossroads: a cull needs the next level's creatures); a quest taken there begins as the party walks into the next level (`beginQuest`, its bodies placed along that level's stretch, a race counting from then) and is settled at the next camp (`endQuest`, `settleQuestNow`), where a ward or a captive goes home.
   - **The opening beat** (R1, the cookfire) is staged in the first level (`SimOptions.road.beat`).
   - **The party rests in every camp** (`restParty`: on its feet, full health, rid of ailments), as it did on the way into a store.
   - **The AI runner plays the road** (`src/ai/runner.ts`): one sim, its report cut into the road's levels and camps as before, so `pnpm sim` and the balance tools work unchanged; a part of the road over 15 minutes is a timeout.
   - **Balance parity, and what changed.** Two things were found and put back: the director measured its advance over the road's grown gaps (fixed: it counts only each level's own field, `roadAdvance`, and stops in a level's last screen as before), and growing the road around a scene had kept every encounter the scene's clearing used to remove (fixed: a level keeps the encounters it had, `levelEncounters`). With those, kills per run match the old route. What remains different, by design: (1) a level's horde now **arrives as the camera reaches it** instead of in one burst when the level began (nothing pops in), which is gentler but slower to fight through, most for area-damage classes; (2) the regions after a crossroads come in **the order the party chooses**, so a biome tuned for one depth (the Frozen Pass's bump) can come earlier; (3) about 4 minutes more walking on a full run. On 8 seeds each, an expert run now takes 31 min (warrior) to 51 min (mage) against 26 to 35 before, and win rates moved both ways (warrior-average 63% to 25%, archer-average 13% to 25%, mage-expert 38% to 50%). The balance pass followed (below).

**Phase B: generated places**, one per region instead of five archetypes:
1. Separate the region's theme (a climate vector: cold to hot, dry to drowned, lush to dead, eerie) from the archetype index everywhere it is read: the bestiary's per-biome flavours, the music mode, names, difficulty bumps.
2. Turn the drawing code written for one place each into parametric families (one tree family, one building kit, one relief family, floor materials), checked by rebuilding today's five archetypes as presets.
3. A palette generator with a readability test (floor brightness band, contrast against the run's monster colours).
4. `generatePlace(seed, theme)`; the archetypes live on as `CLASSIC_PLACES` (`?places=classic`). Neighbouring regions are kept apart in climate so a turn reads as a change; a region can drift inside itself (a forest thinning into heath).
5. New families (villages, palisades, giant fungi, crystal growths, ash and cobble floors...), a place roller in `art/`, `tools/place-sheet.mjs`, and a generated destination landmark for every region.

**Later and separate:** terrain on the field itself (pits, bridges, walls) touches collision, pathing, bots and the entry over the hill, and waits until the above is done.

## The balance pass

After the cut-over a run on the road was longer and a little harder than the old route. Measured with the AI runner (`pnpm sim`, 8 to 12 seeds of each class at average and expert skill, `--curve` for the per-level picture), the time went to two places: **walking** (the empty ground the road grew) and **boss levels** (more than half of a run, the first boss the longest and the last a wall). What was changed, in the order it was found:

| Change | Why |
|---|---|
| The empty ground is made short, not fast (above: spawn off the edge after a calm place, small gaps, tighter camp and crossroads grounds) | the road is now about 46,000 px (the old route: 48,440), with no faster walking: **the party never speeds up** |
| `STREAM_AHEAD` 520 to 300 px | a foe spawned far off is a long wait for the party, most for ranged and area classes; still out of sight |
| `ROAD_BOSS_HP` 1 to 0.75 | shorter boss levels; the last boss no longer a wall (27% of deaths on its own, now 12%) |
| `DAMAGE_END` 2.3 to 2.15 | the last region's levels were flagged hard |
| A gate on the last crowd before every calm place, and the director's banked progress | shorter gaps were removing fights: kills per level fell by half on the levels with a road scene (the party walked into the place with a crowd still alive, and the director sat out most of the stretch). Both put the kills back |
| `ROAD_HORDE` stays 1 | tried down to 0.65: barely shorter, and harder, because a smaller horde starves the heroes of experience |

The knobs stay available to the probe: `pnpm sim --horde=X --boss-hp=X`.

**Result** (12 seeds each, solo hero, with the base game as it was then, `ROAD_HARD` 1 and nothing built; old route in brackets, from the last commit before the cut-over. The base game is much harder now: see "Difficulty and the town" below):

| | win% average / expert | minutes, expert | kills, expert |
|---|---|---|---|
| warrior | 58 / 92 (63 / 100) | 24 (26) | 14,900 (15,400) |
| archer | 25 / 50 (13 / 63) | 28 (29) | 12,100 (11,900) |
| mage | 42 / 42 (63 / 38) | 32 (35) | 10,500 (9,400) |
| cleric | 100 / 100 (100 / 100) | 32 (36) | 15,200 (15,500) |

Wins average 64% against 67.5% before, inside the noise of 12 seeds; deaths are spread over the five bosses (4 to 13% each) and no level but the easy opening ones is flagged. Expert runs take about 29 minutes. The mage, always the slowest, is the longest: its fights are slow against a horde that arrives a little at a time rather than in one crowd.

## Difficulty and the town

**The design.** The base game is meant to be very, very hard: a party with none of the town's upgrades should meet a road that only a very good player can beat, and slowly. The town's upgrades are how the game becomes beatable with ordinary skill. So the road is balanced *against how much the town has been built*, not against an empty-handed party, and two numbers carry it: `ROAD_HARD` (`sim/gen/road.ts`, how hard the road hits against the depth curve, 1.9) and the places in `data/meta.ts`. The class trees ([22](22-class-trees.md)) deliberately sell no raw stats, so they widen what a character can be and this general layer supplies the strength.

**The places** (all layers of their own, multiplied in beside the run's boons, so none takes a card out of a level-up hand; `RoadState.metaMul`, applied in `step.ts`):

| Place | Per rank | Ranks | Cost of the ranks | Fully built |
|---|---|---|---|---|
| Armoury | 11% less damage taken | 4 | 40, 75, 110, 145 | x0.56 |
| Forge | 14% more damage dealt | 5 | 50, 90, 130, 170, 210 | x1.70 |
| Stables | 7% faster | 3 | 30, 60, 90 | x1.21 |
| Academy | hero begins a level higher, with the level-up to choose | 4 | 60, 105, 150, 195 | level 5 |
| Treasury | 60 gold in the purse | 4 | 30, 55, 80, 105 | 240 gold |

Everything costs 1,980 renown. A run earns `renownFor` = 4 per level cleared, 15 per boss slain, 1 per 50 kills, 25 for winning, and a floor of 15 for any party that set out from the town (so a run that ends on the first level still moves a player on, and one quit in the town earns nothing).

**What it comes to** (`pnpm sim --renown=N`, which spends N renown in the order a sensible player would: one rank of each place in turn; warrior, archer and mage at 20 seeds each; the cleric is left out, see below):

| Town built | novice | average | expert |
|---|---|---|---|
| nothing | 0% | 5% | 32% |
| 800 renown | 2% | 25% | 60% |
| everything | 10% | 65% | 80% |

(The percentages are runs won.) With nothing built an expert wins about one run in three and a typical player almost never; fully built, an ordinary player wins two runs in three. Using the earnings the same runs produced, an average player needs about 5 runs to reach 800 renown and about 9 to build everything, an expert 3 and 6, and a novice, who dies on the first level, about 25 and 44 (a first rank every two or three runs). The run times are as in the balance pass: 12 minutes for an average player who dies around the third boss, 20 to 30 for one who gets through.

**Re-tuning it.** `pnpm sim --class=warrior,archer,mage --skill=novice,average,expert --runs=20 --renown=0` (then `800`, `1980`), and `--hard=X` to try another base; the numbers in the table above are what to hold it to. Making the base harder moves the whole curve down; making a place stronger moves the top of it up.

**The cleric is an outlier (not yet fixed).** Its aura grinds everything around it all the time, which a horde game rewards, and it wins 70% / 85% (average / expert) with nothing built, against 5% / 32% for the others, and 100% once the town is built. What was found, for whoever picks it up:
- Its offence is ordinary (about the warrior's kills); it **takes more damage than anyone** (2.5x the warrior's) but **heals back 98% of it** in fights, from the dodge pulse (14, 24 stamina, half-second cooldown) and the nova (25 / 45), which the aura keeps fuelled (every aura hit builds fury, up to 6 per pulse).
- With no heals at all it is hopeless (0%, dead on level 3, and 23% / 60% even fully built), so the fix is a matter of degree. Heals at a quarter of their size (nova 6 / 11, dodge 3.5) with slower fury (0.35 per hit) and a one-second dodge cooldown put the base game right (8% / 38%).
- The trouble is the **slope**: whatever the base setting, the cleric climbs faster with the town than the others (58% / 93% at 800 renown, 90% / 98% fully built, against about 35% / 62% and 65% / 80%). The Armoury alone lifts every class a lot (warrior 10% to 40%, archer 0% to 35%, mage 5% to 50%, cleric 0% to 55%), and a healer gains more because its heals keep their size while the damage it takes shrinks. Scaling its heals with the Armoury barely changed this (65% / 93% to 58% / 85% at 800), so it is not the whole story.
- Chunkier, rarer heals (a nova of 14 / 26 for a full fury bar) are more fun but expert pilots time them well (55% at base). Treat the numbers with care: the cleric's skills and trees are being rebuilt in [22](22-class-trees.md), so tune it with that work, not before.
- Measure with `pnpm sim --class=cleric --skill=average,expert --runs=40 --renown=0` (then `800`, `1980`; `--meta=armoury:4` to build one place).

## The story needs rethinking (to do)

The story beats stay, but how they are delivered has to be worked out again for this kind of run. [12](12-story.md) was written for runs of separate levels started from a hub with a Writ board, and some of it no longer fits: no run revisits an earlier run's road (so the Quiet Regions walk, R9, goes or changes), the hub becomes the town at the start of the road, and the per-level chapter wording, road scenes and reserved beats must find their place on one continuous road with forks. Until that rework, keep the beats working where they are (reserved beats on spine regions, road scenes as scene stretches) and avoid building anything new on the old hub.

## Open

- How the town looks as it is built up (it is drawn plainly for now), and what more the town can sell (a place for potions, a chapel to revive from) once the class trees are in.
- What a newcomer joining deep in a run gets exactly (picks to make, or picks made for them; boons drawn how).
