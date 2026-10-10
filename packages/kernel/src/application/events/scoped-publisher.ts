import type { ExecutionContext } from '../execution/execution-context.js';
import type { ExecutionScope } from '../ports/execution-scope.js';
import type { IntegrationEventPublisher } from '../ports/integration-event-publisher.js';
import type { IntegrationEvent } from './integration-event.js';
import { messagingSystemOf } from './messaging-system-of.js';

/**
 * Decorates a publisher: an event published without `correlationId` takes the one of the work
 * in progress, so everything one stimulus causes can be found again. An event that names its
 * correlation keeps it, and outside of any execution context nothing is stamped. The name of
 * the transport (`messagingSystem`) is passed on.
 */
export function scopedPublisher(
  publisher: IntegrationEventPublisher,
  scope: ExecutionScope,
): IntegrationEventPublisher {
  const messagingSystem = messagingSystemOf(publisher);

  return {
    publish: (events) => publisher.publish(events.map((event) => correlated(event, scope.current()))),
    ...(messagingSystem === undefined ? {} : { messagingSystem }),
  };
}

function correlated(event: IntegrationEvent, context: ExecutionContext | undefined): IntegrationEvent {
  if (event.correlationId !== undefined || context === undefined) {
    return event;
  }

  return { ...event, correlationId: context.correlationId };
}
