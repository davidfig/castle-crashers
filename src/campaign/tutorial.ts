// The first-time controls tutorial: the start of a new player's first field, where small waves teach the buttons one at a time.
// It runs outside the sim (the sim only holds back its planned encounters while `tutorialHold` is set), so it is DOM-free and testable.
import { MAX_PLAYERS } from '../sim/constants';
import { Btn, type InputFrame } from '../sim/input';
import { Kind } from '../sim/entities';
import { spawnTutorialWave } from '../sim/gen/level';
import type { GameState } from '../sim/state';
import { CLASSES } from '../data/classes';
import { NOUNS } from '../data/upgrades';

/** localStorage key: set once the tutorial has been finished or skipped, so it plays for a new player only. */
export const TUTORIAL_KEY = 'game.tutorialDone';

export type TutorialAction = 'move' | 'attack' | 'ability1' | 'ability2' | 'dodge';

/** Pixels a hero must walk to have learned to move. */
const WALK_PX = 110;
/** Ticks the "well done" card shows between steps, and ticks the skip button must be held. */
const GAP_TICKS = 75;
export const SKIP_TICKS = 60;
/** The cleric's attack is an aura she switches on, not a swing to chain. */
const AURA_CLASS = 2;

interface StepDef {
  action: TutorialAction | null;
  /** Enemies that come on at the start of the step. */
  wave: number;
  title: (classId: number) => string;
  text: (classId: number) => string;
  /** Presses (or pixels, for walking) that count as having learned it. */
  need: (classId: number) => number;
}

const noun = (classId: number, k: 0 | 1 | 2 | 3): string => NOUNS[classId]?.[k] ?? '';

const STEPS: readonly StepDef[] = [
  { action: 'move', wave: 0, title: () => 'MOVE', text: () => 'The field is deep as well as wide. Walk right and then up and down.', need: () => WALK_PX },
  {
    action: 'attack', wave: 2,
    title: (c) => `ATTACK  ${noun(c, 0)}`,
    text: (c) => (c === AURA_CLASS ? 'Press to switch your aura on, then stand among the goblins.' : 'Hit the goblins. Press again in rhythm to chain a combo.'),
    need: (c) => (c === AURA_CLASS ? 1 : 3),
  },
  { action: 'ability1', wave: 4, title: (c) => `ABILITY 1  ${noun(c, 2)}`, text: () => 'Fury builds as you fight. Spend it on a big area attack.', need: () => 1 },
  { action: 'ability2', wave: 5, title: (c) => `ABILITY 2  ${noun(c, 1)}`, text: () => 'Your heavy move. It costs stamina, so use it when it counts.', need: () => 1 },
  { action: 'dodge', wave: 3, title: (c) => `DODGE  ${noun(c, 3)}`, text: () => 'Slip out of trouble, or through it. It costs stamina too.', need: () => 1 },
  { action: null, wave: 6, title: () => 'PUT IT TOGETHER', text: () => 'One more band. Use everything you have learned.', need: () => 0 },
];

export interface Tutorial {
  step: number;
  /** Per slot: progress on this step (presses, or pixels walked). */
  progress: number[];
  prevButtons: number[];
  lastX: number[];
  lastY: number[];
  /** Ticks left of the "well done" card between steps (0 = a step is in play). */
  gap: number;
  /** Ticks the skip button has been held. */
  skipHeld: number;
  /** The step's enemies have been brought on. */
  started: boolean;
  /** Finished or skipped: the caller releases the sim's hold. */
  over: boolean;
}

export function createTutorial(): Tutorial {
  const z = (): number[] => new Array(MAX_PLAYERS).fill(0);
  return { step: 0, progress: z(), prevButtons: z(), lastX: z().map(() => NaN), lastY: z().map(() => NaN), gap: 0, skipHeld: 0, started: false, over: false };
}

/** Whether this browser has already been through (or skipped) the tutorial. Blocked storage counts as not yet, so it plays rather than silently vanishing. */
export function tutorialSeen(store: Pick<Storage, 'getItem'> | undefined): boolean {
  try { return store?.getItem(TUTORIAL_KEY) === '1'; } catch { return false; }
}

export function markTutorialSeen(store: Pick<Storage, 'setItem'> | undefined): void {
  try { store?.setItem(TUTORIAL_KEY, '1'); } catch { /* it will play again next time */ }
}

function liveMobs(s: GameState): number {
  const e = s.ents;
  let n = 0;
  for (let i = 0; i < e.highWater; i++) if (e.alive[i] && e.kind[i] === Kind.Mob) n++;
  return n;
}

/** Heroes the tutorial is waiting on: on their feet. */
function able(s: GameState, k: number): boolean {
  const p = s.players[k];
  return p.active && !p.downed;
}

/** Call once per tick, after the sim has stepped with `frames`. */
export function updateTutorial(t: Tutorial, s: GameState, frames: readonly InputFrame[]): void {
  if (t.over) return;
  const def = STEPS[t.step];
  // Skipping: any hero holding the stand-down button.
  let holding = false;
  for (let k = 0; k < MAX_PLAYERS; k++) if (s.players[k].active && (frames[k].buttons & Btn.Interact)) holding = true;
  t.skipHeld = holding ? t.skipHeld + 1 : 0;
  if (t.skipHeld >= SKIP_TICKS) { t.over = true; return; }

  const edges: number[] = [];
  for (let k = 0; k < MAX_PLAYERS; k++) {
    edges[k] = frames[k].buttons & ~t.prevButtons[k];
    t.prevButtons[k] = frames[k].buttons;
  }

  if (t.gap > 0) {
    if (--t.gap === 0) {
      t.step++;
      t.started = false;
      t.progress.fill(0);
      if (t.step >= STEPS.length) t.over = true;
    }
    return;
  }

  if (!t.started) {
    t.started = true;
    for (let k = 0; k < MAX_PLAYERS; k++) {
      const p = s.players[k];
      if (!p.active) continue;
      s.ents.hp[p.ent] = s.ents.maxhp[p.ent];
      t.lastX[k] = s.ents.x[p.ent];
      t.lastY[k] = s.ents.y[p.ent];
    }
    if (def.wave > 0) spawnTutorialWave(s, def.wave, t.step);
  }

  let waiting = 0;
  for (let k = 0; k < MAX_PLAYERS; k++) {
    const p = s.players[k];
    if (!p.active) continue;
    const cls = CLASSES[p.classId];
    const need = def.need(p.classId);
    const wasDone = t.progress[k] >= need;
    if (!p.downed) {
      if (def.action === 'move') { if (!Number.isNaN(t.lastX[k])) t.progress[k] += Math.hypot(s.ents.x[p.ent] - t.lastX[k], s.ents.y[p.ent] - t.lastY[k]); }
      else if (def.action === 'attack' && edges[k] & Btn.Attack) t.progress[k]++;
      else if (def.action === 'ability1' && edges[k] & Btn.Ability1) t.progress[k]++;
      else if (def.action === 'ability2' && edges[k] & Btn.Ability2) t.progress[k]++;
      else if (def.action === 'dodge' && edges[k] & Btn.Dodge) t.progress[k]++;
    }
    t.lastX[k] = s.ents.x[p.ent];
    t.lastY[k] = s.ents.y[p.ent];
    // Until a hero has tried the move, never let a lack of fury or stamina be what stops them.
    if (!wasDone && !p.downed) {
      if (def.action === 'ability1') p.fury = Math.max(p.fury, cls.novaCost);
      if (def.action === 'ability2' || def.action === 'dodge') { p.stamina = cls.staminaMax; p.winded = false; }
    }
    if (able(s, k) && t.progress[k] < need) waiting++;
  }
  if (waiting === 0 && liveMobs(s) === 0) t.gap = GAP_TICKS;
}

export interface TutorialView {
  title: string;
  text: string;
  /** "2 / 6". */
  count: string;
  /** Per hero: the button to press, and whether they have done it. */
  keys: { slot: number; label: string; done: boolean }[];
  /** The "well done" card between steps. */
  gap: boolean;
  /** 0..1: how far the skip button has been held. */
  skip: number;
  skipLabel: string;
}

/** What the HUD shows; `hint(slot, action)` is the device's name for a button ('' for an unclaimed slot). */
export function tutorialView(t: Tutorial, s: GameState, hint: (slot: number, action: TutorialAction | 'skip') => string): TutorialView {
  const def = STEPS[Math.min(t.step, STEPS.length - 1)];
  const lead = Math.max(0, s.players.findIndex((p) => p.active));
  const cls = s.players[lead].classId;
  const keys: TutorialView['keys'] = [];
  if (def.action && t.gap === 0) {
    s.players.forEach((p, k) => {
      if (p.active) keys.push({ slot: k, label: hint(k, def.action!) || (k === 0 ? FALLBACK[def.action!] : '?'), done: t.progress[k] >= def.need(p.classId) });
    });
  }
  return {
    title: t.gap > 0 ? 'WELL DONE' : def.title(cls),
    text: t.gap > 0 ? '' : def.text(cls),
    count: `${t.step + 1} / ${STEPS.length}`,
    keys,
    gap: t.gap > 0,
    skip: Math.min(1, t.skipHeld / SKIP_TICKS),
    skipLabel: hint(lead, 'skip') || 'U',
  };
}

const FALLBACK: Record<TutorialAction, string> = { move: 'WASD', attack: 'J', ability1: 'K', ability2: 'I', dodge: 'L' };

export const TUTORIAL_STEPS = STEPS.length;
