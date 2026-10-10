// Contact sheet of a run's generated scenery, for looking at the painter (src/render/sceneryArt.ts) without starting the game.
//   node tools/scenery-sheet.mjs --seed 1 --biome 0 [--archetype 2] [--scale 3] [--out sheet.png] [--strips 3]
// --biome N draws the world's N-th biome (a world has one per stage of the road; --archetype A makes biome 0 that archetype instead:
// 0 Meadow, 1 Haunted Keep, 2 Frozen Pass, 3 Sunken Marsh, 4 Scorched Dunes). Shows the parallax strips (the first --strips variants of each,
// over the day's horizon colour), the floor tiles, the ground decals and the patches, all at --scale.
import * as esbuild from 'esbuild';
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true; };
const seed = Number(opt('seed', 1)), biome = Number(opt('biome', 0)), scale = Number(opt('scale', 3)), nStrips = Number(opt('strips', 3));
const arch = opt('archetype', false);
const out = resolve(String(opt('out', '.tmp/scenery.png')));

const built = await esbuild.build({
  stdin: { contents: "export { generateWorld } from './src/data/scenery/world.ts'; export { paintBiome } from './src/render/sceneryArt.ts'; export { moodAt, makeBlendedMood } from './src/data/biomes.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'node20', logLevel: 'warning', define: { __DEV__: 'true' },
});
const { generateWorld, paintBiome, moodAt, makeBlendedMood } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

const STAGE = 3 * (2160 + 1100);
const archetypes = arch === false ? [0, 1, 2, 3, 4] : [Number(arch), 1, 2, 3, 4];
const world = generateWorld(seed, archetypes, STAGE);
const g = world.biomes[biome];
const t0 = performance.now();
const p = paintBiome(g);
console.log(`${g.def.name} (seed ${seed}, tone hue ${g.recipe.tone.hue.toFixed(2)}) painted in ${(performance.now() - t0).toFixed(0)} ms`);

const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const mood = moodAt(g.def, 0.28, makeBlendedMood());
const sky = mood.sky[mood.sky.length - 1], ground = 0x5a7a4a;
const W = 256 * nStrips * 1 + 16;
// layout
const rows = [];
let H = 8;
const place = (items, sc, bg, gap = 4, maxW = W) => {
  // shelf-pack scaled items into rows under the current H
  let x = 8, rowH = 0, y = H;
  const placed = [];
  for (const it of items) {
    const w = it.pix.w * sc, h = it.pix.h * sc;
    if (x + w > maxW) { x = 8; y += rowH + gap; rowH = 0; }
    placed.push({ it, x, y, sc });
    x += w + gap; rowH = Math.max(rowH, h);
  }
  const top = H, bottom = y + rowH;
  rows.push({ placed, bg, top, bottom });
  H = bottom + 10;
};
const strips = []; for (const [k, list] of Object.entries(p.layers)) list.slice(0, nStrips).forEach((pix) => strips.push({ pix }));
place(strips, 1, sky);
place(Object.values(p.ground).flat().map((pix) => ({ pix })), scale + 1, ground);
place(Object.values(p.decor).map((pix) => ({ pix })), scale + 1, ground, 6);
place(Object.values(p.patch).map((pix) => ({ pix })), scale, ground, 6);
const img = new Uint8ClampedArray(W * H * 4);
const fill = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { if (x + i < 0 || x + i >= W || y + j < 0 || y + j >= H) continue; const o = ((y + j) * W + x + i) * 4; img[o] = c >> 16; img[o + 1] = (c >> 8) & 255; img[o + 2] = c & 255; img[o + 3] = 255; } };
fill(0, 0, W, H, 0x101010);
for (const r of rows) {
  fill(0, r.top - 4, W, r.bottom - r.top + 8, r.bg);
  for (const { it, x, y, sc } of r.placed) {
    const { w, h, rgba } = it.pix;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const si = (yy * w + xx) * 4;
      if (rgba[si + 3] === 0) continue;
      fill(x + xx * sc, y + yy * sc, sc, sc, (rgba[si] << 16) | (rgba[si + 1] << 8) | rgba[si + 2]);
    }
  }
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png(W, H, img));
console.log(`wrote ${out} (${W}x${H})`);
