import { errorReportOf, reportOnce, type ErrorReporter } from '@ddd-ts-kit/kernel';
import type { ErrorContext } from './error-context.js';

/**
 * The `onError` hook that reports every request answered as a server fault: an unexpected
 * error, or a `DomainError` whose code the error mapper answers with a 5xx. A refusal (4xx) is
 * an answer and is left alone, and so is a failure a bus middleware already reported.
 *
 *     const options: ExecuteOptions = { onError: reportHttpErrors(errors) };
 */
export function reportHttpErrors(reporter: ErrorReporter): (error: unknown, context: ErrorContext) => void {
  return (error, { problem, operationId, correlationId, execution }) => {
    if (problem.status < 500) return;

    reportOnce(reporter, error, errorReportOf(error, { origin: 'http', operation: operationId, correlationId }, execution));
  };
}
