import type { Attributes } from '@opentelemetry/api';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

export interface MessagingOperation {
  /** What the kit calls it: `publish`, `append`, `process`. */
  readonly name: string;
  /** The operation type of the messaging conventions: `send`, `create`, `process`. */
  readonly type: string;
  readonly system?: string | undefined;
}

/** The payload never becomes an attribute: only the routing key and the event id. */
export function messagingAttributes(operation: MessagingOperation, event: IntegrationEvent): Attributes {
  return {
    ...(operation.system === undefined ? {} : { 'messaging.system': operation.system }),
    'messaging.operation.name': operation.name,
    'messaging.operation.type': operation.type,
    'messaging.destination.name': event.type,
    'messaging.message.id': event.id,
  };
}
