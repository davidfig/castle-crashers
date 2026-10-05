// Mob definitions. Speeds are px/tick, times are ticks.
export const Behavior = { Melee: 0, Ranged: 1, Bomber: 2 } as const;

export interface MobDef {
  name: string;
  behavior: number;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  atkCooldown: number;
  /** Melee: strike reach. Ranged: preferred standoff distance. Bomber: fuse trigger distance. */
  reach: number;
  /** Ticks of telegraph before the attack lands. Interrupted by stun (except bomber fuses). */
  windup: number;
  knockResist: number;
  /** Blocks frontal non-piercing hits. */
  shield: boolean;
  /** Coin drop: chance (0..1) and value range of the single coin dropped. */
  coinChance: number;
  coinMin: number;
  coinMax: number;
}

export const MobType = { Goblin: 0, Orc: 1, Archer: 2, Shield: 3, Bomber: 4 } as const;

export const MOBS: MobDef[] = [
  { name: 'goblin', behavior: Behavior.Melee, hp: 6, speed: 0.56, radius: 3.5, damage: 3, atkCooldown: 50, reach: 8, windup: 10, knockResist: 1, shield: false, coinChance: 0.5, coinMin: 1, coinMax: 1 },
  { name: 'orc', behavior: Behavior.Melee, hp: 30, speed: 0.38, radius: 5.5, damage: 12, atkCooldown: 80, reach: 14, windup: 24, knockResist: 0.35, shield: false, coinChance: 1, coinMin: 3, coinMax: 6 },
  { name: 'archer', behavior: Behavior.Ranged, hp: 5, speed: 0.5, radius: 3.5, damage: 6, atkCooldown: 110, reach: 100, windup: 30, knockResist: 1, shield: false, coinChance: 0.7, coinMin: 1, coinMax: 3 },
  { name: 'shield', behavior: Behavior.Melee, hp: 22, speed: 0.42, radius: 5, damage: 7, atkCooldown: 70, reach: 11, windup: 16, knockResist: 0.5, shield: true, coinChance: 1, coinMin: 2, coinMax: 4 },
  { name: 'bomber', behavior: Behavior.Bomber, hp: 4, speed: 0.95, radius: 3.5, damage: 14, atkCooldown: 0, reach: 10, windup: 30, knockResist: 1, shield: false, coinChance: 0, coinMin: 0, coinMax: 0 },
];

export const BLAST_RADIUS = 30;
export const ARROW_SPEED = 2.2;
export const ARROW_DAMAGE = 6;
export const ARROW_TTL = 220;
