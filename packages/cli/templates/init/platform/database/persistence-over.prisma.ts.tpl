{{#if queue.processTable}}
import {
{{#if eventSourcing.on}}
  createPrismaEventSourcing,
{{/if}}
  createPrismaUnitOfWork,
  {{#if queue.database}}
  PrismaJobStore,
  {{/if}}
  PrismaOutboxStore,
  PrismaProcessedEventStore,
  PrismaProcessStore,
} from '@ddd-ts-kit/prisma';
{{/if}}
{{#unless queue.processTable}}
{{#if eventSourcing.on}}
import {
  createPrismaEventSourcing,
  createPrismaUnitOfWork,
  PrismaOutboxStore,
  PrismaProcessedEventStore,
} from '@ddd-ts-kit/prisma';
{{/if}}
{{#unless eventSourcing.on}}
import { createPrismaUnitOfWork, PrismaOutboxStore, PrismaProcessedEventStore } from '@ddd-ts-kit/prisma';
{{/unless}}
{{/unless}}
import type { PrismaClient } from '{{alias.generated}}/prisma/client{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

/** The schema of the messaging tables{{#if queue.processTable}} and of the background work{{/if}}, as prisma/schema/schema.prisma names it. */
const MESSAGING_SCHEMA = 'messaging';
{{#if eventSourcing.on}}
/** The schema of the event store, as prisma/schema/schema.prisma names it. */
const EVENT_STORE_SCHEMA = 'event_store';
{{/if}}

/** One object is the unit of work and what repositories query through; the stores are told how to reach their model. */
export function persistenceOver(client: PrismaClient): Persistence {
  const unitOfWork = createPrismaUnitOfWork(client);

  return {
    unitOfWork,
    database: unitOfWork,
    outbox: new PrismaOutboxStore(unitOfWork, {
      delegate: (current) => current.outboxRecord,
      // Prisma Client has no row locking: the claim is the one raw statement of the store.
      claim: { strategy: 'skip-locked', dialect: 'postgresql', schema: MESSAGING_SCHEMA, raw: (current) => current },
{{#if tenancy.any}}
      // The tenant of each event, so that its consumers run in that tenant.
      tenant: true,
{{/if}}
    }),
    processedEvents: new PrismaProcessedEventStore(unitOfWork, { delegate: (current) => current.processedEvent }),
    {{#if queue.database}}
    // The claim of the jobs is a raw statement: it names the schema of the table.
    jobs: new PrismaJobStore(unitOfWork, { delegate: (current) => current.backgroundJob, schema: MESSAGING_SCHEMA }),
    {{/if}}
    {{#if queue.processTable}}
    {{#if tenancy.any}}
    processes: (tenant) =>
      new PrismaProcessStore(unitOfWork, { delegate: (current) => current.processInstance, tenant }),
    {{/if}}
    {{#unless tenancy.any}}
    processes: () => new PrismaProcessStore(unitOfWork, { delegate: (current) => current.processInstance }),
    {{/unless}}
    {{/if}}
    {{#if eventSourcing.on}}
{{#if tenancy.any}}
    eventSourcing: (scope) => createPrismaEventSourcing(unitOfWork, { schema: EVENT_STORE_SCHEMA, scope }),
{{/if}}
{{#unless tenancy.any}}
    eventSourcing: createPrismaEventSourcing(unitOfWork, { schema: EVENT_STORE_SCHEMA }),
{{/unless}}
    {{/if}}
    close: () => client.$disconnect(),
  };
}
