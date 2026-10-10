import { EntitySchema } from 'typeorm';
import { INDEXABLE_LENGTH } from '../columns/indexable-length.js';
import { INSTANT } from '../columns/instant.js';
import { RIGHT_NOW } from '../columns/right-now.js';
import { entityName } from './entity-name.js';
import type { EntityOptions } from './entity-options.js';
import type { ProcessedEventRow } from './processed-event-row.js';

/** The idempotency table of the consumers, to register and migrate like the outbox. */
export function processedEventEntity(options: EntityOptions = {}): EntitySchema<ProcessedEventRow> {
  const dialect = options.dialect ?? 'postgres';

  return new EntitySchema<ProcessedEventRow>({
    name: entityName('ProcessedEvent', options),
    tableName: options.tableName ?? 'processed_events',
    ...(options.schema === undefined ? {} : { schema: options.schema }),
    columns: {
      // The primary key is the unique (consumer, event_id) the store relies on.
      consumer: { type: 'varchar', length: INDEXABLE_LENGTH, primary: true },
      eventId: { name: 'event_id', type: 'varchar', length: INDEXABLE_LENGTH, primary: true },
      processedAt: { ...INSTANT[dialect], name: 'processed_at', default: RIGHT_NOW[dialect] },
    },
  });
}
