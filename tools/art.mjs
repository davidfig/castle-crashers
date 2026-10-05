// Sprite workbench builder. Reads art/chars/*.mjs (paper-doll rigs of hand-pixeled parts),
// composes every frame at integer offsets (no rotation, no resampling), and writes
// art/out/<name>[.variant].png + <name>.json. Zero dependencies (own PNG encoder).
//   node tools/art.mjs            build once
//   node tools/art.mjs --watch    (used by tools/art-dev.mjs)
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHARS = join(ROOT, 'art/chars');
const OUT = join(ROOT, 'art/out');

// ---------- PNG ----------
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii'); data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
export function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- compose ----------
const hexToRGB = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

function partPixels(def, name) {
  const rows = Array.isArray(def) ? def : def.rows;
  const w = Math.max(...rows.map((r) => r.length));
  for (const r of rows) if (r.length !== w) console.warn(`  ! ${name}: ragged row (${r.length} != ${w}): "${r}"`);
  return { w, h: rows.length, rows, ax: def.ax ?? 0, ay: def.ay ?? 0 };
}

/** Builds one sheet (one palette variant). Returns {w,h,rgba,frames,anims}. */
function buildSheet(def, pal, quiet) {
  const [cw, ch] = def.cell;
  const visibleNames = Object.keys(def.anims);
  // `derived` anims are generated from another frame (e.g. a corpse lying on its side) and get their own rows after the real ones.
  // A derived anim may name `fromFrame`, a frame that is in no animation (e.g. a standing pose with the weapon removed); it is
  // rendered into a hidden scratch row that is cut from the published sheet.
  const derivedNames = Object.keys(def.derived ?? {});
  const animsAll = { ...def.anims };
  for (const dn of derivedNames) if (def.derived[dn].fromFrame) animsAll['_src_' + dn] = { fps: 1, frames: [def.derived[dn].fromFrame] };
  const animNames = Object.keys(animsAll);
  const cols = Math.max(...animNames.map((a) => animsAll[a].frames.length));
  const visibleRows = visibleNames.length + derivedNames.length;
  const W = cols * cw, H = (animNames.length + derivedNames.length) * ch;
  const rgba = new Uint8ClampedArray(W * H * 4);
  const frames = {}, anims = {};
  const parts = {};
  for (const [n, rows] of Object.entries(def.parts)) parts[n] = partPixels(rows, n);
  const post = def.post ?? null;
  const clipped = new Set();
  let feet = -1;

  animNames.forEach((an, ri0) => {
    const ri = ri0 >= visibleNames.length ? ri0 + derivedNames.length : ri0;   // hidden scratch rows sit below the derived rows
    const a = animsAll[an];
    const ms = a.ms ?? a.frames.map(() => Math.round(1000 / a.fps));
    if (ms.length !== a.frames.length) throw new Error(`${def.name}: anim ${an} has ${a.frames.length} frames but ${ms.length} durations`);
    anims[an] = { fps: a.fps ?? Math.round(1000 / (ms.reduce((x, y) => x + y, 0) / ms.length)), loop: a.loop !== false, ms, frames: [] };
    a.frames.forEach((fname, ci) => {
      const fr = def.frames[fname];
      if (!fr) throw new Error(`${def.name}: anim ${an} references missing frame ${fname}`);
      const ox = ci * cw, oy = ri * ch;
      const grid = new Array(cw * ch).fill(null);
      const putc = (dx, dy, c) => {
        if (dx < 0 || dy < 0 || dx >= cw || dy >= ch) return;
        grid[dy * cw + dx] = c;
      };
      // fx entries only fill empty cells, so they read as sitting behind the character
      let behind = false;
      const putc2 = (dx, dy, c) => { if (dx < 0 || dy < 0 || dx >= cw || dy >= ch) return; if (grid[dy * cw + dx] === null) grid[dy * cw + dx] = c; };
      const draw = (entry) => {
        if (typeof entry === 'function') { entry(behind ? putc2 : putc); return; }
        const [pn, px, py, flip] = entry;
        const p = parts[pn];
        if (!p) throw new Error(`${def.name}: frame ${fname} references missing part ${pn}`);
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
          const c = p.rows[y][flip ? p.w - 1 - x : x];
          if (c === undefined || c === '.' || c === ' ') continue;
          const dx = px - (flip ? p.w - 1 - p.ax : p.ax) + x, dy = py - p.ay + y;
          if (dx < 0 || dy < 0 || dx >= cw || dy >= ch) { clipped.add(`${fname}:${pn}`); continue; }
          if (behind && grid[dy * cw + dx] !== null) continue;
          if (/^leg/.test(pn) && (an === 'idle' || an === 'walk')) feet = Math.max(feet, dy);
          grid[dy * cw + dx] = c;
        }
      };
      // fx entries (names starting "fx", or entries flagged) are drawn after the edge pass and get no rim/ink
      const isFx = (e) => Array.isArray(e) && typeof e[0] === 'string' && e[0].startsWith('fx');
      for (const e of fr) if (!isFx(e)) draw(e);
      if (post) {
        const solid = grid.map((c) => c !== null);
        const at = (x, y) => (x >= 0 && y >= 0 && x < cw && y < ch ? solid[y * cw + x] : false);
        const next = grid.slice();
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
          const i = y * cw + x;
          if (solid[i]) {
            const r = post.rim?.[grid[i]];
            if (r && (!at(x - 1, y) || !at(x, y - 1))) next[i] = r;
          } else if (post.ink && (post.all ? (at(x - 1, y) || at(x, y - 1) || at(x + 1, y) || at(x, y + 1)) : (at(x - 1, y) || at(x, y - 1)))) next[i] = post.ink;
        }
        for (let i = 0; i < grid.length; i++) grid[i] = next[i];
      }
      behind = true;
      for (const e of fr) if (isFx(e)) draw(e);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const c = grid[y * cw + x];
        if (c === null) continue;
        const col = pal[c];
        if (!col) { console.warn(`  ! ${def.name}: unknown palette char "${c}"`); continue; }
        const o = ((oy + y) * W + ox + x) * 4;
        const [r, g, b] = hexToRGB(col);
        rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
      }
      frames[`${an}_${ci}`] = { x: ox, y: oy, w: cw, h: ch };
      anims[an].frames.push(`${an}_${ci}`);
    });
  });
  // derived: 'lie' = rotate the source frame's figure 90 degrees clockwise (head to the right), lay it on the ground line, darken it
  // and spatter it with blood. Deterministic, so the sheet is stable between builds.
  derivedNames.forEach((dn, di) => {
    const d = def.derived[dn];
    const srcName = d.fromFrame ? `_src_${dn}_0` : d.from;
    const src = frames[srcName];
    if (!src) throw new Error(`${def.name}: derived ${dn} references missing frame ${srcName}`);
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (rgba[((src.y + y) * W + src.x + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;                       // figure bbox; lying it is bh wide and bw tall
    const oy = (visibleNames.length + di) * ch;
    const left = Math.round(cw / 2 - bh / 2), bottom = oy + ch - 1; // bottom row of the cell = the ground ink row, like the standing frames
    const hash = (a, b) => { let h = Math.imul(a, 374761393) + Math.imul(b, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const so = ((src.y + y0 + y) * W + src.x + x0 + x) * 4;
      if (!rgba[so + 3]) continue;
      const nx = left + (bh - 1 - y), ny = bottom - (bw - 1) + x;    // clockwise rotation
      const o = (ny * W + nx) * 4;
      const blood = hash(x + 7 * di, y) % 9 === 0;
      rgba[o] = blood ? 120 : rgba[so] * 0.86; rgba[o + 1] = blood ? 24 : rgba[so + 1] * 0.82; rgba[o + 2] = blood ? 24 : rgba[so + 2] * 0.82; rgba[o + 3] = 255;
    }
    // optional parts drawn on top of the lying figure (e.g. the dropped bow); [part, x, y] in cell coordinates, plain pixels
    for (const [pn, px, py] of d.after ?? []) {
      const p = parts[pn];
      if (!p) throw new Error(`${def.name}: derived ${dn} references missing part ${pn}`);
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
        const c = p.rows[y][x];
        if (c === undefined || c === '.' || c === ' ') continue;
        const dx = px - p.ax + x, dy = py - p.ay + y;
        if (dx < 0 || dy < 0 || dx >= cw || dy >= ch) continue;
        const col = pal[c]; if (!col) continue;
        const o = ((oy + dy) * W + dx) * 4; const [r, g, b] = hexToRGB(col);
        rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
      }
    }
    frames[`${dn}_0`] = { x: 0, y: oy, w: cw, h: ch };
    anims[dn] = { fps: 1, loop: false, ms: [1000], frames: [`${dn}_0`] };
  });
  for (const k of Object.keys(frames)) if (k.startsWith('_src_')) delete frames[k];
  for (const k of Object.keys(anims)) if (k.startsWith('_src_')) delete anims[k];
  if (clipped.size && !quiet) console.warn(`  ! ${def.name}: clipped by cell: ${[...clipped].join(', ')}`);
  const Hpub = visibleRows * ch;                                   // cut the scratch rows from the published image
  return { W, H: Hpub, rgba: rgba.slice(0, W * Hpub * 4), frames, anims, feet };
}

function upscale(w, h, rgba, k, bg) {
  const W = w * k, H = h * k, out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = ((y / k | 0) * w + (x / k | 0)) * 4, o = (y * W + x) * 4;
    const a = rgba[i + 3] ? 1 : 0;
    // checker-free flat background; cell grid lines are drawn by the viewer, not here
    for (let c = 0; c < 3; c++) out[o + c] = a ? rgba[i + c] : bg[c];
    out[o + 3] = 255;
  }
  return { W, H, out };
}

export async function build() {
  mkdirSync(OUT, { recursive: true });
  const files = readdirSync(CHARS).filter((f) => f.endsWith('.mjs')).sort();
  const index = [];
  for (const f of files) {
    const def = (await import(pathToFileURL(join(CHARS, f)).href + `?t=${Date.now()}`)).default;
    const variants = def.variants ?? [{ id: 'base', palette: {} }];
    let meta;
    variants.forEach((v, i) => {
      const pal = { ...def.palette, ...v.palette };
      const sheet = buildSheet(def, pal, i > 0);
      const file = i === 0 ? `${def.name}.png` : `${def.name}.${v.id}.png`;
      writeFileSync(join(OUT, file), encodePNG(sheet.W, sheet.H, sheet.rgba));
      if (process.env.ART_PREVIEW && i === 0) {
        const k = Number(process.env.ART_SCALE) || 6;
        const up = upscale(sheet.W, sheet.H, sheet.rgba, k, [0x5a, 0x5f, 0x6a]);
        writeFileSync(join(process.env.ART_PREVIEW, `${def.name}.png`), encodePNG(up.W, up.H, up.out));
      }
      if (i === 0 && sheet.feet >= 0 && def.pivot[1] !== sheet.feet) {
        // The ground line comes from the lowest sole of the `leg*` parts in idle/walk, never typed by hand
        // (hand-set pivots drifted and made characters float). Weapons/capes may hang lower without moving it.
        console.log(`  pivot y ${def.pivot[1]} -> ${sheet.feet} (derived from feet)`); def.pivot[1] = sheet.feet;
      }
      let top = null;                       // rows of art above the ground line (head height), measured from idle frames
      if (i === 0) {
        let minY = 1e9;
        for (const fname of sheet.anims.idle?.frames ?? []) {
          const fr = sheet.frames[fname];
          for (let y = 0; y < fr.h; y++) { let hit = false; for (let x = 0; x < fr.w && !hit; x++) hit = sheet.rgba[((fr.y + y) * sheet.W + fr.x + x) * 4 + 3] > 0; if (hit) { minY = Math.min(minY, y); break; } }
        }
        if (minY < 1e9) top = def.pivot[1] - minY + 1;
      }
      if (i === 0) meta = { name: def.name, title: def.title ?? def.name, notes: def.notes ?? '', cell: def.cell, pivot: def.pivot, top, shadow: def.shadow ?? [9, 5], size: [sheet.W, sheet.H], frames: sheet.frames, anims: sheet.anims, palette: pal, variants: variants.map((x, j) => ({ id: x.id, label: x.label ?? x.id, file: j === 0 ? `${def.name}.png` : `${def.name}.${x.id}.png` })) };
    });
    writeFileSync(join(OUT, `${def.name}.json`), JSON.stringify(meta, null, 1));
    index.push(def.name);
    console.log(`built ${def.name}: ${meta.size[0]}x${meta.size[1]}, ${Object.keys(meta.frames).length} frames, ${variants.length} variant(s)`);
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
