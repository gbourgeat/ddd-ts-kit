export function restoring<T>(work: () => T, restore: () => void): T {
  let outcome: T;

  try {
    outcome = work();
  } catch (error) {
    restore();
    throw error;
  }

  if (outcome instanceof Promise) outcome.then(restore, restore);
  else restore();

  return outcome;
}
