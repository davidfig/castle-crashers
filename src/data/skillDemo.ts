// A skill specimen for looking at: `demoSpecial('lob', 'fire', { count: 6, pattern: 'ring', spread: 50 })` gives a legal Special of that delivery made of that
// element, with the numbers a mid-game monster would have. The dev preview (`?demo=lob:fire:pattern=ring:count=6`, see main.ts) casts one over and over
// at a hero so every look can be judged; the render tests cast every kind x element through the sim with it.
import { ELEMENTS } from './elements';
import { NovaStyle, Pattern, ProjStyle, type Special } from './mobs';

export const DEMO_KINDS: readonly Special['kind'][] = [
  'lob', 'summon', 'heal', 'rally', 'blink', 'nova', 'beam', 'trap', 'cling', 'ward', 'storm', 'whiteout', 'wail', 'lure', 'leap', 'pounce', 'gust', 'pit', 'hex', 'dazzle',
  'bolt', 'ring', 'cone', 'totem',
];

/** An element by name (or number); -1 when unknown. */
export function elementByName(name: string): number {
  const n = name.toLowerCase();
  const k = ELEMENTS.findIndex((e) => e.name === n);
  if (k >= 0) return k;
  const v = Number(n);
  return Number.isInteger(v) && v >= 0 && v < ELEMENTS.length ? v : -1;
}

const PROJ_BY_NAME: Record<string, number> = { arrow: 0, bone: 1, harpoon: 2, shard: 3, glob: 4, fire: 5, falcon: 6, orb: 7, spike: 8, comet: 9, mote: 10 };
const NOVA_BY_NAME: Record<string, number> = Object.fromEntries(Object.entries(NovaStyle).map(([k, v]) => [k.toLowerCase(), v as number]));

/** A value written as text in a ?demo= override: a number, `true`/`false`, a Pattern / ProjStyle / NovaStyle name, or an element name. */
function parseValue(key: string, raw: string): number | boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const lower = raw.toLowerCase();
  if (key === 'pattern') {
    const p = Object.entries(Pattern).find(([n]) => n.toLowerCase() === lower);
    if (p) return p[1] as number;
  } else if (key === 'shape') {
    if (lower in PROJ_BY_NAME) return PROJ_BY_NAME[lower];
  } else if (key === 'style') {
    if (lower in NOVA_BY_NAME) return NOVA_BY_NAME[lower];
  } else if (key === 'element') {
    const el = elementByName(lower);
    if (el >= 0) return el;
  }
  const v = Number(raw);
  return Number.isFinite(v) ? v : 0;
}

/** Splits `lob:ice:pattern=ring:count=6` (after the `demo=`) into a kind, an element and overrides. Null when the kind or element is unknown. */
export function parseDemo(text: string): { kind: Special['kind']; element: number; overrides: Record<string, number | boolean> } | null {
  const parts = text.split(':');
  const kind = parts[0] as Special['kind'];
  if (!DEMO_KINDS.includes(kind)) return null;
  const element = elementByName(parts[1] ?? 'physical');
  if (element < 0) return null;
  const overrides: Record<string, number | boolean> = {};
  for (const kv of parts.slice(2)) {
    const [k, v] = kv.split('=');
    if (k && v !== undefined) overrides[k] = parseValue(k, v);
  }
  return { kind, element, overrides };
}

/** How far from the hero a caster of this kind likes to stand (melee-ish kinds need to be close, so the demo stands them closer). */
export function demoStandoff(kind: Special['kind']): number {
  switch (kind) {
    case 'nova': case 'wail': case 'whiteout': case 'gust': case 'lure': case 'cone': case 'pounce': case 'cling': case 'ring': return 56;
    case 'leap': case 'blink': return 90;
    default: return 170;
  }
}

/**
 * A Special of `kind` made of `element` (0 = none), with the given fields overriding the defaults (anything it does not know is passed through).
 * `delay`, `windup` and `cooldown` are short so a viewer does not wait; `cooldown` defaults to 120 ticks.
 */
export function demoSpecial(kind: Special['kind'], element = 0, overrides: Record<string, number | boolean> = {}): Special {
  const base = { windup: 40, cooldown: 120 };
  let sp: Special;
  switch (kind) {
    case 'lob': sp = { kind, ...base, minRange: 40, maxRange: 400, radius: 18, damage: 8, delay: 48 }; break;
    case 'summon': sp = { kind, ...base, windup: 50, type: 0, count: 2, cap: 8 }; break;
    case 'heal': sp = { kind, ...base, radius: 70, amount: 0.4 }; break;
    case 'rally': sp = { kind, ...base, radius: 90, duration: 300 }; break;
    case 'blink': sp = { kind, ...base, windup: 26, minRange: 40, maxRange: 400 }; break;
    case 'nova': sp = { kind, ...base, windup: 44, radius: 56, damage: 10, slow: 0, style: element === 2 ? NovaStyle.Frost : NovaStyle.Stomp }; break;
    case 'beam': sp = { kind, ...base, windup: 56, range: 230, width: 6, damage: 12 }; break;
    case 'trap': sp = { kind, ...base, windup: 28, minRange: 30, maxRange: 400, radius: 10, damage: 4, arm: 50, root: 60, linger: 900, cap: 8, spread: 22 }; break;
    case 'cling': sp = { kind, ...base, windup: 10, range: 40, damage: 1, pulse: 30, slow: 40, cap: 3 }; break;
    case 'ward': sp = { kind, ...base, windup: 50, radius: 90, duration: 480, need: 1 }; break;
    case 'storm': sp = { kind, ...base, minRange: 30, maxRange: 400, radius: 36, delay: 50, linger: 260, damage: 3, slow: 60, cap: 9 }; break;
    case 'whiteout': sp = { kind, ...base, radius: 64, damage: 3, duration: 75 }; break;
    case 'wail': sp = { kind, ...base, radius: 70, damage: 4, duration: 200 }; break;
    case 'lure': sp = { kind, ...base, radius: 140, pull: 64, damage: 2 }; break;
    case 'leap': sp = { kind, ...base, windup: 28, minRange: 40, maxRange: 400, radius: 20, damage: 9, slow: 0, delay: 30 }; break;
    case 'pounce': sp = { kind, ...base, windup: 14, minRange: 20, maxRange: 400, radius: 14, damage: 9, delay: 16 }; break;
    case 'gust': sp = { kind, ...base, windup: 34, radius: 56, damage: 4, push: 90 }; break;
    case 'pit': sp = { kind, ...base, windup: 46, minRange: 30, maxRange: 400, radius: 34, delay: 45, linger: 240, pull: 0.55, damage: 4 }; break;
    case 'hex': sp = { kind, ...base, windup: 44, minRange: 30, maxRange: 400, radius: 22, duration: 300 }; break;
    case 'dazzle': sp = { kind, ...base, windup: 48, minRange: 40, maxRange: 400, radius: 24, duration: 50, damage: 3 }; break;
    case 'bolt': sp = { kind, ...base, windup: 40, minRange: 30, maxRange: 400, count: 1, spread: 0, speed: 2.2, damage: 6, shape: ProjStyle.Orb }; break;
    case 'ring': sp = { kind, ...base, windup: 42, maxRange: 400, count: 10, speed: 1.6, damage: 4, shape: ProjStyle.Orb }; break;
    case 'cone': sp = { kind, ...base, windup: 40, minRange: 0, maxRange: 400, range: 80, arc: 0.1, damage: 10 }; break;
    case 'totem': sp = { kind, ...base, windup: 40, minRange: 30, maxRange: 400, range: 200, lifetime: 360, interval: 60, damage: 4, speed: 1.8, shape: ProjStyle.Orb, cap: 2 }; break;
  }
  const out = { ...sp, ...overrides } as Special;
  if (out.kind === 'lob') {
    const res = (overrides as Record<string, unknown>).residue;
    if (res) out.residue = { radius: 24, linger: 240, damage: 2 }; else delete out.residue;
  }
  if (out.kind === 'bolt' && out.count > 1 && !out.spread) out.spread = 0.05;
  if (element > 0) { out.element = element; out.power = out.power ?? 1.2; }
  return out;
}
