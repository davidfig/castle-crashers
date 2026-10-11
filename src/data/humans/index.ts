// A run's people (docs/19-generated-humans.md). `generateFolk(seed)` is a pure function of the run seed: the same run always has the same
// Registrar, King, Herald, Captain, Elder and peddler, down to the last button; the next run has new faces in the same offices. It has
// its own random streams (never the sim's), and nothing here is read by the sim: people are pictures.
import type { NpcName } from '../../render/npcArt';
import type { FolkRole, HumanLook } from '../humanLook';
import { Dice } from '../bestiary/rand';
import { personName } from './names';
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
  /** Each figure's own name ("Aldric"); the office goes in front where the game wants one (LORD ALDRIC). */
  names: Record<NpcName, string>;
}

const FOLK_SALT = 0x6e70;

export function generateFolk(seed: number): Folk {
  const livery = crownLivery(new Dice(seed, FOLK_SALT));
  const looks = {} as Record<NpcName, HumanLook>;
  (Object.keys(NPC_ROLE) as NpcName[]).forEach((name, i) => {
    looks[name] = rollHuman(new Dice(seed, FOLK_SALT + 1 + i), NPC_ROLE[name], livery);
  });
  const names = {} as Record<NpcName, string>;
  const taken = new Set<string>();
  (Object.keys(NPC_ROLE) as NpcName[]).forEach((name, i) => {
    names[name] = personName(new Dice(seed, FOLK_SALT + 50 + i), NPC_ROLE[name], taken);
    taken.add(names[name]);
  });
  return { seed, livery, looks, names };
}

/** Any number of further people of one office (the crowd, captives, a village), each a pure function of (seed, role, n). */
export function generatePerson(seed: number, role: FolkRole, n: number): HumanLook {
  const dice = new Dice(seed, FOLK_SALT + 100 + n);
  return rollHuman(dice, role, crownLivery(new Dice(seed, FOLK_SALT)));
}

/** The run's people as the game's text sees them (quest givers' names). Nothing installed: the hand-made names. */
let active: Folk | null = null;
export function installFolk(f: Folk | null): void { active = f; }
export function activeFolk(): Folk | null { return active; }

export { crownLivery, rollHuman, personName };
export type { Livery };
