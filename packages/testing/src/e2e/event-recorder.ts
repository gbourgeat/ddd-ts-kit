import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { EventType } from './event-type.js';
import type { EventuallyOptions } from './eventually.js';

export interface EventRecorder {
  /** The events received so far, in order, optionally of one type. */
  received<Payload = unknown>(type?: EventType): IntegrationEvent<Payload>[];
  /** Resolves with the first event of the type that satisfies the predicate, received or to come. */
  waitFor<Payload = unknown>(
    type: EventType,
    predicate?: (event: IntegrationEvent<Payload>) => boolean,
    options?: EventuallyOptions,
  ): Promise<IntegrationEvent<Payload>>;
  /** Unsubscribes. What was received stays readable. */
  stop(): void;
}
