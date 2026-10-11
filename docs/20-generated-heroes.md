# 20 — Generated Heroes

The player characters are **built from the run seed**, like the monsters, scenery and people. Each of the four player slots is one *person* (face, hair, beard, build, skin) in a colour the run rolled for that slot; the same person is drawn in every class they might pick. The class decides what they wear and carry, and those **class-defining parts are always there**: only their shape and colour vary, so a hero reads as their class whoever is under the gear.

```
run seed ──► generateParty(seed) ──► Party { people[4], looks[slot][class] }
                                        │
                      installHeroArt    │  composeHero(look) per (class, slot)
                                        ▼
                       S.heroes[class].anims[slot]  ◄── atlas "hero band" (640 rows)
```

## The class kit (always present)

| Class | Headgear | Weapon | Gear | Variants (`hat`, `weapon`, `off`, `adorn`) |
|---|---|---|---|---|
| Warrior | great helm (closed, or nasal with the face showing), crest in the player colour | short sword | shield, steel pauldrons | helm 2, sword 3, shield (kite/round/heater), crest (fin/ridge/plume) |
| Mage | pointed hat | staff with an orb | long robe, golden hem | hat (bent cone/tall cone/wide brim), staff head (orb/crystal/ring), badge (star/moon/none) |
| Cleric | mitre | shepherd's crook | stole or tabard, sun pendant | mitre (cross/sun/plain), crook (hook/ring/flame), vestment, pendant |
| Rogue | hood and mask (one glowing eye), crouch | twin daggers | long scarf in the player colour | hood (point/tail), dagger (straight/curved/long), mask (half/bandana/full/none: face shown), scarf length |
| Archer | feathered cap | bow | quiver | cap (soft/brimmed/hooded), bow (short/long/recurve), quiver (tall/slung/hip), 1-3 feathers |
| Shaman | feather headdress (fan, antlers or horned skull) | totem staff | totem bag, pelt mantle, face paint | headdress, totem (face/antler/bone), bag, paint (stripes/dots/bar) |

**Colours** are rolled per run (`rollSlotColors`, `data/heroes/roll.ts`): four hues spread round the wheel from a random start (at least ~45 degrees apart, so four players never share a colour), dealt to the slots in random order, each with its own saturation and lightness. The slot colour is the dominant garment colour (and the crest, shield field or scarf), so four heroes of one class still tell apart. Each hero also rolls a `second` cloth colour (the slot hue's neighbour or opposite) for the kit's hat, cap or headband, plus metal, wood, glow and feather colours. `installHeroArt` copies the party's colours into the HUD's `PLAYER_COLORS`, so a hero and their health bar always match.

Everything else about a person is rolled once per slot (`data/heroes/roll.ts`, `rollPerson`); a class only nudges it where the kit demands (a warrior is never `slight`, a helm-wearer's hair is short enough to sit under it).

## Pipeline

- **Data** (`data/heroLook.ts`, `data/heroes/`): `HeroLook` (person + palette + variant numbers), `CLASS_KITS`, `generateParty(seed)`, `heroLook(party, slot, class)`. Pure functions of the seed with their own `Dice` streams; the sim never reads them.
- **Poses** (`data/heroes/poses.ts`): the hand-made rigs' own pose tables (weapon angle, hand, stride, bob) for idle, walk, sweep, finisher, recover, cast, hurt and the mage's shoot, so every frame `heroFrame` (render/hero.ts) picks is where it expects, with the same timings. The down frames (kneel, lie flat, headgear and weapon fallen beside) are drawn by the composer.
- **Composer** (`render/heroArt.ts`, class parts in `render/heroKit.ts`): the person is drawn with the same face/hair/beard code as the story figures (`humanArt.ts`), on the shared pixel kit. A class's four slots share one cell size and pivot (`render/heroSprites.ts`), which `HeroSet` relies on.
- **Install** (`render/heroSprites.ts`): composed at start and on every new run seed (`applyParty` in `main.ts`), packed into the atlas's hero band.

## Tools

| | |
|---|---|
| `node tools/hero-sheet.mjs --seeds 1,2 --scale 8 --out heroes.png` | contact sheet: a row per slot, a column per class (`--anim walk --frame 2`) |
| `/art/heroes.html?seed=N` (dev server) | the hero roller. *Parties* (default): eight random parties standing together, each member a random class in the colours that run rolled. *Roster*: one seed's four players in every class with the variant numbers and colours. Animated at the game's speeds; anim, zoom, roll/prev/next |
| `node tools/hero-sheet.mjs --class rogue --anim down --out d.png` | every frame of one class's animation, a row per slot |

## Not yet

The hand-made rigs (`art/chars`, the sheet builder) are deleted. No personal names for heroes; a hero's person is fixed per slot per run, not chosen. Sweep and cast poses reuse the old tables, so the arcs match the slash FX but a very wide weapon variant can clip its cell.
