import { isSpanContextValid, trace } from '@opentelemetry/api';

/**
 * Trace id of the active span. Usable as the correlation id of a log line and as the
 * support reference shown to an end user: it leads straight to the trace.
 */
export function correlationIdFromActiveSpan(): string | undefined {
  const spanContext = trace.getActiveSpan()?.spanContext();

  return spanContext !== undefined && isSpanContextValid(spanContext)
    ? spanContext.traceId
    : undefined;
}
