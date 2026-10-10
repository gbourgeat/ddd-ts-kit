import { SpanKind, context, trace } from '@opentelemetry/api';
import type {
  IntegrationEventCallback,
  IntegrationEventSubscriber,
  Subscription,
} from '@ddd-ts-kit/kernel';
import { contextWithTraceparent } from '../propagation/context-with-traceparent.js';
import { markSpanFailed } from '../span/mark-span-failed.js';
import { tracer } from '../span/tracer.js';
import { messagingAttributes } from './messaging-attributes.js';

/**
 * Decorates a subscriber: every handler runs in a CONSUMER span `process <type>` whose
 * parent is the event's `traceparent`. That span is a local root, so the per-root cap of
 * dependency spans applies to each message separately.
 */
export function tracedSubscriber(subscriber: IntegrationEventSubscriber): IntegrationEventSubscriber {
  return {
    subscribe(type: string, handler: IntegrationEventCallback): Subscription {
      return subscriber.subscribe(type, async (event) => {
        const parent = contextWithTraceparent(context.active(), event.traceparent);

        const span = tracer().startSpan(
          `process ${event.type}`,
          { kind: SpanKind.CONSUMER, attributes: messagingAttributes('process', event) },
          parent,
        );

        try {
          await context.with(trace.setSpan(parent, span), () => handler(event));
        } catch (error) {
          markSpanFailed(span, error);

          throw error;
        } finally {
          span.end();
        }
      });
    },
  };
}
