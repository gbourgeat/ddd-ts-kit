import type { EntitySchema } from 'typeorm';
import type { ProcessedEventStore } from '@ddd-ts-kit/kernel';
import { insertIgnoringConflict } from '../sql/insert-ignoring-conflict';
import type { TypeOrmContext } from '../unit-of-work/type-orm-context';
import { processedEventEntity } from './processed-event-entity';
import type { ProcessedEventRow } from './processed-event-row';

export interface TypeOrmProcessedEventStoreOptions {
  /** Default `processedEventEntity()`, which must then be the one the data source registers. */
  readonly entity?: EntitySchema<ProcessedEventRow>;
}

/**
 * Idempotency of consumers. It writes on the manager of the context: when the consumer runs
 * inside a unit of work, the mark commits with the effects of the handler and disappears with
 * them if the handler fails, so the redelivery is processed.
 */
export class TypeOrmProcessedEventStore implements ProcessedEventStore {
  private readonly context: TypeOrmContext;

  private readonly processedEvents: EntitySchema<ProcessedEventRow>;

  constructor(context: TypeOrmContext, options: TypeOrmProcessedEventStoreOptions = {}) {
    this.context = context;
    this.processedEvents = options.entity ?? processedEventEntity();
  }

  markProcessed(consumer: string, eventId: string): Promise<boolean> {
    return insertIgnoringConflict(this.context.manager(), this.processedEvents, { consumer, eventId });
  }
}
