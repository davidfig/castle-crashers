// The only way players influence the sim. Quantized so it can go over a wire later.
export const Btn = {
  Attack: 1,
  Ability1: 2,
  Dodge: 4,
  Join: 8,
  Interact: 16,
  Swap: 32,
  Ability2: 64,
  /** Opens or closes the level-up panel. */
  Level: 128,
} as const;

export interface InputFrame {
  /** -127..127 */
  moveX: number;
  /** -127..127 */
  moveY: number;
  /** Aim stick, -127..127. Zero (inside deadzone) means face along movement. */
  aimX: number;
  aimY: number;
  buttons: number;
}

export function createInputFrame(): InputFrame {
  return { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };
}
