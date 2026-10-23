import type { AuditEntry } from '@ddd-ts-kit/audit';
import type { AuditEntryView } from '@/platform/audit/search-audit-entries/audit-entry-view';

/** An entry as the endpoint answers it: dates written, the actor and the resource flattened, nothing optional left undefined. */
export function auditEntryViewOf(source: AuditEntry): AuditEntryView {
  const { actor, resource } = source;

  return {
    id: source.id,
    chain: source.chain,
    sequence: source.sequence,
    occurredAt: source.occurredAt.toISOString(),
    category: source.category,
    action: source.action,
    outcome: source.outcome,
    ...(source.reason === undefined ? {} : { reason: source.reason }),
    actorId: actor.id,
    actorType: actor.type,
    ...(source.impersonatedBy === undefined ? {} : { impersonatedBy: source.impersonatedBy }),
    ...(source.tenantId === undefined ? {} : { tenantId: source.tenantId }),
    ...(resource === undefined ? {} : { resourceType: resource.type, resourceId: resource.id }),
    ...(source.context === undefined ? {} : { context: source.context }),
    correlationId: source.correlationId,
    ...(source.causationId === undefined ? {} : { causationId: source.causationId }),
    origin: source.origin,
    previousHash: source.previousHash,
    hash: source.hash,
  };
}
