/** The delayed actions of a consumer, so that draining it cancels every one of them. */
export class Timers {
  private readonly pending = new Set<ReturnType<typeof setTimeout>>();

  later(act: () => void, delayMs: number): void {
    const timer = setTimeout(() => {
      this.pending.delete(timer);
      act();
    }, delayMs);

    this.pending.add(timer);
  }

  cancel(): void {
    for (const timer of this.pending) {
      clearTimeout(timer);
    }
  }
}
