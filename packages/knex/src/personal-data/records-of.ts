/** The rows a statement answered, as records. */
export function recordsOf(answered: unknown): Readonly<Record<string, unknown>>[] {
  const rows: readonly unknown[] = Array.isArray(answered) ? answered : [];

  return rows.filter((row): row is Readonly<Record<string, unknown>> => typeof row === 'object' && row !== null);
}
