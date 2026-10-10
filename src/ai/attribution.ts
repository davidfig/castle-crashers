// Who hurt the hero? The sim records how much (the hero's health), not who, so the runner works it out from what changed this tick:
//   - a mob whose attack timer was just reset has just swung (melee, a boss smash)
//   - an enemy projectile that was in flight last tick and has gone, near the hero, hit them; the shooter was the mob nearest where it was thrown from
//   - a mob whose wind-up finished this tick and who is near the hero cast a special (nova, beam, gust, a slam)
//   - a zone under the hero (or a rock that has just landed on them) is the hazard
// Best effort, but each kind of damage lands under its own name, which is what a balance pass needs ("harpooner 30, zone:frost 12").
import { Behavior, MOBS, ProjStyle } from '../data/mobs';
import { Kind, ZoneKind } from '../sim/entities';
import { SP_WIND } from '../sim/abilities';
import type { GameState } from '../sim/state';

const ZONE_NAMES: Record<number, string> = {
  [ZoneKind.Rock]: 'rock', [ZoneKind.Poison]: 'poison', [ZoneKind.Frost]: 'frost', [ZoneKind.Trap]: 'trap', [ZoneKind.Storm]: 'storm',
  [ZoneKind.Rain]: 'rain', [ZoneKind.Pit]: 'pit', [ZoneKind.Mud]: 'mud', [ZoneKind.Spore]: 'spore',
};
const STYLE_NAMES: Record<number, string> = {
  [ProjStyle.Arrow]: 'arrow', [ProjStyle.Bone]: 'bone', [ProjStyle.Harpoon]: 'harpoon', [ProjStyle.Shard]: 'shard',
  [ProjStyle.Glob]: 'glob', [ProjStyle.Fire]: 'fire', [ProjStyle.Falcon]: 'falcon',
};

interface Shot { x: number; y: number; vx: number; vy: number; name: string }
interface Wind { x: number; y: number; name: string; mode: number; wind: number }

export class Attribution {
  private shots = new Map<number, Shot>();
  private winding = new Map<number, Wind>();
  private rocks = new Map<number, { x: number; y: number }>();
  /** The tick a greed shrine took its toll (the runner sees the event). */
  greedTick = -1;

  /** Name the likeliest cause of damage to a hero standing at (hx, hy), from the state after the tick and the snapshot of the tick before. */
  explain(s: GameState, slot: number, dmg = 99): string {
    const e = s.ents;
    const pl = s.players[slot];
    const hx = e.x[pl.ent], hy = e.y[pl.ent];
    // the greed shrine's price in blood, and the slow ticks of poison, fire and chill
    if (this.greedTick === s.tick) return 'greed shrine';
    if (dmg <= 1.6) {
      if (pl.poisonT > 0) return pl.burning ? 'burning' : 'poison';
      for (let i = 0; i < e.highWater; i++) {
        if (!e.alive[i] || e.kind[i] !== Kind.Mob) continue;
        const def = MOBS[e.sub[i]];
        const r = def.aura?.radius ?? def.flame?.radius ?? 0;
        if (r === 0) continue;
        const dx = e.x[i] - hx, dy = (e.y[i] - hy) * 1.3;
        if (dx * dx + dy * dy <= r * r) return `${def.aura ? 'chill' : 'flame'}:${def.name}`;
      }
    }
    // 1. a swing that has just landed
    let best = '', bestD = Infinity;
    for (let i = 0; i < e.highWater; i++) {
      if (!e.alive[i] || e.kind[i] !== Kind.Mob) continue;
      const def = MOBS[e.sub[i]];
      if (def.atkCooldown === 0 || e.atk[i] !== def.atkCooldown) continue;
      const dx = e.x[i] - hx, dy = e.y[i] - hy;
      const d = dx * dx + dy * dy;
      const reach = def.reach + def.radius + 30;
      if (d < reach * reach && d < bestD) { bestD = d; best = def.name; }
    }
    if (best) return best;
    // 2. a projectile that vanished where the hero stands
    for (const [id, sh] of this.shots) {
      const alive = e.alive[id] === 1 && e.kind[id] === Kind.Proj && e.sub[id] === 0;
      if (alive) continue;
      const dx = sh.x + sh.vx - hx, dy = sh.y + sh.vy - hy;
      if (dx * dx + dy * dy < 14 * 14) return `${sh.name}`;
    }
    // 3. a special that has just gone off close by (its wind-up was running last tick and has ended), or a charge in progress
    let sp = '', spD = Infinity;
    for (const [id, w] of this.winding) {
      if (e.alive[id] !== 1 || e.kind[id] !== Kind.Mob) continue;
      if (w.mode === 0 || e.mode[id] === w.mode) continue; // a plain wind-up is the swing of step 1; still winding is not yet
      const dx = w.x - hx, dy = w.y - hy;
      const d = dx * dx + dy * dy;
      if (d < 200 * 200 && d < spD) { spD = d; sp = w.name; }
    }
    for (let i = 0; i < e.highWater; i++) {
      if (!e.alive[i] || e.kind[i] !== Kind.Mob || e.mode[i] !== 2) continue;
      const dx = e.x[i] - hx, dy = e.y[i] - hy;
      if (dx * dx + dy * dy < 48 * 48) return `${MOBS[e.sub[i]].name}`;
    }
    // 4. a hazard on the ground (a rock that has just come down, or a pool the hero stands in)
    for (const [id, r] of this.rocks) {
      if (e.alive[id] === 1 && e.kind[id] === Kind.Zone) continue;
      const dx = r.x - hx, dy = r.y - hy;
      if (dx * dx + dy * dy < 50 * 50) return 'zone:rock';
    }
    for (let i = 0; i < e.highWater; i++) {
      if (!e.alive[i] || e.kind[i] !== Kind.Zone || e.sub[i] === ZoneKind.Rain || e.sub[i] === ZoneKind.Mud) continue;
      const dx = e.x[i] - hx, dy = (e.y[i] - hy) * 1.3;
      if (dx * dx + dy * dy <= (e.rem[i] + 6) * (e.rem[i] + 6)) return `zone:${ZONE_NAMES[e.sub[i]] ?? e.sub[i]}`;
    }
    if (sp) return sp;
    for (let i = 0; i < e.highWater; i++) {
      if (!e.alive[i] || e.kind[i] !== Kind.Mob) continue;
      const def = MOBS[e.sub[i]];
      if (def.behavior !== Behavior.Boss) continue;
      const dx = e.x[i] - hx, dy = e.y[i] - hy;
      if (dx * dx + dy * dy < 160 * 160) return def.name;
    }
    return 'other';
  }

  /** Remember the tick just played, for explaining the next one. */
  snapshot(s: GameState): void {
    const e = s.ents;
    const next = new Map<number, Shot>();
    this.winding.clear();
    this.rocks.clear();
    for (let i = 0; i < e.highWater; i++) {
      if (!e.alive[i]) continue;
      switch (e.kind[i]) {
        case Kind.Proj: {
          if (e.sub[i] !== 0) break;
          const old = this.shots.get(i);
          // a slot reused for a new arrow shows as a jump; a fresh shot is named after the mob nearest where it was thrown from
          if (old && Math.abs(old.x + old.vx - e.x[i]) < 3 && Math.abs(old.y + old.vy - e.y[i]) < 3) { old.x = e.x[i]; old.y = e.y[i]; old.vx = e.vx[i]; old.vy = e.vy[i]; next.set(i, old); }
          else next.set(i, { x: e.x[i], y: e.y[i], vx: e.vx[i], vy: e.vy[i], name: this.shooterOf(s, e.ax[i], e.ay[i], e.mode[i]) });
          break;
        }
        case Kind.Mob:
          if (e.mode[i] === SP_WIND || e.wind[i] > 0 || (MOBS[e.sub[i]].behavior === Behavior.Boss && e.mode[i] !== 0)) {
            this.winding.set(i, { x: e.x[i], y: e.y[i], name: MOBS[e.sub[i]].name, mode: e.mode[i], wind: e.wind[i] });
          }
          break;
        case Kind.Zone:
          if (e.sub[i] === ZoneKind.Rock && e.mode[i] === 0) this.rocks.set(i, { x: e.x[i], y: e.y[i] });
          break;
      }
    }
    this.shots = next;
  }

  private shooterOf(s: GameState, ox: number, oy: number, style: number): string {
    const e = s.ents;
    let best = '', bestD = 16 * 16;
    for (let i = 0; i < e.highWater; i++) {
      if (!e.alive[i] || e.kind[i] !== Kind.Mob) continue;
      const dx = e.x[i] - ox, dy = e.y[i] - oy;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = MOBS[e.sub[i]].name; }
    }
    return best || STYLE_NAMES[style] || 'shot';
  }
}
