import {
  createKnexEventSourcing,
  createKnexUnitOfWork,
  KnexJobStore,
  KnexOutboxStore,
  KnexProcessedEventStore,
  KnexProcessStore,
} from '@ddd-ts-kit/knex';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';
import type { DatabaseConnection } from '@/platform/database/connect-to-database';
import type { Persistence } from '@/platform/database/persistence';
import { MESSAGING_SCHEMA } from '@/platform/database/schema';

/** One object is the unit of work and what repositories query through; the stores write in its transaction. */
export function persistenceOver(connection: DatabaseConnection): Persistence {
  const unitOfWork = createKnexUnitOfWork(connection.db);

  return {
    unitOfWork,
    database: unitOfWork,
    // The tenant of each event, so that its consumers run in the network it happened in.
    outbox: new KnexOutboxStore(unitOfWork, { schema: MESSAGING_SCHEMA, tenant: true }),
    processedEvents: new KnexProcessedEventStore(unitOfWork, { schema: MESSAGING_SCHEMA }),
    jobs: new KnexJobStore(unitOfWork, { schema: MESSAGING_SCHEMA }),
    // Each instance in the network of the work that started it: a step of another network finds none.
    processes: (scope) => new KnexProcessStore(unitOfWork, { schema: MESSAGING_SCHEMA, tenant: scope }),
    // One event store, in the schema of the one context with event-sourced aggregates.
    eventSourcing: createKnexEventSourcing(unitOfWork, { schema: SCHEDULING_SCHEMA }),
    close: () => connection.close(),
  };
}
