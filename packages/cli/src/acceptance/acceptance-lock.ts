/** A scenario as the lock recorded it. */
export interface LockedScenario {
  readonly title: string;
  readonly criteria: readonly string[];
  readonly fingerprint: string;
}

/** A change of a locked scenario that no change of its criteria explained, and the reason given for it. */
export interface Amendment {
  readonly scenario: string;
  readonly criteria: readonly string[];
  readonly reason: string;
  readonly on: string;
}

/**
 * The acceptance of a story once agreed, `test/acceptance/<story>.acceptance.lock.json`, written by
 * `ddd-ts-kit acceptance <story> --lock` only: the fingerprint of each criterion and of each
 * scenario. A scenario may then change only with its criterion, or with a reason the lock keeps.
 */
export interface AcceptanceLock {
  readonly story: string;
  readonly criteria: Readonly<Record<string, string>>;
  readonly scenarios: readonly LockedScenario[];
  readonly amendments: readonly Amendment[];
}
