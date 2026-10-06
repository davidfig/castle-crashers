# 13 — UI & Screen Art

Status: **in progress** (roadmap M6.5). Every screen below works and is playable; this doc is about how it should *look*, and what is built so far.

## The look: an illuminated ledger

The game is about a bounty office and its books, and the repo's art direction already has a "Glass" palette (stained glass and illuminated manuscripts: jewel tones, flat fills, a dark lead outline, gold leaf for light; `art/palette.mjs`). The screens use it:

- **Pages** of vellum for anything read (scenes, the summary, the Writ board): dark ink on warm paper, a crimson header, gold leaf rules and corner flourishes.
- **Panels** of deep lead-violet for anything chosen (the camp's picks, the merchant, the doors): a gold inner line, corner ornaments, lapis and crimson accents in each player's colour.
- **Cards** with a rarity border (steel, verdigris, lapis, crimson, gold).
- Whole pixels only, no gradients, the same 640x360 canvas as the game ([02](02-rendering.md)).

## What every screen needs

| Screen | Where | Needs (beyond the kit) | Status |
|---|---|---|---|
| Writ board | `render/menu.ts` (board) | Parchment notice per Writ, biome picture (done), milestone seal, the Registrar's desk | a vellum notice per Writ with its biome picture, a raised gold-edged selection, a wax seal on a milestone: **done**; the Registrar's desk planned |
| Character select | menu (select) | Class portraits, ready stamp | framed player-coloured panels, hero on a pedestal, name, abilities, health: **done**; real portraits and a drawn ready stamp planned |
| Hub scenes (tavern, map, board) | menu (scene) | A backdrop per scene, a figure for the speaker | **done**: eight drawn places, the party and the Registrar standing in them, one beat of talk at a time |
| Run summary | menu (text) | Same page; the Registrar beside his remark | vellum page + story font + the Registrar: **done** |
| Camp: spoils | menu (text) | Campfire backdrop | vellum page + story font: **done**; backdrop planned |
| Camp: level-up picks | menu (picks) | Card frames, upgrade icons | **done** (panels, cards, icons) |
| Camp: merchant | menu (shop) | The peddler, ware icons, SOLD stamp | cards, icons, story-font names, the peddler (talks when you buy): **done**; a drawn SOLD stamp planned |
| Camp: doors | menu (doors) | Door frames with node icons | framed panels, node icon, cursor: **done** |
| Level-up panel (in the sky band) | `render/levelup.ts` | Card frames, upgrade icons, the pip | **done** (framed cards, icons, a star pip) |
| Barks | `render/barks.ts` | Story font, speech bubble tail | vellum bubble with a tail, story font: **done** |
| Title and logo | `render/titleArt.ts` | The name, a backdrop | **done**: dusk, the keep with lit windows and a waving banner, a horde crossing the field, the name on a gold plaque, a "Per Head" ribbon; shown on a fresh load (`?hub=1` skips it); the name is *The Final Tally: Per Head* |
| Hub (the city) | none yet | The city at each chapter's mood | planned |

## The kit (built)

All procedural for now (`src/render/uiArt.ts`, packed into the atlas with the rest), so it ships with no asset files; the shapes are defined as text bitmaps like the existing placeholder art, and can be replaced by drawn art from the workbench later without touching the screens, which only call the helpers in `src/render/ui.ts`.

- **Panels and pages:** `drawPanel` (ink or vellum, gold inner rule, four corner flourishes, optional accent colour) and `drawCard` (rarity border).
- **Marks:** a selection cursor, a divider ornament, the level-up star.
- **Icons (9x9):** the five upgrades (hammer, shield, boot, coin, heart), the Lesson (book), and the node types (swords for a battle, a purse for the merchant, a flame for the fire).
- **The story font:** `src/data/storyFont.ts`, a 5x7 face with a two-row descender, lowercase and punctuation, proportional widths. The old 3x5 caps-only font stays for the HUD and numbers. Story text is no longer stripped of commas and apostrophes or forced to capitals.

## Story figures (built)

The art workbench ([art/README.md](../art/README.md)) makes small full-body characters, not busts, so the Registrar and the peddler are **figures**: `art/chars/registrar.mjs` and `peddler.mjs`, built like the heroes (a robed paper-doll rig, the Glass palette, lead outline), each with an *idle* loop and a *talk* loop. The screens draw them pixel-doubled four times, standing beside the text: the Registrar on the right of every scene and run-summary page (talking), the peddler beside the stall (talking after a sale or a refusal). Their sheets are packed into the atlas with the other art (`src/render/npcArt.ts`, `npcSheets.ts`). Adding another speaker is a new file in `art/chars/` and a line in those two files.

## Hub scene backdrops (built)

A hub scene is now a place, not a page: a full-screen drawn set (`src/render/sceneArt.ts`), the party's first two heroes standing at the left (idle sprites, three times size) and the Registrar at the right (four times, in his talk loop while he speaks), and the talk in an ink panel below, **one beat at a time** (attack moves on; dots show how far). The page layout stays for the run summary and the camp's spoils.

| Set | Used by | What is in it |
|---|---|---|
| Tavern | after R1 | beams, a hearth with a live flame, lanterns, a night window, tables with mugs |
| City gates | after the Warlord | a wall and towers at dusk, the gate with its portcullis, crimson banners, fluttering bunting |
| Rain over the city | after R2 | rooftops with lit windows, a pale moon, falling rain, puddles |
| Campfire | after R3, after the Elder | night, pines, tents, a fire with rising sparks |
| Smoke | after R4 | a red dusk, rising smoke columns, spears with torn flags, a broken wagon |
| Registry office | R5, R8 and R10 | shelves of ledgers, the great map of the realm, a desk, a lamp |
| Market | R6 (the map) | stalls with striped awnings, rolled maps, tall houses |
| Graves | after R9 (the Quiet Region) | a grey dawn, rows of mounds and crosses, mist, a bare tree, crows |

Each set is deterministic and animated from the clock (flames, rain, smoke, bunting, lamp flicker), and is clipped to its area. To look at one: `?scene=R1:after` (also `R6`, `R8`, `R10`, `warlord:after`, `R2:after` ... `R9:after`), with `&page=N` to start at a beat and `&party=archer,mage` for who stands in it. Nothing is saved.

## Still to make

More NPCs as the story needs them (the Elder, the mapmaker), a backdrop for the camp's spoils page (a campfire), the clan banners as pictures, the peddler's stall, and a proper icon set once the real upgrade and item pools exist (the 9x9 icons here are stand-ins for the five placeholder upgrades).

## How to work on it

`?camp=shop`, `?camp=picks&players=4&pending=2`, `?camp=doors` and `?camp=spoils` open the camp screens directly ([07](07-procgen.md)); the board and hub scenes show on a fresh load, and `?reset=1` starts a new campaign.
