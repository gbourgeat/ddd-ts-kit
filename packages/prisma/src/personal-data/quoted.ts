/** An identifier as PostgreSQL quotes it. */
export function quoted(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
