import {
  messagingSystemOf,
  type IntegrationEventCallback,
  type IntegrationEventSubscriber,
  type Subscription,
} from '@ddd-ts-kit/kernel';
import type { ConsumerTrace } from './consumer-trace.js';
import { tracedConsumer } from './traced-consumer.js';

export interface TracedSubscriberOptions {
  /** Default `continue`. */
  readonly trace?: ConsumerTrace;
  /** The transport, when neither the deliveries nor the subscriber (`messagingSystem`) name it. */
  readonly system?: string;
}

/**
 * Decorates a subscriber, for a composition without `kernelModule`: every handler runs in a
 * CONSUMER span `process <type>` (see `tracedConsumer`). That span is a local root, so the
 * per-root cap of dependency spans applies to each delivery separately.
 */
export function tracedSubscriber(
  subscriber: IntegrationEventSubscriber,
  options: TracedSubscriberOptions = {},
): IntegrationEventSubscriber {
  const system = options.system ?? messagingSystemOf(subscriber);

  return {
    subscribe(type: string, handler: IntegrationEventCallback): Subscription {
      return subscriber.subscribe(
        type,
        tracedConsumer(handler, {
          ...(options.trace === undefined ? {} : { trace: options.trace }),
          ...(system === undefined ? {} : { system }),
        }),
      );
    },
  };
}
