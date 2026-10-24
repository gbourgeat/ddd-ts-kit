/** An identifier of a raw statement, quoted for PostgreSQL. */
export function quoted(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
