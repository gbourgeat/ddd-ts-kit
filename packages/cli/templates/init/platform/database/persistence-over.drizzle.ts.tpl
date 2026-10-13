import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
{{#if queue.processTable}}
import {
  createDrizzleUnitOfWork,
  {{#if queue.database}}
  DrizzleJobStore,
  {{/if}}
  DrizzleOutboxStore,
  DrizzleProcessedEventStore,
  DrizzleProcessStore,
} from '@ddd-ts-kit/drizzle/postgres';
{{/if}}
{{#unless queue.processTable}}
import { createDrizzleUnitOfWork, DrizzleOutboxStore, DrizzleProcessedEventStore } from '@ddd-ts-kit/drizzle/postgres';
{{/unless}}
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
import { {{#if queue.database}}jobs, {{/if}}outbox, processedEvents{{#if queue.processTable}}, processes{{/if}} } from '{{alias.platform}}/database/schema{{alias.ext}}';

/** One object is the unit of work and what repositories query through; the stores write in its transaction. */
export function persistenceOver(db: PgDatabase<PgQueryResultHKT>, close: () => Promise<void>): Persistence {
  const unitOfWork = createDrizzleUnitOfWork(db);

  return {
    unitOfWork,
    database: unitOfWork,
    outbox: new DrizzleOutboxStore(unitOfWork, { table: outbox }),
    processedEvents: new DrizzleProcessedEventStore(unitOfWork, { table: processedEvents }),
    {{#if queue.database}}
    jobs: new DrizzleJobStore(unitOfWork, jobs),
    {{/if}}
    {{#if queue.processTable}}
    processes: new DrizzleProcessStore(unitOfWork, processes),
    {{/if}}
    close,
  };
}
