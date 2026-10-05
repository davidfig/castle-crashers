# 05 — Items & Trading

Items are found randomly in the world, picked up, equipped, consumed, and — a core pillar — **passed between players**.

## Item model

```ts
interface ItemDef {
  id: string;
  kind: 'weapon' | 'armor' | 'trinket' | 'consumable' | 'relic' | 'material';
  slot?: 'mainhand' | 'offhand' | 'body' | 'trinket';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  tags: string[];                // synergy tags: 'fire', 'projectile', ...
  classAffinity?: string[];      // soft hint, never a hard lock
  baseMods: StatMod[];
  affixPool?: string[];          // random modifiers rolled at drop
  onEquip?: string;              // named effect/trigger ids
  sprite: string;
}

interface ItemInstance {          // what actually exists in the world
  uid: number;                    // deterministic, sim-assigned
  defId: string;
  rolledAffixes: AffixRoll[];
  level: number;                  // drop depth
}
```

- **Rarity** affects affix count, power band, and drop weight; color-coded and also shape/glow-coded (accessibility).
- **Affixes** are rolled from the sim's loot RNG stream when the item spawns, so everything is seed-reproducible.
- **Classes don't hard-lock items.** A mage can wield a sword if she wants; she just won't get its tag synergies. Hints (a small icon) show when an item suits someone nearby.

## Equipment slots (proposed)

Main hand, off-hand (shield/focus/quiver), body, trinket ×2. Small enough to swap quickly, big enough to build around. Relics are run-long passive items with no slot.

## Consumables

Potions, scrolls, bombs, food. Held in a small belt (3 slots) with a "ready" item used by the Quick-use button.

## Sources

- Enemy drops (weighted by enemy type/elite status)
- Breakables and chests (some trapped or mimic)
- Room rewards / challenge rooms
- Merchants (spend shared gold)
- Boss guaranteed drops
- Shrines/forges (risk-reward: sacrifice, reroll, upgrade)

Drop tables are data + modifiers (party Luck, depth, room theme). Pity timers prevent long dry spells.

## Coins (first loot, implemented)

- Kills can drop a **coin** that arcs out of the body, bounces, and spins. Drop chance and value are per enemy in `src/data/mobs.ts` (goblins ~50% for 1; orcs always 3-6; shield bearers 2-4; archers ~70% for 1-3; bombers none). Big coins (value 3+) draw larger.
- **Magnet:** once landed, coins within ~34 px are pulled toward the nearest standing hero, faster the closer they get, and collected on touch. You vacuum loot while fighting without stopping to walk over it.
- **Shared gold.** One purse for the party (docs: gold is shared), with a per-hero total for stats. The HUD shows the gold count and pops on pickup.
- **Bounded cost.** At most 500 coin entities on the field; past that, drops go straight into the purse. Coins **never expire** while on screen; they are only lost once they fall behind the left edge. Each coin **twinkles** on its own cycle (a bright four-point glint) so loot stands out from corpses. Cleared ground stays cleared.
- **The merchant (v0, placeholder):** there are no items yet, so the camp's merchant sells what the game can already give a hero: upgrade scrolls and a level (`src/data/wares.ts`, `src/sim/shop.ts`). Shared gold, one of each good, everyone shopping at once. When items exist the wares become items.
- Everything else in this doc (equipment, trading, affixes) is still design only.

## Pickup & drop

- Items spawn as world entities with a small arc and a rarity glow beam.
- **Walk over** consumables/gold (auto-pickup). **Interact** to pick up equipment so you don't accidentally replace gear in the heat of battle.
- When a character stands near an item, a **compact comparison tag** floats near them (stat diffs with up/down arrows). It does not block. See [06 UI](06-ui.md).
- Picking up gear into an occupied slot: new item is equipped and the old item **drops at your feet** (and is available to teammates). No inventory screen to manage.
- A small **backpack** (say 4 slots) holds spare items for hand-offs and quick swaps.

## Trading between players (non-blocking)

Goals: fast, in-the-moment, no menus, hard to grief.

**Mechanics:**
1. **Drop:** Hold Swap to open your swap ring, choose an item, release to drop it at your feet. It's now a world item with a "recently dropped by P1" mark.
2. **Throw/Pass:** Aim in a direction and tap Interact to **toss** a held/bench item toward an ally; it lands near them with a short **claim window** (≈3 s) where only the intended player (nearest to landing point) can pick it up. After the window it becomes free-for-all.
3. **Hand-over:** Stand next to an ally, hold Interact on the item in your ring while facing them: it flies into their backpack if there's room, otherwise drops at their feet. The recipient sees a short "P1 gives you *Frost Brand*" toast over their head with **Accept** (default, just keep playing) / **Return** (press Interact) — acceptance is implicit by *not* declining, so nobody is ever stuck waiting.
4. **Requests (ping):** A player can **ping** a slot type (e.g. "need a weapon") — a small icon shows over their head so teammates know what to hand over. Optional but very co-op friendly.

**Rules:**
- Trading never pauses the game and has no confirmation windows.
- **Bound items:** some relics/keystones are *soulbound* (can't be traded) to prevent a single player hoarding best-in-slot.
- **Loot ownership modes** (run modifier): *Free-for-all* (default), *Round-robin* (rare drops are claimed in rotation), *Need/Greed-lite* (rare+ items show a brief "contested" ring; first Interact wins; ties broken by lowest recent-loot count).
- Gold is **shared**; it's not tradable.

## Codex

Every item discovered is recorded in the profile's codex (meta). Discovery can feed renown and unlocks item *appearance* in future drop pools (optional "unlock by discovering" system).

## Balance guard rails

- Item power should be **more about changing how you play** than raw +damage. Aim for items that create or enable builds (e.g. "projectiles pierce but deal 20% less", "every 3rd hit casts your ability 1").
- Cap stacking multipliers; prefer additive within category, multiplicative across categories.
- Every item has a short, readable one-line effect (it must fit on a floating tag).
