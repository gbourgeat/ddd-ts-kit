import type { ProcessedEventStore } from '@ddd-ts-kit/kernel';
import { insertIgnoringConflict } from './insert-ignoring-conflict.js';
import { PROCESSED_EVENTS_TABLE } from './schema.js';
import type { KnexContext } from './unit-of-work.js';

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
  readonly #context: KnexContext;
  readonly #schema: string | undefined;
  readonly #table: string;

  constructor(context: KnexContext, options: KnexProcessedEventStoreOptions = {}) {
    this.#context = context;
    this.#schema = options.schema;
    this.#table = options.table ?? PROCESSED_EVENTS_TABLE;
  }

  markProcessed(consumer: string, eventId: string): Promise<boolean> {
    const executor = this.#context.executor();
    const table = executor(this.#table);
    return insertIgnoringConflict(
      executor,
      this.#schema === undefined ? table : table.withSchema(this.#schema),
      { row: { consumer, event_id: eventId }, conflict: ['consumer', 'event_id'] },
    );
  }
}
