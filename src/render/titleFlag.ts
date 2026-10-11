// The banners on the title's keep: one pixel design (stripes, quarters, a cross... with a small emblem) rolled per title and flown from every
// pole, so the keep has a heraldry. Cells hold RGB colours, -1 for cut-away cloth.
export const FLAG_W = 16, FLAG_H = 11;
export interface Flag { w: number; h: number; cells: number[] }

const EMBLEMS = [
  ['..#..', '.###.', '#####', '.###.', '#...#'], // star
  ['..#..', '.###.', '#####', '.###.', '..#..'], // diamond
  ['..#..', '..#..', '#####', '..#..', '..#..'], // cross
  ['.###.', '#....', '#....', '#....', '.###.'], // crescent
  ['.###.', '#.#.#', '#####', '.###.', '.#.#.'], // skull
  ['.#.#.', '#####', '#####', '.###.', '..#..'], // heart
  ['..#..', '..#..', '..#..', '#####', '..#..'], // sword
  ['#.#.#', '#####', '.###.', '.###.', '.###.'], // tower
];
const FIELDS = [0xb02a2a, 0x2a4fb0, 0x2a8a4a, 0x7a2ab0, 0xc9a227, 0xd8d8e0, 0xd8702a, 0x1c2a44];
const PATTERNS: ((x: number, y: number) => boolean)[] = [
  () => false, // plain
  (x, y) => Math.floor(y / 4) % 2 === 1, // bars
  (x) => Math.floor(x / 4) % 2 === 1, // pales
  (x, y) => (x * FLAG_H) / FLAG_W < y, // split on the diagonal
  (x, y) => ((x + Math.abs(y - 5)) >> 2) % 2 === 1, // chevrons
  (x, y) => x < 1 || x >= FLAG_W - 1 || y < 1 || y >= FLAG_H - 1, // a border
  (x, y) => (x < FLAG_W / 2) !== (y < FLAG_H / 2), // quarters
  (x, y) => Math.abs(y - 5) <= 1 || (x >= 6 && x <= 8), // a cross
];

export function rollFlag(r: () => number): Flag {
  const pick = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)];
  const base = pick(FIELDS);
  const accent = pick(FIELDS.filter((c) => c !== base));
  const charge = base === 0xc9a227 || accent === 0xc9a227 ? 0xf4f0e0 : 0xf4d86a;
  const pat = pick(PATTERNS), emblem = r() < 0.8 ? pick(EMBLEMS) : null, ink = 0x14101c;
  const cells = new Array<number>(FLAG_W * FLAG_H);
  for (let y = 0; y < FLAG_H; y++) for (let x = 0; x < FLAG_W; x++) cells[y * FLAG_W + x] = pat(x, y) ? accent : base;
  if (emblem) {
    const ex = 5, ey = 3, on = (x: number, y: number): boolean => emblem[y - ey]?.[x - ex] === '#';
    for (let y = ey - 1; y <= ey + 5; y++) for (let x = ex - 1; x <= ex + 5; x++) {
      if (on(x, y)) cells[y * FLAG_W + x] = charge;
      else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) cells[y * FLAG_W + x] = ink; // an outline so it reads on any field
    }
  }
  if (r() < 0.5) { // a swallowtail
    for (let x = FLAG_W - 5; x < FLAG_W; x++) for (let y = 0; y < FLAG_H; y++) if (Math.abs(y - 5) <= (x - (FLAG_W - 5)) * 0.5) cells[y * FLAG_W + x] = -1;
  }
  return { w: FLAG_W, h: FLAG_H, cells };
}
