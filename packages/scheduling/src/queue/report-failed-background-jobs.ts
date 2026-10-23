import { errorReportOf, isUnexpectedError, reportOnce, type ErrorReporter } from '@ddd-ts-kit/kernel';
import type { BackgroundJobObserver } from './background-job-observer';

/**
 * The observer that reports every attempt that failed with something else than a `DomainError`:
 * a timeout, a fault of the job, a job no module registered. An attempt that a bus middleware
 * already reported is left alone, and one that was released or interrupted is no failure.
 *
 *     new QueueWorker({ ..., onRun: reportFailedBackgroundJobs(errors) });
 */
export function reportFailedBackgroundJobs(reporter: ErrorReporter): BackgroundJobObserver {
  return (run, error) => {
    if ((run.outcome !== 'retried' && run.outcome !== 'dead') || !isUnexpectedError(error)) {
      return;
    }

    reportOnce(
      reporter,
      error,
      errorReportOf(error, {
        origin: 'queue',
        operation: run.job,
        context: run.job.split('.', 1).join(''),
        correlationId: run.correlationId,
      }),
    );
  };
}
