// Things that stand on the field (a stall, a signpost, a banner, a chest, a totem, a road scene's figures): drawn among the characters in
// depth order, by where each touches the ground, so a hero walking behind a signpost is hidden by it and one walking in front hides it.
// Each frame the parts of the scene that stand are gathered here (`push`), sorted by their ground y, and merged into the characters'
// own depth order (draw.ts). What lies flat on the ground (shadows, glows, rings) is drawn before, and the panels and hints that must
// always be read are drawn after.

/** One standing thing: the field y where it touches the ground, and how to draw it. */
export interface Standing { y: number; draw: () => void }

export class StandingList {
  private items: Standing[] = [];
  private n = 0;
  /** Index of the next one to draw (`drawUpTo`). */
  private next = 0;

  /** Starts a new frame. */
  clear(): void { this.n = 0; this.next = 0; }

  /** A thing standing with its feet at field y `y`. */
  push(y: number, draw: () => void): void {
    const it = this.items[this.n];
    if (it) { it.y = y; it.draw = draw; } else this.items[this.n] = { y, draw };
    this.n++;
  }

  /** Sorts them back to front (a stable insertion sort: a few dozen at most, and those pushed first stay behind at the same depth). */
  sort(): void {
    for (let i = 1; i < this.n; i++) {
      const it = this.items[i];
      let j = i - 1;
      while (j >= 0 && this.items[j].y > it.y) { this.items[j + 1] = this.items[j]; j--; }
      this.items[j + 1] = it;
    }
  }

  /** Draws every one not yet drawn that stands at or behind field y `y` (so a character at the same depth is in front of it). */
  drawUpTo(y: number): void {
    while (this.next < this.n && this.items[this.next].y <= y) this.items[this.next++].draw();
  }

  /** Draws the rest (those in front of every character). */
  drawRest(): void { this.drawUpTo(Infinity); }

  get length(): number { return this.n; }
}
