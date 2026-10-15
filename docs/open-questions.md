# Open Questions

Track undecided items here. When resolved, move to an ADR in [decisions](decisions/README.md) and link it.

## Identity
- [x] **Game title.** *The Final Tally: Per Head.* "The Final Tally" is the Chapter V name for the campaign's end; "Per Head" is how the bounty is paid. Cheerful on day one, damning after the turn. Set in `src/data/title.ts` and `public/index.html`. (The repo and the dev docs still say "castle crashers", the game that inspired it, and that is not the title.)
- [x] **Tone: goofy-cartoon** (Castle Crashers), not grim. Art and humor stay bright; the story's drift to quiet in [12](12-story.md) is unchanged (visuals get emptier, not grimmer).

## Story (see [12](12-story.md))
- [x] **Hard midpoint reveal (Chapter III)**, skippable, gated on Ledger state, in a new scene full of gore left by other hunters. See [12](12-story.md#iii--the-ledger-midpoint-turn).
- [ ] How much should mercy cost before it feels like a punishment?
- [ ] Is an accidental AoE kill of a Surrendered mob fair? How is it surfaced?
- [ ] Minimum ordinary Writs per chapter before its milestone appears (starting targets: 2 / 3 / 3 / 3).
- [ ] Witness template count needed to avoid repeats in the first ten runs.
- [ ] Is the second ("escort") campaign in scope for v1?

## Technical
- [x] **Float vs. fixed-point sim.** Resolved: doubles with discipline; see [ADR-0004](decisions/0004-float-sim-and-characters.md).
- [x] Bundler: esbuild + tiny dev/test scripts in `tools/`.
- [x] ECS storage: struct-of-arrays typed arrays (hordes).
- [ ] Atlas: single vs. multiple; max texture size target.
- [ ] Audio formats/tooling (ogg vs mp3 vs wav).
- [x] **Save storage: IndexedDB.** The run save moves off `localStorage` (`campaign/runSave.ts` is still on it). Open detail: the last save is written as the page closes (`pagehide`), where only a synchronous write is sure to finish, so [21](21-the-road.md)'s "localStorage, uncompressed" reasoning needs an answer (e.g. a synchronous localStorage mirror of the latest save, or rely on the 10 s autosave). Small flags (tutorial, road memory) stay in `localStorage`.

## Gameplay
- [x] **Friendly fire: off.** Heroes never hurt each other; difficulty can be added later by other means.
- [ ] Number of active ability slots (proposed 4) and whether resource systems differ per class or share a model.
- [ ] Per-player time dilation while swap ring open: on, off, or option?
- [ ] Do players pick any class every run, or are classes also gated by meta unlocks?
- [x] Can two players pick the same class? Yes, with distinct palettes.
- [x] Renown: per character (multiple characters per class allowed). See [ADR-0004](decisions/0004-float-sim-and-characters.md).
- [ ] Character slot limit; can characters be retired/deleted; does a new character start with any head start?
- [ ] Do class tree nodes grant raw stats at all, or only expand offer pools/options? (Draft answer in [22](22-class-trees.md): pools and options only.) Also open there: the 2-of-3 branch focus cap, whether achievements carry across same-class characters.
- [ ] Shaman and totems: bag reset rule, whether mobs can kill totems, hold-to-lob, per-kind vs total cap, pool size. See [18](18-shaman-and-totems.md#open-questions).
- [ ] Run length target (25–40 min is a guess).
- [x] **No death penalty.** Nothing extra is lost on a death; difficulty can be added later.

## Content
- [ ] Biome list and theming (Forest, Keep, Crypt, Frozen Pass, Volcano, Sky Citadel?).
- [ ] Final roster of v1 classes: 5 or 6? Six are built now (warrior, mage, cleric, rogue, archer, shaman); confirm the shaman is the sixth.
- [ ] Palette: master palette selection (e.g. start from an existing open palette or craft our own).

## Networking (deferred)
- [ ] Host-auth vs rollback vs lockstep (see [08](08-multiplayer.md)).
- [ ] Signaling hosting (serverless function vs. small relay).
- [ ] Cross-play of profile/renown in online sessions.
