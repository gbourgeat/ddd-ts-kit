import type { AfterCommitFailure } from '../../application/events/after-commit-failure.js';
import { errorReportOf } from '../../application/error-reporting/error-report-of.js';
import { reportOnce } from '../../application/error-reporting/report-once.js';
import { identifyError } from '../../application/logging/identify-error.js';
import type { ErrorReporter } from '../../application/ports/error-reporter.js';
import type { ExecutionScope } from '../../application/ports/execution-scope.js';
import type { Logger } from '../../application/ports/logger.js';

export interface AfterCommitFailureSinks {
  readonly reporter: ErrorReporter;
  readonly logger: Pick<Logger, 'error'>;
  readonly scope?: Pick<ExecutionScope, 'current'>;
}

/**
 * What a dispatcher does with the failure of an `after-commit` handler: one error entry naming
 * the event and the class of the error, and the error handed to the reporter, under the
 * operation `after-commit <event name>`. The state is committed: the failure goes no further.
 */
export function reportAfterCommitFailures({ reporter, logger, scope }: AfterCommitFailureSinks): AfterCommitFailure {
  return (error, event) => {
    const operation = `after-commit ${event.name}`;

    logger.error('A domain event handler failed after the commit', { domainEvent: event.name, ...identifyError(error) });
    reportOnce(reporter, error, errorReportOf(error, { origin: 'domain-event', operation }, scope?.current()));
  };
}
