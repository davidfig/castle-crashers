// Per-enemy presentation that is not part of the sheet: how big its shadow is, what colour it bleeds, what it holds. For the hand-made roster
// these are the old tables; for a run's generated monsters they come from the monster itself (its size and its `MonsterLook`).
import { activeBestiary } from '../data/bestiary';
import { MOBS, MobType, isBossType } from '../data/mobs';
import type { HeldKind } from '../data/monsterLook';

/** Shadow size (0 small, 1 medium, 2 large) by MobType, hand-made roster. */
const SHADOW_CLASSIC = [0, 2, 0, 1, 0, 2, 1, 0, 0, 1, 2, 0, 0, 0, 0, 0, 2, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 2, 0, 0, 0, 1, 2, 2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 1, 2, 0, 0, 0, 0, 1, 2, 0, 1, 1, 0, 1, 2];

/** Blood/gib colors per MobType, hand-made roster. */
const KILL_CLASSIC = [
  0x6fbf3f, 0xb04a30, 0x8a5fb0, 0x9aa5b1, 0xd8402e, 0xb04a30, // goblin, orc, archer, shield, bomber, boss
  0x8a7a68, 0x6fbf3f, 0x5a9a50, 0x6fbf3f, 0x6a8a58, // wolf, slinger, shaman, drummer, troll
  0xd6cfc2, 0xd6cfc2, 0x6a8a68, 0x9ab0e0, 0xd6cfc2, 0xd6cfc2, // skeleton, bone archer, ghoul, wraith, skull, bone brute
  0x9a5ac0, 0xb8c8f0, 0x9ab040, 0xc0a0ff, 0x6a6080, // necromancer, banshee, plague zombie, lich, dread knight
  0xb04a30, 0x7fc4f4, 0xb04a30, 0x7494b4, 0xb04a30, 0xb4e8ff, // trapper, snow sprite, harpooner, frost wolf, ram, ice husk
  0x7684b0, 0x5ac8f4, 0x6aaee4, 0x86bce0, 0x587090, // yeti, frost shaman, blizzard witch, whiteout spirit, tundra guard
  0x5a78b8, // rime king
  0x7a4cc0, // dread regent
  0x7ab030, 0x4a6a3a, 0x8cc83a, 0x6aa04a, 0xb8c860, 0xa0b078, // bog frog, mud leech, toad spitter, bullfrog, sporebloat, reed stalker
  0x40e0c0, 0x6a5a3a, 0x7a9a3a, 0x5a8a4a, 0x4a7a6a, // wisp, peat brute, mire hag, toad matron, drowned warden
  0x6a9a2a, // fenlord
  0xc08040, 0x3a5a4a, 0xd8742a, 0xc8a850, 0x8a3a2a, 0xb08850, // dune raider, scarab, flame archer, sidewinder, scorpion, falconer
  0xe0c070, 0x9a6a30, 0xc8b48a, 0xe0a030, 0xc08a30, // dust devil, antlion, mummy, sun priest, sun guard
  0xe8b030, // sun tyrant
];

export function shadowSize(type: number): 0 | 1 | 2 {
  if (!activeBestiary()) return (SHADOW_CLASSIC[type] ?? 0) as 0 | 1 | 2;
  if (isBossType(type)) return 2;
  const r = MOBS[type].radius;
  return r >= 6 ? 2 : r >= 4.2 ? 1 : 0;
}

export function bloodColor(type: number): number {
  const b = activeBestiary();
  return b ? b.looks[type]?.palette.base ?? 0x6fbf3f : KILL_CLASSIC[type] ?? 0x6fbf3f;
}

/** What an enemy carries (the weapon is baked into its sprite; the game only adds the swing trail and the nocked arrow). */
export function heldOf(type: number): HeldKind {
  const b = activeBestiary();
  if (b) return b.looks[type]?.held ?? 'none';
  switch (type) {
    case MobType.Goblin: return 'sword';
    case MobType.Orc: return 'club';
    case MobType.Archer: return 'bow';
    case MobType.Shield: return 'shield';
    default: return 'none';
  }
}
