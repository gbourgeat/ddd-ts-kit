import type { Knex } from 'knex';
import { RELATION_TUPLES_TABLE } from '@/platform/auth/relation-tuples-table.js';

interface Placed {
  /** The database schema the table is created in. */
  readonly schema: string;
}

/**
 * The table of the relation tuples. The primary key is the tuple itself, which makes a second
 * write of the same fact a conflict to ignore and serves the read by object and relation; the
 * index on `subject` serves the reverse lookup of a listing.
 */
export async function createRelationTupleTables(knex: Knex, { schema }: Placed): Promise<void> {
  await knex.schema.createSchemaIfNotExists(schema);

  await knex.schema.withSchema(schema).createTable(RELATION_TUPLES_TABLE, (table) => {
    table.text('object').notNullable();
    table.text('relation').notNullable();
    table.text('subject').notNullable();
    table.primary(['object', 'relation', 'subject']);
    table.index(['subject'], RELATION_TUPLES_TABLE + '_subject_idx');
  });
}
