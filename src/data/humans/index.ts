// A run's people (docs/18-generated-humans.md). `generateFolk(seed)` is a pure function of the run seed: the same run always has the same
// Registrar, King, Herald, Captain, Elder and peddler, down to the last button; the next run has new faces in the same offices. It has
// its own random streams (never the sim's), and nothing here is read by the sim: people are pictures.
import type { NpcName } from '../../render/npcArt';
import type { FolkRole, HumanLook } from '../humanLook';
import { Dice } from '../bestiary/rand';
import { crownLivery, rollHuman, type Livery } from './roll';

/** The office each story figure holds, which sets the wardrobe they are drawn from. */
export const NPC_ROLE: Record<NpcName, FolkRole> = {
  registrar: 'clerk', peddler: 'peddler', king: 'noble', herald: 'herald', captain: 'captain', elder: 'elder',
};

export interface Folk {
  seed: number;
  /** The court's colours this run: the King, Herald and Captain wear them. */
  livery: Livery;
  looks: Record<NpcName, HumanLook>;
}

const FOLK_SALT = 0x6e70;

export function generateFolk(seed: number): Folk {
  const livery = crownLivery(new Dice(seed, FOLK_SALT));
  const looks = {} as Record<NpcName, HumanLook>;
  (Object.keys(NPC_ROLE) as NpcName[]).forEach((name, i) => {
    looks[name] = rollHuman(new Dice(seed, FOLK_SALT + 1 + i), NPC_ROLE[name], livery);
  });
  return { seed, livery, looks };
}

/** Any number of further people of one office (the crowd, captives, a village), each a pure function of (seed, role, n). */
export function generatePerson(seed: number, role: FolkRole, n: number): HumanLook {
  const dice = new Dice(seed, FOLK_SALT + 100 + n);
  return rollHuman(dice, role, crownLivery(new Dice(seed, FOLK_SALT)));
}

export { crownLivery, rollHuman };
export type { Livery };
