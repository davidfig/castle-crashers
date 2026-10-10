// Contact sheet of randomly generated monsters, for looking at the sprite composer (src/render/monsterArt.ts).
//   (--bestiary SEED [--from N] draws the real generated cast of that run seed instead of random looks.)
//   node tools/monster-sheet.mjs --seed 1 --count 40 --scale 4 --out sheet.png [--boss] [--poses [N]] [--cols N] [--size N]
// Each monster is drawn standing (walk_0) on a rotating set of backdrops (green, sand, dark purple, white) so the outline is checked
// against all of them. --poses adds, under the grid, one row per monster of every frame of every anim (the first N monsters, default 3).
import * as esbuild from 'esbuild';
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true; };
const seed = Number(opt('seed', 1)), count = Number(opt('count', 40)), scale = Number(opt('scale', 4));
const boss = !!opt('boss', false);
const poses = opt('poses', false);
const poseN = poses === true ? 3 : Number(poses || 0);
const out = resolve(String(opt('out', '/private/tmp/claude-501/-Users-davidfig-Programming-castle-crashers/8042f084-3b70-4da1-89bf-c4459861bcbf/scratchpad/monsters.png')));
const forcedSize = opt('size', false) ? Number(opt('size', 0)) : undefined;
const lookJson = opt('look', false);

// bundle the composer for node
const built = await esbuild.build({
  stdin: { contents: "export * from './src/render/monsterArt.ts'; export * from './src/render/monsterLookRandom.ts'; export { generateBestiary } from './src/data/bestiary/index.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'node20', logLevel: 'warning', define: { __DEV__: 'true' },
});
const { composeMonster, randomLook, generateBestiary } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

// ---- tiny PNG encoder
const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const BG = [0x5b8a4a, 0xc9b27c, 0x2a2040, 0xe8e4dc];
class Img {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = ((y + j) * this.w + x + i) * 4; this.d[o] = c >> 16; this.d[o + 1] = (c >> 8) & 255; this.d[o + 2] = c & 255; this.d[o + 3] = 255; } }
  /** Draw a sheet rect at integer scale, bottom-centre anchored at (ax, ay). */
  sprite(sheet, f, ax, ay, s) {
    const x0 = ax - Math.floor((f.w * s) / 2), y0 = ay - f.h * s;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const si = ((f.y + y) * sheet.width + f.x + x) * 4;
      if (sheet.rgba[si + 3] === 0) continue;
      for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
        const X = x0 + x * s + i, Y = y0 + y * s + j;
        if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue;
        const o = (Y * this.w + X) * 4;
        this.d[o] = sheet.rgba[si]; this.d[o + 1] = sheet.rgba[si + 1]; this.d[o + 2] = sheet.rgba[si + 2]; this.d[o + 3] = 255;
      }
    }
  }
}

const looks = [], sheets = [];
const bestiary = opt('bestiary', false) ? generateBestiary(Number(opt('bestiary', 1))) : null;
for (let i = 0; i < count; i++) {
  const look = bestiary ? bestiary.looks[(i + Number(opt('from', 0))) % bestiary.looks.length] : lookJson ? JSON.parse(String(lookJson)) : randomLook(seed * 1000 + i, { boss, size: forcedSize });
  looks.push(look); sheets.push(composeMonster(look));
}
const cells = sheets.map((s) => { const f = s.meta.frames.walk_0; return { w: f.w, h: f.h }; });
const cw = Math.max(...cells.map((c) => c.w)) * scale + 8, ch = Math.max(...cells.map((c) => c.h)) * scale + 8;
const cols = Number(opt('cols', Math.min(count, Math.max(1, Math.floor(1400 / cw)))));
const rowsN = Math.ceil(count / cols);
// pose rows
const animOrder = ['walk', 'idle', 'hurt', 'dead', 'windup', 'strike', 'cast', 'aim', 'release', 'lit', 'paw', 'charge', 'dazed', 'rise', 'slam', 'roar', 'smash'];
const poseRows = [];
for (let i = 0; i < Math.min(poseN, count); i++) {
  const s = sheets[i];
  const names = animOrder.flatMap((a) => (s.meta.anims[a] ? s.meta.anims[a].frames : []));
  for (let k = 0; k < names.length; k += 12) poseRows.push({ s, names: names.slice(k, k + 12) });
}
const pf = (r) => r.s.meta.frames[r.names[0]];
const poseH = poseRows.length ? Math.max(...poseRows.map((r) => pf(r).h)) * scale + 8 : 0;
const poseWmax = poseRows.length ? Math.max(...poseRows.map((r) => r.names.length * (pf(r).w * scale + 6))) : 0;
const W = Math.max(cols * cw, poseWmax), H = rowsN * ch + poseRows.length * poseH;
const img = new Img(W, H);
for (let i = 0; i < count; i++) {
  const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
  img.rect(x, y, cw, ch, BG[i % 4]);
  img.sprite(sheets[i], sheets[i].meta.frames.walk_0, x + cw / 2, y + ch - 4, scale);
}
poseRows.forEach((r, k) => {
  const y = rowsN * ch + k * poseH;
  img.rect(0, y, W, poseH, BG[k % 4 === 0 ? 2 : k % 4]);
  const f0 = pf(r), step = f0.w * scale + 6;
  r.names.forEach((n, j) => img.sprite(r.s, r.s.meta.frames[n], j * step + step / 2, y + poseH - 4, scale));
});
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png(W, H, img.d));
const areas = sheets.map((s) => s.width * s.height);
console.log(`${out}  ${W}x${H}  sheets: max area ${Math.max(...areas)}, mean ${Math.round(areas.reduce((a, b) => a + b, 0) / areas.length)}`);
