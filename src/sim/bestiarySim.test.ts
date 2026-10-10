import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBestiary, installBestiary } from '../data/bestiary';
import { MOBS, isBossType } from '../data/mobs';
import { BIOME_COUNT, ROSTERS, biomeIndex } from '../data/roster';
import { botInput, runBot } from './bot';
import { allocEntity, freeEntity, Kind } from './entities';
import { hashState } from './hash';
import { createInputFrame } from './input';
import { Phase, createSim, type GameState } from './state';
import { step } from './step';

afterEach(() => installBestiary(null));

const inputs = () => [0, 1, 2, 3].map(createInputFrame);

function finite(s: GameState, tag: string): void {
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) {
    if (!e.alive[i]) continue;
    assert.ok(Number.isFinite(e.x[i]) && Number.isFinite(e.y[i]) && Number.isFinite(e.hp[i]), `${tag}: entity ${i} (kind ${e.kind[i]}, sub ${e.sub[i]}) has a bad number`);
  }
}

test('a bot plays levels against generated monsters, deterministically, and they fight back', () => {
  for (const seed of [3, 4, 5, 6, 7, 8, 9, 10]) {
    installBestiary(generateBestiary(seed * 31));
    const a = runBot(seed, 6000), b = runBot(seed, 6000);
    assert.deepEqual(a, b, `seed ${seed}: the same run twice`);
    assert.ok(a.kills > 5, `seed ${seed}: something got fought`);
    assert.ok(a.minHp < 100, `seed ${seed}: the monsters hurt`);
  }
});

test('every biome\'s generated boss can be fought: it casts, nothing goes bad, and a run replays identically', () => {
  for (let biome = 0; biome < BIOME_COUNT; biome++) {
    for (const castSeed of [1, 2, 3]) {
      installBestiary(generateBestiary(castSeed * 977 + biome));
      let seed = 1;
      while (biomeIndex(seed) !== biome) seed++;
      const play = (): { hash: number; modes: Set<number>; hp: number } => {
        const s = createSim(seed);
        const e = s.ents;
        for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob) freeEntity(e, i);
        s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length;
        const pe = s.players[0].ent;
        e.x[pe] = 100; e.y[pe] = 100; e.px[pe] = 100; e.py[pe] = 100;
        s.camX = 0; s.prevCamX = 0;
        const type = ROSTERS[biome].boss;
        assert.ok(isBossType(type));
        const bi = allocEntity(e, Kind.Mob, type, 260, 100, MOBS[type].hp);
        e.flags[bi] = 1; e.face[bi] = -1; e.boss = bi; e.cool2[bi] = 20;
        const modes = new Set<number>();
        const frames = inputs();
        for (let t = 0; t < 2400 && s.phase === Phase.Playing; t++) {
          botInput(s, 0, frames[0]);
          step(s, frames);
          s.events.n = 0;
          if (e.alive[bi]) modes.add(e.mode[bi]);
          if (t % 300 === 0) finite(s, `${MOBS[type].name} t${t}`);
        }
        finite(s, MOBS[type].name);
        return { hash: hashState(s), modes, hp: e.hp[pe] };
      };
      const a = play(), b = play();
      assert.equal(a.hash, b.hash, `biome ${biome}, cast ${castSeed}: replays identically`);
      assert.ok(a.modes.size >= 3, `biome ${biome}, cast ${castSeed}: the boss uses its moves (saw modes ${[...a.modes]})`);
    }
  }
});
