import type { OutboxStore } from '@ddd-ts-kit/events';
import type { ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import { createTypeOrmUnitOfWork, TypeOrmOutboxStore, TypeOrmProcessedEventStore } from '@ddd-ts-kit/typeorm';
import { createDataSource, type Database, type DatabaseContext } from './database.js';
import { outbox, processedEvents } from './schema.js';

/** Where state lives and how a command is made atomic. Everything else receives these ports. */
export interface Persistence {
  readonly unitOfWork: UnitOfWork;
  readonly outbox: OutboxStore;
  readonly processedEvents: ProcessedEventStore;
  /** What repositories query through: the manager of the current unit of work, or of the data source. */
  readonly database: DatabaseContext;
  close(): Promise<void>;
}

export async function openPersistence(config: { readonly databaseUrl: string }): Promise<Persistence> {
  const dataSource = createDataSource(config.databaseUrl);
  await dataSource.initialize();
  return persistenceOver(dataSource);
}

{{#if http.any}}
/**
 * For the script that only lists routes: the data source is never initialised,
 * and no query is ever sent, so no database has to be reachable to generate the contracts.
 */
export function inertPersistence(): Persistence {
  return persistenceOver(createDataSource('postgres://unused:unused@127.0.0.1:1/unused'));
}
{{/if}}

export function persistenceOver(dataSource: Database): Persistence {
  const unitOfWork = createTypeOrmUnitOfWork(dataSource);
  return {
    unitOfWork,
    database: unitOfWork,
    outbox: new TypeOrmOutboxStore(unitOfWork, { entity: outbox }),
    processedEvents: new TypeOrmProcessedEventStore(unitOfWork, { entity: processedEvents }),
    close: async () => {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    },
  };
}
