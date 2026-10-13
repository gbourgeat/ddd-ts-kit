/** A list of texts with one more entry, unless it holds it already; a value that is not a list becomes one. */
export function withEntry(value: unknown, entry: string): unknown[] {
  const list: unknown[] = Array.isArray(value) ? value : [];

  return list.includes(entry) ? list : [...list, entry];
}
