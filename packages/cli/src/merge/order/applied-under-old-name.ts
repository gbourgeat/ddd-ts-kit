const REMEDIES = {
  drizzle:
    'would run it again under the new one: reset it, or add to `drizzle.__drizzle_migrations` a row whose `created_at` is the `when` of its new entry in the journal, with any `hash` (required, never compared)',
  knex: 'then refuses every migration (`The migration directory is corrupt, the following files are missing`): reset it, or set `name` of its row in `knex_migrations` to the new file name, extension included',
  prisma:
    'still knows it by the old one: reset it, or record the new name as applied with `npx prisma migrate resolve --applied <new name>`',
  typeorm:
    'would run it again under the new one: reset it, or correct its row in `migrations` (`timestamp`, and `name`, the class)',
} as const;

/**
 * What to do with a database that already ran a migration the landing renames or generates
 * again: its tool knows the migration by the old name.
 */
export function appliedUnderOldName(orm: keyof typeof REMEDIES): string {
  return `A database that already applied a migration under its old name (development, preview, shared) ${REMEDIES[orm]}.`;
}
