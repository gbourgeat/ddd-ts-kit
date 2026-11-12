import type { PostgresReadModelTables } from '@ddd-ts-kit/kernel';
import { knexReadModelTables } from '@ddd-ts-kit/knex';
import type { Persistence } from '@/platform/database/persistence';

/**
 * The read model tables of the database, checked in one pass: each can hold the trace of a deleted
 * row (its key and its stamp, NULL in every column of its row), or is named with the columns that
 * refuse NULL and the migration to write. The application asks it when it starts, whatever builds
 * its stores and whenever, and `npm run db:read-models` asks it of the database a deployment is
 * about to reach. A read model table is known by its stamp (`readModelColumns`). A column no store
 * writes NULL in, besides the key, `tenant_id` and the stamp, is named in a second argument:
 * `{ kept: ['<schema>.<table>.<column>'] }`.
 */
export function readModelTables(persistence: Persistence): PostgresReadModelTables {
  return knexReadModelTables(persistence.database);
}
