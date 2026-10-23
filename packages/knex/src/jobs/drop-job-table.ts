import type { Knex } from 'knex';
import { builderIn } from '../outbox/builder-in';
import { JOB_TABLE } from './job-table-name';
import type { JobTableOptions } from './job-table-options';

/** The `down` of `createJobTable`. The schema itself is left in place. */
export async function dropJobTable(knex: Knex, options: JobTableOptions = {}): Promise<void> {
  await builderIn(knex, options.schema).dropTableIfExists(options.table ?? JOB_TABLE);
}
