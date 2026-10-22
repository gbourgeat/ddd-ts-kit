import { isSpanContextValid, trace } from '@opentelemetry/api';
import { logFieldsOf, type ExecutionScope, type LogFields } from '@ddd-ts-kit/kernel';
import { tracingConfiguration } from '../configuration/configure-tracing';

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
