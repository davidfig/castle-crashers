# 15 — The Random Bestiary

Every run fights **monsters built from pieces**, and the cast is **different every run** but **the same for the whole of one run**.
A player learns *this run's* "cinder hound" (it charges), "bile mite" (poison, bursts into spores) and "rime king" (storms, snares, a ward
over its retinue) in the first level, and uses that through every biome of the road. The next run is a new cast to learn.
The monsters need not make sense (a flaming serpent with a bow, a hooded blob that raises the dead): they are small, and the surprise is the point.

The hand-made roster (59 enemies) is still in the code as `CLASSIC_MOBS` and is what the sim's tests run against; `?mobs=classic` plays it.

## How it works

```
run seed ──► generateBestiary(seed) ──► Bestiary { defs[], looks[], traits[] }
                                           │                │
                          installBestiary  │                │  composeMonster(look) per slot
                                           ▼                ▼
                                  MOBS[type] = def     sprite sheet ─► atlas "monster band"
```

- **Slots.** A `MobType` index is a *slot*, not a species. The slot keeps its job from the hand-made roster (`data/bestiary/plan.ts`):
  where it sits in its biome's order of arrival (`u`, 0 = first enemy .. 1 = heaviest), whether it is the plain first enemy, crowd
  filler (the boss's retinue and what summoners raise), a tiny pest, the bomber, or the boss. Everything that indexes by `MobType`
  (rosters, mixes, tallies, summon targets, corpses) therefore works unchanged.
- **Budget.** A slot's numbers (health, damage, speed, size) start from the hand-made enemy that held it, then the dice move them
  (early slots barely, late slots a lot), so a run still starts easy and ends hard. The balance probe (`BESTIARY=<seed> node tools/balance.mjs`) puts a
  generated cast within a few percent of the hand-made roster's difficulty.
- **Role.** Melee, ranged or caster, re-rolled for the middle and late slots (a brute stays a brute nine times in ten; an archer sometimes
  becomes a caster). The bomber slot stays a bomber. The first enemy of every biome is always plain melee with no powers.
- **Powers** (`data/bestiary/traits.ts`). A monster wears 0-3 powers from one kit: a melee hit that slows/launches/poisons/roots/withers/drains,
  a movement quirk (weave, hop, retreat, evade, burrow), a bull charge, a body trait (armour, shield, thorns, regen, berserk, pack, revive, mud trail),
  an aura (flame, chill), a death effect (burst into swarm, poison pool, ice shards, spore cloud), a way of shooting (volley, fan, harpoon, glob, firebolt,
  falcon) and a telegraphed **special** (the 19 in `Special`: lob, summon, heal, rally, blink, nova, beam, trap, cling, ward, storm, whiteout, wail, lure,
  leap, gust, pit, hex, dazzle). They are all mechanics the sim already has, so the generator only sets fields on a `MobDef`.
  Traits belong to groups that cannot stack on one monster (one hit effect, one movement quirk, one body trait...), a melee mob has a special **or** a charge,
  and a caster always has a special.
- **Uniqueness.** Inside a biome, no two enemies share a power (so a name means one thing to learn). Plain arrows are the baseline and may repeat.
  Each biome leans toward its own flavour (the Frozen Pass favours chills, wards, storms and snares; the Marsh poison and hopping; ...), softly:
  any biome can get any power.
- **Cheap slots** (the first enemy, the boss's retinue, summon and burst targets) stay light: at most one gentle power from a short list.
- **Bosses** (`boss.ts`): five bosses (one per biome), each with a **roar** (calls the biome's crowd), a **slam** and/or a **charge**, **four specials**
  chosen by biome flavour (at least two that hurt, at most one that supports), and a fifth that only a wounded boss uses. Same numbers as the hand-made
  bosses (about 700 health, radius 22), so a boss is a new fight but never an unfair one.
- **Names.** `<mark> <kind>`, from the look and powers: "cinder hound", "bile mite", "rime brute"; boss titles like `HOAR HOUND COLOSSUS`. Unique within a run.
  The run summary tallies by name.
- **Looks** (`data/monsterLook.ts`, `data/bestiary/look.ts`). A recipe of pieces: body plan (blob, tall, squat, wedge, round, serpent, insect, floater), head, limbs,
  back (wings, tail, shell, spikes, cape...), crown (horns, antlers, halo...), held item, eyes, motifs that tell its powers (fire, frost, poison, ghost, armour...),
  a palette from a colour family each biome shares for the run, and a size from its hit radius. Powers pull the pieces: shooters carry bows, casters staves,
  chargers horns, flame-wreathed things are hot-coloured.
- **Sprites** (`render/monsterArt.ts`). The look is composed at run start, as pixels, from parametric shapes and small stamps (no rotation or resampling of pixel art,
  flat fills, upper-left light, rim and ink) into a sheet per monster with the same poses the hand-made sheets have (walk, idle, windup, strike, hurt, dead, cast,
  aim/release, lit, paw/charge/dazed, rise; slam/roar/smash for bosses). `render/monsterSprites.ts` packs the sheets into the atlas's **monster band** and
  swaps them in; `mobArt.ts` and `draw.ts` read them like any other sheet. Per-monster presentation (shadow, blood, held item) is in `render/mobStyle.ts`.

## Determinism

`generateBestiary(seed)` is a pure function of the **run seed** (`cfg.seed`; the road's levels derive from it), with its own random streams,
never the sim's. The game installs it before any sim of the run is created (`applyCast` in `main.ts`), so every client and replay fights the same cast.
Tests (and tools) install explicitly; with nothing installed `MOBS` is the hand-made roster.

## Tools

| | |
|---|---|
| `node tools/bestiary.mjs <seed>` | print a seed's whole cast: role, numbers, powers, look, each boss's moves |
| `node tools/monster-sheet.mjs --seed N --count 40 --out sheet.png` | contact sheet of generated sprites (`--boss`, `--poses`) |
| `BESTIARY=<seed> node tools/balance.mjs` | per-monster duel probe against the bot (compare with the hand-made roster's) |
| `npm run playtest -- --bestiary 1 2 3` | bot runs against each seed's generated cast |
| `?mobs=classic` (dev) | play the hand-made roster |

## Adding to the kit

- **A new power**: add a `Trait` to `data/bestiary/traits.ts` (group, which behaviours wear it, `minU`, theme biomes, `apply`). If it needs new sim behaviour, add that
  to `MobDef`/`step.ts` first, as for any enemy. Give it `motifs` if it should show on the body.
- **A new special**: add the factory to `specials.ts` (and `bossSpecial` if bosses may cast it) and to `MELEE_SPECIALS` / `CASTER_SPECIALS`.
- **A new body piece**: see `render/monsterArt.ts` (parts and stamps), and the enum in `data/monsterLook.ts`.
- Tests: `data/bestiary/bestiary.test.ts` (legal, varied, unique, deterministic over 150 seeds), `sim/bestiarySim.test.ts` (bots and bosses play against generated casts).

## Not done yet / ideas

- A "this run's bestiary" page (the title screen or the camp), showing what a player has met so far.
- Story text still says "the Orc Warlord"; the boss in slot 5 is whatever the cast made it.
- The shield bearer's broken-shield sprite variant: a generated monster keeps its shield picture after the shield breaks.
