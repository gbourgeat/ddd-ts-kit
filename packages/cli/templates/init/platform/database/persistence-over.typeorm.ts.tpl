import type { DataSource } from 'typeorm';
import { createTypeOrmEventSourcing, createTypeOrmUnitOfWork, TypeOrmOutboxStore, TypeOrmProcessedEventStore } from '@ddd-ts-kit/typeorm';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
import { EVENT_STORE_SCHEMA, outbox, processedEvents } from '{{alias.platform}}/database/schema{{alias.ext}}';

/** One object is the unit of work and what repositories query through; the stores write through its manager. */
export function persistenceOver(dataSource: DataSource): Persistence {
  const unitOfWork = createTypeOrmUnitOfWork(dataSource);

  return {
    unitOfWork,
    database: unitOfWork,
    outbox: new TypeOrmOutboxStore(unitOfWork, { entity: outbox }),
    processedEvents: new TypeOrmProcessedEventStore(unitOfWork, { entity: processedEvents }),
    eventSourcing: createTypeOrmEventSourcing(unitOfWork, { schema: EVENT_STORE_SCHEMA }),
    close: async () => {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    },
  };
}
