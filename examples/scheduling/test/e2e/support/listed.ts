/** One page of a list, as every list of the API answers it. */
export interface Listed<Line> {
  readonly items: readonly Line[];
  readonly total?: number;
}
