import type { OutboxStore } from '@ddd-ts-kit/events';
import type {
  EventSourcingStores,
  ExecutionScope,
  ProcessStore,
  ProcessedEventStore,
  UnitOfWork,
} from '@ddd-ts-kit/kernel';
import type { JobStore } from '@ddd-ts-kit/scheduling';
import type { KnexContext } from '@ddd-ts-kit/knex';

/** Where state lives and how a command is made atomic. The platform module binds each member to its port. */
export interface Persistence {
  readonly unitOfWork: UnitOfWork;
  readonly outbox: OutboxStore;
  readonly processedEvents: ProcessedEventStore;
  /** The background jobs, enqueued in the transaction of the command that asks for them. */
  readonly jobs: JobStore;
  /** The instances of the process managers of the network of the work, saved in the transaction of each step. */
  readonly processes: (scope: ExecutionScope) => ProcessStore;
  /** What repositories query through: the transaction of the current unit of work, or the database. */
  readonly database: KnexContext;
  /**
   * The streams of the event-sourced aggregates, their snapshots, the checkpoints of the
   * subscriptions and the keys of the data subjects, as stored: `createAudit` wraps the keys so
   * that every erasure is recorded, and the application and the scripts erase through that wrapper.
   */
  readonly eventSourcing: EventSourcingStores;

  close(): Promise<void>;
}
