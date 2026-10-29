/**
 * The entry a record holds under `key` itself; undefined for any other key. A plain object answers
 * `constructor`, `toString` or `__proto__` from its prototype, and those are names a user can type.
 */
export function ownEntry<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}
