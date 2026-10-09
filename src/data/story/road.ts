// Scenes the party can stumble on along the road (docs/12-story.md, "Delivery without stopping the action"). A scene is a small
// cast of non-combatants standing in a cleared stretch of the field, talking to each other. Nothing about it is forced: a hero who
// lingers within earshot hears the conversation, line by line; one who keeps walking hears nothing, and the story simply goes on
// without them. Cosmetic: the sim only clears a patch of road for it (see `planLevel`), it never reads the script.
//
// One scene per (chapter, level of the biome) on the first two levels; the third level ends in a boss. The chapters follow the
// story: the court's certainty, then its doubt, the ledger, the complicity, and the reckoning.
// The story font draws no accents or curly quotes: plain ASCII only.
import type { NpcName } from '../../render/npcArt';

export interface RoadFigure {
  npc: NpcName;
  /** Offset from the scene's centre, in field pixels. */
  dx: number;
  dy: number;
  /** Which way they face at rest: 1 right, -1 left (toward the party as it arrives). */
  face: 1 | -1;
}

export interface RoadLine {
  /** Index into the scene's `cast`. */
  who: number;
  text: string;
}

export interface RoadScene {
  id: string;
  chapter: number;
  /** Level within the chapter's biome (0 or 1). */
  level: number;
  cast: readonly RoadFigure[];
  lines: readonly RoadLine[];
}

const KING = 'king', HERALD = 'herald', CAPTAIN = 'captain', REGISTRAR = 'registrar', ELDER = 'elder';

export const ROAD_SCENES: readonly RoadScene[] = [
  // I - The Bounty: the court is sure of itself
  {
    id: 'c1a', chapter: 1, level: 0,
    cast: [{ npc: KING, dx: 0, dy: 0, face: -1 }, { npc: HERALD, dx: 34, dy: 10, face: -1 }, { npc: CAPTAIN, dx: -34, dy: 8, face: 1 }],
    lines: [
      { who: 1, text: 'Hear ye! By the Crown\'s seal, a bounty on every beast beyond the walls!' },
      { who: 0, text: 'Three coins a head, and a fourth for a chieftain. The roads will be safe by harvest.' },
      { who: 2, text: 'Majesty, the roads were quiet all winter. Most of them keep to their camps.' },
      { who: 0, text: 'Quiet is how they lull us, Captain. Quiet is how they breed.' },
      { who: 1, text: 'Ah, the bounty hunters! Walk on, brave ones. The Crown is watching.' },
      { who: 0, text: 'Go. Bring me their count.' },
    ],
  },
  {
    id: 'c1b', chapter: 1, level: 1,
    cast: [{ npc: REGISTRAR, dx: -18, dy: 0, face: 1 }, { npc: CAPTAIN, dx: 20, dy: 8, face: -1 }],
    lines: [
      { who: 0, text: 'Forty-one at the last crossing. Forty-one! The Crown will be so pleased.' },
      { who: 1, text: 'I walked the camp afterward. There were small shoes by the fire.' },
      { who: 0, text: 'Shoes are not in the ledger, Captain.' },
      { who: 1, text: 'No. I suppose they are not.' },
      { who: 0, text: 'Do keep up. We are paid by the head, and the heads will not count themselves.' },
    ],
  },
  // II - Doubt: the first cracks
  {
    id: 'c2a', chapter: 2, level: 0,
    cast: [{ npc: CAPTAIN, dx: -22, dy: 0, face: 1 }, { npc: HERALD, dx: 22, dy: 8, face: -1 }],
    lines: [
      { who: 1, text: 'You have not touched your bread, Captain.' },
      { who: 0, text: 'A goblin put down its spear yesterday. Looked me straight in the eye.' },
      { who: 1, text: 'And?' },
      { who: 0, text: 'And I could not find what the bounty says about that.' },
      { who: 1, text: 'It says per head. It always says per head.' },
      { who: 0, text: 'Yes. That is what I am afraid of.' },
    ],
  },
  {
    id: 'c2b', chapter: 2, level: 1,
    cast: [{ npc: KING, dx: 0, dy: 0, face: -1 }, { npc: REGISTRAR, dx: -34, dy: 8, face: 1 }, { npc: HERALD, dx: 34, dy: 8, face: -1 }],
    lines: [
      { who: 0, text: 'The count has slowed. Why has the count slowed?' },
      { who: 1, text: 'They flee north, sire. Whole villages of them, carts and all.' },
      { who: 0, text: 'Then the hills must be cleared as well.' },
      { who: 1, text: 'Villages, sire. They are villages.' },
      { who: 0, text: 'Camps. We will call them camps. It sits better in the ledger.' },
      { who: 2, text: 'Camps. Yes, sire. I shall have it proclaimed.' },
    ],
  },
  // III - The Ledger: the paper trail
  {
    id: 'c3a', chapter: 3, level: 0,
    cast: [{ npc: REGISTRAR, dx: -20, dy: 0, face: 1 }, { npc: HERALD, dx: 20, dy: 8, face: -1 }],
    lines: [
      { who: 1, text: 'You are frowning at the old decrees. You never frown.' },
      { who: 0, text: 'The quota is dated the winter before the first complaint.' },
      { who: 1, text: 'A clerk\'s error, surely. A slip of the date.' },
      { who: 0, text: 'I wrote it myself. In ink. I remember the pen.' },
      { who: 1, text: 'Then the bounty was never an answer to anything.' },
      { who: 0, text: 'It was the plan, Herald. The attacks were meant to follow.' },
    ],
  },
  {
    id: 'c3b', chapter: 3, level: 1,
    cast: [{ npc: ELDER, dx: -22, dy: 0, face: 1 }, { npc: CAPTAIN, dx: 22, dy: 8, face: -1 }],
    lines: [
      { who: 0, text: 'You are the one who did not strike at the ford.' },
      { who: 1, text: 'I am one of the ones who did, too.' },
      { who: 0, text: 'Yes. But you came back to look. That is not nothing.' },
      { who: 1, text: 'Why do you not run, old one?' },
      { who: 0, text: 'My legs are tired, and the valley is mine. We farmed it before your walls had a name.' },
      { who: 0, text: 'Sit a while. The fire is warm. The dead do not mind.' },
    ],
  },
  // IV - Complicity: the price
  {
    id: 'c4a', chapter: 4, level: 0,
    cast: [{ npc: KING, dx: 0, dy: 0, face: -1 }, { npc: REGISTRAR, dx: -34, dy: 8, face: 1 }, { npc: HERALD, dx: 34, dy: 8, face: -1 }],
    lines: [
      { who: 0, text: 'Double the pay for any camp that does not resist.' },
      { who: 1, text: 'Sire, they do not resist because they have no fighters left.' },
      { who: 0, text: 'Then it is cheaper work. Pay it.' },
      { who: 2, text: 'The Crown now pays more for the helpless than for the brave, sire.' },
      { who: 0, text: 'The Crown pays for results, Herald. Mind your trumpet.' },
    ],
  },
  {
    id: 'c4b', chapter: 4, level: 1,
    cast: [{ npc: CAPTAIN, dx: -20, dy: 0, face: 1 }, { npc: HERALD, dx: 20, dy: 8, face: -1 }],
    lines: [
      { who: 0, text: 'I will not carry the next proclamation. Find another.' },
      { who: 1, text: 'Then I will read it myself.' },
      { who: 0, text: 'Do you believe a word of it?' },
      { who: 1, text: 'I believe someone will read it. I would rather it were me, and gentle.' },
      { who: 0, text: 'There is no gentle way to read that.' },
      { who: 1, text: 'No. But I can read it slowly.' },
    ],
  },
  // V - Reckoning: the end of the road
  {
    id: 'c5a', chapter: 5, level: 0,
    cast: [{ npc: KING, dx: 0, dy: 0, face: -1 }, { npc: REGISTRAR, dx: -34, dy: 8, face: 1 }, { npc: CAPTAIN, dx: 34, dy: 8, face: -1 }],
    lines: [
      { who: 1, text: 'One settlement left, sire. Then the book is full, and the Crown gives thanks.' },
      { who: 0, text: 'And the coin stops, I suppose. Nothing left outside to be afraid of.' },
      { who: 2, text: 'Then what will the people fear, Majesty?' },
      { who: 0, text: 'Something will turn up. Something always does.' },
      { who: 2, text: 'That is the part that frightens me.' },
    ],
  },
  {
    id: 'c5b', chapter: 5, level: 1,
    cast: [{ npc: ELDER, dx: -20, dy: 0, face: 1 }, { npc: HERALD, dx: 20, dy: 8, face: -1 }],
    lines: [
      { who: 0, text: 'You are the last of the readers. Read me the decree.' },
      { who: 1, text: 'I cannot.' },
      { who: 0, text: 'Then you understood it long ago.' },
      { who: 1, text: 'I understood it every time I read it aloud.' },
      { who: 0, text: 'Good. Someone must remember it. Tell them what you saw.' },
      { who: 1, text: 'Who would listen to a herald?' },
      { who: 0, text: 'Those who stopped to hear. There are always a few.' },
    ],
  },
];

export const SCENE_BY_ID: Readonly<Record<string, RoadScene>> = Object.fromEntries(ROAD_SCENES.map((c) => [c.id, c]));

/** The scene on a level of the road: none on a boss level. */
export function roadSceneFor(chapter: number, levelInBiome: number, boss: boolean): RoadScene | undefined {
  if (boss) return undefined;
  return ROAD_SCENES.find((c) => c.chapter === chapter && c.level === levelInBiome);
}

/** How far along the field (0..1) the scene stands: a function of the level seed alone, clear of the staged beats (0.3) and of the final stand (the clearing ahead of it must not reach the wall at the end). */
export function roadSceneT(seed: number): number {
  const h = Math.imul(seed ^ 0x51ed270b, 0x85ebca6b) >>> 0;
  return 0.46 + (h % 11) / 100;
}

/**
 * What a hero says about a scene, by class and chapter (index = chapter - 1): [partway, at the end]. The class keeps its stance from
 * the barks (docs/12-story.md): the warrior believes longest, the cleric feels it first, the rogue counts the coin, the mage the
 * numbers, the archer remembers the hills. Lines are chapter-wide, so they fit either scene of the chapter.
 */
export const ROAD_REACTIONS: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  warrior: [
    ['Hear that? The Crown itself stands behind us.', 'Good people. Let us earn that coin.'],
    ['Orders are orders.', 'Do not look at me like that.'],
    ['That cannot be right.', 'The Crown is not like that. It cannot be.'],
    ['Paid more for the helpless. I feel sick.', 'I carried this sword for that?'],
    ['One settlement. I could stop at the gate.', 'We were the good ones. We were not.'],
  ],
  cleric: [
    ['A fine blessing on the work, then.', 'I will pray for their safety. And ours.'],
    ['That did not sound like a blessing.', 'Something is wrong here. I can feel it.'],
    ['Written before the first attack. Oh no.', 'We were never the answer. We were the plan.'],
    ['Forgive us. Please forgive us.', 'No blessing covers this.'],
    ['There is still one thing left to refuse.', 'Mercy is the only holy thing left.'],
  ],
  rogue: [
    ['Everyone gets paid by the head, it seems.', 'Nobody told me the pay was this good.'],
    ['Camps. Villages. Same coin?', 'I am starting to dislike this job.'],
    ['Dated before the trouble. Classic.', 'So the bounty came first. Everyone was lied to.'],
    ['I have robbed honest folk. This is worse.', 'The coin is not worth it. Not anymore.'],
    ['Nothing left to steal but a conscience.', 'Maybe I get out while I still can.'],
  ],
  mage: [
    ['I should like to see the numbers.', 'Fascinating. So much paperwork for beasts.'],
    ['The words keep changing. Interesting.', 'Someone is rewording the ledger as we go.'],
    ['I knew those dates did not fit!', 'I would like to see the rest of that ledger.'],
    ['It is arithmetic now. Only arithmetic.', 'The sum of it is horrifying.'],
    ['The final sum. I do not want the answer.', 'Some numbers should never be completed.'],
  ],
  archer: [
    ['The hills are quiet. Why the hurry?', 'Odd. I have not seen these beasts do harm.'],
    ['I saw those carts. Those were families.', 'They are not what the notice says.'],
    ['I have walked that valley. It was farmland.', 'They were here first. I think I always knew.'],
    ['I did not draw my bow at the last camp.', 'I will not draw it on the kneeling again.'],
    ['They knew us by sight. We never knew them.', 'I will carry this into the hills for good.'],
  ],
};
