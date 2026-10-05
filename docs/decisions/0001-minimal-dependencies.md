# 0001 — Zero runtime dependencies
Status: Accepted
Date: 2026-10-05

## Context
We want to learn from and fully control the stack, keep bundle size tiny, and avoid framework churn. The needs (WebGL2 sprite rendering, input, audio, ECS, math) are well scoped for a 2D game.

## Decision
The shipped game has no third-party runtime code. Dev tooling is limited to TypeScript, a bundler (esbuild or vite), and optionally a test runner. Additions require a new ADR.

## Consequences
- We write our own renderer, input, audio, and (later) networking glue. More upfront work, but the surface is small and well understood.
- Asset tooling (atlas packing, validators) is our own scripts.
- Networking will use browser-native WebRTC/WebSocket APIs.
