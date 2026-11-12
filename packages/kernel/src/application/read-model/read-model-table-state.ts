/**
 * What the table of one read model can hold, as its own store reads it: from the columns the
 * store maps, never from a guess about the table. A table is ready when it is in the database,
 * no column of its row refuses NULL and none is unfit.
 */
export interface ReadModelTableState {
  readonly schema?: string;
  readonly table: string;
  /** False when the database holds no such table: the migration that creates it did not run. */
  readonly exists: boolean;
  /** The columns of the row that refuse NULL, which a migration opens. */
  readonly refusing: readonly string[];
  /**
   * The columns the store maps as fields of the row and that can never hold NULL: a part of the
   * primary key, an identity column, a generated one, or a column the table does not have. No
   * migration of the kit touches them: the store has to stop mapping them.
   */
  readonly unfit: readonly {
    readonly column: string;
    readonly because: 'primary-key' | 'identity' | 'generated' | 'absent';
  }[];
  /** The columns a trace holds NULL in, the unfit ones left out: what the rows deleted before are emptied of. */
  readonly row: readonly string[];
  /** The column that marks a deleted row, under the name the definition of the table gives it. */
  readonly deleted: string;
  /**
   * The check constraint `<table>_live_rows_whole` as the database holds it. `held` and
   * `not-valid` name the columns it keeps whole; `unexpected` is a constraint of that name that
   * checks something else, given as PostgreSQL writes it. Left out when the definition of the table
   * was read, not the database.
   */
  readonly constraint?: {
    readonly state: 'missing' | 'held' | 'not-valid' | 'unexpected';
    readonly columns: readonly string[];
    readonly definition?: string;
  };
}
