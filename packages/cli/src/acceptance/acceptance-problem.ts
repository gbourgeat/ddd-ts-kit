/**
 * What keeps the acceptance of a story from a gate. `always` problems are inconsistencies whatever
 * the gate: a scenario that names no row, an unknown row or an unknown criterion, a scenario put
 * aside, a pending one whose rows are all done, a locked one changed without its criterion. The
 * others are what the gate asks for. A fix has its own: a regression spec missing or without a test.
 */
export interface AcceptanceProblem {
  readonly kind:
    | 'no-rows'
    | 'no-file'
    | 'regression-missing'
    | 'regression-empty'
    | 'todo'
    | 'uncovered'
    | 'uncovered-criterion'
    | 'no-criterion'
    | 'unknown-criterion'
    | 'unlocked'
    | 'drift'
    | 'pending'
    | 'skipped'
    | 'no-row'
    | 'unknown-row'
    | 'done-pending';
  /** `file:line`, or `#<id>` for a row. */
  readonly at: string;
  readonly message: string;
  /** The gate from which it counts; undefined when it always does. */
  readonly from?: 'written' | 'passing';
}
