# Glossary

| Term | Meaning |
|---|---|
| **Run** | One playthrough from class selection to victory or defeat. Procedurally generated from a seed. |
| **Seed** | Value from which all of a run's randomness derives. |
| **Stream** | An independent RNG sequence derived from the run seed (map, loot, combat, ...). |
| **Tick** | One fixed simulation step (1/60 s). |
| **Sim** | The deterministic game-rules layer. No platform access. |
| **InputFrame** | One player's quantized input for one tick. The only way players affect the sim. |
| **Presentation event** | Fire-and-forget message from sim to render/audio/UI (sound, shake, particles). |
| **Renown** | Meta currency earned per run, spent in class trees. |
| **Class tree** | Per-class graph of persistent unlocks that widen in-run options. |
| **Offer** | The set of 3 upgrade choices presented at level-up. |
| **Bench** | Owned-but-inactive abilities that can be swapped into active slots mid-run. |
| **Swap ring** | Radial, non-blocking UI around a character for switching abilities/items and handing items over. |
| **Hand-over** | Giving an item directly to a teammate. |
| **Claim window** | Short period after a toss where only the intended recipient can pick up the item. |
| **Lane** | Depth position on the ground plane (beat-'em-up Y axis). |
| **Chunk** | Hand-authored level piece, assembled procedurally into rooms. |
| **Node (map)** | An encounter on the branching run path (combat, elite, shrine...). |
| **Node (tree)** | A purchasable unlock on a class tree. Context disambiguates. |
| **Token** | Enemy-attack permission: limits simultaneous attackers per player. |
| **Telegraph** | Visible windup indicating an incoming enemy attack. |
| **Hit-stop** | Brief freeze on impact to add weight. |
| **Rest room** | Safe room with in-world interactions (heal, merchant, drop-in). |
| **Archetype** | One of the hand-made biome templates (Meadow, Haunted Keep, ...) that a run varies into its own biome. |
| **World (scenery)** | A run's generated biomes plus the road that turns one into the next (`generateWorld`). |
| **Span / turn** | One stretch of road over which one biome turns into the next; the share rises along a seeded curve. |
| **Share** | The fraction (0..1) of the road's elements that belong to the incoming biome at a point of a turn. |
| **Tone** | A biome's colour shift from its archetype: hue of its foliage band, sky hue, saturation, lightness. |
| **Totem** | A planted, hero-owned entity that pulses an area effect on a beat for a while (the shaman's only damage). See [18](18-shaman-and-totems.md). |
| **Totem bag** | The shaman's ordered loadout of totems; Attack plants the ready one and the bag advances. |
| **Bestiary** | A run's generated cast of monsters and bosses (`MOBS[type]`), the same for the whole run. The hand-made roster is `CLASSIC_MOBS`. See [15](15-random-bestiary.md). |
| **Skill** | A delivery made of an element, tuned by modifiers. See [16](16-skills-and-elements.md). |
| **Element** | What a skill or attack is made of (fire, ice, lightning...); decides what it does on a hit and in a pulse. `data/elements.ts`. |
| **Delivery** | How a skill reaches its target (`Special.kind`: projectile, pool, aura...). |
| **Writ** | A bounty contract taken from the board; the campaign's unit of story. See [12](12-story.md). |
| **Ledger** | The running tally of what the party has done (kills, mercy) that colours the story and ending. See [12](12-story.md). |
| **Surrendered** | A mob that has laid down its arms (mercy); safe until anything damages it. |
| **Over the hill** | The shared way mobs enter from the top (climbing the crest) and leave; see [03](03-gameplay-combat.md). |
| **Camp** | The one place between levels where the action stops and menus are allowed. See [07](07-procgen.md). |
| **Site** | A chest or shrine standing on the field, opened by standing near it (`sim/sites.ts`). |
| **Road** | The continuous stretch of scenery (and, proposed, the run itself) over which biomes turn into one another; `Road` in [17](17-generated-scenery.md), whole-run design in [21](21-the-road.md). |
| **Region** | Proposed: one generated place on the road graph; a run passes about five. See [21](21-the-road.md). |
| **Snapshot** | A complete, exact save of the sim's `GameState` that restores to an identical run (`sim/snapshot.ts`). |
| **Folk** | The per-run generated people of the story (`generateFolk`) and the player heroes (`generateParty`); see [19](19-generated-humans.md), [20](20-generated-heroes.md). |
