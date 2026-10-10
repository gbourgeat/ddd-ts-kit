/** One `filter[...]` parameter of a query: the names between its brackets, and its values. */
export interface FilterEntry {
  readonly path: readonly string[];
  readonly values: readonly unknown[];
}
