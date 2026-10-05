// Class definitions (see docs/04-classes-progression.md). Only the warrior exists so far.
export interface Swing {
  range: number;
  /** Minimum dot(facing, direction-to-target); lower = wider arc. */
  dot: number;
  damage: number;
  knock: number;
  cooldown: number;
  hitStop: number;
  /** Heavy swings break shields. */
  pierce: boolean;
  /** Ticks of forward step while swinging (weight). */
  lunge: number;
  /** Finisher: also cuts a straight wave this long down the facing line (0 = none). */
  wave: number;
  waveWidth: number;
}

export interface ClassDef {
  name: string;
  hp: number;
  speed: number;
  /** 3-hit combo; the last swing is the heavy finisher. */
  combo: Swing[];
  /** Ticks after a swing in which the next press continues the combo. */
  comboWindow: number;
  furyMax: number;
  furyPerHit: number;
  furyPerSwingCap: number;
  furyPerKill: number;
  healPerKill: number;
  // ability 1: radial nova, powered by fury
  novaCost: number;
  novaRadius: number;
  novaDamage: number;
  novaKnock: number;
  novaCooldown: number;
  /** Used when the nova is cast with a full fury bar. */
  novaBigRadius: number;
  novaBigDamage: number;
  // dodge
  dashSpeed: number;
  dashTicks: number;
  dashCooldown: number;
  dashDamage: number;
  dashKnock: number;
}

export const CLASSES: ClassDef[] = [
  {
    name: 'warrior',
    hp: 100,
    speed: 1.5,
    combo: [
      { range: 38, dot: 0.0, damage: 6, knock: 3.8, cooldown: 21, hitStop: 1, pierce: false, lunge: 3, wave: 0, waveWidth: 0 },
      { range: 40, dot: 0.0, damage: 6, knock: 4.2, cooldown: 21, hitStop: 1, pierce: false, lunge: 3, wave: 0, waveWidth: 0 },
      { range: 50, dot: -0.5, damage: 12, knock: 6.5, cooldown: 42, hitStop: 3, pierce: true, lunge: 5, wave: 120, waveWidth: 26 },
    ],
    comboWindow: 28,
    furyMax: 100,
    furyPerHit: 1.2,
    furyPerSwingCap: 6,
    furyPerKill: 0.8,
    healPerKill: 0.1,
    novaCost: 50,
    novaRadius: 70,
    novaDamage: 9,
    novaKnock: 3.5,
    novaCooldown: 30,
    novaBigRadius: 105,
    novaBigDamage: 14,
    dashSpeed: 3.6,
    dashTicks: 10,
    dashCooldown: 45,
    dashDamage: 2,
    dashKnock: 3,
  },
];
