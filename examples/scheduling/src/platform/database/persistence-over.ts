import type { Knex } from 'knex';
import {
  createKnexUnitOfWork,
  KnexJobStore,
  KnexOutboxStore,
  KnexProcessedEventStore,
  KnexProcessStore,
} from '@ddd-ts-kit/knex';
import type { Persistence } from '@/platform/database/persistence';
import { MESSAGING } from '@/platform/database/schema';

/** One object is the unit of work and what repositories query through; the stores write in its transaction. */
export function persistenceOver(db: Knex, close: () => Promise<void>): Persistence {
  const unitOfWork = createKnexUnitOfWork(db);

  return {
    unitOfWork,
    database: unitOfWork,
    outbox: new KnexOutboxStore(unitOfWork, { schema: MESSAGING }),
    processedEvents: new KnexProcessedEventStore(unitOfWork, { schema: MESSAGING }),
    jobs: new KnexJobStore(unitOfWork, { schema: MESSAGING }),
    processes: new KnexProcessStore(unitOfWork, { schema: MESSAGING }),
    close,
  };
}
