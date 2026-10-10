import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MobType, MOBS } from '../data/mobs';
import { makeQuest, MISSIONS, QUEST_NPCS, REWARDS, questOffers, OFFERS, type MissionKind, type QuestDef, type RewardKind } from '../data/quests';
import { UPGRADE_INDEX } from '../data/upgrades';
import { allocEntity, Kind, NpcMode } from './entities';
import { hashState } from './hash';
import { createInputFrame, type InputFrame } from './input';
import { CAPTIVE_HP, FailWhy, QuestStatus, WARD_HP, wardOf } from './quests';
import { CHANNEL } from './sites';
import { createSim, Phase, type GameState } from './state';
import { damageMob, hurtPlayer, step } from './step';

const idle = (): InputFrame[] => [0, 1, 2, 3].map(createInputFrame);
const ctx = { level: 2, boss: false, biome: 0 };

function quest(mission: MissionKind, reward: RewardKind = 'purse'): QuestDef {
  return makeQuest(0, mission, reward, ctx, 0);
}

/** A level with nothing on it but the quest: no mobs, no streaming, a tough hero. */
function field(q: QuestDef, seed = 4, boss = false): GameState {
  const s = createSim(seed, undefined, { quest: q, boss });
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) { s.ents.alive[i] = 0; s.ents.kind[i] = Kind.None; }
  s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length; s.tick = 500;
  const pe = s.players[0].ent;
  s.ents.hp[pe] = s.ents.maxhp[pe] = 1e6;
  return s;
}
function runFor(s: GameState, ticks: number): void { for (let t = 0; t < ticks; t++) step(s, idle()); }
function standAt(s: GameState, x: number, y: number): void {
  const pe = s.players[0].ent;
  s.ents.x[pe] = s.ents.px[pe] = x; s.ents.y[pe] = s.ents.py[pe] = y;
  s.camX = s.prevCamX = Math.max(0, x - 200);
}
function npcs(s: GameState): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Npc) out.push(i);
  return out;
}
function mobAt(s: GameState, type: number, x: number, y: number, hp = 9999): number {
  const i = allocEntity(s.ents, Kind.Mob, type, x, y, hp);
  s.ents.flags[i] = 1;
  return i;
}
/** The hero walks over the line: the level is won. */
function win(s: GameState): void {
  standAt(s, s.exitX + 10, 100);
  step(s, idle());
  assert.equal(s.phase, Phase.Won);
}

test('a camp offers three quests: different givers, missions and rewards, the same every time for a seed', () => {
  for (let seed = 1; seed < 40; seed++) {
    const a = questOffers(seed, ctx), b = questOffers(seed, ctx);
    assert.deepEqual(a, b);
    assert.equal(a.length, OFFERS);
    assert.equal(new Set(a.map((q) => q.npc)).size, OFFERS);
    assert.equal(new Set(a.map((q) => q.mission)).size, OFFERS);
    assert.equal(new Set(a.map((q) => q.reward)).size, OFFERS);
  }
});

test('the mix is rich: dozens of different quests come up across a run, every mission, giver and reward among them', () => {
  const seen = new Set<string>(), missions = new Set<string>(), givers = new Set<number>(), rewards = new Set<string>();
  for (let seed = 1; seed < 60; seed++) for (let level = 1; level < 9; level++) {
    for (const q of questOffers(seed, { level, boss: level % 3 === 2, biome: level % 3 })) {
      seen.add(`${q.npc}-${q.mission}-${q.reward}`); missions.add(q.mission); givers.add(q.npc); rewards.add(q.reward);
    }
  }
  assert.ok(seen.size >= 60, `${seen.size} different quests`);
  assert.equal(missions.size, MISSIONS.length);
  assert.equal(givers.size, QUEST_NPCS.length);
  assert.equal(rewards.size, REWARDS.length);
});

test('a race is never offered on a boss level, and rewards grow with the level', () => {
  for (let seed = 1; seed < 80; seed++) assert.ok(questOffers(seed, { level: 2, boss: true, biome: 0 }).every((q) => q.mission !== 'swift'));
  assert.ok(makeQuest(0, 'cull', 'purse', { ...ctx, level: 7 }).gold > makeQuest(0, 'cull', 'purse', { ...ctx, level: 1 }).gold);
});

test('no quest on a level, none in the camp: nothing changes', () => {
  const a = createSim(5), b = createSim(5, undefined, { store: true, quest: quest('escort') });
  assert.equal(a.quest, null);
  assert.equal(b.quest, null);
  assert.equal(npcs(b).length, 0);
});

test('escort: a ward stands with the party, follows it, and is still there to be paid when the field is won', () => {
  const s = field(quest('escort'));
  const w = wardOf(s);
  assert.ok(w >= 0);
  assert.equal(s.ents.hp[w], WARD_HP);
  const pe = s.players[0].ent;
  standAt(s, 600, 100);
  s.ents.x[w] = s.ents.px[w] = 590; // (the ward starts at the left edge; the test jumps the party ahead)
  runFor(s, 200);
  assert.ok(Math.abs(s.ents.x[w] - s.ents.x[pe]) < 90, 'he keeps up');
  assert.equal(s.quest!.status, QuestStatus.Active);
  const gold = s.gold;
  win(s);
  assert.equal(s.quest!.status, QuestStatus.Done);
  assert.equal(s.gold, gold + s.quest!.def.gold, 'the purse is paid at the end');
});

test('escort: the ward swings at what comes near, and it hardly scratches; what bites it hurts, and he can die', () => {
  const s = field(quest('escort'));
  const w = wardOf(s);
  standAt(s, 600, 100);
  s.ents.x[w] = s.ents.px[w] = 590; s.ents.y[w] = s.ents.py[w] = 100;
  const m = mobAt(s, MobType.Goblin, 606, 100);
  runFor(s, 140);
  assert.ok(s.ents.hp[m] < 9999 && s.ents.hp[m] > 9999 - 30, 'a few scratches');
  assert.ok(s.ents.hp[w] < WARD_HP, 'and it bit back');
  // a crowd on him
  for (let k = 0; k < 8; k++) mobAt(s, MobType.Orc, s.ents.x[w] + 4 + k, s.ents.y[w]);
  runFor(s, 600);
  assert.equal(s.quest!.status, QuestStatus.Failed);
  assert.equal(s.quest!.why, FailWhy.Died);
  assert.equal(wardOf(s), -1);
  const gold = s.gold;
  win(s);
  assert.equal(s.gold, gold, 'a dead ward pays nothing');
});

test('escort: an arrow meant for the party can take the ward instead', () => {
  const s = field(quest('escort'));
  const w = wardOf(s);
  standAt(s, 600, 100);
  s.ents.x[w] = s.ents.px[w] = 600; s.ents.y[w] = s.ents.py[w] = 100;
  const arrow = allocEntity(s.ents, Kind.Proj, 0, s.ents.x[w] - 1, s.ents.y[w] - 5, 30);
  s.ents.vx[arrow] = 0.5; s.ents.rem[arrow] = 10;
  step(s, idle());
  assert.ok(s.ents.hp[w] < WARD_HP);
  assert.ok(!s.ents.alive[arrow] || s.ents.kind[arrow] !== Kind.Proj);
});

test('escort: heroes\' blows and bursts never touch the ward', () => {
  const s = field(quest('escort'));
  const w = wardOf(s);
  standAt(s, 600, 100);
  s.ents.x[w] = s.ents.px[w] = 604; s.ents.y[w] = s.ents.py[w] = 100;
  for (let t = 0; t < 120; t++) { const f = idle(); f[0].buttons = 1; step(s, f); }
  assert.equal(s.ents.hp[w], WARD_HP);
});

test('bounty: the marked brute comes out of the hill near the place chosen, and killing it pays at once', () => {
  const s = field(quest('bounty', 'purse'), 9);
  assert.equal(s.quest!.ent, -1);
  standAt(s, s.quest!.x - 300, 100);
  runFor(s, 4);
  const brute = s.quest!.ent;
  assert.ok(brute >= 0);
  assert.equal(s.ents.elite[brute], 3);
  assert.ok(s.ents.hp[brute] > MOBS[s.ents.sub[brute]].hp * 3, 'tougher than the ordinary kind');
  const gold = s.gold;
  s.ents.flags[brute] = 1; // (arrived)
  damageMob(s, brute, 1e9, 1, 0, 0, 0, 0);
  assert.equal(s.quest!.status, QuestStatus.Done);
  assert.equal(s.gold, gold + s.quest!.def.gold);
});

test('bounty: the field won with the brute still alive is a failure', () => {
  const s = field(quest('bounty'), 9);
  win(s);
  assert.equal(s.quest!.status, QuestStatus.Failed);
  assert.equal(s.quest!.why, FailWhy.Missed);
});

test('cull: only the named kind counts, and the goal pays once', () => {
  const q = quest('cull');
  const s = field(q);
  const gold = s.gold;
  for (let k = 0; k < q.goal - 1; k++) damageMob(s, mobAt(s, q.mob, 300 + k, 100, 1), 99, 1, 0, 0, 0, 0);
  for (let k = 0; k < 20; k++) damageMob(s, mobAt(s, MobType.Boss === q.mob ? MobType.Orc : MobType.Troll, 300 + k, 100, 1), 99, 1, 0, 0, 0, 0);
  assert.equal(s.quest!.progress, q.goal - 1);
  assert.equal(s.quest!.status, QuestStatus.Active);
  damageMob(s, mobAt(s, q.mob, 300, 100, 1), 99, 1, 0, 0, 0, 0);
  assert.equal(s.quest!.status, QuestStatus.Done);
  assert.equal(s.gold, gold + q.gold);
  damageMob(s, mobAt(s, q.mob, 300, 100, 1), 99, 1, 0, 0, 0, 0);
  assert.equal(s.gold, gold + q.gold, 'not twice');
});

test('rescue: guards come when the captive is on screen; standing by the captive frees them, and that pays', () => {
  const s = field(quest('rescue', 'purse'), 9);
  const [c] = npcs(s);
  assert.equal(s.ents.mode[c], NpcMode.Captive);
  assert.ok(s.ents.x[c] > 900);
  const mobs = () => { let n = 0; for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Mob) n++; return n; };
  standAt(s, s.ents.x[c] - 800, s.ents.y[c]);
  runFor(s, 3);
  assert.equal(mobs(), 0, 'not yet');
  standAt(s, s.ents.x[c] - 60, s.ents.y[c]);
  runFor(s, 3);
  assert.ok(mobs() > 6, 'the guards come');
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) { s.ents.alive[i] = 0; s.ents.kind[i] = Kind.None; } // (the guards are beaten)
  standAt(s, s.ents.x[c] + 6, s.ents.y[c]);
  const gold = s.gold;
  runFor(s, CHANNEL - 4);
  assert.equal(s.quest!.status, QuestStatus.Active);
  runFor(s, 12);
  assert.equal(s.quest!.status, QuestStatus.Done);
  assert.equal(s.ents.mode[c], NpcMode.Freed);
  assert.equal(s.gold, gold + s.quest!.def.gold);
  runFor(s, 400);
  assert.equal(npcs(s).length, 0, 'the freed captive runs off');
});

test('rescue: cut free with guards still about, the captive cowers, and it is only done once the guards near them are dead', () => {
  const s = field(quest('rescue', 'purse'), 9);
  const [c] = npcs(s);
  standAt(s, s.ents.x[c] - 60, s.ents.y[c]);
  runFor(s, 3);
  // the guards are held off at a distance, so the ring can fill
  const guards: number[] = [];
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Mob) { s.ents.x[i] = s.ents.x[c] + 120; s.ents.y[i] = -40; s.ents.stun[i] = 9999; guards.push(i); }
  standAt(s, s.ents.x[c] + 6, s.ents.y[c]);
  runFor(s, CHANNEL + 4);
  assert.equal(s.ents.mode[c], NpcMode.Loose, 'cut free, but not safe');
  assert.equal(s.quest!.status, QuestStatus.Active);
  const slay = (g: number) => { s.ents.alive[g] = 0; s.ents.kind[g] = Kind.None; };
  for (const g of guards.slice(1)) slay(g);
  runFor(s, 30);
  assert.equal(s.quest!.status, QuestStatus.Active, 'one guard left');
  slay(guards[0]);
  runFor(s, 30);
  assert.equal(s.quest!.status, QuestStatus.Done);
  assert.equal(s.ents.mode[c], NpcMode.Freed);
});

test('rescue: the guards go for the captive, and if they kill them the quest fails', () => {
  const s = field(quest('rescue', 'purse'), 9);
  const [c] = npcs(s);
  assert.equal(s.ents.hp[c], CAPTIVE_HP);
  standAt(s, s.ents.x[c] - 60, s.ents.y[c]);
  runFor(s, 3);
  standAt(s, s.ents.x[c] - 400, s.ents.y[c]); // the party hangs back
  s.camX = s.prevCamX = s.ents.x[c] - 200;
  for (let t = 0; t < 1800 && s.quest!.status === QuestStatus.Active; t++) step(s, idle());
  assert.equal(s.quest!.status, QuestStatus.Failed);
  assert.equal(s.quest!.why, FailWhy.Died);
  assert.equal(npcs(s).length, 0);
});

test('flawless: a hero going down fails it; reaching the end with nobody down pays', () => {
  const ok = field(quest('flawless'));
  win(ok);
  assert.equal(ok.quest!.status, QuestStatus.Done);

  const s = field(quest('flawless'));
  const pe = s.players[0].ent;
  s.ents.hp[pe] = 1;
  hurtPlayer(s, 0, 50);
  runFor(s, 30); // (a hit freezes the world for a moment)
  assert.ok(s.players[0].downed || s.phase === Phase.Lost);
  assert.equal(s.quest!.status, QuestStatus.Failed);
  assert.ok(s.quest!.why === FailWhy.Fell || s.quest!.why === FailWhy.Lost);
});

test('swift: there is a clock; beating it pays, missing it does not', () => {
  const q = quest('swift');
  assert.ok(q.goal >= 60 && q.goal <= 120);
  const fast = field(q);
  fast.tick = q.goal * 60 - 30;
  win(fast);
  assert.equal(fast.quest!.status, QuestStatus.Done);
  const slow = field(q);
  slow.tick = q.goal * 60 + 5;
  runFor(slow, 2);
  assert.equal(slow.quest!.status, QuestStatus.Failed);
  assert.equal(slow.quest!.why, FailWhy.Late);
});

test('a lost field fails the quest', () => {
  const s = field(quest('cull'));
  const pe = s.players[0].ent;
  s.ents.hp[pe] = 1;
  hurtPlayer(s, 0, 1e6);
  runFor(s, 4);
  assert.equal(s.phase, Phase.Lost);
  assert.equal(s.quest!.status, QuestStatus.Failed);
});

test('every reward does what it says', () => {
  const rewards = (r: RewardKind): GameState => { const s = field(quest('flawless', r)); win(s); return s; };
  const purse = rewards('purse');
  assert.equal(purse.gold, purse.quest!.def.gold);
  const lesson = rewards('lesson');
  assert.equal(lesson.players[0].level, 2);
  assert.equal(lesson.players[0].pending, 1);
  const relic = field(makeQuest(0, 'flawless', 'relic', ctx, 2));
  const idx = relic.quest!.def.upgrade;
  win(relic);
  assert.equal(relic.players[0].ranks[idx], 1);
  assert.ok(idx === UPGRADE_INDEX.heavy || idx === UPGRADE_INDEX.thick || idx === UPGRADE_INDEX.swift || idx === UPGRADE_INDEX.windfall);
  const fortune = field(quest('flawless', 'fortune'));
  const rr = fortune.players[0].rerolls, bb = fortune.players[0].banishes;
  fortune.ents.hp[fortune.players[0].ent] = 100; fortune.ents.maxhp[fortune.players[0].ent] = 1e6;
  win(fortune);
  assert.equal(fortune.players[0].rerolls, rr + 2);
  assert.equal(fortune.players[0].banishes, bb + 1);
});

test('a level with a quest plays out the same every time', () => {
  const run = (): number => {
    const s = createSim(12, undefined, { quest: quest('escort'), boss: false });
    for (let t = 0; t < 900; t++) step(s, idle());
    return hashState(s);
  };
  assert.equal(run(), run());
});
