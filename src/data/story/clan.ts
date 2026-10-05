// A Clan: the people a run's region belongs to, generated from the run seed's `story` stream so that
// changing it never shifts rooms, loot or combat (docs/12-story.md, "The Clan").
import { createRng, rngInt, Stream, type Rng } from '../../engine/rng';
import { MobType } from '../mobs';

export type Trade = 'farmers' | 'miners' | 'herders' | 'builders' | 'hunters' | 'scribes';
export type Temperament = 'defiant' | 'weary' | 'proud' | 'frightened';
export type LeaderRole = 'warlord' | 'elder' | 'council';

export interface Clan {
  place: string;
  /** "the Ashfen Reeds" */
  name: string;
  /** Mob types the clan fields, most common first. Never the boss. */
  species: number[];
  banner: { color: number; glyph: string };
  trade: Trade;
  temperament: Temperament;
  leader: { name: string; role: LeaderRole; trait: string };
  /** One line: what the humans took. Text slots are already filled. */
  grievance: string;
}

export function pick<T>(r: Rng, a: readonly T[]): T {
  return a[rngInt(r, a.length)];
}

const PLACES = [
  'Ashfen', 'Brackwater', 'Cinderhollow', 'Dunmarrow', 'Thornbeck', 'Hollowmere', 'Greywick', 'Stonefold',
  'Mossgate', 'Emberdell', 'Saltmarch', 'Larkspur', 'Windrow', 'Coldharbor', 'Fenwick', 'Redmoor',
];
const EMBLEMS = [
  'Reeds', 'Lanterns', 'Foxes', 'Hammers', 'Wrens', 'Kettles', 'Antlers', 'Salt',
  'Wheels', 'Ravens', 'Thistles', 'Ladders', 'Moths', 'Needles', 'Bells', 'Boughs',
];
const GLYPHS = ['crescent', 'hammer', 'sprig', 'eye', 'wheel', 'bird', 'flame', 'tooth'];
const COLORS = [0xb04a3a, 0xc9892f, 0x6a9a3c, 0x3f8f8a, 0x4a6fb5, 0x8a5aa8, 0xa86a8a, 0x8a7a5a];

const TRADES: readonly Trade[] = ['farmers', 'miners', 'herders', 'builders', 'hunters', 'scribes'];
const TEMPERAMENTS: readonly Temperament[] = ['defiant', 'weary', 'proud', 'frightened'];

/** Integer weights per trade over the mob types a clan of that trade fields. */
const SPECIES_BY_TRADE: Record<Trade, ReadonlyArray<readonly [number, number]>> = {
  farmers: [[MobType.Goblin, 5], [MobType.Shield, 1], [MobType.Archer, 1]],
  miners: [[MobType.Bomber, 4], [MobType.Orc, 2], [MobType.Goblin, 2], [MobType.Shield, 1]],
  herders: [[MobType.Goblin, 3], [MobType.Shield, 2], [MobType.Archer, 2]],
  builders: [[MobType.Orc, 4], [MobType.Shield, 2], [MobType.Goblin, 1]],
  hunters: [[MobType.Archer, 4], [MobType.Goblin, 2], [MobType.Orc, 1]],
  scribes: [[MobType.Archer, 2], [MobType.Shield, 2], [MobType.Goblin, 1]],
};

const ROLES: Record<Temperament, readonly LeaderRole[]> = {
  defiant: ['warlord', 'warlord', 'council'],
  weary: ['elder', 'elder', 'council'],
  proud: ['council', 'warlord', 'elder'],
  frightened: ['elder', 'elder', 'council'],
};

const LEADER_NAMES = ['Brakka', 'Ulm', 'Tessik', 'Orrin', 'Madda', 'Kesh', 'Vorn', 'Ilsa', 'Dobb', 'Hesk', 'Nari', 'Pell'];
const LEADER_TRAITS = [
  'counts every child twice before a march',
  'never raises their voice',
  'carries the boundary stones in a sack',
  'has not slept in the same camp twice',
  'trades fairly and expects the same',
  'sings the walking songs to keep the line moving',
  'mends everyone\'s boots before their own',
  'remembers every road that used to be theirs',
];

/** `{place}` is the only slot. */
const GRIEVANCES: Record<Trade, readonly string[]> = {
  farmers: [
    'The Crown drew a new road through {place} and called the fields unclaimed.',
    'A walled town upriver dammed the stream that watered {place}.',
    'Tax-men burned the {place} granary for harbouring vermin.',
  ],
  miners: [
    'The cities bought the {place} quarry and barred its diggers from their own seams.',
    'Powder-masters from the capital took over the {place} diggings and kept the diggers\' tools.',
    'The {place} shafts were flooded to make room for a canal.',
  ],
  herders: [
    'The grazing at {place} was fenced for a lord\'s hunting park.',
    'A toll gate went up on the only drove road out of {place}.',
    'The summer pastures of {place} were sold to a monastery.',
  ],
  builders: [
    'They raised the walls of the human towns and were never paid.',
    'The {place} yards built the keep, and were driven out when it was done.',
    'The masons of {place} were told the new districts had no room for them.',
  ],
  hunters: [
    'The forests around {place} were declared the Crown\'s, and their bows declared poachers\' tools.',
    'A king\'s warrant closed the game trails of {place}.',
    'The deer-paths of {place} were fenced into a lord\'s chase.',
  ],
  scribes: [
    'The tally-scribes of {place} kept the old boundary maps, and the maps went missing.',
    'The records of {place} were requisitioned by the cities and never returned.',
    'The {place} archive was burned to settle a land dispute.',
  ],
};

function weightedSpecies(r: Rng, trade: Trade): number[] {
  const pool = SPECIES_BY_TRADE[trade].map(([t, w]) => [t, w] as [number, number]);
  const count = 2 + rngInt(r, 2); // 2-3 types
  const out: number[] = [];
  while (out.length < count && pool.length > 0) {
    let total = 0;
    for (const [, w] of pool) total += w;
    let roll = rngInt(r, total);
    let i = 0;
    while (roll >= pool[i][1]) { roll -= pool[i][1]; i++; }
    out.push(pool[i][0]);
    pool.splice(i, 1);
  }
  return out;
}

export function makeClan(seed: number): Clan {
  const r = createRng(seed, Stream.story);
  const place = pick(r, PLACES);
  const emblem = pick(r, EMBLEMS);
  const trade = pick(r, TRADES);
  const temperament = pick(r, TEMPERAMENTS);
  return {
    place,
    name: `the ${place} ${emblem}`,
    species: weightedSpecies(r, trade),
    banner: { color: pick(r, COLORS), glyph: pick(r, GLYPHS) },
    trade,
    temperament,
    leader: { name: pick(r, LEADER_NAMES), role: pick(r, ROLES[temperament]), trait: pick(r, LEADER_TRAITS) },
    grievance: pick(r, GRIEVANCES[trade]).replace('{place}', place),
  };
}
