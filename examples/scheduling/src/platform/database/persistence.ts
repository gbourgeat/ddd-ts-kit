import type { OutboxStore } from '@ddd-ts-kit/events';
import type { ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import type { KnexContext } from '@ddd-ts-kit/knex';

/** Where state lives and how a command is made atomic. The platform module binds each member to its port. */
export interface Persistence {
  readonly unitOfWork: UnitOfWork;
  readonly outbox: OutboxStore;
  readonly processedEvents: ProcessedEventStore;
  /** What repositories query through: the transaction of the current unit of work, or the database. */
  readonly database: KnexContext;

  close(): Promise<void>;
}
