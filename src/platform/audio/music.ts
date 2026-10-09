// Generative ambient music (Web Audio, no asset files). Sparse by design: slow pads that change chord every ~12 s,
// a rare soft melody note, and layers that fade in with danger — a low heartbeat, then a dark drone for the heavy fights and bosses.
// Presentation only: it reads the sim through `dangerOf` and never feeds anything back. Math.random is fine here (cosmetic).
import { Kind, BYSTANDER, SURRENDERED } from '../../sim/entities';
import { VIEW_W } from '../../sim/constants';
import type { GameState } from '../../sim/state';

/** What the music should be doing right now. */
export interface Scene {
  /** Which biome's key and mode to play in. */
  biome: number;
  /** 0 = quiet (camp, store, menus) .. 1 = overwhelmed. */
  danger: number;
  /** A boss is alive. */
  boss: boolean;
}

interface Mode {
  /** MIDI note of the tonic (kept low). */
  root: number;
  /** Semitones of the scale. */
  scale: readonly number[];
  /** Chord roots as scale degrees; one chord per entry, looped. */
  prog: readonly number[];
  /** Seconds per beat (a chord lasts 8 beats). */
  beat: number;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10], DORIAN = [0, 2, 3, 5, 7, 9, 10], PHRYGIAN = [0, 1, 3, 5, 7, 8, 10], LYDIAN = [0, 2, 4, 6, 7, 9, 11], PENTA = [0, 2, 3, 7, 8];
/** One per biome (wraps if there are more biomes than entries). */
const MODES: readonly Mode[] = [
  { root: 50, scale: DORIAN, prog: [0, 5, 3, 4], beat: 1.5 },
  { root: 52, scale: PHRYGIAN, prog: [0, 1, 0, 6], beat: 1.6 },
  { root: 45, scale: MINOR, prog: [0, 5, 2, 6], beat: 1.5 },
  { root: 53, scale: LYDIAN, prog: [0, 4, 1, 4], beat: 1.7 },
  { root: 47, scale: PENTA, prog: [0, 3, 1, 4], beat: 1.8 },
  { root: 48, scale: MINOR, prog: [0, 3, 5, 4], beat: 1.4 },
];

const LOOKAHEAD = 0.5;
const BEATS_PER_CHORD = 8;
const PAD_ATTACK = 3;
const PAD_RELEASE = 4;
/** Enemies awake and near the screen at which the fight counts as full-on. */
const FULL_DANGER_MOBS = 40;
/** Seconds for a layer to rise / fall (a fight swells in faster than it ebbs). */
const RISE = 1.5, FALL = 4;

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** How dangerous the field looks: awake enemies near the screen, and whether the boss is up. */
export function dangerOf(s: GameState, camX: number): { danger: number; boss: boolean } {
  const e = s.ents;
  let n = 0;
  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Mob || !e.alive[i]) continue;
    const f = e.flags[i];
    if (!(f & 1) || (f & (BYSTANDER | SURRENDERED))) continue;
    const x = e.x[i];
    if (x > camX - 80 && x < camX + VIEW_W + 80) n++;
  }
  const boss = e.boss >= 0 && e.alive[e.boss] === 1;
  return { danger: Math.min(1, n / FULL_DANGER_MOBS), boss };
}

export type Stinger = 'level' | 'boss' | 'win' | 'lose';

export class Music {
  private sting: GainNode;
  private layers: Record<'pad' | 'melody' | 'pulse' | 'tension', { gain: GainNode; level: number }>;
  private reverb: ConvolverNode;
  private tension: { a: OscillatorNode; b: OscillatorNode };
  private mode = MODES[0];
  private nextChord = 0;
  private chord = 0;
  private nextBeat = 0;
  private beatNo = 0;
  private started = false;

  constructor(private ac: AudioContext, out: AudioNode) {
    const rev = ac.createConvolver();
    rev.buffer = impulse(ac, 3.5);
    const wet = ac.createGain();
    wet.gain.value = 0.7;
    rev.connect(wet).connect(out);
    this.reverb = rev;

    const mk = (send: number) => {
      const g = ac.createGain();
      g.gain.value = 0;
      g.connect(out);
      const s = ac.createGain();
      s.gain.value = send;
      g.connect(s).connect(rev);
      return { gain: g, level: 0 };
    };
    // Stingers bypass the danger layers: short phrases in the current key that ring out into the reverb.
    this.sting = ac.createGain();
    this.sting.connect(out);
    const ss = ac.createGain();
    ss.gain.value = 0.9;
    this.sting.connect(ss).connect(rev);
    this.layers = { pad: mk(0.8), melody: mk(1), pulse: mk(0.3), tension: mk(0.5) };

    // The dark drone: two detuned saws behind a low filter, always running, only audible when the tension layer rises.
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 2;
    const lfo = ac.createOscillator(), lfoGain = ac.createGain();
    lfo.frequency.value = 0.07; lfoGain.gain.value = 90;
    lfo.connect(lfoGain).connect(lp.frequency); lfo.start();
    const a = ac.createOscillator(), b = ac.createOscillator();
    a.type = 'sawtooth'; b.type = 'sawtooth';
    const v = ac.createGain();
    v.gain.value = 0.22;
    a.connect(lp); b.connect(lp); lp.connect(v).connect(this.layers.tension.gain);
    a.start(); b.start();
    this.tension = { a, b };
  }

  update(dt: number, scene: Scene): void {
    const ac = this.ac, t = ac.currentTime;
    const m = MODES[scene.biome % MODES.length];
    if (!this.started) {
      this.started = true;
      this.mode = m;
      this.nextChord = this.nextBeat = t + 0.1;
      this.setDrone(m, t, 0);
    } else if (m !== this.mode) {
      this.mode = m; // takes effect at the next chord; the pads already sounding ring out underneath
      this.chord = 0;
      this.setDrone(m, t, 4);
    }

    const d = scene.danger;
    const target = {
      pad: scene.boss ? 0.6 : 1 - 0.3 * d,
      melody: scene.boss ? 0 : 1 - 0.7 * smooth(0.1, 0.8, d),
      pulse: scene.boss ? 1 : smooth(0.2, 0.7, d),
      tension: scene.boss ? 1 : smooth(0.55, 1, d) * 0.8,
    };
    for (const k of Object.keys(this.layers) as (keyof typeof target)[]) {
      const l = this.layers[k];
      const tau = target[k] > l.level ? RISE : FALL;
      l.level += (target[k] - l.level) * (1 - Math.exp(-dt / tau));
      l.gain.gain.setTargetAtTime(l.level, t, 0.15);
    }

    while (this.nextChord < t + LOOKAHEAD) {
      this.playChord(this.nextChord, scene);
      this.nextChord += this.mode.beat * BEATS_PER_CHORD;
    }
    while (this.nextBeat < t + LOOKAHEAD) {
      if (this.layers.pulse.level > 0.03) this.playPulse(this.nextBeat, scene);
      this.nextBeat += this.mode.beat;
      this.beatNo++;
    }
  }

  /** A short phrase for a moment that should be marked, played in the key the music is in. */
  stinger(kind: Stinger): void {
    const t = this.ac.currentTime + 0.05;
    switch (kind) {
      case 'level': // three soft notes climbing the chord, the last left to ring
        [0, 2, 4].forEach((d, i) => this.bell(t + i * 0.2, this.degree(d + 7), i === 2 ? 3 : 1.4, 0.2));
        this.swell(t, this.degree(0), 3, 0.12);
        break;
      case 'boss': // the weight lifts: a low open fifth underneath, then a slow climb
        this.swell(t, this.degree(0) - 12, 5, 0.3);
        this.swell(t, this.degree(4) - 12, 5, 0.2);
        [0, 2, 4, 7].forEach((d, i) => this.bell(t + 0.7 + i * 0.55, this.degree(d + 7), i === 3 ? 4 : 2, 0.2));
        break;
      case 'win': // the same climb, one step further, with the whole chord underneath
        this.swell(t, this.degree(0) - 12, 6, 0.3);
        this.swell(t, this.degree(2), 6, 0.15);
        this.swell(t, this.degree(4), 6, 0.15);
        [0, 2, 4, 7, 9].forEach((d, i) => this.bell(t + 0.5 + i * 0.5, this.degree(d + 7), i === 4 ? 5 : 2, 0.2));
        break;
      case 'lose': // a slow fall to the tonic
        [4, 2, 0].forEach((d, i) => this.bell(t + i * 0.9, this.degree(d + 7) - 12, i === 2 ? 5 : 2.5, 0.22));
        this.swell(t + 1.8, this.degree(0) - 12, 5, 0.25);
        break;
    }
  }

  /** A soft struck note: quick attack, long fade. */
  private bell(t: number, midi: number, dur: number, vol: number): void {
    const ac = this.ac, g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.sting);
    for (const [mul, v] of [[1, 1], [2.01, 0.25]] as const) {
      const o = ac.createOscillator(), og = ac.createGain();
      o.type = 'sine'; o.frequency.value = mtof(midi) * mul; og.gain.value = v;
      o.connect(og).connect(g);
      o.start(t); o.stop(t + dur + 0.05);
    }
  }

  /** A slow-rising held tone. */
  private swell(t: number, midi: number, dur: number, vol: number): void {
    const ac = this.ac, g = ac.createGain(), o = ac.createOscillator();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.type = midi < 52 ? 'sine' : 'triangle';
    o.frequency.value = mtof(midi);
    o.connect(g).connect(this.sting);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private setDrone(m: Mode, t: number, glide: number): void {
    const f = mtof(m.root - 24);
    this.tension.a.frequency.setTargetAtTime(f, t, glide || 0.01);
    this.tension.b.frequency.setTargetAtTime(f * 1.5 * 1.012, t, glide || 0.01); // a slightly flat fifth: uneasy, not dissonant
  }

  private degree(d: number): number {
    const sc = this.mode.scale, n = sc.length;
    return this.mode.root + sc[((d % n) + n) % n] + 12 * Math.floor(d / n);
  }

  private playChord(t: number, scene: Scene): void {
    const m = this.mode;
    const p = m.prog[this.chord++ % m.prog.length];
    const len = m.beat * BEATS_PER_CHORD;
    // Triad plus the root an octave down; now and then a ninth, for colour.
    const notes = [this.degree(p) - 12, this.degree(p), this.degree(p + 2), this.degree(p + 4)];
    if (Math.random() < 0.35) notes.push(this.degree(p + 8));
    for (const n of notes) this.padNote(t, n, len);

    // A sparse melody: zero to two long soft notes somewhere in the chord, more when it is quiet.
    const count = Math.random() < 0.3 ? 0 : Math.random() < 0.6 ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const at = t + 2 + Math.random() * (len - 4);
      this.melodyNote(at, this.degree(p + [0, 2, 4, 1, 3][Math.floor(Math.random() * 5)] + 7));
    }
    void scene;
  }

  private padNote(t: number, midi: number, len: number): void {
    const ac = this.ac, end = t + len + PAD_RELEASE;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.1, t + PAD_ATTACK);
    g.gain.setValueAtTime(0.1, t + len);
    g.gain.linearRampToValueAtTime(0.0001, end);
    g.connect(this.layers.pad.gain);
    for (const detune of [-5, 5]) {
      const o = ac.createOscillator();
      o.type = midi < 52 ? 'sine' : 'triangle';
      o.frequency.value = mtof(midi);
      o.detune.value = detune;
      o.connect(g);
      o.start(t); o.stop(end + 0.05);
    }
  }

  private melodyNote(t: number, midi: number): void {
    const ac = this.ac;
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'triangle';
    o.frequency.value = mtof(midi);
    f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    o.connect(f).connect(g).connect(this.layers.melody.gain);
    o.start(t); o.stop(t + 4.6);
  }

  /** A low heartbeat: every other beat while it is tense, every beat (with a second, deeper hit) in the heavy fights and for bosses. */
  private playPulse(t: number, scene: Scene): void {
    const heavy = scene.boss || scene.danger > 0.65;
    if (!heavy && this.beatNo % 2) return;
    this.thump(t, 62, 36, 0.5, 0.45);
    if (heavy) this.thump(t + this.mode.beat * 0.5, 48, 30, 0.6, scene.boss ? 0.5 : 0.3);
  }

  private thump(t: number, f0: number, f1: number, dur: number, vol: number): void {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.layers.pulse.gain);
    o.start(t); o.stop(t + dur + 0.05);
  }
}

/** A cheap reverb tail: decaying noise. */
function impulse(ac: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  }
  return buf;
}
