# 0006 — Online play goes through server-geometry, host-authoritative
Status: Accepted
Date: 2026-10-17

## Context
The sister *-geometry games (sword, space, astronaut) share one lobby server, `../server-geometry`: friend-code rooms, matchmaking queues, seats kept across reloads and a message relay. It never reads game data; a player's browser (the host) runs the match. [08](../08-multiplayer.md) proposed host-authoritative play over WebRTC with a signalling service we would write. We do not need to write it.

## Decision
- This game is `castle-crashers` in the server's `src/games.ts` (4 to a room, one `party` queue). It uses the same client package, `server-geometry-client` (`"link:../server-geometry/client"`), and the same model as the others: the host's browser runs the real run; guests send their inputs and follow.
- Because our sim is deterministic and snapshottable, "following" is exact rather than corrected: a guest restores the host's snapshot, then steps its own copy of the sim with the very frames the host used for each tick (`platform/net/`). The host sends the hash every two seconds; a guest that disagrees (or that missed ticks) asks for the state again. No per-entity snapshots over the wire.
- The relay is JSON strings, 64 KB at most; a snapshot (about 80 KB) travels in 40 KB pieces.

## Consequences
- The first runtime dependency (ADR 0001): first-party, no dependencies of its own, no bundler-specific code. `server-geometry` must sit beside this repo.
- Bandwidth is tiny (about 40 numbers, 30 times a second, each way per guest); a resync costs one snapshot.
- A guest sees its own hero act a round trip plus a tenth of a second after its key (no prediction yet); fine for co-op, the first thing to improve if it is not.
- Anything outside the sim that changes the sim would desync a guest. Online, the tutorial is off and guests never save, spend renown or write the Ledger: the run, its renown and its story belong to the host.
- A reload mid-run is not survived yet: a guest is out of the run, and the host's reload ends it for everyone (the room itself keeps seats for 45 s, which a later change can use).
