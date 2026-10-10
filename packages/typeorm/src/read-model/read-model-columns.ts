import type { EntitySchemaColumnOptions } from 'typeorm';
import { INDEXABLE_LENGTH } from '../columns/indexable-length.js';
import { INSTANT } from '../columns/instant.js';
import type { TypeOrmDialect } from '../columns/type-orm-dialect.js';
import type { ReadModelStamps } from './read-model-stamps.js';

/**
 * The columns a projection orders its events by, to spread into the `columns` of the
 * `EntitySchema` of a read model, under the same names in every project: `last_event_id`,
 * `last_event_at`, `last_event_version` and `deleted`, the trace a removed row leaves so that
 * a late event does not bring it back.
 */
export function readModelColumns(
  dialect: TypeOrmDialect = 'postgres',
): Record<keyof ReadModelStamps, EntitySchemaColumnOptions> {
  return {
    lastEventId: { name: 'last_event_id', type: 'varchar', length: INDEXABLE_LENGTH },
    lastEventAt: { ...INSTANT[dialect], name: 'last_event_at' },
    lastEventVersion: { name: 'last_event_version', type: 'bigint', nullable: true },
    deleted: { name: 'deleted', type: 'boolean', default: false },
  };
}
