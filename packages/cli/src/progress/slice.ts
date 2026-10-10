/** One row of the table of `docs/architecture/slices.md`, as the plan-slices skill writes it. */
export interface Slice {
  /** The `#` column. */
  readonly id: string;
  readonly context: string;
  /** `contract`, `skeleton` or `slice`. */
  readonly kind: string;
  readonly slice: string;
  /** The generator commands that start it, as written. */
  readonly startWith: string;
  /** The ids of the rows it waits for. */
  readonly dependsOn: readonly string[];
  /** `conductor`, the name of a context, or a person. */
  readonly owner: string;
  /** `todo`, `in progress` or `done`. */
  readonly status: string;
}
