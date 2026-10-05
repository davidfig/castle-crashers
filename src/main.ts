import { InputManager } from './platform/input/input';
import { startLoop } from './platform/loop';
import { Renderer } from './platform/gl/renderer';
import { buildSprites } from './render/art';
import { loadHeroImages } from './render/heroSheets';
import { drawFrame } from './render/draw';
import { Fx } from './render/fx';
import { TICK_RATE, VIEW_H, VIEW_W } from './sim/constants';
import { createSim } from './sim/state';
import { step } from './sim/step';
import { lerp } from './engine/math';
import { FrameStats } from './platform/perf';

function fail(msg: string): never {
  const el = document.getElementById('err');
  if (el) { el.textContent = msg; el.style.display = 'grid'; }
  throw new Error(msg);
}

const canvas = document.getElementById('game') as HTMLCanvasElement;
let heroImages: HTMLImageElement[];
try {
  heroImages = await loadHeroImages();
} catch (err) {
  fail(String(err instanceof Error ? err.message : err));
}
const sprites = buildSprites(heroImages);
let renderer: Renderer;
try {
  renderer = new Renderer(canvas, sprites.atlas, VIEW_W, VIEW_H);
} catch (err) {
  fail(String(err instanceof Error ? err.message : err));
}

const input = new InputManager();
let fx = new Fx();

const params = new URLSearchParams(location.search);
let seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : (Date.now() & 0xffffffff) >>> 0;
let sim = createSim(seed);

const stats = new FrameStats();

function restart(): void {
  seed = (seed + 1) >>> 0;
  sim = createSim(seed);
  fx = new Fx();
  input.reset();
}

startLoop({
  tickRate: TICK_RATE,
  timeScale: () => (__DEV__ ? ((window as unknown as { __ts?: number }).__ts ?? 1) : 1),
  update() {
    if (input.restartRequested) { restart(); return; }
    step(sim, input.sample());
  },
  onSkippedTicks(n) {
    stats.noteSkippedTicks(n, performance.now());
  },
  render(alpha, dt, rawDt) {
    stats.record(rawDt * 1000);
    input.consumeHaptics(sim.events);
    fx.consume(sim.events);
    fx.update(dt * 60);

    const cam = lerp(sim.prevCamX, sim.camX, alpha);
    renderer.begin();
    drawFrame(renderer.batcher, sprites, sim, fx, cam, alpha, {
      stats,
      simLag: stats.simLagging(performance.now()),
      drawCalls: renderer.batcher.lastDrawCalls,
      sprites: renderer.batcher.lastSprites,
    });
    renderer.end();
  },
});

if (__DEV__) {
  new EventSource('/esbuild').addEventListener('change', () => location.reload());
  const w = window as unknown as { sim: () => typeof sim; sprites: typeof sprites; fx: typeof fx };
  w.sim = () => sim;
  w.sprites = sprites;
  w.fx = fx;
  (w as unknown as { stats: typeof stats }).stats = stats;
}
