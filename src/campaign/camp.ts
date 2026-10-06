// The camp between levels (docs/07-procgen.md): what its screens say. The one place in a run where the action stops.
// In order: the spoils, the picks a player did not make in the level, and the doors. Pure view-building, no drawing.
import { CLASSES } from '../data/classes';
import { chapterDef } from '../data/story/chapters';
import { OFFER_SIZE, offerFor, UPGRADES } from '../data/upgrades';
import { merchantLine } from '../data/story/hub';
import { WARES, type StockItem } from '../data/wares';
import type { Carry } from '../sim/carry';
import type { GameState } from '../sim/state';
import type { Door } from './route';
import { storySafe } from '../data/storyFont';
import { fontSafe, type Line, type PickLane, type Screen, type Tone } from './view';

const ln = (text: string, tone: Tone = 'normal'): Line => ({ text: storySafe(text), tone });
const sum = (a: ArrayLike<number>): number => { let t = 0; for (let i = 0; i < a.length; i++) t += a[i]; return t; };

export function routeStrip(level: number, total: number): string {
  return `LEVEL ${level + 1} OF ${total}`;
}

/** The spoils: what the level was worth. `before` is the carry the level started with, if it was not the first. */
export function spoilsScreen(chapter: number, now: Carry, before: Carry | undefined, level: number, total: number): Screen {
  const lex = chapterDef(chapter).lexicon;
  const heads = now.kills - (before?.kills ?? 0);
  const spared = sum(now.spared) - (before ? sum(before.spared) : 0);
  const body: Line[] = [
    ln(routeStrip(level, total), 'dim'),
    ln(`${lex.tally}: ${heads}`, 'gold'),
    ln(`Gold: ${now.gold}`),
  ];
  if (spared > 0) body.push(ln(`Spared: ${spared}`, 'gold'));
  if (now.betrayed - (before?.betrayed ?? 0) > 0) body.push(ln(`${now.betrayed - (before?.betrayed ?? 0)} had surrendered. They were killed anyway.`, 'red'));
  body.push(ln(''));
  now.players.forEach((p, k) => {
    if (!p) return;
    const cls = CLASSES[p.classId].name;
    body.push(ln(`P${k + 1} ${cls[0].toUpperCase()}${cls.slice(1)}: level ${p.level}${p.pending > 0 ? `   ${p.pending} pick${p.pending > 1 ? 's' : ''} waiting` : ''}`, p.pending > 0 ? 'gold' : 'normal'));
  });
  body.push(ln(''), ln('The party rests by the fire. Everyone is on their feet.', 'dim'));
  return { kind: 'text', header: 'LEVEL CLEARED', body, footer: 'ATTACK TO CONTINUE' };
}

/** Picks nobody made during the level, resolved here with nothing at stake. Each player works their own panel. */
export function pickLanes(sim: GameState, ready: readonly boolean[]): PickLane[] {
  return sim.players.map((p, slot) => {
    if (!p.active) return { active: false, slot, name: '', level: 0, pending: 0, ready: false, cursor: 0, cards: [] };
    const cards = p.pending > 0
      ? offerFor(sim.offerSeed, slot, p.level - p.pending + 1, p.ranks).slice(0, OFFER_SIZE).map((u) => ({ name: UPGRADES[u].name, text: [...UPGRADES[u].text], rank: p.ranks[u], icon: UPGRADES[u].icon }))
      : [];
    return { active: true, slot, name: CLASSES[p.classId].name.toUpperCase(), level: p.level, pending: p.pending, ready: p.pending === 0 || ready[slot], cursor: p.cursor, cards };
  });
}

export function picksScreen(sim: GameState, ready: readonly boolean[], level: number, total: number): Screen {
  return {
    kind: 'picks',
    header: 'LEVEL UPS',
    sub: routeStrip(level, total),
    lanes: pickLanes(sim, ready),
    footer: 'STICK MOVES    ATTACK OR DASH PICKS    LEVEL BUTTON KEEPS FOR LATER',
  };
}

export function shopScreen(sim: GameState, stock: readonly StockItem[], sold: readonly boolean[], cursors: readonly number[], ready: readonly boolean[], chapter: number, note: string): Screen {
  return {
    kind: 'shop',
    header: 'THE MERCHANT',
    sub: storySafe(merchantLine(sim.offerSeed, chapter)),
    gold: sim.gold,
    rows: stock.map((it, i) => ({ name: fontSafe(WARES[it.ware].name), text: WARES[it.ware].text.map(fontSafe), price: it.price, sold: sold[i], afford: sim.gold >= it.price, icon: WARES[it.ware].icon })),
    seats: sim.players.map((p, slot) => ({ active: p.active, slot, name: p.active ? CLASSES[p.classId].name.toUpperCase() : '', ready: ready[slot], cursor: cursors[slot] })),
    note: fontSafe(note),
    footer: 'UP/DOWN LOOK    ATTACK BUY    LEVEL BUTTON WHEN DONE',
    figure: { name: 'peddler', talking: note !== '' },
  };
}

export function doorsScreen(doors: readonly Door[], sel: number, level: number, total: number): Screen {
  return {
    kind: 'doors',
    header: 'THE ROAD AHEAD',
    sub: `${routeStrip(level, total)}   CHOOSE THE NEXT ROAD`,
    doors: doors.map((d) => ({ biome: d.biome, label: fontSafe(d.label), tag: fontSafe(d.tag), icon: 'swords' })),
    sel,
    footer: 'LEFT/RIGHT CHOOSE    ATTACK GO',
  };
}
