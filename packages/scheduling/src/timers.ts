/** How the in-process scheduler sleeps. Injected so that a test moves time instead of waiting for it. */
export interface JobTimers {
  /** Calls `task` once `delayMs` have passed. The answer cancels it. */
  schedule(delayMs: number, task: () => void): () => void;
}

export const systemJobTimers: JobTimers = Object.freeze({
  schedule(delayMs: number, task: () => void): () => void {
    const timer = setTimeout(task, delayMs);
    return () => {
      clearTimeout(timer);
    };
  },
});
