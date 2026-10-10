# 16 — Skills and Elements

A **skill** is a *delivery* (how it reaches you) made of an *element* (what it is made of, which decides what it does when it lands), tuned by a handful of
*modifiers* (how many, laid out how, what shape, whether it pierces, bursts, homes or leaves a pool). Every monster's special moves, shots, hits, auras and
death effects are built this way, so the same ten elements and twenty-odd deliveries make hundreds of different moves, and a run's monsters (docs/15) read
as sets: an ice monster chills in melee, fires frost and freezes the ground, and the odd flaming one with a lightning bolt is the surprise.

The skill is **plain data** (`Special`, `ShotDef`, `onHit`, `elemAura`, `DeathDef` in `data/mobs.ts`) and what it *does* is resolved in the sim from the element
(`sim/elements.ts`). Nothing in the data or the element table knows who casts it. Today the casters are monsters and the victims are heroes; the hero skill
tree to come will reuse the same data and element table with a hero as caster and monsters as victims (see "Toward hero skills").

## Elements (`data/elements.ts`, effects in `sim/elements.ts`)

| element | on a hit | a pulse (pool, aura) | colours / look |
|---|---|---|---|
| physical | a plain blow | none | grey |
| fire | **burns**: damage over time until it burns out | a short re-ignite | orange, embers |
| ice | **chills** (slows); a chilled hero hit again is **frozen** solid briefly | slows | pale blue, shards |
| lightning | **jumps** to up to two other heroes within 90 px (60% damage, arcs drawn) and shocks stamina regeneration | a small zap to a neighbour | yellow-white, arcs |
| poison | a long **poison** bleed | poison | green, bubbles |
| shadow | **silences**: no ability buttons | drains stamina regen | violet, wisps |
| holy | **blinds**: a brief stun | a flash of silence | gold, light |
| earth | **roots** the hero and shoves them | slows | brown, rock |
| wind | **blows** the hero away and scrambles their controls | a push | pale teal, swirls |
| arcane | **hexes**: half again as much damage taken | hex | magenta, runes |
| blood | makes the hero **bleed** and heals the monster that struck | bleed | crimson |

`power` (default 1) scales how long/strong the effect is. A dodge-roll slips a hit and its element; damage-over-time pulses ignore it, as always.

## Deliveries (`Special.kind`)

Existing: **lob** (a delayed strike where you stood), **trap** (a mine), **storm** (a gathering zone that settles into a pool), **pit** (a vortex that pulls),
**nova** (a burst round the caster), **beam** (a locked ray), **leap**/**pounce** (a bound onto you), **gust**, **whiteout**, **wail**, **lure**, **hex**, **dazzle**,
**cling**, plus the non-damaging **summon**, **heal**, **rally**, **ward**, **blink**.
New: **bolt** (aimed projectile fan; the aim locks when the telegraph starts), **ring** (projectiles flung out all round), **cone** (a breath: an instant wedge), **totem**
(a turret that fires at you for a while, then crumbles).

## Modifiers (the "variables")

- **count + pattern** (lob, trap, storm, pit): `Pattern.Scatter` random spots; `Line` along the caster-to-hero line; `Wall` across your path; `Ring` round you with none on you
  (standing still is safe); `Cross`; `Spiral` winding out, later and later; `March` a line of strikes walking from the caster to you.
- **residue** (lob): each strike leaves a pool of its element.
- **projectiles** (bolt, ring, totem, shots): shape (`Orb`, `Spike`, `Comet`, `Mote`), speed, count and spread, **pierce** (hits each hero once and goes on), **splash** (bursts on impact), **homing**.
- **on-hit element** (`MobDef.onHit`), **element aura** (`elemAura`), **death effects** (`DeathDef.blast`, element pool, element shards).
- ranges, windups, cooldowns, radii, damage and `power`, all drawn per monster and scaled by how late in its biome the monster comes.

## Where the data lives in the sim

An element rides on zones and mob projectiles in unused fields (`sim/entities.ts`): `flags & ELEM_MASK` = element id, `elite` = power x 10; for a projectile `flags & 32` pierces,
`flags & 128` homes, `wind` = splash radius. Events carry the element so the renderer can colour them: `Ev.Burst` style 32 + element, `Ev.Beam` d, `Ev.Cone`, `Ev.Arc` (lightning chain).
`strikeHero` (hit + element), `pulseHero` (pool/aura bite) and `elementHit`/`elementPulse` are the entry points.

## Generator (`data/bestiary/*`)

- Every skill and every elemental rider/aura/death/shot is a **trait instance per element** (`traits.ts`: `lob:fire`, `elemhit:ice`, `blast:poison`, `comet:lightning`...).
- A monster picks an **element it leans on** (the biome's own elements are favoured, plain ones exist) and sometimes a second; traits made of those are ~6x / 2.4x likelier,
  so its powers read as a set (`affinity`). Crowd filler leans plain and weak (`power` 0.6).
- The biome never repeats a trait id, so `lob:fire` and `lob:ice` may share a biome but never two `lob:fire`.
- Colours, eyes and motifs follow the element; names take the element's words (`cinder hound`, `rime brute`).
- Bosses pick a primary element; each of their four skills is made of it 72% of the time, else another element of the biome.

## Adding things

- **An element**: add it to `Element`/`ELEMENTS` (data/elements.ts, append only), give it a case in `elementHit`/`elementPulse` (sim/elements.ts), its look in the renderer (render/elementFx.ts),
  and it appears in generated casts on its own.
- **A delivery**: a `Special` kind in data/mobs.ts, its `startSpecialOf`/`fireSpecialOf` cases in sim/abilities.ts (apply the element with `strikeHero`), its factories in
  data/bestiary/specials.ts, a `SKILL_RULES` row in traits.ts, its telegraph in the renderer.
- **A modifier**: a field on the delivery's type, handled where it fires, rolled in `specials.ts`.

## Toward hero skills

The skill tree for heroes can reuse all of this: `Special`/`ShotDef` data, the element table and the `elementHit` effects. What is missing is the *victim* side for monsters
(a mob has no slow/root/burn status today: `elementHit` is written against heroes) and a caster path in `abilities.ts` that fires a skill from a hero at mobs. The element
effects are deliberately in one file (`sim/elements.ts`) so adding the monster-victim half is local.
