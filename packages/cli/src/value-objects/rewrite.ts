/** A source once rewritten, and how many places changed. */
export interface Rewrite {
  readonly source: string;
  readonly count: number;
}
