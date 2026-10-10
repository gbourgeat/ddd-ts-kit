/** One directory of a project and the prefix its files are imported by. */
export interface AliasRoot {
  /** As written in an import, `@/`. */
  readonly prefix: string;
  /** Relative to the project root. */
  readonly directory: string;
}
