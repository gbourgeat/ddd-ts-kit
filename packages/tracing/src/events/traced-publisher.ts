import { SpanKind, context, trace, type Context, type Span } from '@opentelemetry/api';
import { messagingSystemOf, type IntegrationEvent, type IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { admitDependencySpan } from '../local-root/admit-dependency-span.js';
import { contextWithTraceparent } from '../propagation/context-with-traceparent.js';
import { traceparentFromContext } from '../propagation/traceparent-from-context.js';
import { markSpanFailed } from '../span/mark-span-failed.js';
import { tracer } from '../span/tracer.js';
import { messagingAttributes, type MessagingOperation } from './messaging-attributes.js';

export interface TracedPublisherOptions {
  /** The transport, when the publisher does not name it itself (`messagingSystem`). `outbox` for one that only stores. */
  readonly system?: string;
}

interface Publication {
  readonly event: IntegrationEvent;
  /** Absent once the cap of the local root is reached: the event still carries the trace on. */
  readonly span?: Span;
}

const OUTBOX = 'outbox';

/**
 * Decorates a publisher: one span per event, and its `traceparent` stamped on what goes out,
 * so whatever handles the event next is a child of that span.
 *
 * A publisher that sends (`publish <type>`, PRODUCER) continues the trace the event already
 * names: an outbox relay publishing later, from a timer and outside of any request, attaches
 * its span to the trace of the request that stored the event, never to its own loop. A
 * publisher that only stores (`outbox append <type>`, the operation `create`) is where that
 * context is captured, inside the request. An event without `traceparent` continues the
 * active span. The spans count against the caps of the local root: past them an event goes
 * out without a span of its own, still naming the trace.
 */
export function tracedPublisher(
  publisher: IntegrationEventPublisher,
  options: TracedPublisherOptions = {},
): IntegrationEventPublisher {
  const system = options.system ?? messagingSystemOf(publisher);

  return {
    async publish(events: readonly IntegrationEvent[]): Promise<void> {
      const active = context.active();
      const publications = events.map((event) => publicationOf(event, active, system));
      const spans = publications.flatMap(({ span }) => span ?? []);

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

function publicationOf(event: IntegrationEvent, active: Context, system: string | undefined): Publication {
  const parent = contextWithTraceparent(active, event.traceparent);
  const stored = system === OUTBOX;
  const name = stored ? `outbox append ${event.type}` : `publish ${event.type}`;

  if (!admitDependencySpan(name)) return { event: stamped(event, parent) };

  const operation: MessagingOperation = stored ? { name: 'append', type: 'create', system } : { name: 'publish', type: 'send', system };
  const options = { kind: stored ? SpanKind.INTERNAL : SpanKind.PRODUCER, attributes: messagingAttributes(operation, event) };
  const span = tracer().startSpan(name, options, parent);

  return { event: stamped(event, trace.setSpan(parent, span)), span };
}

/** The event naming the span carried by the context, or as it is when there is none. */
function stamped(event: IntegrationEvent, from: Context): IntegrationEvent {
  const traceparent = traceparentFromContext(from);

  return traceparent === undefined ? event : { ...event, traceparent };
}
