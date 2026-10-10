export interface CommentRecord {
  readonly line: number;
  readonly text: string;
  /** False for a comment that shares its line with code. */
  readonly ownLine: boolean;
  /** Offset just after the comment. */
  readonly end: number;
}
