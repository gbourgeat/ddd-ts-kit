import type { IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { InvalidEventPayloadError } from './definition.js';
import type { EventRegistry } from './registry.js';

export interface ValidatingPublisherOptions {
  /** What to do with an event whose type and version are not in the registry. */
  readonly unknown: 'reject' | 'allow';
}

export class UnknownEventError extends Error {
  readonly code = 'UNKNOWN_EVENT';

  constructor(
    readonly eventType: string,
    readonly eventVersion: number,
  ) {
    super(`Integration event ${eventType} v${eventVersion} is not declared in the registry`);
    this.name = 'UnknownEventError';
  }
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
  return {
    async publish(events) {
      for (const event of events) {
        const definition = registry.get(event.type, event.version);
        if (definition === undefined) {
          if (options.unknown === 'reject') {
            throw new UnknownEventError(event.type, event.version);
          }
          continue;
        }
        const parsed = definition.payload.parse(event.payload);
        if (!parsed.ok) {
          throw new InvalidEventPayloadError(event.type, event.version, parsed.error);
        }
      }
      await publisher.publish(events);
    },
  };
}
