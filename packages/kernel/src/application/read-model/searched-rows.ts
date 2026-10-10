/** What the query of a plan answered: the rows in order, and the total when it was counted. */
export interface SearchedRows<Row> {
  readonly rows: readonly Row[];
  readonly total?: number;
}
