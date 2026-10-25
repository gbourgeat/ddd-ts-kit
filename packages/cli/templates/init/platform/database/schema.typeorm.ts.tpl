{{#if audit.on}}
import { auditEntities } from '@ddd-ts-kit/audit/typeorm';
{{/if}}
import type { EntitySchema } from 'typeorm';
import { {{#if eventSourcing.on}}eventStoreEntities, {{/if}}{{#if queue.database}}jobEntity, {{/if}}outboxEntity, processedEventEntity{{#if queue.processTable}}, processEntity{{/if}} } from '@ddd-ts-kit/typeorm';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/** The schema of what the kit stores for the application: the outbox and the processed events{{#if queue.processTable}}, the background work{{/if}}. */
export const MESSAGING_SCHEMA = 'messaging';

{{#if tenancy.any}}
// The tenant of each event, so that its consumers run in that tenant.
export const outbox = outboxEntity({ schema: MESSAGING_SCHEMA, tenant: true });
{{/if}}
{{#unless tenancy.any}}
export const outbox = outboxEntity({ schema: MESSAGING_SCHEMA });
{{/unless}}
export const processedEvents = processedEventEntity({ schema: MESSAGING_SCHEMA });
{{#if queue.database}}
/** The background jobs, enqueued in the transaction of the command that asks for them. */
export const jobs = jobEntity({ schema: MESSAGING_SCHEMA });
{{/if}}
{{#if queue.processTable}}
/** The instances of the process managers, saved in the transaction of each step. */
export const processes = processEntity({ schema: MESSAGING_SCHEMA });
{{/if}}

{{#if eventSourcing.on}}
/** The schema of the event store: the events, the snapshots, the checkpoints and the keys of the data subjects. It records no tenant. */
export const EVENT_STORE_SCHEMA = 'event_store';

/** The five tables of the event store, registered with the data source and migrated like the others. */
export const eventStore = eventStoreEntities({ schema: EVENT_STORE_SCHEMA });

{{/if}}
{{#if audit.on}}
/** The schema of the audit trail. */
export const AUDIT_SCHEMA = 'audit';

// TODO(platform): TypeORM generates no trigger. After the first `npm run db:generate migrations/<name>`, add a migration of your own that runs the statements `npm run db:audit-guard` prints: they make the entries refuse UPDATE, DELETE and TRUNCATE.
export const auditTrail = auditEntities({ schema: AUDIT_SCHEMA });

{{/if}}
/** Every table of the application: what the data source registers and what migrations are generated from. */
export const entities: readonly EntitySchema[] = [
  outbox,
  processedEvents,
  {{#if queue.database}}
  jobs,
  {{/if}}
  {{#if queue.processTable}}
  processes,
  {{/if}}
  {{#if eventSourcing.on}}
  ...eventStore,
  {{/if}}
  {{#if audit.on}}
  ...auditTrail,
  {{/if}}
  // ddd-ts-kit:schemas
  // /ddd-ts-kit:schemas
];
