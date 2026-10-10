# 18 — Generated Humans

The people of the story (the Registrar, the King, the Herald, the Captain, the Elder and the peddler) are **built from the run seed**: the same
run always has the same faces and clothes, the next run has new people in the same offices. A run's King might be a stout bearded man in
green with a fur collar; the next, a tall clean-shaven woman in crimson with a circlet. They fill the same slots as the hand-made figures,
so road scenes, quest givers and the story screens use them with no other change.

```
run seed ──► generateFolk(seed) ──► Folk { livery, looks[NpcName] }
                                      │
                       installFolkArt │  composeHuman(look) per figure
                                      ▼
                       S.npcs[name] = NpcSet  ◄── atlas "folk band" (64 rows)
```

- **Offices** (`data/humans/roll.ts`, `NPC_ROLE`). An office is a wardrobe table: noble (crown or circlet, robe or coat, fur or long cloak, sceptre),
  herald (plumed cap, tabard, trumpet), captain (helm, plate, long cloak, sword), clerk (spectacles, ledger or scroll, robe), peddler (brimmed hat,
  pack, cane or lantern), elder (stooped, long beard, staff), commoner (anything, for crowds). Each slot is a weighted table, so an office is
  recognisable by its silhouette and still varies: the Herald always carries a trumpet, but his hair, beard, build, face and colours are rolled.
- **Livery.** The King, Herald and Captain share the court's colours this run (cloth hue, trim metal), each at their own depth, so a court looks like one.
  Everyone else rolls independent colours.
- **Look** (`data/humanLook.ts`). Height (15-21 px), build, stoop, hair style and colour, beard, headwear, garment, hem, cloak, what is held, extras
  (spectacles, chain, sash, pauldrons, pack, apron...), face (eye spacing, brow, nose) and a six-colour palette (skin, hair, cloth, accent, trim, leather).
- **Sprites** (`render/humanArt.ts`). Composed at run start from the shared pixel kit (`render/pixelKit.ts`: shaded ellipses, rects, lines, polygons, ASCII
  stamps, the rim-and-ink post pass, the sheet packer; the monster composer uses the same). Four-frame `idle` (breathe, blink) and `talk` (mouth, a
  raised hand) loops, the shape of the hand-made NPC sheets, so `npcArt.ts` and every consumer read them unchanged.

## Determinism

`generateFolk(seed)` is a pure function of the run seed with its own random streams (`Dice` salts), never the sim's, and nothing in the sim reads it:
people are pictures. `main.ts` installs it (`applyFolk`) at start and on every new run. `generatePerson(seed, role, n)` makes any number of further
people of one office, each a pure function of `(seed, role, n)`: the hook for crowds, captives and villages.

## Tools

| | |
|---|---|
| `node tools/folk-sheet.mjs --seeds 1,2,3 --scale 8 --out folk.png` | contact sheet: a row of the six story figures per seed (`--extra N` adds commoners, `--anim talk`, `--frames`) |
| `?folk=classic` (dev) | keep the hand-made figures from the art workbench |

## Not yet

Figures are only the six story slots; names and titles (LORD ALDRIC...) are still fixed in `data/quests.ts`; no walk or combat poses (a freed captive hops,
the ward is a still figure); the hand-made art stays for the art workbench screens.
