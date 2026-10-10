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
