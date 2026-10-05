# 00 — Vision

## One-liner

A side-scrolling **battlefield** roguelike: 1–4 friends on one screen push left to right through hordes of hundreds of small enemies using area-of-effect abilities, on a different procedurally generated fantasy run each time, level up as they go, and slowly grow a persistent class tree across runs.

## Pillars

1. **Battlefield scale.** Tiny heroes, huge landscapes, and *hundreds of enemies on screen at once*. Individual characters are small relative to the world; the fantasy is a few heroes carving a path through an army. Abilities are AoE-first so progress against the horde feels earned and spectacular. See [ADR-0005](decisions/0005-horde-scale-battlefield.md).
2. **Couch co-op first.** Four players on one screen is the primary experience. Solo is supported, not the focus. Everything is designed to be readable and fun with four characters and a screen full of enemies.
3. **Never stop the action.** No pause-to-menu inventories, no modal dialogs during a run. All UI is small, near the character, and dismissible by simply continuing to play. See [06 UI](06-ui.md).
4. **Every run is different.** Levels, enemies, loot, and level-up offers are all seeded and varied. No two runs should feel scripted.
5. **Two layers of growth.** Within a run you gain XP, level up, and find items. Between runs you earn *renown* that grows your class tree. Meta progression widens your options; it should not simply make numbers bigger. See [04](04-classes-progression.md).
6. **Items are social.** Loot is meant to be passed around. Finding the right item for your friend is as fun as finding it for yourself. See [05](05-items-trading.md).
7. **Crunchy pixels.** Deliberately low-resolution pixel art with chunky, juicy feedback: hit-stop, screen shake, squash and stretch, big numbers. See [02](02-rendering.md).

## Audience

Friends and families who play together on a couch with controllers; people who like Castle Crashers, Streets of Rage, Hades, Dead Cells, and Vampire Survivors–style "build emerges as the run goes on" games.

## Scope boundaries

**In scope (v1)**
- 1–4 local players, keyboard and gamepads.
- 5–6 classes with a class tree each.
- A run of ~25–40 minutes: several biomes, mini-bosses, final boss.
- Meta progression with persistent save in the browser.
- Item pickups, equipment, consumables, trading.
- Desktop browsers (Chrome, Firefox, Safari) with WebGL2.

**Explicitly out of scope for v1**
- Online multiplayer (but the architecture must not preclude it; see [08](08-multiplayer.md)).
- Mobile/touch controls.
- Level editor, mod support.
- PvP.

## Success criteria for a "fun" prototype

- Four players can run into a room, fight 10+ enemies, pick up an item, and hand it to a friend without anyone opening a menu.
- A run takes under 2 minutes to set up and each run feels measurably different from the last.
- The sim holds 60 FPS with 4 players and **1,500+ active mobs** on a mid-range laptop (currently met with ~1,900 mobs and one draw call).
- A single AoE ability visibly clears a pack, and the player feels the push forward.
