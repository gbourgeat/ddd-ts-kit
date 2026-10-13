import type { Knex } from 'knex';
{{#if queue.database}}
import {
  createKnexUnitOfWork,
  KnexJobStore,
  KnexOutboxStore,
  KnexProcessedEventStore,
  KnexProcessStore,
} from '@ddd-ts-kit/knex';
{{/if}}
{{#unless queue.database}}
import { createKnexUnitOfWork, KnexOutboxStore, KnexProcessedEventStore{{#if queue.processTable}}, KnexProcessStore{{/if}} } from '@ddd-ts-kit/knex';
{{/unless}}
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
import { MESSAGING } from '{{alias.platform}}/database/schema{{alias.ext}}';

/** One object is the unit of work and what repositories query through; the stores write in its transaction. */
export function persistenceOver(db: Knex, close: () => Promise<void>): Persistence {
  const unitOfWork = createKnexUnitOfWork(db);

  return {
    unitOfWork,
    database: unitOfWork,
{{#if tenancy.any}}
    outbox: new KnexOutboxStore(unitOfWork, { schema: MESSAGING, tenant: true }),
{{/if}}
{{#unless tenancy.any}}
    outbox: new KnexOutboxStore(unitOfWork, { schema: MESSAGING }),
{{/unless}}
    processedEvents: new KnexProcessedEventStore(unitOfWork, { schema: MESSAGING }),
    {{#if queue.database}}
    jobs: new KnexJobStore(unitOfWork, { schema: MESSAGING }),
    {{/if}}
    {{#if queue.processTable}}
    processes: new KnexProcessStore(unitOfWork, { schema: MESSAGING }),
    {{/if}}
    close,
  };
}
