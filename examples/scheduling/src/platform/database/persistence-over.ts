import type { Knex } from 'knex';
import { createKnexUnitOfWork, KnexOutboxStore, KnexProcessedEventStore } from '@ddd-ts-kit/knex';
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
    close,
  };
}
