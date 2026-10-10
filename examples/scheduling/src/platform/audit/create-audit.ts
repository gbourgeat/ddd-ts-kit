import {
  auditDecisions,
  auditIntegrationEvents,
  auditMiddleware,
  type AuditReader,
  type AuditSource,
  type AuditTrail,
} from '@ddd-ts-kit/audit';
import { KnexAuditTrail } from '@ddd-ts-kit/audit/knex';
import type { OnDecision } from '@ddd-ts-kit/auth';
import type { EventSubscription } from '@ddd-ts-kit/events';
import type { BusMiddleware } from '@ddd-ts-kit/kernel';
import type { Persistence } from '#src/platform/database/persistence.js';
import { AUDIT_SCHEMA } from '#src/platform/database/schema.js';
import { auditPermissions } from '#src/platform/audit/audit.permissions.js';
import { auditedEvents } from '#src/platform/audit/audited-events.js';
import { SearchAuditEntriesQuery } from '#src/platform/audit/search-audit-entries.query.js';

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
  const trail = createAuditTrail(persistence);
  const { unitOfWork, processedEvents } = persistence;

  return {
    trail,
    decisions: auditDecisions(trail, { ...source, sensitivePermissions: [auditPermissions['trail.read'].id] }),
    // TODO(platform): declare what may go into `changes` with `fields: [auditedFields(SomeCommand, ['status'])]`; by default an entry carries identifiers and codes only.
    commands: auditMiddleware(trail, { ...source, unitOfWork }),
    queries: auditMiddleware(trail, { ...source, queries: [SearchAuditEntriesQuery] }),
    subscriptions: auditIntegrationEvents(trail, {
      registry: auditedEvents,
      clock: source.clock,
      ids: source.ids,
      processed: processedEvents,
      unitOfWork,
      scope: source.scope,
      consumer,
    }),
    consumer,
  };
}

function createAuditTrail(persistence: Persistence): AuditTrail & AuditReader {
  return new KnexAuditTrail(persistence.database, { schema: AUDIT_SCHEMA });
}
