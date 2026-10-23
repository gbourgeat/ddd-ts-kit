import type { JobTimers } from './job-timers';

export const systemJobTimers: JobTimers = Object.freeze({
  schedule(delayMs: number, task: () => void): () => void {
    const timer = setTimeout(task, delayMs);

    return () => {
      clearTimeout(timer);
    };
  },
});
