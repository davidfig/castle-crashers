// Generated road conversations (docs/12-story.md, "Delivery without stopping the action"). The hand-written scripts in road.ts are
// the first-time version of a scene and a set of alternates; this makes more: every conversation is put together from
//   an opener (small talk of the chapter's mood)  +  a story exchange (the scene's beat, one of several phrasings)
//   + sometimes a second aside  +  a closer (the last word to the hunters),
// with named things ({food}, {beast}, {place}...) filled from word lists. The beat is always in there, so a generated
// conversation moves the story the same way, by a road the player has not walked yet. Cosmetic; the sim never reads it.
// Plain ASCII only (the story font draws no accents or curly quotes).
import type { NpcName } from '../../render/npcArt';
import { rngInt, type Rng } from '../../engine/rng';
import { choose, fill, genRng, WORDS } from './gen';
import type { RoadLine, RoadScene, RoadScript } from './road';

/** One small exchange: who takes part (in order of first appearance), the chapters it suits, and the lines as `index|text`. */
interface Ex { npcs: readonly NpcName[]; ch: readonly [number, number]; lines: readonly string[] }
const x = (ch: readonly [number, number], npcs: readonly NpcName[], lines: readonly string[]): Ex => ({ npcs, ch, lines });

// --- Openers: small talk, in the mood of the chapter ---------------------------------------------------------------------------

export const OPENERS: readonly Ex[] = [
  // the court's certainty (I-II)
  x([1, 2], ['king', 'herald'], ['0|Herald, what is the {weather} doing to my proclamations?', '1|It has got into the ink, sire. Half of them now read as poetry.', '0|Keep the poetry. Poetry is how a bounty sounds like a blessing.']),
  x([1, 2], ['king', 'captain'], ['0|Captain, I am told the guards have been sharing {food}.', '1|Yes, Majesty. {num} portions, to the last crumb.', '0|Sharing is how mutinies start. Count the spoons.']),
  x([1, 3], ['herald', 'captain'], ['0|I practised the new proclamation on a {beast} this morning.', '1|How did it take it?', '0|It ate my hat. I am treating that as a review.']),
  x([1, 3], ['registrar', 'captain'], ['0|Captain, did you sign for the {thing}? I have it down as lost.', '1|It was never issued, Registrar.', '0|Then it was lost before issue. A neater category. Thank you.']),
  x([1, 4], ['king', 'registrar'], ['0|Registrar, is it true my likeness is stamped on the {thing+}?', '1|On all {num} of them, sire.', '0|Good. Stamp it larger. A king should be hard to lose.']),
  x([1, 2], ['king', 'herald', 'captain'], ['0|Who ordered {food} for the march? I want the name.', '1|You did, sire. At length. In verse.', '2|It was a very long verse, Majesty. We all stood for it.']),
  x([1, 2], ['herald', 'registrar'], ['0|Registrar, the crowd at {place} asked me to repeat the decree.', '1|Did they cheer?', '0|They asked me to repeat it more slowly. I am choosing to hear that as admiration.']),
  x([1, 3], ['captain', 'registrar'], ['0|Registrar, your boots squeak.', '1|They are new. They squeak with authority.', '0|They squeak in front of the camps. The camps hear us coming from a mile away.']),
  x([1, 2], ['king', 'captain'], ['0|Captain, is it true a {beast} bit the Royal Taster?', '1|It was the Taster who bit the {beast}, Majesty. By accident. In a pie.', '0|Then the {beast} was provoked. Have it pardoned.']),
  // doubt and the ledger (II-IV)
  x([2, 4], ['captain', 'herald'], ['0|I walked past {place} at dawn. The chimneys were cold.', '1|Perhaps the folk sleep late.', '0|Perhaps. I did not look in the windows. I am not proud of that.']),
  x([2, 5], ['registrar', 'herald'], ['0|Another {num} pages today. My hand is cramped from the {weather}.', '1|Shall I read them aloud for you?', '0|Do not. Aloud they sound like what they are.']),
  x([2, 4], ['registrar', 'captain'], ['0|I took to talking to my {beast}. It is the only one that does not correct my sums.', '1|It has not read them, Registrar.', '0|That is what makes it such good company.']),
  x([2, 4], ['king', 'registrar'], ['0|Registrar, the court is very quiet at dinner now. Why?', '1|Fewer of us are hungry, sire.', '0|Hungry people are loud. This is progress.']),
  x([2, 5], ['herald', 'captain'], ['0|Captain, do you sleep?', '1|On the nights I count {beast+} I do. It is the other counting that keeps me up.', '0|I have started counting {food} instead. I am very well fed and no happier.']),
  x([3, 5], ['registrar', 'herald'], ['0|I dreamed the ledger learned to read itself.', '1|And what did it say?', '0|That I should have asked what the numbers were for. I woke before it said more.']),
  x([2, 4], ['captain', 'registrar'], ['0|Someone has been leaving {food} outside the barracks, Registrar.', '1|A bribe? A threat?', '0|A thank you, I think. It is from {place}. I have not eaten it. I have not thrown it away either.']),
  // the Elder's fire, the reckoning (III-V)
  x([3, 5], ['elder', 'captain'], ['0|You have a {thing} in your belt. Is it for the fire?', '1|I... do not remember what it is for. I forgot.', '0|Then it is a good thing to forget. Sit.']),
  x([3, 5], ['elder', 'herald'], ['0|Your voice has gone quiet, Herald.', '1|I read too loudly for too long. The {weather} does the rest.', '0|Rest it. Quiet is a fine thing to practise.']),
  x([3, 5], ['elder', 'captain'], ['0|My granddaughter asks whether you are the soldier with the sad moustache.', '1|I... am. Tell her I am sorry about the moustache.', '0|She says it is the only kind thing on the road.']),
  x([3, 5], ['elder', 'herald'], ['0|I have kept every notice you ever posted, Herald.', '1|They were routine, Elder. Announcements.', '0|I wrapped the {food} in them. They were very good for that.']),
  x([4, 5], ['king', 'captain'], ['0|Captain, why do the {beast+} keep turning their backs on my banner?', '1|They have eaten the banner, sire.', '0|Then they are loyal! Feed them. No, wait, do not.']),
  x([4, 5], ['king', 'registrar'], ['0|How many are left, Registrar?', '1|{num} households, sire, and a rounding error.', '0|Round it up. Always round it up.']),
  x([4, 5], ['king', 'herald'], ['0|Herald, the crowds have grown thin. Where did the cheering go?', '1|It is in the crowd, sire. Folded very small.', '0|Then unfold it! That is what a herald is for.']),
  x([4, 5], ['registrar', 'captain'], ['0|The Crown wishes me to compliment you on your brevity, Captain.', '1|I have run out of things to report, Registrar.', '0|So have I. It is surprisingly restful.']),
  x([3, 5], ['captain', 'herald'], ['0|The sentries say they hear singing from {place} at night.', '1|What do they sing?', '0|Walking songs. They sing to keep the line moving. We have no song like that.']),
  x([3, 5], ['elder', 'herald'], ['0|Do you know the song they sing at {place} when the {weather} comes?', '1|I have only ever read proclamations.', '0|Then sit. I will teach you the first verse. It is mostly about {food}.']),
  x([3, 5], ['elder', 'herald'], ['0|Sit, Herald. I made {food}, and nobody here will bill you for it.', '1|I have forgotten how to eat without a trumpet in my hand.', '0|You will remember. Hunger is a fine teacher.']),
  x([4, 5], ['herald', 'elder'], ['0|Elder, a {beast} has followed me from {place}. Is it an omen?', '1|It is a {beast}. It wants some {food}.', '0|I had hoped for an omen. Omens are easier to explain.']),
  x([3, 5], ['captain', 'elder'], ['0|I mended your fence, Elder. Please do not tell the captain.', '1|You are the captain.', '0|Then I shall not tell myself.']),
  x([3, 5], ['elder', 'captain'], ['0|Do you play dice, soldier?', '1|Badly. The Registrar keeps the winnings.', '0|Then we play for {food}. Nobody keeps the winnings of {food}.']),
  x([3, 5], ['herald', 'registrar'], ['0|The {beast} on your desk is eating the decree.', '1|Let it. It is the first creature to read the whole thing.', '0|And?', '1|It looks quite sick.']),
  x([1, 3], ['registrar', 'captain'], ['0|I have invented a new form, Captain. It is for requesting other forms.', '1|And who approves it?', '0|Another form. It is turtles all the way down, and every turtle is in triplicate.']),
  x([1, 3], ['captain', 'registrar'], ['0|The men are asking what the {thing} on the cart is for.', '1|Tell them it is for morale.', '0|They want to know whose morale. There is only one {thing}.']),
  x([1, 2], ['registrar', 'captain'], ['0|Captain, did you eat my {food}? The ledger says there were {num} portions.', '1|The ledger also says the camp was full of soldiers, Registrar.', '0|It was a very optimistic ledger. Do try to leave me one portion next time.']),
  x([1, 3], ['captain', 'registrar'], ['0|The scouts say it will rain on {day}.', '1|Then it will rain on {day} in the report. Rain is unpredictable in the field and obedient on paper.', '0|I hope the camps get the same paper.']),
  x([2, 3], ['herald', 'captain'], ['0|I rehearsed the speech in front of a {beast}. It left halfway through.', '1|Did it say why?', '0|It looked at me the way the crowds do now. I am beginning to understand the crowds.']),
  x([2, 4], ['captain', 'herald'], ['0|Do you ever read the part of the notice that comes after the seal?', '1|There is no part after the seal.', '0|There is, Herald. It is blank. I looked at it for {num} minutes yesterday.']),
  x([2, 4], ['herald', 'captain'], ['0|I was handed a speech to read at {place} and it had my name misspelled.', '1|Wrongly?', '0|Humbly. It said Herold. A herold is someone who herds. I would like to be that.']),
];

// --- The story exchanges, scene by scene: what the chapter's beat is, put several ways ---------------------------------------------

export const BEATS: Readonly<Record<string, readonly Ex[]>> = {
  // I - The Bounty: the court is sure of itself
  c1a: [
    x([1, 1], ['captain', 'king'], ['0|Majesty, the {place} road has not seen a robbery since last spring.', '1|Then they are getting cleverer. A thief who does not steal is a thief in training.', '0|Or a farmer, sire.', '1|A farmer who does not farm for the Crown is the worst thief of all.']),
    x([1, 1], ['herald', 'king', 'captain'], ['0|Hear ye! Three coins a head, and the Crown asks no questions about the heads.', '1|Questions slow the counting.', '2|And if the head belongs to someone who was only passing, Majesty?', '1|Then they should have passed faster.']),
    x([1, 1], ['king', 'captain'], ['0|Captain, how many of the beasts have attacked us this year?', '1|None that I have recorded, sire.', '0|Exactly! They are saving up. Pay the hunters at once.']),
    x([1, 1], ['herald', 'captain'], ['0|The bounty is posted on every board from here to the coast.', '1|The notices say vermin and nothing else. Nobody says what they did.', '0|The notice is very sure of itself. I find that is half of being right.']),
  ],
  c1b: [
    x([1, 1], ['registrar', 'captain'], ['0|I make it {num} heads at the last camp, Captain. A fine morning.', '1|Most of them were asleep, Registrar.', '0|Asleep or awake, a head is a head. The Crown does not itemise posture.']),
    x([1, 1], ['captain', 'registrar'], ['0|There was a {thing} by the fire at {place}. A child\'s, by the size.', '1|Is it a weapon?', '0|It is a {thing}.', '1|Then it is not in the ledger, and neither is the child. Keep up.']),
    x([1, 1], ['registrar', 'captain'], ['0|Pay is by the head, so I ask the hunters to bring heads, not stories.', '1|They bring stories because the heads are so small, Registrar.', '0|Smaller heads, smaller stories. The count remains the count.']),
    x([1, 1], ['registrar', 'captain'], ['0|We are {num} heads ahead of the quarter. The Crown will be delighted.', '1|There was a cradle at the crossing. Is that one of the {num}?', '0|Cradles are not in the ledger.', '1|No. Only the occupants.']),
  ],
  // II - Doubt: the first cracks
  c2a: [
    x([2, 2], ['captain', 'herald'], ['0|A goblin at {place} laid down its spear and waited for me to decide.', '1|And what did you decide?', '0|I walked on. I have been deciding ever since.']),
    x([2, 2], ['herald', 'captain'], ['0|The new proclamation has a clause for beasts that surrender.', '1|What does it say?', '0|That they are to be counted twice. Once for surrendering and once for the inconvenience.']),
    x([2, 2], ['captain', 'herald'], ['0|Herald, they keep putting their hands up. Even the {beast+} are standing still.', '1|Perhaps they have heard something we have not.', '0|Perhaps they have heard us.']),
    x([2, 2], ['herald', 'captain'], ['0|I was ordered to read the bounty louder, Captain.', '1|Why louder?', '0|Because fewer people are clapping. The court has noticed.']),
  ],
  c2b: [
    x([2, 2], ['king', 'registrar'], ['0|Why is the count falling, Registrar?', '1|The northern villages have emptied, sire.', '0|Villages? Camps. Say camps.', '1|Camps. Emptied. It reads much better.']),
    x([2, 2], ['captain', 'king', 'registrar'], ['0|Majesty, the carts we passed at {place} were full of pots and children.', '1|Pots are armaments, Captain.', '0|And the children?', '1|Reserves. Write that down, Registrar.', '2|Reserves, sire. Small.']),
    x([2, 2], ['herald', 'king'], ['0|The people of {place} send word that they wish to talk.', '1|Talk? Beasts, talking? Burn the letter.', '0|It is very polite, sire.', '1|That is how you know it is a trap.']),
    x([2, 2], ['registrar', 'king', 'captain'], ['0|Sire, the bounty budget is nearly spent, yet there are more camps.', '1|Then lower the price per head.', '0|The hunters will take less, sire. They are hungry.', '2|So are the camps, Majesty.']),
  ],
  // III - The Ledger: the dates do not fit
  c3a: [
    x([3, 3], ['herald', 'registrar'], ['0|You have been staring at that page since {day}.', '1|The date on the quota is older than the first complaint.', '0|A clerk\'s slip.', '1|My clerk. My ink. My slip.']),
    x([3, 3], ['registrar', 'herald'], ['0|Herald, if I told you the attacks were scheduled, what would you say?', '1|That someone is joking.', '0|I have the schedule. It is signed.', '1|Then it is not a joke. It is worse. It is administration.']),
    x([3, 3], ['herald', 'registrar'], ['0|I read the bounty at {place} again today. The crowd did not cheer.', '1|They never cheered when it was fresh.', '0|They did, Registrar. Back when I believed it too.']),
    x([3, 3], ['registrar', 'herald'], ['0|The Crown asked me to revise the dates.', '1|Will you?', '0|I have the pen in my hand. It is not a heavy pen. It feels very heavy.']),
  ],
  c3b: [
    x([3, 3], ['elder', 'captain'], ['0|We farmed {place} before your walls had a name, soldier.', '1|I have seen the old terraces. They are beautiful.', '0|They were. You are standing on one.']),
    x([3, 3], ['captain', 'elder'], ['0|Elder, why does no one run when we come?', '1|Running is for those who think they will be chased fairly.', '0|That is a hard thing to hear.', '1|It is a harder thing to live.']),
    x([3, 3], ['elder', 'captain'], ['0|I wrote the Registrar {num} letters this winter.', '1|Did he answer?', '0|He sent a receipt each time. It is a kind of reply.']),
    x([3, 3], ['elder', 'captain'], ['0|The children ask why the soldiers come with ledgers instead of swords.', '1|What do you tell them?', '0|That the ledger is the sharper of the two.']),
  ],
  // IV - Complicity: paid more for the helpless
  c4a: [
    x([4, 4], ['king', 'registrar', 'captain'], ['0|The new rate is in force: double for any camp that does not resist.', '1|Sire, they do not resist because no one is left to resist.', '0|Excellent. Efficiency.', '2|The ones left are the old and the very young, Majesty.']),
    x([4, 4], ['herald', 'king'], ['0|Majesty, shall I proclaim the new rate?', '1|Proclaim it warmly.', '0|How does one warmly proclaim pay for the defenceless?', '1|Smile. It carries.']),
    x([4, 4], ['registrar', 'captain'], ['0|The hunters now wait outside {place} until the fighters go.', '1|Until the fighters leave, Registrar. Then they walk in.', '0|It is the most efficient war in history.']),
    x([4, 4], ['king', 'captain'], ['0|Captain, why are your reports getting shorter?', '1|There is less to say, sire.', '0|Good. Shorter reports are cheaper to bind.']),
  ],
  c4b: [
    x([4, 4], ['captain', 'herald'], ['0|I have been asked to carry the new proclamation to {place}.', '1|Will you?', '0|I will carry it. I will not read it. I will let the wind do that.']),
    x([4, 4], ['herald', 'captain'], ['0|The new decree is {num} pages. I am to read all of them aloud.', '1|In one sitting?', '0|I intend to stop and breathe. For a long time. Several times.']),
    x([4, 4], ['captain', 'herald'], ['0|If I desert, Herald, will you cover for me?', '1|I will say you went to fetch water.', '0|That is what we said about Hobb.', '1|Hobb is very well. He sent a letter from the south.']),
    x([4, 4], ['herald', 'captain'], ['0|I am learning to read slowly, Captain.', '1|Is there a trick?', '0|You say each word as though it were someone\'s name.']),
  ],
  // V - Reckoning: the last settlement
  c5a: [
    x([5, 5], ['registrar', 'king'], ['0|One settlement left, sire. {place}. Then the ledger is finished.', '1|And then?', '0|And then, I suppose, I am unemployed.', '1|We are all unemployed after a victory. It is a terrible thing.']),
    x([5, 5], ['captain', 'king'], ['0|Majesty, the folk at {place} have no weapons left.', '1|Then it will be quick. Quick is merciful.', '0|Not to the one it comes for.']),
    x([5, 5], ['king', 'registrar', 'captain'], ['0|When the last camp is cleared, what will the Crown fear?', '1|Rising taxes, sire.', '0|Taxes are boring. I want something with teeth.', '2|There is one thing left with teeth, Majesty, and it is us.']),
    x([5, 5], ['registrar', 'captain'], ['0|I have drafted a closing line for the ledger.', '1|What does it say?', '0|Resolved. Only that. It sounds so tidy.', '1|It is the least tidy thing I have ever heard.']),
  ],
  c5b: [
    x([5, 5], ['elder', 'herald'], ['0|Read me the decree, Herald.', '1|I would rather read you a recipe.', '0|Read me the recipe, then. Quietly. And then the decree.']),
    x([5, 5], ['herald', 'elder'], ['0|I told the story in {place} today. Four people stopped.', '1|Four is a crowd. Who were they?', '0|A baker, a child, a man with a {beast}, and a woman who only wished to pass.', '1|She heard some, then. Everyone does.']),
    x([5, 5], ['elder', 'herald'], ['0|Do you remember the first thing you read for the Crown?', '1|A notice for a {food} festival.', '0|And the last?', '1|A notice for a funeral that had not happened yet.']),
    x([5, 5], ['herald', 'elder'], ['0|Elder, will you forgive us?', '1|Forgiveness is not mine to hand out like {food}.', '0|Then what is it?', '1|A road. You walk it. We keep the fire lit.']),
  ],
};

// --- Closers: the last word to the hunters ------------------------------------------------------------------------------------

export const CLOSERS: readonly Ex[] = [
  x([1, 2], ['king'], ['0|Walk on, hunters! The Crown is watching, and the {food} is waiting.']),
  x([1, 5], ['king'], ['0|Do not dawdle, hunters. A king\'s patience lasts only as long as his {food} stays warm.']),
  x([1, 3], ['king'], ['0|Bring me the count by {day}, hunters. I am told that is a day.']),
  x([4, 5], ['king'], ['0|Onward, hunters. The Crown does not care to be kept waiting, and neither does the {food}.']),
  x([1, 2], ['herald'], ['0|Hear ye: the hunters are doing splendidly! That was a rehearsal. Do carry on.']),
  x([1, 3], ['herald'], ['0|Go well, hunters. Mind the {weather}, and mind the Crown.']),
  x([3, 5], ['herald'], ['0|Walk gently, hunters. Some of us are listening.']),
  x([2, 5], ['captain'], ['0|Go carefully, hunters. And look in the windows.']),
  x([1, 3], ['captain'], ['0|Careful out there, hunters. The {weather} has a way of hiding things.']),
  x([2, 4], ['herald'], ['0|If anyone asks, I did not hear a word you said, hunters. Neither did the {beast}.']),
  x([2, 3], ['registrar'], ['0|The ledger thanks you, hunters. I find I am no longer certain it should.']),
  x([1, 2], ['captain'], ['0|On you go, hunters. Keep clear of the {beast+}. They bite when they are reminded of the Taster.']),
  x([2, 4], ['captain'], ['0|Do as you see fit, hunters. I will not write down what I did not see.']),
  x([1, 4], ['registrar'], ['0|Keep the count, hunters. Counts are the one thing I trust.']),
  x([1, 3], ['registrar'], ['0|Do keep up, hunters. The {num} below the line will not tally themselves.']),
  x([3, 5], ['registrar'], ['0|Mind the ledger on your way out. Do not read it. ...Read it.']),
  x([3, 5], ['elder'], ['0|Walk on, hunters. Come back when you have something worth telling me.']),
  x([3, 5], ['elder'], ['0|Take some {food} for the road. It is the best I can do.']),
  x([3, 5], ['elder'], ['0|The path is long, hunters. The fire stays lit behind you.']),
];

// --- Assembly -------------------------------------------------------------------------------------------------------------

function eligible(pool: readonly Ex[], cast: readonly NpcName[], chapter: number): Ex[] {
  return pool.filter((e) => chapter >= e.ch[0] && chapter <= e.ch[1] && e.npcs.every((n) => cast.includes(n)));
}

/** Turns an exchange into script lines, mapping its speakers onto the scene's cast. */
function lines(e: Ex, sc: RoadScene, r: Rng, used: Map<string, readonly [string, string]>): RoadLine[] {
  return e.lines.map((l) => {
    const bar = l.indexOf('|');
    const npc = e.npcs[Number(l.slice(0, bar))];
    return { who: sc.cast.findIndex((f) => f.npc === npc), text: fill(l.slice(bar + 1), r, used) };
  });
}

/**
 * A new conversation for `sc`, a pure function of (scene, salt): an opener, the scene's story exchange, now and then a second
 * aside, and a closer. Never fewer than 4 lines; the story exchange is always in it.
 */
export function generateScript(sc: RoadScene, salt: number): RoadScript {
  const cast = sc.cast.map((f) => f.npc);
  const beats = BEATS[sc.id] ?? [];
  if (beats.length === 0) return sc.lines;
  const openers = eligible(OPENERS, cast, sc.chapter);
  const closers = eligible(CLOSERS, cast, sc.chapter);
  let parts: RoadLine[][] = [];
  // a few tries at a conversation where nobody answers themselves across a seam between parts; the last try stands regardless
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = genRng(sc.chapter * 7919 + sc.level * 104729, salt * 8 + attempt);
    const used = new Map<string, readonly [string, string]>();
    const first = openers.length ? choose(r, openers) : undefined;
    parts = [];
    if (first) parts.push(lines(first, sc, r, used));
    parts.push(lines(choose(r, beats), sc, r, used));
    if (parts.flat().length <= 6 && openers.length > 1 && rngInt(r, 2) === 0) parts.push(lines(choose(r, openers.filter((o) => o !== first)), sc, r, used));
    if (closers.length) parts.push(lines(choose(r, closers), sc, r, used));
    if (parts.every((p, i) => i === 0 || p[0].who !== parts[i - 1][parts[i - 1].length - 1].who)) break;
  }
  return parts.flat();
}

/** How many different conversations a scene can make, ignoring the word lists (for the tests and the docs). */
export function generatedCount(sc: RoadScene): number {
  const cast = sc.cast.map((f) => f.npc);
  const o = eligible(OPENERS, cast, sc.chapter).length;
  const c = eligible(CLOSERS, cast, sc.chapter).length;
  const b = (BEATS[sc.id] ?? []).length;
  return b * Math.max(1, o) * Math.max(1, c) + b * Math.max(1, o * (o - 1)) * Math.max(1, c);
}

export const SLOT_NAMES: readonly string[] = Object.keys(WORDS);
