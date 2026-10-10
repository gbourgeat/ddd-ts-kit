{{#if audit.sql}}
import { auditDecisions, auditIntegrationEvents, auditMiddleware, type AuditReader, type AuditSource, type AuditTrail } from '@ddd-ts-kit/audit';
{{/if}}
{{#if audit.memory}}
import { InMemoryAuditTrail, auditDecisions, auditIntegrationEvents, auditMiddleware, type AuditReader, type AuditSource, type AuditTrail } from '@ddd-ts-kit/audit';
{{/if}}
{{#if audit.knex}}
import { KnexAuditTrail } from '@ddd-ts-kit/audit/knex';
{{/if}}
{{#if audit.drizzle}}
import { DrizzleAuditTrail } from '@ddd-ts-kit/audit/drizzle';
{{/if}}
import type { OnDecision } from '@ddd-ts-kit/auth';
import type { EventSubscription } from '@ddd-ts-kit/events';
import type { BusMiddleware } from '@ddd-ts-kit/kernel';
import type { Persistence } from '../database/persistence.js';
{{#if audit.sql}}
import { AUDIT_SCHEMA } from '../database/schema.js';
{{/if}}
{{#if audit.route}}
import { auditPermissions } from './audit.permissions.js';
{{/if}}
import { auditedEvents } from './audited-events.js';
{{#if audit.route}}
import { ListAuditEntriesQuery } from './list-audit-entries.query.js';
{{/if}}

/** The name the audit trail consumes integration events under: its idempotency scope, and its queues behind a broker. */
const consumer = 'audit';

/**
 * The audit trail and its three sources. No use case writes to it: the entries come from the
 * authorization hook, from the buses and from a subscription to every integration event, and
 * each one carries the correlation id, the actor and the tenant of the execution scope.
 */
export interface Audit {
  readonly trail: AuditTrail & AuditReader;
  /** The `onDecision` hook of the authorization: who was allowed or refused what. */
  readonly decisions: OnDecision;
  /** On the command bus, before the unit of work: which command ran and how it ended. */
  readonly commands: BusMiddleware;
  /** On the query bus: whoever reads the trail leaves an entry in it. */
  readonly queries: BusMiddleware;
  /** One subscription per declared integration event: that it occurred, never its payload. */
  readonly subscriptions: readonly EventSubscription[];
  /** The name those subscriptions listen under. */
  readonly consumer: string;
}

export function createAudit(persistence: Persistence, source: AuditSource): Audit {
  const trail = createAuditTrail({{#if audit.sql}}persistence{{/if}});
  const { unitOfWork, processedEvents } = persistence;

  return {
    trail,
{{#if audit.route}}
    decisions: auditDecisions(trail, { ...source, sensitivePermissions: [auditPermissions['trail.read'].id] }),
    // TODO(platform): declare what may go into `changes` with `fields: [auditedFields(SomeCommand, ['status'])]`; by default an entry carries identifiers and codes only.
    commands: auditMiddleware(trail, { ...source, unitOfWork }),
    queries: auditMiddleware(trail, { ...source, queries: [ListAuditEntriesQuery] }),
{{/if}}
{{#unless audit.route}}
    decisions: auditDecisions(trail, source),
    // TODO(platform): declare what may go into `changes` with `fields: [auditedFields(SomeCommand, ['status'])]`; by default an entry carries identifiers and codes only.
    commands: auditMiddleware(trail, { ...source, unitOfWork }),
    queries: auditMiddleware(trail, source),
{{/unless}}
    subscriptions: auditIntegrationEvents(trail, { registry: auditedEvents, clock: source.clock, ids: source.ids, processed: processedEvents, unitOfWork, scope: source.scope, consumer }),
    consumer,
  };
}

{{#if audit.knex}}
function createAuditTrail(persistence: Persistence): AuditTrail & AuditReader {
  return new KnexAuditTrail(persistence.database, { schema: AUDIT_SCHEMA });
}
{{/if}}
{{#if audit.drizzle}}
function createAuditTrail(persistence: Persistence): AuditTrail & AuditReader {
  return new DrizzleAuditTrail(persistence.database, { schema: AUDIT_SCHEMA });
}
{{/if}}
{{#if audit.memory}}
// TODO(platform): the audit package stores on knex and drizzle only: write an adapter of AuditTrail and AuditReader for your storage, hold it to `auditTrailContract` of @ddd-ts-kit/audit/testing and answer it here. Until then the entries live in the memory of the process and are lost when it stops.
function createAuditTrail(): AuditTrail & AuditReader {
  return new InMemoryAuditTrail();
}
{{/if}}
