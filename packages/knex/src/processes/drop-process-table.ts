import type { Knex } from 'knex';
import { builderIn } from '../outbox/builder-in.js';
import { PROCESS_TABLE } from './process-table-name.js';
import type { ProcessTableOptions } from './process-table-options.js';

/** The `down` of `createProcessTable`. The schema itself is left in place. */
export async function dropProcessTable(knex: Knex, options: ProcessTableOptions = {}): Promise<void> {
  await builderIn(knex, options.schema).dropTableIfExists(options.table ?? PROCESS_TABLE);
}
