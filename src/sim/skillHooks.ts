// What the class skills (sim/skills.ts, sim/mageSkills.ts) need from step.ts, which they cannot import (step imports them): step.ts fills
// this in when it loads. Plain function references, no state.
import type { GameState } from './state';

export type DamageMob = (s: GameState, m: number, dmg: number, dirX: number, dirY: number, knock: number, owner: number, flags: number) => number;

export const hooks: { damageMob: DamageMob } = { damageMob: () => 0 };
