/** What a driver answered, as records: anything else is left out. */
export function recordsOf(answered: unknown): Readonly<Record<string, unknown>>[] {
  const records: readonly unknown[] = Array.isArray(answered) ? answered : [];

  return records.filter(isRecord);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}
