import { isSpanContextValid, type SpanContext } from '@opentelemetry/api';

// Version 00 only, lowercase hex, exact lengths: an event is stored and replayed, so a
// malformed value is dropped instead of being interpreted leniently.
const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

/** Parses a `traceparent`. Returns undefined for anything malformed or all-zero ids. */
export function spanContextFromTraceparent(traceparent: string): SpanContext | undefined {
  const match = TRACEPARENT.exec(traceparent);

  if (match === null) return undefined;

  const [, traceId, spanId, flags] = match;

  if (traceId === undefined || spanId === undefined || flags === undefined) return undefined;

  const spanContext: SpanContext = {
    traceId,
    spanId,
    traceFlags: Number.parseInt(flags, 16),
    isRemote: true,
  };

  return isSpanContextValid(spanContext) ? spanContext : undefined;
}
