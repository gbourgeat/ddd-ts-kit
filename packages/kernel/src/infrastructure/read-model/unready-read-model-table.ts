/** A read model table that cannot hold the trace of a deleted row, and what its migration has to change. */
export interface UnreadyReadModelTable {
  readonly schema?: string;
  readonly table: string;
  /** The columns of the row that refuse NULL. */
  readonly refusing: readonly string[];
  /** Every column of the row: what the rows deleted before the migration are emptied of. */
  readonly row: readonly string[];
  /**
   * Whether the database holds the check constraint that keeps the live rows whole,
   * `<table>_live_rows_whole`. Left out when the definition of the table was read, not the database.
   */
  readonly constraint?: boolean;
}
