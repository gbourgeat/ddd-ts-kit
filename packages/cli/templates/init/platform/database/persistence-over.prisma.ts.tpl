import { createPrismaEventSourcing, createPrismaUnitOfWork, PrismaOutboxStore, PrismaProcessedEventStore } from '@ddd-ts-kit/prisma';
import type { PrismaClient } from '{{alias.generated}}/prisma/client{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

/** The schema of the outbox and the processed events, as prisma/schema.prisma names it. */
const MESSAGING_SCHEMA = 'messaging';
/** The schema of the event store, as prisma/schema.prisma names it. */
const EVENT_STORE_SCHEMA = 'event_store';

/** One object is the unit of work and what repositories query through; the stores are told how to reach their model. */
export function persistenceOver(client: PrismaClient): Persistence {
  const unitOfWork = createPrismaUnitOfWork(client);

  return {
    unitOfWork,
    database: unitOfWork,
    outbox: new PrismaOutboxStore(unitOfWork, {
      delegate: (current) => current.outboxRecord,
      // Prisma Client has no row locking: the claim is the one raw statement of the store.
      claim: { strategy: 'skip-locked', dialect: 'postgresql', schema: MESSAGING_SCHEMA, raw: (current) => current },
    }),
    processedEvents: new PrismaProcessedEventStore(unitOfWork, { delegate: (current) => current.processedEvent }),
    eventSourcing: createPrismaEventSourcing(unitOfWork, { schema: EVENT_STORE_SCHEMA }),
    close: () => client.$disconnect(),
  };
}
