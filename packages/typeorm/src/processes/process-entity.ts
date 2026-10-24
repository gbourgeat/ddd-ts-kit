import { EntitySchema } from 'typeorm';
import { INDEXABLE_LENGTH } from '../columns/indexable-length';
import { INSTANT } from '../columns/instant';
import { RIGHT_NOW } from '../columns/right-now';
import type { PostgresEntityOptions } from '../jobs/postgres-entity-options';
import { entityName } from '../outbox/entity-name';
import type { ProcessRow } from './process-row';

/**
 * The instances of the process managers as an `EntitySchema`, on PostgreSQL: one row per process
 * and correlation key, its JSON state, its version, its end and its armed timeouts.
 */
export function processEntity(options: PostgresEntityOptions = {}): EntitySchema<ProcessRow> {
  return new EntitySchema<ProcessRow>({
    name: entityName('ProcessInstance', options),
    tableName: options.tableName ?? 'process_instances',
    ...(options.schema === undefined ? {} : { schema: options.schema }),
    columns: {
      name: { type: 'varchar', length: INDEXABLE_LENGTH, primary: true },
      id: { type: 'varchar', length: INDEXABLE_LENGTH, primary: true },
      state: { type: 'jsonb', nullable: true },
      version: { type: 'int' },
      ended: { type: 'boolean', default: false },
      timeouts: { type: 'jsonb' },
      updatedAt: { ...INSTANT.postgres, name: 'updated_at', default: RIGHT_NOW.postgres },
    },
  });
}
