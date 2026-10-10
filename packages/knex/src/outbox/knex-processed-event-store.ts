import type { ProcessedEventStore } from '@ddd-ts-kit/kernel';
import { insertIgnoringConflict } from '../sql/insert-ignoring-conflict.js';
import type { KnexContext } from '../unit-of-work/knex-context.js';
import { PROCESSED_EVENTS_TABLE } from './table-names.js';

export interface KnexProcessedEventStoreOptions {
  /** The schema the table was created in. Default: the default schema of the connection. */
  readonly schema?: string;
  /** Default `processed_events`. */
  readonly table?: string;
}

/**
 * Idempotency of consumers. It writes on the executor of the context: when the consumer runs
 * inside a unit of work, the mark commits with the effects of the handler and disappears with
 * them if the handler fails, so the redelivery is processed.
 */
export class KnexProcessedEventStore implements ProcessedEventStore {
  private readonly context: KnexContext;

  private readonly schemaName: string | undefined;

  private readonly tableName: string;

  constructor(context: KnexContext, options: KnexProcessedEventStoreOptions = {}) {
    this.context = context;
    this.schemaName = options.schema;
    this.tableName = options.table ?? PROCESSED_EVENTS_TABLE;
  }

  markProcessed(consumer: string, eventId: string): Promise<boolean> {
    const executor = this.context.executor();
    const table = executor(this.tableName);

    return insertIgnoringConflict(executor, this.schemaName === undefined ? table : table.withSchema(this.schemaName), {
      row: { consumer, event_id: eventId },
      conflict: ['consumer', 'event_id'],
    });
  }
}
