// Contact sheet of generated people, for looking at the sprite composer (src/render/humanArt.ts).
//   node tools/folk-sheet.mjs --seeds 1,2,3 --scale 6 --out folk.png [--anim idle|talk] [--frames] [--extra N]
// One row per seed: the six story figures (registrar, peddler, king, herald, captain, elder), each on a rotating backdrop so the outline
// is checked against green, sand, dark and white. --extra N adds N commoners per seed. --frames draws every frame of the first seed's figures.
import * as esbuild from 'esbuild';
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true; };
const seeds = String(opt('seeds', '1,2,3,4')).split(',').map(Number);
const scale = Number(opt('scale', 6));
const anim = String(opt('anim', 'idle'));
const extra = Number(opt('extra', 0));
const frames = !!opt('frames', false);
const out = resolve(String(opt('out', 'folk.png')));

const built = await esbuild.build({
  stdin: { contents: "export { composeHuman } from './src/render/humanArt.ts'; export { generateFolk, generatePerson } from './src/data/humans/index.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'node20', logLevel: 'warning', define: { __DEV__: 'true' },
});
const { composeHuman, generateFolk, generatePerson } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

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

const rows = [];
for (const seed of seeds) {
  const folk = generateFolk(seed);
  const sheets = Object.values(folk.looks).map((l) => composeHuman(l));
  for (let i = 0; i < extra; i++) sheets.push(composeHuman(generatePerson(seed, 'commoner', i)));
  rows.push(sheets);
}
const CW = 46, CH = 40;
const cols = Math.max(...rows.map((r) => r.length));
const nFrames = frames ? 8 : 1;
const W = cols * CW * scale, H = (rows.length * (frames ? 1 : 1) + (frames ? 8 : 0)) * CH * scale;
const px = new Uint8ClampedArray(W * H * 4);
const fill = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y + j) * W + x + i) * 4; px[o] = c >> 16; px[o + 1] = (c >> 8) & 255; px[o + 2] = c & 255; px[o + 3] = 255; } };
function draw(sheet, fname, cellX, cellY) {
  const f = sheet.frames[fname];
  const ax = cellX + (CW * scale >> 1), ay = cellY + (CH - 4) * scale; // feet
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const si = ((f.y + y) * sheet.width + f.x + x) * 4;
    if (sheet.rgba[si + 3] === 0) continue;
    for (let j = 0; j < scale; j++) for (let i = 0; i < scale; i++) {
      const X = ax + (x - sheet.pivot[0]) * scale + i, Y = ay + (y - sheet.pivot[1]) * scale + j;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const o = (Y * W + X) * 4;
      px[o] = sheet.rgba[si]; px[o + 1] = sheet.rgba[si + 1]; px[o + 2] = sheet.rgba[si + 2]; px[o + 3] = 255;
    }
  }
}
if (frames) {
  rows[0].forEach((sh, c) => {
    for (let k = 0; k < 8; k++) { const a = k < 4 ? 'idle' : 'talk'; fill(c * CW * scale, k * CH * scale, CW * scale, CH * scale, BG[(c + k) % 4]); draw(sh, `${a}_${k % 4}`, c * CW * scale, k * CH * scale); }
  });
} else {
  rows.forEach((r, ri) => r.forEach((sh, c) => { fill(c * CW * scale, ri * CH * scale, CW * scale, CH * scale, BG[(c + ri) % 4]); draw(sh, `${anim}_0`, c * CW * scale, ri * CH * scale); }));
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png(W, H, px));
console.log('wrote', out, `${W}x${H}`, 'cell', rows[0][0].cell);
