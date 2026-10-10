/** The rows a driver answered a statement with: node-postgres and PGlite wrap them, postgres-js does not. */
export function rowsOf(answered: unknown): Readonly<Record<string, unknown>>[] {
  const wrapped: unknown =
    typeof answered === 'object' && answered !== null && 'rows' in answered ? answered.rows : answered;

  const rows: readonly unknown[] = Array.isArray(wrapped) ? wrapped : [];

  return rows.filter(isRecord);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}
