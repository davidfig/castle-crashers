// Contact sheet of generated player characters, for looking at the sprite composer (src/render/heroArt.ts).
//   node tools/hero-sheet.mjs --seeds 1,2 --scale 6 --out heroes.png [--anim idle|walk|sweep|finisher|recover|cast|shoot|hurt|down] [--frame N] [--class warrior]
// One block per seed: a row per player slot (P1..P4), a column per class (warrior, mage, cleric, rogue, archer, shaman), each on a rotating
// backdrop so the outline is checked against green, sand, dark and white. --class draws every frame of that class's anim instead: a row per slot.
import * as esbuild from 'esbuild';
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true; };
const seeds = String(opt('seeds', '1,2')).split(',').map(Number);
const scale = Number(opt('scale', 6));
const anim = String(opt('anim', 'idle'));
const frameNo = Number(opt('frame', 0));
const only = opt('class', null);
const out = resolve(String(opt('out', 'heroes.png')));

const built = await esbuild.build({
  stdin: { contents: "export { composeHero } from './src/render/heroArt.ts'; export { generateParty } from './src/data/heroes/index.ts'; export { HERO_CLASS_NAMES } from './src/data/heroLook.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'node20', logLevel: 'warning', define: { __DEV__: 'true' },
});
const { composeHero, generateParty, HERO_CLASS_NAMES } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const BG = [0x5b8a4a, 0xc9b27c, 0x2a2040, 0xe8e4dc];

// every sheet of every seed, then lay the cells out
const blocks = seeds.map((seed) => {
  const party = generateParty(seed);
  return party.looks.map((row) => row.map((look) => composeHero(look)));
});
const CW = 48, CH = 44;
const cells = []; // { sheet, name }
let cols = 0;
if (only) {
  const ci = HERO_CLASS_NAMES.indexOf(only);
  const n = blocks[0][0][ci].anims[anim].frames.length;
  cols = n;
  for (const b of blocks) for (const row of b) { const sh = row[ci]; cells.push(sh.anims[anim].frames.map((f) => ({ sh, f }))); }
} else {
  cols = HERO_CLASS_NAMES.length;
  for (const b of blocks) for (const row of b) cells.push(row.map((sh) => ({ sh, f: sh.anims[anim].frames[Math.min(frameNo, sh.anims[anim].frames.length - 1)] })));
}
const W = cols * CW * scale, H = cells.length * CH * scale;
const px = new Uint8ClampedArray(W * H * 4);
const fill = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y + j) * W + x + i) * 4; px[o] = c >> 16; px[o + 1] = (c >> 8) & 255; px[o + 2] = c & 255; px[o + 3] = 255; } };
function draw({ sh, f: fname }, cellX, cellY) {
  const f = sh.frames[fname];
  const ax = cellX + ((CW * scale) >> 1), ay = cellY + (CH - 6) * scale;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const si = ((f.y + y) * sh.width + f.x + x) * 4;
    if (sh.rgba[si + 3] === 0) continue;
    for (let j = 0; j < scale; j++) for (let i = 0; i < scale; i++) {
      const X = ax + (x - sh.pivot[0]) * scale + i, Y = ay + (y - sh.pivot[1]) * scale + j;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const o = (Y * W + X) * 4;
      px[o] = sh.rgba[si]; px[o + 1] = sh.rgba[si + 1]; px[o + 2] = sh.rgba[si + 2]; px[o + 3] = 255;
    }
  }
}
cells.forEach((row, r) => row.forEach((cell, c) => { fill(c * CW * scale, r * CH * scale, CW * scale, CH * scale, BG[(c + r) % 4]); draw(cell, c * CW * scale, r * CH * scale); }));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png(W, H, px));
const s0 = blocks[0][0][0];
console.log('wrote', out, `${W}x${H}`, 'sheet', s0.width + 'x' + s0.height, 'pivot', s0.pivot, 'top', blocks[0][0].map((s) => s.top).join(','));
