/** How the in-process scheduler sleeps. Injected so that a test moves time instead of waiting for it. */
export abstract class JobTimers {
  static readonly tokenKey = 'scheduling.JobTimers';

  /** Calls `task` once `delayMs` have passed. The answer cancels it. */
  abstract schedule(delayMs: number, task: () => void): () => void;
}
