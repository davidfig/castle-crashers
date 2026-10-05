// Turns keyboards and gamepads into per-slot InputFrames. The sim only ever sees InputFrames.
import { Btn, createInputFrame, type InputFrame } from '../../sim/input';
import { MAX_PLAYERS } from '../../sim/constants';
import { EV_STRIDE, Ev, type EventBuf } from '../../sim/events';

interface KeyScheme {
  up: string; down: string; left: string; right: string;
  attack: string; ability1: string; dodge: string;
}

const SCHEMES: KeyScheme[] = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', attack: 'KeyJ', ability1: 'KeyK', dodge: 'KeyL' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', attack: 'Comma', ability1: 'Period', dodge: 'Slash' },
];

const PAD_ATTACK = [7]; // right trigger
const PAD_ABILITY1 = [0]; // A
const PAD_DODGE = [1, 5];

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

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      SCHEMES.forEach((sc, i) => {
        const bit = this.bitFor(sc, e.code);
        if (bit) this.edges.set(`kb${i}`, (this.edges.get(`kb${i}`) ?? 0) | bit);
      });
      if (e.code === 'KeyR') this.restartRequested = true;
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    SCHEMES.forEach((sc, i) => this.sources.push(this.keyboardSource(`kb${i}`, sc)));
  }

  private bitFor(sc: KeyScheme, code: string): number {
    if (code === sc.attack) return Btn.Attack;
    if (code === sc.ability1) return Btn.Ability1;
    if (code === sc.dodge) return Btn.Dodge;
    return 0;
  }

  private keyboardSource(id: string, sc: KeyScheme): Source {
    return {
      id,
      read: (out) => {
        const k = this.keys;
        out.moveX = axis((k.has(sc.right) ? 1 : 0) - (k.has(sc.left) ? 1 : 0));
        out.moveY = axis((k.has(sc.down) ? 1 : 0) - (k.has(sc.up) ? 1 : 0));
        out.aimX = 0;
        out.aimY = 0;
        let b = 0;
        if (k.has(sc.attack)) b |= Btn.Attack;
        if (k.has(sc.ability1)) b |= Btn.Ability1;
        if (k.has(sc.dodge)) b |= Btn.Dodge;
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
        const down = (i: number) => !!p.buttons[i]?.pressed || (p.buttons[i]?.value ?? 0) > 0.3;
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
        if (PAD_DODGE.some(down)) b |= Btn.Dodge;
        const any = p.buttons.some((bt) => bt.pressed);
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

  /** Release all slots (on restart) so devices can re-join. */
  reset(): void {
    this.slots.fill(null);
    this.restartRequested = false;
  }

  get claimedSlots(): number {
    return this.slots.filter((s) => s !== null).length;
  }
}
