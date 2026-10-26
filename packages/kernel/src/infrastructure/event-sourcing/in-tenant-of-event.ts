import type { StoredEvent } from '../../application/event-sourcing/stored-event';
import { systemActor } from '../../application/actor/system-actor';
import { executionContext } from '../../application/execution/execution-context';
import type { ExecutionScope } from '../../application/ports/execution-scope';

/**
 * Applies a stored event in the tenant of its stream, as a consumer of the outbox runs in the
 * tenant of the event it consumes: a context of origin `event`, acting as the system for the
 * subscriber, correlated with the event. Without a scope, or for an event of a stream that
 * recorded no tenant, the event is applied as it comes.
 */
export function inTenantOfEvent<T>(
  scope: ExecutionScope | undefined,
  subscriber: string,
  event: StoredEvent,
  work: () => Promise<T>,
): Promise<T> {
  if (scope === undefined || event.tenantId === undefined) {
    return work();
  }

  const correlationId = event.metadata['correlationId'];

  return scope.run(
    executionContext({
      correlationId: typeof correlationId === 'string' ? correlationId : event.id,
      causationId: event.id,
      actor: systemActor(subscriber),
      origin: 'event',
      tenantId: event.tenantId,
    }),
    work,
  );
}
