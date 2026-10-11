# 22 — Class Trees (meta skill trees)

**Status: design draft; all six class trees are built as prototypes** (see "Built" in [trees/warrior.md](trees/warrior.md): data in `src/data/trees/`, sim in `sim/tree.ts`, `sim/treeUi.ts`, `sim/skills.ts`, the screen in `render/treeUi.ts`, the Trainer in the town). Extends the "Class tree" section of [04](04-classes-progression.md). The per-class trees are in [trees/](trees/): [warrior](trees/warrior.md), [mage](trees/mage.md), [cleric](trees/cleric.md), [rogue](trees/rogue.md), [archer](trees/archer.md), [shaman](trees/shaman.md).

## What a tree is

A tree is **not** a power ladder. Spending renown on a node does not make a character stronger on turn one; it **widens what a run can offer them**. In a run, every level-up draws 3 cards from the character's *offer pool* (`offerFor`). The pool is: generic boons + whatever the character's **active unlocked nodes** grant. So:

- A fresh character has a small, readable pool (enough to play, thin on build variety).
- Each node adds cards, a fusion, a starting kit, a capacity, or (keystones) a rule change.
- The player steers by choosing which branches they grow and which are **active** (feed the pool).

Raw stats are not sold by the tree. The only numbers a node may carry are small starting-kit or capacity bumps.

## Shape (one template for every class)

Every class tree has the same skeleton, so costs, UI and code are shared; only the contents differ.

```
                    ROOT (free, always owned)
          ┌────────────┼────────────┐
       Branch A      Branch B      Branch C
        A1  A2        B1  B2        C1  C2      tier 1  (requires ROOT)
        A3  A4        B3  B4        C3  C4      tier 2  (A3 needs A1, A4 needs A2)
          A5            B5            C5        tier 3  (needs 3 and 4) capacity / starting kit
          A6            B6            C6        KEYSTONE (needs 5 + an achievement)
   bridge AB (needs A3 + B3)   bridge BC (B3 + C3)   bridge AC (A3 + C3)     tier 3
   2 cosmetic/lore nodes per class (cheap)
```

That is 1 root + 18 branch nodes + 3 bridges + 2 cosmetic = **24 nodes** per class.

| Tier | Where | Renown | Typically |
|---|---|---|---|
| 1 | A1/A2/B1/B2/C1/C2 | 15 | a boon or a track family joins the pool |
| 2 | 3/4 | 30 | a stronger boon, a fusion, an ability's tracks |
| 3 | 5 and bridges | 60 | capacity or starting kit; a bridge opens a cross-branch boon |
| Keystone | 6 | 150 | one rule change; **achievement-gated** |
| Cosmetic | — | 10 | skin, title, codex page |

Full tree ≈ 1,200 renown. At ~60 renown a run (`renownFor`) that is about 20 runs, matching the 15–25 target in [04](04-classes-progression.md). Costs are starting numbers.

### Node kinds and what they may do

| Kind | May grant | May not |
|---|---|---|
| `unlock` | boon ids, track families, fusions, a class ability variant to the pool | stats |
| `capacity` | +1 bench slot, +1 extra revive per run, +1 starting card choice, +1 reroll | anything that scales with level |
| `startingKit` | begin each run with one rank of a boon, a consumable, gold, or a resource topped up | more than ~one rank of anything |
| `keystone` | one rule change (listed per class) | stacking with another keystone |
| `cosmetic` | skin, title, codex entry | anything mechanical |

### Rules

1. **Focus cap: two of three branches active.** All owned nodes stay owned, but only the nodes in the two chosen branches (plus the root and bridges between active branches) feed the pool. Toggling is free between runs ([04](04-classes-progression.md)). This stops a finished tree from diluting every offer into mush, and makes finishing the third branch about breadth for the next character, not a power bump.
2. **One keystone active at a time**, whichever branch it sits in. Owning all three is fine; choosing is the point.
3. **Achievement gates are on keystones** (and optionally one tier-2 per class). They double as a goals list; each is something the class does *with its own kit* (so the tree teaches the class). Renown alone never buys a keystone.
4. **Grants live in the tree, not on the boon.** A class's pool is its base pool (stat boons and basic-swing tracks) plus the grants of its *active* nodes. A boon with no `classes` field (Executioner, Blood Tithe, Chain Spark...) may be granted by several classes' trees; a class-restricted boon can only be granted by its own.
5. **Fusions** (`evolve`) are unlocked by the node that grants the *second* of their two parents, so you cannot be offered a fusion whose parents you cannot get.
6. **Legendaries are keystone rewards,** not one shared `legend` node: Glass Fang, Phoenix and Frenzy each move to a keystone that fits them (see the trees). The upgrade field `unlock: 'legend'` becomes the owning keystone's node id.
7. **A solo character must be able to use every non-party node;** party-only boons (`needsParty`) still show but are dropped from solo offers (existing behaviour).
8. **A fresh character's pool** (root only) must hold at least ~12 distinct cards so levels 1–5 do not repeat. The root's grant is chosen with that in mind.
9. **Every node has a status** in the class docs: `✓` the boon/track already exists and needs only gating, `◐` a small tweak to something that exists, `＋` new content. A tree can ship with only `✓` and `◐` nodes live and `＋` nodes locked as "coming".
10. **Every class sells replacement skills.** A class has four *slots*, one per button (Swing, Big Swing, Nova, Dodge; the shaman's are its direct totem buttons), and a `SKILL` node grants a skill that *replaces* the class's skill in one slot while equipped; the loadout holds one per slot, equipped at the town or a camp. A skill brings its own four tracks (size, count, speed, power) and is mostly *data*: fields of the class's definition it overrides (`data/skills.ts`). Each branch hands out two skills (nodes 3 and 5, different slots), a deliberate departure from the template's node-5 capacity/kit slot. All six are built: [warrior](trees/warrior.md), [mage](trees/mage.md), [cleric](trees/cleric.md), [rogue](trees/rogue.md), [archer](trees/archer.md), [shaman](trees/shaman.md). Each class's tree is its own save (`RoadState.trees`, one per class).

## Data

`ClassTreeNode` as sketched in [04](04-classes-progression.md), with two additions:

```ts
interface ClassTreeNode {
  id: string;            // 'w-g1', 'm-bridge-pc' ... also the value of Upgrade.unlock
  classId: number;
  branch: 'a' | 'b' | 'c' | 'root' | 'bridge';
  tier: 1 | 2 | 3 | 4;   // 4 = keystone
  kind: 'unlock' | 'capacity' | 'startingKit' | 'keystone' | 'cosmetic';
  requires: string[];
  achievement?: string;
  grants: { boons?: string[]; fusions?: string[]; kit?: KitGrant; capacity?: CapGrant; rule?: string };
}
```

- Boons: the tree holds the grants. `offerFor` takes the character's resolved pool (base + grants of **active** nodes) in place of today's `ctx.unlocked` node-id filter, and `Upgrade.unlock` is retired (the legendaries' `unlock: 'legend'` becomes a keystone grant).
- Per-character profile: `{ owned: string[], activeBranches: [a,b], keystone?: string }` (versioned, in `campaign/profile.ts`).
- Where it is spent: a trainer in the town ([21](21-the-road.md)); the tree is drawn per player panel there.
- Tests: `tree.test.ts` checks the template (every class has 24 nodes, requires are acyclic, every class boon is granted by exactly one node, every fusion's parents are reachable), plus `offerFor` honours the active set.

## Open questions

- Is the 2-of-3 focus cap right, or should it be all-active with a higher pool-dilution tolerance?
- Do bridges need both branches *active*, or only owned?
- Do achievement gates carry across same-class characters (account-level "seen it done") or must each character earn them?
- Should a character's first keystone be cheaper to avoid a long dead stretch in the middle of the tree?
