// The UI kit's drawing helpers (docs/13-ui-art.md). Screens call these, not rectangles, so the look lives in one place.
import { glyphWidth, GLYPH_H, storySafe } from '../data/storyFont';
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import type { Sprites } from './art';
import { npcFrame, type NpcName } from './npcArt';
import { GLASS } from './uiArt';

/** Rarity border colours: common, uncommon, rare, epic, legendary. */
export const RARITY = [GLASS.Z, GLASS.m, GLASS.c, GLASS.q, GLASS.G] as const;

/** Text colours on a vellum page, by tone; on ink they are the lighter set in menu.ts. */
export const PAGE_TONE = { normal: GLASS.lead, dim: 0x6a5a7a, gold: 0x8a5a10, red: GLASS.r } as const;

/** Draws story text (mixed case, punctuation) at 1x or more. Returns its width in pixels. */
export function drawStory(b: Batcher, S: Sprites, text: string, x: number, y: number, color: number, scale = 1, shadow: number | null = null): number {
  const safe = storySafe(text);
  for (let pass = shadow === null ? 1 : 0; pass < 2; pass++) {
    let cx = x;
    for (const ch of safe) {
      const f = S.ui.story[ch];
      if (f) {
        if (pass === 0) b.drawScaled(f, cx + scale, y + scale, f.w * scale, f.h * scale, hex(shadow!, 0.6));
        else b.drawScaled(f, cx, y, f.w * scale, f.h * scale, hex(color));
      }
      cx += (glyphWidth(ch) + 1) * scale;
    }
  }
  let w = 0;
  for (const ch of safe) w += glyphWidth(ch) + 1;
  return Math.max(0, w - 1) * scale;
}

export { GLYPH_H };

export interface PanelStyle {
  /** 'ink' for things chosen, 'vellum' for things read. */
  fill?: 'ink' | 'vellum';
  /** Outline colour, e.g. a player's colour; defaults to lead. */
  accent?: number;
  /** Draw the four gold corner flourishes. */
  ornaments?: boolean;
}

/** A panel: a coloured outline, a fill, a gold inner rule and (optionally) corner flourishes. */
export function drawPanel(b: Batcher, S: Sprites, x: number, y: number, w: number, h: number, st: PanelStyle = {}): void {
  const vellum = st.fill === 'vellum';
  b.drawScaled(S.px, x, y, w, h, hex(st.accent ?? GLASS.lead));
  b.drawScaled(S.px, x + 1, y + 1, w - 2, h - 2, hex(vellum ? GLASS.W : GLASS.ink));
  const rule = hex(vellum ? GLASS.g : GLASS.g);
  // the gold inner rule, inset 3 px
  b.drawScaled(S.px, x + 3, y + 3, w - 6, 1, rule);
  b.drawScaled(S.px, x + 3, y + h - 4, w - 6, 1, rule);
  b.drawScaled(S.px, x + 3, y + 3, 1, h - 6, rule);
  b.drawScaled(S.px, x + w - 4, y + 3, 1, h - 6, rule);
  if (st.ornaments !== false && w >= 24 && h >= 24) {
    const c = S.ui.corner;
    b.draw(c[0], x + 2, y + 2);
    b.draw(c[1], x + w - 2 - c[1].w, y + 2);
    b.draw(c[2], x + 2, y + h - 2 - c[2].h);
    b.draw(c[3], x + w - 2 - c[3].w, y + h - 2 - c[3].h);
  }
}

/** A card: a rarity-coloured border around an ink face; `lit` brightens it (a cursor is on it). */
export function drawCard(b: Batcher, S: Sprites, x: number, y: number, w: number, h: number, rarity = 0, lit = false): void {
  b.drawScaled(S.px, x, y, w, h, hex(GLASS.lead));
  b.drawScaled(S.px, x + 1, y + 1, w - 2, h - 2, hex(RARITY[rarity]));
  b.drawScaled(S.px, x + 2, y + 2, w - 4, h - 4, hex(lit ? 0x2f2a66 : GLASS.ink));
}

export function drawIcon(b: Batcher, S: Sprites, name: string, x: number, y: number, scale = 1): void {
  const f = S.ui.icons[name];
  if (f) b.drawScaled(f, x, y, f.w * scale, f.h * scale);
}

export function drawCursor(b: Batcher, S: Sprites, x: number, y: number, tint = 0xffffffff): void {
  b.draw(S.ui.cursor, x, y, false, tint);
}

/** A gold rule with a diamond in the middle. */
export function drawDivider(b: Batcher, S: Sprites, x: number, y: number, w: number): void {
  const mid = Math.round(x + w / 2);
  b.drawScaled(S.px, x, y + 1, w, 1, hex(GLASS.g));
  b.drawScaled(S.px, mid - 2, y, 5, 3, hex(GLASS.G));
  b.drawScaled(S.px, mid - 1, y - 1, 3, 5, hex(GLASS.Y));
}

/** A story figure (the Registrar, the peddler) standing with their feet at (x, y), pixel-scaled by a whole number. */
export function drawNpc(b: Batcher, S: Sprites, name: NpcName, x: number, y: number, scale: number, talking: boolean, tick: number): void {
  const set = S.npcs[name];
  const a = set.anims[talking ? 'talk' : 'idle'] ?? set.anims.idle;
  const f = npcFrame(a, (tick * 1000) / 60);
  b.drawScaled(S.px, x - 8 * scale, y - scale, 16 * scale, 2 * scale, hex(0x000000, 0.3)); // a shadow on the floor
  b.drawScaled(f, x - set.pivotX * scale, y - set.pivotY * scale, f.w * scale, f.h * scale);
}
