/** What every search answers. `total` when it is cheap to count, `nextCursor` when more follow. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly total?: number;
  readonly nextCursor?: string;
}
