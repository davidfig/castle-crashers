# 10 — Roadmap

Milestones are ordered to prove risk early: **feel first, then structure, then content, then meta.**

## M0 — Foundations ✅ done
Built: esbuild/TypeScript toolchain, deterministic sim with seeded RNG streams and state hash, determinism lint (`npm run check`), unit tests (`npm test`), WebGL2 pipeline (640×360 FBO, integer-scaled blit, instanced sprite batcher, procedural atlas, bitmap font), keyboard and gamepad input with multi-player slot claiming.

- Repo, TypeScript, bundler, dev server, lint/format, test runner.
- Fixed-step loop, seeded PRNG, math helpers, state hash.
- WebGL2 context, low-res framebuffer, integer-scaled blit, sprite batcher, bitmap font.
- Keyboard + gamepad input → `InputFrame`.
- **Exit:** colored sprites move on screen at a stable 60 Hz, pixel-perfect at any window size.

## M1 — The Horde Feel (in progress)
Done so far: Warrior with a sweeping 3-hit combo (wide arcs, finisher wave, lunge, bowling knockback, launched bodies), fury-powered AoE nova and plowing dash; sim-level hit-stop; five enemy types (goblin, orc, archer, shield bearer, bomber) with telegraphs that hits interrupt; arrows, chain-explosions, reinforcement director; level of ~1,400 mobs in clumps along a 4,800 px field; corpses, particles, screen shake, kill-streak counter, 1–4 player join, tethered camera, down/revive, win/lose; headless bot playtest (`npm run playtest`). Coins drop from kills, scatter, and are magnet-collected into shared gold. **Boss (first pass):** the Orc Warlord ends the battlefield: huge, super-armored, with a retinue and war-cry summons, a club smash, ground slam, bull charge, and an enrage phase; killing it wins the run. **Still to do:** more bosses and mini-bosses, summoner/elite enemies, damage numbers or aggregated hit feedback, balance with real playtesters, sound, XP.

Original M1 goals:
- Depth-lane movement, jump, attacks, hitboxes/hurtboxes, hit-stop, knockback.
- One class (Warrior), one enemy type with AI + telegraphs.
- Camera, shadows, damage numbers, juice.
- **Exit:** carving through a 200-mob horde with AoE feels *good*. (This is the gate for everything else.)

## M2 — Local Co-op
- 1–4 players, join flow, per-player palette, tethered camera, down/revive.
- Enemy token system, party-size scaling.
- Character-anchored HUD framework (anchor + layout).
- **Exit:** four people play a room together comfortably.

## M3 — Items & the Swap Ring
- Item data model, drops, pickups, equipment, stat engine.
- Swap ring, comparison tags, drop/hand-over/toss, backpack.
- **Exit:** pass an item between players without a menu.

## M4 — Progression In-Run
- XP, levels, level-up strip with offers, ability bench & slots, perk/mutation system.
- 3 more classes (Mage, Cleric, Rogue) to stress the system; Archer after.
- **Exit:** two runs with the same class produce noticeably different builds.

## M5 — Procedural Runs
- Chunk library + room assembler, encounter budgets, node graph with forks.
- Biome 1 complete: ~6 node types, 2 mini-bosses, 1 boss.
- Rest room, merchant, shrine.
- **Exit:** a full run start → boss → end screen, differing per seed.

## M6 — Meta Progression
- Hub, renown payout, class tree data + UI, profile persistence (versioned).
- Achievement-gated nodes, codex.
- **Exit:** play 5 runs and watch your class tree materially change your offers.

## M6.5 — UI & Screen Art
The menus, the camp, the board and the story screens work but are placeholder: flat rectangles and a 3x5 caps-only font. This milestone gives them a look. Plan and status per screen in [13 UI & Screen Art](13-ui-art.md).
- **The look:** an illuminated ledger: vellum pages, lead outlines, gold leaf (the "Glass" palette in `art/palette.mjs`), because the game is about a bounty office and its books.
- **Kit first:** panel and card frames, rarity borders, cursors, ornaments; a story font with lowercase and punctuation; icons for upgrades, wares, node types and the level-up pip. Everything else reuses these.
- **Then:** portraits (the Registrar, the peddler, one per class), scene art for the hub (tavern, board, market, city square), the camp backdrop, the title and logo, clan banners.
- **Exit:** every screen in a full run, from the Writ board to the summary, is drawn from the kit with no flat-rectangle placeholders left.

## M7 — Content & Polish
- Biomes 2–3, more enemies/items/bosses, music & SFX pass, settings, accessibility.
- Balance tooling (headless simulation of many seeded runs).
- **Exit:** a shippable vertical slice.

## M8 — Network Plumbing → Online (post-v1)
- Implement `Transport` over WebRTC, signaling service, desync detection.
- Host-authoritative prediction or rollback (ADR).
- Lobbies/invite links.

## Cross-cutting, always
- Keep sim deterministic (CI test: golden hash per seed/input script).
- Performance budget checks (draw calls, allocations).
- Docs updated alongside changes.

## Risks

| Risk | Mitigation |
|---|---|
| Combat doesn't feel good | M1 is a gate; iterate on feel before building breadth |
| Four-player horde screen is unreadable | Silhouette/color discipline, ground rings per player, elite telegraphs, corpse decals fading, playtest at M2 |
| Hordes tank perf | SoA + spatial grid + one-draw-call batcher (done); profile at 3,000+ mobs |
| Art workload for many classes/animations | Small roster first, palette swaps, shared animation skeletons |
| Float determinism across browsers | Own trig, state-hash tests; consider fixed-point before M8 |
| Scope creep in meta/trees | Ship 1 class's tree fully (M6) before duplicating the pattern |
