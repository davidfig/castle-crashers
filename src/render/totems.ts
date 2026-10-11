// Drawing the shaman's totems and the row of actions over the shaman (docs/18-shaman-and-totems.md). Reads state only.
import type { StandingList } from './standing';
import { HERDS, TOTEMS } from '../data/totems';
import { hex, type Batcher } from '../platform/gl/batcher';
import { FIELD_Y0 } from './background';
import { drawText } from './draw';
import { PLAYER_COLORS, type Sprites } from './art';
import { lerp } from '../engine/math';
import { Kind } from '../sim/entities';
import { Btn } from '../sim/input';
import type { GameState } from '../sim/state';
import { bank, canDo, resolve } from '../sim/totems';
import { CLASSES } from '../data/classes';

/** Ticks a pulse's flash lasts. */
const FLASH = 12;

function ring(b: Batcher, S: Sprites, cx: number, cy: number, r: number, dots: number, color: number): void {
  for (let d = 0; d < dots; d++) {
    const a = (d / dots) * Math.PI * 2;
    b.drawScaled(S.px, Math.round(cx + Math.cos(a) * r - 1), Math.round(cy + Math.sin(a) * r * 0.85 - 1), 2, 2, color);
  }
}

/** A totem's pillar: a tapering post with the kind's colour band, a face and a bright cap. `lift` is a plant's pop, `tint` blinks it when hurt. */
function pillar(b: Batcher, S: Sprites, x: number, y: number, color: number, accent: number, lift: number, alpha: number, hurt: boolean): void {
  const px = Math.round(x), py = Math.round(y - lift);
  b.drawScaled(S.px, px - 4, py - 16, 9, 16, hex(0x2a1c10, alpha));
  b.drawScaled(S.px, px - 3, py - 15, 7, 14, hex(hurt ? 0xffffff : color, alpha));
  b.drawScaled(S.px, px - 3, py - 10, 7, 2, hex(accent, alpha));
  b.drawScaled(S.px, px - 4, py - 20, 9, 4, hex(accent, alpha));
  b.drawScaled(S.px, px - 2, py - 13, 1, 2, hex(0x000000, alpha));
  b.drawScaled(S.px, px + 1, py - 13, 1, 2, hex(0x000000, alpha));
}

/**
 * The planted totems, drawn before the creatures so heroes stand in front. A burning or mending ring sits on the ground at its radius and flashes
 * on each pulse; a Stone's reach is a faint dotted ring; a cannon shows a small ring (its range is long). Every totem has a health bar once hurt.
 */
export function drawTotems(b: Batcher, S: Sprites, s: GameState, camX: number, oy: number, alpha: number, list?: StandingList): void {
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) {
    if (!e.alive[i] || e.kind[i] !== Kind.Totem) continue;
    const k = TOTEMS[e.sub[i]];
    const sx = lerp(e.px[i], e.x[i], alpha) - camX, sy = FIELD_Y0 + lerp(e.py[i], e.y[i], alpha) + oy;
    if (sx < -k.radius - 10 || sx > 640 + k.radius + 10) continue;
    const sinceBeat = Math.max(0, k.beat - e.cool[i]);
    const flash = sinceBeat < FLASH ? 1 - sinceBeat / FLASH : 0;
    const fading = e.rem[i] < 120 && (s.tick >> 2) % 2 === 0 ? 0.45 : 1; // the last two seconds blink
    const owner = PLAYER_COLORS[e.by[i]] ?? 0xffffff;
    // its reach, flat on the ground
    if (k.role === 'damage' || k.role === 'heal') {
      const r = k.radius + flash * 3;
      b.drawScaled(S.disc, Math.round(sx - r), Math.round(sy - r * 0.85), r * 2, r * 1.7, hex(k.color, (0.1 + 0.16 * flash) * fading));
      ring(b, S, sx, sy, r, 36, hex(k.color, (0.55 + 0.4 * flash) * fading));
    } else if (k.role === 'taunt') {
      ring(b, S, sx, sy, k.radius, 44, hex(k.color, (0.22 + 0.3 * flash) * fading)); // the reach that holds enemies
      ring(b, S, sx, sy, 10, 12, hex(k.accent, 0.7 * fading));
    } else {
      ring(b, S, sx, sy, 12 + flash * 5, 14, hex(k.color, (0.6 + 0.3 * flash) * fading));
    }
    ring(b, S, sx, sy, 7, 10, hex(owner, 0.8 * fading));
    // the pillar itself stands among the characters (or straight away, with no list)
    const stand = (): void => {
      pillar(b, S, sx, sy, k.color, k.accent, e.rem[i] > k.ttl - 6 ? 6 - (k.ttl - e.rem[i]) : 0, fading, e.hurt[i] > 0 && (s.tick & 2) === 0);
      if (e.hp[i] < e.maxhp[i] - 0.5) {
        const w = 14, f = Math.max(0, e.hp[i] / e.maxhp[i]);
        b.drawScaled(S.px, Math.round(sx - w / 2) - 1, Math.round(sy - 27), w + 2, 4, hex(0x000000, 0.8));
        b.drawScaled(S.px, Math.round(sx - w / 2), Math.round(sy - 26), Math.round(w * f), 2, hex(f > 0.35 ? 0x4fd05a : 0xe0503a));
      }
    };
    if (list) list.push(lerp(e.py[i], e.y[i], alpha), stand); else stand();
  }
}

/**
 * The actions on the buttons over the shaman: three squares for Attack, Ability 1 and Ability 2 (a fourth for Dodge while Alt is held), each with
 * its letter. Dim when it cannot be done yet; a white pip on a kind that is already standing (planting it again moves it and mends it). While Alt
 * is held the row has a white bar over it, so it is plain which bank a press will use. In the Alt bank the first square is the *selected extra*
 * and the second, the step button, shows an arrow with a chip of the extra it would select next.
 */
export function drawBag(b: Batcher, S: Sprites, s: GameState, sx: number, top: number, slot: number): void {
  const p = s.players[slot];
  const def = CLASSES[p.classId].totems;
  if (!def) return;
  const alt = (p.prevButtons & Btn.Alt) !== 0;
  const acts = bank(p.classId, alt, p.loadout);
  const SZ = 9, GAP = 1, n = acts.length;
  const x0 = Math.round(sx - (n * (SZ + GAP) - GAP) / 2), y0 = Math.round(top);
  if (alt) b.drawScaled(S.px, x0 - 1, y0 - 3, n * (SZ + GAP) + 1, 1, hex(0xffffff, 0.9));
  for (let k = 0; k < n; k++) {
    const raw = acts[k];
    const a = resolve(def, p, raw);
    const x = x0 + k * (SZ + GAP);
    if (!a) { b.drawScaled(S.px, x, y0, SZ, SZ, hex(0x000000, 0.25)); continue; }
    let color: number, glyph: string;
    if ('totem' in a) { color = TOTEMS[a.totem].color; glyph = TOTEMS[a.totem].glyph; }
    else if ('herd' in a) { color = HERDS[a.herd].color; glyph = HERDS[a.herd].glyph; }
    else if ('cycle' in a) { color = 0x8a8f9a; glyph = a.cycle > 0 ? '>' : '<'; }
    else continue; // (a `pick` was resolved above)
    const al = canDo(p, a) ? 1 : 0.4;
    b.drawScaled(S.px, x - 1, y0 - 1, SZ + 2, SZ + 2, hex(0x000000, 0.85 * al));
    b.drawScaled(S.px, x, y0, SZ, SZ, hex(color, al));
    drawText(b, S, glyph, x + 3, y0 + 2, hex(0x101010, al), 1, false);
    if ('cycle' in a && def.extras.length > 1) {
      const next = def.extras[(((p.pick + a.cycle) % def.extras.length) + def.extras.length) % def.extras.length];
      b.drawScaled(S.px, x + SZ - 3, y0 - 1, 4, 4, hex(0x000000, 0.85));
      b.drawScaled(S.px, x + SZ - 2, y0, 2, 2, hex(TOTEMS[next].color)); // the one it would select
    }
    if ('totem' in a && standing(s, slot, a)) b.drawScaled(S.px, x + SZ - 3, y0 - 1, 3, 3, hex(0xffffff, 0.95));
  }
}

function standing(s: GameState, slot: number, a: { totem: number }): boolean {
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.alive[i] && e.kind[i] === Kind.Totem && e.by[i] === slot && e.sub[i] === a.totem) return true;
  return false;
}
