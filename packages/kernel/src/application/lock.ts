export interface AcquireOptions {
  /** After it the lock frees itself: the holder crashed, or took longer than it promised. */
  readonly ttlMs: number;
  /** How long to wait for a lock somebody else holds. Default 0: answer at once. */
  readonly waitMs?: number;
}

export interface LockHandle {
  readonly key: string;
  /**
   * Grows with each acquisition of the key. A resource that remembers the highest token it
   * has seen can refuse a holder whose lock expired while it was paused.
   */
  readonly fencingToken: number;
  /** Frees the lock if it is still this holder's. Releasing twice, or too late, does nothing. */
  release(): Promise<void>;
}

/**
 * A mutex between processes, to avoid doing the same work twice: `undefined` when somebody
 * else holds the key. An efficiency tool, never the guard of an invariant: what must not
 * happen twice is refused by a database constraint.
 */
export interface Lock {
  acquire(key: string, options: AcquireOptions): Promise<LockHandle | undefined>;
}

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
