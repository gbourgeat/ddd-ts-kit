import { SpanKind, context, trace, type Context, type Span } from '@opentelemetry/api';
import type { IntegrationEvent, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { contextWithTraceparent } from '../propagation/context-with-traceparent.js';
import { traceparentFromContext } from '../propagation/traceparent-from-context.js';
import { markSpanFailed } from '../span/mark-span-failed.js';
import { tracer } from '../span/tracer.js';
import { messagingAttributes } from './messaging-attributes.js';

interface Publication {
  readonly event: IntegrationEvent;
  readonly span: Span;
}

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
      const publications = events.map((event) => publicationOf(event, active));
      const spans = publications.map(({ span }) => span);

      try {
        // One call for the whole batch: the provider keeps its atomicity and ordering.
        await publisher.publish(publications.map(({ event }) => event));
      } catch (error) {
        for (const span of spans) markSpanFailed(span, error);

        throw error;
      } finally {
        for (const span of spans) span.end();
      }
    },
  };
}

function publicationOf(event: IntegrationEvent, active: Context): Publication {
  const span = tracer().startSpan(
    `publish ${event.type}`,
    { kind: SpanKind.PRODUCER, attributes: messagingAttributes('publish', event) },
    contextWithTraceparent(active, event.traceparent),
  );

  if (event.traceparent !== undefined) return { event, span };

  const traceparent = traceparentFromContext(trace.setSpan(active, span));

  return { event: traceparent === undefined ? event : { ...event, traceparent }, span };
}
