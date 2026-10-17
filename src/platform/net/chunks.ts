// The sim's snapshot is about 80 KB of text and the relay passes at most 64 KB a message, so it travels in pieces.

/** Characters per piece: well under the relay's cap, with room for the envelope. */
export const CHUNK = 40_000;

export function split(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK) out.push(text.slice(i, i + CHUNK));
  return out.length ? out : [''];
}

/** Collects the pieces of one snapshot (`n` is the tick it was taken at). A piece of a newer snapshot starts it over. */
export class Assembler {
  private n = -1;
  private parts: (string | undefined)[] = [];
  private got = 0;

  /** The whole text once the last piece is in, else null. */
  add(n: number, i: number, of: number, s: string): string | null {
    if (n !== this.n || this.parts.length !== of) { this.n = n; this.parts = new Array(of); this.got = 0; }
    if (i < 0 || i >= of || this.parts[i] !== undefined) return null;
    this.parts[i] = s;
    if (++this.got < of) return null;
    const text = this.parts.join('');
    this.parts = [];
    this.n = -1;
    return text;
  }
}
