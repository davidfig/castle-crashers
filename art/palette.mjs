// Master palette. Every character draws from these ramps so the whole cast reads as one world.
// Rules: ~28 colours; light from the upper-left; each material gets at most 4 steps; no gradients/dither.
// The world is ash, rust and verdigris. Saturation is rationed: only GLOW (life/magic) and bright rust (blood/cloth) are loud.
export const MASTER = {
  ink:   '#0d0b10',
  // soot / steel (cold, purple-tinted greys)
  s1: '#1b1720', s2: '#2c2530', s3: '#43394a', s4: '#6e6470', s5: '#a39a98', s6: '#d6cfc2', s7: '#efe9da',
  // rust / blood / dyed cloth
  r1: '#2a0e10', r2: '#52161a', r3: '#8a2a1c', r4: '#c24a22', r5: '#e8873a',
  // brass / bone-yellow
  b1: '#3d2e12', b2: '#7a5a20', b3: '#b98a30', b4: '#e6c35c',
  // verdigris / sickness
  v1: '#14292a', v2: '#24504a', v3: '#43806c', v4: '#8cc0a0',
  // glow (player identity / eyes / magic). Variants swap these.
  gl: '#ff4a3d', gd: '#7a1f2a',
};
export const PLAYER_GLOWS = [
  { id: 'p1', label: 'P1 ember',  palette: { E: '#ff4a3d', F: '#7a1f2a' } },
  { id: 'p2', label: 'P2 tide',   palette: { E: '#3df0ff', F: '#17606e' } },
  { id: 'p3', label: 'P3 sulfur', palette: { E: '#ffd23d', F: '#6e5817' } },
  { id: 'p4', label: 'P4 bruise', palette: { E: '#c36bff', F: '#512a73' } },
];

// ---- "Glass" palette: stained-glass / illuminated-manuscript direction. Jewel tones, flat fills,
// a full dark "lead" outline on every shape, gold leaf for light. Solemn and iconic, neither gritty nor cute.
export const GLASS = {
  lead: '#1a1030',
  a: '#232f78', b: '#3b57b8', c: '#7f9ee8',          // lapis
  r: '#7a1a35', R: '#c23458', q: '#ec7a8c',          // crimson
  g: '#a8791f', G: '#efbd44', Y: '#fff0a0',          // gold leaf
  w: '#cfc09f', W: '#f4ead2',                        // vellum
  s: '#c89574', S: '#f0cfae',                        // skin
  n: '#2c7554', m: '#5fb88a',                        // verdigris accent
  z: '#4a526e', Z: '#8f98b8', X: '#d4daf0',          // steel
  o: '#5a2e1e', O: '#8a4a2e', t: '#b9744a',           // orc hide
};
export const GLASS_PLAYERS = [
  { id: 'p1', label: 'P1 crimson',  palette: { r: '#7a1a35', R: '#c23458', q: '#ec7a8c' } },
  { id: 'p2', label: 'P2 lapis',    palette: { r: '#1a2a6a', R: '#3b6fd0', q: '#8fb4ff' } },
  { id: 'p3', label: 'P3 amber',    palette: { r: '#7a5a10', R: '#d8a820', q: '#f6dc70' } },
  { id: 'p4', label: 'P4 amethyst', palette: { r: '#4a1f6e', R: '#8a4ac0', q: '#c898f0' } },
];
