// Frame-time tracking for the debug overlay: FPS, dropped frames, worst frame, and a rolling graph.
const WINDOW = 600; // ~10 s at 60 fps
const GRAPH = 120;
const WARMUP_FRAMES = 30; // shader compilation and first uploads are not "drops"

export class FrameStats {
  /** Last GRAPH frame times in ms, oldest first via `graphStart`. */
  readonly graph = new Float32Array(GRAPH);
  graphStart = 0;
  /** Frames in the last ~10 s that took far longer than the display's usual rhythm. */
  drops = 0;
  worstMs = 0;
  fps = 60;
  /** Typical (drop-free) frame time in ms; drops are measured against this. */
  typicalMs = 16.7;
  /** Times the sim fell so far behind it had to skip ticks. */
  skippedTicks = 0;
  private lastSkipAt = -1e9;

  private flags = new Uint8Array(WINDOW);
  private times = new Float32Array(WINDOW);
  private head = 0;
  private frames = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;

  /** Record one rendered frame. dtMs is the real time since the previous frame. */
  record(dtMs: number): void {
    // Ignore the gap from a hidden tab or a debugger pause.
    if (dtMs > 500) return;
    this.frames++;

    const isDrop = this.frames > WARMUP_FRAMES && dtMs > this.typicalMs * 1.5 + 1;
    if (!isDrop) this.typicalMs += (dtMs - this.typicalMs) * 0.05;

    const leaving = this.flags[this.head];
    if (leaving) this.drops--;
    this.flags[this.head] = isDrop ? 1 : 0;
    this.times[this.head] = dtMs;
    if (isDrop) this.drops++;
    this.head = (this.head + 1) % WINDOW;

    if (this.frames % 20 === 0) {
      let w = 0;
      for (let i = 0; i < WINDOW; i++) if (this.times[i] > w) w = this.times[i];
      this.worstMs = w;
    }

    this.graph[this.graphStart] = dtMs;
    this.graphStart = (this.graphStart + 1) % GRAPH;

    this.fpsAcc += dtMs;
    this.fpsFrames++;
    if (this.fpsAcc >= 500) {
      this.fps = Math.round((this.fpsFrames * 1000) / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
  }

  noteSkippedTicks(n: number, nowMs: number): void {
    this.skippedTicks += n;
    this.lastSkipAt = nowMs;
  }

  /** True for ~10 s after the sim last had to skip ticks. */
  simLagging(nowMs: number): boolean {
    return nowMs - this.lastSkipAt < 10000;
  }

  get graphLength(): number {
    return GRAPH;
  }
}
