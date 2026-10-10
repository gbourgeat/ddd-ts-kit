/** One changed file of the working tree or of the index, with the lines it adds and removes. */
export interface Change {
  /** Relative to the project root. */
  readonly path: string;
  readonly lines: number;
}
