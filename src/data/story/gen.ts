// A small text-grammar for generated dialogue: `{slot}` in a template is filled from a word list, once per conversation, so a slot
// that appears in several lines names the same thing in all of them. `{slot+}` is its plural. Pure and seeded; nothing here
// touches the sim. Word lists are plain ASCII (the story font draws no accents or curly quotes).
import { createRng, rngInt, Stream, type Rng } from '../../engine/rng';
import { PLACES } from './clan';

/** [singular, plural] */
type Word = readonly [string, string];
const w = (s: string, p = s + 's'): Word => [s, p];

export const WORDS: Readonly<Record<string, readonly Word[]>> = {
  food: [w('porridge'), w('turnip stew'), w('plum jam'), w('barley bread'), w('onion soup'), w('honey cake'), w('fried eel'), w('pea pottage'), w('blackberry tart'), w('smoked cheese'), w('oat biscuit'), w('mushroom pie')],
  beast: [w('goose', 'geese'), w('goat'), w('hen'), w('mule'), w('pig'), w('duck'), w('sheep', 'sheep'), w('cat'), w('bull'), w('donkey', 'donkeys'), w('rooster'), w('pony', 'ponies')],
  thing: [w('ladle'), w('lantern'), w('bucket'), w('kettle'), w('ladder'), w('wheelbarrow'), w('bell'), w('broom'), w('spindle'), w('sieve'), w('hat'), w('cooking pot')],
  num: [w('eleven'), w('fourteen'), w('nineteen'), w('twenty-three'), w('thirty-seven'), w('forty-four'), w('fifty-two'), w('sixty-one'), w('seventy-eight'), w('ninety-six')],
  day: [w('Monday'), w('Tuesday'), w('Wednesday'), w('Thursday'), w('Friday'), w('Saturday'), w('Sunday')],
  weather: [w('drizzle'), w('fog'), w('wind'), w('dust'), w('heat'), w('frost'), w('mud')],
  name: [w('Tamsin'), w('Hobb'), w('Pell'), w('Brannoch'), w('Wick'), w('Marta'), w('Odo'), w('Jessa'), w('Corrin'), w('Bim'), w('Dunstan'), w('Ysolde')],
  place: PLACES.map((p) => w(p)),
};

/** Distinct second name for `{name2}` etc.: a slot ending in a digit draws from the same list but never repeats a value already used. */
export function fill(template: string, r: Rng, used: Map<string, Word>): string {
  return template.replace(/\{([a-z]+)(\d?)(\+?)\}/g, (_m, key: string, idx: string, plural: string, at: number) => {
    const slot = key + idx;
    let word = used.get(slot);
    if (!word) {
      const list = WORDS[key];
      if (!list) throw new Error(`unknown slot {${key}} in "${template}"`);
      const taken = new Set([...used.entries()].filter(([k]) => k.startsWith(key)).map(([, v]) => v[0]));
      const free = list.filter((x) => !taken.has(x[0]));
      word = free[rngInt(r, free.length)];
      used.set(slot, word);
    }
    const text = plural ? word[1] : word[0];
    return at === 0 || /[.!?] $/.test(template.slice(Math.max(0, at - 2), at)) ? cap(text) : text;
  });
}

/** A seeded stream for generated dialogue, independent of every sim stream. The seed and salt are mixed hard first, so neighbouring values (hearing 1, hearing 2...) give unrelated conversations. */
export function genRng(seed: number, salt: number): Rng {
  let h = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  const r = createRng(h, Stream.story);
  rngInt(r, 2); rngInt(r, 2);
  return r;
}

export function choose<T>(r: Rng, a: readonly T[]): T {
  return a[rngInt(r, a.length)];
}

/** Capitalise the first letter (for a slot that opens a sentence). */
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
