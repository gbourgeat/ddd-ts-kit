import type { Knex } from 'knex';
import {
  createKnexEventSourcing,
  createKnexUnitOfWork,
  KnexOutboxStore,
  KnexProcessedEventStore,
} from '@ddd-ts-kit/knex';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';
import type { Persistence } from '@/platform/database/persistence';
import { MESSAGING } from '@/platform/database/schema';

/** One object is the unit of work and what repositories query through; the stores write in its transaction. */
export function persistenceOver(db: Knex, close: () => Promise<void>): Persistence {
  const unitOfWork = createKnexUnitOfWork(db);

  return {
    unitOfWork,
    database: unitOfWork,
    // The tenant of each event, so that its consumers run in the network it happened in.
    outbox: new KnexOutboxStore(unitOfWork, { schema: MESSAGING, tenant: true }),
    processedEvents: new KnexProcessedEventStore(unitOfWork, { schema: MESSAGING }),
    // One event store, in the schema of the one context with event-sourced aggregates.
    eventSourcing: createKnexEventSourcing(unitOfWork, { schema: SCHEDULING_SCHEMA }),
    close,
  };
}
