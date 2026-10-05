# 0004 — Float (double) sim with discipline; renown per character
Status: Accepted
Date: 2026-10-05

## Context
Two decisions made together.

**Sim numerics.** JS numbers are IEEE-754 doubles. `+ - * /` and `Math.sqrt` are exactly specified, so they produce identical results on every engine. `Math.sin/cos/atan2/pow/exp/log` are implementation-approximated and may differ between browsers/OSes. Fixed-point avoids float concerns entirely but costs ergonomics: JS has no 64-bit ints, so multiplies need care (`Math.imul` overflows at 32 bits; you either choose small ranges or multiply as doubles then truncate), every constant/formula is scaled, and code is harder to read and tune.

**Progression ownership.** Renown could be account-wide, per class, or per character.

## Decision
- Sim uses **plain doubles**. Allowed in `sim/`: `+ - * /`, `Math.sqrt`, `Math.abs/min/max/floor/ceil/round/trunc`. Disallowed: `Math.sin/cos/tan/atan2/pow/exp/log/hypot` and `Math.random` (use `engine/math` lookup-table trig and the seeded PRNG). Enforce with a lint rule/grep check in CI.
- No reliance on object key order; iterate arrays in stable order.
- Keep a **golden state-hash test** (seed + scripted inputs → hash after N ticks) and run it in Chromium, Firefox and WebKit before online work. If any engine diverges, revisit fixed-point at that point, scoped to the sim only.
- **Renown is per character.** A character is a saved instance of a class with its own renown and class-tree progress. A player may have multiple characters of the same class to explore different builds. Account-level data (codex, settings, global cosmetics) is shared.

## Consequences
- Normal, readable gameplay code; fast to iterate on feel (the M1 gate).
- Determinism across browsers is *probable, not proven* until the cross-engine hash test exists. Cost of being wrong later: a contained refactor of `sim/` math, which is why the discipline rules above matter now.
- Host-authoritative netcode would work regardless; lockstep/rollback depends on the cross-engine test passing.
- Profile schema needs a `characters[]` list; the hub needs character create/select UI.
