import type { DataSource } from 'typeorm';
{{#if queue.processTable}}
import {
{{#if eventSourcing.on}}
  createTypeOrmEventSourcing,
{{/if}}
  createTypeOrmUnitOfWork,
  {{#if queue.database}}
  TypeOrmJobStore,
  {{/if}}
  TypeOrmOutboxStore,
  TypeOrmProcessedEventStore,
  TypeOrmProcessStore,
} from '@ddd-ts-kit/typeorm';
{{/if}}
{{#unless queue.processTable}}
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
{{/unless}}
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
import { {{#if eventSourcing.on}}EVENT_STORE_SCHEMA, {{/if}}{{#if queue.database}}jobs, {{/if}}outbox, processedEvents{{#if queue.processTable}}, processes{{/if}} } from '{{alias.platform}}/database/schema{{alias.ext}}';

/** One object is the unit of work and what repositories query through; the stores write through its manager. */
export function persistenceOver(dataSource: DataSource): Persistence {
  const unitOfWork = createTypeOrmUnitOfWork(dataSource);

  return {
    unitOfWork,
    database: unitOfWork,
    outbox: new TypeOrmOutboxStore(unitOfWork, { entity: outbox }),
    processedEvents: new TypeOrmProcessedEventStore(unitOfWork, { entity: processedEvents }),
    {{#if queue.database}}
    jobs: new TypeOrmJobStore(unitOfWork, { entity: jobs }),
    {{/if}}
    {{#if queue.processTable}}
    processes: ({{#if tenancy.any}}tenant{{/if}}) => new TypeOrmProcessStore(unitOfWork, { entity: processes{{#if tenancy.any}}, tenant{{/if}} }),
    {{/if}}
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
