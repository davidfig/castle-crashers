// What the board, the hub scenes and the run summary say, as plain data the renderer draws. No drawing here.
import { BEAT_BY_ID } from '../data/story/beats';
import { chapterDef, FINAL_CHAPTER } from '../data/story/chapters';
import { writLines, type Writ } from '../data/story/writs';
import { boardGreeting, cityMood, CLASS_ORDER, registrarRemark, type Backdrop, type ClassName, type Scene } from '../data/story/hub';
import { CLASSES } from '../data/classes';
import { storySafe } from '../data/storyFont';
import { biomeIndex } from '../data/roster';
import type { RunConfig } from './board';
import type { Ledger } from './ledger';
import type { RunSummary } from './summary';

export type Tone = 'normal' | 'dim' | 'gold' | 'red';
export interface Line { text: string; tone: Tone }
/** `biome` indexes the renderer's biome list: the card shows a picture of the place the writ sends the party. */
export interface Card { title: string; lines: string[]; tag?: string; biome: number }

export interface SelectSlot { joined: boolean; ready: boolean; classId: number; name: string; blurb: string[]; hp: number; speed: number }

/** A card in a player's panel at the camp. */
export interface PickCard { name: string; text: string[]; rank: number; icon: string }
/** One player's panel at the camp: their pending picks, one card each for the level being chosen. */
export interface PickLane { active: boolean; slot: number; name: string; level: number; pending: number; ready: boolean; cursor: number; cards: PickCard[] }
/** A story figure standing beside the text, and whether they are speaking (their talk loop) or listening (idle). */
export interface Figure { name: 'registrar' | 'peddler'; talking: boolean }
export interface DoorView { biome: number; label: string; tag: string; icon: string }
/** A row in the merchant's stock. */
export interface ShopRow { name: string; text: string[]; price: number; sold: boolean; afford: boolean; icon: string }
export interface ShopSeat { active: boolean; slot: number; name: string; ready: boolean; cursor: number }

export type Screen =
  | { kind: 'shop'; header: string; sub: string; gold: number; rows: ShopRow[]; seats: ShopSeat[]; note: string; footer: string; figure: Figure }
  | { kind: 'picks'; header: string; sub: string; lanes: PickLane[]; footer: string }
  | { kind: 'doors'; header: string; sub: string; doors: DoorView[]; sel: number; footer: string }
  | { kind: 'select'; header: string; sub: string; biome: number; slots: SelectSlot[]; footer: string }
  | { kind: 'board'; header: string; sub: string; mood: string; cards: Card[]; sel: number; footer: string }
  | { kind: 'title' }
  | { kind: 'text'; header: string; body: Line[]; footer: string; figure?: Figure }
  | { kind: 'scene'; header: string; backdrop: Backdrop; lines: Line[]; speaker: 'narrator' | 'registrar' | 'party'; voices: ClassName[]; party: string[]; page: number; pages: number; footer: string };

/** The bitmap font has 0-9, A-Z and : . - / ! + ? only. */
export function fontSafe(text: string): string {
  return text.toUpperCase().replace(/%/g, ' PCT').replace(/[',"();]/g, '').replace(/\s+/g, ' ').trim();
}
/** A line of a read-it page: mixed case and punctuation, in the story font. */
const ln = (text: string, tone: Tone = 'normal'): Line => ({ text: storySafe(text), tone });

/** Greedy word wrap. */
export function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    if (cur && cur.length + 1 + w.length > width) { out.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
export function chapterHeader(chapter: number): string {
  if (chapter > FINAL_CHAPTER) return 'THE CAMPAIGN IS COMPLETE';
  return fontSafe(`Chapter ${ROMAN[chapter - 1]}  ${chapterDef(chapter).name}`);
}

export const CARD_WIDTH_CHARS = 44;

export function boardScreen(l: Ledger, writs: readonly Writ[], sel: number, saveNote?: string): Screen {
  return {
    kind: 'board',
    header: chapterHeader(l.chapter),
    sub: storySafe(boardGreeting(l.campaignSeed ^ Math.imul(l.runs + 1, 0x9e3779b1), l.chapter)),
    mood: storySafe(cityMood(l.chapter, Object.values(l.spared).reduce((a, b) => a + b, 0), Object.values(l.slain).reduce((a, b) => a + b, 0))),
    sel,
    cards: writs.map((w) => ({
      title: storySafe(w.title),
      tag: w.milestone ? 'MILESTONE' : undefined,
      biome: biomeIndex(w.seed),
      lines: writLines(w).slice(1).map(storySafe),
    })),
    footer: fontSafe(saveNote ?? 'LEFT/RIGHT CHOOSE    ATTACK ACCEPT'),
  };
}

/** Characters per wrapped line on a page (the story font advances about 5-6 px a character, the page is about 540 px wide). */
const WHO_WIDTH = 84;
/** Narrower when a figure stands beside the text. */
const FIG_WIDTH = 66;

/** The class voices in a party that have something to say in a scene line: party order first, then the usual order, at most two. */
export function speakers(says: Partial<Record<ClassName, string>>, party: readonly string[]): ClassName[] {
  const have = (c: string): c is ClassName => c in says;
  const out: ClassName[] = [];
  for (const c of party) if (have(c) && !out.includes(c)) out.push(c);
  for (const c of CLASS_ORDER) if (have(c) && !out.includes(c)) out.push(c);
  return out.slice(0, 2);
}

/** Characters per wrapped line in a scene's text panel. */
const PANEL_WIDTH = 88;

/** One beat of a scene: a narrator line, the Registrar's, or the party's voices (up to two). Pressing attack moves to the next. */
export interface ScenePage { speaker: 'narrator' | 'registrar' | 'party'; lines: Line[]; voices: ClassName[] }

export function scenePages(scene: Scene, party: readonly string[] = []): ScenePage[] {
  return scene.lines.map((l): ScenePage => {
    const lines: Line[] = [];
    const emit = (prefix: string, text: string, tone: Tone) => wrap(storySafe(`${prefix}${text}`), PANEL_WIDTH).forEach((t) => lines.push({ text: t, tone }));
    if (l.who === 'narrator') { emit('', l.text!, 'dim'); return { speaker: 'narrator', lines, voices: [] }; }
    if (l.who === 'registrar') { emit('Registrar: ', l.text!, 'gold'); return { speaker: 'registrar', lines, voices: [] }; }
    const voices = speakers(l.says!, party);
    for (const c of voices) emit(`${c[0].toUpperCase()}${c.slice(1)}: `, l.says![c]!, 'normal');
    return { speaker: 'party', lines, voices };
  });
}

/** A hub scene as a screen: the place it happens, the beat on `page`, and who is standing there. */
export function sceneScreen(scene: Scene, party: readonly string[] = [], page = 0): Screen {
  const pages = scenePages(scene, party);
  const p = pages[Math.max(0, Math.min(page, pages.length - 1))];
  const stand = party.length > 0 ? [...party] : ['warrior', 'cleric'];
  return {
    kind: 'scene', header: fontSafe(scene.title), backdrop: scene.backdrop, lines: p.lines, speaker: p.speaker, voices: p.voices,
    party: stand.slice(0, 2), page, pages: pages.length, footer: page + 1 >= pages.length ? 'ATTACK TO FINISH' : 'ATTACK TO CONTINUE',
  };
}

/** What the party learns about the people it fought, by chapter: nothing in I, the name in II, the whole of it from III. */
export function epitaph(w: Writ): string[] {
  if (w.chapter <= 1) return [];
  const c = w.clan;
  if (w.chapter === 2) return [c.name];
  return [c.name, `${c.trade}. led by ${c.leader.name}`, c.grievance];
}

export function summaryScreen(sum: RunSummary, cfg: RunConfig, before: Ledger, after: Ledger, gold: number): Screen {
  const w = cfg.writ;
  const lex = chapterDef(w.chapter).lexicon;
  const heads = Object.values(sum.slain).reduce((a, b) => a + b, 0);
  const header = sum.outcome === 'won' ? 'BATTLE WON' : sum.outcome === 'retreat' ? 'RETREAT' : 'ROUTED';
  const body: Line[] = [
    ln(w.title, 'dim'),
    ln(`${lex.tally}: ${heads}`, 'gold'),
    ln(`${lex.noun} asked: ${w.quota}`, 'dim'),
    ln(Object.keys(sum.slain).map((k) => `${k} ${sum.slain[k]}`).join('   ') || 'Nothing slain.', 'dim'),
    ln(`Gold: ${gold}`),
  ];
  const spared = Object.values(sum.spared).reduce((a, b) => a + b, 0);
  if (spared > 0) body.push(ln(`Spared: ${spared}`, 'gold'));
  if (sum.betrayed > 0) body.push(ln(`${sum.betrayed} had surrendered. They were killed anyway.`, 'red'));
  if (sum.offLedger) {
    body.push(ln(''), ln('Off the ledger. This run does not count.', 'dim'));
  } else {
    const epi = sum.outcome === 'won' ? epitaph(w) : [];
    if (epi.length) { body.push(ln('')); for (const e of epi) for (const t of wrap(storySafe(e), FIG_WIDTH)) body.push({ text: t, tone: 'red' }); }
    const played = after.beatsSeen.filter((id) => !before.beatsSeen.includes(id));
    for (const id of played) {
      const b = BEAT_BY_ID[id];
      if (!b) continue;
      body.push(ln(''), ln(`Story: ${b.title}`, 'gold'));
      for (const t of wrap(storySafe(b.summary), FIG_WIDTH)) body.push({ text: t, tone: 'normal' });
    }
    body.push(ln(''));
    for (const t of registrarRemark(after.campaignSeed ^ Math.imul(after.runs + 7, 0x85ebca6b), { chapter: w.chapter, outcome: sum.outcome, spared, betrayed: sum.betrayed })) {
      for (const l of wrap(storySafe(`Registrar: ${t}`), FIG_WIDTH)) body.push({ text: l, tone: 'gold' });
    }
    if (after.chapter > before.chapter) {
      body.push(ln(''), ln(after.chapter > FINAL_CHAPTER ? 'The campaign is complete.' : `Chapter ${ROMAN[after.chapter - 1]} begins: ${chapterDef(after.chapter).name}`, 'gold'));
    }
  }
  return { kind: 'text', header, body, footer: 'ATTACK TO CONTINUE', figure: sum.offLedger ? undefined : { name: 'registrar', talking: true } };
}

/** What each class is for, shown on the character select (docs/04-classes-progression.md, "What each class is best at"): a headline, then how. */
export const BLURB: Record<string, string[]> = {
  warrior: ['HOLDS THE LINE', 'MOST HP', 'DODGE PLOWS A LANE', 'ABILITY: QUAKE'],
  mage: ['AREA DAMAGE', 'SPLASH FIREBALLS', 'DODGE TELEPORTS', 'ABILITY: BIG FIREBALL'],
  cleric: ['KEEPS ALLIES ALIVE', 'ATTACK TOGGLES AURA', 'AURA HURTS ALL NEAR', 'DODGE HEALS PARTY'],
  rogue: ['BURST FROM BEHIND', 'BACKSTAB: 2.5X DAMAGE', 'VANISH, THEN STRIKE', 'WEAK HEAD-ON'],
  archer: ['SNIPER', 'FAR SHOTS HIT HARDER', 'ARROW FAN AND RAIN', 'STAY BACK'],
};

export interface LobbySlot { joined: boolean; ready: boolean; classId: number }

/** Character select: one panel per player slot; a device joins by pressing attack. */
export function selectScreen(w: Writ, lobby: readonly LobbySlot[]): Screen {
  return {
    kind: 'select',
    header: 'CHOOSE YOUR HERO',
    sub: storySafe(w.title),
    biome: biomeIndex(w.seed),
    slots: lobby.map((l) => {
      const c = CLASSES[l.classId];
      return { joined: l.joined, ready: l.ready, classId: l.classId, name: fontSafe(c.name), blurb: BLURB[c.name] ?? [], hp: c.hp, speed: c.speed };
    }),
    footer: 'LEFT/RIGHT CHOOSE    ATTACK READY    ALL READY STARTS',
  };
}
