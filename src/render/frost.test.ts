import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NovaStyle, MOBS, MobType, type Special } from '../data/mobs';
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { ZoneKind } from '../sim/entities';
import type { GameState } from '../sim/state';
import type { Sprites } from './art';
import { drawHarpoon, drawSpecialTelegraph, drawZone } from './draw';

// Draws are recorded instead of sent to the GPU: what matters is which colors the effect puts on the field.
interface Rec { x: number; y: number; w: number; h: number; tint: number }
function recorder(): { b: Batcher; calls: Rec[] } {
  const calls: Rec[] = [];
  const b = {
    drawScaled: (_f: unknown, x: number, y: number, w: number, h: number, tint = 0xffffffff) => { calls.push({ x, y, w, h, tint }); },
    draw: (_f: unknown, x: number, y: number, _flip = false, tint = 0xffffffff) => { calls.push({ x, y, w: 0, h: 0, tint }); },
  } as unknown as Batcher;
  return { b, calls };
}
const frame = { u0: 0, v0: 0, u1: 1, v1: 1, w: 3, h: 5 };
const S = { px: frame, glyph: new Proxy({}, { get: () => frame }) } as unknown as Sprites;
const rgb = (c: number): number => c & 0xffffff;
// hex() packs 0xAABBGGRR, so compare with the same packing
const rgbOf = (color: number): number => rgb(hex(color));
const count = (calls: Rec[], color: number): number => calls.filter((c) => rgb(c.tint) === rgbOf(color)).length;

function ents(over: Record<string, number[]>): GameState['ents'] {
  return { wind: [12], sub: [0], rem: [24], cool2: [300], ax: [1], ay: [0], ...over } as unknown as GameState['ents'];
}

// No enemy uses a frost nova at the moment (the Blizzard Witch casts a storm), but the look stays available to any nova special.
const frostNova: Special = { kind: 'nova', windup: 44, cooldown: 220, radius: 58, damage: 7, slow: 140, style: NovaStyle.Frost };

test('a frost nova winds up with a frost ring and rising icicles, not the red nova ring', () => {
  const { b, calls } = recorder();
  drawSpecialTelegraph(b, S, ents({ wind: [10] }), 0, frostNova, 200, 100, 120, 0);
  const deep = calls.filter((c) => rgb(c.tint) === rgbOf(0x2f94f0));
  assert.equal(deep.filter((c) => c.w === 2 && c.h === 2).length, 40, 'the danger ring is 40 frost-blue dots');
  assert.equal(count(calls, 0xff3a2a), 0, 'no red ring');
  const icicles = deep.filter((c) => c.w === 1 && c.h >= 1);
  assert.equal(icicles.length, 16, 'sixteen icicles stand along the ring');
  assert.ok(icicles.some((c) => c.h > 1), 'and they grow as the scream builds');
});

test('the other novas keep their looks: a stomp is red, a scream is violet', () => {
  const stomp = MOBS[MobType.Troll].special!;
  const { b, calls } = recorder();
  drawSpecialTelegraph(b, S, ents({ wind: [10] }), 0, stomp, 200, 100, 120, 0);
  assert.equal(count(calls, 0xff3a2a), 40);
  const scream = { kind: 'nova' as const, windup: 44, cooldown: 220, radius: 56, damage: 7, slow: 120, style: NovaStyle.Scream };
  const r2 = recorder();
  drawSpecialTelegraph(r2.b, S, ents({ wind: [10] }), 0, scream, 200, 100, 120, 0);
  assert.equal(count(r2.calls, 0xb890ff), 40);
});

test('a frost pool is drawn as ice with crystals, and a poison pool stays green', () => {
  const frost = recorder();
  drawZone(frost.b, S, ents({ sub: [ZoneKind.Frost] }), 0, 200, 120, 0);
  assert.equal(count(frost.calls, 0x2f94f0), 26, 'a rim of frost-blue dots');
  assert.ok(frost.calls.some((c) => rgb(c.tint) === rgbOf(0x5ab4f4) && c.w === 1 && c.h >= 2), 'ice crystals stand in it');
  assert.equal(count(frost.calls, 0xb8e060), 0, 'none of the poison look');
  const poison = recorder();
  drawZone(poison.b, S, ents({ sub: [ZoneKind.Poison] }), 0, 200, 120, 0);
  assert.equal(count(poison.calls, 0xb8e060), 26);
  assert.equal(count(poison.calls, 0x2f94f0), 0);
});

test('a harpoon is drawn as a shaft, a barbed head and a frost streak, along its heading', () => {
  const right = recorder();
  drawHarpoon(right.b, S, 100, 50, 1, 0);
  assert.equal(count(right.calls, 0x6a4a2a) + count(right.calls, 0x8a5a30), 7, 'a 7 px shaft');
  assert.ok(right.calls.some((c) => rgb(c.tint) === rgbOf(0x2f94f0)), 'a frost streak behind');
  const shaft = right.calls.filter((c) => c.w === 1 && c.h === 1 && (rgb(c.tint) === rgbOf(0x6a4a2a) || rgb(c.tint) === rgbOf(0x8a5a30)));
  assert.ok(shaft.every((c) => c.y === 50 && c.x < 100), 'flying right, the shaft trails to the left on the same row');
  const down = recorder();
  drawHarpoon(down.b, S, 100, 50, 0, 1);
  const shaftD = down.calls.filter((c) => c.w === 1 && c.h === 1 && (rgb(c.tint) === rgbOf(0x6a4a2a) || rgb(c.tint) === rgbOf(0x8a5a30)));
  assert.ok(shaftD.every((c) => c.x === 100 && c.y < 50), 'flying down, the shaft trails above');
});

// The Pass floor is near-white snow, so an ice effect drawn in a pale color is invisible there.
const luminance = (tint: number): number => ((tint & 255) * 0.3 + ((tint >>> 8) & 255) * 0.59 + ((tint >>> 16) & 255) * 0.11) / 255;

test('the storm the blizzard witch casts is drawn in colors that show on snow', () => {
  const sp = MOBS[MobType.BlizzardWitch].special!;
  assert.equal(sp.kind, 'storm');
  const { b, calls } = recorder();
  drawZone(b, S, ents({ sub: [ZoneKind.Storm], wind: [30], rem: [32] }), 0, 200, 120, 0);
  assert.ok(calls.length > 20, 'a ring and flakes');
  assert.ok(calls.every((c) => luminance(c.tint) < 0.8), 'nothing pale enough to vanish on snow');
});

test('every frost effect avoids snow-white', () => {
  const all: Rec[] = [];
  const push = (fn: (r: ReturnType<typeof recorder>) => void): void => { const r = recorder(); fn(r); all.push(...r.calls); };
  push((r) => drawSpecialTelegraph(r.b, S, ents({ wind: [10] }), 0, frostNova, 200, 100, 120, 0));
  push((r) => drawZone(r.b, S, ents({ sub: [ZoneKind.Frost] }), 0, 200, 120, 0));
  push((r) => drawZone(r.b, S, ents({ sub: [ZoneKind.Storm], wind: [30], rem: [32] }), 0, 200, 120, 0));
  push((r) => drawHarpoon(r.b, S, 100, 50, 1, 0));
  // a 1 px white glint is the one allowed highlight; anything bigger or paler must not be white
  const pale = all.filter((c) => luminance(c.tint) >= 0.8 && !(c.w <= 1 && c.h <= 1 && rgb(c.tint) === 0xffffff));
  assert.equal(pale.length, 0, `${pale.length} pale draws`);
});
