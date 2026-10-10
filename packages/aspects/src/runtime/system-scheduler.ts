import type { Scheduler } from './scheduler.js';

export const systemScheduler: Scheduler = Object.freeze({
  schedule(work: () => void, delayMs: number): () => void {
    const timer = setTimeout(work, delayMs);

    return () => {
      clearTimeout(timer);
    };
  },
});
