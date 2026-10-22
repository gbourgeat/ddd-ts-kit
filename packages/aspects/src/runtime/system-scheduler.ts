import type { Scheduler } from './scheduler';

export const systemScheduler: Scheduler = Object.freeze({
  schedule(work: () => void, delayMs: number): () => void {
    const timer = setTimeout(work, delayMs);

    return () => {
      clearTimeout(timer);
    };
  },
});
