/** One directory of a project and the prefix its files are imported by. */
export interface AliasRoot {
  /** As written in an import, `#src/`. */
  readonly prefix: string;
  /** Relative to the project root. */
  readonly directory: string;
  /** False for a tree that is never built: its alias names the source under every condition. */
  readonly compiled: boolean;
}
