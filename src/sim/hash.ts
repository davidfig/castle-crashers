// FNV-1a over the simulation state. Used by golden tests now and desync detection later.
import type { GameState } from './state';

function mix(h: number, bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mixNum(h: number, v: number): number {
  const f = new Float64Array(1);
  f[0] = v;
  return mix(h, new Uint8Array(f.buffer));
}

export function hashState(s: GameState): number {
  let h = 2166136261;
  h = mixNum(h, s.tick);
  h = mixNum(h, s.phase);
  h = mixNum(h, s.kills);
  h = mixNum(h, s.camX);
  h = mixNum(h, s.hitStop);
  h = mixNum(h, s.spawnTimer);
  h = mixNum(h, s.gold);
  h = mixNum(h, s.coinCount);
  h = mix(h, new Uint8Array(s.rngLoot.buffer));
  h = mix(h, new Uint8Array(s.rngCombat.buffer));
  h = mix(h, new Uint8Array(s.rngSpawn.buffer));
  const e = s.ents;
  const n = e.highWater;
  const u8 = (a: { buffer: ArrayBufferLike; BYTES_PER_ELEMENT: number }) => new Uint8Array(a.buffer, 0, n * a.BYTES_PER_ELEMENT);
  h = mixNum(h, e.count);
  h = mix(h, u8(e.alive));
  h = mix(h, u8(e.kind));
  h = mix(h, u8(e.sub));
  h = mix(h, u8(e.x));
  h = mix(h, u8(e.y));
  h = mix(h, u8(e.vx));
  h = mix(h, u8(e.vy));
  h = mix(h, u8(e.z));
  h = mix(h, u8(e.hp));
  h = mix(h, u8(e.stun));
  h = mix(h, u8(e.atk));
  h = mix(h, u8(e.wind));
  h = mix(h, u8(e.by));
  h = mix(h, u8(e.flags));
  for (const p of s.players) {
    h = mixNum(h, p.active ? 1 : 0);
    h = mixNum(h, p.ent);
    h = mixNum(h, p.downed ? 1 : 0);
    h = mixNum(h, p.downTimer);
    h = mixNum(h, p.invuln);
    h = mixNum(h, p.dashT);
    h = mixNum(h, p.cdAttack);
    h = mixNum(h, p.cdAbility1);
    h = mixNum(h, p.cdDash);
    h = mixNum(h, p.kills);
    h = mixNum(h, p.coins);
    h = mixNum(h, p.fury);
    h = mixNum(h, p.combo);
    h = mixNum(h, p.comboTimer);
    h = mixNum(h, p.lungeT);
  }
  return h >>> 0;
}
