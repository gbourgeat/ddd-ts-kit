import { systemActor } from '../actor/system-actor';
import { type ExecutionContext, executionContext } from '../execution/execution-context';
import type { EventExecutionOptions } from './event-execution-options';
import type { IntegrationEvent } from './integration-event';

/**
 * The execution context of a consumed event: origin `event`, the correlation of the event (its
 * own id when it names none, which starts a new chain), the event as the direct cause, and the
 * tenant the event belongs to, so the consumer reads and writes in that tenant only.
 */
export function executionContextOfEvent(event: IntegrationEvent, options: EventExecutionOptions): ExecutionContext {
  return executionContext({
    correlationId: event.correlationId ?? event.id,
    causationId: event.id,
    actor: options.actorOf?.(event) ?? systemActor(options.consumer),
    origin: 'event',
    ...(event.tenantId === undefined ? {} : { tenantId: event.tenantId }),
  });
}
