// Synthesized sound effects (Web Audio, no asset files). The sim never touches this: sounds are played from the
// presentation event queue, like fx and haptics. Call consume() BEFORE fx.consume(), which empties the queue.
import { EV_STRIDE, Ev, type EventBuf } from '../../sim/events';
import { VIEW_W } from '../../sim/constants';
import { Music, type Scene, type Stinger } from './music';

const MUSIC_VOLUME = 0.55;

/** One voice being built: helpers that schedule oscillators and noise bursts into the voice's output. */
interface Kit {
  tone(wave: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay?: number): void;
  hiss(filter: BiquadFilterType, f0: number, f1: number, dur: number, vol: number, delay?: number, q?: number): void;
}

interface Sound {
  /** Most voices of this sound that may overlap. */
  poly: number;
  /** Most voices of this sound started in a single frame (30 kills at once should not be 30 voices). */
  perFrame: number;
  gain: number;
  make(k: Kit, mag: number): void;
}

const SOUNDS = {
  swing:   { poly: 6, perFrame: 2, gain: 0.35, make: (k) => { k.hiss('bandpass', 500, 1400, 0.12, 0.5, 0, 0.7); } },
  hit:     { poly: 8, perFrame: 3, gain: 0.5, make: (k, m) => { k.tone('triangle', 130, 55, 0.09, 0.4 + m * 0.01); k.hiss('lowpass', 1400, 300, 0.07, 0.5); } },
  kill:    { poly: 6, perFrame: 2, gain: 0.5, make: (k) => { k.tone('sine', 150, 45, 0.22, 0.6); k.hiss('lowpass', 900, 200, 0.16, 0.4); } },
  bigKill: { poly: 2, perFrame: 1, gain: 0.8, make: (k) => { k.tone('sine', 80, 25, 1.0, 0.8); k.hiss('lowpass', 700, 80, 0.9, 0.7); } },
  hurt:    { poly: 3, perFrame: 1, gain: 0.55, make: (k) => { k.tone('triangle', 200, 90, 0.2, 0.5); k.hiss('lowpass', 800, 250, 0.12, 0.3); } },
  down:    { poly: 2, perFrame: 1, gain: 0.7, make: (k) => { k.tone('sine', 180, 50, 0.7, 0.7); k.hiss('lowpass', 500, 120, 0.5, 0.3); } },
  revive:  { poly: 2, perFrame: 1, gain: 0.5, make: (k) => { k.tone('sine', 200, 300, 0.5, 0.5); k.tone('sine', 300, 450, 0.5, 0.25); } },
  dash:    { poly: 4, perFrame: 2, gain: 0.3, make: (k) => { k.hiss('bandpass', 350, 900, 0.2, 0.6, 0, 0.6); } },
  finisher:{ poly: 3, perFrame: 1, gain: 0.55, make: (k) => { k.hiss('bandpass', 400, 1200, 0.22, 0.6, 0, 0.7); k.tone('triangle', 110, 45, 0.25, 0.5); } },
  blast:   { poly: 3, perFrame: 1, gain: 0.7, make: (k) => { k.hiss('lowpass', 1500, 80, 0.55, 1); k.tone('sine', 90, 28, 0.55, 0.8); } },
  block:   { poly: 4, perFrame: 2, gain: 0.4, make: (k) => { k.tone('triangle', 380, 260, 0.09, 0.4); k.hiss('bandpass', 1500, 900, 0.07, 0.4, 0, 1.5); } },
  bow:     { poly: 4, perFrame: 2, gain: 0.3, make: (k) => { k.tone('triangle', 320, 110, 0.1, 0.4); k.hiss('bandpass', 1200, 700, 0.06, 0.3); } },
  tick:    { poly: 4, perFrame: 2, gain: 0.25, make: (k) => { k.tone('triangle', 260, 160, 0.05, 0.4); } },
  quake:   { poly: 2, perFrame: 1, gain: 0.75, make: (k) => { k.tone('sine', 70, 25, 0.6, 0.9); k.hiss('lowpass', 500, 80, 0.55, 0.7); } },
  pulse:   { poly: 3, perFrame: 1, gain: 0.4, make: (k) => { k.tone('sine', 150, 260, 0.35, 0.5); } },
  heal:    { poly: 3, perFrame: 1, gain: 0.35, make: (k) => { k.tone('sine', 260, 330, 0.5, 0.4); k.tone('sine', 330, 400, 0.5, 0.3, 0.05); } },
  blink:   { poly: 3, perFrame: 2, gain: 0.35, make: (k) => { k.tone('sine', 500, 180, 0.15, 0.4); k.hiss('bandpass', 700, 300, 0.12, 0.3); } },
  winded:  { poly: 2, perFrame: 1, gain: 0.3, make: (k) => { k.hiss('bandpass', 450, 280, 0.3, 0.5, 0, 1.5); } },
  slam:    { poly: 2, perFrame: 1, gain: 0.85, make: (k) => { k.tone('sine', 75, 24, 0.65, 1); k.hiss('lowpass', 900, 70, 0.5, 0.8); } },
  roar:    { poly: 2, perFrame: 1, gain: 0.7, make: (k) => { k.tone('sawtooth', 70, 50, 1.0, 0.5); k.hiss('bandpass', 320, 200, 1.0, 0.5, 0, 1.2); } },
  charge:  { poly: 2, perFrame: 1, gain: 0.5, make: (k) => { k.tone('triangle', 60, 110, 0.45, 0.6); k.hiss('lowpass', 300, 700, 0.4, 0.4); } },
  coin:    { poly: 4, perFrame: 2, gain: 0.3, make: (k) => { k.tone('sine', 420, 380, 0.14, 0.5); k.hiss('bandpass', 1200, 900, 0.04, 0.25, 0, 2); } },
  thud:    { poly: 3, perFrame: 1, gain: 0.5, make: (k) => { k.tone('sine', 100, 38, 0.22, 0.8); k.hiss('lowpass', 700, 150, 0.15, 0.5); } },
  scream:  { poly: 2, perFrame: 1, gain: 0.4, make: (k) => { k.tone('sawtooth', 280, 480, 0.4, 0.3); k.hiss('bandpass', 700, 900, 0.4, 0.3, 0, 2); } },
  summon:  { poly: 2, perFrame: 1, gain: 0.5, make: (k) => { k.tone('triangle', 70, 160, 0.55, 0.5); k.hiss('bandpass', 250, 800, 0.5, 0.3, 0, 1.5); } },
  rally:   { poly: 2, perFrame: 1, gain: 0.65, make: (k) => { k.tone('sine', 70, 45, 0.28, 0.9); k.tone('sine', 70, 45, 0.28, 0.9, 0.22); } },
  beam:    { poly: 2, perFrame: 1, gain: 0.4, make: (k) => { k.tone('triangle', 300, 160, 0.45, 0.4); k.hiss('bandpass', 900, 500, 0.4, 0.3, 0, 2); } },
  white:   { poly: 2, perFrame: 1, gain: 0.35, make: (k) => { k.tone('sine', 280, 160, 0.3, 0.4); k.hiss('bandpass', 800, 400, 0.25, 0.3); } },
  potion:  { poly: 2, perFrame: 1, gain: 0.4, make: (k) => { k.tone('sine', 180, 280, 0.12, 0.5); k.tone('sine', 190, 300, 0.12, 0.5, 0.14); k.hiss('bandpass', 600, 600, 0.3, 0.15); } },
  proc:    { poly: 4, perFrame: 2, gain: 0.25, make: (k) => { k.tone('sine', 330, 400, 0.15, 0.5); } },
  pick:    { poly: 2, perFrame: 1, gain: 0.35, make: (k) => { k.tone('triangle', 240, 200, 0.12, 0.5); } },
  // The mage's blink: a rising shimmer as she vanishes, and a falling one with a soft landing where she arrives.
  warpOut: { poly: 3, perFrame: 2, gain: 0.45, make: (k) => { k.tone('sine', 280, 1100, 0.4, 0.35); k.tone('sine', 420, 1650, 0.4, 0.18); [880, 1175, 1568].forEach((f, i) => k.tone('sine', f, f, 0.4, 0.13, 0.06 + i * 0.06)); k.hiss('bandpass', 1200, 3000, 0.35, 0.14, 0, 4); } },
  warpIn:  { poly: 3, perFrame: 2, gain: 0.45, make: (k) => { k.tone('sine', 1100, 280, 0.4, 0.3, 0.08); k.tone('sine', 1650, 420, 0.4, 0.15, 0.08); [1568, 1175, 880].forEach((f, i) => k.tone('sine', f, f, 0.45, 0.12, 0.1 + i * 0.06)); k.tone('sine', 140, 60, 0.25, 0.4, 0.12); k.hiss('bandpass', 3000, 1200, 0.35, 0.14, 0.08, 4); } },
  // The cleric's light: bell-like partials with a slow shimmer instead of a thud, so her aura reads as holy, not as another weapon.
  smite:   { poly: 4, perFrame: 1, gain: 0.3, make: (k) => { k.tone('sine', 523, 523, 0.5, 0.45); k.tone('sine', 785, 785, 0.4, 0.25, 0.02); k.tone('sine', 1450, 1450, 0.25, 0.1, 0.02); } },
  holyKill:{ poly: 3, perFrame: 1, gain: 0.45, make: (k) => { k.tone('sine', 392, 392, 1.1, 0.4); k.tone('sine', 588, 588, 1.0, 0.3, 0.03); k.tone('sine', 784, 784, 0.9, 0.2, 0.06); k.hiss('bandpass', 1800, 1800, 0.5, 0.06, 0, 4); } },
  holyBurst:{ poly: 2, perFrame: 1, gain: 0.6, make: (k) => { k.tone('sine', 262, 262, 1.2, 0.5); k.tone('sine', 392, 392, 1.2, 0.4, 0.04); k.tone('sine', 523, 523, 1.1, 0.35, 0.08); k.tone('sine', 1046, 1046, 0.7, 0.12, 0.1); k.hiss('bandpass', 1500, 2500, 0.6, 0.1, 0, 3); } },
  surrender: { poly: 3, perFrame: 1, gain: 0.3, make: (k) => { k.tone('sine', 300, 180, 0.35, 0.4); } },
} satisfies Record<string, Sound>;

type SoundId = keyof typeof SOUNDS;

/** Burst styles (BurstStyle in sim/abilities) that make a noise other than the generic thud. */
const BURST_SCREAM = 2;
const BURST_WISP = 8;
const BURST_HEX = 9;
const BURST_FLASH = 10;

const MASTER_VOLUME = 0.45;
/** Everything passes a lowpass here, so nothing is ever shrill. */
const CEILING_HZ = 3500;
/** Pitch wobble per voice (+/-), so repeats don't sound machine-gunned. Cosmetic: Math.random, never the sim's stream. */
const PITCH_JITTER = 0.1;

const SOUND_KEY = 'cc.sound';
const MUSIC_KEY = 'cc.music';
/** On unless the player switched it off ('0'); blocked site data just means on. */
function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) !== '0'; } catch { return true; }
}
function writeFlag(key: string, on: boolean): void {
  try { localStorage.setItem(key, on ? '1' : '0'); } catch { /* blocked site data: not remembered */ }
}

export class Audio {
  private ac: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private master = MASTER_VOLUME;
  private ends: Record<string, number[]> = {};
  private frameCount: Record<string, number> = {};
  /** Sound effects and music switch separately; both are remembered between visits. */
  soundOn = readFlag(SOUND_KEY);
  musicOn = readFlag(MUSIC_KEY);
  private mbus: GainNode | null = null;
  music: Music | null = null;
  private holyKill = false;
  /** Set by ?mute: no audio context is ever created, so nothing plays, and the remembered N / M choices are left alone. */
  muted = false;

  /** Create or resume the context. Browsers only allow this from a user gesture; safe to call repeatedly. */
  unlock(): void {
    if (this.muted) return;
    try {
      if (!this.ac) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const ac = new AC();
        const comp = ac.createDynamicsCompressor(); // many voices at once get tamed rather than clipped
        const bus = ac.createGain();
        bus.gain.value = this.master;
        const soft = ac.createBiquadFilter();
        soft.type = 'lowpass'; soft.frequency.value = CEILING_HZ; soft.Q.value = 0.5;
        bus.connect(soft).connect(comp).connect(ac.destination);
        const len = ac.sampleRate;
        const noise = ac.createBuffer(1, len, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const mbus = ac.createGain();
        mbus.gain.value = this.musicOn ? MUSIC_VOLUME : 0;
        mbus.connect(bus);
        this.music = new Music(ac, mbus);
        this.mbus = mbus; this.ac = ac; this.bus = bus; this.noise = noise;
      }
      if (this.ac.state === 'suspended') void this.ac.resume();
    } catch { /* no audio available: the game stays silent */ }
  }

  setSound(on: boolean): void {
    this.soundOn = on;
    writeFlag(SOUND_KEY, on);
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    writeFlag(MUSIC_KEY, on);
    if (this.mbus && this.ac) this.mbus.gain.setTargetAtTime(on ? MUSIC_VOLUME : 0, this.ac.currentTime, 0.05);
  }

  /** A musical phrase for a moment worth marking (the run is won or lost). */
  stinger(kind: Stinger): void {
    if (this.ac?.state === 'running' && this.musicOn) this.music?.stinger(kind);
  }

  /** Keep the music going; call once per render frame with what is happening. */
  updateMusic(dt: number, scene: Scene): void {
    if (this.ac?.state === 'running') this.music?.update(dt, scene);
  }

  /** Play the sounds for this frame's events. Does not clear the queue. */
  consume(ev: EventBuf, camX: number): void {
    if (!this.ac || this.ac.state !== 'running' || !this.soundOn) return;
    this.frameCount = {};
    const d = ev.data;
    for (let k = 0; k < ev.n; k++) {
      const o = k * EV_STRIDE;
      const x = d[o + 1], a = d[o + 3], c = d[o + 4];
      const pan = Math.max(-1, Math.min(1, ((x - camX) / VIEW_W) * 2 - 1));
      switch (d[o]) {
        case Ev.Swing: this.play('swing', pan); break;
        case Ev.Hit: this.play(d[o + 6] === 1 ? 'smite' : 'hit', pan, a); break;
        case Ev.Holy: this.holyKill = true; break;
        case Ev.Kill: this.play(this.holyKill ? 'holyKill' : 'kill', pan); this.holyKill = false; break;
        case Ev.BossDown: this.play('bigKill', 0); this.music?.stinger('boss'); break;
        case Ev.Nova: this.play('pulse', pan); break;
        case Ev.PlayerHurt: this.play('hurt', pan); break;
        case Ev.PlayerDown: this.play('down', pan); break;
        case Ev.Dash: this.play(c === 4 ? 'heal' : c === 3 ? 'warpOut' : c === 2 ? 'blink' : 'dash', pan); break;
        case Ev.Revive: this.play('revive', pan); break;
        case Ev.Finisher: this.play('finisher', pan); break;
        case Ev.Blast: this.play('blast', pan); break;
        case Ev.Block: this.play('block', pan); break;
        case Ev.Fire: this.play('bow', pan); break;
        case Ev.Arrow: this.play('tick', pan); break;
        case Ev.Quake: this.play('quake', pan); break;
        case Ev.Pulse: this.play('holyBurst', pan); break;
        case Ev.Teleport:
        case Ev.Blink: { // x,y = where she was, a,c = where she lands
          this.play('warpOut', pan);
          this.play('warpIn', Math.max(-1, Math.min(1, ((a - camX) / VIEW_W) * 2 - 1)));
          break;
        }
        case Ev.Heal:
        case Ev.HealMob: this.play('heal', pan); break;
        case Ev.Winded: this.play('winded', pan); break;
        case Ev.Slam: this.play('slam', pan); break;
        case Ev.Roar: this.play('roar', 0); break;
        case Ev.Charge: this.play('charge', pan); break;
        case Ev.Coin: this.play('coin', pan); break;
        case Ev.Burst: this.play(c === BURST_SCREAM ? 'scream' : c === BURST_WISP || c === BURST_HEX || c === BURST_FLASH ? 'white' : 'thud', pan); break;
        case Ev.Summon: this.play('summon', pan); break;
        case Ev.Rally: this.play('rally', pan); break;
        case Ev.Beam: this.play('beam', pan); break;
        case Ev.Surrender: this.play('surrender', pan); break;
        case Ev.LevelUp: this.music?.stinger('level'); break;
        case Ev.Potion: this.play('potion', pan); break;
        case Ev.Proc: this.play('proc', pan); break;
        case Ev.Pick: this.play('pick', 0); break;
        case Ev.Quest: if (a === 1) this.music?.stinger('level'); else if (a === 2) this.play('down', pan); else if (a === 5) this.play('potion', pan); break;
      }
    }
  }

  private play(id: SoundId, pan: number, mag = 0): void {
    const ac = this.ac, bus = this.bus, noise = this.noise;
    if (!ac || !bus || !noise) return;
    const s: Sound = SOUNDS[id];
    const n = (this.frameCount[id] ?? 0) + 1;
    if (n > s.perFrame) return;
    this.frameCount[id] = n;
    const t = ac.currentTime;
    const ends = (this.ends[id] ??= []).filter((e) => e > t);
    if (ends.length >= s.poly) { this.ends[id] = ends; return; }

    const out = ac.createGain();
    out.gain.value = s.gain;
    connectPan(ac, out, bus, pan);
    const pitch = 1 + (Math.random() * 2 - 1) * PITCH_JITTER;
    let longest = 0;
    const kit: Kit = {
      tone(wave, f0, f1, dur, vol, delay = 0) {
        const o = ac.createOscillator(), g = ac.createGain(), t0 = t + delay;
        o.type = wave;
        o.frequency.setValueAtTime(f0 * pitch, t0);
        if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * pitch), t0 + dur);
        envelope(g, t0, dur, vol);
        o.connect(g).connect(out);
        o.start(t0); o.stop(t0 + dur + 0.02);
        longest = Math.max(longest, delay + dur);
      },
      hiss(filter, f0, f1, dur, vol, delay = 0, q = 1) {
        const src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(), t0 = t + delay;
        src.buffer = noise; src.loop = true;
        fl.type = filter; fl.Q.value = q;
        fl.frequency.setValueAtTime(f0 * pitch, t0);
        if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * pitch), t0 + dur);
        envelope(g, t0, dur, vol);
        src.connect(fl).connect(g).connect(out);
        src.start(t0, Math.random() * 0.9); src.stop(t0 + dur + 0.02);
        longest = Math.max(longest, delay + dur);
      },
    };
    s.make(kit, mag);
    ends.push(t + longest);
    this.ends[id] = ends;
  }
}

function envelope(g: GainNode, t0: number, dur: number, vol: number): void {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

function connectPan(ac: AudioContext, from: AudioNode, to: AudioNode, pan: number): void {
  if (typeof ac.createStereoPanner === 'function') {
    const p = ac.createStereoPanner();
    p.pan.value = pan * 0.7;
    from.connect(p).connect(to);
  } else {
    from.connect(to);
  }
}
