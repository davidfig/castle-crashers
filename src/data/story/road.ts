// Scenes the party can stumble on along the road (docs/12-story.md, "Delivery without stopping the action"). A scene is a small
// cast of non-combatants standing in a cleared stretch of the field, talking to each other. Nothing about it is forced: a hero who
// lingers within earshot hears the conversation, line by line; one who keeps walking hears nothing, and the story simply goes on
// without them. Cosmetic: the sim only clears a patch of road for it (see `planLevel`), it never reads the script.
//
// One scene per (chapter, level of the biome) on the first two levels; the third level ends in a boss. The chapters follow the
// story: the court's certainty, then its doubt, the ledger, the complicity, and the reckoning.
//
// A scene is met many times over a campaign, so it holds several conversations: `lines` is the set first-time script (the
// version that carries the chapter's beat), and `variants` are alternates for every later hearing. Each variant moves the same
// story forward by a different road, is funnier or odder than it strictly needs to be, and lets different cast members talk
// (the guards and the Herald get a say even when the King holds court). `scriptFor` picks which one plays.
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

export type RoadScript = readonly RoadLine[];

export interface RoadScene {
  id: string;
  chapter: number;
  /** Level within the chapter's biome (0 or 1). */
  level: number;
  cast: readonly RoadFigure[];
  /** The first-time script: always the same. */
  lines: RoadScript;
  /** Alternate conversations for later hearings, same cast. */
  variants: readonly RoadScript[];
}

const KING = 'king', HERALD = 'herald', CAPTAIN = 'captain', REGISTRAR = 'registrar', ELDER = 'elder';

/** A tiny pure hash of a scene id, so each scene starts its rotation of variants somewhere different. */
function idHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The script for a scene heard `heard` times before: the set first-time script on the first meeting, then the variants in a
 * rotation (starting point fixed by the scene id) so the same conversation never plays twice running and every one is heard
 * before any repeats. `forced` (dev aid, ?variant=N) picks one directly: 0 the first-time script, k the k-th variant.
 */
export function scriptFor(sc: RoadScene, heard: number, forced?: number): RoadScript {
  if (forced !== undefined) return forced <= 0 || sc.variants.length === 0 ? sc.lines : sc.variants[(forced - 1) % sc.variants.length];
  if (heard <= 0 || sc.variants.length === 0) return sc.lines;
  return sc.variants[(idHash(sc.id) + heard - 1) % sc.variants.length];
}

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
    variants: [
      [
        { who: 1, text: 'Hear ye, hear ye! And also hear me, because the King insists I rehearse on the road.' },
        { who: 0, text: 'Louder. The beasts must know the price on their heads.' },
        { who: 2, text: 'Majesty, they cannot read. Some of them cannot hear us either. We are quite far.' },
        { who: 0, text: 'Then the price must be very large, and the print very small.' },
        { who: 1, text: 'The small print says the bounty also covers beasts we have not met yet.' },
        { who: 0, text: 'Efficient. Walk on, hunters. Bring me a count, and a souvenir if it is shiny.' },
      ],
      [
        { who: 2, text: 'Sire, the guards ask whether they might share in the bounty.' },
        { who: 0, text: 'Guards are paid to guard. Hunters are paid to hunt. It is a very tidy system.' },
        { who: 2, text: 'The guards say a hunter earns in a week what they earn in a year.' },
        { who: 0, text: 'Then the guards should hunt. Captain, are you free on Thursday?' },
        { who: 2, text: 'I am a guard, Majesty. I guard. It says so on my hat.' },
        { who: 1, text: 'Ah, the bounty hunters! The Crown is watching. Mostly the Crown is eating.' },
      ],
      [
        { who: 1, text: 'The Crown has issued a decree on the correct way to feel about goblins.' },
        { who: 0, text: 'Afraid. Politely afraid. With a small bow at the end.' },
        { who: 2, text: 'I fought a goblin once, Majesty. It asked me for directions.' },
        { who: 0, text: 'A cunning ploy! Which way did you point?' },
        { who: 2, text: 'To the market. It was lost. It was carrying a pie.' },
        { who: 0, text: 'A pie. Mark it down. The beasts are armed with pies.' },
        { who: 1, text: 'Marked, sire. In the column headed Armaments.' },
      ],
      [
        { who: 0, text: 'Is this the fourth bounty, or have we started the fifth? I lose track.' },
        { who: 1, text: 'The fourth, sire. The fifth is for the ones who hide very well.' },
        { who: 2, text: 'Sire, the ones who hide well are mostly farmers. Behind their farms.' },
        { who: 0, text: 'Then they are hiding on farms, Captain. Write that down.' },
        { who: 2, text: 'That is just where they live, Majesty.' },
        { who: 0, text: 'Exactly my point. Hunters, onward! Do try to get the horns.' },
      ],
      [
        { who: 1, text: 'Hear ye! Any hunter who falls in the field shall be raised by the Order, free of charge!' },
        { who: 2, text: 'Free? Last time the clerics billed me for a new spleen.' },
        { who: 0, text: 'The spleen is extra, Captain. The dying itself is on the Crown.' },
        { who: 1, text: 'Majesty, do the beasts have an Order of their own?' },
        { who: 0, text: 'Beasts have no clerics, Herald. A goblin dies once and stays dead. That is what makes it a goblin.' },
        { who: 2, text: 'So we get up again and they do not. A lopsided sort of war, Majesty.' },
        { who: 0, text: 'Lopsided is the best kind. Walk on, hunters! Die as often as you like.' },
      ],
      [
        { who: 1, text: 'The royal map is finished, sire. Everything past the wall is labelled Vermin.' },
        { who: 0, text: 'Good. Clear, simple, and it fits on one scroll.' },
        { who: 2, text: 'Majesty, the mapmaker has never been past the wall. He drew the goblins from a bad dream.' },
        { who: 0, text: 'And a fine dream it was. Look at the teeth on that one.' },
        { who: 2, text: 'The real ones have very ordinary teeth, sire. One showed me. He was proud of them.' },
        { who: 1, text: 'Shall I add a footnote, sire? Teeth ordinary, owner proud?' },
        { who: 0, text: 'No footnotes. Footnotes make people read. Walk on, hunters!' },
      ],
      [
        { who: 0, text: 'When the beasts are cleared, I shall plant orchards from the wall to the river.' },
        { who: 2, text: 'There are orchards there already, Majesty. The goblins planted them.' },
        { who: 0, text: 'How thoughtful. They have saved us the digging.' },
        { who: 1, text: 'Hear ye! The Crown thanks the vermin for their gardening. They have until harvest to leave.' },
        { who: 2, text: 'Leave for where, Herald?' },
        { who: 1, text: 'The decree did not say. It ran out of parchment.' },
        { who: 0, text: 'Then it is settled. Hunters, mind the apple trees. Those are mine now.' },
      ],
      [
        { who: 0, text: 'The trophy hall is looking very bare, Captain. I want horns by Midsummer.' },
        { who: 2, text: 'Sire, most goblins have no horns. They have ears. Rather nice ears.' },
        { who: 0, text: 'Then I shall have ears. Mounted in a row, by size.' },
        { who: 1, text: 'The royal carpenter asks how many hooks to order, sire.' },
        { who: 0, text: 'All of them. Order every hook in the kingdom, and then a few more.' },
        { who: 2, text: 'That is a great many hooks, Majesty, for folk who mostly keep to their camps.' },
        { who: 0, text: 'A hook is never wasted, Captain. Walk on, hunters, and bring me ears.' },
      ],
      [
        { who: 1, text: 'Hear ye! The Crown\'s new price list. Three coins a goblin, five an orc, seven a troll.' },
        { who: 2, text: 'Majesty, what if the troll is only carrying firewood?' },
        { who: 0, text: 'Then it is a troll carrying firewood, Captain. Seven coins, and keep the firewood.' },
        { who: 1, text: 'Sire, a hunter asks whether the old grey ones are cheaper.' },
        { who: 0, text: 'Full price! Old ones know things. Knowing things is very dangerous.' },
        { who: 2, text: 'The old one I met knew how to mend a roof, Majesty. She showed me.' },
        { who: 0, text: 'Exactly. Next she would have mended ours. Walk on, hunters. The Crown loves a bargain.' },
      ],
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
    variants: [
      [
        { who: 0, text: 'Good news. I have invented a new column in the ledger. It is for bonus heads.' },
        { who: 1, text: 'What is a bonus head?' },
        { who: 0, text: 'A head we were not expecting. Delightful, really.' },
        { who: 1, text: 'There is a camp ahead with an old woman knitting. I do not think she expected us either.' },
        { who: 0, text: 'Does she have a head?' },
        { who: 1, text: '...Yes.' },
        { who: 0, text: 'Then she is in the ledger. Splendid. Keep up, Captain.' },
      ],
      [
        { who: 0, text: 'I have lost a pen. This is the worst day of the campaign.' },
        { who: 1, text: 'There was a cook in the last camp. She had a cleaver, and she did not use it on us.' },
        { who: 0, text: 'Pens do not grow on trees, Captain. They grow on geese, and the geese are scarce.' },
        { who: 1, text: 'She put the cleaver down and made tea instead.' },
        { who: 0, text: 'Tea! Was it good tea? ...Never mind. Tea is not in the ledger.' },
        { who: 1, text: 'It was very good tea.' },
      ],
      [
        { who: 0, text: 'A hunter tells me the goblins are oddly polite. I have corrected him in writing.' },
        { who: 1, text: 'He is not wrong. One thanked me for the bread I dropped.' },
        { who: 0, text: 'A goblin that thanks you is a goblin that wants your bread. It is practically theft.' },
        { who: 1, text: 'It was my bread. I dropped it.' },
        { who: 0, text: 'Precisely. Now nobody owes anybody anything, and the ledger balances.' },
        { who: 1, text: 'That is not what balanced means, Registrar.' },
      ],
      [
        { who: 0, text: 'Splendid news. The Order raised the Miller boys again. Their third time this month.' },
        { who: 1, text: 'They keep charging the same orc camp.' },
        { who: 0, text: 'And the Crown keeps paying the clerics to stitch them back together. A very healthy economy.' },
        { who: 1, text: 'The orcs they cut down stay down, though. Nobody comes to stitch those.' },
        { who: 0, text: 'Orcs have no Order, Captain. No chapel, no candles, no second go. One head, one entry.' },
        { who: 1, text: 'Put like that, it sounds unfair.' },
        { who: 0, text: 'It is not unfair. It is bookkeeping. A head that got up again would ruin my columns.' },
      ],
      [
        { who: 0, text: 'A query for you, Captain. Under which column do I enter a dog?' },
        { who: 1, text: 'A dog? It was guarding the goblin camp. It wagged at me.' },
        { who: 0, text: 'A dog that lives with goblins is, for bookkeeping purposes, a goblin.' },
        { who: 1, text: 'It fetched a stick for one of the hunters. Then he shot it.' },
        { who: 0, text: 'Three coins, then. The stick is not in the ledger.' },
        { who: 1, text: 'No. Neither is the little one who was crying for it.' },
      ],
      [
        { who: 0, text: 'The hunters keep bringing me hats instead of heads. I have had to make a ruling.' },
        { who: 1, text: 'What did you rule?' },
        { who: 0, text: 'One hat, one head. A hat is proof of a head. Nobody wears a hat on nothing.' },
        { who: 1, text: 'Some of these hats are very small, Registrar.' },
        { who: 0, text: 'Small hats, small heads, same three coins. The Crown does not haggle over size.' },
        { who: 1, text: 'I wish it did. Then someone might ask why they are so small.' },
      ],
      [
        { who: 0, text: 'I have been spelling goblin with two Bs all week. Is it one B or two, Captain?' },
        { who: 1, text: 'They do not call themselves goblins. Their word means the people by the river.' },
        { who: 0, text: 'The people by the river. That will never fit in the column.' },
        { who: 1, text: 'There is no river by them any more. The Crown dammed it for the new mill.' },
        { who: 0, text: 'Then the name is out of date as well. Goblin it is. One B, I think.' },
        { who: 1, text: 'One B. It is a short word, for so many of them.' },
      ],
      [
        { who: 0, text: 'My report to the Crown is dull. I need adjectives. How fierce were the forty-one?' },
        { who: 1, text: 'They were asleep, Registrar. It was very early.' },
        { who: 0, text: 'Fearsomely asleep. Menacingly early. Good, that reads much better.' },
        { who: 1, text: 'One of them woke up and asked if we wanted breakfast.' },
        { who: 0, text: 'Brazenly offered breakfast. The Crown will be appalled.' },
        { who: 1, text: 'It was porridge. I had two bowls before the hunters arrived.' },
        { who: 0, text: 'Leave out the bowls, Captain. Bowls make you sound like a guest.' },
      ],
      [
        { who: 0, text: 'Look at this abacus, Captain. I bought it at the border market. Not one bead sticks.' },
        { who: 1, text: 'That is goblin work, Registrar. The carver\'s mark is on the side.' },
        { who: 0, text: 'Is it? Marvellous craftsmanship. They would make wonderful clerks.' },
        { who: 1, text: 'The carver lived at the crossing. The one with the forty-one.' },
        { who: 0, text: 'Then he is in the ledger already. Counted on his own beads. How neat.' },
        { who: 1, text: 'Neat is one word for it.' },
        { who: 0, text: 'It is the only word the ledger needs. Do keep up, Captain.' },
      ],
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
    variants: [
      [
        { who: 1, text: 'I may have added the word please to the proclamation.' },
        { who: 0, text: 'The proclamation orders them hunted down.' },
        { who: 1, text: 'Yes. Please be hunted down. It sounds much more civil.' },
        { who: 0, text: 'Does that help them?' },
        { who: 1, text: 'No. But it helps me sleep, and that counts for something.' },
        { who: 0, text: 'It should not. But I am glad it does.' },
      ],
      [
        { who: 0, text: 'A wolf followed the column all day. I threw it a bone.' },
        { who: 1, text: 'Captain, feeding a beast is against the decree.' },
        { who: 0, text: 'It was a very small decree and a very large bone.' },
        { who: 1, text: 'Did it bite you?' },
        { who: 0, text: 'It sat. Then it walked beside me for a mile, and left. I was sorry to see it go.' },
        { who: 1, text: 'The decree says nothing about sitting. I shall go and have a long think about sitting.' },
      ],
      [
        { who: 1, text: 'The guards want to know if you are going on strike.' },
        { who: 0, text: 'Tell them yes. Tell them no. Tell them I have a headache.' },
        { who: 1, text: 'They also ask why the goblins keep surrendering in the middle of an ambush.' },
        { who: 0, text: 'I took it for rudeness. Now I think it is good sense.' },
        { who: 1, text: 'Good sense, on a battlefield? Captain, that is dangerously close to thinking.' },
        { who: 0, text: 'I know. I have started wearing a hat to keep it in.' },
      ],
      [
        { who: 1, text: 'You look well, Captain, for a man who was dead on Tuesday.' },
        { who: 0, text: 'The Order raised me by supper. The priest said I have a lovely skeleton.' },
        { who: 1, text: 'What is it like? Being dead?' },
        { who: 0, text: 'Cold. Short. Then a cleric slapping my cheek and asking for a donation.' },
        { who: 0, text: 'When I woke I went back. The goblins were burying the one I killed. They dug the hole by hand.' },
        { who: 1, text: 'Will their priests not raise him?' },
        { who: 0, text: 'They have no priests for it. Their dead stay where we leave them. I never knew until I watched them dig.' },
        { who: 1, text: 'But the keep is full of skeletons that get up again. Somebody raises those.' },
        { who: 0, text: 'A necromancer. It lifts the bones, not the person. I asked one its name. It only rattled.' },
      ],
      [
        { who: 0, text: 'I helped a family push their cart out of the mud this morning.' },
        { who: 1, text: 'A goblin family?' },
        { who: 0, text: 'A grandmother, two children and a goat. All pushing. The goat pushed hardest.' },
        { who: 1, text: 'Captain, that cart was fleeing from us.' },
        { who: 0, text: 'I know. It was fleeing very slowly. Somebody had to help.' },
        { who: 1, text: 'I shall leave it out of my report. I shall put the goat in. Goats are allowed.' },
      ],
      [
        { who: 1, text: 'The roll call was short this morning. Nine guards answered. We had twelve.' },
        { who: 0, text: 'Hobb went to fetch water. Three days ago.' },
        { who: 1, text: 'That is a long way to go for water.' },
        { who: 0, text: 'He took his blanket and his mother\'s clock. He must be very thirsty.' },
        { who: 1, text: 'Should I proclaim him missing?' },
        { who: 0, text: 'Proclaim him thirsty. It is kinder, and it is nearly true.' },
      ],
      [
        { who: 1, text: 'New wording from the court. Surrender is struck out. I am to say a pause in hostilities.' },
        { who: 0, text: 'And what happens to a beast that pauses?' },
        { who: 1, text: 'It is counted, Captain. A pause is still a head.' },
        { who: 0, text: 'So it is the same thing, in a longer word.' },
        { who: 1, text: 'Four words. The court pays me by the word now. It is the only good news I have.' },
        { who: 0, text: 'Buy something warm with it. Winter is coming for all of us.' },
      ],
      [
        { who: 1, text: 'I have started a count of my own. Carts going north. Forty this week.' },
        { who: 0, text: 'The Registrar will not like a second ledger.' },
        { who: 1, text: 'It is not a ledger. It is a scrap of paper in my hat.' },
        { who: 0, text: 'And what is the count for?' },
        { who: 1, text: 'I do not know yet. It felt wrong that nobody counted the ones who got away.' },
        { who: 0, text: 'Keep it in the hat. Hats are not inspected. Yet.' },
      ],
      [
        { who: 0, text: 'The goblins at the ford waved a white sheet at us today.' },
        { who: 1, text: 'How rude. Was it at least clean?' },
        { who: 0, text: 'Freshly washed. They had hung it out to dry the night before, just in case.' },
        { who: 1, text: 'There is no proclamation for sheets. I have looked. I have looked twice.' },
        { who: 0, text: 'Then what do I do, the next time?' },
        { who: 1, text: 'I do not know, Captain. Perhaps you wave one back, and we both call it laundry.' },
      ],
    ],
  },
  {
    id: 'c2b', chapter: 2, level: 1,
    cast: [{ npc: KING, dx: 0, dy: 0, face: -1 }, { npc: REGISTRAR, dx: -34, dy: 8, face: 1 }, { npc: HERALD, dx: 34, dy: 8, face: -1 }, { npc: CAPTAIN, dx: 66, dy: 14, face: -1 }],
    lines: [
      { who: 0, text: 'The count has slowed. Why has the count slowed?' },
      { who: 1, text: 'They flee north, sire. Whole villages of them, carts and all.' },
      { who: 0, text: 'Then the hills must be cleared as well.' },
      { who: 1, text: 'Villages, sire. They are villages.' },
      { who: 0, text: 'Camps. We will call them camps. It sits better in the ledger.' },
      { who: 2, text: 'Camps. Yes, sire. I shall have it proclaimed.' },
    ],
    variants: [
      [
        { who: 3, text: 'Sire, the scouts report a village with a school. Chalk, small desks, a bell.' },
        { who: 0, text: 'A bell? Do they ring it to call their army?' },
        { who: 3, text: 'They ring it for lunch, sire.' },
        { who: 0, text: 'Lunch is how armies begin. Burn the lunch.' },
        { who: 1, text: 'We shall list it as a barracks with a cafeteria.' },
        { who: 2, text: 'A barracks with a cafeteria. I shall proclaim it in the loudest voice I own.' },
      ],
      [
        { who: 0, text: 'I am told the beasts have begun naming their children. Sixteen names this week.' },
        { who: 1, text: 'Sire, that is called a birth.' },
        { who: 0, text: 'It sounds like a recruitment drive.' },
        { who: 3, text: 'It is one baby, Majesty. It is called Pip.' },
        { who: 0, text: 'Pip! Even the names are sinister. Add Pip to the list.' },
        { who: 1, text: 'To the list, sire. Under recruits, small.' },
      ],
      [
        { who: 2, text: 'Majesty, the northern farms are all deserted.' },
        { who: 0, text: 'Then they have fled. Cowards! Chase them.' },
        { who: 3, text: 'They fled because the army was coming, sire. We are the army.' },
        { who: 0, text: 'Impossible. We are the Crown. They should have been honoured.' },
        { who: 1, text: 'I shall record that they were honoured right out of their homes.' },
        { who: 0, text: 'Good. Give the Captain a small raise for his candour, and then lose his report.' },
      ],
      [
        { who: 3, text: 'Sire, the hunters fall in the hills and get up in the chapel. The Order is working double shifts.' },
        { who: 0, text: 'Excellent. A hunter who cannot stay dead is the best kind of hunter.' },
        { who: 2, text: 'Sire, the goblins have started leaving flowers on their dead. They sit and wait for them to wake.' },
        { who: 0, text: 'And do they wake?' },
        { who: 1, text: 'No, sire. The beasts have no clerics. What falls out there stays fallen.' },
        { who: 0, text: 'Nonsense. The keep is crawling with skeletons. Those got up.' },
        { who: 1, text: 'Necromancy, sire. It lifts the bones and leaves their owner behind. I file it under furniture.' },
        { who: 0, text: 'Then the flowers are a waste of flowers. Proclaim it as littering.' },
        { who: 2, text: 'Littering. Yes, sire. I shall proclaim it very quietly.' },
      ],
      [
        { who: 0, text: 'Registrar, why does the map still say Lower Puddingford?' },
        { who: 1, text: 'Renamed, sire. It is now Puddingford Camp. The pudding stays. It is very old pudding.' },
        { who: 2, text: 'The people of Puddingford ask whether they may keep their bakery.' },
        { who: 0, text: 'A camp with a bakery is a fortress with a bakery. Proclaim it a fortress.' },
        { who: 3, text: 'Majesty, it was empty when we got there. The ovens were still warm.' },
        { who: 0, text: 'Then they have retreated to a better bakery. Follow the smell, Captain.' },
      ],
      [
        { who: 0, text: 'Why were there only six at dinner? I set the table for twenty.' },
        { who: 1, text: 'Three courtiers resigned, sire. The rest have discovered relatives in the south.' },
        { who: 0, text: 'Everyone has relatives in the south. That is no excuse.' },
        { who: 2, text: 'The Royal Taster left a note, sire. He says he no longer has the stomach for it.' },
        { who: 0, text: 'Ha! A joke. Frame it for the hall. And hire a taster with a sturdier stomach.' },
        { who: 3, text: 'Majesty, I do not think he meant the soup.' },
      ],
      [
        { who: 1, text: 'Sire, a whole camp surrendered at the bridge. I have no column for it.' },
        { who: 0, text: 'Then make one. No, wait. Do not make one. Columns only encourage them.' },
        { who: 1, text: 'I could enter them as captured, sire. Captured is a very respectable word.' },
        { who: 3, text: 'We did not capture them. They walked up and handed me a pot of jam.' },
        { who: 0, text: 'Captured with jam. Put it in the dispatches, Herald. Make it sound like a siege.' },
        { who: 2, text: 'The great Siege of the Jam. I shall proclaim it, sire, though my heart is not in it.' },
      ],
      [
        { who: 0, text: 'Every cart on the north road is a cart I cannot count. Put a toll on it.' },
        { who: 1, text: 'A toll, sire? They have nothing to pay with. They left with a cart and a goat.' },
        { who: 0, text: 'Then the toll is the goat. Everything is taxable if you are brave enough.' },
        { who: 3, text: 'Majesty, the guards at the toll gate have been waving the carts through.' },
        { who: 0, text: 'Waving? With what?' },
        { who: 3, text: 'With their hands, sire. Some of them wave quite warmly.' },
        { who: 2, text: 'I shall proclaim the toll paid in full, sire. In goats we have not got.' },
      ],
      [
        { who: 2, text: 'Majesty, I proclaimed the victory at the crossroads, but nobody was there to hear it.' },
        { who: 0, text: 'Nobody? Where was everybody?' },
        { who: 1, text: 'North, sire. The crossroads went north on Monday. I have it down as a camp, vacated.' },
        { who: 0, text: 'Then proclaim it louder, so they hear it on the way.' },
        { who: 2, text: 'I did, sire. A small girl on the last cart waved at me. I waved back.' },
        { who: 3, text: 'No harm in it, Herald. There is no rule against waving. Not yet.' },
        { who: 0, text: 'Waving is fine. Waving is cheap. Just never wave at anything with horns.' },
      ],
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
    variants: [
      [
        { who: 1, text: 'You were in the archive all night. There is ink on your nose.' },
        { who: 0, text: 'There is a drawer with no key. It is labelled Before.' },
        { who: 1, text: 'Before what?' },
        { who: 0, text: 'Before the monsters. It is full of quotas, all stamped, all earlier than the trouble.' },
        { who: 1, text: 'Perhaps the drawer is just very old.' },
        { who: 0, text: 'Perhaps. But my own handwriting is in it, and I am not that old.' },
      ],
      [
        { who: 0, text: 'I have made a dreadful discovery. I filed it under Dreadful, and now I cannot find it.' },
        { who: 1, text: 'What did you discover?' },
        { who: 0, text: 'The bounty list was printed three winters ago. The beasts were still waving at travellers then.' },
        { who: 1, text: 'Waving?' },
        { who: 0, text: 'I have a witness. A very honest cat.' },
        { who: 1, text: 'A cat is not a legal witness, Registrar.' },
        { who: 0, text: 'No. But it does not lie, and I am tired of those who do.' },
      ],
      [
        { who: 1, text: 'The King asks why you have stopped smiling at the office.' },
        { who: 0, text: 'Tell him my smile is on loan to the ledger, until the ledger is honest.' },
        { who: 1, text: 'He will not understand that.' },
        { who: 0, text: 'No. He will tell the Captain to find me a nicer face.' },
        { who: 1, text: 'What is it that frightens you? The quota book?' },
        { who: 0, text: 'The date, Herald. Dated before anyone threw the first stone.' },
      ],
      [
        { who: 1, text: 'Why does the ledger have a column called Returned?' },
        { who: 0, text: 'For hunters. They fall, the wagon brings them home, the Order raises them, and I tick the box.' },
        { who: 0, text: 'Some have died so often the clerics gave them a punch card. Ten deaths, the eleventh is free.' },
        { who: 1, text: 'And the beasts? Where is their Returned column?' },
        { who: 0, text: 'There is none. Nothing raises them. I checked every page twice, then once more in better light.' },
        { who: 1, text: 'So every one of ours comes back, and none of theirs.' },
        { who: 0, text: 'Yes. I used to call that a margin. I cannot think what to call it now.' },
      ],
      [
        { who: 1, text: 'I need the date for the proclamation of the first attack. For the anniversary.' },
        { who: 0, text: 'Which date? The one it happened, or the one it was printed?' },
        { who: 1, text: 'Those are the same date, Registrar.' },
        { who: 0, text: 'They are not. Your proclamation was set in type a year early, with a blank for the day.' },
        { who: 1, text: 'I read it out with such feeling. I thought it was news.' },
        { who: 0, text: 'It was news to you, Herald. It was a schedule to somebody else.' },
      ],
      [
        { who: 0, text: 'Herald, I have found a requisition form. One menace, to be delivered by spring.' },
        { who: 1, text: 'A menace? Who orders a menace?' },
        { who: 0, text: 'The Crown did. In triplicate. Approved, stamped, and filed two winters before the menace.' },
        { who: 1, text: 'And did it arrive?' },
        { who: 0, text: 'No. So they ordered the bounty instead, and the menace was made to fit it.' },
        { who: 1, text: 'That is backwards. That is a cart pulling a very sad horse.' },
      ],
      [
        { who: 1, text: 'Why are you weighing coins? You only weigh coins when you are cross.' },
        { who: 0, text: 'The mint struck ten thousand bounty tokens. Here is the invoice. Look at the date.' },
        { who: 1, text: 'The autumn before the trouble. Perhaps the mint is very forward thinking.' },
        { who: 0, text: 'Nobody strikes ten thousand rewards for a danger that has not happened yet.' },
        { who: 1, text: 'Unless they meant to spend them.' },
        { who: 0, text: 'Every one of them, Herald. They budgeted the dead before they met them.' },
      ],
      [
        { who: 0, text: 'Next year\'s ledger is already filled in. Beasts slain, by month, in a lovely round hand.' },
        { who: 1, text: 'How can you count what has not happened?' },
        { who: 0, text: 'You call it a projection, Herald. It is how the Crown counts things it intends to do.' },
        { who: 1, text: 'And the attacks on our farms? Are they projected too?' },
        { who: 0, text: 'Every one. With the barns already named. Some of the barns have not been built.' },
        { who: 1, text: 'Then who were the attacks for?' },
        { who: 0, text: 'For the ledger. So the numbers would have something to stand on.' },
      ],
      [
        { who: 1, text: 'Hear ye! The ledger stands accused of lying to the realm!' },
        { who: 0, text: 'Herald, you cannot put a book on trial. It has no legs to stand in the dock.' },
        { who: 1, text: 'Then let it speak in its defence. What does it say?' },
        { who: 0, text: 'It says it wrote down what it was told, in the order it was told, and the order was wrong.' },
        { who: 1, text: 'Poor book. It only ever wanted to add up.' },
        { who: 0, text: 'So did I. It turns out the sum was decided before the first figure went in.' },
      ],
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
    variants: [
      [
        { who: 0, text: 'Sit. I will not poison your soup. I would, but we are out of poison.' },
        { who: 1, text: 'I came to arrest you. Under the bounty.' },
        { who: 0, text: 'Arrest me! Do you have a cell for a hundred and eleven years?' },
        { who: 1, text: 'Honestly, no. The jail has a leak.' },
        { who: 0, text: 'Then we are both in a hard place. Stew?' },
        { who: 1, text: '...Yes. Thank you. Ow, that is hot.' },
      ],
      [
        { who: 0, text: 'In my youth your city was a muddy field with a goat. The goat was clever.' },
        { who: 1, text: 'The goat is on our crest now.' },
        { who: 0, text: 'Of course. You always keep the goat and lose the family.' },
        { who: 1, text: 'Elder, the quota came before the attacks, did it not.' },
        { who: 0, text: 'Child, you are the first of your kind to ask that aloud. Eat. You will need to say it again.' },
      ],
      [
        { who: 0, text: 'Your friend with the trumpet came by. He wept. We gave him soup.' },
        { who: 1, text: 'The Herald?' },
        { who: 0, text: 'He asked if we had a decree for sorrow. We had a very large one. We have used it often.' },
        { who: 1, text: 'I thought I was the only one who could not sleep.' },
        { who: 0, text: 'The whole kingdom lies awake, soldier. It is only the beds that are asleep.' },
      ],
      [
        { who: 0, text: 'They tell me your priests can call a man back from the dead. Is it true?' },
        { who: 1, text: 'It is. I have been called back four times. The Order says I am their best customer.' },
        { who: 0, text: 'Four! We have not managed it once in a hundred and eleven years. Not for lack of asking.' },
        { who: 1, text: 'You have no clerics at all?' },
        { who: 0, text: 'We have a fellow who is very good with knees. Death is beyond him. Ours stay where they fall.' },
        { who: 1, text: 'The keep is full of the dead walking about. Is that not raising?' },
        { who: 0, text: 'Bones on strings, soldier. Whoever lived in them does not come back. We would know our own.' },
        { who: 1, text: 'Then every one we take is gone for good.' },
        { who: 0, text: 'Yes, soldier. You get a second go. We get a grave, if anyone is left to dig it.' },
      ],
      [
        { who: 0, text: 'Mind where you stand, soldier. That ditch under your boot is my grandmother\'s furrow.' },
        { who: 1, text: 'This is the King\'s road. It goes all the way to the gate.' },
        { who: 0, text: 'It does. It was laid along our plough lines. The stones are still straight from the oxen.' },
        { who: 1, text: 'Nobody told us there were fields here before.' },
        { who: 0, text: 'Nobody asked. You are the first to look down instead of along.' },
        { who: 1, text: 'I came to see for myself. I am still looking.' },
      ],
      [
        { who: 1, text: 'I brought a Crown survey. It marks this valley empty, and good for grazing.' },
        { who: 0, text: 'Empty! I was in it. I waved at the man with the measuring chain.' },
        { who: 1, text: 'He wrote that the waving was the wind.' },
        { who: 0, text: 'Then the wind has had a very hard time since. Look at the date on your paper.' },
        { who: 1, text: 'It is older than the bounty. Older than the first raid.' },
        { who: 0, text: 'Yes. They wrote us out of the valley before they came to clear it.' },
      ],
      [
        { who: 0, text: 'You have walked a long way, soldier. What did you come to ask?' },
        { who: 1, text: 'Which way to the river, please.' },
        { who: 0, text: 'It is behind you. You crossed it. You were looking at me the whole time.' },
        { who: 1, text: 'Very well. Did your people strike our farms first?' },
        { who: 0, text: 'No. Your farms were planted on ours, and we let them be. A hundred years of letting.' },
        { who: 1, text: 'Thank you. I think I knew. I needed someone to say it plainly.' },
      ],
      [
        { who: 0, text: 'Here. A receipt. My mother paid your city a tithe, in turnips, when your walls were new.' },
        { who: 1, text: 'The Crown taxed you? Then you were in the books.' },
        { who: 0, text: 'We were neighbours in the books. Good ones. We were never late with a turnip.' },
        { who: 1, text: 'When did the books stop calling you neighbours?' },
        { who: 0, text: 'The year your King found the valley more useful without us in it.' },
        { who: 1, text: 'I shall show this to the Registrar. The Registrar keeps every receipt.' },
        { who: 0, text: 'Then the Registrar will know the turnips. They were very fine turnips.' },
      ],
      [
        { who: 1, text: 'My orders say to count your folk. The list says four hundred.' },
        { who: 0, text: 'Four hundred! We have never been four hundred, even at a wedding.' },
        { who: 1, text: 'Then how many?' },
        { who: 0, text: 'Ninety in a good year. Fewer since the ford. Your list counts more of us than ever lived.' },
        { who: 1, text: 'So the quota cannot be met. Not ever.' },
        { who: 0, text: 'It was never meant to be met, soldier. It was meant to be chased.' },
      ],
    ],
  },
  // IV - Complicity: the price
  {
    id: 'c4a', chapter: 4, level: 0,
    cast: [{ npc: KING, dx: 0, dy: 0, face: -1 }, { npc: REGISTRAR, dx: -34, dy: 8, face: 1 }, { npc: HERALD, dx: 34, dy: 8, face: -1 }, { npc: CAPTAIN, dx: 66, dy: 14, face: -1 }],
    lines: [
      { who: 0, text: 'Double the pay for any camp that does not resist.' },
      { who: 1, text: 'Sire, they do not resist because they have no fighters left.' },
      { who: 0, text: 'Then it is cheaper work. Pay it.' },
      { who: 2, text: 'The Crown now pays more for the helpless than for the brave, sire.' },
      { who: 0, text: 'The Crown pays for results, Herald. Mind your trumpet.' },
    ],
    variants: [
      [
        { who: 0, text: 'The beasts no longer fight back. This is a great victory.' },
        { who: 3, text: 'They have no one left to fight with, sire.' },
        { who: 0, text: 'So much the better. Cheaper hunters, fewer bandages.' },
        { who: 1, text: 'The treasury likes this very much, sire.' },
        { who: 2, text: 'Sire, a goblin asked me what we were guarding. I said the Crown. He said ah, and sat down.' },
        { who: 0, text: 'Sat down? Mark him as dead on arrival.' },
      ],
      [
        { who: 0, text: 'I wish a new title, befitting the man who made the realm safe.' },
        { who: 1, text: 'Tamer of Beasts, sire?' },
        { who: 0, text: 'Too gentle.' },
        { who: 3, text: 'Emptier of Hills, sire.' },
        { who: 0, text: 'That one. No. Wait. Why does it sound worse out loud?' },
        { who: 2, text: 'Because it is true, sire, and the truth wears a crown badly.' },
        { who: 0, text: 'Mind your trumpet, Herald. And find me a better word than emptier.' },
      ],
      [
        { who: 3, text: 'The hunters are being paid twice for the same camp, sire.' },
        { who: 0, text: 'Twice? How?' },
        { who: 3, text: 'Once for the camp, once for the memory of the camp. The clerks are very creative.' },
        { who: 1, text: 'I did not authorise a memory fee.' },
        { who: 0, text: 'Nor I. But it sounds profitable. Keep it.' },
        { who: 2, text: 'Sire, I believe the clerks are laughing at us.' },
        { who: 0, text: 'Laughing means morale. Pay them double.' },
      ],
      [
        { who: 1, text: 'Sire, the Order has sent its bill. Raising the hunters now costs more than the bounty pays.' },
        { who: 0, text: 'Then raise them cheaper. Fewer candles. Shorter prayers.' },
        { who: 2, text: 'Sire, the clerics say a shorter prayer brings back a shorter hunter.' },
        { who: 3, text: 'And the beasts still bury theirs, sire. Nobody raises a goblin, at any price. They have no Order.' },
        { who: 0, text: 'Good. A war where only one side stays dead is a war I can afford.' },
        { who: 2, text: 'Sire, that may be the worst sentence I have ever had to remember.' },
        { who: 0, text: 'Then do not remember it. Proclaim it.' },
      ],
      [
        { who: 1, text: 'Sire, the clerks ask what to call a camp with no fighters left in it.' },
        { who: 0, text: 'A nest. Nests sound like something you clear.' },
        { who: 2, text: 'Sire, a nest is where the small ones sleep.' },
        { who: 0, text: 'Exactly. Nobody minds clearing a nest.' },
        { who: 3, text: 'The hunters mind, sire. Two of them handed in their spears this morning.' },
        { who: 0, text: 'Then the rest share their pay. Look how the problem solves itself.' },
        { who: 1, text: 'I will put it under savings, sire.' },
      ],
      [
        { who: 1, text: 'Sire, the resignations have their own drawer now. I had to buy a second drawer.' },
        { who: 0, text: 'Resignations? From whom?' },
        { who: 1, text: 'Two scribes, a quartermaster and the man who polishes the bounty scales.' },
        { who: 3, text: 'And mine, sire. Third from the top. I folded it neatly.' },
        { who: 0, text: 'Then I refuse it neatly. Nobody leaves while the pay is this good.' },
        { who: 2, text: 'Sire, that is rather the trouble. The pay is only good because nobody fights back.' },
        { who: 0, text: 'File that under compliments, Registrar.' },
      ],
      [
        { who: 0, text: 'Herald, read me back this morning\'s proclamation.' },
        { who: 2, text: 'The Crown regrets to announce, with heavy heart, a small increase in rewards.' },
        { who: 0, text: 'Regrets? Heavy heart? I wrote rejoice.' },
        { who: 2, text: 'I may have been holding it upside down, sire.' },
        { who: 3, text: 'He read it to the gate in a whisper, sire. The guards took their hats off.' },
        { who: 0, text: 'Hats off! Splendid. Respect for the Crown at last.' },
        { who: 1, text: 'I shall note it as respect, sire.' },
      ],
      [
        { who: 3, text: 'The hunters want a bonus, sire. The work is too easy and it keeps them up at night.' },
        { who: 0, text: 'Easy work, and they want more? Marvellous cheek.' },
        { who: 1, text: 'They have named it the sleeping fee, sire. It is on the invoice.' },
        { who: 0, text: 'Pay it. A rested hunter is a quick hunter.' },
        { who: 2, text: 'Sire, they are not asking to sleep. They are asking to stop dreaming.' },
        { who: 0, text: 'Then pay them to dream of something nicer. Ponies.' },
        { who: 1, text: 'Ponies, sire. Under sundries.' },
      ],
      [
        { who: 0, text: 'Registrar, why do the books say the realm saved money this month?' },
        { who: 1, text: 'The camps stopped resisting, sire. A camp of grandmothers costs almost nothing to clear.' },
        { who: 0, text: 'Splendid! Advertise it. A thrifty month for the Crown.' },
        { who: 2, text: 'Sire, I cannot proclaim a discount on grandmothers.' },
        { who: 0, text: 'Then call it efficiency. Efficiency never has grandmothers.' },
        { who: 3, text: 'Efficiency has my lads, sire. Three came back and asked to be sent to the stables.' },
        { who: 0, text: 'Send them. Horses are very efficient too.' },
      ],
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
    variants: [
      [
        { who: 0, text: 'I have resigned. I wrote it on a very small piece of paper.' },
        { who: 1, text: 'The King will not see a small piece of paper.' },
        { who: 0, text: 'That was the plan.' },
        { who: 1, text: 'If you leave, Captain, who will carry the banner?' },
        { who: 0, text: 'The banner can carry itself. It is the only honest thing in this army.' },
        { who: 1, text: 'Then I will walk beside it. Slowly.' },
      ],
      [
        { who: 1, text: 'I practised the new proclamation on a mirror. The mirror left.' },
        { who: 0, text: 'Wise mirror.' },
        { who: 1, text: 'It said the camps shall be made quiet. I read it as shall be left in peace.' },
        { who: 0, text: 'You cannot change the words, Herald.' },
        { who: 1, text: 'I changed three. Nobody counts the small words.' },
        { who: 0, text: 'I do. Keep going.' },
      ],
      [
        { who: 0, text: 'The gate guards asked me for something rousing. I said good morning.' },
        { who: 1, text: 'Did it work?' },
        { who: 0, text: 'Half went home. The rest asked to keep their spears and become gardeners.' },
        { who: 1, text: 'Gardeners! The Crown has always needed gardeners.' },
        { who: 0, text: 'I told them nobody would ask. They went anyway.' },
        { who: 1, text: 'Then the Crown has fewer guards and better roses. I call that progress.' },
      ],
      [
        { who: 0, text: 'I asked the Order to raise a goblin child. Just one. I offered to pay.' },
        { who: 1, text: 'What did they say?' },
        { who: 0, text: 'That the rite only takes on people. Then they looked at me as if I had asked them to raise a chair.' },
        { who: 1, text: 'And the goblins have no rite of their own?' },
        { who: 0, text: 'None. Ours will not touch them and they have nothing else. When they fall, that is the end of it.' },
        { who: 1, text: 'While we walk back from the dead every week, grumbling about the chapel coffee.' },
        { who: 0, text: 'The coffee is terrible. It is the only part of dying I still feel I may complain about.' },
      ],
      [
        { who: 1, text: 'The new tariff came this morning. It is printed on lovely paper.' },
        { who: 0, text: 'How lovely?' },
        { who: 1, text: 'Gilt edges. A camp with no fighters pays double. They put that part in bold.' },
        { who: 0, text: 'They always put the worst part in bold.' },
        { who: 1, text: 'I have been covering it with my thumb when I read it out.' },
        { who: 0, text: 'Your thumb cannot cover it forever.' },
        { who: 1, text: 'I know. It is a very big thumb. But I know.' },
      ],
      [
        { who: 0, text: 'I asked to be demoted. Lower than private. They had to invent a rank.' },
        { who: 1, text: 'What did they call it?' },
        { who: 0, text: 'Person. I am now Person Third Class.' },
        { who: 1, text: 'Is the pay worse?' },
        { who: 0, text: 'Much worse. I sleep wonderfully.' },
        { who: 1, text: 'Could I be demoted too? I would make a very good Person.' },
        { who: 0, text: 'You would have to stop shouting, Herald.' },
      ],
      [
        { who: 1, text: 'My trumpet has stopped working. I think it is on strike.' },
        { who: 0, text: 'Trumpets do not strike.' },
        { who: 1, text: 'This one heard the proclamation. It plays only one note now, and the note is sad.' },
        { who: 0, text: 'The King will buy you a new one.' },
        { who: 1, text: 'He has. It came with the next proclamation folded inside it.' },
        { who: 0, text: 'Then lose them both somewhere on the road.' },
        { who: 1, text: 'I have. Twice. Somebody kind keeps sending them back.' },
      ],
      [
        { who: 0, text: 'My scouts have stopped finding camps. The hills are suddenly very hard to read.' },
        { who: 1, text: 'Are the camps gone?' },
        { who: 0, text: 'No. The scouts just look very carefully in the wrong direction.' },
        { who: 1, text: 'The Registrar will notice the count is low.' },
        { who: 0, text: 'He marks them lost to fog. He has not checked the weather since spring.' },
        { who: 1, text: 'So the whole army is lying by accident.' },
        { who: 0, text: 'Carefully, Herald. By accident is the only way we are allowed to do it.' },
      ],
      [
        { who: 1, text: 'I am to announce a feast. The cheapest season in the history of the Crown.' },
        { who: 0, text: 'Cheap for whom?' },
        { who: 1, text: 'The menu says roast pheasant and a toast to the quiet hills.' },
        { who: 0, text: 'I will not drink to the hills.' },
        { who: 1, text: 'Nor I. I thought I might bring water and raise it very low.' },
        { who: 0, text: 'Low enough to be a bow.' },
        { who: 1, text: 'That is what I hoped. A small bow, to whoever is not there.' },
      ],
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
    variants: [
      [
        { who: 0, text: 'The last settlement. I shall want a parade, with elephants.' },
        { who: 2, text: 'We do not have elephants, sire.' },
        { who: 0, text: 'Then geese. Many geese. The enemy will be so confused they surrender.' },
        { who: 1, text: 'They surrendered some time ago, sire. It has not been reflected in the pay.' },
        { who: 2, text: 'Sire, what do we do with a parade and no enemy?' },
        { who: 0, text: 'Hold it anyway. Everyone feels better after a parade.' },
      ],
      [
        { who: 1, text: 'A delicate matter, sire. After the last settlement, the Office has no work.' },
        { who: 0, text: 'Then find more beasts.' },
        { who: 2, text: 'There are none left, sire.' },
        { who: 0, text: 'Then find some that look like them. Merchants, perhaps. The ones with the odd hats.' },
        { who: 1, text: 'The merchants pay our wages, sire.' },
        { who: 0, text: 'Ah. Then... I will think of someone. It always works out.' },
        { who: 2, text: 'That, sire, is exactly what frightens me.' },
      ],
      [
        { who: 2, text: 'My lord, a sentry says the settlement has raised white banners. Dozens of them.' },
        { who: 0, text: 'A trick! Surrender is how they trick us.' },
        { who: 1, text: 'It is also how people ask not to be killed, sire.' },
        { who: 0, text: 'Registrar, you are unhelpfully literal today.' },
        { who: 2, text: 'Sire, the banners say please.' },
        { who: 0, text: '...Then it is a very polite trick. Advance.' },
      ],
      [
        { who: 0, text: 'For the parade, have the Order raise every hunter who fell on the road.' },
        { who: 2, text: 'They are already raised, sire. Every one. Most of them twice.' },
        { who: 0, text: 'Splendid. Then raise a few of the beasts as well, for the crowd. In chains, for effect.' },
        { who: 1, text: 'Sire, nothing raises them. They have no clerics, and the rite of the Order will not take on them.' },
        { who: 0, text: 'Not one? In all this time?' },
        { who: 2, text: 'Not one, sire. Everyone we lost came home. Everyone they lost is still out there.' },
        { who: 0, text: '...Then cancel the beasts in chains. Keep the geese.' },
      ],
      [
        { who: 1, text: 'Sire, a small difficulty. The book is full, and there is still one settlement to enter.' },
        { who: 0, text: 'Then buy a bigger book. Leather. With my face on it.' },
        { who: 1, text: 'I could. But a bigger book suggests we mean to fill that one too.' },
        { who: 2, text: 'Do we, sire?' },
        { who: 0, text: 'Captain, nobody buys a book to leave it empty. That would be wasteful.' },
        { who: 1, text: 'Then I shall order the small one. It will be quicker to finish.' },
      ],
      [
        { who: 0, text: 'The map makers ask what to draw out past the last settlement.' },
        { who: 1, text: 'Traditionally, sire, nothing. Blank parchment and a polite note.' },
        { who: 0, text: 'Blank! Blank frightens nobody. Draw monsters in the margins. Big ones, with teeth.' },
        { who: 2, text: 'We have just finished clearing the margins, sire.' },
        { who: 0, text: 'Then the people will need new ones. A map is a promise of things to pay for.' },
        { who: 2, text: 'I will tell the map makers to draw slowly.' },
      ],
      [
        { who: 2, text: 'The settlement wishes to surrender, sire. They have asked who they should hand it to.' },
        { who: 1, text: 'There is no form for that. We have forms for heads, for ears, and for one tail.' },
        { who: 0, text: 'Then they cannot surrender. It would make a mess of the filing.' },
        { who: 2, text: 'They are waving very hard, sire. One of them is waving a chair.' },
        { who: 1, text: 'I could draw up a form tonight. It would only need a line for please.' },
        { who: 0, text: 'No. If we write please down, someone will expect us to read it.' },
      ],
      [
        { who: 2, text: 'Sire, when it is done, may I go home? My mother asks what I did on the road.' },
        { who: 0, text: 'Tell her you saved the realm. Mothers like that. I will send a medal.' },
        { who: 2, text: 'She will ask from what, sire.' },
        { who: 1, text: 'The medal comes with a little card, Captain. The card does not say from what.' },
        { who: 0, text: 'Nobody reads the card. That is why it is so small.' },
        { who: 2, text: 'She will. She taught me to read on the old notices.' },
      ],
      [
        { who: 0, text: 'I am writing my victory speech. We have nothing left to fear. Is it stirring?' },
        { who: 1, text: 'Stirring, sire. Though the treasury notes it also ends the tax for protection.' },
        { who: 0, text: 'Ah. Strike that. We have nothing left to fear for now.' },
        { who: 2, text: 'And when the people ask what comes next, sire?' },
        { who: 0, text: 'They will not ask. They will be at the parade, looking for the geese.' },
        { who: 2, text: 'I think they will look at us, sire. There is nobody else left to look at.' },
        { who: 1, text: 'I have a column for that. It is the only empty one.' },
      ],
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
    variants: [
      [
        { who: 0, text: 'I saved you a place by the fire. A soft stone. I sat on it first, to be sure.' },
        { who: 1, text: 'I came to read the decree.' },
        { who: 0, text: 'And I came to hear it. Together we make a very sad audience.' },
        { who: 1, text: 'I do not think I can read it aloud again.' },
        { who: 0, text: 'Then read it softly. True things are always said softly.' },
        { who: 1, text: 'Will anyone hear?' },
        { who: 0, text: 'The goats might. They are excellent listeners.' },
      ],
      [
        { who: 1, text: 'Elder, I brought you a very large trumpet.' },
        { who: 0, text: 'I am too old to blow it.' },
        { who: 1, text: 'It is not for blowing. When they ask who read the decree, I want to be holding it.' },
        { who: 0, text: 'You wish to be remembered as the herald?' },
        { who: 1, text: 'I wish to be remembered as the one who stopped.' },
        { who: 0, text: 'Then stop, and tell the others. Loud is only how a trumpet is brave.' },
      ],
      [
        { who: 0, text: 'You came alone, without soldiers. Are you lost?' },
        { who: 1, text: 'Very. I lost my way somewhere around the second proclamation.' },
        { who: 0, text: 'How many proclamations did it take?' },
        { who: 1, text: 'I stopped counting. It is how I know it went wrong.' },
        { who: 0, text: 'We count by harvests. Come, we will teach you. It ends better.' },
      ],
      [
        { who: 1, text: 'Elder, I died last spring. A goblin spear. The Order had me back on my feet by the afternoon.' },
        { who: 0, text: 'And the goblin?' },
        { who: 1, text: 'The hunters found him the next week. Nobody brought him back. Nobody could.' },
        { who: 0, text: 'No. We have no priest for that. Every name we lose, we lose for good. We keep them in songs instead.' },
        { who: 1, text: 'I am sorry. I am alive to say so, which is rather the problem.' },
        { who: 0, text: 'Then spend the life they keep giving you. Spend it on the truth. They will only hand you another.' },
      ],
      [
        { who: 1, text: 'Elder, I have written a new decree. Only true things in it. May I practise on you?' },
        { who: 0, text: 'Go on. I have heard the old one enough to know the tune.' },
        { who: 1, text: 'Hear ye. We came for the land. We were paid by the head. We were never in danger.' },
        { who: 0, text: 'Shorter than the old one.' },
        { who: 1, text: 'The old one needed a great many words to say nothing.' },
        { who: 0, text: 'Read it in every square you pass. Someone will stop. Somebody always does.' },
      ],
      [
        { who: 0, text: 'I am very old, Herald. I forget my own porridge. I will forget this too.' },
        { who: 1, text: 'Then I will remember it for you.' },
        { who: 0, text: 'All of it? The wagons, the notices, the counting?' },
        { who: 1, text: 'I read every line of it aloud. It is difficult to forget a thing you said yourself.' },
        { who: 0, text: 'Good. Then I can go back to forgetting my porridge in peace.' },
        { who: 1, text: 'It is on your knee, Elder.' },
      ],
      [
        { who: 1, text: 'I told the story in the market. Three people stopped.' },
        { who: 0, text: 'Three! That is a crowd. Who were they?' },
        { who: 1, text: 'A baker, a girl with a goose, and a man who thought I was selling something.' },
        { who: 0, text: 'Did he stay?' },
        { who: 1, text: 'To the end. He said it was not what he came for, but he would tell his brother.' },
        { who: 0, text: 'Then it was four. It always grows. That is how the decree spread, too.' },
      ],
      [
        { who: 1, text: 'I meant to burn the decree. I have carried it so long it has gone soft.' },
        { who: 0, text: 'Do not burn it. Keep it. Show the children the seal at the bottom.' },
        { who: 1, text: 'Why the seal?' },
        { who: 0, text: 'So they know it was not wolves or weather. Somebody signed it. In good ink.' },
        { who: 1, text: 'The Registrar was very proud of that ink.' },
        { who: 0, text: 'Then let it last. Good ink is the one thing he got right.' },
      ],
      [
        { who: 0, text: 'The book in the city is full of numbers. Will you write some names for me instead?' },
        { who: 1, text: 'I only know how to read out loud, Elder. I am a poor writer.' },
        { who: 0, text: 'Then read them back to me. Tamsin. Old Brannoch. The twins who never sat still.' },
        { who: 1, text: 'Tamsin. Old Brannoch. The twins who never sat still.' },
        { who: 0, text: 'There. That is the first true decree you ever read.' },
        { who: 1, text: 'It is very short.' },
        { who: 0, text: 'I am old. We will add to it as I remember. Come back tomorrow.' },
      ],
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
