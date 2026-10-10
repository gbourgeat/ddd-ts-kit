const attempts = new WeakMap<object, number>();

/** Counts one more attempt on the adapter and answers how many were made. */
export function noteAttempt(rates: object): number {
  const made = attemptsOf(rates) + 1;

  attempts.set(rates, made);

  return made;
}

export function attemptsOf(rates: object): number {
  return attempts.get(rates) ?? 0;
}
