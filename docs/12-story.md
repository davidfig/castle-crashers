# 12 — Story & Narrative Structure

Status: **Proposed.** Names, numbers and the exact ending set are defaults to build against until challenged. Placeholder terms (the Tally, the Writ, the Ledger) are in-world working names, not final.

## Premise

For generations the humans have lived behind walls, afraid of the monsters that roam the world. Now the Crown has posted a **bounty on every non-human creature**. Your party takes the contract: clear the world and make it safe for humans, once and for all.

The first hours play as a straightforward, satisfying power fantasy. Then the story turns, and the player has to face what they have been doing: the monsters were never a threat to be cleared. They were peoples being driven off land the cities wanted, and the party is the instrument of a **genocide** that the game has been paying them for.

## Design principles

1. **The rules never change, only their meaning.** The horde, the kill streak, the coin per kill and the AoE that clears a pack all stay exactly as fun as they are on day one. Nothing is secretly "punished". What changes is what the player *knows* about the thing they are doing. Complicity comes from having enjoyed it, not from a cutscene scolding them.
2. **The story is delivered across runs, not inside one.** A run is one **sortie** in a longer campaign. Revelations accumulate in a persistent **Ledger** and are delivered by a guaranteed schedule, not by luck (see [Delivering the beats](#delivering-the-beats-three-tiers)), so the story advances at the pace of the player's whole history, not at the pace of one 30-minute run. This is what makes a roguelike's repetition *part* of the story instead of a conflict with it (see [Replayability](#replayability-how-a-seeded-run-carries-story)).
3. **Never stop the action.** Consistent with [00 Vision](00-vision.md) pillar 3: no modal dialogs, no dialogue boxes mid-fight. Story is told through the world, barks, small anchored text, event nodes the party walks into, the hub, and the codex. See [Delivery](#delivery-without-stopping-the-action).
4. **Shared, not preached.** The player is never told "you are the villain". The game shows, and lets a character say it once, late, when it will hit hardest.
5. **Charm as contrast.** The art stays bright and cartoonish (see [11 Backgrounds](11-backgrounds.md)). The tone drifts from goofy to quiet; the visuals do not get grimmer, they get *emptier*.

## The world and its words

### What the humans call things

The language of the bounty drifts as the Ledger grows. The same act gets cleaner words:

| Chapter | Bounty text | Meaning |
|---|---|---|
| I | "Vermin", "pests", "raiders" | Self-defense |
| II | "Beasts", "the Wild" | Othering |
| III | "Clearance", "pacification" | Bureaucracy |
| IV | "Resettlement", "recovery", "quota" | Euphemism |
| V | "The Final Tally" | Completion |

### Who the monsters actually are

The existing enemy roster is reinterpreted, not replaced. Nothing about their stats or behavior changes; what changes is what the player learns about *why* they behave that way. This is the engine of the retroactive turn:

| Mob | What it looked like | What it actually is |
|---|---|---|
| **Goblin** | Swarming raider | Scavengers and farmers whose fields were taken. They come in numbers because that is how a displaced community moves, young and old together. |
| **Orc** | Brute with a club | Laborers and builders. The club is a tool and the camp's defender's weapon. |
| **Archer** | Ambusher | Hunters. They know the land; they are defending the hunting ground. |
| **Shield bearer** | Armored wall | A village guard shielding others. The shield is held in *front of someone*. |
| **Bomber** | Suicide kamikaze | Quarry miners carrying blasting powder, the same quarries that fed the cities' walls. The "fuse" is a work tool turned desperate. |
| **Warlord** (Chapter I boss) | Evil orc king, retinue, war cries | The leader of a refugee column. The "retinue" are bodyguards for families; the "war-cry summons" is a call for everyone to get behind him. The player killed a man defending a column of civilians. |

New non-combat variants (kits, cooks, elders, carts, cookfires) are introduced in Chapter I as scenery, in Chapter II as *targets of the horde's attention*, and in Chapter III as the point.

### The antagonist is a system

There is no human villain to kill, deliberately. The antagonist is the **Tally Office**, the bureaucracy that issues Writs and pays per head. Its human face is the **Registrar**, a calm and courteous official who is genuinely pleased with the party's work. The Registrar is never fought. Killing the "bad humans" is explicitly rejected as an ending because it would flip the theme into "genocide is fine as long as it's aimed correctly".

Death, in fiction: a downed party is carried home by the Office's recovery wagons. The Tally needs its collectors alive. This is the diegetic reason runs repeat, and it is quietly the darkest line in the game.

## Characters and the party

### The party is the player's

Parties are 1–4 players choosing from the class roster, duplicates allowed, characters named by the player ([04](04-classes-progression.md)). That rules out a fixed named cast. Instead the story gives each **class a voice**: a short, class-keyed bark set and a stance on the bounty. Whoever is in the party speaks in their class's voice.

| Class | Stance | Arc |
|---|---|---|
| **Warrior** | Believer. Duty, protecting the weak, the walls. | Last to doubt and breaks hardest. |
| **Cleric** | Conscience. Their order's blessing lends the Writ moral cover. | First to question; has the most to lose. |
| **Rogue** | Mercenary. Honest about doing it for coin. | Cynicism is the cover story; his honesty is an indictment. |
| **Mage** | Scholar. Reads the evidence. | Knows earliest and says nothing. |
| **Archer** | Hunter. Recognizes the land as someone's home. | First to *recognize* the camps as camps. |

With multiple same-class players, only one voice speaks per bark; other players of that class get the same bark staggered. Players who want to roleplay can; the system does not require it.

### Character-level conscience

Each saved character carries a small **Conscience** record (spared / slain counts, witnesses watched). It does not change stats directly. It gates certain class-tree **keystone** and **lore/cosmetic** nodes (see [04](04-classes-progression.md)), so a Warrior branch can be "Guardian" (mercy-favoring) vs. "Warlord" (execution-favoring) for mechanical reasons the player chose, not because the game assigned them. Specifics in [Meta integration](#meta-integration).

## Campaign structure

The campaign is five **chapters**. A chapter ends when every one of its beats has played, which is its milestone Writ being cleared (see [Delivering the beats](#delivering-the-beats-three-tiers)), not on a run count and not by biome. Each chapter changes the *context* of the same procedural runs. Chapters I–IV are listed here by what the player sees; the tier that carries each beat is in the revelation table.

### I — The Bounty

Tone: bright, heroic, a little silly.
- Hub: a walled city, a notice board, a cheering crowd. Writs pay well and the first payout is generous.
- Runs are clean monster hunts. Mob barks are growls. Nothing is explained.
- **Planted seeds (not flagged):** cookfires and laundry lines in the background; the Warlord's retinue includes kits and a cook the player kills without comment.
- **Chapter boss:** the Orc Warlord, now a refugee-column leader.
- **Exit:** the **Warlord milestone Writ**. R1 (the first mob that does not attack) is delivered before it, as a reserved run beat.

### II — Doubt

Tone: still fun, now with static in it.
- Some enemies **flee**. Some archers **drop their bows**. A shield bearer stands in front of a cart rather than advancing.
- Mobs have *things*: tools, shrines, toys. Some barks resolve into recognizable words.
- Witness events (see below) begin to offer **Stand Down**.
- The Writ board gets *more generous* as the targets get more human, and the Registrar compliments the party.
- Class voices diverge. The Mage and Archer start leaving things unsaid; the Cleric asks questions.
- **Exit:** the **Mid-boss milestone Writ**, where an enemy speaks plainly, unmistakably, to the party (R4).

### III — The Ledger (midpoint turn)

Tone: quiet.
- A cleared settlement contains the **paperwork**: the Writ quotas pre-date any "threat". The map shows the cities' expansion over the territories that the "monsters" came from. The bounty was never a response; it was a plan.
- An **Elder** asks the party to stop. This is structured like a boss encounter (arena, staging) but the Elder fights only defensively, if at all. Whether the party kills the Elder or lets them walk is the first big, public choice.
- The party fractures. Class stances now shift openly in the hub.
- **Exit:** the **Elder milestone Writ** (R7: "the Elder knew the Registrar's name").

### IV — Complicity

Tone: the game is nicer than ever, and that is the problem.
- The Writ board escalates: **nests**, "non-combatant cohorts". Payouts are *larger* and loot is *better*. The temptation is mechanical and it is exactly the one the player already had.
- The hub is richer and more celebratory the more they commit; it gets a hush if they've been sparing.
- **Quiet Regions:** previously cleared regions are revisitable and empty. The corpses are where the player left them. Nothing spawns. It is a short, deliberate walking sequence, and it is the heaviest place in the game.
- Party members may **leave, turn on the party's decisions, or double down**, depending on how the Ledger's mercy ratio has gone (class voices only; no mechanical party loss).
- **Exit:** the **Quiet Writ** (R9). The Registrar then explains the final Writ in the hub (R10), which is the first beat of Chapter V.

### V — Reckoning

Tone: one thing left, and it is a choice.
- The **Final Writ** is a hand-authored, non-procedural level (an exception to [07](07-procgen.md)): the last settlement, containing everyone who is left.
- The final "boss" is a **parent** (or a council), who is not a threat. The player may attack, or **decline**.
- The ending is determined by what the Ledger holds and what the party does here ([Endings](#endings)).

## Replayability: how a seeded run carries story

The concern: if the story is fixed and a run is procedural, either every run repeats the same story beats (boring) or the story has nothing to hook onto (disconnected). The answer is to make **procedural generation the world's way of being many different places, and the story the same truth seen through them**.

### Two layers

| Layer | Lives in | Changes how | Content |
|---|---|---|---|
| **Campaign** (the Ledger) | Profile save (versioned) | Slowly, across runs | Chapter, revelations found, region map state, conscience tally, ending flags |
| **Sortie** (a run) | Run seed | Every run | The Writ, the region, the *Clan*, the vignettes, the barks, the map |

The Campaign decides **what the story is ready to say.** The Sortie decides **who, where and how.**

### The Writ is the run's contract

The hub's Writ board offers **three seeded Writs** (Hades-style choice) from a campaign-level RNG. Each Writ is a readable contract that summarizes a run:

- **Region** → picks the biome order from the pool ([07](07-procgen.md)).
- **Clan** → a procedurally generated people (see below) that this region belongs to.
- **Quota/Target** → which mob mix is emphasized and how many "heads" the Writ wants.
- **Clauses** → the run modifiers from [07](07-procgen.md) written as contract text. "Swarm" is *Nest Clearance*. "Glass cannons" is *Hazard Pay*. "Cursed loot" is *Tainted Spoils*. The mechanics are unchanged; the framing makes each modifier a piece of the world.
- **Payout** → renown and gold multiplier. Chapter IV payouts are larger.

Picking a Writ is already narrative: which people the player is willing to go after, in which region, for how much.

### The Clan: a procedural cast per run

Each Writ's region is home to a **Clan**, generated from a dedicated **`story` RNG stream** (`hash(runSeed, 'story')`) so story generation never shifts rooms, loot or combat. A Clan is a small data object:

```ts
interface Clan {
  name: string;               // "the Ashfen Reeds"
  species: MobType[];         // who they are: a clan mixes types; weights per type
  banner: { color: number; glyph: string };
  trade: 'farmers' | 'miners' | 'herders' | 'builders' | 'hunters' | 'scribes';
  temperament: 'defiant' | 'weary' | 'proud' | 'frightened';
  leader: { name: string; role: 'warlord' | 'elder' | 'council'; trait: string };
  grievance: string;          // one-line "what the humans took from them"
}
```

The Clan appears *consistently across the run*: banners on the biome's decor and enemies, the Event vignettes' names and objects, the midboss and boss's identity, and the codex entry created when the run ends. Two different seeds produce two different peoples with different trades, so the same Chapter II beat ("a shield bearer stands in front of a cart") lands as a *miner's family* in one run and a *herder's flock* in another.

### Witness events

The node graph's **Event** nodes become **Witness** nodes. A Witness is a small handcrafted vignette template with slots (`{clan}`, `{trade}`, `{leader}`, `{species}`, `{object}`) that the `story` stream fills. Each has up to three options, chosen by what the party *does* in the world, with no dialogue box:

- **Strike** (attack the participants as usual)
- **Stand Down** (the party lowers its weapons; see [mechanics](#mechanics))
- **Look Away** (walk past; neither, and the pass has a cost in a different currency)

Witness templates are the **flavor pool** (tier 3 below): each is tagged by **chapter range** and **revelation prerequisite**, and the event stream picks from what is currently eligible. This keeps dozens of vignette seeds fresh and makes sure no run shows a beat before the player is ready for it. Witness *slots* are also where tier 2 reserved beats are placed.

Fork doors on the node graph are also a moral tool: the signpost can show, in later chapters, that one door leads toward a "settlement" and another toward a "stronghold". The party decides by walking.

### Delivering the beats: three tiers

The main story is **not rolled**. The Ledger holds a queue of **revelations** (R1…R12), each an authored scene with prerequisites (earlier revelations, a minimum number of ordinary Writs in the chapter). The *next* pending revelation is a pure function of the Ledger: no RNG decides whether it happens, so it cannot be late, skipped, or lost to an unlucky seed. Later revelations are never eligible before earlier ones, so the story cannot be skipped by playing more runs.

The seed decides only the *skin* of a beat (the Clan, names, objects, the region it plays in). Each beat is delivered by one of three tiers:

| Tier | What | Guaranteed? | Seed varies |
|---|---|---|---|
| **1. Hub beats** | Scenes at the Writ board, the tavern, the Registrar; city mood; codex entries | Yes, whatever happened in the run | Almost nothing; this is the authored layer |
| **2. Reserved run beats** | A node the run generator is *told* to place at a fixed spot | Yes, once the party reaches it (carries over if missed) | The Clan and setting |
| **3. Flavor pool** | Witness vignettes, barks, decor | No: random, filtered by chapter | Everything |

Milestone Writs (below) are a special case of tier 2: a whole run built around one beat.

#### Tier 1: hub beats

- Triggered from Ledger state when the party returns to the hub, after any run outcome (win, defeat or retreat). A death never costs the player a beat.
- Queued first-in-first-out with a priority for the pending revelation; at most **two** per hub visit so the hub does not become a cutscene reel.
- Carry most of the talking: the Registrar, class voices at the tavern, Writ board text, city mood, codex entries. The hub is not a run, so short staged scenes the player walks into (and can walk away from) are fine here.
- Can *acknowledge* missed tier 2 beats ("Rumor says the scouts found something at the crossing…") so the player is never left wondering.

#### Tier 2: reserved run beats

- When the pending revelation is a run beat, the campaign layer adds a **reserved beat** to the run's `RunConfig` (alongside the modifiers from [07](07-procgen.md)):

  ```ts
  interface ReservedBeat {
    id: string;            // 'R2'
    node: 'witness' | 'combat' | 'treasure' | 'boss';
    biome: number;         // index in the run's biome order
    at: 'spine';           // a step every route passes through
  }
  ```

- The map generator **places a node of that type at a fixed point of the run**. It is never a weighted roll. Because the node graph forks ([07](07-procgen.md)), the beat goes on a **convergence step** that all routes pass through (or is duplicated on every fork at that step), and the validation pass asserts that no route can avoid it.
- It is placed early (first biome, before its boss) so a defeat before it is uncommon.
- The beat is marked **seen** only when it plays out. A party that dies earlier gets the **same beat re-reserved next run**, and the hub acknowledges the miss (tier 1). If a beat has been missed **twice in a row**, the generator moves it earlier on the spine. This is a deterministic nudge, not a probability.
- Since the beat's content is a template with Clan slots, the same revelation looks different in each campaign and each Writ, but means the same thing.

#### Tier 3: the flavor pool

- Random Witness vignettes, barks and decor from the `story`/`events` streams, filtered by chapter range and prerequisites.
- Never required for progress. They make runs differ and can *echo* completed beats (a callback to the Elder, a banner seen earlier).
- Must be large enough that a player rarely sees the same one twice in a row (see [open questions](open-questions.md)).

#### Milestone Writs (chapter gates)

The big set pieces (the Warlord, the mid-boss, the Elder, the Quiet Regions walk, the Final Writ) are too important to leave to a pool. They are **milestone Writs**: when one is next, the Writ board shows it as a distinct contract among the three offered, with the Registrar's name on it.

- It appears only after the prior revelations are seen and the player has completed a **minimum number of ordinary Writs** in the chapter (starting targets, to tune: I = 2, II = 3, III = 3, IV = 3). The minimum guarantees each chapter has time to be felt before the turn.
- It does not block anything. Ordinary Writs stay available, so a player who wants to power up first can, and one who wants the story can push on.
- Clearing it advances the chapter. Failing it leaves it on the board.
- The Final Writ is the one hand-authored (non-procedural) level; the other milestones are generated runs with one authored encounter placed by the same reserved-beat mechanism.

| ID | Chapter | Revelation | Tier | Delivered by |
|---|---|---|---|---|
| R1 | I | A mob does not attack. | 2 Run | Bark + a nonhostile unit in a Combat node on the spine |
| R2 | II | Some mobs carry children and carts. | 2 Run | Reserved Witness node |
| R3 | II | An enemy surrenders, and you can choose. | 2 Run | First Stand Down offer; Cleric reacts at the tavern (tier 1) |
| R4 | II | An enemy speaks plainly. | Milestone | Mid-boss monologue (short) |
| R5 | III | The bounty quotas predate any attacks. | 2 Run | Found ledger page (treasure / Witness); Mage's reaction in the hub |
| R6 | III | A map of the cities' expansion over their land. | 1 Hub | The Writ board or a merchant in the hub |
| R7 | III | The Elder knew the Registrar's name. | Milestone | Elder encounter |
| R8 | IV | The Writ pays more for targets who are not fighting. | 1 Hub | Writ board |
| R9 | IV | Quiet Regions. | Milestone | The Quiet Writ: revisit a cleared region |
| R10 | V | The Registrar's plan for the last settlement. | 1 Hub | After a run |
| R11 | V | There is no one left outside the last settlement. | Milestone | Final Writ |
| R12 | V | The Final Writ is the last. | Milestone | Final Writ |

Per-run capacity: at most **one** reserved run beat per run in Chapters I–II, and up to **two** (one of them can be the milestone encounter itself) in Chapters III–IV so the turn does not stall. Hub capacity is two per visit.

#### Failure and edge cases

- **Defeat or retreat before a reserved node:** the beat stays pending; see above.
- **Co-op:** a beat is consumed for the **campaign**, not per player. Any player present sees it. Players who join in later via the Rest campfire see it too.
- **Mid-run join/leave:** no effect on the schedule; only the run summary's `beatsSeen` list matters.
- **Quit mid-beat:** the beat is marked seen only on completion or on the node's resolution, so quitting at the wrong moment replays it.

### Off-ledger runs

Entered seeds, the daily seed and any future challenge runs do not alter the Ledger, conscience or chapter. They are fully playable sandboxes that borrow the generation and the Clan system so a seeded run still has a people, a place and a Writ, but cannot advance or end the story. This keeps seed sharing and determinism clean ([07](07-procgen.md)) and prevents "my friend's seed ruined my story".

## Mechanics

Everything in this section is proposed, not implemented.

### Stand Down and surrender

- Some mobs, from Chapter II, can enter a **Surrendered** state (instead of or in addition to being "interrupted"): they drop their weapon, stop attacking, and may kneel or flee.
- A held **Stand Down** input on a player marks that player as holding. Hold alone does not protect anyone.
- A Surrendered mob is safe **until anything damages it**. There is no friendly fire between players ([open questions](open-questions.md)), but the horde is AoE-first, so mercy requires *the whole party* to not splash them. Any player's blast that clips a Surrendered mob kills it, whoever intended what.
- This is a deliberate consequence of the game's shape: in a four-player AoE game, **mercy is cooperative and fragile**, and so is slaughter. One player striking forces everyone's hand.
- Design risk to test: accidental kills should be readable (an icon over Surrendered mobs, a distinct kill sound and a Ledger tag `slain-surrendered`) and not so punishing that mercy feels impossible. The tension is the point; frustration is not.

**Implemented (v0).** Available from Chapter II (and with `?surrender=1` in dev). Hold **U** (second keyboard player: `'`; pad: B or Y) to stand down. A standing hero cannot attack or use abilities and walks at 60%. After half a second (`STAND_TICKS`) any mob within 64 px (`STAND_RADIUS`) has a small chance each tick to lay down its arms (`src/data/surrender.ts`: goblins most willing, then archers, shield bearers, orcs; bombers, the Warlord and the undead never). A surrendered mob shows a white flag, does not attack, kneels for four seconds, then runs from the party; one that gets away counts as `spared`. Anything that damages it kills it like any mob, and the Ledger counts that as `betrayed`. R3 stages a group that has already surrendered, kneeling in the road until the party reaches it. Tuning is a first guess.

### Mercy has a price and a reward

- **Price:** Writs pay by the head. Spared mobs are lost income. A merciful run earns less gold and less renown *from that Writ*.
- **Reward:** Spared mobs produce things the Writ cannot: **gifts** (relics tagged `gratitude`), **info** (secret routes, lifted fog of war), and the **Conscience** the class trees can read. These are not "better" in stats, they are different in kind, which keeps the choice a real one instead of a free upgrade.
- Mercy is never mandatory for progress and never the only way to win a run.

### Counting heads

The existing kill streak and the coin per kill are untouched. What the game *adds*:
- A **head count** in the end-of-run summary, alongside the Writ's quota.
- The Ledger remembers `slain` and `spared` by species and by Clan.
- In later chapters the same number is rendered differently: Chapter I "Bounty collected: 1,438". Chapter IV "Souls": a number alone, no framing. Chapter V: the same number, on a blank screen.

### The codex tells the story you wrote

The codex is account-level and fills in as you play. "Goblin" starts as `Pest · 3g bounty · likes shiny things`. After Chapter II it gains a name for their language; by Chapter IV it lists the families you cleared, by Clan, with the numbers. Reading it late is the same act as reading the Ledger.

## Delivery without stopping the action

| Channel | Use | Interrupts play? |
|---|---|---|
| **Barks** | Class voices and mob lines in short, anchored text near the speaker | No |
| **Environment** | Camp props, banners, ruins, Quiet Regions | No |
| **Witness nodes** | Vignette played in the world, driven by player action | No (the party walks in) |
| **Hub** | Writ board text, the Registrar, city mood, party in the tavern | Yes, but the hub is not a run |
| **Codex** | Consolidated record | Opened from the hub |
| **Run-end summary** | Head count, spared, Clan name, a one-line epitaph | Between runs |

The one hard rule: nothing in a run pauses the sim for a story beat. The rare exceptions (the Elder, the final choice) are staged as *encounters in the world*, with the camera and the music doing the work.

**Hub scenes (implemented v0).** `src/data/story/hub.ts` holds them. A hub beat (R6, R8, R10) is its scene: seeing it plays the beat. Every other beat that played in a run gets an *aftermath* scene on the next return to the hub (tavern talk in the voices of the classes in the last party, and the Registrar), at most two per visit, each shown once (`src/campaign/scenes.ts`). The Writ board greets the party differently each visit and shows the mood of the city, which tracks the share of the campaign's toll that was mercy. The run summary ends with the Registrar's remark, which changes by chapter and result and notices mercy (chapters II-V) and betrayal.

## Endings

The ending is a function of **the Ledger's conscience tally** and **what the party does in the Final Writ**.

| Ending | Condition | What happens |
|---|---|---|
| **The Safe World** (completion) | The party finishes the Final Writ | The victory screen is a head count. The city celebrates. The world is quiet. The game offers no redemption, and the credits roll over the hub. |
| **Stand Down** (refusal) | The party declines at the Final Writ, any conscience | The party walks away. Reward for the final run is zero. The Tally Office is shown moving on to someone else. |
| **Too Late** | Declines with a high slain ratio | The refusal is real but the world is already empty. Quieter, bitter. |

An "avenge the monsters by killing the Crown" ending is **intentionally absent**. Revenge on the humans is the same logic as the Writ pointed the other way.

An ending is not the end of the game. After credits, the campaign can start a **new Ledger** while keeping characters, renown and the codex; the codex now remembers the previous campaign. A stretch idea for later: a second campaign where writs are **escorts** rather than sweeps, so the horde the player used to slaughter is now what they must protect.

## Meta integration

- **Profile save** gains `ledger: { chapter, revelations: string[], regions: Record<RegionId, 'unseen' | 'cleared' | 'quiet'>, slain: Record<MobKey, number>, spared: Record<MobKey, number>, endings: string[] }`. Versioned like everything else in the profile ([04](04-classes-progression.md)).
- **Per-character conscience** is separate from the account ledger, per the existing split of account vs. character data in [04](04-classes-progression.md).
- **Class tree** has an optional moral lean on some branches, as *which nodes become available*, not a stat bonus. Examples: the Cleric tree's keystone is only reachable by sparing; the Warrior's *Warlord* branch is gated by execution counts. Existing node types ([04](04-classes-progression.md)) cover this: Unlock / Keystone / Cosmetic-lore. No new node type is required.
- **Renown** payout is still per character, and the Writ's payout multiplier feeds it.
- **Hub** reads the Ledger for city mood, the Registrar's lines and class voices at the tavern.

## Determinism and architecture notes

- Add a `story` stream to the split in [07](07-procgen.md): `runSeed ──► … ─► story`. Clan generation and vignette filling must never touch the `map`, `rooms`, `enemies`, `loot`, `events` or `combat` streams. Witness *outcomes* are sim events; vignette *text* is cosmetic.
- The sim does not touch the profile. At run end it produces a **run summary** (heads slain and spared by species and Clan, witnesses seen, choices made). The meta layer applies it to the Ledger. This keeps the sim pure and the story testable.
- Surrender is sim state (it changes who fights), so it is hashed and replayable. The Stand Down input is an `InputFrame` field, like any other input.
- Which revelation is pending is a pure function of the Ledger: no RNG. The campaign layer passes it to the run as a `ReservedBeat` in `RunConfig`, and the run summary reports `beatsSeen`. The three Writs on the board are drawn from a campaign RNG, not a run seed, so a shared seed cannot advance or leak a revelation. Only the Clan *skin* of a beat comes from the `story` stream.
- Add generator tests: a reserved beat is placed on every route of every seed; a missed beat is re-reserved; a beat is not reserved before its prerequisites exist.
- Writ text is data (`src/data/story/`), with the slot templates validated by a test (every slot used must exist in the Clan shape; every vignette has an eligible chapter).

## Content and art needs

- **Non-combatant sprites:** kit (child), cook, elder, cart, tent, cookfire, laundry line. Reuse the existing palette and sprite pipeline ([02](02-rendering.md)).
- **Surrendered poses** for each existing mob type (drop weapon, kneel, back away).
- **Clan banners:** a small procedural glyph set plus a color per Clan.
- **Hub states:** city mood variants keyed to Ledger stage.
- **Quiet Region** dressing: the same biome with corpses, no spawns, no music.
- **Writing:** class bark sets (5 classes × chapter tiers), ~30–40 Witness templates (tier 3 flavor pool), the 12 authored revelation scenes across the three tiers, the Registrar's lines.
- **Audio:** the music thins as chapters advance; Quiet Regions are scored with nothing.

## Roadmap mapping

| Roadmap | Story work |
|---|---|
| **M1** (now) | None required. Optionally: a surrender state and a bark channel as spikes. The Chapter I boss is already the Warlord. |
| **M5** | Node graph with Witness nodes and a reserved-beat slot on the spine (with the validator); `story` stream; Clan generator; Writ board data; run summary object. |
| **M6** | Ledger in the profile; revelation queue and hub-beat triggers; milestone Writs on the board; codex; Conscience on characters; class-tree gating. |
| **M7** | Chapters II–V content, Quiet Regions, endings, audio pass, the Final Writ level. |

## Open questions

Tracked in [open-questions](open-questions.md):

- Is a **hard midpoint reveal** (Chapter III) the right shape, or should every beat stay a slow drift?
- How much does **mercy cost** before it feels like punishment? Needs playtesting.
- Does an accidental AoE kill of a Surrendered mob feel *fair*?
- How many **Witness templates** are enough that a player doesn't see repeats in the first ten runs?
- How many ordinary Writs should each chapter require before its milestone appears? (Starting targets are I = 2, II = 3, III = 3, IV = 3.)
- Is a **second campaign** (escorts) worth scoping for v1, or a later release?
- Final **title**, which is tied to the story and still undecided.
