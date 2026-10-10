# Project Docs

Working title: **TBD** (see [open-questions](open-questions.md)).

A locally co-op, pixel-art, fantasy beat-'em-up roguelike. Built with TypeScript and WebGL2, with as few runtime dependencies as possible.

## Index

| Doc | Purpose |
|---|---|
| [00 Vision](00-vision.md) | Pillars, audience, scope, what the game is and isn't |
| [01 Architecture](01-architecture.md) | Code layout, game loop, sim/render split, dependency policy |
| [02 Rendering](02-rendering.md) | WebGL2 pixel pipeline, sprite batching, lighting, palette |
| [03 Gameplay & Combat](03-gameplay-combat.md) | Movement, combat, enemies, bosses, co-op rules |
| [04 Classes & Progression](04-classes-progression.md) | Classes, in-run leveling, renown, class trees |
| [05 Items & Trading](05-items-trading.md) | Item model, rarity, pickups, player-to-player trading |
| [06 UI](06-ui.md) | Non-blocking, character-anchored UI |
| [07 Procedural Generation](07-procgen.md) | Run structure, level generation, seeding |
| [08 Multiplayer & Netcode](08-multiplayer.md) | Local co-op now, network plumbing for later |
| [09 Input, Audio, Assets](09-input-audio-assets.md) | Controllers, Web Audio, asset pipeline |
| [10 Roadmap](10-roadmap.md) | Milestones |
| [11 Backgrounds](11-backgrounds.md) | Sky, parallax, ground, biomes, time of day |
| [12 Story](12-story.md) | Premise, chapters, the Ledger, how procgen carries the story |
| [13 UI & Screen Art](13-ui-art.md) | The illuminated-ledger look, what every screen needs, the kit and its status |
| [15 The Random Bestiary](15-random-bestiary.md) | Per-run generated monsters and bosses: slots, powers, looks, determinism, tools |
| [Briefs](briefs/frozen-pass-roster.md) | Hand-off briefs for work another owner picks up (now: the Frozen Pass enemy roster) |
| [Open Questions](open-questions.md) | Things we haven't decided |
| [Decisions (ADRs)](decisions/README.md) | Log of decisions and why |
| [Glossary](glossary.md) | Shared vocabulary |

## How to use these docs

- Docs are the source of truth for **intent**; code is the source of truth for **behavior**. When they diverge, fix one of them.
- Anything marked **Proposed** is a default we'll build against until challenged. Anything marked **Decided** has an ADR.
- Numbers (damage, cooldowns, drop rates) in docs are starting points, not balance. Real values live in data files under `src/data/`.
- Keep docs short. If a section grows past a screen or two, split it.
