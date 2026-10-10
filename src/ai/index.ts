// The simulated-player package: skill-parameterised pilots and a headless route runner (docs/14-ai-playtesting.md).
export { Pilot, type Plan, type StoreCtx } from './pilot';
export { SKILL_NAMES, SKILL_PRESETS, resolveSkill, skillAt, type Skill } from './skill';
export { runRoute, type HeroReport, type LevelReport, type Outcome, type PartyMember, type RunOptions, type RunReport, type StoreReport } from './runner';
export { difficultyCurve, summarize, type CurveRow, type LevelSummary, type Summary } from './report';
export { Attribution } from './attribution';
