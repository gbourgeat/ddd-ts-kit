import { SpanKind, context, trace, type Attributes, type Span } from '@opentelemetry/api';
import type {
  IntegrationEvent,
  IntegrationEventCallback,
  IntegrationEventPublisher,
  IntegrationEventSubscriber,
  Subscription,
} from '@ddd-ts-kit/kernel';
import { markSpanFailed } from './errors.js';
import { contextWithTraceparent, traceparentFromContext } from './propagation.js';
import { tracer } from './tracer.js';

/**
 * Decorates a publisher: one PRODUCER span `publish <type>` per event, and a
 * `traceparent` stamped on every event that has none, so consumers continue the trace.
 * An event that already carries one (an outbox relay publishing later) keeps it, and its
 * span is attached to that original trace.
 */
export function tracedPublisher(publisher: IntegrationEventPublisher): IntegrationEventPublisher {
  return {
    async publish(events: readonly IntegrationEvent[]): Promise<void> {
      const active = context.active();
      const spans: Span[] = [];
      const stamped = events.map((event) => {
        const span = tracer().startSpan(
          `publish ${event.type}`,
          { kind: SpanKind.PRODUCER, attributes: messagingAttributes('publish', event) },
          contextWithTraceparent(active, event.traceparent),
        );
        spans.push(span);
        if (event.traceparent !== undefined) return event;
        const traceparent = traceparentFromContext(trace.setSpan(active, span));
        return traceparent === undefined ? event : { ...event, traceparent };
      });
      try {
        // One call for the whole batch: the provider keeps its atomicity and ordering.
        await publisher.publish(stamped);
      } catch (error) {
        for (const span of spans) markSpanFailed(span, error);
        throw error;
      } finally {
        for (const span of spans) span.end();
      }
    },
  };
}

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

// The payload never becomes an attribute: only the routing key and the event id.
function messagingAttributes(operation: string, event: IntegrationEvent): Attributes {
  return {
    'messaging.operation': operation,
    'messaging.destination.name': event.type,
    'messaging.message.id': event.id,
  };
}
