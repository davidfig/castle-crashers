// The midpoint scene (docs/12-story.md, Chapter III, beat R5 "The quotas"): the party comes upon a place the Crown's other hunters have
// already been through. The gore is drawn in the cartoon style (render/roadGore.ts); the hunters are alive, go about their work, cannot be
// attacked, and say the quotas out loud. It is told once, as `lines`, and is skippable like every road scene: nothing pauses, and a party
// that walks past does not hear it. The sim stages it in the first scene slot of the chapter's region when the road is made with
// `midpoint` (sim/gen/road.ts). The story font draws plain ASCII only.
import type { RoadScene } from './road';

/** The chapter whose region holds the scene. */
export const MIDPOINT_CHAPTER = 3;

export const MIDPOINT_SCENE: RoadScene = {
  id: 'r5',
  chapter: MIDPOINT_CHAPTER,
  level: 0,
  once: true,
  cast: [
    { npc: 'captain', dx: -20, dy: 6, face: 1 },
    { npc: 'registrar', dx: 30, dy: -4, face: -1 },
    { npc: 'peddler', dx: 74, dy: 12, face: -1 },
  ],
  lines: [
    { who: 0, text: 'Well met, colleagues! Lovely morning. Mind the puddles, they are not water.' },
    { who: 1, text: 'Mark the cooks as combatants. A ladle is a weapon, if you squint.' },
    { who: 2, text: 'Pelts, pots, little shoes. Three coppers a sack, no questions, no returns.' },
    { who: 0, text: 'We were sent here before the trouble began. Funny order, but the Crown knows best.' },
    { who: 1, text: 'See here: the quota for this valley is stamped the winter before anyone saw a goblin.' },
    { who: 2, text: 'Dated before the trouble! Same as the last six valleys. Someone plans very well.' },
    { who: 0, text: 'Do not look so grim. It is a fine bounty. They have all stopped complaining.' },
    { who: 1, text: 'Initial here, here and here. Per head, friends?' },
  ],
  variants: [],
};
