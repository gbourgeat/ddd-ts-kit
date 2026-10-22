import type { AuditActor, AuditRecord, ExecutionContext } from '@ddd-ts-kit/kernel';
import type { AuditFact } from './audit-fact';
import type { AuditSource } from './audit-source';

export function recordIn(context: ExecutionContext, source: Omit<AuditSource, 'scope'>, fact: AuditFact): AuditRecord {
  const session = context.session;

  return {
    id: source.ids.next(),
    occurredAt: source.clock.now(),
    ...fact,
    actor: auditActorOf(context),
    ...(context.tenantId === undefined ? {} : { tenantId: context.tenantId }),
    ...(session?.impersonatedBy === undefined ? {} : { impersonatedBy: session.impersonatedBy }),
    ...(session === undefined ? {} : { sessionId: session.id }),
    correlationId: context.correlationId,
    ...(context.causationId === undefined ? {} : { causationId: context.causationId }),
    origin: context.origin,
  };
}

function auditActorOf({ actor }: ExecutionContext): AuditActor {
  return { id: actor.id, type: actor.type, ...(actor.tenantId === undefined ? {} : { tenantId: actor.tenantId }) };
}
