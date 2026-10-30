{{#if audit.sql}}
import {
{{#if tenancy.any}}
  TenantAuditReader,
{{/if}}
  auditDecisions,
  auditGuardRefusals,
  auditIntegrationEvents,
  auditMiddleware,
  logLostRecords,
  type ArchivableAuditTrail,
  type AuditReader,
  type AuditSource,
  type AuditTrail,
  type GuardRefusalOfARoute,
} from '@ddd-ts-kit/audit';
{{/if}}
{{#if audit.memory}}
import {
{{#if tenancy.any}}
  TenantAuditReader,
{{/if}}
  auditDecisions,
  auditGuardRefusals,
  auditIntegrationEvents,
  auditMiddleware,
  logLostRecords,
  type ArchivableAuditTrail,
  type AuditReader,
  type AuditSource,
  type AuditTrail,
  type GuardRefusalOfARoute,
} from '@ddd-ts-kit/audit';
{{/if}}
import type { OnDecision } from '@ddd-ts-kit/auth';
import type { EventSubscription } from '@ddd-ts-kit/events';
import type { AuditRecord, BusMiddleware, Logger } from '@ddd-ts-kit/kernel';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
{{#if audit.route}}
import { auditPermissions } from '{{alias.platform}}/audit/audit.permissions{{alias.ext}}';
{{/if}}
import { auditedEvents } from '{{alias.platform}}/audit/audited-events{{alias.ext}}';
import { createAuditTrail } from '{{alias.platform}}/audit/create-audit-trail{{alias.ext}}';
{{#if audit.route}}
import { SearchAuditEntriesQuery } from '{{alias.platform}}/audit/search-audit-entries/search-audit-entries.query{{alias.ext}}';
{{/if}}

/** The name the audit trail consumes integration events under: its idempotency scope, and its queues behind a broker. */
const consumer = 'audit';

/**
 * The audit trail and its three sources. No use case writes to it: the entries come from the
 * authorization hook, from the buses and from a subscription to every integration event, and
 * each one carries the correlation id, the actor and the tenant of the execution scope.
 */
export interface Audit {
  /** The store of the entries: written by the three sources, searched, its oldest entries archived. */
  readonly trail: AuditTrail & AuditReader & ArchivableAuditTrail;
{{#if tenancy.any}}
  /**
   * The trail as the read side searches it: confined to the tenant of the work in progress,
   * whatever the filter or the actor says. Platform staff read across tenants only inside
   * `acrossTenants`, which records the elevation first; work in no tenant is refused.
   */
  readonly reader: AuditReader;
{{/if}}
  /** The `onDecision` hook of the authorization: who was allowed or refused what. */
  readonly decisions: OnDecision;
  /** The `onGuardRefusal` hook of the HTTP pipeline: who a guard refused at the edge, before any use case. */
  readonly refusals: (refusal: GuardRefusalOfARoute) => Promise<void>;
  /** On the command bus, before the unit of work: which command ran and how it ended. */
  readonly commands: BusMiddleware;
  /** On the query bus: whoever reads the trail leaves an entry in it. */
  readonly queries: BusMiddleware;
  /** One subscription per declared integration event: that it occurred, never its payload. */
  readonly subscriptions: readonly EventSubscription[];
  /** The name those subscriptions listen under. */
  readonly consumer: string;
  /** What a source outside this file passes on: a failure whose entry could not be written is told to the log. */
  readonly onLostRecord: (error: unknown, record: AuditRecord | undefined) => void;
}

export function createAudit(persistence: Persistence, source: AuditSource, logger: Logger): Audit {
  const trail = createAuditTrail({{#if audit.sql}}persistence{{/if}});
  const { unitOfWork, processedEvents } = persistence;
  const onLostRecord = logLostRecords(logger);

  return {
    trail,
{{#if tenancy.any}}
    reader: new TenantAuditReader(trail, source.scope),
{{/if}}
    refusals: auditGuardRefusals(trail, source),
{{#if audit.route}}
    decisions: auditDecisions(trail, { ...source, sensitivePermissions: [auditPermissions['trail.read'].id] }),
    // TODO(platform): declare what may go into `changes` with `fields: [auditedFields(SomeCommand, ['status'])]`; by default an entry carries identifiers and codes only.
    commands: auditMiddleware(trail, { ...source, unitOfWork, onLostRecord }),
    queries: auditMiddleware(trail, { ...source, queries: [SearchAuditEntriesQuery], onLostRecord }),
{{/if}}
{{#unless audit.route}}
    decisions: auditDecisions(trail, source),
    // TODO(platform): declare what may go into `changes` with `fields: [auditedFields(SomeCommand, ['status'])]`; by default an entry carries identifiers and codes only.
    commands: auditMiddleware(trail, { ...source, unitOfWork, onLostRecord }),
    queries: auditMiddleware(trail, { ...source, onLostRecord }),
{{/unless}}
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
    onLostRecord,
  };
}
