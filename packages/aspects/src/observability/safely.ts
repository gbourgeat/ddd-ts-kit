/** Observation must never break what it observes. */
export function safely(act: () => void): void {
  try {
    act();
  } catch {
    return;
  }
}
