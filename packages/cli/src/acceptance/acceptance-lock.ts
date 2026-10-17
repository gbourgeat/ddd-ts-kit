/** A scenario as the lock recorded it. */
export interface LockedScenario {
  readonly title: string;
  readonly criteria: readonly string[];
  readonly fingerprint: string;
}

/**
 * A change since the previous lock that the acceptance-judge agent let through: a scenario changed
 * while its criteria were not, or a criterion changed; with the verdict, for the owner to validate.
 */
export interface Amendment {
  /** `scenario "<title>"` or `criterion AC1`. */
  readonly subject: string;
  readonly criteria: readonly string[];
  readonly reason: string;
  /** The file of the verdict. */
  readonly verdict: string;
  readonly on: string;
}

/**
 * The acceptance of a story once agreed, `test/acceptance/<story>.acceptance.lock.json`, written by
 * `ddd-ts-kit acceptance <story> --lock` only: the fingerprint of each criterion and of each
 * scenario. A scenario may then change only with its criterion; a criterion, or a scenario whose
 * criteria stayed, only with a verdict of the acceptance-judge agent, which the lock keeps.
 */
export interface AcceptanceLock {
  readonly story: string;
  readonly criteria: Readonly<Record<string, string>>;
  readonly scenarios: readonly LockedScenario[];
  readonly amendments: readonly Amendment[];
}
