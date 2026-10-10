import { errorReportOf, isUnexpectedError, reportOnce, systemActor, type ErrorReporter } from '@ddd-ts-kit/kernel';
import type { JobRunObserver } from './job-run-observer.js';

/**
 * The observer that reports every run that failed with something else than a `DomainError`:
 * a timeout, a lock that could not be asked, a fault of the job. A run that was skipped or
 * missed is not a failure, and one whose command a bus middleware already reported is left alone.
 *
 *     new InProcessJobScheduler({ ..., onRun: reportFailedRuns(errors) });
 */
export function reportFailedRuns(reporter: ErrorReporter): JobRunObserver {
  return (run, error, detail) => {
    if (run.outcome !== 'failed' || !isUnexpectedError(error)) {
      return;
    }

    reportOnce(
      reporter,
      error,
      errorReportOf(error, {
        origin: 'schedule',
        operation: run.job,
        context: run.job.split('.', 1).join(''),
        actorId: systemActor(run.job).id,
        ...(detail?.correlationId === undefined ? {} : { correlationId: detail.correlationId }),
      }),
    );
  };
}
