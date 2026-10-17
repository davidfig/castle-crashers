// The online lobby (docs/08-multiplayer.md): host a room and share its code, join by code, or wait in matchmaking, then the host starts the run.
// It only talks to the shared lobby server (platform/net/lobby.ts) and says what to show as a text Screen; main.ts starts the run when
// `onStart` fires, for the host and the guests alike.
import { CODE_LENGTH, createRoom, joinQueue, newToken, openRoom, serverUp, type RoomClient } from './lobby';
import { readStart, type StartInfo } from './wire';
import { MAX_PLAYERS } from '../../sim/constants';
import type { Line, Screen, Tone } from '../../campaign/view';

type Phase = 'menu' | 'code' | 'opening' | 'room' | 'queue' | 'starting' | 'error';

/** Friend codes leave out 0, O, 1 and I (server-geometry's CODE_ALPHABET); a key outside it is not part of a code. */
const CODE_KEY = /^(?:Key([A-Z])|Digit([2-9]))$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Milliseconds a matchmade room waits for everyone's seat to be up before the host starts it. */
const MATCH_WAIT = 1500;

const line = (text: string, tone: Tone = 'normal'): Line => ({ text, tone });

export class OnlineLobby {
  phase: Phase = 'menu';
  /** The room's friend code (shown to the host to share). */
  code = '';
  private typed = '';
  private message = '';
  private queue: { cancel: () => void } | null = null;
  private queued: { players: number; needed: number } | null = null;
  private up: boolean | null = null;
  private room: RoomClient | null = null;
  private readyAt = 0;

  /**
   * `makeStart` is called on the host's browser when the run starts: the seed and road for the party in these slots.
   * `onStart` fires on every browser once the host has started: `room` is the one to play through.
   */
  constructor(private readonly makeStart: (slots: number[]) => StartInfo, private readonly onStart: (room: RoomClient, info: StartInfo) => void, private readonly onBack: () => void, note = '') {
    if (note) { this.phase = 'error'; this.message = note; }
    serverUp().then((v) => { this.up = v; });
  }

  /** A key pressed while the lobby is up (`KeyboardEvent.code`). */
  key(code: string): void {
    if (this.phase === 'code') return this.codeKey(code);
    if (code === 'Escape') return this.back();
    if (this.phase === 'menu' || this.phase === 'error') {
      if (code === 'KeyH') void this.host();
      else if (code === 'KeyJ') { this.phase = 'code'; this.typed = ''; this.message = ''; }
      else if (code === 'KeyQ') this.search();
    } else if (this.phase === 'room' && code === 'Enter' && this.room?.isHost) this.startRun();
  }

  /** Per frame: a matchmade room starts itself once everyone is in. */
  update(now: number): void {
    const r = this.room;
    if (this.phase !== 'room' || !r?.matchmade || !r.isHost) return;
    const ready = r.members.length >= 2 && r.members.every((m) => m.connected);
    if (!ready) { this.readyAt = 0; return; }
    this.readyAt ||= now;
    if (now - this.readyAt >= MATCH_WAIT) this.startRun();
  }

  /** Leaves whatever the lobby holds (a room, the queue). */
  close(): void {
    this.queue?.cancel();
    this.queue = null;
    if (this.phase !== 'starting') this.room?.leave();
    this.room = null;
  }

  private back(): void {
    const wasMenu = this.phase === 'menu' || this.phase === 'error';
    this.close();
    this.phase = 'menu';
    this.message = '';
    if (wasMenu) this.onBack();
  }

  private fail(message: string): void {
    this.close();
    this.phase = 'error';
    this.message = message;
  }

  private codeKey(code: string): void {
    if (code === 'Escape') { this.phase = 'menu'; return; }
    if (code === 'Backspace') { this.typed = this.typed.slice(0, -1); return; }
    if (code === 'Enter' && this.typed.length === CODE_LENGTH) { this.join(this.typed); return; }
    const m = CODE_KEY.exec(code);
    const ch = m ? m[1] ?? m[2] : '';
    if (ch && CODE_ALPHABET.includes(ch) && this.typed.length < CODE_LENGTH) {
      this.typed += ch;
      if (this.typed.length === CODE_LENGTH) this.join(this.typed);
    }
  }

  private hello = (): { name: string; info: unknown } => ({ name: 'Hero', info: {} });

  private async host(): Promise<void> {
    this.phase = 'opening';
    try {
      const { code, token } = await createRoom();
      this.enter(openRoom(code, token, this.hello), code);
    } catch { this.fail('The online server is not answering.'); }
  }

  private join(code: string): void {
    this.phase = 'opening';
    try { this.enter(openRoom(code, newToken(), this.hello), code); } catch { this.fail('The online server is not answering.'); }
  }

  private search(): void {
    this.phase = 'queue';
    this.queued = null;
    try {
      this.queue = joinQueue('party', 'Hero', {
        waiting: (players, needed) => { this.queued = { players, needed }; },
        matched: (code, token) => { this.queue = null; this.enter(openRoom(code, token, this.hello), code); },
        failed: () => { if (this.phase === 'queue') this.fail('Could not reach matchmaking.'); },
      });
    } catch { this.fail('The online server is not answering.'); }
  }

  private enter(room: RoomClient, code: string): void {
    this.room = room;
    this.code = code;
    this.phase = 'room';
    room.onError = (why) => this.fail(why);
    room.onStart = (game) => {
      const info = readStart(game);
      if (!info) return this.fail('The host started a run this version cannot read.');
      this.phase = 'starting';
      this.onStart(room, info);
    };
  }

  private startRun(): void {
    const r = this.room;
    if (!r || this.phase !== 'room') return;
    const slots = [...r.members].filter((m) => m.connected).map((m) => m.id).slice(0, MAX_PLAYERS);
    if (slots.length < 1) return;
    r.send({ t: 'start', game: this.makeStart(slots) });
  }

  view(): Screen {
    const body: Line[] = [];
    let footer = 'ESC TO GO BACK';
    switch (this.phase) {
      case 'menu':
        body.push(line('Walk the road with friends. One of you hosts the run;'), line('the others follow along from their own screens.'), line(''));
        body.push(line('H    host a room and share its code', 'gold'), line('J    join a friend by their code', 'gold'), line('Q    find a party to walk with', 'gold'));
        if (this.up === false) body.push(line(''), line('The online server is not answering right now.', 'red'));
        break;
      case 'code':
        body.push(line('Type the code your friend gives you.'), line(''), line(`CODE   ${this.typed.padEnd(CODE_LENGTH, '_').split('').join(' ')}`, 'gold'));
        footer = 'ENTER TO JOIN   ESC TO GO BACK';
        break;
      case 'opening': body.push(line('Opening the room...')); break;
      case 'queue': {
        body.push(line('Looking for a party...'));
        if (this.queued) body.push(line(''), line(`${this.queued.players} waiting, a party of ${this.queued.needed} sets out`, 'dim'));
        break;
      }
      case 'room': this.roomLines(body); footer = this.room?.isHost && !this.room.matchmade ? 'ENTER TO START THE RUN   ESC TO LEAVE' : 'ESC TO LEAVE'; break;
      case 'starting': body.push(line('Setting out...')); footer = ''; break;
      case 'error': body.push(line(this.message, 'red')); footer = 'ESC TO GO BACK'; break;
    }
    return { kind: 'text', header: 'Play online', body, footer };
  }

  private roomLines(body: Line[]): void {
    const r = this.room!;
    if (!r.matchmade) body.push(line(`Room code   ${this.code}`, 'gold'), line('Tell your friends to press J on the title and type it.', 'dim'), line(''));
    else body.push(line('A party has formed.', 'gold'), line(''));
    r.members.forEach((m, i) => {
      const who = m.id === r.you ? 'you' : m.connected ? 'here' : 'away';
      body.push(line(`${i + 1}   Hero${m.id === r.host ? '   host' : ''}   ${who}`, m.id === r.you ? 'gold' : m.connected ? 'normal' : 'dim'));
    });
    body.push(line(''));
    if (!r.connected) body.push(line('Reconnecting...', 'red'));
    else if (r.isHost && !r.matchmade) body.push(line('Everyone walks in at the starting town. Start when the party is here.', 'dim'));
    else body.push(line(r.matchmade && r.isHost ? 'Setting out in a moment...' : 'Waiting for the host to set out.', 'dim'));
  }
}
