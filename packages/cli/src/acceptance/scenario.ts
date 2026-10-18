/**
 * What a scenario of an acceptance spec says of its code: `todo`, an `it.todo` still to write;
 * `pending`, written and wrapped in `pending(...)`, the code it waits for not built; `active`,
 * written and expected to pass; `skipped`, put aside by the runner (`.skip`, `.fails`, `.failing`),
 * which an acceptance spec never does.
 */
export type ScenarioState = 'todo' | 'pending' | 'active' | 'skipped';

/** One `it` of an acceptance spec. */
export interface Scenario {
  readonly title: string;
  readonly line: number;
  /** The ids of the rows of slices.md its title names (`#US5.02`): what makes it pass. */
  readonly rows: readonly string[];
  /** The acceptance criteria of the story its title names (`AC1`): what it proves. */
  readonly criteria: readonly string[];
  readonly state: ScenarioState;
  /**
   * What the scenario asserts, as a digest: its call without comments, white space, trailing commas
   * and the `pending(...)` around its body, so that removing the wrapper or formatting again keeps it.
   */
  readonly fingerprint: string;
}
