import {
  context,
  isSpanContextValid,
  trace,
  type Context,
  type SpanContext,
} from '@opentelemetry/api';

// Version 00 only, lowercase hex, exact lengths: an event is stored and replayed, so a
// malformed value is dropped instead of being interpreted leniently.
const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

/** W3C `traceparent` of the span carried by `ctx`, if any. */
export function traceparentFromContext(ctx: Context): string | undefined {
  const spanContext = trace.getSpanContext(ctx);
  if (spanContext === undefined || !isSpanContextValid(spanContext)) return undefined;
  const flags = (spanContext.traceFlags & 0xff).toString(16).padStart(2, '0');
  return `00-${spanContext.traceId}-${spanContext.spanId}-${flags}`;
}

/** W3C `traceparent` of the active span, to store on an outgoing message. */
export function captureTraceparent(): string | undefined {
  return traceparentFromContext(context.active());
}

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

/** `base` with the remote span as parent, or `base` itself when there is none. */
export function contextWithTraceparent(base: Context, traceparent: string | undefined): Context {
  const remote = traceparent === undefined ? undefined : spanContextFromTraceparent(traceparent);
  return remote === undefined ? base : trace.setSpanContext(base, remote);
}

/**
 * Runs `fn` so that spans it starts continue the trace named by `traceparent`. With a
 * missing or malformed value, `fn` runs in the current context.
 */
export function runWithTraceparent<T>(traceparent: string | undefined, fn: () => T): T {
  return context.with(contextWithTraceparent(context.active(), traceparent), fn);
}
