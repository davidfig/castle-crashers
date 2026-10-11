// What a generated monster *is*: a creature out of a fantasy bestiary (goblin, skeleton, wolf, ogre, wraith...) instead of a dice roll over body
// parts. A species fixes the body plan, head, limbs, gear and the colours nature (or the grave) would give it; the powers a monster wears then
// only tint it (an ember in the eyes, frost on the fur), and the species picks which species suit a monster's role, size, biome and powers.
// The name comes from the species too ("cinder goblin", "frost wolf"), so what you read is what you see.
import { Behavior } from '../mobs';
import type { BackKind, Build, CrownKind, HeadKind, HeldKind, JawKind, LimbKind, Motif, PatternKind, WornKind } from '../monsterLook';

type Span = readonly [number, number];

export interface Species {
  id: string;
  /** Names: the plain noun(s), and what it is called when it shoots, casts or bursts. */
  nouns: readonly string[];
  ranged?: readonly string[];
  caster?: readonly string[];
  bomber?: readonly string[];
  /** Added to the name of a boss ("... king"). */
  boss?: readonly string[];
  build: readonly Build[];
  limbs: LimbKind;
  head: readonly HeadKind[];
  back: readonly BackKind[];
  crown: readonly CrownKind[];
  /** Melee gear (the other roles carry what the role needs, if it has hands to hold it). */
  held: readonly HeldKind[];
  eyes: Span;
  teeth: boolean;
  stout: Span;
  /** The motifs it always wears (what it is made of: bones, fur, stone...). */
  motifs: readonly Motif[];
  /** What its mouth has (fangs, tusks, a beak...), how its hide is marked, and what it wears. Repeats weight a choice. */
  jaw: readonly JawKind[];
  pattern: readonly PatternKind[];
  worn: readonly WornKind[];
  /** Which sizes it comes in (px standing height, see lookFor). */
  size: Span;
  /** Which roles it can have, with weights (Melee, Ranged, Bomber, Boss, Caster). */
  roles: Partial<Record<number, number>>;
  /** How common it is in each biome (Meadow, Keep, Frozen, Marsh, Dunes). */
  biomes: readonly [number, number, number, number, number];
  /** How likely it is to be a boss (0 = never). */
  bossWeight?: number;
  /** Powers it suits (ids or kinds, see traits.ts) and by how much. */
  likes?: Record<string, number>;
  /** Colours: the body hue/saturation/lightness, the trim, and whether the body takes the biome's cloth colour instead (robes, tabards). */
  hue: Span;
  sat: Span;
  light: Span;
  /** Trim colour: hue offsets from the body (cloth, belly, ornaments). */
  trim: readonly number[];
  cloth?: boolean;
  /** Made of its element: the body takes the element's colour (sprites, golems of ember). Otherwise the element only lights its eyes and trim. */
  tint?: boolean;
}

const M = Behavior.Melee, R = Behavior.Ranged, B = Behavior.Bomber, C = Behavior.Caster, BOSS = Behavior.Boss;

export const SPECIES: readonly Species[] = [
  { id: 'goblin', nouns: ['goblin', 'grunt', 'gobbo'], ranged: ['goblin archer', 'goblin slinger'], bomber: ['goblin sapper', 'powder goblin'], caster: ['goblin shaman'], boss: ['goblin king', 'warchief'],
    build: ['tall', 'squat'], limbs: 'biped', head: ['round', 'round', 'beast', 'cone', 'mask'], back: ['none', 'none', 'cape', 'pack', 'banner'], crown: ['ears', 'ears', 'none', 'mohawk', 'hat'], held: ['club', 'sword', 'spear', 'axe', 'dagger', 'pick', 'torch'], eyes: [2, 2], teeth: true, stout: [0.8, 1.05], motifs: [], jaw: ['plain', 'fangs', 'tusks'], pattern: ['none', 'none', 'belly', 'spots', 'mottled'], worn: ['none', 'belt', 'scarf', 'necklace', 'sash', 'bracers'],
    size: [7, 15], roles: { [M]: 4, [R]: 3, [B]: 4, [C]: 1, [BOSS]: 1 }, biomes: [5, 0.5, 0.5, 1.5, 1.5], bossWeight: 0.6, likes: { pack: 1.5, swarm: 2.5, lunge: 1.5 },
    hue: [85, 115], sat: [0.4, 0.55], light: [0.36, 0.46], trim: [-60, 30, 150], cloth: false },
  { id: 'orc', nouns: ['orc', 'brute', 'marauder'], ranged: ['orc axe-thrower'], caster: ['orc warlock'], boss: ['orc warlord', 'war-boss'],
    build: ['squat', 'wedge'], limbs: 'biped', head: ['maw', 'horned', 'helm', 'round', 'mask'], back: ['none', 'none', 'cape', 'banner', 'pack', 'mane'], crown: ['none', 'none', 'horns', 'mohawk'], held: ['axe', 'club', 'sword', 'mace', 'hammer'], eyes: [2, 2], teeth: true, stout: [1.05, 1.4], motifs: [], jaw: ['tusks', 'tusks', 'fangs', 'beard'], pattern: ['none', 'none', 'patches', 'stripes'], worn: ['belt', 'pauldron', 'necklace', 'bracers', 'collar', 'none'],
    size: [13, 26], roles: { [M]: 4, [R]: 0.4, [C]: 0.3, [BOSS]: 1 }, biomes: [4, 1, 1.5, 1, 2], bossWeight: 1.4, likes: { charge: 2, berserk: 2.5, armor: 1.5, shield: 1.5 },
    hue: [75, 105], sat: [0.28, 0.4], light: [0.3, 0.4], trim: [-70, 20, 170] },
  { id: 'troll', nouns: ['troll', 'bog troll', 'cave troll'], boss: ['troll king', 'troll mother'],
    build: ['squat'], limbs: 'biped', head: ['maw', 'round', 'horned', 'long', 'toad'], back: ['none', 'spikes', 'mane', 'quills', 'crystals'], crown: ['none', 'ears', 'mohawk', 'sprout'], held: ['club', 'club', 'none', 'hammer'], eyes: [2, 2], teeth: true, stout: [1.2, 1.5], motifs: ['stone'], jaw: ['tusks', 'fangs', 'plain', 'beard'], pattern: ['mottled', 'patches', 'belly', 'none'], worn: ['none', 'none', 'necklace', 'belt'],
    size: [18, 28], roles: { [M]: 4, [BOSS]: 1 }, biomes: [2, 0.5, 1, 4, 1], bossWeight: 1.4, likes: { regen: 3, mud: 3, burst: 1.5 },
    hue: [90, 150], sat: [0.18, 0.3], light: [0.34, 0.42], trim: [30, 90, -60] },
  { id: 'ogre', nouns: ['ogre', 'brute', 'bruiser'], boss: ['ogre king', 'ogre chief', 'giant'],
    build: ['squat'], limbs: 'biped', head: ['round', 'maw', 'helm', 'toad', 'cone'], back: ['none', 'pack'], crown: ['none', 'none', 'ears', 'hat', 'mohawk'], held: ['club', 'axe', 'club', 'hammer', 'mace'], eyes: [2, 2], teeth: true, stout: [1.2, 1.5], motifs: [], jaw: ['tusks', 'plain', 'beard', 'fangs'], pattern: ['none', 'belly', 'patches'], worn: ['belt', 'belt', 'necklace', 'pauldron', 'none'],
    size: [19, 28], roles: { [M]: 3, [BOSS]: 1 }, biomes: [2, 1, 1, 0.5, 2], bossWeight: 1.5, likes: { armor: 1.5, berserk: 1.5, charge: 1.5 },
    hue: [14, 34], sat: [0.35, 0.5], light: [0.42, 0.52], trim: [180, 200, -40] },
  { id: 'skeleton', nouns: ['skeleton', 'bonewalker', 'skeleton warrior'], ranged: ['skeleton archer', 'bone archer'], caster: ['skeleton mage', 'bone caller'], boss: ['skeleton king', 'bone lord'],
    build: ['tall'], limbs: 'biped', head: ['skull'], back: ['none', 'none', 'cape', 'banner'], crown: ['none', 'none', 'crest', 'hat', 'horns'], held: ['sword', 'spear', 'club', 'shield', 'axe', 'scythe', 'dagger', 'mace', 'pick'], eyes: [2, 2], teeth: false, stout: [0.8, 1], motifs: ['bones'], jaw: ['plain'], pattern: ['none'], worn: ['none', 'sash', 'pauldron', 'belt', 'necklace'],
    size: [8, 20], roles: { [M]: 4, [R]: 3, [C]: 1.2, [BOSS]: 1 }, biomes: [0.3, 5, 0.5, 0.8, 1.5], bossWeight: 1, likes: { revive: 4, slow: 2, lunge: 2, volley: 3, burst: 2 },
    hue: [38, 50], sat: [0.15, 0.25], light: [0.7, 0.78], trim: [-20, 10, 190, 180] },
  { id: 'skull', nouns: ['flying skull', 'skull', 'bone fiend'], bomber: ['screaming skull', 'powder skull'],
    build: ['floater'], limbs: 'none', head: ['skull'], back: ['none', 'flame'], crown: ['none', 'horns', 'horn'], held: ['none'], eyes: [2, 2], teeth: false, stout: [0.9, 1.1], motifs: ['bones'], jaw: ['plain', 'fangs'], pattern: ['none'], worn: ['none'],
    size: [7, 10], roles: { [M]: 2, [B]: 4 }, biomes: [0.3, 5, 0.3, 0.3, 1], likes: { cling: 2, blink: 1 },
    hue: [38, 50], sat: [0.15, 0.25], light: [0.72, 0.8], trim: [0, 180], tint: false },
  { id: 'zombie', nouns: ['zombie', 'shambler', 'ghoul'], boss: ['plague lord', 'ghoul king'],
    build: ['tall', 'squat'], limbs: 'biped', head: ['round', 'maw', 'cone'], back: ['none', 'pack'], crown: ['none', 'mohawk', 'sprout'], held: ['none', 'none', 'club', 'pick', 'dagger'], eyes: [2, 2], teeth: true, stout: [0.85, 1.15], motifs: ['bandage'], jaw: ['plain', 'fangs'], pattern: ['patches', 'mottled', 'none'], worn: ['none', 'sash', 'necklace', 'belt'],
    size: [11, 20], roles: { [M]: 4, [BOSS]: 0.5 }, biomes: [0.2, 4, 0.3, 3, 1], bossWeight: 0.5, likes: { drain: 3, spores: 3, regen: 2.5, slow: 1.5, revive: 2 },
    hue: [75, 130], sat: [0.18, 0.3], light: [0.4, 0.5], trim: [-30, 30, 180] },
  { id: 'wraith', nouns: ['wraith', 'specter', 'shade'], caster: ['banshee', 'wraith mage', 'spectral sage'], boss: ['wraith lord', 'dread phantom'],
    build: ['floater'], limbs: 'none', head: ['hood', 'skull', 'round', 'mask', 'cone'], back: ['cape', 'cape', 'none', 'crystals'], crown: ['none', 'horns', 'crown', 'hat'], held: ['none', 'scythe'], eyes: [2, 2], teeth: false, stout: [0.8, 1.05], motifs: ['ghost'], jaw: ['plain'], pattern: ['none'], worn: ['none', 'necklace'],
    size: [11, 22], roles: { [M]: 1.5, [C]: 4, [BOSS]: 1 }, biomes: [0.2, 5, 1, 2, 1.2], bossWeight: 0.8, likes: { blink: 3, wail: 3, drain: 2.5, evade: 3, whiteout: 1.5 },
    hue: [200, 250], sat: [0.18, 0.32], light: [0.72, 0.8], trim: [-20, 20, 100] },
  { id: 'cultist', nouns: ['cultist', 'acolyte', 'warlock'], ranged: ['hexer'], caster: ['mage', 'sorcerer', 'witch', 'priest', 'necromancer'], boss: ['archmage', 'high priest', 'lich'],
    build: ['tall'], limbs: 'biped', head: ['hood', 'hood', 'round', 'mask', 'cone'], back: ['cape', 'cape', 'none', 'banner', 'pack'], crown: ['none', 'none', 'halo', 'hat', 'horns', 'horn'], held: ['staff', 'staff', 'orb', 'dagger', 'torch', 'scythe'], eyes: [2, 2], teeth: false, stout: [0.8, 1], motifs: [], jaw: ['plain', 'beard'], pattern: ['none'], worn: ['necklace', 'sash', 'belt', 'scarf', 'none'],
    size: [11, 19], roles: { [M]: 0.8, [R]: 1.5, [C]: 5, [BOSS]: 1 }, biomes: [1.5, 3, 2, 2.5, 3], bossWeight: 1.4, likes: { summon: 3, heal: 3, ward: 2, storm: 2, lob: 2, hex: 2, rally: 1.5 },
    hue: [255, 300], sat: [0.3, 0.5], light: [0.28, 0.4], trim: [40, 60, 180], cloth: true },
  { id: 'knight', nouns: ['knight', 'guard', 'man-at-arms'], ranged: ['crossbowman'], caster: ['battle priest'], boss: ['dread knight', 'black knight', 'warden'],
    build: ['tall', 'squat'], limbs: 'biped', head: ['helm'], back: ['cape', 'none', 'none', 'banner'], crown: ['crest', 'crest', 'none', 'horns', 'horn', 'crown'], held: ['sword', 'shield', 'spear', 'axe', 'mace', 'hammer', 'trident'], eyes: [2, 2], teeth: false, stout: [1.05, 1.4], motifs: ['armor'], jaw: ['plain'], pattern: ['none', 'belly'], worn: ['pauldron', 'belt', 'sash', 'scarf'],
    size: [13, 24], roles: { [M]: 4, [R]: 1, [BOSS]: 1 }, biomes: [2, 3, 1.5, 1, 3], bossWeight: 1.4, likes: { armor: 3, shield: 4, backstep: 1 },
    hue: [210, 225], sat: [0.1, 0.18], light: [0.46, 0.56], trim: [0, 150, 180], cloth: false },
  { id: 'bandit', nouns: ['bandit', 'raider', 'cutthroat'], ranged: ['archer', 'bandit archer', 'slinger'], caster: ['hedge wizard'], boss: ['bandit king', 'raider chief'],
    build: ['tall'], limbs: 'biped', head: ['hood', 'round', 'round', 'mask'], back: ['cape', 'none', 'none', 'pack', 'banner'], crown: ['none', 'hat', 'mohawk'], held: ['sword', 'spear', 'axe', 'club', 'dagger', 'dagger', 'pick', 'torch'], eyes: [2, 2], teeth: false, stout: [0.85, 1.05], motifs: [], jaw: ['plain', 'beard'], pattern: ['none'], worn: ['scarf', 'sash', 'belt', 'bracers'],
    size: [11, 17], roles: { [M]: 3, [R]: 5, [C]: 0.5, [BOSS]: 0.5 }, biomes: [3, 0.5, 2, 1, 4], bossWeight: 0.8, likes: { backstep: 3, lunge: 1.5, weave: 1.5 },
    hue: [20, 40], sat: [0.3, 0.45], light: [0.3, 0.42], trim: [-20, 160, 200], cloth: true },
  { id: 'wolf', nouns: ['wolf', 'hound', 'dire wolf'], boss: ['alpha', 'wolf king', 'fenrir'],
    build: ['wedge'], limbs: 'quad', head: ['beast', 'long'], back: ['tail', 'mane'], crown: ['ears'], held: ['none'], eyes: [2, 2], teeth: true, stout: [0.85, 1.15], motifs: ['fur'], jaw: ['fangs', 'plain', 'whiskers'], pattern: ['belly', 'stripes', 'patches', 'mottled', 'none'], worn: ['none', 'none', 'collar'],
    size: [9, 18], roles: { [M]: 5, [BOSS]: 0.5 }, biomes: [3, 1, 5, 0.3, 1], bossWeight: 0.6, likes: { pack: 4, weave: 3, berserk: 2, launch: 1 },
    hue: [22, 38], sat: [0.1, 0.25], light: [0.34, 0.46], trim: [10, 40, 190] },
  { id: 'boar', nouns: ['boar', 'warthog', 'ram'], boss: ['great boar', 'ram king'],
    build: ['wedge', 'squat'], limbs: 'quad', head: ['horned', 'beast', 'long'], back: ['tail', 'none', 'mane', 'quills'], crown: ['horns', 'horns', 'none', 'ears'], held: ['none'], eyes: [2, 2], teeth: true, stout: [1.1, 1.4], motifs: ['fur'], jaw: ['tusks', 'tusks', 'plain'], pattern: ['stripes', 'mottled', 'patches', 'none'], worn: ['none', 'collar'],
    size: [11, 20], roles: { [M]: 4, [BOSS]: 0.4 }, biomes: [3, 0.3, 4, 0.5, 1.5], bossWeight: 0.5, likes: { charge: 5, launch: 3, berserk: 2 },
    hue: [18, 32], sat: [0.25, 0.4], light: [0.28, 0.38], trim: [20, 190, 0] },
  { id: 'bat', nouns: ['bat', 'night bat', 'vampire bat'], boss: ['bat lord'],
    build: ['floater'], limbs: 'none', head: ['beast', 'long'], back: ['wings'], crown: ['ears', 'horn'], held: ['none'], eyes: [2, 2], teeth: true, stout: [0.85, 1.1], motifs: [], jaw: ['fangs'], pattern: ['none', 'belly'], worn: ['none'],
    size: [7, 13], roles: { [M]: 4, [B]: 1 }, biomes: [0.8, 4, 1.5, 1.5, 2], likes: { gust: 4, blink: 2, drain: 3, weave: 3, cling: 2, falcon: 3 },
    hue: [255, 290], sat: [0.15, 0.3], light: [0.22, 0.3], trim: [-20, 160, 0] },
  { id: 'harpy', nouns: ['harpy', 'falcon', 'carrion bird'], ranged: ['falconer', 'harpy shrieker'], caster: ['storm harpy'], boss: ['harpy queen', 'roc'],
    build: ['tall', 'wedge'], limbs: 'biped', head: ['beast', 'long'], back: ['wings'], crown: ['crest', 'none', 'mohawk', 'crest'], held: ['none', 'spear', 'dagger', 'trident'], eyes: [2, 2], teeth: false, stout: [0.8, 1], motifs: [], jaw: ['beak', 'beak', 'fangs'], pattern: ['belly', 'chevron', 'none'], worn: ['necklace', 'none'],
    size: [10, 18], roles: { [M]: 3, [R]: 2, [C]: 1, [BOSS]: 0.6 }, biomes: [1, 0.3, 2.5, 0.8, 3], bossWeight: 0.5, likes: { gust: 4, falcon: 5, blink: 2, weave: 2 },
    hue: [25, 40], sat: [0.3, 0.45], light: [0.4, 0.5], trim: [20, 180, 200] },
  { id: 'spider', nouns: ['spider', 'giant spider', 'weaver'], ranged: ['web-spitter', 'spitter'], caster: ['widow'], boss: ['spider queen', 'broodmother'],
    build: ['insect'], limbs: 'many', head: ['round', 'maw', 'cyclops', 'toad'], back: ['none', 'spikes', 'quills', 'crystals'], crown: ['none', 'stalks', 'antenna'], held: ['none'], eyes: [3, 4], teeth: true, stout: [0.9, 1.2], motifs: [], jaw: ['mandibles'], pattern: ['spots', 'stripes', 'chevron', 'mottled'], worn: ['none'],
    size: [7, 18], roles: { [M]: 4, [R]: 1.5, [C]: 0.4, [BOSS]: 0.8 }, biomes: [1, 3, 0.3, 4, 1.5], bossWeight: 0.8, likes: { trap: 3, cling: 4, snare: 4, venom: 3, summon: 1.5 },
    hue: [0, 28], sat: [0.2, 0.4], light: [0.2, 0.3], trim: [0, 40, 110] },
  { id: 'scorpion', nouns: ['scorpion', 'sand scorpion', 'stinger'], boss: ['scorpion king', 'giant scorpion'],
    build: ['insect'], limbs: 'many', head: ['maw', 'long'], back: ['tail', 'shell'], crown: ['none', 'stalks'], held: ['none'], eyes: [2, 3], teeth: false, stout: [1, 1.3], motifs: [], jaw: ['mandibles'], pattern: ['chevron', 'stripes', 'none', 'scales'], worn: ['none'],
    size: [8, 20], roles: { [M]: 4, [R]: 1, [BOSS]: 0.8 }, biomes: [0.2, 0.3, 0.1, 1.5, 5], bossWeight: 0.7, likes: { venom: 3, burrow: 2, armor: 2 },
    hue: [28, 40], sat: [0.4, 0.55], light: [0.36, 0.46], trim: [15, 190, 0] },
  { id: 'scarab', nouns: ['scarab', 'beetle', 'carrion beetle'], bomber: ['bombardier beetle', 'bloat beetle'],
    build: ['insect'], limbs: 'many', head: ['round', 'horned'], back: ['shell', 'wings', 'crystals'], crown: ['antenna', 'none', 'horn'], held: ['none'], eyes: [2, 2], teeth: false, stout: [1, 1.3], motifs: [], jaw: ['mandibles'], pattern: ['spots', 'stripes', 'scales'], worn: ['none'],
    size: [7, 13], roles: { [M]: 4, [B]: 3 }, biomes: [1.5, 0.5, 0.2, 1.5, 5], likes: { swarm: 3, armor: 2, burrow: 2 },
    hue: [185, 215], sat: [0.45, 0.6], light: [0.28, 0.38], trim: [150, 20, 40] },
  { id: 'slime', nouns: ['slime', 'ooze', 'gelatinous blob'], bomber: ['bloat', 'burst slime'], caster: ['ooze mage'], boss: ['slime king', 'great ooze'],
    build: ['blob'], limbs: 'none', head: ['none'], back: ['none', 'crystals', 'quills'], crown: ['none', 'crest', 'sprout', 'stalks', 'antenna', 'hat'], held: ['none'], eyes: [1, 2], teeth: false, stout: [0.9, 1.3], motifs: ['slime'], jaw: ['plain'], pattern: ['spots', 'mottled', 'none', 'belly'], worn: ['none'],
    size: [7, 22], roles: { [M]: 3, [B]: 2, [BOSS]: 0.6 }, biomes: [1.5, 1.5, 1, 4, 1], bossWeight: 0.6, likes: { mud: 4, regen: 3, spores: 3, burst: 3, cling: 2 },
    hue: [95, 190], sat: [0.45, 0.6], light: [0.42, 0.52], trim: [30, -30, 180], tint: false },
  { id: 'frog', nouns: ['frog', 'bullfrog', 'toad'], ranged: ['toad spitter', 'spitting frog'], caster: ['toad shaman'], boss: ['toad king', 'toad matron'],
    build: ['round', 'squat'], limbs: 'quad', head: ['maw', 'toad', 'toad'], back: ['none', 'quills'], crown: ['none', 'stalks', 'crown', 'sprout'], held: ['none'], eyes: [2, 2], teeth: false, stout: [1, 1.35], motifs: ['slime'], jaw: ['plain'], pattern: ['spots', 'spots', 'stripes', 'belly', 'mottled'], worn: ['none'],
    size: [7, 18], roles: { [M]: 4, [R]: 3, [C]: 0.6, [BOSS]: 0.8 }, biomes: [0.5, 0.2, 0.1, 5, 0.3], bossWeight: 0.9, likes: { hop: 6, spores: 2, venom: 2 },
    hue: [85, 140], sat: [0.4, 0.55], light: [0.34, 0.44], trim: [40, 60, 180] },
  { id: 'snake', nouns: ['snake', 'viper', 'sidewinder'], caster: ['serpent mystic'], boss: ['serpent king', 'great serpent', 'wyrm'],
    build: ['serpent'], limbs: 'none', head: ['beast', 'maw', 'long'], back: ['none', 'fins'], crown: ['none', 'horn', 'horns'], held: ['none'], eyes: [2, 2], teeth: true, stout: [0.8, 1.2], motifs: [], jaw: ['fangs', 'plain'], pattern: ['scales', 'stripes', 'chevron', 'spots', 'mottled'], worn: ['none'],
    size: [8, 22], roles: { [M]: 4, [C]: 0.3, [BOSS]: 1 }, biomes: [1, 0.5, 0.3, 3, 4], bossWeight: 1.1, likes: { venom: 4, burrow: 5, lunge: 2, weave: 2, evade: 2, snare: 1.5 },
    hue: [60, 130], sat: [0.35, 0.5], light: [0.34, 0.44], trim: [30, 60, 180] },
  { id: 'leech', nouns: ['leech', 'mud leech', 'bog worm'], boss: ['bog horror'],
    build: ['serpent'], limbs: 'none', head: ['maw'], back: ['none'], crown: ['none', 'stalks'], held: ['none'], eyes: [1, 2], teeth: true, stout: [0.9, 1.2], motifs: ['slime'], jaw: ['fangs', 'plain'], pattern: ['stripes', 'spots', 'none'], worn: ['none'],
    size: [7, 15], roles: { [M]: 4 }, biomes: [0.2, 1, 0.3, 5, 0.5], likes: { drain: 4, cling: 5, mud: 2, burrow: 3 },
    hue: [15, 30], sat: [0.25, 0.4], light: [0.26, 0.34], trim: [0, 40, 100] },
  { id: 'golem', nouns: ['golem', 'stone guardian', 'gargoyle'], boss: ['stone colossus', 'golem lord', 'colossus'],
    build: ['squat'], limbs: 'biped', head: ['cyclops', 'round', 'helm', 'cone', 'mask'], back: ['none', 'crystals', 'crystals', 'quills'], crown: ['none', 'crest', 'horn', 'horns', 'sprout'], held: ['none', 'hammer'], eyes: [1, 2], teeth: false, stout: [1.25, 1.55], motifs: ['stone'], jaw: ['plain'], pattern: ['none', 'patches', 'mottled'], worn: ['none', 'necklace', 'bracers'],
    size: [16, 28], roles: { [M]: 4, [BOSS]: 1 }, biomes: [1, 2, 2.5, 1, 3], bossWeight: 1.2, likes: { armor: 4, flame: 3, chill: 3, launch: 2, aura: 2 },
    hue: [28, 48], sat: [0.06, 0.14], light: [0.4, 0.5], trim: [0, 180], tint: false },
  { id: 'yeti', nouns: ['yeti', 'snow ape', 'frost giant'], boss: ['yeti king', 'frost titan'],
    build: ['squat'], limbs: 'biped', head: ['beast', 'maw'], back: ['none', 'mane', 'mane', 'quills'], crown: ['none', 'ears', 'horns', 'mohawk'], held: ['none', 'club', 'hammer'], eyes: [2, 2], teeth: true, stout: [1.2, 1.5], motifs: ['fur'], jaw: ['fangs', 'tusks', 'plain', 'beard'], pattern: ['belly', 'none', 'patches'], worn: ['none', 'necklace'],
    size: [18, 28], roles: { [M]: 4, [BOSS]: 1 }, biomes: [0.1, 0.1, 6, 0.1, 0.1], bossWeight: 1.2, likes: { berserk: 3, launch: 3, chill: 3 },
    hue: [195, 215], sat: [0.08, 0.2], light: [0.8, 0.88], trim: [190, 10, 0] },
  { id: 'imp', nouns: ['imp', 'fiend', 'gremlin'], bomber: ['firebomb imp', 'bomb imp'], caster: ['imp mage', 'hellcaller'], boss: ['demon lord', 'pit fiend', 'arch-demon'],
    build: ['wedge', 'tall'], limbs: 'biped', head: ['horned', 'long', 'cone'], back: ['wings', 'tail', 'pack'], crown: ['horns', 'horn', 'mohawk'], held: ['spear', 'none', 'sword', 'trident', 'dagger', 'torch', 'pick'], eyes: [2, 2], teeth: true, stout: [0.8, 1.15], motifs: [], jaw: ['fangs', 'plain'], pattern: ['belly', 'none', 'spots'], worn: ['none', 'sash', 'necklace', 'belt'],
    size: [7, 17], roles: { [M]: 3, [R]: 1.5, [B]: 4, [C]: 2, [BOSS]: 1 }, biomes: [1, 2, 0.4, 0.8, 3.5], bossWeight: 1.3, likes: { flame: 4, blink: 3, gust: 1.5, lob: 2 },
    hue: [-10, 12], sat: [0.5, 0.65], light: [0.36, 0.44], trim: [20, 180, 40] },
  { id: 'sprite', nouns: ['sprite', 'wisp', 'spirit'], caster: ['storm spirit', 'elementalist'], bomber: ['spark wisp', 'boom wisp'], boss: ['elemental lord', 'spirit king'],
    build: ['floater'], limbs: 'none', head: ['none', 'round', 'cone'], back: ['wings', 'flame', 'none', 'crystals'], crown: ['none', 'halo', 'sprout', 'antenna', 'stalks', 'horn'], held: ['none'], eyes: [1, 2], teeth: false, stout: [0.8, 1.05], motifs: ['glow'], jaw: ['plain'], pattern: ['none'], worn: ['none'],
    size: [7, 16], roles: { [M]: 1, [B]: 1, [C]: 2, [BOSS]: 0.6 }, biomes: [1, 0.8, 4, 3, 3], bossWeight: 0.5, likes: { storm: 2, whiteout: 3, gust: 3, blink: 2, heal: 1.5, elemhit: 2 },
    hue: [190, 200], sat: [0.5, 0.7], light: [0.55, 0.65], trim: [0, 180], tint: true },
  { id: 'mummy', nouns: ['mummy', 'tomb guard', 'sand wraith'], caster: ['sun priest', 'tomb priest'], boss: ['pharaoh', 'sun tyrant', 'mummy king'],
    build: ['tall'], limbs: 'biped', head: ['round', 'helm', 'mask', 'cone'], back: ['none', 'cape', 'banner'], crown: ['crown', 'none', 'hat', 'horns'], held: ['none', 'sword', 'spear', 'scythe', 'mace', 'dagger'], eyes: [2, 2], teeth: false, stout: [0.9, 1.15], motifs: ['bandage'], jaw: ['plain'], pattern: ['none'], worn: ['necklace', 'collar', 'sash', 'belt'],
    size: [12, 20], roles: { [M]: 4, [C]: 1.5, [BOSS]: 1 }, biomes: [0.1, 1.5, 0.1, 0.5, 5], bossWeight: 1, likes: { wither: 4, drain: 2, flame: 1.5, armor: 1 },
    hue: [38, 50], sat: [0.25, 0.4], light: [0.6, 0.7], trim: [-10, 190, 160] },
  { id: 'treant', nouns: ['treant', 'bramble beast', 'tree guardian'], caster: ['bark mystic'], boss: ['elder treant', 'forest titan'],
    build: ['tall', 'squat'], limbs: 'biped', head: ['round', 'maw', 'cone', 'long'], back: ['spikes', 'none', 'crystals', 'quills', 'mane'], crown: ['antlers', 'sprout', 'sprout', 'horns'], held: ['club', 'none', 'hammer'], eyes: [2, 2], teeth: false, stout: [1.1, 1.4], motifs: ['thorns'], jaw: ['plain', 'beard', 'beard'], pattern: ['mottled', 'patches', 'stripes', 'none'], worn: ['none', 'necklace'],
    size: [15, 28], roles: { [M]: 4, [C]: 0.5, [BOSS]: 1 }, biomes: [3, 0.3, 0.5, 4, 0.3], bossWeight: 1, likes: { thorns: 5, regen: 3, snare: 3, heal: 2, mud: 1.5 },
    hue: [25, 35], sat: [0.3, 0.42], light: [0.24, 0.32], trim: [90, 100, 110] },
  { id: 'drake', nouns: ['drake', 'wyvern', 'lizard'], boss: ['dragon', 'drake lord', 'wyrm'],
    build: ['wedge', 'squat'], limbs: 'quad', head: ['horned', 'beast', 'long', 'long'], back: ['wings', 'tail', 'quills', 'mane'], crown: ['horns', 'crest', 'horn'], held: ['none'], eyes: [2, 2], teeth: true, stout: [1.1, 1.4], motifs: [], jaw: ['fangs', 'plain'], pattern: ['scales', 'belly', 'stripes'], worn: ['none', 'collar'],
    size: [14, 26], roles: { [M]: 2, [BOSS]: 1 }, biomes: [0.5, 1, 1, 0.5, 3], bossWeight: 2, likes: { flame: 3, charge: 2, gust: 2 },
    hue: [0, 140], sat: [0.4, 0.55], light: [0.34, 0.44], trim: [30, 190, 60] },
  // ---- more of the fantasy bestiary: humanoids
  { id: 'kobold', nouns: ['kobold', 'cave kobold', 'scaly sneak'], ranged: ['kobold slinger', 'kobold trapper'], bomber: ['kobold bombardier', 'powder kobold'], caster: ['kobold shaman'], boss: ['kobold king', 'trap-lord'],
    build: ['tall', 'squat'], limbs: 'biped', head: ['beast', 'round', 'long', 'cone'], back: ['tail', 'tail', 'none', 'pack'], crown: ['ears', 'horns', 'none', 'mohawk', 'horn'], held: ['spear', 'club', 'sword', 'pick', 'dagger', 'torch', 'trident'], eyes: [2, 2], teeth: true, stout: [0.8, 1.05], motifs: [], jaw: ['fangs', 'plain'], pattern: ['scales', 'belly', 'stripes', 'spots'], worn: ['none', 'belt', 'scarf', 'sash'],
    size: [7, 12], roles: { [M]: 4, [R]: 3, [B]: 3, [C]: 0.6, [BOSS]: 0.3 }, biomes: [3, 2, 0.5, 1, 3], bossWeight: 0.3, likes: { swarm: 3, pack: 2, backstep: 2, trap: 3 },
    hue: [8, 24], sat: [0.4, 0.55], light: [0.34, 0.44], trim: [30, 190, -30] },
  { id: 'hobgoblin', nouns: ['hobgoblin', 'goblin sergeant', 'war goblin'], ranged: ['hobgoblin archer'], caster: ['hobgoblin warlock'], boss: ['hobgoblin warlord', 'goblin general'],
    build: ['tall'], limbs: 'biped', head: ['helm', 'round', 'mask'], back: ['cape', 'none', 'banner'], crown: ['crest', 'none', 'mohawk', 'horns', 'hat'], held: ['sword', 'spear', 'shield', 'axe', 'mace', 'hammer', 'trident'], eyes: [2, 2], teeth: true, stout: [1, 1.3], motifs: ['armor'], jaw: ['tusks', 'fangs', 'plain'], pattern: ['none', 'belly'], worn: ['pauldron', 'belt', 'sash', 'bracers'],
    size: [12, 18], roles: { [M]: 4, [R]: 2, [C]: 0.5, [BOSS]: 1 }, biomes: [4, 1.5, 1, 0.5, 2], bossWeight: 1, likes: { shield: 2, armor: 2, rally: 3, backstep: 1 },
    hue: [8, 22], sat: [0.45, 0.6], light: [0.34, 0.42], trim: [-10, 180, 30] },
  { id: 'bugbear', nouns: ['bugbear', 'hairy brute', 'cave ambusher'], boss: ['bugbear chief', 'bugbear king'],
    build: ['squat'], limbs: 'biped', head: ['beast', 'long'], back: ['none', 'mane', 'pack'], crown: ['ears', 'horns', 'mohawk'], held: ['club', 'axe', 'spear', 'mace', 'hammer', 'pick'], eyes: [2, 2], teeth: true, stout: [1.15, 1.4], motifs: ['fur'], jaw: ['fangs', 'tusks', 'beard'], pattern: ['belly', 'stripes', 'mottled'], worn: ['belt', 'necklace', 'collar', 'bracers'],
    size: [15, 22], roles: { [M]: 4, [BOSS]: 0.6 }, biomes: [3, 1, 2, 1.5, 1], bossWeight: 0.7, likes: { lunge: 3, berserk: 2, launch: 2, trap: 1.5 },
    hue: [25, 38], sat: [0.3, 0.42], light: [0.3, 0.38], trim: [10, 180, -20] },
  { id: 'gnoll', nouns: ['gnoll', 'hyena-man', 'gnoll raider'], ranged: ['gnoll archer'], caster: ['gnoll witch-doctor'], boss: ['gnoll pack-lord', 'gnoll warlord'],
    build: ['tall'], limbs: 'biped', head: ['beast', 'long', 'long'], back: ['tail', 'none', 'mane', 'quills', 'banner'], crown: ['ears', 'mohawk'], held: ['spear', 'axe', 'club', 'sword', 'scythe', 'trident', 'dagger'], eyes: [2, 2], teeth: true, stout: [0.9, 1.15], motifs: ['fur'], jaw: ['fangs', 'plain', 'whiskers'], pattern: ['spots', 'stripes', 'mottled'], worn: ['necklace', 'sash', 'belt', 'collar'],
    size: [11, 18], roles: { [M]: 4, [R]: 3, [C]: 0.5, [BOSS]: 0.6 }, biomes: [2, 1, 0.5, 0.5, 5], bossWeight: 0.7, likes: { pack: 4, swarm: 2, berserk: 2, weave: 1.5 },
    hue: [35, 48], sat: [0.35, 0.5], light: [0.38, 0.46], trim: [0, 20, 190] },
  { id: 'lizardfolk', nouns: ['lizardfolk', 'scaleback', 'lizard warrior'], ranged: ['lizardfolk harpooner', 'spear-thrower'], caster: ['lizardfolk shaman'], boss: ['lizard king', 'scale-chief'],
    build: ['tall'], limbs: 'biped', head: ['beast', 'long', 'long'], back: ['tail', 'quills', 'pack'], crown: ['crest', 'none', 'mohawk', 'horn'], held: ['spear', 'sword', 'shield', 'club', 'trident', 'trident', 'dagger'], eyes: [2, 2], teeth: true, stout: [0.9, 1.2], motifs: [], jaw: ['fangs', 'plain'], pattern: ['scales', 'scales', 'stripes', 'belly', 'chevron'], worn: ['necklace', 'sash', 'belt', 'bracers'],
    size: [11, 19], roles: { [M]: 4, [R]: 3, [C]: 1, [BOSS]: 0.6 }, biomes: [0.3, 0.3, 0.1, 5, 3], bossWeight: 0.7, likes: { venom: 2, snare: 2, lunge: 2, regen: 1.5, backstep: 1.5 },
    hue: [90, 150], sat: [0.35, 0.5], light: [0.34, 0.44], trim: [40, 70, 180] },
  { id: 'satyr', nouns: ['satyr', 'goatman', 'faun'], ranged: ['satyr piper', 'satyr hunter'], caster: ['satyr mystic'], boss: ['satyr lord', 'horned king'],
    build: ['tall'], limbs: 'biped', head: ['horned', 'beast', 'long'], back: ['tail', 'none', 'pack', 'mane'], crown: ['horns', 'sprout', 'horns'], held: ['spear', 'club', 'sword', 'dagger', 'torch', 'hammer'], eyes: [2, 2], teeth: false, stout: [0.85, 1.1], motifs: ['fur'], jaw: ['beard', 'beard', 'plain'], pattern: ['belly', 'mottled', 'none'], worn: ['sash', 'necklace', 'belt'],
    size: [11, 17], roles: { [M]: 3, [R]: 3, [C]: 1, [BOSS]: 0.4 }, biomes: [3, 0.3, 1.5, 1.5, 0.5], bossWeight: 0.4, likes: { weave: 2, backstep: 3, charge: 2 },
    hue: [22, 34], sat: [0.35, 0.5], light: [0.38, 0.48], trim: [20, 160, 180] },
  { id: 'dwarf', nouns: ['deep dwarf', 'dwarf renegade', 'dwarf'], ranged: ['dwarf crossbowman', 'dwarf sharpshooter'], caster: ['rune priest'], boss: ['dwarf thane', 'iron king'],
    build: ['squat'], limbs: 'biped', head: ['helm', 'round'], back: ['none', 'cape', 'pack', 'banner'], crown: ['none', 'crest', 'horns', 'hat', 'mohawk'], held: ['axe', 'club', 'shield', 'sword', 'hammer', 'hammer', 'pick', 'mace'], eyes: [2, 2], teeth: false, stout: [1.15, 1.45], motifs: ['armor'], jaw: ['beard', 'beard', 'beard', 'plain'], pattern: ['none'], worn: ['belt', 'pauldron', 'bracers', 'sash'],
    size: [10, 17], roles: { [M]: 4, [R]: 3, [C]: 1, [BOSS]: 0.8 }, biomes: [1.5, 2, 4, 0.2, 1], bossWeight: 0.8, likes: { armor: 3, shield: 2, backstep: 1.5, lunge: 1 },
    hue: [14, 28], sat: [0.4, 0.55], light: [0.44, 0.54], trim: [180, 20, 200], cloth: false },
  { id: 'darkelf', nouns: ['dark elf', 'shadow elf', 'night stalker'], ranged: ['dark elf archer', 'shadow archer'], caster: ['dark elf mage', 'shadow weaver'], boss: ['dark elf matron', 'shadow queen'],
    build: ['tall'], limbs: 'biped', head: ['hood', 'round', 'mask'], back: ['cape', 'none', 'banner'], crown: ['none', 'mohawk', 'crown', 'hat', 'crest'], held: ['sword', 'spear', 'staff', 'dagger', 'dagger', 'scythe', 'trident'], eyes: [2, 2], teeth: false, stout: [0.75, 0.95], motifs: ['shadow'], jaw: ['plain'], pattern: ['none'], worn: ['scarf', 'sash', 'pauldron', 'necklace', 'bracers'],
    size: [11, 17], roles: { [M]: 2, [R]: 5, [C]: 3, [BOSS]: 0.6 }, biomes: [0.3, 3, 1, 0.5, 0.5], bossWeight: 0.6, likes: { blink: 2, backstep: 3, hex: 2, trap: 2, weave: 1.5, evade: 2 },
    hue: [250, 275], sat: [0.18, 0.3], light: [0.4, 0.5], trim: [-20, 160, 40] },
  { id: 'hag', nouns: ['hag', 'crone', 'swamp witch'], ranged: ['hex-hurler'], caster: ['hag', 'coven witch', 'bog crone'], boss: ['hag queen', 'coven mother'],
    build: ['tall'], limbs: 'biped', head: ['hood', 'cone', 'long'], back: ['cape', 'pack'], crown: ['none', 'hat', 'hat', 'horns', 'sprout'], held: ['staff', 'staff', 'orb', 'scythe', 'torch', 'dagger'], eyes: [2, 2], teeth: true, stout: [0.75, 0.95], motifs: [], jaw: ['plain', 'fangs'], pattern: ['none', 'patches'], worn: ['necklace', 'scarf', 'sash'],
    size: [10, 16], roles: { [M]: 1, [R]: 1, [C]: 5, [BOSS]: 1 }, biomes: [1, 1.5, 1.5, 5, 1], bossWeight: 1, likes: { hex: 4, storm: 3, summon: 2, trap: 2, lure: 3, heal: 1.5, lob: 1.5 },
    hue: [90, 125], sat: [0.22, 0.32], light: [0.3, 0.4], trim: [150, 180, -30], cloth: false },
  { id: 'seraph', nouns: ['fallen angel', 'fallen seraph', 'corrupted paladin'], caster: ['fallen priest', 'dusk cleric'], boss: ['archangel of ruin', 'fallen seraph'],
    build: ['tall'], limbs: 'biped', head: ['round', 'helm'], back: ['wings'], crown: ['halo', 'crown', 'horn'], held: ['sword', 'staff', 'spear', 'trident', 'mace', 'hammer'], eyes: [2, 2], teeth: false, stout: [0.85, 1.1], motifs: ['holy'], jaw: ['plain'], pattern: ['none', 'belly'], worn: ['sash', 'pauldron', 'necklace', 'scarf'],
    size: [13, 20], roles: { [M]: 3, [C]: 3, [BOSS]: 1 }, biomes: [1, 1.2, 2, 0.3, 2], bossWeight: 1, likes: { heal: 4, ward: 3, gust: 2, rally: 2, elemhit: 1.5 },
    hue: [42, 55], sat: [0.35, 0.5], light: [0.76, 0.84], trim: [180, 190, 10] },
  // ---- undead and spirits
  { id: 'vampire', nouns: ['vampire', 'blood thrall', 'night noble'], caster: ['blood mage', 'vampire sorcerer'], boss: ['vampire lord', 'blood count'],
    build: ['tall'], limbs: 'biped', head: ['round', 'hood', 'mask'], back: ['cape', 'wings', 'banner'], crown: ['none', 'crest', 'crown', 'horns', 'mohawk'], held: ['sword', 'none', 'staff', 'dagger', 'scythe'], eyes: [2, 2], teeth: true, stout: [0.8, 1], motifs: ['blood'], jaw: ['fangs', 'fangs', 'plain'], pattern: ['none'], worn: ['collar', 'necklace', 'sash', 'scarf'],
    size: [12, 19], roles: { [M]: 3, [C]: 3, [BOSS]: 1 }, biomes: [0.2, 4, 1, 0.5, 0.5], bossWeight: 1.3, likes: { drain: 4, blink: 3, summon: 2, gust: 1.5, evade: 2 },
    hue: [5, 25], sat: [0.08, 0.16], light: [0.74, 0.8], trim: [-10, 350, 0] },
  { id: 'werewolf', nouns: ['werewolf', 'lycan', 'moon hound'], boss: ['werewolf alpha', 'great lycan'],
    build: ['tall'], limbs: 'biped', head: ['beast', 'long', 'long'], back: ['none', 'tail', 'mane', 'mane', 'quills'], crown: ['ears'], held: ['none'], eyes: [2, 2], teeth: true, stout: [1, 1.3], motifs: ['fur'], jaw: ['fangs', 'fangs', 'whiskers'], pattern: ['belly', 'stripes', 'mottled'], worn: ['none', 'none', 'collar', 'necklace', 'bracers'],
    size: [13, 22], roles: { [M]: 4, [BOSS]: 0.6 }, biomes: [2, 2.5, 3, 0.3, 0.2], bossWeight: 0.7, likes: { berserk: 4, pack: 1.5, launch: 1.5, drain: 1 },
    hue: [22, 34], sat: [0.1, 0.22], light: [0.28, 0.36], trim: [10, 180, 0] },
  { id: 'wight', nouns: ['wight', 'barrow knight', 'grave warden'], caster: ['wight sorcerer'], boss: ['death knight', 'barrow king'],
    build: ['tall'], limbs: 'biped', head: ['helm', 'skull'], back: ['cape', 'none', 'banner'], crown: ['crest', 'none', 'horns', 'crown', 'horn'], held: ['sword', 'axe', 'spear', 'shield', 'scythe', 'mace', 'hammer'], eyes: [2, 2], teeth: false, stout: [1, 1.3], motifs: ['armor', 'ghost'], jaw: ['plain', 'fangs'], pattern: ['none'], worn: ['pauldron', 'belt', 'sash', 'necklace'],
    size: [13, 22], roles: { [M]: 4, [R]: 0.6, [C]: 1, [BOSS]: 1 }, biomes: [0.1, 5, 1, 0.5, 0.5], bossWeight: 1.2, likes: { drain: 3, slow: 2, revive: 2, armor: 2, wail: 2, shield: 2 },
    hue: [175, 200], sat: [0.12, 0.22], light: [0.4, 0.5], trim: [0, 180, 40] },
  { id: 'poltergeist', nouns: ['poltergeist', 'restless ghost', 'ghost'], bomber: ['wailing spirit'], caster: ['haunting'],
    build: ['floater'], limbs: 'none', head: ['round', 'none', 'mask', 'cone'], back: ['none', 'crystals'], crown: ['none', 'hat', 'horns', 'stalks'], held: ['none'], eyes: [2, 2], teeth: false, stout: [0.85, 1.1], motifs: ['ghost'], jaw: ['plain', 'fangs'], pattern: ['none'], worn: ['none', 'scarf', 'necklace'],
    size: [7, 13], roles: { [M]: 3, [B]: 1.5, [C]: 1.5 }, biomes: [0.3, 5, 1, 1.5, 0.5], likes: { evade: 3, blink: 3, cling: 2, wail: 2 },
    hue: [180, 220], sat: [0.2, 0.35], light: [0.78, 0.86], trim: [-20, 20, 100] },
  { id: 'scarecrow', nouns: ['scarecrow', 'straw man', 'field watcher'], caster: ['crow-caller'], boss: ['harvest king', 'scarecrow lord'],
    build: ['tall'], limbs: 'biped', head: ['hood', 'round', 'cone', 'mask'], back: ['cape', 'none', 'pack', 'banner'], crown: ['none', 'hat', 'hat', 'sprout', 'mohawk'], held: ['none', 'club', 'sword', 'scythe', 'scythe', 'pick', 'torch'], eyes: [2, 2], teeth: false, stout: [0.8, 1], motifs: ['bandage'], jaw: ['plain'], pattern: ['patches', 'stripes', 'none'], worn: ['scarf', 'sash', 'belt', 'necklace'],
    size: [11, 17], roles: { [M]: 4, [C]: 0.8, [BOSS]: 0.4 }, biomes: [4, 2, 0.1, 1.5, 0.5], bossWeight: 0.3, likes: { burst: 3, spores: 1.5, flame: 2, lunge: 1.5 },
    hue: [40, 52], sat: [0.4, 0.55], light: [0.46, 0.56], trim: [-30, 160, 190] },
  { id: 'bonedrake', nouns: ['bone drake', 'skeletal wyrm'], boss: ['bone dragon', 'dracolich'],
    build: ['wedge'], limbs: 'quad', head: ['skull', 'long'], back: ['wings', 'tail', 'quills', 'spikes'], crown: ['none', 'horns', 'horn', 'crest'], held: ['none'], eyes: [2, 2], teeth: false, stout: [1.05, 1.35], motifs: ['bones'], jaw: ['fangs', 'plain'], pattern: ['none'], worn: ['none'],
    size: [16, 26], roles: { [M]: 1, [BOSS]: 1 }, biomes: [0.1, 5, 0.5, 0.3, 1], bossWeight: 1.5, likes: { revive: 3, wail: 2, drain: 2, gust: 2 },
    hue: [38, 50], sat: [0.12, 0.22], light: [0.68, 0.76], trim: [0, 190, 10] },
  { id: 'abomination', nouns: ['flesh golem', 'stitched horror', 'abomination'], boss: ['flesh titan', 'the stitched king'],
    build: ['squat'], limbs: 'biped', head: ['maw', 'round', 'toad', 'long', 'cyclops'], back: ['none', 'spikes', 'quills', 'crystals', 'tentacles'], crown: ['none', 'stalks', 'horn', 'sprout'], held: ['none', 'club', 'hammer', 'scythe', 'pick'], eyes: [1, 3], teeth: true, stout: [1.3, 1.55], motifs: ['bandage'], jaw: ['tusks', 'fangs', 'mandibles', 'plain'], pattern: ['patches', 'mottled', 'stripes'], worn: ['none', 'belt', 'collar'],
    size: [18, 28], roles: { [M]: 3, [BOSS]: 1 }, biomes: [0.3, 4, 0.3, 2, 0.3], bossWeight: 1, likes: { regen: 3, drain: 2, spores: 2, burst: 3, launch: 2, berserk: 2 },
    hue: [80, 115], sat: [0.18, 0.28], light: [0.38, 0.46], trim: [-60, 30, 190] },
  // ---- beasts and monstrosities
  { id: 'rat', nouns: ['giant rat', 'plague rat', 'dire rat'], boss: ['rat king'],
    build: ['wedge'], limbs: 'quad', head: ['beast', 'long', 'long'], back: ['tail', 'pack', 'quills'], crown: ['ears', 'none'], held: ['none'], eyes: [2, 2], teeth: true, stout: [0.8, 1.1], motifs: ['fur'], jaw: ['whiskers', 'whiskers', 'fangs'], pattern: ['belly', 'mottled', 'patches', 'none'], worn: ['none', 'none', 'collar', 'scarf'],
    size: [7, 12], roles: { [M]: 5, [BOSS]: 0.3 }, biomes: [2, 3, 0.5, 2, 0.5], bossWeight: 0.3, likes: { swarm: 4, pack: 3, venom: 2, weave: 2, burrow: 1.5 },
    hue: [18, 30], sat: [0.08, 0.2], light: [0.26, 0.36], trim: [10, 200, 0] },
  { id: 'wasp', nouns: ['giant wasp', 'killer bee', 'stinger swarm'], boss: ['wasp queen', 'hive mother'],
    build: ['insect'], limbs: 'many', head: ['round'], back: ['wings'], crown: ['antenna', 'stalks', 'horn'], held: ['none'], eyes: [2, 3], teeth: false, stout: [0.9, 1.15], motifs: [], jaw: ['mandibles'], pattern: ['stripes', 'stripes', 'chevron'], worn: ['none'],
    size: [7, 13], roles: { [M]: 4, [R]: 1 }, biomes: [4, 0.2, 0.2, 2, 2], likes: { swarm: 3, weave: 3, venom: 3, gust: 1.5, pack: 2 },
    hue: [44, 54], sat: [0.65, 0.8], light: [0.46, 0.54], trim: [180, 150, 0] },
  { id: 'ant', nouns: ['giant ant', 'soldier ant', 'fire ant'], bomber: ['acid ant', 'bloat ant'], boss: ['ant queen'],
    build: ['insect'], limbs: 'many', head: ['round', 'toad', 'long'], back: ['none', 'shell', 'wings', 'crystals'], crown: ['antenna', 'horn'], held: ['none'], eyes: [2, 2], teeth: true, stout: [1, 1.25], motifs: [], jaw: ['mandibles'], pattern: ['none', 'stripes', 'scales'], worn: ['none'],
    size: [7, 14], roles: { [M]: 5, [B]: 2, [BOSS]: 0.3 }, biomes: [1.5, 0.5, 0.1, 1, 4], bossWeight: 0.3, likes: { swarm: 4, burrow: 2, armor: 1, pack: 2, venom: 1 },
    hue: [5, 20], sat: [0.5, 0.65], light: [0.24, 0.32], trim: [0, 190, 40] },
  { id: 'centipede', nouns: ['giant centipede', 'crawling horror', 'scuttler'], boss: ['great centipede', 'chitin wyrm'],
    build: ['serpent'], limbs: 'none', head: ['maw', 'long', 'beast'], back: ['spikes', 'none', 'quills'], crown: ['antenna', 'none', 'horns', 'stalks'], held: ['none'], eyes: [2, 2], teeth: true, stout: [0.9, 1.2], motifs: [], jaw: ['mandibles', 'fangs'], pattern: ['stripes', 'chevron', 'scales', 'spots'], worn: ['none'],
    size: [8, 22], roles: { [M]: 4, [BOSS]: 0.5 }, biomes: [0.5, 2, 0.2, 3, 3], bossWeight: 0.5, likes: { venom: 3, weave: 2, burrow: 2, lunge: 1.5, cling: 1.5 },
    hue: [8, 22], sat: [0.5, 0.65], light: [0.3, 0.4], trim: [30, 190, 0] },
  { id: 'crab', nouns: ['giant crab', 'rock crab', 'snapper'], boss: ['crab king', 'colossal crab'],
    build: ['insect'], limbs: 'many', head: ['round', 'cyclops', 'toad'], back: ['shell', 'crystals', 'spikes', 'quills'], crown: ['none', 'stalks', 'stalks', 'antenna'], held: ['none'], eyes: [2, 2], teeth: false, stout: [1.1, 1.4], motifs: [], jaw: ['mandibles', 'plain'], pattern: ['spots', 'mottled', 'none'], worn: ['none'],
    size: [8, 20], roles: { [M]: 4, [BOSS]: 0.4 }, biomes: [0.3, 0.1, 0.5, 4, 2], bossWeight: 0.4, likes: { armor: 3, shield: 2, snare: 2, launch: 1.5 },
    hue: [4, 16], sat: [0.5, 0.65], light: [0.38, 0.46], trim: [20, 190, 0] },
  { id: 'crocodile', nouns: ['crocodile', 'bog lizard', 'swamp stalker'], boss: ['great crocodile', 'river tyrant'],
    build: ['wedge'], limbs: 'quad', head: ['maw', 'long', 'long', 'long'], back: ['tail', 'spikes', 'quills', 'fins'], crown: ['none', 'crest'], held: ['none'], eyes: [2, 2], teeth: true, stout: [1, 1.3], motifs: [], jaw: ['fangs', 'plain'], pattern: ['scales', 'scales', 'stripes', 'mottled', 'belly'], worn: ['none'],
    size: [12, 24], roles: { [M]: 4, [BOSS]: 0.8 }, biomes: [0.3, 0.2, 0.1, 5, 3], bossWeight: 0.8, likes: { snare: 3, lunge: 3, launch: 2, burrow: 2, regen: 1.5 },
    hue: [90, 120], sat: [0.28, 0.4], light: [0.24, 0.32], trim: [30, 190, 60] },
  { id: 'bear', nouns: ['cave bear', 'bear', 'owlbear'], boss: ['great bear', 'bear lord', 'owlbear matriarch'],
    build: ['squat'], limbs: 'quad', head: ['beast', 'long'], back: ['none', 'mane', 'quills'], crown: ['ears'], held: ['none'], eyes: [2, 2], teeth: true, stout: [1.2, 1.5], motifs: ['fur'], jaw: ['fangs', 'plain', 'whiskers'], pattern: ['belly', 'none', 'patches'], worn: ['none', 'collar'],
    size: [14, 26], roles: { [M]: 4, [BOSS]: 0.8 }, biomes: [3, 0.3, 3, 0.8, 0.1], bossWeight: 0.8, likes: { berserk: 4, launch: 3, regen: 1.5, charge: 1.5 },
    hue: [20, 32], sat: [0.28, 0.4], light: [0.26, 0.34], trim: [10, 190, 0] },
  { id: 'griffon', nouns: ['griffon', 'sky lion', 'eagle-beast'], boss: ['griffon king', 'storm griffon'],
    build: ['wedge'], limbs: 'quad', head: ['beast', 'long'], back: ['wings', 'tail', 'mane', 'quills'], crown: ['crest', 'ears', 'mohawk', 'crest'], held: ['none'], eyes: [2, 2], teeth: false, stout: [1, 1.3], motifs: ['fur'], jaw: ['beak', 'beak', 'beak'], pattern: ['belly', 'spots', 'stripes', 'chevron'], worn: ['none'],
    size: [14, 26], roles: { [M]: 3, [BOSS]: 0.8 }, biomes: [1, 0.2, 3, 0.2, 3], bossWeight: 0.8, likes: { gust: 4, falcon: 3, charge: 2, launch: 2, blink: 1 },
    hue: [34, 46], sat: [0.4, 0.55], light: [0.42, 0.52], trim: [190, 0, 20] },
  { id: 'chimera', nouns: ['chimera', 'manticore', 'three-headed beast'], boss: ['great chimera', 'manticore king'],
    build: ['wedge'], limbs: 'quad', head: ['horned', 'long', 'beast'], back: ['wings', 'tail', 'spikes', 'mane', 'mane', 'quills'], crown: ['horns', 'horn', 'ears', 'crest'], held: ['none'], eyes: [2, 3], teeth: true, stout: [1.1, 1.4], motifs: ['fur'], jaw: ['fangs', 'tusks', 'beak'], pattern: ['stripes', 'patches', 'spots', 'belly'], worn: ['none', 'collar'],
    size: [15, 27], roles: { [M]: 3, [BOSS]: 1 }, biomes: [0.5, 1.5, 1, 1, 3], bossWeight: 1.2, likes: { flame: 3, charge: 2, venom: 2, cone: 3, gust: 1.5 },
    hue: [24, 40], sat: [0.4, 0.55], light: [0.36, 0.44], trim: [100, 190, 10] },
  { id: 'basilisk', nouns: ['basilisk', 'stone-eyed lizard', 'cockatrice'], boss: ['great basilisk', 'gorgon'],
    build: ['wedge'], limbs: 'quad', head: ['beast', 'long', 'long', 'toad'], back: ['spikes', 'tail', 'quills', 'crystals', 'fins'], crown: ['crest', 'horn', 'horns'], held: ['none'], eyes: [2, 2], teeth: true, stout: [1, 1.3], motifs: ['stone'], jaw: ['fangs', 'plain'], pattern: ['scales', 'chevron', 'stripes', 'mottled'], worn: ['none'],
    size: [11, 22], roles: { [M]: 4, [BOSS]: 0.6 }, biomes: [0.3, 1.5, 0.2, 3, 4], bossWeight: 0.6, likes: { beam: 3, venom: 3, snare: 2, burrow: 1.5 },
    hue: [95, 130], sat: [0.2, 0.32], light: [0.28, 0.36], trim: [30, 190, 60] },
  { id: 'hydra', nouns: ['young hydra', 'many-headed serpent'], boss: ['hydra', 'great hydra', 'swamp hydra'],
    build: ['serpent'], limbs: 'none', head: ['horned', 'maw', 'long'], back: ['fins', 'spikes', 'quills', 'crystals'], crown: ['horns', 'crest', 'horn', 'stalks'], held: ['none'], eyes: [2, 3], teeth: true, stout: [1.1, 1.4], motifs: [], jaw: ['fangs'], pattern: ['scales', 'stripes', 'chevron', 'belly'], worn: ['none'],
    size: [16, 26], roles: { [M]: 1, [BOSS]: 1 }, biomes: [0.5, 0.5, 0.5, 5, 2], bossWeight: 1.5, likes: { regen: 3, venom: 3, cone: 2, snare: 2 },
    hue: [95, 150], sat: [0.35, 0.5], light: [0.3, 0.4], trim: [30, 60, 190] },
  { id: 'naga', nouns: ['naga', 'serpent maiden', 'snake priestess'], ranged: ['naga spitter'], caster: ['naga sorceress', 'serpent mystic'], boss: ['naga queen', 'serpent empress'],
    build: ['serpent'], limbs: 'none', head: ['round', 'hood', 'mask', 'cone', 'long'], back: ['fins', 'none', 'banner', 'quills', 'crystals'], crown: ['crown', 'crest', 'hat', 'horn', 'mohawk'], held: ['none'], eyes: [2, 2], teeth: false, stout: [0.85, 1.15], motifs: [], jaw: ['fangs', 'plain'], pattern: ['scales', 'belly', 'chevron', 'stripes'], worn: ['necklace', 'necklace', 'sash', 'scarf'],
    size: [11, 22], roles: { [M]: 2, [R]: 1, [C]: 3, [BOSS]: 0.8 }, biomes: [0.2, 0.5, 0.3, 4, 3], bossWeight: 0.8, likes: { storm: 2, hex: 2, venom: 2, ward: 1.5, lure: 3, heal: 1.5 },
    hue: [165, 200], sat: [0.35, 0.5], light: [0.36, 0.46], trim: [150, 40, 180] },
  { id: 'mimic', nouns: ['mimic', 'treasure chest', 'living hoard'], boss: ['hoard horror', 'the greedy chest'],
    build: ['squat'], limbs: 'quad', head: ['maw', 'toad', 'long'], back: ['none', 'quills', 'crystals'], crown: ['none', 'stalks', 'horn', 'sprout'], held: ['none'], eyes: [2, 2], teeth: true, stout: [1.2, 1.5], motifs: ['armor'], jaw: ['fangs', 'tusks', 'mandibles'], pattern: ['none', 'stripes'], worn: ['none'],
    size: [9, 16], roles: { [M]: 4, [BOSS]: 0.2 }, biomes: [1.5, 2, 0.3, 0.5, 1.5], bossWeight: 0.2, likes: { cling: 4, lunge: 3, drain: 2, trap: 3, armor: 1.5 },
    hue: [24, 34], sat: [0.45, 0.55], light: [0.28, 0.36], trim: [-10, 190, 20] },
  { id: 'myconid', nouns: ['myconid', 'mushroom man', 'sporeling'], bomber: ['puffcap', 'sporebloat'], caster: ['spore sage'], boss: ['mushroom king', 'great fungus'],
    build: ['round'], limbs: 'biped', head: ['none', 'cyclops', 'round'], back: ['none', 'quills', 'crystals'], crown: ['crest', 'sprout', 'hat', 'stalks', 'mohawk'], held: ['none', 'club', 'pick'], eyes: [2, 3], teeth: false, stout: [1, 1.35], motifs: ['poison'], jaw: ['plain'], pattern: ['spots', 'spots', 'mottled', 'none'], worn: ['none', 'none', 'necklace'],
    size: [8, 20], roles: { [M]: 4, [B]: 3, [C]: 1.5, [BOSS]: 0.4 }, biomes: [1, 0.8, 0.5, 5, 0.5], bossWeight: 0.4, likes: { spores: 6, regen: 2, heal: 2, venom: 2, burst: 2 },
    hue: [300, 340], sat: [0.3, 0.45], light: [0.46, 0.56], trim: [60, 190, -30] },
  { id: 'mound', nouns: ['shambling mound', 'bog heap', 'creeping thicket'], boss: ['the great mound', 'bog colossus'],
    build: ['blob'], limbs: 'none', head: ['none', 'cyclops', 'maw'], back: ['spikes', 'none', 'crystals', 'quills', 'tentacles'], crown: ['none', 'sprout', 'stalks', 'horns'], held: ['none'], eyes: [2, 3], teeth: false, stout: [1.2, 1.5], motifs: ['thorns', 'slime'], jaw: ['plain', 'tusks'], pattern: ['mottled', 'spots', 'patches', 'none'], worn: ['none'],
    size: [14, 26], roles: { [M]: 4, [BOSS]: 0.5 }, biomes: [1.5, 0.5, 0.1, 5, 0.1], bossWeight: 0.5, likes: { regen: 3, snare: 4, thorns: 3, mud: 3, spores: 2 },
    hue: [85, 120], sat: [0.35, 0.45], light: [0.22, 0.3], trim: [40, 20, 180] },
  { id: 'eye', nouns: ['floating eye', 'gazer', 'evil eye'], ranged: ['eye archer', 'watcher'], caster: ['eye mage', 'seer'], boss: ['all-seeing eye', 'eye tyrant'],
    build: ['floater'], limbs: 'tentacles', head: ['cyclops'], back: ['none', 'tentacles', 'spikes', 'crystals', 'wings'], crown: ['none', 'horns', 'crown', 'stalks'], held: ['none'], eyes: [1, 1], teeth: false, stout: [0.9, 1.2], motifs: ['arcane'], jaw: ['plain'], pattern: ['none', 'spots', 'stripes', 'mottled'], worn: ['none'],
    size: [8, 22], roles: { [M]: 1, [R]: 2, [C]: 3, [BOSS]: 1 }, biomes: [0.5, 3, 1, 2, 2], bossWeight: 1.1, likes: { beam: 5, hex: 3, dazzle: 4, blink: 2, wail: 1.5 },
    hue: [280, 330], sat: [0.35, 0.5], light: [0.36, 0.46], trim: [60, 180, 100] },
  { id: 'kraken', nouns: ['tentacle horror', 'deep squid', 'grasping thing'], boss: ['kraken', 'the deep one', 'tentacle lord'],
    build: ['floater'], limbs: 'tentacles', head: ['none', 'cyclops', 'toad', 'maw'], back: ['none', 'fins', 'spikes', 'crystals'], crown: ['none', 'stalks', 'horns', 'crown'], held: ['none'], eyes: [1, 3], teeth: false, stout: [1, 1.35], motifs: ['slime'], jaw: ['plain', 'beak', 'fangs'], pattern: ['spots', 'mottled', 'stripes', 'belly'], worn: ['none'],
    size: [10, 28], roles: { [M]: 3, [BOSS]: 0.8 }, biomes: [0.2, 1, 0.5, 4, 0.1], bossWeight: 0.8, likes: { cling: 4, snare: 4, storm: 1.5, drain: 1.5 },
    hue: [200, 260], sat: [0.35, 0.5], light: [0.3, 0.4], trim: [60, 180, 120] },
  { id: 'crow', nouns: ['crow', 'raven', 'carrion bird'], boss: ['crow king', 'raven lord'],
    build: ['floater'], limbs: 'none', head: ['beast', 'long'], back: ['wings'], crown: ['none', 'crest', 'mohawk'], held: ['none'], eyes: [2, 2], teeth: false, stout: [0.8, 1], motifs: [], jaw: ['beak'], pattern: ['none', 'belly', 'spots'], worn: ['none'],
    size: [7, 12], roles: { [M]: 4, [B]: 1 }, biomes: [2, 3, 2, 0.3, 3], likes: { swarm: 3, gust: 3, weave: 3, falcon: 3, drain: 1.5 },
    hue: [250, 280], sat: [0.08, 0.16], light: [0.14, 0.22], trim: [0, 190, 40] },
  { id: 'pixie', nouns: ['pixie', 'will-o-wisp', 'fey'], bomber: ['spark pixie', 'prank-sprite'], caster: ['pixie witch', 'fey enchanter'],
    build: ['floater'], limbs: 'none', head: ['round', 'cone'], back: ['wings'], crown: ['none', 'sprout', 'antenna', 'hat', 'crown', 'stalks'], held: ['none', 'orb', 'dagger'], eyes: [2, 2], teeth: false, stout: [0.8, 1], motifs: ['glow'], jaw: ['plain'], pattern: ['none'], worn: ['scarf', 'necklace', 'none', 'sash'],
    size: [7, 9], roles: { [M]: 2, [B]: 1.5, [C]: 3 }, biomes: [3, 0.3, 0.8, 3, 0.5], likes: { blink: 3, heal: 3, hex: 2, dazzle: 3, weave: 2, evade: 2 },
    hue: [140, 190], sat: [0.45, 0.6], light: [0.58, 0.68], trim: [100, 180, 60] },
  // ---- the pit, the elements, the desert
  { id: 'devil', nouns: ['devil', 'hellspawn', 'horned fiend'], caster: ['hell priest', 'infernal warlock'], boss: ['arch-devil', 'infernal duke', 'pit lord'],
    build: ['tall'], limbs: 'biped', head: ['horned', 'long', 'mask'], back: ['wings', 'tail', 'cape', 'quills', 'mane', 'banner'], crown: ['horns', 'horn'], held: ['sword', 'spear', 'axe', 'staff', 'trident', 'trident', 'scythe', 'mace'], eyes: [2, 2], teeth: true, stout: [1, 1.3], motifs: ['fire'], jaw: ['fangs', 'beard', 'plain', 'tusks'], pattern: ['belly', 'none', 'chevron'], worn: ['pauldron', 'necklace', 'collar', 'belt', 'sash'],
    size: [13, 24], roles: { [M]: 3, [C]: 1.5, [BOSS]: 1 }, biomes: [0.2, 3, 0.2, 0.3, 3], bossWeight: 1.5, likes: { flame: 3, lob: 2, rally: 2, ring: 2, summon: 2 },
    hue: [-8, 8], sat: [0.55, 0.7], light: [0.3, 0.38], trim: [30, 190, 40] },
  { id: 'hellhound', nouns: ['hellhound', 'fire hound', 'ember wolf'], boss: ['hellhound alpha', 'cerberus'],
    build: ['wedge'], limbs: 'quad', head: ['beast', 'long'], back: ['flame', 'tail', 'mane', 'quills', 'spikes'], crown: ['ears', 'horns', 'horn'], held: ['none'], eyes: [2, 2], teeth: true, stout: [0.9, 1.2], motifs: ['fire'], jaw: ['fangs', 'fangs'], pattern: ['stripes', 'mottled', 'none', 'belly'], worn: ['collar', 'collar', 'none'],
    size: [10, 20], roles: { [M]: 5, [BOSS]: 0.4 }, biomes: [0.2, 2.5, 0.1, 0.1, 4], bossWeight: 0.4, likes: { flame: 4, pack: 3, charge: 2, weave: 1.5 },
    hue: [-5, 12], sat: [0.5, 0.65], light: [0.2, 0.28], trim: [30, 40, 190] },
  { id: 'salamander', nouns: ['salamander', 'fire lizard', 'magma newt'], ranged: ['salamander spitter'], caster: ['fire-tongue'], boss: ['great salamander', 'magma wyrm'],
    build: ['wedge'], limbs: 'quad', head: ['beast', 'long', 'toad'], back: ['tail', 'flame', 'quills', 'fins'], crown: ['none', 'crest', 'horn', 'crest'], held: ['none'], eyes: [2, 2], teeth: true, stout: [0.95, 1.25], motifs: ['fire'], jaw: ['fangs', 'plain', 'whiskers'], pattern: ['spots', 'stripes', 'scales', 'chevron'], worn: ['none'],
    size: [9, 20], roles: { [M]: 4, [R]: 2, [C]: 0.6, [BOSS]: 0.4 }, biomes: [0.1, 0.5, 0.1, 0.5, 5], bossWeight: 0.4, likes: { flame: 4, burrow: 1.5, lob: 2, venom: 1 },
    hue: [8, 26], sat: [0.6, 0.75], light: [0.34, 0.44], trim: [30, 40, 180] },
  { id: 'elemental', nouns: ['elemental', 'living storm', 'conjured brute'], caster: ['elemental channeler'], boss: ['elemental lord', 'avatar of the storm'],
    build: ['squat'], limbs: 'biped', head: ['cyclops', 'none', 'round', 'mask', 'cone'], back: ['none', 'crystals', 'flame', 'quills'], crown: ['crest', 'none', 'horns', 'horn', 'crown', 'stalks'], held: ['none', 'hammer'], eyes: [1, 2], teeth: false, stout: [1.1, 1.45], motifs: ['glow'], jaw: ['plain'], pattern: ['mottled', 'stripes', 'none'], worn: ['none'],
    size: [14, 28], roles: { [M]: 3, [C]: 1, [BOSS]: 1 }, biomes: [0.5, 0.8, 3, 1, 3], bossWeight: 1.2, likes: { elemhit: 4, elemaura: 4, aura: 3, flame: 2, chill: 2, storm: 1.5 },
    hue: [20, 30], sat: [0.5, 0.65], light: [0.45, 0.55], trim: [0, 180], tint: true },
  { id: 'dustdevil', nouns: ['dust devil', 'whirlwind', 'gale spirit'], caster: ['storm caller'], boss: ['great whirlwind', 'sandstorm lord'],
    build: ['floater'], limbs: 'none', head: ['none', 'cyclops'], back: ['none', 'crystals', 'spikes'], crown: ['none', 'horns', 'crown', 'stalks'], held: ['none'], eyes: [1, 2], teeth: false, stout: [0.9, 1.2], motifs: ['wind'], jaw: ['plain'], pattern: ['stripes', 'none', 'mottled'], worn: ['none'],
    size: [9, 20], roles: { [M]: 3, [C]: 2, [BOSS]: 0.5 }, biomes: [0.5, 0.1, 3, 0.1, 5], bossWeight: 0.5, likes: { gust: 5, whiteout: 3, evade: 2, wind: 2, launch: 2 },
    hue: [34, 46], sat: [0.3, 0.45], light: [0.56, 0.66], trim: [0, 180, 20] },
  { id: 'antlion', nouns: ['antlion', 'sand trapper', 'pit lurker'], boss: ['great antlion'],
    build: ['insect'], limbs: 'many', head: ['maw', 'long', 'toad'], back: ['none', 'shell', 'quills', 'crystals'], crown: ['horns', 'stalks', 'antenna'], held: ['none'], eyes: [2, 3], teeth: false, stout: [1.05, 1.3], motifs: [], jaw: ['mandibles', 'mandibles', 'fangs'], pattern: ['stripes', 'chevron', 'mottled'], worn: ['none'],
    size: [8, 20], roles: { [M]: 4, [BOSS]: 0.4 }, biomes: [0.1, 0.1, 0.1, 0.8, 4], bossWeight: 0.4, likes: { burrow: 5, trap: 3, pit: 3, lunge: 2, snare: 2 },
    hue: [30, 44], sat: [0.35, 0.5], light: [0.38, 0.48], trim: [15, 190, 0] },
  { id: 'sphinx', nouns: ['sphinx', 'riddle guardian'], boss: ['great sphinx', 'desert guardian', 'sphinx of the sands'],
    build: ['wedge'], limbs: 'quad', head: ['round', 'mask'], back: ['wings', 'tail', 'mane', 'mane', 'banner'], crown: ['crown', 'horns'], held: ['none'], eyes: [2, 2], teeth: false, stout: [1.1, 1.4], motifs: ['stone'], jaw: ['plain', 'beard', 'fangs'], pattern: ['belly', 'stripes', 'none'], worn: ['collar', 'necklace', 'none'],
    size: [16, 26], roles: { [M]: 1, [BOSS]: 1 }, biomes: [0.1, 0.5, 0.1, 0.2, 5], bossWeight: 1.2, likes: { beam: 3, whiteout: 1.5, gust: 2, ward: 1.5 },
    hue: [38, 50], sat: [0.35, 0.5], light: [0.5, 0.6], trim: [150, 190, 10] },
  { id: 'dragon', nouns: ['dragon whelp', 'young dragon'], boss: ['dragon', 'elder dragon', 'ancient wyrm'],
    build: ['squat', 'wedge'], limbs: 'quad', head: ['horned', 'long', 'long'], back: ['wings', 'tail', 'quills', 'mane', 'crystals'], crown: ['horns', 'crest', 'horn', 'mohawk'], held: ['none'], eyes: [2, 2], teeth: true, stout: [1.15, 1.45], motifs: [], jaw: ['fangs', 'tusks', 'plain', 'beard'], pattern: ['scales', 'belly', 'stripes', 'chevron'], worn: ['none'],
    size: [18, 28], roles: { [M]: 1, [BOSS]: 1 }, biomes: [1.5, 1, 1.5, 0.5, 3], bossWeight: 2, likes: { flame: 3, gust: 2, charge: 2, cone: 3 },
    hue: [0, 160], sat: [0.45, 0.6], light: [0.32, 0.42], trim: [30, 190, 60] },
];

export const SPECIES_BY_ID: ReadonlyMap<string, Species> = new Map(SPECIES.map((s) => [s.id, s]));

export interface PickCtx {
  /** How many monsters of each species this run already has: a run should show a wide cast, not five goblins. */
  seen?: ReadonlyMap<string, number>;
  role: number; biome: number; size: number; boss: boolean; traits: ReadonlySet<string>; motifs: readonly Motif[] }

/** How well a species suits a monster (0 = not at all). */
export function speciesWeight(s: Species, c: PickCtx): number {
  const roleW = s.roles[c.boss ? BOSS : c.role] ?? 0;
  if (roleW <= 0) return 0;
  let w = roleW * s.biomes[c.biome] ** 1.5 * (c.boss ? (s.bossWeight ?? 0) : 1);
  if (!c.boss) {
    const [lo, hi] = s.size;
    if (c.size < lo) w *= 0.15 / (1 + (lo - c.size));
    else if (c.size > hi) w *= 0.15 / (1 + (c.size - hi));
  }
  for (const t of c.traits) w *= s.likes?.[t] ?? (t.startsWith('elemhit') || t.startsWith('elemaura') ? s.likes?.elemhit ?? 1 : 1);
  w /= 1 + 2.2 * (c.seen?.get(s.id) ?? 0);
  // a power's tells (bones, ghost...) say what it must be
  if (c.motifs.includes('bones') && s.motifs.includes('bones')) w *= 3;
  if (c.motifs.includes('ghost') && s.motifs.includes('ghost')) w *= 3;
  if (c.motifs.includes('bandage') && s.motifs.includes('bandage')) w *= 3;
  if (c.motifs.includes('fur') && s.motifs.includes('fur')) w *= 2;
  if (c.motifs.includes('slime') && s.motifs.includes('slime')) w *= 2;
  if (c.motifs.includes('thorns') && s.motifs.includes('thorns')) w *= 2.5;
  return w;
}
