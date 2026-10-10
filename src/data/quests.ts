// Side quests (docs/15-quests.md): a person in the camp asks the party for a favour on the next level and pays if it is done.
//
// A quest is a giver (who asks), a mission (what the level has to show for it) and a reward (what the party is paid), mixed and matched:
// five givers x six missions x four rewards, so a run does not often see the same ask twice. Three are offered in each camp, chosen from
// the run seed. Pure data and text; the sim plays the mission (sim/quests.ts) and the renderer shows it.
import { createRng, rngFloat, rngInt, Stream } from '../engine/rng';
import { MOBS } from './mobs';
import { ROSTERS } from './roster';
import { UPGRADE_INDEX, UPGRADES } from './upgrades';

/** The art of a giver: a sheet from the art workbench (render/npcArt.ts). */
export type QuestArt = 'king' | 'captain' | 'elder' | 'herald' | 'registrar';

export interface QuestNpc {
  id: string;
  art: QuestArt;
  name: string;
  /** What a hero reads over their head before they have spoken. */
  title: string;
}

export const QUEST_NPCS: readonly QuestNpc[] = [
  { id: 'lord', art: 'king', name: 'LORD ALDRIC', title: 'A NOBLE' },
  { id: 'captain', art: 'captain', name: 'CAPTAIN VESK', title: 'A CAPTAIN' },
  { id: 'elder', art: 'elder', name: 'ELDER MORWEN', title: 'AN ELDER' },
  { id: 'herald', art: 'herald', name: 'HERALD PIPPIN', title: 'A HERALD' },
  { id: 'clerk', art: 'registrar', name: 'THE REGISTRAR', title: 'A CLERK' },
];

export type MissionKind = 'escort' | 'bounty' | 'cull' | 'rescue' | 'flawless' | 'swift';
export const MISSIONS: readonly MissionKind[] = ['escort', 'bounty', 'cull', 'rescue', 'flawless', 'swift'];

export type RewardKind = 'purse' | 'lesson' | 'relic' | 'fortune';
export const REWARDS: readonly RewardKind[] = ['purse', 'lesson', 'relic', 'fortune'];

/** One quest, as plain data: what the camp offers, the sim plays and the carry could save. */
export interface QuestDef {
  /** Index into QUEST_NPCS. */
  npc: number;
  mission: MissionKind;
  reward: RewardKind;
  /** Gold for a purse. */
  gold: number;
  /** The upgrade a relic is a rank of (index into UPGRADES). */
  upgrade: number;
  /** Cull: the mob type to slay. Bounty: unused (the sim picks the quarry from the level's brutes). */
  mob: number;
  /** Cull: how many. Swift: seconds allowed. */
  goal: number;
}

/** The relics: a rank of one of the wares' scrolls, kept as a named keepsake. */
const RELICS: readonly { id: string; name: string }[] = [
  { id: 'heavy', name: 'SIGNET OF MIGHT' },
  { id: 'thick', name: 'WARDING CHARM' },
  { id: 'swift', name: 'WINGED BOOTS' },
  { id: 'windfall', name: 'LUCKY COIN' },
];

/** How much a mission is worth against a plain purse: the harder asks pay more. */
const WORTH: Record<MissionKind, number> = { escort: 1.6, bounty: 1.3, cull: 1, rescue: 1.2, flawless: 1.5, swift: 1.2 };

/** What each giver says for each mission: the ask, in the story font's capitals, wrapped by the renderer. */
const ASKS: Record<string, Record<MissionKind, string>> = {
  lord: {
    escort: 'I WILL RIDE WITH YOU! KEEP ME ALIVE TO THE END OF THE FIELD AND I WILL MAKE IT WORTH YOUR WHILE.',
    bounty: 'A BEAST HAS BEEN RAIDING MY LANDS. BRING ME ITS HEAD AND NAME YOUR PRICE.',
    cull: 'THESE VERMIN FOUL MY ROAD. CUT DOWN {N} {MOB} AND I SHALL PAY HANDSOMELY.',
    rescue: 'MY SQUIRE WAS TAKEN. FIND HIM ON THE FIELD AND CUT HIM FREE.',
    flawless: 'A TRUE KNIGHT LOSES NOBODY. WALK THE FIELD WITH NO ONE FALLEN AND I WILL REWARD YOU.',
    swift: 'THE KING WAITS ON NO ONE. REACH THE FAR END IN {T} SECONDS AND THE PURSE IS YOURS.',
  },
  captain: {
    escort: 'GIVE ME A BLADE AND A PLACE IN YOUR LINE. KEEP ME BREATHING TO THE END, I WILL PAY.',
    bounty: 'A MARKED BRUTE LEADS THE HORDE. TAKE IT DOWN AND THE GUARD WILL PAY.',
    cull: 'THE WATCH IS THIN. KILL {N} {MOB} AND THE GUARD WILL MAKE IT WORTH YOUR TROUBLE.',
    rescue: 'ONE OF MY SCOUTS IS BOUND OUT THERE. FREE HIM BEFORE THE FIELD IS DONE.',
    flawless: 'NO ONE LEFT BEHIND. KEEP THE WHOLE PARTY STANDING AND THE GUARD IS IN YOUR DEBT.',
    swift: 'REINFORCEMENTS NEED THAT ROAD IN {T} SECONDS. CAN YOU CLEAR IT THAT FAST?',
  },
  elder: {
    escort: 'I AM OLD, BUT I KNOW THIS ROAD. LET ME WALK WITH YOU AND KEEP ME ALIVE TO ITS END.',
    bounty: 'A CURSED BEAST STALKS MY VILLAGE. END IT AND MY PEOPLE WILL GIVE YOU WHAT THEY CAN.',
    cull: 'THEY GROW BOLD. SLAY {N} {MOB} AND I WILL SEE YOU REPAID.',
    rescue: 'MY GRANDCHILD WAS TAKEN. PLEASE, FIND THE CHILD AND SET THEM FREE.',
    flawless: 'LET NO ONE FALL ON THIS ROAD AND I WILL GIVE YOU WHAT I HAVE SAVED.',
    swift: 'THE HARVEST SPOILS WITH EVERY HOUR. CLEAR THE ROAD IN {T} SECONDS.',
  },
  herald: {
    escort: 'I MUST CARRY A MESSAGE TO THE FAR END. SEE ME THERE ALIVE AND THE CROWN WILL PAY.',
    bounty: 'THE CROWN HAS NAMED A BEAST OUTLAW. BRING IT DOWN AND CLAIM THE BOUNTY.',
    cull: 'BY ROYAL DECREE, {N} {MOB} ARE TO BE CULLED. THE CROWN PAYS PER HEAD.',
    rescue: 'A COURIER OF THE CROWN WAS SEIZED. FREE THEM AND YOU WILL BE NAMED IN THE ROLLS.',
    flawless: 'THE CROWN FAVOURS A SPOTLESS COMPANY. LET NO HERO FALL AND BE REWARDED.',
    swift: 'THE CROWN ALLOWS {T} SECONDS TO CLEAR THE ROAD. THE FASTEST IS PAID.',
  },
  clerk: {
    escort: 'THE LEDGER MUST BE DELIVERED. ESCORT ME TO THE END OF THE FIELD AND YOU WILL BE PAID.',
    bounty: 'A BEAST OF NOTE IS ON THE ROLLS. DELIVER ITS DEATH AND THE FEE IS YOURS.',
    cull: 'THE COUNT IS SHORT. THE LEDGER WANTS {N} {MOB} STRUCK FROM THE ROLLS.',
    rescue: 'AN AUDITOR WAS TAKEN. FREE THEM, FOR THE PAPERWORK ALONE IS A NIGHTMARE.',
    flawless: 'THE ROLLS MUST NOT SHOW A SINGLE FALLEN HERO. KEEP THEM CLEAN FOR A BONUS.',
    swift: 'THE LEDGER CLOSES IN {T} SECONDS. REACH THE FAR END BEFORE IT DOES.',
  },
};

/** "GOBLINS" for the mob type (the bitmap font is all capitals). */
function plural(mob: number): string {
  const n = MOBS[mob].name.toUpperCase();
  return /[SX]$/.test(n) ? n : n + 'S';
}

/** A short tag for the tracker that follows the party through the level. */
export function questGoalText(q: QuestDef, progress = 0): string {
  const npc = QUEST_NPCS[q.npc];
  switch (q.mission) {
    case 'escort': return `KEEP ${npc.name} ALIVE`;
    case 'bounty': return 'SLAY THE MARKED BEAST';
    case 'cull': return `SLAY ${plural(q.mob)}  ${Math.min(progress, q.goal)}/${q.goal}`;
    case 'rescue': return progress > 0 ? 'SLAY THE GUARDS' : 'FREE THE CAPTIVE';
    case 'flawless': return 'LET NO HERO FALL';
    case 'swift': return `REACH THE END IN ${q.goal}S`;
  }
}

/** What the camp shows before a quest is accepted: the giver's ask. */
export function questAsk(q: QuestDef): string {
  const npc = QUEST_NPCS[q.npc];
  return ASKS[npc.id][q.mission].replace('{N}', String(q.goal)).replace('{MOB}', plural(q.mob)).replace('{T}', String(q.goal));
}

/** The reward, short: what the party is paid. */
export function rewardText(q: QuestDef): string {
  switch (q.reward) {
    case 'purse': return `${q.gold} GOLD`;
    case 'lesson': return 'A FREE LEVEL';
    case 'relic': return RELICS.find((r) => UPGRADE_INDEX[r.id] === q.upgrade)?.name ?? UPGRADES[q.upgrade].name;
    case 'fortune': return 'HEAL AND REROLLS';
  }
}

/** The mission as a few words, for the offer's heading. */
export function missionText(q: QuestDef): string {
  switch (q.mission) {
    case 'escort': return 'ESCORT';
    case 'bounty': return 'BOUNTY';
    case 'cull': return 'CULL';
    case 'rescue': return 'RESCUE';
    case 'flawless': return 'FLAWLESS';
    case 'swift': return 'SWIFT';
  }
}

/** The slot in UPGRADES of each relic. */
export function relicUpgrades(): number[] { return RELICS.map((r) => UPGRADE_INDEX[r.id]); }

/** The common enemy of a biome that a cull asks for: the one that fills the field from the start. */
export function cullTarget(biome: number): number { return ROSTERS[biome].entries[0].type; }

/** How many of it a cull asks for, and how many seconds a swift run gets: both grow with the level. */
export function cullGoal(level: number): number { return 24 + 3 * level; }
export function swiftSeconds(level: number): number { return Math.round((105 - 3 * Math.min(level, 8)) / 5) * 5; }

export interface QuestCtx {
  /** The route level the quest will be played on (0-based). */
  level: number;
  /** The level ends in a boss. */
  boss: boolean;
  /** The biome of that level. */
  biome: number;
}

/** How many quests a camp offers. */
export const OFFERS = 3;

/** The quest for giver `npc` doing `mission` for `reward`, with the numbers scaled to the level. */
export function makeQuest(npc: number, mission: MissionKind, reward: RewardKind, ctx: QuestCtx, pick = 0): QuestDef {
  const relics = relicUpgrades();
  return {
    npc, mission, reward,
    gold: Math.round(((45 + 22 * ctx.level) * WORTH[mission]) / 5) * 5,
    upgrade: relics[pick % relics.length],
    mob: cullTarget(ctx.biome),
    goal: mission === 'cull' ? cullGoal(ctx.level) : mission === 'swift' ? swiftSeconds(ctx.level) : 0,
  };
}

/** Which missions a level can host: a boss level ends when the boss falls, not when the far end is reached, so a race makes no sense there. */
export function missionsFor(ctx: QuestCtx): MissionKind[] {
  return MISSIONS.filter((m) => !(ctx.boss && m === 'swift'));
}

/** The quests on offer in the camp before `ctx.level`: different givers, different missions, different rewards. A function of the seed alone. */
export function questOffers(runSeed: number, ctx: QuestCtx): QuestDef[] {
  const r = createRng((runSeed ^ Math.imul(ctx.level + 7, 0x7feb352d)) >>> 0, Stream.story + 31);
  const npcs = QUEST_NPCS.map((_, i) => i);
  const missions = missionsFor(ctx);
  const rewards = REWARDS.slice();
  const out: QuestDef[] = [];
  for (let k = 0; k < OFFERS; k++) {
    const npc = npcs.splice(rngInt(r, npcs.length), 1)[0];
    const mission = missions.splice(rngInt(r, missions.length), 1)[0];
    const reward = rewards.splice(rngInt(r, rewards.length), 1)[0];
    out.push(makeQuest(npc, mission, reward, ctx, Math.floor(rngFloat(r) * 4)));
  }
  return out;
}
