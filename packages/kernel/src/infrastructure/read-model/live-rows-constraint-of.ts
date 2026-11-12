/** PostgreSQL keeps 63 bytes of an identifier. */
const IDENTIFIER_LENGTH = 63;

/**
 * The name of the check constraint that keeps the live rows of a read model table whole, in place
 * of the NOT NULL its columns lose: `<table>_live_rows_whole`, as PostgreSQL keeps it.
 */
export function liveRowsConstraintOf(table: string): string {
  return `${table}_live_rows_whole`.slice(0, IDENTIFIER_LENGTH);
}
