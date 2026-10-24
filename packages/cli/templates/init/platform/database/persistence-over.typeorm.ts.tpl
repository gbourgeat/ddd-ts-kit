import type { DataSource } from 'typeorm';
{{#if eventSourcing.on}}
import {
  createTypeOrmEventSourcing,
  createTypeOrmUnitOfWork,
  TypeOrmOutboxStore,
  TypeOrmProcessedEventStore,
} from '@ddd-ts-kit/typeorm';
{{/if}}
{{#unless eventSourcing.on}}
import { createTypeOrmUnitOfWork, TypeOrmOutboxStore, TypeOrmProcessedEventStore } from '@ddd-ts-kit/typeorm';
{{/unless}}
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
import { {{#if eventSourcing.on}}EVENT_STORE_SCHEMA, {{/if}}outbox, processedEvents } from '{{alias.platform}}/database/schema{{alias.ext}}';

/** One object is the unit of work and what repositories query through; the stores write through its manager. */
export function persistenceOver(dataSource: DataSource): Persistence {
  const unitOfWork = createTypeOrmUnitOfWork(dataSource);

  return {
    unitOfWork,
    database: unitOfWork,
    outbox: new TypeOrmOutboxStore(unitOfWork, { entity: outbox }),
    processedEvents: new TypeOrmProcessedEventStore(unitOfWork, { entity: processedEvents }),
    {{#if eventSourcing.on}}
    eventSourcing: createTypeOrmEventSourcing(unitOfWork, { schema: EVENT_STORE_SCHEMA }),
    {{/if}}
    close: async () => {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    },
  };
}
