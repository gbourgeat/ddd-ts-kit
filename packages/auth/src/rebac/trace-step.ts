/** One line of an explanation: what was asked, how deep, and what came out of it. */
export interface TraceStep {
  readonly depth: number;
  /** `nobody is owner of document:q3`, `the members of group:finance are viewer of folder:reports`. */
  readonly text: string;
  /** `yes` when the line holds, `no` when it does not, `cut` when a cycle or the depth limit stopped it. */
  readonly answer: 'yes' | 'no' | 'cut';
}
