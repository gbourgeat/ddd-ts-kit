import type { ExecutionContext } from '../execution/execution-context';
import type { ExecutionScope } from '../ports/execution-scope';
import type { IntegrationEventPublisher } from '../ports/integration-event-publisher';
import type { IntegrationEvent } from './integration-event';
import { messagingSystemOf } from './messaging-system-of';

/**
 * Decorates a publisher: an event published without `correlationId` takes the one of the work
 * in progress, so everything one stimulus causes can be found again, and one without `tenantId`
 * the tenant of that work, so its consumers run in the same tenant. What an event names is
 * kept, and outside of any execution context nothing is stamped. The name of the transport
 * (`messagingSystem`) is passed on.
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
  if (context === undefined) {
    return event;
  }

  const { correlationId, tenantId } = context;

  return {
    ...event,
    ...(event.correlationId === undefined ? { correlationId } : {}),
    ...(event.tenantId === undefined && tenantId !== undefined ? { tenantId } : {}),
  };
}
