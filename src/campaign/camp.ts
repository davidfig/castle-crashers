// The store between levels (docs/07-procgen.md, "The store"): what the peddler's counter says. Pure view-building, no drawing.
import { CLASSES } from '../data/classes';
import { merchantLine } from '../data/story/hub';
import { WARES, type StockItem } from '../data/wares';
import type { GameState } from '../sim/state';
import { storySafe } from '../data/storyFont';
import { fontSafe, type Screen } from './view';

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
