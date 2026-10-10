import { isSpanContextValid, trace, type Context } from '@opentelemetry/api';

/** W3C `traceparent` of the span carried by `ctx`, if any. */
export function traceparentFromContext(ctx: Context): string | undefined {
  const spanContext = trace.getSpanContext(ctx);

  if (spanContext === undefined || !isSpanContextValid(spanContext)) {
    return undefined;
  }

  const flags = (spanContext.traceFlags & 0xff).toString(16).padStart(2, '0');

  return `00-${spanContext.traceId}-${spanContext.spanId}-${flags}`;
}
