import type { SqlRow } from './sql-row.js';

/** The rows of a driver result: an array (postgres-js) or an object holding `rows` (node-postgres, PGlite). */
export function rowsOf(result: unknown): readonly SqlRow[] {
  if (Array.isArray(result)) return result.filter(isRow);

  if (typeof result === 'object' && result !== null && 'rows' in result) return rowsOf(result.rows);

  return [];
}

function isRow(value: unknown): value is SqlRow {
  return typeof value === 'object' && value !== null;
}
