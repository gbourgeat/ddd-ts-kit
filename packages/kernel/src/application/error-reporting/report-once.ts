import type { ErrorReporter } from '../ports/error-reporter.js';
import type { ErrorReport } from './error-report.js';

const REPORTED = new WeakSet<object>();
const DEEPEST_CAUSE = 8;

/**
 * Hands a failure to the reporter unless a capture point closer to it already did. The first
 * one to see an error object reports it and marks it; the boundaries it then crosses (a bus,
 * a route, a job, the process) recognise it, also as the `cause` of the error that wraps it or
 * among the `errors` of an `AggregateError`. A thrown value that is not an object cannot be
 * marked. Never throws: a failing reporter must not turn into a second failure.
 */
export function reportOnce(reporter: ErrorReporter, error: unknown, report: ErrorReport): void {
  if (wasReported(error, DEEPEST_CAUSE)) {
    return;
  }

  if (typeof error === 'object' && error !== null) {
    REPORTED.add(error);
  }

  try {
    reporter.report(error, report);
  } catch {
    return;
  }
}

function wasReported(error: unknown, depth: number): boolean {
  if (typeof error !== 'object' || error === null || depth === 0) {
    return false;
  }

  if (REPORTED.has(error)) {
    return true;
  }

  const inner = innerErrors(error);

  return inner.length > 0 && inner.every((one) => wasReported(one, depth - 1));
}

function innerErrors(error: object): unknown[] {
  const aggregated: unknown[] = error instanceof AggregateError ? error.errors : [];

  return 'cause' in error ? [error.cause, ...aggregated] : aggregated;
}
