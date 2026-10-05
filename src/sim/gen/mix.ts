// Which mob type to spawn at battlefield progress t (0..1). Shared by level gen and the director.
import { rngFloat, type Rng } from '../../engine/rng';
import { MobType } from '../../data/mobs';

export function pickMobType(r: Rng, t: number): number {
  let roll = rngFloat(r);
  const bomber = t > 0.08 ? 0.03 + 0.04 * t : 0;
  const archer = t > 0.04 ? 0.06 : 0;
  const shield = t > 0.12 ? 0.08 : 0;
  const orc = 0.04 + 0.3 * t;
  if ((roll -= bomber) < 0) return MobType.Bomber;
  if ((roll -= archer) < 0) return MobType.Archer;
  if ((roll -= shield) < 0) return MobType.Shield;
  if ((roll -= orc) < 0) return MobType.Orc;
  return MobType.Goblin;
}
