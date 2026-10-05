# 08 — Multiplayer & Netcode

**Now:** 1–4 local players on one screen.
**Later:** online co-op. We build the local game so that going online is an *addition*, not a rewrite.

## The key idea: players are input sources

The sim never knows what a "keyboard" or "gamepad" is. It receives, every tick, an array of **`InputFrame`s — one per player slot**:

```ts
interface InputFrame {
  tick: number;
  player: 0 | 1 | 2 | 3;
  move: { x: -1|0|1 ... };       // quantized axes (e.g. int8 -127..127)
  buttons: number;               // bitmask: attack, jump, ability1, ability2, dodge, interact, swap, ...
  // UI-affecting actions are also inputs, not side channels:
  uiAction?: { kind: 'swapSelect' | 'levelPick' | 'handOver' | ..., arg: number };
}
```

Local players: devices → `InputFrame`s on the local machine.
Remote players (later): `InputFrame`s arrive over the network instead.

If every piece of gameplay-affecting UI is an input action (see [06](06-ui.md#implementation-notes)), the network layer only ever has to move `InputFrame`s (and occasionally snapshots).

## Required properties (do now, even in local-only)

1. **Deterministic sim** with seeded RNG and fixed timestep ([01](01-architecture.md)).
2. **Serializable state:** `GameState` is plain data (no closures, no class instances with hidden state, no DOM refs) → `serialize()/deserialize()` and `hash()`.
3. **Input quantization & compact encoding:** small integers, bitmasks.
4. **Stable IDs:** entity and item IDs are assigned deterministically.
5. **No wall-clock in sim.**
6. **Presentation separated from sim:** a rollback/resim can replay ticks without replaying sound/particles (events are tagged with tick and deduped by the presentation layer).
7. **Transport abstraction:** `platform/net/Transport` interface with a `LocalTransport` no-op implementation used today.

```ts
interface Transport {
  send(peer: PeerId, msg: Uint8Array, reliable: boolean): void;
  onMessage(cb: (peer: PeerId, msg: Uint8Array) => void): void;
  peers(): PeerId[];
}
```

## Candidate online models

| Model | How | Pros | Cons |
|---|---|---|---|
| **Host-authoritative + snapshots** | One player (or a server) runs the sim; clients send inputs, receive state snapshots, predict own movement | Simple mental model; forgiving of non-determinism; cheats limited | Latency on non-host; need interpolation & prediction |
| **Deterministic lockstep** | Everyone runs the sim, exchanging inputs; wait for all inputs each tick | Tiny bandwidth; no snapshots | Input delay; **requires perfect cross-machine determinism** |
| **Rollback (GGPO-style)** | Lockstep with prediction and rewind/resim | Feels great at low-mid latency | Needs fast resim & strict determinism; more complex |

**Proposal (not final):** build local play as the deterministic sim above, then first online implementation = **host-authoritative with client-side prediction of the local player**, using WebRTC data channels (peer-to-peer, the host is a player) to avoid running servers. Rollback remains an option if the sim proves deterministic across browsers. Decision recorded as an ADR when we start net work.

### Why not a library
Per our dependency policy, we'd use the browser's `RTCPeerConnection`/`RTCDataChannel` directly, plus a tiny signaling service (a single serverless function or WebSocket relay) we write ourselves. Signaling is out of scope until the network milestone.

## Local multiplayer specifics

- Join flow: press a button on any unassigned device (keyboard half, gamepad N) to claim the next slot — a "press to join" ring appears near the spawn point/hub.
- Keyboard can serve 1–2 players (split keyboard layouts); gamepads for the rest.
- Player slots are stable for the run; reconnecting a gamepad re-binds the same slot.
- Drop-in/out at rest rooms (see [03](03-gameplay-combat.md)).

## Desync detection (later)

Every N ticks each peer sends `hash(state)`; mismatches trigger a log + (for host-auth) a resync snapshot. We'll have the hash function and golden tests from day one.

## Security/cheating

Co-op PvE between friends: low priority. Host-authoritative limits casual cheating. Profile/renown are local; if shared online, the host trusts clients' *loadouts* but computes *rewards*. Revisit if public matchmaking is ever on the table.
