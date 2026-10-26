/**
 * A migration drizzle-kit wrote, its `CREATE SCHEMA` made idempotent: a schema created before by
 * hand, by another tool or by a migration of a project generated earlier, is left as it is
 * instead of failing the migration.
 */
export function schemasIfMissing(migration: string): string {
  return migration.replace(/CREATE SCHEMA (?!IF NOT EXISTS)/g, 'CREATE SCHEMA IF NOT EXISTS ');
}
