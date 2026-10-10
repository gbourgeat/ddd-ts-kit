/** Lets what is already resolved run: promise reactions, never the passage of time. */
export function settled(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
