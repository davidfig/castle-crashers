# Open Questions

Track undecided items here. When resolved, move to an ADR in [decisions](decisions/README.md) and link it.

## Identity
- [ ] **Game title.** Deferred until the game is playable. Story is drafted in [12 Story](12-story.md). Using a placeholder name; "castle crashers" is an existing trademark so it won't ship.
- [ ] Tone: goofy-cartoon (Castle Crashers) vs. grim-ish (Dead Cells)? Affects art and humor.

## Story (see [12](12-story.md))
- [ ] Hard midpoint reveal (Chapter III) vs. a continuous slow drift.
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
- [ ] Save storage: `localStorage` vs. IndexedDB from the start.

## Gameplay
- [ ] **Friendly fire policy.** Off, on, or modifier?
- [ ] Number of active ability slots (proposed 4) and whether resource systems differ per class or share a model.
- [ ] Per-player time dilation while swap ring open: on, off, or option?
- [ ] Do players pick any class every run, or are classes also gated by meta unlocks?
- [x] Can two players pick the same class? Yes, with distinct palettes.
- [x] Renown: per character (multiple characters per class allowed). See [ADR-0004](decisions/0004-float-sim-and-characters.md).
- [ ] Character slot limit; can characters be retired/deleted; does a new character start with any head start?
- [ ] Do class tree nodes grant raw stats at all, or only expand offer pools/options?
- [ ] Run length target (25–40 min is a guess).
- [ ] Death penalty detail: anything kept besides renown & codex?

## Content
- [ ] Biome list and theming (Forest, Keep, Crypt, Frozen Pass, Volcano, Sky Citadel?).
- [ ] Final roster of v1 classes: 5 or 6? Which one is the 6th?
- [ ] Palette: master palette selection (e.g. start from an existing open palette or craft our own).

## Networking (deferred)
- [ ] Host-auth vs rollback vs lockstep (see [08](08-multiplayer.md)).
- [ ] Signaling hosting (serverless function vs. small relay).
- [ ] Cross-play of profile/renown in online sessions.
