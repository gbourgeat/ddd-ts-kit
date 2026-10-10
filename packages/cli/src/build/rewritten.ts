/** One emitted file after its alias specifiers were turned into relative ones. */
export interface Rewritten {
  readonly text: string;
  /** How many specifiers changed. */
  readonly count: number;
  /** Why some could not: each one says the line and the specifier. */
  readonly problems: readonly string[];
}
