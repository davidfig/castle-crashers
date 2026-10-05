# Architecture & Design Decisions

Short records of decisions that are costly to reverse. One file per decision: `NNNN-short-title.md`.

## Template

```markdown
# NNNN — Title
Status: Proposed | Accepted | Superseded by NNNN
Date: YYYY-MM-DD

## Context
What forces are at play?

## Decision
What we're doing.

## Consequences
What gets easier, what gets harder.
```

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-minimal-dependencies.md) | Zero runtime dependencies | Accepted |
| [0002](0002-deterministic-sim.md) | Deterministic fixed-step sim separated from rendering | Accepted |
| [0003](0003-non-blocking-ui.md) | UI never blocks gameplay during a run | Accepted |
| [0004](0004-float-sim-and-characters.md) | Float (double) sim with discipline; renown per character | Accepted |
| [0005](0005-horde-scale-battlefield.md) | Horde-scale battlefield presentation | Accepted |
