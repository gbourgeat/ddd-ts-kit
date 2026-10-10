export interface FunctionShape {
  readonly name: string;
  readonly line: number;
  /** Offset of the declaration and of the end of its body. */
  readonly start: number;
  readonly end: number;
  readonly parameters: readonly string[];
  /** Offset of the brace opening the body. */
  readonly bodyStart: number;
  /** Lines holding code strictly inside the body. */
  readonly bodyLines: number;
}
