const TABLES = {
  drizzle:
    'add to `drizzle.__drizzle_migrations` a row whose `created_at` is the `when` of its new entry in the journal',
  knex: 'rename its row in `knex_migrations` (`name`, the file name)',
  prisma: 'rename its row in `_prisma_migrations` (`migration_name`)',
  typeorm: 'correct its row in `migrations` (`timestamp`, and `name`, the class)',
} as const;

/**
 * What to do with a database that already ran a migration the landing renames or generates
 * again: its tool knows the migration by the old name, and would run it a second time.
 */
export function appliedUnderOldName(orm: keyof typeof TABLES): string {
  return `A database that already applied a migration under its old name (development, preview, shared) would run it again under the new one: reset it, or ${TABLES[orm]}.`;
}
