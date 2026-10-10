// The random bestiary. `generateBestiary(runSeed)` builds a whole cast of monsters, one for every enemy slot (MobType index), from
// pieces: body plans, powers, sizes, colours. It is a pure function of the seed: every client and replay builds the same cast,
// the cast stays the same for the whole run (every level, every biome of the road), and the next run gets a different one, so the
// player has to learn this run's monsters. `installBestiary` puts it into `MOBS`, which is what the sim and renderer read; with
// nothing installed the game has the hand-made roster.
import { CLASSIC_MOBS, MOBS, type MobDef } from '../mobs';
import type { MonsterLook } from '../monsterLook';
import { makeBoss } from './boss';
import { makeFaction } from './look';
import { makeMob } from './monster';
import { slotPlans } from './plan';
import { Dice } from './rand';

export interface Bestiary {
  seed: number;
  /** Indexed by MobType. */
  defs: MobDef[];
  looks: MonsterLook[];
  /** Ids of the powers each monster wears (a boss: the specials it casts). For logs, tests and the bestiary page. */
  traits: string[][];
}

export function generateBestiary(seed: number): Bestiary {
  seed = seed >>> 0;
  const n = CLASSIC_MOBS.length;
  const defs: MobDef[] = new Array(n);
  const looks: MonsterLook[] = new Array(n);
  const traits: string[][] = new Array(n);
  const names = new Set<string>();
  for (const bp of slotPlans()) {
    const faction = makeFaction(new Dice(seed, 0x1000 + bp.biome));
    const led = { used: new Set<string>(), names };
    for (const p of bp.entries) {
      const m = makeMob(p, bp, faction, led, seed);
      defs[p.slot] = m.def; looks[p.slot] = m.look; traits[p.slot] = m.traits;
    }
    const b = makeBoss(bp, faction, names, seed);
    defs[bp.boss] = b.def; looks[bp.boss] = b.look; traits[bp.boss] = b.traits;
  }
  return { seed, defs, looks, traits };
}

let current: Bestiary | null = null;
/** Bumped by every install, so the renderer knows to rebuild its monster sprites. */
let epoch = 0;

/** Puts a bestiary's monsters into `MOBS` (null restores the hand-made roster). */
export function installBestiary(b: Bestiary | null): void {
  const src: readonly MobDef[] = b ? b.defs : CLASSIC_MOBS;
  for (let i = 0; i < src.length; i++) MOBS[i] = src[i];
  current = b;
  epoch++;
}

/** The installed bestiary, or null while the hand-made roster is in play. */
export function activeBestiary(): Bestiary | null { return current; }
export function bestiaryEpoch(): number { return epoch; }

/** Builds and installs the bestiary for a run seed, unless it is already the one in play. */
export function ensureBestiary(seed: number): Bestiary {
  seed = seed >>> 0;
  if (current && current.seed === seed) return current;
  const b = generateBestiary(seed);
  installBestiary(b);
  return b;
}
