import type { Knex } from 'knex';

/** The dialect families the adapters tell apart; everything else takes the portable path. */
export type SqlDialect = 'postgres' | 'mysql' | 'sqlite' | 'other';

export function dialectOf(knex: Knex): SqlDialect {
  // `client.dialect` is the name knex itself gives the dialect, whatever driver is behind it.
  const client: unknown = knex.client;
  const name: unknown =
    typeof client === 'object' && client !== null && 'dialect' in client ? client.dialect : undefined;
  switch (name) {
    case 'postgresql':
    case 'cockroachdb':
      return 'postgres';
    case 'mysql':
      return 'mysql';
    case 'sqlite3':
      return 'sqlite';
    default:
      return 'other';
  }
}
