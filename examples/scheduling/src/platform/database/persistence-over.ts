import type { Knex } from 'knex';
import { createKnexUnitOfWork, KnexOutboxStore, KnexProcessedEventStore } from '@ddd-ts-kit/knex';
import type { Persistence } from './persistence.js';
import { MESSAGING } from './schema.js';

/** One object is the unit of work and what repositories query through; the stores write in its transaction. */
export function persistenceOver(db: Knex, close: () => Promise<void>): Persistence {
  const unitOfWork = createKnexUnitOfWork(db);

  return {
    unitOfWork,
    database: unitOfWork,
    outbox: new KnexOutboxStore(unitOfWork, { schema: MESSAGING }),
    processedEvents: new KnexProcessedEventStore(unitOfWork, { schema: MESSAGING }),
    close,
  };
}
