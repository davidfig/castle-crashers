# 0003 — UI never blocks gameplay during a run
Status: Accepted
Date: 2026-10-05

## Context
In four-player co-op, a pause or modal from one player stops everyone and breaks the flow. We want quick, in-the-moment swaps of items and abilities.

## Decision
During a run there are no pause menus or modal dialogs. UI is anchored near each character, glanceable, safe to ignore, and operable quickly (swap ring, level-up strip, item tags, toasts). Menus are allowed only in the hub and settings outside runs. Gameplay-affecting UI interactions are expressed as sim inputs.

## Consequences
- UI must be designed for speed and low cognitive load; ties into the swap-ring and hand-over mechanics.
- No global pause in multiplayer; single-player may have a minimal explicit pause.
- Deterministic UI-as-input keeps the netcode path open.
