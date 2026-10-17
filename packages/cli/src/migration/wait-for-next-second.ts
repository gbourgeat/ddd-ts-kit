/**
 * Blocks until the second after `since` has begun: drizzle-kit numbers a migration with the time to
 * the second (`prefix: 'timestamp'`), so two generated within one second would share a snapshot file.
 */
export function waitForNextSecond(since: number): void {
  const left = (Math.floor(since / 1000) + 1) * 1000 - Date.now();

  if (left > 0) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, left);
  }
}
