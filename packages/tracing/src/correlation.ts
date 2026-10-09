import { isSpanContextValid, trace } from '@opentelemetry/api';
import { logFieldsOf, type ExecutionScope, type LogFields } from '@ddd-ts-kit/kernel';
import { tracingConfiguration } from './config.js';

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

export interface TraceLogFields extends LogFields {
  trace_id?: string;
  span_id?: string;
}

/**
 * Fields for a logger mixin (pino `mixin`, winston format...): the trace and span ids inside a
 * span, and, inside the execution scope given here or to `configureTracing`, the log fields of
 * the execution context (`logFieldsOf`: correlation, causation, origin, actor and tenant ids).
 * Empty outside of both.
 */
export function traceLogFields(scope?: ExecutionScope): TraceLogFields {
  const execution = (scope ?? tracingConfiguration().executionScope)?.current();
  const spanContext = trace.getActiveSpan()?.spanContext();
  return {
    ...(execution === undefined ? {} : logFieldsOf(execution)),
    ...(spanContext !== undefined && isSpanContextValid(spanContext)
      ? { trace_id: spanContext.traceId, span_id: spanContext.spanId }
      : {}),
  };
}
