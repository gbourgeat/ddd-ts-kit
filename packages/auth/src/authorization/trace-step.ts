/** One line of an explanation: what was asked, how deep, and what came out of it. */
export interface TraceStep {
  readonly depth: number;
  /** `accountant grants billing:invoice.issue`, `nobody is owner of document:q3`. */
  readonly text: string;
  /** `yes` when the line holds, `no` when it does not, `cut` when a cycle or the depth limit stopped it. */
  readonly answer: 'yes' | 'no' | 'cut';
}
