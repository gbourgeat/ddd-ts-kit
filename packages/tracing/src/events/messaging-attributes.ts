import type { Attributes } from '@opentelemetry/api';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

/** The payload never becomes an attribute: only the routing key and the event id. */
export function messagingAttributes(operation: string, event: IntegrationEvent): Attributes {
  return {
    'messaging.operation': operation,
    'messaging.destination.name': event.type,
    'messaging.message.id': event.id,
  };
}
