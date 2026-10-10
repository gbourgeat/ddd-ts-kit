/** Runs the work in the asynchronous context of the caller. */
export function here<T>(work: () => T): T {
  return work();
}
