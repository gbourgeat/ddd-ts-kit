/** PostgreSQL keeps 63 bytes of an identifier, cut at a character. */
const IDENTIFIER_BYTES = 63;

/**
 * The name of the check constraint that keeps the live rows of a read model table whole, in place
 * of the NOT NULL its columns lose: `<table>_live_rows_whole`, as PostgreSQL keeps it.
 */
export function liveRowsConstraintOf(table: string): string {
  const encoder = new TextEncoder();
  let kept = '';

  for (const character of `${table}_live_rows_whole`) {
    if (encoder.encode(kept + character).length > IDENTIFIER_BYTES) {
      break;
    }

    kept += character;
  }

  return kept;
}
