/**
 * Lightweight step timer for Edge Functions. Pure logging — never affects
 * behavior. Each `mark(label)` logs `[tag] label Xms` for the time since the
 * previous mark; `total()` logs `[tag] TOTAL Xms`. Reading the logs tells you at
 * a glance whether cold start, the page fetch / transcript provider, or OpenRouter
 * is eating the time (the gap between TOTAL and the summed marks ≈ overhead).
 */
export class StepTimer {
  private readonly start = Date.now();
  private last = this.start;

  constructor(private readonly tag: string) {}

  /** Log elapsed time since the previous mark (or construction) under `label`. */
  mark(label: string): void {
    const now = Date.now();
    console.log(`[${this.tag}] ⏱ ${label} ${now - this.last}ms`);
    this.last = now;
  }

  /** Log total elapsed time since construction. */
  total(): void {
    console.log(`[${this.tag}] ⏱ TOTAL ${Date.now() - this.start}ms`);
  }
}
