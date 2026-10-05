// Lines the party says during a run (docs/12-story.md, "Characters and the party"). A class has a voice and a stance;
// whoever is in the party speaks in it. Cosmetic: nothing here touches the sim.
//
// Each trigger has many lines per tier, so the same moment sounds different from run to run, and the render side
// avoids repeating a line it said recently. Tiers follow the chapters: 0 = I, 1 = II-III, 2 = IV-V.
// The bitmap font has no commas or apostrophes: write without them.
import { createRng, rngInt, Stream } from '../../engine/rng';

export type BarkTrigger =
  | 'start'   // a few seconds in
  | 'idle'    // ambient chatter on the road
  | 'streak'  // the kill tally passes a mark
  | 'clear'   // a big crowd falls at once
  | 'boss'    // the Warlord appears
  | 'camp'    // R1 plays: the camp that does not attack
  | 'surrender' // a mob lays down its arms (from chapter II)
  | 'betray'  // a mob that had surrendered is killed anyway
  | 'hurt'    // a hero is low on health
  | 'down'    // a hero falls
  | 'coin'    // the purse passes a mark
  | 'win'
  | 'lost';
export const BARK_TRIGGERS: readonly BarkTrigger[] = ['start', 'idle', 'streak', 'clear', 'boss', 'camp', 'surrender', 'betray', 'hurt', 'down', 'coin', 'win', 'lost'];
export const VOICE_TIERS = 3;

type Lines = readonly [readonly string[], readonly string[], readonly string[]];
export type Voice = Record<BarkTrigger, Lines>;

export function voiceTier(chapter: number): number {
  return chapter <= 1 ? 0 : chapter <= 3 ? 1 : 2;
}

const NONE: readonly string[] = [];

export const VOICES: Record<string, Voice> = {
  // Believer: duty, the walls. Last to doubt and breaks hardest.
  warrior: {
    start: [
      ['Another bounty. Another day!', 'The walls hold because we do.', 'Let us make the roads safe!', 'Stay sharp. Stay together.', 'Folks sleep sounder when we are done.', 'Forward. The city is counting on us.'],
      ['Do the job. Do not think on it.', 'Orders are orders. Forward.', 'The Crown knows best. It must.', 'Keep your eyes on the road.'],
      ['Almost done. That is all that matters.', 'One foot. Then the next.', 'I have to believe in this.', 'Finish it. Then rest.'],
    ],
    idle: [
      ['Fine weather for it.', 'My mother worried. I said it was easy work.', 'Good road. Solid ground.', 'When this is done I buy the drinks.', 'I could get used to this pay.', 'Keep your eyes up. Do not dream.', 'Smell that? Wood smoke somewhere.'],
      ['Quiet today. Too quiet.', 'Funny. They do not run like beasts.', 'I keep thinking I hear singing.', 'Pay is pay. It is pay.', 'Walk on. Just walk on.'],
      ['My hands will not stop shaking.', 'I used to sleep well.', 'Tell me this was worth it.', 'I keep seeing the little ones.', 'We were the good ones. We were.'],
    ],
    streak: [
      ['Hundred and counting!', 'That is how it is done!', 'They will tell stories about this!', 'The road is clearing nicely.', 'Not one gets past us!', 'Do you hear that? That is safety.'],
      ['Keep swinging. Stay steady.', 'Do not slow down now.', 'Eyes forward. Arms up.', 'Do not look too long.'],
      ['Do not count them.', 'I will not tally. I will not.', 'Keep moving. Keep moving.', 'Numbers are just numbers.'],
    ],
    clear: [
      ['Ha! Did you see that?!', 'Cleared the lot!', 'That is a hundred gone!', 'Not so tough now!', 'Make way!'],
      ['That was a lot of them.', 'Faster than I thought. Too fast.', 'They just keep coming.', 'Stay steady. Stay steady.'],
      ['So many. So very many.', 'That was no battle.', 'They did not even raise a hand.', 'I cannot feel my arms.'],
    ],
    boss: [
      ['That must be their warlord!', 'One more and the road is clear.', 'Big one. Good. Let us finish it!', 'Cut off the head. The rest will scatter.', 'Shields up. Here it comes!', 'That is the one on the notice!'],
      ['Another chief. Same as the rest.', 'It is only a leader. Only a leader.', 'Strike fast. Do not let it speak.', 'Do not listen to it.'],
      ['I will not look at its face.', 'Quick. Make it quick.', 'Whatever it says do not listen.', 'Just another warlord. Just another.'],
    ],
    camp: [['That one is not attacking.', 'Odd. It just stands there.', 'It is not even armed.', 'Huh. A cookfire out here.', 'It is watching us. Why is it watching?', 'Maybe it is a trap. Careful.'], NONE, NONE],
    surrender: [NONE, ['It put its weapon down.', 'Hold. It is yielding.', 'Stand easy. Stand easy.', 'Do I strike it? It gave up.'], ['Let it go. Let it go.', 'Good. Run. Run far.', 'I will not touch it.', 'One less to carry.']],
    betray: [NONE, ['That one had surrendered.', 'Careful! It was yielding!', 'I did not see. I did not see.', 'Mind your blades!'], ['It was kneeling.', 'I knew. I knew and I swung.', 'It was kneeling and we killed it.', 'Never again.']],
    hurt: [
      ['Ugh. Just a scratch!', 'Still standing!', 'Is that all you have?!', 'I have had worse!'],
      ['That hurts. Good. Maybe.', 'Keep going. Keep going.', 'I am fine. Do not look.'],
      ['Maybe I deserve that.', 'Let it hurt.', 'Do it. Do it again.'],
    ],
    down: [
      ['Hang on! I am coming!', 'Get up! We need you!', 'Cover them!', 'Not today. Not today!'],
      ['No no no. Stay with us.', 'Up. Get up.', 'We cannot lose another.'],
      ['Not you too.', 'Is it worth this?', 'Please get up.'],
    ],
    coin: [
      ['Coin for the city!', 'Not bad for a morning.', 'The Crown is generous.', 'That will feed a few families.'],
      ['Pay is pay.', 'Do not think about the coin.', 'The coin is good. That is all.'],
      ['Blood money. No. Just money.', 'I do not want it.', 'Whose is this?'],
    ],
    win: [
      ['Victory!', 'The road is ours!', 'Take that to the city!', 'They will cheer for us!'],
      ['It is done. Is it done?', 'We did what we were asked.', 'That is that.'],
      ['It is over. It is not over.', 'I want to go home.', 'What have we done?'],
    ],
    lost: [
      ['Fall back! Fall back!', 'We will be back!', 'We regroup. We return.', 'Not today. Next time.'],
      ['Retreat. We retreat.', 'Perhaps it is a sign.', 'We were not ready.'],
      ['Good. Maybe it is enough.', 'Perhaps it is a mercy.', 'Let us rest.'],
    ],
  },

  // Scholar: reads the evidence, says nothing.
  mage: {
    start: [
      ['Fascinating terrain. Shall we?', 'Note the wind. We will want it.', 'I have charted this valley. Mostly.', 'The air smells of rain. Pity.', 'Do keep clear of my left side.', 'Let us be efficient about this.'],
      ['Hm.', 'I have been reading the ledgers.', 'Efficient. Let us be efficient.', 'Mind the details. Always the details.'],
      ['I have read the ledgers.', 'I know what is written.', 'I wish I had not read it.', 'Forward. Without comment.'],
    ],
    idle: [
      ['The geology here is remarkable.', 'I should write this up.', 'Do you know the stars over this valley?', 'I packed three books. Foolish.', 'Magic is mostly patience. And fire.', 'Did you hear that? Birdsong.', 'I wonder who farmed this land.'],
      ['Their tools are well made.', 'That is a child toy on the ground.', 'Whose fire was that?', 'The maps do not match the land.', 'Mm. Curious.'],
      ['I have read the quotas. All of them.', 'I knew. I knew and I came.', 'Knowledge is not absolution.', 'There is no spell for this.', 'I will remember every name.'],
    ],
    streak: [
      ['Statistically tidy.', 'The count rises nicely.', 'A pleasing rate of progress.', 'Textbook. Truly textbook.', 'Let me note that down.', 'Efficient work. Efficient indeed.'],
      ['The numbers do not add up.', 'The tally is larger than the report.', 'Odd. Their numbers were wrong.', 'Let me check that count again.'],
      ['I stopped counting.', 'The number is meaningless.', 'I would rather not write that down.', 'One does not forget a figure like this.'],
    ],
    clear: [
      ['Quite thorough!', 'Neat. Very neat.', 'That went rather well.', 'Fire does so love a crowd.', 'Magnificent.'],
      ['That was rather a lot of them.', 'I wonder what they had left.', 'They barely resisted.', 'Too easy. Why too easy?'],
      ['No. Not magnificent.', 'I did that.', 'They did not even run.', 'I will not call it a victory.'],
    ],
    boss: [
      ['A big one. Mind the club.', 'Likely the leader.', 'Observe how it stands. Confident.', 'The reports did not do it justice.', 'Do be careful. It is rather large.', 'Fire. Plenty of fire.'],
      ['They have a leader. Leaders have reasons.', 'It is guarding something. Not attacking.', 'Note how its people gather behind it.', 'It is shielding the others.'],
      ['I know what the ledger says.', 'It is merely defending its own.', 'Forgive me.', 'I will end it cleanly.'],
    ],
    camp: [['Behavior outside the norm. Interesting.', 'It has not moved. Why?', 'A hearth. A fire. Cooked food?', 'Not an ambush. How curious.', 'That is not feral conduct.', 'Hm. A camp. Properly kept.'], NONE, NONE],
    surrender: [NONE, ['Observe. It yields.', 'Fascinating. They do that.', 'A white flag. How civilized.', 'It has stopped. Why?'], ['Good. Good.', 'Let it go. Please.', 'They always could.', 'I would like to remember that.']],
    betray: [NONE, ['My fault. A stray spell.', 'Oh. That one was kneeling.', 'Careless. Very careless.', 'Apologies.'], ['I am sorry. I am sorry.', 'It was kneeling. I saw.', 'My fire does not choose.', 'That one is on me.']],
    hurt: [
      ['Ow. Ow. Ow.', 'Careful! I am fragile!', 'That was uncalled for!', 'I did not agree to that.'],
      ['Hm. A fair exchange.', 'I am not sure I blame them.', 'Yes. Fine. That is fair.'],
      ['Good.', 'Yes. Perhaps.', 'I accept that.'],
    ],
    down: [
      ['Oh dear. Hold on!', 'Someone! Quickly!', 'I have you!', 'Do not move!'],
      ['Oh no. Not again.', 'Please. Please get up.', 'We cannot keep doing this.'],
      ['Stay down. It is safer.', 'Perhaps stay down.', 'Stop. Please stop.'],
    ],
    coin: [
      ['Splendid.', 'That will buy a few books.', 'Coin is a fine tool.', 'Excellent.'],
      ['Funded by the Crown. Of course.', 'I would rather not know the source.', 'Is this the Crown coin?'],
      ['I cannot spend this.', 'This is not pay.', 'Tainted. All of it.'],
    ],
    win: [
      ['Excellent work all!', 'A tidy result.', 'Written up. Done.', 'Splendid. Tea?'],
      ['Done. As ordered.', 'I do not feel victorious.', 'I shall write this up honestly.'],
      ['It is done. I will carry it.', 'The ledger is full.', 'I will not write this one.'],
    ],
    lost: [
      ['A tactical withdrawal!', 'We shall try again.', 'Well. That was educational.', 'Back to the map.'],
      ['Perhaps we should not return.', 'A pause may be wise.', 'A good moment to think.'],
      ['Thank goodness.', 'Perhaps no one else should die.', 'Let it end.'],
    ],
  },

  // Conscience: first to question, most to lose.
  cleric: {
    start: [
      ['Light keep us.', 'Stay close. I will mend what I can.', 'Walk with courage. I am behind you.', 'May the road be short.', 'I pray this goes quickly.', 'Let us do right by one another.'],
      ['Are we sure about this?', 'I keep asking if this is right.', 'Something about the notice troubles me.', 'I will heal you. I will also ask questions.'],
      ['I cannot bless this.', 'I have nothing left to bless it with.', 'Forgive me. Forgive us.', 'I walk because you walk.'],
    ],
    idle: [
      ['I should thank the light more often.', 'Remember to drink water.', 'I miss the temple bells.', 'Keep a hand free for healing.', 'Pretty morning. Is it not?', 'Have you eaten?', 'I will say a prayer for the road.'],
      ['I keep praying. Nothing answers.', 'Did you see their eyes?', 'Why does it feel like we are the beasts?', 'The bounty said monsters.', 'I hear crying sometimes.'],
      ['I will not be able to heal this.', 'Pray with me.', 'I do not think the light is here.', 'I counted the graves.', 'No blessing washes this.'],
    ],
    streak: [
      ['Easy. Mind your footing.', 'Praise the light. Keep it up.', 'Well fought!', 'Steady. Breathe.', 'The light is with you.', 'Thank the light for that.'],
      ['So many. So quickly.', 'Are they ever going to stop?', 'That is a great many souls.', 'Slow down. Please slow down.'],
      ['Please. Enough.', 'Let it end.', 'I cannot bear the number.', 'How many more?'],
    ],
    clear: [
      ['Praise the light!', 'That was a great blow!', 'Careful. Do not overextend.', 'Well done!', 'May they find peace.'],
      ['That was so many at once.', 'They did not stand a chance.', 'I could not heal that.', 'Oh. Oh no.'],
      ['Stop. Stop.', 'They are only trying to live.', 'I cannot watch.', 'What are we?'],
    ],
    boss: [
      ['Stay together. I have you.', 'Heavens. He is huge.', 'Light shield us all!', 'Be brave. I am here.', 'Hold the line. I will mend you.', 'What a monster!'],
      ['It looks afraid. Does it look afraid?', 'Look how they cling to it.', 'It is protecting someone.', 'Why does it not run?'],
      ['Please do not make me watch.', 'I cannot.', 'Spare it. Please spare it.', 'Light forgive us.'],
    ],
    camp: [['They are not fighting back.', 'Wait. Look at that one.', 'A cookfire. Someone lives here.', 'They look so ordinary.', 'It is just standing there.', 'Should we be attacking this?'], NONE, NONE],
    surrender: [NONE, ['Look! It put its weapon down!', 'Thank the light. Thank the light.', 'Hold your swings! It yields!', 'Peace. Peace.'], ['Go. Go in peace.', 'Yes. Yes. Like this.', 'That is all I wanted.', 'Bless you. Run.']],
    betray: [NONE, ['No! It was surrendering!', 'Stop! It was kneeling!', 'Why? Why?', 'It had given up!'], ['I told you. I told you.', 'It was begging. Begging.', 'That is murder.', 'I will never forgive this.']],
    hurt: [
      ['Ow! Heal me!', 'I can mend that. Mostly.', 'Light mend me.', 'Hold on.'],
      ['Perhaps I deserve this.', 'I will heal. Then I will think.', 'Ow. It is nothing.'],
      ['It does not matter.', 'I have no right to complain.', 'Let it hurt.'],
    ],
    down: [
      ['Light preserve you! Hold on!', 'I am coming!', 'Do not leave us!', 'Hang on! Hang on!'],
      ['Not another one.', 'Please. Please open your eyes.', 'I am here. Stay with me.'],
      ['I cannot lose you too.', 'Please do not go.', 'Is this what we get?'],
    ],
    coin: [
      ['Gold for the temple!', 'Alms for the poor.', 'Coin is a blessing.', 'Lucky us.'],
      ['Whose coin is it?', 'I am not sure I want it.', 'Let us give some away.'],
      ['I cannot hold this.', 'It weighs so much.', 'Burn it. Please.'],
    ],
    win: [
      ['Thank the light! We are safe!', 'Well done everyone!', 'A good day.', 'Let us rest and give thanks.'],
      ['It is over. For now.', 'I feel hollow.', 'Was it necessary?'],
      ['Forgive us all.', 'I will pray every night.', 'I did not heal anyone today.'],
    ],
    lost: [
      ['We live! That is enough!', 'Back to the temple!', 'We will mend and return.', 'Be thankful we are alive.'],
      ['Perhaps that is a sign.', 'The light spared us.', 'Let us not go back.'],
      ['Thank you. Thank you.', 'Please let that be the last.', 'We could stop now.'],
    ],
  },

  // Mercenary: honest about the coin, and that is the indictment.
  rogue: {
    start: [
      ['Pay is pay.', 'Let us get paid.', 'Mind the purse. Mind the knife.', 'Quick job. Quick coin.', 'Whoever is paying is not here to see this.', 'I am here for the coin. And the view.'],
      ['Coin is coin.', 'Look. A job is a job.', 'We are paid. That is all.', 'Quick. Clean. Paid.'],
      ['I am in it for the gold. I say.', 'At least I am honest about it.', 'Same job. Worse feeling.', 'I tell myself it is the money.'],
    ],
    idle: [
      ['I could do this for a living. I do.', 'Anyone have a spare sandwich?', 'Do not touch my purse.', 'Ten gold says I outkill you.', 'I have a cousin who would love this view.', 'A knife is a good friend.', 'A bit of luck would not hurt.'],
      ['I am getting an uncomfortable feeling.', 'Funny how small they are up close.', 'The pay keeps going up. Why is that?', 'I did not sign up for this. Or did I?', 'Keep walking.'],
      ['I never said I was good.', 'Take the money. Leave the view.', 'Spend it fast. Spend it all.', 'Do not ask me to say it.', 'I have done worse. Not by much.'],
    ],
    streak: [
      ['Cha-ching!', 'That is a good morning.', 'That is a nice little pile!', 'Business is booming!', 'Count it. I am counting.', 'Easy money. Easy.'],
      ['Money is money. Do not look.', 'The rate is going up. The pay too.', 'Funny. Pay rises as they get smaller.', 'Do not ask whose they were.'],
      ['I know what this is.', 'Pay is higher for a reason.', 'I never claimed to be good.', 'I wanted the coin. I got this.'],
    ],
    clear: [
      ['Whoo! Look at that!', 'That is the stuff!', 'Now THAT is a haul!', 'Beautiful.', 'Pay me twice!'],
      ['That was a little much.', 'Is it supposed to be this easy?', 'I did not need to see that.', 'Easy. Too easy.'],
      ['I knew it. I knew this.', 'They never had a chance.', 'That is how much it pays.', 'Fine. I did it.'],
    ],
    boss: [
      ['Big payday that one.', 'Whoever kills it eats well.', 'That is a month of rent!', 'Leave me a slice of that.', 'That is the target. Smile.', 'Let me line one up.'],
      ['Another head. Another purse.', 'Be quick. It does not matter who he is.', 'Not my business who he is.', 'Do not give it time to talk.'],
      ['At least I never lied about it.', 'I will do this one for free.', 'Right. Get it over with.', 'Knife in. Eyes shut.'],
    ],
    camp: [['Free coin if it stays put.', 'Not worth a stab. Not yet.', 'That fire is a nice touch.', 'Let it cook. We come back.', 'Easy pickings. Bit odd though.', 'What is it doing?'], NONE, NONE],
    surrender: [NONE, ['Huh. It gave up. Lucky it.', 'Not worth the effort.', 'Free pass.', 'I will let that one walk.'], ['Walk. Go on. Walk.', 'I never liked the sight of that.', 'Keep your coin little one.', 'Fine. Live.']],
    betray: [NONE, ['Oops.', 'That one was done anyway.', 'Collateral. Happens.', 'Eh. Accidents.'], ['It was kneeling. I saw.', 'No. No excuses.', 'I do not want to count that one.', 'That is a stain.']],
    hurt: [
      ['Hey! That is my good shirt!', 'Nicked me!', 'Ow. Fine.', 'Lucky cut.'],
      ['Fair. Fair.', 'I earned that.', 'Ow. Ow.'],
      ['Good. Good.', 'Make it hurt.', 'I deserve a few.'],
    ],
    down: [
      ['Get up! You owe me!', 'Hey! No napping!', 'Hold on. I will drag you.', 'Do not die on me!'],
      ['Get up. We cannot do this alone.', 'Come on. Come on.', 'Not you. Not you too.'],
      ['Fine. Take me instead.', 'Take my share. Just get up.', 'What are we doing?'],
    ],
    coin: [
      ['Ka-ching!', 'Mine!', 'Now we are talking.', 'Mind if I pocket that?'],
      ['More. Always more.', 'Feels heavier than it should.', 'Heh. Do not look at it.'],
      ['I do not want it.', 'Take it. All of it.', 'Cursed coin. Fitting.'],
    ],
    win: [
      ['Pay up!', 'Drinks are on me!', 'Easiest money of my life!', 'Where is the payroll?'],
      ['Paid. Done. Moving on.', 'Do not look back.', 'Another job in the books.'],
      ['I am sick of the sound of coin.', 'Pay me last.', 'Do not thank me.'],
    ],
    lost: [
      ['Run! Run for it!', 'Not worth dying for!', 'Live to loot another day!', 'Out! Out!'],
      ['Live. Pay later.', 'Pull out. Pull out.', 'Nothing is worth this.'],
      ['Good call.', 'Let us not do this again.', 'Maybe we stop.'],
    ],
  },

  // Hunter: knows the land, and recognizes a camp as a camp.
  archer: {
    start: [
      ['Good ground. Quiet.', 'I know this valley.', 'Wind is on our side.', 'Nice clear sightlines.', 'Keep to the high grass.', 'Fine day for a hunt.'],
      ['Somebody lives on this land.', 'I know these trails. I think.', 'These tracks are not an animal.', 'Something about this valley is familiar.'],
      ['These were their hunting grounds.', 'I know where this leads.', 'This is their land. It always was.', 'I hear them singing.'],
    ],
    idle: [
      ['Listen. Birds.', 'I can smell rain.', 'Deer tracks up the hill.', 'My grandfather taught me this stretch.', 'I love a quiet morning.', 'Keep your voice down.', 'That bend is a perfect ambush spot.'],
      ['That is a sleeping mat. Small.', 'I found a toy by the road.', 'These are tidy camps.', 'The trails are older than the Crown.', 'Who taught them to farm?'],
      ['I can read every footprint now.', 'The wood is empty.', 'No deer. No birds.', 'I do not hear the singing anymore.', 'We emptied the valley.'],
    ],
    streak: [
      ['Clean shots.', 'Nothing gets past me.', 'Right between the eyes!', 'That is how you shoot!', 'I cannot miss today.', 'Another one down.'],
      ['They were here first.', 'They had the better ground.', 'Count the arrows. I will not.', 'Each one a life. Every shot.'],
      ['I used to hunt here.', 'I used to hunt animals.', 'I miss the deer.', 'They are not game.'],
    ],
    clear: [
      ['Whole flock gone!', 'Nice grouping!', 'Bullseye!', 'Clean sweep!', 'Did you see that?!'],
      ['That was a whole village.', 'They never had a chance.', 'I counted too many.', 'Did they have to be so many?'],
      ['No more.', 'Too quiet now.', 'I did that.', 'That was home to someone.'],
    ],
    boss: [
      ['Look at that frame. A leader.', 'I have a clear line on him.', 'Big target. Easy shot.', 'Aim for the legs. Slow it down.', 'That is a lot of muscle.', 'Keep him busy. I will do the rest.'],
      ['He is guarding something. A camp.', 'Look how they stay close to him.', 'He is not charging. He is covering.', 'He stands like a guard.'],
      ['He held the line for them.', 'He is a hunter too.', 'I do not want this shot.', 'Forgive me.'],
    ],
    camp: [['A camp. A cookfire.', 'That is a hearth.', 'Smoke on the wind. A home.', 'Real camp. Real fire.', 'It tends a fire. Beasts do not.', 'They have set stones around it.'], NONE, NONE],
    surrender: [NONE, ['It dropped its bow.', 'That is a white flag.', 'Easy. It is done fighting.', 'Hold your fire. Hold!'], ['Run home. Run.', 'Good. Get out of here.', 'They know the land. They will live.', 'Go. We will not follow.']],
    betray: [NONE, ['I had it in my sights. Sorry.', 'That arrow was not for it.', 'Careless!', 'It was down. It was down!'], ['It was surrendering.', 'I will not draw again.', 'I watched it fall.', 'I am done.']],
    hurt: [
      ['Got me!', 'Nasty one.', 'Just a graze.', 'I will shoot you for that.'],
      ['I deserved that.', 'Ow. Fair enough.', 'They are only defending.'],
      ['Fair.', 'Let it go.', 'Let it bleed.'],
    ],
    down: [
      ['Man down! Cover him!', 'Hang on! I am drawing them off!', 'I have your back!', 'Hold on!'],
      ['Stay with us.', 'Please. Get up.', 'I cannot do this alone.'],
      ['Not again.', 'Why do we keep going?', 'Get up. We should leave.'],
    ],
    coin: [
      ['Gold glint!', 'A nice little purse.', 'Spend it on arrows.', 'Mine I think.'],
      ['Whose was it?', 'I would trade this for a deer.', 'Take it.'],
      ['I do not want it.', 'Leave it.', 'Blood money.'],
    ],
    win: [
      ['Fine shooting!', 'Good hunt!', 'We did it!', 'That was a good day of work.'],
      ['The hunt is over.', 'I want to go home.', 'No joy in that one.'],
      ['I will never draw again.', 'The land is quiet now.', 'I know every spot we ruined.'],
    ],
    lost: [
      ['Fall back! Fall back!', 'Regroup behind me!', 'Another day!', 'I will cover you!'],
      ['Let us not come back.', 'Perhaps the land is telling us something.', 'Leave while we can.'],
      ['Good. Leave it be.', 'The valley wins.', 'Leave them alone.'],
    ],
  },
};

/** Kill counts at which the party remarks on the tally, and gold amounts at which it remarks on the purse. */
/** How many surrenders make the party remark on it (the first, then a little later). */
export const SURRENDER_MARKS: readonly number[] = [1, 8, 25];
export const STREAK_MARKS: readonly number[] = [120, 300, 550, 850, 1200];
export const COIN_MARKS: readonly number[] = [80, 250, 500];

/**
 * The line for a trigger, picked from the story stream so the same seed says the same thing (and tests can pin it).
 * `salt` tells apart repeats of one trigger; `avoid` is what was said lately, skipped unless nothing else is left.
 */
export function pickBark(seed: number, trigger: BarkTrigger, className: string, chapter: number, salt = 0, avoid?: ReadonlySet<string>): string | undefined {
  const all = VOICES[className]?.[trigger][voiceTier(chapter)];
  if (!all || all.length === 0) return undefined;
  const fresh = avoid ? all.filter((l) => !avoid.has(l)) : all;
  const lines = fresh.length > 0 ? fresh : all;
  const r = createRng((seed ^ Math.imul(salt + 1, 0x9e3779b1) ^ Math.imul(BARK_TRIGGERS.indexOf(trigger) + 1, 0x85ebca6b)) >>> 0, Stream.story);
  return lines[rngInt(r, lines.length)];
}
