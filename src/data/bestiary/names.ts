// Names for generated monsters: "<what marks it> <what it is>", e.g. "cinder hound", "bile mite", "rime brute". The name is what the
// run summary tallies and what a player learns to dread, so it comes from the monster's look and powers, not from a dice roll alone.
import type { MonsterLook } from '../monsterLook';
import { Dice } from './rand';

const NOUN_BY_BUILD: Record<MonsterLook['build'], readonly string[]> = {
  blob: ['blob', 'glob', 'lump', 'ooze', 'gobbet'],
  tall: ['stalker', 'lurker', 'reaper', 'strider', 'walker'],
  squat: ['brute', 'toad', 'grub', 'bruiser', 'lug'],
  wedge: ['snapper', 'hound', 'biter', 'render', 'fang'],
  round: ['bulb', 'puff', 'roller', 'tick', 'bloat'],
  serpent: ['wyrm', 'crawler', 'viper', 'worm', 'slither'],
  insect: ['mite', 'skitter', 'crawler', 'scuttler', 'chitter'],
  floater: ['wisp', 'shade', 'drifter', 'spook', 'eye'],
};
const NOUN_BY_HEAD: Partial<Record<MonsterLook['head'], readonly string[]>> = {
  skull: ['bonehead', 'skull', 'deathmask'],
  cyclops: ['cyclops', 'watcher', 'gazer'],
  maw: ['maw', 'gobbler', 'gulper'],
  hood: ['cultist', 'hex', 'robe'],
  helm: ['guard', 'knight', 'warden'],
  horned: ['bull', 'ram', 'gorer'],
};
const NOUN_BY_HELD: Partial<Record<MonsterLook['held'], readonly string[]>> = {
  bow: ['archer', 'shooter'], sling: ['slinger', 'flinger'], staff: ['mage', 'caller', 'sage'], orb: ['seer', 'oracle'],
  bomb: ['bomber', 'boomer'], shield: ['shieldbearer', 'bulwark'], axe: ['chopper', 'raider'], club: ['basher', 'thug'], sword: ['blade', 'duelist'], spear: ['lancer', 'pikeman'],
};

const ADJ_BY_MOTIF: Record<string, readonly string[]> = {
  fire: ['cinder', 'ember', 'ash', 'blaze', 'scorch'],
  frost: ['rime', 'frost', 'sleet', 'hoar', 'glacial'],
  poison: ['bile', 'venom', 'blight', 'toxic', 'rot'],
  ghost: ['pale', 'hollow', 'wan', 'ghost', 'fade'],
  armor: ['iron', 'plate', 'bastion', 'steel', 'gilded'],
  bones: ['grave', 'bone', 'crypt', 'marrow', 'tomb'],
  fur: ['shaggy', 'wild', 'feral', 'bristle', 'mangy'],
  slime: ['slick', 'mire', 'sludge', 'bog', 'drip'],
  glow: ['gleam', 'lantern', 'glimmer', 'lumen', 'spark'],
  stone: ['rock', 'slate', 'cairn', 'granite', 'flint'],
  bandage: ['wrapped', 'dust', 'linen', 'tomb', 'shroud'],
  thorns: ['thorn', 'barb', 'bramble', 'spike', 'briar'],
};
/** Fallbacks by size when nothing else marks it. */
const ADJ_BY_SIZE = { small: ['tiny', 'sneaky', 'grubby', 'scrappy', 'pesky'], mid: ['grim', 'sour', 'crooked', 'ragged', 'dire'], big: ['hulking', 'grand', 'brutal', 'towering', 'savage'] };

export function nameFor(look: MonsterLook, d: Dice, taken: ReadonlySet<string>): string {
  const nouns = [
    ...(look.held !== 'none' && look.held !== 'club' ? NOUN_BY_HELD[look.held] ?? [] : []),
    ...(NOUN_BY_HEAD[look.head] ?? []),
    ...NOUN_BY_BUILD[look.build],
  ];
  const weighted = look.held !== 'none' && NOUN_BY_HELD[look.held] ? [...NOUN_BY_HELD[look.held]!, ...nouns] : nouns;
  const size = look.size < 11 ? 'small' : look.size < 18 ? 'mid' : 'big';
  const adjs = look.motifs.flatMap((m) => ADJ_BY_MOTIF[m] ?? []);
  for (let tries = 0; tries < 24; tries++) {
    const noun = d.pick(weighted);
    const adj = adjs.length > 0 && d.chance(0.85) ? d.pick(adjs) : d.pick(ADJ_BY_SIZE[size]);
    const name = `${adj} ${noun}`;
    if (!taken.has(name)) return name;
  }
  // a very crowded run: number it
  for (let k = 2; ; k++) {
    const name = `${d.pick(ADJ_BY_SIZE[size])} ${weighted[0]} ${k}`;
    if (!taken.has(name)) return name;
  }
}

const BOSS_RANK = ['king', 'queen', 'lord', 'tyrant', 'baron', 'matron', 'overseer', 'warden', 'maw', 'father', 'mother', 'colossus'];
const BOSS_OF = ['of the Hollow', 'of Ash', 'of the Deep', 'of Ruin', 'of the Last Road', 'of Teeth', 'of Sorrow', 'of the Pit', 'of Thorns', 'the Unwelcome'];

/** A boss's health-bar title (upper case): "CINDER HOUND KING". */
export function bossTitle(look: MonsterLook, d: Dice, taken: ReadonlySet<string>): string {
  const adj = look.motifs.length > 0 ? d.pick(ADJ_BY_MOTIF[d.pick(look.motifs)] ?? ADJ_BY_SIZE.big) : d.pick(ADJ_BY_SIZE.big);
  const noun = d.pick(NOUN_BY_BUILD[look.build]);
  for (let tries = 0; tries < 24; tries++) {
    const t = (d.chance(0.5) ? `${adj} ${noun} ${d.pick(BOSS_RANK)}` : `the ${adj} ${d.pick(BOSS_RANK)} ${d.pick(BOSS_OF)}`).toUpperCase();
    if (!taken.has(t)) return t;
  }
  return `THE ${adj} ${noun} ${taken.size + 2}`.toUpperCase();
}
