// Personal names for generated people, built from syllables so a run's cast never reads as a list of the same few names. Each office has its own
// sound: nobles are long and grand, captains short and hard, heralds light and bouncy, elders old-fashioned, clerks plain, peddlers anything.
// Plain A-Z only (the story font has no accents). Names are unique within a run.
import type { FolkRole } from '../humanLook';
import type { Dice } from '../bestiary/rand';

interface Sound { start: readonly string[]; mid: readonly string[]; end: readonly string[]; syllables: [number, number] }

const SOUNDS: Record<FolkRole, Sound> = {
  noble: { start: ['Al', 'Ber', 'Cor', 'Dar', 'Eld', 'Gal', 'Hal', 'Ire', 'Lor', 'Mar', 'Osw', 'Ro', 'Se', 'Tha', 'Vi'], mid: ['de', 'ri', 'va', 'lo', 'mi', 'the', 'an'], end: ['ric', 'mund', 'wyn', 'ard', 'ias', 'ona', 'bert', 'elle', 'dric', 'mere'], syllables: [2, 3] },
  captain: { start: ['Bra', 'Dag', 'Gar', 'Hok', 'Jor', 'Kor', 'Mal', 'Ors', 'Rag', 'Sko', 'Thr', 'Ves', 'Wul', 'Yar'], mid: ['k', 'g'], end: ['k', 'th', 'ak', 'ek', 'gar', 'ric', 'dan', 'sk', 'ul'], syllables: [1, 2] },
  herald: { start: ['Pip', 'Tib', 'Fen', 'Nim', 'Wim', 'Lil', 'Bo', 'Tam', 'Quin', 'Jas', 'Mer', 'Dil'], mid: ['pi', 'li', 'bo', 'ti', 'mi'], end: ['pin', 'kin', 'by', 'let', 'ford', 'ly', 'bit', 'wick', 'ton'], syllables: [1, 2] },
  elder: { start: ['Mor', 'Ag', 'Ber', 'Cel', 'Dor', 'Edd', 'Gwen', 'Hild', 'Ish', 'Nan', 'Ors', 'Wil'], mid: ['a', 'e', 'i', 'wy'], end: ['wen', 'tha', 'rin', 'ma', 'dred', 'ine', 'wyn', 'eth', 'ula'], syllables: [2, 2] },
  clerk: { start: ['Ash', 'Ben', 'Cal', 'Dun', 'Ed', 'Gil', 'Hob', 'Ken', 'Lem', 'Nor', 'Pen', 'Sam', 'Tob', 'Wat'], mid: ['e', 'o'], end: ['by', 'ley', 'ton', 'ham', 'son', 'wick', 'ford', 'den', 'ner'], syllables: [1, 2] },
  peddler: { start: ['Ab', 'Bar', 'Cob', 'Dil', 'Eb', 'Fal', 'Gus', 'Hen', 'Jak', 'Lun', 'Mog', 'Nib', 'Pol', 'Rum', 'Sid', 'Tam'], mid: ['o', 'a', 'i', 'u'], end: ['by', 'bo', 'ko', 'wick', 'son', 'ner', 'lo', 'mer', 'zy'], syllables: [1, 2] },
  commoner: { start: ['Ann', 'Bet', 'Col', 'Dob', 'Eli', 'Fen', 'Gil', 'Han', 'Joss', 'Kit', 'Lin', 'Mab', 'Ned', 'Ott', 'Per', 'Rob', 'Sib', 'Tom', 'Wyn'], mid: ['a', 'e', 'o'], end: ['na', 'bert', 'ley', 'ry', 'mer', 'ta', 'dy', 'ton'], syllables: [1, 2] },
};

function one(d: Dice, s: Sound): string {
  const n = d.int(s.syllables[0], s.syllables[1]);
  let name = d.pick(s.start);
  for (let i = 1; i < n; i++) name += d.pick(s.mid);
  name += d.pick(s.end);
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/** A name for a person of this office, not one in `taken` (a run's names are all different). */
export function personName(d: Dice, role: FolkRole, taken: ReadonlySet<string> = new Set()): string {
  const s = SOUNDS[role];
  for (let tries = 0; tries < 40; tries++) {
    const name = one(d, s);
    if (name.length >= 3 && name.length <= 9 && !/[^aeiouy]{4}/i.test(name) && !taken.has(name)) return name;
  }
  return one(d, s) + 'ia'; // never reached in practice; keeps the function total
}
