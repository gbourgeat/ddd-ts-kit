/** One statement of a SQL file, without its comments, its blanks folded, and the line it starts on. */
export interface SqlStatement {
  readonly text: string;
  readonly line: number;
}
