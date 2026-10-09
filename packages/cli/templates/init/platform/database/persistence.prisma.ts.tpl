import type { OutboxStore } from '@ddd-ts-kit/events';
import type { ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import { createPrismaUnitOfWork, PrismaOutboxStore, PrismaProcessedEventStore } from '@ddd-ts-kit/prisma';
import { createClient, type Database, type DatabaseContext } from './database.js';

/** Where state lives and how a command is made atomic. Everything else receives these ports. */
export interface Persistence {
  readonly unitOfWork: UnitOfWork;
  readonly outbox: OutboxStore;
  readonly processedEvents: ProcessedEventStore;
  /** What repositories query through: the transaction client of the current unit of work, or the root client. */
  readonly database: DatabaseContext;
  close(): Promise<void>;
}

export async function openPersistence(config: { readonly databaseUrl: string }): Promise<Persistence> {
  const client = createClient(config.databaseUrl);
  await client.$connect();
  return persistenceOver(client);
}

{{#if persistence.inert}}
/**
 * For the script that only lists routes: the client connects on the first query,
 * and none is ever sent, so no database has to be reachable to generate the contracts.
 */
export function inertPersistence(): Persistence {
  return persistenceOver(createClient('postgres://unused:unused@127.0.0.1:1/unused'));
}
{{/if}}

export function persistenceOver(client: Database): Persistence {
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
