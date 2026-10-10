> **Superseded for art:** the hand-pixeled enemy rigs (`art/chars`, `mobSheets.ts`) were removed; enemy pictures are generated (docs/15). Kept as history.

# Brief: the Frozen Pass enemy roster

**For:** whoever owns enemies and the roster (`src/data/mobs.ts`, `src/data/roster.ts`, `art/chars/`).
**Status: delivered.** The roster in this brief was built as written (11 enemies, types 22 to 32, `ROSTERS[2]`, 11 new rigs in `art/chars/`), the Pass is biome 2 in `BIOMES`, and `?biome=2` previews scenery and enemies together. What is still open is listed under *Follow-ups* at the end. The rest of this document is kept as the design record.

**Update: the abilities in the table below were replaced.** The first draft reused the Keep's abilities under new names (nova, blink, summon, pool, charge, shield), so every Pass enemy now has an ability no other biome uses: Trapper sets snares, Snow Sprite clings, Harpooner hooks and hauls, Frost Wolf hits and runs, Ram launches, Ice Husk shatters into shards, Yeti goes berserk, Frost Shaman wards allies, Blizzard Witch conjures a lingering storm, Whiteout Spirit reverses your movement, Tundra Guard has a chilling aura (and no shield). See the roster table in [03](../03-gameplay-combat.md). Roles, names, stats and arrival order are unchanged.

## What to deliver

A biome in this game is a pair: **scenery** (`BIOMES` in `src/data/biomes.ts`) and a **roster** (`ROSTERS` in `src/data/roster.ts`). A test (`roster.test.ts`: "a roster for every biome") requires `BIOME_COUNT === BIOMES.length`, so the two must land together.

1. **Enemy types.** Append the new `MobType` entries after `DreadKnight: 21` and the matching `MOBS` definitions. The `MobType` value is the index into `MOBS`, into `SHEETS` in `src/render/mobSheets.ts` and into `MOB_METAS` in `src/render/mobArt.ts`, so all four lists must grow in the same order.
2. **Art.** One rig per enemy in `art/chars/<name>.mjs` (see `art/README.md`), imported in `mobSheets.ts` and `mobArt.ts`.
3. **The roster.** A new entry at the end of `ROSTERS`, built with `spread([...])` like the others.
4. **Join the rotation.** Move `FROZEN_PASS` from its own export into `BIOMES` (same index as its roster), and drop `ALL_SCENERY`'s special handling if you like. After that `?biome=2` forces both scenery and enemies.
5. **Docs.** Add the Pass to the table in `docs/03-gameplay-combat.md` ("Enemy roster by biome").

## Constraints (all enforced by tests in `src/sim/roster.test.ts` and `src/render/mobArt.test.ts`)

- At least **10** enemies, **no duplicate types**, every type defined in `MOBS`.
- `spread()` gives each enemy its arrival point from its position in the list: the first is there from the start (a **single type at progress 0**), one more arrives at evenly spaced points, the last at `LAST_ARRIVAL` (0.8), so the whole cast is out before the boss. **The list order is the arrival order**, easiest first.
- A mob has a `special` **or** a `charge`, never both. A `Caster` must have a `special`. A special's `windup` must equal the mob's `windup` (except melee).
- Every enemy needs the common poses `walk`, `idle`, `hurt`, `dead`; melee needs `windup` and `strike`; ranged needs `aim` and `release`; anything with a `charge` needs `paw`, `charge`, `dazed`; casters use `windup` as their telegraph pose. Check `src/render/mobArt.test.ts` and copy a similar existing rig (e.g. `art/chars/necromancer.mjs`, `wolf.mjs`).
- Every special is **telegraphed** (a windup, a ring or lane on the ground) and a hit during the windup breaks it. Keep that promise: readability beats difficulty ([03](../03-gameplay-combat.md)).

## Theme and story hooks

The Pass is the cold high country: a mountain people and what lives with them. The story ([12](../12-story.md)) reinterprets every enemy as someone's neighbour, so the cast should be readable as *a people and their animals* more than as monsters, with a few folk-tale spirits at the far end:

- **Clan trades that fit:** herders, hunters, ice-cutters (`Clan.trade`).
- Animals (wolf, ram) are their working beasts. Spirits (sprite, whiteout, witch) are what the Pass-folk say the mountain sends.
- Keep the same rule as the existing cast: **nothing glows** except a deliberate weak point.

## Readability: the one new problem

The Pass floor is **near-white snow** (and a pale blue at night). The Meadow and Keep floors were mid-dark, so characters could be light. Here that flips:

- No white or pale-grey enemies. A yeti must be a **dark grey-blue or dirty brown**, not white. Snow Sprites and spirits should be **saturated blue or teal with a dark core**, not pale.
- The workbench's 1 px ink edge helps, but the fill must still sit well below the snow's brightness. Aim for body values around the Meadow goblin's green or darker.
- Test it: with a full horde on screen (`npm run playtest`, or `?scenery=frozen&auto=1&bots=3` and set `window.__ts = 6`), units and corpses should pop against the snow. They already do for the greenskins and skeletons.

## The proposed cast (11)

In arrival order. Stats are **first drafts** modelled on the existing enemies of the same role (see the `MOBS` entries named in the last column); tune with `npm run playtest`. Times are ticks, speeds px/tick.

| # | Enemy | Role / the question it asks | Behavior and abilities (draft) | Modelled on |
|---|---|---|---|---|
| 1 | **Trapper** | Fodder swarm in furs; arrives in waves | Melee. hp 7, speed 0.5, damage 4, cooldown 52, reach 9, windup 12 | Goblin, Skeleton |
| 2 | **Snow Sprite** | Fast, zig-zagging biter: hard to line up | Melee, `weave: 0.9`. hp 3, speed 0.85, damage 3, cooldown 40, reach 7, windup 8, knockResist 1 | Skull |
| 3 | **Harpooner** | Ranged: close in or dodge the dart | Ranged. hp 6, speed 0.42, reach 120, windup 34, `shot` of 1 heavy dart, damage 8, speed 2.6 | Archer, Bone archer |
| 4 | **Frost Wolf** | Fast pouncer whose bite chills | Melee + short `charge` (distance ~70) and `slowOnHit: 60`. hp 10, speed 0.95 | Wolf, Ghoul |
| 5 | **Bighorn Ram** | Charges often: read the lane, sidestep, punish the daze | Melee + `charge` (chance 1/300, distance ~200, dazed 60). hp 26, speed 0.4, knockResist 0.35 | Orc |
| 6 | **Ice Husk** | Slow tank that leaves a **frost pool** when it dies: don't fight in it | Melee, `onDeath.pool` (radius 24, linger 300, slow 40). hp 36, speed 0.3, damage 9 | Plague zombie |
| 7 | **Yeti** | Brute that **lobs ice boulders**: watch the red circle | A `lob` special (radius 20, damage 12, delay 50, minRange 40) on top of a heavy melee swing; it is `Behavior.Melee` with a special, like the Troll. hp 48, speed 0.34, knockResist 0.28, `regen` small | Troll + Slinger |
| 8 | **Frost Shaman** | Raises Snow Sprites: kill it first | Caster, `summon` of Snow Sprites (count 3, cap 12). hp 16, speed 0.4, reach 110, windup 50 | Necromancer |
| 9 | **Blizzard Witch** | A scream that **freezes your movement**: break the telegraph or stay out of the ring | Caster, `nova` (radius 58, damage 7, **slow 140**). hp 12, speed 0.5, reach 62, windup 44 | Banshee |
| 10 | **Whiteout Spirit** | Fades into the storm and **blinks to your side** | Melee + `blink` (minRange 70, maxRange 230). hp 11, speed 0.55, knockResist 1 | Wraith |
| 11 | **Tundra Guard** | Shielded **and** charging elite: the late-level test | Melee, `shield: true`, `charge` (distance ~170). hp 60, speed 0.35, knockResist 0.3 | Dread knight |

**Optional swaps** if a role feels redundant: a **Glacier Seer** (long locked `beam`, like the Lich) or an **Elder** (`rally`, like the Drummer, to give the Pass a support piece).

### Arrival and weights

`spread()` places arrivals evenly from 0 to 0.8, so with 11 enemies they come in at about 0%, 8%, 16%, 24%, 32%, 40%, 48%, 56%, 64%, 72% and 80% of the level. Each entry is `[type, weight when it arrives, weight at the end]`:

```ts
[MobType.Trapper, 10, 3],
[MobType.SnowSprite, 1.2, 1.8],
[MobType.Harpooner, 1, 1.5],
[MobType.FrostWolf, 1.5, 2.4],
[MobType.Ram, 1, 1.6],
[MobType.IceHusk, 0.6, 1.1],
[MobType.Yeti, 0.5, 0.9],
[MobType.FrostShaman, 0.4, 0.75],
[MobType.BlizzardWitch, 0.45, 0.8],
[MobType.WhiteoutSpirit, 0.8, 1.3],
[MobType.TundraGuard, 0.4, 0.8],
```

- **Boss retinue** (`support`): `[[Trapper, 0.62], [Harpooner, 0.2], [FrostWolf, 0.18]]`.
- **Enraged extra** (`enragedExtra`): `{ type: SnowSprite, chance: 0.1 }`.
- The Pass has **no boss of its own yet** (the Orc Warlord leads every biome for now; the Keep's is also to do). A Pass boss is a follow-up, not part of this brief.

## Visual and sound notes for the art

- Silhouettes must read at 1x: Trapper = fur hood and a hatchet; Harpooner = a long harpoon held up (a tall thin line); Ram = **curled horns**; Yeti = broad, hunched, huge hands; Frost Shaman = a tall staff with an ice crystal; Blizzard Witch = a flaring cloak and an open mouth; Whiteout Spirit = a drifting hood with no legs; Tundra Guard = a tower shield and a horned helm.
- **Corpses:** `dead` is a lying-down pose like the other enemies. Corpses stay on the ground for the run, so they should be dark enough to read on the snow too.
- **Render-only extras** I can do on the scenery side when the roster lands: an ice-blue `NovaStyle.Frost` ring for the witch, an icicle `ProjStyle` for the harpoon, and a frost-blue ground pool for the husk (the sim carries the number; `draw.ts` picks the look).

## Checklist

- [ ] `MobType` additions (22 to 32), `MOBS` entries, in the same order as the art.
- [ ] Eleven rigs in `art/chars/`, imported in `mobSheets.ts` and `mobArt.ts` in `MobType` order.
- [ ] `ROSTERS` entry (11 enemies, support, enragedExtra).
- [ ] `FROZEN_PASS` moved into `BIOMES` at the same index; `?biome=2` previews it with enemies.
- [ ] `npm test`, `npm run check`, `npm run playtest` pass; check readability with a full horde on the snow.
- [ ] `docs/03-gameplay-combat.md` table and `docs/11-backgrounds.md` updated.

## Open questions

- Is the Pass's people the same Clan system as the other biomes (herders, hunters, ice-cutters), or does this region get its own banner and codex entries?
- Should the Pass give the horde a **cold** mechanic of its own (for example, standing in snow slows everyone slightly, or heroes chill over time), or is "chilling" attacks and frost pools enough?
- Where in the biome order should the Pass sit (before or after the Keep) so the enemy difficulty curve across a run makes sense?

## Follow-ups (not done)

- **Ice-themed visuals (done, render side).** A shared `ICE` palette in `draw.ts` (mid-saturated blues, white only as 1 px highlights) is used by every Pass effect: the harpoon dart (`drawHarpoon`: shaft, barbed head, frost streak, `ProjStyle.Harpoon`), the frost pool and the storm that settles into it (`ZoneKind.Frost`, `ZoneKind.Storm`), traps, ice shards, the permafrost aura and the ward ring, plus an optional frost nova look (`NovaStyle.Frost`: icicles rising along the ring) that no enemy uses right now. **Why mid blues:** pale cyan and white vanish on the Pass's near-white snow (the first version of these effects was invisible there). `src/render/frost.test.ts` checks the drawing and that no ice effect uses a snow-white color.
- **A Pass boss (done):** the Rime King, see [03](../03-gameplay-combat.md#boss-repertoires). Bosses are now per biome (`Roster.boss`) and each has its own repertoire of moves.
- **Balance:** the stats are first drafts. The headless bot loses at about 31 to 37% progress in the Pass (36 to 43% in the Meadow, 35 to 38% in the Keep), so it is a little harder than the Meadow; tune with `npm run playtest`.
- **Art polish:** several rigs started from an existing rig and keep its pose set (Frost Wolf from the Wolf, Ice Husk from the Plague Zombie, Yeti from the Troll, Frost Shaman from the Necromancer, Blizzard Witch from the Banshee, Whiteout Spirit from the Wraith, Tundra Guard from the Dread Knight, Snow Sprite from the Skull); each has its own palette and silhouette changes, but a second pass on silhouettes would help.
