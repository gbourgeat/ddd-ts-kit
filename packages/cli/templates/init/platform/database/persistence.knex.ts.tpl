import type { OutboxStore } from '@ddd-ts-kit/events';
import type { ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import { createKnexUnitOfWork, KnexOutboxStore, KnexProcessedEventStore } from '@ddd-ts-kit/knex';
import { connectToDatabase, type Database, type DatabaseContext } from './database.js';
import { MESSAGING } from './schema.js';

/** Where state lives and how a command is made atomic. Everything else receives these ports. */
export interface Persistence {
  readonly unitOfWork: UnitOfWork;
  readonly outbox: OutboxStore;
  readonly processedEvents: ProcessedEventStore;
  /** What repositories query through: the transaction of the current unit of work, or the database. */
  readonly database: DatabaseContext;
  close(): Promise<void>;
}

export function openPersistence(config: { readonly databaseUrl: string }): Persistence {
  const connection = connectToDatabase(config.databaseUrl);
  return persistenceOver(connection.db, () => connection.close());
}

{{#if http.any}}
/**
 * For the script that only lists routes: the pool connects on the first query,
 * and none is ever sent, so no database has to be reachable to generate the contracts.
 */
export function inertPersistence(): Persistence {
  return openPersistence({ databaseUrl: 'postgres://unused:unused@127.0.0.1:1/unused' });
}
{{/if}}

export function persistenceOver(db: Database, close: () => Promise<void>): Persistence {
  const unitOfWork = createKnexUnitOfWork(db);
  return {
    unitOfWork,
    database: unitOfWork,
    outbox: new KnexOutboxStore(unitOfWork, { schema: MESSAGING }),
    processedEvents: new KnexProcessedEventStore(unitOfWork, { schema: MESSAGING }),
    close,
  };
}
