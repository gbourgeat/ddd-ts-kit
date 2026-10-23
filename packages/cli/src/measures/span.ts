/** The span of a story: its first and its last commit. */
export interface Span {
  readonly story: string;
  readonly from: number;
  readonly to: number;
}
