import { createPrismaUnitOfWork, PrismaOutboxStore, PrismaProcessedEventStore } from '@ddd-ts-kit/prisma';
import type { PrismaClient } from '{{alias.generated}}/prisma/client{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

/** One object is the unit of work and what repositories query through; the stores are told how to reach their model. */
export function persistenceOver(client: PrismaClient): Persistence {
  const unitOfWork = createPrismaUnitOfWork(client);

  return {
    unitOfWork,
    database: unitOfWork,
    outbox: new PrismaOutboxStore(unitOfWork, {
      delegate: (current) => current.outboxRecord,
      // Prisma Client has no row locking: the claim is the one raw statement of the store.
      claim: { strategy: 'skip-locked', dialect: 'postgresql', schema: 'messaging', raw: (current) => current },
    }),
    processedEvents: new PrismaProcessedEventStore(unitOfWork, { delegate: (current) => current.processedEvent }),
    close: () => client.$disconnect(),
  };
}
