/** Runs every attempt, whatever the previous ones did, and answers what they threw. */
export function failuresOf(attempts: readonly (() => void)[]): unknown[] {
  return attempts.flatMap((attempt) => {
    try {
      attempt();

      return [];
    } catch (error) {
      return [error];
    }
  });
}
