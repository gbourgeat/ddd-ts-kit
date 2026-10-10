import { errorReportOf } from '../../application/error-reporting/error-report-of.js';
import { isUnexpectedError } from '../../application/error-reporting/is-unexpected-error.js';
import { reportOnce } from '../../application/error-reporting/report-once.js';
import type { BusMiddleware } from '../../application/messaging/bus-middleware.js';
import type { ErrorReporter } from '../../application/ports/error-reporter.js';
import type { ExecutionScope } from '../../application/ports/execution-scope.js';

/**
 * Reports the command or query that fails with something else than a `DomainError`, named
 * after the message class, then lets the failure go on. Put it first on the bus, outside the
 * unit of work, so a failed commit is seen too. Inside a unit of work of origin `event` it stays
 * silent: a failed delivery is retried, which is expected, and the hook of the provider reports
 * the event once it is given up (`DeadLetterReports`).
 */
export function errorReportingMiddleware(
  reporter: ErrorReporter,
  scope?: Pick<ExecutionScope, 'current'>,
): BusMiddleware {
  return async (_message, next, info) => {
    try {
      return await next();
    } catch (error) {
      const execution = scope?.current();

      if (isUnexpectedError(error) && execution?.origin !== 'event') {
        reportOnce(reporter, error, errorReportOf(error, { origin: info.kind, operation: info.name }, execution));
      }

      throw error;
    }
  };
}
