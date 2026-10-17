# 08 — Multiplayer & Netcode

**Now:** 1–4 local players on one screen, and online co-op for up to four through the shared lobby server (below).
**Later:** prediction for a guest's own hero, rejoining after a reload, a server-run host.

## The key idea: players are input sources

The sim never knows what a "keyboard" or "gamepad" is. It receives, every tick, an array of **`InputFrame`s — one per player slot**. The real type is in `src/sim/input.ts` (`moveX`, `moveY`, `aimX`, `aimY` as -127..127 and a `buttons` bitmask `Btn`; UI actions such as the level-up panel are buttons, there is no `uiAction` field). The sketch below is the original design:

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
2. **Serializable state:** `GameState` is plain data (no closures, no class instances with hidden state, no DOM refs) → `serialize()/deserialize()` and `hash()` (`hashState` in `src/sim/hash.ts`). Implemented as `snapshot` / `restore` in `src/sim/snapshot.ts` (see [21](21-the-road.md)); its tests fail if the state stops being plain data or a restored sim plays on differently.
3. **Input quantization & compact encoding:** small integers, bitmasks.
4. **Stable IDs:** entity and item IDs are assigned deterministically.
5. **No wall-clock in sim.**
6. **Presentation separated from sim:** a rollback/resim can replay ticks without replaying sound/particles (events are tagged with tick and deduped by the presentation layer).
7. **Transport:** the shared lobby server's relay, through `platform/net/lobby.ts` (see "Online play" below). *(The `Transport` interface sketched here was not needed: the lobby client is the seam.)*

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

**Proposal (superseded by the lobby server, see "Online play" below):** build local play as the deterministic sim above, then first online implementation = **host-authoritative with client-side prediction of the local player**, using WebRTC data channels (peer-to-peer, the host is a player) to avoid running servers. Rollback remains an option if the sim proves deterministic across browsers. Decision recorded as an ADR when we start net work.

## Online play (built)

Decided in [ADR-0006](decisions/0006-online-through-server-geometry.md). The same server and the same model as every *-geometry game: `../server-geometry` keeps the rooms (friend codes, matchmaking), the seats and the relay; the host's browser runs the run. Code in `src/platform/net/`.

- **Lobby.** `O` on the title (when a server is configured) opens the lobby: `H` host a room and share its code, `J` join by code, `Q` matchmaking. The host presses Enter to set out (a matchmade room sets out by itself once everyone is in). `onlineLobby.ts` is the screen, `lobby.ts` the door to the server (`castle-crashers` in the server's `src/games.ts`).
- **The server's address:** `?server=` in the URL, else `SERVER=https://... pnpm build`, else (dev) `http://localhost:8787`, which is `pnpm dev:server`.
- **Host** (`hostLink.ts`, `hostFeed.ts`): each tick, its own player's input plus one queued frame per guest (the last again when none came) steps the one sim; the frames used go to the guests every two ticks. Every seated slot presses Join, so everyone walks into the starting town.
- **Guest** (`guestLink.ts`, `guestFeed.ts`): asks the host for the state, restores the snapshot (`sim/snapshot.ts`, in 40 KB pieces, `chunks.ts`), then steps its own copy of the sim with the host's frames, kept about 6 ticks behind so a late message does not stall it. Its own input goes to the host, two ticks to a message, every tick kept so a tap is never lost.
- **Staying exact.** The host sends `hashState` every 120 ticks; a guest that disagrees, or that finds a stretch of ticks missing, asks for the state again and carries on from it. The test (`net.test.ts`) drives a host and a guest through an in-memory room, including a lost stretch and a corrupted copy.
- **Seats.** The start names who plays which slot, but someone in the room the start missed (they arrived as the host set out) is seated when they ask for the run: the host gives them the next free slot and tells everyone (`Wire` 'seats'), and their hero walks in.
- **Hidden tabs.** Browsers stop animation frames in a hidden tab, which would freeze the run for everyone when it is the host's (two tabs in one window: one is always hidden). While an online run is on, a worker's timer steps the sim when frames stop (`stepHidden` in `platform/loop.ts`), as sword-geometry does.
- **What is not shared:** the host's profile, Ledger and run save. A guest never saves, spends its own renown or writes its Ledger from a run it joined; the tutorial is off online. A guest leaving frees nothing (its hero stands idle); the host leaving ends the run (the host's Escape saves it, to continue alone).
- **Not yet:** prediction of a guest's own hero (it feels a round trip plus a tenth of a second late), rejoining after a reload, joining a run under way, a server-run host, and choosing the class anywhere but in the town.

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
