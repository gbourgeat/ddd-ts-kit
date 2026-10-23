import type { Knex } from 'knex';
import { builderIn } from '../outbox/builder-in';
import { PROCESS_TABLE } from './process-table-name';
import type { ProcessTableOptions } from './process-table-options';

/** The `down` of `createProcessTable`. The schema itself is left in place. */
export async function dropProcessTable(knex: Knex, options: ProcessTableOptions = {}): Promise<void> {
  await builderIn(knex, options.schema).dropTableIfExists(options.table ?? PROCESS_TABLE);
}
