import { systemActor } from '../actor/system-actor.js';
import { type ExecutionContext, executionContext } from '../execution/execution-context.js';
import type { EventExecutionOptions } from './event-execution-options.js';
import type { IntegrationEvent } from './integration-event.js';

/**
 * The execution context of a consumed event: origin `event`, the correlation of the event (its
 * own id when it names none, which starts a new chain), and the event as the direct cause.
 */
export function executionContextOfEvent(
  event: IntegrationEvent,
  options: EventExecutionOptions,
): ExecutionContext {
  return executionContext({
    correlationId: event.correlationId ?? event.id,
    causationId: event.id,
    actor: options.actorOf?.(event) ?? systemActor(options.consumer),
    origin: 'event',
  });
}
