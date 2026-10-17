// This game's door to the shared lobby server (../server-geometry): friend-code rooms, matchmaking and the relay, the same server and
// client every *-geometry game uses. The game is `castle-crashers` in the server's `src/games.ts`; the queue modes here must match that entry.
import { Lobby, type Hello, type NewRoom, type QueueHandlers, type RoomClient } from 'server-geometry-client';

export type { Hello, Member, NewRoom, RoomClient } from 'server-geometry-client';
export { CODE_LENGTH, isCode } from 'server-geometry-client';

/** This game's id on the lobby server. */
export const GAME = 'castle-crashers';
/** Matchmaking queues this game offers (a party of two to four strangers). */
export type QueueMode = 'party';
/** Most people on one road: the party's slots. */
export const ROOM_SIZE = 4;

/** Where the lobby server is: `?server=` in the URL, else the address baked into the build (`SERVER=...`), else (in dev) a local `pnpm dev:server`. */
export function serverUrl(): string | null {
  const baked = typeof __SERVER__ === 'string' && __SERVER__ ? __SERVER__ : null;
  return new URLSearchParams(location.search).get('server') ?? baked ?? (__DEV__ ? 'http://localhost:8787' : null);
}

let shared: Lobby | null = null;
let sharedUrl = '';

function lobby(): Lobby {
  const url = serverUrl();
  if (!url) throw new Error('No online server in this build');
  if (!shared || sharedUrl !== url) { shared = new Lobby({ url, game: GAME }); sharedUrl = url; }
  return shared;
}

/** Is the server answering for this game? (A 2 s timeout counts as no.) */
export function serverUp(): Promise<boolean> {
  return serverUrl() ? lobby().up() : Promise.resolve(false);
}

/** A new friend-code room; you hold its host seat. */
export const createRoom = (): Promise<NewRoom> => lobby().createRoom();

/** Takes a seat in a room (the host's own, after `createRoom`, or a guest's with a fresh token). */
export const openRoom = (code: string, token: string, hello: Hello): RoomClient => lobby().room(code, token, hello);

/** Waits in a matchmaking queue. `cancel()` leaves it. */
export function joinQueue(mode: QueueMode, name: string, on: QueueHandlers): { cancel: () => void } {
  return lobby().queue(mode, name, on);
}

/** A seat token for a room joined by code: random, kept by the page for as long as it plays. */
export function newToken(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}
