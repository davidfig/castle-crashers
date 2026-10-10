import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENT_COUNT, ELEMENTS } from '../data/elements';
import { MOBS, MobType, Pattern, ProjStyle, type Special } from '../data/mobs';
import { DEMO_KINDS, demoSpecial, demoStandoff, parseDemo } from '../data/skillDemo';
import { allocEntity, ELEM_MASK, freeEntity, Kind, PROJ_HOMING, PROJ_PIERCE, ZoneKind } from '../sim/entities';
import { EV_STRIDE, Ev } from '../sim/events';
import { createInputFrame } from '../sim/input';
import { fireSpecialOf, startSpecialOf } from '../sim/abilities';
import { createSim, type GameState } from '../sim/state';
import { step } from '../sim/step';
import type { Batcher } from '../platform/gl/batcher';
import type { Sprites } from './art';
import { drawElemAura, drawElemProj, drawElemZone, elemTelegraph, swirlMotes } from './elementDraw';
import {
  CORE, elementArc, elementBeam, elementBurst, elementCone, elemId, hash01, mixRgb, ringColor, rgbOf, shade, tint, type Sink, burstTrauma, CONE_TICKS,
} from './elementFx';
import { Fx } from './fx';

/** A batcher that only checks what it is asked to draw: every number finite, every box at least a pixel in size. */
function fakeBatcher(): { b: Batcher; S: Sprites; stats: { calls: number; bad: number } } {
  const stats = { calls: 0, bad: 0 };
  const b = {
    drawScaled(_f: unknown, x: number, y: number, w: number, h: number, c = 0): void {
      stats.calls++;
      if (![x, y, w, h, c].every(Number.isFinite) || w < 0 || h < 0) stats.bad++;
    },
    draw(): void { stats.calls++; },
  } as unknown as Batcher;
  return { b, S: { px: {} } as unknown as Sprites, stats };
}

/** A particle sink that records what the recipes spawn. */
function recorder(): Sink & { n: number; bad: number; maxLife: number } {
  let seed = 1234567;
  const r = {
    n: 0, bad: 0, maxLife: 0,
    rand(): number { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; },
    spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, col: number, big = 0, grav = 0.12, drag = 1, spin = 0): void {
      r.n++;
      if (![x, y, z, vx, vy, vz, life, col, big, grav, drag, spin].every(Number.isFinite) || life <= 0) r.bad++;
      if (life > r.maxLife) r.maxLife = life;
    },
  };
  return r;
}

const idle = () => [0, 1, 2, 3].map(createInputFrame);

function arena(seed = 1): GameState {
  const s = createSim(seed);
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob) freeEntity(e, i);
  s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length;
  const pe = s.players[0].ent;
  e.x[pe] = 100; e.y[pe] = 100; e.px[pe] = 100; e.py[pe] = 100;
  s.camX = 0; s.prevCamX = 0;
  return s;
}

test('every element has a palette: four distinct, finite colours, and element 0 is the plain one', () => {
  assert.equal(ELEMENTS.length, ELEMENT_COUNT);
  for (let el = 0; el < ELEMENT_COUNT; el++) {
    for (let tone = 0; tone < 4; tone++) assert.ok(Number.isInteger(rgbOf(el, tone)) && rgbOf(el, tone) >= 0 && rgbOf(el, tone) <= 0xffffff, `element ${el} tone ${tone}`);
    assert.ok(Number.isFinite(tint(el, CORE, 0.5)));
    assert.ok(Number.isFinite(shade(el, CORE, -0.3)) && Number.isFinite(shade(el, CORE, 0.3)));
    assert.ok(Number.isFinite(ringColor(el)) && burstTrauma(el) > 0);
  }
  assert.equal(elemId(undefined), 0);
  assert.equal(elemId(99), 0);
  assert.equal(elemId(-1), 0);
  const cores = new Set(ELEMENTS.slice(1).map((e) => e.core));
  assert.equal(cores.size, ELEMENT_COUNT - 1, 'every element has its own colour');
  assert.equal(mixRgb(0x000000, 0xffffff, 0.5), 0x808080);
  const h = hash01(5);
  assert.ok(h >= 0 && h < 1 && h === hash01(5));
});

test('bursts, arcs, breaths and beams spawn finite particles for every element, and never too many', () => {
  for (let el = 0; el < ELEMENT_COUNT; el++) {
    for (const r of [8, 18, 50]) {
      const rec = recorder();
      elementBurst(rec, 100, 100, r, el);
      assert.ok(rec.n > 4 && rec.n < 400, `burst ${el} r${r}: ${rec.n}`);
      assert.equal(rec.bad, 0, `burst ${el} r${r}`);
    }
    const arc = recorder();
    elementArc(arc, 10, 10, 90, 40, el);
    elementArc(arc, 10, 10, 10, 10, el); // from and to the same spot
    assert.ok(arc.n > 0 && arc.bad === 0, `arc ${el}`);
    const cone = recorder();
    for (let t = 0; t < CONE_TICKS; t++) elementCone(cone, 50, 60, 80, 10, 0.1, el, t / CONE_TICKS, (t + 1) / CONE_TICKS, (t & 1) === 1);
    assert.ok(cone.n > 20 && cone.bad === 0, `cone ${el}: ${cone.n}`);
    const beam = recorder();
    elementBeam(beam, 30, 40, 1, 0, 200, 6, el);
    elementBeam(beam, 30, 40, 0, 1, 10, 0, el);
    assert.ok(beam.n > 0 && beam.bad === 0, `beam ${el}`);
  }
});

test('the Fx store takes the new events: element bursts, arcs, breaths and coloured beams', () => {
  const fx = new Fx();
  const ev = { n: 0, data: new Float64Array(64 * EV_STRIDE) };
  const put = (...v: number[]): void => { ev.data.set([...v, 0, 0, 0, 0, 0, 0, 0].slice(0, EV_STRIDE), ev.n * EV_STRIDE); ev.n++; };
  for (let el = 1; el < ELEMENT_COUNT; el++) {
    put(Ev.Burst, 100, 100, 20, 32 + el);
    put(Ev.Arc, 20, 20, 80, 40, el);
    put(Ev.Cone, 30, 30, 70, 10, 0.1, el);
    put(Ev.Beam, 30, 30, 120, 0, 6, el);
  }
  put(Ev.Burst, 100, 100, 20, 4); // a plain burst still works
  put(Ev.Beam, 30, 30, 120, 0, 6, 0); // and a plain beam
  fx.consume(ev);
  assert.ok(fx.n > 200);
  assert.equal(ev.n, 0);
  for (let t = 0; t < 120; t++) fx.update(1);
  for (let i = 0; i < fx.n; i++) assert.ok(Number.isFinite(fx.x[i] + fx.y[i] + fx.z[i] + fx.vx[i] + fx.vy[i] + fx.vz[i]), 'particle state stays finite');
  assert.equal(fx.n, 0, 'every particle dies');
  assert.equal(fx.cnt.every((t) => t < 0), true, 'the breaths finish their sweep');
});

test('projectiles of every element, shape and flag draw without a bad number', () => {
  const { b, S, stats } = fakeBatcher();
  for (let el = 0; el < ELEMENT_COUNT; el++) {
    for (const shape of [ProjStyle.Orb, ProjStyle.Spike, ProjStyle.Comet, ProjStyle.Mote]) {
      for (const flags of [0, PROJ_PIERCE, PROJ_HOMING, PROJ_PIERCE | PROJ_HOMING]) {
        for (const [dx, dy] of [[1, 0], [0, -1], [-0.7071, 0.7071], [0, 0]]) {
          const before = stats.calls;
          drawElemProj(b, S, 120.5, 90.25, dx, dy, shape, el, flags | el, 37, 5);
          assert.ok(stats.calls > before, `element ${el} shape ${shape} draws something`);
        }
      }
    }
  }
  assert.equal(stats.bad, 0);
});

/** A zone of `sub` made of `el`, with the fields the sim gives it. */
function zone(s: GameState, sub: number, el: number, o: Record<string, number> = {}): number {
  const e = s.ents;
  const z = allocEntity(e, Kind.Zone, sub, 100, 100, 3);
  e.flags[z] = el;
  e.rem[z] = 24; e.wind[z] = 20; e.cool2[z] = 200; e.buff[z] = 60; e.mode[z] = 0; e.ax[z] = 2; e.ay[z] = 1;
  for (const k of Object.keys(o)) (e as unknown as Record<string, ArrayLike<number> & Record<number, number>>)[k][z] = o[k];
  return z;
}

test('every zone kind made of every element draws, in every phase, without a bad number', () => {
  const s = arena();
  const { b, S, stats } = fakeBatcher();
  const e = s.ents;
  for (let el = 0; el < ELEMENT_COUNT; el++) {
    const zs: number[] = [];
    zs.push(zone(s, ZoneKind.Rock, el, { mode: 0, wind: 40, ax: 20 }));
    zs.push(zone(s, ZoneKind.Rock, el, { mode: 0, wind: 0, ax: 0 }));
    zs.push(zone(s, ZoneKind.Trap, el, { mode: 0 }));
    zs.push(zone(s, ZoneKind.Trap, el, { mode: 2 }));
    zs.push(zone(s, ZoneKind.Storm, el, { wind: 50 }));
    zs.push(zone(s, ZoneKind.Pit, el, { mode: 0 }));
    zs.push(zone(s, ZoneKind.Pit, el, { mode: 1, cool2: 20 }));
    zs.push(zone(s, ZoneKind.Pool, el, { mode: 1, cool2: 30 }));
    zs.push(zone(s, ZoneKind.Pool, el, { mode: 1, rem: 8 }));
    zs.push(zone(s, ZoneKind.Totem, el, { rem: 150, cool2: 300, buff: 60, wind: 3, ax: 2, mode: ProjStyle.Orb }));
    zs.push(zone(s, ZoneKind.Totem, el, { cool2: 10, wind: 60 }));
    for (const z of zs) {
      for (const tick of [0, 1, 7, 100, 12345]) {
        const handled = drawElemZone(b, S, e, z, 150.5, 120.25, tick);
        const sub = e.sub[z];
        if (sub === ZoneKind.Pool || sub === ZoneKind.Totem) assert.ok(handled, `pools and totems are always drawn here (${sub}, element ${el})`);
        else if (el > 0 && !(sub === ZoneKind.Rock && e.mode[z] !== 0)) assert.ok(handled, `zone ${sub} of element ${el} is handled`);
        else if (el === 0) assert.ok(!handled, `zone ${sub} with no element keeps its hand-made look`);
      }
    }
    for (const z of zs) freeEntity(e, z);
  }
  assert.equal(stats.bad, 0);
  // an old zone kind with stray flag bits is left alone
  const poison = zone(s, ZoneKind.Poison, 0);
  assert.equal(drawElemZone(b, S, e, poison, 100, 100, 3), false);
  assert.equal(ELEM_MASK, 31);
  swirlMotes(b, S, 3, 50, 50, 20, 9, 1, 0, 1); // no motes is fine
});

test('every kind of skill, plain or elemental, has a telegraph that draws', () => {
  const s = arena();
  const { b, S, stats } = fakeBatcher();
  const e = s.ents;
  const m = allocEntity(e, Kind.Mob, MobType.Slinger, 200, 100, 10);
  e.ax[m] = 0.8; e.ay[m] = 0.6;
  const plain = new Set<Special['kind']>(['bolt', 'ring', 'cone', 'totem']);
  for (const kind of DEMO_KINDS) {
    for (let el = 0; el < ELEMENT_COUNT; el++) {
      const sp = demoSpecial(kind, el, kind === 'bolt' ? { count: 3, spread: 0.05 } : {});
      for (const p of [0, 0.3, 0.8, 1]) {
        const glyph = elemTelegraph(b, S, e, m, sp, 200, 100, 33, p);
        if (plain.has(kind)) assert.ok(glyph > 0, `${kind} always has its own telegraph`);
        if (el === 0 && !plain.has(kind)) assert.equal(glyph, 0, `${kind} with no element keeps the old telegraph`);
      }
    }
  }
  assert.equal(stats.bad, 0);
  drawElemAura(b, S, 4, 40, 100, 100, 5, 2);
  assert.equal(stats.bad, 0);
});

test('demoSpecial gives a legal Special for every kind and element, and ?demo= text parses', () => {
  for (const kind of DEMO_KINDS) {
    for (let el = 0; el < ELEMENT_COUNT; el++) {
      const sp = demoSpecial(kind, el);
      assert.equal(sp.kind, kind);
      assert.ok(sp.windup > 0 && sp.cooldown > 0, `${kind} timings`);
      assert.equal(sp.element ?? 0, el);
      for (const [k, v] of Object.entries(sp)) if (typeof v === 'number') assert.ok(Number.isFinite(v), `${kind}.${k}`);
    }
    assert.ok(demoStandoff(kind) > 0);
  }
  const lob = demoSpecial('lob', 2, { pattern: Pattern.Ring, count: 6, spread: 50 });
  assert.ok(lob.kind === 'lob' && lob.pattern === Pattern.Ring && lob.count === 6);
  const p = parseDemo('lob:ice:pattern=ring:count=6:spread=50');
  assert.ok(p && p.kind === 'lob' && p.element === 2 && p.overrides.pattern === Pattern.Ring && p.overrides.count === 6 && p.overrides.spread === 50);
  assert.deepEqual(parseDemo('bolt:lightning:shape=comet:pierce=true')?.overrides, { shape: ProjStyle.Comet, pierce: true });
  assert.equal(parseDemo('lob:ice')?.element, 2);
  assert.equal(parseDemo('nonsense:fire'), null);
  assert.equal(parseDemo('lob:nothing'), null);
  assert.equal(parseDemo('cone')?.element, 0);
  const res = demoSpecial('lob', 1, { residue: 1 });
  assert.ok(res.kind === 'lob' && res.residue && res.residue.radius > 0);
});

test('the sim can cast every demo skill, and a hundred ticks later nothing is NaN', () => {
  for (const kind of DEMO_KINDS) {
    for (let el = 0; el < ELEMENT_COUNT; el++) {
      const s = arena(el + 1);
      const e = s.ents;
      const sp = demoSpecial(kind, el, kind === 'bolt' ? { count: 3, spread: 0.05 } : kind === 'lob' ? { count: 5, pattern: Pattern.Spiral, spread: 40, residue: 1 } : {});
      const stand = demoStandoff(kind);
      const m = allocEntity(e, Kind.Mob, MobType.Slinger, 100 + Math.min(stand, 150), 100, MOBS[MobType.Slinger].hp);
      e.flags[m] = 1; e.face[m] = -1;
      const tp = s.players[0].ent;
      const dx = e.x[tp] - e.x[m], dy = e.y[tp] - e.y[m], d = Math.sqrt(dx * dx + dy * dy);
      if (startSpecialOf(s, m, sp, 0, d, dx / d, dy / d)) fireSpecialOf(s, m, sp, 0);
      for (let t = 0; t < 100; t++) step(s, idle());
      for (let i = 0; i < e.highWater; i++) {
        if (!e.alive[i]) continue;
        assert.ok(Number.isFinite(e.x[i] + e.y[i] + e.hp[i] + e.vx[i] + e.vy[i]), `${kind}:${el} entity ${i} (kind ${e.kind[i]}) stays finite`);
      }
      // what the render side would be handed this tick draws, too
      const { b, S, stats } = fakeBatcher();
      for (let i = 0; i < e.highWater; i++) {
        if (!e.alive[i]) continue;
        if (e.kind[i] === Kind.Zone) drawElemZone(b, S, e, i, e.x[i], e.y[i], s.tick);
        else if (e.kind[i] === Kind.Proj && e.sub[i] === 0 && e.mode[i] >= ProjStyle.Orb) drawElemProj(b, S, e.x[i], e.y[i], 1, 0, e.mode[i], e.flags[i] & ELEM_MASK, e.flags[i], s.tick, i);
      }
      assert.equal(stats.bad, 0, `${kind}:${el} draws cleanly`);
      // and the events of the cast feed the particle store
      const fx = new Fx();
      fx.consume(s.events);
      for (let t = 0; t < 10; t++) fx.update(1);
    }
  }
});
