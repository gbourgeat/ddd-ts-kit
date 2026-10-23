import {
  TenantAuditReader,
  auditDecisions,
  auditGuardRefusals,
  auditIntegrationEvents,
  auditMiddleware,
  auditedSubjectKeys,
  type AuditReader,
  type AuditSource,
  type AuditTrail,
  type GuardRefusalOfARoute,
} from '@ddd-ts-kit/audit';
import { KnexAuditTrail } from '@ddd-ts-kit/audit/knex';
import type { OnDecision } from '@ddd-ts-kit/auth';
import type { EventSubscription } from '@ddd-ts-kit/events';
import { acrossTenants, type BusMiddleware, type SubjectKeyStore, type TenantElevation } from '@ddd-ts-kit/kernel';
import type { Persistence } from '@/platform/database/persistence';
import { AUDIT_SCHEMA } from '@/platform/database/schema';
import { auditPermissions } from '@/platform/audit/audit.permissions';
import { auditedEvents } from '@/platform/audit/audited-events';
import { SearchAuditEntriesQuery } from '@/platform/audit/search-audit-entries/search-audit-entries.query';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';

/** Reading the trail, and reading a document that may hold health data: every allowed access is recorded. */
const SENSITIVE_READS = [auditPermissions['trail.read'].id, schedulingPermissions['appointment.read-document'].id];

/** The name the audit trail consumes integration events under: its idempotency scope, and its queues behind a broker. */
const consumer = 'audit';

/**
 * The audit trail and its sources. No use case writes to it: the entries come from the
 * authorization hook, from the buses, from a subscription to every integration event and from
 * the key store of the data subjects, and each one carries the correlation id, the actor and the
 * tenant of the execution scope.
 */
export interface Audit {
  readonly trail: AuditTrail & AuditReader;
  /**
   * The trail as the read side searches it: confined to the network of the work in progress,
   * whatever the filter or the actor says. Platform staff read across networks only inside
   * `elevate`; work in no network reads nothing.
   */
  readonly reader: AuditReader;
  /** How platform staff reach networks that are not theirs: the elevation is written to the trail before the work runs. */
  readonly elevate: <T>(elevation: TenantElevation, work: () => Promise<T>) => Promise<T>;
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
  /** The keys of the data subjects: every erasure, whoever asks for it, leaves an entry with its date. */
  readonly subjectKeys: SubjectKeyStore;
}

export function createAudit(persistence: Persistence, source: AuditSource): Audit {
  const trail = createAuditTrail(persistence);
  const { unitOfWork, processedEvents } = persistence;

  return {
    trail,
    reader: new TenantAuditReader(trail, source.scope),
    elevate: (elevation, work) => acrossTenants({ ...source, trail }, elevation, work),
    refusals: auditGuardRefusals(trail, source),
    decisions: auditDecisions(trail, { ...source, sensitivePermissions: SENSITIVE_READS }),
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
    subjectKeys: auditedSubjectKeys(persistence.eventSourcing.subjectKeys, trail, source),
  };
}

function createAuditTrail(persistence: Persistence): AuditTrail & AuditReader {
  return new KnexAuditTrail(persistence.database, { schema: AUDIT_SCHEMA });
}
