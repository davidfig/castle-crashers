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
  /**
   * True while the page must keep stepping with no animation frames (online: a hidden host would freeze the run for everyone, and a hidden
   * guest would fall behind it). A worker's timer keeps running in a hidden tab, so it steps the sim (no drawing) while frames have stopped.
   */
  stepHidden?(): boolean;
}

/** Milliseconds without an animation frame after which the worker takes over stepping. */
const STALL_MS = 100;

export function startLoop(opts: LoopOptions): void {
  const dt = 1000 / opts.tickRate;
  const maxSteps = opts.maxStepsPerFrame ?? 5;
  let last = performance.now();
  let acc = 0;

  /** Runs the ticks that `now` is owed (the sim only; drawing is the frame's). Returns the scaled seconds elapsed. */
  const advance = (now: number): { elapsed: number; raw: number } => {
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
    return { elapsed, raw };
  };

  let lastFrame = performance.now();
  const frame = (now: number) => {
    lastFrame = performance.now();
    const { elapsed, raw } = advance(now);
    opts.render(acc / dt, elapsed / 1000, raw / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  if (opts.stepHidden) {
    let worker: Worker | undefined;
    try { worker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 16)'], { type: 'text/javascript' }))); } catch { /* no workers here: a hidden page stalls, as before */ }
    if (worker) worker.onmessage = () => {
      const t = performance.now();
      if (t - lastFrame > STALL_MS && opts.stepHidden!()) advance(t);
    };
  }
}
