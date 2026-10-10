/** One array literal that names what a constructor receives, and the identifiers it holds. */
export interface DependencyList {
  /** What carries the list: a decorator (`@CommandHandler`), `toClass` or `handledBy`. */
  readonly owner: string;
  readonly line: number;
  readonly names: readonly { readonly name: string; readonly line: number }[];
}
