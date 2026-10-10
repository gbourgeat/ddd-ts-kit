import { isSpanContextValid, trace } from '@opentelemetry/api';

export interface ActiveTrace {
  readonly traceId: string;
  readonly spanId?: string;
}

/**
 * The trace an event belongs to: the active OpenTelemetry span when there is one, whoever
 * owns the tracer provider, else the trace id the capture point knew.
 */
export function activeTrace(reportedTraceId: string | undefined): ActiveTrace | undefined {
  const spanContext = trace.getActiveSpan()?.spanContext();

  if (spanContext !== undefined && isSpanContextValid(spanContext)) {
    return { traceId: spanContext.traceId, spanId: spanContext.spanId };
  }

  return reportedTraceId === undefined ? undefined : { traceId: reportedTraceId };
}
