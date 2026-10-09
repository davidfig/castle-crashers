// Turns keyboards and gamepads into per-slot InputFrames. The sim only ever sees InputFrames.
import { Btn, createInputFrame, type InputFrame } from '../../sim/input';
import { MAX_PLAYERS } from '../../sim/constants';
import { EV_STRIDE, Ev, type EventBuf } from '../../sim/events';

interface KeyScheme {
  up: string; down: string; left: string; right: string;
  attack: string; ability1: string; ability2: string; dodge: string; standDown: string; level: string;
}

const SCHEMES: KeyScheme[] = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', attack: 'KeyJ', ability1: 'KeyK', ability2: 'KeyI', dodge: 'KeyL', standDown: 'KeyU', level: 'KeyO' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', attack: 'Comma', ability1: 'Period', ability2: 'Semicolon', dodge: 'Slash', standDown: 'Quote', level: 'BracketLeft' },
];

const RUMBLE_KEY = 'cc.rumble';

const PAD_ATTACK = [7]; // right trigger
const PAD_ABILITY1 = [2]; // X
const PAD_ABILITY2 = [5]; // right bumper
const PAD_DODGE = [6]; // left trigger
const PAD_STAND_DOWN = [1, 3]; // B, Y
const PAD_LEVEL = [4]; // left bumper
const PAD_CONFIRM = [0]; // A: menus only

interface Source {
  id: string;
  /** Fills moveX/moveY/buttons (held) for this source. Returns true if any button is down. */
  read(out: InputFrame): boolean;
}

function axis(v: number): number {
  return Math.max(-127, Math.min(127, Math.round(v * 127)));
}

export class InputManager {
  /** slot -> source id (null = unclaimed) */
  private slots: (string | null)[] = new Array(MAX_PLAYERS).fill(null);
  private keys = new Set<string>();
  /** Presses since the last sample, so a tap shorter than a tick is not lost. */
  private edges = new Map<string, number>();
  private frames: InputFrame[] = Array.from({ length: MAX_PLAYERS }, createInputFrame);
  private tmp = createInputFrame();
  private sources: Source[] = [];
  private gamepadIds = new Set<number>();
  /** Set when "restart" is requested (R key or Start on a pad). */
  restartRequested = false;
  /** Controller rumble setting (V toggles). Off by default; persisted so it survives reloads. */
  rumbleEnabled = false;
  /** Menu presses since the last consumeMenu(): the menus read devices directly, so nobody has to claim a player slot to navigate. */
  private menuLeft = false;
  private menuRight = false;
  private menuOk = false;
  private menuAny = false;
  private menuBack = false;
  private padMenuPrev = new Map<number, number>();
  /** Keys / pad buttons held when the slots were reset (the press that confirmed a menu): they do nothing until released, so they are not the player's first action. */
  private heldKeys = new Set<string>();
  private heldPad = new Map<number, Set<number>>();

  constructor() {
    try { this.rumbleEnabled = localStorage.getItem(RUMBLE_KEY) === '1'; } catch { /* blocked site data: stay off */ }
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'KeyV') { this.setRumble(!this.rumbleEnabled); return; }
      this.keys.add(e.code);
      this.noteMenuKey(e.code);
      SCHEMES.forEach((sc, i) => {
        const bit = this.bitFor(sc, e.code);
        if (bit) this.edges.set(`kb${i}`, (this.edges.get(`kb${i}`) ?? 0) | bit);
      });
      if (e.code === 'KeyR') this.restartRequested = true;
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); this.heldKeys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.heldKeys.clear(); });
    SCHEMES.forEach((sc, i) => this.sources.push(this.keyboardSource(`kb${i}`, sc)));
  }

  setRumble(on: boolean): void {
    this.rumbleEnabled = on;
    try { localStorage.setItem(RUMBLE_KEY, on ? '1' : '0'); } catch { /* unsaved */ }
  }

  private noteMenuKey(code: string): void {
    if (code === 'Escape') { this.menuBack = true; return; }
    if (!/^(Shift|Control|Alt|Meta|Caps)/.test(code)) this.menuAny = true;
    if (code === 'KeyA' || code === 'ArrowLeft') this.menuLeft = true;
    else if (code === 'KeyD' || code === 'ArrowRight') this.menuRight = true;
    else if (code !== 'KeyR' && !/^(Shift|Control|Alt|Meta|Caps|Escape|F\d|Tab|Arrow(Up|Down))/.test(code) && code !== 'KeyW' && code !== 'KeyS') this.menuOk = true; // any other key confirms
  }

  /** Left/right (-1, 0, 1) and confirm pressed since the last call, from any keyboard or pad. Clears them. */
  consumeMenu(): { dx: number; ok: boolean; any: boolean; back: boolean } {
    for (const p of navigator.getGamepads()) {
      if (!p) continue;
      const down = (i: number) => !!p.buttons[i]?.pressed;
      const x = p.axes[0] ?? 0;
      const mask = (down(14) || x < -0.6 ? 1 : 0) | (down(15) || x > 0.6 ? 2 : 0) | (p.buttons.some((bt, i) => i < 12 && i !== 9 && bt.pressed) ? 4 : 0) | (p.buttons.some((bt) => bt.pressed) ? 8 : 0) | (down(1) ? 16 : 0);
      const fresh = mask & ~(this.padMenuPrev.get(p.index) ?? 0);
      this.padMenuPrev.set(p.index, mask);
      if (fresh & 1) this.menuLeft = true;
      if (fresh & 2) this.menuRight = true;
      if (fresh & 4) this.menuOk = true;
      if (fresh & 8) this.menuAny = true;
      if (fresh & 16) this.menuBack = true;
    }
    const out = { dx: (this.menuRight ? 1 : 0) - (this.menuLeft ? 1 : 0), ok: this.menuOk, any: this.menuAny, back: this.menuBack };
    this.menuLeft = this.menuRight = this.menuOk = this.menuAny = this.menuBack = false;
    return out;
  }

  private bitFor(sc: KeyScheme, code: string): number {
    if (code === sc.attack) return Btn.Attack;
    if (code === sc.ability1) return Btn.Ability1;
    if (code === sc.ability2) return Btn.Ability2;
    if (code === sc.dodge) return Btn.Dodge;
    if (code === sc.standDown) return Btn.Interact;
    if (code === sc.level) return Btn.Level;
    return 0;
  }

  private keyboardSource(id: string, sc: KeyScheme): Source {
    return {
      id,
      read: (out) => {
        const k = this.keys;
        const on = (c: string) => k.has(c) && !this.heldKeys.has(c);
        out.moveX = axis((k.has(sc.right) ? 1 : 0) - (k.has(sc.left) ? 1 : 0));
        out.moveY = axis((k.has(sc.down) ? 1 : 0) - (k.has(sc.up) ? 1 : 0));
        out.aimX = 0;
        out.aimY = 0;
        let b = 0;
        if (on(sc.attack)) b |= Btn.Attack;
        if (on(sc.ability1)) b |= Btn.Ability1;
        if (on(sc.ability2)) b |= Btn.Ability2;
        if (on(sc.dodge)) b |= Btn.Dodge;
        if (on(sc.standDown)) b |= Btn.Interact;
        if (on(sc.level)) b |= Btn.Level;
        b |= this.edges.get(id) ?? 0;
        this.edges.set(id, 0);
        out.buttons = b;
        return b !== 0;
      },
    };
  }

  private padSource(pad: Gamepad): Source {
    const id = `pad${pad.index}`;
    let prev = 0;
    return {
      id,
      read: (out) => {
        const p = navigator.getGamepads()[pad.index];
        if (!p) { out.moveX = out.moveY = out.aimX = out.aimY = out.buttons = 0; return false; }
        const stick = (ix: number, iy: number): [number, number] => {
          let x = p.axes[ix] ?? 0, y = p.axes[iy] ?? 0;
          const m = Math.hypot(x, y);
          if (m < 0.2) return [0, 0];
          const s = (Math.min(m, 1) - 0.2) / 0.8 / m;
          return [x * s, y * s];
        };
        let [x, y] = stick(0, 1);
        const [rx, ry] = stick(2, 3);
        const held = this.heldPad.get(pad.index);
        if (held) {
          for (const i of held) if (!p.buttons[i]?.pressed && (p.buttons[i]?.value ?? 0) <= 0.3) held.delete(i);
        }
        const down = (i: number) => !held?.has(i) && (!!p.buttons[i]?.pressed || (p.buttons[i]?.value ?? 0) > 0.3);
        if (down(14)) x = -1;
        if (down(15)) x = 1;
        if (down(12)) y = -1;
        if (down(13)) y = 1;
        out.moveX = axis(x);
        out.moveY = axis(y);
        out.aimX = axis(rx);
        out.aimY = axis(ry);
        let b = 0;
        if (PAD_ATTACK.some(down)) b |= Btn.Attack;
        if (PAD_ABILITY1.some(down)) b |= Btn.Ability1;
        if (PAD_ABILITY2.some(down)) b |= Btn.Ability2;
        if (PAD_DODGE.some(down)) b |= Btn.Dodge;
        if (PAD_STAND_DOWN.some(down)) b |= Btn.Interact;
        if (PAD_LEVEL.some(down)) b |= Btn.Level;
        if (PAD_CONFIRM.some(down)) b |= Btn.Confirm;
        const any = p.buttons.some((bt, i) => bt.pressed && !held?.has(i));
        if (down(9) && !(prev & 0x100)) this.restartRequested = true;
        prev = down(9) ? 0x100 : 0;
        out.buttons = b;
        return any;
      },
    };
  }

  private syncGamepads(): void {
    for (const p of navigator.getGamepads()) {
      if (p && !this.gamepadIds.has(p.index)) {
        this.gamepadIds.add(p.index);
        this.sources.push(this.padSource(p));
      }
    }
  }

  /** Sample all devices into one InputFrame per player slot. */
  sample(): InputFrame[] {
    this.syncGamepads();
    for (const f of this.frames) { f.moveX = 0; f.moveY = 0; f.aimX = 0; f.aimY = 0; f.buttons = 0; }
    for (const src of this.sources) {
      const active = src.read(this.tmp);
      let slot = this.slots.indexOf(src.id);
      if (slot < 0) {
        if (!active) continue;
        slot = this.slots.indexOf(null);
        if (slot < 0) continue;
        this.slots[slot] = src.id;
        this.tmp.buttons |= Btn.Join;
      }
      const f = this.frames[slot];
      f.moveX = this.tmp.moveX;
      f.moveY = this.tmp.moveY;
      f.aimX = this.tmp.aimX;
      f.aimY = this.tmp.aimY;
      f.buttons = this.tmp.buttons;
    }
    return this.frames;
  }

  /** Rumble the pad claimed by `slot`, if any. No-op for keyboards or browsers without haptics. */
  rumble(slot: number, strong: number, weak: number, ms: number): void {
    if (!this.rumbleEnabled) return;
    const id = this.slots[slot];
    if (!id?.startsWith('pad')) return;
    const pad = navigator.getGamepads()[Number(id.slice(3))] as (Gamepad & { vibrationActuator?: GamepadHapticActuator }) | null;
    pad?.vibrationActuator?.playEffect?.('dual-rumble', {
      startDelay: 0, duration: ms, strongMagnitude: strong, weakMagnitude: weak,
    })?.catch(() => {});
  }

  /** Turn sim events into controller rumble: a pulse on heavy hits, a long low rumble when hurt. */
  consumeHaptics(ev: EventBuf): void {
    const d = ev.data;
    for (let k = 0; k < ev.n; k++) {
      const o = k * EV_STRIDE;
      const t = d[o];
      if (t === Ev.Swing) this.rumble(d[o + 6], 0.3, 0.1, 60);
      else if (t === Ev.Finisher) this.rumble(d[o + 6], 1, 0.25, 110);
      else if (t === Ev.PlayerHurt) this.rumble(d[o + 3], 0.15, 1, 380);
      else if (t === Ev.PlayerDown) this.rumble(d[o + 3], 1, 1, 500);
    }
  }

  /** What to press to open the level-up panel for the device that holds `slot` ("O", "[", "LB"), or '' while the slot is unclaimed. */
  levelHint(slot: number): string {
    const id = this.slots[slot];
    if (!id) return '';
    if (id.startsWith('pad')) return 'LB';
    const code = SCHEMES[Number(id.slice(2))]?.level ?? '';
    return code.replace(/^Key/, '').replace('BracketLeft', '[');
  }

  /** Release all slots (on restart) so devices can re-join. `keep[k]` keeps slot k's device bound to it (the lobby's party carrying into the run). */
  reset(keep?: boolean[]): void {
    this.slots = this.slots.map((id, k) => (keep?.[k] ? id : null));
    this.restartRequested = false;
    this.edges.clear();
    this.heldKeys = new Set(this.keys);
    this.heldPad.clear();
    for (const p of navigator.getGamepads()) {
      if (!p) continue;
      const s = new Set<number>();
      p.buttons.forEach((bt, i) => { if (bt.pressed || bt.value > 0.3) s.add(i); });
      this.heldPad.set(p.index, s);
    }
  }

  get claimedSlots(): number {
    return this.slots.filter((s) => s !== null).length;
  }
}
