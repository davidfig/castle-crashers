// Fixed-timestep loop: sim ticks at a constant rate, render runs every animation frame
// and receives an interpolation alpha in [0, 1).
export interface LoopOptions {
  tickRate: number;
  maxStepsPerFrame?: number;
  update(): void;
  /** frameSeconds is scaled by timeScale; rawSeconds is the real time since the last frame. */
  render(alpha: number, frameSeconds: number, rawSeconds: number): void;
  /** Called when the sim fell too far behind and skipped ticks to catch up. */
  onSkippedTicks?(ticks: number): void;
  /** Dev aid: scale game time (0.1 = 10x slow motion). */
  timeScale?: () => number;
}

export function startLoop(opts: LoopOptions): void {
  const dt = 1000 / opts.tickRate;
  const maxSteps = opts.maxStepsPerFrame ?? 5;
  let last = performance.now();
  let acc = 0;

  const frame = (now: number) => {
    let elapsed = now - last;
    const raw = elapsed;
    last = now;
    if (elapsed > 250) elapsed = 250; // tab was hidden; don't try to catch up
    if (opts.timeScale) elapsed *= opts.timeScale();
    acc += elapsed;
    let steps = 0;
    while (acc >= dt && steps < maxSteps) {
      opts.update();
      acc -= dt;
      steps++;
    }
    if (steps === maxSteps && acc >= dt) {
      opts.onSkippedTicks?.(Math.floor(acc / dt));
      acc = 0; // fell behind; drop the backlog
    }
    opts.render(acc / dt, elapsed / 1000, raw / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
