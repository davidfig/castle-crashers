// Mob definitions. Speeds are px/tick, times are ticks.
export const Behavior = {
  Melee: 0,
  Ranged: 1,
  Bomber: 2,
  Boss: 3,
  /** Keeps its distance like an archer and spends its time on its `special` (healing, summoning, lobbing, beaming...). */
  Caster: 4,
} as const;

/** A bull charge: a locked-direction rush that cannot be stopped until it has covered `distance`. */
export interface ChargeDef {
  /** Chance per tick to start a charge while eligible (so ~1/chance ticks between charges on average). */
  chance: number;
  speed: number;
  distance: number;
  windup: number;
  /** Ticks before another charge can start. */
  cooldown: number;
  damage: number;
  /** Eligible when the target is between these distances (it needs a run-up, and must be worth charging). */
  minRange: number;
  maxRange: number;
  /** Ticks the charger is dazed (helpless) after finishing. */
  dazed: number;
}

/** A volley: how a ranged mob's shot is shaped (default: one plain arrow). */
export interface ShotDef {
  /** Projectiles per shot, fanned out around the aim line. */
  count: number;
  /** Angle between neighbouring projectiles, in turns. */
  spread: number;
  speed: number;
  damage: number;
  /** Projectile look (see `ProjStyle`). */
  style: number;
  /** A hit also hauls the hero this many pixels toward the shooter (a harpoon). */
  pull?: number;
  /** A hit also poisons (or sets alight) the hero for this many ticks (see `poisonOnHit`). */
  poison?: number;
  /** The projectile steers toward the nearest hero as it flies (a falcon); a dodge-roll shakes it. */
  homing?: boolean;
}

/** What a mob projectile looks like. Render-only; the sim just carries the number. */
export const ProjStyle = { Arrow: 0, Bone: 1, Harpoon: 2, Shard: 3, Glob: 4, Fire: 5, Falcon: 6 } as const;

/** A move with a telegraph: the mob stops, winds up (`windup` ticks, interruptible by a hit), then it happens. */
interface SpecialBase {
  windup: number;
  /** Ticks before it can be used again. */
  cooldown: number;
}

/** Lob a rock: a red circle appears on the ground where the target stands, and `delay` ticks later the rock lands. */
export interface LobSpecial extends SpecialBase {
  kind: 'lob';
  minRange: number;
  maxRange: number;
  radius: number;
  damage: number;
  /** Ticks the rock is in the air (the circle is the warning). */
  delay: number;
  /** A volley: `count` rocks in all, the first on the target and the rest scattered within `spread` px of it (default one). */
  count?: number;
  spread?: number;
}
/** Raise `count` of mob type `type` around the caster, as long as fewer than `cap` of them are alive. */
export interface SummonSpecial extends SpecialBase { kind: 'summon'; type: number; count: number; cap: number }
/** Mend hurt allies within `radius` by `amount` of their max health. Only cast when someone needs it. */
export interface HealSpecial extends SpecialBase { kind: 'heal'; radius: number; amount: number }
/** Whip allies within `radius` into a frenzy for `duration` ticks (faster moving and attacking). */
export interface RallySpecial extends SpecialBase { kind: 'rally'; radius: number; duration: number }
/** Vanish and reappear right beside the target (needs a gap of at least `minRange`, at most `maxRange`). */
export interface BlinkSpecial extends SpecialBase { kind: 'blink'; minRange: number; maxRange: number }
/** A burst around the caster: a ground stomp or a scream. Cast when a hero is inside `radius`; `slow` ticks of slowed movement. */
export interface NovaSpecial extends SpecialBase { kind: 'nova'; radius: number; damage: number; slow: number; style: number }
/** A locked straight ray: after the windup everything within `width` of the line, out to `range`, is hit. */
export interface BeamSpecial extends SpecialBase { kind: 'beam'; range: number; width: number; damage: number }
/** Set a snare near the hero (aimed a little ahead of them, then thrown off by `spread`): it arms after `arm` ticks, then roots whoever steps on it (a dodge breaks the hold). */
export interface TrapSpecial extends SpecialBase {
  kind: 'trap'; minRange: number; maxRange: number; radius: number; damage: number;
  /** Ticks to arm, ticks of root, ticks before it rusts away, and how many snares one mob may keep out (scaled by party size). */
  arm: number; root: number; linger: number; cap: number;
  /** `spread`: px a snare may land from the aim point, at random (none = dead on it). A field of snares (`count` > 1) keeps its first at the aim point and scatters the rest. */
  count?: number; spread?: number;
}
/** Leap onto a hero and cling: it chews at them (`damage` every `pulse` ticks, slowing) until it is killed or they dodge-roll it off. */
export interface ClingSpecial extends SpecialBase { kind: 'cling'; range: number; damage: number; pulse: number; slow: number; cap: number }
/** Wrap allies within `radius` in ice for `duration` ticks: the next hit on each is absorbed whole. Only cast when `need` unwarded allies are near. */
export interface WardSpecial extends SpecialBase { kind: 'ward'; radius: number; duration: number; need: number }
/** Conjure a blizzard where the hero stands: after `delay` ticks it settles into a pool that chills and bites for `linger` ticks. */
export interface StormSpecial extends SpecialBase {
  kind: 'storm'; minRange: number; maxRange: number; radius: number; delay: number; linger: number; damage: number; slow: number;
  /** A barrage: `count` storms in all, the first on the hero and the rest scattered within `spread` px of it (default one). */
  count?: number; spread?: number;
  /** The storm is a stinking bog, not blizzard: it settles into a poison pool instead of black ice. */
  bog?: boolean;
  /** Most storm zones (gathering or settled) alive at once, for a party of one (scaled by party size): pools from several witches would stack. */
  cap?: number;
}
/** A howling whiteout around the caster: heroes inside lose their bearings (movement reversed) for `duration` ticks. */
export interface WhiteoutSpecial extends SpecialBase { kind: 'whiteout'; radius: number; damage: number; duration: number }
/** A death-wail around the caster: heroes inside are silenced (no ability buttons) for `duration` ticks. */
export interface WailSpecial extends SpecialBase { kind: 'wail'; radius: number; damage: number; duration: number }
/** A false light: every hero within `radius` is dragged `pull` px toward the caster (and bitten `damage`) so the crowd gets them. */
export interface LureSpecial extends SpecialBase { kind: 'lure'; radius: number; pull: number; damage: number }
/** Spring onto the hero's spot: a ring marks the landing, `delay` ticks later it comes down, hitting everyone within `radius` and slowing them. */
export interface LeapSpecial extends SpecialBase { kind: 'leap'; minRange: number; maxRange: number; radius: number; damage: number; slow: number; delay: number }
/** A gust around the caster: heroes inside `radius` take `damage` and are blown `push` px outward. */
export interface GustSpecial extends SpecialBase { kind: 'gust'; radius: number; damage: number; push: number }
/** Open a pit under the hero: after `delay` ticks it sucks heroes within `radius` toward its centre (`pull` px per tick) for `linger` ticks, biting whoever reaches the middle. */
export interface PitSpecial extends SpecialBase {
  kind: 'pit'; minRange: number; maxRange: number; radius: number; delay: number; linger: number; pull: number; damage: number;
  /** A field of pits: `count` in all, the first under the hero and the rest scattered within `spread` px of it (default one). */
  count?: number; spread?: number;
}
/** Mark the hero's spot: when the windup ends, every hero within `radius` of it is hexed for `duration` ticks (takes half again as much damage). Moving away dodges it. */
export interface HexSpecial extends SpecialBase { kind: 'hex'; minRange: number; maxRange: number; radius: number; duration: number }
/** A blinding flash on the hero's spot: heroes within `radius` of it are stunned (cannot move or use abilities) for `duration` ticks and take `damage`. */
export interface DazzleSpecial extends SpecialBase { kind: 'dazzle'; minRange: number; maxRange: number; radius: number; duration: number; damage: number }
export type Special =
  | HexSpecial | DazzleSpecial | LobSpecial | SummonSpecial | HealSpecial | RallySpecial | BlinkSpecial | NovaSpecial | BeamSpecial
  | TrapSpecial | ClingSpecial | WardSpecial | StormSpecial | WhiteoutSpecial | WailSpecial
  | LureSpecial | LeapSpecial | GustSpecial | PitSpecial;

/** Nova looks. */
export const NovaStyle = { Stomp: 0, Scream: 1, Frost: 2 } as const;

/** What happens where a mob dies. */
export interface DeathDef {
  /** Breaks apart into `count` of mob type `type`. */
  split?: { type: number; count: number };
  /** Leaves a pool on the ground that hurts and slows whoever stands in it (`frost`: it looks like ice, not poison). */
  pool?: { radius: number; linger: number; damage: number; slow: number; frost?: boolean };
  /** Bursts into a ring of `count` flying shards. */
  shards?: { count: number; speed: number; damage: number };
  /** Leaves a cloud of spores that chokes whoever stands in it: `drain` stamina per tick, and a little slowing. */
  cloud?: { radius: number; linger: number; drain: number };
}

/**
 * One move in a boss's repertoire. `slam`, `roar` (the war cry that calls the retinue) and `charge` are the boss's own fixed moves,
 * driven by the numbers on `BossDef`; `special` is any telegraphed special (see abilities.ts), cast from the boss with the same
 * range rules as an ordinary enemy (its own `cooldown` is ignored: the boss's `specialGap` paces it). Each time the boss is free to act
 * it draws among the moves that can happen right now, by `weight`.
 */
export type BossMove =
  | { kind: 'slam' | 'roar' | 'charge'; weight: number; enragedOnly?: boolean }
  | { kind: 'special'; special: Special; weight: number; enragedOnly?: boolean; /** The authored pose of its windup (default: the roar). */ pose?: 'slam' | 'roar' | 'smash' };

/** The moves a boss without a `moves` list has: the original three. */
export const LEGACY_BOSS_MOVES: readonly BossMove[] = [{ kind: 'slam', weight: 4 }, { kind: 'roar', weight: 3 }, { kind: 'charge', weight: 3 }];

/** A boss's special moves and its supporting cast. */
export interface BossDef {
  /** What it can do besides its plain smash, each with a weight (default: `LEGACY_BOSS_MOVES`). Every boss should have a repertoire of its own. */
  moves?: readonly BossMove[];
  /** Ground slam: red ring that grows for `slamWindup` ticks, then hits everything inside `slamRadius`. */
  slamRadius: number;
  slamWindup: number;
  slamDamage: number;
  /** Ticks of slowed movement the slam leaves on whoever it hits (default none). */
  slamSlow?: number;
  /** Its slam and tells look like ice (a frost ring and icicles) instead of the default fire-and-dust. */
  frost?: boolean;
  /** The name on its health bar. */
  title: string;
  /** War cry: a windup, then a burst of supporting enemies around the boss. */
  roarWindup: number;
  /** Supporters summoned per war cry for a party of one (scaled by party size). */
  summonSize: number;
  /** Supporters standing around the boss when the fight begins, for a party of one (scaled by party size). */
  retinue: number;
  /** Ticks between special moves, normally and once enraged. */
  specialGap: number;
  specialGapEnraged: number;
  /** Below this fraction of its health the boss enrages: faster, quicker specials, an immediate war cry. */
  enrageAt: number;
  enrageSpeed: number;
  /** Boss health multiplier by party size (1..4 players). */
  hpScale: number[];
  /** Coins dropped on death: how many, and each coin's value. */
  lootCoins: number;
  lootValue: number;
}

export interface MobDef {
  name: string;
  behavior: number;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  atkCooldown: number;
  /** Melee: strike reach. Ranged: preferred standoff distance. Bomber: fuse trigger distance. */
  reach: number;
  /** Ticks of telegraph before the attack lands. Interrupted by stun (except bomber fuses). */
  windup: number;
  knockResist: number;
  /** Blocks frontal non-piercing hits, until `shieldHp` of damage has been spent on it: then it breaks and the mob is open from every side. */
  shield: boolean;
  /** Damage a shield soaks before it breaks (absent = it never breaks). */
  shieldHp?: number;
  /** Coin drop: chance (0..1) and value range of the single coin dropped. */
  coinChance: number;
  coinMin: number;
  coinMax: number;
  charge?: ChargeDef;
  /** Takes damage but is never shoved or staggered. */
  armored?: boolean;
  boss?: BossDef;
  /** Ranged and caster mobs: the projectile pattern (default: a single arrow). */
  shot?: ShotDef;
  /** One telegraphed move besides the basic attack. A mob has either this or `charge`, never both. */
  special?: Special;
  onDeath?: DeathDef;
  /** A melee hit also slows the hero for this many ticks. */
  slowOnHit?: number;
  /** Zig-zags toward its target: sideways wobble as a fraction of its speed. */
  weave?: number;
  /** Health regained per tick while it is not being hit. */
  regen?: number;
  /** Hunts in packs: each other mob of its kind within `radius` (up to 3) makes it `bonus` faster and harder-hitting. */
  pack?: { radius: number; bonus: number };
  /** The first time it would die it rises again at this fraction of its health, after a moment on the ground. */
  revive?: number;
  /** After a bite lands it darts away for this many ticks before coming back (hit and run). */
  retreat?: number;
  /** A melee hit also flings the hero this many pixels away. */
  launch?: number;
  /** A melee hit also poisons the hero: this many ticks of damage over time. */
  poisonOnHit?: number;
  /** A melee hit also snares the hero (cannot walk, a dodge-roll breaks free) for this many ticks. */
  rootOnHit?: number;
  /** A melee hit also withers the hero: no stamina comes back for this many ticks. */
  witherOnHit?: number;
  /** Hops toward its target: every `every` ticks (once the hero is `minDist` away) it springs forward at `speed` px/tick. */
  hop?: { every: number; speed: number; minDist: number };
  /** Its venomous skin: whoever hits it is poisoned for this many ticks. */
  thorns?: number;
  /** Chance (0..1) that a blow glances off without touching it. */
  evade?: number;
  /** Travels hidden under the ground (and cannot be hurt) until a hero is within this many px, then surfaces. */
  burrow?: number;
  /** A melee hit heals it by this much. */
  drain?: number;
  /** Leaves slowing mud behind as it walks: a puddle every `every` ticks of movement. */
  trail?: { every: number; radius: number; linger: number; slow: number };
  /** A fire around it: a hero within `radius` is set alight (burning) while there. */
  flame?: { radius: number };
  /** Below this fraction of its health it goes berserk: frenzied, harder-hitting, and no longer staggered. */
  berserk?: number;
  /** A chill around it: a hero within `radius` is slowed (`slow` ticks) and frostbitten (`damage` every `pulse` ticks). */
  aura?: { radius: number; slow: number; damage: number; pulse: number };
}

export const MobType = {
  // Meadow (the greenskin raiders)
  Goblin: 0, Orc: 1, Archer: 2, Shield: 3, Bomber: 4,
  Boss: 5,
  Wolf: 6, Slinger: 7, Shaman: 8, Drummer: 9, Troll: 10,
  // Haunted Keep (the restless dead)
  Skeleton: 11, BoneArcher: 12, Ghoul: 13, Wraith: 14, Skull: 15, BoneBrute: 16,
  Necromancer: 17, Banshee: 18, PlagueZombie: 19, Lich: 20, DreadKnight: 21,
  // Frozen Pass (the mountain folk and what the storm sends)
  Trapper: 22, SnowSprite: 23, Harpooner: 24, FrostWolf: 25, Ram: 26, IceHusk: 27,
  Yeti: 28, FrostShaman: 29, BlizzardWitch: 30, WhiteoutSpirit: 31, TundraGuard: 32,
  // Frozen Pass boss
  RimeKing: 33,
  // Haunted Keep boss
  DreadRegent: 34,
  // Sunken Marsh (the bog-folk and what rises from the mire)
  BogFrog: 35, MudLeech: 36, ToadSpitter: 37, Bullfrog: 38, Sporebloat: 39, ReedStalker: 40,
  Wisp: 41, PeatBrute: 42, MireHag: 43, ToadMatron: 44, DrownedWarden: 45,
  // Sunken Marsh boss
  Fenlord: 46,
  // Scorched Dunes (the sun-cult nomads, the desert's beasts and the sand's spirits)
  DuneRaider: 47, Scarab: 48, FlameArcher: 49, Sidewinder: 50, Scorpion: 51, Falconer: 52,
  DustDevil: 53, Antlion: 54, Mummy: 55, SunPriest: 56, SunGuard: 57,
  // Scorched Dunes boss
  SunTyrant: 58,
} as const;

export const MOBS: MobDef[] = [
  { name: 'goblin', behavior: Behavior.Melee, hp: 6, speed: 0.56, radius: 3.5, damage: 3, atkCooldown: 50, reach: 8, windup: 10, knockResist: 1, shield: false, coinChance: 0.5, coinMin: 1, coinMax: 1 },
  { name: 'orc', behavior: Behavior.Melee, hp: 30, speed: 0.38, radius: 5.5, damage: 12, atkCooldown: 80, reach: 14, windup: 24, knockResist: 0.35, shield: false, coinChance: 1, coinMin: 3, coinMax: 6,
    charge: { chance: 1 / 500, speed: 3.4, distance: 190, windup: 36, cooldown: 420, damage: 14, minRange: 60, maxRange: 240, dazed: 55 } },
  { name: 'archer', behavior: Behavior.Ranged, hp: 5, speed: 0.5, radius: 3.5, damage: 6, atkCooldown: 110, reach: 100, windup: 30, knockResist: 1, shield: false, coinChance: 0.7, coinMin: 1, coinMax: 3 },
  { name: 'shield', behavior: Behavior.Melee, hp: 22, speed: 0.42, radius: 5, damage: 7, atkCooldown: 70, reach: 11, windup: 16, knockResist: 0.5, shield: true, shieldHp: 24, coinChance: 1, coinMin: 2, coinMax: 4 },
  { name: 'bomber', behavior: Behavior.Bomber, hp: 4, speed: 0.95, radius: 3.5, damage: 14, atkCooldown: 0, reach: 10, windup: 30, knockResist: 1, shield: false, coinChance: 0, coinMin: 0, coinMax: 0 },
  {
    name: 'warlord', behavior: Behavior.Boss, hp: 650, speed: 0.3, radius: 22, damage: 22, atkCooldown: 100, reach: 30, windup: 28,
    knockResist: 0, shield: false, coinChance: 0, coinMin: 0, coinMax: 0, armored: true,
    charge: { chance: 0, speed: 3.1, distance: 280, windup: 44, cooldown: 0, damage: 28, minRange: 80, maxRange: 300, dazed: 85 },
    boss: {
      title: 'ORC WARLORD',
      // The warlord leads a warband: it slams and charges itself, rallies its retinue into a frenzy, and has boulders hurled in a volley.
      moves: [
        { kind: 'slam', weight: 4 }, { kind: 'roar', weight: 3 }, { kind: 'charge', weight: 3 },
        { kind: 'special', weight: 2.5, pose: 'roar', special: { kind: 'rally', windup: 44, cooldown: 0, radius: 150, duration: 360 } },
        { kind: 'special', weight: 3, pose: 'slam', special: { kind: 'lob', windup: 40, cooldown: 0, minRange: 50, maxRange: 320, radius: 22, damage: 14, delay: 56, count: 4, spread: 70 } },
      ],
      slamRadius: 84, slamWindup: 56, slamDamage: 24, roarWindup: 50, summonSize: 9, retinue: 26,
      specialGap: 240, specialGapEnraged: 150, enrageAt: 0.5, enrageSpeed: 1.4, hpScale: [1, 1.6, 2.1, 2.6],
      lootCoins: 14, lootValue: 12,
    },
  },
  // ---- Meadow
  { name: 'wolf', behavior: Behavior.Melee, hp: 9, speed: 0.8, radius: 4, damage: 5, atkCooldown: 45, reach: 9, windup: 10, knockResist: 0.9, shield: false, coinChance: 0.5, coinMin: 1, coinMax: 2,
    pack: { radius: 44, bonus: 0.22 } },
  { name: 'slinger', behavior: Behavior.Caster, hp: 7, speed: 0.5, radius: 3.5, damage: 9, atkCooldown: 0, reach: 110, windup: 36, knockResist: 1, shield: false, coinChance: 0.7, coinMin: 1, coinMax: 3,
    special: { kind: 'lob', windup: 36, cooldown: 140, minRange: 40, maxRange: 175, radius: 16, damage: 9, delay: 46 } },
  { name: 'shaman', behavior: Behavior.Caster, hp: 12, speed: 0.42, radius: 4, damage: 0, atkCooldown: 0, reach: 90, windup: 40, knockResist: 0.8, shield: false, coinChance: 1, coinMin: 2, coinMax: 5,
    special: { kind: 'heal', windup: 40, cooldown: 200, radius: 72, amount: 0.5 } },
  { name: 'drummer', behavior: Behavior.Caster, hp: 20, speed: 0.36, radius: 5, damage: 0, atkCooldown: 0, reach: 70, windup: 30, knockResist: 0.6, shield: false, coinChance: 1, coinMin: 2, coinMax: 5,
    special: { kind: 'rally', windup: 30, cooldown: 280, radius: 95, duration: 330 } },
  { name: 'troll', behavior: Behavior.Melee, hp: 70, speed: 0.3, radius: 7, damage: 14, atkCooldown: 90, reach: 16, windup: 26, knockResist: 0.25, shield: false, coinChance: 1, coinMin: 5, coinMax: 9, regen: 0.03,
    special: { kind: 'nova', windup: 44, cooldown: 240, radius: 42, damage: 16, slow: 0, style: NovaStyle.Stomp } },

  // ---- Haunted Keep
  { name: 'skeleton', behavior: Behavior.Melee, hp: 8, speed: 0.5, radius: 3.5, damage: 4, atkCooldown: 55, reach: 9, windup: 14, knockResist: 0.9, shield: false, coinChance: 0.5, coinMin: 1, coinMax: 2 },
  { name: 'bonearcher', behavior: Behavior.Ranged, hp: 6, speed: 0.45, radius: 3.5, damage: 5, atkCooldown: 130, reach: 105, windup: 34, knockResist: 1, shield: false, coinChance: 0.7, coinMin: 1, coinMax: 3,
    shot: { count: 2, spread: 0.03, speed: 2.1, damage: 5, style: ProjStyle.Bone } },
  { name: 'ghoul', behavior: Behavior.Melee, hp: 14, speed: 0.8, radius: 4, damage: 6, atkCooldown: 50, reach: 9, windup: 10, knockResist: 0.8, shield: false, coinChance: 0.6, coinMin: 1, coinMax: 3, slowOnHit: 90 },
  { name: 'wraith', behavior: Behavior.Melee, hp: 11, speed: 0.55, radius: 4, damage: 8, atkCooldown: 70, reach: 11, windup: 16, knockResist: 1, shield: false, coinChance: 0.8, coinMin: 2, coinMax: 4,
    special: { kind: 'blink', windup: 26, cooldown: 240, minRange: 70, maxRange: 230 } },
  { name: 'skull', behavior: Behavior.Melee, hp: 3, speed: 0.85, radius: 3, damage: 3, atkCooldown: 40, reach: 7, windup: 8, knockResist: 1, shield: false, coinChance: 0.2, coinMin: 1, coinMax: 1, weave: 0.9 },
  { name: 'bonebrute', behavior: Behavior.Melee, hp: 42, speed: 0.32, radius: 6, damage: 13, atkCooldown: 85, reach: 15, windup: 24, knockResist: 0.3, shield: false, coinChance: 1, coinMin: 3, coinMax: 6,
    onDeath: { split: { type: MobType.Skull, count: 3 } } },
  { name: 'necromancer', behavior: Behavior.Caster, hp: 18, speed: 0.4, radius: 4, damage: 0, atkCooldown: 0, reach: 110, windup: 50, knockResist: 0.8, shield: false, coinChance: 1, coinMin: 4, coinMax: 8,
    special: { kind: 'summon', windup: 50, cooldown: 320, type: MobType.Skeleton, count: 3, cap: 12 } },
  { name: 'banshee', behavior: Behavior.Caster, hp: 12, speed: 0.5, radius: 4, damage: 0, atkCooldown: 0, reach: 62, windup: 44, knockResist: 1, shield: false, coinChance: 0.9, coinMin: 2, coinMax: 5,
    special: { kind: 'wail', windup: 44, cooldown: 240, radius: 70, damage: 4, duration: 210 } },
  { name: 'plaguezombie', behavior: Behavior.Melee, hp: 38, speed: 0.3, radius: 5.5, damage: 9, atkCooldown: 90, reach: 12, windup: 26, knockResist: 0.4, shield: false, coinChance: 1, coinMin: 2, coinMax: 4,
    onDeath: { pool: { radius: 24, linger: 300, damage: 2, slow: 40 } } },
  { name: 'lich', behavior: Behavior.Caster, hp: 34, speed: 0.4, radius: 5, damage: 18, atkCooldown: 0, reach: 130, windup: 56, knockResist: 0.6, shield: false, coinChance: 1, coinMin: 6, coinMax: 10,
    special: { kind: 'beam', windup: 56, cooldown: 250, range: 230, width: 6, damage: 18 } },
  { name: 'dreadknight', behavior: Behavior.Melee, hp: 58, speed: 0.36, radius: 6, damage: 14, atkCooldown: 85, reach: 14, windup: 22, knockResist: 0.3, shield: false, coinChance: 1, coinMin: 6, coinMax: 10, revive: 0.4 },
  // ---- Frozen Pass
  { name: 'trapper', behavior: Behavior.Melee, hp: 7, speed: 0.5, radius: 3.5, damage: 5, atkCooldown: 52, reach: 9, windup: 12, knockResist: 0.9, shield: false, coinChance: 0.5, coinMin: 1, coinMax: 1,
    special: { kind: 'trap', windup: 26, cooldown: 280, minRange: 30, maxRange: 170, radius: 9, damage: 4, arm: 50, root: 60, linger: 900, cap: 2, spread: 22 } },
  { name: 'snowsprite', behavior: Behavior.Melee, hp: 3, speed: 0.85, radius: 3, damage: 3, atkCooldown: 40, reach: 7, windup: 8, knockResist: 1, shield: false, coinChance: 0.2, coinMin: 1, coinMax: 1,
    special: { kind: 'cling', windup: 10, cooldown: 200, range: 26, damage: 1, pulse: 30, slow: 40, cap: 3 } },
  { name: 'harpooner', behavior: Behavior.Ranged, hp: 6, speed: 0.42, radius: 3.5, damage: 8, atkCooldown: 140, reach: 120, windup: 34, knockResist: 1, shield: false, coinChance: 0.7, coinMin: 1, coinMax: 3,
    shot: { count: 1, spread: 0, speed: 2.6, damage: 6, style: ProjStyle.Harpoon, pull: 56 } },
  { name: 'frostwolf', behavior: Behavior.Melee, hp: 10, speed: 1.0, radius: 4, damage: 4, atkCooldown: 65, reach: 9, windup: 10, knockResist: 0.9, shield: false, coinChance: 0.5, coinMin: 1, coinMax: 2, retreat: 30 },
  { name: 'ram', behavior: Behavior.Melee, hp: 26, speed: 0.4, radius: 5.5, damage: 8, atkCooldown: 80, reach: 13, windup: 22, knockResist: 0.35, shield: false, coinChance: 1, coinMin: 2, coinMax: 4, launch: 84 },
  { name: 'icehusk', behavior: Behavior.Melee, hp: 36, speed: 0.3, radius: 5.5, damage: 9, atkCooldown: 90, reach: 12, windup: 26, knockResist: 0.4, shield: false, coinChance: 1, coinMin: 2, coinMax: 4,
    onDeath: { shards: { count: 6, speed: 1.9, damage: 4 } } },
  { name: 'yeti', behavior: Behavior.Melee, hp: 48, speed: 0.34, radius: 6.5, damage: 12, atkCooldown: 88, reach: 15, windup: 24, knockResist: 0.28, shield: false, coinChance: 1, coinMin: 3, coinMax: 6, berserk: 0.4 },
  { name: 'frostshaman', behavior: Behavior.Caster, hp: 16, speed: 0.4, radius: 4, damage: 0, atkCooldown: 0, reach: 110, windup: 50, knockResist: 0.8, shield: false, coinChance: 1, coinMin: 4, coinMax: 8,
    special: { kind: 'ward', windup: 50, cooldown: 300, radius: 90, duration: 480, need: 3 } },
  { name: 'blizzardwitch', behavior: Behavior.Caster, hp: 12, speed: 0.5, radius: 4, damage: 0, atkCooldown: 0, reach: 100, windup: 44, knockResist: 1, shield: false, coinChance: 0.9, coinMin: 2, coinMax: 5,
    special: { kind: 'storm', windup: 44, cooldown: 220, minRange: 30, maxRange: 170, radius: 36, delay: 50, linger: 260, damage: 3, slow: 60, cap: 3 } },
  { name: 'whiteoutspirit', behavior: Behavior.Melee, hp: 11, speed: 0.55, radius: 4, damage: 8, atkCooldown: 70, reach: 11, windup: 16, knockResist: 1, shield: false, coinChance: 0.8, coinMin: 2, coinMax: 4,
    special: { kind: 'whiteout', windup: 36, cooldown: 300, radius: 64, damage: 3, duration: 75 } },
  { name: 'tundraguard', behavior: Behavior.Melee, hp: 60, speed: 0.35, radius: 6, damage: 14, atkCooldown: 85, reach: 14, windup: 22, knockResist: 0.3, shield: false, coinChance: 1, coinMin: 6, coinMax: 10,
    aura: { radius: 40, slow: 30, damage: 1, pulse: 40 } },
  // ---- Frozen Pass boss: a colossal frost-giant chieftain. The same moves as the Warlord, tuned for the Pass: a slam that leaves
  // you slowed, a longer, wider, slower charge, and a retinue of the Pass's own folk.
  {
    name: 'rimeking', behavior: Behavior.Boss, hp: 720, speed: 0.28, radius: 22, damage: 24, atkCooldown: 100, reach: 30, windup: 30,
    knockResist: 0, shield: false, coinChance: 0, coinMin: 0, coinMax: 0, armored: true,
    charge: { chance: 0, speed: 3.0, distance: 270, windup: 46, cooldown: 0, damage: 26, minRange: 80, maxRange: 310, dazed: 80 },
    boss: {
      title: 'RIME KING', frost: true,
      // The Rime King rules the cold itself and has no ground slam: it calls the Pass's folk and charges like an avalanche, and its
      // magic is ice: a frost nova, a barrage of blizzards, a field of snares, a ward over its retinue, and (enraged) a whiteout.
      moves: [
        { kind: 'roar', weight: 2.5 }, { kind: 'charge', weight: 2.5 },
        { kind: 'special', weight: 3, pose: 'slam', special: { kind: 'nova', windup: 50, cooldown: 0, radius: 96, damage: 18, slow: 150, style: NovaStyle.Frost } },
        { kind: 'special', weight: 3, pose: 'roar', special: { kind: 'storm', windup: 46, cooldown: 0, minRange: 0, maxRange: 420, radius: 30, delay: 56, linger: 320, damage: 2, slow: 70, count: 4, spread: 80 } },
        { kind: 'special', weight: 2, pose: 'smash', special: { kind: 'trap', windup: 40, cooldown: 0, minRange: 0, maxRange: 420, radius: 10, damage: 5, arm: 50, root: 80, linger: 900, cap: 3, count: 4, spread: 60 } },
        { kind: 'special', weight: 1.5, pose: 'roar', special: { kind: 'ward', windup: 52, cooldown: 0, radius: 140, duration: 480, need: 4 } },
        { kind: 'special', weight: 2, pose: 'slam', enragedOnly: true, special: { kind: 'whiteout', windup: 44, cooldown: 0, radius: 120, damage: 6, duration: 150 } },
      ],
      slamRadius: 92, slamWindup: 58, slamDamage: 20, roarWindup: 52, summonSize: 10, retinue: 28,
      specialGap: 230, specialGapEnraged: 140, enrageAt: 0.5, enrageSpeed: 1.35, hpScale: [1, 1.6, 2.1, 2.6],
      lootCoins: 16, lootValue: 12,
    },
  },
  // ---- Haunted Keep boss: an undead king. No charge or ground slam: it rules by magic, with a soul beam, raised dead, spectral
  // blinks, a scream and a death wail, and it drinks the strength of its own retinue.
  {
    name: 'dreadregent', behavior: Behavior.Boss, hp: 700, speed: 0.26, radius: 22, damage: 22, atkCooldown: 100, reach: 30, windup: 30,
    knockResist: 0, shield: false, coinChance: 0, coinMin: 0, coinMax: 0, armored: true,
    charge: { chance: 0, speed: 2.6, distance: 220, windup: 46, cooldown: 0, damage: 22, minRange: 80, maxRange: 280, dazed: 80 },
    boss: {
      title: 'DREAD REGENT',
      moves: [
        { kind: 'roar', weight: 2 },
        { kind: 'special', weight: 3, pose: 'slam', special: { kind: 'beam', windup: 70, cooldown: 0, range: 420, width: 12, damage: 26 } },
        { kind: 'special', weight: 3, pose: 'roar', special: { kind: 'summon', windup: 54, cooldown: 0, type: MobType.Skeleton, count: 5, cap: 18 } },
        { kind: 'special', weight: 2.5, pose: 'smash', special: { kind: 'blink', windup: 30, cooldown: 0, minRange: 80, maxRange: 300 } },
        { kind: 'special', weight: 2.5, pose: 'slam', special: { kind: 'nova', windup: 48, cooldown: 0, radius: 80, damage: 16, slow: 120, style: NovaStyle.Scream } },
        { kind: 'special', weight: 2, pose: 'roar', special: { kind: 'heal', windup: 46, cooldown: 0, radius: 160, amount: 0.5 } },
        { kind: 'special', weight: 2, pose: 'roar', enragedOnly: true, special: { kind: 'wail', windup: 50, cooldown: 0, radius: 130, damage: 5, duration: 180 } },
      ],
      slamRadius: 80, slamWindup: 58, slamDamage: 18, roarWindup: 52, summonSize: 8, retinue: 26,
      specialGap: 220, specialGapEnraged: 130, enrageAt: 0.5, enrageSpeed: 1.3, hpScale: [1, 1.6, 2.1, 2.6],
      lootCoins: 16, lootValue: 12,
    },
  },
  // ---- Sunken Marsh: the bog-folk. Venom, mud and false lights; the ground itself is the enemy. Like every other biome, each enemy
  // does something no other enemy does (see the test in roster.test.ts).
  { name: 'bogfrog', behavior: Behavior.Melee, hp: 6, speed: 0.5, radius: 3.5, damage: 3, atkCooldown: 50, reach: 8, windup: 10, knockResist: 1, shield: false, coinChance: 0.5, coinMin: 1, coinMax: 1,
    hop: { every: 55, speed: 1.4, minDist: 30 } },
  { name: 'mudleech', behavior: Behavior.Melee, hp: 4, speed: 0.7, radius: 3, damage: 2, atkCooldown: 45, reach: 7, windup: 8, knockResist: 1, shield: false, coinChance: 0.2, coinMin: 1, coinMax: 1, poisonOnHit: 150 },
  { name: 'toadspitter', behavior: Behavior.Ranged, hp: 6, speed: 0.45, radius: 3.5, damage: 3, atkCooldown: 125, reach: 105, windup: 32, knockResist: 1, shield: false, coinChance: 0.7, coinMin: 1, coinMax: 3,
    shot: { count: 1, spread: 0, speed: 1.9, damage: 3, style: ProjStyle.Glob, poison: 140 } },
  { name: 'bullfrog', behavior: Behavior.Melee, hp: 20, speed: 0.42, radius: 5, damage: 7, atkCooldown: 75, reach: 11, windup: 18, knockResist: 0.5, shield: false, coinChance: 1, coinMin: 2, coinMax: 4,
    special: { kind: 'leap', windup: 28, cooldown: 270, minRange: 50, maxRange: 150, radius: 20, damage: 9, slow: 60, delay: 30 } },
  { name: 'sporebloat', behavior: Behavior.Melee, hp: 9, speed: 0.4, radius: 4.5, damage: 2, atkCooldown: 70, reach: 9, windup: 16, knockResist: 0.9, shield: false, coinChance: 0.4, coinMin: 1, coinMax: 2,
    onDeath: { cloud: { radius: 28, linger: 300, drain: 0.7 } } },
  { name: 'reedstalker', behavior: Behavior.Melee, hp: 12, speed: 0.55, radius: 3.5, damage: 7, atkCooldown: 75, reach: 22, windup: 18, knockResist: 0.8, shield: false, coinChance: 0.8, coinMin: 1, coinMax: 3 },
  { name: 'wisp', behavior: Behavior.Caster, hp: 8, speed: 0.5, radius: 3.5, damage: 0, atkCooldown: 0, reach: 100, windup: 40, knockResist: 1, shield: false, coinChance: 0.9, coinMin: 2, coinMax: 5,
    special: { kind: 'lure', windup: 40, cooldown: 270, radius: 140, pull: 64, damage: 2 } },
  { name: 'peatbrute', behavior: Behavior.Melee, hp: 52, speed: 0.3, radius: 6, damage: 12, atkCooldown: 88, reach: 15, windup: 24, knockResist: 0.25, shield: false, coinChance: 1, coinMin: 3, coinMax: 6,
    trail: { every: 36, radius: 13, linger: 420, slow: 30 } },
  { name: 'mirehag', behavior: Behavior.Caster, hp: 13, speed: 0.5, radius: 4, damage: 0, atkCooldown: 0, reach: 100, windup: 44, knockResist: 1, shield: false, coinChance: 0.9, coinMin: 2, coinMax: 5,
    special: { kind: 'hex', windup: 44, cooldown: 260, minRange: 30, maxRange: 170, radius: 22, duration: 300 } },
  { name: 'toadmatron', behavior: Behavior.Melee, hp: 44, speed: 0.3, radius: 6, damage: 9, atkCooldown: 90, reach: 13, windup: 22, knockResist: 0.4, shield: false, coinChance: 1, coinMin: 4, coinMax: 8, thorns: 180 },
  { name: 'drownedwarden', behavior: Behavior.Melee, hp: 62, speed: 0.33, radius: 6, damage: 13, atkCooldown: 85, reach: 14, windup: 22, knockResist: 0.3, shield: false, coinChance: 1, coinMin: 6, coinMax: 10, rootOnHit: 40 },
  // ---- Sunken Marsh boss: a bloated toad-lord of the fen. It leaps, drags you toward it with its false lights, brews the bog under
  // you, calls the frogs, and (enraged) lobs filth in a volley.
  {
    name: 'fenlord', behavior: Behavior.Boss, hp: 700, speed: 0.28, radius: 22, damage: 22, atkCooldown: 100, reach: 30, windup: 30,
    knockResist: 0, shield: false, coinChance: 0, coinMin: 0, coinMax: 0, armored: true,
    charge: { chance: 0, speed: 2.6, distance: 220, windup: 46, cooldown: 0, damage: 22, minRange: 80, maxRange: 280, dazed: 80 },
    boss: {
      title: 'THE FENLORD',
      moves: [
        { kind: 'roar', weight: 2.5 },
        { kind: 'special', weight: 3.5, pose: 'slam', special: { kind: 'leap', windup: 44, cooldown: 0, minRange: 60, maxRange: 340, radius: 56, damage: 22, slow: 100, delay: 44 } },
        { kind: 'special', weight: 2.5, pose: 'roar', special: { kind: 'lure', windup: 50, cooldown: 0, radius: 220, pull: 90, damage: 4 } },
        { kind: 'special', weight: 3, pose: 'roar', special: { kind: 'storm', windup: 46, cooldown: 0, minRange: 0, maxRange: 420, radius: 30, delay: 56, linger: 320, damage: 2, slow: 60, count: 4, spread: 80, bog: true } },
        { kind: 'special', weight: 2, pose: 'smash', special: { kind: 'summon', windup: 50, cooldown: 0, type: MobType.BogFrog, count: 5, cap: 20 } },
        { kind: 'special', weight: 2.5, pose: 'slam', enragedOnly: true, special: { kind: 'lob', windup: 40, cooldown: 0, minRange: 50, maxRange: 340, radius: 20, damage: 12, delay: 56, count: 5, spread: 80 } },
      ],
      slamRadius: 84, slamWindup: 58, slamDamage: 20, roarWindup: 52, summonSize: 9, retinue: 26,
      specialGap: 220, specialGapEnraged: 130, enrageAt: 0.5, enrageSpeed: 1.35, hpScale: [1, 1.6, 2.1, 2.6],
      lootCoins: 16, lootValue: 12,
    },
  },
  // ---- Scorched Dunes: the sun-cult nomads and the desert's beasts. Fire, sand and venom; the open ground pulls and blows you about.
  { name: 'duneraider', behavior: Behavior.Melee, hp: 7, speed: 0.55, radius: 3.5, damage: 4, atkCooldown: 52, reach: 9, windup: 12, knockResist: 0.9, shield: false, coinChance: 0.5, coinMin: 1, coinMax: 1, evade: 0.25 },
  { name: 'scarab', behavior: Behavior.Melee, hp: 4, speed: 0.7, radius: 3, damage: 3, atkCooldown: 42, reach: 7, windup: 8, knockResist: 1, shield: false, coinChance: 0.2, coinMin: 1, coinMax: 1, drain: 2 },
  { name: 'flamearcher', behavior: Behavior.Ranged, hp: 6, speed: 0.45, radius: 3.5, damage: 4, atkCooldown: 120, reach: 110, windup: 32, knockResist: 1, shield: false, coinChance: 0.7, coinMin: 1, coinMax: 3,
    shot: { count: 1, spread: 0, speed: 2.3, damage: 4, style: ProjStyle.Fire, poison: 120 } },
  { name: 'sidewinder', behavior: Behavior.Melee, hp: 9, speed: 0.85, radius: 3.5, damage: 5, atkCooldown: 60, reach: 8, windup: 10, knockResist: 0.9, shield: false, coinChance: 0.5, coinMin: 1, coinMax: 2, burrow: 46 },
  { name: 'scorpion', behavior: Behavior.Melee, hp: 16, speed: 0.55, radius: 4.5, damage: 7, atkCooldown: 70, reach: 11, windup: 16, knockResist: 0.6, shield: false, coinChance: 0.8, coinMin: 1, coinMax: 3, armored: true },
  { name: 'falconer', behavior: Behavior.Ranged, hp: 8, speed: 0.42, radius: 3.5, damage: 5, atkCooldown: 150, reach: 120, windup: 36, knockResist: 1, shield: false, coinChance: 0.8, coinMin: 2, coinMax: 4,
    shot: { count: 1, spread: 0, speed: 1.5, damage: 5, style: ProjStyle.Falcon, homing: true } },
  { name: 'dustdevil', behavior: Behavior.Melee, hp: 10, speed: 0.6, radius: 4, damage: 6, atkCooldown: 65, reach: 10, windup: 14, knockResist: 1, shield: false, coinChance: 0.8, coinMin: 2, coinMax: 4,
    special: { kind: 'gust', windup: 34, cooldown: 280, radius: 56, damage: 4, push: 90 } },
  { name: 'antlion', behavior: Behavior.Caster, hp: 20, speed: 0.3, radius: 5, damage: 0, atkCooldown: 0, reach: 95, windup: 46, knockResist: 0.7, shield: false, coinChance: 1, coinMin: 3, coinMax: 7,
    special: { kind: 'pit', windup: 46, cooldown: 300, minRange: 30, maxRange: 170, radius: 34, delay: 45, linger: 240, pull: 0.55, damage: 4 } },
  { name: 'mummy', behavior: Behavior.Melee, hp: 48, speed: 0.3, radius: 5.5, damage: 11, atkCooldown: 90, reach: 13, windup: 26, knockResist: 0.3, shield: false, coinChance: 1, coinMin: 3, coinMax: 6, witherOnHit: 240 },
  { name: 'sunpriest', behavior: Behavior.Caster, hp: 16, speed: 0.4, radius: 4, damage: 0, atkCooldown: 0, reach: 120, windup: 48, knockResist: 0.8, shield: false, coinChance: 1, coinMin: 4, coinMax: 8,
    special: { kind: 'dazzle', windup: 48, cooldown: 280, minRange: 40, maxRange: 200, radius: 24, duration: 50, damage: 3 } },
  { name: 'sunguard', behavior: Behavior.Melee, hp: 64, speed: 0.34, radius: 6, damage: 14, atkCooldown: 85, reach: 14, windup: 22, knockResist: 0.3, shield: false, coinChance: 1, coinMin: 6, coinMax: 10,
    flame: { radius: 34 } },
  // ---- Scorched Dunes boss: a god-king of the sun cult. Sunbeams, a rain of sunfire, hot gusts, pits in the sand, a stampede, and its
  // priests' summoned scarabs.
  {
    name: 'suntyrant', behavior: Behavior.Boss, hp: 720, speed: 0.27, radius: 22, damage: 24, atkCooldown: 100, reach: 30, windup: 30,
    knockResist: 0, shield: false, coinChance: 0, coinMin: 0, coinMax: 0, armored: true,
    charge: { chance: 0, speed: 3.0, distance: 260, windup: 44, cooldown: 0, damage: 26, minRange: 80, maxRange: 300, dazed: 80 },
    boss: {
      title: 'SUN TYRANT',
      moves: [
        { kind: 'roar', weight: 2 }, { kind: 'charge', weight: 2 },
        { kind: 'special', weight: 3, pose: 'slam', special: { kind: 'beam', windup: 70, cooldown: 0, range: 420, width: 14, damage: 28 } },
        { kind: 'special', weight: 3, pose: 'roar', special: { kind: 'lob', windup: 44, cooldown: 0, minRange: 0, maxRange: 380, radius: 20, damage: 12, delay: 56, count: 6, spread: 90 } },
        { kind: 'special', weight: 2.5, pose: 'slam', special: { kind: 'gust', windup: 48, cooldown: 0, radius: 110, damage: 10, push: 100 } },
        { kind: 'special', weight: 2.5, pose: 'smash', special: { kind: 'pit', windup: 44, cooldown: 0, minRange: 0, maxRange: 420, radius: 36, delay: 48, linger: 260, pull: 0.6, damage: 5, count: 3, spread: 70 } },
        { kind: 'special', weight: 2, pose: 'roar', enragedOnly: true, special: { kind: 'summon', windup: 50, cooldown: 0, type: MobType.Scarab, count: 6, cap: 24 } },
      ],
      slamRadius: 88, slamWindup: 58, slamDamage: 20, roarWindup: 52, summonSize: 10, retinue: 28,
      specialGap: 225, specialGapEnraged: 135, enrageAt: 0.5, enrageSpeed: 1.35, hpScale: [1, 1.6, 2.1, 2.6],
      lootCoins: 16, lootValue: 12,
    },
  },
];

/** True for the boss types (the Orc Warlord, the Rime King): they have a `boss` def and their own move set. */
export function isBossType(type: number): boolean {
  return MOBS[type].behavior === Behavior.Boss;
}

export const BLAST_RADIUS = 30;
export const ARROW_SPEED = 2.2;
export const ARROW_DAMAGE = 6;
export const ARROW_TTL = 220;
