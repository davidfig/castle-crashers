// Composed barks: a class's ambient chatter built from a lead (something seen or noticed on the road, with a named thing filled in)
// and a tail (how that class takes it at this stage of the story), so the road does not run dry of things to say. Hand-written
// lines in barks.ts remain the beat-carrying core; these are the filler around them. No commas or apostrophes (docs/12-story.md).
import type { Rng } from '../../engine/rng';
import { storyWidth } from '../storyFont';
import { choose, fill, genRng } from './gen';

const VOICE_TIERS = 3;

interface Parts {
  /** What the class notices, any time. */
  leads: readonly string[];
  /** How they take it, by voice tier (I, II-III, IV-V). */
  tails: readonly [readonly string[], readonly string[], readonly string[]];
}

export const BARK_PARTS: Record<string, Parts> = {
  warrior: {
    leads: ['Is that {food} I smell?', 'Look. A {beast} on the road.', 'The {weather} cannot stop us.', '{num} days on the road now.', 'Mind the {weather}.', 'Good ground under us.', 'That {thing} was well made.', 'Not far to {place} now.'],
    tails: [
      ['Spirits are high.', 'Keep the pace up.', 'Home by dark I say.', 'Not a bad life.', 'I could march all day.'],
      ['Stay alert all the same.', 'Keep your thoughts close.', 'It is too quiet.', 'Eyes forward.', 'Do not ask me why.'],
      ['Never mind. Keep walking.', 'I cannot taste a thing.', 'It all looks different now.', 'Do not stop to think.', 'Say nothing. Walk.'],
    ],
  },
  mage: {
    leads: ['I measured the {weather} today.', 'That {beast} has an odd gait.', 'The map has {food} on it.', '{num} paces to the next rise.', 'The air tastes of {weather}.', 'I read of {place} once.', 'Note the old {thing} there.'],
    tails: [
      ['Fascinating really.', 'I shall write it up.', 'Do remind me later.', 'A pleasant diversion.', 'Splendid. Quite splendid.'],
      ['It does not fit the record.', 'Odd. Very odd.', 'The maps lied somewhere.', 'I keep revising my notes.', 'Hm. I must check that.'],
      ['I cannot write this one.', 'No book covers this.', 'Knowing is the burden.', 'I wish I could forget.', 'There is no footnote for it.'],
    ],
  },
  cleric: {
    leads: ['I blessed that {beast} in passing.', 'Drink water friends.', 'The {weather} will pass.', 'I counted {num} birds today.', 'There is {food} in my pack.', '{num} steps since the stream.', 'Someone prayed at {place} once.', 'I found a {thing} by the way.'],
    tails: [
      ['Light keep us all.', 'Share it if you like.', 'All will be well.', 'Stay close to me.', 'What a lovely day.'],
      ['I wonder who prays here.', 'I do not feel at peace.', 'Something is off.', 'I keep looking back.', 'I wonder whose it was.'],
      ['It brings no comfort.', 'I cannot pray it away.', 'Nothing blesses this.', 'Hold my hand.', 'I have nothing left to give.'],
    ],
  },
  rogue: {
    leads: ['Bet on the {weather} anyone?', 'That {beast} had a fine purse.', '{num} gold says we beat the rest.', 'I lifted a {thing} back there.', 'Smell that {food}? Worth a coin.', 'A free {thing} by the road.', 'Who would hide {food} here?'],
    tails: [
      ['Easy living.', 'Beats honest work.', 'I like this job.', 'Do not tell the cleric.', 'Not bad at all.'],
      ['Wait. Whose was that?', 'I give it back. Maybe.', 'Funny how it feels.', 'Never mind.', 'It sat wrong with me.'],
      ['I will not keep it.', 'Not worth the guilt.', 'I used to like this.', 'Put it down.', 'I do not want it.'],
    ],
  },
  archer: {
    leads: ['Fresh {beast} tracks here.', 'The {weather} comes from the east.', 'I smell {food} on the wind.', 'A {beast} watched us pass.', '{num} paces to that ridge.', 'The grass bends toward {place}.', 'Someone left a {thing} here.'],
    tails: [
      ['Good hunting country.', 'Quiet. Just how I like it.', 'Keep low.', 'Nothing escapes this valley.', 'I could stay here.'],
      ['Someone walks here daily.', 'These trails are tended.', 'Whose land was this?', 'I do not like this country.', 'This was lived in.'],
      ['The tracks are all gone.', 'No one tends it now.', 'It was a good valley.', 'I looked away.', 'It was theirs.'],
    ],
  },
};

BARK_PARTS.shaman = BARK_PARTS.cleric;

/** Widest a bark may be in the story font (a speech bubble). */
export const BARK_MAX_W = 230;

/**
 * A composed idle line for a class at a voice tier, or undefined when the class has none or `avoid` rules everything out.
 * Pure in (seed, salt); tries a few combinations for one that fits a bubble and has not just been said.
 */
export function genBark(seed: number, className: string, tier: number, salt: number, avoid?: ReadonlySet<string>): string | undefined {
  const p = BARK_PARTS[className];
  if (!p || tier < 0 || tier >= VOICE_TIERS) return undefined;
  const r: Rng = genRng(seed ^ 0x2545f491, salt + 31);
  for (let tries = 0; tries < 8; tries++) {
    const used = new Map<string, readonly [string, string]>();
    const text = `${fill(choose(r, p.leads), r, used)} ${choose(r, p.tails[tier])}`;
    if (storyWidth(text) <= BARK_MAX_W && !avoid?.has(text)) return text;
  }
  return undefined;
}
