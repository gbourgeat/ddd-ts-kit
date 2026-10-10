export interface BlockCommentRecord {
  /** Line of the opening delimiter. */
  readonly line: number;
  readonly endLine: number;
  /** Content between the delimiters, untouched. */
  readonly text: string;
  readonly jsdoc: boolean;
  /** Offset just after the closing delimiter. */
  readonly end: number;
}
