// What the city says (docs/12-story.md, tier 1: hub beats). The Registrar, the tavern, the Writ board and the mood of the
// square react to where the campaign is and to what the party has done. The bitmap font has no commas or apostrophes: write without.
import { createRng, rngInt, Stream } from '../../engine/rng';

export type ClassName = 'warrior' | 'mage' | 'cleric' | 'rogue' | 'archer';
export const CLASS_ORDER: readonly ClassName[] = ['warrior', 'cleric', 'rogue', 'mage', 'archer'];

/** One line of a scene. `party` lines expand to the class voices actually in the party (up to two). */
export interface SceneLine {
  who: 'registrar' | 'narrator' | 'party';
  text?: string;
  says?: Partial<Record<ClassName, string>>;
}

/** The place a hub scene happens: one drawn set each (src/render/sceneArt.ts). */
export type Backdrop = 'tavern' | 'gates' | 'rain' | 'campfire' | 'smoke' | 'office' | 'market' | 'graves';

export interface Scene {
  /** 'R6' for a hub beat, 'R1:after' for the scene that follows a beat played in a run. */
  id: string;
  /** The beat this belongs to. A 'beat' scene IS the beat (seeing it plays it); an 'aftermath' scene follows a beat already played. */
  beat: string;
  kind: 'beat' | 'aftermath';
  backdrop: Backdrop;
  title: string;
  lines: SceneLine[];
}

const R = (text: string): SceneLine => ({ who: 'registrar', text });
const N = (text: string): SceneLine => ({ who: 'narrator', text });
const P = (says: Partial<Record<ClassName, string>>): SceneLine => ({ who: 'party', says });

/** The hub beats of the main story: the scene is the beat. */
export const HUB_SCENES: Readonly<Record<string, Scene>> = {
  R6: {
    id: 'R6', beat: 'R6', kind: 'beat', backdrop: 'market', title: 'The map',
    lines: [
      N('A mapmaker in the market sells you a sheet of vellum. It shows the city and the land around it.'),
      P({ mage: 'Look at the borders. Each year they creep outward.', cleric: 'Every one of those lines goes through a camp.', rogue: 'That is a lot of fields.', warrior: 'The city has to grow.', archer: 'That is the valley. All of it.' }),
      R('Growth is not a crime. The Crown takes only what is unused.'),
      P({ archer: 'Unused. I hunted there as a child.', cleric: 'People lived there.', mage: 'The ink is dated. The first line was drawn forty years ago.', rogue: 'Forty years. The notices say a few seasons.', warrior: 'I did not know.' }),
      N('The vellum is folded and put away. Nobody says anything on the way back.'),
    ],
  },
  R8: {
    id: 'R8', beat: 'R8', kind: 'beat', backdrop: 'office', title: 'The board pays more',
    lines: [
      N('A new notice on the Writ board. It pays double. The word cohorts is underlined.'),
      R('We are prioritizing efficiency. Targets that do not resist are cheaper to clear. We pay a premium for them.'),
      P({ rogue: 'That is backwards.', mage: 'A premium on the helpless.', cleric: 'It is for the good of the ledger. Not the city.', warrior: 'It is for the good of the city.', archer: 'Cohorts. That means the young and the old.' }),
      R('You will find the payout generous. Take it. Everyone else has.'),
    ],
  },
  R10: {
    id: 'R10', beat: 'R10', kind: 'beat', backdrop: 'office', title: 'The last settlement',
    lines: [
      R('One Writ remains. A settlement at the edge of the map. Everyone who is left.'),
      R('When it is done there will be nothing left to clear. The Crown will be very grateful.'),
      P({ warrior: 'And after?', cleric: 'I will not.', rogue: 'And if we say no?', mage: 'I have read the plan. I know what it says.', archer: 'They have nowhere left to go.' }),
      R('After there are roads and fields and peace. The Writ stands either way. You may stand with it or not.'),
      N('The board has one notice.'),
    ],
  },
};

/** The scene that follows a beat that played in a run: tavern talk, and the Registrar's view. */
export const AFTERMATH: Readonly<Record<string, Scene>> = {
  R1: {
    id: 'R1:after', beat: 'R1', kind: 'aftermath', backdrop: 'tavern', title: 'At the tavern',
    lines: [
      N('The Gilded Ladle is loud tonight. Word of your hunt has spread.'),
      R('A tidy report. The clerk marks a camp that did not fight. Strays do that. Pay it no mind.'),
      P({ warrior: 'It did not even raise a hand.', cleric: 'I keep thinking about the fire.', mage: 'Curious behavior. I made notes.', rogue: 'Free coin. I will take the next one.', archer: 'That was a hearth. I know a hearth.' }),
      R('Your next Writ is on the board. Hunt well.'),
    ],
  },
  warlord: {
    id: 'warlord:after', beat: 'warlord', kind: 'aftermath', backdrop: 'gates', title: 'The Crown gives thanks',
    lines: [
      N('The city throws open its gates for you. Banners hang from every window.'),
      R('The Warlord is dead. The north road is open. The Crown is grateful.'),
      P({ warrior: 'A great day.', cleric: 'There were so many around him. So many.', mage: 'The count in the report is lower than what I saw.', rogue: 'The pay was very good.', archer: 'He was holding the road for someone.' }),
      R('Do not trouble yourselves. There are other Writs.'),
      N('Something has changed in the party. A hand can be lowered. Hold U or pad B in the field to stand down.'),
    ],
  },
  R2: {
    id: 'R2:after', beat: 'R2', kind: 'aftermath', backdrop: 'rain', title: 'Rain over the city',
    lines: [
      N('Rain. Nobody is in the square.'),
      P({ cleric: 'There was a child. On a cart.', warrior: 'Beasts have young. It is the same thing.', mage: 'Not beasts. Not exactly.', rogue: 'I did not see anything.', archer: 'Carts do not belong to beasts.' }),
      R('Camp followers. Scavengers. The Crown classifies them together.'),
    ],
  },
  R3: {
    id: 'R3:after', beat: 'R3', kind: 'aftermath', backdrop: 'campfire', title: 'The white flag',
    lines: [
      N('The party eats in silence.'),
      P({ cleric: 'It put its weapon down. I could have wept.', warrior: 'And we walked past it.', rogue: 'Nobody paid for that one.', mage: 'Fascinating. They have a gesture for it.', archer: 'A white flag is a white flag.' }),
      R('Surrender is not recognized by the Writ. A head is a head. But the Crown is flexible about wastage.'),
    ],
  },
  R4: {
    id: 'R4:after', beat: 'R4', kind: 'aftermath', backdrop: 'smoke', title: 'A voice in the smoke',
    lines: [
      N('The mid-boss spoke. Plainly. In your own tongue.'),
      P({ warrior: 'Mimicry. Parrots do it.', cleric: 'It said please.', mage: 'Syntax. Grammar. It was a language.', rogue: 'Let us not talk about it.', archer: 'It said the road was theirs.' }),
      R('Animals repeat what they hear. It has been documented.'),
    ],
  },
  R5: {
    id: 'R5:after', beat: 'R5', kind: 'aftermath', backdrop: 'office', title: 'The quotas',
    lines: [
      N('The page is a quota table. The dates are older than the first raid.'),
      P({ mage: 'The quotas were set before anyone was attacked.', cleric: 'Then why are we here?', warrior: 'There must be an explanation.', rogue: 'There is. It is on the page.', archer: 'They were never raiding. They were running.' }),
      R('Where did you find that? It is an internal document. Please return it.'),
    ],
  },
  R7: {
    id: 'R7:after', beat: 'R7', kind: 'aftermath', backdrop: 'campfire', title: 'The Elder',
    lines: [
      N('The Elder knew the name of the Registrar. The Elder said it like a curse.'),
      P({ cleric: 'The Elder asked us to stop. We did not.', warrior: 'I do not understand.', mage: 'I do. The Elder has been writing letters for years.', rogue: 'I am done pretending.', archer: 'They asked for mercy and we gave them a Writ.' }),
      R('You have met someone I once corresponded with. Unfortunate. Shall we continue?'),
    ],
  },
  R9: {
    id: 'R9:after', beat: 'R9', kind: 'aftermath', backdrop: 'graves', title: 'The quiet',
    lines: [
      N('You walked through the Quiet Region. The dead are where you left them.'),
      P({ warrior: 'I cannot stop seeing them.', cleric: 'No one is burying them.', mage: 'I have written a letter. I will not send it.', rogue: 'I used to sleep.', archer: 'The valley is silent.' }),
      R('A reminder of why the Writ exists. Order that has been restored is quiet.'),
    ],
  },
};

// --- The Registrar's remark on a finished run (chapters 1-5) --------------------------------------------------

const REMARK_WON: readonly (readonly string[])[] = [
  ['Excellent work. The city sleeps better.', 'A fine tally. The Crown thanks you.', 'Splendid. The roads grow safer.', 'Clean work. Collect your pay.'],
  ['Another fine tally.', 'The Crown notes your dedication.', 'Efficiency. Admirable.', 'Your numbers improve.'],
  ['Pacification proceeds on schedule.', 'The reports are most satisfactory.', 'Do not trouble yourselves with the details.', 'Your thoroughness is noted.'],
  ['The quota is met. Handsomely.', 'Resettlement proceeds. Thank you.', 'The Crown rewards diligence.', 'A clean ledger.'],
  ['Almost there.', 'One more and it is done.', 'The work is nearly complete.', 'History will thank you.'],
];
const REMARK_FAILED: readonly (readonly string[])[] = [
  ['A setback. The city will wait.', 'Rest. The vermin are not going anywhere.', 'Not every hunt ends well. Try again.', 'The Crown is patient.'],
  ['Come back stronger.', 'You were fortunate to return.', 'The Crown is patient.', 'The recovery wagon was prompt.'],
  ['Your wagon was prompt. We need you alive.', 'Rest. We will need you.', 'Remember who needs you alive.', 'A pity. Try again.'],
  ['Do not tire. The quota stands.', 'We need you in the field.', 'Take a day. Then back to it.', 'The wagon will always come for you.'],
  ['The last Writ will wait for you.', 'Rest. It is nearly done.', 'There is no hurry now.', 'We can wait.'],
];
/** Chapters 2-5 (index chapter - 2). */
const REMARK_SPARED: readonly (readonly string[])[] = [
  ['I see some got away. Wastage happens.', 'A few escaped. It is noted.', 'Strays slip through. It is no matter.'],
  ['Leniency is not in the Writ. Noted.', 'Some were left alive. The ledger records it.', 'I do not pay for those you let go.'],
  ['Your unpaid targets are a tax on my patience.', 'Those you spared will not be paid.', 'Mercy is expensive. You are paying for it.'],
  ['Mercy does not appear in the ledger.', 'The ones you spared do not change the total.', 'It will not matter. Not now.'],
];
const REMARK_BETRAYED: readonly (readonly string[])[] = [
  ['Surrendered or not - a head is a head.', 'The Writ makes no distinction.', 'Thorough.'],
  ['Efficient.', 'Good. No loose ends.', 'The Crown is pleased by how thorough you are.'],
  ['That is how it is done.', 'You did not hesitate. I appreciate that.', 'A clean job.'],
  ['Thank you for not hesitating.', 'Quick. Quiet. As it should be.', 'Good.'],
];

export interface RemarkContext { chapter: number; outcome: 'won' | 'lost' | 'retreat'; spared: number; betrayed: number }

/** The Registrar's remark on a run, picked from the story stream so the same ledger state says the same thing. */
export function registrarRemark(seed: number, c: RemarkContext): string[] {
  const ch = Math.min(Math.max(c.chapter, 1), 5);
  const r = createRng(seed >>> 0, Stream.story);
  const pick = (a: readonly string[]) => a[rngInt(r, a.length)];
  const out = [pick((c.outcome === 'won' ? REMARK_WON : REMARK_FAILED)[ch - 1])];
  if (ch >= 2) {
    if (c.betrayed > 0) out.push(pick(REMARK_BETRAYED[ch - 2]));
    else if (c.spared > 0) out.push(pick(REMARK_SPARED[ch - 2]));
  }
  return out;
}

// --- The Writ board's greeting and the mood of the city -----------------------------------------------------------

const GREETING: readonly (readonly string[])[] = [
  ['Welcome back heroes.', 'The city watches.', 'Fresh notices today.', 'Good hunting to you.'],
  ['The Registrar nods.', 'New notices have come in.', 'The Crown is pleased.', 'The board is full.'],
  ['The Registrar does not look up.', 'The notices are longer now.', 'Please sign for your Writ.', 'The clerks are busy.'],
  ['The board has been rewritten.', 'The notices pay well. Take one.', 'Please do not read the fine print.', 'The queue is long.'],
  ['One notice remains.', 'The board is nearly empty.', 'The clerks have gone home.', 'Everyone is waiting.'],
];
export function boardGreeting(seed: number, chapter: number): string {
  const lines = GREETING[Math.min(Math.max(chapter, 1), 5) - 1];
  return lines[rngInt(createRng(seed >>> 0, Stream.story), lines.length)];
}

/** [low, mid, high] by how much of the campaign's toll was mercy. */
const MOOD: readonly (readonly [string, string, string])[] = [
  ['Bunting hangs from every window.', 'The square is cheerful. A few stare.', 'The square is cheerful. A few stare.'],
  ['Crowds line the street as you pass.', 'Some cheer. Some look away.', 'Fewer cheer than before.'],
  ['Pennants fly. The cheering sounds rehearsed.', 'The cheering thins.', 'A hush as you pass.'],
  ['A parade is planned in your honor.', 'A parade. Half the windows are shuttered.', 'No parade. Shutters closed.'],
  ['The whole city is waiting for you.', 'The city is waiting. Some are afraid.', 'The city is silent.'],
];
export function cityMood(chapter: number, spared: number, slain: number): string {
  const total = spared + slain;
  const share = total === 0 ? 0 : spared / total;
  return MOOD[Math.min(Math.max(chapter, 1), 5) - 1][share < 0.1 ? 0 : share < 0.3 ? 1 : 2];
}

// --- The merchant at the camp ---------------------------------------------------------------------------------------

const MERCHANT: readonly (readonly string[])[] = [
  ['A peddler has set up by the fire. Coin buys what the Crown will not.', 'A trader waves you over. Everything has a price.', 'The peddler tips a hat. Looking for an edge?'],
  ['The peddler does not ask where you have been.', 'The peddler sells to anyone with coin.', 'The goods are good. Do not ask where they came from.'],
  ['The peddler will not meet your eyes.', 'Some of the goods have names stitched inside.', 'The peddler asks only that you pay.'],
  ['The peddler has more stock than usual.', 'Everything is cheaper now. Nobody says why.', 'The peddler is doing well.'],
  ['The peddler is packing up.', 'There is little left to sell.', 'The peddler asks what you will do after.'],
];
export function merchantLine(seed: number, chapter: number): string {
  const lines = MERCHANT[Math.min(Math.max(chapter, 1), 5) - 1];
  return lines[rngInt(createRng(seed >>> 0, Stream.story), lines.length)];
}
