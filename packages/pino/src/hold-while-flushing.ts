/** The longest a flush keeps a process alive. */
const HOLD_MS = 10_000;

/**
 * Keeps the process alive while a flush is under way. Pino unreferences the worker thread of a
 * transport (`pino-pretty`) so that it never holds a process: its answer to a flush does not
 * either, and a process with nothing else pending exited before the flush resolved, skipping
 * what its shutdown does after it. A flush that never answers holds it ten seconds, no more.
 * Answers what releases the hold.
 */
export function holdWhileFlushing(): () => void {
  const timer = setTimeout(() => undefined, HOLD_MS);

  return () => {
    clearTimeout(timer);
  };
}
