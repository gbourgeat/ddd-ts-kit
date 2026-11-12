/**
 * The tables an end-to-end run on a server leaves their rows (test-database-emptying.ts): every
 * other table of its copy of the migrated database is emptied before a spec file starts. A name is
 * `<schema>.<table>`, or `<schema>.*` for every table of a schema, written as the server stores it
 * and without quotes: in lower case unless the table was created between quotes (`"Countries"` is
 * `public.Countries`). The run says of a name that it is no table of the database. Add a table
 * whose rows a migration inserts and the application reads (a list of countries, a plan). A kept
 * table that references an emptied one, or is a partition of one, needs that one kept too: the run
 * says which.
 */
export const KEPT_TABLES: readonly string[] = [
  // What the migration tool writes of what it applied: a table it is told to name otherwise goes here under that name.
{{#if orm.drizzle}}
  'drizzle.__drizzle_migrations',
{{/if}}
{{#if orm.knex}}
  'public.knex_migrations',
  'public.knex_migrations_lock',
{{/if}}
{{#if orm.prisma}}
  'public._prisma_migrations',
{{/if}}
{{#if orm.typeorm}}
  'public.migrations',
  'public.typeorm_metadata',
{{/if}}
{{#if audit.on}}
  // The audit trail, which its guard keeps append-only whoever asks.
  'audit.*',
{{/if}}
];
