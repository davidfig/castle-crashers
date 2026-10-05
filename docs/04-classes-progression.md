# 04 — Classes & Progression

Progression has **two layers**:

1. **In-run:** XP → levels → pick an upgrade. Items found. Resets every run.
2. **Meta:** *Renown* earned per run → spend it to unlock nodes on each class's **class tree**. Persists forever.

The link between them: meta unlocks **expand what you can be offered during a run**. They don't hand you stats directly (mostly). This keeps runs feeling fresh and keeps new players from being locked out by raw power.

## Classes (v1 target roster)

| Class | Role | Core fantasy | Signature mechanic (proposed) |
|---|---|---|---|
| **Warrior** | Frontline tank/bruiser | Hold the line | *Fury* built by cleaving, killing and being hit; spent on an AoE nova (bigger at full). *Stamina* funds swings, dashes and the big-swing special |
| **Mage** | Ranged AoE glass cannon | Elemental destruction | Mana + element attunement (fire/ice/lightning) switching |
| **Cleric** | Support/healer, light melee | Keep everyone alive | Holy *Favor* resource; healing aura, revive speed, smite |
| **Rogue** | Fast melee burst | Hit and vanish | Combo points, stealth/backstab, dodge-through |
| **Archer** | Ranged single-target/kiting | Precision from afar | Charged shots, trap placement, weak-point hits |
| *(later)* **Paladin, Druid, Necromancer, Bard** | | | See "Future classes" |

Each class defines (in `src/data/classes/`): base stats, light-attack chain, dodge/block, 2 starting abilities, resource type, sprite set, palette rows, and a class tree.

### Stats

Keep small and legible: **Vitality** (HP), **Strength** (physical dmg), **Magic** (spell dmg/heal), **Agility** (speed, crit, dodge), **Defense** (damage reduction), plus a derived **Luck** hook for drops. Classes weight stats differently; items modify them.

## In-run progression

- Kill enemies / clear rooms → XP. Level cap per run (proposed **~20**).
- Each **level-up** offers **3 choices** drawn from the pool of everything *you've unlocked in your class tree* plus generic perks. Pick one; it applies instantly.
  - **Non-blocking:** a level-up is a pending pick. The player opens it with the Level button, into their lane of the sky band at the top of the screen, when they choose; gameplay continues. Unchosen offers never expire: they wait, and are resolved at the camp between levels at the latest. See [06 UI](06-ui.md).
- Choices come in kinds:
  - **Ability unlock/upgrade** (new ability, or +rank to an existing one)
  - **Passive** (stat or trigger-based: "crits explode", "dodging leaves frost")
  - **Mutation** (changes how an ability works: pierce, bounce, split, element swap)
- Rarity-weighted offers so builds *emerge*. Synergy tags (e.g. `fire`, `projectile`, `holy`, `melee`) bias offers toward what you already have, with some chance of a wild card.
- **Ability slots:** a small number of active slots (proposed 4: 2 class + 2 free). Extra abilities go to a "bench" and can be swapped in on the fly via the near-character swap ring.

## Meta progression: Renown & class trees

### Renown

- Earned at end of every run (win or lose): from rooms cleared, bosses killed, challenges completed, distance reached, party achievements.
- **Renown belongs to a character, not the account** (Decided, ADR-0004). A **character** is a saved instance of a class: it has a name, its own renown balance, and its own class-tree progress.
- You can create **multiple characters of the same class** (e.g. two Warriors: one grown as a Guardian, one as a Berserker) to try different builds in parallel. Each progresses independently; renown never moves between characters.
- A run is played *by* characters. The party picks existing characters (or creates new ones) at the hub. Two players may bring same-class characters.
- Account-level data (codex, settings, achievements, cosmetics unlocked globally) is shared; only renown and tree progress are per character.
- Open: character slot limit, and whether a character can be retired/deleted (see [open-questions](open-questions.md)).

### Class tree

- A node graph per class (3–4 branches, ~25–40 nodes). Branches map to sub-identities, e.g. Warrior: **Guardian / Berserker / Warlord**; Mage: **Pyromancer / Cryomancer / Stormcaller**.
- Node types:
  - **Unlock:** adds abilities/mutations/passives to the in-run offer pool.
  - **Slot/Capacity:** extra bench slot, extra revive, extra starting item choice.
  - **Starting kit:** begin runs with a particular weapon or consumable.
  - **Keystone:** a build-defining rule change (rare, 1–2 per branch).
  - **Cosmetic/lore:** skins, titles, codex entries. Cheap and fun.
- Tree shape is *prerequisite-gated* (adjacent unlock), so players choose a direction.
- **Focus toggling is free** between runs: the tree is a *loadout* of what's **active**, plus a *collection* of what's **unlocked**. Unlocked nodes cost renown once; you may toggle which branches feed your offer pool (up to a "focus" cap). Because builds are explored via separate characters, there is no full respec; focus toggling is a light steering tool, not a way to undo spending.
- "Unlocks as you work through the game": some nodes are gated by **in-game achievements** (beat boss X with the class, finish a run without dodging) rather than just renown, so the tree doubles as a goals list.

### Data shape (sketch)

```ts
interface ClassTreeNode {
  id: string;
  classId: string;
  branch: string;
  kind: 'unlock' | 'capacity' | 'startingKit' | 'keystone' | 'cosmetic';
  cost: number;                 // renown
  requires: string[];           // prerequisite node ids
  achievement?: string;         // optional gating condition id
  grants: Grant[];              // ability ids, perk ids, slot counts, etc.
}
```

## Pacing targets (starting numbers)

- First run: reach level ~6–8, earn enough renown for 1–2 early nodes.
- A class's full tree: ~15–25 runs of play.
- Level-up cadence in run: roughly every 90–120 seconds early, slowing later.

## Future classes

Paladin (tank/healer hybrid), Druid (shapeshift), Necromancer (minions), Bard (party buffs). Each new class must bring a **distinct resource** and a **distinct party role** to be worth adding.
