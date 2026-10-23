import { messagingSystemOf, type IntegrationEvent, type IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { InvalidEventPayloadError } from '../definition/invalid-event-payload-error';
import type { EventRegistry } from '../registry/event-registry';
import { UnknownEventError } from './unknown-event-error';

export interface ValidatingPublisherOptions {
  /** What to do with an event whose type and version are not in the registry. */
  readonly unknown: 'reject' | 'allow';
}

/**
 * Refuses what the registry does not describe. The whole batch is checked before anything
 * is published, so a refused batch leaves no partial publication behind.
 */
export function validatingPublisher(
  publisher: IntegrationEventPublisher,
  registry: EventRegistry,
  options: ValidatingPublisherOptions = { unknown: 'reject' },
): IntegrationEventPublisher {
  const messagingSystem = messagingSystemOf(publisher);

  return {
    async publish(events) {
      for (const event of events) {
        assertDeclared(event, registry, options);
      }

      await publisher.publish(events);
    },
    ...(messagingSystem === undefined ? {} : { messagingSystem }),
  };
}

function assertDeclared(event: IntegrationEvent, registry: EventRegistry, options: ValidatingPublisherOptions): void {
  const definition = registry.get(event.type, event.version);

  if (definition === undefined) {
    if (options.unknown === 'reject') {
      throw new UnknownEventError(event.type, event.version);
    }

    return;
  }

  const parsed = definition.payload.parse(event.payload);

  if (!parsed.ok) {
    throw new InvalidEventPayloadError(event.type, event.version, parsed.error);
  }
}
