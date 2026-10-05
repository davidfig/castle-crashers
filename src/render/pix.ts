// Small shared helpers for the procedural sprite builders (pixel buffers and cosmetic noise).

export type Pix = { w: number; h: number; rgba: Uint8ClampedArray; /** Torch positions, and lit windows (those have a size), baked into the strip; the light itself is drawn live so it can flicker. */ lights?: { x: number; y: number; w?: number; h?: number }[] };

export function setPix(p: Pix, x: number, y: number, c: number): void {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
  const o = (y * p.w + x) * 4;
  p.rgba[o] = (c >> 16) & 255; p.rgba[o + 1] = (c >> 8) & 255; p.rgba[o + 2] = c & 255; p.rgba[o + 3] = 255;
}

// Small deterministic hash for cosmetic noise (not the sim RNG).
export function hash2(x: number, y: number, s = 0): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function darken(rgb: number, k: number): number {
  const r = Math.round(((rgb >> 16) & 255) * k), g = Math.round(((rgb >> 8) & 255) * k), b = Math.round((rgb & 255) * k);
  return (r << 16) | (g << 8) | b;
}

export function makeEllipse(w: number, h: number): { w: number; h: number; rgba: Uint8ClampedArray } {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2);
      if (dx * dx + dy * dy <= 1) rgba[(y * w + x) * 4 + 3] = 255;
    }
  }
  return { w, h, rgba };
}

/** White copy of a sprite's silhouette (tinted when drawn, to haze it into the sky). */
export function silhouette(src: Pix): Pix {
  const p: Pix = { w: src.w, h: src.h, rgba: new Uint8ClampedArray(src.rgba.length) };
  for (let i = 0; i < src.rgba.length; i += 4) if (src.rgba[i + 3] > 0) p.rgba.fill(255, i, i + 4);
  return p;
}
