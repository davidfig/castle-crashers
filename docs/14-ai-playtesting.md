# 14 — Simulated Players & Headless Balance Runs

A playtest that costs a second instead of an evening. Simulated players (`src/ai/`) play every class the way a person would, at a chosen level of skill, and a headless runner plays whole campaign routes with no renderer, so a balance question ("is the Frozen Pass boss too hard for a middling cleric?") becomes a table.

```
npm run sim                                        every class at novice / average / expert, 6 seeds, the whole 15-level route
npm run sim -- --class=mage,archer --skill=casual,expert --runs=20
npm run sim -- --party=warrior:expert,cleric:average --runs=10     one explicit party ("class:skill" per hero, up to four)
npm run sim -- --players=3 --skill=skilled                         each class leads a party of three (the next classes fill out)
npm run sim -- --levels=6 --heat=3 --curve --killers               a shorter road at heat 3: difficulty by level, and what ends runs
npm run sim -- --start=6 --upto=3 --boost=6                        only levels 7-9, from a hero who was given six level-ups first
node tools/sim-trace.mjs rogue expert 3 15 600                     one run as text, a line every 600 ticks (find out why it got stuck)
node tools/sim-peek.mjs rogue expert 3 --level=5 --at=3000 --n=3   what a pilot decided on a few ticks (plan, buttons, target)
```

Other flags: `--seed0=N`, `--workers=N` (default: every core but one), `--json=file` (raw reports), `--levels-table` (per-level detail for every scenario; a single scenario always prints it), `--boons` (what the heroes ended holding), `--quiet`. The sim plus its players run at about 17k ticks a second a core (a full route is 100-250k ticks): 150 full routes, 70 hours of play, take about 100 s on a ten-core laptop, and the header line of every run says what it managed.

**Watch one in the real game.** `/?seed=5&levels=3&auto=1&skill=expert&bclass=archer` (dev build) lets a pilot drive slot 1; `&bots=3` adds pilots in slots 2-4; `&skill=0.35` is any point on the ladder; `window.__ts = 4` fast-forwards. Without `skill`, the bots are the old scripted `sim/bot.ts` (`npm run playtest`, kept for the boon sweep).

## How a pilot plays

A `Pilot` (`src/ai/pilot.ts`) is one simulated hero. Every tick it sees what a player sees, decides, and presses the same buttons a pad has, as an `InputFrame`. It never touches the sim's state, and it is deterministic: its own RNG stream is seeded from the run seed, so a run is a pure function of its options (a test pins that).

1. **Perceive** (`perceive.ts`): the foes nearest the hero (24 tracked, sorted), crowd counts at 24/40/70/120 px, allies and the weakest of them, loose coins and flasks, chests and shrines. Bystanders, kneeling mobs and burrowed ones are not foes.
2. **Know the dangers** (`threats.ts`): every red circle, locked charge lane, wind-up about to land, arrow in flight and lingering pool becomes a circle, lane or shot with a time it lands and a health cost. The pilot only knows about one after its **reaction time**, and notices only some of them (its **attention**): a fast attack cannot be dodged by a slow player, which is the whole of why skill matters. Telegraphs that stop counting down are ignored (see "Findings").
3. **Choose a target** (`pilot.ts`): the nearest, but a sharper player prefers healers, shooters and bombers (and sticks to its choice for a while, set by **tempo**).
4. **Play the class** (`tactics.ts`): the plan is where to stand, where to aim, which buttons.

   | Class | What the pilot does |
   |---|---|
   | Warrior | Stands just inside sword reach (outside most foes'), swings; big sweep on a knot or something tough; quake down a column it finds by trying directions; charge to close a gap. Rests when stamina is low. |
   | Mage | Keeps out of reach, aims fireballs at the thickest knot in range, lobs the special at a knot that sits at its fixed range, nova when swamped, blinks out of trouble. |
   | Archer | Kites; aims along the line that threads the most foes (arrows pierce and hit harder the farther they fly); fan on a cone, rain on a knot; lets go to refill stamina. |
   | Cleric | Aura on among the foes (hysteresis on stamina), standing close for the inner ring; nova and the heal roll when she or an ally is hurt; burst when closed on. |
   | Rogue | Hidden until he strikes: slips up on a knot and opens with the ambush, works round behind targets for backstabs, falls back to hiding. |
5. **Steer** (`pilot.ts`): 16 directions and "stay" are each priced: distance to the goal after a short walk, plus the expected health cost of every known danger along that line, plus a soft cost for standing among biting foes. The cheapest wins. A **dodge** is spent when the best move still eats a hit within a few ticks.
6. **Everything else a player does**: opens the level-up panel (when quiet, if careful), reads the three cards, **rerolls** a poor hand or **banishes** a bad card, and picks (`cards.ts` holds the taste: what a veteran knows about which boons carry which class); walks to coins, chests and shrines in its habit; takes flasks when hurt; in the store, buys by value and walks out when the party is done.

### Skill (`skill.ts`)

A `Skill` is fifteen human limits and habits: `reaction` (ticks), `attention`, `aimError`, `tempo`, `abilityUse`, `spacing`, `focus`, `dodge`, `caution`, `buildSense`, `rerollSense`, `pickDelay`, `panelCare`, `thorough`, `shopSense`. Five presets (novice, casual, average, skilled, expert) and `skillAt(0..1)` between them; `--skill=0.35` works. **The numbers are assumptions, not measurements.** To calibrate: have real people play, then move the presets until "average" wins as often as your average tester does (the ladder's shape, not the absolute level, is what makes comparisons between classes and levels meaningful).

## The headless runner (`runner.ts`)

`runRoute({ seed, party, levels, heat, startLevel, stopAfter, boost })` is the twin of the campaign flow in `main.ts`: the same level plans (`levelPlan`), road scenes, first-level beat, store between levels (stock, prices, the trade button on a ware), carry between sims and boss on every third level. Results per level and per run: outcome, time, kills, gold, **health lost** (as a share of one hero's full health), lowest health, downs, chests and shrines, level-ups, and **health lost by source**. Sources are worked out from what changed that tick (a swing that just landed, a projectile that just vanished, a special that just went off, a zone underfoot, poison, a chill aura, the greed shrine's price); `attribution.ts` is best effort, but each kind of damage lands under its own name.

Reading the tables: **win%** is the share of runs that survived everything asked for (`--upto` limits that to a stretch); **dies@** is the median level a losing run ended on; **dmg%** is health lost per level over a hero's full bar (200 = two full bars, mostly mended by flasks and the store); **vsMed** compares a level's damage to the median of its sort (bosses only with bosses), and `--curve` marks levels over 1.5x as HARD, under 0.5x as EASY (and any level that ends over a fifth of the runs that reach it).

## Findings so far (the first sweeps, 2026-10-09, heat 0)

- **Who survives what.** An expert wins the whole 15-level road with the warrior, mage, cleric and archer; the rogue's missing wins are stuck runs, not deaths (below). The ladder shows below it: a *casual* player clears the road with the cleric (the aura forgives), loses half the time to the Meadow's boss or the Keep with the warrior and the mage, and almost always dies in the first two levels with the rogue and the archer (the two classes that need footwork). *Average* clears nearly everything except the archer (60%) and rogue (80%).
- **Difficulty was front-loaded; the road now ramps** (`campaign/route.ts`). Before, the Meadow cost 1.6-2.6x the median damage and the Dunes 0.5x, and the second level of a biome opened with the same goblins as the first. Now `levelPlan` gives each level: a horde multiplier `depthScale` (0.55 at level 1 to 2.2 at 15) and an enemy-damage multiplier `depthDamage` (0.8 to 2.3, `GameState.damageMul`); a `mix` slice of the biome's cast (`GameState.mix`, applied in `pickMobType`): level 1 of a biome draws the first half of the cast, level 2 the middle, level 3 the back half, so each level opens on faces the last one only ended with, and each later biome opens further in (`MIX_PER_BIOME`); and a per-biome bump (`BIOME_BUMP`, the Frozen Pass x1.2 horde / x1.15 damage). Pooled damage per ordinary level now reads about 38/51 (Meadow), 17/43, 21/37 (Frozen Pass), 39/55 (Marsh), 38/44 (Dunes), bosses 234, 199, 259, 319, 222. The first level of the Keep and the Pass is still the easiest of the road; re-run `--curve` after changing any constant. No new enemy *types* were added (each needs sprites): the cast is the existing 10-11 per biome, now spread across three levels instead of all three opening with the same few.
- **Greed shrines** are a steady 4-11 points of damage in the later levels: pilots buy them often (it is the cheapest gold in the game). Whether that is the intent is a design question.
- Things the pilots had to learn that a person would also hit (worth knowing as a designer):
  - **Casters can hold a shut gate.** A slinger, drummer or bone archer standing just past a shut gate keeps its standoff (60-70 px) and never comes in; a melee hero cannot reach it, and the gate stays shut (`visibleHostiles` counts it). A person has to back right off so it walks in. The pilots do; a player who does not is stuck. A boss that casts from beyond the last gate does the same, and the pilots do not always get it to come: about one rogue run in ten stalls there (reported as `timeout`, "stuck").
  - **A hidden rogue freezes half the horde.** With only a hidden rogue alive, every mob in an even slot has no target and stops mid-telegraph (a boss mid-special stays in it, wind-up counter and all); mobs in odd slots chase his last position. A solo rogue can stall a level by never revealing himself; the pilot steps out with a swing.
  - **Archer stamina**: a shot costs 1 but restarts the 12-tick regen delay and the cooldown is 8, so firing without a pause never regenerates: stamina pins near zero and fire drops to a shot every ~20 ticks. The pilot lets go to refill; a player holding the trigger gets the sputter.
  - **An even fan misses a lone target.** Twin Flame / Split ranks give an even number of arrows with none down the aim line; at 100 px every arrow misses a single foe by ~15 px. The pilot turns the fan (`fanBias`); a player has to notice.
  - **Ability boons can price a class out of its own attack.** Every rank of Size/Split/Speed/Power adds to the stamina cost: a mage who stacks all four basic-attack tracks pays about 3x for a fireball that costs 40 of 100, and can never cast it. The card says so; the pilot now reads it (`cards.ts`, `affordable`), a careless one does not.
  - After a pick, the sim mutes the buttons that made it until all are let go (`PlayerState.lock`): a held Attack stays dead. Harmless on a keyboard; a pad with a sticky trigger would feel it.

## Limits

- It is not a person. Its perception is exact (positions, wind-up counters), it never mis-presses, and it has no fear. Use it to rank and to find outliers, not to predict a win rate; recalibrate `Skill` against real sessions.
- It does not use Stand Down or surrender (story mechanics), Swap, or revives beyond the sim's automatic one; a four-player run is four pilots that fight near each other, not a coordinated team.
- Attribution names the most likely source; damage from several things in one tick goes to the first match.
- Balance changes land in the data files and the sim, so re-run the sweep after one; a `--seed0` fixed range gives the same levels every time, so a before/after is a fair comparison.
