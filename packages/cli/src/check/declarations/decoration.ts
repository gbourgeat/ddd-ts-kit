export interface Decoration {
  readonly name: string;
  readonly line: number;
  /** Offset of the `@`. */
  readonly start: number;
  /** Offsets of the parentheses around the arguments; equal when the decorator is not called. */
  readonly open: number;
  readonly close: number;
}
