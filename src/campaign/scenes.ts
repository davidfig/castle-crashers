// Which hub scenes are due on returning to the hub (docs/12-story.md, tier 1). A hub beat IS its scene; any other beat that
// played in a run gets an aftermath scene (tavern talk, the Registrar). At most two per visit, so the hub is not a cutscene reel.
import { BEATS } from '../data/story/beats';
import { AFTERMATH, HUB_SCENES, type Scene } from '../data/story/hub';
import { hasSeen, markBeatsSeen, pendingBeat, type Ledger } from './ledger';

export const SCENES_PER_VISIT = 2;

/** The scene for a beat that is pending in the hub. */
export function hubScene(beatId: string): Scene | undefined {
  return HUB_SCENES[beatId];
}

/** Records a scene as shown. A hub beat's scene plays the beat; an aftermath scene is remembered by id. */
export function markSceneSeen(l: Ledger, scene: Scene): Ledger {
  if (scene.kind === 'beat') return markBeatsSeen(l, [scene.beat]);
  return l.scenes.includes(scene.id) ? l : { ...l, scenes: [...l.scenes, scene.id] };
}

export function dueScenes(l: Ledger, limit = SCENES_PER_VISIT): Scene[] {
  const out: Scene[] = [];
  let cur = l;
  for (let guard = 0; out.length < limit && guard < 64; guard++) {
    const after = BEATS.find((b) => hasSeen(cur, b.id) && AFTERMATH[b.id] && !cur.scenes.includes(AFTERMATH[b.id].id));
    if (after) {
      out.push(AFTERMATH[after.id]);
      cur = markSceneSeen(cur, AFTERMATH[after.id]);
      continue;
    }
    const p = pendingBeat(cur);
    const scene = p?.tier === 'hub' ? hubScene(p.id) : undefined;
    if (!scene) break;
    out.push(scene);
    cur = markSceneSeen(cur, scene);
  }
  return out;
}
