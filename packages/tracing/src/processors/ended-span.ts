import type { Attributes, SpanStatus } from '@opentelemetry/api';

/**
 * The part of an ended SDK span the scrubbing processors touch. Declared here so the root
 * entry depends on `@opentelemetry/api` only; the SDK `ReadableSpan` is assignable to it.
 *
 * Those processors edit the span in `onEnd`. The SDK types a span as read-only at that point
 * and offers no supported way to rewrite an attribute or an event of a span created by someone
 * else (auto-instrumentation). With sdk-trace 3.x the attributes, events and status are
 * plain mutable objects, and exporters read them after every processor ran, so mutating them
 * there is the usual approach. Register these processors BEFORE the exporting one.
 */
export interface EndedSpan {
  attributes: Attributes;
  events: { attributes?: Attributes }[];
  status: SpanStatus;
}
