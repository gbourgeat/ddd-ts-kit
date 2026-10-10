import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { createDrizzleUnitOfWork, DrizzleOutboxStore, DrizzleProcessedEventStore } from '@ddd-ts-kit/drizzle/postgres';
import type { Persistence } from './persistence.js';
import { outbox, processedEvents } from './schema.js';

/** One object is the unit of work and what repositories query through; the stores write in its transaction. */
export function persistenceOver(db: PgDatabase<PgQueryResultHKT>, close: () => Promise<void>): Persistence {
  const unitOfWork = createDrizzleUnitOfWork(db);

  return {
    unitOfWork,
    database: unitOfWork,
    outbox: new DrizzleOutboxStore(unitOfWork, { table: outbox }),
    processedEvents: new DrizzleProcessedEventStore(unitOfWork, { table: processedEvents }),
    close,
  };
}
