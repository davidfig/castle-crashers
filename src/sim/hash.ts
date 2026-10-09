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

function e0(s: GameState): number { return s.ents.boss; }

export function hashState(s: GameState): number {
  let h = 2166136261;
  h = mixNum(h, s.tick);
  h = mixNum(h, s.phase);
  h = mixNum(h, s.kills);
  for (let i = 0; i < s.slain.length; i++) h = mixNum(h, s.slain[i]);
  h = mixNum(h, s.camX);
  h = mixNum(h, s.hitStop);
  h = mixNum(h, s.spawnTimer);
  h = mixNum(h, s.flankTimer);
  h = mixNum(h, s.trigCamX);
  h = mixNum(h, s.nextClump);
  h = mixNum(h, s.biome);
  h = mixNum(h, s.bossDeadTick);
  h = mixNum(h, s.gateIdx);
  h = mixNum(h, s.gateOpenTick);
  h = mixNum(h, s.beatIndex);
  h = mixNum(h, s.beatPlayedTick);
  h = mixNum(h, s.surrender ? 1 : 0);
  h = mixNum(h, s.surrenders);
  h = mixNum(h, s.betrayed);
  for (let i = 0; i < s.spared.length; i++) h = mixNum(h, s.spared[i]);
  h = mixNum(h, e0(s));
  h = mixNum(h, s.gold);
  h = mixNum(h, s.heat);
  h = mixNum(h, s.chestsOpened);
  h = mixNum(h, s.chestMiss);
  h = mixNum(h, s.coinCount);
  h = mixNum(h, s.potionCount);
  h = mixNum(h, s.potionBudget);
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
  h = mix(h, u8(e.mode));
  h = mix(h, u8(e.cool));
  h = mix(h, u8(e.cool2));
  h = mix(h, u8(e.buff));
  h = mix(h, u8(e.shieldHp));
  h = mix(h, u8(e.rem));
  h = mix(h, u8(e.by));
  h = mix(h, u8(e.flags));
  h = mix(h, u8(e.elite));
  for (const p of s.players) {
    h = mixNum(h, p.active ? 1 : 0);
    h = mixNum(h, p.ent);
    h = mixNum(h, p.downed ? 1 : 0);
    h = mixNum(h, p.downTimer);
    h = mixNum(h, p.invuln);
    h = mixNum(h, p.dashT);
    h = mixNum(h, p.vanishT);
    h = mixNum(h, p.cursor);
    h = mixNum(h, p.revealT);
    h = mixNum(h, p.auraOn ? 1 : 0);
    h = mixNum(h, p.cdAttack);
    h = mixNum(h, p.cdAbility1);
    h = mixNum(h, p.cdDash);
    h = mixNum(h, p.kills);
    h = mixNum(h, p.coins);
    h = mixNum(h, p.fury);
    h = mixNum(h, p.combo);
    h = mixNum(h, p.comboTimer);
    h = mixNum(h, p.lungeT);
    h = mixNum(h, p.standT);
    h = mixNum(h, p.xp);
    h = mixNum(h, p.level);
    h = mixNum(h, p.pending);
    h = mixNum(h, p.panel ? 1 : 0);
    h = mixNum(h, p.lock ? 1 : 0);
    h = mix(h, p.ranks);
    for (let b = 0; b < p.boonCd.length; b++) h = mixNum(h, p.boonCd[b]);
    h = mixNum(h, p.stamina);
    h = mixNum(h, p.staminaDelay);
    h = mixNum(h, p.winded ? 1 : 0);
    h = mixNum(h, p.cdSpecial);
    h = mixNum(h, p.bufAbility2);
    h = mixNum(h, p.slowT);
    h = mixNum(h, p.rootT);
    h = mixNum(h, p.dashChain);
    h = mixNum(h, p.chainT);
    h = mixNum(h, p.echoLeft);
    h = mixNum(h, p.echoT);
    h = mixNum(h, p.echoBig ? 1 : 0);
    h = mixNum(h, p.silenceT);
    h = mixNum(h, p.confuseT);
    h = mixNum(h, p.poisonT);
    h = mixNum(h, p.burning ? 1 : 0);
    h = mixNum(h, p.hexT);
    h = mixNum(h, p.witherT);
    h = mixNum(h, p.pullT);
    h = mixNum(h, p.pullX);
    h = mixNum(h, p.pullY);
    h = mixNum(h, p.rerolls);
    h = mixNum(h, p.banishes);
    h = mixNum(h, p.salt);
    h = mix(h, p.banned);
  }
  return h >>> 0;
}
