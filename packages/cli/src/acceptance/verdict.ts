/** What the acceptance-judge agent decided about one change since the lock. */
export interface Verdict {
  /** The file, relative to the root. */
  readonly file: string;
  readonly story: string;
  /** `scenario "<title>"` or `criterion AC1`, as `acceptance` names the change. */
  readonly subject: string;
  /** The version judged: a verdict holds for that version only. */
  readonly fingerprint: string;
  /** `amend`: the change makes the test say what its criterion says, or follows the statement; `refuse`: it does not. */
  readonly verdict: 'amend' | 'refuse';
  readonly reason: string;
}
