# 0002 — Deterministic fixed-step sim separated from rendering
Status: Accepted
Date: 2026-10-05

## Context
We want local co-op now and online co-op later, seeded procedural runs, reproducible bugs, and testable game logic.

## Decision
- Simulation runs at a fixed 60 Hz as a function of `(state, inputs)`.
- All randomness uses seeded PRNG streams stored in state; no wall-clock, `Math.random`, or platform APIs in `sim/`.
- Players interact only via `InputFrame`s (including gameplay-affecting UI actions).
- Rendering/audio/UI read state and consume presentation events; they never mutate sim state.
- State is plain serializable data with a hash function.

## Consequences
- Enables replays, golden tests, seed sharing, and multiple netcode strategies (host-auth, lockstep, rollback).
- Requires discipline: custom trig, stable iteration order, no hidden state. Float vs fixed-point remains open (see open-questions).
- Some features (e.g. UI that changes gameplay) must be modeled as inputs, adding design overhead.
