export interface Violation {
  readonly ruleId: string;
  readonly severity: 'error' | 'warn';
  readonly file: string;
  readonly line: number;
  readonly message: string;
  /** One sentence saying what to do instead; written for whoever has to repair the code. */
  readonly fix: string;
  /**
   * The other files the finding is repaired in: `check --changed-since` keeps it when one of them
   * changed, and `check <paths>` reports it when one of them is among the paths given.
   */
  readonly subjects?: readonly string[];
}
