import { isSpanContextValid, trace } from '@opentelemetry/api';
import type { ErrorReporter } from '@ddd-ts-kit/kernel';
import { failedTraces } from '../span/failed-traces.js';

/**
 * Decorates an error reporter: a report that names no trace takes the one the failure
 * happened in, so the error tracker leads to the trace. That is the active trace, or, for a
 * failure reported once its spans are over (a job, a buried event), the trace of the span
 * that saw the error first.
 */
export function tracedErrorReporter(reporter: ErrorReporter): ErrorReporter {
  return {
    report(error, report) {
      const traceId = report.traceId ?? traceOf(error);

      reporter.report(error, traceId === undefined ? report : { ...report, traceId });
    },
    flush: (timeoutMs) => reporter.flush(timeoutMs),
  };
}

function traceOf(error: unknown): string | undefined {
  const failedIn = typeof error === 'object' && error !== null ? failedTraces.get(error) : undefined;
  const active = trace.getActiveSpan()?.spanContext();

  return failedIn ?? (active !== undefined && isSpanContextValid(active) ? active.traceId : undefined);
}
