// Names for generated monsters: "<what marks it> <what it is>", e.g. "cinder hound", "bile mite", "rime brute". The name is what the
// run summary tallies and what a player learns to dread, so it comes from the monster's look and powers, not from a dice roll alone.
import type { MonsterLook } from '../monsterLook';
import { ELEMENTS } from '../elements';
import { Behavior } from '../mobs';
import { Dice } from './rand';
import { SPECIES_BY_ID, type Species } from './species';

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

/** The nouns a species goes by in a role ("goblin archer" when it shoots). */
function nounsFor(sp: Species, role: number): readonly string[] {
  const special = role === Behavior.Ranged ? sp.ranged : role === Behavior.Caster ? sp.caster : role === Behavior.Bomber ? sp.bomber : undefined;
  return special ?? sp.nouns;
}

export function nameFor(look: MonsterLook, d: Dice, taken: ReadonlySet<string>, elements: readonly number[] = [], role: number = Behavior.Melee): string {
  const sp = SPECIES_BY_ID.get(look.kind ?? '') ?? SPECIES_BY_ID.get('goblin')!;
  const nouns = nounsFor(sp, role);
  const size = look.size < 11 ? 'small' : look.size < 18 ? 'mid' : 'big';
  const clash = (a: string): boolean => [...SPECIES_BY_ID.values()].some((x) => x.nouns.some((n) => n.includes(a)) || x.id === a);
  const adjs = [...elements.slice(0, 2).flatMap((el) => [...ELEMENTS[el].words, ...ELEMENTS[el].words]), ...look.motifs.filter((m) => !sp.motifs.includes(m)).flatMap((m) => ADJ_BY_MOTIF[m] ?? [])].filter((a) => !clash(a));
  for (let tries = 0; tries < 24; tries++) {
    const noun = d.pick(nouns);
    const name = d.chance(0.8) && adjs.length > 0 ? `${d.pick(adjs)} ${noun}` : d.chance(0.5) ? `${d.pick(ADJ_BY_SIZE[size])} ${noun}` : noun;
    if (!taken.has(name)) return name;
  }
  // a very crowded run: number it
  for (let k = 2; ; k++) {
    const name = `${d.pick(ADJ_BY_SIZE[size])} ${nouns[0]} ${k}`;
    if (!taken.has(name)) return name;
  }
}

const BOSS_OF = ['of the Hollow', 'of Ash', 'of the Deep', 'of Ruin', 'of the Last Road', 'of Teeth', 'of Sorrow', 'of the Pit', 'of Thorns', 'Unwelcome'];

/** A boss's health-bar title (upper case): "CINDER OGRE KING". */
export function bossTitle(look: MonsterLook, d: Dice, taken: ReadonlySet<string>, elements: readonly number[] = []): string {
  const sp = SPECIES_BY_ID.get(look.kind ?? '') ?? SPECIES_BY_ID.get('ogre')!;
  const adj = elements.length > 0 ? d.pick(ELEMENTS[elements[0]].words) : look.motifs.length > 0 ? d.pick(ADJ_BY_MOTIF[d.pick(look.motifs)] ?? ADJ_BY_SIZE.big) : d.pick(ADJ_BY_SIZE.big);
  const named = sp.boss ?? sp.nouns;
  for (let tries = 0; tries < 24; tries++) {
    const t = (d.chance(0.55) ? `${adj} ${d.pick(named)}` : `the ${d.pick(named)} ${d.pick(BOSS_OF)}`).toUpperCase();
    if (!taken.has(t)) return t;
  }
  return `THE ${adj} ${named[0]} ${taken.size + 2}`.toUpperCase();
}
