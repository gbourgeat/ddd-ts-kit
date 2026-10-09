import type { Clock, ExecutionContext, ExecutionScope, IdGenerator } from '@ddd-ts-kit/kernel';
import type { AuditActor, AuditEntry, AuditRecord } from './entry.js';

/** What every source reads instead of being handed parameters by the use cases. */
export interface AuditSource {
  readonly scope: ExecutionScope;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/** What happened. Who, in which session and under which correlation come from the scope. */
export type AuditFact = Pick<AuditEntry, 'category' | 'action' | 'outcome'> &
  Partial<Pick<AuditEntry, 'reason' | 'resource' | 'context' | 'changes' | 'extensions'>>;

/**
 * The record of a fact that happened in the work in progress. Sources use it, and so does
 * infrastructure writing a `data-access` entry by hand. Throws `NoExecutionContextError`
 * outside of `ExecutionScope.run`.
 */
export function auditRecordOf(source: AuditSource, fact: AuditFact): AuditRecord {
  return recordIn(source.scope.require(), source, fact);
}

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
