/** How long a command waits for the lock, how often it looks again, and when a lock left behind is taken over. */
export interface LockTiming {
  readonly waitMs: number;
  readonly pollMs: number;
  readonly staleMs: number;
}
