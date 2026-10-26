{{#if queue.database}}
import {
{{#if eventSourcing.on}}
  createKnexEventSourcing,
{{/if}}
  createKnexUnitOfWork,
  KnexJobStore,
  KnexOutboxStore,
  KnexProcessedEventStore,
  KnexProcessStore,
} from '@ddd-ts-kit/knex';
{{/if}}
{{#unless queue.database}}
{{#if eventSourcing.on}}
import {
  createKnexEventSourcing,
  createKnexUnitOfWork,
  KnexOutboxStore,
  KnexProcessedEventStore,
{{#if queue.processTable}}
  KnexProcessStore,
{{/if}}
} from '@ddd-ts-kit/knex';
{{/if}}
{{#unless eventSourcing.on}}
import { createKnexUnitOfWork, KnexOutboxStore, KnexProcessedEventStore{{#if queue.processTable}}, KnexProcessStore{{/if}} } from '@ddd-ts-kit/knex';
{{/unless}}
{{/unless}}
import type { DatabaseConnection } from '{{alias.platform}}/database/connect-to-database{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
import { {{#if eventSourcing.on}}EVENT_STORE_SCHEMA, {{/if}}MESSAGING_SCHEMA } from '{{alias.platform}}/database/schema{{alias.ext}}';

/** One object is the unit of work and what repositories query through; the stores write in its transaction. */
export function persistenceOver(connection: DatabaseConnection): Persistence {
  const unitOfWork = createKnexUnitOfWork(connection.db);

  return {
    unitOfWork,
    database: unitOfWork,
{{#if tenancy.any}}
    outbox: new KnexOutboxStore(unitOfWork, { schema: MESSAGING_SCHEMA, tenant: true }),
{{/if}}
{{#unless tenancy.any}}
    outbox: new KnexOutboxStore(unitOfWork, { schema: MESSAGING_SCHEMA }),
{{/unless}}
    processedEvents: new KnexProcessedEventStore(unitOfWork, { schema: MESSAGING_SCHEMA }),
    {{#if queue.database}}
    jobs: new KnexJobStore(unitOfWork, { schema: MESSAGING_SCHEMA }),
    {{/if}}
    {{#if queue.processTable}}
    processes: ({{#if tenancy.any}}tenant{{/if}}) => new KnexProcessStore(unitOfWork, { schema: MESSAGING_SCHEMA{{#if tenancy.any}}, tenant{{/if}} }),
    {{/if}}
    {{#if eventSourcing.on}}
{{#if tenancy.any}}
    eventSourcing: (scope) => createKnexEventSourcing(unitOfWork, { schema: EVENT_STORE_SCHEMA, scope }),
{{/if}}
{{#unless tenancy.any}}
    eventSourcing: createKnexEventSourcing(unitOfWork, { schema: EVENT_STORE_SCHEMA }),
{{/unless}}
    {{/if}}
    close: () => connection.close(),
  };
}
