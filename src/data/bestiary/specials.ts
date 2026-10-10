// Telegraphed specials for generated monsters. One factory per `Special` kind, each tuned to the numbers the hand-made enemies
// proved out (data/mobs.ts), scaled by `u` (0 = a weak early enemy .. 1 = a late one) and nudged by the dice, so no two monsters
// cast quite alike. Boss versions (`bossSpecial`) are the same moves, bigger and with no cooldown of their own (the boss's gap paces them).
import { NovaStyle, type Special } from '../mobs';
import { Dice, round } from './rand';

export type SpecialKind = Special['kind'];

/** Who can use a special well: a melee mob has to walk up to the hero, a caster keeps its distance. */
export const MELEE_SPECIALS: readonly SpecialKind[] = ['blink', 'nova', 'trap', 'cling', 'whiteout', 'leap', 'gust'];
export const CASTER_SPECIALS: readonly SpecialKind[] = ['lob', 'summon', 'heal', 'rally', 'beam', 'wail', 'ward', 'storm', 'lure', 'pit', 'hex', 'dazzle'];
/** What a boss may cast (the moves the hand-made bosses use; the rest are too small to read at boss scale). */
export const BOSS_SPECIALS: readonly SpecialKind[] = ['rally', 'lob', 'nova', 'storm', 'trap', 'ward', 'whiteout', 'beam', 'summon', 'blink', 'heal', 'wail', 'leap', 'lure', 'gust', 'pit'];

interface Ctx {
  /** The cheap swarm slot of the biome: what a summoner raises. */
  swarm: number;
  frost?: boolean;
  bog?: boolean;
}

const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

/** An ordinary monster's special. `windup` and `cooldown` are its own. */
export function makeSpecial(kind: SpecialKind, d: Dice, u: number, c: Ctx): Special {
  const cool = (lo: number, hi: number) => Math.round(d.range(lo, hi));
  switch (kind) {
    case 'lob': {
      const volley = u > 0.55 && d.chance(0.4);
      return { kind, windup: cool(34, 42), cooldown: cool(130, 190), minRange: 40, maxRange: cool(165, 190), radius: cool(14, 20), damage: Math.round(lerp(7, 12, u)), delay: cool(44, 52),
        ...(volley ? { count: d.int(2, 3), spread: cool(40, 60) } : {}) };
    }
    case 'summon':
      return { kind, windup: cool(46, 56), cooldown: cool(300, 340), type: c.swarm, count: d.int(2, 3), cap: d.int(8, 12) };
    case 'heal':
      return { kind, windup: cool(38, 46), cooldown: cool(190, 230), radius: cool(66, 80), amount: round(d.range(0.35, 0.5), 2) };
    case 'rally':
      return { kind, windup: cool(28, 34), cooldown: cool(260, 300), radius: cool(85, 105), duration: cool(300, 360) };
    case 'blink':
      return { kind, windup: cool(24, 30), cooldown: cool(220, 260), minRange: 70, maxRange: cool(210, 240) };
    case 'nova':
      return { kind, windup: cool(40, 48), cooldown: cool(220, 260), radius: cool(38, 52), damage: Math.round(lerp(11, 17, u)), slow: d.chance(0.5) ? 0 : cool(40, 80),
        style: c.frost ? NovaStyle.Frost : d.pick([NovaStyle.Stomp, NovaStyle.Scream]) };
    case 'beam':
      return { kind, windup: cool(52, 60), cooldown: cool(230, 270), range: cool(210, 240), width: d.int(5, 7), damage: Math.round(lerp(13, 19, u)) };
    case 'trap':
      return { kind, windup: cool(24, 30), cooldown: cool(260, 300), minRange: 30, maxRange: cool(160, 180), radius: d.int(8, 10), damage: Math.round(lerp(3, 5, u)), arm: 50, root: cool(55, 65), linger: 900, cap: 2, spread: cool(18, 26) };
    case 'cling':
      return { kind, windup: cool(8, 12), cooldown: cool(180, 220), range: 26, damage: 1, pulse: cool(26, 34), slow: cool(35, 45), cap: 3 };
    case 'ward':
      return { kind, windup: cool(46, 54), cooldown: cool(280, 320), radius: cool(84, 96), duration: cool(440, 520), need: 3 };
    case 'storm':
      return { kind, windup: cool(40, 48), cooldown: cool(200, 240), minRange: 30, maxRange: cool(160, 180), radius: cool(32, 40), delay: cool(46, 54), linger: cool(240, 280), damage: Math.round(lerp(2, 3, u)), slow: cool(50, 70), cap: 3,
        ...(c.bog ? { bog: true } : {}) };
    case 'whiteout':
      return { kind, windup: cool(32, 40), cooldown: cool(280, 320), radius: cool(58, 70), damage: 3, duration: cool(65, 85) };
    case 'wail':
      return { kind, windup: cool(40, 48), cooldown: cool(220, 260), radius: cool(64, 76), damage: 4, duration: cool(190, 230) };
    case 'lure':
      return { kind, windup: cool(36, 44), cooldown: cool(250, 290), radius: cool(130, 150), pull: cool(58, 70), damage: 2 };
    case 'leap':
      return { kind, windup: cool(25, 31), cooldown: cool(250, 290), minRange: 50, maxRange: cool(140, 160), radius: cool(18, 22), damage: Math.round(lerp(7, 11, u)), slow: cool(50, 70), delay: cool(27, 33) };
    case 'gust':
      return { kind, windup: cool(30, 38), cooldown: cool(260, 300), radius: cool(50, 62), damage: Math.round(lerp(3, 5, u)), push: cool(80, 100) };
    case 'pit':
      return { kind, windup: cool(42, 50), cooldown: cool(280, 320), minRange: 30, maxRange: cool(160, 180), radius: cool(30, 38), delay: cool(40, 50), linger: cool(220, 260), pull: round(d.range(0.5, 0.6), 2), damage: 4 };
    case 'hex':
      return { kind, windup: cool(40, 48), cooldown: cool(240, 280), minRange: 30, maxRange: cool(160, 180), radius: cool(20, 24), duration: cool(280, 320) };
    case 'dazzle':
      return { kind, windup: cool(44, 52), cooldown: cool(260, 300), minRange: 40, maxRange: cool(190, 210), radius: cool(22, 26), duration: cool(45, 55), damage: 3 };
  }
}

/** A boss's version of a special: bigger, reaching the whole field, with no cooldown of its own. */
export function bossSpecial(kind: SpecialKind, d: Dice, c: Ctx): Special {
  const w = (lo: number, hi: number) => Math.round(d.range(lo, hi));
  switch (kind) {
    case 'rally': return { kind, windup: w(42, 48), cooldown: 0, radius: w(140, 160), duration: w(340, 380) };
    case 'lob': return { kind, windup: w(38, 46), cooldown: 0, minRange: 0, maxRange: w(320, 380), radius: w(20, 22), damage: w(12, 14), delay: 56, count: d.int(4, 6), spread: w(70, 90) };
    case 'nova': return { kind, windup: w(46, 52), cooldown: 0, radius: w(80, 100), damage: w(16, 19), slow: w(100, 150), style: c.frost ? NovaStyle.Frost : d.pick([NovaStyle.Stomp, NovaStyle.Scream]) };
    case 'storm': return { kind, windup: w(44, 48), cooldown: 0, minRange: 0, maxRange: 420, radius: w(28, 32), delay: 56, linger: w(300, 340), damage: 2, slow: w(60, 70), count: 4, spread: w(76, 84), ...(c.bog ? { bog: true } : {}) };
    case 'trap': return { kind, windup: w(38, 42), cooldown: 0, minRange: 0, maxRange: 420, radius: 10, damage: 5, arm: 50, root: w(70, 80), linger: 900, cap: 3, count: 4, spread: w(56, 64) };
    case 'ward': return { kind, windup: w(50, 54), cooldown: 0, radius: w(130, 150), duration: w(460, 500), need: 4 };
    case 'whiteout': return { kind, windup: w(42, 46), cooldown: 0, radius: w(110, 130), damage: 6, duration: w(140, 160) };
    case 'beam': return { kind, windup: w(66, 72), cooldown: 0, range: 420, width: w(12, 14), damage: w(24, 28) };
    case 'summon': return { kind, windup: w(50, 56), cooldown: 0, type: c.swarm, count: d.int(5, 6), cap: w(18, 24) };
    case 'blink': return { kind, windup: w(28, 32), cooldown: 0, minRange: 80, maxRange: w(290, 310) };
    case 'heal': return { kind, windup: w(44, 48), cooldown: 0, radius: w(150, 170), amount: 0.5 };
    case 'wail': return { kind, windup: w(48, 52), cooldown: 0, radius: w(120, 140), damage: 5, duration: w(170, 190) };
    case 'leap': return { kind, windup: w(42, 46), cooldown: 0, minRange: 60, maxRange: w(320, 360), radius: w(52, 60), damage: w(20, 24), slow: w(90, 110), delay: w(42, 46) };
    case 'lure': return { kind, windup: w(48, 52), cooldown: 0, radius: w(210, 230), pull: w(85, 95), damage: 4 };
    case 'gust': return { kind, windup: w(46, 50), cooldown: 0, radius: w(100, 120), damage: w(9, 11), push: w(95, 105) };
    case 'pit': return { kind, windup: w(42, 46), cooldown: 0, minRange: 0, maxRange: 420, radius: w(34, 38), delay: w(46, 50), linger: w(250, 270), pull: round(d.range(0.55, 0.65), 2), damage: 5, count: 3, spread: w(66, 74) };
    case 'cling': case 'hex': case 'dazzle': return bossSpecial('nova', d, c);
  }
}
