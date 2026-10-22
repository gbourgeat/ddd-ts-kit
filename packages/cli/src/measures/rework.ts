/** The requirements that moved after the build started. */
export interface Rework {
  /** Commits that changed `## Acceptance criteria` after the first commit carrying a `Slice: <code>.` trailer. */
  readonly criteriaChanges: number;
  /** The amendments the lock recorded (each an `amend` verdict of the acceptance-judge agent). */
  readonly amendments: number;
  /** The `refuse` verdicts written for the story. */
  readonly refusals: number;
}
