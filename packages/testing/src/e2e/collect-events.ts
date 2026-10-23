import type { IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import type { EventRecorder } from './event-recorder';
import type { EventType } from './event-type';
import { SubscribedRecorder } from './subscribed-recorder';

/**
 * Subscribes to the given types and records what is published, to assert integration events
 * from the outside, as another context would see them.
 */
export function collectEvents(subscriber: IntegrationEventSubscriber, types: readonly EventType[]): EventRecorder {
  return new SubscribedRecorder(subscriber, types);
}
