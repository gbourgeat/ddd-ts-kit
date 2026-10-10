import type { LockHandle } from './lock-handle.js';

export interface WaitingOptions {
  /** Pause between two attempts while waiting. Default 25. */
  readonly retryDelayMs?: number;
  /** Default: a timer. */
  readonly sleep?: (ms: number) => Promise<void>;
}

/** For an adapter of `Lock`: tries, and tries again every `retryDelayMs` until `waitMs` have been waited. */
export async function acquiring(attempt: () => Promise<LockHandle | undefined>, waitMs: number, waiting: WaitingOptions): Promise<LockHandle | undefined> {
  const pause = Math.max(1, waiting.retryDelayMs ?? 25);
  const sleep = waiting.sleep ?? timer;

  for (let waited = 0; ; waited += pause) {
    const handle = await attempt();

    if (handle !== undefined || waited >= waitMs) return handle;

    await sleep(Math.min(pause, waitMs - waited));
  }
}

function timer(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
