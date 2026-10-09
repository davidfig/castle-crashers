# 03 — Gameplay & Combat

## Moment-to-moment

Side-scrolling horde battler on a wide battlefield. Heroes are small and the field is deep; players move in 8 directions across the field while hundreds of enemies close in. **Area-of-effect is the main verb**: every class's kit is built around clearing groups (cleave arcs, novas, projectiles that pierce, ground effects), not single-target duels. The original beat-'em-up lane model still applies (x along the field, y across its depth). Players move in 8 directions (left/right plus up/down across lanes), jump, attack, use abilities, dodge, and interact.

### Controls (logical actions)

| Action | Notes |
|---|---|
| Move | 8-way; lane movement on Y |
| Jump | Z axis; air attacks |
| Attack | Light combo chain (class-defined), directional variants |
| Ability 1 / 2 | Class abilities, cooldown- or resource-based. Mappable slots; swap via contextual UI |
| Dodge/Block | Class-dependent (roll, block, blink) |
| Interact | Pick up / hand over / open |
| Item quick-use | Uses the "ready" consumable |
| Swap (hold) | Opens the near-character swap ring; game continues |

Physical bindings live in [09](09-input-audio-assets.md). The sim only sees logical `InputFrame`s.

## Combat model

- **Hitboxes and hurtboxes** are AABBs in (x, y-lane-thickness, z) space. A hit needs overlap on all three axes; lane thickness is small (~±8 px) so you must line up with enemies.
- Attacks have **startup / active / recovery** frames, defined in data per animation.
- **Hit-stop** (2–6 ticks) on hit, scaled by attack weight. **Knockback** and **launch** (z velocity) enable juggles.
- **Status effects:** burn, freeze/chill, poison, stun, slow, bleed, shield, haste, taunt. Stack rules are data-driven.
- **Damage types:** physical, fire, ice, lightning, holy, shadow. Enemies have resistances/weaknesses. Keep the list short so it's readable.
- **Basic attack = a sweep, not a poke.** Design rule: a basic strike must feel like a small nova, because against a horde, hitting 3 enemies feels like nothing. The warrior's basic attack is a **two-hit combo** of wide sweeps (up to ~180° ahead, reach ~40 px) that one-shot goblins, built on three levers: **mass**, **motion** and **spectacle**.
  - *Mass:* wide arcs that one-shot the small fry. Swings are deliberately slow-ish (21-tick cooldown): fewer, heavier blows.
  - *Motion:* knockback is strong (a goblin is shoved ~30 px). Mobs that survive a blow and slide fast **bowl into others**, damaging and launching them (credit goes to the original attacker). Mobs that die are **launched as tumbling bodies** and land as corpses. The hero **lunges** forward a few pixels on each swing.
  - *Spectacle:* a bold slash arc with a bright blade edge; camera kick along the swing; screen shake scaling with how many enemies were hit; hit-stop growing with the number of hits.
  - Each swing that connects builds **fury**, and costs a little **stamina**.
- **Ability 2 (warrior): the big swing.** What used to be the combo's third hit is now its own button (`I` / `;` / gamepad X): a much wider arc (~240°) and bigger damage that **breaks shields**, plus a **straight wave ~120 px down the facing line** that carves a lane through the horde. It costs **35 stamina** and has a **2.5 s cooldown** (a pip next to the fury bar shows when it is ready and affordable).
- **Stamina.** Every hero has a stamina pool (100 for the warrior), spent by actions and recovered when not spending:
  - Costs: a basic swing 4, a dash 22, the big swing 35. The nova costs fury, not stamina.
  - Regen: 0.75/tick (~45 per second), starting 12 ticks after the last spend. It is tuned so that **ordinary swinging is net-positive** (you recover *while* fighting, about a dash's worth every 3 s) but chaining dashes and big swings drains you.
  - Empty means **winded**: movement ~30% slower, and no attacks, dashes or big swing until stamina has recovered to 25. A hero who is revived comes back with full stamina.
  - HUD: a thin blue bar above the hero's health bar, shown only while stamina is not full; it turns amber when you cannot afford a dash and flashes red with a "WINDED" label when winded.
  - Design intent: the horde never pauses, so stamina is a rhythm rather than a gate: pick your moments for the expensive moves, and use the basic combo to refill. Numbers are in `src/data/classes.ts`.
- **Fury loop (warrior):** cleaving and killing build fury (and taking hits does too: pain feeds rage). **Quake** (ability 1: he drives his sword into the ground and a shockwave runs straight down the field, `quake` in `classes.ts`) costs 50 fury and pierces shields; casting it at **100 fury** sends a longer, wider, harder one. (The mage and cleric keep a radial nova; the archer's is the arrow rain.) Aggression feeds the AoE, and the AoE clears space for more aggression.
- **Archer's rain (ability 1):** instead of a radial nova, the archer (same fury cost) looses a volley that climbs out of sight and falls on a patch about half his arrow range ahead (`rain` in `classes.ts`, timing and landing spots in `sim/rain.ts`, a `ZoneKind.Rain` zone). Each arrow hurts what is under it where it lands and stays in the ground like other spent arrows; a full-fury cast is bigger and denser.
- **Dash:** brief invulnerable burst that plows through small mobs (light damage + knockback). Short cooldown; the answer to telegraphs.
- **Hit-stop:** a sim-level global freeze (1 tick on a normal hit, 3–4 on finisher/nova, scaling with kills) gives hits weight. Button presses are still buffered during the freeze.
- **Attack animation:** every mob telegraphs visibly: a lean back and a raised weapon (goblin dagger, orc axe) during the windup, a lunge and weapon swing on the strike, a drawn bow with a nocked arrow and aim line for archers, a swelling, shaking fuse for bombers, and a shield bash. Mobs waiting out a cooldown beside you hop restlessly instead of standing still.
- **Telegraph interrupts:** hits cancel an enemy's windup (not a lit bomber's fuse), so aggressive play is rewarded; stepping out of range dodges a strike.
- **Spawns are trigger points, not a clock:** authored encounters stream in as the camera approaches, and the top-up reinforcements and flank waves fire every N px of *forward camera progress* (`REINFORCE_INTERVAL`, `FLANK_INTERVAL` in `step.ts`; `spawnTimer`/`flankTimer` count px, `trigCamX` is the furthest camera x already counted). A party that stands still faces no growing horde.
- **Forward-only battlefield:** the camera never scrolls back and the hero cannot leave the screen to the left, so cleared ground **stays cleared**, and **nothing spawns behind you**. Mobs left more than ~360 px behind the left edge are removed; closer ones can still rejoin.
- **Gates (implemented):** you cannot run through a level ignoring combat. A **barrier** stands just past every wall of enemies (`gate` in `ClumpPlan`, `planGates` in `gen/level.ts`; about every fourth encounter). While it is shut the camera stops against it (`GATE_INSET` px inside the right edge, so it reads as a wall) and heroes cannot pass, dash or blink beyond it. It **opens once the camera is up against it, its wall has streamed in, and no hostile mob is on the screen** (or within ~120 px of its right edge, about to walk in). Stragglers far behind, bystanders, surrendered and fleeing mobs do not hold it, so one lost goblin never stalls the run. Because spawns trigger off camera progress, a shut gate also pauses reinforcements and flank waves: the fight at the gate is the wall you brought with you. A camera that is somehow already beyond a gate (tests, scripted jumps) simply passes it. The barrier is themed per biome (`src/render/gate.ts`): a sharpened-log palisade in the Meadow, an iron portcullis between torch-lit piers in the Haunted Keep, a wall of ice shards in the Frozen Pass; it topples, winds up or shatters over 45 ticks when it opens. The final stand and the boss are not gated. State: `gates`, `gateIdx`, `gateOpenTick` (hashed).
- **Flank waves (implemented):** on top of the encounters streaming in from ahead, big packs pour in over the **top** and **bottom** edges **in front of the party** (between the lead hero and the right edge of the screen), so the pressure comes from every side and you cannot just walk forward killing what is in front of you. A wave is as big as an authored encounter (about 28-70 enemies for a party of one, scaled by party size), arrives roughly every 7 s early on and every 4.5 s at full depth, and 30% of the time is a **pincer** from both edges at once. The waves are independent of how many enemies are already awake. Entrants walk straight in and cannot attack until they are on the field; after that they are confined to it like everyone else. A top-up director also tops up packs from ahead whenever few enemies are awake.
  - **Over the hill (top entrance):** enemies coming over the top climb up from *behind* a hill. Seen from the field, a bumpy grassy crest runs along the horizon in front of the mountains. A climber's feet start just below the crest, so its head appears first, then its body rises out from behind the crest as the hill hides the lower half along its curved edge; it stands on the crest for a moment, then walks down the near slope onto the field and heads for the player. (Rendering: climbers are drawn before the ground so the ground and crest cover them; the slope descent remaps their height onto the slope; see `draw.ts`. The sim treats top entrants as still "entering", unable to attack, until they are 4 px into the field.)
  - **Leaving is arriving in reverse:** every mob that leaves the play area (party-wipe retreat, surrender flight) uses the same entrance paths backwards: over the top it walks up the near slope, stands on the crest and sinks head-last behind the hill (removed only once fully hidden, `TOP_EXIT_DEPTH` in `step.ts`); over the bottom it drops behind the ridge. New exits must reuse this.
  - **Bottom entrance:** a low foreground ridge runs along the bottom of the screen; enemies coming from below walk up from behind it.
- **Healing is a potion you go and get.** Kills no longer heal. Mobs drop a red **potion** (tougher mobs more often; the boss always drops two) that lands where it fell and stays until you walk over it (`Kind.Potion`, `POTION_*` in `step.ts`). Only a hurt hero can drink one (it heals 30% of full health), so a healthy hero walks past and can come back for it. There is no magnet, so healing is a choice you make mid-fight, not a trickle you never notice. Potions are lost once they fall behind the screen, like coins. Drops are rate limited by a shared budget that refills per hero (`POTION_PER_SECOND`, `POTION_BUDGET_MAX`) so a bigger horde cannot mean more healing, which would make difficulty *easier* as enemy pressure rose. The cleric's nova and heal dash are the other source.

### Enemy roster (v0)

| Enemy | Role | The question it asks |
|---|---|---|
| Goblin | Fodder, fast | Fuel for fury; arrives in waves |
| Orc | Slow brute, big telegraphed smash, and a random **bull charge** | Interrupt the smash; read the charge lane and sidestep or dash it; punish the daze |
| Archer | Ranged, keeps its distance, red aim line then a dodgeable arrow | Close in, dash the line, or swat arrows out of the air with a cleave/nova |
| Shield bearer | Blocks frontal non-piercing hits; the shield soaks 24 damage, then **breaks** (the guard is stunned and open from every side, and drawn with a shard instead of the slab) | Pound the shield down, use the finisher or nova (they pierce), or get behind it |
| Bomber | Fast, explodes on a short fuse | Kill it *away from you*, or into a pack: its blast chain-kills nearby mobs and credits you |

Use `npm run playtest` to run a scripted bot over several seeds for balance sanity (win/lose, kills, minimum HP).
- **Friendly fire:** Default **off for damage, on for knockback/status that is explicitly "area"**? (Open question; see [open-questions](open-questions.md).) Proposed: off for damage, but players can be *pushed* by allies' heavy hits for comedy/utility. Configurable per run as a modifier.

## Enemies

- **Archetypes:** grunt (melee), brute (slow, high HP, armor), skirmisher (fast, hit-and-run), ranged (archer/caster), summoner, shielded, flyer, swarm.
- **AI:** cheap per-mob behaviors, run for hundreds at a time: a mob heads for the nearest standing player from the moment it spawns, whether or not the party is advancing. Mid-move mobs (stunned, winding up, charging, sliding) finish the move first. They separate from neighbours via the spatial grid, stop at attack reach, and attack on a cooldown. Because encounters stream in just past the screen's right edge, the horde arrives as a continuous tide rather than waiting in clumps. Because enemies are numerous and individually weak, readability comes from **scale and silhouette**, not telegraph-per-enemy; elites, ranged units and bosses still get explicit windups. An attack-token system is deferred until ranged/elite enemies need it.
- **Telegraphs:** every damaging enemy attack has a clear windup and a visible shape/flash. Readability beats difficulty.
- **Elites/Mini-bosses:** modifiers (e.g. *Frenzied, Shielded, Vampiric, Splitting*) drawn from a pool and applied at generation time.
- **Party-size scaling (implemented):** the horde grows with the party; enemies do **not** get tankier. A party of 1/2/3/4 faces 1x / 2.4x / 3.8x / 5.2x the enemies (`PARTY_SCALE` in `src/sim/gen/level.ts`), steeper than linear because heroes stack their AoE on the same crowd. It applies to both the authored encounters and the reinforcement director (bigger, more frequent packs, and a higher "awake" floor). Depth scaling comes from the enemy mix thickening toward the far end. XP rewards will scale to keep leveling pace constant once XP exists.
  - **Drop-in:** the party size is read when an encounter *streams in*, so a player who joins mid-run raises the difficulty from the next encounter on; leaving lowers it.
  - **Known limit:** per-player pressure is *lower* in bigger parties than solo, mostly because of auto-revive (below): a solo hero loses the moment they go down, but a party only loses when everyone is down at once. Bot playtests show 2-4 players winning nearly every run even at several times the enemies. The real fix is a proper revive mechanic (hold Interact, limited revives per run), not ever-bigger hordes.

## Bosses

One boss so far, at the end of the battlefield: the **Orc Warlord** (`MobType.Boss`, `src/data/mobs.ts`). **Killing it wins the run**; just reaching the end no longer does, and flank waves and top-up reinforcements stop for the fight. It appears just off the right edge once the party reaches the arena, with its retinue.

- **Size and toughness.** Roughly five times a hero's height (the orc art drawn at 4x, so it picks up new orc art automatically), 650 HP for a solo hero (x1.6 / x2.1 / x2.6 for 2 / 3 / 4 players). It has **super armor**: it takes damage but is never shoved or staggered. A giant is hit when any part of it is in reach, not just its centre.
- **Support.** A **retinue** of ~26 small enemies (goblins up front, shield bearers, archers behind) stands around it at the start, and its **war cry** summons a fresh burst of supporters that fly out from the boss and rush the party. Both scale with party size. The little ones are what you have to cut through to reach it.
- **Moves** (it picks one every ~4 s, ~2.5 s once enraged; each has a tell):
  - **Club smash**, up close: a windup with a "!", lands where you stand *now*, so stepping out of reach dodges it.
  - **Ground slam**: it rears up while a red ring marks the zone for ~1 s, then hits everything inside (24 damage, a screen-shaking shockwave). Dash through it or get out of the ring.
  - **Bull charge**: the orc charge (see above) at a bigger scale: a red lane, 280 px, super armor, ends in a long daze. It does not trample its own supporters.
  - **War cry**: a windup with rings and "!!!", then supporters burst out. Skipped if the field is already crowded.
- **Enrage at 50% health:** an immediate war cry, glowing red eyes, 40% faster, quicker special moves, and bigger summons that can include bombers.
- **Health bar:** a wide bar at the top of the screen, with a mark at the enrage line.
- **Death:** a long hit-stop, a huge shockwave and fireworks, a burst of 14 coins (12 each), and about three seconds to gather them before the battle is won.
- **Tuning notes:** with the scripted bot, 4 players kill it about 5 times in 8, while 1-2 players get it to a few percent. Bots do not dodge the club, so a human who does should fare better.
- **Dev:** `?boss=1` starts at the arena.

### Boss repertoires

A boss has a **repertoire** (`BossDef.moves`): a weighted list of moves. Each time it is free to act (every `specialGap` ticks, shorter once enraged) it draws among the moves that can happen right now, by weight, and starts one. A move is one of the boss's own three (`slam`, `roar`: the war cry that calls the retinue, `charge`) or **any telegraphed special** from the enemy special system (`kind: 'special'`; see "Enemy roster by biome"), cast with that special's own range rules. Specials can be marked `enragedOnly`, and the lob, storm and trap specials take a `count` and `spread` so a boss fires a volley or a field of them. Each boss should have moves the others do not, so every boss fight asks something different. Everything is data in `src/data/mobs.ts`; `pickBossMove` in `step.ts` runs it and the boss's windup pose and telegraph are the move's own.

| Boss | Moves | What it asks |
|---|---|---|
| **Orc Warlord** (Meadow) | Ground slam, war cry (retinue), charge, **rally** (its retinue into a frenzy), **boulder volley** (four rocks scattered round you, landing in a ripple) | Cut down the warband before it is rallied; keep moving through the volley; dodge the charge lane |
| **Rime King** (Frozen Pass) | War cry (the Pass's folk), charge, **frost nova** (a wide ring with a long slow, when you are close), **blizzard barrage** (four storms that settle into ice), **glacier snares** (a field of rooting traps), **ice ward** (its retinue wrapped in ice), and, enraged only, a **whiteout** (your movement reversed) | Do not stand still, read the ground, and break the ward before the retinue grinds you down |
| **Dread Regent** (Haunted Keep) | War cry, **soul beam** (a long, wide, telegraphed line), **raise the dead** (five skeletons), **spectral blink** (it vanishes and reappears near you), **banshee scream** (a close ring that slows), **soul drain** (heals its retinue), and, enraged only, a **death wail** (damage and silence) | Step out of the beam's line, kill the raised dead before they pile up, and stay out of the wail's ring |
| **Fenlord** (Sunken Marsh) | War cry (frogs), **leap** (it springs across the field and lands on your spot: a ring marks it), **false lights** (drags every hero toward it), **bog barrage** (four stinking pools of poison), **spawn** (five more frogs), and, enraged only, a **filth volley** (five lobbed blobs) | Keep your distance so it has room to leap, and be ready to dodge-roll out of the pull; do not stand in the pools |
| **Sun Tyrant** (Scorched Dunes) | War cry (the nomads), charge, **sunbeam** (a very long, wide, telegraphed line), **sunfire rain** (six strikes scattered round you), **hot gust** (a wide ring that blows you out), **sand pits** (three pits that drag you in), and, enraged only, **scarab swarm** (six scarabs that heal on every bite) | Step out of the beam, keep moving through the rain, and never let the pits pin you at its feet |

The Rime King has no ground slam (the frost nova takes its place): a frost-giant chieftain (`MobType.RimeKing`, art `art/chars/rimeking.mjs`) with shaggy blue-grey fur, a mane, a crown of ice shards over curled horns, a glacier-ice pauldron and an ice maul. 720 HP before party scaling (the Warlord has 650), enraging at half health; its health bar reads RIME KING.

The Dread Regent (`MobType.DreadRegent`, art `art/chars/dreadregent.mjs`) is an undead king: a gaunt skeleton with a gilt spiked crown, green-glinting sockets, a rotted iron breastplate over the ribs, a tattered purple cape and tabard, and a great rusted greatsword. It has no charge and no ground slam (a caster king). 700 HP before party scaling, enraging at half health; its health bar reads DREAD REGENT.

## Co-op rules

- **Shared screen, tethered camera.** Players can't leave the screen. If one lags, the camera waits within a limit, then gently pulls the straggler (a "rubber-band" that does damage-free teleport after N seconds).
- **Downed & revive:** at 0 HP a player goes down for ~10 s; allies revive by holding Interact. If all are down, the run ends. Revive count per run is limited (rises with meta unlocks).
- **Shared resources:** gold is shared; XP is individual but with a **catch-up bonus** for lower-level players so a revived/late player doesn't fall behind.
- **Drop-in/drop-out:** a player can join at a checkpoint/campfire room mid-run, starting at the party's average level.
- **Difficulty scaling** by party size is automatic (see enemies).

## Run flow

```
Hub (meta) → choose class(es) + modifiers → Run:
  Biome 1: room, room, room, ..., mini-boss, Rest room
  Biome 2: ...
  ...
  Final boss → Victory / Defeat → Renown payout → Hub
```

**Rest rooms:** campfire/shop-like safe rooms with no menus that pause the game: you walk to things (a merchant NPC, a shrine, a forge) and interact with in-world prompts. Details in [06](06-ui.md).

## Death & failure

- Run ends when all players are down simultaneously.
- You keep: renown, any meta unlocks, discovered items (codex). You lose: items, in-run levels, gold.
- No permadeath of *characters* across runs; the *run* is the unit of risk.

### Orc bull charge

- **Trigger:** while the orc is 60-240 px from its target, on screen, and off cooldown, it has a small random chance each tick to start a charge (~1 in 500 per tick; many orcs close in before they roll one, so roughly half of them charge on the way in).
- **Windup (0.6 s):** it paws the ground, rocking back and stomping, with a "!!" and a dotted red **lane** drawn along the locked direction. The direction is locked at the start, so sidestepping works. A hit during the windup **cancels** the charge.
- **Charge:** ~3.4 px/tick (about nine times its walking speed) for a fixed **190 px**. It cannot be stopped, turned or staggered: **super armor** (it still takes damage, but no knockback or stun). It tramples anything on the way: heavy damage to the hero (a dash's invulnerability carries you through), light damage and knockback to other mobs, with a dust trail and motion ghosts. It ends early only at the edge of the world.
- **Daze:** afterwards it is winded and helpless for about a second (stars circle its head), then has a ~7 second cooldown. That is the window to punish it.
- All numbers are in `src/data/mobs.ts` (`charge`). Any mob type can get a `charge` entry.

## Enemy roster by biome

Each biome has its own cast (`src/data/roster.ts`, one `RosterEntry` per enemy). The sim learns the biome from `biomeIndex(seed)` (also stored as `GameState.biome`), so the scenery and the enemies always agree; `?biome=N` forces both in dev builds. An enemy is absent until its `from` (level progress 0..1), then its share of the crowd grows steadily to the end of the level, so the first minutes are mostly fodder and the last are full of casters and elites. The boss's retinue is drawn from the same biome (`ROSTERS[b].support`).

Abilities are data on `MobDef` (`special`, `shot`, `charge`, `onDeath`, `slowOnHit`, `weave`, `regen`, `retreat`, `launch`, `berserk`, `aura`, `pack`, `revive`, and for the Marsh and the Dunes `poisonOnHit`, `rootOnHit`, `witherOnHit`, `hop`, `thorns`, `evade`, `burrow`, `drain`, `trail`, `flame`) and run in `src/sim/abilities.ts`. The Marsh and the Dunes added the specials `leap`, `lure`, `hex`, `gust`, `pit` and `dazzle`, the `onDeath.cloud` spore cloud, and three hero statuses beside the older slow, root, silence and confusion: **poison/burning** (`poisonT`, one point of health every 24 ticks, a fresh dose only lengthens it; green bubbles for venom, embers for fire), **hexed** (`hexT`, half again as much damage taken) and **withered** (`witherT`, no stamina comes back). Spore clouds and mud are ground zones (`ZoneKind.Spore`, `ZoneKind.Mud`), the sand pit another (`ZoneKind.Pit`, it drags heroes in each tick). Every special is telegraphed (the mob plants itself, an authored windup pose plays, a ground ring or lane shows), and a hit on the mob breaks the telegraph and costs it half its cooldown.

| Biome | Enemy | Appears | Ability |
|---|---|---|---|
| Meadow | Goblin | start | Swarm melee |
| | Orc | start | Bull charge, then dazed |
| | Archer | 4% | Single aimed arrow |
| | Bomber | 8% | Runs in, lights a fuse, explodes |
| | Wolf | 10% | Hunts in packs: each packmate close by makes it faster and harder-hitting |
| | Shield bearer | 12% | Blocks frontal hits |
| | Slinger | 20% | Lobs a rock: a red circle marks the landing spot, it lands 0.8s later |
| | Shaman | 30% | Heals hurt allies in a radius (only casts when someone is hurt) |
| | Drummer | 40% | Rally: allies in range move and attack faster for 5s |
| | Troll | 55% | Regenerates; ground stomp when you stay close |
| Haunted Keep | Skeleton | start | Swarm melee |
| | Skull | 5% | Fast, zig-zagging biter |
| | Skeleton archer | 5% | Two-arrow volley |
| | Ghoul | 12% | Fast; claws slow you |
| | Wraith | 22% | Blinks to your side, then slashes |
| | Bone brute | 30% | Bursts into three skulls when killed |
| | Necromancer | 35% | Raises skeletons (capped) |
| | Banshee | 45% | Wail: heroes in the ring are silenced (no ability buttons) for 4s |
| | Plague zombie | 50% | Leaves a poison pool when killed |
| | Lich | 65% | Locked death ray: step out of the lane |
| | Dread knight | 75% | Rises once more at 40% health after its first death |
| Frozen Pass | Trapper | start | Sets a snare ahead of you: it arms, then roots whoever steps in (a dodge-roll tears free) |
| | Snow Sprite | 8% | Leaps onto a hero and clings: gnaws and slows until killed or rolled off |
| | Harpooner | 16% | Harpoon with a line: a hit hauls you across the field toward it |
| | Frost Wolf | 24% | Hit and run: one bite, then it darts away before coming back |
| | Bighorn Ram | 32% | Headbutt that launches you a long way (into the rest of the horde) |
| | Ice Husk | 40% | Shatters into a ring of flying ice shards when killed |
| | Yeti | 48% | Berserk below half health: frenzied, harder-hitting, never staggered |
| | Frost Shaman | 56% | Wards its allies: the next hit on each is absorbed whole |
| | Blizzard Witch | 64% | Conjures a blizzard on your spot that settles into a lingering pool of chilling ice |
| | Whiteout Spirit | 72% | Howls a whiteout: your movement is reversed for 1.5s (a dodge-roll slips through) |
| | Tundra Guard | 80% | Permafrost aura: heroes beside it are chilled and frostbitten |
| Sunken Marsh | Bog Frog | start | Hops: springs forward in bursts, so it closes faster than it walks |
| | Mud Leech | 8% | Poison: the bite keeps taking health for 2.5s |
| | Toad Spitter | 16% | Spits a glob of venom that poisons on a hit |
| | Bullfrog | 24% | Leaps: a ring marks where it will land, on your spot, and it slows you |
| | Sporebloat | 32% | Bursts into a spore cloud that saps the stamina of anyone in it |
| | Reed Stalker | 40% | The longest reach of any enemy: it spears you from outside your swing |
| | Wisp | 48% | A false light: every hero in range is dragged toward it (a dodge-roll resists) |
| | Peat Brute | 56% | Leaves slowing mud behind it as it walks |
| | Mire Hag | 64% | Hex: a marked spot curses whoever stands on it, who then takes half again as much damage for 5s |
| | Toad Matron | 72% | Venomous skin: whoever hits her is poisoned |
| | Drowned Warden | 80% | Weeds that snare: a hit roots you (a dodge-roll tears free) |
| Scorched Dunes | Dune Raider | start | Nimble: a quarter of the blows against it glance off |
| | Scarab | 8% | Feeds: heals itself on each bite |
| | Flame Archer | 16% | Fire arrows that set you alight (a slow burn) |
| | Sidewinder | 24% | Travels under the sand, untouchable, and surfaces beside you |
| | Scorpion | 32% | Hard shell: it takes damage but is never staggered |
| | Falconer | 40% | Looses a falcon that steers after you (a dodge-roll shakes it) |
| | Dust Devil | 48% | Gust: a ring that blows you out of it |
| | Antlion | 56% | Digs a sand pit under you that drags you toward its middle |
| | Mummy | 64% | Withers: your stamina does not come back for 4s |
| | Sun Priest | 72% | A flash on your spot that roots and silences you for 0.8s |
| | Sun Guard | 80% | A ring of fire: heroes beside it are set alight |

**Design rule: no ability repeats, in any biome.** Every enemy does something no other enemy does (the plain Goblin, Skeleton and Archer are the baseline; the Marsh and the Dunes follow the rule to the letter, so even their plain fodder has a trick). The test "no ability is used by two enemies, in any biome" (`src/sim/roster.test.ts`) enforces it; the one bull charge belongs to the Orc, the one shield to the Shield bearer, the one stomp to the Troll. New abilities go in `src/sim/abilities.ts` as a `Special` kind, a `MobDef` field, or an `onDeath` entry.

**Bosses are per biome** (`Roster.boss` in `roster.ts`, the level spawns `ROSTERS[biome].boss`): the Meadow has the Orc Warlord, the Frozen Pass the **Rime King**, the Haunted Keep the **Dread Regent**, the Sunken Marsh the **Fenlord** and the Scorched Dunes the **Sun Tyrant**. Any enemy type with a `boss` def (`BossDef`) is a boss; `isBossType` in `mobs.ts` is the check. A boss's moves are data (its `moves` repertoire, below), so a new boss is mostly a list of moves plus art.
